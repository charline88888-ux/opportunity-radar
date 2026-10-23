"""本地控制台后端（data-v0.7.0）：用标准库给网页提供「一键更新 / 采集 / 构建 / 定时任务」能力。

设计约束（docs/12 §1.8）：
- 只绑定 `127.0.0.1`，不上公网；启动生成随机 token 写仓库根 `.radar-console-token`（gitignore）；
- 静态服务优先 `current/index.html`（工作副本）→ `app/dist/index.html` → 最新 `releases/*/dist/index.html`；
  无构建返回 503 + 引导文案；路径穿越一律拒绝；
- API 除 `/api/health` 外都要求 header `X-Radar-Token`；校验 Origin 仅限 127.0.0.1/localhost；
- 单任务并发：忙时 `POST /api/run` 返回 409；任务后台线程执行、stdout/stderr 进内存环形日志；
- 每次 API 调用写 `scanner/logs/console.log`（不含 token）。

用法：
    python scanner/serve.py                      # 默认 127.0.0.1:8787，生成 token 到 .radar-console-token
    python scanner/serve.py --port 8788 --open   # 打开 http://127.0.0.1:8788/#/control?token=<token>
    python scanner/serve.py --token-file .radar-console-token
"""
from __future__ import annotations

import argparse
import csv
import html
import io
import json
import locale
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from collections import deque
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, unquote, urlparse

if __package__ in (None, ""):  # 支持 python scanner/serve.py 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import config  # noqa: E402
else:  # pragma: no cover
    from . import config

ROOT = Path(__file__).resolve().parent.parent
TOKEN_HEADER = "X-Radar-Token"
TASK_NAMES = ("update", "fetch", "build")
JOB_STATE_RUNNING = "running"
LOG_DIRNAME = "logs"
CONSOLE_LOG_NAME = "console.log"
ALERT_FILE_NAME = "ALERT.txt"
TASK_NAME = "OpportunityRadar-Daily"
JOB_LOG_MAX_LINES = 4000
JOB_TAIL_LINES = 200
MAX_LOG_BYTES = 200 * 1024
LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}
LLM_SAFE_CHARS = re.compile(r"[^A-Za-z0-9_\-./]")


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def read_version(root: Path) -> str:
    version_file = root / "VERSION"
    try:
        text = version_file.read_text(encoding="utf-8").strip()
        if text:
            return text.splitlines()[0].strip()
    except OSError:
        pass
    return getattr(config, "DATA_VERSION", "0.0.0")


# ---------------------------------------------------------------- 任务与日志
class Job:
    def __init__(self, task: str) -> None:
        self.id = uuid.uuid4().hex[:12]
        self.task = task
        self.state = JOB_STATE_RUNNING
        self.started_at = now_iso()
        self.finished_at: str | None = None
        self.exit_code: int | None = None
        self._lines: deque[str] = deque(maxlen=JOB_LOG_MAX_LINES)
        self._lock = threading.Lock()
        self._done = threading.Event()

    def emit(self, line: str) -> None:
        with self._lock:
            for piece in str(line).replace("\r\n", "\n").replace("\r", "\n").split("\n"):
                if piece:
                    self._lines.append(piece)

    def finish(self, exit_code: int) -> None:
        with self._lock:
            self.state = "ok" if exit_code == 0 else "failed"
            self.exit_code = exit_code
            self.finished_at = now_iso()
        self._done.set()

    def wait(self, timeout: float | None = None) -> bool:
        return self._done.wait(timeout)

    def log_tail(self, limit: int = JOB_TAIL_LINES) -> list[str]:
        with self._lock:
            return list(self._lines)[-limit:]

    def summary(self) -> dict[str, Any]:
        with self._lock:
            return {
                "id": self.id,
                "task": self.task,
                "state": self.state,
                "started_at": self.started_at,
                "finished_at": self.finished_at,
                "exit_code": self.exit_code,
                "log_tail": list(self._lines)[-JOB_TAIL_LINES:],
            }


