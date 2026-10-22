# v0.2.0 开发文档（DEV）

> 版本：v0.2.0　｜　数据版本：data-v0.2.0　｜　数据基准日：2026-10-22　｜　发布日期：2026-10-22
> 对应冻结目录：`releases/v0.2.0/`；线上版：https://charline88888-ux.github.io/opportunity-radar/
> 上一版本：`releases/v0.1.0/`（保持不变，可随时打开）

---

## 1. 本版目标与范围

目标：把 v0.1.0 的「离线机会库 + 榜单」升级为**可持续运转的本地扫描系统**：真实采集（人工复核）、历史快照与真实排名变化、SQLite 派生库、自动报告、定时任务、个人实验台，并发布 GitHub 线上版。

| 模块 | v0.2.0 增量 |
|---|---|
| 数据 | 数据版本升 `0.2.0`（MINOR，向后兼容）；新增 `data/history/`、`data/reports/`、`data/source-health.json`；sources 63→67（新增可采集 RSS 源） |
| 扫描器 | `history.py`（快照/delta）、`db.py`（SQLite 派生库）、`fetch.py`（真实采集）、`report.py`（四窗口报告）；validate V01–V20；单测 28 条 |
| 采集 | `pipeline.py --fetch`：7/8 源成功、185 条原始信号（Reddit/iTunes/HN/App Store/arXiv/TechCrunch/ProductHunt），写 outbox 供人工复核，不自动入库 |
| 前端 | 新 `/lab` 实验台（localStorage）、报告导出、历史口径标签、Markdown 机会卡、1024 栅格修复、About 升 v0.2.0 + GitHub/Pages 链接 |
| 工程 | `scripts/install-daily-task.ps1`（Windows 定时任务）、`scripts/deploy-pages.ps1`（GitHub Pages 发布） |
| 发布 | `releases/v0.2.0/` 冻结 + git tag `v0.2.0` + 线上版（根=最新，历史版本归档 `/v0.1.0/`、`/v0.2.0/`） |

**明确不做（留给后续）**：LLM 富化（v0.2.x/v0.3）、个人画像持久化与推荐重排、多语言 UI、机会预警推送、社区/团队版。

---

## 2. 相对上一版的变更

### 2.1 数据与扫描器

1. **历史快照与真实 delta**：`pipeline --all` 写 `data/history/rankings-<as_of>.json`（同日覆盖、确定性）；`rankings.meta` 增加 `delta_basis` / `history_as_of` / `tie_breaker`；有上一份快照时按「上一快照同窗口名次 − 当前名次」计算，否则回退 v0.1.0 相邻窗口口径，前端明示口径。
2. **SQLite 派生库**：`scanner/db.py` 全量重建 `data/radar.db`（gitignore）：opportunities/evidence/rankings_history/source_health = 46/88/92/8 行；`--db-rebuild` 可重建。
3. **真实采集**：`scanner/fetch.py` + `pipeline.py --fetch`。8 个公开源中 7 成功（reddit 25、itunes 30、hnrss 20、app-store 30、arxiv 30、techcrunch 20、producthunt 30 = 185 条）；shopify-changelog 返回 HTML 非 feed，已如实记录失败。限速（每域 ≤1 req/s）、缓存（6h）、UA、超时、重试；产物 → `scanner/outbox/` + `data/source-health.json`，**永不自动进机会库**。
4. **报告导出**：`scanner/report.py --all` 生成 4 窗口 × HTML/MD = 8 个文件到 `data/reports/`；HTML 自包含、可打印、含七问摘要/证据链接/风险/免责。
5. **校验与测试**：validate 新增 V19（history 一致性）/V20（source-health 合法性），**20/20 PASS**；单测 28/28（含 history 两路径、db 重建、报告生成）。
6. **数据版本**：`data-v0.2.0`，taxonomy/rankings/stats/sources/playbooks/calendar 全部升级 meta；opportunities 内容未变（指纹不变）。

### 2.2 前端

