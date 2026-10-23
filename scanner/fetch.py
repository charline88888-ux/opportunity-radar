"""真实在线采集（`python scanner/pipeline.py --fetch`）。

默认不联网：只有显式 `--fetch` 才执行，`--all` 永远离线。
- 数据源：`data/sources.json` 中 `access ∈ {rss, api}` 且 `compliance ∈ {green, yellow}` 的在线源；
  红区源（Jumia/Noon/Trustpilot/Fiverr/LinkedIn 等）不抓取。
- 合规：每域限速 ≤1 req/s、6 小时文件缓存、明确 UA、12s 超时、失败重试 2 次；
  不绕过登录/付费墙/验证码。
- 输出：`scanner/outbox/signals-<date>.json`（人工复核，**不自动写入机会库**）+
  `data/source-health.json`（源健康度，供 V20 校验与前端展示）。
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET  # noqa: N817
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

if __package__ in (None, ""):  # 支持 python scanner/pipeline.py --fetch 场景下的导入
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import common, config, dedupe as dedupe_mod, ledger as ledger_mod, normalize, relevance  # noqa: E402
else:  # pragma: no cover
    from . import common, config, dedupe as dedupe_mod, ledger as ledger_mod, normalize, relevance

_TAG_RE = re.compile(r"<[^>]+>")
_ATOM_NS = {"a": "http://www.w3.org/2005/Atom"}
_CONTENT_NS = {"content": "http://purl.org/rss/1.0/modules/content/"}
_XML_INVALID_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_BARE_AMPERSAND = re.compile(r"&(?!(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);)")


def _parse_xml(text: str) -> ET.Element:
    """XML 容错解析（v0.9.2）：先原样解析；失败后清理控制字符/未转义 & 再试一次。"""
    try:
        return ET.fromstring(text)
    except ET.ParseError:
        cleaned = _BARE_AMPERSAND.sub("&amp;", _XML_INVALID_CHARS.sub("", text))
        return ET.fromstring(cleaned)


def _clean(text: str | None, limit: int = 500) -> str:
    if not text:
        return ""
    plain = _TAG_RE.sub(" ", text)
    plain = re.sub(r"\s+", " ", plain).strip()
    return plain[:limit]


def _find_text(node: ET.Element, tag: str) -> str:
    child = node.find(tag)
    return (child.text or "").strip() if child is not None else ""


def _parse_date(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date().isoformat()
    except ValueError:
        pass
    try:
        from email.utils import parsedate_to_datetime

        return parsedate_to_datetime(value).date().isoformat()
    except (TypeError, ValueError):
        return None


def parse_feed(text: str, source_id: str, source_category: str, lang: str = "en") -> list[dict[str, Any]]:
    """解析 RSS 2.0 / Atom / Apple 风格 JSON feed，返回统一 raw 记录（供 normalize 使用）。"""
    if text.lstrip().startswith("{"):
        return _parse_json_feed(text, source_id, source_category, lang=lang)
    root = _parse_xml(text)
    records: list[dict[str, Any]] = []
    now_iso = datetime.now().astimezone().isoformat(timespec="seconds")

    channel = root.find("channel")
    if channel is not None:  # RSS 2.0
        for idx, node in enumerate(channel.findall("item")):
            title = _find_text(node, "title")
            link = _find_text(node, "link")
            description = _clean(_find_text(node, "description"))
            content = node.find("content:encoded", _CONTENT_NS)
            if content is not None and content.text:
                description = description or _clean(content.text)
            records.append(
                {
                    "adapter": "rss-live",
                    "source_id": source_id,
                    "source_category": source_category,
                    "access": "rss",
                    "collected_at": now_iso,
                    "raw_id": f"{source_id}:{idx}",
                    "title": title,
                    "url": link,
                    "published": _parse_date(_find_text(node, "pubDate")),
                    "text": description,
                    "lang": lang,
                    "engagement": {"feed_items": len(channel.findall("item"))},
                    "payload": {"feed_kind": "rss"},
                }
            )
        return records

    entries = root.findall("a:entry", _ATOM_NS)
    atom_ns = "{http://www.w3.org/2005/Atom}"

    def atom_text(node: ET.Element, tag: str) -> str:
        child = node.find(atom_ns + tag)
        return (child.text or "").strip() if child is not None else ""

    for idx, node in enumerate(entries):  # Atom
        title = _clean(atom_text(node, "title"))
        link = ""
        for link_node in node.findall("a:link", _ATOM_NS):
            if link_node.get("rel") in (None, "alternate"):
                link = link_node.get("href", "")
                break
        summary = _clean(atom_text(node, "summary") or atom_text(node, "content"))
        published = atom_text(node, "published") or atom_text(node, "updated")
        records.append(
            {
                "adapter": "rss-live",
                "source_id": source_id,
                "source_category": source_category,
                "access": "rss",
                "collected_at": now_iso,
                "raw_id": f"{source_id}:{idx}",
                "title": title,
                "url": link,
                "published": _parse_date(published),
                "text": summary,
                "lang": lang,
                "engagement": {"feed_items": len(entries)},
                "payload": {"feed_kind": "atom"},
            }
        )
    return records


def _parse_json_feed(
    text: str, source_id: str, source_category: str, lang: str = "en"
) -> list[dict[str, Any]]:
    """兼容 Apple iTunes 的 JSON feed（feed.entry 列表，label/attributes 结构）。"""
    data = json.loads(text)
    feed = data.get("feed") if isinstance(data, dict) else None
    if not isinstance(feed, dict):
        return []
    entries = feed.get("entry") or []
    if isinstance(entries, dict):
        entries = [entries]
    now_iso = datetime.now().astimezone().isoformat(timespec="seconds")
    records: list[dict[str, Any]] = []

    def label(node: Any) -> str:
        if isinstance(node, dict):
            return _clean(str(node.get("label", "")))
        return _clean(str(node or ""))

    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            continue
        link = ""
        link_node = entry.get("link")
        link_candidates = link_node if isinstance(link_node, list) else [link_node]
        for candidate in link_candidates:
            if not isinstance(candidate, dict):
                continue
            attributes = candidate.get("attributes") or {}
            href = str(attributes.get("href", ""))
            if href:
                link = href
                break
        records.append(
            {
                "adapter": "rss-live",
                "source_id": source_id,
                "source_category": source_category,
                "access": "rss",
                "collected_at": now_iso,
                "raw_id": f"{source_id}:{idx}",
                "title": label(entry.get("title")) or label(entry.get("im:name")),
                "url": link,
                "published": _parse_date(label(entry.get("updated")) or label(entry.get("releaseDate"))),
                "text": label(entry.get("content")) or label(entry.get("summary")),
                "lang": lang,
                "engagement": {"feed_items": len(entries)},
                "payload": {"feed_kind": "json"},
            }
        )
    return records


def _cache_path(url: str) -> Path:
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    return config.FETCH_CACHE_DIR / f"{digest}.json"


def _read_cache(url: str) -> dict[str, Any] | None:
    path = _cache_path(url)
    if not path.exists():
        return None
    try:
        payload = common.load_json(path)
    except (json.JSONDecodeError, OSError):
        return None
    try:
        fetched_at = datetime.fromisoformat(payload["fetched_at"])
    except (KeyError, ValueError):
        return None
    if datetime.now().astimezone() - fetched_at > timedelta(seconds=config.FETCH_CACHE_TTL_SEC):
        return None
    return payload


def _write_cache(url: str, payload: dict[str, Any]) -> None:
    config.FETCH_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    common.dump_json(_cache_path(url), payload)


def fetch_url(url: str, *, cache_enabled: bool = True) -> dict[str, Any]:
    """抓取单个 URL（含缓存/重试/UA），返回 {ok,status,latency_ms,text,error,cached}。"""
    if cache_enabled:
        cached = _read_cache(url)
        if cached is not None:
            return {
                "ok": True,
                "status": int(cached.get("status", 200)),
                "latency_ms": 0,
                "text": cached.get("text", ""),
                "error": None,
                "cached": True,
            }

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": config.FETCH_USER_AGENT,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
    )
    last_error: str | None = None
    for attempt in range(1 + config.FETCH_MAX_RETRIES):
        started = time.time()
        try:
            with urllib.request.urlopen(request, timeout=config.FETCH_TIMEOUT_SEC) as response:
                raw = response.read()
                text = raw.decode(response.headers.get_content_charset() or "utf-8", errors="replace")
                latency_ms = int((time.time() - started) * 1000)
                if cache_enabled:
                    _write_cache(
                        url,
                        {
                            "fetched_at": datetime.now().astimezone().isoformat(timespec="seconds"),
                            "status": response.status,
                            "text": text,
                        },
                    )
                return {
                    "ok": True,
                    "status": response.status,
                    "latency_ms": latency_ms,
                    "text": text,
                    "error": None,
                    "cached": False,
                }
        except urllib.error.HTTPError as exc:
            last_error = f"HTTP {exc.code}"
            status = exc.code
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            status = 0
        if attempt < config.FETCH_MAX_RETRIES:
            time.sleep(0.8 * (attempt + 1))
    return {"ok": False, "status": status, "latency_ms": 0, "text": "", "error": last_error, "cached": False}


def select_sources(sources: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    """筛选 enabled 的可自动采集源（RSS/JSON，绿/黄合规），按 priority/value_score 降序取前 limit 个。"""
    candidates: list[dict[str, Any]] = []
    for category in sources.get("categories") or []:
        for source in category.get("sources") or []:
            if source.get("enabled") is False:
                continue
            if source.get("access") not in config.FETCHABLE_ACCESS:
                continue
            if source.get("compliance") not in config.FETCHABLE_COMPLIANCE:
                continue
            url = str(source.get("url", ""))
            if not url.startswith("http"):
                continue
            entry = dict(source)
            entry["category"] = category.get("id")
            candidates.append(entry)
    candidates.sort(
        key=lambda item: (
            -int(item.get("priority") or 0),
            -float(item.get("value_score") or 0),
            item.get("id", ""),
        )
    )
    return candidates[:limit]


def run_fetch(
    as_of: str,
    *,
    limit: int = config.FETCH_DEFAULT_LIMIT,
    cache_enabled: bool = True,
) -> dict[str, Any]:
    """执行一次真实采集：返回 {health, outbox_path, source_health_path, summary}。"""
    sources = common.load_json(config.SOURCES_PATH)
    selected = select_sources(sources, limit)
    health_rows: list[dict[str, Any]] = []
    raw_records: list[dict[str, Any]] = []
    last_request_at: dict[str, float] = {}

    for source in selected:
        url = source["url"]
        domain = urlparse(url).netloc.lower()
        # 同域限速 ≤1 req/s
        elapsed = time.time() - last_request_at.get(domain, 0)
        if elapsed < config.FETCH_MIN_INTERVAL_SEC:
            time.sleep(config.FETCH_MIN_INTERVAL_SEC - elapsed)
        last_request_at[domain] = time.time()

        result = fetch_url(url, cache_enabled=cache_enabled)
        items: list[dict[str, Any]] = []
        parse_error: str | None = None
        if result["ok"]:
            try:
                items = parse_feed(
                    result["text"],
                    source["id"],
                    source.get("category", ""),
                    lang=str(source.get("lang") or "en"),
                )
                items = [item for item in items if item.get("title") and item.get("url")][
                    : config.FETCH_MAX_ITEMS_PER_SOURCE
                ]
            except (ET.ParseError, json.JSONDecodeError) as exc:
                parse_error = f"{type(exc).__name__}: {exc}"
            except Exception as exc:  # noqa: BLE001 - 单源解析失败不得拖垮整次采集
                parse_error = f"{type(exc).__name__}: {exc}"
        normalized_count = 0
        if items:
            for record in items:
                signal = normalize.normalize_record(record, as_of)
                if signal.get("title") and signal.get("url"):
                    raw_records.append({"adapter": "rss-live", "signal": signal})
                    normalized_count += 1
        signals = normalized_count

        ok = bool(result["ok"] and parse_error is None and items)
        mode = "cache" if result["cached"] else "online-fetch"
        http_status = int(result["status"]) if result["status"] else None
        error = parse_error or result["error"]
        if not ok and not error:
            if result["ok"]:
                error = f"返回内容不是可解析的 feed（http_status={result['status']}，有效条目 0 条）"
            else:
                error = "网络请求失败（无响应/连接异常）"
        note = str(source.get("notes", ""))[:120]
        if result["cached"]:
            note = (note + "；缓存命中（latency 记 0）") if note else "缓存命中（latency 记 0）"
        health_rows.append(
            {
                "id": source["id"],
                "name": source.get("name", source["id"]),
                "category": source.get("category", ""),
                "url": url,
                "access": source.get("access"),
                "compliance": source.get("compliance"),
                "ok": ok,
                # v0.3.0 source-health v2
                "mode": mode,
                "http_status": http_status,
                "latency_ms": int(result["latency_ms"]),
                "cached": bool(result["cached"]),
                "items": len(items),
                "signals": signals,
                "checked_at": datetime.now().astimezone().isoformat(timespec="seconds"),
                "error": error,
                # v0.2.0 兼容字段（旧前端仍可读）
                "status": result["status"],
                "note": note,
            }
        )

    normalized_signals = [row["signal"] for row in raw_records]
    deduped, dedupe_report = dedupe_mod.dedupe(normalized_signals)

    # v0.8.0：跨批次持久去重（SQLite 账本）+ 相关性初筛
    ledger = ledger_mod.SignalLedger()
    try:
        ledger_stats = ledger.classify(deduped, as_of)
    finally:
        ledger.close()
    relevance_stats = relevance.analyze(deduped)

    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    config.OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    outbox_path = config.OUTBOX_DIR / f"signals-{as_of}.json"
    common.dump_json(
        outbox_path,
        {
            "meta": {
                "data_version": config.DATA_VERSION,
                "as_of": as_of,
                "generated_at": generated_at,
                "generator": "scanner/fetch.py",
                "mode": "online-fetch",
                "source_count": len(selected),
                "raw_count": len(normalized_signals),
                "signal_count": len(deduped),
                "new_count": ledger_stats["new_count"],
                "seen_count": ledger_stats["seen_count"],
                "ledger_total": ledger_stats["ledger_total"],
                "relevant_count": relevance_stats["relevant_count"],
                "tiers": relevance_stats["tiers"],
                "top_relevant": relevance_stats["top_relevant"],
                "dedupe_report": dedupe_report,
                "ledger_path": "scanner/build/signal-ledger.sqlite",
                "note": (
                    "真实在线采集结果，仅供人工复核；不会自动写入 data/opportunities.json。"
                    "is_new=true 为账本中未出现过的新信号；relevance 仅为线索排序（business/maybe/off-topic）。"
                ),
            },
            "signals": [
                dict(signal, review={"status": "pending", "note": "人工复核后再决定是否入库"})
                for signal in deduped
            ],
        },
    )

    ok_count = sum(1 for row in health_rows if row["ok"])
    if not health_rows:
        overall_mode = "offline"
    elif all(row["mode"] == "cache" for row in health_rows):
        overall_mode = "cache"
    else:
        overall_mode = "online-fetch"
    health_payload = {
        "meta": {
            "data_version": config.DATA_VERSION,
            "as_of": as_of,
            "generated_at": generated_at,
            "generator": "scanner/fetch.py",
            "count": len(health_rows),
            "ok_count": ok_count,
            "failed_count": len(health_rows) - ok_count,
            "mode": overall_mode,
            "cached_count": sum(1 for row in health_rows if row["cached"]),
            "online_count": sum(1 for row in health_rows if row["mode"] == "online-fetch"),
            "note": "source-health v2：mode/http_status/latency_ms/cached/items/error；缓存命中 latency 记 0",
        },
        "sources": health_rows,
    }
    common.dump_json(config.SOURCE_HEALTH_PATH, health_payload)
    return {
        "health": health_rows,
        "outbox_path": str(outbox_path),
        "source_health_path": str(config.SOURCE_HEALTH_PATH),
        "ok_count": ok_count,
        "failed_count": len(health_rows) - ok_count,
        "signal_count": len(deduped),
        "raw_count": len(normalized_signals),
        "new_count": ledger_stats["new_count"],
        "seen_count": ledger_stats["seen_count"],
        "ledger_total": ledger_stats["ledger_total"],
        "relevant_count": relevance_stats["relevant_count"],
        "tiers": relevance_stats["tiers"],
    }


def ensure_outbox_ignore() -> None:
    config.OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    ignore = config.OUTBOX_DIR / ".gitignore"
    if not ignore.exists():
        ignore.write_text("# 在线采集 outbox 仅供人工复核，不入库\n*\n", encoding="utf-8")
