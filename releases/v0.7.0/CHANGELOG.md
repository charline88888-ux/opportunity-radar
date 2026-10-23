# v0.7.0 变更明细（CHANGELOG）

> 日期：2026-10-23　｜　应用 0.7.0　｜　数据 data-v0.7.0　｜　类型：MINOR　｜　上一版：v0.6.1

## 新增（Added）
- `scanner/serve.py` 本地控制台（127.0.0.1 + token；status/run/job/logs/log/schedule API）。
- `/control` 控制台页面：网页一键更新/采集/构建/启停每日任务，实时日志、告警与日志查看。
- `启动机会雷达.bat`、`scripts/install-console-autostart.ps1`（可选登录自启动）。
- `.github/workflows/daily-update.yml`：每天 06:30 云端刷新数据并部署线上根。
- 站点结构：`/vX.Y.Z/` 归档包含最新版本；versions.json 支持 `live_as_of`/`daily_channel`。

## 修改（Changed）
- `scripts/build_site.py` 支持 `--as-of`、全版本归档、latest.path=`/vX.Y.Z/`。
- data 版本 0.6.1 → 0.7.0；前端 0.7.0；15 路由；docs/README 同步。

## 修复（Fixed）
- 「网页无更新入口、必须本地命令」的体验问题（提供控制台入口与每日云端更新）。
- v0.6.1 P2：最新版本无 `/vX.Y.Z/` 归档、旧固定链接不兼容 → 已恢复全版本归档。

## 数据版本
| 版本 | 变化 |
|---|---|
| v0.6.1 | 80 机会 / as_of 支持 / 每日本地任务 |
| v0.7.0 | 全部 meta 0.7.0；控制台/每日云更新/站点结构；机会库未变 |

## 已知限制
- 控制台需本机 Python 服务；云端每日更新不新增机会（人工复核）；Actions 调度可能延迟。

## 升级与回滚
- 升级：双击 `启动机会雷达.bat`（或 `python scanner/serve.py --open`）→ 控制台点「立即更新数据」。
- 回滚：线上 `/vX.Y.Z/` 冻结版本；本地 `releases/vX.Y.Z/dist/index.html`。