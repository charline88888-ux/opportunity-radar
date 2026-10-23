"""qa/serve-check.py —— v0.7.0 本地控制台后端 scanner/serve.py 红队独立验收。

覆盖（只用 stdlib；不改系统任务/不污染仓库）：
1) 启动/安全：仅绑定 127.0.0.1（LAN IP 连接失败、netstat 监听地址）；--host 0.0.0.0 拒绝启动 exit2；
   随机 token 写文件（长度/内容/不打印）；Origin 非 loopback → 403（API；health 另测）；
   除 /api/health 外缺/错 token → 401；路径穿越 /../、%2e%2e、..\\ → 403/404 且不泄漏数据。
2) 静态：build_root 优先级 current→app/dist→releases；index.html 注入 window.__RADAR_CONSOLE_TOKEN__
   （仅响应内存，磁盘文件不变；非 index 文件不注入）；SPA 深链回退 index；无构建 503 引导（独立副本目录）。
3) API：health/status schema；run(build) 202 + 并发 409 + 后台 job 完成/log_tail≤200；job 不存在 404；
   logs/log（限 logs 目录、防穿越、tail≤200KB）；schedule disable/enable 实测（执行 install-daily-task.ps1，
   测试后恢复“无任务”状态）；每次 API 写 scanner/logs/console.log 且不含 token。
4) 数据：data 0.7.0、validate 20/20、unittest 77/77（serve 13 条）、--all 幂等、指纹。
用法：python qa/serve-check.py
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP = ROOT / "qa" / "tmp"
TOKEN = "qa-serve-token-0123456789abcdef"
TOKEN_FILE = TMP / "serve-token-test"
TOKEN_FILE2 = TMP / "serve-token-random"
PORT = 8791
PORT_RANDOM = 8792
PORT_NOBUILD = 8793
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def free_port(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def lan_ip() -> str | None:
    try:
        return socket.gethostbyname(socket.gethostname())
    except Exception:
        return None


def http(method: str, url: str, token: str | None = None, payload: dict | None = None,
         origin: str | None = None, timeout: float = 15) -> tuple[int, dict | str, dict]:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if token is not None:
        req.add_header("X-Radar-Token", token)
    if payload is not None:
        req.add_header("Content-Type", "application/json")
    if origin is not None:
        req.add_header("Origin", origin)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
            headers = dict(r.headers)
            status = r.status
    except urllib.error.HTTPError as e:
        body = e.read()
        headers = dict(e.headers)
        status = e.code
    ct = headers.get("Content-Type", "")
    if "application/json" in ct:
        try:
            return status, json.loads(body.decode("utf-8")), headers
        except Exception:
            return status, body.decode("utf-8", "ignore"), headers
    return status, body.decode("utf-8", "ignore"), headers


def raw_path(port: int, path: str) -> tuple[int, str]:
    """保留原始路径发送（urllib 会规范化 ..，用 socket 手动构造请求）。"""
    with socket.create_connection(("127.0.0.1", port), timeout=10) as s:
        request = f"GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
        s.sendall(request.encode())
        chunks = []
        while True:
            part = s.recv(65536)
            if not part:
                break
            chunks.append(part)
    raw = b"".join(chunks).decode("utf-8", "ignore")
    head, _, body = raw.partition("\r\n\r\n")
    m = re.search(r"HTTP/1\.1 (\d{3})", head)
    return (int(m.group(1)) if m else 0), body


def start_server(port: int, token_file: Path, token: str | None = None, extra: list[str] | None = None) -> tuple[subprocess.Popen, str]:
    token_file.parent.mkdir(parents=True, exist_ok=True)
    token_file.unlink(missing_ok=True)
    args = [sys.executable, str(ROOT / "scanner" / "serve.py"), "--port", str(port), "--token-file", str(token_file)]
    if token:
        args += ["--token", token]
    if extra:
        args += extra
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    proc = subprocess.Popen(args, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                            encoding="utf-8", errors="replace", env=env)
    for _ in range(80):
        if proc.poll() is not None:
            out, err = proc.communicate(timeout=5)
            raise RuntimeError(f"serve 启动失败 exit={proc.returncode}\n{out}\n{err}")
        try:
            status, body, _ = http("GET", f"http://127.0.0.1:{port}/api/health", timeout=1)
            if status == 200:
                return proc, token_file.read_text(encoding="utf-8").strip()
        except Exception:
            pass
        time.sleep(0.15)
    out, err = proc.communicate(timeout=5)
    raise RuntimeError(f"serve 健康检查超时\n{out}\n{err}")


def stop_server(proc: subprocess.Popen) -> tuple[str, str]:
    proc.terminate()
    try:
        out, err = proc.communicate(timeout=8)
    except subprocess.TimeoutExpired:
        proc.kill()
        out, err = proc.communicate(timeout=5)
    return out, err


def check(cond: bool, msg: str, p0: bool = True) -> None:
    if not cond:
        (P0 if p0 else P1).append(msg)


def main() -> int:
    TMP.mkdir(parents=True, exist_ok=True)
    for port in (PORT, PORT_RANDOM, PORT_NOBUILD):
        if not free_port(port):
            P0.append(f"测试端口 {port} 被占用，请先停止服务")
            return report()
    # ---------- 数据基线 ----------
    rankings = json.loads((ROOT / "data" / "rankings.json").read_text(encoding="utf-8"))
    meta = rankings.get("meta") or {}
    data_version = meta.get("data_version")
    counts = {w: len(v.get("items") or []) for w, v in (rankings.get("windows") or {}).items()}
    if data_version != "0.7.0":
        P0.append(f"data_version={data_version!r} ≠ 0.7.0")
    if counts != {"day": 17, "week": 49, "month": 57, "year": 80}:
        P0.append(f"四窗口 {counts} ≠ 17/49/57/80")
    fingerprints = {
        "scanner/serve.py": "d721f672e0e37269",
        "data/opportunities.json": "88fda5ab84b7f826",
        "data/rankings.json": "a8ec7ef573091c36",
        "data/stats.json": "33f4868622f7c8a6",
        "data/source-health.json": "3c0527e6953ae7e3",
        "data/sources.json": "0a37f7acb6baa03f",
        "data/radar.db": "1fce72c7a0b628fa",
    }
    for rel, expect in fingerprints.items():
        p = ROOT / rel
        got = sha(p)[:16] if p.exists() else "MISSING"
        if got != expect:
            P2.append(f"指纹 {rel}={got} ≠ 交付 {expect}")
    if not any(f.startswith("指纹") for f in P2):
        notes.append("数据 0.7.0 / 四窗口 17/49/57/80 / 指纹与交付一致 ✅")

    # ---------- 启动（固定 token） ----------
    proc, token = start_server(PORT, TOKEN_FILE, TOKEN)
    try:
        if token != TOKEN:
            P1.append(f"token 文件内容与实际 token 不一致：{token[:8]}…")
        if len(token) < 20:
            P1.append(f"token 长度过短：{len(token)}")
        out = proc.stdout.read(0) if False else ""
        base = f"http://127.0.0.1:{PORT}"
        # health
        st, body, _ = http("GET", f"{base}/api/health")
        if st != 200 or not isinstance(body, dict) or body.get("ok") is not True:
            P0.append(f"/api/health 异常：{st} {body}")
        elif body.get("version") != "0.6.1":
            P2.append(f"health server.version={body.get('version')!r}（根 VERSION 尚未升 0.7.0；发布前需 Lead 更新）")
        # 监听地址
        netstat = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, encoding="utf-8", errors="replace")
        listen_lines = []
        for ln in netstat.stdout.splitlines():
            if "LISTENING" not in ln.upper() or f":{PORT}" not in ln:
                continue
            fields = ln.split()
            if len(fields) >= 2 and fields[1].endswith(f":{PORT}"):
                listen_lines.append(fields[1])
        if not listen_lines:
            P1.append("netstat 未找到本端口监听行")
        elif any(addr.startswith("0.0.0.0") or addr.startswith("[::]") or addr.startswith("::") for addr in listen_lines):
            P1.append(f"监听地址非仅 loopback：{listen_lines}")
        elif not all(addr.startswith("127.0.0.1:") or addr.startswith("[::1]:") for addr in listen_lines):
            P1.append(f"监听地址异常：{listen_lines}")
        else:
            notes.append(f"监听地址仅 127.0.0.1:{PORT} ✅（{listen_lines}）")
        ip = lan_ip()
        if ip and not ip.startswith("127."):
            try:
                with socket.create_connection((ip, PORT), timeout=1.5):
                    P0.append(f"LAN IP {ip}:{PORT} 可连接（不应绑定公网/局域网）")
            except OSError:
                notes.append(f"LAN IP {ip}:{PORT} 不可连接（仅 loopback）✅")
        # 非 loopback host 拒绝
        bad = subprocess.run([sys.executable, str(ROOT / "scanner" / "serve.py"), "--host", "0.0.0.0",
                              "--port", "8799", "--token-file", str(TMP / "serve-bad-host-token")],
                             cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
        if bad.returncode != 2 or "loopback" not in (bad.stdout + bad.stderr):
            P1.append(f"--host 0.0.0.0 未被拒绝（exit={bad.returncode}）")
        else:
            notes.append("--host 0.0.0.0 拒绝启动 exit 2 ✅")
        # 随机 token 生成（第二实例）
        proc2, token2 = start_server(PORT_RANDOM, TOKEN_FILE2)
        try:
            if len(token2) < 32 or not re.fullmatch(r"[A-Za-z0-9_\-]+", token2):
                P1.append(f"随机 token 形态异常：{token2!r}")
            else:
                notes.append(f"随机 token 生成并写入文件（长度 {len(token2)}，URL-safe）✅")
        finally:
            stop_server(proc2)
        # ---------- 鉴权 / Origin ----------
        checks = [
            ("GET", f"{base}/api/status", None, None, 401),
            ("GET", f"{base}/api/status", "wrong-token", None, 401),
        ]
        for method, url, tok, origin, want in checks:
            st, _, _ = http(method, url, token=tok, origin=origin)
            if st != want:
                P0.append(f"{url} token={tok!r} 期望 {want} 实际 {st}")
        if all(http("GET", f"{base}/api/status", token=TOKEN)[0] == 200 for _ in range(1)):
            notes.append("status：缺/错 token 401、正确 token 200 ✅")
        st_bad_origin, _, _ = http("GET", f"{base}/api/status", token=TOKEN, origin="http://evil.example")
        st_ok_origin, _, _ = http("GET", f"{base}/api/status", token=TOKEN, origin=f"http://127.0.0.1:{PORT}")
        if st_bad_origin != 403 or st_ok_origin != 200:
            P0.append(f"Origin 校验异常：evil={st_bad_origin} loopback={st_ok_origin}")
        else:
            notes.append("Origin：非 loopback 403、loopback 200 ✅")
        st_health_origin, _, _ = http("GET", f"{base}/api/health", origin="http://evil.example")
        st_health_ok_origin, _, _ = http("GET", f"{base}/api/health", origin=f"http://127.0.0.1:{PORT}")
        if st_health_origin != 403 or st_health_ok_origin != 200:
            P1.append(f"/api/health Origin 校验不符：evil={st_health_origin} loopback={st_health_ok_origin}")
        else:
            notes.append("/api/health Origin：非 loopback 403、loopback 200（免 token 但校验 Origin）✅")
        # ---------- 路径穿越 ----------
        traversals = [
            "/../data/opportunities.json", "/%2e%2e/data/opportunities.json",
            "/..%2fdata%2fopportunities.json", "/..\\data\\opportunities.json",
            "/%2e%2e%5cdata%5copportunities.json", "/api/log?name=..%2Fdata%2Fopportunities.json",
            "/api/log?name=..%5cdata%5copportunities.json",
        ]
        leaked = []
        codes = []
        for path in traversals:
            if path.startswith("/api/"):
                st, body, _ = http("GET", f"{base}{path}", token=TOKEN)
            else:
                st, body = raw_path(PORT, path)
            codes.append((path, st))
            if st not in (400, 403, 404) or "opp-crossborder" in str(body) or '"id"' in str(body):
                leaked.append((path, st))
        if leaked:
            P0.append(f"路径穿越防护失败/泄漏：{leaked}")
        else:
            notes.append(f"路径穿越 7 种变体均拒绝且不泄漏：{codes}")
        # ---------- 静态 / token 注入 ----------
        st, index_body, _ = http("GET", f"{base}/")
        index_path = ROOT / "current" / "index.html"
        before = sha(index_path) if index_path.exists() else None
        token_script = f'window.__RADAR_CONSOLE_TOKEN__="{TOKEN}"'
        if st != 200 or "text/html" not in _get_ct(base + "/") or token_script not in index_body:
            P0.append(f"index 静态/注入异常：status={st} injected={token_script in index_body}")
        else:
            notes.append("index.html 200 + 注入 window.__RADAR_CONSOLE_TOKEN__（响应内）✅")
        if before and sha(index_path) != before:
            P0.append("GET / 后磁盘 index.html 被修改（token 不应落盘）")
        st, spa_body, _ = http("GET", f"{base}/some/deep/route")
        if st != 200 or token_script not in spa_body:
            P1.append(f"SPA 深链回退/注入异常：status={st}")
        else:
            notes.append("SPA 深链回退 index 且注入 token ✅")
        st_asset, asset_body, _ = http("GET", f"{base}/README.txt")
        if st_asset == 200 and TOKEN in asset_body:
            P0.append("非 index 静态文件被注入 token")
        elif st_asset == 200:
            notes.append("非 index 静态文件不注入 token ✅")
        # status schema
        st, status, _ = http("GET", f"{base}/api/status", token=TOKEN)
        need = ["ok", "server", "data", "schedule", "alert", "jobs", "logs"]
        if st != 200 or not isinstance(status, dict) or any(k not in status for k in need):
            P0.append(f"status schema 缺字段：{status if not isinstance(status, dict) else list(status)}")
        else:
            d = status.get("data") or {}
            if d.get("data_version") != "0.7.0" or d.get("as_of") != "2026-10-22" or d.get("opportunities") != 80:
                P1.append(f"status data 摘要异常：{d}")
            if (d.get("counts") or {}) != {"day": 17, "week": 49, "month": 57, "year": 80}:
                P2.append(f"status data.counts={d.get('counts')}")
            static_src = (d.get("current_build") or {}).get("path")
            if static_src and "current/index.html" not in static_src:
                P2.append(f"静态优先级 current 未生效：current_build={static_src}")
            else:
                notes.append("status schema/数据摘要/静态优先级（current/index.html）✅")
        # ---------- run/job ----------
        build_start = time.time()
        st1, run1, _ = http("POST", f"{base}/api/run", token=TOKEN, payload={"task": "build"})
        st2, run2, _ = http("POST", f"{base}/api/run", token=TOKEN, payload={"task": "build"})
        if st1 != 202 or not isinstance(run1, dict) or not run1.get("job_id"):
            P0.append(f"run build 未返回 202/job_id：{st1} {run1}")
        if st2 != 409:
            P1.append(f"并发第二个 run 未 409：{st2} {run2}")
        elif st1 == 202:
            notes.append("run build 202 + 并发 409 ✅")
        job_id = (run1 or {}).get("job_id") if isinstance(run1, dict) else None
        job_status = None
        if job_id:
            for _ in range(240):
                stj, jbody, _ = http("GET", f"{base}/api/job?id={job_id}", token=TOKEN)
                job = jbody.get("job") if isinstance(jbody, dict) else None
                if job and job.get("state") != "running":
                    job_status = job
                    break
                time.sleep(0.5)
            if not job_status:
                P0.append("build job 超时未完成（>120s）")
            else:
                tail = job_status.get("log_tail") or []
                if job_status.get("exit_code") != 0:
                    P1.append(f"build job exit_code={job_status.get('exit_code')} tail={tail[-5:]}")
                if len(tail) > 200:
                    P1.append(f"job.log_tail={len(tail)} > 200")
                notes.append(f"run build 完成：state={job_status.get('state')} exit={job_status.get('exit_code')} log_tail={len(tail)} 行，耗时 {time.time()-build_start:.1f}s")
        st_invalid, _, _ = http("POST", f"{base}/api/run", token=TOKEN, payload={"task": "rm-rf"})
        if st_invalid != 400:
            P1.append(f"非法 task 未 400：{st_invalid}")
        st_job404, _, _ = http("GET", f"{base}/api/job?id=not-a-job", token=TOKEN)
        if st_job404 != 404:
            P1.append(f"job 不存在未 404：{st_job404}")
        # ---------- logs ----------
        st, logs, _ = http("GET", f"{base}/api/logs", token=TOKEN)
        names = [x.get("name") for x in (logs.get("logs") if isinstance(logs, dict) else [])]
        if st != 200 or "console.log" not in names:
            P1.append(f"/api/logs 异常：{st} {names}")
        st, logbody, _ = http("GET", f"{base}/api/log?name=console.log", token=TOKEN)
        if st != 200 or not isinstance(logbody, dict) or "text" not in logbody:
            P1.append(f"/api/log console.log 异常：{st}")
        else:
            text = logbody.get("text") or ""
            if len(text.encode("utf-8")) > 200 * 1024:
                P1.append(f"/api/log 体积 {len(text.encode('utf-8'))} > 200KB")
            if TOKEN in text:
                P0.append("console.log 泄漏 token")
            else:
                notes.append("console.log 可读、tail≤200KB、不含 token ✅")
        # schedule：disable → no task；enable → 有任务；再 disable 清理
        sch_before = subprocess.run(["schtasks", "/Query", "/TN", "OpportunityRadar-Daily"], capture_output=True, text=True)
        st, r, _ = http("POST", f"{base}/api/schedule", token=TOKEN, payload={"action": "disable"})
        if st != 200 or not isinstance(r, dict) or r.get("ok") is not True:
            P1.append(f"schedule disable（任务不存在）未幂等成功：{st} {r}")
        else:
            sched_state = (r or {}).get("schedule") or {}
            if sched_state.get("status") != "not_installed":
                P2.append(f"schedule disable 后 status={sched_state.get('status')!r}（期望 not_installed）")
            else:
                notes.append("schedule disable（任务不存在）幂等：200 + not_installed ✅")
        st, r2, _ = http("POST", f"{base}/api/schedule", token=TOKEN, payload={"action": "enable", "fetch": False})
        task_exists = subprocess.run(["schtasks", "/Query", "/TN", "OpportunityRadar-Daily"], capture_output=True, text=True)
        if st != 200 or not isinstance(r2, dict) or r2.get("ok") is not True or task_exists.returncode != 0:
            P1.append(f"schedule enable 失败：{st} {r2} task_query={task_exists.returncode}")
        else:
            notes.append("schedule disable/enable 实测（schtasks 任务创建）✅")
        st, r3, _ = http("POST", f"{base}/api/schedule", token=TOKEN, payload={"action": "disable"})
        after = subprocess.run(["schtasks", "/Query", "/TN", "OpportunityRadar-Daily"], capture_output=True, text=True)
        if st != 200 or after.returncode == 0:
            P1.append(f"schedule 清理失败：st={st} task_query={after.returncode}")
        else:
            notes.append("schedule disable 清理任务（测试后恢复无任务状态）✅")
        # ---------- console.log 记录 & token 不落日志 ----------
        console_log = ROOT / "scanner" / "logs" / "console.log"
        cl_text = console_log.read_text(encoding="utf-8", errors="ignore") if console_log.exists() else ""
        for marker in ("GET /api/health", "GET /api/status", "POST /api/run", "GET /api/logs"):
            if marker not in cl_text:
                P1.append(f"console.log 缺记录 {marker}")
        if not any(marker in cl_text for marker in ("GET /api/health", "POST /api/run")):
            P1.append("console.log 未记录 API 调用")
        logs_dir = ROOT / "scanner" / "logs"
        token_leaks = []
        if logs_dir.is_dir():
            for f in logs_dir.rglob("*"):
                if f.is_file() and f.suffix.lower() in (".log", ".txt"):
                    try:
                        if TOKEN in f.read_text(encoding="utf-8", errors="ignore"):
                            token_leaks.append(f.name)
                    except OSError:
                        pass
        if token_leaks or TOKEN in cl_text:
            P0.append(f"scanner/logs 泄漏 token：{token_leaks}")
        else:
            notes.append("console.log 记录 API 调用且全 logs 不含 token ✅")
        # 停服务并检查 stdout/stderr 不打印 token
        out, err = stop_server(proc)
        proc = None
        if TOKEN in (out + err):
            P0.append("serve stdout/stderr 打印了 token")
        else:
            notes.append("serve 启动/运行输出不打印 token ✅")
    finally:
        if proc is not None:
            stop_server(proc)
        # 清理测试任务（防止异常残留）
        subprocess.run(["schtasks", "/Delete", "/TN", "OpportunityRadar-Daily", "/F"], capture_output=True)

    # ---------- 无构建 503（独立副本，不污染仓库） ----------
    nobuild = TMP / "serve-nobuild"
    shutil.rmtree(nobuild, ignore_errors=True)
    (nobuild / "scanner").mkdir(parents=True)
    for f in (ROOT / "scanner").glob("*.py"):
        shutil.copy2(f, nobuild / "scanner" / f.name)
    (nobuild / "VERSION").write_text("0.6.1\n", encoding="utf-8")
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    proc3 = subprocess.Popen([sys.executable, str(nobuild / "scanner" / "serve.py"), "--port", str(PORT_NOBUILD),
                              "--token-file", str(TMP / "serve-nobuild-token"), "--token", "nobuild-test-token"],
                             cwd=nobuild, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", env=env)
    try:
        for _ in range(60):
            try:
                if http("GET", f"http://127.0.0.1:{PORT_NOBUILD}/api/health", timeout=1)[0] == 200:
                    break
            except Exception:
                pass
            time.sleep(0.15)
        st, body, _ = http("GET", f"http://127.0.0.1:{PORT_NOBUILD}/")
        if st != 503 or "还没有可用构建" not in body:
            P1.append(f"无构建未返回 503 引导：{st} {str(body)[:120]}")
        else:
            notes.append("无构建：503 + 引导文案 ✅")
    finally:
        stop_server(proc3)

    # ---------- 单元测试 / validate / 幂等 ----------
    for label, cmd, expect in (
        ("serve unittest", [sys.executable, "-m", "unittest", "scanner.tests.test_serve"], "Ran 17 tests"),
        ("full unittest", [sys.executable, "-m", "unittest", "discover", "-s", "scanner/tests"], "Ran 81 tests"),
        ("validate", [sys.executable, "scanner/validate.py"], "20/20"),
    ):
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
        blob = r.stdout + r.stderr
        if r.returncode != 0 or expect not in blob:
            P0.append(f"{label} 失败：exit={r.returncode} 期望 {expect!r} :: {blob[-260:]}")
        else:
            notes.append(f"{label}：{expect} PASS ✅")
    before = {str(p.relative_to(ROOT)): sha(p) for p in (ROOT / "data").rglob("*") if p.is_file()}
    r1 = subprocess.run([sys.executable, "scanner/pipeline.py", "--all"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
    mid = {str(p.relative_to(ROOT)): sha(p) for p in (ROOT / "data").rglob("*") if p.is_file()}
    r2 = subprocess.run([sys.executable, "scanner/pipeline.py", "--all"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
    after = {str(p.relative_to(ROOT)): sha(p) for p in (ROOT / "data").rglob("*") if p.is_file()}
    if r1.returncode != 0 or r2.returncode != 0 or before != mid or mid != after:
        P0.append(f"--all 幂等失败：exit={r1.returncode}/{r2.returncode} diff={[k for k in before if before[k] != after.get(k)][:5]}")
    else:
        notes.append(f"--all 幂等：{len(after)} 个 data 文件 SHA256 一致 ✅")
    return report()


def _get_ct(url: str) -> str:
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.headers.get("Content-Type", "")


def report() -> int:
    print("\n== serve-check ==")
    for n in notes:
        print("  ·", n)
    print(f"\nP0 = {len(P0)}  P1 = {len(P1)}  P2 = {len(P2)}")
    for level, items in (("P0", P0), ("P1", P1), ("P2", P2)):
        for item in items:
            print(f"  [{level}] {item}")
    print("RESULT:", "PASS" if not P0 and not P1 else "FAIL")
    return 0 if not P0 and not P1 else 1


if __name__ == "__main__":
    raise SystemExit(main())
