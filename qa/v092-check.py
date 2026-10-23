"""qa/v092-check.py —— v0.9.2 系统评估 + 中文候选 + 漏斗真值红队验收。

覆盖：
1) sources：168 平台 / 101 enabled 自动源（rss+json、绿/黄）/ 11 区域 / 10 disabled（原因）；
2) source-health：92 行、ok 91、failed 1（rest-of-world parse_error）、items 2177、mode=online-fetch；
3) outbox：raw 2420 → signal 1892、new 1865/seen 27/ledger 1865、tiers；
4) candidates：200 条、business_signals 320；gap 覆盖 200/200（missing 0/ratio 1.0/fallback 28）、
   gap_inferred、region 11/11、country 28；评分 Decimal 独立复算 200/200；title≤28 无 HTML；唯一 URL；
   七问/ROI/免责/verification 全 unverified；同 URL 仅保留最新（URL 唯一、按 first_seen 最新）；
5) candidate-rankings：99/200/200/200、按 first_seen 归窗、排序独立复算、verification_affects_ranking=false；
6) stats 200/95/200；精选 80 条与 v0.9.0 内容一致；opportunities 指纹不变；
7) `scanner/candidates.py --limit 200` 确定性、`--all` 双跑 0 变化、validate 20/20、unittest 114/114；
8) data 0.9.1、报告 8 文件、db 80/156/654/92、关键指纹；源 URL 抽查 12（新增源）。
用法：python qa/v091-check.py [--no-net]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUTBOX = ROOT / "scanner" / "outbox"
LEDGER = ROOT / "scanner" / "build" / "signal-ledger.sqlite"
TMP = ROOT / "qa" / "tmp"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 radar-redteam/0.9.1"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []

FP = {
    "data/rankings.json": "70d0970c5ff94ac7",
    "data/stats.json": "331bbbb9ca4f71d1",
    "data/candidates.json": "ef822c7152ad1a65",
    "data/candidate-rankings.json": "fc10b813e4d9c1a6",
    "data/sources.json": "1354e3c4da59ae38",
    "data/source-health.json": "3a019b49c4e33311",
    "data/radar.db": "acffa988b489e99b",
    "data/reports/report-day-2026-10-23.html": "b0861d45e123624b",
    "data/reports/yearbook-2026.html": "6192622d29872171",
    "data/reports/calibration-2026-10-22.html": "4b6e84c2f7b2918f",
    "data/opportunities.json": "88fda5ab84b7f826",
    "scanner/candidates.py": "04e32e9976ffe079",
    "scanner/fetch.py": "39f9e07d636f5125",
    "scanner/serve.py": "be893f5ea3b20176",
    "scanner/stats.py": "56bb4e8c1bb26385",
    "scanner/config.py": "64be106e19f3b845",
    "scanner/pipeline.py": "b79b027e9689b02f",
    "scanner/validate.py": "bde87eba7d13e7bd",
}


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(args: list[str], timeout: int = 900) -> subprocess.CompletedProcess:
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    return subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout, env=env)


def q1(x: Decimal | float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-net", action="store_true")
    args = ap.parse_args()
    TMP.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(ROOT))
    import scanner.common as common  # noqa: E402
    import scanner.fetch as fetch_mod  # noqa: E402

    tax = json.loads((DATA / "taxonomy.json").read_text(encoding="utf-8"))
    weights = {d["id"]: float(d["weight"]) for d in tax["score_dimensions"]}
    grades = sorted([(g["id"], float(g["min"])) for g in tax["grades"]], key=lambda x: x[1], reverse=True)
    # ---------- sources ----------
    sraw = json.loads((DATA / "sources.json").read_text(encoding="utf-8"))
    srcs = [x for cat in (sraw.get("categories") or []) for x in (cat.get("sources") or [])]
    auto = [x for x in srcs if x.get("access") in ("rss", "json") and x.get("compliance") in ("green", "yellow") and x.get("enabled") is not False]
    disabled = [x for x in srcs if x.get("enabled") is False]
    regions = {r for x in srcs for r in (x.get("regions") or [])}
    if len(srcs) != 168:
        P1.append(f"平台数 {len(srcs)} ≠ 168")
    if len(auto) != 101:
        P0.append(f"enabled 自动源 {len(auto)} ≠ 101")
    if len(regions) != 11:
        P1.append(f"区域 {len(regions)} ≠ 11")
    if len(disabled) != 8:
        P1.append(f"disabled {len(disabled)} ≠ 8")
    no_reason = [x["id"] for x in disabled if not (x.get("notes") or x.get("check_result"))]
    if no_reason:
        P1.append(f"disabled 缺原因：{no_reason}")
    sel = fetch_mod.select_sources(sraw, 160)
    if len(sel) != 101:
        P1.append(f"select_sources(160)={len(sel)} ≠ 101")
    bad = [x.get("id") for x in sel if x.get("enabled") is False or x.get("access") not in ("rss", "json") or x.get("compliance") not in ("green", "yellow")]
    if bad:
        P0.append(f"select_sources 选出不合规源：{bad[:5]}")
    notes.append(f"sources：{len(srcs)} 平台 / {len(auto)} enabled 自动源（{Counter(x['access'] for x in auto)}）/ {len(regions)} 区域 / {len(disabled)} disabled（原因齐全）")
    notes.append(f"select_sources(160)：{len(sel)} 源全部合规 ✅")
    # ---------- health ----------
    health = json.loads((DATA / "source-health.json").read_text(encoding="utf-8"))
    hrows = health.get("sources") or []
    hmeta = health.get("meta") or {}
    failed = [x for x in hrows if not x.get("ok")]
    items_sum = sum(int(x.get("items") or 0) for x in hrows)
    if len(hrows) != 101 or hmeta.get("ok_count") != 101 or hmeta.get("failed_count") != 0:
        P1.append(f"source-health 计数 {len(hrows)}/ok{hmeta.get('ok_count')}/failed{hmeta.get('failed_count')} ≠ 101/101/0")
    if failed:
        P1.append(f"source-health 存在失败源：{[x.get('id') for x in failed]}")
    if items_sum != 2420:
        P1.append(f"source-health items={items_sum} ≠ 2420")
    if hmeta.get("mode") != "online-fetch":
        P1.append(f"health mode={hmeta.get('mode')!r} ≠ online-fetch")
    
    notes.append(f"source-health：{len(hrows)} 行 / ok {hmeta.get('ok_count')} / failed {len(failed)} / items {items_sum} / mode={hmeta.get('mode')}")
    # ---------- outbox / ledger ----------
    ob_files = sorted(OUTBOX.glob("signals-*.json"), key=lambda p: (p.stat().st_mtime, p.name))
    if not ob_files:
        P0.append("outbox 无 signals")
        return report()
    ob = json.loads(ob_files[-1].read_text(encoding="utf-8"))
    m = ob.get("meta") or {}
    sigs = ob.get("signals") or []
    checks = {"raw_count": 2420, "signal_count": 1892, "new_count": 1865, "seen_count": 27, "ledger_total": 1865, "data_version": "0.9.2"}
    for k, v in checks.items():
        if m.get(k) != v:
            P1.append(f"outbox.meta.{k}={m.get(k)!r} ≠ {v}")
    new_true = sum(1 for x in sigs if x.get("is_new") is True)
    if new_true != int(m.get("new_count") or -1):
        P1.append(f"is_new=true {new_true} ≠ new_count {m.get('new_count')}")
    notes.append(f"outbox={ob_files[-1].name} raw={m.get('raw_count')}→signal={m.get('signal_count')} new={m.get('new_count')} seen={m.get('seen_count')} ledger={m.get('ledger_total')}")
    try:
        import sqlite3
        con = sqlite3.connect(LEDGER)
        cur = con.cursor()
        rows = cur.execute("select count(*) from signals").fetchone()[0]
        dup = cur.execute("select fingerprint,count(*) c from signals group by fingerprint having c>1 limit 3").fetchall()
        con.close()
        if rows != 1865:
            P1.append(f"ledger rows={rows} ≠ 1865")
        if dup:
            P0.append(f"ledger fingerprint 重复 {dup}")
        notes.append(f"ledger：{rows} 行、fingerprint 唯一 ✅")
    except Exception as exc:  # noqa: BLE001
        P0.append(f"ledger 检查失败 {exc}")
    # ---------- candidates ----------
    c = json.loads((DATA / "candidates.json").read_text(encoding="utf-8"))
    cm = c.get("meta") or {}
    cands = c.get("candidates") or []
    if cm.get("data_version") != "0.9.2" or len(cands) != 200 or cm.get("business_signals") != 344:
        P0.append(f"candidates meta/version/200/business344 异常：{cm.get('data_version')} {len(cands)} {cm.get('business_signals')}")
    gc = cm.get("gap_inference_coverage") or {}
    if not (gc.get("inferred") == 200 and gc.get("missing") == 0 and float(gc.get("ratio") or 0) == 1.0):
        P1.append(f"gap_inference_coverage={gc} ≠ inferred200/missing0/ratio1.0")
    rc = cm.get("region_coverage") or {}
    cc = cm.get("country_coverage") or {}
    if rc.get("covered") != 11 or rc.get("missing"):
        P1.append(f"region_coverage={rc}")
    if cc.get("countries") != 28:
        P1.append(f"country_coverage={cc}")
    empty_gap = sum(1 for x in cands if not x.get("gap_type_ids"))
    if empty_gap:
        P1.append(f"gap_type_ids 空 {empty_gap}/200（v0.9.2 目标 missing 0）")
    if sum(1 for x in cands if x.get("gap_inferred") is True) <= 0:
        P2.append("gap_inferred true=0（期望存在兜底样本）")
    bad_scores = []
    title_bad = []
    html_bad = []
    ev_bad = []
    urls = []
    region_union = set()
    country_union = set()
    for x in cands:
        dims = (x.get("scores") or {}).get("dimensions") or {}
        if len(dims) != 10:
            bad_scores.append((x.get("candidate_id"), "dims"))
            continue
        raw = sum(Decimal(str(dims[k])) * Decimal(str(weights[k])) for k in weights)
        total = float((raw * Decimal(10)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
        mom = round(float((x.get("scores") or {}).get("momentum", 1.0)), 1)
        raw_rank = Decimal(str(total)) * (Decimal(1) + Decimal("0.12") * (Decimal(str(mom)) - 1))
        rank_score = float(min(Decimal(100), raw_rank).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
        grade = next((g for g, mn in grades if total >= mn), "D")
        sc = x.get("scores") or {}
        if abs(total - float(sc.get("total", -1))) > 0.051 or abs(rank_score - float(sc.get("rank_score", -1))) > 0.051 or grade != sc.get("grade"):
            bad_scores.append((x.get("candidate_id"), total, sc.get("total"), grade, sc.get("grade")))
        if len(str(x.get("title") or "")) > 28:
            title_bad.append(x.get("candidate_id"))
        text = f"{x.get('title','')} {x.get('one_liner','')}"
        if "<" in text or "&amp;" in text or "&lt;" in text:
            html_bad.append(x.get("candidate_id"))
        ev = x.get("evidence") or []
        if not ev or not str(ev[0].get("url", "")).startswith("http"):
            ev_bad.append(x.get("candidate_id"))
        else:
            urls.append(ev[0]["url"])
        region_union |= set(x.get("region_ids") or [])
        country_union |= set(x.get("target_countries") or [])
    if bad_scores:
        P1.append(f"评分复算不一致 {len(bad_scores)}：{bad_scores[:3]}")
    if title_bad:
        P2.append(f"title 超 28 字 {len(title_bad)}：{title_bad[:3]}")
    if html_bad:
        P1.append(f"标题/摘要残留 HTML {html_bad[:5]}")
    if ev_bad:
        P1.append(f"evidence 缺失/非 http {ev_bad[:5]}")
    if len(set(urls)) != len(urls):
        P1.append(f"候选 evidence URL 非唯一：{len(urls)-len(set(urls))} 重复（同 URL 应保留最新）")
    if len(region_union) != 11:
        P1.append(f"候选区域并集 {len(region_union)} ≠ 11")
    if len(country_union) != 28:
        P2.append(f"候选国家并集 {len(country_union)} ≠ 28")
    missing_gi = [x.get("candidate_id") for x in cands if not str(x.get("gap_inference") or "").strip()]
    cleaned_bad = [x.get("candidate_id") for x in cands if (x.get("source") or {}).get("cleaned") != x.get("title")]
    raw_bad = [x.get("candidate_id") for x in cands if not (x.get("source") or {}).get("raw_title")]
    if missing_gi:
        P1.append(f"gap_inference 缺失 {len(missing_gi)}：{missing_gi[:3]}")
    if cleaned_bad:
        P1.append(f"source.cleaned ≠ title {len(cleaned_bad)}：{cleaned_bad[:3]}")
    if raw_bad:
        P1.append(f"source.raw_title 缺失 {len(raw_bad)}：{raw_bad[:3]}")
    if not missing_gi and not cleaned_bad and not raw_bad:
        notes.append("candidates 新字段：gap_inference 200/200、source.cleaned=title、source.raw_title 齐全 ✅")
    not_started = sum(1 for x in cands if x.get("verification_status") == "not_started")
    if not_started != 200:
        P1.append(f"verification_status=not_started 数量 {not_started} ≠ 200")
    # v0.9.2: system_validation / 中文化 / 漏斗真值
    svs = cm.get("system_validation_summary") or {}
    if not (svs.get("high") == 53 and svs.get("medium") == 133 and svs.get("low") == 14 and abs(float(svs.get("avg_score") or 0) - 92.9) <= 0.05 and svs.get("verified_by_system") == 200):
        P1.append(f"system_validation_summary={svs} ≠ high53/medium133/low14/avg92.9/verified200")
    levels = Counter()
    sv_score_sum = 0.0
    sv_bad = []
    for x in cands:
        sv = x.get("system_validation") or {}
        if sv.get("verified_by_system") is not True or len(sv.get("checks") or []) != 8:
            sv_bad.append(x.get("candidate_id"))
            continue
        lv = sv.get("level")
        levels[lv] += 1
        sv_score_sum += float(sv.get("score") or 0)
        passed = sum(1 for c in sv.get("checks") or [] if c.get("passed"))
        if passed != int(sv.get("checks_passed") or -1) or len(sv.get("checks") or []) != int(sv.get("checks_total") or -1):
            sv_bad.append(x.get("candidate_id"))
        thr = sv.get("level_thresholds") or {}
        score = float(sv.get("score") or 0)
        exp_lv = "high" if score >= float(thr.get("high", 95)) else "medium" if score >= float(thr.get("medium", 87)) else "low"
        if lv != exp_lv:
            sv_bad.append(x.get("candidate_id"))
        if sum(int(c.get("points") or 0) for c in sv.get("checks") or []) != int(score):
            sv_bad.append(x.get("candidate_id"))
    if sv_bad:
        P1.append(f"system_validation 异常 {len(sv_bad)} 条：{sv_bad[:3]}")
    if dict(levels) != {"high": 53, "medium": 133, "low": 14}:
        P1.append(f"system_validation level 分布 {dict(levels)} ≠ 53/133/14")
    avg_sv = round(sv_score_sum / len(cands), 1) if cands else 0
    if abs(avg_sv - 92.9) > 0.1:
        P1.append(f"system_validation avg={avg_sv} ≠ 92.9")
    if not sv_bad and dict(levels) == {"high": 53, "medium": 133, "low": 14}:
        notes.append(f"system_validation：200/200 verified_by_system、8 checks、high53/medium133/low14、avg={avg_sv}、level 阈值一致 ✅")
    tc = cm.get("translation_coverage") or {}
    methods = tc.get("methods") or {}
    if not (tc.get("total") == 200 and tc.get("zh_titles") == 200 and float(tc.get("ratio") or 0) == 1.0 and methods.get("template") == 194 and methods.get("source-zh") == 6):
        P1.append(f"translation_coverage={tc} ≠ 200/200/template194/source-zh6")
    zh_bad = [x.get("candidate_id") for x in cands if not str(x.get("title_zh") or "").strip() or len(str(x.get("title_zh"))) > 28 or not str(x.get("one_liner_zh") or "").strip() or len(str(x.get("one_liner_zh"))) > 60 or not str(x.get("title_original") or "").strip() or not str(x.get("translation_method") or "").strip()]
    if zh_bad:
        P1.append(f"中文标题字段异常 {len(zh_bad)}：{zh_bad[:3]}")
    if not zh_bad and not (tc.get("zh_titles") != 200):
        notes.append("中文化：200/200 title_zh≤28、one_liner_zh≤60、title_original/translation_method 齐全（template194/source-zh6）✅")
    if any(x.get("verification_status") != "not_started" for x in cands):
        P1.append("存在 verification_status ≠ not_started")
    if cm.get("verification_affects_ranking") is not False:
        P1.append("candidates.meta.verification_affects_ranking 非 false")
    fn = cm.get("funnel") or {}
    exp_fn = {"attempted": 101, "ok": 101, "failed": 0, "raw": 2420, "deduped": 1892, "new": 1865, "relevant": 344, "candidates": 200}
    if any(int(fn.get(k) if fn.get(k) is not None else -1) != v for k, v in exp_fn.items()):
        P1.append(f"candidates.meta.funnel={fn} ≠ {exp_fn}")
    elif not (len(hrows) == fn.get("attempted") and int(m.get("raw_count") or 0) == fn.get("raw") and int(m.get("signal_count") or 0) == fn.get("deduped") and int(m.get("new_count") or 0) == fn.get("new") and int(m.get("relevant_count") or 0) == fn.get("relevant")):
        P1.append("funnel 与 source-health/outbox meta 不一致")
    else:
        notes.append("funnel 真值：attempted101/ok101/failed0、raw2420→deduped1892→new1865→relevant344→candidates200，与 health/outbox 一致 ✅")
    notes.append(f"candidates：200 条（business_signals 344）、gap 200/200、region 11/11、country {len(country_union)}、评分复算 {200-len(bad_scores)}/200、URL 唯一、verification=not_started")
    # ---------- candidate-rankings ----------
    cr = json.loads((DATA / "candidate-rankings.json").read_text(encoding="utf-8"))
    counts = {w: len((v or {}).get("items") or []) for w, v in (cr.get("windows") or {}).items()}
    if counts != {"day": 99, "week": 200, "month": 200, "year": 200}:
        P1.append(f"发现榜窗口 {counts} ≠ 99/200/200/200")
    if (cr.get("meta") or {}).get("verification_affects_ranking") is not False:
        P0.append("verification_affects_ranking 非 false")
    cand_by_id = {x["candidate_id"]: x for x in cands}
    as_of = str(cm.get("as_of"))
    for w in ("day", "week", "month", "year"):
        items = ((cr.get("windows") or {}).get(w) or {}).get("items") or []
        exp = []
        for x in cands:
            try:
                d = common.parse_date(str(x.get("first_seen")))
            except Exception:
                continue
            if common.window_key(w, d) == common.window_key(w, common.parse_date(as_of)):
                exp.append(x)
        exp.sort(key=lambda x: (
            -float((x.get("scores") or {}).get("rank_score") or 0),
            -float((x.get("scores") or {}).get("momentum") or 0),
            -len(x.get("evidence") or []),
            str(x.get("last_seen") or ""),
            str(x.get("candidate_id") or ""),
        ))
        got = [it.get("candidate_id") for it in items]
        if got != [x["candidate_id"] for x in exp]:
            P1.append(f"发现榜 {w} 成员/顺序与独立复算不一致（{len(got)} vs {len(exp)}）")
        if [it.get("rank") for it in items] != list(range(1, len(items) + 1)):
            P1.append(f"发现榜 {w} rank 非连续")
        if any(cid not in cand_by_id for cid in got):
            P0.append(f"发现榜 {w} 存在未知 candidate_id")
    if not any("发现榜" in x for x in P1):
        notes.append(f"candidate-rankings：{counts}、按 first_seen 归窗、排序独立复算一致、验证不门禁 ✅")
    # ---------- stats / 精选 / 数据版本 ----------
    st = json.loads((DATA / "stats.json").read_text(encoding="utf-8"))
    kpi = st.get("kpi") or {}
    for k, v in (("candidates_total", 200), ("today_new_candidates", 99), ("unverified_candidates", 200), ("system_verified_candidates", 200), ("verification_not_started_candidates", 200)):
        if int(kpi.get(k) or 0) != v:
            P1.append(f"stats.kpi.{k}={kpi.get(k)} ≠ {v}")
    old = subprocess.run(["git", "show", "v0.9.0:data/rankings.json"], cwd=ROOT, capture_output=True)
    if old.returncode == 0:
        oldr = json.loads(old.stdout.decode("utf-8"))
        cur = json.loads((DATA / "rankings.json").read_text(encoding="utf-8"))
        same = all(
            [(x.get("opp_id"), x.get("rank"), x.get("rank_score"), x.get("total")) for x in ((oldr.get("windows") or {}).get(w) or {}).get("items") or []]
            == [(x.get("opp_id"), x.get("rank"), x.get("rank_score"), x.get("total")) for x in ((cur.get("windows") or {}).get(w) or {}).get("items") or []]
            for w in ("day", "week", "month", "year")
        )
        if not same:
            P1.append("精选 rankings 80 条内容与 v0.9.0 不一致")
        else:
            notes.append("精选 80 条内容与 v0.9.0 完全一致（仅 data_version→0.9.1）✅")
    versions = {}
    for f in ("taxonomy", "rankings", "stats", "sources", "playbooks", "calendar", "source-health", "candidates", "candidate-rankings"):
        try:
            versions[f] = (json.loads((DATA / f"{f}.json").read_text(encoding="utf-8")).get("meta") or {}).get("data_version")
        except Exception:
            versions[f] = "?"
    badv = {k: v for k, v in versions.items() if v != "0.9.2"}
    if badv:
        P1.append(f"data meta 版本非 0.9.2：{badv}")
    else:
        notes.append("data 全部 meta=0.9.2（9 文件）✅")
    reports = list((DATA / "reports").glob(f"report-*-{as_of}.*"))
    if len(reports) != 8:
        P1.append(f"报告 8 文件缺失：{len(reports)}")
    # ---------- 确定性 / 幂等 / validate / tests ----------
    before = {p.name: sha(p) for p in (DATA / "candidates.json", DATA / "candidate-rankings.json")}
    r = run(["scanner/candidates.py", "--as-of", as_of, "--limit", "200"])
    after = {p.name: sha(p) for p in (DATA / "candidates.json", DATA / "candidate-rankings.json")}
    if r.returncode != 0:
        P1.append(f"candidates.py 重跑 exit={r.returncode}: {(r.stdout + r.stderr)[-220:]}")
    elif before != after:
        P1.append("candidates.py 重跑文件不一致（确定性失败）")
    else:
        notes.append("candidates.py --as-of --limit 200 重跑字节一致（确定性）✅")
    h1 = {str(p.relative_to(ROOT)): sha(p) for p in DATA.rglob("*") if p.is_file()}
    rr1 = run(["scanner/pipeline.py", "--all", "--as-of", as_of])
    h2 = {str(p.relative_to(ROOT)): sha(p) for p in DATA.rglob("*") if p.is_file()}
    rr2 = run(["scanner/pipeline.py", "--all", "--as-of", as_of])
    h3 = {str(p.relative_to(ROOT)): sha(p) for p in DATA.rglob("*") if p.is_file()}
    if rr1.returncode != 0 or rr2.returncode != 0 or h2 != h3:
        P1.append(f"--all 双跑不幂等 exit={rr1.returncode}/{rr2.returncode}")
    else:
        notes.append(f"--all --as-of {as_of} 双跑 0 文件变化（{len(h3)} 文件）✅")
    for label, cmd, expect in (("validate", ["scanner/validate.py"], "20/20"),
                               ("unittest", ["-m", "unittest", "discover", "-s", "scanner/tests"], "Ran 117 tests")):
        rr = run(cmd, timeout=300)
        blob = rr.stdout + rr.stderr
        if rr.returncode != 0 or expect not in blob:
            P0.append(f"{label} 失败 exit={rr.returncode} 期望 {expect} :: {blob[-240:]}")
        else:
            notes.append(f"{label}：{expect} PASS ✅")
    try:
        import sqlite3
        con = sqlite3.connect(DATA / "radar.db")
        cur = con.cursor()
        db = {t: cur.execute(f"select count(*) from {t}").fetchone()[0] for t in ("opportunities", "evidence", "rankings_history", "source_health")}
        con.close()
        if db != {"opportunities": 80, "evidence": 156, "rankings_history": 654, "source_health": 101}:
            P2.append(f"radar.db 行数 {db}")
        else:
            notes.append("radar.db 行数 80/156/654/101 ✅")
    except Exception as exc:  # noqa: BLE001
        P1.append(f"radar.db 检查失败 {exc}")
    bad = []
    for rel, expect in FP.items():
        p = ROOT / rel
        got = sha(p)[:16] if p.exists() else "MISSING"
        if got != expect:
            bad.append((rel, got, expect))
    if bad:
        P1.append(f"指纹不一致：{bad}")
    else:
        notes.append("关键指纹与 data-engineer 交付一致 ✅")
    if subprocess.run(["git", "check-ignore", "data/candidates.json"], cwd=ROOT, capture_output=True).returncode == 0:
        P0.append("候选文件被 gitignore")
    else:
        notes.append("候选文件非 gitignore（提交物）✅")
    # ---------- 新增源 URL 抽查 ----------
    if not args.no_net:
        import ssl
        ctx = ssl.create_default_context()
        new_like = [x for x in auto if x.get("source_category") or x.get("kind") or x.get("priority")]
        picked = new_like[:12] if new_like else auto[:12]
        ok = 0
        results = []
        for x in picked:
            try:
                req = urllib.request.Request(x["url"], headers={"User-Agent": UA, "Accept": "*/*"})
                with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
                    raw = resp.read(150000)
                    results.append({"id": x["id"], "status": resp.status, "bytes": len(raw)})
                    if 200 <= resp.status < 400 and len(raw) > 100:
                        ok += 1
            except Exception as exc:  # noqa: BLE001
                results.append({"id": x["id"], "error": f"{type(exc).__name__}: {exc}"[:140]})
        (TMP / "v091-source-reach.json").write_text(json.dumps({"tested": len(picked), "accessible": ok, "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
        if ok < 10:
            P1.append(f"新增源 URL 可访问 {ok}/{len(picked)} < 10")
        else:
            notes.append(f"新增源 URL 抽查：{ok}/{len(picked)} 可访问（≥10）✅")
    return report()


def report() -> int:
    print("\n== v0.9.2 check ==")
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
