"""v1.7.0：批量 DeepSeek 商机判断分析（只追加 analysis，不改候选/排序/门禁）。

- 从 HKCU\\Environment 读取 DEEPSEEK_API_KEY/BASE_URL/MODEL 注入当前分析进程（不打印值）；
- 使用 scanner/llm_analysis.DeepSeekProvider；缓存 scanner/build/analysis-cache.json；
- 失败/超时保留旧 analysis；不删除候选、不改其他字段/顺序；
- 结果直接写 data/candidates.json（仅新增 analysis），并写报告到 scanner/build/analysis-batch-report.json。
"""
from __future__ import annotations

import json
import os
import sys
import time
try:
    import winreg  # Windows only
except ImportError:  # pragma: no cover - CI/Linux
    winreg = None  # type: ignore[assignment]
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CANDIDATES_PATH = DATA_DIR / "candidates.json"
CACHE_PATH = ROOT / "scanner" / "build" / "analysis-cache.json"
REPORT_PATH = ROOT / "scanner" / "build" / "analysis-batch-report.json"

sys.path.insert(0, str(ROOT))
from scanner import llm_analysis  # noqa: E402

ALLOWED_FIELDS = {
    "thesis", "dominant_driver", "strengths", "weaknesses", "unknowns", "causal_chain",
    "entry_point", "differentiation", "commercial_structure", "evidence_refs",
    "falsifiers", "confidence", "analysis_score", "single_axis_strong", "scenario", "not_a_gate",
    "information_value", "key_facts", "evidence_quality",
}


def read_hkcu_env() -> dict[str, str]:
    """读取用户级 HKCU\\Environment，不打印值；非 Windows/CI 环境返回空并继续用进程 env。"""
    result: dict[str, str] = {}
    if winreg is None:
        return result
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            for name in ("DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL"):
                try:
                    value, _ = winreg.QueryValueEx(key, name)
                except FileNotFoundError:
                    continue
                if str(value).strip():
                    result[name] = str(value)
    except OSError:
        pass
    return result


ANALYSIS_DIMENSIONS = ["信号", "信息差", "可行性", "经济性", "时机", "竞争", "风险", "匹配", "证据", "杠杆"]


def _canonical_driver(value: Any) -> list[str]:
    items = value if isinstance(value, list) else [value]
    result: list[str] = []
    keyword_map = [
        (("监管", "政策", "规则", "信号", "需求", "增长", "供应", "技术", "市场变化", "事件"), "信号"),
        (("信息差", "套利", "价差", "区域差", "平台规则", "渠道差"), "信息差"),
        (("可行性", "执行", "落地", "交付", "启动"), "可行性"),
        (("经济", "成本", "价格", "毛利", "利润", "投资", "回本"), "经济性"),
        (("时机", "窗口", "时效", "紧迫"), "时机"),
        (("竞争", "壁垒", "对手", "替代"), "竞争"),
        (("风险", "合规", "不确定"), "风险"),
        (("匹配", "适配", "人群"), "匹配"),
        (("证据", "来源", "数据", "验证"), "证据"),
        (("杠杆", "规模", "复用"), "杠杆"),
    ]
    for item in items:
        text = str(item or "")
        label = "信号"
        for keywords, candidate in keyword_map:
            if any(keyword in text for keyword in keywords):
                label = candidate
                break
        if label not in result:
            result.append(label)
        if len(result) >= 2:
            break
    return result or ["信号"]


def _allowed_refs(record: dict[str, Any]) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    for item in record.get("evidence") or []:
        if item.get("url"):
            refs.append({
                "title": str(item.get("title") or ""),
                "url": str(item.get("url")),
                "publisher": str(item.get("publisher") or ""),
                "date": str(item.get("date") or ""),
            })
    source = record.get("source") or {}
    if source.get("url"):
        refs.append({
            "title": str(record.get("title_zh") or record.get("title") or ""),
            "url": str(source.get("url")),
            "publisher": str(source.get("name") or ""),
            "date": str(source.get("published_at") or ""),
        })
    return refs


