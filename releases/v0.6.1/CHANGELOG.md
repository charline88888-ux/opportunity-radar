# v0.6.1 变更明细（CHANGELOG）

> 日期：2026-10-23　｜　应用 0.6.1　｜　数据 data-v0.6.1　｜　类型：PATCH　｜　上一版：v0.6.0

## 新增（Added）
- `pipeline.py --as-of YYYY-MM-DD`：真实每日运行（窗口/history/stats/报告/年鉴跟随）。
- `scripts/daily-run.ps1`（每日任务：数据→校验→构建→current/index.html；失败 ALERT+通知；清理未来快照）。
- `scripts/build_site.py`、`scripts/publish.ps1`。
- `.github/workflows/ci.yml`、`.github/workflows/deploy-pages.yml`（tag 自动部署 Pages）。
- 前端数据新鲜度（as_of 距今天数、三态警告）+ `/alerts`「数据过期」规则 + About 更新方式说明。

## 修改（Changed）
- `install-daily-task.ps1` 改为调度 daily-run；任务创建/删除实测。
- validate V08：完整配额仅基准日强制，其他 as_of 只校验结构并允许空榜；V07/V09/V14/V19 使用 meta.as_of。
- 数据版本 0.6.0 → 0.6.1；报告/年鉴/校准重生成；前端 v0.6.1。
- PowerShell 脚本统一为 UTF-8 BOM（兼容 Windows PowerShell 5.1）。

## 修复（Fixed）
- 每日任务在 PS5.1 下因 stderr/编码导致的解析与退出问题；失败路径补 ALERT 与异常兜底。
- 回填旧 as_of 时历史快照晚于 as_of 导致 V19 失败（daily-run 自动清理未来快照）。

## 数据版本
| 版本 | 变化 |
|---|---|
| v0.6.0 | 80 机会 / 四窗口 17/49/57/80 |
| v0.6.1 | 全部 meta 0.6.1；窗口/报告/年鉴随 as_of 支持；机会库未变 |

## 已知限制
- 计划任务需开机+登录；通知为本地弹窗；采集产物需人工复核；Actions 自动部署需仓库权限，失败可手动兜底。

## 升级与回滚
- 升级：`git pull` → `pipeline.py --all` → `cd app && pnpm build` → 打开 `releases/v0.6.1/dist/index.html`。
- 回滚：`releases/v0.6.0/dist/index.html` 或线上 `/v0.6.0/`。