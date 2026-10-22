# 机会雷达 Opportunity Radar · 全球商机扫描器（本地个人版）

> 用「人性需求信号 + 文化差异信号」持续发现全世界的赚钱信息差，按 **日 / 周 / 月 / 年** 榜单交付，并为每个机会强制回答 **商业驱动七问**。
> 本地优先（Local-first）：数据与页面全部在你自己的电脑上，双击 HTML 即可用；也可在线访问（随版本更新）。

| | 链接 |
|---|---|
| 🌐 **在线版（随版本更新）** | **https://charline88888-ux.github.io/opportunity-radar/** |
| 💻 源码仓库（GitHub） | https://github.com/charline88888-ux/opportunity-radar |
| 📦 当前冻结版 | `releases/v0.6.1/dist/index.html`（历史：`/v0.1.0/`–`/v0.6.0/`） |
| 🏷️ 版本 | 应用 v0.6.1 ｜ 数据 data-v0.6.1 ｜ 基准日 2026-10-22 |

## 现在能做什么（v0.6.1）

- **指挥台**：今日新信号、四大榜单、评分分布、区域/行业/需求全景、画像摘要 + 推荐 Top3、预警数、采集健康度。
- **排行榜**：日/周/月/年 + 14 行业 + 信息差筛选 + 排名变化（**真实历史 delta**，显示「较上一快照 / 历史回放」口径）；新增 **「为你推荐」模式**（按个人画像重排）。
- **个人画像 `/profile`**：3 步设置 7 维能力（资金/时间/技术/内容/供应链/英语/风险），5 个预设；localStorage 本地保存，不上传。
- **预警中心 `/alerts`**：5 类本地规则（窗口关闭/实验超期/源失败/未核验证据/高匹配未行动），已读/忽略持久化。
- **回测校准 `/calibration`**：实验 outcome × 机会评分 → 预测等级成功率、分桶校准、花费/耗时、校准建议；样本不足显示空态。
- **实验台 `/lab`**：7 天实验（预算/花费/耗时/状态/outcome/结论），统计与 JSON/Markdown 导出。
- **机会详情**：七问、10 维雷达 + 权重滑杆、ROI、证据链、7 天动作、证伪条件、加入实验、Markdown 机会卡导出。
- **扫描室**：需求×信号热力矩阵、信息差桑基图、12 剧本、**真实采集源健康度 v2**（mode/latency/cached/error）。
- **方法论**：评分权重拖动重排、七问、神经递质矩阵、信息差类型学、文化雷达、窗口衰减曲线。
- **数据源矩阵**：68 平台 / 12 类 + 采集健康度；**真实采集 8/8 源成功**（reddit 降级为人工浏览 + Lobsters 替代）→ outbox 人工复核。
- **v0.3.1 增补**：校准页 **Brier 分数**（当前 0.296 / N=6，基线 0.25）、**严格资金过滤**开关（按 ROI 启动资金硬过滤）、预警 id 含数据版本（数据升级自动重提醒）、单桶样本 <3 提示。
- **v0.4.0 增补**：**中英双语 UI**（顶栏切换，EN 数据仍中文并标注）、**AI 富化 outbox**（`scanner/enrich.py`，offline-template 默认 / 可选 LLM key；永不自动入库）、**校准/年度报告**（`scanner/calibrate.py` → `data/reports/calibration-*.html`）、**预警桌面通知**（可选、本地）。
- **v0.5.0 增补**：**年度年鉴 `/yearbook`**（年榜 Top20/月度时间线/分布/A 级清单/窗口风险 + 导出 MD/HTML）、**个人数据包 `/data`**（画像/实验/预警/推荐记录导出与导入，多设备手动迁移）、**推荐漏斗**（曝光→查看→实验→命中率）；后端可生成可打印年鉴 `scanner/yearbook.py`。
- **v0.5.1 增补**：数据包**口令加密**（PBKDF2-SHA256+AES-GCM-256，导入自动识别）、年鉴「第 1 名总分 vs 年度最高总分」分开展示、`enrich.py --provider mock` 本地模拟在线流程 + token/成本估算。
- **v0.6.0 增补**：机会库扩到 **80+**（53 个国家/地区、42 条中国角度、32 条 verified）；四窗口配额升级（日17/周49/月57/年80）；年鉴新增月度等级分布/信息差热度/窗口衰减/实验漏斗；docs/07 §20 多设备同步与团队协作方案评估。
- **v0.6.1 增补**：`pipeline.py --all --as-of YYYY-MM-DD` 真实每日推进；`scripts/daily-run.ps1` 每日任务（失败 ALERT+通知，输出 `current/index.html`）；`scripts/publish.ps1` + GitHub Actions tag 自动部署；前端数据新鲜度警告与「数据过期」预警。
- **报告**：四窗口 HTML（自包含可打印）+ Markdown；前端一键导出当前视图。
- **版本隔离**：`releases/vX.Y.Z/` + git tag + GitHub Pages 历史归档；旧版本只读，可随时回滚。

## 快速开始

### 方式 A：直接打开（无需安装/联网）

双击 `releases/v0.6.1/dist/index.html`（单文件，离线可用）。

### 方式 B：在线访问

**https://charline88888-ux.github.io/opportunity-radar/**（`/v0.1.0/`、`/v0.2.0/` 为历史归档，`versions.json` 为版本索引）。

### 方式 C：数据流水线（Python 3.11，仅标准库）