1. `/lab` 实验台：localStorage 记录实验（机会/开始日/预算/状态/结论/花费/时长），统计 + 导出 JSON/Markdown，Dashboard 显示进行中提醒。
2. 详情页：实验状态卡（加入/更新/结案）、Markdown 机会卡导出、history/delta 口径提示。
3. 榜单页：delta 口径标签（「较上一快照」/「口径：相邻窗口」）、报告导出、1024 卡片栅格修复、「新上榜」文案修正。
4. About：版本 v0.2.0、版本历史、GitHub 仓库与线上链接；指挥台接入 source-health（若存在）。
5. 构建：version 0.2.0；strict sync 支持 history/source-health 可选文件，缺失不阻断构建；单文件 dist（`file://` 可双击）。

### 2.3 工程与发布

1. `scripts/install-daily-task.ps1`：每日 07:00 跑 `--all`（可选 `--fetch`），日志 `scanner/logs/scheduled.log`。
2. `scripts/deploy-pages.ps1`：按冻结版本组装 Pages 站点（根=最新、历史版本目录、`versions.json`），推送 `gh-pages` 并验证线上 URL。
3. `release.ps1` 修复：dist 复制目录创建、MANIFEST 在内容提交后回填 `git_commit` 并单独提交/tag；counts 整数化。
4. 线上：GitHub 公共仓库 + GitHub Pages（Pages 由 API 启用，legacy build from gh-pages）。

---

## 3. 架构与数据流（v0.2.0）

```
公开源 ──fetch.py（--fetch，限速/缓存/UA）──► scanner/outbox/signals-*.json（人工复核）
                                                   └──► data/source-health.json
data/opportunities.json ──pipeline.py --all──► score/rank ──► data/rankings.json
                                      │                     ├──► data/history/rankings-<date>.json
                                      │                     ├──► data/stats.json
                                      │                     ├──► data/radar.db（SQLite 派生）
                                      │                     └──► data/reports/report-<period>-<date>.{html,md}（report.py）
                                      ▼
                             validate.py V01–V20（失败阻断）
                                      ▼
                app/scripts/sync-data.mjs --strict ──► vite build（singlefile）
                                      ▼
                releases/vX.Y.Z/dist/index.html ──deploy-pages.ps1──► GitHub Pages
```

原则不变：JSON 是唯一事实源；DB/报告/线上站都是派生物；默认离线、显式联网；同日快照幂等。

---

## 4. 文件清单（本版新增/修改的关键文件）

| 路径 | 说明 |
|---|---|
| `scanner/history.py` | 历史快照读写、delta 计算（history / adjacent-window 两路径） |
| `scanner/db.py` | SQLite schema、全量重建、状态查询 |
| `scanner/fetch.py` | 真实采集：RSS/JSON 适配器、限速/缓存/健康度、outbox 输出 |
| `scanner/report.py` | 四窗口 HTML/MD 报告生成 |
| `scanner/pipeline.py` | 新增 `--fetch`、`--db-rebuild`、`--report` 入口；`--all` 串联 history/db/report |
| `scanner/rank.py` | meta 增加 delta_basis/history_as_of；delta 来自 history |
| `scanner/validate.py` | +V19（history 一致）、+V20（source-health） |
| `scanner/tests/test_scanner.py` | 28 条测试（+history/db/report/fetch 相关） |
| `data/history/rankings-2026-10-22.json` | 首份榜单快照（20448 B） |
| `data/reports/report-*-2026-10-22.{html,md}` | 四窗口报告 ×2 格式 |
| `data/source-health.json` | 采集源健康度（7/8 成功） |
| `app/src/pages/Lab.tsx` | 实验台（新页面） |
| `app/src/lib/experiments.ts` | 实验 localStorage 数据层 |
| `app/src/lib/report.ts` | 前端报告/Markdown 生成 |
| `scripts/install-daily-task.ps1` | Windows 定时任务安装/卸载 |
| `scripts/deploy-pages.ps1` | GitHub Pages 发布 |

---

## 5. 本地运行与构建命令

```powershell
cd E:\全球商机扫描器

# 数据流水线（离线、幂等；生成榜单/历史/DB/报告）
python scanner/pipeline.py --all
python scanner/validate.py                                  # 期望 20/20 PASS
python -m unittest discover -s scanner/tests -v              # 期望 28 tests OK

# 真实采集（显式联网；产物进 outbox 供人工复核）
python scanner/pipeline.py --fetch

# 报告（单独重新生成）
python scanner/report.py --all

# 前端
cd app; pnpm install; pnpm build                            # strict + 单文件

# 定时任务（可选）
powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1
powershell -ExecutionPolicy Bypass -File scripts/install-daily-task.ps1 -Fetch

# 发布新版本 + 上线
cd ..
powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Version v0.2.0
$env:GITHUB_TOKEN = "ghp_xxx"
powershell -ExecutionPolicy Bypass -File scripts/deploy-pages.ps1 -Version v0.2.0
```

