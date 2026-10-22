# deploy-pages.ps1 — 把冻结版本发布到 GitHub Pages（v0.2.0）
# 用法：
#   $env:GITHUB_TOKEN = "ghp_xxx"
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-pages.ps1 -Version v0.2.0
# 或：
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-pages.ps1 -Version v0.2.0 -Token ghp_xxx
#
# 产物结构（gh-pages 分支）：
#   /                    最新版本（当前 -Version 的 dist/index.html）
#   /v0.1.0/index.html   历史版本归档
#   /v0.2.0/index.html   当前版本归档
#   /versions.json       { latest, versions:[{version,path,released_at}] }
#   /404.html, /.nojekyll
#
# 前置：本仓库已配置 origin（https://github.com/<owner>/<repo>.git）且仓库已开启 Pages（source=gh-pages:/）。
# 说明：只操作临时 index/work-tree，不改动当前工作分支。

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$Token = $env:GITHUB_TOKEN,
    [string]$Owner = 'charline88888-ux',
    [string]$Repo = 'opportunity-radar',
    [switch]$NoVerify
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if ($Version -notmatch '^v\d+\.\d+\.\d+$') { Write-Host "[FAIL] 版本号格式错误: $Version" -ForegroundColor Red; exit 1 }
$releaseDir = Join-Path $RepoRoot "releases\$Version\dist"
if (-not (Test-Path (Join-Path $releaseDir 'index.html'))) {
    Write-Host "[FAIL] 找不到冻结产物: releases\$Version\dist\index.html（先运行 release.ps1）" -ForegroundColor Red
    exit 1
}
if (-not $Token) {
    Write-Host '[FAIL] 缺少 GitHub Token：设置 $env:GITHUB_TOKEN 或传 -Token' -ForegroundColor Red
    Write-Host '       Token 需要 repo（推送）+ workflow（可选）权限；不要提交到仓库。'
    exit 1
}

# ---------- 1. 组装站点目录 ----------
$site = Join-Path $RepoRoot 'qa\tmp\pages-site'
if (Test-Path $site) { Remove-Item $site -Recurse -Force }
New-Item -ItemType Directory -Force -Path $site | Out-Null
Copy-Item (Join-Path $releaseDir 'index.html') (Join-Path $site 'index.html')
Copy-Item (Join-Path $releaseDir 'index.html') (Join-Path $site '404.html')
Set-Content -Path (Join-Path $site '.nojekyll') -Value '' -NoNewline -Encoding ASCII

$versions = @()
Get-ChildItem (Join-Path $RepoRoot 'releases') -Directory | Where-Object { $_.Name -match '^v\d+\.\d+\.\d+$' } | Sort-Object Name | ForEach-Object {
    $v = $_.Name
    $src = Join-Path $_.FullName 'dist\index.html'
    if (Test-Path $src) {
        $sub = Join-Path $site $v
        New-Item -ItemType Directory -Force -Path $sub | Out-Null
        Copy-Item $src (Join-Path $sub 'index.html')
        $versions += @{ version = $v; path = if ($v -eq $Version) { '/' } else { "/$v/" }; released_at = (Get-Item $src).LastWriteTime.ToString('yyyy-MM-dd') }
    }
}
$versionsJson = @{ latest = $Version; versions = $versions } | ConvertTo-Json -Depth 6
Set-Content -Path (Join-Path $site 'versions.json') -Value $versionsJson -Encoding UTF8
Write-Host "==> 站点已组装：$((Get-ChildItem $site -Recurse -File).Count) 个文件 / $([math]::Round((Get-ChildItem $site -Recurse -File | Measure-Object Length -Sum).Sum/1MB,2)) MB（latest=$Version）"

# ---------- 2. 用临时 index 生成 gh-pages 提交 ----------
$idx = Join-Path $RepoRoot 'qa\tmp\pages.index'
if (Test-Path $idx) { Remove-Item $idx -Force }
$env:GIT_INDEX_FILE = $idx
Push-Location $site
try {
    git --git-dir="$RepoRoot\.git" --work-tree="$site" add -A 2>&1 | Out-Null
    $tree = (git --git-dir="$RepoRoot\.git" write-tree).Trim()
} finally { Pop-Location }
Remove-Item Env:GIT_INDEX_FILE

$env:GIT_AUTHOR_NAME = 'Opportunity Radar Bot'
$env:GIT_AUTHOR_EMAIL = 'bot@local'
$env:GIT_COMMITTER_NAME = 'Opportunity Radar Bot'
$env:GIT_COMMITTER_EMAIL = 'bot@local'
$commit = (git commit-tree $tree -m "deploy: GitHub Pages $Version").Trim()

# ---------- 3. 推送 gh-pages ----------
$b64 = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("x-access-token:$Token"))
$env:GIT_CONFIG_COUNT = '1'
$env:GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader'
$env:GIT_CONFIG_VALUE_0 = "AUTHORIZATION: basic $b64"
$env:GIT_TERMINAL_PROMPT = '0'
git -c credential.helper= push "https://github.com/$Owner/$Repo.git" "${commit}:refs/heads/gh-pages" --force 2>&1 | Select-Object -Last 4
if ($LASTEXITCODE -ne 0) { Write-Host '[FAIL] 推送 gh-pages 失败' -ForegroundColor Red; exit 1 }
$url = "https://$Owner.github.io/$Repo/"
Write-Host "[OK] 已推送 gh-pages：commit=$commit tree=$tree"
Write-Host "     线上地址: $url"

# ---------- 4. 等待并验证 ----------
if (-not $NoVerify) {
    Write-Host '==> 等待 GitHub Pages 构建（最多 ~90s）'
    $ok = $false
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Seconds 8
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
            if ($r.StatusCode -eq 200 -and $r.Content -match '机会雷达|Opportunity Radar') { $ok = $true; break }
        } catch { }
        Write-Host "    ...第 $($i + 1) 次检查未就绪"
    }
    if ($ok) { Write-Host "[OK] 线上验证通过: $url" } else { Write-Host "[WARN] 线上尚未就绪，请稍后手动打开: $url" -ForegroundColor Yellow }
}
exit 0
