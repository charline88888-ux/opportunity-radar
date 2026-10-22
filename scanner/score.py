"""评分模块：总分、等级、rank_score（契约 4.5 公式，锁定）。

total       = round( Σ(dimension_i × weight_i) × 10 , 1 )
rank_score  = round( min(100, total × (1 + 0.12 × (momentum − 1))) , 1 )
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from . import config
from .common import clamp, round1


def weights_from_taxonomy(taxonomy: dict) -> dict[str, float]:
    weights: dict[str, float] = {}
    for dim in taxonomy.get("score_dimensions", []):
        weights[dim["id"]] = float(dim["weight"])
    missing = [d for d in config.DIMENSION_ORDER if d not in weights]
    if missing:
        raise ValueError(f"taxonomy 缺少评分维度: {missing}")
    return weights


def grade_thresholds(taxonomy: dict) -> list[tuple[str, float]]:
    grades = [(g["id"], float(g["min"])) for g in taxonomy.get("grades", [])]
    return sorted(grades, key=lambda item: item[1], reverse=True)


def compute_total(dimensions: dict[str, float], weights: dict[str, float]) -> float:
    """total = round_half_up( Σ(dim_i × weight_i) × 10 , 1 )，用 Decimal 精确求和避免浮点误差。"""
    missing = [d for d in config.DIMENSION_ORDER if d not in dimensions]
    if missing:
        raise ValueError(f"scores.dimensions 缺少维度: {missing}")
    weights_sum = sum(weights[d] for d in config.DIMENSION_ORDER)
    if abs(weights_sum - 1.0) > 1e-6:
        raise ValueError(f"评分权重合计应为 1.00，当前 {weights_sum}")
    raw = Decimal(0)
    for dim_id in config.DIMENSION_ORDER:
        raw += Decimal(str(dimensions[dim_id])) * Decimal(str(weights[dim_id]))
    return float((raw * Decimal("10")).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def grade_for(total: float, taxonomy: dict) -> str:
    for grade_id, minimum in grade_thresholds(taxonomy):
        if total >= minimum:
            return grade_id
    return "D"


def compute_rank_score(total: float, momentum: float) -> float:
    """rank_score = round_half_up( min(100, total × (1 + 0.12 × (momentum − 1))), 1 )。"""
    momentum = round1(clamp(float(momentum), 0.5, 2.5))
    total_d = Decimal(str(total))
    momentum_d = Decimal(str(momentum))
    score = total_d * (Decimal(1) + Decimal("0.12") * (momentum_d - Decimal(1)))
    score = min(Decimal(100), score)
    return float(score.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def recompute(opportunity: dict, taxonomy: dict) -> dict[str, Any]:
    """返回由评分维度推导出的 {total, grade, rank_score, momentum} 期望值。"""
    weights = weights_from_taxonomy(taxonomy)
    dims = opportunity.get("scores", {}).get("dimensions", {})
    total = compute_total(dims, weights)
    momentum = round1(clamp(float(opportunity.get("momentum", 1.0)), 0.5, 2.5))
    return {
        "total": total,
        "grade": grade_for(total, taxonomy),
        "rank_score": compute_rank_score(total, momentum),
        "momentum": momentum,
    }


def score_diff(opportunity: dict, taxonomy: dict, tolerance: float = 0.05) -> list[str]:
    """比对文件内数值与公式值，返回差异描述列表（空列表 = 一致）。"""
    expected = recompute(opportunity, taxonomy)
    actual = opportunity.get("scores", {})
    issues: list[str] = []
    if abs(float(actual.get("total", -1)) - expected["total"]) > tolerance:
        issues.append(f"total 文件 {actual.get('total')} ≠ 公式 {expected['total']}")
    if actual.get("grade") != expected["grade"]:
        issues.append(f"grade 文件 {actual.get('grade')} ≠ 公式 {expected['grade']}")
    if abs(float(opportunity.get("rank_score", -1)) - expected["rank_score"]) > tolerance:
        issues.append(f"rank_score 文件 {opportunity.get('rank_score')} ≠ 公式 {expected['rank_score']}")
    if abs(float(opportunity.get("momentum", -1)) - expected["momentum"]) > tolerance:
        issues.append(f"momentum 文件 {opportunity.get('momentum')} ≠ 规约值 {expected['momentum']}")
    return issues
