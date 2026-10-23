"""scanner/serve.py 本地控制台后端单测（标准库；临时端口，不依赖外网/真实任务）。"""
from __future__ import annotations

import http.client
import json
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scanner import serve  # noqa: E402


def make_root(tmp: Path, *, with_build: bool = True) -> Path:
    (tmp / "data").mkdir(parents=True, exist_ok=True)
    (tmp / "data" / "rankings.json").write_text(
        json.dumps(
            {
                "meta": {
                    "as_of": "2026-10-22",
                    "data_version": "0.7.0",
                    "counts": {"day": 17, "week": 49, "month": 57, "year": 80},
                },
                "windows": {},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (tmp / "data" / "stats.json").write_text(
        json.dumps({"meta": {"data_version": "0.7.0"}, "kpi": {"total_opps": 80}}, ensure_ascii=False),
        encoding="utf-8",
    )
    (tmp / "VERSION").write_text("0.7.0\n", encoding="utf-8")
    (tmp / "scanner" / "logs").mkdir(parents=True, exist_ok=True)
    (tmp / "scripts").mkdir(exist_ok=True)
    (tmp / "scripts" / "daily-run.ps1").write_text("# fake", encoding="utf-8")
    (tmp / "scripts" / "install-daily-task.ps1").write_text("# fake", encoding="utf-8")
    if with_build:
        (tmp / "current").mkdir()
        (tmp / "current" / "index.html").write_text(
            "<!doctype html><html><head><title>radar console</title></head><body>app</body></html>",
            encoding="utf-8",
        )
        (tmp / "releases" / "v0.6.1" / "dist").mkdir(parents=True)
        (tmp / "releases" / "v0.6.1" / "dist" / "index.html").write_text("<!doctype html><title>frozen</title>", encoding="utf-8")
        # v0.7.3：采集 outbox 摘要测试数据
        outbox = tmp / "scanner" / "outbox"
        outbox.mkdir(parents=True, exist_ok=True)
        signals = [
            {
                "signal_id": f"sig-test-{idx:03d}",
                "source_id": ["hnrss", "arxiv-rss", "lobsters"][idx % 3],
                "title": f"采集到的测试信号 {idx}",
                "url": f"https://example.com/signal/{idx}",
                "published_date": "2026-10-23",
                "lang": "en",
                "industry_hints": ["ai"],
                "region_hints": ["north-america"],
                # v0.8.0 去重 + 相关性
                "is_new": idx != 2,
                "first_seen": "2026-10-23",
                "last_seen": "2026-10-23",
                "seen_count": 1 if idx != 2 else 2,
                "relevance_score": 85 - idx * 20,
                "tier": ["business", "maybe", "off-topic"][idx],
                "industry_ids": ["ai"],
                "gap_type_ids": ["knowledge"],
                "region_ids": ["north-america"],
                "reasons": ["category:trend", "keyword:launch"],
            }
            for idx in range(3)
        ]
        (outbox / "signals-2026-10-23.json").write_text(
            json.dumps(
                {
                    "meta": {
                        "data_version": "0.8.0",
                        "as_of": "2026-10-23",
                        "generated_at": "2026-10-23T12:45:00+08:00",
                        "source_count": 57,
                        "raw_count": 1448,
                        "signal_count": 1015,
                        "new_count": 0,
                        "seen_count": 1015,
                        "ledger_total": 1051,
                        "relevant_count": 184,
                        "tiers": {"business": 184, "maybe": 712, "off-topic": 119},
                        "top_relevant": [
                            {"signal_id": "sig-test-000", "title": "采集到的测试信号 0", "relevance_score": 85, "tier": "business", "source_id": "hnrss", "url": "https://example.com/signal/0"}
                        ],
                    },
                    "signals": signals,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        (outbox / "REVIEW.md").write_text("# 采集复核清单\n", encoding="utf-8")
    return tmp


class ServeTestBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        cls.root = make_root(Path(cls._tmp.name))
        cls.token = "test-token-123"
        cls.block = threading.Event()
        cls.events: list[tuple[str, bool]] = []

        def executor(task: str, emit):
            emit(f"start {task}")
            if task == "fetch":
                cls.block.wait(5)
            emit(f"done {task}")
            return 0

        def installer(action: str, fetch: bool) -> dict:
            cls.events.append((action, fetch))
            return {"ok": True, "exit_code": 0, "output": f"{action} {fetch}"}

        cls.app = serve.ConsoleApp(cls.root, cls.token, executor=executor, installer=installer)
        cls.app.schedule_refresh_delay = 0.0
        cls.app.schedule_refresh_attempts = 2
        cls.server = serve.create_server(cls.app, port=0)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.1)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.block.set()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        cls._tmp.cleanup()

    def tearDown(self) -> None:
        self.block.set()
        for _ in range(100):
            if not self.app.jobs.busy():
                break
            time.sleep(0.02)
        self.block.clear()

    def call(self, method: str, path: str, *, token: bool | str = True, origin: str | None = None, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        headers = {}
        if token is True:
            headers[serve.TOKEN_HEADER] = self.token
        elif isinstance(token, str):
            headers[serve.TOKEN_HEADER] = token
        if origin:
            headers["Origin"] = origin
        payload = None
        if body is not None:
            payload = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        conn.request(method, path, body=payload, headers=headers)
        response = conn.getresponse()
        data = response.read()
        status = response.status
        conn.close()
        return status, data


class TestServeApi(ServeTestBase):
    def test_health_without_token(self):
        status, data = self.call("GET", "/api/health", token=False)
        self.assertEqual(status, 200)
        payload = json.loads(data)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["version"], "0.7.0")
        self.assertEqual(payload["port"], self.port)

    def test_health_origin_policy(self):
        """v0.7.0 P2：health 虽免 token，但同样校验 Origin（与其余 API 一致）。"""
        self.assertEqual(self.call("GET", "/api/health", token=False, origin="http://evil.example")[0], 403)
        status, _ = self.call("GET", "/api/health", token=False, origin=f"http://127.0.0.1:{self.port}")
        self.assertEqual(status, 200)

    def test_status_requires_valid_token(self):
        self.assertEqual(self.call("GET", "/api/status", token=False)[0], 401)
        self.assertEqual(self.call("GET", "/api/status", token="wrong-token")[0], 401)
        status, data = self.call("GET", "/api/status")
        self.assertEqual(status, 200)
        payload = json.loads(data)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["server"]["version"], "0.7.0")
        self.assertEqual(payload["server"]["port"], self.port)
        self.assertEqual(payload["data"]["as_of"], "2026-10-22")
        self.assertEqual(payload["data"]["opportunities"], 80)
        self.assertEqual(payload["data"]["counts"]["day"], 17)
        self.assertEqual(payload["data"]["current_build"]["path"], "current/index.html")
        self.assertGreater(payload["data"]["current_build"]["size"], 0)
        self.assertEqual(payload["data"]["frozen_latest"]["version"], "v0.6.1")
        self.assertEqual(payload["schedule"]["task_name"], "OpportunityRadar-Daily")
        self.assertFalse(payload["alert"]["exists"])
        self.assertIsInstance(payload["jobs"], list)
        self.assertIsInstance(payload["logs"], list)
        # v0.7.3：采集摘要；v0.8.0：去重/相关性字段
        outbox = payload["outbox"]
        self.assertIsNotNone(outbox)
        self.assertEqual(outbox["file"], "signals-2026-10-23.json")
        self.assertEqual(outbox["as_of"], "2026-10-23")
        self.assertEqual(outbox["raw_count"], 1448)
        self.assertEqual(outbox["signal_count"], 1015)
        self.assertEqual(outbox["new_count"], 0)
        self.assertEqual(outbox["seen_count"], 1015)
        self.assertEqual(outbox["ledger_total"], 1051)
        self.assertEqual(outbox["relevant_count"], 184)
        self.assertEqual(outbox["tiers"], {"business": 184, "maybe": 712, "off-topic": 119})
        self.assertEqual(outbox["top_relevant"][0]["tier"], "business")
        self.assertEqual(len(outbox["top"]), 3)
        self.assertTrue(outbox["review_md"]["exists"])
        self.assertEqual(set(outbox["by_source"]), {"hnrss", "arxiv-rss", "lobsters"})
        self.assertNotIn(str(self.root), json.dumps(payload))  # 不返回绝对路径

    def test_outbox_endpoint(self):
        self.assertEqual(self.call("GET", "/api/outbox", token=False)[0], 401)
        status, data = self.call("GET", "/api/outbox?limit=2")
        self.assertEqual(status, 200)
        payload = json.loads(data)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["outbox"]["raw_count"], 1448)
        self.assertEqual(payload["outbox"]["relevant_count"], 184)
        self.assertEqual(len(payload["signals"]), 2)
        first = payload["signals"][0]
        self.assertIn("title", first)
        self.assertIn("source_id", first)
        self.assertIn("is_new", first)
        self.assertIn("relevance_score", first)
        self.assertIn("tier", first)
        self.assertIn("reasons", first)
        # limit 越界/非法处理
        status, data = self.call("GET", "/api/outbox?limit=999")
        self.assertEqual(status, 200)
        self.assertLessEqual(len(json.loads(data)["signals"]), 100)
        status, _ = self.call("GET", "/api/outbox?limit=abc")
        self.assertEqual(status, 400)

    def test_outbox_empty_when_no_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = make_root(Path(tmp), with_build=False)
            app = serve.ConsoleApp(root, "tok")
            self.assertIsNone(app.outbox_summary())
            self.assertEqual(app.outbox_signals(), [])

    def test_fetch_command_uses_data_as_of(self):
        command = serve.fetch_command(self.root)
        self.assertEqual(command[-2:], ["--as-of", "2026-10-22"])
        self.assertIn("--fetch", command)

    def test_origin_check_forbidden(self):
        status, data = self.call("POST", "/api/run", origin="http://evil.example", body={"task": "build"})
        self.assertEqual(status, 403)
        self.assertFalse(json.loads(data)["ok"])
        status, data = self.call("POST", "/api/run", origin=f"http://127.0.0.1:{self.port}", body={"task": "build"})
        self.assertEqual(status, 202)

    def test_run_invalid_task(self):
        status, _ = self.call("POST", "/api/run", body={"task": "rm-rf"})
        self.assertEqual(status, 400)

    def test_run_busy_409_and_job_detail(self):
        status, data = self.call("POST", "/api/run", body={"task": "fetch"})
        self.assertEqual(status, 202)
        job_id = json.loads(data)["job_id"]
        for _ in range(100):
            if self.app.jobs.busy():
                break
            time.sleep(0.02)
        status, data = self.call("POST", "/api/run", body={"task": "build"})
        self.assertEqual(status, 409)
        self.assertIn("已有任务", json.loads(data)["error"])
        self.block.set()
        for _ in range(200):
            if not self.app.jobs.busy():
                break
            time.sleep(0.02)
        status, data = self.call("GET", f"/api/job?id={job_id}")
        self.assertEqual(status, 200)
        job = json.loads(data)["job"]
        self.assertEqual(job["task"], "fetch")
        self.assertEqual(job["state"], "ok")
        self.assertEqual(job["exit_code"], 0)
        self.assertTrue(any("start fetch" in line for line in job["log_tail"]))
        status, data = self.call("GET", "/api/job?id=not-a-real-job")
        self.assertEqual(status, 404)

    def test_recent_jobs_in_status(self):
        status, _ = self.call("POST", "/api/run", body={"task": "build"})
        self.assertEqual(status, 202)
        for _ in range(200):
            if not self.app.jobs.busy():
                break
            time.sleep(0.02)
        status, data = self.call("GET", "/api/status")
        jobs = json.loads(data)["jobs"]
        self.assertTrue(any(job["task"] == "build" and job["state"] == "ok" for job in jobs))


class TestServeStaticAndLogs(ServeTestBase):
    def test_static_serves_current_and_spa_fallback(self):
        status, data = self.call("GET", "/", token=False)
        self.assertEqual(status, 200)
        self.assertIn(b"radar console", data)
        status, data = self.call("GET", "/deep/link", token=False)  # 无扩展名 → SPA 回退
        self.assertEqual(status, 200)
        self.assertIn(b"radar console", data)
        status, _ = self.call("GET", "/assets/missing.js", token=False)
        self.assertEqual(status, 404)

    def test_index_injects_console_token_in_memory_only(self):
        """v0.7.0：index.html 注入 window.__RADAR_CONSOLE_TOKEN__（自启动直接访问可登录），且不落日志。"""
        status, data = self.call("GET", "/", token=False)
        self.assertEqual(status, 200)
        text = data.decode("utf-8")
        self.assertIn("window.__RADAR_CONSOLE_TOKEN__", text)
        self.assertIn(self.token, text)
        self.assertLess(text.index("window.__RADAR_CONSOLE_TOKEN__"), text.index("</head>"))
        # SPA 深链回退的 index 也注入
        status, data = self.call("GET", "/deep/link", token=False)
        self.assertIn(self.token, data.decode("utf-8"))
        # 非 index 静态资源不注入 token
        (self.root / "current" / "app.js").write_text("console.log('asset')", encoding="utf-8")
        status, data = self.call("GET", "/app.js", token=False)
        self.assertEqual(status, 200)
        self.assertNotIn(self.token, data.decode("utf-8"))
        # console.log 不记录 token
        log_text = self.app.console_log.read_text(encoding="utf-8")
        self.assertNotIn(self.token, log_text)

    def test_static_traversal_rejected(self):
        for path in ("/../data/rankings.json", "/%2e%2e/data/rankings.json", "/..%5cdata%5crankings.json"):
            status, data = self.call("GET", path, token=False)
            self.assertIn(status, (403, 404))
            self.assertNotIn(b"2026-10-22", data)

    def test_no_build_returns_503_guidance(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = make_root(Path(tmp), with_build=False)
            app = serve.ConsoleApp(root, "tok", executor=lambda task, emit: 0)
            server = serve.create_server(app, port=0)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                conn = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=10)
                conn.request("GET", "/")
                response = conn.getresponse()
                body = response.read()
                conn.close()
                self.assertEqual(response.status, 503)
                self.assertIn("本地控制台".encode("utf-8"), body)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)

    def test_logs_and_log_traversal(self):
        log = self.app.log_dir / "daily-2026-10-22.log"
        log.write_text("line-1\nline-2-tail\n", encoding="utf-8")
        status, data = self.call("GET", "/api/logs")
        self.assertEqual(status, 200)
        names = [row["name"] for row in json.loads(data)["logs"]]
        self.assertIn("daily-2026-10-22.log", names)
        status, data = self.call("GET", "/api/log?name=daily-2026-10-22.log")
        self.assertEqual(status, 200)
        self.assertIn("line-2-tail", json.loads(data)["text"])
        for bad in ("../secret.txt", "%2e%2e%2fsecret.txt", "C:\\Windows\\win.ini"):
            status, _ = self.call("GET", f"/api/log?name={bad}")
            self.assertIn(status, (400, 403, 404))

    def test_schedule_validation_and_call(self):
        status, _ = self.call("POST", "/api/schedule", body={"action": "bogus"})
        self.assertEqual(status, 400)
        status, _ = self.call("POST", "/api/schedule", body={"action": "enable", "fetch": "yes"})
        self.assertEqual(status, 400)
        self.events.clear()
        status, data = self.call("POST", "/api/schedule", body={"action": "enable", "fetch": True})
        self.assertEqual(status, 200)
        payload = json.loads(data)
        self.assertTrue(payload["ok"])
        self.assertIn(("enable", True), self.events)
        self.assertIn("schedule", payload)
        status, data = self.call("POST", "/api/schedule", body={"action": "disable"})
        self.assertEqual(status, 200)
        self.assertIn(("disable", False), self.events)

    def test_schedule_action_response_has_fresh_status(self):
        """v0.7.0 修复：enable/disable 响应必须带动作后最新状态（而非动作前/unknown）。"""
        latest = {
            "task_name": serve.TASK_NAME,
            "enabled": True,
            "status": "ready",
            "status_raw": "Ready",
            "next_run": "2026/10/24 7:00:00",
            "last_run": "2026/10/23 7:00:00",
            "last_result": "0",
        }
        with mock.patch.object(self.app, "schedule_status_after_action", return_value=latest):
            status, data = self.call("POST", "/api/schedule", body={"action": "enable"})
        self.assertEqual(status, 200)
        payload = json.loads(data)
        self.assertTrue(payload["ok"])
        self.assertTrue(payload["schedule"]["enabled"])
        self.assertEqual(payload["schedule"]["status"], "ready")
        self.assertEqual(payload["schedule"]["next_run"], "2026/10/24 7:00:00")

    def test_token_not_logged_and_calls_recorded(self):
        self.call("GET", "/api/status")
        self.call("GET", "/api/health", token=False)
        text = self.app.console_log.read_text(encoding="utf-8")
        self.assertNotIn(self.token, text)
        self.assertIn("/api/status", text)
        self.assertIn("/api/health", text)

    # ------------------------------------------------ v0.7.0 P2 修复回归
    def test_disable_when_task_not_installed_is_ok(self):
        """任务未安装时 POST disable 不应 500：目标状态已达成，按成功返回。"""
        app = serve.ConsoleApp(self.root, "tok")
        not_installed = {
            "task_name": serve.TASK_NAME,
            "enabled": False,
            "status": "not_installed",
            "next_run": None,
            "last_run": None,
            "last_result": None,
        }
        with mock.patch.object(app, "schedule_status", return_value=not_installed):
            result = app.run_installer("disable", False)
        self.assertTrue(result["ok"])
        self.assertTrue(result.get("already"))

    def test_disable_uninstall_cannot_find_maps_to_ok(self):
        app = serve.ConsoleApp(self.root, "tok")
        self.assertTrue(serve._missing_task_output("ERROR: The system cannot find the task."))
        self.assertTrue(serve._missing_task_output("错误: 系统找不到指定的文件。"))
        self.assertFalse(serve._missing_task_output("SUCCESS: The scheduled task was deleted."))
        with mock.patch.object(app, "schedule_status", return_value={"status": "Ready", "enabled": True}), mock.patch.object(
            serve, "_run_capture", return_value=(1, "ERROR: The system cannot find the task specified.")
        ):
            result = app.run_installer("disable", False)
        self.assertTrue(result["ok"])
        self.assertTrue(result.get("already"))

    def test_enable_failure_still_reports_failure(self):
        app = serve.ConsoleApp(self.root, "tok")
        with mock.patch.object(serve, "_run_capture", return_value=(1, "access denied")):
            result = app.run_installer("enable", False)
        self.assertFalse(result["ok"])
        self.assertEqual(result["exit_code"], 1)


class TestScheduleStatusParsing(unittest.TestCase):
    """v0.7.0 修复：schtasks CSV 解析（中英文/禁用/缺失/坏输出）+ 动作后状态同步 + 编码。"""

    EN_CSV = '"HOST","OpportunityRadar-Daily","2026/10/24 7:00:00","Ready","Interactive/Background","2026/10/23 7:00:00","0","user","powershell.exe -File x"'
    ZH_CSV = '"HOST","OpportunityRadar-Daily","2026/10/24 7:00:00","就绪","交互式/后台","2026/10/23 7:00:00","0","user","powershell.exe -File x"'
    ZH_DISABLED_CSV = '"HOST","OpportunityRadar-Daily","N/A","已禁用","交互式/后台","2026/10/23 7:00:00","0"'

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = make_root(Path(self._tmp.name))
        self.app = serve.ConsoleApp(self.root, "tok", installer=lambda action, fetch: {"ok": True})

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_parse_english_and_chinese(self):
        for raw in (self.EN_CSV, self.ZH_CSV):
            with mock.patch.object(serve, "_run_capture", return_value=(0, raw)):
                status = self.app.schedule_status()
            self.assertTrue(status["enabled"], raw)
            self.assertEqual(status["status"], "ready")
            self.assertEqual(status["next_run"], "2026/10/24 7:00:00")
            self.assertEqual(status["last_run"], "2026/10/23 7:00:00")
            self.assertEqual(status["last_result"], "0")

    def test_not_installed(self):
        with mock.patch.object(serve, "_run_capture", return_value=(1, "ERROR: The system cannot find the task.")):
            status = self.app.schedule_status()
        self.assertFalse(status["enabled"])
        self.assertEqual(status["status"], "not_installed")
        self.assertIsNone(status["next_run"])

    def test_disabled(self):
        with mock.patch.object(serve, "_run_capture", return_value=(0, self.ZH_DISABLED_CSV)):
            status = self.app.schedule_status()
        self.assertFalse(status["enabled"])
        self.assertEqual(status["status"], "disabled")
        self.assertIsNone(status["next_run"])

    def test_bad_output_does_not_crash(self):
        with mock.patch.object(serve, "_run_capture", return_value=(0, "garbage output")):
            status = self.app.schedule_status()
        self.assertFalse(status["enabled"])
        self.assertEqual(status["status"], "unknown")
        with mock.patch.object(serve, "_run_capture", return_value=(0, "")):
            self.assertEqual(self.app.schedule_status()["status"], "unknown")

    def test_enable_refreshes_until_ready(self):
        app = serve.ConsoleApp(self.root, "tok")
        app.schedule_refresh_delay = 0.0
        app.schedule_refresh_attempts = 3
        responses = [(1, "ERROR: cannot find the task"), (0, self.EN_CSV)]
        calls = {"n": 0}

        def fake_run(args, timeout=10):
            index = min(calls["n"], len(responses) - 1)
            calls["n"] += 1
            return responses[index]

        with mock.patch.object(serve, "_run_capture", side_effect=fake_run):
            status = app.schedule_status_after_action("enable")
        self.assertTrue(status["enabled"])
        self.assertEqual(status["next_run"], "2026/10/24 7:00:00")
        self.assertGreaterEqual(calls["n"], 2)

    def test_disable_refreshes_until_not_installed(self):
        app = serve.ConsoleApp(self.root, "tok")
        app.schedule_refresh_delay = 0.0
        app.schedule_refresh_attempts = 3
        responses = [(0, self.EN_CSV), (1, "ERROR: cannot find the task")]
        calls = {"n": 0}

        def fake_run(args, timeout=10):
            index = min(calls["n"], len(responses) - 1)
            calls["n"] += 1
            return responses[index]

        with mock.patch.object(serve, "_run_capture", side_effect=fake_run):
            status = app.schedule_status_after_action("disable")
        self.assertEqual(status["status"], "not_installed")
        self.assertGreaterEqual(calls["n"], 2)

    def test_decode_locale(self):
        self.assertEqual(serve._decode_locale("计划任务：成功创建".encode("gbk")), "计划任务：成功创建")
        self.assertEqual(serve._decode_locale("中文 OK".encode("utf-8")), "中文 OK")
        self.assertIsInstance(serve._decode_locale(b"\xff\xfe\xfa"), str)


if __name__ == "__main__":
    unittest.main(verbosity=2)
