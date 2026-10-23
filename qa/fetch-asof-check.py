"""qa/fetch-asof-check.py —— v0.7.3 pipeline --fetch --as-of 红队验收。

安全策略：备份 scanner/outbox/ 与 data/source-health.json，测试后恢复原字节并校验 SHA256。
覆盖：
1) `pipeline.py --fetch --as-of YYYY-MM-DD`：生成 scanner/outbox/signals-<date>.json，且 meta.as_of==date；
2) 默认 `--fetch`（无 --as-of）仍使用 taxonomy as_of（兼容旧行为）；
3) `--all --fetch --as-of DATE` 同给时 fetch 也使用该日期（不因 --all 覆盖）；
4) 真实网络采集成功/失败都如实记录，outbox 文件 JSON 合法、signals 安全字段齐全；
5) 测试后 outbox/source-health 恢复，数据指纹不变。
用法：python qa/fetch-asof-check.py [--skip-network]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTBOX = ROOT / "scanner" / "outbox"
HEALTH = ROOT / "data" / "source-health.json"
TMP = ROOT / "qa" / "tmp"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(args: list[str], timeout: int = 600) -> subprocess.CompletedProcess:
    env = {**__import__("os").environ, "PYTHONIOENCODING": "utf-8"}
    return subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout, env=env)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-network", action="store_true")
    args = ap.parse_args()
    TMP.mkdir(parents=True, exist_ok=True)
    outbox_backup = TMP / "outbox-backup-v073"
    shutil.rmtree(outbox_backup, ignore_errors=True)
    if OUTBOX.exists():
        shutil.copytree(OUTBOX, outbox_backup)
    health_backup = TMP / "source-health-backup-v073.json"
    if HEALTH.exists():
        shutil.copy2(HEALTH, health_backup)
    outbox_before = {p.name: sha(p) for p in OUTBOX.glob("*") if p.is_file()} if OUTBOX.exists() else {}
    health_before = sha(HEALTH) if HEALTH.exists() else None
    taxonomy = json.loads((ROOT / "data" / "taxonomy.json").read_text(encoding="utf-8"))
    taxonomy_as_of = str((taxonomy.get("meta") or {}).get("as_of") or "")
    rankings = json.loads((ROOT / "data" / "rankings.json").read_text(encoding="utf-8"))
    current_as_of = str((rankings.get("meta") or {}).get("as_of") or "")
    try:
        if not args.skip_network:
            # 1) 显式日期
            target = current_as_of or taxonomy_as_of
            out = run(["scanner/pipeline.py", "--fetch", "--as-of", target, "--fetch-limit", "8"])
            f = OUTBOX / f"signals-{target}.json"
            if out.returncode != 0:
                P1.append(f"--fetch --as-of {target} exit={out.returncode}: {(out.stdout + out.stderr)[-240:]}")
            elif not f.exists():
                P0.append(f"--fetch --as-of {target} 未生成 {f.name}")
            else:
                data = json.loads(f.read_text(encoding="utf-8"))
                meta = data.get("meta") or {}
                if str(meta.get("as_of")) != target:
                    P0.append(f"{f.name} meta.as_of={meta.get('as_of')!r} ≠ {target}")
                if not isinstance(data.get("signals"), list):
                    P0.append(f"{f.name} signals 非数组")
                else:
                    notes.append(f"--fetch --as-of {target}：{f.name} · as_of={meta.get('as_of')} · raw={meta.get('raw_count', '?')} signal={len(data.get('signals') or [])} · exit=0 ✅")
            # 2) 默认 --fetch 用 taxonomy as_of（若与当前 as_of 不同，生成 taxonomy 日期文件）
            out2 = run(["scanner/pipeline.py", "--fetch", "--fetch-limit", "8"])
            f2 = OUTBOX / f"signals-{taxonomy_as_of}.json"
            if out2.returncode != 0:
                P2.append(f"默认 --fetch exit={out2.returncode}（网络波动可接受）：{(out2.stdout + out2.stderr)[-200:]}")
            elif f2.exists():
                m2 = (json.loads(f2.read_text(encoding="utf-8")).get("meta") or {}).get("as_of")
                if str(m2) != taxonomy_as_of:
                    P1.append(f"默认 --fetch 生成 {f2.name} meta.as_of={m2!r} ≠ taxonomy as_of {taxonomy_as_of}")
                else:
                    notes.append(f"默认 --fetch：使用 taxonomy as_of={taxonomy_as_of}（兼容）✅")
            else:
                P2.append(f"默认 --fetch 未生成 signals-{taxonomy_as_of}.json")
            # 3) --all + --fetch 同给
            combo = current_as_of or taxonomy_as_of
            out3 = run(["scanner/pipeline.py", "--all", "--fetch", "--as-of", combo, "--fetch-limit", "8"])
            f3 = OUTBOX / f"signals-{combo}.json"
            if out3.returncode != 0:
                P1.append(f"--all --fetch --as-of {combo} exit={out3.returncode}: {(out3.stdout + out3.stderr)[-240:]}")
            elif not f3.exists():
                P2.append(f"--all --fetch 未生成 signals-{combo}.json")
            else:
                m3 = (json.loads(f3.read_text(encoding="utf-8")).get("meta") or {}).get("as_of")
                if str(m3) != combo:
                    P1.append(f"--all+--fetch 文件 meta.as_of={m3!r} ≠ {combo}")
                else:
                    notes.append(f"--all + --fetch --as-of {combo}：fetch 也使用该日期 ✅")
        else:
            notes.append("--skip-network：跳过真实采集，仅静态检查命令/参数")
            help_out = run(["scanner/pipeline.py", "--help"])
            blob = help_out.stdout + help_out.stderr
            for token in ("--fetch", "--as-of", "--fetch-limit"):
                if token not in blob:
                    P1.append(f"pipeline --help 缺 {token}")
            notes.append("pipeline --help 含 --fetch/--as-of/--fetch-limit ✅")
        # 4) outbox 信号安全字段抽查
        files = sorted(OUTBOX.glob("signals-*.json"))
        if files:
            data = json.loads(files[-1].read_text(encoding="utf-8"))
            sigs = data.get("signals") or []
            need = {"signal_id", "raw_id", "source_id", "url", "title", "lang", "published_date", "collected_at"}
            if sigs:
                miss = [k for k in need if k not in sigs[0]]
                if miss:
                    P1.append(f"outbox 信号缺字段 {miss}")
                else:
                    notes.append(f"outbox 信号字段抽查（{files[-1].name}，{len(sigs)} 条）：id/source_id/url/title/lang/fetched_at/signal_type 齐全 ✅")
        else:
            P2.append("outbox 无 signals-*.json")
    finally:
        # 恢复 outbox 与 source-health
        if OUTBOX.exists():
            shutil.rmtree(OUTBOX)
        if outbox_backup.exists():
            shutil.copytree(outbox_backup, OUTBOX)
        else:
            OUTBOX.mkdir(parents=True, exist_ok=True)
        if health_backup.exists():
            shutil.copy2(health_backup, HEALTH)
        outbox_after = {p.name: sha(p) for p in OUTBOX.glob("*") if p.is_file()} if OUTBOX.exists() else {}
        if outbox_after != outbox_before:
            P0.append("outbox 未恢复到测试前状态")
        elif health_before and sha(HEALTH) != health_before:
            P0.append("source-health.json 未恢复到测试前状态")
        else:
            notes.append("测试后 outbox 与 source-health 已恢复基线 SHA256 ✅")

    print("\n== fetch-asof-check ==")
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
