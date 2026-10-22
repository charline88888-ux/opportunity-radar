"""机会对象物化：把作者撰写的字段补全为契约要求的完整对象。

由扫描器统一计算/校验的派生字段：
- evidence_count = len(signal.evidence)
- activity_dates 升序去重
- last_activity = max(activity_dates)，first_seen 缺省 = min(activity_dates)
- momentum clip 到 [0.5, 2.5] 并保留 1 位小数
- scores.dimensions 各维保留 1 位小数；total/grade/rank_score 由公式重算
用于 `python scanner/pipeline.py --fix`（数据工程师撰写机会后一次性物化）。
"""
from __future__ import annotations

from copy import deepcopy
from datetime import date
from typing import Any

from . import config
from .common import clamp, parse_date, round1
from .score import compute_rank_score, compute_total, grade_for, weights_from_taxonomy

FIELD_ORDER = [
    "id",
    "slug",
    "title",
    "one_liner",
    "industry_id",
    "gap_type_ids",
    "region_ids",
    "origin_country",
    "target_countries",
    "human_need_ids",
    "neuro_drivers",
    "emotion_tags",
    "source_langs",
    "signal",
    "seven_questions",
    "roi",
    "scores",
    "window",
    "risks",
    "first_steps_7d",
    "kill_criteria",
    "compliance_notes",
    "evidence_count",
    "activity_dates",
    "first_seen",
    "last_activity",
    "momentum",
    "rank_score",
    "tags",
    "verified",
    "disclaimer",
]


def materialize_opportunity(opportunity: dict, taxonomy: dict, as_of: date) -> dict[str, Any]:
    weights = weights_from_taxonomy(taxonomy)
    source = deepcopy(opportunity)
    out: dict[str, Any] = {field: source.get(field) for field in FIELD_ORDER}
    for key, value in source.items():
        if key not in out:
            out[key] = value

    evidence = (out.get("signal") or {}).get("evidence") or []
    out["evidence_count"] = len(evidence)

    dates = sorted({str(item) for item in (out.get("activity_dates") or [])})
    for item in dates:
        parse_date(item)  # 非法日期直接抛错，避免脏数据进入榜单
    out["activity_dates"] = dates
    as_of_iso = as_of.isoformat()
    if dates:
        out["first_seen"] = out.get("first_seen") or dates[0]
        out["last_activity"] = dates[-1]
    else:
        out["first_seen"] = out.get("first_seen") or as_of_iso
        out["last_activity"] = out.get("last_activity") or out["first_seen"]

    out["momentum"] = round1(clamp(float(out.get("momentum") or 1.0), 0.5, 2.5))

    raw_dims = (out.get("scores") or {}).get("dimensions") or {}
    dimensions: dict[str, float] = {}
    missing_dims = [dim for dim in config.DIMENSION_ORDER if dim not in raw_dims]
    extra_dims = [dim for dim in raw_dims if dim not in config.DIMENSION_ORDER]
    if missing_dims or extra_dims:
        raise ValueError(f"scores.dimensions 必须恰含 10 维，缺失 {missing_dims}，多余 {extra_dims}")
    for dim_id in config.DIMENSION_ORDER:
        dimensions[dim_id] = round1(clamp(float(raw_dims[dim_id]), 0.0, 10.0))
    total = compute_total(dimensions, weights)
    out["scores"] = {
        "dimensions": dimensions,
        "total": total,
        "grade": grade_for(total, taxonomy),
    }
    out["rank_score"] = compute_rank_score(total, out["momentum"])
    out["tags"] = list(dict.fromkeys(out.get("tags") or []))
    out["disclaimer"] = out.get("disclaimer") or config.DISCLAIMER
    return out


def materialize_all(
    opportunities: list[dict], taxonomy: dict, as_of: date
) -> tuple[list[dict], list[str]]:
    result = []
    issues: list[str] = []
    for opportunity in opportunities:
        try:
            result.append(materialize_opportunity(opportunity, taxonomy, as_of))
        except Exception as exc:  # noqa: BLE001 - 聚合所有问题后一次报错
            issues.append(f"{opportunity.get('id', '<no-id>')}: {type(exc).__name__}: {exc}")
    return result, issues
