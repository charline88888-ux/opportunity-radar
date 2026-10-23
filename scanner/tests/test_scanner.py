"""scanner 单元测试（标准库 unittest）。

运行：
    python -m unittest discover -s scanner/tests -v
    python scanner/tests/test_scanner.py        # 也可直接运行
"""
from __future__ import annotations

import http.server
import json
import os
import sys
import tempfile
import threading
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest import mock

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scanner import (  # noqa: E402
    calibrate,
    common,
    config,
    db,
    dedupe,
    enrich,
    fetch,
    history,
    materialize,
    normalize,
    pipeline,
    rank,
    report,
    score,
    validate,
    yearbook,
)


def _load_taxonomy() -> dict:
    return common.load_json(config.TAXONOMY_PATH)


def _dims(**overrides) -> dict:
    base = {dim: 7.5 for dim in config.DIMENSION_ORDER}
    base.update(overrides)
    return base


class TestScoreFormula(unittest.TestCase):
    """docs/12 §4.5 公式与 docs/04 §10.4 T01–T04 舍入规则。"""

    @classmethod
    def setUpClass(cls):
        cls.taxonomy = _load_taxonomy()
        cls.weights = score.weights_from_taxonomy(cls.taxonomy)

    def test_contract_example_total(self):
        # docs/12 §4.5 示例向量重算 = 78.9
        dims = {
            "signal": 8.4, "gap": 7.8, "feasibility": 8.6, "economics": 8.2, "timing": 7.5,
            "competition": 6.5, "risk": 7.8, "fit": 8.0, "evidence": 7.6, "leverage": 6.8,
        }
        self.assertAlmostEqual(score.compute_total(dims, self.weights), 78.9, places=6)

    def test_round_half_up_not_bankers(self):
        self.assertEqual(common.round1(76.95), 77.0)
        self.assertEqual(common.round1(75.45), 75.5)
        self.assertEqual(common.round1(84.95), 85.0)
        self.assertEqual(common.round1(2.05), 2.1)

    def test_grade_boundaries(self):
        self.assertEqual(score.grade_for(85.0, self.taxonomy), "S")
        self.assertEqual(score.grade_for(84.9, self.taxonomy), "A")
        self.assertEqual(score.grade_for(75.0, self.taxonomy), "A")
        self.assertEqual(score.grade_for(74.9, self.taxonomy), "B")
        self.assertEqual(score.grade_for(65.0, self.taxonomy), "B")
        self.assertEqual(score.grade_for(64.9, self.taxonomy), "C")
        self.assertEqual(score.grade_for(55.0, self.taxonomy), "C")
        self.assertEqual(score.grade_for(54.9, self.taxonomy), "D")

    def test_rank_score_formula_and_clip(self):
        self.assertEqual(score.compute_rank_score(78.9, 1.3), 81.7)
        self.assertEqual(score.compute_rank_score(95.0, 2.5), 100.0)  # min(100, 112.1)
        self.assertEqual(score.compute_rank_score(70.0, 1.0), 70.0)

    def test_momentum_clip_and_round(self):
        opp = {
            "id": "opp-test-momentum-001",
            "momentum": 3.0,
            "scores": {"dimensions": _dims()},
        }
        self.assertEqual(score.recompute(opp, self.taxonomy)["momentum"], 2.5)
        opp["momentum"] = 0.1
        self.assertEqual(score.recompute(opp, self.taxonomy)["momentum"], 0.5)

    def test_compute_total_rejects_missing_dimension(self):
        dims = _dims()
        dims.pop("leverage")
        with self.assertRaises(ValueError):
            score.compute_total(dims, self.weights)


class TestWindowsAndRankings(unittest.TestCase):
    """docs/12 §5.1 窗口归属与 delta 口径。"""

    AS_OF = date(2026, 10, 22)

    @staticmethod
    def _opp(opp_id: str, last_activity: str, total: float = 70.0, momentum: float = 1.0) -> dict:
        return {
            "id": opp_id,
            "last_activity": last_activity,
            "momentum": momentum,
            "rank_score": score.compute_rank_score(total, momentum),
            "scores": {"total": total},
        }

    def test_iso_week_boundaries(self):
        self.assertEqual(common.iso_week_key(date(2026, 10, 19)), "2026-W43")
        self.assertEqual(common.iso_week_key(date(2026, 10, 25)), "2026-W43")
        self.assertEqual(common.iso_week_key(date(2026, 10, 26)), "2026-W44")

    def test_window_membership(self):
        opps = [
            self._opp("opp-test-day-001", "2026-10-22"),
            self._opp("opp-test-week-002", "2026-10-20"),
            self._opp("opp-test-month-003", "2026-10-05"),
            self._opp("opp-test-year-004", "2026-09-01"),
        ]
        rankings = rank.build_rankings(opps, self.AS_OF)
        counts = {window: len(rankings["windows"][window]["items"]) for window in ("day", "week", "month", "year")}
        self.assertEqual(counts, {"day": 1, "week": 2, "month": 3, "year": 4})

    def test_rank_continuous_and_sorted(self):
        opps = [self._opp(f"opp-test-rank-{idx:03d}", "2026-10-22", total=60.0 + idx) for idx in range(5)]
        rankings = rank.build_rankings(opps, self.AS_OF)
        items = rankings["windows"]["day"]["items"]
        self.assertEqual([item["rank"] for item in items], [1, 2, 3, 4, 5])
        scores = [item["rank_score"] for item in items]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_tie_breaker_chain(self):
        """契约 §5.1：同分 → momentum 降 → evidence_count 降 → last_activity 降 → opp_id 升。"""
        def tie(opp_id: str, momentum: float, evidence_count: int, last_activity: str) -> dict:
            return {
                "id": opp_id,
                "last_activity": last_activity,
                "momentum": momentum,
                "evidence_count": evidence_count,
                "rank_score": 70.0,
                "scores": {"total": 70.0},
            }

        opps = [
            tie("opp-test-tie-104", 1.2, 2, "2026-10-22"),
            tie("opp-test-tie-102", 1.2, 5, "2026-10-22"),
            tie("opp-test-tie-101", 1.5, 1, "2026-10-20"),
            tie("opp-test-tie-105", 1.2, 2, "2026-10-19"),
            tie("opp-test-tie-103", 1.2, 2, "2026-10-22"),
        ]
        rankings = rank.build_rankings(opps, self.AS_OF)
        order = [item["opp_id"] for item in rankings["windows"]["week"]["items"]]
        self.assertEqual(
            order,
            [
                "opp-test-tie-101",  # momentum 降序第一
                "opp-test-tie-102",  # 次高 momentum 组内 evidence_count 最多
                "opp-test-tie-103",  # 剩余同分且同日期 → opp_id 升序
                "opp-test-tie-104",
                "opp-test-tie-105",  # last_activity 最新者优先
            ],
        )

    def test_year_delta_is_null_and_change_new(self):
        opps = [self._opp("opp-test-year-005", "2026-09-01")]
        rankings = rank.build_rankings(opps, self.AS_OF)
        item = rankings["windows"]["year"]["items"][0]
        self.assertIsNone(item["delta"])
        self.assertEqual(item["change"], "new")

    def test_invalid_last_activity_raises(self):
        with self.assertRaises(ValueError):
            rank.build_rankings([self._opp("opp-test-bad-006", "2026-13-99")], self.AS_OF)


