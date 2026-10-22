# install-daily-task.ps1 — 注册/卸载 Windows 每日扫描任务（v0.6.1：调度 daily-run.ps1）
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1 -Time 07:30 -Fetch
#   powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1 -Uninstall
# 说明：
#   默认每天 07:00 运行 scripts/daily-run.ps1（自动计算当天 as_of → pipeline --all → validate → pnpm build → current/index.html）；
#   加 -Fetch 会同时真实采集（产物进 scanner/outbox，人工复核后才入库）；失败会写 ALERT.txt 并弹 Windows 通知。
#   日志：scanner/logs/daily-<as_of>.log

[CmdletBinding()]
param(
    [string]$TaskName = 'OpportunityRadar-Daily',
    [string]$Time = '07:00',
    [switch]$Fetch,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$dailyScript = Join-Path $RepoRoot 'scripts\daily-run.ps1'

if ($Uninstall) {
    $out = schtasks /Delete /TN $TaskName /F 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Host "[OK] 已删除计划任务: $TaskName" } else { Write-Host "[WARN] 删除失败（可能不存在）: $out" }
    exit 0
}
if (-not (Test-Path $dailyScript)) { Write-Host "[FAIL] 找不到 scripts\daily-run.ps1" -ForegroundColor Red; exit 1 }

$fetchArg = if ($Fetch) { ' -Fetch' } else { '' }
$tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$dailyScript`"$fetchArg"

Write-Host '==> 注册计划任务'
Write-Host "    名称: $TaskName"
Write-Host "    时间: 每天 $Time"
Write-Host "    命令: $tr"
schtasks /Create /TN $TaskName /TR $tr /SC DAILY /ST $Time /F | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Host '[FAIL] 注册失败（可能缺少权限；可尝试以管理员身份运行）' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '[OK] 已完成。常用命令：'
Write-Host "    立即跑:   schtasks /Run /TN $TaskName"
Write-Host "    查看:     schtasks /Query /TN $TaskName /V /FO LIST"
Write-Host '    手动跑:   powershell -ExecutionPolicy Bypass -File scripts/daily-run.ps1 -Fetch'
Write-Host "    卸载:     powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1 -Uninstall"
Write-Host '    日志:     scanner/logs/daily-<as_of>.log；失败看 scanner/logs/ALERT.txt'
Write-Host ''
Write-Host '注意：电脑需开机且已登录；真实采集产物需人工复核后才写入机会库；冻结版仍由 scripts/publish.ps1 发布。'
