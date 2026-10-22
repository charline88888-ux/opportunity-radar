"""qa/replay-check.py —— v0.3.0 历史回放快照红队独立复算。

验证回放快照是否可由「现有机会 + 回放日窗口规则」确定性重建（两种候选口径）：
  A. 历史知识截止：只用 last_activity <= replay_as_of 的机会；
  B. 不过滤：用全部现有机会（只换 as_of 求窗口）。
对比字段：各窗口 items 的 opp_id 顺序 / rank / rank_score / total（delta/change 属展示口径，允许不同）。
用法：python qa/replay-check.py
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scanner import rank  # noqa: E402

DATA = ROOT / "data"
REPLAY_DATES = ["2026-10-20", "2026-10-21"]
WINDOWS = ("day", "week", "month", "year")
P0: list[str] = []
P1: list[str] = []


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def comparable(snapshot: dict) -> dict:
    out = {}
    for w in WINDOWS:
        items = ((snapshot.get("windows") or {}).get(w) or {}).get("items") or []
        out[w] = [(it.get("opp_id"), it.get("rank"), it.get("rank_score"), it.get("total")) for it in items]
    return out


def main() -> int:
    opps = load("opportunities.json")
    for day in REPLAY_DATES:
        path = DATA / "history" / f"rankings-{day}.json"
        if not path.exists():
            P0.append(f"缺少回放快照 {path.name}")
            continue
        snap = json.loads(path.read_text(encoding="utf-8"))
        meta = snap.get("meta") or {}
        if meta.get("reconstructed") is not True:
            P0.append(f"{day}: reconstructed != true")
        if str(meta.get("replay_as_of"))[:10] != day:
            P0.append(f"{day}: replay_as_of={meta.get('replay_as_of')} 与快照日期不符")
        d = date.fromisoformat(day)
        target = comparable(snap)
        results = {}
        for model, subset in (
            ("A:cutoff(last_activity<=as_of)", [o for o in opps if str(o.get("last_activity")) <= day]),
            ("B:all-opportunities", opps),
        ):
            rebuilt = rank.build_rankings(subset, d, None)
            got = comparable(rebuilt)
            results[model] = got == target
        matched = [m for m, ok in results.items() if ok]
        if not matched:
            P0.append(f"{day}: 回放快照无法用任一独立口径复算（A/B 都不一致）")
            for w in WINDOWS:
                print(f"  [{day}] {w} target={len(target[w])} A={len(results['A:cutoff(last_activity<=as_of)'][w]) if False else '-'}")
        else:
            print(f"{day}: 回放复算匹配口径 = {matched}")
            # 记录窗口条数
            print("  counts:", {w: len(target[w]) for w in WINDOWS})
        # 回放快照内部：day 窗口必须都是 last_activity==replay 日
        day_ids = {it[0] for it in target["day"]}
        wrong = [o["id"] for o in opps if o["id"] in day_ids and str(o.get("last_activity")) != day]
        if wrong:
            P0.append(f"{day}: day 窗口含 last_activity≠{day} 的机会 {wrong[:3]}")

    print(json.dumps({"p0": P0, "p1": P1}, ensure_ascii=False, indent=2))
    print("RESULT:", "PASS" if not P0 else "FAIL")
    return 0 if not P0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
