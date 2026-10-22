# v0.3.0 开发文档（DEV）

> 版本：v0.3.0　｜　数据版本：data-v0.3.0　｜　数据基准日：2026-10-22　｜　发布日期：2026-10-22
> 对应冻结目录：`releases/v0.3.0/`；线上版：https://charline88888-ux.github.io/opportunity-radar/
> 上一版本：`releases/v0.2.0/`（保持不变，可随时打开）

---

## 1. 本版目标与范围

v0.2.0 解决了「数据管道」；v0.3.0 解决「跟我有什么关系、什么时候该行动、我的评分准不准」：

| 模块 | v0.3.0 增量 |
|---|---|
| 个性化 | 个人画像 `/profile`（7 维能力向量，localStorage）+ 排行榜「为你推荐」重排（fit/rec_score/MMR/解释） |
| 行动闭环 | 实验台扩展 outcome（positive/negative/inconclusive）+ 回测校准 `/calibration` |
| 预警 | 预警中心 `/alerts`：窗口关闭、实验超期、采集源失败、S/A 未核验、高匹配未行动；已读/忽略 |
| 数据 | source-health v2（真实 latency/error/mode/cached/http_status）；历史回放快照（10-20/10-21）；真实 history delta 生效（history_as_of=2026-10-21） |
| 文档 | docs/04 新增 §12 个性化/预警/回测实现规格（586 行）；docs/12 契约 data-v0.3.0；docs/00/06/07/08/10/README 更新 |
| 发布 | `releases/v0.3.0/` + git tag + GitHub Pages（根=最新，历史归档） |

**明确不做（留给 v0.4.0）**：中英双语 UI、LLM 富化 outbox、Brier 分数实现（v0.3.1）、机会推送（本地通知/邮件）、年度校准报告出版级模板。

---

## 2. 相对上一版的变更

### 2.1 数据与扫描器

1. **source-health v2**：`--fetch --no-cache` 真实刷新；8 源 5 成功 / 3 失败（reddit 超时、itunes-reviews 与 shopify-changelog 返回非 feed），成功源真实 latency 874–9218ms、共 129 条信号；失败源 `error` 必填原因。字段：`mode/http_status/latency_ms/cached/items/error/checked_at` + `meta.mode`。
2. **历史回放快照**：新增 `--replay-as-of <date> --replay-days N`，生成确定性回放（只按当日窗口规则重排现有机会，不新增/修改机会库），`meta.reconstructed=true`、`meta.replay_as_of`；已生成 `rankings-2026-10-20.json`、`rankings-2026-10-21.json`，保留 10-22 真实快照（reconstructed=false）。
3. **真实 delta 生效**：`rankings.meta.delta_basis="history"`、`history_as_of="2026-10-21"`；day 用上一日、week/month/year 用同 key；两期都出现才计算，新增 null/new；week/month/year 分别 7/15/38 条有 delta；回退口径保留。
4. **校验/测试/版本**：V19（快照结构/snapshot_at 对齐/回放必须有 replay_as_of/最新快照=当日真实且与 rankings 一致）、V20（mode 枚举、cached→mode=cache 且 latency=0、http_status、ok=false 必须有 error、meta.mode）；validate **20/20 PASS**；unittest **36/36**；全链路字节级幂等；data_version 升 0.3.0；报告改为确定性 `generated_at`。
5. **数据库/报告**：radar.db 重建 46/88/211/8 行；四窗口报告 8 文件重生成且可重复。

### 2.2 前端（12 路由）

1. `/profile`：3 步画像（资金/时间/技能/英语/风险/全职）+ 5 个预设 + 雷达图 + 本地持久化 + 导出 JSON。
2. `/rankings?mode=recommend`：需求向量 + 4 类硬约束（资金/资质/供应链/英语）+ fit（加权覆盖度）+ `rec_score=0.6×total+0.4×fit×100` + MMR 多样性（λ=0.7）+ 双解释；未设置画像回退综合榜。
3. `/alerts`：5 条规则、严重度/排序/去重、已读/忽略 localStorage、跳转机会/实验/数据源；Dashboard 显示未读数。
4. `/calibration`：实验 outcome 统计、预测等级→成功率分桶、成功/失败均分、花费/耗时、校准建议、JSON/MD 导出；<3 样本空态。
5. `/lab`：新增 outcome/结案字段；Dashboard 画像摘要 + 推荐 Top3 + 预警数；About v0.3.0 + 版本历史。
6. 数据口径：`delta_basis=history` 显示「较上一快照（2026-10-21）」，回放快照显示「历史回放」；source-health v2 显示真实 mode/latency/cached/error。
7. 构建：v0.3.0；strict 11/11 PASS（real、mock=[]）；单文件 dist 2,138,535 B；file:// 12 路由无白屏/无 console error。

### 2.3 文档

- docs/04 新增 §12（7 维画像、需求向量、硬约束、fit、rec_score、MMR、预警阈值、校准指标、Brier 扩展、T-v03-01–24 复核向量、5 个开放项）。
- docs/12 契约升级 data-v0.3.0（source-health v2、回放快照、真实 delta、V19/V20 收紧）。
- docs/06/07/08/10/00/README 同步 v0.3.0 产品、架构、运营、发布与版本记录。

---

## 3. 架构与数据流（v0.3.0）

```
画像(localStorage) ──► recommend.ts(fit/rec_score/MMR) ──► Rankings「为你推荐」/Dashboard Top3
                                                              │
实验(localStorage, outcome) ──► calibration.ts ──► /calibration 校准建议
                                                              │
机会/窗口/source-health ──► alerts.ts(5 规则) ──► /alerts + Dashboard 未读数

data/history/rankings-<date>.json（10-20/10-21 回放 + 10-22 真实）
        └──► rank.py delta（上期名次−本期名次）──► rankings.json(delta_basis=history)
data/source-health.json(v2) ──► /sources、Dashboard、/alerts
```

