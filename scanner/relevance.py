"""信号相关性初筛（v0.8.0）：离线规则给采集信号打分/分类，帮助从 200+ 条里挑出“像商机”的线索。

只做线索排序，**不自动写入机会库**；字段：
- `relevance_score` 0–100
- `industry_ids` / `gap_type_ids` / `region_ids`（来自 normalize 的 hints，再按规则补充）
- `tier ∈ business / maybe / off-topic`
- `reasons`（可解释原因，含命中关键词/排除词）

规则（纯离线、无网络/无模型）：
1. 基础分 25；行业/信息差/地区 hint 命中分别加分；
2. 来源类别加权（政策/资本/市场/需求 > 学术/泛新闻）；
3. 商业词（funding/regulation/launch/complaint/ecommerce…）加分；
4. 强排除词（招聘/广告/call for papers/纯论文）大幅减分；
5. clamp 到 0–100，按阈值分 tier。
"""
from __future__ import annotations

from typing import Any

if __package__ in (None, ""):  # pragma: no cover
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scanner import config  # noqa: E402

CATEGORY_BONUS = {
    "demand": 12,
    "capital": 12,
    "policy": 12,
    "marketplace": 10,
    "trend": 8,
    "supply": 8,
    "platform": 8,
    "culture": 6,
    "talent": 4,
    "social": 4,
    "data": 4,
    "academic": -8,
}

BUSINESS_KEYWORDS = [
    "startup", "funding", "raised", "acquisition", "ecommerce", "retail", "marketplace",
    "subscription", "revenue", "pricing", "customer", "launch", "regulation", "compliance",
    "tariff", "logistics", "payment", "smb", "small business", "consumer", "demand",
    "import", "export", "supply chain", "pet", "senior", "aging", "halal", "cross-border",
    "创业", "融资", "电商", "合规", "监管", "出海", "跨境", "宠物", "银发", "供应链",
]

EXCLUDE_KEYWORDS = [
    "hiring", "we are hiring", "job posting", "job alert", "recruiting", "招聘", "急招",
    "advertisement", "sponsored", "newsletter", "subscribe", "call for papers",
    "arxiv preprint", "preprint", "citation", "doi:", "university researchers",
    "大奖赛", "抽奖",
]

ACADEMIC_HINTS = ["arxiv", "preprint", "paper", "doi:", "journal", "study", "research paper", "论文", "预印本"]


def assess(signal: dict[str, Any]) -> dict[str, Any]:
    """给单条归一信号计算相关性字段（原地返回新 dict，不修改输入）。"""
    title = str(signal.get("title") or "")
    text = f"{title} {signal.get('quote') or ''}".lower()
    industries = [item for item in signal.get("industry_hints") or [] if isinstance(item, str)]
    gaps = [item for item in signal.get("gap_hints") or [] if isinstance(item, str)]
    regions = [item for item in signal.get("region_hints") or [] if isinstance(item, str)]
    category = str(signal.get("source_category") or "")
    reasons: list[str] = []
    score = 25

    category_score = CATEGORY_BONUS.get(category, 0)
    if category_score:
        score += category_score
        reasons.append(f"category:{category}")
    score += min(24, 12 * len(industries))
    for industry in industries[:2]:
        reasons.append(f"industry:{industry}")
    score += min(20, 10 * len(gaps))
    for gap in gaps[:2]:
        reasons.append(f"gap:{gap}")
    score += min(8, 4 * len(regions))
    if regions:
        reasons.append("region:" + ",".join(regions[:2]))

    keyword_hits = [keyword for keyword in BUSINESS_KEYWORDS if keyword in text]
    if keyword_hits:
        score += min(18, 6 * len(keyword_hits))
        reasons.append("keyword:" + ",".join(keyword_hits[:3]))

    excluded = [keyword for keyword in EXCLUDE_KEYWORDS if keyword in text]
    if excluded:
        score -= 45
        reasons.append("excluded:" + ",".join(excluded[:2]))

    academic_hits = [keyword for keyword in ACADEMIC_HINTS if keyword in text]
    if academic_hits:
        penalty = 20 if (not industries and not gaps) else 10
        score -= penalty
        reasons.append("academic:" + ",".join(academic_hits[:2]))

    score = max(0, min(100, int(round(score))))
    if score >= config.RELEVANCE_BUSINESS_MIN:
        tier = "business"
    elif score >= config.RELEVANCE_MAYBE_MIN:
        tier = "maybe"
    else:
        tier = "off-topic"
    if not reasons:
        reasons.append("no_signal")
    return {
        "relevance_score": score,
        "industry_ids": industries,
        "gap_type_ids": gaps,
        "region_ids": regions,
        "tier": tier,
        "reasons": reasons,
    }


def analyze(signals: list[dict[str, Any]]) -> dict[str, Any]:
    """批量标注相关性并返回 meta 摘要（relevant_count / tiers / top_relevant）。"""
    annotated: list[dict[str, Any]] = []
    tiers = {"business": 0, "maybe": 0, "off-topic": 0}
    for signal in signals:
        result = assess(signal)
        signal.update(result)
        tiers[result["tier"]] = tiers.get(result["tier"], 0) + 1
        annotated.append(signal)
    top = sorted(annotated, key=lambda item: (-int(item["relevance_score"]), str(item.get("signal_id"))))[:8]
    return {
        "relevant_count": tiers.get("business", 0),
        "tiers": tiers,
        "top_relevant": [
            {
                "signal_id": item.get("signal_id"),
                "title": str(item.get("title") or "")[:120],
                "relevance_score": item["relevance_score"],
                "tier": item["tier"],
                "source_id": item.get("source_id"),
                "url": str(item.get("url") or "")[:300],
            }
            for item in top
        ],
    }
