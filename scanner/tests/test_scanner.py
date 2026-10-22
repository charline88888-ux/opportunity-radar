"""scanner 单元测试（标准库 unittest）。

运行：
    python -m unittest discover -s scanner/tests -v
    python scanner/tests/test_scanner.py        # 也可直接运行
"""
from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scanner import common, config, dedupe, materialize, normalize, rank, score, validate  # noqa: E402


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


if __name__ == "__main__":
    unittest.main(verbosity=2)
