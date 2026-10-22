# 机会雷达 Opportunity Radar · 全球商机扫描器（本地个人版）

> 用「人性需求信号 + 文化差异信号」持续发现全世界的赚钱信息差，按 **日 / 周 / 月 / 年** 榜单交付，并为每个机会强制回答 **商业驱动七问**。
> 本地优先（Local-first）：数据与页面全部在你自己的电脑上，双击 HTML 即可用；也可在线访问（随版本更新）。

| | 链接 |
|---|---|
| 🌐 **在线版（随版本更新）** | **https://charline88888-ux.github.io/opportunity-radar/** |
| 💻 源码仓库（GitHub） | https://github.com/charline88888-ux/opportunity-radar |
| 📦 当前冻结版 | `releases/v0.2.0/dist/index.html`（v0.1.0 归档在 `/v0.1.0/`） |
| 🏷️ 版本 | 应用 v0.2.0 ｜ 数据 data-v0.2.0 ｜ 基准日 2026-10-22 |

## 现在能做什么（v0.2.0）

- **指挥台**：今日新信号、四大榜单速览、评分分布、区域/行业/人性需求全景图、进行中实验提醒、采集健康度。
- **排行榜**：日 / 周 / 月 / 年四个窗口 + 14 个行业板块 + 信息差类型筛选 + 排名变化（真实历史快照后自动升级口径）+ 报告导出。
- **机会详情**：七问全答、10 维评分雷达、ROI、证据链、7 天验证动作、证伪条件、风险合规、Markdown 机会卡导出、加入实验。
- **实验台 `/lab`**：把机会变成可追踪的 7 天实验（预算/花费/耗时/状态/结论），统计与导出，防止「收藏夹吃灰」。
- **扫描室**：人性需求 × 信号类型矩阵、信息差桑基图、12 个扫描剧本、真实采集源健康度。
- **方法论**：评分权重拖动实时重排、七问框架、神经递质矩阵、信息差类型学、文化雷达、窗口衰减曲线。
- **数据源矩阵**：67 个平台 / 12 类、访问方式、频率、成本、合规等级、价值评分；**真实采集** 7 个公开源（RSS/JSON）→ outbox 人工复核。
- **报告**：四窗口 HTML（自包含可打印）+ Markdown 自动生成在 `data/reports/`；前端也可一键导出当前视图。
- **历史与 delta**：每日榜单快照 `data/history/`，有历史后自动切换为「较上一快照」的真实排名变化。
- **版本隔离**：`releases/vX.Y.Z/` + git tag + GitHub Pages 历史归档；旧版本永不修改，可随时回滚。

## 快速开始

### 方式 A：直接打开（无需安装/联网）

双击 `releases/v0.2.0/dist/index.html`（单文件，离线可用）。

### 方式 B：在线访问

打开 **https://charline88888-ux.github.io/opportunity-radar/**（`/v0.1.0/` 为历史版本归档，`versions.json` 为版本索引）。

### 方式 C：跑数据流水线（Python 3.11，仅标准库）

```powershell
python scanner/pipeline.py --all      # 生成榜单/历史快照/SQLite/报告（离线、幂等）
python scanner/validate.py            # 期望 20/20 PASS
python -m unittest discover -s scanner/tests -v   # 期望 28 tests OK
python scanner/pipeline.py --fetch    # 真实采集（显式联网；产物进 scanner/outbox/ 供人工复核）
```

### 方式 D：前端开发与构建

```powershell
cd app
pnpm install
pnpm dev      # 本地开发
pnpm build    # strict 校验 + 单文件构建，产物 app/dist/index.html
```

### 方式 E：每日自动跑 + 发布新版本

```powershell
# 注册 Windows 每日 07:00 任务（可加 -Fetch 同时采集）
powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1

# 冻结新版本（不污染旧版本）
powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Version v0.2.1

# 发布到 GitHub Pages（需要 GITHUB_TOKEN，勿提交）
$env:GITHUB_TOKEN = "ghp_xxx"
powershell -ExecutionPolicy Bypass -File scripts/deploy-pages.ps1 -Version v0.2.1
```

