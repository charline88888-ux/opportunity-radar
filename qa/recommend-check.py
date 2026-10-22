"""qa/recommend-check.py —— v0.3.0 推荐/预警独立复算（按 docs/04 §12 规格，从 data/ 独立实现，不读前端代码）。

输出 qa/tmp/recommend-expected.json，供 qa/flows-v03.mjs 与前端 UI 数值比对。
用法：python qa/recommend-check.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

CAP_BANDS = {"lt1w": 3, "b1-5w": 5, "b5-20w": 7, "gt20w": 10}
SKILL_MAP = lambda v: round1((v / 3) * 10)  # noqa: E731
FIT_WEIGHTS = {"capital": 0.20, "time": 0.15, "tech": 0.15, "content": 0.10, "supply": 0.15, "english": 0.10, "risk": 0.15}
NON_GENERIC = {"ar", "ja", "ko", "vi", "th", "id", "ms", "tr", "ru", "hi", "ur", "pt", "es", "fr", "de", "it", "he", "fa"}
EN_MARKETS = ("north-america", "europe", "oceania")


def round1(x: float) -> float:
    # 与前端 utils.round1 相同（四舍五入到 1 位；用 floor(x*10+0.5) 避免银行家舍入差异）
    import math
    return math.floor(float(x) * 10 + 0.5 + 1e-9) / 10


def round3(x: float) -> float:
    import math
    return math.floor(float(x) * 1000 + 0.5 + 1e-9) / 1000


def capability(profile: dict) -> dict:
    hours = profile["weeklyHours"]
    time = 10 if profile.get("fullTime") else (2 if hours <= 5 else 4 if hours <= 10 else 6 if hours <= 20 else 8 if hours <= 35 else 9)
    return {
        "capital": CAP_BANDS[profile["capitalBand"]],
        "time": time,
        "tech": SKILL_MAP(profile["skills"]["tech"]),
        "content": SKILL_MAP(profile["skills"]["content"]),
        "supply": SKILL_MAP(profile["skills"]["supply"]),
        "english": SKILL_MAP(profile["english"]),
        "risk": round1(((profile["risk"] - 1) / 4) * 10),
    }


def is_chinese_market(opp: dict) -> bool:
    if "china" not in opp["region_ids"]:
        return False
    countries = opp.get("target_countries") or []
    return (all(any(k in c for k in ("中国", "香港", "台湾", "澳门")) for c in countries) if countries else False) or (
        bool(opp.get("source_langs")) and all(l == "zh" for l in opp["source_langs"])
    )


def is_english_market(opp: dict) -> bool:
    if "en" in [l.lower() for l in (opp.get("source_langs") or [])]:
        return True
    if any(r in EN_MARKETS for r in opp["region_ids"]):
        return True
    return any(any(k in c for k in ("美国", "英国", "加拿大", "澳大利亚", "新西兰", "爱尔兰", "新加坡")) for c in (opp.get("target_countries") or []))


def demand(opp: dict) -> dict:
    roi = opp.get("roi") or {}
    c = ((roi.get("capital_cny") or {}).get("min"))
    capital = 4 if not isinstance(c, (int, float)) else (2 if c < 3000 else 4 if c < 10000 else 6 if c < 30000 else 8 if c < 100000 else 10)
    team = roi.get("team_size")
    effort = roi.get("effort_level")
    time = 10 if isinstance(team, (int, float)) and team >= 3 else 8 if effort == "full" else 5 if effort == "side" else 3
    tags = set(opp.get("tags") or [])
    if opp["industry_id"] == "ai":
        tech = 9
    elif tags & {"tech-driven", "ai-native"}:
        tech = 8
    elif "needs-license" in tags:
        tech = 6
    elif "platform-dependent" in tags:
        tech = 5
    else:
        tech = 3
    content = 8 if "content-driven" in tags else 7 if "localization-heavy" in tags else 6 if opp["industry_id"] in {"content", "gaming", "emotional", "culture"} else 4
    supply = 3
    if "needs-supply-chain" in tags:
        supply = 7
    if "china-advantage" in tags:
        supply = max(supply, 7)
    if "physical" in tags:
        supply = max(supply, 5)
    if "digital" in tags and "physical" not in tags and "needs-supply-chain" not in tags:
        supply = 2
    if is_chinese_market(opp):
        english = 2
    elif opp["industry_id"] == "culture" and "localization-heavy" in tags:
        english = 9
    elif any(l.lower() in NON_GENERIC for l in (opp.get("source_langs") or [])):
        english = 8
    elif is_english_market(opp):
        english = 5
    else:
        english = 6
    risk_dim = ((opp.get("scores") or {}).get("dimensions") or {}).get("risk", 5)
    risk = max(2, min(10, int(round1(11 - risk_dim) + 0.0) if False else int((11 - risk_dim) + 0.5)))
    return {"capital": capital, "time": time, "tech": tech, "content": content, "supply": supply, "english": english, "risk": risk}


def hard_constraints(profile: dict, opp: dict, cap: dict, need: dict) -> list[str]:
    out = []
    if cap["capital"] + 2 < need["capital"]:
        out.append("capital")
    tags = set(opp.get("tags") or [])
    if "needs-license" in tags and not profile.get("hasLicensePartner"):
        out.append("license")
    if "needs-supply-chain" in tags and cap["supply"] < 4:
        out.append("supply")
    if cap["english"] < 4 and need["english"] >= 5 and not is_chinese_market(opp):
        out.append("english")
    return out


def score(profile: dict, opp: dict) -> dict:
    cap = capability(profile)
    need = demand(opp)
    ratios = {}
    for k in FIT_WEIGHTS:
        ratios[k] = max(0.0, min(10.0, 10.0 * cap[k] / max(need[k], 1)))
    match = round1(sum(FIT_WEIGHTS[k] * ratios[k] for k in FIT_WEIGHTS))
    fit = round3(match / 10)
    total = float(opp["scores"]["total"])
    rec = round1(0.6 * total + 0.4 * fit * 100)
    return {
        "cap": cap, "need": need, "ratios": ratios, "match": match, "fit": fit, "rec": rec,
        "total": total, "grade": opp["scores"]["grade"], "hard": hard_constraints(profile, opp, cap, need),
    }


def main() -> None:
    opps = json.loads((DATA / "opportunities.json").read_text(encoding="utf-8"))
    taxonomy = json.loads((DATA / "taxonomy.json").read_text(encoding="utf-8"))
    source_health = json.loads((DATA / "source-health.json").read_text(encoding="utf-8"))
    ind_name = {i["id"]: i["name"] for i in taxonomy["industries"]}
    region_name = {i["id"]: i["name"] for i in taxonomy["regions"]}
    gap_name = {i["id"]: i["name"] for i in taxonomy["gap_types"]}

    profiles = {
        "side-hustle": {"capitalBand": "b1-5w", "weeklyHours": 10, "fullTime": False, "skills": {"tech": 1, "content": 2, "supply": 0, "ops": 2}, "english": 2, "risk": 3, "hasLicensePartner": False},
        "lt1w-lowcap": {"capitalBand": "lt1w", "weeklyHours": 5, "fullTime": False, "skills": {"tech": 0, "content": 0, "supply": 0, "ops": 0}, "english": 0, "risk": 1, "hasLicensePartner": False},
    }
    out: dict = {"profiles": {}, "opps": {}}
    for pname, profile in profiles.items():
        cap = capability(profile)
        scored = []
        for opp in opps:
            s = score(profile, opp)
            s.update({
                "id": opp["id"], "title": opp["title"], "industry": opp["industry_id"],
                "industry_name": ind_name.get(opp["industry_id"]),
                "region0": (opp.get("region_ids") or [None])[0], "gap0": (opp.get("gap_type_ids") or [None])[0],
            })
            scored.append(s)
        filtered = [s for s in scored if s["hard"]]
        pool = [s for s in scored if not s["hard"] and opps[[o["id"] for o in opps].index(s["id"])]["window"]["status"] != "closed"]
        # MMR top10
        def jacc(a, b):
            a, b = set(a), set(b)
            return len(a & b) / len(a | b) if (a | b) else 0.0
        industries = {s["id"]: s["industry"] for s in scored}
        regions = {s["id"]: set((o.get("region_ids") or [])) for s in scored for o in opps if o["id"] == s["id"]}
        gaps = {s["id"]: set((o.get("gap_type_ids") or [])) for s in scored for o in opps if o["id"] == s["id"]}

        from itertools import chain  # noqa: F401
        maxrec = max((s["rec"] for s in pool), default=1)
        selected: list[dict] = []
        remaining = list(pool)
        while remaining and len(selected) < 10:
            best = None
            best_mmr = -1e9
            for cand in remaining:
                rel = cand["rec"] / max(maxrec, 1)
                sims = []
                for sel in selected:
                    ind = 1.0 if cand["industry"] == sel["industry"] else 0.0
                    rj = jacc(regions[cand["id"]], regions[sel["id"]])
                    gj = jacc(gaps[cand["id"]], gaps[sel["id"]])
                    sims.append((ind + rj + gj) / 3)
                mmr = 0.7 * rel - 0.3 * (max(sims) if sims else 0)
                # 配额
                ok = True
                if len(selected) < 10:
                    same_ind = sum(1 for s in selected if s["industry"] == cand["industry"])
                    same_reg = sum(1 for s in selected if s["region0"] == cand["region0"])
                    same_gap = sum(1 for s in selected if s["gap0"] == cand["gap0"])
                    if same_ind >= 2 or same_reg >= 3 or same_gap >= 3:
                        ok = False
                if ok and mmr > best_mmr:
                    best, best_mmr = cand, mmr
            if best is None:
                # 放宽配额
                for cand in remaining:
                    rel = cand["rec"] / max(maxrec, 1)
                    sims = []
                    for sel in selected:
                        ind = 1.0 if cand["industry"] == sel["industry"] else 0.0
                        rj = jacc(regions[cand["id"]], regions[sel["id"]])
                        gj = jacc(gaps[cand["id"]], gaps[sel["id"]])
                        sims.append((ind + rj + gj) / 3)
                    mmr = 0.7 * rel - 0.3 * (max(sims) if sims else 0)
                    if best is None or mmr > best_mmr:
                        best, best_mmr = cand, mmr
            if best is None:
                break
            selected.append(best)
            remaining.remove(best)
        out["profiles"][pname] = {
            "capability": cap,
            "filteredByHard": len(filtered),
            "hardFilteredIds": [s["id"] for s in filtered],
            "candidateCount": len(pool),
            "recommended": [{k: s[k] for k in ("id", "title", "rec", "fit", "total", "grade", "hard", "industry", "match")} for s in selected],
        }
        for s in scored:
            out["opps"].setdefault(s["id"], {})[pname] = {k: s[k] for k in ("rec", "fit", "match", "need", "ratios", "hard", "total", "grade")}

    # pet glass 期望值（T-v03-05/06/13）
    pet = out["opps"]["opp-pet-memorial-glass-001"]["side-hustle"]
    # 高匹配预警（side-hustle）：fit>=0.75、hard=0、无实验（当前无实验）
    high_all = [oid for oid, v in out["opps"].items() if v["side-hustle"]["fit"] >= 0.75 and not v["side-hustle"]["hard"]]
    # 未核验 A 级
    unverified_a = [o["id"] for o in opps if not o.get("verified") and o["scores"]["grade"] in {"S", "A"}]
    # 窗口关闭
    closing = [o["id"] for o in opps if (o.get("window") or {}).get("months_left", 99) <= 3]
    failed_sources = [s["id"] for s in source_health.get("sources", []) if not s.get("ok")]
    out["alertsExpected"] = {
        "failedSources": failed_sources,
        "unverifiedA": unverified_a,
        "windowClosing": closing,
        "highMatch": high_all,
        "experimentNone": True,
    }
    out["petGlass"] = {
        "capability": out["profiles"]["side-hustle"]["capability"],
        "need": pet["need"], "ratios": pet["ratios"], "match": pet["match"], "fit": pet["fit"], "rec": pet["rec"], "total": pet["total"],
    }
    (ROOT / "qa" / "tmp").mkdir(exist_ok=True)
    (ROOT / "qa" / "tmp" / "recommend-expected.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: out[k] for k in ("petGlass",)}, ensure_ascii=False, indent=2))
    print("profiles:", {k: {kk: v[kk] for kk in ("filteredByHard", "candidateCount")} for k, v in out["profiles"].items()})
    print("alertsExpected:", json.dumps({k: (v if not isinstance(v, list) else f"{len(v)} 条") for k, v in out["alertsExpected"].items()}, ensure_ascii=False))
    print("saved -> qa/tmp/recommend-expected.json")


if __name__ == "__main__":
    main()
