# daily-run.ps1 — 每日自动运行：推进 as_of → 更新数据 → 校验 → 构建 → 生成 current/index.html
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts/daily-run.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/daily-run.ps1 -Fetch          # 同时真实采集（outbox 待人工复核）
#   powershell -ExecutionPolicy Bypass -File scripts/daily-run.ps1 -AsOf 2026-10-23 -NoBuild
# 由 scripts/install-daily-task.ps1 注册为 Windows 计划任务（默认每天 07:00）。
# 约定：失败时写 scanner/logs/ALERT.txt 并弹 Windows 通知；成功时清除 ALERT。
# 注意：daily-run 只更新“本地工作副本”（app/dist 与 current/index.html）；冻结版 releases/ 只能由 release.ps1 产生，
#       线上版由 push tag 触发的 GitHub Actions 自动部署（.github/workflows/deploy-pages.yml）。

[CmdletBinding()]
param(
    [string]$AsOf = '',
    [switch]$Fetch,
    [switch]$NoBuild,
    [switch]$NoValidate,
    [switch]$NoCurrentCopy,
    [string]$Python = 'python'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$now = Get-Date
if (-not $AsOf) { $AsOf = $now.ToString('yyyy-MM-dd') }
if ($AsOf -notmatch '^\d{4}-\d{2}-\d{2}$') {
    Write-Host "[FAIL] -AsOf 必须为 YYYY-MM-DD，当前: $AsOf" -ForegroundColor Red
    exit 2
}

$logDir = Join-Path $RepoRoot 'scanner\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "daily-$AsOf.log"
$alertFile = Join-Path $logDir 'ALERT.txt'
$env:PYTHONIOENCODING = 'utf-8'

function Write-Log([string]$msg) {
    $line = '[{0}] {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $msg
    Add-Content -Path $logFile -Value $line -Encoding UTF8
    Write-Host $line
}

function Notify([string]$title, [string]$text) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $icon = New-Object System.Windows.Forms.NotifyIcon
        $icon.Icon = [System.Drawing.SystemIcons]::Warning
        $icon.Visible = $true
        $icon.ShowBalloonTip(6000, $title, $text, [System.Windows.Forms.ToolTipIcon]::Warning)
        Start-Sleep -Seconds 3
        $icon.Dispose()
    } catch { }
}

function Fail([string]$msg) {
    Write-Log "FAIL: $msg"
    $alert = @(
        "机会雷达每日任务失败",
        "时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        "as_of: $AsOf",
        "原因: $msg",
        "日志: $logFile",
        "处理: 查看日志后重新运行 scripts/daily-run.ps1，或手动执行 python scanner/pipeline.py --all --as-of $AsOf"
    ) -join "`r`n"
    Set-Content -Path $alertFile -Value $alert -Encoding UTF8
    Notify '机会雷达每日任务失败' "$msg（详见 scanner/logs/ALERT.txt）"
    exit 1
}

# 调用原生命令：临时关闭 Stop（避免 PS5.1 把 stderr 当 terminating error），返回退出码
function Invoke-Native([string]$file, [string[]]$arguments) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $file @arguments 2>&1
        $code = $LASTEXITCODE
        $output | ForEach-Object { Write-Log ($_ | Out-String).TrimEnd() }
        return $code
    } finally { $ErrorActionPreference = $prev }
}

try {
    if (Test-Path $alertFile) { Remove-Item $alertFile -Force }
    Write-Log "===== start as_of=$AsOf fetch=$($Fetch.IsPresent) build=$(-not $NoBuild) ====="

    # 0) 清理晚于本次 as_of 的快照（避免回填旧日期时 V19 报“快照晚于 as_of”）
    $historyDir = Join-Path $RepoRoot 'data\history'
    if (Test-Path $historyDir) {
        Get-ChildItem $historyDir -Filter 'rankings-*.json' | ForEach-Object {
            if ($_.BaseName -match 'rankings-(\d{4}-\d{2}-\d{2})$') {
                $snap = $Matches[1]
                if ($snap -gt $AsOf) {
                    Remove-Item $_.FullName -Force
                    Write-Log "prune future snapshot: rankings-$snap.json（晚于 as_of=$AsOf）"
                }
            }
        }
    }

    # 1) 数据流水线（离线，推进 as_of）
    Write-Log 'step 1/4: pipeline --all'
    $code = Invoke-Native $Python @('scanner\pipeline.py', '--all', '--as-of', $AsOf)
    if ($code -ne 0) { Fail "pipeline --all 退出码 $code" }

    # 2) 真实采集（可选；产物进 outbox，人工复核后才入库，失败不阻断当日更新）
    if ($Fetch) {
        Write-Log 'step 2/4: pipeline --fetch（可选，采集失败不阻断）'
        $fetchCode = Invoke-Native $Python @('scanner\pipeline.py', '--fetch', '--as-of', $AsOf)
        if ($fetchCode -ne 0) { Write-Log "WARN: --fetch 退出码 $fetchCode（继续，检查 source-health/outbox）" }
    } else { Write-Log 'step 2/4: skip --fetch（可用 -Fetch 开启）' }

    # 3) 校验
    if (-not $NoValidate) {
        Write-Log 'step 3/4: validate'
        $vCode = Invoke-Native $Python @('scanner\validate.py')
        if ($vCode -ne 0) { Fail "validate 退出码 $vCode（数据或基准日不合法，已保留 ALERT）" }
    } else { Write-Log 'step 3/4: skip validate（-NoValidate）' }

    # 4) 前端构建 → current/index.html（本地最新工作副本）
    if (-not $NoBuild) {
        Write-Log 'step 4/4: build app'
        $appDir = Join-Path $RepoRoot 'app'
        Push-Location $appDir
        try {
            $iCode = Invoke-Native 'pnpm' @('install', '--frozen-lockfile')
            if ($iCode -ne 0) { throw "pnpm install 退出码 $iCode" }
            $bCode = Invoke-Native 'pnpm' @('build')
            if ($bCode -ne 0) { throw "pnpm build 退出码 $bCode" }
        } finally { Pop-Location }

        if (-not $NoCurrentCopy) {
            $currentDir = Join-Path $RepoRoot 'current'
            New-Item -ItemType Directory -Force -Path $currentDir | Out-Null
            Copy-Item (Join-Path $RepoRoot 'app\dist\index.html') (Join-Path $currentDir 'index.html') -Force
            $meta = @(
                "机会雷达 · 本地每日工作副本",
                "as_of: $AsOf",
                "generated_at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
                "打开: current/index.html",
                "冻结版本: releases/（只读）；线上: GitHub Pages",
                "提示: 本目录由 scripts/daily-run.ps1 生成，不进入 git/发布"
            ) -join "`r`n"
            Set-Content -Path (Join-Path $currentDir 'README.txt') -Value $meta -Encoding UTF8
            Write-Log "current/index.html 已更新（as_of=$AsOf）"
        }
    } else { Write-Log 'step 4/4: skip build（-NoBuild）' }

    Write-Log "===== OK as_of=$AsOf ====="
    Write-Host ''
    Write-Host "[OK] 每日任务完成：$AsOf" -ForegroundColor Green
    Write-Host '     工作副本: current\index.html'
    Write-Host "     日志:     $logFile"
    Write-Host '     发布:     需要新版本时运行 scripts\publish.ps1 -Version vX.Y.Z'
    exit 0
} catch {
    Fail $_.Exception.Message
}
