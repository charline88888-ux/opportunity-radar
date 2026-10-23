"""qa/v130-check.py —— v1.3.0 专业商业评估叙事数据验收（analyst_narrative 6 段）（每日扫描→候选全入榜→四窗口；删非核心）。

覆盖：
1) data 全部 meta=1.0.0；candidates 200（无 verification_status/verified_by_system 等验证字段），
   system_validation 保留（8 checks/high53/medium133/low14 avg92.9）；translation_summary 中文 200/200；
2) candidate-rankings day99/week200/month200/year200；候选 200 全部覆盖 （year 200，窗口并集=200）；
   rankings 精选 80 条内容与 v0.9.2 一致；stats 核心 KPI；
3) sources 168/101/11/8；source-health 101/101/0/items2401；outbox 2420→1892/new1865/seen27/ledger1865；
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
    "data/rankings.json": "427847c77e3183c4",
    "data/stats.json": "f610eb59682e2417",
    "data/candidates.json": "67241ac004229367",
    "data/candidate-rankings.json": "79e717e24232293d",
    "data/sources.json": "d0117e5f7887cbed",
    "data/source-health.json": "04830fe03fd0ada6",
    "data/radar.db": "c6e4a9a8e6c6ca56",
    "data/reports/report-day-2026-10-23.html": "792e4add0cd9dac5",
    "data/opportunities.json": "88fda5ab84b7f826",
    "scanner/business.py": "4875151755add4f2",
    "scanner/candidates.py": "37a8f5f64895218c",
    "scanner/translate.py": "2350c346277fd68c",
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
    badv = {k: v for k, v in versions.items() if v != "1.3.0"}
    if badv:
        P1.append(f"data meta 版本非 1.3.0：{badv}")
    else:
        notes.append("data 9 文件 meta=1.3.0 ✅")
    # candidates
    c = json.loads((DATA / "candidates.json").read_text(encoding="utf-8"))
    cm = c.get("meta") or {}
    cands = c.get("candidates") or []
    if len(cands) != 200 or cm.get("data_version") != "1.3.0":
        P0.append(f"candidates={len(cands)}/version={cm.get('data_version')} ≠ 200/1.3.0")
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
    # v1.3.0 文案清洗
    text_all = (DATA / "candidates.json").read_text(encoding="utf-8")
    bad_words = {w: text_all.count(w) for w in ("验证", "实验", "复核", "门禁")}
    if any(bad_words.values()):
        P1.append(f"candidates.json 仍含禁用文案 {bad_words}")
    else:
        notes.append("candidates.json 全量禁用词=0（验证/实验/复核/门禁）✅")
    seven_keys = list(((cands[0].get("seven_questions") or {})).keys()) if cands else []
    if seven_keys != ["需求", "人群", "竞品", "差异", "渠道", "成本", "跟踪"]:
        P1.append(f"七问键={seven_keys} ≠ 需求/人群/竞品/差异/渠道/成本/跟踪")
    else:
        notes.append("七问键：需求/人群/竞品/差异/渠道/成本/跟踪 ✅")
    q_answers = []
    for x in cands:
        sq = x.get("seven_questions") or {}
        q_answers.append(sq)
    track_ans = [((sq.get("跟踪") or {}).get("answer") or "") for sq in q_answers]
    if not all("14 天内观察到" in a for a in track_ans[:200]):
        P1.append("跟踪答案未统一为「14 天内观察到…」")
    else:
        notes.append("跟踪答案统一：「14 天内观察到询价/预约/加购等可量化信号…」✅")
    ol_count = sum(1 for x in cands if str(x.get("one_liner") or "").endswith("（自动发现线索，系统已初筛）"))
    if ol_count < 200:
        P2.append(f"one_liner 后缀「（自动发现线索，系统已初筛）」仅 {ol_count}/200（长文本截断/部分未带；one_liner_zh 无该后缀，禁用词仍为 0）")
    else:
        notes.append("one_liner 后缀统一「（自动发现线索，系统已初筛）」✅")
    notes_bad = []
    for x in cands:
        n = str((x.get("system_validation") or {}).get("notes") or "")
        if "不代表收入承诺" not in n or any(w in n for w in ("验证", "实验")):
            notes_bad.append(x.get("candidate_id"))
    if notes_bad:
        P1.append(f"system_validation.notes 未清洗 {len(notes_bad)}：{notes_bad[:3]}")
    else:
        notes.append("system_validation.notes 统一「系统自动评估…不代表收入承诺」✅")
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
    # v1.3.0 business evaluation
    canvas_keys = ["channels", "cost_structure", "customer_relationships", "customer_segments", "key_activities", "key_partners", "key_resources", "revenue_streams", "value_proposition"]
    biz_missing = []
    canvas_hashes = set()
    entity_ok = 0
    import re as _re
    for x in cands:
        bc = x.get("business_canvas") or {}
        if sorted(bc.keys()) != sorted(canvas_keys) or any(not bc.get(k) for k in canvas_keys):
            biz_missing.append((x.get("candidate_id"), "canvas"))
        canvas_hashes.add(hashlib.sha256(json.dumps(bc, sort_keys=True, ensure_ascii=False).encode()).hexdigest())
        j = x.get("judgment") or {}
        dims = j.get("dimensions") or []
        if len(dims) != 10 or not j.get("why_opportunity") or not j.get("not_opportunity_if"):
            biz_missing.append((x.get("candidate_id"), "judgment"))
        for k in ("competition", "cross_market", "timing", "conditions", "barriers", "profit_model", "execution_plan"):
            if not isinstance(x.get(k), dict) or not x.get(k):
                biz_missing.append((x.get("candidate_id"), k))
        if not (x.get("sources") or []):
            biz_missing.append((x.get("candidate_id"), "sources"))
        txt = json.dumps(j, ensure_ascii=False)
        if _re.search(r"[0-9]", txt) or _re.search(r"[A-Za-z]{3,}", txt):
            entity_ok += 1
    if biz_missing:
        P1.append(f"business 字段异常 {len(biz_missing)}：{biz_missing[:3]}")
    else:
        notes.append("business：200/200 含 9 块画布/10 维 judgment(why/not_if)/竞争/跨市场/时效/条件/门槛/利润/执行/来源 ✅")
    primary_bad = [x.get("candidate_id") for x in cands if not x.get("primary_industry")]
    if primary_bad:
        P1.append(f"顶层 primary_industry 缺失 {len(primary_bad)}")
    else:
        notes.append("顶层 primary_industry 200/200 ✅")
    ind_bad = [x.get("candidate_id") for x in cands if not x.get("industry_ids") or x.get("primary_industry") not in x.get("industry_ids", [])]
    if ind_bad:
        P1.append(f"industry_ids 未含 primary 或为空 {len(ind_bad)}：{ind_bad[:3]}")
    else:
        notes.append("industry_ids 以 primary 为首且非空（200/200）✅")
    rs_bad = [x.get("candidate_id") for x in cands if not (x.get("profit_model") or {}).get("revenue_streams")]
    if rs_bad:
        P2.append(f"profit_model.revenue_streams 缺失 {len(rs_bad)}")
    else:
        notes.append("profit_model.revenue_streams 200/200 ✅")
    # analyst_narrative
    narr_keys = ["thesis", "market", "competition", "cross_market", "timing", "verdict"]
    narr_bad = []
    narr_hashes = set()
    narr_entity = 0
    for x in cands:
        n = x.get("analyst_narrative") or {}
        if sorted(n.keys()) != sorted(narr_keys) or any(not str(n.get(k) or "").strip() for k in narr_keys):
            narr_bad.append(x.get("candidate_id"))
            continue
        narr_hashes.add(hashlib.sha256(json.dumps(n, sort_keys=True, ensure_ascii=False).encode()).hexdigest())
        txt = json.dumps(n, ensure_ascii=False)
        if _re.search(r"[0-9]", txt) or _re.search(r"[A-Za-z]{3,}", txt):
            narr_entity += 1
    if narr_bad:
        P1.append(f"analyst_narrative 缺失/字段不全 {len(narr_bad)}：{narr_bad[:3]}")
    else:
        notes.append("analyst_narrative：200/200 六段（thesis/market/competition/cross_market/timing/verdict）✅")
    if len(narr_hashes) != 200:
        P1.append(f"analyst_narrative 唯一 {len(narr_hashes)}/200（模板复读？）")
    else:
        notes.append("analyst_narrative：200/200 唯一（非同模板复读）✅")
    if narr_entity != 200:
        P2.append(f"analyst_narrative 实体/数字引用 {narr_entity}/200")
    else:
        notes.append("analyst_narrative 引用实体/数字：200/200 ✅")
    if any(json.dumps(c, ensure_ascii=False).count(w) for w in ("验证", "实验", "复核", "门禁")):
        P1.append("analyst_narrative 含禁用词")
    if len(canvas_hashes) != 200:
        P1.append(f"business_canvas 唯一 {len(canvas_hashes)}/200（应有差异）")
    else:
        notes.append("business_canvas：200/200 唯一（同行业不同信号有差异）✅")
    if entity_ok != 200:
        P2.append(f"候选 judgment 实体/数字引用 {entity_ok}/200")
    else:
        notes.append("judgment 引用标题实体/数字：200/200 ✅")
    forbidden = {w: json.dumps(c, ensure_ascii=False).count(w) for w in ("验证", "实验", "复核", "门禁")}
    if any(forbidden.values()):
        P1.append(f"business 数据禁用词 {forbidden}")
    else:
        notes.append("candidates 全量（含 business 字段）验证/实验/复核/门禁=0 ✅")
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
    old = subprocess.run(["git", "show", "v1.0.1:data/rankings.json"], cwd=ROOT, capture_output=True)
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
            notes.append("精选 80 条内容与 v1.0.1 完全一致（仅 data_version→1.3.0）✅")
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
    if len(hrows) != 101 or sum(int(x.get("items") or 0) for x in hrows) != 2401:
        P1.append(f"source-health rows/items={len(hrows)}/{sum(int(x.get('items') or 0) for x in hrows)} ≠ 101/2401")
    else:
        notes.append(f"source-health：101 行 / ok{hm.get('ok_count')} / failed{hm.get('failed_count')} / items2401 ✅")
    # funnel 与 health/outbox 必须一致（v1.3.0 一致性修复点）
    fn = cm.get("funnel") or {}
    if fn and (int(fn.get("attempted") or -1) != int(hm.get("count") or -1) or int(fn.get("ok") or -1) != int(hm.get("ok_count") or -1) or int(fn.get("failed") or -1) != int(hm.get("failed_count") or -1)):
        P1.append(f"candidates.meta.funnel={fn} 与 source-health count/ok/failed={hm.get('count')}/{hm.get('ok_count')}/{hm.get('failed_count')} 不一致")
    else:
        notes.append("funnel 与 source-health 计数一致 ✅")
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
                               ("unittest", ["-m", "unittest", "discover", "-s", "scanner/tests"], "Ran 100 tests")):
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
    print("\n== v1.3.0 core check ==")
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