class TestMaterializeAndValidate(unittest.TestCase):
    """T19/T20：维度缺失抛错、validate 失败路径。"""

    @classmethod
    def setUpClass(cls):
        cls.taxonomy = _load_taxonomy()

    def _base_opportunity(self) -> dict:
        return {
            "id": "opp-test-materialize-001",
            "slug": "test-materialize",
            "activity_dates": ["2026-08-01", "2026-09-01"],
            "momentum": 1.2,
            "scores": {"dimensions": _dims()},
        }

    def test_materialize_missing_dimension_raises(self):
        opp = self._base_opportunity()
        opp["scores"]["dimensions"].pop("signal")
        with self.assertRaises(ValueError):
            materialize.materialize_opportunity(opp, self.taxonomy, date(2026, 10, 22))

    def test_materialize_fills_derived_fields(self):
        result = materialize.materialize_opportunity(self._base_opportunity(), self.taxonomy, date(2026, 10, 22))
        self.assertEqual(result["evidence_count"], 0)
        self.assertEqual(result["last_activity"], "2026-09-01")
        self.assertEqual(result["first_seen"], "2026-08-01")
        self.assertEqual(result["scores"]["grade"], score.grade_for(result["scores"]["total"], self.taxonomy))

    def test_validate_v05_fails_on_inconsistent_total(self):
        bad = materialize.materialize_opportunity(self._base_opportunity(), self.taxonomy, date(2026, 10, 22))
        bad["scores"]["total"] = 99.9
        ctx = {"taxonomy": self.taxonomy, "opportunities": [bad]}
        with self.assertRaises(validate.CheckFailure):
            validate._v05(ctx)

    def test_validate_v13_fails_on_banned_word(self):
        ctx = {"opportunities": [{"id": "opp-test-badword-001", "one_liner": "稳赚不赔"}]}
        with self.assertRaises(validate.CheckFailure):
            validate._v13(ctx)


class TestNormalizeAndDedupe(unittest.TestCase):
    """采集后归一 / 去重逻辑（离线 fixtures 同构）。"""

    def test_canonical_url_strips_tracking(self):
        url = "https://www.Example.com/a/b/?utm_source=rss&b=2&a=1#frag"
        self.assertEqual(normalize.canonical_url(url), "https://example.com/a/b?a=1&b=2")

    def test_normalize_extracts_hints_and_pain(self):
        record = {
            "adapter": "rss",
            "source_id": "google-news-rss",
            "source_category": "demand",
            "access": "rss",
            "collected_at": "2026-10-22T09:00:00+08:00",
            "raw_id": "fixture-1",
            "title": "Pet memorial glass keepsakes break in transit",
            "url": "https://www.etsy.com/ca/shop/example",
            "published": "2026-10-20",
            "text": "The glass broke in transit and the customer service never replied.",
            "engagement": {},
            "payload": {},
        }
        signal = normalize.normalize_record(record, "2026-10-22")
        self.assertIn("pet", signal["industry_hints"])
        self.assertIn("broke in transit", signal["pain_phrases"])
        self.assertEqual(signal["date_source"], "source")

    def test_dedupe_merges_same_canonical_url(self):
        def signal(sig_id: str, url: str) -> dict:
            record = {
                "adapter": "rss",
                "source_id": "s",
                "source_category": "demand",
                "access": "rss",
                "collected_at": "2026-10-22T09:00:00+08:00",
                "raw_id": sig_id,
                "title": "Pet memorial glass market grows",
                "url": url,
                "published": "2026-10-20",
                "text": "same article",
                "engagement": {},
                "payload": {},
            }
            return normalize.normalize_record(record, "2026-10-22")

        signals = [
            signal("a", "https://example.com/x?utm_source=rss"),
            signal("b", "https://example.com/x"),
        ]
        deduped, report = dedupe.dedupe(signals)
        self.assertEqual(report["input"], 2)
        self.assertEqual(report["output"], 1)
        self.assertEqual(deduped[0]["duplicate_count"], 1)


class TestHistoryDelta(unittest.TestCase):
    """v0.2.0：history delta 路径 + adjacent-window 回退路径。"""

    AS_OF = date(2026, 10, 22)

    @staticmethod
    def _opp(opp_id: str, last_activity: str, total: float = 70.0, momentum: float = 1.0, evidence: int = 1) -> dict:
        return {
            "id": opp_id,
            "last_activity": last_activity,
            "momentum": momentum,
            "evidence_count": evidence,
            "rank_score": score.compute_rank_score(total, momentum),
            "scores": {"total": total},
        }

    def _previous_snapshot(self) -> dict:
        return {
            "meta": {"as_of": "2026-10-20"},
            "windows": {
                "day": {
                    "items": [
                        {"opp_id": "opp-test-hist-001", "rank": 2},
                        {"opp_id": "opp-test-hist-002", "rank": 1},
                    ],
                    "delta_basis": "adjacent-window",
                },
                "week": {"items": [{"opp_id": "opp-test-hist-001", "rank": 1}], "delta_basis": "adjacent-window"},
                # month / year 故意留空 → 该窗口回退 adjacent-window
                "month": {"items": []},
                "year": {"items": []},
            },
        }

    def test_history_path(self):
        opps = [
            self._opp("opp-test-hist-001", "2026-10-22", total=80.0),
            self._opp("opp-test-hist-002", "2026-10-22", total=70.0),
        ]
        rankings = rank.build_rankings(opps, self.AS_OF, previous_snapshot=self._previous_snapshot())
        self.assertEqual(rankings["meta"]["delta_basis"], "history")
        self.assertEqual(rankings["meta"]["history_as_of"], "2026-10-20")
        day_items = {item["opp_id"]: item for item in rankings["windows"]["day"]["items"]}
        self.assertEqual(day_items["opp-test-hist-001"]["rank"], 1)
        self.assertEqual(day_items["opp-test-hist-001"]["delta"], 1)  # 上期 2 → 本期 1
        self.assertEqual(day_items["opp-test-hist-001"]["change"], "up")
        self.assertEqual(day_items["opp-test-hist-002"]["delta"], -1)
        self.assertEqual(day_items["opp-test-hist-002"]["change"], "down")
        self.assertEqual(rankings["windows"]["day"]["delta_basis"], "history")
        # 上一快照该窗口为空 → 回退 adjacent-window
        self.assertEqual(rankings["windows"]["year"]["delta_basis"], "adjacent-window")

    def test_fallback_adjacent_path(self):
        opps = [
            self._opp("opp-test-adj-001", "2026-10-22", total=80.0),
            self._opp("opp-test-adj-002", "2026-10-20", total=70.0),
        ]
        rankings = rank.build_rankings(opps, self.AS_OF, previous_snapshot=None)
        self.assertEqual(rankings["meta"]["delta_basis"], "adjacent-window")
        self.assertIsNone(rankings["meta"]["history_as_of"])
        day_item = rankings["windows"]["day"]["items"][0]
        # day(rank 1) 在 week 中也是 rank 1 → delta 0 flat
        self.assertEqual(day_item["delta"], 0)
        self.assertEqual(day_item["change"], "flat")
        self.assertIsNone(rankings["windows"]["year"]["items"][0]["delta"])

    def test_snapshot_roundtrip_and_find_previous(self):
        with tempfile.TemporaryDirectory() as tmp:
            history_dir = Path(tmp)
            opps = [self._opp("opp-test-snap-001", "2026-10-22", total=80.0)]
            rankings = rank.build_rankings(opps, self.AS_OF)
            path = history.write_snapshot(rankings, self.AS_OF, history_dir=history_dir)
            self.assertTrue(path.exists())
            snapshot = common.load_json(path)
            self.assertEqual(snapshot["meta"]["snapshot_at"], "2026-10-22T00:00:00+08:00")
            self.assertFalse(history.validate_snapshot_shape(snapshot, self.AS_OF))
            # 同日快照不作为自身参照
            self.assertIsNone(history.find_previous_snapshot(self.AS_OF, history_dir=history_dir))
            previous = history.find_previous_snapshot(date(2026, 10, 23), history_dir=history_dir)
            self.assertIsNotNone(previous)
            self.assertEqual(previous[0], self.AS_OF)
            after = rank.build_rankings(opps, date(2026, 10, 23), previous_snapshot=previous[1])
            self.assertEqual(after["meta"]["history_as_of"], "2026-10-22")