```powershell
python scanner/pipeline.py --all        # 榜单 + history + SQLite + 报告（离线、幂等）
python scanner/validate.py              # 期望 20/20 PASS
python -m unittest discover -s scanner/tests -v   # 期望 36 tests OK
python scanner/pipeline.py --fetch --no-cache     # 真实采集（显式联网；写 outbox + source-health v2）
python scanner/pipeline.py --replay-as-of 2026-10-22 --replay-days 2  # 历史回放（演示/对照）
python scanner/report.py --all          # 四窗口报告
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
powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Version v0.4.1

# 发布到 GitHub Pages（需要 GITHUB_TOKEN，勿提交；网络异常时 git 加 -c http.version=HTTP/1.1 -c http.sslBackend=schannel）
$env:GITHUB_TOKEN = "ghp_xxx"
powershell -ExecutionPolicy Bypass -File scripts/deploy-pages.ps1 -Version v0.4.1
```

## 仓库地图

| 路径 | 内容 |
|---|---|
| `docs/` | 战略、方法论、评分、产品、技术、运营、风险、版本共 13 份主文档（00–12） |
| `data/` | 分类学、**80+ 机会库**、榜单、历史快照（含回放）、报告（四窗口/校准/年鉴）、数据源、剧本、日历、采集健康度 v2（data-v0.6.0） |
| `scanner/` | 采集（真实/离线）→ 归一 → 去重 → 评分 → 排榜 → 历史/回放 → SQLite → 报告 → **富化 enrich.py** → **校准 calibrate.py** → 校验（Python 标准库） |
| `app/` | React + Vite + TS + Tailwind v4 + ECharts 前端源码（12 个页面） |
| `research/` | 真实案例、平台可访问性验证、文化差异研究底稿（含来源链接） |
| `qa/` | 红队清单、验收报告、截图、CDP 检查脚本 |
| `releases/` | 每个版本的冻结产物 + DEV/OPS/CHANGELOG/MANIFEST + 文档快照（**只读**） |
| `scripts/` | 发布、定时任务、GitHub Pages 部署脚本 |

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
- [12 数据契约与字段字典（data-v0.6.1）](docs/12-数据契约与字段字典.md)

## 版本历史

| 版本 | 日期 | 摘要 | 产物 / 线上 |
|---|---|---|---|
| **v0.6.1** | 2026-10-23 | PATCH：`--as-of` 每日运行、daily-run/publish 自动化、GitHub Actions 自动部署、数据新鲜度 | [`releases/v0.6.1/`](releases/v0.6.1/)（[DEV](releases/v0.6.1/DEV.md) / [OPS](releases/v0.6.1/OPS.md) / [CHANGELOG](releases/v0.6.1/CHANGELOG.md)）｜线上根目录 |
| v0.6.0 | 2026-10-22 | MINOR：机会库 46→80+、榜单配额升级、年鉴指标细化、多设备/团队评估 | [`releases/v0.6.0/`](releases/v0.6.0/)｜线上 `/v0.6.0/` |
| v0.5.1 | 2026-10-22 | PATCH：年鉴分数口径修正、数据包口令加密、enrich mock/在线 usage、i18n 收尾 | [`releases/v0.5.1/`](releases/v0.5.1/)｜线上 `/v0.5.1/` |
| v0.5.0 | 2026-10-22 | MINOR：年度年鉴 `/yearbook`、个人数据包 `/data`、推荐漏斗、i18n 收尾 | [`releases/v0.5.0/`](releases/v0.5.0/)｜线上 `/v0.5.0/` |
| v0.4.0 | 2026-10-22 | MINOR：中英双语 UI、AI 富化 outbox、实验校准/年度报告、预警桌面通知 | [`releases/v0.4.0/`](releases/v0.4.0/)｜线上 `/v0.4.0/` |
| v0.3.1 | 2026-10-22 | PATCH：采集修复 8/8 源成功、Brier 分数、严格资金过滤、预警按数据版本重提醒、单桶样本提示 | [`releases/v0.3.1/`](releases/v0.3.1/)｜线上 `/v0.3.1/` |
| v0.3.0 | 2026-10-22 | 个人画像 + 推荐重排、实验回测校准、预警中心、source-health v2、历史回放/真实 delta | [`releases/v0.3.0/`](releases/v0.3.0/)｜线上 `/v0.3.0/` |
| v0.2.0 | 2026-10-22 | 真实采集（7 源）+ SQLite + 历史快照/真实 delta + 四窗口报告 + 定时任务 + 实验台 `/lab` + P2 修复 + GitHub Pages | [`releases/v0.2.0/`](releases/v0.2.0/)｜线上 `/v0.2.0/` |
| v0.1.0 | 2026-10-22 | 首个可用版本：8 页应用、46 条机会库、四窗口榜单、10 维评分、13 份文档、红队验收、发布体系 | [`releases/v0.1.0/`](releases/v0.1.0/)｜线上 `/v0.1.0/` |

> 升级规则：每次升级在 `releases/` 新建版本目录 + 新 git tag，旧版本只读、永不修改；回滚只需打开上一版本的 `dist/index.html`，线上回滚用对应 `/vX.Y.Z/` 归档。详见 [`docs/10-版本与发布管理.md`](docs/10-版本与发布管理.md)。

## 免责声明

本项目是「个人商机研究工具」，所有机会卡片是研究假设与公开信息整理，**不构成投资建议、法律意见或收入承诺**。涉及跨境、金融、医疗、宗教、内容版权时请自行做合规核查。数据中标注 `verified:false` 的条目未经二次核实，使用前必须复核原始来源；真实采集产物在 `scanner/outbox/`，需人工复核后才可入库。历史回放快照仅用于 delta 对照与演示，不代表真实历史信号。
