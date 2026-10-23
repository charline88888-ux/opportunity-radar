# install-console-autostart.ps1 — 登录时自动启动本地控制台（可选）
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts/install-console-autostart.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/install-console-autostart.ps1 -Port 8787
#   powershell -ExecutionPolicy Bypass -File scripts/install-console-autostart.ps1 -Uninstall
# 说明：
#   - 注册 Windows 计划任务（登录时触发），后台运行 pythonw scanner/serve.py（不弹窗）；
#   - 之后随时双击「启动机会雷达.bat」或访问 http://127.0.0.1:8787/ 即可；
#   - 不需要时用 -Uninstall 卸载。

[CmdletBinding()]
param(
    [string]$TaskName = 'OpportunityRadar-Console',
    [int]$Port = 8787,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$serve = Join-Path $RepoRoot 'scanner\serve.py'

if ($Uninstall) {
    $out = schtasks /Delete /TN $TaskName /F 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Host "[OK] 已删除控制台自启动任务: $TaskName" } else { Write-Host "[WARN] 删除失败（可能不存在）: $out" }
    exit 0
}
if (-not (Test-Path $serve)) { Write-Host '[FAIL] 找不到 scanner\serve.py' -ForegroundColor Red; exit 1 }

$pythonw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
if (-not $pythonw) {
    $python = (Get-Command python.exe -ErrorAction Stop).Source
    $pythonw = Join-Path (Split-Path $python -Parent) 'pythonw.exe'
}
if (-not (Test-Path $pythonw)) { Write-Host '[FAIL] 找不到 pythonw.exe（可用 python 手动运行控制台）' -ForegroundColor Red; exit 1 }

$tr = "`"$pythonw`" `"$serve`" --port $Port"
Write-Host '==> 注册登录自启动（本地控制台）'
Write-Host "    任务: $TaskName"
Write-Host "    命令: $tr"
schtasks /Create /TN $TaskName /TR $tr /SC ONLOGON /RL LIMITED /F | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Host '[FAIL] 注册失败（可能缺少权限；可尝试管理员）' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '[OK] 已注册：下次登录 Windows 时自动在后台启动控制台。'
Write-Host '    现在启动: 双击「启动机会雷达.bat」或 powershell -File scripts/install-console-autostart.ps1 后登录'
Write-Host "    地址:     http://127.0.0.1:$Port/（打开后进入「控制台」页面）"
Write-Host "    卸载:     powershell -File scripts/install-console-autostart.ps1 -Uninstall"
