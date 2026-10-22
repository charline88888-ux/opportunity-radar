"""AI 富化 outbox（data-v0.5.1）：把 `--fetch` 的原始信号整理成**候选机会草稿**，供人工复核。

铁律：
- 输出只写 `scanner/outbox/`（gitignore），**永不自动写入 `data/opportunities.json`**；
- 所有候选 `needs_human: true`，七问只是草稿（明确标注待人工补充）；
- key 只从环境变量读取、**绝不写入任何文件或日志**。

provider（v0.5.1）：
- `offline`（默认）：无网络/无 key，模板级候选映射；
- `mock`：本地模拟在线响应（**不联网**），走与真实在线相同的请求构造/响应解析/回退流程，
  `meta.generator="mock-llm"`、`meta.model="mock-model"`，用于测试与演示；
- `online`：需 `LLM_API_KEY`（可选 `LLM_BASE_URL`/`LLM_MODEL`），调用 OpenAI 兼容
  `/chat/completions`；记录 token 用量与成本估算（价格常量见 config），超时/重试/24h 缓存，失败回退 offline。

用法：
    python scanner/enrich.py                                  # offline（默认）
    python scanner/enrich.py --provider mock --limit 5        # 本地模拟在线（不联网）
    python scanner/enrich.py --provider online --limit 5      # 真实 LLM（需 LLM_API_KEY）
    python scanner/enrich.py --dry-run                        # 只打印摘要，不写文件
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # 支持 python scanner/enrich.py 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import common, config, normalize  # noqa: E402
else:  # pragma: no cover
    from . import common, config, normalize

SIGNAL_GLOB = "signals-*.json"
CANDIDATE_PREFIX = "cand-"
LLM_TIMEOUT_SEC = 60
LLM_MAX_INPUT_CHARS = 4000  # 单条信号送入 prompt 的最大字符数（控 token）

# signal_type（由 source_category/信号特征推导）→ gap_type 候选回退
SIGNAL_TYPE_GAP_FALLBACK = {
    "complaint": ["emotion"],
    "trend": ["time"],
    "market_signal": ["price"],
    "discussion": ["channel"],
    "regulation": ["regulation"],
    "funding": ["channel"],
    "paper": ["knowledge"],
    "price": ["price"],
    "culture": ["culture"],
    "service": ["language"],
    "platform_rule": ["platform"],
    "news": [],
}
CATEGORY_TO_SIGNAL_TYPE = {
    "demand": "complaint",
    "trend": "trend",
    "marketplace": "market_signal",
    "social": "discussion",
    "policy": "regulation",
    "capital": "funding",
    "academic": "paper",
    "supply": "price",
    "culture": "culture",
    "talent": "service",
    "data": "market_size",
    "platform": "platform_rule",
}
# 无情绪线索时按行业的默认人性需求候选
INDUSTRY_NEED_FALLBACK = {
    "pet": ["belonging", "health"],
    "silver": ["health", "control"],
    "emotional": ["meaning", "belonging"],
    "ai": ["ease", "growth"],
    "crossborder": ["status", "ease"],
    "content": ["expression", "novelty"],
    "education": ["growth", "status"],
    "local": ["ease", "belonging"],
    "green": ["survival", "control"],
    "compliance": ["control", "survival"],
    "culture": ["meaning", "belonging"],
    "gaming": ["novelty", "status"],
    "fintech": ["survival", "control"],
    "manufacturing": ["survival", "status"],
}
# 信号类型 → 商业驱动候选（seven_questions.drivers 用）
SIGNAL_TYPE_DRIVERS = {
    "complaint": ["info"],
    "trend": ["info"],
    "market_signal": ["supply", "info"],
    "discussion": ["info"],
    "regulation": ["regulation"],
    "funding": ["capital"],
    "paper": ["tech"],
    "price": ["supply"],
    "culture": ["info"],
    "service": ["ops"],
    "platform_rule": ["regulation", "info"],
    "news": ["info"],
    "market_size": ["capital"],
}

QUESTIONS = [
    ("traffic", "流量怎么来"),
    ("money", "赚什么钱"),
    ("model", "商业模式"),
    ("roi", "投入回报"),
    ("audience", "适合人群"),
    ("drivers", "驱动类型"),
    ("moat", "壁垒"),
]


# ---------------------------------------------------------------- 输入
def latest_signals_path(explicit: str | None = None) -> Path | None:
    if explicit:
        path = Path(explicit)
        return path if path.exists() else None
    candidates = sorted(config.OUTBOX_DIR.glob(SIGNAL_GLOB))
    return candidates[-1] if candidates else None


def load_outbox(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    payload = common.load_json(path)
    if isinstance(payload, list):
        return {}, payload
    return payload.get("meta") or {}, payload.get("signals") or []


def date_from_signals(path: Path, signals_meta: dict[str, Any]) -> str:
    as_of = signals_meta.get("as_of")
    if as_of:
        return str(as_of)
    match = re.search(r"signals-(\d{4}-\d{2}-\d{2})", path.name)
    return match.group(1) if match else datetime.now().astimezone().date().isoformat()


# ---------------------------------------------------------------- offline 模板
def detect_lang(text: str, fallback: str = "en") -> str:
    """启发式语言检测：CJK > 15% → zh；日文假名 → ja；韩文 → ko；西里尔 → ru；否则 en。"""
    if not text:
        return fallback
    total = len(text)
    cjk = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
    kana = sum(1 for ch in text if "\u3040" <= ch <= "\u30ff")
    hangul = sum(1 for ch in text if "\uac00" <= ch <= "\ud7af")
    cyrillic = sum(1 for ch in text if "\u0400" <= ch <= "\u04ff")
    if kana > 3:
        return "ja"
    if hangul > 3:
        return "ko"
    if cyrillic / total > 0.3:
        return "ru"
    if cjk / total > 0.15:
        return "zh"
    return fallback


def _signal_type(signal: dict[str, Any]) -> str:
    category = str(signal.get("source_category") or "")
    if category in CATEGORY_TO_SIGNAL_TYPE:
        return CATEGORY_TO_SIGNAL_TYPE[category]
    if signal.get("pain_phrases"):
        return "complaint"
    if signal.get("trend"):
        return "trend"
    return "news"


def _taxonomy() -> dict[str, Any]:
    return common.load_json(config.TAXONOMY_PATH)


def _valid_ids(taxonomy: dict[str, Any], collection: str) -> set[str]:
    return {item["id"] for item in taxonomy.get(collection, [])}


def _needs_for_signal(signal: dict[str, Any], taxonomy: dict[str, Any], industry_ids: list[str]) -> list[str]:
    emotion_ids = _valid_ids(taxonomy, "emotions")
    emotions = [emotion for emotion in signal.get("emotion_hints") or [] if emotion in emotion_ids]
    needs = []
    for need in taxonomy.get("human_needs", []):
        if set(need.get("typical_emotions") or []) & set(emotions):
            needs.append(need["id"])
    if not needs:
        for industry in industry_ids:
            needs.extend(INDUSTRY_NEED_FALLBACK.get(industry, []))
    deduped: list[str] = []
    for need in needs:
        if need not in deduped:
            deduped.append(need)
    return deduped[:3]


def _neuro_for_needs(needs: list[str], taxonomy: dict[str, Any]) -> list[str]:
    mapping = {need["id"]: need.get("neuro_drivers") or [] for need in taxonomy.get("human_needs", [])}
    drivers: list[str] = []
    for need in needs:
        for driver in mapping.get(need, []):
            if driver not in drivers:
                drivers.append(driver)
    return drivers[:3]


def offline_candidate(signal: dict[str, Any], taxonomy: dict[str, Any]) -> dict[str, Any] | None:
    title = str(signal.get("title") or "").strip()
    url = str(signal.get("url") or "").strip()
    if not title or not url.startswith("http"):
        return None
    signal_type = _signal_type(signal)
    gap_ids = _valid_ids(taxonomy, "gap_types")
    industry_ids = _valid_ids(taxonomy, "industries")
    need_ids = _valid_ids(taxonomy, "human_needs")

    industries = [item for item in signal.get("industry_hints") or [] if item in industry_ids][:3]
    gaps = [item for item in signal.get("gap_hints") or [] if item in gap_ids][:3]
    if not gaps:
        gaps = [item for item in SIGNAL_TYPE_GAP_FALLBACK.get(signal_type, []) if item in gap_ids]
    needs = [item for item in _needs_for_signal(signal, taxonomy, industries) if item in need_ids]
    emotions = [
        item
        for item in (signal.get("emotion_hints") or [])
        if item in _valid_ids(taxonomy, "emotions")
    ][:4]
    neuro = _neuro_for_needs(needs, taxonomy)
    regions = [item for item in signal.get("region_hints") or [] if item in _valid_ids(taxonomy, "regions")][:3]
    drivers = [item for item in SIGNAL_TYPE_DRIVERS.get(signal_type, ["info"]) if item in _valid_ids(taxonomy, "drivers")]
    lang = str(signal.get("lang") or "") or detect_lang(f"{title} {signal.get('quote', '')}")
    published = signal.get("published_date")

    seven = {
        "traffic": (
            f"待人工补充：信号来自 {signal.get('source_id') or '未知来源'}（{signal_type}），"
            "需先判断目标客户聚集渠道与内容形式（草稿，未验证）"
        ),
        "money": "待人工补充：卖实物/服务/信息/订阅/佣金？客单价、毛利率与复购结构需人工调研",
        "model": "待人工补充：一句商业模式 + 价值链条 + 交付方式（草稿）",
        "roi": "待人工补充：启动资金、回本周期、月收入区间、毛利与现金流（禁止估算冒充实测）",
        "audience": "待人工补充：适合什么资源/技能/语言/身份的人做，不适合谁",
        "drivers": drivers or ["info"],
        "moat": "待人工补充：壁垒类型 + 前置条件；若只是窗口期套利需如实写『无长期壁垒』",
    }
    return {
        "candidate_id": CANDIDATE_PREFIX + hashlib.sha1(f"{url}|{title}".encode()).hexdigest()[:12],
        "source_id": signal.get("source_id"),
        "url": url,
        "title": title,
        "lang": lang,
        "signal_type": signal_type,
        "gap_type_ids": gaps,
        "human_need_ids": needs,
        "seven_questions_draft": seven,
        "notes": [
            "offline-template：基于关键词/taxonomy 的候选映射，未做语义验证；七问为骨架草稿",
            "需人工补充：渠道/客单/毛利/壁垒/合规与证据三角验证",
            "本候选永不自动写入 data/opportunities.json",
        ],
        "needs_human": True,
        # 便于人工复核的附加信息（非契约必填）
        "industry_id_candidates": industries,
        "emotion_tags": emotions,
        "neuro_drivers": neuro,
        "region_ids": regions,
        "published_date": published,
        "quote": (signal.get("quote") or "")[:200],
        "signal_id": signal.get("signal_id"),
        "confidence": "low",
    }


# ---------------------------------------------------------------- LLM 公共层
def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def llm_available() -> bool:
    return bool(os.environ.get("LLM_API_KEY"))


def _llm_settings() -> dict[str, str]:
    return {
        "api_key": os.environ.get("LLM_API_KEY", ""),
        "base_url": (os.environ.get("LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/"),
        "model": os.environ.get("LLM_MODEL") or "gpt-4o-mini",
    }


def _cache_path(key: str, cache_dir: Path | None = None) -> Path:
    digest = hashlib.sha1(key.encode()).hexdigest()[:16]
    return (cache_dir or (config.BUILD_DIR / "enrich-cache")) / f"{digest}.json"


def _chat_body(signal: dict[str, Any], offline: dict[str, Any], model: str) -> dict[str, Any]:
    signal_payload = {
        "title": signal.get("title"),
        "url": signal.get("url"),
        "quote": signal.get("quote"),
        "published_date": signal.get("published_date"),
        "source_id": signal.get("source_id"),
        "source_category": signal.get("source_category"),
        "industry_hints": signal.get("industry_hints"),
        "gap_hints": signal.get("gap_hints"),
        "emotion_hints": signal.get("emotion_hints"),
        "pain_phrases": signal.get("pain_phrases"),
    }
    system = (
        "你是商机研究助理。只基于用户提供的信号（标题/摘录/来源）提炼候选机会线索。"
        "输出严格 JSON，不要编造 URL、数字或事实；不知道的字段输出 null。"
        "七问只给草稿并明确写『待人工补充』。所有候选都必须 needs_human=true。"
        "不要给出投资建议。"
    )
    user = (
        "请输出 JSON：{"
        '"title_suggestion":string|null, "industry_id":string|null, "gap_type_ids":[string],'
        '"human_need_ids":[string], "seven_questions_draft":{"traffic":string,"money":string,'
        '"model":string,"roi":string,"audience":string,"drivers":[string],"moat":string},'
        '"notes":[string], "needs_human":true'
        "}。\n可选 industry_id 必须来自 taxonomies；不知道就 null。\n信号 JSON：\n"
        + json.dumps(signal_payload, ensure_ascii=False)[:LLM_MAX_INPUT_CHARS]
    )
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }


def _mock_chat_response(signal: dict[str, Any], offline: dict[str, Any]) -> dict[str, Any]:
    """本地模拟 OpenAI 兼容响应（不联网）：结构、content、usage 与真实响应一致。"""
    content = {
        "title_suggestion": str(offline.get("title", ""))[:80],
        "industry_id": (offline.get("industry_id_candidates") or [None])[0],
        "gap_type_ids": offline.get("gap_type_ids") or [],
        "human_need_ids": offline.get("human_need_ids") or [],
        "seven_questions_draft": {
            key: (
                (offline["seven_questions_draft"].get(key) or "").replace(
                    "待人工补充", "待人工补充（mock-llm 草稿）"
                )
                if key != "drivers"
                else offline["seven_questions_draft"].get("drivers", ["info"])
            )
            for key, _label in QUESTIONS
        },
        "notes": ["mock provider：本地模拟在线响应，未联网；仅用于测试/演示", "仍需人工复核，不得直接入库"],
        "needs_human": True,
    }
    prompt = json.dumps(_chat_body(signal, offline, config.MOCK_LLM_MODEL), ensure_ascii=False)
    content_text = json.dumps(content, ensure_ascii=False)
    return {
        "model": config.MOCK_LLM_MODEL,
        "choices": [{"message": {"role": "assistant", "content": content_text}, "finish_reason": "stop"}],
        "usage": {
            "prompt_tokens": _estimate_tokens(prompt),
            "completion_tokens": _estimate_tokens(content_text),
            "total_tokens": _estimate_tokens(prompt) + _estimate_tokens(content_text),
        },
    }


def _http_chat_response(body: dict[str, Any], settings: dict[str, str]) -> tuple[dict[str, Any], int]:
    """真实 HTTP 调用（超时 + 重试）；返回 (响应 JSON, latency_ms)。"""
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    last_error: str = "unknown"
    started = time.time()
    for attempt in range(1 + config.LLM_MAX_RETRIES):
        request = urllib.request.Request(
            f"{settings['base_url']}/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings['api_key']}",  # 仅内存使用，不落盘
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=LLM_TIMEOUT_SEC) as response:
                raw = response.read().decode("utf-8", errors="replace")
                latency_ms = int((time.time() - started) * 1000)
                return json.loads(raw), latency_ms
        except urllib.error.HTTPError as exc:
            last_error = f"HTTP {exc.code}"
            if exc.code < 500 and exc.code != 429:  # 4xx（除限流）不重试
                break
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        if attempt < config.LLM_MAX_RETRIES:
            time.sleep(config.LLM_RETRY_BACKOFF_SEC * (attempt + 1))
    raise RuntimeError(f"LLM 请求失败（{last_error}）")


def _extract_llm_content(data: dict[str, Any]) -> tuple[dict[str, Any], dict[str, int]]:
    try:
        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage") or {}
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"LLM 响应结构不合法：{type(exc).__name__}") from exc
    content = re.sub(r"^```(?:json)?|```$", "", str(content).strip(), flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("LLM 输出不是严格 JSON") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("LLM 输出不是 JSON 对象")
    tokens = {
        "input_tokens": int(usage.get("prompt_tokens") or _estimate_tokens(content)),
        "output_tokens": int(usage.get("completion_tokens") or _estimate_tokens(content)),
    }
    return parsed, tokens


def _merge_llm_candidate(
    offline: dict[str, Any],
    parsed: dict[str, Any],
    taxonomy: dict[str, Any],
    *,
    model: str,
    provider: str,
    latency_ms: int,
    tokens: dict[str, int],
    cached: bool,
) -> dict[str, Any]:
    industry_valid = _valid_ids(taxonomy, "industries")
    gap_valid = _valid_ids(taxonomy, "gap_types")
    need_valid = _valid_ids(taxonomy, "human_needs")
    candidate = deepcopy(offline)
    candidate["industry_id_candidates"] = [
        item
        for item in ([parsed.get("industry_id")] if parsed.get("industry_id") else []) + offline["industry_id_candidates"]
        if item in industry_valid
    ][:3]
    merged_gaps = [item for item in (parsed.get("gap_type_ids") or []) if item in gap_valid]
    if merged_gaps:
        candidate["gap_type_ids"] = merged_gaps[:3]
    merged_needs = [item for item in (parsed.get("human_need_ids") or []) if item in need_valid]
    if merged_needs:
        candidate["human_need_ids"] = merged_needs[:3]
    llm_seven = parsed.get("seven_questions_draft") or {}
    for key, _label in QUESTIONS:
        value = llm_seven.get(key)
        if isinstance(value, list):
            candidate["seven_questions_draft"][key] = value
        elif isinstance(value, str) and value.strip():
            candidate["seven_questions_draft"][key] = value.strip()
    if isinstance(parsed.get("notes"), list):
        candidate["notes"] = [str(note) for note in parsed["notes"]][:6] + candidate["notes"][:2]
    candidate["title"] = str(parsed.get("title_suggestion") or candidate["title"]).strip()[:120]
    candidate["needs_human"] = True
    candidate["confidence"] = "medium"
    cost = (
        tokens["input_tokens"] / 1000.0 * config.LLM_PRICE_INPUT_PER_1K_USD
        + tokens["output_tokens"] / 1000.0 * config.LLM_PRICE_OUTPUT_PER_1K_USD
    )
    candidate["_mode"] = "llm-cache" if cached else ("mock-llm" if provider == "mock" else "llm")
    candidate["_llm"] = {
        "provider": provider,
        "model": model,
        "latency_ms": int(latency_ms),
        "input_tokens": int(tokens["input_tokens"]),
        "output_tokens": int(tokens["output_tokens"]),
        "estimated_cost_usd": round(cost, 6),
        "cached": bool(cached),
        "prices": {
            "input_per_1k_usd": config.LLM_PRICE_INPUT_PER_1K_USD,
            "output_per_1k_usd": config.LLM_PRICE_OUTPUT_PER_1K_USD,
        },
    }
    return candidate


def llm_candidate(
    signal: dict[str, Any],
    offline: dict[str, Any],
    taxonomy: dict[str, Any],
    *,
    provider: str,
    cache_enabled: bool = True,
    cache_dir: Path | None = None,
) -> dict[str, Any]:
    """mock/online 共用：请求构造 → 响应获取（mock 本地 / online HTTP）→ 解析 → 合并。"""
    settings = _llm_settings()
    model = config.MOCK_LLM_MODEL if provider == "mock" else settings["model"]
    cache_key = json.dumps(
        {"url": signal.get("url"), "title": signal.get("title"), "model": model, "provider": provider},
        ensure_ascii=False,
        sort_keys=True,
    )
    cached_path = _cache_path(cache_key, cache_dir)
    if cache_enabled and cached_path.exists():
        try:
            payload = common.load_json(cached_path)
            llm_meta = dict(payload.get("_llm") or {})
            llm_meta["cached"] = True
            return dict(
                payload,
                _mode=("mock-llm-cache" if provider == "mock" else "llm-cache"),
                _llm=llm_meta,
            )
        except (json.JSONDecodeError, OSError):
            pass

    body = _chat_body(signal, offline, model)
    started = time.time()
    if provider == "mock":
        data = _mock_chat_response(signal, offline)
        latency_ms = max(5, int((time.time() - started) * 1000))
    else:
        data, latency_ms = _http_chat_response(body, settings)
    parsed, tokens = _extract_llm_content(data)
    candidate = _merge_llm_candidate(
        offline,
        parsed,
        taxonomy,
        model=model,
        provider=provider,
        latency_ms=latency_ms,
        tokens=tokens,
        cached=False,
    )
    if cache_enabled:
        cached_path.parent.mkdir(parents=True, exist_ok=True)
        common.dump_json(cached_path, candidate)
    return candidate


# ---------------------------------------------------------------- 主流程
def enrich(
    signals_path: Path,
    *,
    online: bool | None = None,
    provider: str | None = None,
    dry_run: bool = False,
    limit: int | None = None,
    out_dir: Path | None = None,
    date: str | None = None,
    cache_enabled: bool = True,
    cache_dir: Path | None = None,
) -> dict[str, Any]:
    """生成候选；返回摘要。`dry_run=True` 时不写任何文件。"""
    provider = provider or ("online" if online else "offline")
    if provider not in config.LLM_PROVIDERS:
        raise ValueError(f"provider 必须是 {sorted(config.LLM_PROVIDERS)}，当前 {provider}")
    taxonomy = _taxonomy()
    signals_meta, signals = load_outbox(signals_path)
    as_of = date or date_from_signals(signals_path, signals_meta)
    out_dir = Path(out_dir).resolve() if out_dir else config.OUTBOX_DIR
    candidates: list[dict[str, Any]] = []
    skipped = 0
    error: str | None = None
    llm_used = 0
    llm_fallback = 0
    cache_hits = 0

    if provider == "online" and not llm_available():
        return {
            "error": "provider=online 需要环境变量 LLM_API_KEY；未检测到，已中止（未写任何文件）",
            "provider": provider,
            "mode": "online-unavailable",
            "candidates": [],
            "skipped": 0,
        }

    selected = signals[:limit] if limit else signals
    for signal in selected:
        offline = offline_candidate(signal, taxonomy)
        if offline is None:
            skipped += 1
            continue
        if provider == "offline":
            candidate = offline
        else:
            try:
                candidate = llm_candidate(
                    signal,
                    offline,
                    taxonomy,
                    provider=provider,
                    cache_enabled=cache_enabled,
                    cache_dir=cache_dir,
                )
                llm_used += 1
                llm_meta = candidate.get("_llm") or {}
                if llm_meta.get("cached"):
                    cache_hits += 1
            except RuntimeError as exc:
                llm_fallback += 1
                error = str(exc)
                candidate = dict(offline)
                candidate["notes"] = [f"{provider} 调用失败，已回退 offline-template：{exc}"] + candidate["notes"]
        candidates.append(candidate)
    skipped += max(0, len(signals) - len(selected))

    usage = {"input_tokens": 0, "output_tokens": 0, "estimated_cost_usd": 0.0, "calls": 0, "cache_hits": cache_hits}
    for candidate in candidates:
        llm_meta = candidate.get("_llm")
        if not llm_meta or llm_meta.get("cached"):
            continue
        usage["input_tokens"] += int(llm_meta.get("input_tokens") or 0)
        usage["output_tokens"] += int(llm_meta.get("output_tokens") or 0)
        usage["estimated_cost_usd"] += float(llm_meta.get("estimated_cost_usd") or 0.0)
        usage["calls"] += 1
    usage["estimated_cost_usd"] = round(usage["estimated_cost_usd"], 6)
    usage["prices"] = {
        "input_per_1k_usd": config.LLM_PRICE_INPUT_PER_1K_USD,
        "output_per_1k_usd": config.LLM_PRICE_OUTPUT_PER_1K_USD,
        "note": "示例价格常量（config.LLM_PRICE_*），仅估算参考，不代表真实账单；缓存命中不重复计费",
    }

    if provider == "offline":
        mode = "offline-template"
        generator = "offline-template"
        model = None
    elif provider == "mock":
        mode = "mock-llm"
        generator = "mock-llm"
        model = config.MOCK_LLM_MODEL
    else:
        mode = "llm+fallback" if llm_fallback and llm_used else ("llm" if llm_used else "offline-template")
        generator = "llm" if llm_used else "offline-template"
        model = _llm_settings()["model"] if llm_used else None

    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    meta = {
        "data_version": config.DATA_VERSION,
        "generator": generator,
        "mode": mode,
        "provider": provider,
        "model": model,
        "generated_at": generated_at,
        "dry_run": bool(dry_run),
        "as_of": as_of,
        "signals_file": str(signals_path),
        "signal_count": len(signals),
        "candidate_count": len(candidates),
        "skipped": skipped,
        "llm_used": llm_used,
        "llm_fallback": llm_fallback,
        "cache_hits": cache_hits,
        "usage": usage,
        "error": error,
        "key_logged": False,
        "note": "AI 富化草稿仅供人工复核；needs_human=true；永不自动写入 data/opportunities.json",
    }
    payload = {"meta": meta, "candidates": candidates}
    summary = {
        "signals_path": str(signals_path),
        "as_of": as_of,
        "provider": provider,
        "mode": mode,
        "generator": generator,
        "model": model,
        "candidates": len(candidates),
        "skipped": skipped,
        "llm_used": llm_used,
        "llm_fallback": llm_fallback,
        "cache_hits": cache_hits,
        "usage": usage,
        "error": error,
        "dry_run": dry_run,
    }
    if dry_run:
        return summary

    out_dir.mkdir(parents=True, exist_ok=True)
    enriched_path = out_dir / f"enriched-{as_of}.json"
    review_path = out_dir / "REVIEW.md"
    common.dump_json(enriched_path, payload)
    review_path.write_text(render_review(payload), encoding="utf-8")
    summary.update({"enriched_path": str(enriched_path), "review_path": str(review_path)})
    return summary


def render_review(payload: dict[str, Any]) -> str:
    meta = payload.get("meta") or {}
    candidates = payload.get("candidates") or []
    usage = meta.get("usage") or {}
    lines = [
        "# 富化候选人工复核清单（REVIEW.md）",
        "",
        f"- 数据版本：data-v{meta.get('data_version')}　｜　provider：`{meta.get('provider')}`　｜　生成模式：`{meta.get('mode')}`　｜　模型：{meta.get('model') or '—'}",
        f"- 生成时间：{meta.get('generated_at')}　｜　信号文件：`{meta.get('signals_file')}`",
        f"- 候选数：{meta.get('candidate_count')}　｜　跳过：{meta.get('skipped')}　｜　LLM 成功/回退/缓存：{meta.get('llm_used')}/{meta.get('llm_fallback')}/{meta.get('cache_hits')}",
        f"- token 用量：input {usage.get('input_tokens')} / output {usage.get('output_tokens')}　｜　成本估算：${usage.get('estimated_cost_usd')}（示例价格，非真实账单）",
        "",
        "> ⚠️ 本文件与 `enriched-*.json` 是**派生草稿**：永不自动写入 `data/opportunities.json`；",
        "> 所有候选 `needs_human=true`，七问为骨架草稿，必须人工补全、核验证据后才能手工入库（然后跑 `--all`）。",
        "",
        "## 复核步骤",
        "",
        "1. 逐条打开 `url`，确认标题/引文与来源一致（打不开或无法确认 → 放弃该候选）。",
        "2. 判定行业 / 信息差类型 / 人性需求候选是否正确（草稿可能误判）。",
        "3. 补全七问：流量渠道、收费方式与客单、交付模式、ROI 估算、适合人群、驱动、壁垒。",
        "4. 找 1–3 条独立证据（优先官方/一手），按 docs/12 §4.2 写 evidence（含 date/tier/lang/quote）。",
        "5. 只有通过人工复核的候选，才手工写入 `data/opportunities.json` 并 `python scanner/pipeline.py --all`。",
        "",
        "## 候选列表",
        "",
    ]
    if not candidates:
        lines.append("_本次没有可复核候选（outbox 为空或全部信号不合法）。_")
    for index, candidate in enumerate(candidates, start=1):
        lines.extend(
            [
                f"### {index}. {candidate.get('title', '').strip() or '（无标题）'}",
                "",
                f"- 来源：[{candidate.get('source_id')}]({candidate.get('url')})　｜　语言：`{candidate.get('lang')}`　｜　signal_type：`{candidate.get('signal_type')}`",
                f"- 行业候选：{'、'.join(candidate.get('industry_id_candidates') or []) or '待人工判定'}",
                f"- 信息差候选：{'、'.join(candidate.get('gap_type_ids') or []) or '待人工判定'}",
                f"- 人性需求候选：{'、'.join(candidate.get('human_need_ids') or []) or '待人工判定'}",
                f"- 情绪/神经递质：{'、'.join(candidate.get('emotion_tags') or []) or '—'} / {'、'.join(candidate.get('neuro_drivers') or []) or '—'}",
                f"- 待人工补充：{'；'.join(candidate.get('notes') or [])}",
                "",
            ]
        )
    lines.extend(
        [
            "## 禁止事项",
            "",
            "- 不把草稿直接批量写入机会库；不把 `needs_human` 改成 false 冒充已复核。",
            "- 不编造证据 URL/数字；无法核验 → `verified:false` 并在 `compliance_notes` 说明。",
            "- 不在 `online` 模式把 API key 写入任何文件（本工具只从环境变量读取）。",
            "",
        ]
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="AI 富化 outbox（offline 默认 / mock 本地模拟 / online 真实 LLM；永不自动入库）")
    parser.add_argument("--signals", type=str, default=None, help="输入 outbox signals-*.json（默认取最新）")
    parser.add_argument("--out-dir", type=str, default=None, help="输出目录（默认 scanner/outbox）")
    parser.add_argument("--date", type=str, default=None, help="输出日期 YYYY-MM-DD（默认取 signals meta.as_of）")
    parser.add_argument("--provider", choices=sorted(config.LLM_PROVIDERS), default=None, help="offline（默认）/ mock（不联网模拟）/ online（需 LLM_API_KEY）")
    parser.add_argument("--online", action="store_true", help="兼容别名：等价于 --provider online")
    parser.add_argument("--limit", type=int, default=None, help="最多处理 N 条信号")
    parser.add_argument("--dry-run", action="store_true", help="只打印摘要，不写文件")
    parser.add_argument("--no-cache", action="store_true", help="禁用 24h 富化缓存")
    args = parser.parse_args(argv)

    path = latest_signals_path(args.signals)
    if path is None:
        print("[enrich] 未找到 outbox 信号文件；请先运行 `python scanner/pipeline.py --fetch`")
        return 1
    summary = enrich(
        path,
        online=True if args.online else None,
        provider=args.provider,
        dry_run=args.dry_run,
        limit=args.limit,
        out_dir=Path(args.out_dir) if args.out_dir else None,
        date=args.date,
        cache_enabled=not args.no_cache,
    )
    if summary.get("error") and not summary.get("candidates"):
        print(f"[enrich] 错误：{summary['error']}")
        return 2
    usage = summary.get("usage") or {}
    print(
        f"[enrich] provider={summary['provider']} mode={summary['mode']} 候选={summary['candidates']} "
        f"跳过={summary['skipped']} llm={summary['llm_used']}/{summary['llm_fallback']} cache={summary['cache_hits']} "
        f"tokens={usage.get('input_tokens')}/{usage.get('output_tokens')} cost=${usage.get('estimated_cost_usd')} "
        f"dry_run={summary['dry_run']}"
    )
    if summary.get("enriched_path"):
        print(
            f"[enrich] → {common.display_path(summary['enriched_path'])}"
            f" / {common.display_path(summary['review_path'])}"
        )
    if summary.get("error"):
        print(f"[enrich] 警告：{summary['error']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
