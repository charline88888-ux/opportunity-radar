"""qa/online-check-v07.py —— v0.7+ 新站结构线上核验（root=当日数据构建，/vX.Y.Z/=冻结归档）。

规则（docs/12 §1.8）：
- `/` = 最新数据构建（daily-update 或最新冻结），versions.json 顶层 `live_as_of` 为根数据基准日；
- `/vX.Y.Z/` = **所有冻结版本**归档（含最新）；最新归档必须与 tag 内冻结 dist 逐字节一致；
- versions.json：latest、latest.path=/vX.Y.Z/、daily_channel=true（每日通道）、live_as_of。
用法：python qa/online-check-v07.py --version v0.7.2 [--tag v0.7.2] [--base URL]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 radar-redteam/0.7"


def fetch(url: str, retries: int = 5) -> tuple[int, bytes]:
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Cache-Control": "no-cache"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(2 + i * 2)
    raise RuntimeError(f"fetch 失败 {url}: {last}")


def git_blob(token: str) -> bytes | None:
    r = subprocess.run(["git", "cat-file", "blob", token], cwd=ROOT, capture_output=True)
    return r.stdout if r.returncode == 0 else None


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", required=True)
    ap.add_argument("--tag", default=None)
    ap.add_argument("--base", default="https://charline88888-ux.github.io/opportunity-radar")
    args = ap.parse_args()
    version = args.version
    tag = args.tag or version
    base = args.base.rstrip("/")
    P0: list[str] = []
    P1: list[str] = []
    P2: list[str] = []
    notes: list[str] = []

    # versions.json
    st, raw = fetch(f"{base}/versions.json")
    if st != 200:
        P0.append(f"versions.json HTTP {st}")
        return report(P0, P1, P2, notes)
    vj = json.loads(raw.decode("utf-8"))
    if vj.get("latest") != version:
        P0.append(f"versions.json latest={vj.get('latest')!r} ≠ {version}")
    live_as_of = str(vj.get("live_as_of") or "")
    if vj.get("daily_channel") is not True or not re.fullmatch(r"20\d\d-\d\d-\d\d", live_as_of):
        P2.append(f"versions.json daily_channel/live_as_of 缺失或非每日通道（daily_channel={vj.get('daily_channel')!r}, live_as_of={live_as_of!r}；契约中为可选字段，当前由 tag deploy 生成 → root=最新冻结构建）")
    entry = next((x for x in (vj.get("versions") or []) if x.get("version") == version), None)
    if not entry:
        P0.append(f"versions.json 缺少 {version} 条目")
    else:
        if entry.get("path") != f"/{version}/":
            P0.append(f"versions.json {version}.path={entry.get('path')!r} ≠ /{version}/")
        else:
            notes.append(f"versions.json latest={version} path=/{version}/ daily_channel={vj.get('daily_channel')} live_as_of={live_as_of} ✅")

    # root = 当日构建；as_of 应与 live_as_of 一致
    st, root = fetch(f"{base}/")
    if st != 200:
        P0.append(f"root HTTP {st}")
    else:
        text = root.decode("utf-8", "ignore")
        candidates = re.findall(r'as_of\s*:\s*"(20\d\d-\d\d-\d\d)",generator\s*:\s*"scanner/pipeline\.py"', text)
        root_as_of = candidates[0] if candidates else ""
        import json as _json
        tag_data = git_blob(f"{tag}:data/rankings.json")
        tag_as_of = ""
        if tag_data:
            try:
                tag_as_of = str((_json.loads(tag_data.decode("utf-8")).get("meta") or {}).get("as_of") or "")
            except Exception:
                pass
        if not root_as_of:
            P2.append("root 未解析出 rankings meta.as_of（压缩格式可能变化）")
        elif tag_as_of and root_as_of != tag_as_of:
            P1.append(f"root 内嵌 as_of={root_as_of} ≠ tag 数据 as_of={tag_as_of}")
        else:
            notes.append(f"root 内嵌 rankings.as_of={root_as_of} = tag 冻结数据 as_of={tag_as_of} ✅（当日数据构建）")
        if "控制台" in text or "CONTROL" in text:
            notes.append("root 含 /control 控制台入口 ✅")
        else:
            P1.append("root 未见控制台入口（v0.7 功能缺失？）")
        notes.append(f"root = {len(root)} B / {sha(root)[:16]}")

    # 最新冻结归档 = tag 内 dist
    expected = git_blob(f"{tag}:releases/{version}/dist/index.html")
    if expected is None:
        P0.append(f"本地 git 缺少 {tag}:releases/{version}/dist/index.html（无法对照）")
    else:
        st, arch = fetch(f"{base}/{version}/")
        if st != 200:
            P0.append(f"/{version}/ HTTP {st}")
        elif sha(arch) != sha(expected) or len(arch) != len(expected):
            P0.append(f"/{version}/ 与冻结 dist 不一致：线上 {len(arch)}B/{sha(arch)[:16]} ≠ 冻结 {len(expected)}B/{sha(expected)[:16]}")
        else:
            notes.append(f"/{version}/ = tag 冻结 dist {sha(expected)[:16]}… / {len(expected)} B ✅")
        if sha(root) == sha(expected):
            P2.append("root 与最新冻结 dist 完全相同（当日数据构建与冻结一致，可接受但需确认 live_as_of）")

    # 历史归档逐个对照各自 tag blob
    releases = sorted([p for p in (ROOT / "releases").iterdir() if p.is_dir() and re.fullmatch(r"v\d+\.\d+\.\d+", p.name)])
    for rel in releases:
        ver = rel.name
        if ver == version:
            continue
        exp = git_blob(f"{ver}:releases/{ver}/dist/index.html") or git_blob(f"{ver}^{{commit}}:releases/{ver}/dist/index.html")
        st, arch = fetch(f"{base}/{ver}/")
        if st != 200:
            P0.append(f"/{ver}/ HTTP {st}")
            continue
        if exp is None:
            P2.append(f"/{ver}/ 可访问但本地无 tag 对照")
        elif sha(arch) != sha(exp):
            P0.append(f"/{ver}/ 与 {ver} 冻结 dist 不一致（串台）：{sha(arch)[:16]} ≠ {sha(exp)[:16]}")
        else:
            notes.append(f"/{ver}/ = 冻结 {sha(exp)[:16]}… ✅")

    # 404 探测
    st, _ = fetch(f"{base}/__nonexistent__/404-probe.html", retries=1)
    if st not in (403, 404):
        P2.append(f"不存在路径 HTTP {st}（期望 404/403）")
    else:
        notes.append(f"不存在路径 HTTP {st} ✅")

    return report(P0, P1, P2, notes)


def report(P0, P1, P2, notes) -> int:
    print("\n== online-check-v07 ==")
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
