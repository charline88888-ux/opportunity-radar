"""自动候选商机生成（v0.9.2）：从在线采集 outbox 的 business 级信号直接生成“发现榜”候选卡。

边界原则（冻结）：
- **“这是不是一个商机”由系统评估**（需求/信息差/证据/时效/可执行性），自动计算、无需人工/实验；
- **“我能不能靠它赚钱”是个人线下实体验证**（verification_status: not_started|observing|tested），
  系统不验证、不承诺、也不作为收录/排序门禁；
- 候选直接进入发现榜，无需人工复核；不写 `data/opportunities.json`（精选人工库 80 条保持不变）。
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
    from scanner import business as business_mod, common, config, normalize, score, translate as translate_mod  # noqa: E402
else:  # pragma: no cover
    from . import business as business_mod, common, config, normalize, score, translate as translate_mod

CANDIDATE_LIMIT = int(getattr(config, "CANDIDATE_LIMIT", 200))
WINDOWS = ("day", "week", "month", "year")
STATUS_AUTO = "auto-discovered"
VERIFICATION_NOT_STARTED = "not_started"
SYSTEM_BOUNDARY = "系统自动评估商机信号（需求/信息差/证据/时效/可执行性）；仅代表发现与评估，不代表收入承诺。"
DISCLAIMER = "自动发现的候选线索：由公开信号自动生成，系统已做商机初筛评估（system_validation）；不代表收入承诺。"

ZH_GLOSSARY = {
    "startup": "创业公司", "startups": "创业公司", "funding": "融资", "raised": "融资",
    "acquisition": "收购", "acquires": "收购", "retail": "零售", "retailer": "零售商",
    "ecommerce": "电商", "e-commerce": "电商", "marketplace": "平台", "pet": "宠物",
    "pets": "宠物", "senior": "银发", "aging": "老龄化", "elderly": "老年人",
    "compliance": "合规", "regulation": "监管", "regulatory": "监管", "policy": "政策",
    "ai": "AI", "app": "应用", "apps": "应用", "market": "市场", "growth": "增长",
    "launch": "上线", "launches": "上线", "expansion": "扩张", "payment": "支付",
    "payments": "支付", "supply": "供应", "chain": "链", "logistics": "物流",
    "brand": "品牌", "consumer": "消费者", "consumers": "消费者", "halal": "清真",
    "energy": "能源", "solar": "太阳能", "health": "健康", "beauty": "美妆",
    "travel": "旅行", "platform": "平台", "tariff": "关税", "export": "出口",
    "import": "进口", "cross-border": "跨境", "smb": "中小企业", "sme": "中小企业",
    "pricing": "定价", "revenue": "收入", "customers": "客户", "demand": "需求",
    "small business": "中小企业", "venture": "风投", "seed": "种子轮", "series": "轮融资",
    "crypto": "加密货币", "fintech": "金融科技", "bank": "银行", "banks": "银行",
    "healthcare": "医疗", "education": "教育", "food": "食品", "delivery": "配送",
    "store": "门店", "stores": "门店", "sustainability": "可持续", "recycling": "回收",
    "plastic": "塑料", "packaging": "包装", "the": "", "and": "与", "of": "的",
}

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
    ("成本", "最小启动成本与最大风险分别是什么？"),
    ("跟踪", "14 天内用什么可观察指标判断值得继续？"),
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


TITLE_BANNED = "…系统翻译暂缺待补"


TITLE_BRANDS = {"MAS", "PayPal", "Lianlian", "LianLian", "EPR", "AI", "TikTok", "Amazon", "ByteDance", "PineDrama", "Grab", "Swiggy", "SEBI"}
TITLE_EVENT_SHORT = {
    "政策/监管窗口": "监管动向",
    "融资": "融资动向",
    "新品/上线": "新品上线",
    "合作": "合作",
    "需求变化": "需求变化",
    "成本变化": "成本变化",
    "市场变化": "市场变化",
}


def _is_clean_title(text: str) -> bool:
    if not text or len(text) < 8 or len(text) > 32:
        return False
    if "…" in text or "系统翻译" in text or "暂缺" in text or "商机线索" in text or "基础设施差" in text or "机会" in text:
        return False
    chinese = len(re.findall(r"[\u4e00-\u9fff]", text))
    if chinese < 4:
        return False
    latin_tokens = re.findall(r"[A-Za-z][A-Za-z0-9&.\-]*", text)
    allowed = {"MAS", "PayPal", "Lianlian", "LianLian", "EPR", "AI", "TikTok", "Amazon", "ByteDance", "PineDrama", "Grab", "Swiggy", "SEBI", "Z"}
    if any(token not in allowed for token in latin_tokens):
        return False
    return True


def _title_topic(title: str) -> str:
    text = title.lower()
    mapping = [
        (("cross-border payment", "payment", "payout", "remittance", "clearing", "支付", "清算"), "跨境支付"),
        (("epr", "packaging", "packaging waste", "包装"), "包装法规"),
        (("stablecoin", "stablecoins", "稳定币"), "稳定币"),
        (("ipo", "listing", "上市", "debut"), "上市融资"),
        (("funding", "raises", "raised", "融资", "seed", "series"), "融资"),
        (("cyber", "网络安全"), "网络安全"),
        (("airspace", "航空"), "航空监管"),
        (("pet", "pet ", "宠物"), "宠物消费"),
        (("silver", "aging", "elderly", "养老", "银发"), "适老服务"),
        (("short drama", "drama", "webtoon", "短剧", "网文"), "内容出海"),
        (("ai", "artificial intelligence", "人工智能", "模型", "agent"), "人工智能"),
        (("ecommerce", "e-commerce", "marketplace", "电商", "零售"), "电商零售"),
        (("energy", "solar", "battery", "光伏", "电池", "能源"), "新能源"),
        (("compliance", "regulation", "epr", "合规", "监管"), "合规监管"),
        (("education", "edtech", "教育", "培训"), "教育培训"),
        (("game", "游戏", "电竞"), "游戏"),
    ]
    for keywords, label in mapping:
        if any(keyword in text for keyword in keywords):
            return label
    return ""


def _special_title(title_original: str) -> str:
    text = (title_original or "").lower()
    if "gen z" in text and ("africa" in text or "african" in text):
        return "非洲Z世代消费者如何改变商业"
    if "pinedrama" in text:
        return "字节跳动PineDrama短剧出海"
    if "lianlian" in text and "paypal" in text:
        return "Lianlian与PayPal跨境支付合作"
    if "tenstorrent" in text:
        return "Tenstorrent AI芯片估值翻倍"
    if re.search(r"\bepr\b", text) and ("packaging" in text or "council" in text):
        return "欧盟理事会包装法规立场"
    return ""


TITLE_COMMON = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "from", "as", "at", "by",
    "is", "are", "was", "were", "be", "been", "this", "that", "these", "those", "its", "it", "their",
    "new", "how", "why", "what", "when", "where", "who", "will", "can", "may", "has", "have", "had",
    "says", "said", "report", "news", "update", "today", "week", "year", "global", "world",
}


def _title_subject(title_original: str) -> str:
    entities = business_mod.display_entities(title_original)
    for entity in entities:
        cleaned = re.sub(r"（[^）]*）", "", entity).strip(" -–—,:：")
        if not cleaned or re.search(r"^[0-9]", cleaned):
            continue
        if re.search(r"[\u4e00-\u9fff]", cleaned) and 2 <= len(cleaned) <= 12:
            return cleaned
        if re.search(r"^[A-Z][A-Za-z0-9&.\-]{2,}$", cleaned) and cleaned.lower() not in TITLE_COMMON:
            return cleaned
    for token in re.findall(r"[A-Z][A-Za-z0-9&.\-]{2,}", title_original or ""):
        if token.lower() not in TITLE_COMMON:
            return token
    run = re.findall(r"[\u4e00-\u9fff]{2,8}", title_original or "")
    return run[0] if run else ""


def _title_action(title_original: str) -> str:
    text = (title_original or "").lower()
    rules = [
        (("valuation", "valuation doubles", "doubles its valuation", "估值"), "估值翻倍"),
        (("raises", "raised", "funding", "seed", "series", "融资", "轮融资"), "完成融资"),
        (("ipo", "listing", "debut", "上市"), "推进上市"),
        (("partners", "partnership", "teams up", "team up", "joins", "collaboration", "合作"), "达成合作"),
        (("launches", "launched", "launch", "unveils", "releases", "rollout", "上线", "发布"), "发布新品"),
        (("regulation", "regulations", "rules", "act", "council", "epr", "compliance", "policy", "监管", "新规", "合规"), "监管新规"),
        (("acquires", "acquisition", "merger", "并购"), "完成并购"),
        (("demand", "growth", "surge", "spending", "需求", "增长"), "需求增长"),
        (("cost", "price", "tariff", "inflation", "成本", "价格", "关税"), "成本变化"),
        (("short drama", "drama", "webtoon", "短剧", "网文"), "短剧出海"),
        (("pet food", "pet", "宠物"), "宠物消费"),
        (("ai", "artificial intelligence", "人工智能", "模型"), "AI应用"),
    ]
    for keywords, label in rules:
        if any(keyword in text for keyword in keywords):
            return label
    return ""


def _synth_title(business_eval: dict[str, Any], signal: dict[str, Any], countries: list[str]) -> str:
    primary = str(business_eval.get("primary_industry") or "crossborder")
    region = str(business_eval.get("primary_region") or "north-america")
    industry_zh = "人工智能" if primary == "ai" else business_mod.INDUSTRY_ZH.get(primary, "跨境")
    event_zh = business_mod.EVENT_ZH.get(str((business_eval.get("judgment") or {}).get("event_type") or ""), "市场变化")
    event_short = TITLE_EVENT_SHORT.get(event_zh, "动向")
    region_rule = business_mod.REGION_RULES.get(region) or {}
    market = (region_rule.get("markets") or ["全球"])[0]
    country = countries[0] if countries else market
    title_original = str(signal.get("title") or signal.get("title_norm") or "")
    numbers = re.findall(r"[0-9]+(?:\.[0-9]+)?%?", title_original)
    num = numbers[0] if numbers else ""
    topic = _title_topic(title_original)
    subject = _title_subject(title_original)
    action = _title_action(title_original)
    if topic == "人工智能":
        topic = "AI"
    variants = [
        f"{subject}{topic}初创{action}" if subject and topic and action else "",
        f"{subject}{topic}企业{action}" if subject and topic and action else "",
        f"{country}{topic}初创{action}" if topic and action else "",
        f"{subject}{topic}{action}" if subject and action else "",
        f"{subject}{topic}新动向" if subject and topic else "",
        f"{country}{topic}{action}" if topic and action else "",
        f"{country}{industry_zh}{action}" if action else "",
        f"{subject}{action}" if subject and action else "",
        f"{country}{topic}变化" if topic else "",
        f"{country}{industry_zh}变化",
    ]
    if subject and num:
        variants.insert(1, f"{subject}{topic or action}{num}")
    seen: set[str] = set()
    for title in variants:
        if not title or title in seen:
            continue
        seen.add(title)
        title = title.strip(" -–—,:：")
        title = title.replace("跨境跨境", "跨境").replace("人工智能人工智能", "人工智能").replace("人工智能AI应用", "人工智能应用")
        if _is_clean_title(title):
            return title
    return ""


def _make_unique_title(title: str, candidate: dict[str, Any], used: set[str]) -> str:
    candidate_title = str(title or "").replace("市场观察", "市场变化").replace("市场动向", "市场变化")
    if candidate_title and candidate_title not in used and _is_clean_title(candidate_title):
        return candidate_title
    entity = str(candidate.get("title_original") or "")
    subject = _title_subject(entity)
    action = _title_action(entity)
    topic = _title_topic(entity)
    region = str(candidate.get("primary_region") or "")
    region_rule = business_mod.REGION_RULES.get(region) or {}
    country = (region_rule.get("markets") or ["全球"])[0]
    industry = str(candidate.get("primary_industry") or "crossborder")
    industry_zh = "人工智能" if industry == "ai" else business_mod.INDUSTRY_ZH.get(industry, "跨境")
    alternatives = [
        f"{subject}{topic}初创{action}" if subject and topic and action else "",
        f"{country}{topic}初创{action}" if topic and action else "",
        f"{subject}{topic}{action}" if subject and action else "",
        f"{country}{topic}{action}" if topic and action else "",
        f"{country}{industry_zh}{action}" if action else "",
        f"{country}{industry_zh}变化",
    ]
    for alt in alternatives:
        alt = re.sub(r"[0-9]+$", "", alt).strip().replace("市场观察", "市场变化").replace("市场动向", "市场变化")
        if alt and alt not in used and _is_clean_title(alt):
            return alt
    source = str(candidate.get("source", {}).get("name") or "公开信号")
    base = re.sub(r"[0-9]+$", "", candidate_title).strip() or f"{country}{industry_zh}市场变化新动态"
    numerals = "一二三四五六七八九十"
    counter = len(used) % 10
    for attempt in range(10):
        suffix = f"·{source[:6]}{numerals[(counter + attempt) % 10]}"
        alt = f"{base[: 32 - len(suffix)]}{suffix}"
        if alt not in used and _is_clean_title(alt):
            return alt
    return f"{base[:24]}新动态{numerals[len(used) % 10]}"


def _noise_flags(signal: dict[str, Any]) -> list[str]:
    title = str(signal.get("title") or signal.get("title_norm") or "")
    source_id = str(signal.get("source_id") or "").lower()
    text = title.lower()
    flags: list[str] = []
    if "app-store" in source_id or "appstore" in source_id:
        flags.append("app-store-listing")
    slogans = (r"(download now|play now|shop now|buy now|free shipping|no\.?\s*1|top \d+|best .*app|"
               r"购物|下载|福利|红包|优惠券|here.s why|you won.t believe|what you need to know|opinion|podcast)")
    if re.search(slogans, text):
        flags.append("promo-slogan")
    low_signal = (r"(layoff|layoffs|裁员|award|awards|获奖|stock|stocks|shares|股价|ipo|上市|debut|"
                  r"here.s why|what you need to know|you won.t believe|标题党|airspace|federal register)")
    if re.search(low_signal, text):
        flags.append("low-signal-news")
    company_event = (r"(raises|raised|funding|seed round|series [a-z]|融资|种子轮|轮融资|launches|launched|"
                     r"unveils|上线|发布|新品)")
    if re.search(company_event, text):
        flags.append("company-event")
    if len(re.findall(r"[A-Za-z\u4e00-\u9fff]", title)) < 8:
        flags.append("too-short")
    return flags


def _seven_questions(signal: dict[str, Any], industries: list[str], gaps: list[str]) -> dict[str, dict[str, str]]:
    industry_text = "、".join(INDUSTRY_NAMES.get(item, item) for item in industries[:2]) or "跨境"
    gap_text = "、".join(GAP_NAMES.get(item, item) for item in gaps[:2]) or "信息差"
    title = _clean_title(signal)
    answers = {
        "需求": f"围绕「{title}」：{industry_text}需求正在被公开讨论，可能存在未被满足的具体场景。",
        "人群": "从该信号来源的读者/从业者中找最早 100 个种子用户（如原文评论区、相关社群）。",
        "竞品": "现有替代方案多为通用商品/服务；需人工对比价格、交付与本地化程度。",
        "差异": f"利用{gap_text}做出本地化/更快/更透明的供给（自动草稿，待人工细化）。",
        "渠道": "先用来源媒体/社群做小成本测试，再考虑搜索/平台/私域渠道（自动草稿）。",
        "成本": "先按行业默认 ROI 估算最小启动成本；真实成本需人工核价。",
        "跟踪": "14 天内观察到询价/预约/加购等可量化信号再投入（自动草稿）。",
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


def _has_cjk(text: str) -> bool:
    return any("\u4e00" <= char <= "\u9fff" for char in text or "")


def _translate_terms(text: str) -> list[str]:
    lowered = (text or "").lower()
    terms: list[str] = []
    for english, chinese in ZH_GLOSSARY.items():
        if not chinese:
            continue
        if re.search(r"(?<![a-z])" + re.escape(english) + r"(?![a-z])", lowered) and chinese not in terms:
            terms.append(chinese)
        if len(terms) >= 8:
            break
    return terms


def _english_ratio(text: str) -> float:
    if not text:
        return 0.0
    english = len(re.findall(r"[A-Za-z]{2,}", text))
    chinese = len(re.findall(r"[\u4e00-\u9fff]", text))
    total = english + chinese
    return english / total if total else 0.0


def _readable_zh_title(translated: str, label: str) -> str:
    """从翻译结果提取中文片段，前置行业/信息差上下文，组成可读标题（≤28 字）。"""
    parts = [
        re.sub(r"[，。、；：]+$", "", part.strip())
        for part in re.findall(r"[\u4e00-\u9fff][\u4e00-\u9fff·、，A-Za-z0-9]*", translated or "")
    ]
    parts = [part for part in parts if len(part) >= 2][:2]
    extracted = "、".join(parts)
    if not extracted:
        return _truncate(f"{label}商机线索", 28)
    return _truncate(f"{label}｜{extracted}", 28)


def _localize(
    signal: dict[str, Any],
    title_original: str,
    summary: str,
    one_liner: str,
    industries: list[str],
    gaps: list[str],
    regions: list[str],
    *,
    translate_provider: str | None = None,
    translate_cache: bool = True,
) -> dict[str, Any]:
    """系统级翻译（v0.9.3 修订）：title_zh=真实翻译结果（≤40 字，不做标签拼接）。"""
    industry_zh = "、".join(INDUSTRY_NAMES.get(item, item) for item in industries[:2]) or "跨境"
    gap_zh = "、".join(GAP_NAMES.get(item, item) for item in gaps[:2]) or "信息差"
    region_zh = "、".join(REGION_NAMES.get(item, item) for item in regions[:2]) or "全球"
    title_input = re.sub(r"\s+[-|–—]\s+[^-|–—]{2,40}$", "", title_original or title).strip() or (title_original or title)
    translated = translate_mod.translate_fields(
        title_input,
        summary,
        one_liner,
        context={"label": f"{industry_zh}·{gap_zh}", "region": region_zh},
        provider=translate_provider or config.TRANSLATION_DEFAULT_PROVIDER,
        use_cache=translate_cache,
        stable_cached=True,
    )
    title_zh = translated.get("title_zh") or ""
    if (not _has_cjk(title_zh)) or _english_ratio(title_zh) > 0.5:
        # 仅当英文残留过多才回退中文模板（quality=low / template=true）
        translated["title_zh"] = _truncate(f"{industry_zh}{gap_zh}商机线索", 40)
        translated["translation"]["quality"] = "low"
        translated["translation"]["template"] = True
        translated["translation_method"] = "template"
    else:
        translated["translation"]["template"] = bool(translated["translation"].get("template"))
        # v1.0.0 P1：quality 只由最终标题文本/provider 确定，避免冷/热缓存历史导致漂移
        provider = str(translated["translation"].get("provider") or "glossary")
        if provider != "source-zh":
            translated["translation"]["quality"] = translate_mod.quality_for_translated(title_zh, provider)
        translated["translation_method"] = provider
    translated["title_original"] = _truncate(title_original, 120)
    return translated


def _system_validation(
    signal: dict[str, Any],
    source_meta: dict[str, Any],
    industries: list[str],
    gaps: list[str],
    gap_inferred: bool,
    regions: list[str],
    countries: list[str],
    evidence: list[dict[str, Any]],
    published: str,
    as_of: date,
) -> dict[str, Any]:
    """系统商机评估（无需人工/实验）：≥5 项检查 + score/level；不代表“能赚钱”。"""
    relevance = float(signal.get("relevance_score") or 0)
    tier = str(signal.get("tier") or "")
    try:
        days_old = (as_of - common.parse_date(published)).days
    except (TypeError, ValueError):
        days_old = 999
    source_ok = source_meta.get("compliance") in (None, "green", "yellow") and source_meta.get("enabled") is not False
    yellow_source = source_meta.get("compliance") == "yellow"

    def check(check_id: str, name: str, passed: bool, note: str, points: int) -> dict[str, Any]:
        return {"id": check_id, "name": name, "passed": bool(passed), "note": note, "points": int(points)}

    demand_points = int(round(25 * min(1.0, relevance / 95.0)))
    gap_points = 15 if (gaps and not gap_inferred) else (9 if gaps else 0)
    evidence_points = 12 if len(evidence) >= 2 else (8 if evidence and evidence[0].get("url") else 0)
    source_points = 12 if source_ok and not yellow_source else (8 if source_ok else 0)
    if days_old <= 3:
        time_points = 15
    elif days_old <= 14:
        time_points = 12
    elif days_old <= 30:
        time_points = 8
    elif days_old <= 90:
        time_points = 4
    else:
        time_points = 0
    action_points = 10 if industries and countries else (5 if industries or countries else 0)
    specificity_points = 8 if regions else 4
    window_points = 5 if days_old <= 7 else (3 if days_old <= 30 else 0)
    checks = [
        check("demand_signal", "需求信号", demand_points >= 15, f"相关性 {relevance:.0f}/100，tier={tier or 'unknown'}；{demand_points}/25", demand_points),
        check("gap_clarity", "信息差明确", gap_points >= 9, "信息差：" + ("、".join(GAP_NAMES.get(item, item) for item in gaps) if gaps else "未识别") + f"；{gap_points}/15", gap_points),
        check("evidence", "证据链接", evidence_points > 0, f"公开链接 {len(evidence)} 条（无需人工核验）；{evidence_points}/12", evidence_points),
        check("source_quality", "来源质量", source_points > 0, f"来源 {source_meta.get('name') or signal.get('source_id')}（compliance={source_meta.get('compliance') or 'unknown'}）；{source_points}/12", source_points),
        check("timeliness", "时效", time_points > 0, (f"发布距基准日 {days_old} 天；{time_points}/15" if days_old != 999 else "发布日期未知"), time_points),
        check("actionability", "可执行性", action_points >= 5, f"行业 {len(industries)} / 目标国家 {len(countries)} / ROI 默认区间；{action_points}/10", action_points),
        check("specificity", "地理/场景具体性", specificity_points > 0, "区域：" + ("、".join(REGION_NAMES.get(item, item) for item in regions) if regions else "未识别") + f"；{specificity_points}/8", specificity_points),
        check("competition_window", "竞争/窗口", window_points > 0, f"新鲜度窗口 {days_old} 天；{window_points}/5", window_points),
    ]
    score = int(round(sum(int(item["points"]) for item in checks)))
    score = max(0, min(100, score))
    if score >= 95:
        level = "high"
    elif score >= 87:
        level = "medium"
    else:
        level = "low"
    return {
        "level": level,
        "score": score,
        "level_thresholds": {"high": 95, "medium": 87},
        "checks": checks,
        "checks_passed": sum(1 for item in checks if item["passed"]),
        "checks_total": len(checks),
        "notes": SYSTEM_BOUNDARY,
    }


def _candidate_from_signal(
    signal: dict[str, Any],
    sources: dict[str, dict[str, Any]],
    as_of: date,
    *,
    translate_provider: str | None = None,
    translate_cache: bool = True,
) -> dict[str, Any]:
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
    title_original = _strip_html(str(signal.get("title") or ""))
    title = _clean_title(signal)
    summary = _clean_summary(signal, title)
    sectors = "、".join(INDUSTRY_NAMES.get(item, item) for item in industries[:2])
    one_liner = _truncate(
        f"{sectors}｜{summary}（自动发现线索，系统已初筛）",
        120,
    )
    localize = _localize(
        signal,
        title_original or title,
        summary,
        one_liner,
        industries,
        gaps,
        regions,
        translate_provider=translate_provider,
        translate_cache=translate_cache,
    )
    title_zh = localize["title_zh"]
    one_liner_zh = localize["one_liner_zh"]
    summary_zh = localize.get("summary_zh") or summary
    translation = localize.get("translation") or {}
    evidence = [
        {
            "title": title_zh,
            "url": url,
            "source_id": source_id,
            "publisher": source_name,
            "date": published,
            "tier": "public-signal",
            "verified_by_human": False,
            "link_status": "public-url" if str(url).startswith(("http://", "https://")) else "missing-url",
            "fetch_status": "unfetched",
        }
    ]
    system_validation = _system_validation(
        signal, source_meta, industries, gaps, gap_inferred, regions, countries, evidence, published, as_of
    )
    candidate_id = "cand-" + _hash(url or title, str(signal.get("title_norm") or title))[:12]
    relevance = float(signal.get("relevance_score") or 0)
    confidence = int(round(common.clamp(30 + relevance * 0.5 + (10 if signal.get("tier") == "business" else 0) + 5 + 5, 0, 95)))
    primary_industry = business_mod._primary_industry(title_original or title, f"{summary_zh} {title_zh}", industries)
    secondary = business_mod.secondary_industry(
        primary_industry,
        industries,
        title_original or title,
        f"{summary_zh} {title_zh}",
    )
    industries_clean = [primary_industry] + ([secondary] if secondary and secondary != primary_industry else [])
    roi = _roi(primary_industry)
    business_eval = business_mod.build_business(
        signal,
        title_original=title_original or title,
        title_zh=title_zh,
        summary_zh=summary_zh,
        industries=industries_clean,
        gaps=gaps,
        regions=regions,
        countries=countries,
        scores=_scores(signal, industries_clean, regions, len(evidence), as_of),
        roi=roi,
        evidence=evidence,
        source_name=source_name,
        as_of=as_of.isoformat(),
        source_regions=list(source_meta.get("regions") or []) if source_meta else [],
    )
    primary_region = str(business_eval.get("primary_region") or regions[0])
    regions_clean = [primary_region] + [item for item in regions if item != primary_region][:1]
    countries_clean = _target_countries(regions_clean)
    title_final = _special_title(title_original or title) or (title_zh if _is_clean_title(title_zh) else _synth_title(business_eval, signal, countries_clean))
    if not _is_clean_title(title_final) and not _special_title(title_original or title):
        title_final = _synth_title(business_eval, signal, countries_clean)
    title_final = re.sub(r"[0-9]+$", "", title_final).strip()
    title_final = title_final.replace("市场动向", "市场观察")
    evidence[0]["title"] = title_final
    noise_flags = _noise_flags(signal)
    scores = _scores(signal, industries_clean, regions_clean, len(evidence), as_of)
    return {
        "candidate_id": candidate_id,
        "title": title_final,
        "title_zh": title_final,
        "one_liner_zh": one_liner_zh,
        "summary_zh": summary_zh,
        "title_original": localize["title_original"],
        "translation": translation,
        "translation_method": localize["translation_method"],
        "one_liner": one_liner,
        "industry_ids": industries_clean,
        "primary_industry": primary_industry,
        "primary_region": primary_region,
        "gap_type_ids": gaps,
        "gap_inferred": gap_inferred,
        "gap_inference": _gap_inference_text(gaps, gap_inferred),
        "region_ids": regions_clean,
        "region_inferred": region_inferred,
        "target_countries": countries_clean,
        "source": {
            "id": source_id,
            "name": source_name,
            "url": url,
            "cleaned": title_final,
            "raw_title": title_original,
            "published_at": published,
            "summary": summary,
        },
        "evidence": evidence,
        "system_validation": system_validation,
        "seven_questions": _seven_questions(signal, industries, gaps),
        "roi": roi,
        "grade": scores["grade"],
        "noise_flags": noise_flags,
        "scores": scores,
        **business_eval,
        "confidence": confidence,
        "status": STATUS_AUTO,
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


def _event_key(signal: dict[str, Any], candidate: dict[str, Any]) -> tuple:
    text = str(signal.get("title") or signal.get("title_norm") or "").lower()
    if "lianlian" in text and "paypal" in text:
        return ("brands", ("lianlian", "paypal"))
    raw_brands = [brand.lower() for brand in business_mod.BRAND_ZH if re.search(r"(?<![a-z])" + re.escape(brand.lower()) + r"(?![a-z])", text)]
    brands = sorted({("lianlian" if "lianlian" in brand else brand) for brand in raw_brands})
    judgment = candidate.get("judgment") or {}
    region = str(candidate.get("primary_region") or "")
    event = str(judgment.get("event_type") or "")
    if brands:
        return ("brands", tuple(brands[:3]))
    tokens = sorted({token for token in re.findall(r"[a-z0-9\u4e00-\u9fff]+", text) if len(token) > 2 or token.isdigit()})[:6]
    return ("tokens", tuple(tokens), region, event)


LOW_INFO_PATTERNS = (
    r"daily news", r"weekly (roundup|digest|wrap)", r"roundup", r"market wrap", r"morning brief",
    r"top \d+", r"best of", r"newsletter", r"podcast", r"opinion", r"editorial",
    r"^[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}$", r"^[0-9]+ takeaways",
)
TITLE_GENERIC_PATTERNS = (r"行业信号", r"市场观察", r"市场动向", r"市场变化", r"新动态", r"动态$", r"机会")


def _is_low_info(title: str) -> bool:
    text = str(title or "").strip()
    if len(text) < 8:
        return True
    lowered = text.lower()
    if any(re.search(pattern, lowered) for pattern in LOW_INFO_PATTERNS):
        return True
    has_subject = bool(re.search(r"[A-Z][A-Za-z]{2,}", text)) or bool(re.search(r"[\u4e00-\u9fff]{2,}", text))
    has_event = bool(re.search(
        r"raises|funding|launch|partner|acquir|regulat|policy|rules|epr|ban|demand|growth|surge|"
        r"price|cost|tariff|ipo|listing|hiring|layoff|投资|融资|上线|发布|合作|并购|监管|新规|需求|增长|关税|降价",
        lowered,
    ))
    has_number = bool(re.search(r"[0-9]", text))
    return not (has_subject and (has_event or has_number))


def _is_acceptable_title(title: str) -> bool:
    if not title or title in {"", "行业信号"}:
        return False
    if len(title) < 8 or len(title) > 32:
        return False
    if re.search(r"[0-9]+$", title):
        return False
    if re.search("|".join(TITLE_GENERIC_PATTERNS), title):
        return False
    if not _is_clean_title(title):
        return False
    return True


def build_candidates(
    as_of: date | None = None,
    outbox_path: Path | None = None,
    limit: int | None = None,
    translate_provider: str | None = None,
    translate_cache: bool = True,
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
    seen_title_tokens: list[set[str]] = []
    seen_event_keys: set[tuple] = set()
    used_titles: set[str] = set()
    dropped_duplicates = 0
    noise_filtered = 0
    low_info_filtered = 0
    for signal in ordered:
        if _is_low_info(signal.get("title")):
            low_info_filtered += 1
            continue
        candidate = _candidate_from_signal(
            signal,
            sources,
            as_of,
            translate_provider=translate_provider,
            translate_cache=translate_cache,
        )
        dedupe_key_url = str(signal.get("canonical_url") or signal.get("url") or "")
        dedupe_key_title = str(signal.get("title_norm") or candidate["candidate_id"])
        if dedupe_key_url and dedupe_key_url in seen_urls:
            dropped_duplicates += 1
            continue
        if dedupe_key_title in seen_titles:
            dropped_duplicates += 1
            continue
        title_tokens = {item for item in re.findall(r"[a-z0-9\u4e00-\u9fff]+", str(signal.get("title_norm") or signal.get("title") or "").lower()) if len(item) > 1 or item.isdigit()}
        if title_tokens and any(
            len(title_tokens & other) / max(1, len(title_tokens | other)) >= 0.8 for other in seen_title_tokens
        ):
            dropped_duplicates += 1
            continue
        if dedupe_key_url:
            seen_urls.add(dedupe_key_url)
        seen_titles.add(dedupe_key_title)
        if title_tokens:
            seen_title_tokens.append(title_tokens)
        if any(flag in {"app-store-listing", "promo-slogan", "low-signal-news"} for flag in candidate.get("noise_flags", [])):
            noise_filtered += 1
            continue
        event_key = _event_key(signal, candidate)
        if event_key in seen_event_keys:
            dropped_duplicates += 1
            continue
        seen_event_keys.add(event_key)
        unique_title = _make_unique_title(str(candidate.get("title_zh") or ""), candidate, used_titles)
        unique_title = re.sub(r"[0-9]+$", "", unique_title).strip()
        if not unique_title or not _is_acceptable_title(unique_title):
            low_info_filtered += 1
            continue
        candidate["title"] = unique_title
        candidate["title_zh"] = unique_title
        if candidate.get("evidence"):
            candidate["evidence"][0]["title"] = unique_title
        if candidate.get("source"):
            candidate["source"]["cleaned"] = unique_title
        used_titles.add(candidate["title_zh"])
        candidates.append(candidate)
        if len(candidates) >= limit:
            break
    source_meta = (outbox.get("meta") or {}) if isinstance(outbox.get("meta"), dict) else {}
    gap_missing = sum(1 for candidate in candidates if not candidate.get("gap_type_ids"))
    gap_inferred_count = sum(1 for candidate in candidates if candidate.get("gap_inferred"))
    covered_regions = sorted({region for candidate in candidates for region in candidate.get("region_ids") or []})
    covered_countries = sorted({country for candidate in candidates for country in candidate.get("target_countries") or []})
    levels = {"high": 0, "medium": 0, "low": 0}
    validation_scores: list[int] = []
    for candidate in candidates:
        validation = candidate.get("system_validation") or {}
        levels[validation.get("level", "low")] = levels.get(validation.get("level", "low"), 0) + 1
        validation_scores.append(int(validation.get("score") or 0))
    translation_methods: dict[str, int] = {}
    translation_cached = 0
    quality_counts = {"high": 0, "medium": 0, "low": 0, "source-zh": 0}
    zh_titles = 0
    for candidate in candidates:
        translation = candidate.get("translation") or {}
        method = str(translation.get("provider") or candidate.get("translation_method") or "glossary")
        translation_methods[method] = translation_methods.get(method, 0) + 1
        quality = str(translation.get("quality") or "medium")
        quality_counts[quality] = quality_counts.get(quality, 0) + 1
        if translation.get("cached"):
            translation_cached += 1
        if _has_cjk(str(candidate.get("title_zh") or "")):
            zh_titles += 1
    translation_summary = {
        "provider": translation_methods,
        "total": len(candidates),
        "cached": translation_cached,
        "cache_hit_ratio": round(translation_cached / len(candidates), 3) if candidates else 0.0,
        "quality_high": quality_counts.get("high", 0),
        "quality_medium": quality_counts.get("medium", 0),
        "quality_low": quality_counts.get("low", 0),
        "quality_source_zh": quality_counts.get("source-zh", 0),
        "source_zh": translation_methods.get("source-zh", 0),
        "glossary": translation_methods.get("glossary", 0),
        "llm": translation_methods.get("llm", 0),
        "mock": translation_methods.get("mock", 0),
        "coverage": round(zh_titles / len(candidates), 3) if candidates else 0.0,
        "glossary_entries": len(translate_mod.GLOSSARY),
        "disclaimer": translate_mod.DISCLAIMER,
    }
    health = common.load_json(config.SOURCE_HEALTH_PATH) or {}
    health_meta = health.get("meta") if isinstance(health, dict) else None
    health_meta = health_meta if isinstance(health_meta, dict) else {}
    failed_sources = [
        {
            "id": row.get("id"),
            "http_status": row.get("http_status"),
            "error": row.get("error"),
        }
        for row in (health.get("sources") or [])
        if isinstance(row, dict) and not row.get("ok")
    ][:10]
    funnel = {
        "attempted": health_meta.get("count"),
        "ok": health_meta.get("ok_count"),
        "failed": health_meta.get("failed_count"),
        "failed_sources": failed_sources,
        "raw": source_meta.get("raw_count"),
        "deduped": source_meta.get("signal_count"),
        "new": source_meta.get("new_count"),
        "relevant": (source_meta.get("tiers") or {}).get("business"),
        "candidates": len(candidates),
    }
    payload = {
        "meta": {
            "data_version": config.DATA_VERSION,
            "as_of": as_of.isoformat(),
            "generated_at": f"{as_of.isoformat()}T00:00:00+08:00",
            "generator": "scanner/candidates.py",
            "status": "auto-discovered",
            "system_boundary": SYSTEM_BOUNDARY,
            "limit": limit,
            "total": len(candidates),
            "business_signals": len(business),
            "maybe_signals": len(maybe),
            "dropped_duplicates": dropped_duplicates,
        "noise_filtered": noise_filtered,
        "low_info_filtered": low_info_filtered,
            "system_validation_summary": {
                "high": levels.get("high", 0),
                "medium": levels.get("medium", 0),
                "low": levels.get("low", 0),
                "avg_score": round(sum(validation_scores) / len(validation_scores), 1) if validation_scores else 0.0,
                "note": SYSTEM_BOUNDARY,
            },
            "translation_summary": translation_summary,
            "translation_coverage": {
                "total": len(candidates),
                "zh_titles": zh_titles,
                "ratio": round(zh_titles / len(candidates), 3) if candidates else 0.0,
                "methods": translation_methods,
            },
            "funnel": funnel,
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
                "自动发现候选（discovery layer）：由系统自动评估商机信号（system_validation：需求/信息差/证据/时效/可执行性）；"
                "不写入 opportunities.json。"
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
            "note": "候选发现榜与精选人工榜（rankings.json，80 条）并行；系统评估仅用于发现与排序参考。",
        },
        "windows": windows,
    }


def generate(
    as_of: date | None = None,
    outbox_path: Path | None = None,
    limit: int | None = None,
    translate_provider: str | None = None,
    translate_cache: bool = True,
) -> dict[str, Any]:
    """生成并写出 data/candidates.json + data/candidate-rankings.json；返回摘要。"""
    payload, outbox_file = build_candidates(
        as_of=as_of,
        outbox_path=outbox_path,
        limit=limit,
        translate_provider=translate_provider,
        translate_cache=translate_cache,
    )
    as_of_date = date.fromisoformat(payload["meta"]["as_of"])
    rankings = build_candidate_rankings(payload, as_of_date)
    common.dump_json(config.CANDIDATES_PATH, payload)
    common.dump_json(config.CANDIDATE_RANKINGS_PATH, rankings)
    return {
        "total": payload["meta"]["total"],
        "business_signals": payload["meta"]["business_signals"],
        "maybe_signals": payload["meta"]["maybe_signals"],
        "dropped_duplicates": payload["meta"]["dropped_duplicates"],
        "translation_summary": payload["meta"].get("translation_summary"),
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
    parser.add_argument("--translate-provider", choices=sorted(translate_mod.PROVIDERS), default=None, help="翻译引擎（默认 auto：有 LLM_API_KEY 用 llm，否则 glossary）")
    parser.add_argument("--no-translate-cache", action="store_true", help="禁用翻译缓存")
    args = parser.parse_args(argv)
    try:
        as_of = date.fromisoformat(args.as_of) if args.as_of else None
    except ValueError:
        print(f"--as-of 非法日期：{args.as_of}")
        return 2
    outbox_path = Path(args.outbox) if args.outbox else None
    result = generate(
        as_of=as_of,
        outbox_path=outbox_path,
        limit=args.limit,
        translate_provider=args.translate_provider,
        translate_cache=not args.no_translate_cache,
    )
    print(
        f"候选已生成：{result['total']} 条（business {result['business_signals']} / maybe {result['maybe_signals']}，"
        f"去重 {result['dropped_duplicates']}）→ " + " / ".join(Path(path).name for path in result["paths"])
    )
    print("四窗口：" + " / ".join(f"{window}={count}" for window, count in result["counts"].items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