class TestReportAndDb(unittest.TestCase):
    """v0.2.0：报告导出与 SQLite 重建。"""

    def test_generate_reports(self):
        with tempfile.TemporaryDirectory() as tmp:
            periods = ["day", "year"]
            written = report.generate(periods, reports_dir=Path(tmp))
            self.assertEqual(len(written), 2)
            counts = common.load_json(config.RANKINGS_PATH)["meta"]["counts"]
            for period, row in zip(periods, written):
                html_path = Path(row["html"])
                md_path = Path(row["md"])
                self.assertTrue(html_path.exists())
                self.assertTrue(md_path.exists())
                html_text = html_path.read_text(encoding="utf-8")
                md_text = md_path.read_text(encoding="utf-8")
                self.assertIn("机会雷达", html_text)
                self.assertIn("<style>", html_text)
                self.assertIn("免责声明", html_text)
                # 不依赖仓内数据当日 as_of：有 items 才断言证据链接，空窗口断言空态
                if counts.get(period, 0) > 0:
                    self.assertIn("https://", html_text)
                    self.assertIn("七问摘要", md_text)
                    self.assertIn("证据链接", md_text)
                else:
                    self.assertIn("该窗口暂无机会", html_text)
                    self.assertIn("条目数：0", md_text)
                    self.assertNotIn("https://", md_text)

    def test_db_rebuild(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "radar.db"
            result = db.rebuild(db_path=db_path, data_dir=config.DATA_DIR)
            self.assertTrue(db_path.exists())
            self.assertGreater(result["counts"]["opportunities"], 0)
            self.assertGreater(result["counts"]["evidence"], 0)
            info = db.info(db_path)
            self.assertTrue(info["exists"])
            self.assertEqual(info["rows"]["opportunities"], result["counts"]["opportunities"])


class TestFetchParsing(unittest.TestCase):
    """v0.2.0：真实采集的解析与合规筛选（离线测试，不联网）。"""

    def test_parse_rss(self):
        xml = (
            "<rss version='2.0'><channel><title>feed</title>"
            "<item><title>Hello</title><link>https://example.com/a</link>"
            "<pubDate>Tue, 20 Oct 2026 08:00:00 GMT</pubDate><description>desc</description></item>"
            "</channel></rss>"
        )
        records = fetch.parse_feed(xml, "test-rss", "demand")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["title"], "Hello")
        self.assertEqual(records[0]["published"], "2026-10-20")

    def test_parse_atom(self):
        atom = (
            "<feed xmlns='http://www.w3.org/2005/Atom'><title>t</title>"
            "<entry><title>Atom title</title><link rel='alternate' href='https://example.com/b'/>"
            "<published>2026-10-20T00:00:00Z</published><summary>sum</summary></entry></feed>"
        )
        records = fetch.parse_feed(atom, "test-atom", "social")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["title"], "Atom title")
        self.assertEqual(records[0]["url"], "https://example.com/b")

    def test_parse_json_feed(self):
        payload = (
            '{"feed": {"entry": [{"title": {"label": "JSON title"},'
            ' "link": {"attributes": {"href": "https://example.com/c"}},'
            ' "updated": {"label": "2026-10-20T00:00:00Z"}, "summary": {"label": "s"}}]}}'
        )
        records = fetch.parse_feed(payload, "test-json", "marketplace")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["title"], "JSON title")
        self.assertEqual(records[0]["url"], "https://example.com/c")

    def test_select_sources_skips_red(self):
        sources = {
            "categories": [
                {
                    "id": "demand",
                    "sources": [
                        {"id": "green-rss", "url": "https://example.com/rss", "access": "rss", "compliance": "green", "value_score": 9},
                        {"id": "red-rss", "url": "https://example.com/red", "access": "rss", "compliance": "red", "value_score": 9},
                        {"id": "green-html", "url": "https://example.com/html", "access": "html", "compliance": "green", "value_score": 9},
                    ],
                }
            ]
        }
        selected = fetch.select_sources(sources, limit=10)
        self.assertEqual([source["id"] for source in selected], ["green-rss"])


class TestReplaySnapshots(unittest.TestCase):
    """v0.3.0：历史回放快照（reconstructed=true）与链式 delta。"""

    @staticmethod
    def _opp(opp_id: str, last_activity: str, total: float = 70.0, momentum: float = 1.0) -> dict:
        return {
            "id": opp_id,
            "last_activity": last_activity,
            "momentum": momentum,
            "evidence_count": 1,
            "rank_score": score.compute_rank_score(total, momentum),
            "scores": {"total": total},
        }

    def _opps(self) -> list[dict]:
        return [
            self._opp("opp-replay-001", "2026-10-20", total=80.0),
            self._opp("opp-replay-002", "2026-10-21", total=90.0),
            self._opp("opp-replay-003", "2026-10-22", total=75.0),
        ]

    def test_replay_chain_metadata_and_filtering(self):
        with tempfile.TemporaryDirectory() as tmp:
            history_dir = Path(tmp)
            path_20, rankings_20 = history.build_replay_snapshot(
                self._opps(), date(2026, 10, 20), history_dir=history_dir
            )
            snapshot_20 = common.load_json(path_20)
            self.assertTrue(snapshot_20["meta"]["reconstructed"])
            self.assertEqual(snapshot_20["meta"]["replay_as_of"], "2026-10-20")
            self.assertEqual(snapshot_20["meta"]["snapshot_at"], "2026-10-20T00:00:00+08:00")
            self.assertEqual(rankings_20["meta"]["delta_basis"], "adjacent-window")
            # 只纳入 last_activity <= 回放日的机会（不出现未来信号）
            year_ids = [item["opp_id"] for item in rankings_20["windows"]["year"]["items"]]
            self.assertEqual(year_ids, ["opp-replay-001"])

            path_21, rankings_21 = history.build_replay_snapshot(
                self._opps(), date(2026, 10, 21), history_dir=history_dir
            )
            snapshot_21 = common.load_json(path_21)
            self.assertEqual(snapshot_21["meta"]["replay_as_of"], "2026-10-21")
            self.assertEqual(rankings_21["meta"]["delta_basis"], "history")
            self.assertEqual(rankings_21["meta"]["history_as_of"], "2026-10-20")
            year_items = {item["opp_id"]: item for item in rankings_21["windows"]["year"]["items"]}
            # 上期已出现且名次变化的才有 delta；新出现为 null/new
            self.assertEqual(year_items["opp-replay-001"]["change"], "down")  # 上期第1 → 本期第2
            self.assertIsNone(year_items["opp-replay-002"]["delta"])
            self.assertEqual(year_items["opp-replay-002"]["change"], "new")

    def test_replay_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            history_dir = Path(tmp)
            path_1, _ = history.build_replay_snapshot(self._opps(), date(2026, 10, 20), history_dir=history_dir)
            first = path_1.read_text(encoding="utf-8")
            path_2, _ = history.build_replay_snapshot(self._opps(), date(2026, 10, 20), history_dir=history_dir)
            second = path_2.read_text(encoding="utf-8")
            self.assertEqual(first, second)

    def test_snapshot_shape_rejects_real_snapshot_with_replay_as_of(self):
        with tempfile.TemporaryDirectory() as tmp:
            history_dir = Path(tmp)
            path, _ = history.build_replay_snapshot(self._opps(), date(2026, 10, 20), history_dir=history_dir)
            snapshot = common.load_json(path)
            snapshot["meta"]["reconstructed"] = False
            issues = history.validate_snapshot_shape(snapshot, date(2026, 10, 20))
            self.assertTrue(any("replay_as_of" in issue for issue in issues))


