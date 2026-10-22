"""归一模块：raw 记录 → 统一信号对象（normalized signal）。

统一信号对象字段（供 dedupe / 后续机会聚合使用）：
  signal_id, adapter, source_id, source_category, access, collected_at,
  title, title_norm, quote, url, canonical_url, url_domain,
  published_date, date_source, lang,
  region_hints[], industry_hints[], gap_hints[], emotion_hints[], pain_phrases[],
  engagement{}, trend{}, raw_id, fingerprint
"""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from .common import load_json, norm_text, short_hash, token_set, trim

TRACKING_PREFIXES = ("utm_", "spm", "from", "ref", "pspartner", "fbclid", "gclid", "cmpid")

INDUSTRY_KEYWORDS: dict[str, list[str]] = {
    "pet": ["pet", "pets", "dog", "cat", "宠物", "毛孩子", "vet", "memorial", "殡葬", "寄养"],
    "silver": ["elderly", "senior", "aging", "ageing", "care home", "养老", "银发", "老年", "照护", "康复"],
    "emotional": ["grief", "lonely", "loneliness", "anxiety", "therapy", "情绪", "疗愈", "孤独", "哀悼", "心理"],
    "ai": ["ai", "agent", "automation", "llm", "人工智能", "自动化", "模型", "效率"],
    "crossborder": ["cross-border", "跨境", "temu", "shein", "amazon", "shopee", "ecommerce", "电商", "fba", "直邮"],
    "content": ["webtoon", "short drama", "短剧", "webnovel", "content", "licensing", "版权", "ip", "漫"],
    "education": ["tutoring", "school", "exam", "course", "补习", "教育", "培训", "留学", "microschool", "curriculum"],
    "local": ["local", "delivery", "restaurant", "service", "上门", "本地", "到店", "laundry", "社区"],
    "green": ["solar", "heat pump", "recycling", "green", "光伏", "热泵", "回收", "节能", "节水", "降温", "电池"],
    "compliance": ["compliance", "regulation", "eudr", "ai act", "gpsr", "合规", "认证", "监管", "epr", "halal certification", "tax"],
    "culture": ["ramadan", "halal", "quran", "religious", "church", "斋月", "宗教", "清真", "文化", "eid"],
    "gaming": ["game", "gaming", "roblox", "esports", "游戏", "电竞", "ugc", "creator"],
    "fintech": ["payment", "paypal", "remittance", "fintech", "wallet", "支付", "汇款", "金融", "withdraw"],
    "manufacturing": ["factory", "manufacturing", "spare parts", "supplier", "制造", "工厂", "零部件", "1688", "oem"],
}

GAP_KEYWORDS: dict[str, list[str]] = {
    "language": ["translation", "translate", "localization", "tajweed", "语言", "翻译", "本地化", "word-by-word"],
    "culture": ["halal", "ramadan", "eid", "religious", "quran", "清真", "斋月", "宗教", "文化差异"],
    "time": ["trend", "trending", "early", "already mainstream", "趋势", "时差", "刚起来"],
    "geo": ["import", "export", "cross-border", "overseas", "海外", "进口", "出口", "跨境", "直邮"],
    "knowledge": ["research", "patent", "developer", "paper", "学术", "专利", "论文", "圈内"],
    "regulation": ["regulation", "compliance", "act", "certification", "mandate", "法规", "监管", "认证", "合规", "税"],
    "platform": ["platform", "algorithm", "policy", "fba fee", "platform fee", "平台", "规则", "佣金", "搜索"],
    "price": ["cheap", "price", "supplier", "cost", "价格", "便宜", "供应链", "成本", "运费"],
    "channel": ["traffic", "keyword", "seo", "流量", "关键词", "渠道", "获客"],
    "demographic": ["aging", "elderly", "single", "birth rate", "老龄化", "单身", "少子化", "人口", "freelancer"],
    "emotion": ["grief", "lonely", "loneliness", "anxiety", "memorial", "情绪", "孤独", "哀悼", "焦虑", "纪念"],
    "infrastructure": ["logistics", "payment", "off-grid", "物流", "支付", "基础设施", "电网", "withdraw"],
}

EMOTION_KEYWORDS: dict[str, list[str]] = {
    "complaint": ["broken", "waste", "doesn't work", "too expensive", "complaint", "吐槽", "不好用", "太贵", "退货", "cracked"],
    "anxiety": ["anxious", "worried", "risk", "anxiety", "焦虑", "担心", "风险"],
    "loneliness": ["lonely", "alone", "no friends", "孤独", "没人"],
    "grief": ["grief", "passed away", "ashes", "memorial", "哀悼", "去世", "纪念"],
    "nostalgia": ["nostalgia", "vintage", "retro", "怀旧", "复古"],
    "hope": ["hope", "opportunity", "better", "希望", "机会"],
    "aspiration": ["aspire", "want to be", "向往", "想成为"],
    "identity": ["identity", "community", "belong", "认同", "圈层"],
    "relief": ["relief", "relax", "calm", "解压", "放松"],
    "love": ["love", "keepsake", "爱", "留念"],
    "curiosity": ["curious", "new", "好奇", "新"],
}

