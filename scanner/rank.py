"""榜单模块：按契约 5.1 的窗口规则生成 data/rankings.json。

窗口归属（全部按 Asia/Shanghai 日界）：
- day   : last_activity == as_of
- week  : last_activity 落在 as_of 所在 ISO 周（2026-W43）
- month : last_activity 落在 as_of 所在自然月（2026-10）
- year  : last_activity 落在 as_of 所在自然年（2026）
同一机会可同时出现在多个窗口。

排序链（契约 §5.1）：rank_score 降序 → momentum 降序 → evidence_count 降序 →
last_activity 降序 → opp_id 升序；`rank` 从 1 连续。

delta/change 口径（v0.1.0 明确）：以「相邻更大窗口」为参照——
day 参照 week，week 参照 month，month 参照 year，year 无参照（delta=null, change="new"）。
delta = 参照窗口名次 − 本窗口名次（正数=上升）。参照窗口中不存在 = 新上榜。
"""
from __future__ import annotations

from datetime import date
from typing import Any

from . import config
from .common import iso_week_key, month_key, window_key, window_label, year_key

WINDOWS = ["day", "week", "month", "year"]
# 参照窗口（上一窗口）
REFERENCE = {"day": "week", "week": "month", "month": "year", "year": None}


def _sort_key(item: dict) -> tuple:
    """契约 docs/12 §5.1 排序链：
    rank_score 降序 → momentum 降序 → evidence_count 降序 → last_activity 降序 → opp_id 升序。
    """
    return (
        -float(item["rank_score"]),
        -float(item.get("momentum", 1.0)),
        -int(item.get("evidence_count", 0)),
        -date.fromisoformat(item["last_activity"]).toordinal(),
        item["id"],
    )


def _window_members(opportunities: list[dict], as_of: date) -> dict[str, list[dict]]:
    by_window: dict[str, list[dict]] = {w: [] for w in WINDOWS}
    for opp in opportunities:
        last = opp.get("last_activity")
        if not last:
            raise ValueError(f"{opp.get('id')}: 缺失 last_activity，无法归入榜单窗口")
        try:
            day = date.fromisoformat(last)
        except ValueError as exc:
            raise ValueError(f"{opp.get('id')}: last_activity 非法日期 {last!r}") from exc
        if window_key("day", day) == window_key("day", as_of):
            by_window["day"].append(opp)
        if iso_week_key(day) == iso_week_key(as_of):
            by_window["week"].append(opp)
        if month_key(day) == month_key(as_of):
            by_window["month"].append(opp)
        if year_key(day) == year_key(as_of):
            by_window["year"].append(opp)
    return by_window


def build_rankings(opportunities: list[dict], as_of: date) -> dict[str, Any]:
    members = _window_members(opportunities, as_of)
    sorted_by_window = {w: sorted(members[w], key=_sort_key) for w in WINDOWS}

    rank_maps: dict[str, dict[str, int]] = {}
    for window in WINDOWS:
        rank_maps[window] = {
            opp["id"]: idx + 1 for idx, opp in enumerate(sorted_by_window[window])
        }

    windows: dict[str, Any] = {}
    for window in WINDOWS:
        items = []
        reference = REFERENCE[window]
        for idx, opp in enumerate(sorted_by_window[window]):
            rank = idx + 1
            delta = None
            change = "new"
            if reference is not None:
                prev_rank = rank_maps[reference].get(opp["id"])
                if prev_rank is None:
                    delta, change = None, "new"
                else:
                    delta = prev_rank - rank
                    change = "up" if delta > 0 else "down" if delta < 0 else "flat"
            items.append(
                {
                    "opp_id": opp["id"],
                    "rank": rank,
                    "rank_score": float(opp["rank_score"]),
                    "total": float(opp["scores"]["total"]),
                    "delta": delta,
                    "change": change,
                }
            )
        day = as_of
        windows[window] = {
            "key": window_key(window, day),
            "label": window_label(window, day),
            "count": len(items),
            "items": items,
        }

    return {
        "meta": {
            "data_version": config.DATA_VERSION,
            "as_of": as_of.isoformat(),
            "generator": "scanner/pipeline.py",
            "window_rules": "day=last_activity==as_of; week=ISO week; month=YYYY-MM; year=YYYY",
            "delta_rules": "delta 相对相邻更大窗口名次：day←week, week←month, month←year, year 无参照",
            "tie_breaker": "rank_score desc, momentum desc, evidence_count desc, last_activity desc, opp_id asc",
            "quotas": config.WINDOW_QUOTAS,
            "counts": {w: windows[w]["count"] for w in WINDOWS},
        },
        "windows": windows,
    }
