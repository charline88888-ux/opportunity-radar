# v0.1.0 开发文档（DEV）

> 版本：v0.1.0　｜　数据版本：data-v0.1.0　｜　数据基准日：2026-10-22　｜　发布日期：2026-10-22
> 对应冻结目录：`releases/v0.1.0/`；源码：`app/`（前端）、`scanner/`（扫描器）、`data/`（数据）、`docs/`（文档）

---

## 1. 本版目标与范围

目标：把「全球商机扫描」做成一个**可以每天用的本地闭环**——能发现（机会库 + 榜单）、能判断（七问 + 10 维评分）、能执行（7 天验证动作 + 证伪条件）、能迭代（版本冻结 + 数据版本独立）。

本版包含：

| 模块 | 范围 |
|---|---|
| 前端应用 | 8 个页面、18 类图表、深色数据终端风格、离线单文件可双击打开 |
| 数据层 | 46 条机会、11 组分类学枚举、63 个数据源、12 个扫描剧本、33 个商业日历节点、4 窗口榜单、聚合统计 |
| 扫描器 | Python 3.11 标准库流水线：adapters(4) → normalize → dedupe → materialize → score → rank → stats → validate（V01–V18）+ 19 条单元测试 |
| 文档 | 13 份主文档（00–12：总览/战略/方法论/评分/七问/产品/技术/运营/风险/版本/补充/契约） |
| 研究 | 40 个真实案例、62 条平台可访问性验证、16 国文化笔记 |
| 质量 | 红队早期审查 + 最终验收报告 + 8 路由截图 |
| 发布 | `releases/v0.1.0/`（dist + DEV/OPS/MANIFEST + docs 快照）、git tag `v0.1.0` |

**明确不做（留给 v0.2）**：真实网络采集（本版适配器只跑离线 fixtures）、SQLite、定时任务、LLM 富化、个人画像持久化、自动报告导出。

---

## 2. 相对上一版的变更

v0.1.0 是首个版本，无上一版。所有内容均为新增（详见 `CHANGELOG.md`）。

---

## 3. 架构与数据流

```
data/opportunities.json ──┐
data/taxonomy.json ───────┤
scanner/fixtures/*.json ──┴─► normalize ─► dedupe ─► materialize（派生字段/评分/窗口）
                                                   │
                                                   ├─► data/rankings.json（四窗口权威榜单）
                                                   ├─► data/stats.json（聚合统计）
                                                   └─► validate.py（V01–V18，失败阻断发布）
app/scripts/sync-data.mjs --strict ──► app/src/data/*.json ──► vite build（singlefile 内联）
                                                                 │
                                                                 ▼
                                             releases/v0.1.0/dist/index.html（双击可开）
```

关键设计：

1. **单一数据源**：榜单/统计只由扫描器生成，前端不重算窗口归属。
2. **构建期打包**：数据在 `vite build` 前同步并校验，产物内联为单个 HTML（无 fetch、无 CDN、无模块 CORS 问题）。
3. **确定性**：`pipeline.py --all` 幂等（同输入三次运行输出哈希一致）；评分用 Decimal ROUND_HALF_UP。
4. **契约先行**：所有字段/枚举/公式/校验规则以 `docs/12` 为准，validate 18 条规则可执行。
5. **版本隔离**：`releases/vX.Y.Z/` 冻结只读；数据版本独立于应用版本。

---

## 4. 文件清单（关键文件）

| 路径 | 说明 |
|---|---|
| `app/src/pages/*.tsx` | 8 个页面：Dashboard / Rankings / OpportunityDetail / Scanner / Method / Sources / Calendar / About |
| `app/src/components/` | AppShell、OpportunityCard、PageHeader、ErrorBoundary、ui.tsx（shadcn 风格）、charts/（ECharts 封装 + 深色主题） |
| `app/src/lib/data.ts`、`utils.ts`、`types.ts` | 数据访问、格式化、契约类型 |
| `app/scripts/sync-data.mjs` | 数据同步 + 契约自检（strict 模式禁止 mock） |
| `app/vite.config.ts` | base `'./'`、Tailwind v4、`vite-plugin-singlefile` |
| `scanner/pipeline.py` | CLI：`--all` / `--rank` / `--validate` / `--ingest` |
| `scanner/core`（normalize/dedupe/materialize/score/rank/stats） | 流水线模块 |
| `scanner/validate.py` | V01–V18 契约校验 |
| `scanner/tests/test_scanner.py` | 19 条单元测试（公式/舍入/等级边界/ISO 周/榜单/tie-breaker/异常路径） |
| `scanner/adapters/` + `fixtures/` | RSS / Reddit / Google Trends / 电商评论（离线样本） |
| `data/*.json` | taxonomy / opportunities / rankings / stats / sources / playbooks / calendar |
| `docs/00–12` | 13 份主文档 |
| `research/*.md` | 案例、平台验证、文化笔记、交接底稿 |
| `qa/*` | 早期审查、最终报告、截图 |
| `scripts/release.ps1` | 发布脚本（校验 → 构建 → 冻结 → MANIFEST → git tag） |

