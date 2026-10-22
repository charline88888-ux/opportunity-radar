"""年度年鉴（v0.5.0）：把年度榜单、分布、月度时间线与实验校准汇总成一份自包含报告。

用法：
    python scanner/yearbook.py --year 2026
    python scanner/yearbook.py --year 2026 --experiments scanner/fixtures/experiments-sample.json --sample

输出：data/reports/yearbook-<year>.html + .md
- HTML 自包含（内联 CSS，可离线打开/打印），`generated_at` 用 as_of 固定值保证确定性；
- 实验摘要复用 `scanner/calibrate.py` 的 Brier/花费口径（docs/04 §12.9.5）；
- 规则化「年度 3 个方向建议」基于数据生成，明确标注「规则生成，非投资建议」。
"""
from __future__ import annotations

import argparse
import html
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # 支持 python scanner/yearbook.py 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import calibrate, common, config, stats  # noqa: E402
else:  # pragma: no cover
    from . import calibrate, common, config, stats

MONTH_LABELS = [f"{month} 月" for month in range(1, 13)]
STATUS_LABELS = {"open": "开放", "peak": "高峰", "closing": "收尾", "closed": "关闭"}
GRADE_ORDER = ["S", "A", "B", "C", "D"]

HTML_STYLE = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; padding: 32px 20px 60px; font-family: "Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,"Segoe UI",sans-serif;
       background: #f6f7f9; color: #1f2430; line-height: 1.65; font-size: 14px; }