Executor = Callable[[str, Callable[[str], None]], int]


def default_executor(root: Path, task: str, emit: Callable[[str], None]) -> int:
    """执行任务：update=daily-run.ps1；fetch=pipeline --fetch；build=pnpm build + 复制 current。"""
    if task == "update":
        return _stream_command(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(root / "scripts" / "daily-run.ps1"),
            ],
            cwd=root,
            emit=emit,
        )
    if task == "fetch":
        return _stream_command(
            [sys.executable, str(root / "scanner" / "pipeline.py"), "--fetch"],
            cwd=root,
            emit=emit,
        )
    if task == "build":
        code = _stream_command(_pnpm_command() + ["build"], cwd=root / "app", emit=emit)
        if code != 0:
            return code
        dist = root / "app" / "dist" / "index.html"
        if not dist.exists():
            emit("[build] 未找到 app/dist/index.html")
            return 1
        current = root / "current"
        current.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(dist, current / "index.html")
        (current / "README.txt").write_text(
            "机会雷达 · 本地工作副本\n"
            f"generated_at: {now_iso()}\n"
            "打开: current/index.html\n"
            "提示: 本目录由本地控制台 / scripts/daily-run.ps1 生成，不进入 git/发布\n",
            encoding="utf-8",
        )
        emit("[build] 已复制 app/dist/index.html → current/index.html")
        return 0
    emit(f"[job] 未知任务 {task}")
    return 2


def _pnpm_command() -> list[str]:
    for name in ("pnpm.cmd", "pnpm.exe", "pnpm"):
        found = shutil.which(name)
        if found:
            return [found]
    return ["pnpm"]


def _stream_command(args: list[str], cwd: Path, emit: Callable[[str], None]) -> int:
    emit(f"$ {' '.join(str(item) for item in args)}")
    try:
        process = subprocess.Popen(
            args,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            shell=False,
        )
    except FileNotFoundError as exc:
        emit(f"[job] 无法启动命令：{exc}")
        return 127
    assert process.stdout is not None
    for raw_line in process.stdout:
        emit(_decode_locale(raw_line).rstrip("\n"))
    code = process.wait()
    emit(f"[job] 退出码 {code}")
    return int(code)


class JobManager:
    """同一时刻只允许一个任务；最近任务保留供状态查询。"""

    def __init__(self, executor: Executor) -> None:
        self._executor = executor
        self._lock = threading.Lock()
        self._jobs: dict[str, Job] = {}
        self._current: Job | None = None
        self._order: deque[str] = deque(maxlen=20)

    def current(self) -> dict[str, Any] | None:
        with self._lock:
            return self._current.summary() if self._current else None

    def busy(self) -> bool:
        with self._lock:
            return self._current is not None

    def submit(self, task: str) -> Job | None:
        job = Job(task)
        with self._lock:
            if self._current is not None:
                return None
            self._current = job
            self._jobs[job.id] = job
            self._order.append(job.id)
        thread = threading.Thread(target=self._run, args=(job,), name=f"radar-{task}", daemon=True)
        thread.start()
        return job

    def _run(self, job: Job) -> None:
        exit_code = 1
        try:
            exit_code = int(self._executor(job.task, job.emit))
        except Exception as exc:  # noqa: BLE001 - 后台任务异常必须落到任务状态里
            job.emit(f"[job] 执行异常：{type(exc).__name__}: {exc}")
            exit_code = 1
        finally:
            job.finish(exit_code)
            job.wait()
            with self._lock:
                if self._current is job:
                    self._current = None

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def recent(self, limit: int = 5) -> list[dict[str, Any]]:
        with self._lock:
            ids = list(self._order)[-limit:][::-1]
            return [self._jobs[job_id].summary() for job_id in ids if job_id in self._jobs]