class TestSourceHealthV20(unittest.TestCase):
    """v0.3.0：source-health v2 的 V20 收紧规则（合法/非法）。"""

    @staticmethod
    def _sources_ctx() -> dict:
        return {
            "sources": {
                "categories": [
                    {
                        "id": "demand",
                        "sources": [
                            {"id": "hnrss", "name": "HNRSS"},
                            {"id": "reddit", "name": "Reddit"},
                        ],
                    }
                ]
            }
        }

    @staticmethod
    def _row(**overrides) -> dict:
        row = {
            "id": "hnrss",
            "ok": True,
            "mode": "online-fetch",
            "http_status": 200,
            "latency_ms": 1234,
            "cached": False,
            "items": 20,
            "checked_at": "2026-10-22T17:30:00+08:00",
            "error": None,
        }
        row.update(overrides)
        return row

    def _run(self, payload: dict) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "source-health.json"
            common.dump_json(path, payload)
            with mock.patch.object(config, "SOURCE_HEALTH_PATH", path):
                validate._v20(self._sources_ctx())

    def _expect_failure(self, payload: dict) -> None:
        with self.assertRaises(validate.CheckFailure):
            self._run(payload)

    def test_valid_health_passes(self):
        payload = {
            "meta": {"mode": "online-fetch", "count": 2},
            "sources": [
                self._row(),
                self._row(
                    id="reddit",
                    ok=False,
                    mode="online-fetch",
                    http_status=None,
                    latency_ms=0,
                    cached=False,
                    items=0,
                    error="URLError: timed out",
                ),
            ],
        }
        self.assertIsInstance(self._run(payload), type(None))

    def test_cached_row_requires_zero_latency(self):
        payload = {
            "meta": {"mode": "cache", "count": 1},
            "sources": [self._row(mode="cache", cached=True, latency_ms=0)],
        }
        self._run(payload)
        self._expect_failure(
            {
                "meta": {"mode": "cache", "count": 1},
                "sources": [self._row(mode="cache", cached=True, latency_ms=12)],
            }
        )

    def test_failed_row_requires_error_reason(self):
        self._expect_failure(
            {
                "meta": {"mode": "online-fetch", "count": 1},
                "sources": [self._row(ok=False, error="")],
            }
        )

    def test_missing_http_status_and_bad_meta_mode(self):
        bad_row = self._row()
        bad_row.pop("http_status")
        self._expect_failure({"meta": {"mode": "online-fetch", "count": 1}, "sources": [bad_row]})
        self._expect_failure({"meta": {"mode": "bogus", "count": 1}, "sources": [self._row()]})


class TestHistoryDeltaNewSemantics(unittest.TestCase):
    """v0.3.0：history 口径下，上期未出现的机会 → null/new（不回退相邻窗口）。"""

    def test_new_item_is_null_not_adjacent(self):
        as_of = date(2026, 10, 22)
        opps = [
            {
                "id": "opp-new-001",
                "last_activity": "2026-10-22",
                "momentum": 1.0,
                "evidence_count": 1,
                "rank_score": 80.0,
                "scores": {"total": 80.0},
            },
            {
                "id": "opp-new-002",
                "last_activity": "2026-10-20",
                "momentum": 1.0,
                "evidence_count": 1,
                "rank_score": 80.0,
                "scores": {"total": 80.0},
            },
        ]
        previous = {
            "meta": {"as_of": "2026-10-21"},
            "windows": {
                # day 窗口上期存在（有 opp-new-002），但本期只有 opp-new-001 → new，不回退 week
                "day": {"items": [{"opp_id": "opp-new-002", "rank": 1}]},
                "week": {"items": [{"opp_id": "opp-new-002", "rank": 1}]},
                "month": {"items": []},
                "year": {"items": []},
            },
        }
        rankings = rank.build_rankings(opps, as_of, previous_snapshot=previous)
        day_items = {item["opp_id"]: item for item in rankings["windows"]["day"]["items"]}
        self.assertIsNone(day_items["opp-new-001"]["delta"])
        self.assertEqual(day_items["opp-new-001"]["change"], "new")
        # month/year 上期为空 → 回退 adjacent-window
        self.assertEqual(rankings["windows"]["month"]["delta_basis"], "adjacent-window")


