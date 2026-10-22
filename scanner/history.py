"""历史快照（data/history/rankings-<date>.json）读写、上一期查找与历史回放。

data-v0.3.0：
- 真实每日快照：`--all` 按 as_of 写一份，`meta.reconstructed=false`；
- 历史回放快照：`--replay-as-of <date> --replay-days N` 生成确定性回放，
  `meta.reconstructed=true`、`meta.replay_as_of=<date>`，只按当日窗口规则重排现有机会
  （仅纳入 last_activity ≤ 回放日的机会，不新增/不修改机会库）；
- `meta.snapshot_at` 为确定性逻辑时间（`<date>T00:00:00+08:00`），同日重复生成字节一致（幂等）。
"""
from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime
from pathlib import Path
from typing import Any

from . import config
from .common import dump_json, load_json

FILENAME_PREFIX = "rankings-"


def snapshot_path(day: date, history_dir: Path | None = None) -> Path:
    return (history_dir or config.HISTORY_DIR) / f"{FILENAME_PREFIX}{day.isoformat()}.json"


def write_snapshot(
    rankings: dict[str, Any],
    as_of: date,
    history_dir: Path | None = None,
    *,
    reconstructed: bool = False,
) -> Path:
    """写入（覆盖）as_of 当天快照；内容确定，重复运行字节一致。

    reconstructed=True 表示历史回放（v0.3.0），必须带 meta.replay_as_of。
    """
    snapshot = deepcopy(rankings)
    meta = snapshot.setdefault("meta", {})
    meta["snapshot_at"] = f"{as_of.isoformat()}{config.SNAPSHOT_TIME_SUFFIX}"
    meta["reconstructed"] = bool(reconstructed)
    meta["data_version"] = config.DATA_VERSION
    if reconstructed:
        meta["replay_as_of"] = as_of.isoformat()
    else:
        meta.pop("replay_as_of", None)
    path = snapshot_path(as_of, history_dir)
    dump_json(path, snapshot)
    return path


def build_replay_snapshot(
    opportunities: list[dict[str, Any]],
    replay_date: date,
    history_dir: Path | None = None,
) -> tuple[Path, dict[str, Any]]:
    """生成单个历史回放快照（确定性）。

    - 只纳入 `last_activity <= replay_date` 的机会，避免「未来信号」进入回放；
    - 上一期取严格早于 replay_date 的最近快照（回放可按日期顺序链式生成）；
    - 不写回 data/opportunities.json、不改变评分与排序规则。
    """
    from . import rank  # 延迟导入，避免模块级循环依赖

    available = [
        opp
        for opp in opportunities
        if str(opp.get("last_activity", "")) <= replay_date.isoformat()
    ]
    previous = find_previous_snapshot(replay_date, history_dir)
    rankings = rank.build_rankings(
        available,
        replay_date,
        previous_snapshot=previous[1] if previous else None,
    )
    path = write_snapshot(rankings, replay_date, history_dir, reconstructed=True)
    return path, rankings


def _snapshot_date(path: Path) -> date | None:
    name = path.stem
    if not name.startswith(FILENAME_PREFIX):
        return None
    try:
        return date.fromisoformat(name[len(FILENAME_PREFIX) :])
    except ValueError:
        return None


def list_snapshots(history_dir: Path | None = None) -> list[tuple[date, Path]]:
    directory = history_dir or config.HISTORY_DIR
    if not directory.exists():
        return []
    rows: list[tuple[date, Path]] = []
    for path in directory.glob(f"{FILENAME_PREFIX}*.json"):
        day = _snapshot_date(path)
        if day:
            rows.append((day, path))
    rows.sort(key=lambda item: item[0])
    return rows


def find_previous_snapshot(
    as_of: date, history_dir: Path | None = None
) -> tuple[date, dict[str, Any]] | None:
    """返回严格早于 as_of 的最近一份快照（同日快照不作为自身参照）。"""
    for day, path in reversed(list_snapshots(history_dir)):
        if day < as_of:
            return day, load_json(path)
    return None


def snapshot_rank_maps(snapshot: dict[str, Any]) -> dict[str, dict[str, int]]:
    """快照 → {window: {opp_id: rank}}。"""
    maps: dict[str, dict[str, int]] = {}
    for window, data in (snapshot.get("windows") or {}).items():
        maps[window] = {
            item["opp_id"]: int(item["rank"]) for item in (data.get("items") or []) if item.get("opp_id")
        }
    return maps


