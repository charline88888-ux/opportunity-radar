"""qa/data-qa.py —— 红队独立数据验收脚本（不依赖 scanner/ 实现，按 docs/12 v0.1.0 契约独立实现）。

用法：
    python qa/data-qa.py            # 人类可读报告，发现 P0 级问题时退出码 1
    python qa/data-qa.py --json     # 机器可读

设计原则：
1. 公式与阈值独立硬编码（与 docs/12 对齐），不复用 scanner/score.py，避免「同源共谋」；
2. 舍入用 Decimal ROUND_HALF_UP（docs/12 §4.5）；
3. 输出 P0/P1/P2 分级问题清单，供 qa/report.md 直接引用。
"""
from __future__ import annotations

import json
import sys
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
AS_OF = date(2026, 10, 22)

WEIGHTS = {
    "signal": 0.15, "gap": 0.15, "feasibility": 0.15, "economics": 0.15,
    "timing": 0.10, "competition": 0.08, "risk": 0.07,
    "fit": 0.05, "evidence": 0.05, "leverage": 0.05,
}
GRADES = [("S", 85), ("A", 75), ("B", 65), ("C", 55), ("D", 0)]
HALF_LIFE = {
    "language": 24, "culture": 36, "time": 9, "geo": 18, "knowledge": 30,
    "regulation": 24, "platform": 6, "price": 12, "channel": 9,
    "demographic": 30, "emotion": 18, "infrastructure": 24,
}
WINDOW_QUOTAS = {"day": 6, "week": 12, "month": 20, "year": 40}
BANNED = ["稳赚", "保证收益", "躺赚", "内幕", "100% 成功", "100%成功"]
PLACEHOLDERS = ["待补充", "TODO", "TBD", "待定"]


