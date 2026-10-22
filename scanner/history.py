"""历史快照（data/history/rankings-<date>.json）读写与上一期查找。

v0.2.0：每次 `pipeline.py --all` 按 as_of 写一份快照（同日覆盖），
下一步运行若存在更早快照，则 delta 用「上一快照同窗口名次」计算。
快照内容 = rankings.json + meta.snapshot_at（逻辑时间，确定性）+ meta.reconstructed=false，
因此同日重复运行内容完全一致（幂等）。
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


def write_snapshot(rankings: dict[str, Any], as_of: date, history_dir: Path | None = None) -> Path:
    """写入（覆盖）as_of 当天的榜单快照；内容确定，重复运行字节一致。"""
    snapshot = deepcopy(rankings)
    meta = snapshot.setdefault("meta", {})
    meta["snapshot_at"] = f"{as_of.isoformat()}{config.SNAPSHOT_TIME_SUFFIX}"
    meta["reconstructed"] = False
    meta["data_version"] = config.DATA_VERSION
    path = snapshot_path(as_of, history_dir)
    dump_json(path, snapshot)
    return path


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
    latest = snapshots[-1] if snapshots else None
    return {
        "count": len(snapshots),
        "dates": [day.isoformat() for day, _ in snapshots],
        "latest": latest[0].isoformat() if latest else None,
    }


def validate_snapshot_shape(snapshot: dict[str, Any], day: date) -> list[str]:
    """V19 辅助：快照结构检查，返回问题列表。"""
    issues: list[str] = []
    if not isinstance(snapshot, dict):
        return [f"{day}: 快照不是对象"]
    meta = snapshot.get("meta") or {}
    if not meta.get("snapshot_at"):
        issues.append(f"{day}: 缺少 meta.snapshot_at")
    else:
        try:
            datetime.fromisoformat(str(meta["snapshot_at"]))
        except ValueError:
            issues.append(f"{day}: meta.snapshot_at 非 ISO8601")
    if meta.get("reconstructed") is not False:
        issues.append(f"{day}: meta.reconstructed 必须为 false")
    if meta.get("data_version") != config.DATA_VERSION:
        issues.append(f"{day}: meta.data_version={meta.get('data_version')} ≠ {config.DATA_VERSION}")
    if meta.get("as_of") != day.isoformat():
        issues.append(f"{day}: meta.as_of={meta.get('as_of')} 与文件名不一致")
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
    return issues