前端仍全部本地：画像/实验/预警已读均在 localStorage；无网络请求、无后端。

---

## 4. 文件清单（本版新增/修改的关键文件）

| 路径 | 说明 |
|---|---|
| `app/src/pages/Profile.tsx`、`Alerts.tsx`、`Calibration.tsx` | 三个新页面 |
| `app/src/lib/profile.ts`、`recommend.ts`、`alerts.ts`、`calibration.ts`、`experiments.ts` | 画像/推荐/预警/校准/实验数据层 |
| `app/src/pages/Rankings.tsx` / `Dashboard.tsx` / `About.tsx` / `App.tsx` / `AppShell.tsx` | 推荐模式、预警数、版本、路由 |
| `scanner/history.py` / `rank.py` / `pipeline.py` | 回放快照、真实 delta、`--replay-*` 命令 |
| `scanner/fetch.py` | source-health v2（真实 latency/error/mode/cached） |
| `scanner/validate.py` / `tests/test_scanner.py` | V19/V20 收紧、36 条测试 |
| `data/history/rankings-2026-10-20.json`、`-10-21.json`、`-10-22.json` | 回放 ×2 + 真实 ×1 |
| `data/source-health.json` | v2 健康度 |
| `docs/04`（§12）、`docs/12`（v0.3.0） | 规格与契约 |

---

## 5. 本地运行与构建命令

```powershell
cd E:\全球商机扫描器

# 数据（离线、幂等）
python scanner/pipeline.py --all
python scanner/validate.py                              # 20/20 PASS
python -m unittest discover -s scanner/tests -v          # 36 tests OK

# 刷新采集健康度（显式联网）
python scanner/pipeline.py --fetch --no-cache

# 历史回放（演示/对照）
python scanner/pipeline.py --replay-as-of 2026-10-22 --replay-days 2
python scanner/report.py --all

# 前端
cd app; pnpm install; pnpm build

# 发布 + 上线
cd ..
powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Version v0.3.0
$env:GITHUB_TOKEN = "ghp_xxx"
powershell -ExecutionPolicy Bypass -File scripts/deploy-pages.ps1 -Version v0.3.0
```

---

## 6. 测试与验收结果

| 项目 | 命令 | 结果 |
|---|---|---|
| 数据流水线 | `pipeline --all` | exit 0；全链路字节级幂等（含 history/reports/rankings/db） |
| 历史与 delta | 3 份快照 + 独立复算 | delta_basis=history；week/month/year 7/15/38 条 delta，新增 null/new；回放幂等 |
| 采集健康度 | `--fetch --no-cache` | 5/8 成功；失败源 error 非空；真实 latency |
| 契约校验 | `validate.py` | **20/20 PASS**（V01–V20） |
| 单测 | `unittest` | **36/36 OK** |
| 前端构建 | `pnpm build` | strict 11/11 PASS；单文件 dist 2,138,535 B / SHA256 18DCE4B8…8374 |
| 前端验收 | file:// 12 路由 + CDP | console error=0；1024 无溢出；画像/推荐/预警/校准/实验全流程 |
| 冻结 | MANIFEST | 见 `releases/v0.3.0/MANIFEST.json`（红队核验） |
| 线上 | GitHub Pages | 根 `/` = 冻结 dist；`/v0.3.0/` 归档；`versions.json` latest=v0.3.0 |

> 完整证据：`qa/report.md`（v0.3.0 章节）、`releases/v0.3.0/MANIFEST.json`。

---

## 7. 已知问题与技术债

1. **回放口径**：10-20/10-21 快照为确定性回放（reconstructed=true），只用于 delta 对照与演示，不代表真实历史信号；UI 已标注。后续真实每日快照积累后可停用回放。
2. **采集覆盖**：仅 RSS/JSON feed 类源；Reddit/itunes/shopify 本轮真实失败（已记录 error），需换源或补认证方式。
3. **Brier 分数未实现**（docs/04 §12.9.5，计划 v0.3.1）；资金硬约束用「分数差≥2」而非严格 CNY 判定（O1）；告警 id 未含 data_version，数据升级后可能重复提醒（O3）。
4. **verified:true 仍 5 条**；41 条为研究假设，使用前复核。
5. **画像/实验/预警已读**仅 localStorage，不跨设备；换设备需导出/导入。
6. **单文件体积**约 2.14MB（ECharts 内联）；离线可接受。

---

## 8. 升级/迁移说明

- 数据 `0.2.0 → 0.3.0` 为 MINOR：新增 history 回放快照与 source-health v2 字段；旧 JSON 字段不改名。v0.1.0/v0.2.0 发布目录不受影响。
- 升级步骤：`git pull` → `python scanner/pipeline.py --all` → `cd app; pnpm build` → 打开 `releases/v0.3.0/dist/index.html`。
- 回滚：直接打开 `releases/v0.2.0/dist/index.html`；线上用 `/v0.2.0/` 或回退 gh-pages。
- localStorage 数据（画像/实验/预警）与版本无关，升级后自动可用；如实验 schema 变化，前端做兼容迁移。

---

## 9. 下一版计划（v0.4.0）

1. 中英双语 UI（i18n，含 docs 摘要英译）；
2. LLM 富化 outbox：翻译/归因/七问初稿 → 人工复核（不自动入库）；
3. v0.3.1 补：Brier 分数、O1 严格资金判定、O3 告警去重、source 替代源；
4. 年度校准报告 + 机会预警推送（本地通知/邮件可选）；
5. 评分权重年度校准流程落地（docs/04 §11）。