# ---------------------------------------------------------------- 应用状态
class ConsoleApp:
    """无 HTTP 依赖的状态/文件服务，便于单测。"""

    def __init__(
        self,
        root: Path,
        token: str,
        *,
        port: int = 0,
        executor: Executor | None = None,
        installer: Callable[[str, bool], dict[str, Any]] | None = None,
    ) -> None:
        self.root = Path(root).resolve()
        self.token = token
        self.port = port
        self.started_at = now_iso()
        self.version = read_version(self.root)
        self.log_dir = self.root / "scanner" / LOG_DIRNAME
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.console_log = self.log_dir / CONSOLE_LOG_NAME
        self.jobs = JobManager(lambda task, emit: (executor or (lambda t, e: default_executor(self.root, t, e)))(task, emit))
        self._installer = installer
        self._log_lock = threading.Lock()

    # -------------------------------------------------- 记录 API
    def record(self, method: str, path: str, status: int) -> None:
        safe_path = path.split("?", 1)[0]
        line = f"[{now_iso()}] {method} {safe_path} -> {status}\n"
        try:
            with self._log_lock:
                with self.console_log.open("a", encoding="utf-8") as handle:
                    handle.write(line)
        except OSError:
            pass

    # -------------------------------------------------- 状态
    def status(self) -> dict[str, Any]:
        data = self._data_summary()
        schedule = self.schedule_status()
        alert_path = self.log_dir / ALERT_FILE_NAME
        alert = {"exists": alert_path.exists(), "content": ""}
        if alert_path.exists():
            alert["content"] = _tail_text(alert_path, 4000)
        return {
            "ok": True,
            "server": {"version": self.version, "started_at": self.started_at, "port": self.port},
            "data": data,
            "schedule": schedule,
            "alert": alert,
            "jobs": self.jobs.recent(5),
            "logs": self.list_logs(10),
        }

    def _data_summary(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "as_of": None,
            "data_version": None,
            "opportunities": 0,
            "counts": {},
            "current_build": None,
            "frozen_latest": None,
        }
        rankings = _load_json(self.root / "data" / "rankings.json")
        if rankings:
            meta = rankings.get("meta") or {}
            data["as_of"] = meta.get("as_of")
            data["data_version"] = meta.get("data_version")
            data["counts"] = meta.get("counts") or {}
        stats = _load_json(self.root / "data" / "stats.json")
        if stats:
            kpi = stats.get("kpi") or {}
            data["opportunities"] = kpi.get("total_opps", 0)
            data["data_version"] = data["data_version"] or (stats.get("meta") or {}).get("data_version")
        build = self.build_root()
        if build is not None:
            index = build / "index.html"
            data["current_build"] = {
                "path": _relative(self.root, index),
                "size": index.stat().st_size,
                "mtime": _mtime_iso(index),
            }
        frozen_version, frozen_index = self._frozen_latest()
        if frozen_index is not None:
            data["frozen_latest"] = {
                "version": frozen_version,
                "size": frozen_index.stat().st_size,
                "mtime": _mtime_iso(frozen_index),
            }
        return data

    # 动作后重新查询状态的等待/重试（v0.7.0 修复 enable 后状态不同步；单测可置 0）
    schedule_refresh_delay = 0.4
    schedule_refresh_attempts = 6

    def schedule_status(self) -> dict[str, Any]:
        """以 `schtasks /Query /TN <name> /V /FO CSV /NH` 为准（中英文系统通用）。

        返回 `{task_name,enabled,status,status_raw,next_run,last_run,last_result}`；
        任务不存在 → `status="not_installed"`；输出无法解析 → `status="unknown"` 但不崩溃。
        """
        result: dict[str, Any] = {
            "task_name": TASK_NAME,
            "enabled": False,
            "status": "unknown",
            "status_raw": None,
            "next_run": None,
            "last_run": None,
            "last_result": None,
        }
        code, output = _run_capture(
            ["schtasks", "/Query", "/TN", TASK_NAME, "/V", "/FO", "CSV", "/NH"],
            timeout=8,
        )
        if code != 0:
            result["status"] = "not_installed"
            return result
        parsed = _parse_schtasks_csv(output)
        if not parsed:
            return result
        status_text = str(parsed.get("status") or "")
        disabled = any(marker in status_text for marker in DISABLED_STATUS_MARKERS)
        status = "disabled" if disabled else ("ready" if parsed.get("next_run") else "installed")
        result.update(
            {
                "task_name": parsed.get("task_name") or TASK_NAME,
                "enabled": not disabled,
                "status": status,
                "status_raw": status_text or None,
                "next_run": parsed.get("next_run"),
                "last_run": parsed.get("last_run"),
                "last_result": parsed.get("last_result"),
            }
        )
        return result

    def schedule_status_after_action(self, action: str) -> dict[str, Any]:
        """enable/disable 后 sleep 并重查，直到状态收敛或重试耗尽；返回最新状态。"""
        status = self.schedule_status()
        attempts = max(1, int(getattr(self, "schedule_refresh_attempts", 6)))
        delay = max(0.0, float(getattr(self, "schedule_refresh_delay", 0.4)))
        for _ in range(attempts - 1):
            if action == "enable":
                converged = bool(status.get("enabled"))
            else:
                converged = status.get("status") in ("not_installed", "disabled")
            if converged:
                break
            if delay:
                time.sleep(delay)
            status = self.schedule_status()
        return status

    # -------------------------------------------------- 静态构建
    def build_root(self) -> Path | None:
        candidates = [self.root / "current", self.root / "app" / "dist"]
        candidates.extend(sorted((self.root / "releases").glob("*/dist"), reverse=True))
        for candidate in candidates:
            if (candidate / "index.html").exists():
                return candidate
        return None

    def _frozen_latest(self) -> tuple[str | None, Path | None]:
        releases = self.root / "releases"
        if not releases.is_dir():
            return None, None
        versions = [item for item in releases.iterdir() if item.is_dir() and (item / "dist" / "index.html").exists()]
        if not versions:
            return None, None

        def sort_key(path: Path) -> tuple:
            parts = re.findall(r"\d+", path.name)
            return tuple(int(part) for part in parts) if parts else (0,)

        latest = max(versions, key=sort_key)
        return latest.name, latest / "dist" / "index.html"

    def resolve_static(self, raw_path: str) -> tuple[Path | None, int, str]:
        """返回 (文件, HTTP 状态, 提示)。403=越界，404=不存在，503=无构建。"""
        build = self.build_root()
        if build is None:
            return None, 503, "no-build"
        path = unquote(raw_path)
        if "\x00" in path:
            return None, 403, "bad-path"
        relative = path.lstrip("/")
        if relative in ("", "/"):
            relative = "index.html"
        candidate = (build / relative).resolve()
        try:
            candidate.relative_to(build.resolve())
        except ValueError:
            return None, 403, "forbidden"
        if candidate.is_dir():
            candidate = candidate / "index.html"
        if candidate.is_file():
            return candidate, 200, ""
        if "." not in Path(relative).name:  # SPA 深链回退到 index.html（file:// 静态路由用）
            index = build / "index.html"
            if index.is_file():
                return index, 200, ""
        return None, 404, "not-found"

    # -------------------------------------------------- 日志
    def list_logs(self, limit: int = 10) -> list[dict[str, Any]]:
        rows = []
        if self.log_dir.is_dir():
            files = [item for item in self.log_dir.iterdir() if item.is_file() and item.suffix.lower() in (".log", ".txt")]
            files.sort(key=lambda item: item.stat().st_mtime, reverse=True)
            for item in files[:limit]:
                stat = item.stat()
                rows.append({"name": item.name, "size": stat.st_size, "mtime": _mtime_iso(item)})
        return rows

    def read_log(self, name: str) -> tuple[str | None, int, str]:
        if not name or name != Path(name).name or name in (".", "..") or "/" in name or "\\" in name:
            return None, 400, "非法日志名"
        target = (self.log_dir / name).resolve()
        try:
            target.relative_to(self.log_dir.resolve())
        except ValueError:
            return None, 403, "路径越界"
        if not target.is_file() or target.suffix.lower() not in (".log", ".txt"):
            return None, 404, "日志不存在"
        text = _tail_text(target, MAX_LOG_BYTES)
        return text, 200, ""

    # -------------------------------------------------- 定时任务
    def run_installer(self, action: str, fetch: bool) -> dict[str, Any]:
        if self._installer is not None:
            return self._installer(action, fetch)
        script = self.root / "scripts" / "install-daily-task.ps1"
        if not script.exists():
            return {"ok": False, "error": "scripts/install-daily-task.ps1 不存在", "exit_code": 127}
        args = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script),
        ]
        if action == "enable" and fetch:
            args.append("-Fetch")
        if action == "disable":
            # v0.7.0 P2 修复：任务本就不存在时，schtasks -Uninstall 会 exit1；
            # 此时目标状态（未安装/已停用）已达成，按成功返回而不是 500。
            if self.schedule_status().get("status") == "not_installed":
                return {"ok": True, "exit_code": 0, "output": "计划任务未安装，无需停用（视为已停用）", "already": True}
            args.append("-Uninstall")
        code, output = _run_capture(args, timeout=60)
        if action == "disable" and code != 0 and _missing_task_output(output):
            return {
                "ok": True,
                "exit_code": 0,
                "output": _tail_text_str(output, 8000),
                "already": True,
                "note": "计划任务不存在，按已停用处理（P2 幂等修复）",
            }
        return {"ok": code == 0, "exit_code": code, "output": _tail_text_str(output, 8000)}


