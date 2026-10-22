# release.ps1 — 冻结发布一个新版本（旧版本永不修改）
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Version v0.1.0
#   powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Version v0.1.1 -SkipData -NoGit
# 可选：-SkipBuild 跳过前端构建；-SkipData 跳过数据流水线；-NoGit 不提交打 tag
# 说明：版本说明文件从 release-notes/<Version>/{DEV.md,OPS.md,CHANGELOG.md} 复制；
#       若不存在则生成占位模板（发布前应补齐，脚本会告警）。

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [switch]$SkipBuild,
    [switch]$SkipData,
    [switch]$NoGit
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Fail([string]$msg) {
    Write-Host "[FAIL] $msg" -ForegroundColor Red
    exit 1
}
function Step([string]$msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok([string]$msg) { Write-Host "[OK] $msg" -ForegroundColor Green }

# ---------- 1. 版本号与目录检查 ----------
if ($Version -notmatch '^v\d+\.\d+\.\d+$') { Fail "版本号必须形如 v0.1.0，当前: $Version" }
$ReleaseDir = Join-Path $RepoRoot "releases\$Version"
if (Test-Path $ReleaseDir) { Fail "版本目录已存在（禁止覆盖发布）: releases\$Version" }

$appVersion = $Version.TrimStart('v')
$versionFile = Join-Path $RepoRoot 'VERSION'
if (Test-Path $versionFile) { Set-Content -Path $versionFile -Value $appVersion -Encoding UTF8 }

# ---------- 2. 数据流水线 + 校验 ----------
if (-not $SkipData) {
    Step '运行数据流水线 pipeline.py --all'
    $out = & python scanner/pipeline.py --all 2>&1
    $code = $LASTEXITCODE
    $out | Select-Object -Last 12 | ForEach-Object { Write-Host "    $_" }
    if ($code -ne 0) { Fail "pipeline.py 退出码 $code" }

    Step '运行数据校验 validate.py'
    $vout = & python scanner/validate.py 2>&1
    $vcode = $LASTEXITCODE
    $vout | Select-Object -Last 20 | ForEach-Object { Write-Host "    $_" }
    if ($vcode -ne 0) { Fail "validate.py 退出码 $vcode" }
    Ok '数据校验通过'
} else { Write-Host '    （跳过数据流水线）' -ForegroundColor Yellow }

# ---------- 3. 前端构建 ----------
$DistSrc = Join-Path $RepoRoot 'app\dist'
if (-not $SkipBuild) {
    Step '构建前端（pnpm install + build）'
    Push-Location (Join-Path $RepoRoot 'app')
    try {
        if (Test-Path 'pnpm-lock.yaml') { pnpm install --frozen-lockfile | Out-Host } else { pnpm install | Out-Host }
        if ($LASTEXITCODE -ne 0) { throw 'pnpm install 失败' }
        pnpm build | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'pnpm build 失败' }
    } finally { Pop-Location }
} else { Write-Host '    （跳过前端构建）' -ForegroundColor Yellow }
if (-not (Test-Path (Join-Path $DistSrc 'index.html'))) { Fail "找不到构建产物: app\dist\index.html" }
Ok '前端构建产物存在'

# ---------- 4. 创建冻结目录 ----------
Step "创建 releases\$Version"
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
$distDest = Join-Path $ReleaseDir 'dist'
New-Item -ItemType Directory -Force -Path $distDest | Out-Null
Copy-Item -Path (Join-Path $DistSrc '*') -Destination $distDest -Recurse -Force
if (-not (Test-Path (Join-Path $distDest 'index.html'))) { Fail '复制 dist 失败：找不到 dist/index.html' }
Ok '已复制 dist/'

$docsSnapshot = Join-Path $ReleaseDir 'docs-snapshot'
New-Item -ItemType Directory -Force -Path $docsSnapshot | Out-Null
Get-ChildItem -Path (Join-Path $RepoRoot 'docs') -Filter '*.md' | Copy-Item -Destination $docsSnapshot -Force
Ok "已快照 docs（$((Get-ChildItem $docsSnapshot).Count) 份）"

# ---------- 5. 版本说明（DEV/OPS/CHANGELOG） ----------
$notesSrc = Join-Path $RepoRoot "release-notes\$Version"
$templates = @{
    'DEV.md'       = @"
# v$Version 开发文档
## 1. 本版目标与范围
（待补写）
## 2. 相对上一版的变更
## 3. 架构与数据流变化
## 4. 文件清单
## 5. 本地运行与构建命令
## 6. 测试与验收结果
## 7. 已知问题与技术债
## 8. 升级/迁移说明
## 9. 下一版计划
"@
    'OPS.md'       = @"
# v$Version 运营文档
## 1. 本版运营目标与指标
## 2. 数据源状态
## 3. 日常 SOP
## 4. 本版新增/变更机会主题
## 5. KPI 看板
## 6. 事故/异常记录
## 7. 下一版运营动作
"@
    'CHANGELOG.md' = @"
# v$Version 变更明细
## 新增
## 修改
## 修复
## 移除
## 数据版本变化
"@
}
foreach ($name in $templates.Keys) {
    $target = Join-Path $ReleaseDir $name
    $source = Join-Path $notesSrc $name
    if (Test-Path $source) { Copy-Item $source $target -Force; Ok "已复制 $name" }
    else {
        Set-Content -Path $target -Value $templates[$name] -Encoding UTF8
        Write-Host "[WARN] 缺少 release-notes\$Version\$name，已生成模板，请在发布前补齐" -ForegroundColor Yellow
    }
}