def _normalize_information_value(raw: Any) -> dict[str, Any]:
    source = raw if isinstance(raw, dict) else {}
    dimensions_raw = source.get("dimensions") if isinstance(source.get("dimensions"), dict) else source
    keys = ("novelty", "specificity", "impact", "urgency", "actionability")
    dimensions = {}
    for key in keys:
        try:
            value = float(dimensions_raw.get(key, source.get(key)))
        except (TypeError, ValueError):
            value = 5.0
        dimensions[key] = round(min(10.0, max(0.0, value)), 1)
    score = round(sum(dimensions.values()) / len(dimensions), 1)
    result = {"score": score, "dimensions": dimensions}
    result.update(dimensions)
    return result


def _normalize_key_facts(raw: Any, refs: list[dict[str, str]], title: str) -> list[dict[str, Any]]:
    facts = []
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or item.get("fact") or "").strip()
            if not text:
                continue
            kind = str(item.get("type") or "fact").strip().lower()
            if kind not in {"fact", "inference"}:
                kind = "inference" if ("推断" in kind or "推断" in text) else "fact"
            source = item.get("source_ref")
            ref_title = ref_url = ""
            if isinstance(source, dict):
                ref_title = str(source.get("title") or "")
                ref_url = str(source.get("url") or "")
            elif isinstance(source, str):
                ref_url = source
            if ref_url and not any(ref_url in ref["url"] for ref in refs):
                ref_url = ""
            if not ref_url and refs:
                ref_url = refs[0]["url"]
                ref_title = ref_title or refs[0]["title"]
            if not ref_title and ref_url:
                ref_title = next((ref["title"] for ref in refs if ref["url"] == ref_url), "")
            facts.append({"text": text, "fact": text, "type": kind, "source_ref": {"title": ref_title, "url": ref_url}})
    if len(facts) < 3:
        for ref in refs[:3]:
            text = ref.get("title") or title
            facts.append({"text": f"{text}（公开信号摘要）", "fact": f"{text}（公开信号摘要）", "type": "fact",
                          "source_ref": {"title": ref.get("title") or "", "url": ref.get("url") or ""}})
    return facts[:6]


def _normalize_evidence_quality(raw: Any, refs: list[dict[str, str]], record: dict[str, Any]) -> dict[str, Any]:
    publishers = {ref.get("publisher") for ref in refs if ref.get("publisher")}
    source_count = len(refs)
    independence = min(10.0, max(1.0, len(publishers) * 2.0)) if publishers else (4.0 if source_count else 1.0)
    authority = 7.0 if source_count else 3.0
    recency = 8.0 if source_count else 5.0
    score = min(100.0, (source_count * 8 + independence * 2 + authority * 3 + recency * 2) * 2.5)
    note = f"公开来源 {source_count} 条，独立发布方 {len(publishers)} 个；理论评分，非人工审计。"
    if isinstance(raw, dict):
        try:
            source_count = int(raw.get("source_count", source_count))
        except (TypeError, ValueError):
            pass
        for key in ("independence", "authority", "recency", "timeliness"):
            try:
                value = float(raw.get(key))
            except (TypeError, ValueError):
                continue
            if key == "independence":
                independence = min(10.0, max(0.0, value))
            elif key == "authority":
                authority = min(10.0, max(0.0, value))
            else:
                recency = min(10.0, max(0.0, value))
        try:
            score = min(100.0, max(0.0, float(raw.get("score"))))
        except (TypeError, ValueError):
            pass
        note = str(raw.get("note") or note)
    return {"source_count": source_count, "independence": round(independence, 1), "authority": round(authority, 1),
            "recency": round(recency, 1), "timeliness": round(recency, 1), "score": round(score, 1), "note": note}


