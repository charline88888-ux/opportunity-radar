# v0.3.0 变更明细（CHANGELOG）

> 日期：2026-10-22　｜　应用版本：0.3.0　｜　数据版本：data-v0.3.0　｜　上一版本：v0.2.0
> 类型：MINOR（新功能 + 数据契约 MINOR 向后兼容）

## 新增（Added）

### 前端（12 路由）

- `/profile` 个人画像：3 步向导 + 5 预设 + 7 维能力雷达 + localStorage 持久化/导出/清除。
- 推荐重排：`lib/recommend.ts`（7 维需求向量、4 类硬约束、fit 加权覆盖度、`rec_score=0.6×total+0.4×fit×100`、MMR λ=0.7、双解释）；排行榜「为你推荐」模式；Dashboard 画像摘要 + Top3。
- `/alerts` 预警中心：5 类规则（窗口关闭≤3 月 / 实验超期>7 天 / 采集源失败 / S/A 未核验 / 高匹配未行动）+ 严重度排序 + 已读/忽略 localStorage + Dashboard 未读数。
- `/calibration` 回测校准：实验 outcome 与评分 join，等级×结果、成功率、均分、花费/耗时、分桶、校准建议、JSON/MD 导出、<3 样本空态。
- `/lab` 实验台扩展：outcome（positive/negative/inconclusive）、结案日期、结论、花费/耗时；详情页实验状态。
- 数据口径展示：`delta_basis=history` →「较上一快照（2026-10-21）」、回放 →「历史回放」；source-health v2 的 mode/latency/cached/error 展示。
- About：v0.3.0、版本历史（v0.1→v0.2→v0.3）、新功能摘要。

### 数据与扫描器

- source-health v2：真实重跑 `--fetch --no-cache`，5/8 成功；新增 `mode/http_status/latency_ms/cached/items/error/checked_at` 与 `meta.mode`；失败源 error 必填。
- 历史回放：`--replay-as-of <date> --replay-days N` 生成确定性回放快照（`meta.reconstructed=true`、`replay_as_of`）；新增 `data/history/rankings-2026-10-20.json`、`rankings-2026-10-21.json`；保留 10-22 真实快照。
- 真实 delta：`rankings.meta.delta_basis="history"`、`history_as_of="2026-10-21"`；day 用上一日、week/month/year 同 key；week/month/year 分别 7/15/38 条有 delta；新增 null/new；回退口径保留。
- 确定性报告：`report.py` 的 `generated_at` 改为确定性（重跑字节一致）；4 窗口 × HTML/MD 重新生成。
- 数据版本升 `data-v0.3.0`；validate V19/V20 收紧；unittest 28→**36**。

### 文档

- docs/04 新增 §12「v0.3.0 个性化推荐与回测实现规格」（586 行，含复核向量 T-v03-01–24、5 个开放项）。
- docs/12 升级 data-v0.3.0（§1.2 source-health v2/回放/真实 delta、§5 delta 规则、§9 V19/V20）。
- docs/00/06/07/08/10、README、release-notes 同步 v0.3.0。

### 发布

- `releases/v0.3.0/` 冻结（dist + DEV/OPS/CHANGELOG/MANIFEST + docs 快照）；git tag `v0.3.0`。
- GitHub Pages：根 `/`=v0.3.0，`/v0.3.0/` 归档，保留 `/v0.1.0/`、`/v0.2.0/`；`versions.json` latest=v0.3.0。

## 修改（Changed）

- 数据：`data_version 0.2.0 → 0.3.0`（taxonomy/rankings/stats/sources/playbooks/calendar/source-health 同步）；`rankings.json` delta 由 adjacent-window 改为 history；`history` 3 份（2 回放 + 1 真实）。
- 扫描器：`--all` 串联回放/delta/history；新增 `--replay-as-of` / `--replay-days`；`--fetch` 记录 v2 健康度；报告 `generated_at` 确定化。
- 前端：版本 0.3.0；strict 自检 11/11；dist 单文件 2,138,535 B；路由 9→12。
- 发布脚本/流程沿用 v0.2（release.ps1 + deploy-pages.ps1）。

## 修复（Fixed）

- v0.2 红队 P2：source-health 失败源无 error、latency 全 0/缓存语义不清 → v2 修复（真实测量 + 缓存标注 + error 原因）。
- v0.2 红队 P2：docs/00 版本号/验收表历史标注 → 更新为 v0.3，v0.1 验收表标注历史。
- 采集超时/非 feed 源不再静默成功，全部进入 `/alerts` 源失败规则。

## 移除（Removed）

- 无。

## 数据版本变化

| 版本 | 变化 |
|---|---|
| v0.2.0 | 46 机会 / 67 源 / 3 快照？→ 实际 1 快照 / 8 报告 / source-health |
| v0.3.0 | 46 机会（未变）/ 67 源 / 3 快照（2 回放+1 真实）/ 8 报告 / source-health v2 / delta_basis=history |

## 已知限制（Known limitations）

- 回放快照（10-20/10-21）为确定性重建，仅用于 delta 对照/演示，不代表真实历史信号（UI 标注）。
- 采集仅 RSS/JSON feed；本轮 3 源真实失败（error 已记录），需换源。
- Brier 分数未实现（v0.3.1）；资金硬约束为分数差判定（O1）；告警 id 未含 data_version（O3）。
- `verified:true` 仍 5 条；41 条为研究假设，使用前须复核。
- 画像/实验/预警已读为 localStorage，不跨设备同步；单文件 dist 约 2.14MB。

## 升级与回滚

- 升级：`git pull` → `python scanner/pipeline.py --all` → `cd app; pnpm build` → 打开 `releases/v0.3.0/dist/index.html`；localStorage 数据自动可用。
- 回滚：打开 `releases/v0.2.0/dist/index.html`；线上用 `/v0.2.0/` 或回退 gh-pages。
- 旧版本目录只读，永不修改。