REGION_KEYWORDS: dict[str, list[str]] = {
    "north-america": ["us", "usa", "united states", "america", "canada", "美国", "加拿大"],
    "europe": ["eu", "europe", "germany", "france", "uk", "poland", "spain", "netherlands", "欧洲", "德国", "英国", "波兰"],
    "mena": ["mena", "saudi", "uae", "dubai", "egypt", "middle east", "中东", "沙特", "阿联酋", "斋月"],
    "sea": ["indonesia", "vietnam", "thailand", "philippines", "malaysia", "singapore", "印尼", "越南", "泰国", "东南亚"],
    "east-asia": ["japan", "korea", "taiwan", "hong kong", "日本", "韩国", "东亚"],
    "south-asia": ["india", "pakistan", "bangladesh", "印度", "巴基斯坦", "南亚"],
    "latam": ["brazil", "mexico", "chile", "argentina", "巴西", "墨西哥", "拉美"],
    "africa": ["nigeria", "kenya", "south africa", "africa", "尼日利亚", "肯尼亚", "非洲"],
    "oceania": ["australia", "new zealand", "澳洲", "澳大利亚", "新西兰"],
    "cis": ["russia", "kazakhstan", "uzbekistan", "cis", "俄罗斯", "中亚"],
    "china": ["china", "chinese", "中国", "国内", "亚宠", "1688"],
}

PAIN_PHRASES = [
    "can't find",
    "over $",
    "too expensive",
    "broke in transit",
    "smaller than expected",
    "takes weeks",
    "no one",
    "hard to",
    "doesn't work",
    "not worth",
    "找不到",
    "太贵",
    "不好用",
    "退货",
    "破损",
    "等太久",
]


def canonical_url(url: str) -> str:
    """URL 规范化：去 fragment / 追踪参数 / 重复斜杠，query 排序。用于精确去重。"""
    if not url:
        return ""
    parsed = urlparse(url.strip())
    scheme = (parsed.scheme or "https").lower()
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    query_pairs = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=False)
        if not key.lower().startswith(TRACKING_PREFIXES) and key.lower() not in {"spm", "ref", "from"}
    ]
    query = urlencode(sorted(query_pairs))
    path = re.sub(r"/+", "/", parsed.path or "/")
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    return urlunparse((scheme, netloc, path, "", query, ""))


def url_domain(url: str) -> str:
    try:
        return (urlparse(url).netloc or "").lower()
    except ValueError:
        return ""


def _infer(text: str, mapping: dict[str, list[str]], limit: int = 4) -> list[str]:
    norm = norm_text(text)
    scored: list[tuple[str, int]] = []
    for key, keywords in mapping.items():
        hits = sum(1 for keyword in keywords if norm_text(keyword) and norm_text(keyword) in norm)
        if hits:
            scored.append((key, hits))
    scored.sort(key=lambda item: (-item[1], item[0]))
    return [key for key, _ in scored[:limit]]


def _extract_pain_phrases(text: str, limit: int = 5) -> list[str]:
    norm = norm_text(text)
    hits = [phrase for phrase in PAIN_PHRASES if norm_text(phrase) in norm]
    return hits[:limit]


def normalize_record(raw: dict[str, Any], as_of: str) -> dict[str, Any]:
    url = raw.get("url", "")
    title = raw.get("title", "")
    text = raw.get("text", "")
    payload = raw.get("payload", {}) or {}
    combined = " ".join(
        [title, text, str(payload.get("channel", "")), str(payload.get("term", "")), str(payload.get("subreddit", ""))]
    )
    published = raw.get("published")
    date_source = "source"
    if not published:
        published, date_source = as_of, "collected_at"
    trend: dict[str, Any] = {}
    if payload.get("trend_direction"):
        trend = {
            "direction": payload.get("trend_direction"),
            "latest": raw.get("engagement", {}).get("latest_value"),
            "points": len(payload.get("interest_over_time", [])),
        }
    norm_title = norm_text(title)
    return {
        "signal_id": "sig-" + short_hash(raw.get("source_id", ""), canonical_url(url), norm_title),
        "adapter": raw.get("adapter", ""),
        "source_id": raw.get("source_id", ""),
        "source_category": raw.get("source_category", ""),
        "access": raw.get("access", ""),
        "collected_at": raw.get("collected_at", ""),
        "title": title,
        "title_norm": norm_title,
        "quote": trim(text or title, 120),
        "url": url,
        "canonical_url": canonical_url(url),
        "url_domain": url_domain(url),
        "published_date": published,
        "date_source": date_source,
        "lang": raw.get("lang", "en"),
        "region_hints": _infer(combined, REGION_KEYWORDS),
        "industry_hints": _infer(combined, INDUSTRY_KEYWORDS),
        "gap_hints": _infer(combined, GAP_KEYWORDS),
        "emotion_hints": _infer(combined, EMOTION_KEYWORDS),
        "pain_phrases": _extract_pain_phrases(text or title),
        "engagement": raw.get("engagement", {}),
        "trend": trend,
        "raw_id": raw.get("raw_id", ""),
        "fingerprint": short_hash(canonical_url(url), norm_title),
        "tokens": sorted(token_set(title)),
    }


def normalize_all(
    raw_records: list[dict[str, Any]], as_of: str
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    normalized = [normalize_record(raw, as_of) for raw in raw_records]
    by_adapter: dict[str, int] = {}
    for signal in normalized:
        by_adapter[signal["adapter"]] = by_adapter.get(signal["adapter"], 0) + 1
    summary = {
        "input": len(raw_records),
        "output": len(normalized),
        "by_adapter": by_adapter,
        "with_pain_phrases": sum(1 for signal in normalized if signal["pain_phrases"]),
        "with_trend": sum(1 for signal in normalized if signal["trend"]),
    }
    return normalized, summary


def load_fixtures(path) -> dict[str, Any]:
    return load_json(path)
