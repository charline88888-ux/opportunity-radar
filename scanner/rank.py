"""榜单模块：按契约 5.1（data-v0.2.0）生成 data/rankings.json。

窗口归属（全部按 Asia/Shanghai 日界）：
- day   : last_activity == as_of
- week  : last_activity 落在 as_of 所在 ISO 周（2026-W43）
- month : last_activity 落在 as_of 所在自然月（2026-10）
- year  : last_activity 落在 as_of 所在自然年（2026）
同一机会可同时出现在多个窗口。

排序链（契约 §5.1）：rank_score 降序 → momentum 降序 → evidence_count 降序 →
last_activity 降序 → opp_id 升序；rank 从 1 连续。

delta 口径（v0.2.0）：
1. 优先「上一份历史快照的同窗口名次」：delta = 上期名次 − 本期名次，delta_basis="history"；
2. 无历史（首版/该窗口上期为空）：回退相邻更大窗口口径（day←week、week←month、
   month←year、year 无参照），delta_basis="adjacent-window"；
3. 完全无参照：delta=null、change="new"。
"""
from __future__ import annotations

from datetime import date
from typing import Any

from . import config
from .common import iso_week_key, month_key, window_key, window_label, year_key

WINDOWS = ["day", "week", "month", "year"]
# 相邻更大窗口参照（无历史时的回退口径）
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


def _delta_for(
    *,
    opp_id: str,
    rank: int,
    window: str,
    history_ranks: dict[str, dict[str, int]],
    window_has_history: bool,
    current_rank_maps: dict[str, dict[str, int]],
) -> tuple[int | None, str]:
    """返回 (delta, change)。

    v0.3.0 真实 delta：
    - 上一快照该窗口非空（window_has_history）→ 只比较同窗口上期名次；
      两期都出现才有 delta，新增为 null/new（不再回退相邻窗口）；
    - 上一快照缺失或该窗口上期为空 → 回退 adjacent-window 口径。
    """
    if window_has_history:
        prev_rank = (history_ranks.get(window) or {}).get(opp_id)
        if prev_rank is None:
            return None, "new"
        delta = int(prev_rank - rank)
        change = "up" if delta > 0 else "down" if delta < 0 else "flat"
        return delta, change

    reference = REFERENCE[window]
    if reference is not None:
        prev_rank = current_rank_maps.get(reference, {}).get(opp_id)
        if prev_rank is not None:
            delta = int(prev_rank - rank)
            change = "up" if delta > 0 else "down" if delta < 0 else "flat"
            return delta, change
    return None, "new"


def build_rankings(
    opportunities: list[dict],
    as_of: date,
    previous_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """生成榜单。`previous_snapshot` 为上一份历史快照（无则回退相邻窗口口径）。"""
    members = _window_members(opportunities, as_of)
    sorted_by_window = {window: sorted(members[window], key=_sort_key) for window in WINDOWS}

    current_rank_maps: dict[str, dict[str, int]] = {}
    for window in WINDOWS:
        current_rank_maps[window] = {
            opp["id"]: idx + 1 for idx, opp in enumerate(sorted_by_window[window])
        }

    history_ranks: dict[str, dict[str, int]] = {}
    if previous_snapshot:
        for window, data in (previous_snapshot.get("windows") or {}).items():
            history_ranks[window] = {
                item["opp_id"]: int(item["rank"])
                for item in (data.get("items") or [])
                if item.get("opp_id")
            }

    windows: dict[str, Any] = {}
    for window in WINDOWS:
        items = []
        # 上一快照该窗口非空 → 该窗口用 history 口径；否则整体回退 adjacent-window
        window_has_history = previous_snapshot is not None and bool(history_ranks.get(window))
        for idx, opp in enumerate(sorted_by_window[window]):
            rank = idx + 1
            delta, change = _delta_for(
                opp_id=opp["id"],
                rank=rank,
                window=window,
                history_ranks=history_ranks,
                window_has_history=window_has_history,
                current_rank_maps=current_rank_maps,
            )
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
        windows[window] = {
            "key": window_key(window, as_of),
            "label": window_label(window, as_of),
            "count": len(items),
            "delta_basis": "history" if window_has_history else "adjacent-window",
            "items": items,
        }

    history_as_of = None
    if previous_snapshot:
        history_as_of = (previous_snapshot.get("meta") or {}).get("as_of")
    return {
        "meta": {
            "data_version": config.DATA_VERSION,
            "as_of": as_of.isoformat(),
            "generator": "scanner/pipeline.py",
            "window_rules": "day=last_activity==as_of; week=ISO week; month=YYYY-MM; year=YYYY",
            "delta_rules": (
                "优先上一快照同窗口名次（delta=上期名次−本期名次）；无历史回退 adjacent-window："
                "day←week, week←month, month←year, year 无参照"
            ),
            "delta_basis": "history" if previous_snapshot else "adjacent-window",
            "history_as_of": history_as_of,
            "tie_breaker": "rank_score desc, momentum desc, evidence_count desc, last_activity desc, opp_id asc",
            "quotas": config.WINDOW_QUOTAS,
            "counts": {window: windows[window]["count"] for window in WINDOWS},
        },
        "windows": windows,
    }
