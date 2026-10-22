# qa/shoot-routes.ps1 —— 红队 file:// 路由截图（v0.3 12 路由 + 1024 + 纵向长页）
# 用法：powershell -File qa/shoot-routes.ps1 -Dist "app/dist/index.html" -OutDir "qa/screenshots/v03"
param(
  [Parameter(Mandatory = $true)][string]$Dist,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$Width = 1600,
  [int]$Height = 1000
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$distPath = if ([System.IO.Path]::IsPathRooted($Dist)) { $Dist } else { Join-Path $root $Dist }
if (-not (Test-Path $distPath)) { Write-Host "ERROR: dist 不存在: $distPath"; exit 1 }
$base = "file:///" + ($distPath -replace '\\', '/')
$out = if ([System.IO.Path]::IsPathRooted($OutDir)) { $OutDir } else { Join-Path $root $OutDir }
New-Item -ItemType Directory -Force $out | Out-Null
$profile = Join-Path $root "qa\tmp\chrome-shoot"
New-Item -ItemType Directory -Force $profile | Out-Null
$opp = "opp-pet-memorial-glass-001"
$routes = @(
  @{ n = "01-dashboard"; h = "#/"; w = $Width; ht = $Height },
  @{ n = "02-rankings"; h = "#/rankings"; w = $Width; ht = $Height },
  @{ n = "03-detail"; h = "#/opportunities/$opp"; w = $Width; ht = $Height },
  @{ n = "04-scanner"; h = "#/scanner"; w = $Width; ht = $Height },
  @{ n = "05-method"; h = "#/method"; w = $Width; ht = $Height },
  @{ n = "06-sources"; h = "#/sources"; w = $Width; ht = $Height },
  @{ n = "07-calendar"; h = "#/calendar"; w = $Width; ht = $Height },
  @{ n = "08-lab"; h = "#/lab"; w = $Width; ht = $Height },
  @{ n = "09-profile"; h = "#/profile"; w = $Width; ht = $Height },
  @{ n = "10-alerts"; h = "#/alerts"; w = $Width; ht = $Height },
  @{ n = "11-calibration"; h = "#/calibration"; w = $Width; ht = $Height },
  @{ n = "12-about"; h = "#/about"; w = $Width; ht = $Height },
  @{ n = "13-tall-detail"; h = "#/opportunities/$opp"; w = $Width; ht = 3600 },
  @{ n = "14-tall-about"; h = "#/about"; w = $Width; ht = 2800 },
  @{ n = "15-1024-dashboard"; h = "#/"; w = 1024; ht = 1000 },
  @{ n = "16-1024-rankings"; h = "#/rankings"; w = 1024; ht = 1000 },
  @{ n = "17-1024-profile"; h = "#/profile"; w = 1024; ht = 1000 }
)
$errors = 0
foreach ($r in $routes) {
  $shot = Join-Path $out "$($r.n).png"
  Remove-Item $shot -ErrorAction SilentlyContinue
  $log = Join-Path $root "qa\tmp\shoot-$($r.n).log"
  $args = @(
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    "--user-data-dir=$profile", "--window-size=$($r.w),$($r.ht)", '--virtual-time-budget=15000',
    "--screenshot=$shot", '--enable-logging=stderr', '--v=0', "$base$($r.h)"
  )
  $p = Start-Process -FilePath $chrome -ArgumentList $args -Wait -PassThru -RedirectStandardError $log -RedirectStandardOutput (Join-Path $root "qa\tmp\shoot-$($r.n).out")
  $size = (Get-Item $shot -ErrorAction SilentlyContinue).Length
  $jsErr = (Select-String -Path $log -Pattern 'ERROR:CONSOLE|Uncaught|Failed to load resource' -ErrorAction SilentlyContinue).Count
  if ($jsErr -gt 0) { $errors++ }
  Write-Host ("{0,-20} exit={1} size={2} jsErrors={3}" -f $r.n, $p.ExitCode, $size, $jsErr)
}
Write-Host "shots=$($routes.Count) jsErrorRoutes=$errors -> $out"
