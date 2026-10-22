#!/usr/bin/env python3
"""build_site.py — 组装 GitHub Pages 站点目录（不联网、可本地验证）

输入：
  --dist    最新版本的已构建 dist 目录（含 index.html）；或 --version 指定已冻结版本
  --releases  releases 目录（默认 ./releases）
  --out      输出目录（默认 ./_site）
  --version  可选：指定“最新”版本（默认读 VERSION 文件）

输出（out/）：
  index.html / 404.html /.nojekyll
  <version>/index.html        每个冻结版本归档
  versions.json               { latest, versions:[{version,path,released_at}] }

规则：
  - 只消费已冻结的 releases/*/dist/index.html（不可变版本）；--dist 仅用于覆盖“最新”根目录。
  - versions.json 确定性：按语义版本升序；released_at 优先读 MANIFEST.released_at 的日期，否则用文件 mtime。
  - 不修改 releases/，不联网。
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path


SEMVER = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")


def version_key(name: str) -> tuple[int, int, int]:
    m = SEMVER.match(name)
    if not m:
        return (0, 0, 0)
    return tuple(int(x) for x in m.groups())  # type: ignore[return-value]


def released_at(release_dir: Path, idx: Path) -> str:
    manifest = release_dir / "MANIFEST.json"
    if manifest.exists():
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
            stamp = str(data.get("released_at", ""))
            if len(stamp) >= 10:
                return stamp[:10]
        except Exception:
            pass
    return idx.stat().st_mtime_ns and __import__("datetime").datetime.fromtimestamp(
        idx.stat().st_mtime
    ).strftime("%Y-%m-%d")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="组装 GitHub Pages 站点目录")
    parser.add_argument("--dist", default="", help="最新构建 dist 目录（含 index.html）")
    parser.add_argument("--releases", default="releases")
    parser.add_argument("--out", default="_site")
    parser.add_argument("--version", default="", help="最新版本号（默认读 VERSION）")
    args = parser.parse_args(argv)

    root = Path(__file__).resolve().parent.parent
    releases_dir = (root / args.releases).resolve() if not Path(args.releases).is_absolute() else Path(args.releases)
    out_dir = (root / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)

    latest = args.version.strip()
    if not latest:
        version_file = root / "VERSION"
        if version_file.exists():
            latest = "v" + version_file.read_text(encoding="utf-8").strip()
    if not latest:
        print("[FAIL] 无法确定最新版本（VERSION 或 --version）", file=sys.stderr)
        return 2
    if not SEMVER.match(latest):
        print(f"[FAIL] 版本号非法: {latest}", file=sys.stderr)
        return 2

    # 收集已冻结版本
    versions: list[dict] = []
    archives: list[tuple[str, Path, Path]] = []
    for child in sorted(releases_dir.iterdir(), key=lambda p: p.name):
        if not child.is_dir() or not SEMVER.match(child.name):
            continue
        idx = child / "dist" / "index.html"
        if not idx.exists():
            continue
        archives.append((child.name, idx, child))
        versions.append(
            {
                "version": child.name,
                "path": "/" if child.name == latest else f"/{child.name}/",
                "released_at": released_at(child, idx),
            }
        )
    if not versions:
        print(f"[FAIL] {releases_dir} 下没有可用版本", file=sys.stderr)
        return 2
    if latest not in {v["version"] for v in versions}:
        print(f"[FAIL] 最新版本 {latest} 不在 releases 中，请先运行 release.ps1", file=sys.stderr)
        return 2

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 根目录 = 最新版本：优先 --dist（当前构建），否则用已冻结 dist
    root_index = out_dir / "index.html"
    dist_index = Path(args.dist) / "index.html" if args.dist else None
    if dist_index and dist_index.exists():
        shutil.copy2(dist_index, root_index)
        source = f"--dist ({dist_index})"
    else:
        latest_idx = releases_dir / latest / "dist" / "index.html"
        shutil.copy2(latest_idx, root_index)
        source = f"releases/{latest}/dist/index.html"
    shutil.copy2(root_index, out_dir / "404.html")
    (out_dir / ".nojekyll").write_text("", encoding="ascii")

    for name, idx, _child in archives:
        if name == latest:
            continue
        target = out_dir / name
        target.mkdir(parents=True, exist_ok=True)
        shutil.copy2(idx, target / "index.html")

    versions.sort(key=lambda v: version_key(v["version"]))
    # 最新版本放最后（与既有约定一致：path=/ 的条目可为任意位置，这里保持升序）
    payload = {"latest": latest, "versions": versions}
    (out_dir / "versions.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    size_mb = sum(f.stat().st_size for f in out_dir.rglob("*") if f.is_file()) / 1024 / 1024
    print(f"[OK] 站点已组装: {out_dir}")
    print(f"     latest={latest} · 版本数={len(versions)} · 文件数={sum(1 for _ in out_dir.rglob('*') if _.is_file())} · {size_mb:.2f} MB")
    print(f"     root index 来源: {source}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
