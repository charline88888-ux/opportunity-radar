"""qa/data-qa-v02.py —— v0.2.0 红队独立数据验收（history / 真实 delta / SQLite / source-health / 报告）。

不依赖 scanner/ 实现（独立复算），只读 data/ 与 scanner/ 产物；不会修改任何文件。
用法：
    python qa/data-qa-v02.py
    python qa/data-qa-v02.py --json
退出码：P0>0 或 P1>0 时 1，否则 0（P2 不影响）。
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
AS_OF = date(2026, 10, 22)
WINDOWS = ("day", "week", "month", "year")
EXPECTED_VERSION = "0.2.0"


def load(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return {"__json_error__": str(exc)}


class QA:
    def __init__(self) -> None:
        self.p0: list[str] = []
        self.p1: list[str] = []
        self.p2: list[str] = []
        self.notes: list[str] = []

    def report(self) -> int:
        print("=" * 80)
        print("机会雷达 v0.2.0 · 红队独立数据验收（qa/data-qa-v02.py）")
        print("=" * 80)
        print(f"P0 = {len(self.p0)}    P1 = {len(self.p1)}    P2 = {len(self.p2)}")
        for level, items in (("P0", self.p0), ("P1", self.p1), ("P2", self.p2)):
            for item in items:
                print(f"  [{level}] {item}")
        if self.notes:
            print("-" * 80)
            for note in self.notes:
                print(f"  · {note}")
        print("=" * 80)
        return 0 if not self.p0 and not self.p1 else 1


def check_versions(qa: QA, docs: dict) -> None:
    for name, doc in docs.items():
        if not isinstance(doc, dict):
            continue
        meta = doc.get("meta") or {}
        version = str(meta.get("data_version", ""))
        if name in {"taxonomy", "rankings", "stats"}:
            if version != EXPECTED_VERSION:
                qa.p0.append(f"data/{name}.json meta.data_version={version!r} ≠ {EXPECTED_VERSION}")
        elif meta and version and version != EXPECTED_VERSION:
            qa.p2.append(f"data/{name}.json meta.data_version={version!r} 未同步 {EXPECTED_VERSION}（建议统一）")
    for name in ("README", "CHANGELOG"):
        path = DATA / f"{name}.md"
        if not path.exists():
            qa.p1.append(f"data/{name}.md 缺失")
            continue
        text = path.read_text(encoding="utf-8")
        if EXPECTED_VERSION not in text:
            qa.p2.append(f"data/{name}.md 未出现 {EXPECTED_VERSION} 版本记录")


def check_history(qa: QA, rankings: dict) -> None:
    hist_dir = DATA / "history"
    if not hist_dir.is_dir():
        qa.p0.append("data/history/ 目录缺失（v0.2.0 契约必需）")
        return
    snap = hist_dir / f"rankings-{AS_OF.isoformat()}.json"
    if not snap.exists():
        qa.p0.append(f"data/history/rankings-{AS_OF.isoformat()}.json 缺失")
        return
    data = load(snap)
    if not isinstance(data, dict) or "__json_error__" in (data or {}):
        qa.p0.append("history 快照不是合法 JSON")
        return
    meta = data.get("meta") or {}
    if meta.get("data_version") != EXPECTED_VERSION:
        qa.p1.append(f"history 快照 meta.data_version={meta.get('data_version')!r} ≠ {EXPECTED_VERSION}")
    if not meta.get("snapshot_at"):
        qa.p0.append("history 快照缺少 meta.snapshot_at（V19）")
    else:
        if not re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", str(meta["snapshot_at"])):
            qa.p1.append(f"history meta.snapshot_at 非 ISO 时间：{meta.get('snapshot_at')}")
    if not isinstance(meta.get("reconstructed", None), bool):
        qa.p1.append("history meta.reconstructed 不是 bool（v0.2.0 固定 false）")
    # 与当日 rankings 比对（V19）
    if rankings:
        for window in WINDOWS:
            cur = ((rankings.get("windows") or {}).get(window) or {}).get("items") or []
            old = ((data.get("windows") or {}).get(window) or {}).get("items") or []
            if len(cur) != len(old):
                qa.p0.append(f"history vs rankings {window} 条数不一致：{len(old)} ≠ {len(cur)}")
                continue
            for a, b in zip(old, cur):
                for key in ("opp_id", "rank", "rank_score", "total", "delta", "change"):
                    if a.get(key) != b.get(key):
                        qa.p0.append(f"history vs rankings {window} 第 {a.get('rank')} 名 {key} 不一致：{a.get(key)} ≠ {b.get(key)}")
                        break
    qa.notes.append(f"history 快照：{snap.relative_to(ROOT)}（{snap.stat().st_size} B）")


def check_delta_meta(qa: QA, rankings: dict) -> None:
    if not rankings:
        return
    meta = rankings.get("meta") or {}
    basis = meta.get("delta_basis")
    if basis not in {"history", "adjacent-window"}:
        qa.p0.append(f"rankings.meta.delta_basis={basis!r} 非法（history / adjacent-window）")
    if "history_as_of" not in meta:
        qa.p0.append("rankings.meta 缺少 history_as_of")
    elif meta.get("history_as_of") is not None:
        try:
            hist_day = date.fromisoformat(str(meta["history_as_of"]))
            if hist_day >= AS_OF:
                qa.p1.append(f"rankings.meta.history_as_of={hist_day} 应早于 as_of")
            if not (DATA / "history" / f"rankings-{hist_day.isoformat()}.json").exists():
                qa.p1.append(f"history_as_of={hist_day} 指向的快照不存在")
        except ValueError:
            qa.p1.append(f"rankings.meta.history_as_of 日期非法：{meta.get('history_as_of')}")
    if not meta.get("tie_breaker"):
        qa.p1.append("rankings.meta 缺少 tie_breaker 说明")
    # delta/change 语义（V18 加强：整体口径一致性粗检）
    for window in WINDOWS:
        items = ((rankings.get("windows") or {}).get(window) or {}).get("items") or []
        for it in items:
            delta, change = it.get("delta"), it.get("change")
            if change == "new" and delta is not None:
                qa.p0.append(f"{window} {it.get('opp_id')} change=new 但 delta={delta}")
            if change == "up" and not (isinstance(delta, int) and delta > 0):
                qa.p0.append(f"{window} {it.get('opp_id')} change=up 但 delta={delta}")
            if change == "down" and not (isinstance(delta, int) and delta < 0):
                qa.p0.append(f"{window} {it.get('opp_id')} change=down 但 delta={delta}")
            if change == "flat" and delta != 0:
                qa.p0.append(f"{window} {it.get('opp_id')} change=flat 但 delta={delta}")


def check_source_health(qa: QA, sources: dict) -> None:
    path = DATA / "source-health.json"
    if not path.exists():
        qa.p2.append("data/source-health.json 不存在（可选：--fetch 后生成）；若本轮已跑 --fetch 则缺失属 P1")
        return
    doc = load(path)
    if not isinstance(doc, dict) or "__json_error__" in (doc or {}):
        qa.p0.append("source-health.json 不是合法 JSON")
        return
    known = {src.get("id") for cat in (sources or {}).get("categories", []) for src in cat.get("sources", [])}
    rows = doc.get("sources") or []
    if not isinstance(rows, list) or not rows:
        qa.p1.append("source-health.sources 为空")
        return
    for row in rows:
        sid = row.get("id")
        if sid not in known:
            qa.p0.append(f"source-health 引用未知 source id: {sid}")
        if not isinstance(row.get("ok"), bool):
            qa.p0.append(f"source-health {sid}: ok 非 bool")
        checked = row.get("checked_at")
        try:
            if not checked or not str(checked).startswith(str(AS_OF)) and len(str(checked)) < 10:
                qa.p1.append(f"source-health {sid}: checked_at 非法 {checked!r}")
        except Exception:
            qa.p1.append(f"source-health {sid}: checked_at 非法 {checked!r}")
        latency = row.get("latency_ms")
        if not isinstance(latency, (int, float)) or latency < 0:
            qa.p1.append(f"source-health {sid}: latency_ms 非法 {latency!r}")
    ok_count = sum(1 for r in rows if r.get("ok") is True)
    qa.notes.append(f"source-health：{len(rows)} 源，ok={ok_count}，文件 {path.stat().st_size} B")


def check_reports(qa: QA, rankings: dict) -> None:
    rep_dir = DATA / "reports"
    if not rep_dir.is_dir():
        qa.p0.append("data/reports/ 目录缺失（v0.2.0 报告导出未产出）")
        return
    for period in WINDOWS:
        html = rep_dir / f"report-{period}-{AS_OF.isoformat()}.html"
        md = rep_dir / f"report-{period}-{AS_OF.isoformat()}.md"
        if not html.exists():
            qa.p0.append(f"缺少报告 {html.name}")
            continue
        if not md.exists():
            qa.p1.append(f"缺少 Markdown 报告 {md.name}")
        text = html.read_text(encoding="utf-8", errors="ignore")
        if "<style" not in text and "style=" not in text:
            qa.p1.append(f"{html.name}: 未发现内联 CSS（自包含要求）")
        if re.search(r'<script[^>]+src="https?://', text) or re.search(r'<link[^>]+href="https?://', text):
            qa.p1.append(f"{html.name}: 含外部脚本/样式外链（应自包含）")
        for must in ("非投资建议", "研究假设"):
            if must not in text:
                qa.p1.append(f"{html.name}: 缺少免责声明「{must}」")
                break
        items = ((rankings.get("windows") or {}).get(period) or {}).get("items") or []
        if items:
            top_opp = items[0].get("opp_id")
            if top_opp and top_opp not in text and str(items[0].get("rank")) not in text:
                qa.p2.append(f"{html.name}: 未找到榜首 opp_id 痕迹（可能只渲染标题）")
        if md.exists():
            mtext = md.read_text(encoding="utf-8")
            for must in ("七问", "证据", "非投资建议"):
                if must not in mtext:
                    qa.p2.append(f"{md.name}: 缺少「{must}」内容")
        qa.notes.append(f"报告 {period}: {html.name}（{html.stat().st_size} B）" + (f" + {md.name}" if md.exists() else ""))
    html_files = list(rep_dir.glob("*.html"))
    md_files = list(rep_dir.glob("*.md"))
    if len(html_files) < 4 or len(md_files) < 4:
        qa.p1.append(f"报告数量不足：html={len(html_files)} md={len(md_files)}（四窗口各一份）")


def check_sqlite(qa: QA, opps: list, as_of: str) -> None:
    db = DATA / "radar.db"
    if not db.exists():
        qa.p1.append("data/radar.db 不存在（--all 后应自动生成；若本轮尚未生成可忽略）")
        return
    # gitignore
    try:
        r = subprocess.run(["git", "check-ignore", "-q", "data/radar.db"], cwd=ROOT, capture_output=True)
        if r.returncode != 0:
            qa.p1.append("data/radar.db 未被 gitignore（契约要求不入库）")
    except FileNotFoundError:
        qa.p2.append("git 不可用，跳过 radar.db gitignore 检查")
    try:
        conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        for table in ("opportunities", "evidence", "rankings_history", "source_health"):
            if table not in tables:
                qa.p1.append(f"radar.db 缺少表 {table}（实际：{sorted(tables)}）")
        if "opportunities" in tables:
            n = conn.execute("SELECT COUNT(*) FROM opportunities").fetchone()[0]
            if n != len(opps):
                qa.p0.append(f"radar.db opportunities 行数 {n} ≠ JSON {len(opps)}")
        if "evidence" in tables:
            want = sum(len((o.get("signal") or {}).get("evidence") or []) for o in opps)
            n = conn.execute("SELECT COUNT(*) FROM evidence").fetchone()[0]
            if n != want:
                qa.p0.append(f"radar.db evidence 行数 {n} ≠ JSON {want}")
        if "rankings_history" in tables:
            n = conn.execute("SELECT COUNT(*) FROM rankings_history").fetchone()[0]
            if n < 1:
                qa.p1.append("radar.db rankings_history 为空")
        conn.close()
        qa.notes.append(f"radar.db：{db.stat().st_size} B，tables={sorted(tables)}")
    except sqlite3.Error as exc:
        qa.p0.append(f"radar.db 打不开/查询失败：{exc}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    qa = QA()
    docs = {
        "taxonomy": load(DATA / "taxonomy.json"),
        "rankings": load(DATA / "rankings.json"),
        "stats": load(DATA / "stats.json"),
        "sources": load(DATA / "sources.json"),
        "playbooks": load(DATA / "playbooks.json"),
        "calendar": load(DATA / "calendar.json"),
    }
    opps = load(DATA / "opportunities.json") or []
    if not isinstance(opps, list):
        qa.p0.append("opportunities.json 不是数组")
        opps = []
    check_versions(qa, docs)
    check_history(qa, docs["rankings"] or {})
    check_delta_meta(qa, docs["rankings"] or {})
    check_source_health(qa, docs["sources"] or {})
    check_reports(qa, docs["rankings"] or {})
    check_sqlite(qa, opps, AS_OF.isoformat())

    if args.json:
        print(json.dumps({"p0": qa.p0, "p1": qa.p1, "p2": qa.p2, "notes": qa.notes}, ensure_ascii=False, indent=2))
    return qa.report()


if __name__ == "__main__":
    raise SystemExit(main())