# ---------------------------------------------------------------- HTTP
class ConsoleHandler(BaseHTTPRequestHandler):
    app: ConsoleApp
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args: Any) -> None:  # 静默 stderr
        return

    # -------------------------------------------------- 基础
    def _record(self, status: int) -> None:
        """先记录再发送：保证客户端收到响应时 console.log 已落盘（测试/审计可依赖）。"""
        self.app.record(self.command, self.path, status)

    def _send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._record(status)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _send_text(self, text: str, status: int = 200, content_type: str = "text/plain; charset=utf-8") -> None:
        body = text.encode("utf-8")
        self._record(status)
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _origin_ok(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            return True
        try:
            host = (urlparse(origin).hostname or "").lower()
        except ValueError:
            return False
        if host in LOOPBACK_HOSTS:
            return True
        forwarded = self.headers.get("X-Forwarded-Host")
        return bool(forwarded) and forwarded.split(":")[0].lower() in LOOPBACK_HOSTS

    def _authorized(self) -> bool:
        supplied = self.headers.get(TOKEN_HEADER) or ""
        return bool(supplied) and secrets.compare_digest(supplied, self.app.token)

    def _body_json(self) -> dict[str, Any] | None:
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return None
        if length > 1_000_000:
            return None
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None
        return payload if isinstance(payload, dict) else None

    def _guard(self, require_token: bool = True) -> bool:
        if not self._origin_ok():
            self._send_json({"ok": False, "error": "origin 不被允许（仅 127.0.0.1/localhost）"}, 403)
            return False
        if require_token and not self._authorized():
            self._send_json({"ok": False, "error": "缺少或错误的 X-Radar-Token"}, 401)
            return False
        return True

    # -------------------------------------------------- 路由
    def do_GET(self) -> None:  # noqa: N802 - http.server 约定
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        if path == "/api/health":
            # v0.7.0 P2 修复：health 免 token，但仍统一校验 Origin（与其余 API 一致）
            if not self._origin_ok():
                self._send_json({"ok": False, "error": "origin 不被允许（仅 127.0.0.1/localhost）"}, 403)
                return
            self._send_json({"ok": True, "version": self.app.version, "port": self.app.port})
            return
        if path.startswith("/api/"):
            if not self._guard():
                return
            if path == "/api/status":
                self._send_json(self.app.status())
            elif path == "/api/job":
                job_id = (query.get("id") or [""])[0]
                job = self.app.jobs.get(job_id) if job_id else None
                if job is None:
                    self._send_json({"ok": False, "error": "job 不存在"}, 404)
                else:
                    self._send_json({"ok": True, "job": job.summary()})
            elif path == "/api/logs":
                self._send_json({"ok": True, "logs": self.app.list_logs(10)})
            elif path == "/api/log":
                name = (query.get("name") or [""])[0]
                text, status, error = self.app.read_log(name)
                if text is None:
                    self._send_json({"ok": False, "error": error}, status)
                elif "text" in (query.get("format") or []):
                    self._send_text(text)
                else:
                    self._send_json({"ok": True, "name": name, "text": text, "size": len(text.encode("utf-8"))})
            else:
                self._send_json({"ok": False, "error": "未知 API"}, 404)
            return
        if not self._guard(require_token=False):
            return
        if self.command not in ("GET", "HEAD"):
            self._send_json({"ok": False, "error": "method not allowed"}, 405)
            return
        candidate, status, reason = self.app.resolve_static(path)
        if candidate is None:
            if status == 503:
                self._send_guidance()
            else:
                self._send_json({"ok": False, "error": reason}, status)
            return
        try:
            body = candidate.read_bytes()
        except OSError:
            self._send_json({"ok": False, "error": "读取文件失败"}, 500)
            return
        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        # v0.7.0：index.html 注入本次随机 token（仅内存响应，不写日志），
        # 让自启动后直接访问 http://127.0.0.1:<port>/ 也能使用控制台。
        if candidate.name == "index.html" and (content_type or "").startswith("text/html"):
            body = _inject_console_token(body, self.app.token)
            content_type = "text/html"
        self._record(200)
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8" if content_type.startswith("text/") else content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            self._send_json({"ok": False, "error": "not found"}, 404)
            return
        if not self._guard():
            return
        payload = self._body_json()
        if payload is None:
            self._send_json({"ok": False, "error": "请求体必须是 JSON 对象"}, 400)
            return
        if path == "/api/run":
            task = str(payload.get("task") or "")
            if task not in TASK_NAMES:
                self._send_json({"ok": False, "error": f"task 必须是 {list(TASK_NAMES)} 之一"}, 400)
                return
            job = self.app.jobs.submit(task)
            if job is None:
                self._send_json({"ok": False, "error": "已有任务在运行，请稍后再试", "job": self.app.jobs.current()}, 409)
                return
            self._send_json({"ok": True, "job_id": job.id, "task": task}, 202)
            return
        if path == "/api/schedule":
            action = str(payload.get("action") or "")
            if action not in ("enable", "disable"):
                self._send_json({"ok": False, "error": "action 必须是 enable|disable"}, 400)
                return
            fetch = payload.get("fetch")
            if fetch is not None and not isinstance(fetch, bool):
                self._send_json({"ok": False, "error": "fetch 必须是布尔值"}, 400)
                return
            result = self.app.run_installer(action, bool(fetch))
            latest = self.app.schedule_status_after_action(action)
            response = {"ok": bool(result.get("ok")), "action": action, **result, "schedule": latest}
            self._send_json(response, 200 if response["ok"] else 500)
            return
        self._send_json({"ok": False, "error": "未知 API"}, 404)

    def _send_guidance(self) -> None:
        body = (
            "<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><title>机会雷达 · 本地控制台</title>"
            "<style>body{font-family:system-ui,'Segoe UI',sans-serif;max-width:720px;margin:48px auto;line-height:1.7;color:#1f2430;padding:0 20px}"
            "code{background:#f1f5f9;padding:2px 6px;border-radius:4px}</style></head><body>"
            "<h1>本地控制台已启动，但还没有可用构建</h1>"
            "<p>请先执行以下任一操作，然后刷新本页：</p><ul>"
            "<li>双击仓库根目录 <code>启动机会雷达.bat</code>（若存在）</li>"
            "<li>运行 <code>python scanner/serve.py --open</code> 后，在控制台点击「立即更新数据」或「构建工作副本」</li>"
            "<li>或手动运行 <code>python scanner/pipeline.py --all &amp;&amp; cd app &amp;&amp; pnpm build</code></li>"
            "</ul><p>说明：本页由 <code>scanner/serve.py</code> 提供；线上静态页（GitHub Pages）无法执行本地更新，"
            "这是浏览器安全限制，不是故障。</p></body></html>"
        )
        self._send_text(body, 503, "text/html; charset=utf-8")


# ---------------------------------------------------------------- 工具
MISSING_TASK_MARKERS = (
    "cannot find",
    "找不到",
    "无法找到",
    "不存在",
    "no such",
    "does not exist",
    "not exist",
    "未安装",
)
DISABLED_STATUS_MARKERS = ("Disabled", "已禁用", "禁用")
_NOT_AVAILABLE_VALUES = {"", "N/A", "n/a", "NA", "不可用", "无", "不适用", "--", "-"}


def _missing_task_output(output: str) -> bool:
    """schtasks/卸载脚本在「任务不存在」时的输出特征（用于把 disable 幂等映射为成功）。"""
    lowered = (output or "").lower()
    return any(marker in lowered for marker in MISSING_TASK_MARKERS)


def _decode_locale(raw: bytes) -> str:
    """Windows 子进程输出解码：优先严格 UTF-8，失败再用本地 ANSI/mbcs/GBK，最后 replace。

    schtasks/PowerShell 在中文 Windows 上输出 GBK（非 UTF-8）；而 PowerShell 7/部分工具
    可能输出 UTF-8。先试 UTF-8 严格解码，可避免把合法 UTF-8 当成 GBK 解出乱码。
    """
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        pass
    encodings: list[str] = []
    if os.name == "nt":
        encodings.extend(["mbcs", "gbk", "cp936"])
    preferred = locale.getpreferredencoding(False)
    if preferred:
        encodings.append(preferred)
    encodings.extend(["gbk", "utf-8"])
    seen: set[str] = set()
    for encoding in encodings:
        key = encoding.lower()
        if key in seen or key == "utf-8":
            continue
        seen.add(key)
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="replace")