def normalize_analysis(record: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    refs = _allowed_refs(record)
    allowed_urls = {ref["url"] for ref in refs}
    allowed_titles = {ref["title"] for ref in refs if ref["title"]}
    evidence = []
    candidate_refs = raw.get("evidence_refs")
    if isinstance(candidate_refs, list):
        for item in candidate_refs:
            if isinstance(item, dict):
                url = str(item.get("url") or "")
                title = str(item.get("title") or "")
                if url in allowed_urls:
                    evidence.append({"title": title or next((r["title"] for r in refs if r["url"] == url), ""), "url": url,
                                     "publisher": str(item.get("publisher") or ""), "date": str(item.get("date") or "")})
                elif title in allowed_titles:
                    match = next(r for r in refs if r["title"] == title)
                    evidence.append(match)
            elif isinstance(item, str):
                match = next((r for r in refs if item and (item in r["title"] or r["title"] in item)), None)
                if match:
                    evidence.append(match)
    if not evidence:
        evidence = refs[:1]
    if not evidence:
        return None
    def list_of(value: Any) -> list[str]:
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            return [str(item) for item in value if str(item).strip()]
        return []
    try:
        confidence = float(raw.get("confidence"))
        analysis_score = float(raw.get("analysis_score"))
    except (TypeError, ValueError):
        return None
    if not (0 <= confidence <= 1 and 0 <= analysis_score <= 100):
        return None
    commercial = raw.get("commercial_structure")
    if not isinstance(commercial, dict):
        commercial = {}
    result = {
        "thesis": str(raw.get("thesis") or "").strip(),
        "dominant_driver": _canonical_driver(raw.get("dominant_driver")),
        "strengths": list_of(raw.get("strengths")),
        "weaknesses": list_of(raw.get("weaknesses")),
        "unknowns": list_of(raw.get("unknowns")),
        "causal_chain": list_of(raw.get("causal_chain")),
        "entry_point": str(raw.get("entry_point") or "").strip(),
        "differentiation": str(raw.get("differentiation") or "").strip(),
        "commercial_structure": commercial,
        "evidence_refs": evidence,
        "falsifiers": list_of(raw.get("falsifiers")),
        "confidence": round(confidence, 2),
        "analysis_score": round(analysis_score, 1),
        "single_axis_strong": bool(raw.get("single_axis_strong")),
        "scenario": str(raw.get("scenario") or "batch"),
        "not_a_gate": True,
        "information_value": _normalize_information_value(raw.get("information_value")),
        "key_facts": _normalize_key_facts(raw.get("key_facts"), evidence, str(record.get("title_zh") or record.get("title") or "")),
        "evidence_quality": _normalize_evidence_quality(raw.get("evidence_quality"), evidence, record),
    }
    if not all(result[key] for key in ("thesis", "entry_point", "differentiation", "dominant_driver", "causal_chain", "strengths", "weaknesses", "unknowns", "falsifiers")):
        return None
    return {key: value for key, value in result.items() if key in ALLOWED_FIELDS}


def available() -> bool:
    env = read_hkcu_env()
    return bool(env.get("DEEPSEEK_API_KEY") or os.environ.get("DEEPSEEK_API_KEY"))


def main() -> int:
    env = read_hkcu_env()
    for name, value in env.items():
        os.environ[name] = value
    provider = llm_analysis.DeepSeekProvider()
    if not provider.available:
        print("analysis skipped: no DEEPSEEK_API_KEY")
        return 0
    records = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8")).get("candidates") or []
    cache: dict[str, Any] = {}
    if CACHE_PATH.exists():
        try:
            cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            cache = {}
    # 预置已有 10 条真实预览分析（按 candidate_id）
    preview_path = DATA_DIR / "analysis-preview.json"
    if preview_path.exists():
        try:
            preview = json.loads(preview_path.read_text(encoding="utf-8"))
            for item in preview.get("items") or []:
                candidate_id = item.get("candidate_id")
                analysis = item.get("analysis")
                if candidate_id and isinstance(analysis, dict) and candidate_id not in cache:
                    cache[candidate_id] = analysis
        except (OSError, json.JSONDecodeError):
            pass
    results = []
    started = time.monotonic()
    success = 0
    failed = 0
    skipped = 0
    usage_total = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    latency_total = 0.0
    for index, record in enumerate(records, 1):
        candidate_id = str(record.get("candidate_id") or "")
        old_analysis = record.get("analysis") or cache.get(candidate_id)
        if isinstance(old_analysis, dict) and not old_analysis.get("fallback") and all(key in old_analysis for key in ("evidence_refs", "analysis_score", "information_value", "key_facts", "evidence_quality")):
            # 已有真实缓存且结构完整：直接保留（可节省成本）；rule_fallback 仍会被真实 LLM 覆盖
            record["analysis"] = old_analysis
            cache[candidate_id] = old_analysis
            skipped += 1
            results.append({"candidate_id": candidate_id, "status": "cache", "score": old_analysis.get("analysis_score")})
            continue
        analysis_raw = provider.analyze(record, "batch", "全量候选批量分析")
        if analysis_raw is None:
            failed += 1
            if isinstance(old_analysis, dict):
                record["analysis"] = old_analysis
            results.append({"candidate_id": candidate_id, "status": "failed", "error": "provider_failed"})
            continue
        analysis = normalize_analysis(record, analysis_raw)
        if analysis is None:
            failed += 1
            if isinstance(old_analysis, dict):
                record["analysis"] = old_analysis
            results.append({"candidate_id": candidate_id, "status": "invalid", "error": "schema_or_evidence"})
            continue
        usage = provider.last_usage if isinstance(provider.last_usage, dict) else {}
        for key in usage_total:
            usage_total[key] += int(usage.get(key) or 0)
        latency = provider.last_latency_seconds or 0
        latency_total += float(latency)
        analysis["_batch_usage"] = usage
        analysis["_batch_latency_seconds"] = latency
        record["analysis"] = {key: value for key, value in analysis.items() if key in ALLOWED_FIELDS}
        cache[candidate_id] = record["analysis"]
        success += 1
        results.append({"candidate_id": candidate_id, "status": "ok", "score": record["analysis"].get("analysis_score"), "usage": usage, "latency_seconds": latency})
        if index % 10 == 0:
            print(f"analyzed {index}/{len(records)} ok={success} failed={failed} cached={skipped}", flush=True)
    if success == 0 and failed == 0 and skipped == len(records):
        print(f"analysis skipped: all {len(records)} candidates already have v1.8 analysis")
        return 0
    # data_version 1.8.0（仅 meta 版本；不改其他字段）
    payload = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))
    payload["candidates"] = records
    payload.setdefault("meta", {})["data_version"] = "1.8.0"
    payload["meta"]["analysis_meta"] = {
        "provider": "deepseek" if provider.available else "mock",
        "model": provider.model,
        "base_url": provider.base_url,
        "count": len(records),
        "cached": skipped,
        "failed": failed,
        "usage": usage_total if any(usage_total.values()) else None,
        "latency_seconds": round(latency_total, 2) if latency_total else None,
        "wall_seconds": round(time.monotonic() - started, 2),
        "not_a_gate": True,
    }
    CANDIDATES_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {
        "data_version": "1.8.0",
        "generated_at": llm_analysis._now(),
        "provider": "deepseek" if provider.available else "mock",
        "api_key_present": provider.available,
        "model": provider.model,
        "count": len(records),
        "ok": success,
        "failed": failed,
        "cache": skipped,
        "usage": usage_total if any(usage_total.values()) else None,
        "latency_seconds": round(latency_total, 2) if latency_total else None,
        "wall_seconds": round(time.monotonic() - started, 2),
        "estimated_cost_usd": None,
        "cost_note": "以 DeepSeek API 返回 usage 统计 token；成本按实际账单/最新价目表核算，这里不写死价格。",
        "results": results,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"batch done: {len(records)} total, ok={success}, failed={failed}, cache={skipped}; report={REPORT_PATH}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
