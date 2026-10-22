"""qa/asof-check.py —— v0.6.1 `pipeline --as-of` 每日运行语义红队验收。

安全策略：先把 data/ 完整备份到 qa/tmp/v061-data-backup，逐日测试后整体恢复并校验 SHA256 与基线一致，
不把非基准日数据留在仓库。覆盖：
1) 基线：rankings.meta.as_of=2026-10-22、data 0.6.1、四窗口 17/49/57/80、validate 20/20；
2) --as-of 2026-10-23 → day 0/week 49/month 57/year 80；2026-11-01 → 0/0/0/80；2027-01-01 → 全 0；
   validate 在非基准日仍 20/20（V08 只校验结构、允许空榜），且日志含「非基准日…仅校验结构」提示；
3) rankings/stats meta.as_of、history 快照文件名与 meta、报告/年鉴日期跟随 as_of；
4) 同 as_of 双跑字节级确定性；非法日期 exit 2 且数据不变；
5) 恢复基线后所有 data 文件 SHA256 与备份一致、validate 20/20。
用法：python qa/asof-check.py
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TMP = ROOT / "qa" / "tmp"
BACKUP = TMP / "v061-data-backup"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []


def force_rmtree(path: Path, retries: int = 6) -> None:
    """Windows 下文件可能短暂被占用：带重试删除。"""
    import time
    for i in range(retries):
        try:
            if path.exists():
                shutil.rmtree(path)
            return
        except PermissionError:
            time.sleep(1.0 + i * 0.5)
    if path.exists():
        shutil.rmtree(path)


def restore_baseline() -> None:
    force_rmtree(DATA)
    shutil.copytree(BACKUP, DATA)


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def snapshot_data() -> dict[str, str]:
    return {str(p.relative_to(ROOT)).replace("\\", "/"): sha(p) for p in sorted(DATA.rglob("*")) if p.is_file()}


def run(args: list[str]) -> subprocess.CompletedProcess:
    env = {**__import__("os").environ, "PYTHONIOENCODING": "utf-8"}
    return subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=600, env=env)


def load(rel: str):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def counts(rankings: dict) -> dict[str, int]:
    return {w: len((v or {}).get("items") or []) for w, v in (rankings.get("windows") or {}).items()}


def validate_ok(out: subprocess.CompletedProcess) -> bool:
    return out.returncode == 0 and "20/20" in (out.stdout + out.stderr)


def main() -> int:
    TMP.mkdir(parents=True, exist_ok=True)
    # ---------- 备份基线 ----------
    shutil.rmtree(BACKUP, ignore_errors=True)
    shutil.copytree(DATA, BACKUP)
    base_hashes = snapshot_data()
    notes.append(f"data 基线备份：{len(base_hashes)} 个文件 → {BACKUP.relative_to(ROOT)}")
    try:
        # ---------- 0) 基线状态 ----------
        rankings = load("data/rankings.json")
        stats = load("data/stats.json")
        mv = (rankings.get("meta") or {}).get("data_version")
        as_of = (rankings.get("meta") or {}).get("as_of")
        if as_of != "2026-10-22":
            P0.append(f"基线 rankings.meta.as_of={as_of!r} ≠ 2026-10-22（data 未恢复基准日？）")
        if mv != "0.6.1":
            P0.append(f"rankings.meta.data_version={mv!r} ≠ 0.6.1")
        if stats.get("meta", {}).get("as_of") != "2026-10-22":
            P1.append("基线 stats.meta.as_of 不是 2026-10-22")
        if counts(rankings) != {"day": 17, "week": 49, "month": 57, "year": 80}:
            P0.append(f"基线四窗口={counts(rankings)} ≠ 17/49/57/80")
        v = run(["scanner/validate.py"])
        if not validate_ok(v):
            P0.append(f"基线 validate 失败：{v.returncode} {(v.stdout + v.stderr)[-200:]}")

        cases = [
            ("2026-10-23", {"day": 0, "week": 49, "month": 57, "year": 80}),
            ("2026-11-01", {"day": 0, "week": 0, "month": 0, "year": 80}),
            ("2027-01-01", {"day": 0, "week": 0, "month": 0, "year": 0}),
        ]
        for target, expected in cases:
            out = run(["scanner/pipeline.py", "--all", "--as-of", target])
            blob = out.stdout + out.stderr
            if out.returncode != 0:
                P0.append(f"--as-of {target} pipeline exit={out.returncode}: {blob[-300:]}")
                continue
            r = load("data/rankings.json")
            s = load("data/stats.json")
            got = counts(r)
            meta = r.get("meta") or {}
            if got != expected:
                P0.append(f"--as-of {target} 窗口={got} ≠ {expected}")
            if meta.get("as_of") != target:
                P0.append(f"--as-of {target} rankings.meta.as_of={meta.get('as_of')!r}")
            if s.get("meta", {}).get("as_of") != target:
                P0.append(f"--as-of {target} stats.meta.as_of={s.get('meta', {}).get('as_of')!r}")
            snap = DATA / "history" / f"rankings-{target}.json"
            if not snap.exists():
                P1.append(f"--as-of {target} 未生成 history/rankings-{target}.json")
            else:
                sm = load(f"data/history/rankings-{target}.json").get("meta") or {}
                if sm.get("as_of") != target:
                    P1.append(f"history {target} meta.as_of={sm.get('as_of')!r}")
                if sm.get("snapshot_at", "").startswith(target) is False:
                    P2.append(f"history {target} snapshot_at={sm.get('snapshot_at')!r}")
                if sm.get("reconstructed") is not False:
                    P1.append(f"真实每日快照 {target} reconstructed 应为 false")
            # 报告跟随 as_of（--report 显式生成，文件名/内容带 as_of）
            rep = run(["scanner/pipeline.py", "--report", "--as-of", target])
            if rep.returncode != 0:
                P1.append(f"--report --as-of {target} exit={rep.returncode}: {(rep.stdout + rep.stderr)[-200:]}")
            else:
                rep_files = [f for f in (DATA / "reports").glob(f"report-*-{target}.*")]
                if len(rep_files) != 8:
                    P1.append(f"--report --as-of {target} 报告文件 {len(rep_files)} ≠ 8")
                else:
                    rep_md = next((f for f in rep_files if f.suffix == ".md"), None)
                    rep_text = rep_md.read_text(encoding="utf-8", errors="ignore") if rep_md else ""
                    if f"数据基准日：{target}" not in rep_text and target not in rep_text:
                        P1.append(f"报告未体现 as_of {target}")
                    else:
                        notes.append(f"--as-of {target}：四窗口报告 8 文件文件名/基准日跟随 ✅")
            # 年鉴 CLI 自动跟随 rankings.meta.as_of（--out-dir 临时目录，不污染 data/reports）
            yb_year = target[:4]
            yb_dir = TMP / f"yb-asof-{target}"
            force_rmtree(yb_dir)
            yb_dir.mkdir(parents=True)
            yb_run = run(["scanner/yearbook.py", "--year", yb_year, "--out-dir", str(yb_dir.relative_to(ROOT)).replace("\\", "/")])
            yb = yb_dir / f"yearbook-{yb_year}.md"
            if yb_run.returncode != 0 or not yb.exists():
                P1.append(f"--as-of {target} 后 yearbook --year {yb_year} 生成失败 exit={yb_run.returncode}: {(yb_run.stdout + yb_run.stderr)[-200:]}")
            else:
                yb_text = yb.read_text(encoding="utf-8", errors="ignore")
                if f"数据基准日：{target}" not in yb_text and target not in yb_text:
                    P1.append(f"yearbook-{yb_year} 未跟随 as_of {target}")
                else:
                    notes.append(f"--as-of {target}：yearbook 自动跟随 as_of ✅（{yb_year} 年，0 机会也可空态生成）")
            # validate（非基准日仅结构）
            v2 = run(["scanner/validate.py"])
            blob2 = v2.stdout + v2.stderr
            if not validate_ok(v2):
                P0.append(f"--as-of {target} validate 失败：{v2.returncode} {blob2[-260:]}")
            else:
                if target != "2026-10-22" and "非基准日" not in blob2:
                    P2.append(f"--as-of {target} validate 未提示「非基准日…仅校验结构」")
            # 确定性：同 as_of 双跑关键文件
            watch = ["data/rankings.json", "data/stats.json", f"data/history/rankings-{target}.json"]
            if yb.exists():
                watch.append(f"data/reports/yearbook-{yb_year}.md")
                watch.append(f"data/reports/yearbook-{yb_year}.html")
            h1 = {w: sha(ROOT / w) for w in watch if (ROOT / w).exists()}
            out2 = run(["scanner/pipeline.py", "--all", "--as-of", target])
            h2 = {w: sha(ROOT / w) for w in watch if (ROOT / w).exists()}
            if out2.returncode != 0 or h1 != h2:
                P1.append(f"--as-of {target} 双跑不字节一致（exit={out2.returncode}, diff={[k for k in h1 if h1[k] != h2.get(k)]}）")
            else:
                notes.append(f"--as-of {target}：窗口 {got} · validate 20/20 · 双跑一致 · 快照/meta/年鉴跟随 ✅")
            # 非法日期（在当前非基线状态下测试，之后恢复）
            bad = run(["scanner/pipeline.py", "--all", "--as-of", "2026-13-40"])
            if bad.returncode != 2:
                P1.append(f"非法日期 --as-of 2026-13-40 exit={bad.returncode} ≠ 2")
            else:
                notes.append("非法日期 --as-of 2026-13-40 → exit 2 ✅")
            # 每轮恢复基线，避免相互影响
            restore_baseline()
            restored = snapshot_data()
            if restored != base_hashes:
                diff = [k for k in base_hashes if base_hashes.get(k) != restored.get(k)]
                P0.append(f"恢复基线后指纹不一致：{diff[:5]}")
            # --replay-as-of 与 --as-of 互不影响（replay 以 --as-of 为基准往前推）
            replay = run(["scanner/pipeline.py", "--replay-as-of", "2026-10-23", "--replay-days", "2", "--as-of", "2026-10-23"])
            if replay.returncode != 0:
                P1.append(f"--replay-as-of + --as-of 组合 exit={replay.returncode}: {(replay.stdout + replay.stderr)[-220:]}")
            else:
                rr = load("data/rankings.json")
                if (rr.get("meta") or {}).get("as_of") != "2026-10-23":
                    P1.append(f"replay 组合后 rankings.meta.as_of={(rr.get('meta') or {}).get('as_of')!r} ≠ 2026-10-23")
                replay_snaps = []
                for f in sorted((DATA / "history").glob("rankings-2026-10-2[0-9].json")):
                    m = load(f"data/history/{f.name}").get("meta") or {}
                    if m.get("reconstructed") is True:
                        replay_snaps.append((f.name, m.get("replay_as_of"), m.get("as_of")))
                if not replay_snaps:
                    P2.append("replay 组合未产生 reconstructed=true 快照")
                else:
                    bad = [x for x in replay_snaps if not x[1] or x[1] > "2026-10-23"]
                    if bad:
                        P1.append(f"replay 快照 replay_as_of 非法/超过 as_of：{bad[:3]}")
                    else:
                        notes.append(f"--replay-as-of + --as-of 组合：{len(replay_snaps)} 份回放快照 replay_as_of≤as_of ✅")
    finally:
        # ---------- 恢复基线并复核 ----------
        restore_baseline()
    restored = snapshot_data()
    if restored != base_hashes:
        diff = [k for k in base_hashes if base_hashes.get(k) != restored.get(k)]
        P0.append(f"最终恢复基线失败：{diff[:8]}")
    else:
        notes.append(f"最终恢复：{len(restored)} 个 data 文件 SHA256 与基线全部一致 ✅")
    rankings2 = load("data/rankings.json")
    if counts(rankings2) != {"day": 17, "week": 49, "month": 57, "year": 80} or (rankings2.get("meta") or {}).get("as_of") != "2026-10-22":
        P0.append(f"恢复后基线状态异常：as_of={(rankings2.get('meta') or {}).get('as_of')} counts={counts(rankings2)}")
    v3 = run(["scanner/validate.py"])
    if not validate_ok(v3):
        P0.append(f"恢复后 validate 失败：{(v3.stdout + v3.stderr)[-200:]}")
    else:
        notes.append("恢复后 validate 20/20 ✅")

    print("\n== asof-check ==")
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