def _parse_schtasks_csv(output: str) -> dict[str, Any] | None:
    """解析 `schtasks /Query /V /FO CSV /NH` 输出（中英文系统适用；列顺序稳定）。

    预期列：HostName, TaskName, Next Run Time, Status, Logon Mode, Last Run Time, Last Result, ...
    兼容无 -V 的 3 列输出；坏输出返回 None（不崩溃）。
    """
    try:
        rows = [
            row
            for row in csv.reader(io.StringIO(output or ""))
            if row and any((cell or "").strip() for cell in row)
        ]
    except csv.Error:
        return None
    if not rows:
        return None
    row = rows[0]

    def clean(value: str | None) -> str | None:
        text = (value or "").strip()
        return None if text in _NOT_AVAILABLE_VALUES else text

    if len(row) >= 7:
        task_name, next_run, status, last_run, last_result = row[1], row[2], row[3], row[5], row[6]
    elif len(row) >= 3:
        task_name, next_run, status, last_run, last_result = row[0], row[1], row[2], None, None
    else:
        return None
    return {
        "task_name": (clean(task_name) or TASK_NAME).lstrip("\\"),
        "next_run": clean(next_run),
        "status": clean(status) or "unknown",
        "last_run": clean(last_run),
        "last_result": clean(last_result),
    }


