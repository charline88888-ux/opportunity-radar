# v0.7.0 开发文档（DEV）

> 版本：v0.7.0（MINOR）　｜　数据版本：data-v0.7.0　｜　日期：2026-10-23　｜　上一版：v0.6.1
> 冻结目录：`releases/v0.7.0/`　｜　线上：https://charline88888-ux.github.io/opportunity-radar/

## 1. 本版目标
解决「网页上没有更新入口、必须敲本地命令」的体验问题：
1) 本地控制台：网页一键更新/采集/构建/启停每日任务；2) 云端每日自动更新线上数据（无需本机开机）；3) 站点结构修正（最新版本也有 `/vX.Y.Z/` 归档）。

## 2. 变更
### 2.1 本地控制台
- 新增 `scanner/serve.py`（标准库，127.0.0.1:8787，随机 token）：静态服务本地最新构建 + `/api/health|status|run|job|logs|log|schedule`。
- 任务：update（`scripts/daily-run.ps1` 当天 as_of：pipeline+validate+build+current）、fetch（`pipeline --fetch`→outbox）、build（pnpm build→current）。
- 单任务并发（忙 409）、日志环形缓冲、运行状态轮询；安全：loopback + token + Origin + 路径白名单。
- 启动：双击 `启动机会雷达.bat` 或 `python scanner/serve.py --open`；可选登录自启动 `scripts/install-console-autostart.ps1`。

### 2.2 前端 `/control`
- 第 15 个路由：状态卡（服务/数据/构建/定时任务/告警/最近任务）、操作按钮、实时日志、日志查看、未启动引导；token 从 URL 读取存 sessionStorage；双语。

### 2.3 每日线上更新（GitHub Actions）
- `.github/workflows/daily-update.yml`：每天 06:30 Asia/Shanghai；`pipeline --all --as-of <today>` → validate → 提交 rankings/stats/history/source-health → 构建 → build_site（root=当日构建）→ 部署 gh-pages；与 tag 部署共用 `pages-deploy` 并发组。

### 2.4 站点结构
- `/` = 最新数据构建；`/vX.Y.Z/` = **所有**冻结版本（含最新）；`versions.json`：latest.path=`/vX.Y.Z/`，可选 `live_as_of` / `daily_channel`；`build_site.py` 支持 `--as-of`。

### 2.5 其他
- data 0.7.0；scanner README/数据说明更新；`启动机会雷达.bat`、`install-console-autostart.ps1`。

## 3. 验收
| 项 | 结果 |
|---|---|
| 后端 | API 单测（401/403/409/路径穿越/静态 fallback/schedule 参数）；真实启动联调 |
| 前端 | 15 路由 zh/en；控制台联调（更新/构建/启停）；未启动态；构建可复现 |
| 每日云端 | workflow 静态检查 + 手动 dispatch 实测（线上 root as_of 当天） |
| 数据/冻结 | validate 20/20；unittest 全绿；MANIFEST sha256；线上 hash 校验 |

## 4. 已知问题
- 控制台需要本机运行 Python 服务；浏览器安全模型决定静态页面不能直接执行本地命令。
- 云端每日更新只刷新窗口/历史/统计，不自动新增机会（机会库需人工复核）；`--fetch` 采集在本地控制台执行。
- 每日 Actions 依赖 GitHub 调度（可能延迟数分钟至数十分钟）。

## 5. 下一版（v0.7.1/v0.8.0）
- 控制台：任务历史/耗时趋势、信号 inbox 页面（outbox 可视化复核）、发布按钮。
- 机会库 120+、团队只读 bundle、证据 quote 规范化。