"""统计模块：生成 data/stats.json（前端首屏 KPI 与图表使用的聚合结果）。

stats.json 是扫描器生成的派生数据，前端不得自行重算榜单窗口归属；
但 KPI/直方图/分组的聚合口径以本模块为准，validate.py V14 会复核。
"""
from __future__ import annotations

from datetime import date
from typing import Any

from . import config
from .common import clamp, recent_dates, round1


def _name_map(taxonomy: dict, key: str) -> dict[str, str]:
    return {item["id"]: item["name"] for item in taxonomy.get(key, [])}


def _group_counts(
    opportunities: list[dict],
    taxonomy: dict,
    key: str,
    collection: str,
    *,
    multi: bool,
) -> list[dict]:
    names = _name_map(taxonomy, collection)
    buckets: dict[str, list[float]] = {item["id"]: [] for item in taxonomy.get(collection, [])}
    for opp in opportunities:
        value = opp.get(key)
        values = value if multi else [value]
        seen: set[str] = set()
        for item_id in values or []:
            if item_id in seen:
                continue
            seen.add(item_id)
            if item_id in buckets:
                buckets[item_id].append(float(opp["scores"]["total"]))
    rows = []
    for item_id, totals in buckets.items():
        rows.append(
            {
                "id": item_id,
                "name": names.get(item_id, item_id),
                "count": len(totals),
                "avg_total": round1(sum(totals) / len(totals)) if totals else 0.0,
            }
        )
    rows.sort(key=lambda row: (-row["count"], row["id"]))
    return rows


def _score_histogram(opportunities: list[dict]) -> list[int]:
    buckets = [0] * 10
    for opp in opportunities:
        total = float(opp["scores"]["total"])
        idx = min(9, max(0, int(total // 10)))
        buckets[idx] += 1
    return buckets


def _trend_14d(opportunities: list[dict], as_of: date) -> list[dict]:
    first_seen: dict[str, int] = {}
    active: dict[str, list[float]] = {}
    for opp in opportunities:
        fs = opp.get("first_seen")
        if fs:
            first_seen[fs] = first_seen.get(fs, 0) + 1
        la = opp.get("last_activity")
        if la:
            active.setdefault(la, []).append(float(opp["scores"]["total"]))
    rows = []
    for day in recent_dates(as_of, 14):
        totals = active.get(day, [])
        rows.append(
            {
                "date": day,
                "new_count": first_seen.get(day, 0),
                "active_count": len(totals),
                "avg_score": round1(sum(totals) / len(totals)) if totals else 0.0,
            }
        )
    return rows


def build_stats(
    opportunities: list[dict],
    taxonomy: dict,
    as_of: date,
    candidates: list[dict] | None = None,
) -> dict[str, Any]:
    industries = _group_counts(opportunities, taxonomy, "industry_id", "industries", multi=False)
    gap_types = _group_counts(opportunities, taxonomy, "gap_type_ids", "gap_types", multi=True)
    regions = _group_counts(opportunities, taxonomy, "region_ids", "regions", multi=True)
    needs = _group_counts(opportunities, taxonomy, "human_need_ids", "human_needs", multi=True)

    totals = [float(opp["scores"]["total"]) for opp in opportunities]
    grade_counts = {g["id"]: 0 for g in taxonomy.get("grades", [])}
    for opp in opportunities:
        grade = opp["scores"].get("grade", "D")
        grade_counts[grade] = grade_counts.get(grade, 0) + 1

    open_value = 0.0
    for opp in opportunities:
        status = opp.get("window", {}).get("status")
        if status in ("open", "peak"):
            monthly = opp.get("roi", {}).get("monthly_revenue_cny", {}) or {}
            open_value += float(monthly.get("max", 0) or 0)

    as_of_iso = as_of.isoformat()
    candidate_rows = list(candidates or [])
    kpi = {
        "total_opps": len(opportunities),
        "new_today": sum(1 for opp in opportunities if opp.get("last_activity") == as_of_iso),
        "new_first_seen_today": sum(1 for opp in opportunities if opp.get("first_seen") == as_of_iso),
        "grade_a_plus": sum(1 for opp in opportunities if opp["scores"]["grade"] in ("S", "A")),
        "industries_covered": sum(1 for row in industries if row["count"] > 0),
        "regions_covered": sum(1 for row in regions if row["count"] > 0),
        "avg_total": round1(sum(totals) / len(totals)) if totals else 0.0,
        "verified_count": sum(1 for opp in opportunities if opp.get("verified") is True),
        "evidence_total": sum(len(opp.get("signal", {}).get("evidence", [])) for opp in opportunities),
        # v0.9.0 自动发现轨（与精选人工库并行；验证状态不影响计数/排序）
        "candidates_total": len(candidate_rows),
        "today_new_candidates": sum(1 for candidate in candidate_rows if candidate.get("first_seen") == as_of_iso),
        "unverified_candidates": sum(1 for candidate in candidate_rows if candidate.get("verification_status") == "unverified"),
    }

    return {
        "meta": {
            "data_version": config.DATA_VERSION,
            "as_of": as_of_iso,
            "generator": "scanner/pipeline.py",
        },
        "kpi": kpi,
        "by_grade": grade_counts,
        "by_industry": industries,
        "by_gap_type": gap_types,
        "by_region": regions,
        "by_need": needs,
        "score_histogram": _score_histogram(opportunities),
        "score_histogram_ranges": [
            "0-9", "10-19", "20-29", "30-39", "40-49",
            "50-59", "60-69", "70-79", "80-89", "90-100",
        ],
        "trend_14d": _trend_14d(opportunities, as_of),
        "open_window_value_cny": int(round(open_value)),
    }
