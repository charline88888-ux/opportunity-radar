"""v1.7.0 原型：可选的 DeepSeek 商机判断分析（不改现有数据/前端/榜单）。

- provider 读取 DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL；
- 无 key 时使用确定性 mock，仅生成 data/analysis-preview.{json,md} 预览；
- 分析不等于门禁：analysis_score 和 single_axis_strong 只做解释/展示，不参与候选过滤；
- 只做读取 candidates.json + 写 analysis-preview 文件，不改任何现有数据。
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CANDIDATES_PATH = DATA_DIR / "candidates.json"
PREVIEW_JSON = DATA_DIR / "analysis-preview.json"
PREVIEW_MD = DATA_DIR / "analysis-preview.md"

DOMINANT_DIMENSIONS = (
    "signal", "gap", "feasibility", "economics", "timing",
    "competition", "risk", "fit", "evidence", "leverage",
)
ANALYSIS_WEIGHTS = {
    "signal": 0.15, "gap": 0.14, "feasibility": 0.12, "economics": 0.13,
    "timing": 0.10, "competition": 0.08, "risk": 0.08, "fit": 0.10, "evidence": 0.10,
}

SCENARIOS = [
    ("single_strong_regulation", "单条强监管信号", "cand-ea70f74fdd9e"),
    ("single_strong_demand", "单条强需求信号", "cand-646c34c53db9"),
    ("single_strong_regulation", "单条强监管信号", "cand-c0e83c6a4535"),
    ("multi_source_weak", "多源但弱/证据不足", "cand-edc7b59ef2e8"),
    ("multi_source_weak", "多源但弱/证据不足", "cand-a3d130e2442d"),
    ("platform_rule", "平台规则变化", "cand-1b44221228a4"),
    ("platform_rule", "平台规则变化", "cand-3a416042984e"),
    ("cost_shock", "成本冲击", "cand-c0f3d99c1b81"),
    ("cost_shock", "成本冲击", "cand-6f60d82b0f04"),
    ("single_weak_info", "单条弱信息", "cand-0de1c0b4ae6e"),
]


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _clean(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _evidence_refs(record: dict[str, Any]) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in record.get("evidence") or []:
        url = _clean(item.get("url"))
        if not url or url in seen:
            continue
        seen.add(url)
        refs.append({
            "title": _clean(item.get("title")),
            "url": url,
            "publisher": _clean(item.get("publisher")),
            "date": _clean(item.get("date")),
        })
    source = record.get("source") or {}
    url = _clean(source.get("url"))
    if url and url not in seen:
        refs.append({
            "title": _clean(record.get("title_zh") or record.get("title")),
            "url": url,
            "publisher": _clean(source.get("name")),
            "date": _clean(source.get("published_at")),
        })
    return refs


def _tokens(record: dict[str, Any]) -> str:
    return " ".join([
        _clean(record.get("title_zh") or record.get("title")),
        _clean(record.get("title_original")),
        _clean((record.get("source") or {}).get("summary")),
        " ".join(_clean(item.get("title")) for item in (record.get("evidence") or [])),
    ])


def _driver(record: dict[str, Any], scenario: str) -> list[str]:
    text = _tokens(record)
    if scenario == "platform_rule":
        return ["timing", "gap"]
    if scenario == "cost_shock":
        return ["economics", "risk"]
    if scenario == "single_weak_info":
        return ["evidence", "risk"]
    if any(word in text for word in ("监管", "合规", "新规", "政策", "regulatory", "compliance", "rule")):
        return ["signal", "timing"]
    if any(word in text for word in ("需求", "缺口", "短缺", "demand", "shortage")):
        return ["signal", "gap"]
    return ["signal", "feasibility"]


def _dims(record: dict[str, Any], scenario: str) -> dict[str, float]:
    relevance = float(record.get("relevance_score") or 0)
    total = float((record.get("scores") or {}).get("total") or 0)
    base = max(4.0, min(10.0, relevance / 10.0))
    dims = {
        "signal": round(base, 1),
        "gap": round(min(10.0, base - 0.5 + (1.0 if scenario in {"platform_rule", "single_strong_demand"} else 0.0)), 1),
        "feasibility": round(min(10.0, 5.0 + total / 30.0), 1),
        "economics": round(min(10.0, 5.0 + total / 25.0 + (0.8 if scenario == "cost_shock" else 0.0)), 1),
        "timing": round(min(10.0, 5.5 + (1.5 if scenario.startswith("single_strong") else 0.3)), 1),
        "competition": round(min(10.0, 4.5 + total / 40.0), 1),
        "risk": round(min(10.0, 5.0 + total / 35.0), 1),
        "fit": round(min(10.0, 5.0 + total / 40.0), 1),
        "evidence": round(min(10.0, 3.0 + 2.0 * len(_evidence_refs(record))), 1),
        "leverage": round(min(10.0, 5.0 + total / 45.0), 1),
    }
    if scenario == "single_weak_info":
        dims["evidence"] = min(dims["evidence"], 4.0)
        dims["signal"] = min(dims["signal"], 6.0)
    if scenario.startswith("single_strong"):
        dims["signal"] = max(dims["signal"], 9.2)
        if scenario == "single_strong_demand":
            dims["gap"] = max(dims["gap"], 9.1)
    return dims


def _analysis_score(dims: dict[str, float]) -> tuple[float, bool]:
    weighted = sum(dims[key] * weight for key, weight in ANALYSIS_WEIGHTS.items())
    max_dim = max(dims.values())
    single_axis_strong = max_dim >= 9.0
    bonus = 6.0 if single_axis_strong else 0.0
    return round(min(100.0, weighted * 10.0 + bonus), 1), single_axis_strong


def mock_analysis(record: dict[str, Any], scenario: str, label: str) -> dict[str, Any]:
    text = _tokens(record)
    title = _clean(record.get("title_zh") or record.get("title"))
    driver = _driver(record, scenario)
    dims = _dims(record, scenario)
    score, strong = _analysis_score(dims)
    refs = _evidence_refs(record)
    platform = scenario == "platform_rule"
    cost = scenario == "cost_shock"
    weak = scenario in {"single_weak_info", "multi_source_weak"}
    strengths = []
    weaknesses = []
    unknowns = []
    if scenario.startswith("single_strong"):
        strengths = ["信号主体/事件明确", "存在可验证的时间窗口或规则变化", "可直接落到具体执行动作"]
    elif platform:
        strengths = ["平台规则变化带来可观察的适配需求", "窗口通常短于一般行业变化"]
    elif cost:
        strengths = ["成本/价格变化有明确传导链", "价差或替代供给可能形成窗口"]
    else:
        strengths = ["有一个可观察的公开信号", "可作为线索继续核验"]
    if weak:
        weaknesses = ["证据链偏薄：当前只有单条公开来源", "缺少独立第二来源或可量化数据"]
        unknowns = ["需求规模是否足够", "本地供给是否已经饱和", "政策/平台规则的执行时间"]
    else:
        weaknesses = ["仍缺少一手交易/价格数据", "区域与渠道细节需要人工补充"]
        unknowns = ["竞品真实报价与交付能力", "首批客户获取成本", "规则执行细则"]
    if cost:
        strengths.append("成本项可拆分，便于测算毛利与回本")
    if platform:
        weaknesses.append("平台规则可能随官方更新快速变化")
    commercial = {
        "value_proposition": f"围绕「{title[:24]}」提供本地化、可复用的解决方案",
        "pricing": "按项目/订阅/服务费组合定价，先小单验证（理论测算）",
        "cost_structure": "合规/渠道/首批样品/运营为主要成本项",
        "channels": "行业社群、平台生态、本地合作方",
        "startup_conditions": "需要明确主体资质、首批客户与本地交付伙伴",
    }
    return {
        "thesis": f"「{title}」的核心是{label}：先抓住可观察变化，再用小成本交付验证商业闭环（分析，不代表收入承诺）。",
        "dominant_driver": driver,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "unknowns": unknowns,
        "causal_chain": [
            f"事实：公开信号显示「{title}」",
            f"变化：{label}正在影响相关主体的成本/合规/供给",
            "受影响主体：目标市场的买家、卖家与服务商",
            f"缺口：{title[:18]}对应的本地化供给尚未被满足",
            "切入点：先做小批量/小范围交付，建立可复用流程",
        ],
        "entry_point": "先以单城市/单平台/单品类做最小闭环，30–90 天形成首批交付样本。",
        "differentiation": "用本地化合规/交付速度与可解释的成本结构，避开同质化价格战。",
        "commercial_structure": commercial,
        "evidence_refs": refs,
        "falsifiers": [
            "若目标市场没有足够付费意愿，需求假设不成立",
            "若监管/平台规则执行时间长期不确定，窗口假设不成立",
            "若头部玩家已锁定渠道且无差异化空间",
            "若首批获客成本高于毛利，单位经济不成立",
        ],
        "confidence": 0.35 if weak else 0.65,
        "analysis_score": score,
        "analysis_dimensions": dims,
        "single_axis_strong": strong,
        "not_a_gate": True,
        "scenario": scenario,
        "scenario_label": label,
    }


class DeepSeekProvider:
    """OpenAI-compatible /chat/completions；无 key 时 is_available=False。"""

    def __init__(self) -> None:
        self.last_usage: dict[str, Any] | None = None
        self.last_latency_seconds: float | None = None
        self.api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
        self.base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
        self.model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    def _prompt(self, record: dict[str, Any], scenario: str, label: str) -> str:
        evidence = _evidence_refs(record)
        return (
            "你是商机分析助手。仅输出 JSON，不要 markdown。分析不等于收录门禁；单项极强也要保留。"
            "字段：thesis, dominant_driver(数组，仅从 信号/信息差/可行性/经济性/时机/竞争/风险/匹配/证据/杠杆 选1-2), strengths(数组), weaknesses(数组), unknowns(数组), "
            "causal_chain(必须恰好 5 项，顺序固定：事实→变化→受影响主体→缺口→切入点；每项一句、不得空、不得合并), entry_point, differentiation, "
            "commercial_structure(对象：value_proposition/pricing/cost_structure/channels/startup_conditions), "
            "evidence_refs(数组，必须只用输入 evidence), falsifiers(数组), confidence(0-1), "
            "analysis_score(0-100), single_axis_strong(布尔), information_value(对象：score 0-10 + dimensions{novelty/specificity/impact/urgency/actionability 各0-10}), key_facts(数组3-6项：{text,type:fact/inference,source_ref:{title,url}}，source_ref 必须来自输入 evidence), evidence_quality(对象：source_count/independence/authority/recency/timeliness/score/note)."
            f"\n场景：{label}\n候选：{json.dumps({'title': record.get('title_zh') or record.get('title'), 'title_original': record.get('title_original'), 'source': record.get('source'), 'evidence': evidence, 'scores': record.get('scores'), 'industry_ids': record.get('industry_ids'), 'region_ids': record.get('region_ids')}, ensure_ascii=False)}"
        )

    def analyze(self, record: dict[str, Any], scenario: str, label: str) -> dict[str, Any] | None:
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": self._prompt(record, scenario, label)}],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            self.base_url + "/chat/completions",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                "User-Agent": "opportunity-radar-v1.7-analysis",
            },
            method="POST",
        )
        started = time.monotonic()
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=45) as response:
                    decoded = json.loads(response.read().decode("utf-8"))
                self.last_latency_seconds = round(time.monotonic() - started, 2)
                self.last_usage = decoded.get("usage")
                content = decoded["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                required = {"thesis", "dominant_driver", "strengths", "weaknesses", "unknowns", "causal_chain",
                            "entry_point", "differentiation", "commercial_structure", "evidence_refs",
                            "falsifiers", "confidence", "analysis_score", "single_axis_strong"}
                if not required.issubset(parsed):
                    return None
                parsed.setdefault("scenario", scenario)
                parsed.setdefault("scenario_label", label)
                parsed.setdefault("not_a_gate", True)
                return parsed
            except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError, OSError):
                if attempt < 2:
                    time.sleep(1.5 * (attempt + 1))
        return None


def select_records(records: list[dict[str, Any]]) -> list[tuple[dict[str, Any], str, str]]:
    by_id = {record.get("candidate_id"): record for record in records}
    selected: list[tuple[dict[str, Any], str, str]] = []
    used: set[str] = set()
    for scenario, label, candidate_id in SCENARIOS:
        record = by_id.get(candidate_id)
        if record and candidate_id not in used:
            selected.append((record, scenario, label))
            used.add(candidate_id)
    for record in records:
        if len(selected) >= 10:
            break
        if record.get("candidate_id") in used:
            continue
        selected.append((record, "single_weak_info", "单条弱信息"))
        used.add(record.get("candidate_id"))
    return selected[:10]


def _ref_label(ref: Any) -> str:
    if isinstance(ref, dict):
        return _clean(ref.get("title") or ref.get("url") or ref.get("publisher") or "")
    return _clean(ref)


def render_markdown(preview: dict[str, Any]) -> str:
    lines = [
        "# v1.7.0 DeepSeek 商机判断分析预览",
        "",
        f"> 生成时间：{preview['meta']['generated_at']} · provider：**{preview['meta']['provider']}** · 数量：{preview['meta']['count']}",
        "> 分析 ≠ 门禁；不参与候选过滤/排序；所有结论均为理论分析，非收入承诺。",
        "",
        f"- 环境变量：`DEEPSEEK_API_KEY`：{'已设置（值不输出）' if preview['meta']['api_key_present'] else '未设置 → mock 模式'}",
        f"- 模型：`{preview['meta']['model']}`；base_url：`{preview['meta']['base_url']}`",
        "",
    ]
    for index, item in enumerate(preview["items"], 1):
        analysis = item["analysis"]
        lines += [
            f"## {index:02d} {item['input']['title']}",
            "",
            f"- 场景：**{analysis.get('scenario_label')}** · analysis_score：**{analysis.get('analysis_score')}** · single_axis_strong：**{analysis.get('single_axis_strong')}** · confidence：{analysis.get('confidence')}",
            f"- 论点：{analysis.get('thesis')}",
            f"- 为什么是商机：{analysis.get('thesis')}",
            f"- 为什么可能不是：{analysis.get('weaknesses') or analysis.get('falsifiers')}",
            f"- 主导驱动：{'、'.join(analysis.get('dominant_driver') or [])}",
            f"- 因果链：{' → '.join(analysis.get('causal_chain') or [])}",
            f"- 切入点：{analysis.get('entry_point')}",
            f"- 差异化：{analysis.get('differentiation')}",
            f"- 强项：{'；'.join(analysis.get('strengths') or [])}",
            f"- 弱项：{'；'.join(analysis.get('weaknesses') or [])}",
            f"- 未知：{'；'.join(analysis.get('unknowns') or [])}",
            f"- 证伪条件：{'；'.join(analysis.get('falsifiers') or [])}",
            f"- 证据：{'; '.join(_ref_label(ref) for ref in analysis.get('evidence_refs') or [])}",
            f"- 商业结构：{json.dumps(analysis.get('commercial_structure'), ensure_ascii=False)}",
            "",
        ]
    return "\n".join(lines)


def rerender_from_json(json_path: Path, md_path: Path) -> int:
    """从已有真实 JSON 重渲染 MD；不调用 API，不改候选/机会库。"""
    preview = json.loads(json_path.read_text(encoding="utf-8"))
    meta = preview.setdefault("meta", {})
    meta.setdefault("usage", None)
    meta.setdefault("latency_seconds", None)
    meta.setdefault("estimated_cost_usd", None)
    meta.setdefault("usage_note", "API 未在 JSON 返回 usage 时记录为 null；真实 provider 下一次会写入 usage/latency/cost。")
    if meta.get("provider") == "deepseek" and meta.get("latency_seconds") is None:
        meta["latency_seconds"] = 64
        meta["latency_seconds_source"] = "lead_reported_approx"
    json_path.write_text(json.dumps(preview, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(preview), encoding="utf-8")
    print(f"rerendered {md_path} from {json_path} (provider={meta.get('provider')})")
    return 0


def main() -> int:
    records = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8")).get("candidates") or []
    provider = DeepSeekProvider()
    use_real = provider.available
    items: list[dict[str, Any]] = []
    failures = 0
    for record, scenario, label in select_records(records):
        analysis: dict[str, Any] | None = None
        if use_real:
            analysis = provider.analyze(record, scenario, label)
            if analysis is None:
                failures += 1
        if analysis is None:
            analysis = mock_analysis(record, scenario, label)
        items.append({
            "candidate_id": record.get("candidate_id"),
            "input": {
                "candidate_id": record.get("candidate_id"),
                "title": record.get("title_zh") or record.get("title"),
                "title_original": record.get("title_original"),
                "source": record.get("source"),
                "industry_ids": record.get("industry_ids"),
                "region_ids": record.get("region_ids"),
                "scores": record.get("scores"),
                "evidence": _evidence_refs(record),
            },
            "analysis": analysis,
        })
    usage_total = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    latency_total = 0.0
    for item in items:
        usage = (item.get("analysis") or {}).get("usage")
        if isinstance(usage, dict):
            for key in usage_total:
                usage_total[key] += int(usage.get(key) or 0)
        latency = (item.get("analysis") or {}).get("latency_seconds")
        if isinstance(latency, (int, float)):
            latency_total += float(latency)
    preview = {
        "meta": {
            "data_version": "1.7.0-preview",
            "generated_at": _now(),
            "provider": "deepseek" if use_real and failures < len(items) else "mock",
            "mode": "deepseek" if use_real else "mock",
            "api_key_present": use_real,
            "model": provider.model,
            "base_url": provider.base_url,
            "count": len(items),
            "failures": failures,
            "usage": usage_total if any(usage_total.values()) else None,
            "latency_seconds": round(latency_total, 2) if latency_total else None,
            "estimated_cost_usd": None,
            "note": "原型预览：只读取 candidates.json；不修改 candidates/opportunities/rankings/前端；分析不等于门禁。",
        },
        "items": items,
    }
    PREVIEW_JSON.write_text(json.dumps(preview, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PREVIEW_MD.write_text(render_markdown(preview), encoding="utf-8")
    print(f"analysis-preview: {len(items)} items -> {PREVIEW_JSON} / {PREVIEW_MD} (provider={preview['meta']['provider']})")
    return 0


if __name__ == "__main__":
    if "--rerender" in sys.argv:
        json_path = PREVIEW_JSON
        md_path = DATA_DIR / "analysis-preview-real.md"
        for index, arg in enumerate(sys.argv):
            if arg == "--json" and index + 1 < len(sys.argv):
                json_path = Path(sys.argv[index + 1])
            if arg == "--md" and index + 1 < len(sys.argv):
                md_path = Path(sys.argv[index + 1])
        raise SystemExit(rerender_from_json(json_path, md_path))
    raise SystemExit(main())
