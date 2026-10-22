# publish.ps1 — 一条命令完成「冻结版本 → 推送 main/tag → GitHub Actions 自动发布 Pages」
# 用法：
#   $env:GITHUB_TOKEN = "ghp_xxx"
#   powershell -ExecutionPolicy Bypass -File scripts/publish.ps1 -Version v0.6.1
#   powershell -ExecutionPolicy Bypass -File scripts/publish.ps1 -Version v0.6.1 -NoVerify
# 说明：
#   - 调用 scripts/release.ps1 完成本地冻结（构建/校验/MANIFEST/git commit+tag）；
#   - 然后 git push main + tag；tag 推送会触发 .github/workflows/deploy-pages.yml 自动部署 Pages；
#   - 推送完成后轮询线上 versions.json 校验 latest；
#   - GITHUB_TOKEN 只从环境变量读，绝不写入仓库/日志。

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Version,
    [switch]$NoVerify,
    [string]$Owner = 'charline88888-ux',
    [string]$Repo = 'opportunity-radar',
    [string]$Token = $env:GITHUB_TOKEN
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if ($Version -notmatch '^v\d+\.\d+\.\d+$') { Write-Host "[FAIL] 版本号必须形如 v0.6.1" -ForegroundColor Red; exit 2 }
if (-not $Token) {
    Write-Host '[FAIL] 缺少 GITHUB_TOKEN：先设置 $env:GITHUB_TOKEN，或改用 release.ps1 + 手动 push' -ForegroundColor Red
    Write-Host '        Token 需 repo（推送）+ workflow（可选）权限；不要提交到仓库。'
    exit 2
}

Write-Host '==> 1/4 本地冻结版本'
& (Join-Path $PSScriptRoot 'release.ps1') -Version $Version
if ($LASTEXITCODE -ne 0) { Write-Host '[FAIL] release.ps1 失败，终止发布' -ForegroundColor Red; exit 1 }

Write-Host '==> 2/4 推送 main 与 tag（触发 Pages 自动部署）'
$b64 = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes("x-access-token:$Token"))
$env:GIT_CONFIG_COUNT = '1'
$env:GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader'
$env:GIT_CONFIG_VALUE_0 = "AUTHORIZATION: basic $b64"
$env:GIT_TERMINAL_PROMPT = '0'
git -c http.version=HTTP/1.1 -c http.sslBackend=schannel push origin main 2>&1 | Select-Object -Last 3
if ($LASTEXITCODE -ne 0) { Write-Host '[FAIL] push main 失败' -ForegroundColor Red; exit 1 }
git -c http.version=HTTP/1.1 -c http.sslBackend=schannel push origin "refs/tags/$Version" 2>&1 | Select-Object -Last 3
if ($LASTEXITCODE -ne 0) { Write-Host '[FAIL] push tag 失败' -ForegroundColor Red; exit 1 }
Write-Host "[OK] 已推送 $Version（GitHub Actions 将自动构建并部署 Pages）"

if ($NoVerify) { exit 0 }

Write-Host '==> 3/4 等待 GitHub Actions / Pages 更新（最多 ~6 分钟）'
$url = "https://$Owner.github.io/$Repo/versions.json"
$want = $Version
$ok = $false
for ($i = 0; $i -lt 18; $i++) {
    Start-Sleep -Seconds 20
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
        $j = $r.Content | ConvertFrom-Json
        if ($j.latest -eq $want) { $ok = $true; break }
        Write-Host "    ...最新为 $($j.latest)，继续等待"
    } catch { Write-Host '    ...Pages 暂不可用，继续等待' }
}
if ($ok) {
    Write-Host "==> 4/4 在线验证通过: https://$Owner.github.io/$Repo/" -ForegroundColor Green
    $dist = Join-Path $RepoRoot "releases\$Version\dist\index.html"
    if (Test-Path $dist) {
        $local = (Get-FileHash $dist -Algorithm SHA256).Hash.ToLower()
        $online = (Invoke-WebRequest "https://$Owner.github.io/$Repo/$Version/" -UseBasicParsing -TimeoutSec 20).RawContentLength
        Write-Host "   本地 dist sha256=$local ($((Get-Item $dist).Length) B) / 线上 $Version 长度=$online B"
    }
} else {
    Write-Host '[WARN] 6 分钟内未看到线上 latest 更新：请检查 https://github.com/charline88888-ux/opportunity-radar/actions' -ForegroundColor Yellow
    exit 3
}
exit 0