def round1(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def exact_total(dims: dict) -> float:
    """精确十进制复算：逐维 Decimal 乘积求和，避免 76.95 这类 .05 边界被 float 误差带偏。"""
    raw = sum(Decimal(str(dims[d])) * Decimal(str(w)) for d, w in WEIGHTS.items())
    return float((raw * 10).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def exact_rank_score(total: float, momentum: float) -> float:
    m = Decimal(str(min(2.5, max(0.5, momentum))))
    raw = Decimal(str(total)) * (1 + Decimal("0.12") * (m - 1))
    return float(min(Decimal("100"), raw).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def load(name: str):
    path = DATA / name
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


class QA:
    def __init__(self):
        self.p0: list[str] = []
        self.p1: list[str] = []
        self.p2: list[str] = []
        self.notes: list[str] = []

    def report(self) -> int:
        print("=" * 78)
        print("机会雷达 · 红队独立数据验收（qa/data-qa.py）")
        print("=" * 78)
        print(f"P0 = {len(self.p0)}    P1 = {len(self.p1)}    P2 = {len(self.p2)}")
        for level, items in (("P0", self.p0), ("P1", self.p1), ("P2", self.p2)):
            for item in items:
                print(f"  [{level}] {item}")
        if self.notes:
            print("-" * 78)
            for note in self.notes:
                print(f"  · {note}")
        print("=" * 78)
        return 0 if not self.p0 and not self.p1 else 1


def main() -> int:
    qa = QA()
    tax = load("taxonomy.json")
    opps = load("opportunities.json")
    rankings = load("rankings.json")
    stats = load("stats.json")
    sources = load("sources.json")
    playbooks = load("playbooks.json")
    calendar = load("calendar.json")
    changelog = DATA / "CHANGELOG.md"
    data_readme = DATA / "README.md"

    if tax is None:
        qa.p0.append("data/taxonomy.json 缺失")
        return qa.report()
    if opps is None:
        qa.p0.append("data/opportunities.json 缺失")
        return qa.report()

    # ---------- taxonomy ----------
    expect_counts = {
        "industries": 14, "human_needs": 12, "neuro_drivers": 6, "emotions": 24,
        "gap_types": 12, "drivers": 7, "business_models": 12, "regions": 11,
        "score_dimensions": 10, "tags": 20, "grades": 5,
    }
    for key, want in expect_counts.items():
        items = tax.get(key) or []
        if len(items) != want:
            qa.p0.append(f"taxonomy.{key} 数量 {len(items)} ≠ {want}")
    weights = {d["id"]: float(d["weight"]) for d in tax.get("score_dimensions", [])}
    if abs(sum(weights.values()) - 1.0) > 1e-9:
        qa.p0.append(f"taxonomy 权重合计 {sum(weights.values())} ≠ 1.00")
    if weights != WEIGHTS:
        qa.p0.append(f"taxonomy 权重与契约不一致：{weights}")
    for g in tax.get("gap_types", []):
        if g.get("half_life_months") != HALF_LIFE.get(g.get("id")):
            qa.p0.append(f"gap_types.{g.get('id')} 半衰期 {g.get('half_life_months')} ≠ 契约 {HALF_LIFE.get(g.get('id'))}")
    grade_map = {g["id"]: g["min"] for g in tax.get("grades", [])}
    if grade_map != {gid: mn for gid, mn in GRADES}:
        qa.p2.append(f"taxonomy.grades={grade_map} 与契约阈值略有差异（D=0 视为 <55 兜底即可）")
    ids = {
        "industries": {i["id"] for i in tax.get("industries", [])},
        "human_needs": {i["id"] for i in tax.get("human_needs", [])},
        "neuro_drivers": {i["id"] for i in tax.get("neuro_drivers", [])},
        "emotions": {i["id"] for i in tax.get("emotions", [])},
        "gap_types": {i["id"] for i in tax.get("gap_types", [])},
        "drivers": {i["id"] for i in tax.get("drivers", [])},
        "regions": {i["id"] for i in tax.get("regions", [])},
        "tags": {i["id"] for i in tax.get("tags", [])},
        "business_models": {i["id"] for i in tax.get("business_models", [])},
    }

    # ---------- opportunities ----------
    if len(opps) < 40:
        qa.p0.append(f"机会数 {len(opps)} < 40")
    seen_ids, seen_slugs = set(), set()
    evidence_urls: list[tuple[str, str, bool]] = []  # (opp_id, url, verified)
    verified_true = 0
    for opp in opps:
        oid = opp.get("id", "<no-id>")
        if oid in seen_ids:
            qa.p0.append(f"{oid}: id 重复")
        if opp.get("slug") in seen_slugs:
            qa.p0.append(f"{oid}: slug 重复")
        seen_ids.add(oid)
        seen_slugs.add(opp.get("slug"))

        # 枚举引用
        if opp.get("industry_id") not in ids["industries"]:
            qa.p0.append(f"{oid}: industry_id 非法 {opp.get('industry_id')}")
        for field, allowed in (
            ("gap_type_ids", ids["gap_types"]), ("region_ids", ids["regions"]),
            ("human_need_ids", ids["human_needs"]), ("neuro_drivers", ids["neuro_drivers"]),
            ("emotion_tags", ids["emotions"]), ("tags", ids["tags"]),
        ):
            values = opp.get(field)
            if not isinstance(values, list) or not values:
                qa.p0.append(f"{oid}: {field} 缺失/非数组")
                continue
            for val in values:
                if val not in allowed:
                    qa.p0.append(f"{oid}: {field} 含非法值 {val}")
        q = opp.get("seven_questions") or {}
        for key in ("traffic", "money", "model", "roi", "audience", "moat"):
            value = q.get(key)
            if not isinstance(value, str) or len(value.strip()) < 12:
                qa.p1.append(f"{oid}: seven_questions.{key} 过短/缺失（<12 字，契约 V04 不合格）")
            elif len(value.strip()) < 30:
                qa.p2.append(f"{oid}: seven_questions.{key} 仅 {len(value)} 字，偏短，建议补到可照做的程度")
            else:
                for ph in PLACEHOLDERS:
                    if ph in value:
                        qa.p0.append(f"{oid}: seven_questions.{key} 含占位符 {ph}")
        drivers = q.get("drivers")
        if not isinstance(drivers, list) or not (1 <= len(drivers) <= 3) or any(d not in ids["drivers"] for d in drivers):
            qa.p1.append(f"{oid}: seven_questions.drivers={drivers} 非法（应 1–3 个契约 driver）")
        # 七问 roi 文字与结构化 roi 的一致性由人工抽查（阶段 2 抽查 ≥8 条），脚本不做正则粗检避免误报

        # V16 必填/ROI schema
        roi = opp.get("roi") or {}
        if not str(opp.get("disclaimer") or "").strip():
            qa.p0.append(f"{oid}: disclaimer 缺失")
        cap = roi.get("capital_cny") or {}
        rev = roi.get("monthly_revenue_cny") or {}
        if not (isinstance(cap.get("min"), (int, float)) and isinstance(cap.get("max"), (int, float)) and 0 <= cap["min"] <= cap["max"]):
            qa.p1.append(f"{oid}: roi.capital_cny 非法 {cap}")
        if not (isinstance(rev.get("min"), (int, float)) and isinstance(rev.get("max"), (int, float)) and 0 <= rev["min"] <= rev["max"]):
            qa.p1.append(f"{oid}: roi.monthly_revenue_cny 非法 {rev}")
        for key in ("time_to_revenue_months", "payback_months", "team_size"):
            if not isinstance(roi.get(key), int) or roi.get(key) < 0:
                qa.p1.append(f"{oid}: roi.{key} 非法 {roi.get(key)}")
        if not isinstance(roi.get("gross_margin_pct"), (int, float)) or not (0 <= roi["gross_margin_pct"] <= 100):
            qa.p1.append(f"{oid}: roi.gross_margin_pct 非法")
        if roi.get("effort_level") not in {"full", "side", "solo"}:
            qa.p1.append(f"{oid}: roi.effort_level 非法")
        # 启动资金/回本一致性：交给人工抽查（见 qa/report.md §证据与七问抽查）

        # window（§4.7 语义）
        window = opp.get("window") or {}
        status, months, decay = window.get("status"), window.get("months_left"), window.get("decay")
        if status not in {"open", "peak", "closing", "closed"}:
            qa.p0.append(f"{oid}: window.status 非法 {status}")
        if not isinstance(months, int) or not (1 <= months <= 36):
            qa.p1.append(f"{oid}: window.months_left={months} 非法（契约 1–36 整数）")
        if decay not in {"slow", "medium", "fast"}:
            qa.p0.append(f"{oid}: window.decay 非法")
        if isinstance(months, int) and status in {"open", "peak", "closing", "closed"}:
            want = "open" if months >= 9 else "peak" if months >= 3 else "closing" if months >= 1 else "closed"
            if status != want:
                qa.p1.append(f"{oid}: window.status={status} 与 months_left={months} 映射不一致（应为 {want}，docs/12 §4.7 / V16）")
        gaps = opp.get("gap_type_ids") or []
        if gaps and decay in {"slow", "medium", "fast"}:
            # docs/12 §4.7：decay 由「主导信息差半衰期」判定，主类型 = gap_type_ids[0]
            h = HALF_LIFE.get(gaps[0], 0)
            want_decay = "slow" if h >= 24 else "medium" if h >= 12 else "fast"
            if decay != want_decay:
                qa.p2.append(f"{oid}: window.decay={decay} 与主 gap（{gaps[0]}，半衰期 {h}）不一致（建议 {want_decay}）")

        # 证据链（V03 + V17）
        signal = opp.get("signal") or {}
        evidence = signal.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            qa.p0.append(f"{oid}: evidence 为空")
        else:
            if opp.get("evidence_count") != len(evidence):
                qa.p0.append(f"{oid}: evidence_count={opp.get('evidence_count')} ≠ {len(evidence)}")
            for idx, item in enumerate(evidence):
                url = item.get("url") or ""
                parsed = urlparse(url)
                if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                    qa.p0.append(f"{oid}: evidence[{idx}].url 不可解析 {url[:60]}")
                if item.get("tier") not in {"primary", "secondary", "marketing"}:
                    qa.p0.append(f"{oid}: evidence[{idx}].tier={item.get('tier')}")
                for field in ("title", "publisher", "date", "quote", "lang"):
                    if not str(item.get(field) or "").strip():
                        qa.p0.append(f"{oid}: evidence[{idx}].{field} 为空")
                try:
                    d = date.fromisoformat(str(item.get("date")))
                    if d > AS_OF:
                        qa.p1.append(f"{oid}: evidence[{idx}].date={d} 晚于 as_of（V17）")
                except ValueError:
                    qa.p0.append(f"{oid}: evidence[{idx}].date 非法")
                evidence_urls.append((oid, url, bool(opp.get("verified"))))
        for field in ("summary", "volume_estimate"):
            if not str(signal.get(field) or "").strip():
                qa.p0.append(f"{oid}: signal.{field} 为空")
        strength = signal.get("signal_strength")
        if not isinstance(strength, (int, float)) or not (0 <= strength <= 10):
            qa.p1.append(f"{oid}: signal.signal_strength={strength} 越界")
        if signal.get("trend_direction") not in {"up", "flat", "down"}:
            qa.p1.append(f"{oid}: signal.trend_direction 非法")

        # 评分（V05，独立复算）
        scores = opp.get("scores") or {}
        dims = scores.get("dimensions") or {}
        if set(dims) != set(WEIGHTS):
            qa.p0.append(f"{oid}: scores.dimensions 键集合不符")
        else:
            for dim, w in WEIGHTS.items():
                if not isinstance(dims[dim], (int, float)) or not (0 <= dims[dim] <= 10):
                    qa.p0.append(f"{oid}: 维度 {dim}={dims[dim]} 越界")
            total = exact_total(dims)
            if abs(total - float(scores.get("total", -1))) > 0.05:
                qa.p0.append(f"{oid}: total 文件 {scores.get('total')} ≠ 精确复算 {total}")
            grade = next(gid for gid, mn in GRADES if total >= mn)
            if scores.get("grade") != grade:
                qa.p0.append(f"{oid}: grade 文件 {scores.get('grade')} ≠ 复算 {grade}")
            momentum = float(opp.get("momentum", 0))
            if not (0.5 <= momentum <= 2.5):
                qa.p1.append(f"{oid}: momentum={momentum} 越界 [0.5,2.5]")
            if abs(momentum * 10 - round(momentum * 10)) > 1e-6:
                qa.p2.append(f"{oid}: momentum={momentum} 非 1 位小数")
            rank_score = exact_rank_score(total, momentum)
            if abs(rank_score - float(opp.get("rank_score", -1))) > 0.05:
                qa.p0.append(f"{oid}: rank_score 文件 {opp.get('rank_score')} ≠ 精确复算 {rank_score}")

        # 日期链（V07）
        dates = opp.get("activity_dates") or []
        try:
            parsed = [date.fromisoformat(d) for d in dates]
        except ValueError:
            qa.p0.append(f"{oid}: activity_dates 含非法日期")
            parsed = []
        if parsed:
            if parsed != sorted(parsed):
                qa.p0.append(f"{oid}: activity_dates 未升序")
            if opp.get("last_activity") != parsed[-1].isoformat():
                qa.p0.append(f"{oid}: last_activity ≠ max(activity_dates)")
            if parsed[-1] > AS_OF:
                qa.p0.append(f"{oid}: last_activity={parsed[-1]} 晚于 as_of")
            first = opp.get("first_seen")
            if not first or date.fromisoformat(first) > parsed[-1]:
                qa.p0.append(f"{oid}: first_seen 非法/晚于 last_activity")

        # 文案与标签
        title, one_liner = opp.get("title") or "", opp.get("one_liner") or ""
        if len(title) > 28:
            qa.p1.append(f"{oid}: title 长度 {len(title)} > 契约上限 28 字")
        if len(one_liner) > 60:
            qa.p1.append(f"{oid}: one_liner 长度 {len(one_liner)} > 契约上限 60 字")
        for field, lo, hi in (("risks", 2, 5), ("first_steps_7d", 3, 6), ("kill_criteria", 2, 4)):
            values = opp.get(field) or []
            if not (lo <= len(values) <= hi):
                qa.p2.append(f"{oid}: {field} 条数 {len(values)} 不在 {lo}–{hi}")
        if not str(opp.get("compliance_notes") or "").strip():
            qa.p1.append(f"{oid}: compliance_notes 为空")
        if opp.get("verified") is True:
            verified_true += 1
        elif opp.get("verified") is not False:
            qa.p0.append(f"{oid}: verified 非布尔")
        elif "未" not in str(opp.get("compliance_notes") or "") and "核验" not in str(opp.get("compliance_notes") or ""):
            qa.p2.append(f"{oid}: verified=false 但 compliance_notes 未说明未核验原因")

    # 覆盖度
    industries_covered = {o.get("industry_id") for o in opps}
    regions_covered = {r for o in opps for r in (o.get("region_ids") or [])}
    gaps_covered = {g for o in opps for g in (o.get("gap_type_ids") or [])}
    countries = {c for o in opps for c in (o.get("target_countries") or [])}
    china_angle = [o for o in opps if "china-advantage" in (o.get("tags") or [])]
    if len(industries_covered) != 14:
        qa.p0.append(f"行业覆盖 {len(industries_covered)}/14")
    if len(regions_covered) < 10:
        qa.p0.append(f"区域覆盖 {len(regions_covered)} < 10")
    if len(gaps_covered) != 12:
        qa.p0.append(f"信息差覆盖 {len(gaps_covered)}/12")
    if len(countries) < 30:
        qa.p1.append(f"目标国家/地区 {len(countries)} < 30（数据任务要求）")
    if len(china_angle) < 12:
        qa.p1.append(f"中国供应链/中文市场角度 {len(china_angle)} < 12（数据任务要求）")

    # 禁用词
    for name, doc in (("taxonomy", tax), ("opportunities", opps), ("rankings", rankings),
                      ("stats", stats), ("sources", sources), ("playbooks", playbooks), ("calendar", calendar)):
        if doc is None:
            continue
        text = json.dumps(doc, ensure_ascii=False)
        for word in BANNED:
            if word in text:
                qa.p0.append(f"data/{name}.json 含 V13 禁用词「{word}」")

    # ---------- rankings（V08/V09/V18） ----------
    if rankings is None:
        qa.p0.append("data/rankings.json 缺失")
    else:
        opp_by_id = {o.get("id"): o for o in opps}
        windows = rankings.get("windows") or {}
        for window, quota in WINDOW_QUOTAS.items():
            items = (windows.get(window) or {}).get("items") or []
            if len(items) < quota:
                qa.p0.append(f"rankings.{window} {len(items)} 条 < 配额 {quota}")
            ranks = [it.get("rank") for it in items]
            if ranks != list(range(1, len(items) + 1)):
                qa.p0.append(f"rankings.{window} rank 非从 1 连续")
            scores = [float(it.get("rank_score", 0)) for it in items]
            if scores != sorted(scores, reverse=True):
                qa.p0.append(f"rankings.{window} 未按 rank_score 降序")
            for it in items:
                oid2 = it.get("opp_id")
                if oid2 not in opp_by_id:
                    qa.p0.append(f"rankings.{window} 引用不存在的 {oid2}")
                if it.get("change") not in {"new", "up", "down", "flat"}:
                    qa.p0.append(f"rankings.{window} change 非法 {it.get('change')}")
                delta, change = it.get("delta"), it.get("change")
                if change == "new" and delta is not None:
                    qa.p0.append(f"rankings.{window} change=new 但 delta={delta}")
                if change == "up" and not (isinstance(delta, int) and delta > 0):
                    qa.p0.append(f"rankings.{window} change=up 但 delta={delta}")
                if change == "down" and not (isinstance(delta, int) and delta < 0):
                    qa.p0.append(f"rankings.{window} change=down 但 delta={delta}")
                if change == "flat" and delta != 0:
                    qa.p0.append(f"rankings.{window} change=flat 但 delta={delta}")
                if window == "year" and delta is not None:
                    qa.p0.append("rankings.year delta 必须为 null（V18）")
        # 窗口归属一致性
        for window in WINDOW_QUOTAS:
            items = (windows.get(window) or {}).get("items") or []
            for it in items:
                opp = opp_by_id.get(it.get("opp_id"))
                if opp and window == "day" and opp.get("last_activity") != AS_OF.isoformat():
                    qa.p0.append(f"rankings.day 含非当日机会 {opp.get('id')}（last_activity={opp.get('last_activity')}）")

    # ---------- stats（V14） ----------
    if stats is None:
        qa.p0.append("data/stats.json 缺失")
    else:
        kpi = stats.get("kpi") or {}
        if kpi.get("total_opps") != len(opps):
            qa.p0.append(f"stats.kpi.total_opps={kpi.get('total_opps')} ≠ {len(opps)}")
        new_today = sum(1 for o in opps if o.get("last_activity") == AS_OF.isoformat())
        if kpi.get("new_today") != new_today:
            qa.p0.append(f"stats.kpi.new_today={kpi.get('new_today')} ≠ {new_today}")
        tier_a = sum(1 for o in opps if (o.get("scores") or {}).get("grade") in {"S", "A"})
        if kpi.get("grade_a_plus") != tier_a:
            qa.p0.append(f"stats.kpi.grade_a_plus={kpi.get('grade_a_plus')} ≠ {tier_a}")

    # ---------- sources / playbooks / calendar ----------
    if sources is None:
        qa.p0.append("data/sources.json 缺失")
    else:
        cats = sources.get("categories") or []
        if len(cats) != 12:
            qa.p0.append(f"sources.categories {len(cats)} ≠ 12")
        src_count = sum(len(c.get("sources") or []) for c in cats)
        if src_count < 60:
            qa.p0.append(f"sources 平台数 {src_count} < 60")
        for cat in cats:
            for src in cat.get("sources") or []:
                if src.get("frequency") not in {"realtime", "daily", "weekly", "monthly", "quarterly", "yearly", "manual"}:
                    qa.p1.append(f"source {src.get('id')}: frequency={src.get('frequency')} 不在契约枚举（V10）")
                if src.get("compliance") not in {"green", "yellow", "red"}:
                    qa.p0.append(f"source {src.get('id')}: compliance 非法")
    if playbooks is None:
        qa.p0.append("data/playbooks.json 缺失")
    else:
        pbs = playbooks.get("playbooks") or []
        if len(pbs) < 12:
            qa.p0.append(f"playbooks {len(pbs)} < 12")
    if calendar is None:
        qa.p0.append("data/calendar.json 缺失")
    else:
        events = calendar.get("events") or []
        if len(events) < 24:
            qa.p0.append(f"calendar {len(events)} < 24")

    # ---------- 文件完整性 ----------
    if not changelog.exists():
        qa.p1.append("data/CHANGELOG.md 缺失")
    if not data_readme.exists():
        qa.p1.append("data/README.md 缺失")

    # ---------- verified 清单（供 web_fetch 人工核验） ----------
    if verified_true:
        qa.notes.append(f"verified:true 共 {verified_true} 条，证据 URL 需 100% 实测可访问")
        for oid, url, ver in evidence_urls:
            if ver:
                qa.notes.append(f"  verified=true 证据：{oid} → {url}")
    qa.notes.append(f"证据 URL 总数：{len(evidence_urls)}（红队将独立 web_fetch 抽查 ≥8 条）")
    qa.notes.append(f"机会数 {len(opps)} / 行业 {len(industries_covered)} / 区域 {len(regions_covered)} / 信息差 {len(gaps_covered)} / 国家地区 {len(countries)} / 中国角度 {len(china_angle)}")
    return qa.report()


if __name__ == "__main__":
    raise SystemExit(main())
