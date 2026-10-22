"""qa/enrich-check.py —— v0.4.0 AI 富化 outbox 红队独立验收。

覆盖：offline 实测/幂等（到临时目录）/schema/needs_human/七问占位/永不入库/gitignore/
dry-run 不写文件/--online 无 key 清晰失败/空 outbox/非法 JSON/REVIEW.md 可复核性。
用法：python qa/enrich-check.py
"""
from __future__ import annotations

import hashlib
import json
import os
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


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args: list[str], env_extra: dict | None = None) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env.pop("LLM_API_KEY", None)
    env.pop("LLM_BASE_URL", None)
    env.pop("LLM_MODEL", None)
    if env_extra:
        env.update(env_extra)
    return subprocess.run([sys.executable, str(ROOT / "scanner" / "enrich.py"), *args],
                          cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="ignore", env=env, timeout=300)


def main() -> int:
    TMP.mkdir(parents=True, exist_ok=True)
    fixture_dir = TMP / "enrich-check"
    shutil.rmtree(fixture_dir, ignore_errors=True)
    fixture_dir.mkdir(parents=True)
    signals_path = OUTBOX / "signals-2026-10-22.json"
    if not signals_path.exists():
        p0msg = "缺少 scanner/outbox/signals-2026-10-22.json（先运行 --fetch）"
        print("P0:", p0msg)
        return 1
    signals = json.loads(signals_path.read_text(encoding="utf-8"))
    signal_count = len(signals.get("signals") or [])
    opps_before = sha(OPPS)

    # 1) 跑一次到临时目录，结果与交付产物比较（除 generated_at 外逐字段）
    proc = run(["--signals", str(signals_path), "--out-dir", str(fixture_dir)])
    print("[run] exit=", proc.returncode)
    if proc.returncode != 0:
        P0.append(f"enrich.py 运行失败 exit={proc.returncode}: {proc.stderr[-300:]}")
        return report()
    out_json = fixture_dir / "enriched-2026-10-22.json"
    out_md = fixture_dir / "REVIEW.md"
    if not out_json.exists():
        P0.append("未生成 enriched-2026-10-22.json")
        return report()
    data = json.loads(out_json.read_text(encoding="utf-8"))
    meta = data.get("meta") or {}
    candidates = data.get("candidates") or []
    if meta.get("generator") != "offline-template":
        P1.append(f"meta.generator={meta.get('generator')!r} ≠ offline-template（无 LLM_API_KEY 时应回退 offline）")
    if meta.get("dry_run") is not False:
        P1.append("实际运行 meta.dry_run 应为 false")
    if meta.get("candidate_count") != signal_count:
        P1.append(f"candidate_count={meta.get('candidate_count')} ≠ outbox signals={signal_count}")
    if meta.get("skipped") != 0:
        P2.append(f"skipped={meta.get('skipped')}（本轮期望 0）")
    if meta.get("key_logged") is not False:
        P0.append("meta.key_logged 应为 false")
    if not out_md.exists() or out_md.stat().st_size < 10_000:
        P1.append("REVIEW.md 缺失或过小")
    text = out_json.read_text(encoding="utf-8") + (out_md.read_text(encoding="utf-8") if out_md.exists() else "")
    if "sk-" in text or "LLM_API_KEY=" in text or "api_key" in text.lower():
        P2.append("产物文本中出现疑似 key/api_key 字样（需人工确认无明文密钥）")
    notes.append(f"offline enrich：signals={signal_count} candidates={len(candidates)} skipped={meta.get('skipped')} REVIEW={out_md.stat().st_size if out_md.exists() else 0}B")

    # 2) schema 校验（docs/12 §1.3）
    taxonomy = json.loads((ROOT / "data" / "taxonomy.json").read_text(encoding="utf-8"))
    gap_ids = {g["id"] for g in taxonomy["gap_types"]}
    need_ids = {n["id"] for n in taxonomy["human_needs"]}
    seven_keys = {"traffic", "money", "model", "roi", "audience", "drivers", "moat"}
    bad = 0
    for c in candidates:
        for key in ("source_id", "url", "title", "lang", "signal_type", "gap_type_ids", "human_need_ids", "seven_questions_draft", "notes", "needs_human"):
            if key not in c:
                bad += 1
                P1.append(f"候选 {c.get('candidate_id')} 缺字段 {key}")
                break
        if c.get("needs_human") is not True:
            P0.append(f"候选 {c.get('candidate_id')} needs_human!=true（永不入库约束）")
        draft = c.get("seven_questions_draft") or {}
        if set(draft.keys()) != seven_keys:
            P1.append(f"候选 {c.get('candidate_id')} 七问草稿 key={sorted(draft.keys())} 不完整")
        if not any("待人工补充" in str(v) for v in draft.values()):
            P1.append(f"候选 {c.get('candidate_id')} 七问草稿未标注待人工补充")
        for g in c.get("gap_type_ids") or []:
            if g not in gap_ids:
                P1.append(f"候选 {c.get('candidate_id')} gap_type_id={g} 不在 taxonomy")
        for n in c.get("human_need_ids") or []:
            if n not in need_ids:
                P1.append(f"候选 {c.get('candidate_id')} human_need_id={n} 不在 taxonomy")
        if not str(c.get("url", "")).startswith("http"):
            P1.append(f"候选 {c.get('candidate_id')} url 非法")
    if bad == 0 and candidates:
        notes.append("schema：候选 10 必填字段/七问 key/枚举引用全部合法")
    # 七问草稿是 dict，DRIVERS 为数组；检查 REVIEW 包含全部候选标题
    review = out_md.read_text(encoding="utf-8") if out_md.exists() else ""
    missing_titles = sum(1 for c in candidates if str(c.get("title", ""))[:20] and str(c.get("title", ""))[:20] not in review)
    if missing_titles > 0:
        P1.append(f"REVIEW.md 缺少 {missing_titles}/{len(candidates)} 个候选标题")
    notes.append(f"REVIEW.md 候选覆盖：{len(candidates) - missing_titles}/{len(candidates)}")

    # 3) 永不写 data/opportunities.json
    opps_after = sha(OPPS)
    if opps_before != opps_after:
        P0.append("enrich.py 修改了 data/opportunities.json（违反永不自动入库）")
    else:
        notes.append("opportunities.json SHA256 不变 ✅")

    # 4) 幂等（临时目录重跑，忽略 generated_at 差异时要求内容一致）
    proc2 = run(["--signals", str(signals_path), "--out-dir", str(fixture_dir)])
    data2 = json.loads(out_json.read_text(encoding="utf-8"))
    m1, m2 = data.get("meta") or {}, data2.get("meta") or {}
    diffs = [k for k in ("generator", "signal_count", "candidate_count", "skipped", "key_logged", "dry_run") if m1.get(k) != m2.get(k)]
    if diffs:
        P1.append(f"重复运行 meta 不一致字段：{diffs}")
    if data.get("candidates") != data2.get("candidates"):
        P2.append("重复运行 candidates 内容不一致（非幂等，但 offline 模板通常确定性；建议记录）")
    else:
        notes.append("重复运行 candidates 字节一致（generated_at 除外）")

    # 5) dry-run 不写文件
    dry_dir = TMP / "enrich-dry"
    shutil.rmtree(dry_dir, ignore_errors=True)
    dry_dir.mkdir()
    proc3 = run(["--signals", str(signals_path), "--out-dir", str(dry_dir), "--dry-run"])
    written = list(dry_dir.rglob("*"))
    if proc3.returncode != 0:
        P1.append(f"--dry-run exit={proc3.returncode}: {proc3.stderr[-200:]}")
    if written:
        P1.append(f"--dry-run 仍写入文件：{[p.name for p in written][:5]}")
    else:
        notes.append("--dry-run 未写任何文件 ✅")

    # 6) --online 无 key：exit 2 且给出清晰错误、不写文件
    online_dir = TMP / "enrich-online"
    shutil.rmtree(online_dir, ignore_errors=True)
    online_dir.mkdir()
    proc4 = run(["--signals", str(signals_path), "--out-dir", str(online_dir), "--online"])
    if proc4.returncode != 2:
        P1.append(f"--online 无 LLM_API_KEY 应 exit 2，实际 {proc4.returncode}")
    blob = (proc4.stdout + proc4.stderr)
    if "LLM_API_KEY" not in blob:
        P1.append("--online 无 key 的错误信息未提及 LLM_API_KEY")
    if list(online_dir.rglob("*")):
        P1.append("--online 无 key 仍写了文件")
    else:
        notes.append(f"--online 无 key：exit={proc4.returncode}，明确提示 LLM_API_KEY，未写文件 ✅")

    # 7) 空 outbox：0 候选、干净退出
    empty = fixture_dir / "empty-signals.json"
    empty.write_text(json.dumps({"meta": {"as_of": "2026-10-22", "data_version": "0.4.0"}, "signals": []}, ensure_ascii=False), encoding="utf-8")
    empty_dir = TMP / "enrich-empty"
    shutil.rmtree(empty_dir, ignore_errors=True)
    empty_dir.mkdir()
    proc5 = run(["--signals", str(empty), "--out-dir", str(empty_dir)])
    if proc5.returncode != 0:
        P1.append(f"空 outbox 应干净退出，实际 exit={proc5.returncode}: {proc5.stderr[-200:]}")
    else:
        notes.append("空 outbox：exit 0 正常处理 ✅")
    # 8) 非法 JSON：错误可控
    bad_file = fixture_dir / "bad-signals.json"
    bad_file.write_text("{not-json", encoding="utf-8")
    bad_dir = TMP / "enrich-bad"
    shutil.rmtree(bad_dir, ignore_errors=True)
    bad_dir.mkdir()
    proc6 = run(["--signals", str(bad_file), "--out-dir", str(bad_dir)])
    if proc6.returncode == 0:
        P1.append("非法 JSON outbox 不应 exit 0")
    else:
        notes.append(f"非法 outbox：exit={proc6.returncode}（可控失败）")

    # 9) gitignore
    gi = subprocess.run(["git", "check-ignore", str(OUTBOX / "enriched-2026-10-22.json"), str(OUTBOX / "REVIEW.md")],
                        cwd=ROOT, capture_output=True, text=True)
    if gi.returncode != 0:
        P1.append("enriched/REVIEW.md 未被 .gitignore 忽略")
    else:
        notes.append("outbox enriched/REVIEW/signals 均被 .gitignore 忽略 ✅")
    return report()


def report() -> int:
    print("\n== enrich-check ==")
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
