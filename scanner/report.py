"""四窗口报告导出：自包含 HTML（内联 CSS，可打印/离线打开）+ Markdown。

用法：
    python scanner/report.py --all                     # 四个窗口各一份
    python scanner/report.py --period day              # 只生成日榜
    python scanner/report.py --period week --period year

输出：data/reports/report-<period>-<as_of>.html / .md
"""
from __future__ import annotations

import html
import json
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # 支持 python scanner/report.py 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import common, config  # noqa: E402
else:  # pragma: no cover
    from . import common, config

WINDOWS = ["day", "week", "month", "year"]
WINDOW_TITLES = {"day": "日榜", "week": "周榜", "month": "月榜", "year": "年度榜"}
PERIOD_LABEL = {"day": "今日", "week": "本周", "month": "本月", "year": "全年"}

HTML_STYLE = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; padding: 32px 20px 60px; font-family: "Noto Sans SC","PingFang SC","Microsoft YaHei",-apple-system,"Segoe UI",sans-serif;
       background: #f6f7f9; color: #1f2430; line-height: 1.65; font-size: 14px; }
.wrap { max-width: 980px; margin: 0 auto; }
.hero { background: #0f1724; color: #e8edf6; border-radius: 14px; padding: 26px 28px; margin-bottom: 22px; }
.hero h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: .5px; }
.hero .sub { color: #9fb0c8; font-size: 13px; }
.hero .chips { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
.chip { background: #1c2a3f; border: 1px solid #2c3e59; color: #cfe0f5; border-radius: 999px; padding: 3px 11px; font-size: 12px; }
.chip.hot { background: #3a1f1f; border-color: #6b3030; color: #ffd9cf; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
.kpi { background: #fff; border-radius: 12px; padding: 14px 16px; border: 1px solid #e4e7ec; }
.kpi .k { font-size: 12px; color: #6b7280; }
.kpi .v { font-size: 22px; font-weight: 700; color: #111827; }
.card { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; page-break-inside: avoid; }
.card .top { display: flex; align-items: flex-start; gap: 12px; }
.rank { min-width: 44px; height: 44px; border-radius: 10px; background: #0f1724; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 17px; }
.card h2 { margin: 0 0 4px; font-size: 17px; }
.one { color: #4b5563; font-size: 13px; margin: 0 0 10px; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.tag { background: #eef2f7; border-radius: 999px; padding: 2px 10px; font-size: 12px; color: #334155; }
.tag.grade { background: #0f1724; color: #fff; }
.seven { border-top: 1px dashed #e4e7ec; padding-top: 10px; }
.seven dt { font-weight: 600; color: #111827; font-size: 13px; margin-top: 8px; }
.seven dd { margin: 2px 0 0; color: #4b5563; font-size: 13px; }
.ev { margin-top: 12px; border-top: 1px dashed #e4e7ec; padding-top: 10px; }
.ev .row { font-size: 12px; color: #4b5563; margin: 4px 0; word-break: break-all; }
.ev a { color: #1d4ed8; text-decoration: none; }
.risk { margin-top: 10px; font-size: 12px; color: #7c2d12; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 8px 10px; }
.footer { margin-top: 28px; font-size: 12px; color: #6b7280; border-top: 1px solid #e4e7ec; padding-top: 14px; }
.empty { text-align: center; color: #6b7280; padding: 40px; background: #fff; border-radius: 12px; border: 1px dashed #d1d5db; }
@media print { body { background: #fff; padding: 0; } .hero { border-radius: 0; } .card { border-color: #ddd; } .kpi { border-color: #ddd; } }
@media (max-width: 760px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
"""


def _load() -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]:
    taxonomy = common.load_json(config.TAXONOMY_PATH)
    opportunities = common.load_json(config.OPPORTUNITIES_PATH)
    rankings = common.load_json(config.RANKINGS_PATH)
    return taxonomy, opportunities, rankings


def _name_maps(taxonomy: dict[str, Any]) -> dict[str, dict[str, str]]:
    return {
        key: {item["id"]: item.get("name", item["id"]) for item in taxonomy.get(key, [])}
        for key in ("industries", "regions", "gap_types", "human_needs")
    }


def build_window_data(
    period: str,
    taxonomy: dict[str, Any],
    opportunities: list[dict[str, Any]],
    rankings: dict[str, Any],
    as_of: str | None = None,
) -> dict[str, Any]:
    names = _name_maps(taxonomy)
    opp_map = {opp["id"]: opp for opp in opportunities}
    data_as_of = as_of or rankings["meta"]["as_of"]
    window = rankings["windows"][period]
    rows = []
    for item in window["items"]:
        opp = opp_map[item["opp_id"]]
        rows.append(
            {
                "rank": item["rank"],
                "delta": item.get("delta"),
                "change": item.get("change"),
                "rank_score": item["rank_score"],
                "total": item["total"],
                "grade": opp["scores"]["grade"],
                "title": opp["title"],
                "one_liner": opp["one_liner"],
                "industry": names["industries"].get(opp["industry_id"], opp["industry_id"]),
                "regions": [names["regions"].get(region, region) for region in opp.get("region_ids", [])],
                "gaps": [names["gap_types"].get(gap, gap) for gap in opp.get("gap_type_ids", [])],
                "need": [names["human_needs"].get(need, need) for need in opp.get("human_need_ids", [])],
                "seven": opp.get("seven_questions", {}),
                "evidence": (opp.get("signal") or {}).get("evidence", []),
                "risks": opp.get("risks", []),
                "window": opp.get("window", {}),
                "verified": bool(opp.get("verified")),
                "disclaimer": opp.get("disclaimer") or config.DISCLAIMER,
            }
        )
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["grade"]] = counts.get(row["grade"], 0) + 1
    avg_total = round(sum(row["total"] for row in rows) / len(rows), 1) if rows else 0.0
    return {
        "period": period,
        "title": WINDOW_TITLES[period],
        "period_label": PERIOD_LABEL[period],
        "key": window["key"],
        "label": window["label"],
        "count": window["count"],
        "delta_basis": window.get("delta_basis", rankings.get("meta", {}).get("delta_basis")),
        "rows": rows,
        "grade_counts": counts,
        "avg_total": avg_total,
        "as_of": data_as_of,
        # 确定性逻辑生成时间（同日重跑字节一致；真实运行时间见 pipeline 日志）
        "generated_at": f"{data_as_of}{config.SNAPSHOT_TIME_SUFFIX}",
        "data_version": rankings["meta"].get("data_version", config.DATA_VERSION),
        "disclaimer": config.DISCLAIMER,
    }


def _delta_text(row: dict[str, Any]) -> str:
    delta = row.get("delta")
    if delta is None:
        return "新上榜"
    if delta > 0:
        return f"↑ {delta}"
    if delta < 0:
        return f"↓ {abs(delta)}"
    return "持平"


def render_markdown(data: dict[str, Any]) -> str:
    lines = [
        f"# 机会雷达 · {data['title']}报告（{data['label']}）",
        "",
        f"- 数据基准日：{data['as_of']}　｜　数据版本：data-v{data['data_version']}　｜　生成时间：{data['generated_at']}",
        f"- 窗口：{data['period']} / {data['key']}　｜　条目数：{data['count']}　｜　平均总分：{data['avg_total']}",
        f"- delta 口径：{data['delta_basis']}（history = 较上一快照；adjacent-window = 相邻窗口回退口径）",
        f"- 等级分布：" + " / ".join(f"{grade} {count}" for grade, count in sorted(data["grade_counts"].items())),
        "",
        "> 免责声明：本报告为研究假设与公开信息整理，不构成投资建议、法律意见或收入承诺。",
        "",
    ]
    for row in data["rows"]:
        lines.extend(
            [
                f"## {row['rank']}. {row['title']}",
                "",
                f"{row['one_liner']}",
                "",
                f"- 行业：{row['industry']}　｜　区域：{'、'.join(row['regions'])}　｜　信息差：{'、'.join(row['gaps'])}",
                f"- 评分：{row['grade']} 级 / total {row['total']} / rank_score {row['rank_score']}　｜　较上期：{_delta_text(row)}",
                f"- 窗口：{row['window'].get('status')}（months_left={row['window'].get('months_left')}, decay={row['window'].get('decay')}）",
                "",
                "**七问摘要**",
                "",
            ]
        )
        seven = row["seven"]
        for field, label in (
            ("traffic", "流量"),
            ("money", "赚钱"),
            ("model", "模式"),
            ("roi", "投入回报"),
            ("audience", "适合人群"),
            ("moat", "壁垒"),
        ):
            value = (seven.get(field) or "").strip()
            lines.append(f"- **{label}**：{value}")
        lines.append("")
        lines.append("**证据链接**")
        lines.append("")
        for evidence in row["evidence"]:
            lines.append(
                f"- [{evidence.get('title', '来源')}]({evidence.get('url', '')})（{evidence.get('publisher', '')}，"
                f"{evidence.get('date', '')}，{evidence.get('tier', '')}）"
            )
        if not row["evidence"]:
            lines.append("- （暂无证据）")
        lines.append("")
        if row["risks"]:
            lines.append("**主要风险**：" + "；".join(row["risks"]))
            lines.append("")
    lines.extend(["---", "", f"生成器：scanner/report.py　｜　{data['disclaimer']}", ""])
    return "\n".join(lines)


def render_html(data: dict[str, Any]) -> str:
    escape = html.escape
    grade_chips = "".join(
        f'<span class="chip">{escape(str(grade))} {count}</span>' for grade, count in sorted(data["grade_counts"].items())
    )
    cards: list[str] = []
    for row in data["rows"]:
        seven = row["seven"]
        seven_html = "".join(
            f'<dt>{label}</dt><dd>{escape(str((seven.get(field) or "—"))[:220])}</dd>'
            for field, label in (
                ("traffic", "流量怎么来"),
                ("money", "赚什么钱"),
                ("model", "商业模式"),
                ("roi", "投入回报"),
                ("audience", "适合人群"),
                ("moat", "壁垒"),
            )
        )
        evidence_html = "".join(
            f'<div class="row">· <a href="{escape(evidence.get("url", ""))}" target="_blank" rel="noopener">'
            f'{escape(str(evidence.get("title", "来源")))}</a>（{escape(str(evidence.get("publisher", "")))}，'
            f'{escape(str(evidence.get("date", "")))}，{escape(str(evidence.get("tier", "")))}）</div>'
            for evidence in row["evidence"]
        ) or '<div class="row">（暂无证据）</div>'
        risk_html = (
            f'<div class="risk"><b>主要风险</b>：{escape("；".join(row["risks"]))}</div>' if row["risks"] else ""
        )
        change_class = "hot" if row["change"] in ("up", "new") else ""
        cards.append(
            f"""
<section class="card">
  <div class="top">
    <div class="rank">{row['rank']}</div>
    <div>
      <h2>{escape(row['title'])}</h2>
      <p class="one">{escape(row['one_liner'])}</p>
      <div class="meta">
        <span class="tag grade">{escape(row['grade'])} 级 · {row['total']} 分</span>
        <span class="tag">rank_score {row['rank_score']}</span>
        <span class="tag {change_class}">较上期 {escape(_delta_text(row))}</span>
        <span class="tag">{escape(row['industry'])}</span>
        <span class="tag">{escape('、'.join(row['regions']))}</span>
        <span class="tag">{escape('、'.join(row['gaps']))}</span>
        <span class="tag">窗口 {escape(str(row['window'].get('status')))} · {row['window'].get('months_left')} 月</span>
        <span class="tag">{'verified' if row['verified'] else 'unverified'}</span>
      </div>
    </div>
  </div>
  <div class="seven"><dl>{seven_html}</dl></div>
  <div class="ev"><b>证据链</b>{evidence_html}</div>
  {risk_html}
</section>"""
        )
    if not cards:
        cards.append('<div class="empty">该窗口暂无机会（等待下一批信号）。</div>')
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>机会雷达 · {escape(data['title'])}报告 · {escape(data['label'])}</title>
<style>{HTML_STYLE}</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>机会雷达 · {escape(data['title'])}报告</h1>
    <div class="sub">{escape(data['label'])}（{escape(data['key'])}）　｜　数据基准日 {escape(data['as_of'])}　｜　data-v{escape(str(data['data_version']))}　｜　生成于 {escape(data['generated_at'])}</div>
    <div class="chips">
      <span class="chip">{data['count']} 条机会</span>
      <span class="chip">平均总分 {data['avg_total']}</span>
      <span class="chip">delta 口径：{escape(str(data['delta_basis']))}</span>
      {grade_chips}
    </div>
  </header>
  <div class="kpis">
    <div class="kpi"><div class="k">窗口条目</div><div class="v">{data['count']}</div></div>
    <div class="kpi"><div class="k">平均总分</div><div class="v">{data['avg_total']}</div></div>
    <div class="kpi"><div class="k">A 级及以上</div><div class="v">{data['grade_counts'].get('S', 0) + data['grade_counts'].get('A', 0)}</div></div>
    <div class="kpi"><div class="k">较上期上升/新上榜</div><div class="v">{sum(1 for row in data['rows'] if row['change'] in ('up', 'new'))}</div></div>
  </div>
  {''.join(cards)}
  <footer class="footer">
    <p>生成器：<code>scanner/report.py</code>　｜　数据版本 data-v{escape(str(data['data_version']))}　｜　本报告为自包含 HTML，可离线打开/打印（Ctrl+P）。</p>
    <p><b>免责声明</b>：{escape(data['disclaimer'])}</p>
  </footer>
</div>
</body>
</html>
"""


def generate(periods: list[str], as_of: str | None = None, reports_dir: Path | None = None) -> list[dict[str, str]]:
    taxonomy, opportunities, rankings = _load()
    as_of = as_of or rankings["meta"]["as_of"]
    output_dir = reports_dir or config.REPORTS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[dict[str, str]] = []
    for period in periods:
        data = build_window_data(period, taxonomy, opportunities, rankings, as_of=as_of)
        html_path = output_dir / f"report-{period}-{as_of}.html"
        md_path = output_dir / f"report-{period}-{as_of}.md"
        html_path.write_text(render_html(data), encoding="utf-8")
        md_path.write_text(render_markdown(data), encoding="utf-8")
        written.append({"period": period, "html": str(html_path), "md": str(md_path), "count": str(data["count"])})
    return written


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    periods: list[str] = []
    as_of: str | None = None
    index = 0
    while index < len(argv):
        token = argv[index]
        if token == "--all":
            periods = list(WINDOWS)
            break
        if token == "--as-of" and index + 1 < len(argv):
            as_of = argv[index + 1]
            try:
                common.parse_date(as_of)
            except ValueError:
                print(f"--as-of 非法日期：{as_of}")
                return 2
            index += 2
            continue
        if token == "--period" and index + 1 < len(argv):
            value = argv[index + 1]
            if value not in WINDOWS:
                print(f"--period 只支持 {WINDOWS}")
                return 2
            periods.append(value)
            index += 2
            continue
        index += 1
    if not periods:
        periods = list(WINDOWS)
    results = generate(periods, as_of=as_of)
    for row in results:
        print(f"[report] {row['period']:>5} {row['count']:>3} 条 → {row['html']} / {row['md']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