def _run_capture(args: list[str], timeout: int = 10) -> tuple[int, str]:
    try:
        completed = subprocess.run(
            args,
            capture_output=True,
            timeout=timeout,
            shell=False,
        )
        raw = (completed.stdout or b"") + (completed.stderr or b"")
        return int(completed.returncode), _decode_locale(raw)
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError) as exc:
        return 127, f"{type(exc).__name__}: {exc}"


def _load_json(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _tail_text(path: Path, max_bytes: int) -> str:
    try:
        data = path.read_bytes()
    except OSError:
        return ""
    if len(data) > max_bytes:
        data = data[-max_bytes:]
    return data.decode("utf-8", errors="replace")


def _inject_console_token(body: bytes, token: str) -> bytes:
    """在 index.html 的 `</head>` 前插入 `window.__RADAR_CONSOLE_TOKEN__`（仅内存，不落盘/不写日志）。

    前端优先读 window token，其次 URL `#/control?token=`；注入失败（无 head/body）时原样返回。
    """
    script = f'<script>window.__RADAR_CONSOLE_TOKEN__="{html.escape(token, quote=True)}";</script>'.encode("utf-8")
    for marker in (b"</head>", b"<body"):
        index = body.find(marker)
        if index != -1:
            return body[:index] + script + body[index:]
    return body + script


def _tail_text_str(text: str, max_chars: int) -> str:
    return text if len(text) <= max_chars else text[-max_chars:]


def _relative(root: Path, path: Path) -> str:
    try:
        return str(path.relative_to(root)).replace("\\", "/")
    except ValueError:
        return path.name


def _mtime_iso(path: Path) -> str | None:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime).astimezone().isoformat(timespec="seconds")
    except OSError:
        return None


