"""qa/yearbook-check.py —— v0.5.0 年度年鉴红队独立验收。

独立从 data/ 复算：年榜 Top20（year 窗口顺序）、月度活跃/新机会、行业/区域/信息差/等级分布、A 级、窗口收尾、评分分布；
再与 yearbook.py 生成的 MD/HTML 对比；并验证确定性、无实验/有实验/空年份/非法实验 JSON、自包含/免责/规则生成标注。
用法：python qa/yearbook-check.py
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP = ROOT / "qa" / "tmp"
DATA = ROOT / "data"
FIX = ROOT / "scanner" / "fixtures" / "experiments-sample.json"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(ROOT / "scanner" / "yearbook.py"), *args],
                          cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=300)


def r1(x: float) -> float:
    import math
    return math.floor(x * 10 + 0.5 + 1e-9) / 10


def check_monthly_grades(md: str, opps: list, year: int) -> list[str]:
    issues = []
    rows = {}
    for m in re.finditer(r"\| (\d{1,2}) 月 \| (\d+) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \|", md):
        mo = int(m.group(1)); rows[mo] = tuple(int(x) for x in m.groups()[1:])
    if len(rows) != 12:
        return [f"月度等级分布应 12 行，实际 {len(rows)}"]
    by_month = defaultdict(lambda: defaultdict(int))
    for o in opps:
        grade = o["scores"]["grade"]
        months = {str(d)[5:7] for d in (o.get("activity_dates") or []) if str(d)[:4] == str(year)}
        for mm in months:
            by_month[int(mm)][grade] += 1
    grade_order = ["S", "A", "B", "C", "D"]
    for mo in range(1, 13):
        got = rows.get(mo)
        want_counts = [by_month[mo].get(g, 0) for g in grade_order]
        want = (sum(want_counts), *want_counts)
        if got != want:
            issues.append(f"月度等级 {mo} 月报告 {got} ≠ 独立 {want}")
    return issues


def check_gap_heat(md: str, opps: list, year: int, gap_name: dict) -> list[str]:
    issues = []
    rows = {}
    for m in re.finditer(r"\| (\d{1,2}) 月 \| (\d+) \| ([^|\n]+) \|", md):
        mo = int(m.group(1)); rows[mo] = (int(m.group(2)), m.group(3).strip())
    # 只取「信息差热度」段
    start = md.find("## 信息差热度")
    if start < 0:
        return ["缺少信息差热度段"]
    seg = md[start: md.find("\n## ", start + 3) if md.find("\n## ", start + 3) > 0 else len(md)]
    heat_rows = {}
    for m in re.finditer(r"\| (\d{1,2}) 月 \| (\d+) \| ([^|\n]+) \|", seg):
        heat_rows[int(m.group(1))] = (int(m.group(2)), m.group(3).strip())
    by_month = defaultdict(Counter)
    for o in opps:
        months = {str(d)[5:7] for d in (o.get("activity_dates") or []) if str(d)[:4] == str(year)}
        for mm in months:
            for g in set(o.get("gap_type_ids") or []):
                by_month[int(mm)][g] += 1
    for mo in range(1, 13):
        got = heat_rows.get(mo)
        if got is None:
            issues.append(f"信息差热度缺 {mo} 月")
            continue
        cnt, text = got
        active = sum(1 for o in opps if any(str(d)[5:7] == f"{mo:02d}" and str(d)[:4] == str(year) for d in (o.get("activity_dates") or [])))
        if cnt != active:
            issues.append(f"信息差热度 {mo} 月活跃 {cnt} ≠ 独立 {active}")
        if text == "—":
            continue
        parts = re.findall(r"([^、()（）]+)\(([0-9]+)\)", text)
        for name, c in parts:
            gid = next((k for k, v in gap_name.items() if v == name.strip()), None)
            if gid is None:
                issues.append(f"信息差热度 {mo} 月未知类型 {name!r}")
                continue
            want = by_month[mo].get(gid, 0)
            if int(c) != want:
                issues.append(f"信息差热度 {mo} 月 {name} 报告 {c} ≠ 独立 {want}")
        if len(parts) > 3:
            issues.append(f"信息差热度 {mo} 月 Top 超过 3 条")
    return issues


def check_window_decay(md: str, opps: list) -> list[str]:
    issues = []
    start = md.find("## 窗口衰减统计")
    if start < 0:
        return ["缺少窗口衰减统计段"]
    seg = md[start: md.find("\n## ", start + 3) if md.find("\n## ", start + 3) > 0 else len(md)]
    status_map = {"open": "开放", "peak": "高峰", "closing": "收尾", "closed": "关闭"}
    want_status = Counter(status_map.get((o.get("window") or {}).get("status"), "?") for o in opps)
    want_decay = Counter(str((o.get("window") or {}).get("decay", "?")) for o in opps)
    buckets = Counter()
    for o in opps:
        ml = int((o.get("window") or {}).get("months_left", 0))
        b = "0-3" if ml <= 3 else "4-8" if ml <= 8 else "9-12" if ml <= 12 else "13-24" if ml <= 24 else "25-36"
        buckets[b] += 1
    m = re.search(r"状态：([^\n]+)", seg)
    if m:
        for name, num in re.findall(r"(开放|高峰|收尾|关闭)\s*(\d+)", m.group(1)):
            if int(num) != want_status.get(name, 0):
                issues.append(f"窗口状态 {name} 报告 {num} ≠ 独立 {want_status.get(name, 0)}")
    else:
        issues.append("窗口衰减统计缺状态行")
    m = re.search(r"衰减速度：([^\n]+)", seg)
    if m:
        for name, num in re.findall(r"(slow|medium|fast)\s*(\d+)", m.group(1)):
            if int(num) != want_decay.get(name, 0):
                issues.append(f"衰减速度 {name} 报告 {num} ≠ 独立 {want_decay.get(name, 0)}")
    m = re.search(r"months_left 分桶：([^\n]+)", seg)
    if m:
        for name, num in re.findall(r"(0-3|4-8|9-12|13-24|25-36)\s*月\s*(\d+)", m.group(1)):
            if int(num) != buckets.get(name, 0):
                issues.append(f"months_left {name} 月报告 {num} ≠ 独立 {buckets.get(name, 0)}")
    return issues


def main() -> int:
    TMP.mkdir(parents=True, exist_ok=True)
    opps = json.loads((DATA / "opportunities.json").read_text(encoding="utf-8"))
    rankings = json.loads((DATA / "rankings.json").read_text(encoding="utf-8"))
    taxonomy = json.loads((DATA / "taxonomy.json").read_text(encoding="utf-8"))
    as_of = (rankings.get("meta") or {}).get("as_of", "2026-10-22")
    year = int(as_of[:4])
    ind_name = {i["id"]: i["name"] for i in taxonomy["industries"]}
    region_name = {i["id"]: i["name"] for i in taxonomy["regions"]}
    gap_name = {g["id"]: g["name"] for g in taxonomy["gap_types"]}

    # ---------- 独立复算 ----------
    in_year = [o for o in opps if str(o.get("last_activity", ""))[:4] == str(year)]
    year_items = ((rankings.get("windows") or {}).get("year") or {}).get("items") or []
    top20 = year_items[:20]
    exp_top = [(it["opp_id"], it["total"]) for it in top20]
    # 月度：活跃=当月任意 activity_date 的去重机会；新=首个 activity_date 落在当月
    active = defaultdict(set)
    first_month = Counter()
    for o in opps:
        all_dates = sorted(str(d)[:10] for d in (o.get("activity_dates") or []))
        dates = [d for d in all_dates if d[:4] == str(year)]
        for d in dates:
            active[d[:7]].add(o["id"])
        if all_dates and all_dates[0][:4] == str(year):
            first_month[all_dates[0][:7]] += 1
    exp_month_active = {m: len(v) for m, v in active.items()}
    exp_month_new = dict(first_month)
    # 分布
    grad = Counter(o["scores"]["grade"] for o in in_year)
    ind = Counter(o["industry_id"] for o in in_year)
    reg = Counter(r for o in in_year for r in o["region_ids"])
    gap = Counter(g for o in in_year for g in o["gap_type_ids"])
    a_list = [o for o in in_year if float(o["scores"]["total"]) >= 75]
    closing = [o for o in in_year if int((o.get("window") or {}).get("months_left", 99)) <= 3]
    buckets = Counter(min(9, int(float(o["scores"]["total"]) // 10)) for o in in_year)
    # ---------- 读取生成报告 ----------
    md_path = DATA / "reports" / f"yearbook-{year}.md"
    html_path = DATA / "reports" / f"yearbook-{year}.html"
    if not md_path.exists() or not html_path.exists():
        P0.append(f"缺少 data/reports/yearbook-{year}.html/md")
        return report()
    md = md_path.read_text(encoding="utf-8")
    html = html_path.read_text(encoding="utf-8")
    if "规则生成" not in md or "非投资建议" not in md:
        P1.append("年鉴缺少「规则生成，非投资建议」标注")
    if "免责" not in md:
        P1.append("年鉴缺少免责声明")
    if re.search(r'<script[^>]+src="https?://', html) or re.search(r'<link[^>]+href="https?://', html):
        P1.append("年鉴 HTML 含外部资源（非自包含）")
    if not re.search(r"data-v0\.6\.0", md):
        P2.append("年鉴 MD 未显示 data-v0.6.0")

    # 2.1 Top20
    top_ids = re.findall(r"（(opp-[a-z0-9\-]+)）", md)
    top_ids = top_ids[:20]
    if [x[0] for x in exp_top] != top_ids:
        P1.append(f"年榜 Top20 与 rankings year 顺序不一致（报告 {len(top_ids)} 条）")
    else:
        notes.append("年榜 Top20 顺序与 rankings year 窗口一致 ✅")
    # 行内 total/grade 抽查
    bad_rows = 0
    for line in md.splitlines():
        m = re.match(r"\| (\d+) \| .*（(opp-[a-z0-9\-]+)） \| ([A-Z]) \| ([0-9.]+) \|", line)
        if not m:
            continue
        _, oid, grade, total = m.groups()
        opp = next((o for o in opps if o["id"] == oid), None)
        if opp and (opp["scores"]["grade"] != grade or abs(float(opp["scores"]["total"]) - float(total)) > 0.051):
            bad_rows += 1
    if bad_rows:
        P1.append(f"年榜行 grade/total 与数据不一致 {bad_rows} 行")
    else:
        notes.append("年榜行 grade/total 与数据一致 ✅")

    # 2.2 月度时间线
    tl_start = md.find("## 月度时间线")
    tl_end = md.find("\n## ", tl_start + 3) if tl_start >= 0 and md.find("\n## ", tl_start + 3) > 0 else len(md)
    tl_seg = md[tl_start:tl_end] if tl_start >= 0 else ""
    month_rows = {int(m.group(1)): (int(m.group(2)), int(m.group(3))) for m in re.finditer(r"\| (\d{1,2}) 月 \| (\d+) \| (\d+) \|", tl_seg)}
    if len(month_rows) != 12:
        P1.append(f"月度时间线应 12 个月，实际 {len(month_rows)}")
    else:
        mismatch = []
        for mo in range(1, 13):
            key = f"{year}-{mo:02d}"
            want_active = exp_month_active.get(key, 0)
            want_new = exp_month_new.get(key, 0)
            got_active, got_new = month_rows[mo]
            if (got_active, got_new) != (want_active, want_new):
                mismatch.append((mo, (got_active, got_new), (want_active, want_new)))
        if mismatch:
            P1.append(f"月度计数与独立复算不一致：{mismatch[:4]}")
        else:
            notes.append("月度活跃/新机会 12 个月与 activity_dates 独立复算一致 ✅")

    # 2.3 分布（行业/区域/信息差/等级）
    def parse_bullets(section_title: str) -> dict[str, int]:
        out: dict[str, int] = {}
        start = md.find(section_title)
        if start < 0:
            return out
        nxt = min([x for x in (md.find("\n### ", start + 3), md.find("\n## ", start + 3)) if x > 0] or [len(md)])
        seg = md[start:nxt]
        for line in seg.splitlines():
            m = re.match(r"- (.+?)：(\d+) 条", line)
            if m:
                out[m.group(1)] = int(m.group(2))
        return out
    ind_md = parse_bullets("### 行业")
    ind_exp = {ind_name[k]: v for k, v in ind.items()}
    if ind_md and ind_md != ind_exp:
        P1.append(f"行业分布不一致：报告 {len(ind_md)} 类 vs 独立 {len(ind_exp)} 类")
    elif ind_md:
        notes.append("行业分布一致 ✅")
    reg_md = parse_bullets("### 区域")
    reg_exp = {region_name[k]: v for k, v in reg.items()}
    if reg_md and reg_md != reg_exp:
        P1.append("区域分布不一致")
    gap_md = parse_bullets("### 信息差类型") or parse_bullets("### 信息差")
    gap_exp = {gap_name[k]: v for k, v in gap.items()}
    if gap_md and gap_md != gap_exp:
        P1.append("信息差分布不一致")

    # 2.3b v0.6 新指标：月度等级分布 / 信息差热度 / 窗口衰减
    for issue in check_monthly_grades(md, opps, year):
        P1.append(issue)
    for issue in check_gap_heat(md, opps, year, gap_name):
        P1.append(issue)
    for issue in check_window_decay(md, opps):
        P1.append(issue)
    if not P1:
        notes.append("v0.6 新指标（月度等级/信息差热度/窗口衰减）与独立复算一致 ✅")

    # 2.4 A 级/收尾/评分分布
    if f"A 级及以上：{len(a_list)} 条" not in md and f"A 级及以上：{len(a_list)}" not in md:
        P1.append(f"A 级计数不一致（独立 {len(a_list)}）")
    if f"≤3 月：{len(closing)} 条" not in md:
        P1.append(f"窗口收尾计数不一致（独立 {len(closing)}）")
    # 评分分布：解析「NN–NN 分：N 条」或表格
    for b in range(10):
        lo, hi = b * 10, b * 10 + 9
        if b == 9:
            hi = 100
        pat = rf"{lo}[–-]{hi}\s*分[^\n]*?(\d+)\s*条"
        m = re.search(pat, md)
        if m and int(m.group(1)) != buckets.get(b, 0):
            P1.append(f"评分分布桶 {lo}-{hi} 报告 {m.group(1)} ≠ 独立 {buckets.get(b, 0)}")

    # ---------- 3) 确定性（双跑临时目录） ----------
    d1, d2 = TMP / "yb-a", TMP / "yb-b"
    for d in (d1, d2):
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True)
    p1 = run(["--year", str(year), "--out-dir", str(d1)])
    p2 = run(["--year", str(year), "--out-dir", str(d2)])
    if p1.returncode or p2.returncode:
        P0.append(f"yearbook.py 运行失败 {p1.returncode}/{p2.returncode}: {p1.stderr[-300:]}")
    else:
        h1 = {f.name: sha(f) for f in d1.glob("yearbook-*")}
        h2 = {f.name: sha(f) for f in d2.glob("yearbook-*")}
        if h1 != h2:
            P1.append("yearbook.py 两次运行字节不一致（确定性失败）")
        else:
            notes.append("无实验年鉴两次运行字节一致（确定性）✅")

    # ---------- 4) 有实验（fixture）+ Brier/成功率独立复算 ----------
    d3 = TMP / "yb-exp"
    shutil.rmtree(d3, ignore_errors=True)
    d3.mkdir(parents=True)
    p3 = run(["--year", str(year), "--experiments", str(FIX), "--sample", "--out-dir", str(d3)])
    if p3.returncode != 0:
        P1.append(f"有实验年鉴运行失败 exit={p3.returncode}: {p3.stderr[-200:]}")
    else:
        exp_md = (d3 / f"yearbook-{year}.md").read_text(encoding="utf-8")
        fixture = json.loads(FIX.read_text(encoding="utf-8"))
        opps_by = {o["id"]: o for o in opps}
        pairs = []
        for e in fixture.get("experiments") or []:
            if e.get("outcome") not in ("positive", "negative"):
                continue
            o = opps_by.get(e.get("opp_id"))
            if not o:
                continue
            p = max(0.01, min(0.99, float(o["scores"]["total"]) / 100))
            pairs.append((p, 1.0 if e["outcome"] == "positive" else 0.0))
        brier = round(sum((p - o) ** 2 for p, o in pairs) / len(pairs), 4) if pairs else None
        if brier is not None and (f"Brier {brier}" not in exp_md and f"Brier={brier}" not in exp_md and f"{brier}" not in exp_md):
            P1.append(f"年鉴实验摘要 Brier 与独立复算 {brier} 不一致")
        if "样例数据" not in exp_md and "sample" not in exp_md.lower():
            P2.append("有实验年鉴未标注样例")
        # v0.6 实验漏斗独立复算
        pos = sum(1 for e in fixture.get("experiments") or [] if e.get("outcome") == "positive")
        neg = sum(1 for e in fixture.get("experiments") or [] if e.get("outcome") == "negative")
        inc = sum(1 for e in fixture.get("experiments") or [] if e.get("outcome") == "inconclusive")
        decided = pos + neg
        success = round(pos / decided, 2) if decided else 0
        funnel_pat = rf"实验漏斗：总样本 {pos + neg + inc} → 已决 {decided}（positive {pos} / negative {neg} / inconclusive {inc}） → 成功率 {success}"
        if not re.search(funnel_pat, exp_md):
            P1.append(f"实验漏斗与独立复算不一致（期望 {pos + neg + inc}/{decided}/{pos}/{neg}/{inc}/{success}）")
        else:
            notes.append("实验漏斗（样本/已决/pos/neg/inconclusive/成功率）与独立复算一致 ✅")
        notes.append(f"有实验年鉴：独立 Brier={brier}，报告含 Brier={'是' if str(brier) in exp_md else '否'}")
        # 非法实验 JSON 容错
        bad = TMP / "yb-bad-exp.json"
        bad.write_text("{not-json", encoding="utf-8")
        d4 = TMP / "yb-bad"
        shutil.rmtree(d4, ignore_errors=True)
        d4.mkdir()
        p4 = run(["--year", str(year), "--experiments", str(bad), "--sample", "--out-dir", str(d4)])
        out4 = p4.stdout + p4.stderr
        tolerant = p4.returncode == 0 and ("警告" in out4 or "失败" in out4 or "跳过" in out4) and (d4 / f"yearbook-{year}.md").exists()
        if tolerant:
            notes.append("非法实验 JSON：exit=0 + 警告 + 跳过实验摘要（容错）✅")
        else:
            P1.append(f"非法实验 JSON 容错不足：exit={p4.returncode} 输出={out4[-160:]!r}")

    # ---------- 5) 空数据年份 ----------
    d5 = TMP / "yb-empty"
    shutil.rmtree(d5, ignore_errors=True)
    d5.mkdir()
    p5 = run(["--year", "2020", "--out-dir", str(d5)])
    if p5.returncode != 0:
        P1.append(f"空数据年份 2020 失败 exit={p5.returncode}: {p5.stderr[-200:]}")
    else:
        empty_md = (d5 / "yearbook-2020.md")
        if not empty_md.exists():
            P1.append("空数据年份未生成报告")
        else:
            txt = empty_md.read_text(encoding="utf-8")
            if "0 条" not in txt and "无" not in txt and "没有" not in txt:
                P2.append("空数据年份报告未明确 0 机会")
            notes.append("空数据年份 2020：exit=0 并生成空态报告 ✅")
    return report()


def report() -> int:
    print("\n== yearbook-check ==")
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
