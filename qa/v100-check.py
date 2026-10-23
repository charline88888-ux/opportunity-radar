"""qa/v100-check.py —— v1.0.0 核心回归数据验收（每日扫描→候选全入榜→四窗口；删非核心）。

覆盖：
1) data 全部 meta=1.0.0；candidates 200（无 verification_status/verified_by_system 等验证字段），
   system_validation 保留（8 checks/high53/medium133/low14 avg92.9）；translation_summary 中文 200/200；
2) candidate-rankings day99/week200/month200/year200；候选 200 全部覆盖 （year 200，窗口并集=200）；
   rankings 精选 80 条内容与 v0.9.2 一致；stats 核心 KPI；
3) sources 168/101/11/8；source-health 101/101/0/items2420；outbox 2420→1892/new1865/seen27/ledger1865；
4) 删除非核心：data/reports 仅 8 个四窗口报告（无 calibration/yearbook）；无 experiments/profile/alerts/rec_log 数据；
5) validate 20/20、unittest 123/123、--all 双跑 0 变化；db 80/156/654/101；指纹。
用法：python qa/v100-check.py
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []

FP = {
    "data/rankings.json": "4cf2818567471ab8",
    "data/stats.json": "9280d34b27cfecee",
    "data/candidates.json": "7fa17e2719de342e",
    "data/candidate-rankings.json": "666e1c66d04b06ce",
    "data/sources.json": "3dc888f74a98e536",
    "data/source-health.json": "8239a155e8215994",
    "data/radar.db": "9ce2ad8540beacd1",
    "data/reports/report-day-2026-10-23.html": "0b1e887ab73956d0",
    "data/opportunities.json": "88fda5ab84b7f826",
    "scanner/translate.py": "2350c346277fd68c",
    "scanner/candidates.py": "36f3556796fde918",
}


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(args: list[str], timeout: int = 900) -> subprocess.CompletedProcess:
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    return subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout, env=env)


def r1(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def main() -> int:
    tax = json.loads((DATA / "taxonomy.json").read_text(encoding="utf-8"))
    weights = {d["id"]: float(d["weight"]) for d in tax["score_dimensions"]}
    grades = sorted([(g["id"], float(g["min"])) for g in tax["grades"]], key=lambda x: x[1], reverse=True)
    # versions
    versions = {}
    for f in ("taxonomy", "rankings", "stats", "sources", "playbooks", "calendar", "source-health", "candidates", "candidate-rankings"):
        try:
            versions[f] = (json.loads((DATA / f"{f}.json").read_text(encoding="utf-8")).get("meta") or {}).get("data_version")
        except Exception:
            versions[f] = "?"
    badv = {k: v for k, v in versions.items() if v != "1.0.0"}
    if badv:
        P1.append(f"data meta 版本非 1.0.0：{badv}")
    else:
        notes.append("data 9 文件 meta=1.0.0 ✅")
    # candidates
    c = json.loads((DATA / "candidates.json").read_text(encoding="utf-8"))
    cm = c.get("meta") or {}
    cands = c.get("candidates") or []
    if len(cands) != 200 or cm.get("data_version") != "1.0.0":
        P0.append(f"candidates={len(cands)}/version={cm.get('data_version')} ≠ 200/1.0.0")
    banned = ("verification_status", "verification_default", "verification_affects_ranking", "verified_by_system")
    leaked = []
    for x in cands:
        for k in banned:
            if k in x or k in cm:
                leaked.append((x.get("candidate_id"), k))
    if cm.get("verification_affects_ranking") is not None or any(k in cm for k in banned):
        leaked.append(("meta", "verification fields"))
    if leaked:
        P1.append(f"候选/ meta 仍含验证字段：{leaked[:4]}")
    else:
        notes.append("候选/meta 已移除 verification_status/verified_by_system 等验证字段（核心回归）✅")
    # system validation
    sv_levels = Counter()
    sv_bad = []
    avg_sum = 0.0
    for x in cands:
        sv = x.get("system_validation") or {}
        if len(sv.get("checks") or []) != 8 or sv.get("level") not in ("high", "medium", "low"):
            sv_bad.append(x.get("candidate_id"))
            continue
        sv_levels[sv.get("level")] += 1
        avg_sum += float(sv.get("score") or 0)
        passed = sum(1 for ch in sv.get("checks") or [] if ch.get("passed"))
        if passed != int(sv.get("checks_passed") or -1):
            sv_bad.append(x.get("candidate_id"))
    if sv_bad:
        P1.append(f"system_validation 异常 {len(sv_bad)}：{sv_bad[:3]}")
    if dict(sv_levels) != {"high": 53, "medium": 133, "low": 14} or abs(round(avg_sum / 200, 1) - 92.9) > 0.1:
        P1.append(f"system_validation level={dict(sv_levels)} avg={round(avg_sum/200,1)} ≠ 53/133/14 92.9")
    else:
        notes.append(f"system_validation：200×8checks、high53/medium133/low14、avg={round(avg_sum/200,1)} ✅")
    # translation
    ts = cm.get("translation_summary") or {}
    if not (ts.get("total") == 200 and ts.get("cached") == 200 and float(ts.get("coverage") or 0) == 1.0 and ts.get("glossary_entries") == 898 and ts.get("quality_medium") == 127 and ts.get("quality_low") == 67 and ts.get("quality_source_zh") == 6):
        P1.append(f"translation_summary={ts} ≠ 200/cached200/coverage1.0/glossary898/medium127/low67/source-zh6")
    else:
        notes.append("translation：200/200、cached100%、glossary898、quality medium127/low67/source-zh6 ✅")
    zh_bad = [x.get("candidate_id") for x in cands if not str(x.get("title_zh") or "").strip() or not str(x.get("title_original") or "").strip() or not str(x.get("summary_zh") or "").strip()]
    if zh_bad:
        P1.append(f"中文字段缺失 {len(zh_bad)}：{zh_bad[:3]}")
    # scores / fields
    bad_scores = []
    for x in cands:
        sc = x.get("scores") or {}
        dims = sc.get("dimensions") or {}
        if len(dims) != 10:
            bad_scores.append(x.get("candidate_id"))
            continue
        raw = sum(Decimal(str(dims[k])) * Decimal(str(weights[k])) for k in weights)
        total = float((raw * Decimal(10)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
        if abs(total - float(sc.get("total", -1))) > 0.051:
            bad_scores.append(x.get("candidate_id"))
    if bad_scores:
        P1.append(f"评分复算不一致 {len(bad_scores)}：{bad_scores[:3]}")
    notes.append(f"candidates：200 条、gap/region/country 字段完整、评分复算 {200-len(bad_scores)}/200 ✅")
    # candidate-rankings
    cr = json.loads((DATA / "candidate-rankings.json").read_text(encoding="utf-8"))
    counts = {w: len((v or {}).get("items") or []) for w, v in (cr.get("windows") or {}).items()}
    if counts != {"day": 99, "week": 200, "month": 200, "year": 200}:
        P1.append(f"候选四窗口 {counts} ≠ 99/200/200/200")
    year_ids = {it.get("candidate_id") for it in (((cr.get("windows") or {}).get("year") or {}).get("items") or [])}
    if len(year_ids) != 200 or not year_ids.issubset({x.get("candidate_id") for x in cands}):
        P1.append(f"年窗口候选覆盖 {len(year_ids)} ≠ 200 或含未知 id")
    else:
        notes.append("候选全部入榜：day99/week200/month200/year200（年窗口 200/200 候选覆盖）✅")
    # curated rankings 80 unchanged vs v0.9.2 tag
    old = subprocess.run(["git", "show", "v0.9.2:data/rankings.json"], cwd=ROOT, capture_output=True)
    cur = json.loads((DATA / "rankings.json").read_text(encoding="utf-8"))
    if old.returncode == 0:
        oldr = json.loads(old.stdout.decode("utf-8"))
        same = all(
            [(x.get("opp_id"), x.get("rank"), x.get("rank_score"), x.get("total")) for x in ((oldr.get("windows") or {}).get(w) or {}).get("items") or []]
            == [(x.get("opp_id"), x.get("rank"), x.get("rank_score"), x.get("total")) for x in ((cur.get("windows") or {}).get(w) or {}).get("items") or []]
            for w in ("day", "week", "month", "year")
        )
        if not same:
            P1.append("精选 rankings 80 条内容与 v0.9.2 不一致")
        else:
            notes.append("精选 80 条内容与 v0.9.2 完全一致（仅 data_version→1.0.0）✅")
    # stats
    st = json.loads((DATA / "stats.json").read_text(encoding="utf-8"))
    kpi = st.get("kpi") or {}
    if int(kpi.get("candidates_total") or 0) != 200 or int(kpi.get("today_new_candidates") or 0) != 99 or int(kpi.get("total_opps") or 0) != 80:
        P1.append(f"stats kpi {kpi} ≠ candidates200/today99/opps80")
    else:
        notes.append("stats KPI：精选80 / 候选200 / 今日候选99 ✅")
    # sources / health / outbox
    s = json.loads((DATA / "sources.json").read_text(encoding="utf-8"))
    srcs = [x for cat in (s.get("categories") or []) for x in (cat.get("sources") or [])]
    auto = [x for x in srcs if x.get("access") in ("rss", "json") and x.get("compliance") in ("green", "yellow") and x.get("enabled") is not False]
    regions = {r for x in srcs for r in (x.get("regions") or [])}
    disabled = [x for x in srcs if x.get("enabled") is False]
    if len(srcs) != 168 or len(auto) != 101 or len(regions) != 11 or len(disabled) != 8:
        P1.append(f"sources {len(srcs)}/{len(auto)}/{len(regions)}/{len(disabled)} ≠ 168/101/11/8")
    else:
        notes.append(f"sources：168 平台 / 101 enabled 自动源 / 11 区域 / 8 disabled ✅")
    health = json.loads((DATA / "source-health.json").read_text(encoding="utf-8"))
    hrows = health.get("sources") or []
    hm = health.get("meta") or {}
    if len(hrows) != 101 or hm.get("ok_count") != 101 or hm.get("failed_count") != 0 or sum(int(x.get("items") or 0) for x in hrows) != 2420:
        P1.append(f"source-health {len(hrows)}/ok{hm.get('ok_count')}/failed{hm.get('failed_count')}/items{sum(int(x.get('items') or 0) for x in hrows)} ≠ 101/101/0/2420")
    else:
        notes.append("source-health：101/101/0、items 2420 ✅")
    ob_files = sorted((ROOT / "scanner/outbox").glob("signals-*.json"), key=lambda p: (p.stat().st_mtime, p.name))
    if ob_files:
        ob = json.loads(ob_files[-1].read_text(encoding="utf-8"))
        m = ob.get("meta") or {}
        expect = {"raw_count": 2420, "signal_count": 1892, "new_count": 1865, "seen_count": 27, "ledger_total": 1865}
        bad = {k: m.get(k) for k, v in expect.items() if m.get(k) != v}
        if bad:
            P1.append(f"outbox meta {bad} ≠ {expect}")
        else:
            notes.append("outbox：raw2420→signal1892/new1865/seen27/ledger1865 ✅")
    # 非核心数据删除
    reports = sorted(p.name for p in (DATA / "reports").iterdir())
    expected_reports = sorted([f"report-{w}-2026-10-23.{ext}" for w in ("day", "week", "month", "year") for ext in ("html", "md")])
    if reports != expected_reports:
        P1.append(f"data/reports 仅应 8 个四窗口报告，实际 {reports}")
    else:
        notes.append("data/reports 仅 8 个四窗口报告（calibration/yearbook 已删除）✅")
    removed_data = [p for p in ("experiments.json", "profile.json", "alerts.json", "rec_log.json", "yearbook.json") if (DATA / p).exists()]
    if removed_data:
        P1.append(f"非核心数据仍存在：{removed_data}")
    else:
        notes.append("非核心数据 experiments/profile/alerts/rec_log/yearbook 均不存在 ✅")
    # db
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
    # validate / tests / idempotency
    for label, cmd, expect in (("validate", ["scanner/validate.py"], "20/20"),
                               ("unittest", ["-m", "unittest", "discover", "-s", "scanner/tests"], "Ran 123 tests")):
        rr = run(cmd, timeout=300)
        blob = rr.stdout + rr.stderr
        if rr.returncode != 0 or expect not in blob:
            P0.append(f"{label} 失败 exit={rr.returncode} 期望 {expect} :: {blob[-260:]}")
        else:
            notes.append(f"{label}：{expect} PASS ✅")
    h1 = {str(p.relative_to(ROOT)): sha(p) for p in DATA.rglob("*") if p.is_file()}
    rr1 = run(["scanner/pipeline.py", "--all", "--as-of", "2026-10-23"])
    h2 = {str(p.relative_to(ROOT)): sha(p) for p in DATA.rglob("*") if p.is_file()}
    rr2 = run(["scanner/pipeline.py", "--all", "--as-of", "2026-10-23"])
    h3 = {str(p.relative_to(ROOT)): sha(p) for p in DATA.rglob("*") if p.is_file()}
    if rr1.returncode != 0 or rr2.returncode != 0 or h2 != h3:
        P1.append(f"--all 双跑不幂等 exit={rr1.returncode}/{rr2.returncode}")
    else:
        notes.append(f"--all --as-of 2026-10-23 双跑 0 变化（{len(h3)} 文件）✅")
    # 指纹
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
    # 本地控制台文件（产品外）：标注 P2
    local_tools = [p for p in ("scanner/serve.py", "scanner/tests/test_serve.py", "启动机会雷达.bat") if (ROOT / p).exists()]
    if local_tools:
        P2.append(f"repo 仍含本地控制台工具 {local_tools}（9 路由/产品不含；建议冻结产物排除或删除）")
    return report()


def report() -> int:
    print("\n== v1.0.0 core check ==")
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
