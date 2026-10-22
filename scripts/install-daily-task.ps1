# install-daily-task.ps1 — 注册/卸载 Windows 每日扫描任务（v0.2.0）
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1 -Time 07:30 -Fetch
#   powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1 -Uninstall
# 说明：默认每天 07:00 运行 `python scanner/pipeline.py --all`（离线、幂等）；
#       加 -Fetch 会同时运行 `--fetch`（真实采集，写 outbox 供人工复核，不自动入库）。

[CmdletBinding()]
param(
    [string]$TaskName = 'OpportunityRadar-Daily',
    [string]$Time = '07:00',
    [string]$Python = 'python',
    [switch]$Fetch,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if ($Uninstall) {
    $out = schtasks /Delete /TN $TaskName /F 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Host "[OK] 已删除计划任务: $TaskName" } else { Write-Host "[WARN] 删除失败（可能不存在）: $out" }
    exit 0
}

$logDir = Join-Path $RepoRoot 'scanner\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'scheduled.log'

$argList = @('scanner\pipeline.py', '--all')
if ($Fetch) { $argList += '--fetch' }
$argString = ($argList | ForEach-Object { if ($_ -match '\s') { '"{0}"' -f $_ } else { $_ } }) -join ' '

# 用 cmd 包一层，保证输出重定向到日志（中文路径用引号）
$inner = "cd /d `"$RepoRoot`" && `"$Python`" $argString >> `"$logFile`" 2>&1"
$tr = "cmd.exe /c $inner"

Write-Host "==> 注册计划任务"
Write-Host "    名称: $TaskName"
Write-Host "    时间: 每天 $Time"
Write-Host "    命令: $tr"
schtasks /Create /TN $TaskName /TR $tr /SC DAILY /ST $Time /F | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Host '[FAIL] 注册失败（可能缺少权限；可尝试以管理员身份运行）' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '[OK] 已完成。常用命令：'
Write-Host "    查看:   schtasks /Query /TN $TaskName /V /FO LIST"
Write-Host "    立即跑: schtasks /Run /TN $TaskName"
Write-Host "    卸载:   powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1 -Uninstall"
Write-Host "    日志:   $logFile"
Write-Host ''
Write-Host '提示：真实采集仅写 scanner/outbox/ 供人工复核，不会自动写机会库；确认后再手动合并。'
