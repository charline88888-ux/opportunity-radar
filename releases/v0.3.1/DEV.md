# v0.3.1 开发文档（DEV）

> 版本：v0.3.1（PATCH）　｜　数据版本：data-v0.3.1　｜　日期：2026-10-22　｜　上一版：v0.3.0
> 冻结目录：`releases/v0.3.1/`　｜　线上：https://charline88888-ux.github.io/opportunity-radar/

## 1. 本版目标

关闭 v0.3.0 红队遗留的 4 个开放项 + 修复 3 个真实采集失败源；不改数据契约、不新增页面。

## 2. 变更

### 数据（data-v0.3.1，PATCH）
- **采集修复 8/8 源成功**（`--fetch --no-cache` 实测，215 原始 → 211 信号）：
  - reddit：本机网络不可达（www/old/.json 40s 超时）→ `access="manual"` 保留矩阵与人工浏览说明；新增替代源 **lobsters**（https://lobste.rs/rss，25 条/833ms）。
  - itunes-reviews：US storefront 无 entry → 改 **GB storefront**，解析 `feed.entry`，30 条/243ms。
  - shopify-changelog：HTML 非 feed → 官方 **https://shopify.dev/changelog/feed.xml**，30 条/2102ms。
  - 采集参数：timeout 12→20s、UA `OpportunityRadar/0.3.1`；限速/缓存/重试/合规不变。
- sources 67→68；source-health v2 全绿（8/8 ok、真实 latency、error 为空）；全部 data meta 升 0.3.1；三份 history 快照与 8 份报告按 0.3.1 重生成。
- validate 20/20 PASS；unittest 36/36；`--all` 全链路幂等。

### 前端（v0.3.1）
- **Brier 分数**（docs/04 §12.9.5）：校准页新增 Brier = mean((p−o)²)，p=clamp(total/100)，inconclusive 排除；实测 0.2956 / N=6（pos3/neg3），基线 0.25；导出 JSON/MD 含 brier。
- **严格资金过滤**：画像开关（默认关），开启按 `roi.capital_cny.min > 资金档上限` 过滤（当前 5 条被过滤），显示过滤数与原因；关闭沿用分数差逻辑；持久化。
- **告警按数据版本重提醒**：id 改为 `type:target:data_version`（source 用 `checked_at`）；0.3.0 已读状态自动失效，显示「数据已更新（v0.3.1）」。
- **采集适配**：68 源（含 lobsters）、8/8 success；reddit manual 无健康记录不报错；`/sources` 按 id→url→name 回退匹配。
- 版本 0.3.1；strict 11/11 PASS；dist 单文件 2,147,394 B / SHA256 `7C2E13D5…3CB1F03`；连续两次构建同 hash（sync 时间戳改用数据 generated_at）。
- file:// 12 路由 console error=0；1024 无溢出；截图 25 张 `app/screenshots/final-v0.3.1/`。

## 3. 验收

| 项目 | 结果 |
|---|---|
| 采集 | 8/8 成功（lobsters 833ms/25、itunes 243ms/30、shopify 2102ms/30、hnrss 17222ms/20、app-store 1284ms/30、arxiv 1683ms/30、techcrunch 2618ms/20、producthunt 1051ms/30） |
| 数据 | validate 20/20 PASS；unittest 36/36；`--all` 字节幂等；opportunities 指纹未变 |
| 前端 | build strict PASS（real、mock=[]）；12 路由 file:// 无 console error；1024 无溢出 |
| 冻结 | 见 `releases/v0.3.1/MANIFEST.json`（红队核验） |
| 线上 | 根 `/` 与 `/v0.3.1/` = 冻结 dist；旧版归档不串台；versions.json latest=v0.3.1 |

## 4. 已知问题
- reddit 本机网络不可达（非代码问题），已降级人工浏览 + Lobsters 替代；Apple customerreviews 仅部分 storefront 有数据（GB 可用，JP 备选）。
- Brier 样本仅 N=6，统计意义有限；样本 ≥10 后再评估。
- 其余 v0.3.0 已知项不变（verified 5 条、localStorage 不跨设备、单文件约 2.1MB）。

## 5. 下一版（v0.4.0）
中英双语 UI、LLM 富化 outbox（离线模板 + 可选 API）、年度校准报告、机会预警推送。