"""qa/evidence-spotcheck.py —— v0.6.0 新增机会证据 URL 独立实测 + 七问/ROI/评分/日期独立复算。

从 git show v0.5.1:data/opportunities.json 取基线，识别新增机会，分层抽 ≥10 条（优先含 verified:true）：
1) 逐条 evidence URL 真实 GET（stdlib urllib，UA/超时/重试），验证可访问（HTTP 2xx/3xx）与 quote 是否在页面文本中出现；
2) 独立按 docs/12 §4.5/§4.6 公式复算 total/rank_score/grade；七问/ROI/risk/first_steps/kill_criteria/compliance 完整性；
3) 日期链：activity_dates/last_activity/evidence.date 与 as_of 自洽，months_left/status 映射；
4) verified:true 的机会若 URL 打不开/引文不符 → 记为 P1（诚实性）；新增机会整体 <10 条可核验 → P0。
用法：python qa/evidence-spotcheck.py [--limit 12]
"""
from __future__ import annotations

import argparse
import json
import math
import re
import ssl
import subprocess
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 OpportunityRadar-QA/0.6"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []


def r1(x: float) -> float:
    return math.floor(x * 10 + 0.5 + 1e-9) / 10


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def baseline_ids() -> set[str]:
    for ref in ("v0.5.1", "HEAD"):
        try:
            out = subprocess.run(["git", "show", f"{ref}:data/opportunities.json"], cwd=ROOT,
                                 capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
            if out.returncode == 0 and out.stdout.strip().startswith("["):
                return {o["id"] for o in json.loads(out.stdout)}
        except Exception:
            continue
    return set()


def pdf_text(raw: bytes) -> str:
    """尽量从 PDF 提取可见文本（zlib 解压 stream + 提取括号字符串/数字）。"""
    import zlib
    chunks = [raw.decode("latin-1", errors="ignore")]
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", raw, re.S):
        data = m.group(1)
        try:
            data = zlib.decompress(data)
        except Exception:
            pass
        chunks.append(data.decode("latin-1", errors="ignore"))
    text = "\n".join(chunks)
    # 括号字符串（PDF text operators）
    strings = re.findall(r"\((?:[^()\\]|\\.)*\)", text)
    return text + " " + " ".join(s[1:-1] for s in strings)


def fetch(url: str) -> tuple[bool, int | None, str]:
    ctx = ssl.create_default_context()
    last = ""
    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*",
                                                       "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
                                                       "Accept-Encoding": "gzip, deflate"})
            with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
                raw = resp.read(2_500_000)
                status = resp.status
                enc = (resp.headers.get("Content-Encoding") or "").lower()
                ctype = (resp.headers.get("Content-Type") or "").lower()
                if enc == "gzip" or raw[:2] == b"\x1f\x8b":
                    try:
                        import gzip
                        raw = gzip.decompress(raw)
                    except Exception:
                        pass
                elif enc == "deflate":
                    try:
                        import zlib
                        raw = zlib.decompress(raw)
                    except Exception:
                        pass
                if "pdf" in ctype or raw[:4] == b"%PDF":
                    return True, status, pdf_text(raw)
                text = raw.decode("utf-8", errors="ignore")
                if not text.strip():
                    text = raw.decode("latin-1", errors="ignore")
                return True, status, text
        except Exception as exc:  # noqa: BLE001
            last = f"{exc.__class__.__name__}: {exc}"
            time.sleep(1)
    return False, None, last


def normalize(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">")
    s = re.sub(r"[\s\u00a0]+", " ", s)
    return s.lower().strip()


