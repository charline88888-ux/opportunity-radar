"""qa/calibrate-check.py —— v0.4.0 calibrate.py 红队独立验收（Brier 独立复算 + 报告/边界）。

独立复算：从 scanner/fixtures/experiments-sample.json 读实验，从 data/opportunities.json 读权威总分，
按 docs/12 §1.3 / docs/04 §12.9.5 口径 p=clamp(total/100,0.01,0.99)、o=pos?1:neg?0、inconclusive 排除，
计算 Brier 后与 calibrate.py 生成的 HTML/MD 报告对比，并与再次运行的字节确定性核对。
用法：python qa/calibrate-check.py
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP = ROOT / "qa" / "tmp"
FIX = ROOT / "scanner" / "fixtures" / "experiments-sample.json"
REPORTS = ROOT / "data" / "reports"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clamp(x: float) -> float:
    return max(0.01, min(0.99, x))


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(ROOT / "scanner" / "calibrate.py"), *args],
                          cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=180)


def extra_check(export_path: Path) -> None:
    """校验前端导出 JSON 并交给 calibrate.py 生成报告，独立复算 Brier 与报告对比。"""
    if not export_path.exists():
        P1.append(f"--export 文件不存在：{export_path}")
        return
    exp = json.loads(export_path.read_text(encoding="utf-8"))
    if exp.get("schema_version") != "0.4.0":
        P1.append(f"导出 schema_version={exp.get('schema_version')!r} ≠ 0.4.0")
    if not isinstance(exp.get("experiments"), list):
        P1.append("导出缺少 experiments 数组")
        return
    opps = {o["id"]: o for o in json.loads((ROOT / "data" / "opportunities.json").read_text(encoding="utf-8"))}
    pairs = []
    for e in exp["experiments"]:
        if e.get("outcome") not in ("positive", "negative"):
            continue
        opp = opps.get(e.get("opp_id"))
        if not opp:
            P2.append(f"导出实验 {e.get('opp_id')} 不在机会库（calibrate 应显示 ? 级）")
            continue
        pairs.append((clamp(float(opp["scores"]["total"]) / 100.0), 1.0 if e["outcome"] == "positive" else 0.0))
    expected = round(sum((p - o) ** 2 for p, o in pairs) / len(pairs), 4) if pairs else None
    out_dir = TMP / "calib-from-export"
    shutil.rmtree(out_dir, ignore_errors=True)
    out_dir.mkdir(parents=True)
    proc = run(["--experiments", str(export_path), "--date", "2026-10-22", "--out-dir", str(out_dir)])
    if proc.returncode != 0:
        P0.append(f"calibrate.py 消费前端导出失败 exit={proc.returncode}: {proc.stderr[-300:]}")
        return
    md = "\n".join(p.read_text(encoding="utf-8") for p in out_dir.glob("calibration-*.md"))
    import re
    got = (re.search(r"Brier\s*=\s*([0-9.]+)", md) or [])[1]
    if expected is None:
        P2.append("前端导出无二值样本，calibrate 报告应显示样本不足")
    elif got is None or abs(float(got) - expected) > 1e-9:
        P1.append(f"前端导出→calibrate Brier={got} ≠ 独立复算 {expected}")
    else:
        notes.append(f"前端导出→calibrate 往返：n={len(pairs)} Brier={got} = 独立复算 ✅")
    if "样例数据" in md or "sample" in md.lower():
        P2.append("前端导出生成的非样例报告被标为样例（检查 --sample 是否误用）")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", default=None, help="额外校验的前端实验导出 JSON（v0.4 schema）")
    args = ap.parse_args()
    if args.export:
        extra_check(Path(args.export))
    if not FIX.exists():
        print("P0: 缺少 scanner/fixtures/experiments-sample.json")
        return 1
    TMP.mkdir(parents=True, exist_ok=True)
    fixture = json.loads(FIX.read_text(encoding="utf-8"))
    opps = {o["id"]: o for o in json.loads((ROOT / "data" / "opportunities.json").read_text(encoding="utf-8"))}

    # 1) 独立复算 Brier
    pairs = []
    unknown = 0
    for e in fixture.get("experiments") or []:
        outcome = e.get("outcome")
        if outcome not in ("positive", "negative"):
            continue
        opp = opps.get(e.get("opp_id"))
        if not opp:
            unknown += 1
            continue
        p = clamp(float(opp["scores"]["total"]) / 100.0)
        o = 1.0 if outcome == "positive" else 0.0
        pairs.append((p, o))
    expected = sum((p - o) ** 2 for p, o in pairs) / len(pairs) if pairs else None
    expected = round(expected, 4) if expected is not None else None
    notes.append(f"独立复算：fixture={len(fixture.get('experiments') or [])} 有效二值 n={len(pairs)} unknown_opp={unknown} Brier={expected}")
    if expected is None:
        P0.append("fixture 无有效二值样本，无法复算")

    # 2) 当前报告（data/reports/calibration-2026-10-22.*）与复算一致性
    md = REPORTS / "calibration-2026-10-22.md"
    html = REPORTS / "calibration-2026-10-22.html"
    if not md.exists() or not html.exists():
        P1.append("缺少 calibration-2026-10-22.html/md 报告（先运行 calibrate.py --sample）")
    else:
        md_text = md.read_text(encoding="utf-8")
        html_text = html.read_text(encoding="utf-8")
        import re
        got = (re.search(r"Brier\s*=\s*([0-9.]+)", md_text) or [])[1]
        html_plain = re.sub(r"<[^>]+>", " ", html_text)
        got_html = (re.search(r"Brier[（(][^）)]*[）)]\s*([0-9.]+)", html_plain) or [])[1]
        if got is None or abs(float(got) - float(expected)) > 1e-9:
            P1.append(f"报告 MD Brier={got} ≠ 独立复算 {expected}")
        if got_html is None or abs(float(got_html) - float(expected)) > 1e-9:
            P1.append(f"报告 HTML Brier={got_html} ≠ 独立复算 {expected}")
        if "样例数据" not in md_text or "sample" not in md_text.lower():
            P1.append("样例报告未标注「样例数据 sample」")
        if "不构成投资建议" not in md_text and "非投资建议" not in md_text:
            P2.append("校准报告缺少免责声明")
        if re.search(r'<script[^>]+src="https?://', html_text) or re.search(r'<link[^>]+href="https?://', html_text):
            P1.append("校准报告 HTML 含外部资源（非自包含）")
        if "有效 5" not in md_text and "有效样本：5" not in md_text and "有效样本 5" not in md_text:
            P2.append("报告未明确展示有效样本 5 条")
        notes.append(f"报告 Brier：MD={got} HTML={got_html}；样例标注={'样例数据' in md_text}")

    # 3) 确定性：重跑两次到临时目录（--sample，日期固定）
    a_dir = TMP / "calib-a"
    b_dir = TMP / "calib-b"
    for d in (a_dir, b_dir):
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True)
    p1 = run(["--experiments", str(FIX), "--sample", "--date", "2026-10-22", "--out-dir", str(a_dir)])
    p2 = run(["--experiments", str(FIX), "--sample", "--date", "2026-10-22", "--out-dir", str(b_dir)])
    if p1.returncode != 0 or p2.returncode != 0:
        P0.append(f"calibrate.py 运行失败 exit={p1.returncode}/{p2.returncode}: {p1.stderr[-300:]}")
    else:
        ha = {f.name: sha(f) for f in a_dir.glob("calibration-*")}
        hb = {f.name: sha(f) for f in b_dir.glob("calibration-*")}
        if ha != hb:
            P1.append(f"calibrate.py 两次运行产物不一致：{ {k: ha.get(k) == hb.get(k) for k in ha} }")
        else:
            notes.append("两次运行报告字节级一致（确定性）✅")
        if md.exists() and (a_dir / md.name).exists() and sha(md) != sha(a_dir / md.name):
            P2.append("data/reports 现存报告与本次重跑不一致（可能生成时间/参数不同）")

    # 4) 边界：n=2 应标记样本不足；n=0 应干净处理
    for tag, keep in (("n2", [e for e in fixture["experiments"] if e.get("outcome") in ("positive", "negative")][:2]),
                      ("n0", [])):
        exp = dict(fixture)
        exp["experiments"] = keep
        f = TMP / f"calib-{tag}.json"
        f.write_text(json.dumps(exp, ensure_ascii=False), encoding="utf-8")
        d = TMP / f"calib-{tag}"
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True)
        proc = run(["--experiments", str(f), "--sample", "--date", "2026-10-22", "--out-dir", str(d)])
        if proc.returncode != 0:
            P1.append(f"边界 {tag} 运行失败 exit={proc.returncode}: {proc.stderr[-200:]}")
            continue
        texts = "\n".join(p.read_text(encoding="utf-8") for p in d.glob("calibration-*.md"))
        if tag == "n2" and not ("样本不足" in texts or "<3" in texts or "仅供参考" in texts):
            P1.append("n=2 报告未提示样本不足")
        if tag == "n0" and not ("样本不足" in texts or "没有可用样本" in texts or "0 条" in texts):
            P1.append("n=0 报告未提示无样本")
        notes.append(f"边界 {tag}: exit=0，提示={'ok' if ('样本不足' in texts or '<3' in texts or '仅供参考' in texts or '0 条' in texts) else '检查'}")

    # 5) 非法 JSON：应可控失败
    bad = TMP / "calib-bad.json"
    bad.write_text("{not-json", encoding="utf-8")
    bd = TMP / "calib-bad"
    shutil.rmtree(bd, ignore_errors=True)
    bd.mkdir()
    proc = run(["--experiments", str(bad), "--out-dir", str(bd)])
    if proc.returncode == 0:
        P1.append("非法 experiments JSON 不应 exit 0")
    else:
        notes.append(f"非法 JSON：exit={proc.returncode}（可控失败）")
    return report()


def report() -> int:
    print("\n== calibrate-check ==")
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
