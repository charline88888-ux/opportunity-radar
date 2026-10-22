"""qa/history-check.py —— v0.2.0 history / 真实 delta 路径红队独立验证（内存中构造上期快照，不改 data/）。

用法：python qa/history-check.py
验证点：
1) 无历史时 build_rankings(opps, as_of, None) 与 data/rankings.json 的 windows 完全一致（回退口径）；
2) 构造上期快照（改日期 + 交换某窗口名次）后，delta/change 按「上期名次 − 本期名次」计算，
   meta.delta_basis=history、history_as_of=上期日期，且该窗口 items.delta_basis=history；
3) 上期快照中缺失的窗口回退 adjacent-window；
4) previous_snapshot 内容不被修改（无副作用）。
"""
from __future__ import annotations

import copy
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scanner import rank  # noqa: E402

AS_OF = date(2026, 10, 22)
P1: list[str] = []
P2: list[str] = []


def load(name: str):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def main() -> int:
    opps = load("opportunities.json")
    current = load("rankings.json")

    # 1) 无历史 = 当前 rankings（回退 adjacent-window）
    rebuilt = rank.build_rankings(opps, AS_OF, None)
    if rebuilt["windows"] != current["windows"]:
        P1.append("无历史时 build_rankings 与 data/rankings.json windows 不一致")
    if rebuilt["meta"].get("delta_basis") != "adjacent-window":
        P1.append(f"无历史时 delta_basis={rebuilt['meta'].get('delta_basis')} ≠ adjacent-window")
    # 记录当前是 adjacent-window 的窗口
    for w in ("day", "week", "month", "year"):
        want = current["windows"][w].get("delta_basis")
        got = rebuilt["windows"][w].get("delta_basis")
        if want != got:
            P1.append(f"{w} window.delta_basis {got} ≠ 文件 {want}")

    # 2) 构造上期快照：把 as_of 改到 2026-10-21，并交换 year 窗口前两名的 rank/delta/change
    prev = copy.deepcopy(current)
    prev["meta"]["as_of"] = "2026-10-21"
    prev["meta"]["snapshot_at"] = "2026-10-21T09:00:00+08:00"
    prev["meta"]["reconstructed"] = False
    year_items = prev["windows"]["year"]["items"]
    if len(year_items) >= 2:
        a, b = year_items[0], year_items[1]
        a["rank"], b["rank"] = b["rank"], a["rank"]
    prev_before = copy.deepcopy(prev)
    with_hist = rank.build_rankings(opps, AS_OF, prev)
    if with_hist["meta"].get("delta_basis") != "history":
        P1.append(f"有历史时 meta.delta_basis={with_hist['meta'].get('delta_basis')} ≠ history")
    if with_hist["meta"].get("history_as_of") != "2026-10-21":
        P1.append(f"history_as_of={with_hist['meta'].get('history_as_of')} ≠ 2026-10-21")
    if with_hist["windows"]["year"].get("delta_basis") != "history":
        P1.append("year 窗口 delta_basis 应为 history")
    # 交换后的两个机会：上期 rank1/2 → 本期 rank1/2，delta 应分别为 +1 / -1（或相反），change 非 new
    by_id = {it["opp_id"]: it for it in with_hist["windows"]["year"]["items"]}
    for opp_id in (a["opp_id"], b["opp_id"]):
        it = by_id[opp_id]
        if it["delta"] is None or it["change"] == "new":
            P1.append(f"{opp_id}: 有上期名次但 delta/change 仍为 new")
        if it["change"] == "up" and not (isinstance(it["delta"], int) and it["delta"] > 0):
            P1.append(f"{opp_id}: change=up 但 delta={it['delta']}")
        if it["change"] == "down" and not (isinstance(it["delta"], int) and it["delta"] < 0):
            P1.append(f"{opp_id}: change=down 但 delta={it['delta']}")
    # 目标值精确核对：a 上期 rank=2，本期 rank=1 → delta=+1/up；b 上期 rank=1，本期 rank=2 → delta=-1/down
    if by_id[a["opp_id"]]["delta"] != 1 or by_id[a["opp_id"]]["change"] != "up":
        P1.append(f"{a['opp_id']}: 期望 delta=1/up，实际 {by_id[a['opp_id']]['delta']}/{by_id[a['opp_id']]['change']}")
    if by_id[b["opp_id"]]["delta"] != -1 or by_id[b["opp_id"]]["change"] != "down":
        P1.append(f"{b['opp_id']}: 期望 delta=-1/down，实际 {by_id[b['opp_id']]['delta']}/{by_id[b['opp_id']]['change']}")
    # 3) prev 中删除 day 窗口 → day 回退 adjacent-window
    prev_no_day = copy.deepcopy(prev)
    prev_no_day["windows"].pop("day", None)
    with_hist2 = rank.build_rankings(opps, AS_OF, prev_no_day)
    if with_hist2["windows"]["day"].get("delta_basis") != "adjacent-window":
        P1.append("上期快照缺 day 窗口时，day 应回退 adjacent-window")
    # 4) 无副作用
    if prev != prev_before:
        P1.append("build_rankings 修改了传入的 previous_snapshot（有副作用）")

    print(json.dumps({"p1": P1, "p2": P2}, ensure_ascii=False, indent=2))
    print("RESULT:", "PASS" if not P1 else "FAIL")
    return 0 if not P1 else 1


if __name__ == "__main__":
    raise SystemExit(main())