def quote_matches(page: str, quote: str) -> str:
    """返回 exact / numeric / keyword / none。中文摘要型引文用数字+关键词语义核验。"""
    if not quote or not page:
        return "none"
    p = normalize(page)
    q = normalize(quote)
    variants = [q]
    if len(q) > 80:
        variants.append(q[:80])
    if len(q) > 40:
        variants.append(q[:40])
    if any(v and v in p for v in variants):
        return "exact"
    raw_nums = re.findall(r"[0-9][0-9,.]*", quote)
    nums = [n for n in raw_nums if len(re.sub(r"[^0-9]", "", n)) >= 2]
    hit_nums = [n for n in nums if normalize(n) in p or normalize(n).replace(",", "") in p.replace(",", "")]
    decimals = [n for n in nums if "." in n]
    # 语义数字匹配：小数命中 1 个，或整数命中 ≥2 个，或 ≥3 位整数命中 1 个（中文摘要型引文常见单位换算）
    strong = any(n in hit_nums for n in decimals) or len(hit_nums) >= 2 or any(n in hit_nums for n in nums if len(re.sub(r"[^0-9]", "", n)) >= 3)
    if nums and strong:
        return "numeric"
    words = [w for w in re.findall(r"[A-Za-z][A-Za-z0-9_-]{3,}", quote) if w.lower() not in ("http", "https", "www", "com")]
    hit_words = [w for w in words if w.lower() in p]
    if words and len(hit_words) >= 1:
        return "keyword"
    return "none"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=12)
    args = ap.parse_args()
    opps = load(DATA / "opportunities.json")
    taxonomy = load(DATA / "taxonomy.json")
    as_of = "2026-10-22"
    weights = {d["id"]: float(d["weight"]) for d in taxonomy["score_dimensions"]}
    grades = taxonomy["grades"]
    gaps = {g["id"]: g for g in taxonomy["gap_types"]}
    base = baseline_ids()
    if not base:
        P1.append("无法从 git 取 v0.5.1 基线机会库（新增识别失败）")
    new = [o for o in opps if o.get("id") not in base] if base else []
    notes.append(f"机会库 {len(opps)} 条；新增 {len(new)} 条（基线 {len(base)}）")
    if len(new) < 34:
        P2.append(f"新增机会 {len(new)} < 34（目标 ≥34）")
    # 分层：每个行业优先取 1 条 + verified:true 优先
    by_ind: dict[str, list] = {}
    for o in sorted(new, key=lambda x: x["id"]):
        by_ind.setdefault(o.get("industry_id", "?"), []).append(o)
    picked: list[dict] = []
    for ind in sorted(by_ind):
        picked.append(by_ind[ind][0])
    verified_new = [o for o in new if o.get("verified") is True]
    for o in verified_new:
        if o not in picked:
            picked.append(o)
    if len(picked) < args.limit:
        for o in new:
            if o not in picked:
                picked.append(o)
            if len(picked) >= args.limit:
                break
    picked = picked[: max(args.limit, 12)]
    notes.append(f"抽样 {len(picked)} 条（行业 {len(set(o.get('industry_id') for o in picked))} 类，verified:true {sum(1 for o in picked if o.get('verified') is True)} 条）")

    report = []
    verified_ok = 0
    urls_total = 0
    urls_ok = 0
    quote_ok = 0
    for o in picked:
        item = {"id": o["id"], "title": o.get("title"), "verified": o.get("verified"), "issues": [], "evidence": [], "formula": {}}
        # 1) 公式独立复算
        dims = (o.get("scores") or {}).get("dimensions") or {}
        try:
            total = sum(weights[k] * float(dims[k]) for k in weights)
            total = r1(total * 10)
        except Exception:
            total = None
        momentum = min(2.5, max(0.5, r1(float(o.get("momentum") or 1.0))))
        rank_score = r1(min(100.0, (total or 0) * (1 + 0.12 * (momentum - 1))))
        grade = None
        for g in sorted(grades, key=lambda x: float(x.get("min", 0)), reverse=True):
            if (total or 0) >= float(g.get("min", 0)):
                grade = g.get("id")
                break
        file_total = float((o.get("scores") or {}).get("total", -1))
        file_rank = float(o.get("rank_score", -1))
        file_grade = (o.get("scores") or {}).get("grade")
        if total is None or abs(total - file_total) > 0.051:
            item["issues"].append(f"total 文件 {file_total} ≠ 复算 {total}")
        if abs(rank_score - file_rank) > 0.051:
            item["issues"].append(f"rank_score 文件 {file_rank} ≠ 复算 {rank_score}")
        if grade != file_grade:
            item["issues"].append(f"grade 文件 {file_grade} ≠ 复算 {grade}")
        item["formula"] = {"total": total, "rank_score": rank_score, "grade": grade, "file_total": file_total, "file_rank": file_rank}
        # 2) 七问/ROI/风险/动作/证伪/合规
        sq = o.get("seven_questions") or {}
        required_sq = ("traffic", "money", "model", "roi", "audience", "drivers", "moat")
        missing = [k for k in required_sq if not str(sq.get(k) or "").strip()]
        placeholder = [k for k in required_sq if re.search(r"待补充|TODO|TBD", str(sq.get(k) or ""), re.I)]
        if missing:
            item["issues"].append(f"七问缺字段 {missing}")
        if placeholder:
            item["issues"].append(f"七问含占位 {placeholder}")
        roi = o.get("roi") or {}
        for k in ("capital_cny", "time_to_revenue_months", "payback_months", "monthly_revenue_cny", "gross_margin_pct", "effort_level", "team_size"):
            if k not in roi:
                item["issues"].append(f"roi 缺 {k}")
        window = o.get("window") or {}
        ml = window.get("months_left")
        st = window.get("status")
        if not isinstance(ml, int) or not (0 <= ml <= 36):
            item["issues"].append(f"months_left 非法 {ml!r}")
        else:
            expect = "closed" if ml == 0 else "closing" if ml <= 2 else "peak" if ml <= 8 else "open"
            if st != expect:
                item["issues"].append(f"window.status={st} 与 months_left={ml} 映射不一致（应 {expect}）")
        # 3) 日期链
        ad = [str(x) for x in (o.get("activity_dates") or []) if str(x)]
        last = str(o.get("last_activity") or "")
        if not ad:
            item["issues"].append("activity_dates 为空")
        else:
            if any(d > as_of for d in ad):
                item["issues"].append(f"activity_dates 有未来日期 {[d for d in ad if d > as_of][:2]}")
            if last and max(ad) != last:
                item["issues"].append(f"last_activity={last} ≠ max(activity_dates)={max(ad)}")
        evs = (o.get("signal") or {}).get("evidence") or []
        if len(evs) < 2:
            item["issues"].append(f"证据 {len(evs)} 条 < 2")
        # 4) 证据 URL 实测 + 引文
        for ev in evs:
            url = ev.get("url")
            quote = ev.get("quote") or ""
            date = ev.get("date")
            uitem = {"url": url, "publisher": ev.get("publisher"), "date": date, "tier": ev.get("tier")}
            if date and str(date) > as_of:
                item["issues"].append(f"证据日期 {date} > as_of")
            if not str(url or "").startswith("http"):
                uitem["fetch"] = "url_invalid"
                item["issues"].append(f"证据 URL 非法 {url!r}")
                item["evidence"].append(uitem)
                continue
            urls_total += 1
            ok, status, text = fetch(url)
            uitem["status"] = status
            if ok:
                urls_ok += 1
                matched = quote_matches(text, quote)
                uitem["quote_match"] = matched
                if matched != "none":
                    quote_ok += 1
            else:
                uitem["error"] = text[:160]
            item["evidence"].append(uitem)
        # 5) verified 诚实性
        accessible = [e for e in item["evidence"] if e.get("status") and 200 <= int(e["status"]) < 400]
        matched_ev = [e for e in accessible if e.get("quote_match") not in (None, False, "none")]
        if o.get("verified") is True:
            if not matched_ev:
                P1.append(f"verified:true 但独立核验无「可访问且引文相符」证据：{o['id']}（{accessible and '可访问但引文不符' or 'URL 不可访问'}）")
                item["issues"].append("verified:true 但无可核验证据")
            else:
                verified_ok += 1
        item["accessible_urls"] = len(accessible)
        item["quote_matched_urls"] = len(matched_ev)
        if item["issues"]:
            item["issues"] = item["issues"][:8]
            P2.append(f"{o['id']}：{'；'.join(item['issues'][:3])}")
        report.append(item)

    opps_evidenced = sum(1 for it in report if it.get("quote_matched_urls", 0) > 0)
    notes.append(f"证据实测：URL 尝试 {urls_total} 条，可访问 {urls_ok}，引文相符 {quote_ok}；抽检机会中有可核验证据 {opps_evidenced}/{len(picked)}；verified:true 抽检通过 {verified_ok}")
    if opps_evidenced < 10:
        P0.append(f"可独立核验（URL 可访问+引文相符）的新增机会仅 {opps_evidenced} 条 < 10")
    if urls_ok == 0:
        P0.append("所有抽检证据 URL 均不可访问（网络/数据问题）")
    out = {"summary": {"opportunities": len(opps), "new": len(new), "picked": len(picked), "urls_tried": urls_total,
                       "urls_ok": urls_ok, "quote_ok": quote_ok, "opps_with_verified_evidence": opps_evidenced,
                       "verified_true_checked_ok": verified_ok},
           "notes": notes, "p0": P0, "p1": P1, "p2": P2, "items": report}
    (ROOT / "qa" / "tmp").mkdir(exist_ok=True)
    (ROOT / "qa" / "v06-evidence-spotcheck.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("== evidence-spotcheck ==")
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
