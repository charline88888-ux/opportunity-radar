"""自动候选商机生成（v0.9.0）：从在线采集 outbox 的 business 级信号直接生成“发现榜”候选卡。

产品原则（冻结）：**验证/实验不是信息获取与上榜的门禁。**
- 候选从 `scanner/outbox/signals-*.json` 的 `tier=business` 信号自动生成，不够时按 relevance 补 `maybe` 高分；
- 无需人工复核、无需商业验证、无需实验盈利即可进入候选榜；
- `verification_status="unverified"` 只是展示标签，**不参与候选收录/排序**；
- 不写 `data/opportunities.json`（精选人工库 80 条保持不变）。

输出：
- `data/candidates.json`（meta + candidates）
- `data/candidate-rankings.json`（day/week/month/year，按 first_seen 归属，排序同 rank 规则）
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # 支持 python scanner/candidates.py
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import common, config, normalize, score  # noqa: E402
else:  # pragma: no cover
    from . import common, config, normalize, score

CANDIDATE_LIMIT = int(getattr(config, "CANDIDATE_LIMIT", 200))
WINDOWS = ("day", "week", "month", "year")
STATUS_AUTO = "auto-discovered"
VERIFICATION_UNVERIFIED = "unverified"
DISCLAIMER = (
    "自动发现的候选线索：由公开信号自动生成，未经人工复核/商业验证/实验盈利，"
    "仅供参考发现商机；verification_status 仅展示，不影响收录与排序。"
)

INDUSTRY_NAMES = {
    "pet": "宠物",
    "silver": "银发",
    "emotional": "情绪",
    "ai": "AI",
    "crossborder": "跨境",
    "content": "内容",
    "education": "教育",
    "local": "本地生活",
    "green": "绿色",
    "compliance": "合规",
    "culture": "文化",
    "gaming": "游戏",
    "fintech": "金融支付",
    "manufacturing": "制造供应链",
}
GAP_NAMES = {
    "language": "语言差",
    "culture": "文化差",
    "time": "时间差",
    "geo": "地理差",
    "knowledge": "知识差",
    "regulation": "监管差",
    "platform": "平台规则差",
    "price": "价格差",
    "channel": "渠道差",
    "demographic": "人口结构差",
    "emotion": "情绪差",
    "infrastructure": "基础设施差",
}
REGION_NAMES = {
    "north-america": "北美",
    "europe": "欧洲",
    "mena": "中东北非",
    "sea": "东南亚",
    "east-asia": "东亚",
    "south-asia": "南亚",
    "latam": "拉美",
    "africa": "非洲",
    "oceania": "大洋洲",
    "cis": "独联体",
    "china": "中国大陆",
}
TARGET_COUNTRIES = {
    "north-america": ["美国", "加拿大"],
    "europe": ["德国", "英国", "法国", "波兰"],
    "mena": ["阿联酋", "沙特", "埃及"],
    "sea": ["印尼", "越南", "泰国", "新加坡"],
    "east-asia": ["日本", "韩国"],
    "south-asia": ["印度", "巴基斯坦"],
    "latam": ["巴西", "墨西哥", "阿根廷"],
    "africa": ["尼日利亚", "肯尼亚", "南非"],
    "oceania": ["澳大利亚", "新西兰"],
    "cis": ["俄罗斯", "哈萨克斯坦"],
    "china": ["中国大陆"],
}
# 行业默认 ROI（人民币，估算区间；标注 estimated=true，非承诺）
ROI_DEFAULTS: dict[str, dict[str, Any]] = {
    "pet": {"capital_min": 30000, "capital_max": 150000, "monthly_revenue_min": 8000, "monthly_revenue_max": 45000, "gross_margin_min": 45, "gross_margin_max": 65, "payback_months": 8, "time_to_revenue_months": 2, "effort": "中"},
    "silver": {"capital_min": 50000, "capital_max": 300000, "monthly_revenue_min": 15000, "monthly_revenue_max": 80000, "gross_margin_min": 35, "gross_margin_max": 55, "payback_months": 12, "time_to_revenue_months": 3, "effort": "中高"},
    "emotional": {"capital_min": 10000, "capital_max": 60000, "monthly_revenue_min": 5000, "monthly_revenue_max": 30000, "gross_margin_min": 55, "gross_margin_max": 75, "payback_months": 5, "time_to_revenue_months": 1, "effort": "低中"},
    "ai": {"capital_min": 20000, "capital_max": 200000, "monthly_revenue_min": 10000, "monthly_revenue_max": 100000, "gross_margin_min": 55, "gross_margin_max": 80, "payback_months": 6, "time_to_revenue_months": 1, "effort": "中"},
    "crossborder": {"capital_min": 50000, "capital_max": 300000, "monthly_revenue_min": 20000, "monthly_revenue_max": 120000, "gross_margin_min": 25, "gross_margin_max": 50, "payback_months": 10, "time_to_revenue_months": 2, "effort": "中高"},
    "content": {"capital_min": 15000, "capital_max": 100000, "monthly_revenue_min": 6000, "monthly_revenue_max": 50000, "gross_margin_min": 50, "gross_margin_max": 75, "payback_months": 6, "time_to_revenue_months": 2, "effort": "中"},
    "education": {"capital_min": 15000, "capital_max": 120000, "monthly_revenue_min": 8000, "monthly_revenue_max": 60000, "gross_margin_min": 45, "gross_margin_max": 70, "payback_months": 7, "time_to_revenue_months": 2, "effort": "中"},
    "local": {"capital_min": 30000, "capital_max": 200000, "monthly_revenue_min": 10000, "monthly_revenue_max": 70000, "gross_margin_min": 30, "gross_margin_max": 55, "payback_months": 9, "time_to_revenue_months": 2, "effort": "中高"},
    "green": {"capital_min": 80000, "capital_max": 500000, "monthly_revenue_min": 20000, "monthly_revenue_max": 150000, "gross_margin_min": 25, "gross_margin_max": 45, "payback_months": 15, "time_to_revenue_months": 4, "effort": "高"},
    "compliance": {"capital_min": 20000, "capital_max": 150000, "monthly_revenue_min": 10000, "monthly_revenue_max": 90000, "gross_margin_min": 50, "gross_margin_max": 75, "payback_months": 6, "time_to_revenue_months": 2, "effort": "中"},
    "culture": {"capital_min": 10000, "capital_max": 80000, "monthly_revenue_min": 5000, "monthly_revenue_max": 40000, "gross_margin_min": 45, "gross_margin_max": 70, "payback_months": 6, "time_to_revenue_months": 1, "effort": "低中"},
    "gaming": {"capital_min": 20000, "capital_max": 150000, "monthly_revenue_min": 8000, "monthly_revenue_max": 70000, "gross_margin_min": 50, "gross_margin_max": 75, "payback_months": 7, "time_to_revenue_months": 2, "effort": "中"},
    "fintech": {"capital_min": 50000, "capital_max": 400000, "monthly_revenue_min": 20000, "monthly_revenue_max": 200000, "gross_margin_min": 40, "gross_margin_max": 70, "payback_months": 12, "time_to_revenue_months": 4, "effort": "高"},
    "manufacturing": {"capital_min": 100000, "capital_max": 800000, "monthly_revenue_min": 30000, "monthly_revenue_max": 300000, "gross_margin_min": 15, "gross_margin_max": 35, "payback_months": 18, "time_to_revenue_months": 5, "effort": "高"},
}
DEFAULT_ROI = ROI_DEFAULTS["crossborder"]

SEVEN_QUESTIONS = [
    ("需求", "谁在什么场景下愿意为什么付费？"),
    ("人群", "最早愿意尝试的 100 个种子用户是谁？"),
    ("竞品", "用户现在用什么替代方案，为什么不满意？"),
    ("差异", "我们的最小差异化是什么（一句话说清）？"),
    ("渠道", "第一个可执行、可量化的获客渠道是什么？"),
    ("成本", "最小验证成本与最大风险分别是什么？"),
    ("验证", "14 天内用什么可观察指标判断值得继续？"),
]
GAP_DRIVERS = {
    "language": "语言本地化",
    "culture": "文化/宗教适配",
    "time": "时间窗口",
    "geo": "地理套利",
    "knowledge": "专业知识翻译",
    "regulation": "合规/监管适配",
    "platform": "平台规则变化",
    "price": "价格/供应链差",
    "channel": "流量/渠道红利",
    "demographic": "人口结构变化",
    "emotion": "情绪/心理需求",
    "infrastructure": "基础设施缺口",
}


def _hash(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def _pick(values: list[str] | None, default: str = "crossborder") -> str:
    if values:
        return values[0]
    return default


def _truncate(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if len(text) <= limit:
        return text
    return text[: max(1, limit - 1)].rstrip() + "…"


def _strip_html(text: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    text = text.replace("\u00a0", " ").replace("\u200b", "")
    return re.sub(r"\s+", " ", text).strip()


def _clean_title(signal: dict[str, Any]) -> str:
    title = _strip_html(str(signal.get("title") or signal.get("quote") or ""))
    # Google News/聚合标题常带 " - 来源" 尾缀；去掉再截断
    title = re.sub(r"\s+[-|–—]\s+[^-|–—]{2,40}$", "", title).strip()
    title = title.strip("“”\"'「」【】[]() ")
    if not title:
        title = _strip_html(str(signal.get("quote") or "")) or "自动发现商机线索"
    return _truncate(title, 28)


def _clean_summary(signal: dict[str, Any], title: str, limit: int = 160) -> str:
    text = _strip_html(str(signal.get("quote") or signal.get("text") or signal.get("title") or ""))
    text = re.sub(r"(阅读全文|Read more|Continue reading|查看原文|点击查看).*$", "", text, flags=re.IGNORECASE).strip()
    if not text:
        text = title
    return _truncate(text, limit)


# v0.9.1：gap 启发式兜底（信号无信息差关键词时，按行业/来源类别/关键词推断）
GAP_FALLBACK_BY_INDUSTRY = {
    "compliance": "regulation", "crossborder": "geo", "fintech": "infrastructure",
    "manufacturing": "price", "local": "channel", "content": "language",
    "education": "knowledge", "culture": "culture", "pet": "demographic",
    "silver": "demographic", "emotional": "emotion", "green": "infrastructure",
    "ai": "knowledge", "gaming": "platform",
}
GAP_FALLBACK_BY_CATEGORY = {
    "policy": "regulation", "marketplace": "price", "capital": "knowledge",
    "trend": "time", "demand": "channel", "supply": "price", "platform": "platform",
    "academic": "knowledge", "culture": "culture", "social": "emotion",
    "talent": "knowledge", "data": "knowledge",
}
GAP_KEYWORD_MAP = {
    "regulation": ["regulation", "compliance", "rule", "act", "policy", "监管", "合规", "法规", "认证"],
    "language": ["translation", "localization", "language", "翻译", "本地化", "语言"],
    "price": ["price", "cost", "cheap", "expensive", "价格", "成本", "便宜"],
    "geo": ["import", "export", "cross-border", "overseas", "跨境", "出海", "进口", "出口"],
    "platform": ["platform", "algorithm", "marketplace", "平台", "算法", "佣金"],
    "time": ["trend", "trending", "early", "趋势", "刚起来"],
    "demographic": ["aging", "senior", "elderly", "pet", "银发", "宠物", "人口", "老龄化"],
    "culture": ["halal", "ramadan", "culture", "宗教", "清真", "文化", "斋月"],
    "channel": ["traffic", "seo", "marketing", "渠道", "流量", "获客"],
    "knowledge": ["research", "patent", "paper", "研究", "专利", "论文"],
    "emotion": ["grief", "lonely", "anxiety", "情绪", "孤独", "焦虑"],
    "infrastructure": ["logistics", "payment", "supply chain", "物流", "支付", "供应链"],
}


def _infer_gaps(signal: dict[str, Any], industries: list[str]) -> tuple[list[str], bool]:
    explicit = [item for item in signal.get("gap_type_ids") or [] if item in GAP_NAMES]
    if explicit:
        return explicit, False
    text = f"{signal.get('title') or ''} {signal.get('quote') or ''}".lower()
    inferred: list[str] = []
    for industry in industries[:2]:
        gap = GAP_FALLBACK_BY_INDUSTRY.get(industry)
        if gap and gap not in inferred:
            inferred.append(gap)
    category = str(signal.get("source_category") or "")
    gap = GAP_FALLBACK_BY_CATEGORY.get(category)
    if gap and gap not in inferred:
        inferred.append(gap)
    for gap_id, keywords in GAP_KEYWORD_MAP.items():
        if gap_id in inferred:
            continue
        if any(keyword in text for keyword in keywords):
            inferred.append(gap_id)
            if len(inferred) >= 2:
                break
    if not inferred:
        inferred = ["knowledge"]
    return inferred[:2], True


def _gap_inference_text(gaps: list[str], inferred: bool) -> str:
    labels = "、".join(GAP_NAMES.get(item, item) for item in gaps) or "未知"
    if inferred:
        return f"信号原文未给出明确信息差，按行业/来源/关键词自动推断为「{labels}」（推断，非原文）"
    return f"来自信号原文的显式信息差：「{labels}」"


def _load_sources() -> dict[str, dict[str, Any]]:
    payload = common.load_json(config.SOURCES_PATH) or {}
    mapping: dict[str, dict[str, Any]] = {}
    for category in payload.get("categories") or []:
        for source in category.get("sources") or []:
            mapping[str(source.get("id"))] = source
    return mapping


def _region_ids(signal: dict[str, Any], source: dict[str, Any] | None) -> tuple[list[str], bool]:
    regions = [item for item in signal.get("region_ids") or [] if item in REGION_NAMES]
    if not regions and source:
        regions = [item for item in source.get("regions") or [] if item in REGION_NAMES]
    if not regions:
        text = f"{signal.get('title') or ''} {signal.get('quote') or ''} {signal.get('source_category') or ''}"
        regions = [item for item in normalize._infer(text, normalize.REGION_KEYWORDS) if item in REGION_NAMES]
    if not regions:
        return ["north-america", "europe"], True
    return regions, False


def _industry_ids(signal: dict[str, Any]) -> list[str]:
    industries = [item for item in signal.get("industry_ids") or [] if item in INDUSTRY_NAMES]
    if not industries:
        industries = [item for item in signal.get("industry_hints") or [] if item in INDUSTRY_NAMES]
    return industries or ["crossborder"]


def _target_countries(regions: list[str]) -> list[str]:
    countries: list[str] = []
    for region in regions:
        for country in TARGET_COUNTRIES.get(region, []):
            if country not in countries:
                countries.append(country)
    return countries[:6]


def _roi(primary_industry: str) -> dict[str, Any]:
    template = ROI_DEFAULTS.get(primary_industry, DEFAULT_ROI)
    roi = {key: value for key, value in template.items()}
    roi["estimated"] = True
    roi["note"] = "行业默认区间估算（自动生成），非承诺；需人工按实际采购/渠道成本重算"
    return roi


def _seven_questions(signal: dict[str, Any], industries: list[str], gaps: list[str]) -> dict[str, dict[str, str]]:
    industry_text = "、".join(INDUSTRY_NAMES.get(item, item) for item in industries[:2]) or "跨境"
    gap_text = "、".join(GAP_NAMES.get(item, item) for item in gaps[:2]) or "信息差"
    title = _clean_title(signal)
    answers = {
        "需求": f"围绕「{title}」：{industry_text}需求正在被公开讨论，可能存在未被满足的具体场景。",
        "人群": "从该信号来源的读者/从业者中找最早 100 个种子用户（如原文评论区、相关社群）。",
        "竞品": "现有替代方案多为通用商品/服务；需人工对比价格、交付与本地化程度。",
        "差异": f"利用{gap_text}做出本地化/更快/更透明的供给（自动草稿，待人工细化）。",
        "渠道": "先用来源媒体/社群做内容验证，再考虑搜索/平台/私域渠道（自动草稿）。",
        "成本": "先按行业默认 ROI 估算最小启动成本；真实成本需人工核价。",
        "验证": "14 天内观察到询价/预约/加购等可量化信号再投入（验证可选，不影响上榜）。",
    }
    return {
        question: {"question": question, "answer": answers[question], "draft": True}
        for question, _hint in SEVEN_QUESTIONS
    }


def _scores(signal: dict[str, Any], industries: list[str], regions: list[str], evidence_count: int, as_of: date) -> dict[str, Any]:
    taxonomy = common.load_json(config.TAXONOMY_PATH) or {}
    weights = score.weights_from_taxonomy(taxonomy)
    relevance = float(signal.get("relevance_score") or 0)
    seed = int(_hash(str(signal.get("candidate_seed") or signal.get("signal_id") or signal.get("title") or ""))[:4], 16) / 65535.0
    published = common.parse_date(signal.get("published_date")) if signal.get("published_date") else None
    fresh_bonus = 1.0 if published and abs((as_of - published).days) <= 7 else 0.0
    gaps = [item for item in signal.get("gap_type_ids") or signal.get("gap_hints") or []]
    dimensions = {
        "signal": round(min(10.0, 4.5 + relevance / 20.0), 1),
        "gap": round(min(10.0, 5.5 + 0.5 * len(gaps)), 1),
        "feasibility": round(6.0 + 2.0 * seed, 1),
        "economics": round(5.5 + 1.5 * seed + (1.0 if industries[0] in {"ai", "compliance", "emotional"} else 0.0), 1),
        "timing": round(min(10.0, 5.5 + fresh_bonus + 1.5 * seed), 1),
        "competition": round(5.0 + 2.0 * seed, 1),
        "risk": round(6.0 + 2.0 * seed, 1),
        "fit": round(5.0 + 2.0 * seed + (0.5 if regions else 0.0), 1),
        "evidence": round(min(10.0, 3.0 + evidence_count), 1),
        "leverage": round(5.0 + 2.0 * seed, 1),
    }
    for key, value in dimensions.items():
        dimensions[key] = round(common.clamp(value, 0.0, 10.0), 1)
    total = score.compute_total(dimensions, weights)
    momentum = 1.0
    rank_score = score.compute_rank_score(total, momentum)
    return {
        "dimensions": dimensions,
        "total": total,
        "rank_score": rank_score,
        "grade": score.grade_for(total, taxonomy),
        "momentum": momentum,
    }


def _candidate_from_signal(signal: dict[str, Any], sources: dict[str, dict[str, Any]], as_of: date) -> dict[str, Any]:
    industries = _industry_ids(signal)
    gaps, gap_inferred = _infer_gaps(signal, industries)
    source_id = str(signal.get("source_id") or "")
    source_meta = sources.get(source_id) or {}
    regions, region_inferred = _region_ids(signal, source_meta)
    countries = _target_countries(regions)
    if not countries:
        countries = ["美国", "德国"]
    source_name = str(source_meta.get("name") or source_id or "公开来源")
    published = str(signal.get("published_date") or as_of.isoformat())
    try:
        first_seen = min(common.parse_date(published), as_of).isoformat()
    except (TypeError, ValueError):
        first_seen = as_of.isoformat()
    last_seen = first_seen
    url = str(signal.get("url") or "")
    title = _clean_title(signal)
    summary = _clean_summary(signal, title)
    evidence = [
        {
            "title": title,
            "url": url,
            "source_id": source_id,
            "publisher": source_name,
            "date": published,
            "tier": "public-signal",
            "verified_by_human": False,
        }
    ]
    candidate_id = "cand-" + _hash(url or title, str(signal.get("title_norm") or title))[:12]
    relevance = float(signal.get("relevance_score") or 0)
    sectors = "、".join(INDUSTRY_NAMES.get(item, item) for item in industries[:2])
    one_liner = _truncate(
        f"{sectors}｜{summary}（自动发现线索，未人工复核）",
        120,
    )
    confidence = int(round(common.clamp(30 + relevance * 0.5 + (10 if signal.get("tier") == "business" else 0) + 5 + 5, 0, 95)))
    return {
        "candidate_id": candidate_id,
        "title": title,
        "one_liner": one_liner,
        "industry_ids": industries,
        "gap_type_ids": gaps,
        "gap_inferred": gap_inferred,
        "gap_inference": _gap_inference_text(gaps, gap_inferred),
        "region_ids": regions,
        "region_inferred": region_inferred,
        "target_countries": countries,
        "source": {
            "id": source_id,
            "name": source_name,
            "url": url,
            "cleaned": title,
            "raw_title": _strip_html(str(signal.get("title") or "")),
            "published_at": published,
            "summary": summary,
        },
        "evidence": evidence,
        "seven_questions": _seven_questions(signal, industries, gaps),
        "roi": _roi(industries[0]),
        "scores": _scores(signal, industries, regions, len(evidence), as_of),
        "confidence": confidence,
        "status": STATUS_AUTO,
        "verification_status": VERIFICATION_UNVERIFIED,
        "first_seen": first_seen,
        "last_seen": last_seen,
        "relevance_score": relevance,
        "source_tier": signal.get("tier"),
        "signal_id": signal.get("signal_id"),
        "outbox_file": str(signal.get("outbox_file") or ""),
        "disclaimer": DISCLAIMER,
    }


def load_outbox(path: Path | None = None) -> tuple[Path | None, dict[str, Any]]:
    """读取最新/指定 outbox signals-*.json；返回 (路径, payload)。"""
    if path is not None:
        payload = common.load_json(path) or {}
        return path, payload
    directory = config.OUTBOX_DIR
    if not directory.is_dir():
        return None, {}
    files = [item for item in directory.glob("signals-*.json") if item.is_file()]
    if not files:
        return None, {}
    latest = max(files, key=lambda item: (item.stat().st_mtime, item.name))
    payload = common.load_json(latest) or {}
    return latest, payload


def build_candidates(
    as_of: date | None = None,
    outbox_path: Path | None = None,
    limit: int | None = None,
) -> tuple[dict[str, Any], Path | None]:
    """从 outbox 生成 candidates payload（不写文件）。返回 (payload, outbox 路径)。"""
    as_of = as_of or common.parse_as_of(common.load_json(config.TAXONOMY_PATH) or {})
    limit = max(1, int(limit if limit is not None else CANDIDATE_LIMIT))
    outbox_file, outbox = load_outbox(outbox_path)
    signals = [signal for signal in (outbox.get("signals") or []) if isinstance(signal, dict)]
    sources = _load_sources()
    business = sorted(
        [signal for signal in signals if signal.get("tier") == "business"],
        key=lambda signal: (
            str(signal.get("published_date") or ""),
            float(signal.get("relevance_score") or 0),
            str(signal.get("signal_id") or ""),
        ),
        reverse=True,
    )
    maybe = sorted(
        [signal for signal in signals if signal.get("tier") == "maybe"],
        key=lambda signal: (
            str(signal.get("published_date") or ""),
            float(signal.get("relevance_score") or 0),
            str(signal.get("signal_id") or ""),
        ),
        reverse=True,
    )
    ordered = business + maybe
    candidates: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    dropped_duplicates = 0
    for signal in ordered:
        candidate = _candidate_from_signal(signal, sources, as_of)
        dedupe_key_url = str(signal.get("canonical_url") or signal.get("url") or "")
        dedupe_key_title = str(signal.get("title_norm") or candidate["candidate_id"])
        if dedupe_key_url and dedupe_key_url in seen_urls:
            dropped_duplicates += 1
            continue
        if dedupe_key_title in seen_titles:
            dropped_duplicates += 1
            continue
        if dedupe_key_url:
            seen_urls.add(dedupe_key_url)
        seen_titles.add(dedupe_key_title)
        candidates.append(candidate)
        if len(candidates) >= limit:
            break
    source_meta = (outbox.get("meta") or {}) if isinstance(outbox.get("meta"), dict) else {}
    gap_missing = sum(1 for candidate in candidates if not candidate.get("gap_type_ids"))
    gap_inferred_count = sum(1 for candidate in candidates if candidate.get("gap_inferred"))
    covered_regions = sorted({region for candidate in candidates for region in candidate.get("region_ids") or []})
    covered_countries = sorted({country for candidate in candidates for country in candidate.get("target_countries") or []})
    payload = {
        "meta": {
            "data_version": config.DATA_VERSION,
            "as_of": as_of.isoformat(),
            "generated_at": f"{as_of.isoformat()}T00:00:00+08:00",
            "generator": "scanner/candidates.py",
            "status": "auto-discovered",
            "verification_status": VERIFICATION_UNVERIFIED,
            "limit": limit,
            "total": len(candidates),
            "business_signals": len(business),
            "maybe_signals": len(maybe),
            "dropped_duplicates": dropped_duplicates,
            "gap_inference_coverage": {
                "inferred": len(candidates) - gap_missing,
                "missing": gap_missing,
                "ratio": round((len(candidates) - gap_missing) / len(candidates), 3) if candidates else 0.0,
                "fallback_used": gap_inferred_count,
                "target_max_missing_ratio": 0.15,
            },
            "region_coverage": {
                "covered": len(covered_regions),
                "total": len(REGION_NAMES),
                "missing": sorted(set(REGION_NAMES) - set(covered_regions)),
                "ratio": round(len(covered_regions) / len(REGION_NAMES), 3),
                "inferred": sum(1 for candidate in candidates if candidate.get("region_inferred")),
            },
            "country_coverage": {"countries": len(covered_countries), "sample": covered_countries[:12]},
            "source_outbox": {
                "file": outbox_file.name if outbox_file is not None else None,
                "as_of": source_meta.get("as_of"),
                "raw_count": source_meta.get("raw_count"),
                "signal_count": source_meta.get("signal_count"),
                "new_count": source_meta.get("new_count"),
                "seen_count": source_meta.get("seen_count"),
                "tiers": source_meta.get("tiers"),
            },
            "note": (
                "自动发现候选（discovery layer）：无需人工复核/商业验证/实验盈利即可上榜；"
                "verification_status 仅展示，不参与收录/排序；不写入 opportunities.json。"
            ),
            "disclaimer": DISCLAIMER,
        },
        "candidates": candidates,
    }
    return payload, outbox_file


def _window_member(window: str, first_seen: str, as_of: date) -> bool:
    try:
        day = common.parse_date(first_seen)
    except (TypeError, ValueError):
        return False
    return common.window_key(window, day) == common.window_key(window, as_of)


def build_candidate_rankings(candidates_payload: dict[str, Any], as_of: date) -> dict[str, Any]:
    """四窗口发现榜：按 first_seen 归窗，排序同 rank 规则（rank_score/momentum/evidence/last_activity/id）。"""
    candidates = candidates_payload.get("candidates") or []
    windows: dict[str, Any] = {}
    for window in WINDOWS:
        items = [
            candidate
            for candidate in candidates
            if _window_member(window, str(candidate.get("first_seen") or ""), as_of)
        ]
        items.sort(
            key=lambda candidate: (
                -float(candidate.get("scores", {}).get("rank_score") or 0),
                -float(candidate.get("scores", {}).get("momentum") or 0),
                -len(candidate.get("evidence") or []),
                str(candidate.get("last_seen") or ""),
                str(candidate.get("candidate_id") or ""),
            )
        )
        windows[window] = {
            "window": window,
            "key": common.window_key(window, as_of),
            "label": common.window_label(window, as_of),
            "count": len(items),
            "items": [
                {
                    "candidate_id": candidate.get("candidate_id"),
                    "rank": index,
                    "total": candidate.get("scores", {}).get("total"),
                    "rank_score": candidate.get("scores", {}).get("rank_score"),
                    "grade": candidate.get("scores", {}).get("grade"),
                    "confidence": candidate.get("confidence"),
                    "title": candidate.get("title"),
                    "industry_ids": candidate.get("industry_ids"),
                    "region_ids": candidate.get("region_ids"),
                    "first_seen": candidate.get("first_seen"),
                    "verification_status": candidate.get("verification_status"),
                }
                for index, candidate in enumerate(items, start=1)
            ],
        }
    counts = {window: windows[window]["count"] for window in WINDOWS}
    return {
        "meta": {
            "data_version": config.DATA_VERSION,
            "as_of": as_of.isoformat(),
            "generated_at": f"{as_of.isoformat()}T00:00:00+08:00",
            "generator": "scanner/candidates.py",
            "method": "按 first_seen 归属窗口；排序同 rank 规则（rank_score/momentum/evidence/last_activity/id）",
            "total": len(candidates),
            "counts": counts,
            "verification_affects_ranking": False,
            "note": "候选发现榜与精选人工榜（rankings.json，80 条）并行；verification_status 不参与收录/排序。",
        },
        "windows": windows,
    }


def generate(as_of: date | None = None, outbox_path: Path | None = None, limit: int | None = None) -> dict[str, Any]:
    """生成并写出 data/candidates.json + data/candidate-rankings.json；返回摘要。"""
    payload, outbox_file = build_candidates(as_of=as_of, outbox_path=outbox_path, limit=limit)
    as_of_date = date.fromisoformat(payload["meta"]["as_of"])
    rankings = build_candidate_rankings(payload, as_of_date)
    common.dump_json(config.CANDIDATES_PATH, payload)
    common.dump_json(config.CANDIDATE_RANKINGS_PATH, rankings)
    return {
        "total": payload["meta"]["total"],
        "business_signals": payload["meta"]["business_signals"],
        "maybe_signals": payload["meta"]["maybe_signals"],
        "dropped_duplicates": payload["meta"]["dropped_duplicates"],
        "gap_inference_coverage": payload["meta"].get("gap_inference_coverage"),
        "region_coverage": payload["meta"].get("region_coverage"),
        "counts": rankings["meta"]["counts"],
        "paths": [str(config.CANDIDATES_PATH), str(config.CANDIDATE_RANKINGS_PATH)],
        "outbox_file": outbox_file,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="从 outbox 自动生成候选商机与发现榜（v0.9.0）")
    parser.add_argument("--outbox", type=str, default=None, help="指定 signals-*.json（默认最新）")
    parser.add_argument("--as-of", type=str, default=None, help="基准日 YYYY-MM-DD（默认 taxonomy as_of）")
    parser.add_argument("--limit", type=int, default=CANDIDATE_LIMIT, help=f"候选上限（默认 {CANDIDATE_LIMIT}，可配置）")
    args = parser.parse_args(argv)
    try:
        as_of = date.fromisoformat(args.as_of) if args.as_of else None
    except ValueError:
        print(f"--as-of 非法日期：{args.as_of}")
        return 2
    outbox_path = Path(args.outbox) if args.outbox else None
    result = generate(as_of=as_of, outbox_path=outbox_path, limit=args.limit)
    print(
        f"候选已生成：{result['total']} 条（business {result['business_signals']} / maybe {result['maybe_signals']}，"
        f"去重 {result['dropped_duplicates']}）→ " + " / ".join(Path(path).name for path in result["paths"])
    )
    print("四窗口：" + " / ".join(f"{window}={count}" for window, count in result["counts"].items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