## 仓库地图

| 路径 | 内容 |
|---|---|
| `docs/` | 战略、方法论、评分、产品、技术、运营、风险、版本共 13 份主文档（00–12） |
| `data/` | 分类学、机会库、榜单、历史快照、报告、数据源、剧本、商业日历、采集健康度（data-v0.2.0） |
| `scanner/` | 流水线：采集（真实/离线 fixtures）→ 归一 → 去重 → 评分 → 排榜 → 历史 → SQLite → 报告 → 校验（Python 标准库） |
| `app/` | React + Vite + TS + Tailwind v4 + ECharts 前端源码（9 个页面） |
| `research/` | 真实案例、平台可访问性验证、文化差异研究底稿（含来源链接） |
| `qa/` | 红队清单、验收报告、截图、CDP 检查脚本 |
| `releases/` | 每个版本的冻结产物 + DEV/OPS/CHANGELOG/MANIFEST + 文档快照（**只读**） |
| `scripts/` | 发布、定时任务、GitHub Pages 部署脚本 |
| `.github/` | 仓库元信息（可选） |

## 文档索引

- [00 总览 · 执行摘要与路线图](docs/00-总览-执行摘要与路线图.md)
- [01 业务蓝图与商业模式](docs/01-业务蓝图与商业模式.md)
- [02 平台与数据源全矩阵](docs/02-平台与数据源全矩阵.md)
- [03 扫描方法论 · 人性需求逆向工程](docs/03-扫描方法论-人性需求逆向工程.md)
- [04 评估评分体系与推荐算法](docs/04-评估评分体系与推荐算法.md)
- [05 商业驱动七问框架](docs/05-商业驱动七问框架.md)
- [06 产品形态与交付设计](docs/06-产品形态与交付设计.md)
- [07 技术架构与扫描流水线](docs/07-技术架构与扫描流水线.md)
- [08 运营与增长手册](docs/08-运营与增长手册.md)
- [09 风险合规与红队清单](docs/09-风险合规与红队清单.md)
- [10 版本与发布管理](docs/10-版本与发布管理.md)
- [11 补充清单 · 40 个容易踩的坑与放大器](docs/11-补充清单-你没想到的40件事.md)
- [12 数据契约与字段字典（data-v0.2.0）](docs/12-数据契约与字段字典.md)

## 版本历史

| 版本 | 日期 | 摘要 | 产物 / 线上 |
|---|---|---|---|
| **v0.2.0** | 2026-10-22 | 真实采集（7 源）+ SQLite + 历史快照/真实 delta + 四窗口报告 + 定时任务 + 实验台 `/lab` + P2 修复 + GitHub Pages | [`releases/v0.2.0/`](releases/v0.2.0/)（[DEV](releases/v0.2.0/DEV.md) / [OPS](releases/v0.2.0/OPS.md) / [CHANGELOG](releases/v0.2.0/CHANGELOG.md)）｜线上根目录 |
| v0.1.0 | 2026-10-22 | 首个可用版本：8 页应用、46 条机会库、四窗口榜单、10 维评分、13 份文档、红队验收、发布体系 | [`releases/v0.1.0/`](releases/v0.1.0/)｜线上 `/v0.1.0/` |

> 升级规则：每次升级在 `releases/` 新建版本目录 + 新 git tag，旧版本只读、永不修改；回滚只需打开上一版本的 `dist/index.html`，线上回滚用对应 `/vX.Y.Z/` 归档。详见 [`docs/10-版本与发布管理.md`](docs/10-版本与发布管理.md)。

## 免责声明

本项目是「个人商机研究工具」，所有机会卡片是研究假设与公开信息整理，**不构成投资建议、法律意见或收入承诺**。涉及跨境、金融、医疗、宗教、内容版权时请自行做合规核查。数据中标注 `verified:false` 的条目未经二次核实，使用前必须复核原始来源；真实采集产物在 `scanner/outbox/`，需人工复核后才可入库。