---

## 5. 本地运行与构建命令

```powershell
cd E:\全球商机扫描器

# 1) 扫描器（Python 3.11+，无需安装依赖）
python scanner/pipeline.py --all
python scanner/validate.py
python -m unittest discover -s scanner/tests -v

# 2) 前端开发
cd app
pnpm install
pnpm dev              # http://localhost:5173
pnpm build            # strict 同步 + tsc + vite build（单文件产物）
pnpm build:demo       # 允许 mock 的开发演示构建

# 3) 打开发布版（无需服务器）
releases/v0.1.0/dist/index.html

# 4) 重新发布新版本
cd ..
powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Version v0.2.0
```

---

## 6. 测试与验收结果（v0.1.0）

| 项目 | 命令 | 结果 |
|---|---|---|
| 数据流水线 | `python scanner/pipeline.py --all` | exit 0；46 条机会；day 8 / week 15 / month 23 / year 46；输出幂等 |
| 数据校验 | `python scanner/validate.py` | **18/18 PASS**（V01–V18） |
| 扫描器单测 | `python -m unittest discover -s scanner/tests` | **19 tests OK** |
| 前端类型 | `tsc --noEmit`（build 内） | 0 error |
| 前端构建 | `pnpm build` | 成功；`dist/index.html` 1.98 MB 单文件；契约自检 PASS；真实数据（非 mock） |
| 离线打开 | Chrome headless `file:///.../dist/index.html#/` | 正常渲染（非白屏），日榜/榜单页截图验证 |
| 页面覆盖 | 8 路由截图 | 见 `qa/screenshots/` |
| 红队验收 | 见 `qa/report.md` | 见报告结论 |
| 版本冻结 | `releases/v0.1.0/MANIFEST.json` | 文件 sha256、git commit、校验结果齐全 |

> 完整证据以 `qa/report.md`、`releases/v0.1.0/MANIFEST.json` 为准。

---

## 7. 已知问题与技术债

1. **采集未联网**：4 个适配器默认只读离线 fixtures；接真实源需替换 `fetch()` 并按 `sources.json` 合规等级限速。
2. **证据核验率**：46 条中仅 5 条 `verified:true`；其余为公开检索/官方页来源，**使用前必须打开原链接复核**。
3. **无历史快照**：v0.1.0 的 `delta` 采用「相对相邻更大窗口」口径（year 为 null/new）；真实排名变化需 v0.2 的 `rankings_history`。
4. **评分分布集中**：64.8–78.6，无 S 级；属正常（新库 + 严格 evidence 分），需用真实执行结果回测校准。
5. **宗教节日为预计值**：`calendar.json` 中部分宗教日期为估算，正式采购/营销前需按当地公告复核。
6. **个人画像/实验看板**为 localStorage 轻量版，不跨设备同步。
7. **Hofstede 文化维度**为内置静态数据，非实时更新。
8. **单文件体积**：1.98 MB（含 ECharts），本地打开无感，但后续图表增多需按需加载优化。

---

## 8. 升级/迁移说明

- 本版为首版，无迁移。
- 升级 v0.2 时：数据契约若变更必须升 `data_version`；前端 build 前 `sync-data.mjs --strict` 会强制校验；旧版 `releases/v0.1.0/` 保持不变，可直接回滚打开。
- 根目录 `VERSION` 与 `data/taxonomy.json.meta.data_version` 分别记录应用/数据版本。
- 发布前必须通过 `docs/10` 的 12 步 Gate。

---

## 9. 下一版计划（v0.2.0）

真实采集（RSS/Reddit/电商/政策）+ SQLite + 增量水位线 + Windows 定时任务 + 日报/周报自动导出 + 源健康度监控 + LLM 富化（outbox 人工复核）+ 榜单历史快照与真实 delta。

---

## 10. 本版贡献者与协作方式

1 名 Lead + 6 名执行智能体（战略 / 方法论 / 数据工程 / 前端 / 研究 / 红队），任务板认领、写域隔离（docs/data/scanner/app/research/qa/releases 各自独立）、依赖管理（红队验收依赖全部交付完成）、Lead 负责集成与发布。全程无 git 冲突，旧版本零污染。
