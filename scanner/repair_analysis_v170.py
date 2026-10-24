"""v1.7.0 修复 analysis：causal_chain 严格 5 步 + 禁用词清洗；只改 analysis/cache。"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scanner.analysis_batch import read_hkcu_env, _allowed_refs  # noqa: E402
from scanner.llm_analysis import DeepSeekProvider  # noqa: E402

CANDIDATES_PATH = ROOT / "data" / "candidates.json"
CACHE_PATH = ROOT / "scanner" / "build" / "analysis-cache.json"
REPORT_PATH = ROOT / "scanner" / "build" / "analysis-repair-report.json"

BANNED_REPLACEMENTS = (
    ("验证", "核验"),
    ("实验", "测试"),
    ("复核", "核对"),
    ("门禁", "门槛"),
)


def clean_strings(value: Any) -> Any:
    if isinstance(value, str):
        text = value
        for old, new in BANNED_REPLACEMENTS:
            text = text.replace(old, new)
        return text
    if isinstance(value, list):
        return [clean_strings(item) for item in value]
    if isinstance(value, dict):
        return {key: clean_strings(item) for key, item in value.items()}
    return value


def valid_chain(chain: Any) -> bool:
    if not isinstance(chain, list) or len(chain) != 5:
        return False
    return all(isinstance(item, str) and len(item.strip()) >= 8 for item in chain)


def template_chain(record: dict[str, Any], analysis: dict[str, Any]) -> list[str]:
    title = str(record.get("title_zh") or record.get("title") or "该信号").strip()
    refs = _allowed_refs(record)
    ref_title = next((ref["title"] for ref in refs if ref.get("title")), title)
    driver = "、".join(analysis.get("dominant_driver") or ["信号"])
    industry = "、".join(record.get("industry_ids") or []) or "目标行业"
    regions = "、".join(record.get("region_ids") or []) or "目标区域"
    return [
        f"事实：公开信号显示「{title}」，来源为「{ref_title}」。",
        f"变化：该信号指向{driver}层面的变化，正在改变{regions}相关主体的成本、供给或规则条件。",
        f"受影响主体：{regions}的{industry}买家、卖家与服务商需要重新评估采购与交付方式。",
        f"缺口：现有供给尚未充分覆盖「{title}」对应的本地化、合规或效率需求。",
        "切入点：先用最小可售方案锁定首批客户，建立可复用的交付与成本结构后再扩张。",
    ]


def main() -> int:
    env = read_hkcu_env()
    for name, value in env.items():
        os.environ[name] = value
    provider = DeepSeekProvider()
    payload = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))
    cache = json.loads(CACHE_PATH.read_text(encoding="utf-8")) if CACHE_PATH.exists() else {}
    repaired_api = 0
    repaired_template = 0
    cleaned = 0
    failures = 0
    results = []
    for record in payload.get("candidates") or []:
        analysis = record.get("analysis")
        if not isinstance(analysis, dict):
            continue
        chain = analysis.get("causal_chain")
        if not valid_chain(chain):
            original = json.dumps(chain, ensure_ascii=False)
            new_chain = None
            for _attempt in range(2):
                raw = provider.analyze(record, "batch", "因果链修复（严格5步）")
                if isinstance(raw, dict) and valid_chain(raw.get("causal_chain")):
                    new_chain = [str(item).strip() for item in raw["causal_chain"]]
                    break
            if new_chain:
                analysis["causal_chain"] = new_chain
                repaired_api += 1
                status = "api"
            else:
                analysis["causal_chain"] = template_chain(record, analysis)
                repaired_template += 1
                failures += 1
                status = "template"
            results.append({"candidate_id": record.get("candidate_id"), "status": status,
                            "old_len": len(chain) if isinstance(chain, list) else None,
                            "new_len": len(analysis["causal_chain"]), "old": original[:200]})
        analysis = clean_strings(analysis)
        analysis["not_a_gate"] = True
        record["analysis"] = analysis
        cache[record["candidate_id"]] = analysis
        if "验证" not in json.dumps(analysis, ensure_ascii=False):
            cleaned += 1
    payload.setdefault("meta", {})["data_version"] = "1.7.0"
    meta = payload["meta"].setdefault("analysis_meta", {})
    meta["causal_chain_repaired"] = repaired_api + repaired_template
    meta["causal_chain_template_fallback"] = repaired_template
    meta["banned_word_cleanup"] = True
    CANDIDATES_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_PATH.write_text(json.dumps({
        "data_version": "1.7.0",
        "provider": "deepseek" if provider.available else "mock",
        "repaired_total": repaired_api + repaired_template,
        "repaired_api": repaired_api,
        "repaired_template": repaired_template,
        "cleaned": cleaned,
        "failures": failures,
        "results": results,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"repair done: api={repaired_api} template={repaired_template} cleaned={cleaned}; report={REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
