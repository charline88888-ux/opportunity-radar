"""qa/data-qa-v031.py —— v0.3.1 红队独立数据验收（采集修复 / Brier 前置 / source-health v2 / 回放 / delta / 报告 / SQLite）。

不依赖 scanner/ 实现（delta 独立复算）；只读 data/ 与 scanner/ 产物。
用法：python qa/data-qa-v03.py [--json]
退出码：P0>0 或 P1>0 → 1。
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
AS_OF = date(2026, 10, 22)
WINDOWS = ("day", "week", "month", "year")
VERSION = "0.3.1"


class QA:
    def __init__(self) -> None:
        self.p0: list[str] = []
        self.p1: list[str] = []
        self.p2: list[str] = []
        self.notes: list[str] = []

    def dump(self) -> int:
        print("=" * 82)
        print("机会雷达 v0.3.1 · 红队独立数据验收（qa/data-qa-v031.py）")
        print("=" * 82)
        print(f"P0 = {len(self.p0)}    P1 = {len(self.p1)}    P2 = {len(self.p2)}")
        for level, items in (("P0", self.p0), ("P1", self.p1), ("P2", self.p2)):
            for item in items:
                print(f"  [{level}] {item}")
        if self.notes:
            print("-" * 82)
            for note in self.notes:
                print(f"  · {note}")
        print("=" * 82)
        return 0 if not self.p0 and not self.p1 else 1


def load(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return {"__json_error__": str(exc)}


def iso_date_ok(value) -> bool:
    try:
        date.fromisoformat(str(value)[:10])
        return True
    except ValueError:
        return False


def check_versions(qa: QA, docs: dict) -> None:
    for name in ("taxonomy", "rankings", "stats", "sources", "playbooks", "calendar"):
        doc = docs.get(name) or {}
        meta = doc.get("meta") or {}
        if str(meta.get("data_version")) != VERSION:
            qa.p0.append(f"data/{name}.json meta.data_version={meta.get('data_version')!r} ≠ {VERSION}")
    for name in ("README", "CHANGELOG"):
        path = DATA / f"{name}.md"
        if not path.exists():
            qa.p1.append(f"data/{name}.md 缺失")
        elif VERSION not in path.read_text(encoding="utf-8"):
            qa.p2.append(f"data/{name}.md 未记录 {VERSION}")


def load_history(qa: QA) -> dict[str, dict]:
    hist_dir = DATA / "history"
    snaps: dict[str, dict] = {}
    if not hist_dir.is_dir():
        qa.p0.append("data/history/ 目录缺失")
        return snaps
    for path in sorted(hist_dir.glob("rankings-*.json")):
        day = path.stem.replace("rankings-", "")
        if not iso_date_ok(day):
            qa.p0.append(f"history 文件名日期非法：{path.name}")
            continue
        doc = load(path)
        if not isinstance(doc, dict):
            qa.p0.append(f"history {path.name} 不是合法 JSON")
            continue
        snaps[day] = doc
        meta = doc.get("meta") or {}
        if not iso_date_ok(meta.get("snapshot_at")):
            qa.p0.append(f"{path.name}: meta.snapshot_at 缺失/非法（V19）")
        elif str(meta["snapshot_at"])[:10] != day:
            qa.p0.append(f"{path.name}: snapshot_at 日期 {str(meta['snapshot_at'])[:10]} ≠ 文件名 {day}")
        if not isinstance(meta.get("reconstructed"), bool):
            qa.p0.append(f"{path.name}: meta.reconstructed 非 bool")
        if meta.get("reconstructed") is True:
            if not meta.get("replay_as_of"):
                qa.p0.append(f"{path.name}: 回放快照缺少 meta.replay_as_of（V19）")
            elif str(meta["replay_as_of"])[:10] != day:
                qa.p1.append(f"{path.name}: replay_as_of={meta.get('replay_as_of')} 与快照日期不一致")
        if str(meta.get("data_version")) != VERSION:
            qa.p1.append(f"{path.name}: meta.data_version={meta.get('data_version')!r} ≠ {VERSION}")
        for w in WINDOWS:
            items = ((doc.get("windows") or {}).get(w) or {}).get("items")
            if not isinstance(items, list):
                qa.p0.append(f"{path.name}: windows.{w}.items 非数组")
                continue
            ranks = [it.get("rank") for it in items]
            if ranks != list(range(1, len(items) + 1)):
                qa.p0.append(f"{path.name}: windows.{w}.rank 未从 1 连续")
        qa.notes.append(
            f"history {day}: reconstructed={meta.get('reconstructed')} "
            f"replay_as_of={meta.get('replay_as_of')} counts="
            f"{ {w: len(((doc.get('windows') or {}).get(w) or {}).get('items') or []) for w in WINDOWS} }"
        )
    for required in ("2026-10-20", "2026-10-21", "2026-10-22"):
        if required not in snaps:
            qa.p0.append(f"缺少 history 快照 rankings-{required}.json")
    for day in ("2026-10-20", "2026-10-21"):
        if day in snaps and (snaps[day].get("meta") or {}).get("reconstructed") is not True:
            qa.p0.append(f"回放快照 {day} 的 meta.reconstructed 应为 true")
    if "2026-10-22" in snaps and (snaps["2026-10-22"].get("meta") or {}).get("reconstructed") is not False:
        qa.p0.append("真实快照 2026-10-22 的 meta.reconstructed 应为 false")
    return snaps


def cur_rank_map(rankings: dict) -> dict[str, dict[str, int]]:
    return {
        w: {it["opp_id"]: int(it["rank"]) for it in ((rankings.get("windows") or {}).get(w) or {}).get("items") or []}
        for w in WINDOWS
    }


def check_history_consistency(qa: QA, rankings: dict, snaps: dict[str, dict]) -> None:
    """V19：最新快照 = 当前 rankings；旧快照允许不同。"""
    if not snaps:
        return
    latest_day = max(snaps)
    latest = snaps[latest_day]
    if latest_day != AS_OF.isoformat():
        qa.p1.append(f"最新 history 快照日期 {latest_day} ≠ as_of {AS_OF}")
    for w in WINDOWS:
        cur = ((rankings.get("windows") or {}).get(w) or {}).get("items") or []
        old = ((latest.get("windows") or {}).get(w) or {}).get("items") or []
        if len(cur) != len(old):
            qa.p0.append(f"最新快照 vs rankings {w} 条数不一致 {len(old)} ≠ {len(cur)}")
            continue
        for a, b in zip(old, cur):
            for key in ("opp_id", "rank", "rank_score", "total", "delta", "change"):
                if a.get(key) != b.get(key):
                    qa.p0.append(f"最新快照 vs rankings {w} 第 {a.get('rank')} 名 {key} 不一致")
                    break


def check_delta(qa: QA, rankings: dict, snaps: dict[str, dict]) -> None:
    """真实 delta 独立复算（契约 §5.1 v0.3.0）。"""
    meta = rankings.get("meta") or {}
    if meta.get("delta_basis") != "history":
        qa.p0.append(f"rankings.meta.delta_basis={meta.get('delta_basis')!r} ≠ history")
    if meta.get("history_as_of") != "2026-10-21":
        qa.p0.append(f"rankings.meta.history_as_of={meta.get('history_as_of')!r} ≠ 2026-10-21")
    prev = snaps.get("2026-10-21")
    if not prev and meta.get("delta_basis") == "history":
        qa.p0.append("缺少 2026-10-21 快照，但 meta.delta_basis=history")
        return
    prev_windows = (prev or {}).get("windows") or {}
    cur_windows = rankings.get("windows") or {}
    cur_maps = {w: {it["opp_id"]: int(it["rank"]) for it in ((cur_windows.get(w) or {}).get("items") or [])} for w in WINDOWS}
    # v0.3.0 契约：per-window basis；history 用上一快照同窗口；adjacent-window 回退相邻更大窗口
    ref = {"day": "week", "week": "month", "month": "year", "year": None}
    checked = 0
    new_count = 0
    history_items = 0
    for w in WINDOWS:
        data = cur_windows.get(w) or {}
        items = data.get("items") or []
        basis = data.get("delta_basis")
        if basis not in {"history", "adjacent-window"}:
            qa.p0.append(f"{w}: window.delta_basis={basis!r} 非法")
            continue
        prev_items = ((prev_windows.get(w) or {}).get("items") or []) if basis == "history" else []
        prev_map = {it["opp_id"]: int(it["rank"]) for it in prev_items}
        for it in items:
            oid = it.get("opp_id")
            checked += 1
            prev_rank = prev_map.get(oid)
            if basis == "adjacent-window":
                reference = ref[w]
                if reference is not None:
                    prev_rank = cur_maps.get(reference, {}).get(oid)
            if prev_rank is None:
                new_count += 1
                if it.get("delta") is not None or it.get("change") != "new":
                    qa.p0.append(f"{w} {oid}: 无可比上期，应为 delta=null/change=new，实际 {it.get('delta')}/{it.get('change')}")
                continue
            history_items += 1
            expect = int(prev_rank) - int(it["rank"])
            expect_change = "up" if expect > 0 else "down" if expect < 0 else "flat"
            if it.get("delta") != expect:
                qa.p0.append(f"{w} {oid}: delta 文件 {it.get('delta')} ≠ 复算 {expect}（{basis} 上期 {prev_rank} → 本期 {it['rank']}）")
            if it.get("change") != expect_change:
                qa.p0.append(f"{w} {oid}: change 文件 {it.get('change')} ≠ 复算 {expect_change}")
    qa.notes.append(f"delta 独立复算：{checked} 条（有可比上期 {history_items} 条，新增 {new_count} 条）")


def check_source_health(qa: QA, sources: dict) -> None:
    path = DATA / "source-health.json"
    if not path.exists():
        qa.p1.append("data/source-health.json 缺失（若本轮已 --fetch 则应为必需）")
        return
    doc = load(path)
    if not isinstance(doc, dict):
        qa.p0.append("source-health.json 不是合法 JSON")
        return
    known = {s.get("id") for c in (sources or {}).get("categories", []) for s in c.get("sources", [])}
    meta = doc.get("meta") or {}
    if not meta.get("mode"):
        qa.p1.append("source-health.meta.mode 缺失")
    rows = doc.get("sources") or []
    if not isinstance(rows, list) or not rows:
        qa.p0.append("source-health.sources 为空/非数组")
        return
    failed = 0
    for row in rows:
        sid = row.get("id")
        if sid not in known:
            qa.p0.append(f"source-health 未知 source id: {sid}")
        if not isinstance(row.get("ok"), bool):
            qa.p0.append(f"{sid}: ok 非 bool")
        if row.get("mode") not in {"online-fetch", "cache", "offline"}:
            qa.p0.append(f"{sid}: mode={row.get('mode')!r} 非法")
        if not isinstance(row.get("cached"), bool):
            qa.p0.append(f"{sid}: cached 非 bool")
        lat = row.get("latency_ms")
        if not isinstance(lat, int) or lat < 0:
            qa.p0.append(f"{sid}: latency_ms={lat!r} 非非负整数")
        status = row.get("http_status")
        if not (status is None or isinstance(status, int)):
            qa.p0.append(f"{sid}: http_status={status!r} 应为 int/null")
        if not isinstance(row.get("items"), int):
            qa.p0.append(f"{sid}: items 非整数")
        if not iso_date_ok(row.get("checked_at")):
            qa.p0.append(f"{sid}: checked_at 非法 {row.get('checked_at')!r}")
        elif len(str(row.get("checked_at"))) < 16:
            qa.p2.append(f"{sid}: checked_at 仅日期，建议含时间")
        if row.get("ok") is False:
            failed += 1
            err = row.get("error")
            if not isinstance(err, str) or not err.strip():
                qa.p0.append(f"{sid}: ok=false 但 error 为空（V20 要求非空原因）")
        if row.get("cached") is True and lat not in (0, None):
            qa.p2.append(f"{sid}: cached=true 但 latency_ms={lat}（契约建议缓存命中记 0）")
    ok_count = sum(1 for r in rows if r.get("ok") is True)
    if meta.get("mode") == "online-fetch" and len(rows) >= 8 and ok_count < 7:
        qa.p1.append(f"source-health 在线采集成功 {ok_count}/{len(rows)} < 7（v0.3.1 修复目标 ≥7/8）")
    qa.notes.append(f"在线采集成功 {ok_count}/{len(rows)}")
    qa.notes.append(f"source-health：{len(rows)} 源 / ok={ok_count} / failed={failed} / meta.mode={meta.get('mode')}")
    for row in rows:
        if row.get("ok") is False:
            qa.notes.append(f"  失败源：{row.get('id')} error={str(row.get('error'))[:80]!r} http_status={row.get('http_status')} mode={row.get('mode')}")


def check_reports(qa: QA, rankings: dict) -> None:
    rep = DATA / "reports"
    if not rep.is_dir():
        qa.p0.append("data/reports/ 缺失")
        return
    for w in WINDOWS:
        html = rep / f"report-{w}-{AS_OF.isoformat()}.html"
        md = rep / f"report-{w}-{AS_OF.isoformat()}.md"
        if not html.exists():
            qa.p0.append(f"缺少报告 {html.name}")
            continue
        if not md.exists():
            qa.p1.append(f"缺少 Markdown 报告 {md.name}")
        text = html.read_text(encoding="utf-8", errors="ignore")
        items = ((rankings.get("windows") or {}).get(w) or {}).get("items") or []
        sections = len(re.findall(r'<section class="card">', text))
        if sections != len(items):
            qa.p1.append(f"{html.name}: 报告条目 {sections} ≠ 榜单 {len(items)}")
        if re.search(r'<link[^>]+href="https?://', text) or re.search(r'<script[^>]+src="https?://', text):
            qa.p1.append(f"{html.name}: 含外部 CSS/JS 外链")
        for must in ("非投资建议",):
            if must not in text:
                qa.p2.append(f"{html.name}: 缺少「{must}」")
        if '<div class="seven">' not in text and "七问" not in text:
            qa.p2.append(f"{html.name}: 未找到七问摘要区块")
        if "证据链" not in text:
            qa.p2.append(f"{html.name}: 未找到证据链区块")
        if md.exists():
            mtext = md.read_text(encoding="utf-8")
            for must in ("七问", "证据", "非投资建议"):
                if must not in mtext:
                    qa.p2.append(f"{md.name}: 缺少「{must}」")
    qa.notes.append(f"reports: html={len(list(rep.glob('*.html')))} md={len(list(rep.glob('*.md')))}")
    for path in sorted(rep.glob("report-day-*.md"))[:1]:
        txt = path.read_text(encoding="utf-8")
        if f"data-v{VERSION}" not in txt:
            qa.p2.append(f"{path.name}: 报告未体现 data-v{VERSION}（版本升级后未重生成报告）")


def check_sqlite(qa: QA, opps: list, snaps: dict[str, dict]) -> None:
    db = DATA / "radar.db"
    if not db.exists():
        qa.p1.append("data/radar.db 缺失")
        return
    try:
        conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        for t in ("opportunities", "evidence", "rankings_history", "source_health"):
            if t not in tables:
                qa.p1.append(f"radar.db 缺表 {t}（实际 {sorted(tables)}）")
        if "opportunities" in tables:
            n = conn.execute("SELECT COUNT(*) FROM opportunities").fetchone()[0]
            if n != len(opps):
                qa.p0.append(f"radar.db opportunities {n} ≠ JSON {len(opps)}")
        if "evidence" in tables:
            want = sum(len((o.get("signal") or {}).get("evidence") or []) for o in opps)
            n = conn.execute("SELECT COUNT(*) FROM evidence").fetchone()[0]
            if n != want:
                qa.p0.append(f"radar.db evidence {n} ≠ JSON {want}")
        if "rankings_history" in tables:
            n = conn.execute("SELECT COUNT(*) FROM rankings_history").fetchone()[0]
            qa.notes.append(f"radar.db rankings_history rows={n}（{len(snaps)} 份快照）")
        conn.close()
    except sqlite3.Error as exc:
        qa.p0.append(f"radar.db 查询失败：{exc}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    qa = QA()
    docs = {n: load(DATA / f"{n}.json") for n in ("taxonomy", "rankings", "stats", "sources", "playbooks", "calendar")}
    opps = load(DATA / "opportunities.json") or []
    rankings = docs.get("rankings") or {}
    check_versions(qa, docs)
    snaps = load_history(qa)
    check_history_consistency(qa, rankings, snaps)
    check_delta(qa, rankings, snaps)
    check_source_health(qa, docs.get("sources") or {})
    check_reports(qa, rankings)
    check_sqlite(qa, opps if isinstance(opps, list) else [], snaps)
    if args.json:
        print(json.dumps({"p0": qa.p0, "p1": qa.p1, "p2": qa.p2, "notes": qa.notes}, ensure_ascii=False, indent=2))
    return qa.dump()


if __name__ == "__main__":
    raise SystemExit(main())
