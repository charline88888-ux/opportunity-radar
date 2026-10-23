"""qa/candidates-check.py —— v0.9.0 自动候选 + 发现榜红队验收。

覆盖：
1) data/candidates.json：meta 0.9.0/200/business184/maybe16/dropped0；字段完整性（candidate_id/title≤28/one_liner/
   industry/gap/region/target_countries/source/evidence≥1/七问草稿/ROI估算/scores 10维/confidence/status/verification/
   first_seen/last_seen/disclaimer）；200 全 unverified；**独立按 docs/12 公式复算 total/rank_score/grade**；
2) data/candidate-rankings.json：四窗口 21/124/168/199、按 first_seen 归窗、独立复算窗口成员与排序（rank_score/
   momentum/evidence/last_seen/candidate_id）；items candidate_id 存在/唯一/rank 连续；verification_affects_ranking=false；
3) stats KPI candidates_total/today_new_candidates/unverified_candidates；精选 rankings.json 80 条内容与 v0.8.0 一致
   （仅 meta.data_version 0.9.0）、opportunities 指纹不变；
4) 生成确定性：`scanner/candidates.py --as-of` 独立跑 → 两文件字节一致；pipeline `--candidates` 可跑；
5) `--all --as-of 2026-10-23` 双跑 0 文件变化；validate 20/20、unittest 109/109；data 全部 0.9.0、报告 10-23、db 行数；
6) 指纹与 data-engineer 交付值；候选文件非 gitignore；≥10 条候选 evidence URL 实测可访问。
用法：python qa/candidates-check.py [--no-net]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TMP = ROOT / "qa" / "tmp"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 radar-redteam/0.9"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []

FINGERPRINTS = {
    "data/rankings.json": "612ac90f132ccbd4",
    "data/stats.json": "09321616a713f987",
    "data/candidates.json": "360c473eb4e5111e",
    "data/candidate-rankings.json": "dd3cc40f8815e205",
    "data/sources.json": "3b164cae70990742",
    "data/source-health.json": "e9a9e5d943f88321",
    "data/radar.db": "a06bd31a8fd7c64a",
    "data/reports/yearbook-2026.html": "9849b0fd00cc2952",
    "data/reports/calibration-2026-10-22.html": "e895743bab7cd154",
    "data/reports/report-day-2026-10-23.html": "087f443f17e830f3",
    "scanner/candidates.py": "64896f3e9280822b",
    "scanner/pipeline.py": "aae59a9d989a45be",
    "scanner/validate.py": "bde87eba7d13e7bd",
    "scanner/stats.py": "808a81ef92d19557",
    "scanner/config.py": "a97dddb44d4e9f8a",
    "data/opportunities.json": "88fda5ab84b7f826",
}


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def r1(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def run(args: list[str], timeout: int = 600) -> subprocess.CompletedProcess:
    import os
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    return subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout, env=env)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-net", action="store_true")
    args = ap.parse_args()
    TMP.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(ROOT))
    import scanner.common as common  # noqa: E402

    tax = json.loads((DATA / "taxonomy.json").read_text(encoding="utf-8"))
    weights = {d["id"]: float(d["weight"]) for d in tax["score_dimensions"]}
    grades = sorted([(g["id"], float(g["min"])) for g in tax["grades"]], key=lambda x: x[1], reverse=True)
    c = json.loads((DATA / "candidates.json").read_text(encoding="utf-8"))
    cr = json.loads((DATA / "candidate-rankings.json").read_text(encoding="utf-8"))
    cands = c.get("candidates") or []
    meta = c.get("meta") or {}
    as_of = str(meta.get("as_of") or "")
    # ---------- 1) candidates ----------
    if meta.get("data_version") != "0.9.0":
        P0.append(f"candidates.meta.data_version={meta.get('data_version')!r} ≠ 0.9.0")
    if meta.get("total") != 200 or len(cands) != 200:
        P0.append(f"candidates total={len(cands)}（meta {meta.get('total')}）≠ 200")
    if int(meta.get("dropped_duplicates") or 0) != 0:
        P2.append(f"dropped_duplicates={meta.get('dropped_duplicates')}")
    ids = [x.get("candidate_id") for x in cands]
    if len(set(ids)) != len(ids):
        P0.append("candidate_id 有重复")
    req = ["candidate_id", "title", "one_liner", "industry_ids", "gap_type_ids", "region_ids", "target_countries",
           "source", "evidence", "seven_questions", "roi", "scores", "confidence", "status", "verification_status",
           "first_seen", "last_seen", "disclaimer"]
    missing = Counter()
    bad_scores = []
    bad_dates = []
    unverified = 0
    empty_gap = []
    for x in cands:
        for k in req:
            if k not in x:
                missing[k] += 1
        if len(str(x.get("title") or "")) > 28:
            P2.append(f"title 超 28 字：{x.get('candidate_id')}")
        if not (x.get("industry_ids") and x.get("region_ids")):
            P1.append(f"{x.get('candidate_id')} industry_ids/region_ids 为空")
        if not x.get("gap_type_ids"):
            empty_gap.append(x.get("candidate_id"))
        if not x.get("target_countries"):
            P2.append(f"{x.get('candidate_id')} target_countries 为空")
        if not isinstance(x.get("evidence"), list) or len(x["evidence"]) < 1:
            P1.append(f"{x.get('candidate_id')} evidence < 1")
        sq = x.get("seven_questions") or {}
        if len(sq) != 7 or any(not isinstance(v, dict) or not v.get("answer") for v in sq.values()):
            P1.append(f"{x.get('candidate_id')} 七问不足/缺 answer")
        roi = x.get("roi") or {}
        if roi.get("estimated") is not True or "capital_min" not in roi or "gross_margin_min" not in roi:
            P1.append(f"{x.get('candidate_id')} ROI 字段/estimated 异常")
        sc = x.get("scores") or {}
        dims = sc.get("dimensions") or {}
        if len(dims) != 10:
            P1.append(f"{x.get('candidate_id')} scores 维度 {len(dims)} ≠ 10")
            continue
        raw = sum(Decimal(str(dims[k])) * Decimal(str(weights[k])) for k in weights)
        total = float((raw * Decimal(10)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
        momentum = round(max(0.5, min(2.5, float(sc.get("momentum", 1.0)))), 1)
        raw_rank = Decimal(str(total)) * (Decimal(1) + Decimal("0.12") * (Decimal(str(momentum)) - Decimal(1)))
        rank_score = float((min(Decimal(100), raw_rank)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
        grade = next((g for g, mn in grades if total >= mn), "D")
        if abs(total - float(sc.get("total", -1))) > 0.051 or abs(rank_score - float(sc.get("rank_score", -1))) > 0.051 or grade != sc.get("grade"):
            bad_scores.append((x.get("candidate_id"), total, sc.get("total"), rank_score, sc.get("rank_score"), grade, sc.get("grade")))
        if not (0 <= float(x.get("confidence") or 0) <= 100):
            P1.append(f"{x.get('candidate_id')} confidence 越界")
        if x.get("status") != "auto-discovered" or x.get("verification_status") != "unverified":
            P1.append(f"{x.get('candidate_id')} status/verification 异常")
        if x.get("verification_status") == "unverified":
            unverified += 1
        try:
            fs, ls = common.parse_date(str(x.get("first_seen"))), common.parse_date(str(x.get("last_seen")))
            if fs > ls or ls > common.parse_date(as_of):
                bad_dates.append(x.get("candidate_id"))
        except Exception:
            bad_dates.append(x.get("candidate_id"))
    if empty_gap:
        P2.append(f"gap_type_ids 为空 {len(empty_gap)}/200（自动候选未能推断信息差类型，UI 可显示—；建议下轮增强或标注）")
    if missing:
        P1.append(f"候选缺字段：{dict(missing)}")
    if bad_scores:
        P1.append(f"评分独立复算不一致 {len(bad_scores)} 条：{bad_scores[:3]}")
    if bad_dates:
        P1.append(f"日期链异常 {bad_dates[:5]}")
    if unverified != 200:
        P1.append(f"unverified={unverified} ≠ 200")
    if not P1:
        notes.append(f"candidates：200 条字段完整、全部 unverified、评分公式独立复算一致、日期链合法 ✅")
    # ---------- 2) candidate-rankings ----------
    wmeta = cr.get("meta") or {}
    counts = {w: len((v or {}).get("items") or []) for w, v in (cr.get("windows") or {}).items()}
    expected_counts = {"day": 21, "week": 124, "month": 168, "year": 199}
    if counts != expected_counts:
        P1.append(f"candidate-rankings 四窗口 {counts} ≠ {expected_counts}")
    if wmeta.get("verification_affects_ranking") is not False:
        P1.append("meta.verification_affects_ranking 非 false（验证门禁？）")
    # 独立复算窗口成员与排序
    id_set = set(ids)
    cand_by_id = {x.get("candidate_id"): x for x in cands}
    for w in ("day", "week", "month", "year"):
        items = ((cr.get("windows") or {}).get(w) or {}).get("items") or []
        # 成员
        exp_members = []
        for x in cands:
            try:
                d = common.parse_date(str(x.get("first_seen")))
            except Exception:
                continue
            if common.window_key(w, d) == common.window_key(w, common.parse_date(as_of)):
                exp_members.append(x)
        exp_members.sort(key=lambda x: (
            -float((x.get("scores") or {}).get("rank_score") or 0),
            -float((x.get("scores") or {}).get("momentum") or 0),
            -len(x.get("evidence") or []),
            str(x.get("last_seen") or ""),
            str(x.get("candidate_id") or ""),
        ))
        got_ids = [it.get("candidate_id") for it in items]
        exp_ids = [x["candidate_id"] for x in exp_members]
        if got_ids != exp_ids:
            P1.append(f"发现榜 {w} 顺序/成员与独立复算不一致（{len(got_ids)} vs {len(exp_ids)}）")
        ranks = [it.get("rank") for it in items]
        if ranks != list(range(1, len(items) + 1)):
            P1.append(f"发现榜 {w} rank 非连续")
        if any(cid not in id_set for cid in got_ids) or len(set(got_ids)) != len(got_ids):
            P0.append(f"发现榜 {w} 存在未知/重复 candidate_id")
    ranked_ids = {it.get("candidate_id") for w in ("day", "week", "month", "year") for it in (((cr.get("windows") or {}).get(w) or {}).get("items") or [])}
    if len(ranked_ids) < 190:
        P2.append(f"发现榜覆盖 candidate 去重 {len(ranked_ids)}（year 199，跨窗口并集）")
    if not any("发现榜" in x for x in P1):
        notes.append(f"candidate-rankings：四窗口 {counts}、按 first_seen 归窗、排序与独立复算一致、验证不门禁 ✅")
    # ---------- 3) stats / 精选不变 ----------
    stats = json.loads((DATA / "stats.json").read_text(encoding="utf-8"))
    kpi = stats.get("kpi") or {}
    for k, v in (("candidates_total", 200), ("today_new_candidates", 21), ("unverified_candidates", 200)):
        if int(kpi.get(k) or 0) != v:
            P1.append(f"stats.kpi.{k}={kpi.get(k)} ≠ {v}")
    if not any("stats.kpi" in x for x in P1):
        notes.append("stats KPI：candidates_total=200 / today_new_candidates=21 / unverified_candidates=200 ✅")
    # rankings 精选内容 vs v0.8.0 tag
    old = subprocess.run(["git", "show", "v0.8.0:data/rankings.json"], cwd=ROOT, capture_output=True)
    if old.returncode == 0:
        oldr = json.loads(old.stdout.decode("utf-8"))
        cur = json.loads((DATA / "rankings.json").read_text(encoding="utf-8"))
        same = True
        for w in ("day", "week", "month", "year"):
            a = [(x.get("opp_id"), x.get("rank"), x.get("rank_score"), x.get("total")) for x in ((oldr.get("windows") or {}).get(w) or {}).get("items") or []]
            b = [(x.get("opp_id"), x.get("rank"), x.get("rank_score"), x.get("total")) for x in ((cur.get("windows") or {}).get(w) or {}).get("items") or []]
            if a != b:
                same = False
        if not same:
            P1.append("精选 rankings.json 80 条窗口内容与 v0.8.0 不一致（应仅 meta.data_version 变化）")
        else:
            notes.append("精选 rankings.json 80 条窗口内容与 v0.8.0 完全一致（仅 meta.data_version→0.9.0）✅")
    # ---------- 4) 生成确定性 ----------
    cand_paths = [DATA / "candidates.json", DATA / "candidate-rankings.json"]
    before = {str(p.name): sha(p) for p in cand_paths}
    r = run(["scanner/candidates.py", "--as-of", as_of])
    after = {str(p.name): sha(p) for p in cand_paths}
    if r.returncode != 0:
        P1.append(f"scanner/candidates.py 退出 {r.returncode}: {(r.stdout + r.stderr)[-220:]}")
    elif before != after:
        P1.append("scanner/candidates.py 重跑后候选文件不一致（确定性失败）")
    else:
        notes.append("scanner/candidates.py --as-of 重跑字节一致（确定性）✅")
    # ---------- 5) --all 双跑 0 变化 / validate / tests ----------
    def data_hashes():
        return {str(p.relative_to(ROOT)): sha(p) for p in DATA.rglob("*") if p.is_file()}
    h1 = data_hashes()
    run1 = run(["scanner/pipeline.py", "--all", "--as-of", as_of])
    h2 = data_hashes()
    run2 = run(["scanner/pipeline.py", "--all", "--as-of", as_of])
    h3 = data_hashes()
    if run1.returncode != 0 or run2.returncode != 0 or h2 != h3:
        P1.append(f"--all --as-of {as_of} 双跑不幂等：exit={run1.returncode}/{run2.returncode}")
    else:
        notes.append(f"--all --as-of {as_of} 双跑 0 文件变化（{len(h3)} 文件 SHA256 一致）✅")
    for label, cmd, expect in (("validate", ["scanner/validate.py"], "20/20"),
                               ("unittest", ["-m", "unittest", "discover", "-s", "scanner/tests"], "Ran 109 tests")):
        rr = run(cmd, timeout=300)
        blob = rr.stdout + rr.stderr
        if rr.returncode != 0 or expect not in blob:
            P0.append(f"{label} 失败：exit={rr.returncode} 期望 {expect!r} :: {blob[-260:]}")
        else:
            notes.append(f"{label}：{expect} PASS ✅")
    # data 版本 / 报告 / db
    versions = {}
    for f in ("taxonomy", "rankings", "stats", "sources", "playbooks", "calendar", "source-health", "candidates", "candidate-rankings"):
        try:
            versions[f] = (json.loads((DATA / f"{f}.json").read_text(encoding="utf-8")).get("meta") or {}).get("data_version")
        except Exception:
            versions[f] = "?"
    badv = {k: v for k, v in versions.items() if v != "0.9.0"}
    if badv:
        P1.append(f"data meta 版本非 0.9.0：{badv}")
    else:
        notes.append("data 全部 meta=0.9.0（9 文件）✅")
    reports = list((DATA / "reports").glob(f"report-*-{as_of}.*"))
    if len(reports) != 8:
        P1.append(f"报告 8 文件缺失：找到 {len(reports)}")
    stale = [p.name for p in (DATA / "reports").glob("report-*-2026-10-22.*")]
    if stale:
        P2.append(f"旧 10-22 报告未清理：{stale[:3]}")
    try:
        import sqlite3
        con = sqlite3.connect(DATA / "radar.db")
        cur = con.cursor()
        dbcounts = {t: cur.execute(f"select count(*) from {t}").fetchone()[0] for t in ("opportunities", "evidence", "rankings_history", "source_health")}
        con.close()
        if dbcounts != {"opportunities": 80, "evidence": 156, "rankings_history": 654, "source_health": 57}:
            P2.append(f"radar.db 行数 {dbcounts}")
        else:
            notes.append("radar.db 行数 80/156/654/57 ✅")
    except Exception as exc:  # noqa: BLE001
        P1.append(f"radar.db 检查失败：{exc}")
    # ---------- 6) 指纹 / gitignore / 证据 URL ----------
    bad = []
    for rel, expect in FINGERPRINTS.items():
        p = ROOT / rel
        got = sha(p)[:16] if p.exists() else "MISSING"
        if got != expect:
            bad.append((rel, got, expect))
    if bad:
        # pipeline.py 消息值可能滞后：单独提示
        P1.append(f"指纹不一致：{bad}")
    else:
        notes.append("关键指纹与 data-engineer 交付一致 ✅")
    cur_pipeline = sha(ROOT / "scanner/pipeline.py")[:16]
    if cur_pipeline != "aae59a9d989a45be":
        P1.append(f"scanner/pipeline.py 当前={cur_pipeline} ≠ 冻结值 AAE59A9D989A45BE")
    gi = subprocess.run(["git", "check-ignore", "data/candidates.json", "data/candidate-rankings.json"], cwd=ROOT, capture_output=True)
    if gi.returncode == 0:
        P0.append("候选文件被 gitignore（应为提交物）")
    else:
        notes.append("候选文件未被 gitignore（提交物）✅")
    # 证据 URL 抽查（≥10）
    if not args.no_net:
        import ssl
        ctx = ssl.create_default_context()
        sample = [x for x in cands if x.get("source", {}).get("id", "").startswith("gn-")][:0]
        picked = []
        seen_sources = set()
        for x in cands:
            sid = (x.get("source") or {}).get("id")
            if sid in seen_sources and len(picked) >= 8:
                continue
            seen_sources.add(sid)
            ev = (x.get("evidence") or [{}])[0]
            if str(ev.get("url", "")).startswith("http"):
                picked.append((x.get("candidate_id"), ev.get("url"), x.get("title")))
            if len(picked) >= 15:
                break
        ok = 0
        results = []
        for cid, url, title in picked:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
                with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
                    raw = resp.read(200000)
                    results.append({"candidate_id": cid, "status": resp.status, "bytes": len(raw), "url": url})
                    if 200 <= resp.status < 400 and len(raw) > 100:
                        ok += 1
            except Exception as exc:  # noqa: BLE001
                results.append({"candidate_id": cid, "error": f"{type(exc).__name__}: {exc}"[:160], "url": url})
        (TMP / "v090-candidate-evidence.json").write_text(json.dumps({"tested": len(picked), "accessible": ok, "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
        if ok < 10:
            P1.append(f"候选证据 URL 可访问 {ok}/{len(picked)} < 10")
        else:
            notes.append(f"候选证据 URL 抽查：{ok}/{len(picked)} 可访问（≥10）✅")
    return report()


def report() -> int:
    print("\n== candidates-check ==")
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
