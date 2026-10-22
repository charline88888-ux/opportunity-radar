# v0.2.0 变更明细（CHANGELOG）

> 日期：2026-10-22　｜　应用版本：0.2.0　｜　数据版本：data-v0.2.0　｜　上一版本：v0.1.0
> 类型：MINOR（新功能；数据契约 MINOR 向后兼容）

## 新增（Added）

### 数据与扫描器

- **真实采集**：`scanner/fetch.py` + `pipeline.py --fetch`，8 个公开源（Reddit/iTunes RSS/HN RSS/App Store RSS/arXiv/TechCrunch/ProductHunt/Shopify Changelog）→ 7 成功 / 185 条信号；限速、6h 缓存、UA、超时、重试；产物 `scanner/outbox/signals-<date>.json` + `data/source-health.json`；**不自动进机会库**。
- **历史快照**：`data/history/rankings-2026-10-22.json`；`rankings.meta.delta_basis/history_as_of/tie_breaker`；真实 delta 机制（history 优先、相邻窗口回退）。
- **SQLite 派生库**：`scanner/db.py` → `data/radar.db`（gitignore），opportunities/evidence/rankings_history/source_health = 46/88/92/8 行；`--db-rebuild`。
- **报告导出**：`scanner/report.py` → `data/reports/report-<period>-2026-10-22.{html,md}`（4 窗口 ×2 格式）；HTML 自包含可打印。
- **校验与测试**：V19（history 一致性）/V20（source-health 合法性）；单测 28 条。
- **数据源**：sources 63→67（新增 4 个可采集 RSS 源，含 source-health 元数据）。

### 前端

- 新页面 `/lab` 实验台：localStorage 实验记录（状态/预算/结论/花费/时长）、统计、导出 JSON/Markdown、Dashboard 进行中提醒。
- 详情页：实验状态卡、Markdown 机会卡导出、history/delta 口径提示。
- 榜单页：delta 口径标签、报告导出按钮、1024 栅格修复、「新上榜」文案修正。
- About：v0.2.0、版本历史、GitHub 仓库与线上链接。
- 构建：0.2.0；strict sync 支持可选 history/source-health；单文件 dist。

### 工程与发布

- `scripts/install-daily-task.ps1`（Windows 定时任务，支持 `-Fetch`、`-Uninstall`）。
- `scripts/deploy-pages.ps1`（GitHub Pages：最新版根目录 + 历史版本归档 + `versions.json`，自动验证 URL）。
- GitHub 公共仓库 + GitHub Pages 线上版：https://charline88888-ux.github.io/opportunity-radar/
- README 增加线上链接与 v0.2 快速开始。

## 修改（Changed）

- 数据版本 `0.1.0 → 0.2.0`；taxonomy/rankings/stats/sources/playbooks/calendar 的 `meta.data_version` 同步升级；opportunities 内容未变（SHA256 不变）。
- `scanner/pipeline.py`：`--all` 串联 history/db/report；新增 `--fetch`、`--db-rebuild`、`--report`。
- `scanner/rank.py`：meta 字段与 delta 计算升级（tie-breaker 仍按契约链）。
- `scripts/release.ps1`：修复 dist 目录复制、MANIFEST 提交顺序/`git_commit` 回填、counts 整数化。
- docs/00/06/07/08/10/12 更新 v0.2 增量（架构、产品、运营、契约、发布、GitHub Pages）。
- 线上版结构：根=最新，`/v0.1.0/`、`/v0.2.0/` 归档，`versions.json`。

## 修复（Fixed）

- v0.1.0 红队 P2-6：Rankings 1024 卡片截断 → 栅格调整；「新上榜」恒 0 → 改为「较周榜变化」/零值隐藏。
- v0.1.0 红队 P2-9：research/cases.md 动态 RSS 证据不可复现 → 换 permalink 并降级为弱证据（研究员）。
- 首次发布脚本缺陷（dist 复制为文件、MANIFEST commit 早于发布提交）→ 修复并重新冻结 v0.1.0，无残留。
- 详情页证据字段错配、tie-breaker 契约不一致等 v0.1.0 冻结前 P1 已在 v0.1.0 内闭环。

## 移除（Removed）

- 无。

## 数据版本变化

| 版本 | 变化 |
|---|---|
| v0.1.0 | 46 机会 / 63 源 / 12 剧本 / 33 日历 / 88 证据 |
| v0.2.0 | + history 快照、+ 8 报告文件、+ source-health、+4 数据源（67）、validate 20 条；opportunities 未变 |

## 已知限制（Known limitations）

- 仅 1 份历史快照，真实 delta 待次日运行后生效（当前回退相邻窗口口径，UI 明示）。
- `--fetch` 结果需人工复核后入库；公开 API 源覆盖有限，失败源如实记录。
- `verified:true` 仍 5 条；41 条为研究假设，使用前须复核。
- 报告 `generated_at` 非确定（派生视图）；单文件 dist 约 2.0MB。
- 个人画像/实验台为 localStorage，不跨设备同步。

## 升级与回滚

- 升级：`git pull` → `python scanner/pipeline.py --all` → `cd app; pnpm build` → 打开 `releases/v0.2.0/dist/index.html`。
- 回滚：直接打开 `releases/v0.1.0/dist/index.html`；线上用 `/v0.1.0/` 或回退 `gh-pages`。
- 旧版本目录只读，永不修改。
