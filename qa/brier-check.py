"""qa/brier-check.py —— v0.3.1 Brier 分数红队独立复算。

按 docs/04 §12.9.5 + v0.3.1 前端规格：
  二值化：positive → o=1；negative → o=0；inconclusive/无 outcome → 排除
  p = clamp(opportunity.scores.total / 100, 0.01, 0.99)
  Brier = mean((p - o)^2)  （binary_n = pos + neg ≥ 3 才展示/导出）
独立数据源：不读导出 samples 的 total，而是用 data/opportunities.json 的权威总分 + 注入的实验清单
（qa/tmp/v031-experiments.json）复算；再与浏览器导出的 calibration JSON 对比。
用法：python qa/brier-check.py [--export qa/tmp/downloads-v031/radar-calibration.json] [--experiments qa/tmp/v031-experiments.json]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []


def r(x: float, n: int) -> float:
    return round(float(x) + 1e-12, n)


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def load(path: Path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", default=str(ROOT / "qa/tmp/downloads-v031/radar-calibration.json"))
    ap.add_argument("--experiments", default=str(ROOT / "qa/tmp/v031-experiments.json"))
    args = ap.parse_args()
    export = load(Path(args.export))
    experiments = load(Path(args.experiments)) or []
    opps = {o["id"]: o for o in load(DATA / "opportunities.json")}
    if export is None:
        print("FAIL: 未找到校准导出 JSON（先在前端点击导出 JSON）")
        return 1

    # 1) 从权威数据 + 注入实验独立复算
    binary = []
    inconclusive = 0
    for e in experiments:
        outcome = e.get("outcome")
        if outcome == "inconclusive":
            inconclusive += 1
            continue
        if outcome not in ("positive", "negative"):
            continue
        opp = opps.get(e.get("opp_id"))
        if not opp:
            P2.append(f"实验 {e.get('id')} 的 opp_id 不在机会库，跳过（UI 应以 total=0 处理）")
            continue
        total = float(opp["scores"]["total"])
        p = clamp(total / 100.0, 0.01, 0.99)
        o = 1.0 if outcome == "positive" else 0.0
        binary.append((p, o))
    n = len(binary)
    expected_brier = None
    if n:
        expected_brier = sum((p - o) ** 2 for p, o in binary) / n

    stats = export.get("stats") or {}
    samples = export.get("samples") or []
    print("== 独立复算 ==")
    print(f"binary_n={n} inconclusive={inconclusive} expected_brier={None if expected_brier is None else r(expected_brier, 4)}")

    # 2) 导出 JSON 结构 / 字段检查
    if "brier" not in stats:
        P1.append("导出 JSON stats.brier 缺失（v0.3.1 要求导出 Brier）")
    export_brier = stats.get("brier")
    print(f"export.brier={export_brier!r} samples={len(samples)}")
    if n >= 3:
        if export_brier is None:
            P1.append("binary_n≥3 但导出 Brier 为空")
        elif abs(float(export_brier) - expected_brier) > 0.0006:
            P1.append(f"导出 Brier {export_brier} ≠ 独立复算 {r(expected_brier, 4)}")
        if "brier_baseline" in stats and abs(float(stats["brier_baseline"]) - 0.25) > 1e-9:
            P1.append(f"brier_baseline={stats['brier_baseline']} ≠ 0.25")
    else:
        if export_brier not in (None, 0, 0.0):
            P1.append(f"binary_n={n}<3 但导出 Brier={export_brier}（应不展示/为空）")
        P2.append("binary_n<3，Brier 不应展示（与规格一致）")

    # 3) 导出 samples 与注入实验一致性（防止 UI join 错机会总分）
    exp_by_opp = {e.get("opp_id"): e for e in experiments if e.get("outcome") in ("positive", "negative")}
    for s in samples:
        oid = s.get("opp_id")
        e = exp_by_opp.get(oid)
        if not e:
            continue
        opp = opps.get(oid)
        if opp and s.get("total") is not None and abs(float(s["total"]) - float(opp["scores"]["total"])) > 1e-9:
            P0.append(f"导出样本 {oid} total={s['total']} ≠ 权威 {opp['scores']['total']}")
        if s.get("outcome") != e.get("outcome"):
            P0.append(f"导出样本 {oid} outcome={s.get('outcome')} ≠ 注入 {e.get('outcome')}")

    # 4) 分桶校验（O5：单桶 <3 提示由前端 UI 检查；这里核对导出分桶计数）
    by_bucket = export.get("by_bucket") or []
    bucket_total = sum(int(b.get("total", 0)) for b in by_bucket)
    if bucket_total and bucket_total != len(samples):
        P1.append(f"by_bucket 合计 {bucket_total} ≠ samples {len(samples)}")
    print(f"by_grade={len(export.get('by_grade') or [])} by_bucket={len(by_bucket)} suggestions={len(export.get('suggestions') or [])}")

    print("\nP0 =", len(P0), " P1 =", len(P1), " P2 =", len(P2))
    for item in P0:
        print("  [P0]", item)
    for item in P1:
        print("  [P1]", item)
    for item in P2:
        print("  [P2]", item)
    print("RESULT:", "PASS" if not P0 and not P1 else "FAIL")
    return 0 if not P0 and not P1 else 1


if __name__ == "__main__":
    raise SystemExit(main())
