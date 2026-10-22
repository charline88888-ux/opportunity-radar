# qa/online-check.ps1 —— 线上 GitHub Pages 与本地冻结产物一致性核验（v0.2+ 通用）
# 用法：powershell -File qa/online-check.ps1 -Version v0.3.0
param(
  [string]$Version = "v0.3.0",
  [string]$BaseUrl = "https://charline88888-ux.github.io/opportunity-radar"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$tmp = Join-Path $root "qa\tmp"
New-Item -ItemType Directory -Force $tmp | Out-Null

function Get-RemoteHash([string]$url, [string]$file) {
  $path = Join-Path $tmp $file
  Remove-Item $path -ErrorAction SilentlyContinue
  & curl.exe -s -f -L -o $path $url
  if (-not (Test-Path $path)) { return $null }
  return @{ bytes = (Get-Item $path).Length; sha256 = (Get-FileHash $path -Algorithm SHA256).Hash }
}

$localDist = Join-Path $root "releases\$Version\dist\index.html"
if (-not (Test-Path $localDist)) { Write-Host "ERROR: 本地冻结 dist 不存在: $localDist"; exit 1 }
$localHash = (Get-FileHash $localDist -Algorithm SHA256).Hash
$localBytes = (Get-Item $localDist).Length
Write-Host ("本地冻结 {0}: {1} B / {2}" -f $Version, $localBytes, $localHash)

$checks = @(
  @{ name = "root(/)"; url = "$BaseUrl/"; file = "online-root.html" },
  @{ name = "/$Version/"; url = "$BaseUrl/$Version/"; file = "online-$Version.html" },
  @{ name = "/v0.1.0/"; url = "$BaseUrl/v0.1.0/"; file = "online-v0.1.0.html" },
  @{ name = "/v0.2.0/"; url = "$BaseUrl/v0.2.0/"; file = "online-v0.2.0.html" }
)
$fail = 0
foreach ($c in $checks) {
  $r = Get-RemoteHash $c.url $c.file
  if ($null -eq $r) { Write-Host ("FAIL {0,-12} 无法下载 {1}" -f $c.name, $c.url); $fail++; continue }
  if ($c.name -like "$Version*" -or $c.name -eq "root(/)") {
    $ok = ($r.sha256 -eq $localHash -and $r.bytes -eq $localBytes)
    Write-Host ("{0} {1,-12} {2} B / {3}  (== 本地冻结: {4})" -f ($(if ($ok) { "PASS" } else { "FAIL" })), $c.name, $r.bytes, $r.sha256, $ok)
    if (-not $ok) { $fail++ }
  } else {
    # 历史归档：只验证可访问且非空（应与对应版本冻结 dist 一致，若有该版本）
    $archiveDist = Join-Path $root "releases\$($c.name.Trim('/'))\dist\index.html"
    if (Test-Path $archiveDist) {
      $ah = (Get-FileHash $archiveDist -Algorithm SHA256).Hash
      $ok = ($r.sha256 -eq $ah)
      Write-Host ("{0} {1,-12} {2} B / {3}  (== {4} 冻结: {5})" -f ($(if ($ok) { "PASS" } else { "FAIL" })), $c.name, $r.bytes, $r.sha256, $c.name.Trim('/'), $ok)
      if (-not $ok) { $fail++ }
    } else {
      Write-Host ("PASS {0,-12} {1} B（历史归档可访问）" -f $c.name, $r.bytes)
    }
  }
}

# versions.json
$vj = Get-RemoteHash "$BaseUrl/versions.json" "online-versions.json"
if ($null -eq $vj) { Write-Host "FAIL versions.json 无法下载"; $fail++ }
else {
  $vpath = Join-Path $tmp "online-versions.json"
  $v = Get-Content $vpath -Raw -Encoding UTF8 | ConvertFrom-Json
  $okLatest = ($v.latest -eq $Version)
  $paths = @($v.versions | ForEach-Object { $_.path })
  Write-Host ("{0} versions.json latest={1} paths={2}" -f ($(if ($okLatest) { "PASS" } else { "FAIL" })), $v.latest, ($paths -join ","))
  if (-not $okLatest) { $fail++ }
}

Write-Host ""
if ($fail -eq 0) { Write-Host "ONLINE CHECK: PASS"; exit 0 } else { Write-Host "ONLINE CHECK: FAIL ($fail)"; exit 1 }