---

## 6. 测试与验收结果

| 项目 | 命令 | 结果 |
|---|---|---|
| 数据流水线 | `python scanner/pipeline.py --all` | exit 0；幂等（JSON/history/db 前后 SHA256 一致）；20/20 校验 |
| 历史快照 | `data/history/rankings-2026-10-22.json` | 生成；`delta_basis=adjacent-window`（仅 1 份快照），history 路径由单测覆盖 |
| SQLite | `python scanner/pipeline.py --db-rebuild` | 46/88/92/8 行；重建前后一致 |
| 真实采集 | `python scanner/pipeline.py --fetch` | 7/8 源成功，185 条信号；1 源失败如实记录 |
| 报告 | `python scanner/report.py --all` | 8 个文件；HTML 自包含可打印 |
| 契约校验 | `python scanner/validate.py` | **20/20 PASS** |
| 扫描器单测 | `python -m unittest discover -s scanner/tests` | **28 tests OK** |
| 前端构建 | `cd app; pnpm build` | strict PASS（source=real、mock=[]）；单文件 dist |
| 页面 | `file://` 9 路由 | 无白屏/无 console error（含 `/lab`） |
| 线上 | `scripts/deploy-pages.ps1` | HTTP 200，与冻结版一致（详见 qa/report.md） |

> 完整证据：`qa/report.md`（v0.2.0 章节）、`releases/v0.2.0/MANIFEST.json`、`data/source-health.json`。

---

## 7. 已知问题与技术债

1. **历史 delta 尚未生效**：只有 2026-10-22 一份快照，真实 delta 需次日再跑 `--all`（或后续每日定时任务）后自动切换为 `history`；当前回退相邻窗口口径。
2. **公开 API 源有限**：Reddit 等依赖公开 JSON/受限接口，可能 403；openFDA 证书链问题未接线；电商/政策源多为 HTML 需人工或后续适配。
3. **采集不进库**：`--fetch` 结果需人工复核后手动写机会卡（有意设计，防自动幻觉/噪声入库）。
4. **报告 `generated_at`** 随生成时间变化，属派生视图，不影响数据指纹；归档时以文件内容为准。
5. **verified:true 仍 5 条**：其余 41 条为研究假设，使用前须复核原始来源。
6. **单文件体积**：约 2.0MB（含 ECharts 内联），离线可接受。
7. **个人画像/实验台**为 localStorage，不跨设备同步；多设备需手动导出/导入。

---

## 8. 升级/迁移说明

- 数据 `0.1.0 → 0.2.0` 为 MINOR：只新增 `history/`、`reports/`、`source-health.json` 与 `rankings.meta` 字段；v0.1.0 发布目录与数据快照**不受影响**，旧前端可继续读新 JSON（多余字段被忽略）。
- 升级步骤：`git pull` → `python scanner/pipeline.py --all` → `cd app; pnpm build` → 打开 `releases/v0.2.0/dist/index.html`；旧版本继续可打开。
- 回滚：直接打开 `releases/v0.1.0/dist/index.html`；线上回滚用 `/v0.1.0/` 归档或把 `gh-pages` 指回旧提交。
- 数据版本独立于应用版本；本轮应用 v0.2.0 ↔ data-v0.2.0。

---

## 9. 下一版计划（v0.3.0）

1. 个人画像持久化 + 推荐重排（能力/资源/语言/风险偏好向量）；
2. 实验数据回测：把 `/lab` 的结论回填评分日志，做 Brier/校准分析；
3. 机会预警（窗口关闭倒计时、扫描源异常、新机会命中画像）；
4. 多语言 UI（中/英）与 LLM 富化 outbox 流水线（翻译/归因/七问初稿，人工复核）；
5. v0.2.x 先补：同窗口第二份快照后的真实 delta 验证、失败源替代、报告模板微调。
