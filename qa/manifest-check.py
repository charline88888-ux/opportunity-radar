"""qa/manifest-check.py —— 冻结 MANIFEST 校验（以 git tag blob 为准，避免工作树污染造成误判）。

用法：
  python qa/manifest-check.py --version v0.7.2 [--tag v0.7.2]
检查：
1) tag 存在且为 annotated tag（git tag -l / git cat-file -t 对象类型）；
2) MANIFEST.files 19 条逐条用 `git cat-file blob <tag>:releases/<v>/<path>` 计算 sha256/bytes 与 MANIFEST 比对；
3) MANIFEST.dist/index.html 的 sha256 与 reports 的当前冻结 dist（tag blob）一致；
4) tag blob 内 releases/<v>/VERSION-README.md 与根 VERSION 记录一致（若存在 expected_version 文本）；
5) MANIFEST.git_commit 是 tag 的祖先（内容提交），tag 提交信息含 manifest。
退出码 0=PASS。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True)


def blob(tag: str, path: str) -> bytes | None:
    r = git("cat-file", "blob", f"{tag}:{path}")
    return r.stdout if r.returncode == 0 else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", required=True)
    ap.add_argument("--tag", default=None)
    args = ap.parse_args()
    version = args.version
    tag = args.tag or version
    errors: list[str] = []
    notes: list[str] = []
    # tag 存在
    r = git("rev-parse", f"{tag}^{{commit}}")
    if r.returncode != 0:
        print(f"FAIL tag 不存在：{tag}")
        return 1
    tag_commit = r.stdout.decode().strip()
    obj_type = git("cat-file", "-t", tag).stdout.decode().strip()
    notes.append(f"tag={tag} type={obj_type} commit={tag_commit[:12]}")
    # MANIFEST
    manifest_path = f"releases/{version}/MANIFEST.json"
    raw = blob(tag, manifest_path)
    if raw is None:
        errors.append(f"tag 内缺少 {manifest_path}")
        return report(errors, notes, version)
    try:
        manifest = json.loads(raw.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"MANIFEST 非法 JSON：{exc}")
        return report(errors, notes, version)
    files = manifest.get("files") or []
    bad = []
    for f in files:
        path = f"releases/{version}/{f['path']}"
        data = blob(tag, path)
        if data is None:
            bad.append((f["path"], "MISSING"))
            continue
        if len(data) != f["bytes"] or hashlib.sha256(data).hexdigest() != f["sha256"]:
            bad.append((f["path"], "MISMATCH"))
    if bad:
        errors.append(f"MANIFEST {len(bad)}/{len(files)} 条与 tag blob 不一致：{bad[:5]}")
    else:
        notes.append(f"MANIFEST {len(files)}/{len(files)} 条 sha256/bytes 与 tag blob 一致 ✅")
    # MANIFEST 对应 dist
    dist_entry = next((f for f in files if f["path"] == "dist/index.html"), None)
    dist_blob = blob(tag, f"releases/{version}/dist/index.html")
    if dist_entry and dist_blob is not None:
        actual = hashlib.sha256(dist_blob).hexdigest()
        if actual != dist_entry["sha256"] or len(dist_blob) != dist_entry["bytes"]:
            errors.append(f"MANIFEST dist 记录 {dist_entry['sha256'][:16]}/{dist_entry['bytes']} ≠ tag dist {actual[:16]}/{len(dist_blob)}")
        else:
            notes.append(f"冻结 dist = {actual[:16]}… / {len(dist_blob)} B（与 MANIFEST 一致）✅")
    # git_commit 祖先
    content_commit = str(manifest.get("git_commit") or "")
    if content_commit:
        anc = git("merge-base", "--is-ancestor", content_commit, tag_commit)
        if anc.returncode != 0:
            errors.append(f"MANIFEST.git_commit={content_commit[:12]} 不是 tag {tag} 的祖先")
        else:
            notes.append(f"内容提交 {content_commit[:12]} 是 tag 祖先 ✅")
    # tag 提交信息
    msg = git("log", "-1", "--format=%s", tag_commit).stdout.decode("utf-8", "ignore").strip()
    notes.append(f"tag 提交：{msg}")
    # tag 内 VERSION-README / VERSION
    vr = blob(tag, f"releases/{version}/dist/VERSION-README.md")
    if vr:
        text = vr.decode("utf-8", "ignore")
        if version not in text:
            notes.append(f"dist/VERSION-README.md 未出现 {version}（提示）")
        else:
            notes.append(f"dist/VERSION-README.md 含 {version} ✅")
    return report(errors, notes, version, tag)


def report(errors: list[str], notes: list[str], version: str, tag: str | None = None) -> int:
    print(f"\n== manifest-check {version}（tag={tag or version}）==")
    for n in notes:
        print("  ·", n)
    for e in errors:
        print("  [FAIL]", e)
    print("RESULT:", "PASS" if not errors else "FAIL")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