def snapshot_summary(history_dir: Path | None = None) -> dict[str, Any]:
    snapshots = list_snapshots(history_dir)
    rows = []
    for day, path in snapshots:
        snapshot = load_json(path)
        meta = snapshot.get("meta") or {}
        rows.append(
            {
                "date": day.isoformat(),
                "reconstructed": bool(meta.get("reconstructed")),
                "delta_basis": meta.get("delta_basis"),
                "history_as_of": meta.get("history_as_of"),
            }
        )
    return {
        "count": len(rows),
        "dates": [row["date"] for row in rows],
        "latest": rows[-1]["date"] if rows else None,
        "snapshots": rows,
    }


def validate_snapshot_shape(snapshot: dict[str, Any], day: date) -> list[str]:
    """V19 辅助：单份快照结构检查（v0.3.0 收紧），返回问题列表。"""
    issues: list[str] = []
    if not isinstance(snapshot, dict):
        return [f"{day}: 快照不是对象"]
    meta = snapshot.get("meta") or {}
    snapshot_at = meta.get("snapshot_at")
    if not snapshot_at:
        issues.append(f"{day}: 缺少 meta.snapshot_at")
    else:
        try:
            parsed_at = datetime.fromisoformat(str(snapshot_at))
        except ValueError:
            issues.append(f"{day}: meta.snapshot_at 非 ISO8601")
            parsed_at = None
        if parsed_at is not None and parsed_at.date() != day:
            issues.append(f"{day}: meta.snapshot_at 日期 {parsed_at.date()} 与文件名不一致")
    reconstructed = meta.get("reconstructed")
    if not isinstance(reconstructed, bool):
        issues.append(f"{day}: meta.reconstructed 必须为 bool")
    elif reconstructed:
        if meta.get("replay_as_of") != day.isoformat():
            issues.append(f"{day}: 回放快照必须有 meta.replay_as_of={day.isoformat()}")
    else:
        if meta.get("replay_as_of") is not None:
            issues.append(f"{day}: 真实快照不应带 meta.replay_as_of")
    if meta.get("data_version") != config.DATA_VERSION:
        issues.append(f"{day}: meta.data_version={meta.get('data_version')} ≠ {config.DATA_VERSION}")
    if meta.get("as_of") != day.isoformat():
        issues.append(f"{day}: meta.as_of={meta.get('as_of')} 与文件名不一致")
    basis = meta.get("delta_basis")
    if basis not in config.DELTA_BASES:
        issues.append(f"{day}: meta.delta_basis={basis} 非法")
    windows = snapshot.get("windows")
    if not isinstance(windows, dict):
        return issues + [f"{day}: windows 缺失"]
    for window in ("day", "week", "month", "year"):
        data = windows.get(window)
        if not isinstance(data, dict):
            issues.append(f"{day}: windows.{window} 缺失")
            continue
        items = data.get("items")
        if not isinstance(items, list):
            issues.append(f"{day}: windows.{window}.items 非数组")
            continue
        ranks = [item.get("rank") for item in items]
        if ranks != list(range(1, len(items) + 1)):
            issues.append(f"{day}: windows.{window}.rank 未从 1 连续")
        for item in items:
            change = item.get("change")
            delta = item.get("delta")
            if change not in {"new", "up", "down", "flat"}:
                issues.append(f"{day}: {window}:{item.get('opp_id')} change 非法")
                continue
            if basis == "adjacent-window" and window == "year" and delta is not None:
                issues.append(f"{day}: {window} adjacent-window 口径下 delta 应为 null")
            if change == "new" and delta is not None:
                issues.append(f"{day}: {window}:{item.get('opp_id')} change=new 但 delta 非 null")
            if change == "up" and not (isinstance(delta, int) and delta > 0):
                issues.append(f"{day}: {window}:{item.get('opp_id')} change=up 但 delta≤0")
            if change == "down" and not (isinstance(delta, int) and delta < 0):
                issues.append(f"{day}: {window}:{item.get('opp_id')} change=down 但 delta≥0")
            if change == "flat" and delta != 0:
                issues.append(f"{day}: {window}:{item.get('opp_id')} change=flat 但 delta≠0")
    return issues