class TestEnrichOffline(unittest.TestCase):
    """v0.4.0：AI 富化 outbox（offline-template，人工复核门禁）。"""

    @staticmethod
    def _signal(idx: int, title: str = "Pet memorial glass demand grows", url: str | None = None) -> dict:
        return {
            "signal_id": f"sig-test-{idx}",
            "source_id": "hnrss",
            "source_category": "demand",
            "title": title,
            "url": url if url is not None else f"https://example.com/pet-memorial-{idx}",
            "quote": "Owners search for keepsakes after loss...",
            "published_date": "2026-10-20",
            "lang": "en",
            "industry_hints": ["pet"],
            "gap_hints": ["emotion"],
            "emotion_hints": ["grief", "love"],
            "region_hints": ["north-america"],
            "pain_phrases": ["can't find"],
            "trend": {},
        }

    def _write_outbox(self, directory: Path, signals: list[dict], as_of: str = "2026-10-22") -> Path:
        path = directory / f"signals-{as_of}.json"
        common.dump_json(path, {"meta": {"as_of": as_of}, "signals": signals})
        return path

    def test_offline_candidates_schema(self):
        taxonomy = _load_taxonomy()
        valid_gaps = {item["id"] for item in taxonomy["gap_types"]}
        valid_needs = {item["id"] for item in taxonomy["human_needs"]}
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            signals_path = self._write_outbox(out_dir, [self._signal(1), self._signal(2), {"title": "", "url": ""}])
            result = enrich.enrich(signals_path, out_dir=out_dir)
            self.assertEqual(result["mode"], "offline-template")
            self.assertEqual(result["candidates"], 2)  # 非法信号被跳过
            self.assertEqual(result["skipped"], 1)
            payload = common.load_json(Path(result["enriched_path"]))
            self.assertEqual(payload["meta"]["generator"], "offline-template")
            self.assertTrue(payload["meta"]["key_logged"] is False)
            for candidate in payload["candidates"]:
                self.assertTrue(candidate["needs_human"])
                self.assertTrue(candidate["url"].startswith("http"))
                self.assertIn(candidate["signal_type"], {"complaint", "trend", "discussion", "news", "market_size"})
                for gap in candidate["gap_type_ids"]:
                    self.assertIn(gap, valid_gaps)
                for need in candidate["human_need_ids"]:
                    self.assertIn(need, valid_needs)
                for key, _label in enrich.QUESTIONS:
                    self.assertIn(key, candidate["seven_questions_draft"])
                self.assertIn("待人工补充", candidate["seven_questions_draft"]["traffic"])
                self.assertIn("永不自动写入", " ".join(candidate["notes"]))
            review = Path(result["review_path"]).read_text(encoding="utf-8")
            self.assertIn("REVIEW.md", review)
            self.assertIn("永不自动写入", review)

    def test_empty_outbox_is_graceful(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            signals_path = self._write_outbox(out_dir, [])
            result = enrich.enrich(signals_path, out_dir=out_dir)
            self.assertEqual(result["candidates"], 0)
            payload = common.load_json(Path(result["enriched_path"]))
            self.assertEqual(payload["candidates"], [])
            review = Path(result["review_path"]).read_text(encoding="utf-8")
            self.assertIn("没有可复核候选", review)

    def test_dry_run_writes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            signals_path = self._write_outbox(out_dir, [self._signal(1)])
            before = {path.name for path in out_dir.iterdir()}
            result = enrich.enrich(signals_path, out_dir=out_dir, dry_run=True)
            self.assertTrue(result["dry_run"])
            self.assertEqual({path.name for path in out_dir.iterdir()}, before)

    def test_online_without_key_returns_error_without_crash(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            signals_path = self._write_outbox(out_dir, [self._signal(1)])
            clean_env = {key: value for key, value in os.environ.items() if key != "LLM_API_KEY"}
            with mock.patch.dict(os.environ, clean_env, clear=True):
                result = enrich.enrich(signals_path, out_dir=out_dir, online=True, dry_run=True)
            self.assertIn("LLM_API_KEY", result["error"])
            self.assertEqual(result["candidates"], [])
            self.assertFalse(Path(out_dir / "enriched-2026-10-22.json").exists())

    def test_enrich_never_writes_opportunities(self):
        before = common.load_json(config.OPPORTUNITIES_PATH)
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            signals_path = self._write_outbox(out_dir, [self._signal(1)])
            enrich.enrich(signals_path, out_dir=out_dir)
        after = common.load_json(config.OPPORTUNITIES_PATH)
        self.assertEqual(before, after)


class TestCalibrate(unittest.TestCase):
    """v0.4.0：校准报告与 Brier 公式（docs/04 §12.9.5）。"""

    def test_brier_formula_pure(self):
        self.assertEqual(calibrate.clamp_p(0), 0.01)
        self.assertEqual(calibrate.clamp_p(50), 0.5)
        self.assertEqual(calibrate.clamp_p(150), 0.99)
        pairs = [(0.8, 1), (0.6, 0), (0.4, 1)]
        expected = ((0.8 - 1) ** 2 + (0.6 - 0) ** 2 + (0.4 - 1) ** 2) / 3
        self.assertAlmostEqual(calibrate.brier_from_pairs(pairs), expected, places=10)
        self.assertIsNone(calibrate.brier_from_pairs([]))

    def _export(self, experiments: list[dict]) -> dict:
        return {"schema_version": "0.4.0", "exported_at": "2026-10-22T18:00:00+08:00", "experiments": experiments}

    def _exp(self, opp_id: str, outcome: str | None, **extra) -> dict:
        payload = {"id": f"exp-{opp_id}-{outcome}", "opp_id": opp_id, "status": "done", "outcome": outcome}
        payload.update(extra)
        return payload

    def test_build_records_and_brier_exclusions(self):
        opportunities = {
            "opp-x1": {"title": "X1", "grade": "A", "total": 80.0},
            "opp-x2": {"title": "X2", "grade": "B", "total": 60.0},
            "opp-x3": {"title": "X3", "grade": "A", "total": 40.0},
        }
        export = self._export(
            [
                self._exp("opp-x1", "positive", spend_cny=100, hours=3),
                self._exp("opp-x2", "negative", spend_cny=200, hours=5),
                self._exp("opp-x3", "positive"),
                self._exp("opp-x1", "inconclusive"),  # 排除
                self._exp("opp-missing", "positive"),  # 未匹配，排除
                self._exp("opp-x2", None),  # 未知 outcome，排除
            ]
        )
        records = calibrate.build_records(export, opportunities)
        self.assertEqual(len(records), 6)
        brier = calibrate.compute_brier(records)
        self.assertEqual(brier["n"], 3)
        expected = ((0.8 - 1) ** 2 + (0.6 - 0) ** 2 + (0.4 - 1) ** 2) / 3
        self.assertAlmostEqual(brier["brier"], round(expected, 4), places=4)
        self.assertTrue(brier["sufficient"])
        self.assertEqual(brier["excluded"]["inconclusive"], 1)
        self.assertEqual(brier["excluded"]["unmatched"], 1)
        self.assertEqual(brier["excluded"]["unknown"], 1)
        spend = calibrate.spend_hours(records)
        self.assertEqual(spend["spend_total"], 300.0)
        self.assertEqual(spend["hours_total"], 8.0)

    def test_insufficient_sample_and_suggestions(self):
        opportunities = {"opp-x1": {"title": "X1", "grade": "A", "total": 80.0}}
        export = self._export([self._exp("opp-x1", "positive"), self._exp("opp-x1", "negative")])
        brier = calibrate.compute_brier(calibrate.build_records(export, opportunities))
        self.assertEqual(brier["n"], 2)
        self.assertFalse(brier["sufficient"])
        tips = calibrate.suggestions(brier, calibrate.grade_stats(calibrate.build_records(export, opportunities)), {"positive": 1, "negative": 1, "inconclusive": 0, "unknown": 0})
        self.assertTrue(any("样本" in tip for tip in tips))

    def test_generate_reports_and_invalid_export(self):
        sample_path = config.FIXTURES_DIR / "experiments-sample.json"
        self.assertTrue(sample_path.exists())
        with tempfile.TemporaryDirectory() as tmp:
            result = calibrate.generate(sample_path, out_dir=Path(tmp), sample=True)
            self.assertEqual(result["samples"], 6)
            self.assertTrue(result["sufficient"])
            html_path = Path(result["html"])
            md_path = Path(result["md"])
            self.assertTrue(html_path.exists() and md_path.exists())
            html_text = html_path.read_text(encoding="utf-8")
            self.assertIn("Brier", html_text)
            self.assertIn("样例数据", html_text)
            self.assertIn("免责声明", html_text)
            md_text = md_path.read_text(encoding="utf-8")
            self.assertIn("校准建议", md_text)
            # 与纯函数复算一致（用报告内记录复算）
            export = calibrate.load_export(sample_path)
            records = calibrate.build_records(export, calibrate.load_opportunities())
            self.assertAlmostEqual(
                calibrate.compute_brier(records)["brier"], result["brier"], places=4
            )
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp) / "bad.json"
            common.dump_json(bad, {"foo": "bar"})
            with self.assertRaises(ValueError):
                calibrate.generate(bad, out_dir=Path(tmp))


class TestYearbook(unittest.TestCase):
    """v0.5.0：年度年鉴（无/有实验、空年份、确定性、非法 JSON 容错）。"""

    YEAR = 2026

    def test_without_experiments(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = yearbook.generate(self.YEAR, out_dir=Path(tmp))
            html_path = Path(result["html"])
            md_path = Path(result["md"])
            self.assertTrue(html_path.exists() and md_path.exists())
            self.assertFalse(result["sample"])
            self.assertGreaterEqual(result["opportunities"], 80)  # v0.6.0：机会库 ≥80
            self.assertEqual(result["top20"], 20)
            self.assertGreaterEqual(result["a_grade"], 1)
            self.assertIsNone(result["brier"])
            # v0.6.0 新指标摘要
            self.assertEqual(len(result["window_status"]), 4)
            self.assertEqual(sum(result["window_status"].values()), result["opportunities"])
            self.assertEqual(len(result["months_left_buckets"]), 5)
            self.assertEqual(sum(result["months_left_buckets"].values()), result["opportunities"])
            self.assertEqual(result["monthly_grade_months"], 12)
            self.assertEqual(result["gap_heat_months"], 12)
            html_text = html_path.read_text(encoding="utf-8")
            md_text = md_path.read_text(encoding="utf-8")
            self.assertIn("年度年鉴", html_text)
            self.assertIn("<style>", html_text)
            self.assertIn("月度时间线", html_text)
            self.assertIn("月度等级分布", html_text)
            self.assertIn("信息差热度", html_text)
            self.assertIn("窗口衰减统计", html_text)
            self.assertIn("规则生成，非投资建议", html_text)
            self.assertIn("免责声明", html_text)
            for label in ("1 月", "10 月", "12 月"):
                self.assertIn(label, md_text)
            self.assertIn("年榜 Top20", md_text)

    def test_metrics_consistency_and_quota_config(self):
        """v0.6.0：年鉴指标与数据独立复算一致；V02/V08 新配额常量生效。"""
        self.assertEqual(config.WINDOW_QUOTAS, {"day": 10, "week": 20, "month": 30, "year": 80})
        report = yearbook.build_report(self.YEAR, experiments_path=None, sample=False)
        self.assertEqual(len(report["monthly_grades"]), 12)
        for row in report["monthly_grades"]:
            self.assertEqual(sum(row["grades"].values()), row["active"])
        self.assertEqual(len(report["gap_heat"]), 12)
        for row in report["gap_heat"]:
            self.assertLessEqual(len(row["gaps"]), 3)
        decay = report["window_decay"]
        self.assertEqual(decay["samples"], report["counts"]["opportunities"])
        self.assertEqual(sum(decay["by_status"].values()), decay["samples"])
        self.assertEqual(sum(decay["by_decay"].values()), decay["samples"])
        self.assertEqual(len(report["suggestions"]), 3)

    def test_with_experiments_reuses_calibrate_brier(self):
        sample = config.FIXTURES_DIR / "experiments-sample.json"
        with tempfile.TemporaryDirectory() as tmp:
            result = yearbook.generate(self.YEAR, experiments_path=sample, sample=True, out_dir=Path(tmp))
            self.assertTrue(result["sample"])
            export = calibrate.load_export(sample)
            records = calibrate.build_records(export, calibrate.load_opportunities())
            expected = calibrate.compute_brier(records)["brier"]
            self.assertAlmostEqual(result["brier"], expected, places=4)
            html_text = Path(result["html"]).read_text(encoding="utf-8")
            self.assertIn("Brier", html_text)
            self.assertIn("样例实验数据", html_text)

    def test_empty_year(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = yearbook.generate(1999, out_dir=Path(tmp))
            self.assertEqual(result["opportunities"], 0)
            self.assertEqual(result["top20"], 0)
            self.assertEqual(result["a_grade"], 0)
            md_text = Path(result["md"]).read_text(encoding="utf-8")
            html_text = Path(result["html"]).read_text(encoding="utf-8")
            self.assertIn("本年度暂无机会", md_text)
            self.assertIn("本年度暂无 A 级机会", html_text)
            for label in ("1 月", "12 月"):
                self.assertIn(label, md_text)

    def test_deterministic_double_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            first = yearbook.generate(self.YEAR, out_dir=Path(tmp))
            first_html = Path(first["html"]).read_text(encoding="utf-8")
            first_md = Path(first["md"]).read_text(encoding="utf-8")
            second = yearbook.generate(self.YEAR, out_dir=Path(tmp))
            self.assertEqual(first_html, Path(second["html"]).read_text(encoding="utf-8"))
            self.assertEqual(first_md, Path(second["md"]).read_text(encoding="utf-8"))
            # v0.7.2：generated_at 跟随 rankings.meta.as_of（每日运行会推进），不硬编码日期
            as_of = json.loads(
                (config.DATA_DIR / "rankings.json").read_text(encoding="utf-8")
            )["meta"]["as_of"]
            self.assertIn(f"{as_of}T00:00:00+08:00", first_html)

    def test_invalid_experiments_json_tolerated(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp) / "bad.json"
            bad.write_text("{not-json", encoding="utf-8")
            result = yearbook.generate(self.YEAR, experiments_path=bad, out_dir=Path(tmp))
            self.assertIsNotNone(result["experiments_error"])
            self.assertIsNone(result["brier"])
            html_text = Path(result["html"]).read_text(encoding="utf-8")
            self.assertIn("已跳过摘要", html_text)


class TestEnrichMockAndOnline(unittest.TestCase):
    """v0.5.1：mock provider / 真实 HTTP 路径（本地 mock server）/ limit / usage / 失败回退。"""

    @staticmethod
    def _signal(idx: int, title: str = "Pet memorial glass demand grows") -> dict:
        return {
            "signal_id": f"sig-llm-{idx}",
            "source_id": "hnrss",
            "source_category": "demand",
            "title": title,
            "url": f"https://example.com/llm-{idx}",
            "quote": "Owners search for keepsakes after loss...",
            "published_date": "2026-10-20",
            "lang": "en",
            "industry_hints": ["pet"],
            "gap_hints": ["emotion"],
            "emotion_hints": ["grief", "love"],
            "region_hints": ["north-america"],
            "pain_phrases": ["can't find"],
            "trend": {},
        }

    def _write_outbox(self, directory: Path, signals: list[dict]) -> Path:
        path = directory / "signals-2026-10-22.json"
        common.dump_json(path, {"meta": {"as_of": "2026-10-22"}, "signals": signals})
        return path

    def test_mock_provider_full_flow(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            signals_path = self._write_outbox(root, [self._signal(1), self._signal(2), self._signal(3)])
            cache_dir = root / "cache"
            result = enrich.enrich(
                signals_path,
                provider="mock",
                limit=2,
                out_dir=root,
                cache_enabled=False,
                cache_dir=cache_dir,
            )
            self.assertEqual(result["provider"], "mock")
            self.assertEqual(result["generator"], "mock-llm")
            self.assertEqual(result["mode"], "mock-llm")
            self.assertEqual(result["model"], "mock-model")
            self.assertEqual(result["candidates"], 2)
            self.assertEqual(result["skipped"], 1)  # 3 条信号，limit 2
            usage = result["usage"]
            self.assertEqual(usage["calls"], 2)
            self.assertGreater(usage["input_tokens"], 0)
            self.assertGreater(usage["output_tokens"], 0)
            self.assertGreater(usage["estimated_cost_usd"], 0)
            payload = common.load_json(Path(result["enriched_path"]))
            self.assertEqual(payload["meta"]["generator"], "mock-llm")
            self.assertFalse(payload["meta"]["key_logged"])
            for candidate in payload["candidates"]:
                self.assertTrue(candidate["needs_human"])
                self.assertEqual(candidate["_llm"]["provider"], "mock")
                self.assertEqual(candidate["_llm"]["model"], "mock-model")
                self.assertFalse(candidate["_llm"]["cached"])
                self.assertIn("mock", candidate["notes"][0])
            review = Path(result["review_path"]).read_text(encoding="utf-8")
            self.assertIn("mock-llm", review)
            self.assertIn("token 用量", review)

    def test_mock_cache_hit_annotated(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            signals_path = self._write_outbox(root, [self._signal(1), self._signal(2)])
            cache_dir = root / "cache"
            first = enrich.enrich(signals_path, provider="mock", out_dir=root, cache_enabled=True, cache_dir=cache_dir)
            self.assertEqual(first["cache_hits"], 0)
            second = enrich.enrich(signals_path, provider="mock", out_dir=root, cache_enabled=True, cache_dir=cache_dir)
            self.assertEqual(second["cache_hits"], 2)
            self.assertEqual(second["usage"]["calls"], 0)  # 缓存命中不重复计费
            payload = common.load_json(Path(second["enriched_path"]))
            for candidate in payload["candidates"]:
                self.assertTrue(candidate["_llm"]["cached"])
                self.assertIn("cache", candidate["_mode"])

    def test_mock_dry_run_writes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            signals_path = self._write_outbox(root, [self._signal(1)])
            before = {path.name for path in root.iterdir()}
            result = enrich.enrich(signals_path, provider="mock", limit=1, out_dir=root, dry_run=True, cache_enabled=False)
            self.assertEqual({path.name for path in root.iterdir()}, before)
            self.assertEqual(result["provider"], "mock")
            self.assertGreater(result["usage"]["calls"], 0)

    def test_online_with_local_http_server(self):
        captured: dict = {}

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):  # noqa: N802 - http.server 约定
                length = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(length) or b"{}")
                captured["path"] = self.path
                captured["authorization"] = self.headers.get("Authorization")
                captured["body"] = body
                content = json.dumps(
                    {
                        "title_suggestion": "LLM 候选标题",
                        "industry_id": "pet",
                        "gap_type_ids": ["emotion"],
                        "human_need_ids": ["belonging"],
                        "seven_questions_draft": {
                            "traffic": "（LLM 草稿）待人工补充：渠道",
                            "money": "（LLM 草稿）待人工补充：客单",
                            "model": "（LLM 草稿）待人工补充：模式",
                            "roi": "（LLM 草稿）待人工补充：回报",
                            "audience": "（LLM 草稿）待人工补充：人群",
                            "drivers": ["info"],
                            "moat": "（LLM 草稿）待人工补充：壁垒",
                        },
                        "notes": ["来自本地 mock server 的测试响应"],
                        "needs_human": True,
                    },
                    ensure_ascii=False,
                )
                response = json.dumps(
                    {
                        "model": "test-model",
                        "choices": [{"message": {"role": "assistant", "content": content}}],
                        "usage": {"prompt_tokens": 12, "completion_tokens": 8, "total_tokens": 20},
                    }
                ).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(response)))
                self.end_headers()
                self.wfile.write(response)

            def log_message(self, *args):  # 静默
                return

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                signals_path = self._write_outbox(root, [self._signal(1), self._signal(2)])
                env = {
                    "LLM_API_KEY": "test-secret-key",
                    "LLM_BASE_URL": f"http://127.0.0.1:{server.server_address[1]}/v1",
                    "LLM_MODEL": "test-model",
                }
                with mock.patch.dict(os.environ, env, clear=False):
                    result = enrich.enrich(
                        signals_path,
                        provider="online",
                        limit=2,
                        out_dir=root,
                        cache_enabled=False,
                        cache_dir=root / "cache",
                    )
                self.assertEqual(result["generator"], "llm")
                self.assertEqual(result["model"], "test-model")
                self.assertEqual(result["candidates"], 2)
                self.assertEqual(result["usage"]["calls"], 2)
                self.assertEqual(result["usage"]["input_tokens"], 24)
                self.assertEqual(result["usage"]["output_tokens"], 16)
                self.assertGreater(result["usage"]["estimated_cost_usd"], 0)
                # 请求构造/头/体校验
                self.assertEqual(captured["path"], "/v1/chat/completions")
                self.assertEqual(captured["authorization"], "Bearer test-secret-key")
                self.assertEqual(captured["body"]["model"], "test-model")
                self.assertEqual(len(captured["body"]["messages"]), 2)
                self.assertIn("只基于用户提供的信号", captured["body"]["messages"][0]["content"])
                # 解析结果 + key 不落盘
                payload = common.load_json(Path(result["enriched_path"]))
                self.assertEqual(payload["candidates"][0]["seven_questions_draft"]["traffic"], "（LLM 草稿）待人工补充：渠道")
                self.assertEqual(payload["candidates"][0]["_llm"]["provider"], "online")
                enriched_text = Path(result["enriched_path"]).read_text(encoding="utf-8")
                review_text = Path(result["review_path"]).read_text(encoding="utf-8")
                self.assertNotIn("test-secret-key", enriched_text)
                self.assertNotIn("test-secret-key", review_text)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

    def test_online_failure_falls_back_to_offline(self):
        class FailingHandler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):  # noqa: N802
                self.send_response(500)
                self.send_header("Content-Length", "0")
                self.end_headers()

            def log_message(self, *args):
                return

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FailingHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                signals_path = self._write_outbox(root, [self._signal(1)])
                env = {
                    "LLM_API_KEY": "test-secret-key",
                    "LLM_BASE_URL": f"http://127.0.0.1:{server.server_address[1]}/v1",
                    "LLM_MODEL": "test-model",
                }
                with mock.patch.dict(os.environ, env, clear=False), mock.patch.object(
                    config, "LLM_RETRY_BACKOFF_SEC", 0.0
                ), mock.patch.object(config, "LLM_MAX_RETRIES", 0):
                    result = enrich.enrich(
                        signals_path,
                        provider="online",
                        limit=1,
                        out_dir=root,
                        cache_enabled=False,
                        cache_dir=root / "cache",
                    )
                self.assertEqual(result["llm_fallback"], 1)
                self.assertIsNotNone(result["error"])
                self.assertIn("LLM 请求失败", result["error"])
                payload = common.load_json(Path(result["enriched_path"]))
                candidate = payload["candidates"][0]
                self.assertTrue(candidate["needs_human"])
                self.assertIn("回退 offline-template", candidate["notes"][0])
                self.assertIsNone(candidate.get("_llm"))
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

    def test_cli_relative_out_dir_does_not_crash(self):
        """v0.5.1 P1 回归：--out-dir 为相对路径时 CLI 不得抛 ValueError（exit 0 且产物写出）。"""
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._write_outbox(root, [self._signal(1)])
            cwd = os.getcwd()
            os.chdir(root)
            try:
                code = enrich.main(
                    [
                        "--signals", "signals-2026-10-22.json",
                        "--out-dir", "out",
                        "--provider", "mock",
                        "--limit", "1",
                        "--no-cache",
                    ]
                )
            finally:
                os.chdir(cwd)
            self.assertEqual(code, 0)
            self.assertTrue((root / "out" / "enriched-2026-10-22.json").exists())
            self.assertTrue((root / "out" / "REVIEW.md").exists())

    def test_cli_relative_out_dir_yearbook_and_calibrate(self):
        """v0.5.1 P1 回归：yearbook/calibrate 的 --out-dir 相对路径同样不得崩溃。"""
        sample = config.FIXTURES_DIR / "experiments-sample.json"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cwd = os.getcwd()
            os.chdir(root)
            try:
                yearbook_code = yearbook.main(["--year", "2026", "--out-dir", "out-yb"])
                calibrate_code = calibrate.main(
                    ["--experiments", str(sample), "--out-dir", "out-cal", "--sample"]
                )
            finally:
                os.chdir(cwd)
            self.assertEqual(yearbook_code, 0)
            self.assertEqual(calibrate_code, 0)
            self.assertTrue((root / "out-yb" / "yearbook-2026.html").exists())
            self.assertTrue((root / "out-cal" / "calibration-2026-10-22.html").exists())