# 发布目录 README
$readme = @"
# 机会雷达 $Version（冻结版本 · 只读）

- 打开应用（无需服务器/联网）：双击 `dist/index.html`
- 本版开发文档：`DEV.md`
- 本版运营文档：`OPS.md`
- 变更明细：`CHANGELOG.md`
- 完整文档快照：`docs-snapshot/`
- 版本清单（文件哈希）：`MANIFEST.json`
- 数据版本与应用版本记录在 `MANIFEST.json`

> 本目录发布后不再修改。升级请发布新版本目录；回滚请直接打开上一版本目录。
"@
Set-Content -Path (Join-Path $ReleaseDir 'README.md') -Value $readme -Encoding UTF8
Copy-Item -Path (Join-Path $ReleaseDir 'README.md') -Destination (Join-Path $ReleaseDir 'dist\VERSION-README.md') -Force

# ---------- 6. MANIFEST ----------
Step '生成 MANIFEST.json'
function Read-Json([string]$path) {
    if (-not (Test-Path $path)) { return $null }
    return (Get-Content -Path $path -Raw -Encoding UTF8 | ConvertFrom-Json)
}
$opp = Read-Json (Join-Path $RepoRoot 'data\opportunities.json')
$tax = Read-Json (Join-Path $RepoRoot 'data\taxonomy.json')
$sources = Read-Json (Join-Path $RepoRoot 'data\sources.json')
$playbooks = Read-Json (Join-Path $RepoRoot 'data\playbooks.json')
$calendar = Read-Json (Join-Path $RepoRoot 'data\calendar.json')

$gitCommit = ''
$gitTag = ''
try { $gitCommit = (git rev-parse --short HEAD 2>$null) } catch { }
try { $gitTag = (git describe --tags --abbrev=0 2>$null) } catch { }

$files = @()
Get-ChildItem -Path $ReleaseDir -Recurse -File | Where-Object { $_.Name -ne 'MANIFEST.json' } | ForEach-Object {
    $rel = $_.FullName.Substring($ReleaseDir.Length + 1).Replace('\', '/')
    $hash = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash.ToLower()
    $files += [ordered]@{ path = $rel; bytes = $_.Length; sha256 = $hash }
}

$manifest = [ordered]@{
    app_version   = $appVersion
    data_version  = if ($tax) { $tax.meta.data_version } else { 'unknown' }
    released_at   = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
    git_commit    = ''
    git_tag       = $Version
    build         = [ordered]@{ node = (& node -v); pnpm = (& pnpm -v) }
    validation    = [ordered]@{ pipeline = $(if ($SkipData) { 'skipped' } else { 'pass' }); validate = $(if ($SkipData) { 'skipped' } else { 'pass' }); build = $(if ($SkipBuild) { 'skipped' } else { 'pass' }) }
    counts        = [ordered]@{
        opportunities = if ($opp) { $opp.opportunities.Count } else { 0 }
        sources       = if ($sources) { [int](($sources.categories | ForEach-Object { $_.sources.Count } | Measure-Object -Sum).Sum) } else { 0 }
        playbooks     = if ($playbooks) { $playbooks.playbooks.Count } else { 0 }
        calendar      = if ($calendar) { $calendar.events.Count } else { 0 }
        docs          = (Get-ChildItem $docsSnapshot).Count
    }
    files         = $files
    open_path     = "releases/$Version/dist/index.html"
    rollback      = '打开上一版本 releases/vPREV/dist/index.html'
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $ReleaseDir 'MANIFEST.json') -Encoding UTF8
Ok "MANIFEST.json 已生成（$($files.Count) 个文件）"

# ---------- 7. Git 提交与 tag ----------
if (-not $NoGit) {
    Step 'Git 提交并打 tag'
    git add -A
    git commit -m "release: $Version" | Out-Host
    if ($LASTEXITCODE -ne 0) { Write-Host '[WARN] git commit 失败（可能无变更），继续打 tag' -ForegroundColor Yellow }

    # 先提交内容、再回填 MANIFEST 的 content commit，最后单独提交 MANIFEST 并在该提交上打 tag
    $contentCommit = (git rev-parse --short HEAD 2>$null)
    $manifest.git_commit = $contentCommit
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $ReleaseDir 'MANIFEST.json') -Encoding UTF8
    git add (Join-Path $ReleaseDir 'MANIFEST.json')
    git commit -m "docs: record $Version manifest (content commit $contentCommit)" | Out-Host

    git tag -a $Version -m "Opportunity Radar $Version (content commit $contentCommit)" | Out-Host
    if ($LASTEXITCODE -ne 0) { Write-Host '[WARN] git tag 失败（可能已存在）' -ForegroundColor Yellow }
    Ok "Git 完成：tag $Version 指向 MANIFEST 提交；内容提交 $contentCommit（如需推送：git push --tags）"
} else { Write-Host '    （跳过 git）' -ForegroundColor Yellow }

# ---------- 8. 摘要 ----------
$sizeMB = [math]::Round(((Get-ChildItem $ReleaseDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host ''
Write-Host '================ 发布完成 ================' -ForegroundColor Green
Write-Host "版本:            $Version"
Write-Host "应用/数据版本:   $appVersion / $($manifest.data_version)"
Write-Host "发布目录:        releases\$Version"
Write-Host "大小:            $sizeMB MB"
Write-Host "打开方式:        releases\$Version\dist\index.html"
Write-Host "文件清单:        releases\$Version\MANIFEST.json"
Write-Host '回滚方式:        直接打开上一版本目录的 dist/index.html'
Write-Host '==========================================' -ForegroundColor Green