.wrap { max-width: 1040px; margin: 0 auto; }
.hero { background: #0f1724; color: #e8edf6; border-radius: 14px; padding: 28px 30px; margin-bottom: 22px; }
.hero h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: .5px; }
.hero .sub { color: #9fb0c8; font-size: 13px; }
.hero .chips { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
.chip { background: #1c2a3f; border: 1px solid #2c3e59; color: #cfe0f5; border-radius: 999px; padding: 3px 11px; font-size: 12px; }
.chip.warn { background: #3a1f1f; border-color: #6b3030; color: #ffd9cf; }
.sample { display: inline-block; margin-top: 10px; background: #7c2d12; color: #ffedd5; border-radius: 999px; padding: 3px 12px; font-size: 12px; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
.kpi { background: #fff; border-radius: 12px; padding: 14px 16px; border: 1px solid #e4e7ec; }
.kpi .k { font-size: 12px; color: #6b7280; }
.kpi .v { font-size: 22px; font-weight: 700; }
.card { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; page-break-inside: avoid; }
.card h2 { margin: 0 0 12px; font-size: 18px; }
.card h3 { margin: 16px 0 8px; font-size: 14px; color: #334155; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
th { color: #374151; font-weight: 600; background: #f9fafb; }
.muted { color: #6b7280; font-size: 12px; }
.barrow { display: flex; align-items: center; gap: 8px; margin: 3px 0; font-size: 12px; }
.barrow .lab { width: 84px; color: #4b5563; }
.barrow .bar { height: 10px; background: #1d4ed8; border-radius: 3px; }
.barrow .num { color: #111827; }
.empty { color: #6b7280; padding: 10px 0; }
ul.tips { margin: 6px 0 0 18px; padding: 0; }
ul.tips li { margin: 6px 0; }
.footer { margin-top: 26px; font-size: 12px; color: #6b7280; border-top: 1px solid #e4e7ec; padding-top: 14px; }
@media print { body { background: #fff; padding: 0; } .hero { border-radius: 0; } }
@media (max-width: 760px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
"""


# ---------------------------------------------------------------- 数据装载
def load_inputs(year: int) -> dict[str, Any]:
    taxonomy = common.load_json(config.TAXONOMY_PATH)
    opportunities = common.load_json(config.OPPORTUNITIES_PATH)
    rankings = common.load_json(config.RANKINGS_PATH)
    as_of = common.parse_as_of(taxonomy)
    in_year = [
        opp for opp in opportunities if str(opp.get("last_activity", "")).startswith(f"{year}-")
    ]
    return {
        "taxonomy": taxonomy,
        "opportunities": opportunities,
        "rankings": rankings,
        "as_of": as_of,
        "in_year": in_year,
    }


def _names(taxonomy: dict[str, Any], collection: str) -> dict[str, str]:
    return {item["id"]: item.get("name", item["id"]) for item in taxonomy.get(collection, [])}


# ---------------------------------------------------------------- 各区块
def top_rankings(year: int, inputs: dict[str, Any]) -> list[dict[str, Any]]:
    rankings = inputs["rankings"]
    window_year = str((rankings.get("meta") or {}).get("as_of", ""))[:4]
    opp_map = {opp["id"]: opp for opp in inputs["in_year"]}
    names_ind = _names(inputs["taxonomy"], "industries")
    names_reg = _names(inputs["taxonomy"], "regions")
    rows: list[dict[str, Any]] = []
    if window_year == str(year):
        for item in (rankings["windows"]["year"]["items"] or [])[:20]:
            opp = opp_map.get(item["opp_id"])
            if not opp:
                continue
            rows.append(_ranking_row(item, opp, names_ind, names_reg))
    else:  # 非当前年度：按总分降序自行排
        ordered = sorted(inputs["in_year"], key=lambda opp: (-opp["scores"]["total"], opp["id"]))
        for idx, opp in enumerate(ordered[:20], start=1):
            item = {"rank": idx, "opp_id": opp["id"], "rank_score": opp.get("rank_score"), "total": opp["scores"]["total"], "delta": None, "change": "new"}
            rows.append(_ranking_row(item, opp, names_ind, names_reg))
    return rows


def _ranking_row(item: dict[str, Any], opp: dict[str, Any], names_ind: dict[str, str], names_reg: dict[str, str]) -> dict[str, Any]:
    window = opp.get("window") or {}
    return {
        "rank": item.get("rank"),
        "opp_id": opp["id"],
        "title": opp.get("title", ""),
        "one_liner": opp.get("one_liner", ""),
        "grade": opp["scores"]["grade"],
        "total": item.get("total", opp["scores"]["total"]),
        "rank_score": item.get("rank_score", opp.get("rank_score")),
        "industry": names_ind.get(opp.get("industry_id"), opp.get("industry_id", "")),
        "regions": [names_reg.get(region, region) for region in opp.get("region_ids", [])],
        "status": window.get("status"),
        "months_left": window.get("months_left"),
    }


def monthly_timeline(year: int, inputs: dict[str, Any]) -> list[dict[str, Any]]:
    names_ind = _names(inputs["taxonomy"], "industries")
    names_gap = _names(inputs["taxonomy"], "gap_types")
    rows: list[dict[str, Any]] = []
    for month in range(1, 13):
        prefix = f"{year}-{month:02d}"
        active = [
            opp
            for opp in inputs["in_year"]
            if any(str(day).startswith(prefix) for day in (opp.get("activity_dates") or []))
        ]
        new = [opp for opp in inputs["in_year"] if str(opp.get("first_seen", "")).startswith(prefix)]
        industry_counts: dict[str, int] = {}
        gap_counts: dict[str, int] = {}
        for opp in active:
            industry = opp.get("industry_id")
            industry_counts[industry] = industry_counts.get(industry, 0) + 1
            for gap in opp.get("gap_type_ids") or []:
                gap_counts[gap] = gap_counts.get(gap, 0) + 1
        top_industries = sorted(industry_counts.items(), key=lambda item: (-item[1], item[0]))[:2]
        top_gaps = sorted(gap_counts.items(), key=lambda item: (-item[1], item[0]))[:2]
        rows.append(
            {
                "month": month,
                "label": MONTH_LABELS[month - 1],
                "active": len(active),
                "new": len(new),
                "themes": {
                    "industries": [{"id": key, "name": names_ind.get(key, key), "count": count} for key, count in top_industries],
                    "gaps": [{"id": key, "name": names_gap.get(key, key), "count": count} for key, count in top_gaps],
                },
            }
        )
    return rows


def distributions(year: int, inputs: dict[str, Any]) -> dict[str, Any]:
    taxonomy = inputs["taxonomy"]
    if not inputs["in_year"]:
        return {
            "by_industry": [], "by_region": [], "by_gap_type": [], "by_grade": {}, "window_status": {},
            "score_histogram": [0] * 10, "score_histogram_ranges": [],
        }
    built = stats.build_stats(inputs["in_year"], taxonomy, inputs["as_of"])
    status_counts: dict[str, int] = {"open": 0, "peak": 0, "closing": 0, "closed": 0}
    for opp in inputs["in_year"]:
        status = (opp.get("window") or {}).get("status") or "open"
        status_counts[status] = status_counts.get(status, 0) + 1
    return {
        "by_industry": built["by_industry"],
        "by_region": built["by_region"],
        "by_gap_type": built["by_gap_type"],
        "by_grade": built["by_grade"],
        "window_status": status_counts,
        "score_histogram": built["score_histogram"],
        "score_histogram_ranges": built["score_histogram_ranges"],
    }


def a_grade_list(inputs: dict[str, Any]) -> list[dict[str, Any]]:
    names_ind = _names(inputs["taxonomy"], "industries")
    names_reg = _names(inputs["taxonomy"], "regions")
    rows = [opp for opp in inputs["in_year"] if opp["scores"]["grade"] in ("S", "A")]
    rows.sort(key=lambda opp: (-opp["scores"]["total"], opp["id"]))
    return [
        {
            "opp_id": opp["id"],
            "title": opp.get("title", ""),
            "grade": opp["scores"]["grade"],
            "total": opp["scores"]["total"],
            "rank_score": opp.get("rank_score"),
            "industry": names_ind.get(opp.get("industry_id"), opp.get("industry_id", "")),
            "regions": [names_reg.get(region, region) for region in opp.get("region_ids", [])],
        }
        for opp in rows
    ]


def closing_opportunities(inputs: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for opp in inputs["in_year"]:
        window = opp.get("window") or {}
        months_left = window.get("months_left")
        status = window.get("status")
        if status in ("closing", "closed") or (isinstance(months_left, int) and months_left <= 3):
            rows.append(
                {
                    "opp_id": opp["id"],
                    "title": opp.get("title", ""),
                    "grade": opp["scores"]["grade"],
                    "status": status,
                    "months_left": months_left,
                    "decay": window.get("decay"),
                }
            )
    rows.sort(key=lambda row: (row.get("months_left") if isinstance(row.get("months_left"), int) else 99, row["opp_id"]))
    return rows


def experiment_summary(experiments_path: Path | None, sample: bool) -> dict[str, Any] | None:
    if experiments_path is None:
        return None
    try:
        export = calibrate.load_export(experiments_path)
        records = calibrate.build_records(export, calibrate.load_opportunities())
        brier = calibrate.compute_brier(records)
        outcomes = calibrate.outcome_distribution(records)
        decided = outcomes["positive"] + outcomes["negative"]
        return {
            "path": str(experiments_path),
            "sample": bool(sample),
            "samples": len(records),
            "outcomes": outcomes,
            "success_rate": round(outcomes["positive"] / decided, 3) if decided else None,
            "brier": brier,
            "spend_hours": calibrate.spend_hours(records),
            "error": None,
        }
    except Exception as exc:  # noqa: BLE001 - 年鉴不得因实验文件非法而失败
        return {"path": str(experiments_path), "sample": bool(sample), "error": f"{type(exc).__name__}: {exc}"}


def annual_suggestions(inputs: dict[str, Any], distributions_data: dict[str, Any], experiments: dict[str, Any] | None) -> list[str]:
    """规则化生成 3 条年度方向建议（非投资建议）。"""
    taxonomy = inputs["taxonomy"]
    names_gap = _names(taxonomy, "gap_types")
    names_ind = _names(taxonomy, "industries")
    a_list = a_grade_list(inputs)
    gap_counts: dict[str, int] = {}
    industry_counts: dict[str, int] = {}
    for opp in inputs["in_year"]:
        if opp["scores"]["grade"] not in ("S", "A"):
            continue
        industry_counts[opp.get("industry_id")] = industry_counts.get(opp.get("industry_id"), 0) + 1
        for gap in opp.get("gap_type_ids") or []:
            gap_counts[gap] = gap_counts.get(gap, 0) + 1
    suggestions: list[str] = []

    if gap_counts:
        top_gap, top_gap_count = sorted(gap_counts.items(), key=lambda item: (-item[1], item[0]))[0]
        suggestions.append(
            f"信息差聚焦：A 级机会最集中在「{names_gap.get(top_gap, top_gap)}」（{top_gap_count} 条）。"
            "下一年优先在这一类信息差里找可复制的验证动作，而不是追新品类。"
        )
    elif industry_counts:
        top_ind = sorted(industry_counts.items(), key=lambda item: (-item[1], item[0]))[0][0]
        suggestions.append(f"行业聚焦：A 级机会最集中在「{names_ind.get(top_ind, top_ind)}」，优先在该行业做深度而非广度。")
    else:
        suggestions.append("本年度尚无 A 级机会，建议先把 C/B 级机会按 kill_criteria 做一轮淘汰，再集中验证少量假设。")

    closing = closing_opportunities(inputs)
    if closing:
        suggestions.append(
            f"窗口管理：有 {len(closing)} 条机会窗口剩余 ≤3 个月或已收尾（最近：{closing[0]['title'][:24]}），"
            "先执行 first_steps_7d 或按 kill_criteria 止损，避免在衰退窗口重注。"
        )
    else:
        suggestions.append("窗口管理：本年度没有 ≤3 个月的收尾窗口，可按正常节奏推进 7 天验证，不必抢跑。")

    if experiments and not experiments.get("error"):
        brier = experiments.get("brier") or {}
        success_rate = experiments.get("success_rate")
        if brier.get("sufficient") and brier.get("brier") is not None:
            if brier["brier"] <= calibrate.BASELINE_BRIER:
                suggestions.append(
                    f"校准反馈：实验 Brier {brier['brier']} ≤ 基线 {calibrate.BASELINE_BRIER}，评分方向性有效；"
                    f"成功率 {success_rate:.0%}，下一年可适度提高 A 级机会的验证预算。"
                    if isinstance(success_rate, float)
                    else f"校准反馈：实验 Brier {brier['brier']} ≤ 基线 {calibrate.BASELINE_BRIER}，评分方向性有效，可适度提高验证预算。"
                )
            else:
                suggestions.append(
                    f"校准反馈：实验 Brier {brier['brier']} > 基线 {calibrate.BASELINE_BRIER}，评分存在高估倾向；"
                    "下一年先把证据三角验证做扎实，再谈加注。"
                )
        else:
            suggestions.append("校准反馈：实验样本不足（<3 条已决实验），下一年先完成至少 3 个 7 天实验再调权重。")
    else:
        suggestions.append("校准反馈：本年度没有可用实验记录，建议从 A 级清单里挑 3 条各跑一次 7 天验证，积累校准样本。")

    return suggestions[:3]


# ---------------------------------------------------------------- 渲染
def build_report(year: int, experiments_path: Path | None = None, sample: bool = False) -> dict[str, Any]:
    inputs = load_inputs(year)
    as_of = inputs["as_of"]
    distributions_data = distributions(year, inputs)
    experiments = experiment_summary(experiments_path, sample)
    report = {
        "year": year,
        "data_version": config.DATA_VERSION,
        "as_of": as_of.isoformat(),
        "generated_at": f"{as_of.isoformat()}{config.SNAPSHOT_TIME_SUFFIX}",
        "sample": bool(sample),
        "counts": {
            "opportunities": len(inputs["in_year"]),
            "top20": len(top_rankings(year, inputs)),
            "a_grade": len(a_grade_list(inputs)),
            "closing": len(closing_opportunities(inputs)),
        },
        "top20": top_rankings(year, inputs),
        "timeline": monthly_timeline(year, inputs),
        "distributions": distributions_data,
        "a_grade": a_grade_list(inputs),
        "closing": closing_opportunities(inputs),
        "experiments": experiments,
        "disclaimer": "年度年鉴为公开信息整理与规则化统计，不构成投资建议、法律意见或收入承诺。",
    }
    report["suggestions"] = annual_suggestions(inputs, distributions_data, experiments)
    return report


def _bar_rows(rows: list[dict[str, Any]], label_key: str, count_key: str = "count") -> str:
    if not rows:
        return '<div class="empty">暂无数据</div>'
    peak = max((row.get(count_key) or 0) for row in rows) or 1
    parts = []
    for row in rows:
        count = row.get(count_key) or 0
        width = max(2, round(count / peak * 220))
        parts.append(
            f'<div class="barrow"><span class="lab">{html.escape(str(row.get(label_key, "")))}</span>'
            f'<span class="bar" style="width:{width}px"></span><span class="num">{count}</span></div>'
        )
    return "".join(parts)


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        f"# 机会雷达 · {report['year']} 年度年鉴",
        "",
    ]
    if report.get("sample"):
        lines.extend(["> ⚠️ **样例数据（sample）**：实验摘要来自演示数据，仅展示年鉴流程。", ""])
    lines.extend(
        [
            f"- 数据版本：data-v{report['data_version']}　｜　数据基准日：{report['as_of']}　｜　生成时间：{report['generated_at']}",
            f"- 本年机会：{report['counts']['opportunities']} 条　｜　A 级及以上：{report['counts']['a_grade']} 条　｜　窗口收尾/≤3 月：{report['counts']['closing']} 条",
            "",
            "## 年榜 Top20",
            "",
            "| 名次 | 机会 | 等级 | 总分 | 行业 | 区域 | 窗口 |",
            "|---|---|---|---|---|---|---|",
        ]
    )
    for row in report["top20"]:
        lines.append(
            f"| {row['rank']} | {row['title']}（{row['opp_id']}） | {row['grade']} | {row['total']} | "
            f"{row['industry']} | {'、'.join(row['regions'])} | {STATUS_LABELS.get(row['status'], row['status'])}/{row['months_left']}月 |"
        )
    if not report["top20"]:
        lines.append("| — | 本年度暂无机会 | — | — | — | — | — |")
    lines.extend(["", "## 月度时间线", "", "| 月份 | 活跃机会 | 新机会 | 主题（行业 / 信息差） |", "|---|---|---|---|"])
    for row in report["timeline"]:
        industries = "、".join(item["name"] for item in row["themes"]["industries"]) or "—"
        gaps = "、".join(item["name"] for item in row["themes"]["gaps"]) or "—"
        lines.append(f"| {row['label']} | {row['active']} | {row['new']} | {industries} / {gaps} |")
    lines.extend(["", "## 分布", "", "### 行业", ""])
    for row in report["distributions"]["by_industry"]:
        lines.append(f"- {row['name']}：{row['count']} 条（均分 {row['avg_total']}）")
    lines.extend(["", "### 区域", ""])
    for row in report["distributions"]["by_region"]:
        lines.append(f"- {row['name']}：{row['count']} 条（均分 {row['avg_total']}）")
    lines.extend(["", "### 信息差", ""])
    for row in report["distributions"]["by_gap_type"]:
        lines.append(f"- {row['name']}：{row['count']} 条（均分 {row['avg_total']}）")
    lines.extend(
        [
            "",
            "### 等级 / 窗口状态",
            "",
            "- 等级：" + " / ".join(f"{grade} {count}" for grade, count in report["distributions"]["by_grade"].items()),
            "- 窗口：" + " / ".join(f"{STATUS_LABELS.get(status, status)} {count}" for status, count in report["distributions"]["window_status"].items()),
            "",
            "## A 级清单（≥75）",
            "",
            "| 机会 | 等级 | 总分 | 行业 | 区域 |",
            "|---|---|---|---|---|",
        ]
    )
    for row in report["a_grade"]:
        lines.append(f"| {row['title']}（{row['opp_id']}） | {row['grade']} | {row['total']} | {row['industry']} | {'、'.join(row['regions'])} |")
    if not report["a_grade"]:
        lines.append("| — | 本年度暂无 A 级机会 | — | — | — |")
    lines.extend(["", "## 窗口收尾 / ≤3 个月", ""])
    for row in report["closing"]:
        lines.append(f"- {row['title']}（{row['opp_id']}）：{STATUS_LABELS.get(row['status'], row['status'])} / 剩余 {row['months_left']} 月 / decay={row['decay']}")
    if not report["closing"]:
        lines.append("- 本年度没有收尾窗口。")
    lines.extend(["", "## 评分分布", ""])
    for label, count in zip(report["distributions"]["score_histogram_ranges"] or [], report["distributions"]["score_histogram"] or []):
        lines.append(f"- {label}：{count}")
    if not report["distributions"]["score_histogram_ranges"]:
        lines.append("- 无数据")
    lines.extend(["", "## 实验摘要（可选）", ""])
    experiments = report.get("experiments")
    if experiments is None:
        lines.append("- 未提供实验导出文件（`--experiments` 可选）。")
    elif experiments.get("error"):
        lines.append(f"- 实验文件读取失败，已跳过摘要：{experiments['error']}")
    else:
        brier = experiments["brier"]
        brier_text = brier["brier"] if brier["brier"] is not None else "样本不足"
        rate = f"{experiments['success_rate']:.1%}" if experiments["success_rate"] is not None else "—"
        lines.append(
            f"- 样本 {experiments['samples']} 条（有效 {brier['n']}）｜成功率 {rate}｜Brier {brier_text}（基线 {brier['baseline']}）"
            + ("｜样例数据" if experiments.get("sample") else "")
        )
        lines.append(
            f"- 花费合计 {experiments['spend_hours']['spend_total']} 元｜耗时合计 {experiments['spend_hours']['hours_total']} 小时"
        )
    lines.extend(["", "## 年度 3 个方向建议（规则生成，非投资建议）", ""])
    lines.extend(f"{idx}. {tip}" for idx, tip in enumerate(report["suggestions"], start=1))
    lines.extend(["", "## 免责声明", "", report["disclaimer"], ""])
    return "\n".join(lines)


def render_html(report: dict[str, Any]) -> str:
    escape = html.escape
    dist = report["distributions"]
    top_rows = "".join(
        f"<tr><td>{row['rank']}</td><td><b>{escape(row['title'])}</b><br><span class='muted'>{escape(row['opp_id'])} · {escape(row['one_liner'][:70])}</span></td>"
        f"<td>{escape(row['grade'])}</td><td>{row['total']}</td><td>{escape(row['industry'])}</td>"
        f"<td>{escape('、'.join(row['regions']))}</td>"
        f"<td>{escape(STATUS_LABELS.get(row['status'], str(row['status'])))} / {row['months_left']} 月</td></tr>"
        for row in report["top20"]
    ) or "<tr><td colspan='7' class='empty'>本年度暂无机会</td></tr>"
    timeline_rows = "".join(
        f"<tr><td>{row['label']}</td><td>{row['active']}</td><td>{row['new']}</td>"
        f"<td>{escape('、'.join(item['name'] for item in row['themes']['industries']) or '—')}"
        f" / {escape('、'.join(item['name'] for item in row['themes']['gaps']) or '—')}</td></tr>"
        for row in report["timeline"]
    )
    a_rows = "".join(
        f"<tr><td>{escape(row['title'])}<br><span class='muted'>{escape(row['opp_id'])}</span></td>"
        f"<td>{escape(row['grade'])}</td><td>{row['total']}</td><td>{escape(row['industry'])}</td>"
        f"<td>{escape('、'.join(row['regions']))}</td></tr>"
        for row in report["a_grade"]
    ) or "<tr><td colspan='5' class='empty'>本年度暂无 A 级机会</td></tr>"
    closing_items = "".join(
        f"<li>{escape(row['title'])}（{escape(row['opp_id'])}）：{escape(STATUS_LABELS.get(row['status'], str(row['status'])))} / 剩余 {row['months_left']} 月 / decay={escape(str(row['decay']))}</li>"
        for row in report["closing"]
    ) or "<li class='empty'>本年度没有收尾窗口。</li>"
    hist_rows = "".join(
        f"<div class='barrow'><span class='lab'>{escape(str(label))}</span>"
        f"<span class='bar' style='width:{max(2, count * 18)}px'></span><span class='num'>{count}</span></div>"
        for label, count in zip(dist["score_histogram_ranges"] or [], dist["score_histogram"] or [])
    ) or "<div class='empty'>无数据</div>"
    experiments = report.get("experiments")
    if experiments is None:
        experiment_html = "<p class='muted'>未提供实验导出文件（<code>--experiments</code> 可选）。</p>"
    elif experiments.get("error"):
        experiment_html = f"<p class='muted'>实验文件读取失败，已跳过摘要：{escape(experiments['error'])}</p>"
    else:
        brier = experiments["brier"]
        brier_text = brier["brier"] if brier["brier"] is not None else "样本不足"
        rate = f"{experiments['success_rate']:.1%}" if experiments["success_rate"] is not None else "—"
        experiment_html = (
            f"<table><tr><th>样本</th><th>有效样本</th><th>成功率</th><th>Brier（基线 {brier['baseline']}）</th>"
            f"<th>花费合计(元)</th><th>耗时合计(h)</th></tr>"
            f"<tr><td>{experiments['samples']}</td><td>{brier['n']}</td><td>{rate}</td><td>{brier_text}</td>"
            f"<td>{experiments['spend_hours']['spend_total']}</td><td>{experiments['spend_hours']['hours_total']}</td></tr></table>"
            + ("<p class='muted'>样例数据（sample），仅展示年鉴流程。</p>" if experiments.get("sample") else "")
        )
    tips = "".join(f"<li>{escape(tip)}</li>" for tip in report["suggestions"])
    grades = " ".join(f"<span class='chip'>{escape(str(grade))} {count}</span>" for grade, count in dist["by_grade"].items())
    status = " ".join(
        f"<span class='chip'>{escape(STATUS_LABELS.get(key, key))} {value}</span>" for key, value in dist["window_status"].items()
    )
    sample_badge = '<div class="sample">样例实验数据（sample）· 仅演示年鉴流程</div>' if report.get("sample") else ""
    return f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>机会雷达 · {report['year']} 年度年鉴</title><style>{HTML_STYLE}</style></head>
<body><div class="wrap">
<header class="hero">
  <h1>机会雷达 · {report['year']} 年度年鉴</h1>
  <div class="sub">数据版本 data-v{escape(str(report['data_version']))}　｜　数据基准日 {escape(report['as_of'])}　｜　生成于 {escape(report['generated_at'])}</div>
  <div class="chips">
    <span class="chip">{report['counts']['opportunities']} 条机会</span>
    <span class="chip">{report['counts']['a_grade']} 条 A 级及以上</span>
    <span class="chip warn">{report['counts']['closing']} 条收尾/≤3 月</span>
    {grades}
    {status}
  </div>
  {sample_badge}
</header>
<section class="card"><h2>年榜 Top20</h2>
<table><tr><th>#</th><th>机会</th><th>等级</th><th>总分</th><th>行业</th><th>区域</th><th>窗口</th></tr>{top_rows}</table></section>
<section class="card"><h2>月度时间线（按 activity_dates 聚合）</h2>
<table><tr><th>月份</th><th>活跃机会</th><th>新机会</th><th>主题（行业 / 信息差 Top2）</th></tr>{timeline_rows}</table></section>
<section class="card"><h2>分布</h2>
<h3>行业</h3>{_bar_rows(dist['by_industry'], 'name')}
<h3>区域</h3>{_bar_rows(dist['by_region'], 'name')}
<h3>信息差</h3>{_bar_rows(dist['by_gap_type'], 'name')}</section>
<section class="card"><h2>评分分布</h2>{hist_rows}</section>
<section class="card"><h2>A 级清单（≥75）</h2>
<table><tr><th>机会</th><th>等级</th><th>总分</th><th>行业</th><th>区域</th></tr>{a_rows}</table></section>
<section class="card"><h2>窗口收尾 / 剩余 ≤3 个月</h2><ul>{closing_items}</ul></section>
<section class="card"><h2>实验摘要（可选）</h2>{experiment_html}</section>
<section class="card"><h2>年度 3 个方向建议 <span class="muted">（规则生成，非投资建议）</span></h2><ul class="tips">{tips}</ul></section>
<footer class="footer">
  <p>生成器：<code>scanner/yearbook.py</code>　｜　数据版本 data-v{escape(str(report['data_version']))}　｜　自包含 HTML，可离线打开/打印（Ctrl+P）。</p>
  <p><b>免责声明</b>：{escape(report['disclaimer'])}</p>
</footer>
</div></body></html>
"""


def generate(
    year: int,
    *,
    experiments_path: Path | None = None,
    sample: bool = False,
    out_dir: Path | None = None,
) -> dict[str, Any]:
    report = build_report(year, experiments_path, sample)
    output_dir = Path(out_dir).resolve() if out_dir else config.REPORTS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    html_path = output_dir / f"yearbook-{year}.html"
    md_path = output_dir / f"yearbook-{year}.md"
    html_text = render_html(report)
    md_text = render_markdown(report)
    html_path.write_text(html_text, encoding="utf-8")
    md_path.write_text(md_text, encoding="utf-8")
    experiments = report.get("experiments") or {}
    return {
        "year": year,
        "html": str(html_path),
        "md": str(md_path),
        "opportunities": report["counts"]["opportunities"],
        "top20": report["counts"]["top20"],
        "a_grade": report["counts"]["a_grade"],
        "closing": report["counts"]["closing"],
        "html_bytes": len(html_text.encode("utf-8")),
        "md_bytes": len(md_text.encode("utf-8")),
        "html_lines": html_text.count("\n") + 1,
        "md_lines": md_text.count("\n") + 1,
        "brier": (experiments.get("brier") or {}).get("brier") if not experiments.get("error") else None,
        "experiments_error": experiments.get("error"),
        "sample": sample,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="年度年鉴报告（自包含 HTML + Markdown）")
    parser.add_argument("--year", type=int, default=None, help="年份（默认取 as_of 所在年）")
    parser.add_argument("--experiments", type=str, default=None, help="可选：前端导出的实验 JSON")
    parser.add_argument("--sample", action="store_true", help="标记实验摘要为样例数据")
    parser.add_argument("--out-dir", type=str, default=None, help="输出目录（默认 data/reports）")
    args = parser.parse_args(argv)

    if args.year is None:
        taxonomy = common.load_json(config.TAXONOMY_PATH)
        year = common.parse_as_of(taxonomy).year
    else:
        year = args.year
    if year < 2000 or year > 2100:
        print(f"[yearbook] 年份不合法：{year}")
        return 2
    result = generate(
        year,
        experiments_path=Path(args.experiments) if args.experiments else None,
        sample=args.sample,
        out_dir=Path(args.out_dir) if args.out_dir else None,
    )
    brier_text = result["brier"] if result["brier"] is not None else "—"
    print(
        f"[yearbook] {year}：机会 {result['opportunities']} / Top20 {result['top20']} / A 级 {result['a_grade']} / "
        f"收尾 {result['closing']} / Brier {brier_text} → {result['html_lines']} 行 HTML（{result['html_bytes']} B）"
    )
    print(
        f"[yearbook] → {common.display_path(result['html'])}"
        f" / {common.display_path(result['md'])}"
    )
    if result.get("experiments_error"):
        print(f"[yearbook] 警告：实验文件读取失败，已跳过实验摘要（{result['experiments_error']}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
