"""qa/enrich-provider-check.py —— v0.5.1 enrich.py provider mock / usage / limit 红队验收。

覆盖：--provider mock 走同请求解析流程且不联网、meta.generator=mock-llm/model=mock-model、
产物 schema/needs_human 不变、usage{input_tokens,output_tokens,estimated_cost_usd} 记录、
--limit N 生效、无 key online 清晰报错、dry-run 不落盘、永不写 opportunities、outbox gitignore、
本地 HTTP mock server 单测存在（unittest 中覆盖）。不依赖外网/真实 key。
用法：python qa/enrich-provider-check.py
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP = ROOT / "qa" / "tmp"
OUTBOX = ROOT / "scanner" / "outbox"
OPPS = ROOT / "data" / "opportunities.json"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(args: list[str], env_extra: dict | None = None) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env.pop("LLM_API_KEY", None)
    env.pop("LLM_BASE_URL", None)
    env.pop("LLM_MODEL", None)
    if env_extra:
        env.update(env_extra)
    return subprocess.run([sys.executable, str(ROOT / "scanner" / "enrich.py"), *args],
                          cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="ignore", env=env, timeout=300)


def load_out(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def main() -> int:
    TMP.mkdir(parents=True, exist_ok=True)
    signals_path = OUTBOX / "signals-2026-10-22.json"
    if not signals_path.exists():
        print("P0: 缺少 outbox signals（先 --fetch）")
        return 1
    opps_before = sha(OPPS)
    signals = json.loads(signals_path.read_text(encoding="utf-8"))
    n_signals = len(signals.get("signals") or [])

    # ---------- 1) --provider mock（必须不联网、完整流程） ----------
    mock_dir = TMP / "enrich-mock"
    shutil.rmtree(mock_dir, ignore_errors=True)
    mock_dir.mkdir(parents=True)
    proc = run(["--signals", str(signals_path), "--out-dir", str(mock_dir), "--provider", "mock"])
    out_json = mock_dir / "enriched-2026-10-22.json"
    data = load_out(out_json)
    meta = (data or {}).get("meta") or {}
    cands = (data or {}).get("candidates") or []
    notes.append(f"--provider mock：exit={proc.returncode} candidates={len(cands)} meta.generator={meta.get('generator')!r}")
    if proc.returncode != 0:
        P0.append(f"--provider mock 失败 exit={proc.returncode}: {proc.stderr[-300:]}")
    else:
        if meta.get("generator") != "mock-llm":
            P1.append(f"mock 模式 meta.generator={meta.get('generator')!r} ≠ mock-llm")
        if str(meta.get("model")) != "mock-model":
            P1.append(f"mock 模式 meta.model={meta.get('model')!r} ≠ mock-model")
        if not cands:
            P1.append("mock 模式未产出候选")
        if any(c.get("needs_human") is not True for c in cands):
            P0.append("mock 候选存在 needs_human != true")
        if len(cands) != n_signals:
            P2.append(f"mock candidates={len(cands)} ≠ signals={n_signals}（可能受 limit 影响）")
        usage = meta.get("usage") or {}
        for k in ("input_tokens", "output_tokens", "estimated_cost_usd"):
            if k not in usage:
                P1.append(f"mock 模式缺少 meta.usage.{k}")
        notes.append(f"usage={json.dumps(usage, ensure_ascii=False)[:160]}")
        # 候选 schema 与 offline 一致
        sample = cands[0] if cands else {}
        for k in ("source_id", "url", "title", "lang", "signal_type", "gap_type_ids", "human_need_ids", "seven_questions_draft", "notes", "needs_human"):
            if k not in sample:
                P1.append(f"mock 候选缺字段 {k}")
        # mock 不应依赖网络：运行输出无 URL 请求痕迹（本地 http mock 单测另由 unittest 覆盖）
        blob = (proc.stdout + proc.stderr).lower()
        if "http://" in blob or "https://" in blob:
            P2.append("mock 输出出现 URL（可能仅提示信息，非网络请求）")

    # ---------- 2) --limit N ----------
    lim_dir = TMP / "enrich-limit"
    shutil.rmtree(lim_dir, ignore_errors=True)
    lim_dir.mkdir(parents=True)
    proc2 = run(["--signals", str(signals_path), "--out-dir", str(lim_dir), "--provider", "mock", "--limit", "5"])
    lim = load_out(lim_dir / "enriched-2026-10-22.json")
    lim_meta = (lim or {}).get("meta") or {}
    lim_c = (lim or {}).get("candidates") or []
    if proc2.returncode != 0:
        P1.append(f"--limit 5 失败 exit={proc2.returncode}: {proc2.stderr[-200:]}")
    elif len(lim_c) != 5:
        P1.append(f"--limit 5 实际 candidates={len(lim_c)}")
    else:
        notes.append(f"--limit 5：candidates={len(lim_c)} ✅")
    u2 = lim_meta.get("usage") or {}
    if proc2.returncode == 0:
        for k in ("input_tokens", "output_tokens", "estimated_cost_usd"):
            if k not in u2:
                P1.append(f"--limit 5 缺少 meta.usage.{k}")
        if u2.get("calls") == 0 and u2.get("cache_hits", 0) > 0:
            notes.append(f"--limit 5 缓存命中（tokens=0, cache_hits={u2.get('cache_hits')}，缓存不重复计费）")

    # ---------- 3) 相对 --out-dir 不崩溃（v0.5.1 P1 回归） ----------
    rel_dir = TMP / "enrich-relative"
    shutil.rmtree(rel_dir, ignore_errors=True)
    rel_arg = str(rel_dir.relative_to(ROOT)).replace("\\", "/")
    proc_rel = run(["--signals", str(signals_path), "--out-dir", rel_arg, "--provider", "mock", "--limit", "2"])
    if proc_rel.returncode != 0:
        P1.append(f"相对 --out-dir 崩溃：exit={proc_rel.returncode}；{proc_rel.stderr.strip().splitlines()[-1] if proc_rel.stderr.strip() else ''}")
    else:
        notes.append("相对 --out-dir：exit=0 正常 ✅")
    # ---------- 3) dry-run 不落盘（mock） ----------
    dry_dir = TMP / "enrich-dry-v051"
    shutil.rmtree(dry_dir, ignore_errors=True)
    dry_dir.mkdir()
    proc3 = run(["--signals", str(signals_path), "--out-dir", str(dry_dir), "--provider", "mock", "--dry-run"])
    if proc3.returncode != 0:
        P1.append(f"mock dry-run exit={proc3.returncode}: {proc3.stderr[-200:]}")
    if list(dry_dir.rglob("*")):
        P1.append("mock dry-run 仍写文件")
    else:
        notes.append("mock dry-run 零落盘 ✅")

    # ---------- 4) online 无 key ----------
    no_key = run(["--signals", str(signals_path), "--out-dir", str(TMP / "enrich-nokey"), "--online"])
    blob = no_key.stdout + no_key.stderr
    if no_key.returncode != 2 or "LLM_API_KEY" not in blob:
        P1.append(f"online 无 key 行为不符：exit={no_key.returncode} 输出={blob[-160:]!r}")
    else:
        notes.append("online 无 key：exit 2 + 明确提示 LLM_API_KEY ✅")

    # ---------- 5) 铁律：不写机会库 / outbox gitignore ----------
    if sha(OPPS) != opps_before:
        P0.append("enrich 修改了 data/opportunities.json")
    gi = subprocess.run(["git", "check-ignore", str(OUTBOX / "enriched-2026-10-22.json"), str(OUTBOX / "REVIEW.md")],
                        cwd=ROOT, capture_output=True, text=True)
    if gi.returncode != 0:
        P1.append("outbox enriched/REVIEW 未被 gitignore")
    else:
        notes.append("opportunities.json 未变 + outbox gitignore ✅")

    # ---------- 6) mock 单测覆盖（本地 HTTP server）在 unittest 中 ----------
    tests_dir = ROOT / "scanner" / "tests"
    hit = []
    for f in tests_dir.glob("*.py"):
        txt = f.read_text(encoding="utf-8", errors="ignore")
        if re.search(r"HTTPServer|ThreadingHTTPServer|mock.*server|chat/completions", txt, re.I):
            hit.append(f.name)
    if not hit:
        P1.append("未找到本地 mock HTTP server 单测（chat/completions）")
    else:
        notes.append(f"本地 HTTP mock 单测文件：{hit}")
    return report()


def report() -> int:
    print("\n== enrich-provider-check ==")
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
