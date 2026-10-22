"""AI 富化 outbox（v0.4.0）：把 `--fetch` 的原始信号整理成**候选机会草稿**，供人工复核。

铁律：
- 输出只写 `scanner/outbox/`（gitignore），**永不自动写入 `data/opportunities.json`**；
- 所有候选 `needs_human: true`，七问只是草稿（明确标注待人工补充）；
- 默认 **offline-template** 模式（无网络/无 API key 可跑）；
- 可选在线模式：仅当显式 `--online` 且环境变量 `LLM_API_KEY` 存在时调用 OpenAI 兼容
  `/chat/completions`；key 只从环境变量读取、**绝不写入任何文件或日志**；失败自动回退 offline。

用法：
    python scanner/enrich.py                       # offline（默认），读最新 signals-*.json
    python scanner/enrich.py --signals scanner/outbox/signals-2026-10-22.json
    python scanner/enrich.py --dry-run             # 只打印摘要，不写文件
    python scanner/enrich.py --online --limit 5    # 有 LLM_API_KEY 时尝试在线富化
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


# ---------------------------------------------------------------- 在线（OpenAI 兼容）
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


def _cache_path(key: str) -> Path:
    digest = hashlib.sha1(key.encode()).hexdigest()[:16]
    return config.BUILD_DIR / "enrich-cache" / f"{digest}.json"


def _llm_prompt(signal: dict[str, Any], offline: dict[str, Any]) -> list[dict[str, str]]:
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
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def online_candidate(signal: dict[str, Any], offline: dict[str, Any], taxonomy: dict[str, Any]) -> dict[str, Any]:
    """在线富化单条信号；失败抛 RuntimeError（调用方回退 offline）。"""
    settings = _llm_settings()
    cache_key = json.dumps(
        {"url": signal.get("url"), "title": signal.get("title"), "model": settings["model"]},
        ensure_ascii=False,
        sort_keys=True,
    )
    cached = _cache_path(cache_key)
    if cached.exists():
        try:
            payload = common.load_json(cached)
            payload["_mode"] = "llm-cache"
            return payload
        except (json.JSONDecodeError, OSError):
            pass

    body = json.dumps(
        {
            "model": settings["model"],
            "messages": _llm_prompt(signal, offline),
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{settings['base_url']}/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings['api_key']}",  # 仅内存使用，不落盘
        },
        method="POST",
    )
    started = time.time()
    try:
        with urllib.request.urlopen(request, timeout=LLM_TIMEOUT_SEC) as response:
            raw = response.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
        raise RuntimeError(f"LLM 请求失败：{type(exc).__name__}") from exc
    latency_ms = int((time.time() - started) * 1000)
    try:
        data = json.loads(raw)
        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage") or {}
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"LLM 响应不可解析：{type(exc).__name__}") from exc
    content = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("LLM 输出不是严格 JSON") from exc

    industry_valid = _valid_ids(taxonomy, "industries")
    gap_valid = _valid_ids(taxonomy, "gap_types")
    need_valid = _valid_ids(taxonomy, "human_needs")
    candidate = deepcopy(offline)
    candidate["industry_id_candidates"] = [
        item for item in ([parsed.get("industry_id")] if parsed.get("industry_id") else []) + offline["industry_id_candidates"]
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
    candidate["_mode"] = "llm"
    candidate["_llm"] = {
        "model": settings["model"],
        "latency_ms": latency_ms,
        "prompt_tokens_est": int(usage.get("prompt_tokens") or _estimate_tokens(json.dumps(_llm_prompt(signal, offline)))),
        "completion_tokens_est": int(usage.get("completion_tokens") or _estimate_tokens(content)),
    }
    config.BUILD_DIR.joinpath("enrich-cache").mkdir(parents=True, exist_ok=True)
    common.dump_json(cached, {key: candidate[key] for key in candidate if key != "_llm"})
    return candidate


# ---------------------------------------------------------------- 主流程
def enrich(
    signals_path: Path,
    *,
    online: bool = False,
    dry_run: bool = False,
    limit: int | None = None,
    out_dir: Path | None = None,
    date: str | None = None,
) -> dict[str, Any]:
    """生成候选；返回摘要。`dry_run=True` 时不写任何文件。"""
    taxonomy = _taxonomy()
    signals_meta, signals = load_outbox(signals_path)
    as_of = date or date_from_signals(signals_path, signals_meta)
    out_dir = out_dir or config.OUTBOX_DIR
    candidates: list[dict[str, Any]] = []
    skipped = 0
    mode = "offline-template"
    error: str | None = None
    llm_used = 0
    llm_fallback = 0

    selected = signals[:limit] if limit else signals
    for signal in selected:
        offline = offline_candidate(signal, taxonomy)
        if offline is None:
            skipped += 1
            continue
        if online:
            if not llm_available():
                return {
                    "error": "online 模式需要环境变量 LLM_API_KEY；未检测到，已中止（未写任何文件）",
                    "mode": "online-unavailable",
                    "candidates": [],
                    "skipped": skipped,
                }
            try:
                candidate = online_candidate(signal, offline, taxonomy)
                llm_used += 1
                mode = "llm"
            except RuntimeError as exc:
                llm_fallback += 1
                error = str(exc)
                candidate = offline
        else:
            candidate = offline
        candidates.append(candidate)
    if llm_fallback and mode != "llm":
        mode = "offline-template"
    if online and llm_used and mode == "llm":
        mode = "llm"
    if online and llm_used and llm_fallback:
        mode = "llm+fallback"
    skipped += max(0, len(signals) - len(selected))

    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    meta = {
        "data_version": config.DATA_VERSION,
        "generator": "llm" if mode.startswith("llm") else "offline-template",
        "mode": mode,
        "model": _llm_settings()["model"] if online else None,
        "generated_at": generated_at,
        "dry_run": bool(dry_run),
        "as_of": as_of,
        "signals_file": str(signals_path),
        "signal_count": len(signals),
        "candidate_count": len(candidates),
        "skipped": skipped,
        "llm_used": llm_used,
        "llm_fallback": llm_fallback,
        "error": error,
        "key_logged": False,
        "note": "AI 富化草稿仅供人工复核；needs_human=true；永不自动写入 data/opportunities.json",
    }
    payload = {"meta": meta, "candidates": candidates}
    summary = {
        "signals_path": str(signals_path),
        "as_of": as_of,
        "mode": mode,
        "candidates": len(candidates),
        "skipped": skipped,
        "llm_used": llm_used,
        "llm_fallback": llm_fallback,
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
    lines = [
        "# 富化候选人工复核清单（REVIEW.md）",
        "",
        f"- 数据版本：data-v{meta.get('data_version')}　｜　生成模式：`{meta.get('mode')}`　｜　模型：{meta.get('model') or '—'}",
        f"- 生成时间：{meta.get('generated_at')}　｜　信号文件：`{meta.get('signals_file')}`",
        f"- 候选数：{meta.get('candidate_count')}　｜　跳过：{meta.get('skipped')}　｜　LLM 成功/回退：{meta.get('llm_used')}/{meta.get('llm_fallback')}",
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
            "- 不在 `--online` 模式把 API key 写入任何文件（本工具只从环境变量读取）。",
            "",
        ]
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="AI 富化 outbox（默认 offline-template，永不自动入库）")
    parser.add_argument("--signals", type=str, default=None, help="输入 outbox signals-*.json（默认取最新）")
    parser.add_argument("--out-dir", type=str, default=None, help="输出目录（默认 scanner/outbox）")
    parser.add_argument("--date", type=str, default=None, help="输出日期 YYYY-MM-DD（默认取 signals meta.as_of）")
    parser.add_argument("--online", action="store_true", help="尝试 OpenAI 兼容在线富化（需 LLM_API_KEY）")
    parser.add_argument("--limit", type=int, default=None, help="最多处理 N 条信号")
    parser.add_argument("--dry-run", action="store_true", help="只打印摘要，不写文件")
    args = parser.parse_args(argv)

    path = latest_signals_path(args.signals)
    if path is None:
        print("[enrich] 未找到 outbox 信号文件；请先运行 `python scanner/pipeline.py --fetch`")
        return 1
    summary = enrich(
        path,
        online=args.online,
        dry_run=args.dry_run,
        limit=args.limit,
        out_dir=Path(args.out_dir) if args.out_dir else None,
        date=args.date,
    )
    if summary.get("error"):
        print(f"[enrich] 错误：{summary['error']}")
        return 2
    print(
        f"[enrich] mode={summary['mode']} 候选={summary['candidates']} 跳过={summary['skipped']} "
        f"llm={summary['llm_used']}/{summary['llm_fallback']} dry_run={summary['dry_run']}"
    )
    if summary.get("enriched_path"):
        print(f"[enrich] → {Path(summary['enriched_path']).relative_to(config.ROOT)} / {Path(summary['review_path']).relative_to(config.ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