class TestAsOf(unittest.TestCase):
    """v0.6.1：pipeline --as-of / validate V08 配额按基准日 / report+yearbook 日期跟随。"""

    def test_resolve_as_of(self):
        self.assertEqual(pipeline.resolve_as_of(None), date(2026, 10, 22))
        self.assertEqual(pipeline.resolve_as_of("2026-10-23"), date(2026, 10, 23))
        with self.assertRaises(ValueError):
            pipeline.resolve_as_of("2026-13-01")

    # ------------------------------------------------ v0.7.3：fetch --as-of
    def _fake_fetch_result(self) -> dict:
        return {
            "health": [],
            "outbox_path": str(config.OUTBOX_DIR / "signals-test.json"),
            "source_health_path": str(config.SOURCE_HEALTH_PATH),
            "ok_count": 0,
            "failed_count": 0,
            "signal_count": 0,
            "raw_count": 0,
        }

    def test_fetch_as_of_passes_date_to_run_fetch(self):
        captured: dict = {}

        def fake_run(as_of: str, *, limit: int, cache_enabled: bool) -> dict:
            captured["as_of"] = as_of
            captured["limit"] = limit
            return self._fake_fetch_result()

        with mock.patch.object(fetch, "run_fetch", side_effect=fake_run), mock.patch.object(
            pipeline.fetch_mod, "ensure_outbox_ignore"
        ):
            code = pipeline.main(["--fetch", "--as-of", "2026-10-23"])
        self.assertEqual(code, 0)
        self.assertEqual(captured["as_of"], "2026-10-23")

    def test_fetch_default_uses_taxonomy_as_of(self):
        taxonomy = common.load_json(config.TAXONOMY_PATH)
        expected = common.parse_as_of(taxonomy).isoformat()
        captured: dict = {}

        def fake_run(as_of: str, *, limit: int, cache_enabled: bool) -> dict:
            captured["as_of"] = as_of
            return self._fake_fetch_result()

        with mock.patch.object(fetch, "run_fetch", side_effect=fake_run), mock.patch.object(
            pipeline.fetch_mod, "ensure_outbox_ignore"
        ):
            code = pipeline.main(["--fetch"])
        self.assertEqual(code, 0)
        self.assertEqual(captured["as_of"], expected)

    def test_rank_windows_shift_with_as_of(self):
        """窗口归属随 as_of 变化；不硬编码仓内数据日期（每日运行会推进 as_of）。"""
        opps = common.load_json(config.OPPORTUNITIES_PATH)
        rankings = common.load_json(config.RANKINGS_PATH)
        base = common.parse_date(rankings["meta"]["as_of"])

        def count_window(window: str, as_of: date) -> int:
            total = 0
            for opp in opps:
                last = common.parse_date(opp["last_activity"])
                if window == "day":
                    total += int(last == as_of)
                elif window == "week":
                    total += int(last.isocalendar()[:2] == as_of.isocalendar()[:2])
                elif window == "month":
                    total += int((last.year, last.month) == (as_of.year, as_of.month))
                elif window == "year":
                    total += int(last.year == as_of.year)
            return total

        expected_base = {window: count_window(window, base) for window in ("day", "week", "month", "year")}
        self.assertEqual(rankings["meta"]["counts"], expected_base)
        built_base = rank.build_rankings(opps, base)
        self.assertEqual(built_base["meta"]["counts"], expected_base)

        # 次日：所有窗口都按 as_of 重新计算（跨周/月/年时也随之变化）
        next_day = base + timedelta(days=1)
        r1 = rank.build_rankings(opps, next_day)
        self.assertEqual(r1["meta"]["as_of"], next_day.isoformat())
        self.assertEqual(r1["windows"]["day"]["key"], next_day.isoformat())
        for window in ("day", "week", "month", "year"):
            self.assertEqual(r1["meta"]["counts"][window], count_window(window, next_day), window)

        # 下月第一天：month 归零（数据都在当前月及以前）
        next_month = (base.replace(day=1) + timedelta(days=32)).replace(day=1)
        r2 = rank.build_rankings(opps, next_month)
        for window in ("day", "week", "month", "year"):
            self.assertEqual(r2["meta"]["counts"][window], count_window(window, next_month), window)

        # 下一年：year 归零（无未来年份活动）
        next_year = date(base.year + 1, 1, 1)
        r3 = rank.build_rankings(opps, next_year)
        self.assertEqual(sum(r3["meta"]["counts"].values()), 0)

    def test_validate_v08_quota_only_baseline(self):
        empty_windows = {window: {"items": []} for window in config.WINDOW_QUOTAS}
        ctx_next_day = {
            "opportunities": [],
            "rankings": {"meta": {"as_of": "2026-10-23"}, "windows": empty_windows},
        }
        detail = validate._v08(ctx_next_day)
        self.assertIn("非基准日", detail)
        ctx_baseline = {
            "opportunities": [],
            "rankings": {"meta": {"as_of": "2026-10-22"}, "windows": empty_windows},
        }
        with self.assertRaises(validate.CheckFailure):
            validate._v08(ctx_baseline)

    def test_validate_as_of_prefers_rankings_meta(self):
        taxonomy = _load_taxonomy()
        ctx = {"taxonomy": taxonomy, "rankings": {"meta": {"as_of": "2026-10-23"}}}
        self.assertEqual(validate._as_of(ctx), date(2026, 10, 23))
        ctx_fallback = {"taxonomy": taxonomy, "rankings": None}
        self.assertEqual(validate._as_of(ctx_fallback), common.parse_as_of(taxonomy))

    def test_yearbook_uses_rankings_as_of(self):
        taxonomy = _load_taxonomy()
        opps = common.load_json(config.OPPORTUNITIES_PATH)
        rankings = {"meta": {"as_of": "2026-10-23"}, "windows": {}}

        def fake_load(path: Path):
            if Path(path) == config.TAXONOMY_PATH:
                return taxonomy
            if Path(path) == config.OPPORTUNITIES_PATH:
                return opps
            if Path(path) == config.RANKINGS_PATH:
                return rankings
            raise AssertionError(f"unexpected path {path}")

        with mock.patch.object(yearbook.common, "load_json", side_effect=fake_load):
            inputs = yearbook.load_inputs(2026)
        self.assertEqual(inputs["as_of"], date(2026, 10, 23))

    def test_report_as_of_override(self):
        with tempfile.TemporaryDirectory() as tmp:
            rows = report.generate(["day"], as_of="2026-10-23", reports_dir=Path(tmp))
            html_path = Path(rows[0]["html"])
            self.assertIn("2026-10-23", html_path.name)
            html_text = html_path.read_text(encoding="utf-8")
            self.assertIn("2026-10-23", html_text)
            self.assertIn("生成于 2026-10-23", html_text)  # as_of 覆盖已渲染进页面


if __name__ == "__main__":
    unittest.main(verbosity=2)
