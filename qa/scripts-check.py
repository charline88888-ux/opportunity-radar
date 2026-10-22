"""qa/scripts-check.py —— v0.6.1 每日自动化/CI/站点组装红队验收（只写 qa/tmp，不动仓库产物）。

覆盖：
1) scripts/*.ps1 语法解析（PowerShell Parser，不执行计划任务）、daily-run 关键步骤静态断言；
2) scripts/build_site.py：py_compile + 实际组装到 qa/tmp/site-test，校验根 index.html 与 releases/v0.6.0/dist
   逐字节一致、各版本归档存在且与对应 releases dist 一致、versions.json latest/paths、404/.nojekyll、双跑确定性；
   非法版本 exit 2；
3) .github/workflows/{ci,deploy-pages}.yml：YAML 可解析、关键步骤存在（validate/unittest/build/build_site/
   frozen release/gh-pages）。
用法：python qa/scripts-check.py
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP = ROOT / "qa" / "tmp"
P0: list[str] = []
P1: list[str] = []
P2: list[str] = []
notes: list[str] = []


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)


def main() -> int:
    TMP.mkdir(parents=True, exist_ok=True)
    # ---------- 1) PowerShell 语法解析 ----------
    ps_scripts = sorted((ROOT / "scripts").glob("*.ps1"))
    if not ps_scripts:
        P1.append("scripts/ 下没有 .ps1")
    for p in ps_scripts:
        code = (
            "$t=$null;$e=$null;"
            f"[System.Management.Automation.Language.Parser]::ParseFile('{p}', [ref]$t, [ref]$e) | Out-Null;"
            "if ($e -and $e.Count -gt 0) { $e | ForEach-Object { Write-Output $_.Message }; exit 1 } else { exit 0 }"
        )
        out = run(["pwsh", "-NoProfile", "-Command", code])
        if out.returncode != 0:
            P1.append(f"{p.name} 语法错误：{(out.stdout + out.stderr)[:200]}")
    if ps_scripts and all(f"{p.name}" not in " ".join(P1) for p in ps_scripts):
        notes.append(f"scripts/*.ps1 语法解析：{len(ps_scripts)} 个全部通过（未执行计划任务）✅")

    daily = (ROOT / "scripts" / "daily-run.ps1").read_text(encoding="utf-8", errors="ignore")
    daily_checks = {
        "pipeline --all/--as-of": bool(re.search(r"pipeline\.py'?\s*,?\s*'--all'|--all'\s*,?\s*'--as-of'|'--as-of'", daily)),
        "validate": "validate.py" in daily,
        "pnpm build": bool(re.search(r"pnpm\s+(run\s+)?build|pnpm\.cmd", daily)),
        "current/index.html": "current" in daily and "index.html" in daily,
        "ALERT.txt": "ALERT.txt" in daily,
        "as-of 校验": bool(re.search(r"\\d\{4\}-\\d\{2\}-\\d\{2\}", daily)),
        "fetch 可选": "--fetch" in daily or "-Fetch" in daily,
    }
    missing = [k for k, v in daily_checks.items() if not v]
    if missing:
        P1.append(f"daily-run.ps1 缺关键步骤：{missing}")
    else:
        notes.append("daily-run.ps1 关键步骤齐全（pipeline --all/--as-of、validate、pnpm build、current 复制、ALERT、fetch 可选）✅")
    install = (ROOT / "scripts" / "install-daily-task.ps1").read_text(encoding="utf-8", errors="ignore")
    if "daily-run.ps1" not in install:
        P1.append("install-daily-task.ps1 未调度 daily-run.ps1")
    else:
        notes.append("install-daily-task.ps1 已指向 daily-run.ps1 ✅")

    # ---------- 2) build_site.py 实测（输出仅 qa/tmp） ----------
    pyc = run([sys.executable, "-m", "py_compile", "scripts/build_site.py"])
    if pyc.returncode != 0:
        P1.append(f"build_site.py 编译失败：{pyc.stderr[-200:]}")
    site = TMP / "site-test"
    shutil.rmtree(site, ignore_errors=True)
    out = run([sys.executable, "scripts/build_site.py", "--releases", "releases", "--out", str(site.relative_to(ROOT)).replace("\\", "/"), "--version", "v0.6.0"])
    if out.returncode != 0:
        P0.append(f"build_site.py 组装失败 exit={out.returncode}: {(out.stdout + out.stderr)[-300:]}")
    else:
        root_idx = site / "index.html"
        frozen = ROOT / "releases" / "v0.6.0" / "dist" / "index.html"
        if not root_idx.exists() or sha(root_idx) != sha(frozen):
            P0.append("build_site 根 index.html 与 releases/v0.6.0/dist 不一致")
        else:
            notes.append("build_site 根 index.html = releases/v0.6.0/dist（逐字节）✅")
        versions = {}
        vj = site / "versions.json"
        if vj.exists():
            versions = json.loads(vj.read_text(encoding="utf-8"))
            if versions.get("latest") != "v0.6.0":
                P1.append(f"versions.json latest={versions.get('latest')!r} ≠ v0.6.0")
            else:
                notes.append(f"versions.json latest=v0.6.0，版本 {len(versions.get('versions') or [])} 个 ✅")
        else:
            P1.append("build_site 缺 versions.json")
        for rel in sorted((ROOT / "releases").iterdir()):
            if not rel.is_dir():
                continue
            if rel.name == "v0.6.0":
                continue
            arch = site / rel.name / "index.html"
            src = rel / "dist" / "index.html"
            if not arch.exists():
                P1.append(f"build_site 缺归档 {rel.name}/index.html")
            elif src.exists() and sha(arch) != sha(src):
                P1.append(f"build_site 归档 {rel.name} 与 releases dist 不一致")
        for must in ("404.html", ".nojekyll"):
            if not (site / must).exists():
                P1.append(f"build_site 缺 {must}")
        if not P1:
            notes.append(f"build_site 归档校验：{len([d for d in (ROOT / 'releases').iterdir() if d.is_dir()])} 个版本逐字节一致、404/.nojekyll 齐全 ✅")
        # 双跑确定性
        site2 = TMP / "site-test-2"
        shutil.rmtree(site2, ignore_errors=True)
        out2 = run([sys.executable, "scripts/build_site.py", "--releases", "releases", "--out", str(site2.relative_to(ROOT)).replace("\\", "/"), "--version", "v0.6.0"])
        h1 = {str(p.relative_to(site)): sha(p) for p in sorted(site.rglob("*")) if p.is_file()}
        h2 = {str(p.relative_to(site2)): sha(p) for p in sorted(site2.rglob("*")) if p.is_file()}
        if out2.returncode != 0 or h1 != h2:
            P1.append("build_site.py 双跑输出不一致")
        else:
            notes.append("build_site.py 双跑字节一致（确定性）✅")
    bad = run([sys.executable, "scripts/build_site.py", "--releases", "releases", "--out", str((TMP / "site-bad").relative_to(ROOT)).replace("\\", "/"), "--version", "0.6.0"])
    if bad.returncode != 2:
        P2.append(f"build_site 非法版本 0.6.0 exit={bad.returncode}（期望 2）")

    # ---------- 3) CI YAML ----------
    try:
        import yaml  # type: ignore
        have_yaml = True
    except Exception:
        have_yaml = False
    workflows = sorted((ROOT / ".github" / "workflows").glob("*.yml"))
    if not workflows:
        P1.append(".github/workflows 下无 yml")
    for wf in workflows:
        text = wf.read_text(encoding="utf-8", errors="ignore")
        data = None
        if have_yaml:
            try:
                data = yaml.safe_load(text)
            except Exception as exc:  # noqa: BLE001
                P1.append(f"{wf.name} YAML 解析失败：{exc}")
                continue
        if wf.name == "ci.yml":
            need = ["validate.py", "unittest", "pnpm", "build_site.py"]
            miss = [x for x in need if x not in text]
            if miss:
                P1.append(f"ci.yml 缺步骤 {miss}")
            else:
                notes.append("ci.yml：validate + unittest + pnpm build + build_site 步骤齐全 ✅")
        if wf.name == "deploy-pages.yml":
            need = ["v[0-9]", "releases/", "build_site.py", "gh-pages"]
            miss = [x for x in need if x not in text]
            if miss:
                P1.append(f"deploy-pages.yml 缺内容 {miss}")
            else:
                notes.append("deploy-pages.yml：tag 触发 + 冻结 release 校验 + build_site + gh-pages 发布 ✅")
    notes.append(("YAML 解析器：PyYAML 可用" if have_yaml else "PyYAML 不可用，YAML 仅做文本断言"))

    print("\n== scripts-check ==")
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
