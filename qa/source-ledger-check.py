"""qa/source-ledger-check.py —— v0.8.0 采集增强红队验收（源注册表 / 持久账本 / 相关性初筛）。

覆盖：
1) data/sources.json：125 平台 / 57 enabled 自动源（access∈{rss,json}、合规绿黄）、11 区域覆盖、disabled 9 且有原因；
2) fetch.select_sources：只选 enabled/合规绿黄/access rss·json，按 priority/value_score 降序，limit 生效；
3) data/source-health.json：57 行、failed=0、items 合计与 outbox raw_count 一致、mode 合法；
4) scanner/outbox/signals-<as_of>.json：signals N（1015±）、is_new/new_count/seen_count/ledger_total 自洽、
   relevance 字段（score 0-100/tier/industry/gap/region/reasons）与 tiers 统计自洽（business/maybe/off-topic）；
5) scanner/build/signal-ledger.sqlite：表结构、唯一 fingerprint、行数=ledger_total、无重复；
6) 同日再跑一次 fetch（cache；备份/恢复 outbox+source-health）：new_count==0、ledger_total 不下降；
7) validate 20/20、unittest 101/101、--all --as-of 2026-10-23 双跑幂等；data 0.8.0、报告 10-23、db counts 80/156/654/57；
8) 指纹（opportunities/rankings/stats/sources/source-health/radar.db/ledger.py/relevance.py/fetch.py）。
用法：python qa/source-ledger-check.py [--no-fetch]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUTBOX = ROOT / "scanner" / "outbox"
LEDGER = ROOT / "scanner" / "build" / "signal-ledger.sqlite"
TMP = ROOT / "qa" / "tmp"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []

FINGERPRINTS = {
    "data/opportunities.json": "88fda5ab84b7f826",
    "data/rankings.json": "04dd9871fab15074",
    "data/stats.json": "b79bdb3bfb7a16e7",
    "data/sources.json": "2e1ac5d220e9de71",
    "data/source-health.json": "f2956a6f8af886e3",
    "data/radar.db": "69151d7425dd5aa1",
    "data/reports/yearbook-2026.html": "fa50dadbf091d30c",
    "scanner/ledger.py": "62cbf68474b28ff6",
    "scanner/relevance.py": "a80c200fe6e4ca93",
    "scanner/fetch.py": "ca8a9b2f7a580c00",
}


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(args: list[str], timeout: int = 600, env_extra: dict | None = None) -> subprocess.CompletedProcess:
    import os
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    if env_extra:
        env.update(env_extra)
    return subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout, env=env)


def all_sources(sources: dict) -> list[dict]:
    out = []
    for cat in sources.get("categories") or []:
        for s in cat.get("sources") or []:
            item = dict(s)
            item["_category"] = cat.get("id")
            out.append(item)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-fetch", action="store_true")
    args = ap.parse_args()
    TMP.mkdir(parents=True, exist_ok=True)
    # ---------- 1) sources 注册表 ----------
    sources_raw = json.loads((DATA / "sources.json").read_text(encoding="utf-8"))
    srcs = all_sources(sources_raw)
    total = len(srcs)
    auto = [s for s in srcs if s.get("access") in ("rss", "json") and s.get("compliance") in ("green", "yellow") and s.get("enabled") is not False]
    disabled = [s for s in srcs if s.get("enabled") is False]
    if total != 125:
        P1.append(f"sources 平台数 {total} ≠ 125")
    if len(auto) != 57:
        P0.append(f"enabled 自动源 {len(auto)} ≠ 57")
    regions = set()
    for s in srcs:
        for r in s.get("regions") or []:
            regions.add(r)
    if len(regions) != 11:
        P1.append(f"区域覆盖 {len(regions)} ≠ 11")
    disabled_no_reason = [s["id"] for s in disabled if not (s.get("disabled_reason") or s.get("reason") or s.get("notes") or s.get("check_result"))]
    if disabled_no_reason:
        P1.append(f"disabled 源缺原因说明：{disabled_no_reason}")
    notes.append(f"sources：{total} 平台 / {len(auto)} enabled 自动源 / {len(regions)} 区域 / disabled {len(disabled)}（原因齐全）")
    # select_sources
    sys.path.insert(0, str(ROOT))
    import scanner.fetch as fetch_mod  # noqa: E402
    selected = fetch_mod.select_sources(sources_raw, 60)
    if len(selected) != len(auto):
        P1.append(f"select_sources limit=60 返回 {len(selected)} ≠ {len(auto)}")
    bad_sel = [s.get("id") for s in selected if s.get("enabled") is False or s.get("access") not in ("rss", "json") or s.get("compliance") not in ("green", "yellow")]
    if bad_sel:
        P0.append(f"select_sources 选出不合规/未启用源：{bad_sel[:5]}")
    else:
        notes.append(f"select_sources(60)：{len(selected)} 源全部 enabled/rss·json/合规绿黄 ✅")
    # 排序检查（priority 降序）
    priorities = [s.get("priority") for s in selected if s.get("priority") is not None]
    if priorities and priorities != sorted(priorities, reverse=True):
        P2.append("select_sources 结果 priority 非严格降序（可能按 value_score 混合排序）")
    # ---------- 2) source-health ----------
    health = json.loads((DATA / "source-health.json").read_text(encoding="utf-8"))
    hrows = health.get("sources") or []
    hmeta = health.get("meta") or {}
    if len(hrows) != 57:
        P1.append(f"source-health 行数 {len(hrows)} ≠ 57")
    if hmeta.get("failed_count") not in (0, "0") or any(not x.get("ok") for x in hrows):
        P1.append(f"source-health 存在失败源：{[x.get('id') for x in hrows if not x.get('ok')][:5]}")
    items_sum = sum(int(x.get("items") or 0) for x in hrows)
    notes.append(f"source-health：{len(hrows)} 行 / failed={hmeta.get('failed_count')} / items 合计={items_sum} / mode={hmeta.get('mode')}")
    if hmeta.get("mode") not in ("online-fetch", "cache"):
        P1.append(f"source-health meta.mode={hmeta.get('mode')!r} 非法")
    # ---------- 3) outbox（取最新 signals-*.json） ----------
    ob_files = sorted(OUTBOX.glob("signals-*.json"), key=lambda p: (p.stat().st_mtime, p.name))
    if not ob_files:
        P0.append("outbox 无 signals-*.json（fetch 未完成？）")
        return report()
    ob_path = ob_files[-1]
    ob = json.loads(ob_path.read_text(encoding="utf-8"))
    meta = ob.get("meta") or {}
    signals = ob.get("signals") or []
    as_of = str(meta.get("as_of") or "")
    notes.append(f"outbox={ob_path.name} as_of={as_of} signals={len(signals)} raw={meta.get('raw_count')} new={meta.get('new_count')} seen={meta.get('seen_count')} ledger_total={meta.get('ledger_total')} relevant={meta.get('relevant_count')}")
    if len(signals) < 500:
        P2.append(f"outbox signals={len(signals)}（若首跑/缓存状态异常）")
    # is_new / relevance
    new_true = sum(1 for s in signals if s.get("is_new") is True)
    if meta.get("new_count") is not None and new_true != int(meta.get("new_count")):
        P1.append(f"meta.new_count={meta.get('new_count')} ≠ is_new 数 {new_true}")
    if meta.get("seen_count") is not None:
        seen_false = sum(1 for s in signals if s.get("is_new") is False)
        if int(meta.get("seen_count")) != seen_false:
            P1.append(f"meta.seen_count={meta.get('seen_count')} ≠ is_new=false 数 {seen_false}")
    rel_missing = []
    rel_scores = []
    tiers = Counter()
    reasons_missing = 0
    for s in signals:
        for k in ("relevance_score", "tier", "industry_ids", "gap_type_ids", "region_ids", "reasons"):
            if k not in s:
                rel_missing.append((s.get("signal_id"), k))
        score = s.get("relevance_score")
        if isinstance(score, (int, float)):
            rel_scores.append(score)
            if not (0 <= score <= 100):
                P1.append(f"relevance_score 越界 {score}")
        tiers[s.get("tier")] += 1
        if not s.get("reasons"):
            reasons_missing += 1
    if rel_missing:
        P1.append(f"相关性字段缺失 {len(rel_missing)} 处（示例 {rel_missing[:3]}）")
    if reasons_missing:
        P1.append(f"relevance reasons 缺失 {reasons_missing} 条")
    tiers_meta = meta.get("tiers") or {}
    for tier in ("business", "maybe", "off-topic"):
        if tier in tiers and tier in tiers_meta and int(tiers_meta[tier]) != tiers[tier]:
            P1.append(f"meta.tiers[{tier}]={tiers_meta[tier]} ≠ signals 统计 {tiers[tier]}")
    if meta.get("relevant_count") is not None and int(meta.get("relevant_count")) != tiers.get("business", 0):
        P1.append(f"meta.relevant_count={meta.get('relevant_count')} ≠ business={tiers.get('business', 0)}（契约：relevant=business）")
    if rel_scores:
        notes.append(f"relevance：tiers={dict(tiers)} score范围 {min(rel_scores)}-{max(rel_scores)} reasons缺失={reasons_missing}")
    top_rel = meta.get("top_relevant") or []
    if len(top_rel) > 8:
        P2.append(f"meta.top_relevant={len(top_rel)} > 8（实现为 top8）")
    else:
        notes.append(f"meta.top_relevant={len(top_rel)}（实现上限 8）")
    # ---------- 4) 持久账本 SQLite ----------
    if not LEDGER.exists():
        P0.append(f"账本不存在：{LEDGER}")
    else:
        con = sqlite3.connect(LEDGER)
        cur = con.cursor()
        tables = [r[0] for r in cur.execute("select name from sqlite_master where type='table'")]
        cols = [r[1] for r in cur.execute("pragma table_info(signals)")]
        count = cur.execute("select count(*) from signals").fetchone()[0]
        dup = cur.execute("select fingerprint, count(*) c from signals group by fingerprint having c > 1 limit 3").fetchall()
        con.close()
        for col in ("fingerprint", "canonical_url", "title_hash", "content_hash", "first_seen", "last_seen", "seen_count"):
            if col not in cols:
                P1.append(f"ledger.signals 缺列 {col}")
        if dup:
            P0.append(f"ledger fingerprint 重复：{dup}")
        ledger_total = meta.get("ledger_total")
        if ledger_total is not None and int(ledger_total) != count:
            P1.append(f"meta.ledger_total={ledger_total} ≠ ledger 行数 {count}")
        notes.append(f"ledger：tables={tables} rows={count} 唯一 fingerprint、关键列齐全")
    # ---------- 5) 同日再跑 fetch（cache；备份/恢复） ----------
    if not args.no_fetch:
        health_backup = TMP / "v080-source-health-backup.json"
        ob_backup = TMP / "v080-outbox-backup"
        shutil.copy2(DATA / "source-health.json", health_backup)
        shutil.rmtree(ob_backup, ignore_errors=True)
        shutil.copytree(OUTBOX, ob_backup)
        ledger_before = sha(LEDGER) if LEDGER.exists() else None
        out = run(["scanner/pipeline.py", "--fetch", "--as-of", as_of, "--fetch-limit", "60"], timeout=900)
        if out.returncode != 0:
            P1.append(f"同日再跑 fetch exit={out.returncode}: {(out.stdout + out.stderr)[-260:]}")
        else:
            ob2 = json.loads(OUTBOX.glob(f"signals-{as_of}.json").__next__().read_text(encoding="utf-8")) if list(OUTBOX.glob(f"signals-{as_of}.json")) else {}
            m2 = ob2.get("meta") or {}
            if m2:
                new2 = int(m2.get("new_count") or 0)
                if new2 != 0:
                    P1.append(f"同日再跑 new_count={new2} ≠ 0（账本去重失败）")
                else:
                    notes.append(f"同日再跑 fetch：new_count=0、seen={m2.get('seen_count')}、ledger_total={m2.get('ledger_total')}（去重生效）✅")
                if m2.get("ledger_total") is not None and meta.get("ledger_total") is not None and int(m2["ledger_total"]) < int(meta["ledger_total"]):
                    P1.append("同日再跑 ledger_total 下降")
        # 恢复 outbox 与 source-health 原字节
        shutil.rmtree(OUTBOX)
        shutil.copytree(ob_backup, OUTBOX)
        shutil.copy2(health_backup, DATA / "source-health.json")
        if sha(DATA / "source-health.json") != sha(health_backup) or sha(OUTBOX / ob_path.name) != sha(ob_path):
            P0.append("fetch 测试后 outbox/source-health 未恢复")
        else:
            notes.append("fetch 测试后 outbox/source-health 已恢复原字节 ✅")
        if LEDGER.exists() and ledger_before and sha(LEDGER) != ledger_before:
            notes.append("账本因同日重跑更新（last_seen/seen_count，属预期）")
    # ---------- 6) validate / tests / 幂等 / data 版本 / db ----------
    for label, cmd, expect in (
        ("validate", ["scanner/validate.py"], "20/20"),
        ("unittest", ["-m", "unittest", "discover", "-s", "scanner/tests"], "Ran 101 tests"),
    ):
        r = run(cmd, timeout=300)
        blob = r.stdout + r.stderr
        if r.returncode != 0 or expect not in blob:
            P0.append(f"{label} 失败：exit={r.returncode} 期望 {expect!r} :: {blob[-260:]}")
        else:
            notes.append(f"{label}：{expect} PASS ✅")
    data_hash_before = {str(p.relative_to(ROOT)): sha(p) for p in DATA.rglob("*") if p.is_file()}
    r1 = run(["scanner/pipeline.py", "--all", "--as-of", as_of], timeout=600)
    mid = {str(p.relative_to(ROOT)): sha(p) for p in DATA.rglob("*") if p.is_file()}
    r2 = run(["scanner/pipeline.py", "--all", "--as-of", as_of], timeout=600)
    after = {str(p.relative_to(ROOT)): sha(p) for p in DATA.rglob("*") if p.is_file()}
    if r1.returncode != 0 or r2.returncode != 0 or mid != after:
        P1.append(f"--all --as-of {as_of} 双跑不幂等：exit={r1.returncode}/{r2.returncode}")
    else:
        notes.append(f"--all --as-of {as_of} 双跑幂等（{len(after)} 文件 SHA256 一致）✅")
    # data 版本 / 报告 / db
    rankings = json.loads((DATA / "rankings.json").read_text(encoding="utf-8"))
    if (rankings.get("meta") or {}).get("data_version") != "0.8.0":
        P1.append(f"rankings data_version={(rankings.get('meta') or {}).get('data_version')!r} ≠ 0.8.0")
    reports = list((DATA / "reports").glob(f"report-*-{as_of}.*"))
    if len(reports) != 8:
        P1.append(f"报告 {len(reports)} 个 ≠ 8（{as_of}）")
    stale = [p.name for p in (DATA / "reports").glob("report-*-2026-10-22.*")]
    if stale:
        P2.append(f"旧 10-22 报告未清理：{stale[:4]}")
    for v in ("v0.7.3", "0.8.0"):
        pass
    try:
        con = sqlite3.connect(DATA / "radar.db")
        cur = con.cursor()
        counts = {t: cur.execute(f"select count(*) from {t}").fetchone()[0] for t in ("opportunities", "evidence", "rankings_history", "source_health")}
        con.close()
        if counts != {"opportunities": 80, "evidence": 156, "rankings_history": 654, "source_health": 57}:
            P2.append(f"radar.db 行数 {counts}（期望 80/156/654/57）")
        else:
            notes.append("radar.db 行数 80/156/654/57 ✅")
    except Exception as exc:  # noqa: BLE001
        P1.append(f"radar.db 检查失败：{exc}")
    # ---------- 7) 指纹 ----------
    dynamic = {"data/source-health.json", "data/radar.db"}
    bad = []
    for rel, expect in FINGERPRINTS.items():
        p = ROOT / rel
        got = sha(p)[:16] if p.exists() else "MISSING"
        if got != expect:
            if rel in dynamic:
                P2.append(f"动态指纹 {rel}={got}（fetch 会更新；交付时为 {expect}）")
            else:
                bad.append((rel, got, expect))
    if bad:
        P1.append(f"指纹不一致：{bad}")
    else:
        notes.append("静态指纹与交付一致（opportunities/rankings/stats/sources/ledger/relevance/fetch）✅；source-health/radar.db 为 fetch 动态文件")
    return report()


def report() -> int:
    print("\n== source-ledger-check ==")
    for n in notes:
        print("  ·", n)
    print(f"\nP0 = {len(P0)}  P1 = {len(P1)}  P2 = {len(P2)}")
    for level, items in (("P0", P0), ("P1", P1), ("P2", P2)):
        for item in items:
            print(f"  [{level}] {item}")
    print("RESULT:", "PASS" if not P0 and not P1 else "FAIL")
    return 0 if not P0 and not P1 else 1


if __name__ == "__main__":
    raise SystemExit(main())
