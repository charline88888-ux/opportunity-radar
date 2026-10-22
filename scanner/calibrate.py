"""实验校准报告（v0.4.0）：读前端导出的实验 JSON，与机会评分 join，生成校准/年度报告。

公式（与 docs/04 §12.9.5 一致，锁定）：
- p = clamp(total / 100, 0.01, 0.99)
- o = outcome == "positive" ? 1 : outcome == "negative" ? 0  （inconclusive 排除）
- Brier = mean((p_i − o_i)²)；基线 0.25（随机猜）；样本 < 3 显示「样本不足」

用法：
    python scanner/calibrate.py --experiments app/experiments-export.json
    python scanner/calibrate.py --experiments scanner/fixtures/experiments-sample.json --sample
输出：data/reports/calibration-<date>.html / .md（自包含 HTML，可打印）
"""
from __future__ import annotations

import argparse
import html
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # 支持 python scanner/calibrate.py 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import common, config  # noqa: E402
else:  # pragma: no cover
    from . import common, config

OUTCOMES = {"positive", "negative", "inconclusive"}
BRIER_MIN_SAMPLE = 3
BASELINE_BRIER = 0.25
GRADES = ["S", "A", "B", "C", "D"]
CLAMP_LOW, CLAMP_HIGH = 0.01, 0.99

HTML_STYLE = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; padding: 32px 20px 60px; font-family: "Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,"Segoe UI",sans-serif;
       background: #f6f7f9; color: #1f2430; line-height: 1.65; font-size: 14px; }
