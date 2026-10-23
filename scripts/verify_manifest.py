#!/usr/bin/env python3
"""verify_manifest.py — 校验 releases/vX.Y.Z/MANIFEST.json 中的 sha256 与 git 对象一致

用法：
    python scripts/verify_manifest.py --release releases/v0.7.2
    python scripts/verify_manifest.py --release releases/v0.7.2 --git-rev HEAD
    python scripts/verify_manifest.py --release releases/v0.7.2 --worktree

说明：
- 默认以 `--git-rev <rev>`（默认 HEAD）的 git blob 字节计算 sha256，与 MANIFEST 比较；
- `--worktree` 则校验工作区文件（发布后未提交时使用）；
- 任一 mismatch 退出码 1；全部一致输出 "MANIFEST OK (N/N)"。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path


def git_blob(repo_root: Path, rev: str, rel_path: str) -> bytes:
    out = subprocess.run(
        ["git", "cat-file", "blob", f"{rev}:{rel_path}"],
        cwd=repo_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr.decode("utf-8", errors="replace").strip() or f"git cat-file 失败: {rel_path}")
    return out.stdout


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="校验 MANIFEST sha256 与 git blob 一致")
    parser.add_argument("--release", required=True, help="发布目录，如 releases/v0.7.2")
    parser.add_argument("--git-rev", default="HEAD", help="git rev（默认 HEAD）")
    parser.add_argument("--worktree", action="store_true", help="校验工作区而不是 git blob")
    args = parser.parse_args(argv)

    repo_root = Path(__file__).resolve().parent.parent
    release_dir = (repo_root / args.release).resolve() if not Path(args.release).is_absolute() else Path(args.release)
    manifest_path = release_dir / "MANIFEST.json"
    if not manifest_path.exists():
        print(f"[FAIL] 找不到 {manifest_path}", file=sys.stderr)
        return 2
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("files") or []
    if not entries:
        print("[FAIL] MANIFEST.files 为空", file=sys.stderr)
        return 2

    prefix = release_dir.relative_to(repo_root).as_posix()
    failures: list[str] = []
    for entry in entries:
        rel = str(entry.get("path", ""))
        expected = str(entry.get("sha256", "")).lower()
        git_rel = f"{prefix}/{rel}"
        if args.worktree:
            target = release_dir / rel
            if not target.exists():
                failures.append(f"{rel}: 文件缺失")
                continue
            data = target.read_bytes()
        else:
            try:
                data = git_blob(repo_root, args.git_rev, git_rel)
            except RuntimeError as exc:
                failures.append(f"{rel}: {exc}")
                continue
        actual = hashlib.sha256(data).hexdigest()
        if actual != expected:
            failures.append(f"{rel}: MANIFEST={expected[:16]}… git={actual[:16]}…")
    if failures:
        print(f"[FAIL] MANIFEST mismatch ({len(failures)}/{len(entries)})", file=sys.stderr)
        for msg in failures:
            print(f"  - {msg}", file=sys.stderr)
        return 1
    print(f"[OK] MANIFEST OK ({len(entries)}/{len(entries)}) · release={args.release} · source={'worktree' if args.worktree else args.git_rev}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