# ---------------------------------------------------------------- 启动
def create_server(app: ConsoleApp, host: str = "127.0.0.1", port: int = 0) -> ThreadingHTTPServer:
    handler = type("BoundConsoleHandler", (ConsoleHandler,), {"app": app})
    server = ThreadingHTTPServer((host, port), handler)
    server.daemon_threads = True
    app.port = server.server_address[1]
    return server


def write_token_file(path: Path, token: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(token + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="机会雷达本地控制台后端（标准库，仅 127.0.0.1）")
    parser.add_argument("--port", type=int, default=8787, help="监听端口（默认 8787；0 表示随机）")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址（仅允许 loopback，默认 127.0.0.1）")
    parser.add_argument("--open", action="store_true", help="启动后用浏览器打开控制台 URL（token 放 hash，不进日志）")
    parser.add_argument("--token-file", default=str(ROOT / ".radar-console-token"), help="token 文件路径")
    parser.add_argument("--token", default=None, help="指定 token（默认 secrets.token_urlsafe 随机生成）")
    args = parser.parse_args(argv)

    host = str(args.host or "127.0.0.1")
    if host not in LOOPBACK_HOSTS:
        print(f"[serve] 拒绝绑定非 loopback 地址：{host}（安全约束：仅 127.0.0.1/localhost）")
        return 2
    token = args.token or secrets.token_urlsafe(32)
    token_path = Path(args.token_file)
    if not token_path.is_absolute():
        token_path = ROOT / token_path
    app = ConsoleApp(ROOT, token)
    try:
        server = create_server(app, host="127.0.0.1", port=int(args.port))
    except OSError as exc:
        print(f"[serve] 启动失败（端口 {args.port} 可能被占用）：{exc}")
        return 1
    # 绑定成功后再写 token 文件，避免端口占用时覆盖/污染已有 token
    write_token_file(token_path, token)
    url = f"http://127.0.0.1:{app.port}/"
    print("=" * 64)
    print(f"[serve] 机会雷达本地控制台已启动：{url}")
    print(f"[serve] 版本 data-v{app.version} ｜ token 文件：{_relative(ROOT, token_path)}（内容不打印）")
    print(f"[serve] 控制台页面：{url}#/control?token=<从 {_relative(ROOT, token_path)} 读取>")
    print("[serve] Ctrl+C 停止；仅监听 127.0.0.1，不会暴露到公网")
    print("=" * 64)
    if args.open:
        webbrowser.open(f"{url}#/control?token={token}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("[serve] 已停止")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