.wrap { max-width: 980px; margin: 0 auto; }
.hero { background: #0f1724; color: #e8edf6; border-radius: 14px; padding: 26px 28px; margin-bottom: 22px; }
.hero h1 { margin: 0 0 6px; font-size: 26px; }
.hero .sub { color: #9fb0c8; font-size: 13px; }
.sample { display: inline-block; margin-top: 10px; background: #7c2d12; color: #ffedd5; border-radius: 999px; padding: 3px 12px; font-size: 12px; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
.kpi { background: #fff; border-radius: 12px; padding: 14px 16px; border: 1px solid #e4e7ec; }
.kpi .k { font-size: 12px; color: #6b7280; }
.kpi .v { font-size: 22px; font-weight: 700; }
.kpi .v.warn { color: #b45309; }
.card { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; }
.card h2 { margin: 0 0 12px; font-size: 17px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 8px 8px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
th { color: #374151; font-weight: 600; background: #f9fafb; }
.formula { background: #0f1724; color: #cfe0f5; border-radius: 8px; padding: 10px 12px; font-family: Consolas, monospace; font-size: 12px; overflow-x: auto; }
.note { color: #6b7280; font-size: 12px; }
ul { margin: 6px 0 0 18px; padding: 0; }
.footer { margin-top: 26px; font-size: 12px; color: #6b7280; border-top: 1px solid #e4e7ec; padding-top: 14px; }
@media print { body { background: #fff; padding: 0; } .hero { border-radius: 0; } }
@media (max-width: 760px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
"""


# ---------------------------------------------------------------- 输入与记录
def load_export(path: Path) -> dict[str, Any]:
    payload = common.load_json(path)
    if isinstance(payload, list):
        return {"schema_version": None, "experiments": payload}
    if not isinstance(payload, dict):
        raise ValueError("实验导出文件必须是对象或数组")
    experiments = payload.get("experiments")
    if not isinstance(experiments, list):
        raise ValueError("实验导出文件缺少 experiments 数组")
    return payload


def load_opportunities() -> dict[str, dict[str, Any]]:
    opportunities = common.load_json(config.OPPORTUNITIES_PATH)
    return {
        opp["id"]: {
            "title": opp.get("title", ""),
            "grade": (opp.get("scores") or {}).get("grade", "?"),
            "total": float((opp.get("scores") or {}).get("total", 0.0)),
            "industry_id": opp.get("industry_id", ""),
        }
        for opp in opportunities
    }


def build_records(export: dict[str, Any], opportunities: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for experiment in export.get("experiments") or []:
        if not isinstance(experiment, dict):
            continue
        opp_id = str(experiment.get("opp_id") or "")
        outcome_raw = str(experiment.get("outcome") or "").lower().strip()
        outcome = outcome_raw if outcome_raw in OUTCOMES else "unknown"
        opp = opportunities.get(opp_id)
        records.append(
            {
                "id": experiment.get("id"),
                "opp_id": opp_id,
                "title": experiment.get("title") or (opp or {}).get("title", ""),
                "status": experiment.get("status"),
                "outcome": outcome,
                "grade": (opp or {}).get("grade", "?"),
                "total": (opp or {}).get("total"),
                "matched": opp is not None,
                "budget_cny": _number(experiment.get("budget_cny")),
                "spend_cny": _number(experiment.get("spend_cny")),
                "hours": _number(experiment.get("hours")),
                "started_at": experiment.get("started_at"),
                "ended_at": experiment.get("ended_at"),
                "conclusion": experiment.get("conclusion"),
            }
        )
    return records


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- 指标
def clamp_p(total: float) -> float:
    """p = clamp(total/100, 0.01, 0.99)（docs/04 §12.9.5）。"""
    return max(CLAMP_LOW, min(CLAMP_HIGH, float(total) / 100.0))


def brier_from_pairs(pairs: list[tuple[float, int]]) -> float | None:
    """Brier = mean((p − o)²)；空样本返回 None。"""
    if not pairs:
        return None
    return sum((p - o) ** 2 for p, o in pairs) / len(pairs)


def compute_brier(records: list[dict[str, Any]]) -> dict[str, Any]:
    pairs: list[tuple[float, int]] = []
    excluded = {"inconclusive": 0, "unknown": 0, "unmatched": 0, "no_total": 0}
    for record in records:
        outcome = record.get("outcome")
        if outcome == "inconclusive":
            excluded["inconclusive"] += 1
            continue
        if outcome not in ("positive", "negative"):
            excluded["unknown"] += 1
            continue
        if not record.get("matched"):
            excluded["unmatched"] += 1
            continue
        total = record.get("total")
        if total is None:
            excluded["no_total"] += 1
            continue
        pairs.append((clamp_p(float(total)), 1 if outcome == "positive" else 0))
    value = brier_from_pairs(pairs)
    return {
        "n": len(pairs),
        "brier": round(value, 4) if value is not None else None,
        "baseline": BASELINE_BRIER,
        "sufficient": len(pairs) >= BRIER_MIN_SAMPLE,
        "excluded": excluded,
    }


def outcome_distribution(records: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"positive": 0, "negative": 0, "inconclusive": 0, "unknown": 0}
    for record in records:
        counts[record["outcome"]] = counts.get(record["outcome"], 0) + 1
    return counts


def status_distribution(records: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for record in records:
        status = str(record.get("status") or "unknown")
        counts[status] = counts.get(status, 0) + 1
    return counts


def grade_stats(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[str, list[dict[str, Any]]] = {grade: [] for grade in GRADES + ["?"]}
    for record in records:
        outcomes = buckets.setdefault(str(record.get("grade") or "?"), [])
        outcomes.append(record)
    rows = []
    for grade in GRADES + ["?"]:
        group = buckets.get(grade) or []
        positive = sum(1 for record in group if record["outcome"] == "positive")
        negative = sum(1 for record in group if record["outcome"] == "negative")
        decided = positive + negative
        rows.append(
            {
                "grade": grade,
                "samples": len(group),
                "positive": positive,
                "negative": negative,
                "success_rate": round(positive / decided, 3) if decided else None,
            }
        )
    return rows


def spend_hours(records: list[dict[str, Any]]) -> dict[str, Any]:
    spend = [record["spend_cny"] for record in records if record.get("spend_cny") is not None]
    hours = [record["hours"] for record in records if record.get("hours") is not None]
    budgets = [record["budget_cny"] for record in records if record.get("budget_cny") is not None]
    return {
        "spend_total": round(sum(spend), 2) if spend else 0.0,
        "spend_avg": round(sum(spend) / len(spend), 2) if spend else None,
        "hours_total": round(sum(hours), 2) if hours else 0.0,
        "hours_avg": round(sum(hours) / len(hours), 2) if hours else None,
        "budget_total": round(sum(budgets), 2) if budgets else 0.0,
        "recorded_spend": len(spend),
        "recorded_hours": len(hours),
    }


def suggestions(brier: dict[str, Any], grades: list[dict[str, Any]], outcomes: dict[str, int]) -> list[str]:
    tips: list[str] = []
    decided = outcomes["positive"] + outcomes["negative"]
    if brier["n"] < BRIER_MIN_SAMPLE:
        tips.append(
            f"有效样本仅 {brier['n']} 条（<{BRIER_MIN_SAMPLE}），Brier 仅供参考；"
            "先完成至少 3 个有明确结论（positive/negative）的实验再校准。"
        )
    elif brier["brier"] is None:
        tips.append("没有可用样本计算 Brier。")
    elif brier["brier"] <= BASELINE_BRIER:
        tips.append(
            f"Brier {brier['brier']} ≤ 基线 {BASELINE_BRIER}：评分方向性有效，可继续按等级分配注意力；"
            "建议对 A 级以上机会保持『先验证后加注』。"
        )
    else:
        tips.append(
            f"Brier {brier['brier']} > 基线 {BASELINE_BRIER}：预测偏差高于随机猜，"
            "可能存在高估；建议回看失败实验的 kill_criteria 是否被绕过、信号证据是否单一来源。"
        )
    high_grades = [row for row in grades if row["grade"] in ("S", "A")]
    high_decided = sum(row["positive"] + row["negative"] for row in high_grades)
    high_positive = sum(row["positive"] for row in high_grades)
    if high_decided >= 3 and high_positive / high_decided < 0.5:
        tips.append("S/A 级机会成功率低于 50%：检查高分是否被『信号强度/信息差』拉高而忽视执行成本与合规风险。")
    low_grades = [row for row in grades if row["grade"] in ("B", "C")]
    low_decided = sum(row["positive"] + row["negative"] for row in low_grades)
    low_positive = sum(row["positive"] for row in low_grades)
    if low_decided >= 3 and low_positive / low_decided >= 0.5:
        tips.append("B/C 级机会成功率高于 50%：当前评分可能低估小机会，建议复核 feasibility/economics 权重与个人资源匹配。")
    if decided < 3:
        tips.append("已决样本仍偏少，结论不稳定；继续按 7 天实验节奏积累样本。")
    if not tips:
        tips.append("样本与校准均正常，按当前策略继续。")
    return tips


# ---------------------------------------------------------------- 渲染
def render_markdown(report: dict[str, Any]) -> str:
    brier = report["brier"]
    lines = [
        f"# 机会雷达 · 实验校准报告（{report['date']}）",
        "",
    ]
    if report.get("sample"):
        lines.append("> ⚠️ **样例数据（sample）**：本报告由演示实验数据生成，用于展示校准流程，不代表真实回测结论。")
        lines.append("")
    lines.extend(
        [
            f"- 数据版本：data-v{report['data_version']}　｜　导出时间：{report.get('exported_at') or '—'}　｜　生成时间：{report['generated_at']}",
            f"- 实验样本：{report['sample_count']} 条（有效 {brier['n']} / 阳性 {report['outcomes']['positive']} / 阴性 {report['outcomes']['negative']} / 不确定 {report['outcomes']['inconclusive']} / 未知 {report['outcomes']['unknown']}）",
            f"- **Brier = {brier['brier'] if brier['brier'] is not None else '样本不足'}**（基线 {BASELINE_BRIER}；{brier['n']} 条有效样本"
            + ("，样本不足 <3" if not brier["sufficient"] else "") + "）",
            f"- 花费合计：{report['spend_hours']['spend_total']} 元（记录 {report['spend_hours']['recorded_spend']} 条）　｜　耗时合计：{report['spend_hours']['hours_total']} 小时",
            "",
            "## 口径",
            "",
            "`p = clamp(total/100, 0.01, 0.99)`；`o = positive→1 / negative→0`；`inconclusive` 排除；`Brier = mean((p−o)²)`。",
            "",
            "## 等级 × 成功率",
            "",
            "| 等级 | 样本 | 阳性 | 阴性 | 成功率 |",
            "|---|---|---|---|---|",
        ]
    )
    for row in report["grades"]:
        rate = f"{row['success_rate']:.1%}" if row["success_rate"] is not None else "—"
        lines.append(f"| {row['grade']} | {row['samples']} | {row['positive']} | {row['negative']} | {rate} |")
    lines.extend(["", "## 实验明细", "", "| 机会 | 等级 | 总分 | 结果 | 花费(元) | 耗时(h) |", "|---|---|---|---|---|---|"])
    for record in report["records"]:
        lines.append(
            f"| {record['title'][:28]}（{record['opp_id']}） | {record['grade']} | {record['total'] if record['total'] is not None else '—'} | "
            f"{record['outcome']} | {record['spend_cny'] if record['spend_cny'] is not None else '—'} | {record['hours'] if record['hours'] is not None else '—'} |"
        )
    lines.extend(["", "## 校准建议", ""])
    lines.extend(f"- {tip}" for tip in report["suggestions"])
    lines.extend(["", "## 免责声明", "", report["disclaimer"], ""])
    return "\n".join(lines)


def render_html(report: dict[str, Any]) -> str:
    escape = html.escape
    brier = report["brier"]
    grade_rows_parts = []
    for row in report["grades"]:
        rate = f"{row['success_rate']:.1%}" if row["success_rate"] is not None else "—"
        grade_rows_parts.append(
            f"<tr><td>{escape(str(row['grade']))}</td><td>{row['samples']}</td><td>{row['positive']}</td>"
            f"<td>{row['negative']}</td><td>{rate}</td></tr>"
        )
    grade_rows = "".join(grade_rows_parts)
    detail_rows = "".join(
        f"<tr><td>{escape(record['title'][:60])}<br><span class='note'>{escape(record['opp_id'])}</span></td>"
        f"<td>{escape(str(record['grade']))}</td><td>{record['total'] if record['total'] is not None else '—'}</td>"
        f"<td>{escape(str(record['outcome']))}</td>"
        f"<td>{record['spend_cny'] if record['spend_cny'] is not None else '—'}</td>"
        f"<td>{record['hours'] if record['hours'] is not None else '—'}</td></tr>"
        for record in report["records"]
    )
    tips = "".join(f"<li>{escape(tip)}</li>" for tip in report["suggestions"])
    brier_text = brier["brier"] if brier["brier"] is not None else "样本不足"
    sample_badge = '<div class="sample">样例数据（sample）· 仅演示校准流程</div>' if report.get("sample") else ""
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>机会雷达 · 实验校准报告 · {escape(report['date'])}</title>
<style>{HTML_STYLE}</style></head>
<body><div class="wrap">
<header class="hero">
  <h1>机会雷达 · 实验校准报告</h1>
  <div class="sub">{escape(report['date'])}　｜　数据版本 data-v{escape(str(report['data_version']))}　｜　导出时间 {escape(str(report.get('exported_at') or '—'))}　｜　生成于 {escape(report['generated_at'])}</div>
  {sample_badge}
</header>
<div class="kpis">
  <div class="kpi"><div class="k">实验样本</div><div class="v">{report['sample_count']}</div></div>
  <div class="kpi"><div class="k">有效样本（Brier）</div><div class="v">{brier['n']}</div></div>
  <div class="kpi"><div class="k">Brier（基线 {BASELINE_BRIER}）</div><div class="v{' warn' if not brier['sufficient'] else ''}">{brier_text}</div></div>
  <div class="kpi"><div class="k">花费合计（元）</div><div class="v">{report['spend_hours']['spend_total']}</div></div>
</div>
<section class="card"><h2>口径（docs/04 §12.9.5）</h2>
  <div class="formula">p = clamp(total / 100, {CLAMP_LOW}, {CLAMP_HIGH})　｜　o = positive→1 / negative→0　｜　Brier = mean((p − o)²)</div>
  <p class="note">inconclusive 与未匹配机会排除；样本数 {brier['n']}，基线 {BASELINE_BRIER}；{'样本不足（&lt;3），Brier 仅供参考' if not brier['sufficient'] else '样本充足'}。
  排除明细：inconclusive {brier['excluded']['inconclusive']} / 未匹配 {brier['excluded']['unmatched']} / 无评分 {brier['excluded']['no_total']}。</p>
</section>
<section class="card"><h2>结果分布</h2>
  <table><tr><th>positive</th><th>negative</th><th>inconclusive</th><th>未知</th></tr>
  <tr><td>{report['outcomes']['positive']}</td><td>{report['outcomes']['negative']}</td><td>{report['outcomes']['inconclusive']}</td><td>{report['outcomes']['unknown']}</td></tr></table>
  <p class="note">状态分布：{escape(json.dumps(report['status'], ensure_ascii=False))}</p>
</section>
<section class="card"><h2>等级 × 成功率</h2>
  <table><tr><th>等级</th><th>样本</th><th>阳性</th><th>阴性</th><th>成功率</th></tr>{grade_rows}</table>
</section>
<section class="card"><h2>实验明细</h2>
  <table><tr><th>机会</th><th>等级</th><th>总分</th><th>结果</th><th>花费(元)</th><th>耗时(h)</th></tr>{detail_rows}</table>
</section>
<section class="card"><h2>校准建议</h2><ul>{tips}</ul></section>
<footer class="footer">
  <p>生成器：<code>scanner/calibrate.py</code>　｜　数据版本 data-v{escape(str(report['data_version']))}　｜　自包含 HTML，可离线打开/打印（Ctrl+P）。</p>
  <p><b>免责声明</b>：{escape(report['disclaimer'])}</p>
</footer>
</div></body></html>
"""


def generate(
    export_path: Path,
    *,
    date: str | None = None,
    out_dir: Path | None = None,
    sample: bool = False,
) -> dict[str, Any]:
    export = load_export(export_path)
    opportunities = load_opportunities()
    records = build_records(export, opportunities)
    exported_at = export.get("exported_at")
    if date is None:
        if isinstance(exported_at, str) and len(exported_at) >= 10:
            date = exported_at[:10]
        else:
            date = common.parse_as_of().isoformat()
    report = {
        "date": date,
        "data_version": config.DATA_VERSION,
        "exported_at": exported_at,
        "generated_at": f"{date}{config.SNAPSHOT_TIME_SUFFIX}",
        "sample": bool(sample),
        "sample_count": len(records),
        "records": records,
        "outcomes": outcome_distribution(records),
        "status": status_distribution(records),
        "grades": grade_stats(records),
        "brier": compute_brier(records),
        "spend_hours": spend_hours(records),
        "disclaimer": "实验校准基于个人小样本实验，不构成投资建议或收入承诺；inconclusive 不计入 Brier。",
        "schema_version": export.get("schema_version"),
        "profile": export.get("profile"),
    }
    report["suggestions"] = suggestions(report["brier"], report["grades"], report["outcomes"])
    output_dir = Path(out_dir).resolve() if out_dir else config.REPORTS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    html_path = output_dir / f"calibration-{date}.html"
    md_path = output_dir / f"calibration-{date}.md"
    html_path.write_text(render_html(report), encoding="utf-8")
    md_path.write_text(render_markdown(report), encoding="utf-8")
    return {
        "html": str(html_path),
        "md": str(md_path),
        "samples": report["sample_count"],
        "brier": report["brier"]["brier"],
        "brier_n": report["brier"]["n"],
        "sufficient": report["brier"]["sufficient"],
        "date": date,
        "sample": bool(sample),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="实验校准报告（Brier 与 docs/04 §12.9.5 一致）")
    parser.add_argument("--experiments", type=str, required=True, help="前端导出的实验 JSON 路径")
    parser.add_argument("--date", type=str, default=None, help="报告日期 YYYY-MM-DD（默认取 exported_at）")
    parser.add_argument("--out-dir", type=str, default=None, help="输出目录（默认 data/reports）")
    parser.add_argument("--sample", action="store_true", help="标记为样例数据（演示用）")
    args = parser.parse_args(argv)

    path = Path(args.experiments)
    if not path.exists():
        print(f"[calibrate] 文件不存在：{path}")
        return 1
    try:
        result = generate(
            path,
            date=args.date,
            out_dir=Path(args.out_dir) if args.out_dir else None,
            sample=args.sample,
        )
    except (ValueError, json.JSONDecodeError) as exc:
        print(f"[calibrate] 导出文件不合法：{exc}")
        return 2
    brier_text = result["brier"] if result["brier"] is not None else "样本不足"
    print(
        f"[calibrate] 样本={result['samples']} 有效={result['brier_n']} Brier={brier_text} "
        f"sufficient={result['sufficient']} sample={result['sample']}"
    )
    print(
        f"[calibrate] → {common.display_path(result['html'])}"
        f" / {common.display_path(result['md'])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
