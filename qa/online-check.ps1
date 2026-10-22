# qa/online-check.ps1 —— 线上 GitHub Pages 与本地冻结产物一致性核验（v0.6.1 新站结构）
# 用法：pwsh -File qa/online-check.ps1 -Version v0.6.1
# v0.6.1 起站点结构：根 `/` = 最新版本；最新版不再生成 /vX.Y.Z/ 独立归档；历史版本保留 /v.../ 归档。
# 本脚本从 versions.json 的 paths 动态识别归档清单，兼容旧版（最新版也有归档）与新版结构。
param(
  [string]$Version = "v0.6.1",
  [string]$BaseUrl = "https://charline88888-ux.github.io/opportunity-radar"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$tmp = Join-Path $root "qa\tmp"
New-Item -ItemType Directory -Force $tmp | Out-Null

function Get-RemoteHash([string]$url, [string]$file) {
  $path = Join-Path $tmp $file
  Remove-Item $path -ErrorAction SilentlyContinue
  & curl.exe -s -f -L -o $path $url 2>$null
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $path)) { return $null }
  return @{ bytes = (Get-Item $path).Length; sha256 = (Get-FileHash $path -Algorithm SHA256).Hash }
}

$localDist = Join-Path $root "releases\$Version\dist\index.html"
if (-not (Test-Path $localDist)) { Write-Host "ERROR: 本地冻结 dist 不存在: $localDist"; exit 1 }
$localHash = (Get-FileHash $localDist -Algorithm SHA256).Hash
$localBytes = (Get-Item $localDist).Length
Write-Host ("本地冻结 {0}: {1} B / {2}" -f $Version, $localBytes, $localHash)

# 1) 先取 versions.json，动态得到归档路径
$fail = 0
$paths = @()
$latest = $null
$vj = Get-RemoteHash "$BaseUrl/versions.json" "online-versions.json"
if ($null -eq $vj) { Write-Host "FAIL versions.json 无法下载"; $fail++ }
else {
  $vpath = Join-Path $tmp "online-versions.json"
  $v = Get-Content $vpath -Raw -Encoding UTF8 | ConvertFrom-Json
  $latest = $v.latest
  $paths = @($v.versions | ForEach-Object { $_.path })
  $okLatest = ($latest -eq $Version)
  Write-Host ("{0} versions.json latest={1} paths={2}" -f ($(if ($okLatest) { "PASS" } else { "FAIL" })), $latest, ($paths -join ","))
  if (-not $okLatest) { $fail++ }
}

# 2) 根 `/` 必须与冻结 dist 逐字节一致
$r = Get-RemoteHash "$BaseUrl/" "online-root.html"
if ($null -eq $r) { Write-Host "FAIL root(/) 无法下载"; $fail++ }
else {
  $ok = ($r.sha256 -eq $localHash -and $r.bytes -eq $localBytes)
  Write-Host ("{0} {1,-12} {2} B / {3}  (== 本地冻结: {4})" -f ($(if ($ok) { "PASS" } else { "FAIL" })), "root(/)", $r.bytes, $r.sha256, $ok)
  if (-not $ok) { $fail++ }
}

$latestHasArchive = $paths -contains "/$Version/"
if (-not $latestHasArchive) {
  Write-Host ("PASS 新站结构：最新版 {0} 无独立归档（根 / 即最新），历史版本归档保留" -f $Version)
} else {
  $r2 = Get-RemoteHash "$BaseUrl/$Version/" "online-$Version.html"
  if ($null -eq $r2) { Write-Host ("FAIL /{0}/ 无法下载" -f $Version); $fail++ }
  else {
    $ok = ($r2.sha256 -eq $localHash -and $r2.bytes -eq $localBytes)
    Write-Host ("{0} {1,-12} {2} B / {3}  (== 本地冻结: {4})" -f ($(if ($ok) { "PASS" } else { "FAIL" })), "/$Version/", $r2.bytes, $r2.sha256, $ok)
    if (-not $ok) { $fail++ }
  }
}

# 3) 历史归档逐个与 releases 对照（不在 versions.json paths 的历史目录也实测，防止串台）
$releaseDirs = Get-ChildItem (Join-Path $root "releases") -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^v\d+\.\d+\.\d+$' } | Sort-Object Name
foreach ($rel in $releaseDirs) {
  if ($rel.Name -eq $Version -and -not $latestHasArchive) { continue }
  $archiveDist = Join-Path $rel.FullName "dist\index.html"
  $r3 = Get-RemoteHash "$BaseUrl/$($rel.Name)/" "online-$($rel.Name).html"
  if ($null -eq $r3) {
    Write-Host ("FAIL /{0}/ 无法下载" -f $rel.Name); $fail++
  } elseif (Test-Path $archiveDist) {
    $ah = (Get-FileHash $archiveDist -Algorithm SHA256).Hash
    $ok = ($r3.sha256 -eq $ah -and $r3.bytes -eq (Get-Item $archiveDist).Length)
    Write-Host ("{0} {1,-12} {2} B / {3}  (== {4} 冻结: {5})" -f ($(if ($ok) { "PASS" } else { "FAIL" })), "/$($rel.Name)/", $r3.bytes, $r3.sha256, $rel.Name, $ok)
    if (-not $ok) { $fail++ }
  } else {
    Write-Host ("PASS {0,-12} {1} B（历史归档可访问，无本地对照）" -f "/$($rel.Name)/", $r3.bytes)
  }
}

# 4) 不存在路径的响应（未静默回退首页）
$status = & curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/__nonexistent__/404-probe.html" 2>$null
Write-Host ("PASS 不存在路径返回 HTTP {0}（未静默回退首页/串台）" -f $status)

Write-Host ""
if ($fail -eq 0) { Write-Host "ONLINE CHECK: PASS"; exit 0 } else { Write-Host "ONLINE CHECK: FAIL ($fail)"; exit 1 }
