# data/ 数据底座使用说明（data-v1.2.0）

> 唯一接口标准：`docs/12-数据契约与字段字典.md`（data-v1.2.0）。本目录所有 JSON 必须通过 `python scanner/validate.py`（V01–V20，退出码 0）。
> 数据基准日 `as_of = 2026-10-22`（Asia/Shanghai），当前周 `2026-W43`（10-19～10-25），当前月 `2026-10`，当前年 `2026`；支持 `--as-of YYYY-MM-DD` 覆盖做真实每日运行。
> **v1.2.0 MINOR（商机评估深化）**：每条候选新增 `business_canvas`（9 块）/`judgment`（10 维 score+rationale+data_used、why_opportunity、not_opportunity_if）/`competition`/`cross_market`/`timing`/`conditions`/`barriers`/`profit_model`/`execution_plan`/`sources`；按 14 行业知识包 + 12 信息差 + 11 区域规则生成，引用信号标题实体/数字，同行业不同信号有差异；全部自动确定生成，无验证/实验/复核/门禁字样。
>
> **v1.0.1 PATCH（候选文案清洗）**：候选 seven_questions 去掉验证/实验/复核/门禁字样（`验证` 键→`跟踪`；成本问句→最小启动成本；one_liner/system_validation.notes 同步清洗）；重生成 candidates/candidate-rankings；数据 1.0.1。
>
> **v1.0.0 MAJOR（核心回归）**：只保留“每日扫描 → 系统评估商机 → 自动候选/精选入榜”；删除校准/年鉴/实验/画像/预警/数据包/控制台等非核心功能与产物，候选去掉 verification_status/实体验证字段，`data/reports` 仅保留四窗口报告；翻译（title_zh/one_liner_zh/summary_zh）保留；同时修复翻译质量冷缓存 determinism（quality 只由文本/语言/残留比例决定，清缓存冷跑两次字节一致）。
>
> **v0.9.3 MINOR（系统级翻译子系统）**：新增 `scanner/translate.py`（provider=glossary 离线词典 **898 条** / llm OpenAI 兼容需 key、失败回退 / mock / source-zh；SQLite 缓存 `scanner/build/translation-cache.sqlite`）；候选逐条自动翻译 `title_zh/one_liner_zh/summary_zh/title_original/translation{provider,quality,cached,source_lang,target_lang}`；meta `translation_summary` 实测 provider glossary 194 / source-zh 6、**cached 200、中文覆盖 1.0、quality medium 120 / low 74 / source-zh 6**；翻译质量不参与收录/排序。
>
> **v0.9.2 MINOR（商机系统评估 + 中文候选 + 漏斗修复）**：候选新增 `system_validation{level/score/checks≥5}`+`verified_by_system=true`（系统评估「是不是商机」，无需人工/实验）；`verification_status` 语义改为个人实体验证，默认 `not_started`、不参与排序；候选新增 `title_zh/one_liner_zh/title_original/translation_method`（实测中文覆盖 **200/200**）；漏斗以 source-health 真值：**101 尝试 / 101 ok / 0 failed**（raw 2420 → 1892 → new 1865 → business 344 → 候选 200）；rest-of-world XML 容错恢复、Arab News→Middle East Monitor、补 8 源到 **168 平台 / 101 enabled**。
>
> **v0.9.1 MINOR（源 160 / 91 + 候选质量）**：`sources.json` 并 researcher 25 个实测 RSS + restofworld 修复 + Google News TR/3 query + App Store 6 国 → **160 平台 / 91 enabled 自动源 / 11/11 区域**（10 个禁用含原因）；真实 `--fetch --no-cache`：92 源尝试、**91 成功**、2177 原始 → 1653 信号、**new 1627**（账本重置干净首跑）；候选质量：标题/摘要清洗、gap 启发式覆盖 **200/200（fallback 28，空率 0%）**、region **11/11**、country 28、同 URL 保留最新、上限可配。
>
> **v0.9.0 MINOR（自动发现流）**：新增 `scanner/candidates.py`——从 outbox business 信号自动生成 **200 条候选机会卡**与四窗口**发现榜**（`data/candidates.json` / `data/candidate-rankings.json`，day 99 / week 200 / month 200 / year 200），与精选人工榜（`rankings.json`，80 条）并行；`verification_status="unverified"` 仅展示、**不影响候选收录/排序**；stats 增加 `candidates_total/today_new_candidates/unverified_candidates`。
>
> **v0.8.0 MINOR（采集增强）**：`sources.json` 升级为**可执行源注册表**（125 平台 / **57 个 enabled 自动源**，覆盖 11 区域）；新增**持久信号账本**（`scanner/build/signal-ledger.sqlite`，跨批去重，outbox 每条 `is_new`）与**相关性初筛**（`relevance_score/tier/reasons`）；机会库内容不变（仍 80 条人工库）。
> **v0.6.1 PATCH**：`pipeline.py --as-of`（窗口/快照/统计/报告/年鉴日期全部按该日）+ V08 配额只在基准日强制（其他 as_of 允许空榜）+ report/yearbook 日期跟随 rankings.meta.as_of；机会库/榜单口径不变。
> **v0.6.0 基线**：机会库 46 → **80 条**（14 行业各 ≥2、11 区域全覆盖、12 信息差全覆盖、目标国家/地区 53、中国角度 42、`verified:true` 32）；榜单配额 day ≥10 / week ≥20 / month ≥30 / year ≥80。

## 0. 每日运行语义（v0.6.1）

- 每天运行：`python scanner/pipeline.py --all --as-of <今天>`（默认仍是基准日 `2026-10-22`）。
- `day` 窗口 = `last_activity == as_of`；若当天没有新机会/新证据，**日榜为空（day=0）是正确结果，不是故障**；week/month/year 按 ISO 周/自然月/自然年计算。
- 全量配额（day≥10/week≥20/month≥30/year≥80）只在基准发布日 `as_of == 2026-10-22` 强制；其他日期只校验结构（rank 连续、排序、opp_id 合法），允许空榜。
- 报告/年鉴日期跟随 `rankings.meta.as_of`：`report.py --all [--as-of D]`、`yearbook.py --year Y`（自动取数据 as_of）。
- 同输入重复运行字节级确定性；测试不同 as_of 后请用 `--all` 恢复基准日状态（勿保留非基准日快照进仓库）。


## 1. 文件清单与规模（data-v0.9.3）

| 文件 | 作用 | 规模 | 生产者 | 消费者 |
|---|---|---|---|---|
| `taxonomy.json` | 14 行业 / 12 人性需求 / 6 神经递质 / 24 情绪 / 12 信息差 / 7 驱动 / 12 商业模式 / 11 区域 / 10 评分维度 / 20 标签 / 5 等级 | 11 组固定枚举 | 数据工程 | 全队 |
| `opportunities.json` | 机会库 | **80 条**（14 行业各 ≥2、11 区域、12 信息差、53 国家/地区、42 条中国角度、32 条 verified:true） | 数据工程 | 前端、扫描器 |
| `rankings.json` | 唯一权威榜单；`meta.delta_basis="history"`、`meta.history_as_of="2026-10-21"`、`windows[].delta_basis` | day 17 / week 49 / month 57 / year 80（配额 day≥10/week≥20/month≥30/year≥80） | 扫描器 `--all` | 前端 |
| `stats.json` | 首屏 KPI 与图表聚合 | KPI（含候选计数）+ 4 组分布 + 直方图 + 14 天趋势 | 扫描器 | 前端 |
| `candidates.json` | **自动发现候选机会卡**（v0.9.0，非人工库） | **200 条**：清洗标题/摘要、gap 启发式兜底（覆盖 200/200）、七问草稿、ROI 估算、10 维评分/confidence、`verification_status=unverified` | `scanner/candidates.py` / `pipeline.py --candidates` | 前端发现榜、扫描器 |
| `candidate-rankings.json` | **候选发现榜**（v0.9.0，与 `rankings.json` 并行） | day 21 / week 124 / month 168 / year 199；按 first_seen 归窗，排序同 rank 规则 | `scanner/candidates.py` | 前端 `/discover` |
| `history/rankings-2026-10-20.json` | **历史回放**（`reconstructed=true`、`replay_as_of=2026-10-20`） | day 13 / week 23 / month 31 / year 54 | `--replay-*` | 扫描器、前端 |
| `history/rankings-2026-10-21.json` | **历史回放**（`reconstructed=true`、`replay_as_of=2026-10-21`，basis=history） | day 9 / week 32 / month 40 / year 63 | `--replay-*` | 扫描器、前端 |
| `history/rankings-2026-10-22.json` | **真实每日快照**（`reconstructed=false`，与 rankings 一致） | day 17 / week 49 / month 57 / year 80 | `--all` | 扫描器、前端 |
| `source-health.json` | 在线采集源健康度 **v2**（`mode`/`http_status`/`latency_ms`/`cached`/`items`/`error`/`checked_at`，`meta.mode`） | **101 个源（101 成功 / 0 失败；2026-10-23 v0.9.2 实测，2420 items）** | `--fetch` | 前端、运营 |
| `reports/report-<period>-2026-10-23.{html,md}` | 四窗口自包含 HTML + Markdown 报告（确定性生成，可打印/分发） | 4 窗口 × 2 格式 | `report.py --all` | 用户、归档 |
| `reports/calibration-2026-10-22.{html,md}` | 实验校准报告（v0.4.0；Brier/等级×成功率/花费耗时/建议，样例数据标注 sample） | 1 份 HTML + 1 份 MD | `calibrate.py` | 用户、归档 |
| `reports/yearbook-2026.{html,md}` | **年度年鉴**（v0.5.0；v0.6.0 增加月度等级分布/信息差热度/窗口衰减/实验漏斗） | 1 份 HTML + 1 份 MD | `yearbook.py` | 用户、归档 |
| `sources.json` | **可执行源注册表** 12 大类（v0.8.0：`enabled/priority/kind/limits/enabled` 字段） | **168 个平台 / 101 个 enabled 自动源**（v0.9.2：rest-of-world XML 容错恢复、Arab News→Middle East Monitor、补 8 个 NEWS/科技源；8 个实测不可用源 enabled=false） | 数据工程 | 前端、`--fetch` |
| `playbooks.json` | 扫描剧本 | **12 个** | 数据工程 | 前端、运营 |
| `calendar.json` | 全球商业日历 2026-11～2028 | **33 个节点** | 数据工程 | 前端、方法论 |
| `radar.db`（gitignore） | SQLite 派生库（opportunities/evidence/rankings_history/source_health） | 80 / 156 / 654 / 101 行 | 扫描器 `--all`（`--db-rebuild` 可重建） | 扫描器 |

## 2. 派生字段口径（扫描器统一计算，手工不要硬写）

| 字段 | 口径 |
|---|---|
| `scores.total` | `round_half_up(Σ(dimension_i × weight_i) × 10, 1)`（Decimal，非银行家舍入） |
| `scores.grade` | 用四舍五入后的 total 判定：S ≥ 85 / A ≥ 75 / B ≥ 65 / C ≥ 55 / D < 55 |
| `rank_score` | `round_half_up(min(100, total × (1 + 0.12 × (momentum − 1))), 1)` |
| `momentum` | 最近 30 天证据变化倍数，clip `[0.5, 2.5]`，保留 1 位小数 |
| `evidence_count` | 恒等于 `signal.evidence.length` |
| `last_activity` | 恒等于 `max(activity_dates)`；`activity_dates` 升序且不晚于 `as_of` |

`--all` 会重算并回写不一致的派生字段，**幂等**：连跑两次 `opportunities.json / rankings.json / history/*.json / stats.json / radar.db / reports/*` 的 SHA256 全部一致（已验证）。

## 3. 榜单窗口与真实 delta 口径（docs/12 §5.1，v0.3.0）

- 窗口归属：`day` = `last_activity == 2026-10-22`；`week` = ISO 周 `2026-W43`；`month` = `2026-10`；`year` = `2026`。
- 排序链：`rank_score` 降序 → `momentum` 降序 → `evidence_count` 降序 → `last_activity` 降序 → `opp_id` 升序。
- **真实 delta（history 口径，当前生效）**：有上一份快照（含历史回放）时，`delta = 上期名次 − 本期名次`（正=上升）；窗口对比规则：**day 用上一日快照的 day 窗口；week/month/year 用相同 key 的上期快照**；仅两期都出现的机会有 delta，新增为 `delta:null, change:"new"`。当前 `rankings.meta`: `delta_basis="history"`、`history_as_of="2026-10-21"`；8 条 10-22 新机会为 new，week/month/year 分别 7/15/38 条有 delta。
- **回退口径**：上一快照缺失或该窗口上期为空 → 回退 v0.1.0 `adjacent-window`（day←week、week←month、month←year，year 无参照），整文件 `meta.delta_basis="adjacent-window"`；回放 2026-10-20 即为该口径示例。
- 完全无参照：`delta:null, change:"new"`。配额：day ≥ 6、week ≥ 12、month ≥ 20、year ≥ 40（当前 8/15/23/46）。

## 4. 历史回放快照（v0.3.0，`data/history/`）

- 真实每日快照：`--all` 按 `as_of` 写一份，`meta.reconstructed=false`，与同日 `rankings.json` 的窗口 items 顺序/分数一致（V19 强制）。
- **历史回放**：`python scanner/pipeline.py --replay-as-of 2026-10-22 --replay-days 2` 生成基准日之前 N 天（=2026-10-20、2026-10-21）的确定性快照：
  - `meta.reconstructed=true`、`meta.replay_as_of=<date>`、`meta.snapshot_at=<date>T00:00:00+08:00`；
  - 只纳入 `last_activity ≤ 回放日` 的机会（不引入未来信号），不新增/修改机会库、不改变评分与排序规则；
  - 按日期顺序链式生成：10-20 无上期 → adjacent-window；10-21 以 10-20 为上一期 → history；
  - 回放后自动重算当前榜单 → 10-22 以 10-21 为上一期 → `delta_basis="history"`、`history_as_of="2026-10-21"`。
  - 同日重复执行字节一致（幂等，已验证）。
- 回放仅用于补足 delta 演示与历史对照，**UI 必须用 `reconstructed` 区分**并明示「历史回放」。

## 5. source-health v2（`--fetch`，v0.3.1 修复后）

- 每源字段：`id/name/category/url/access/compliance/ok/mode/http_status/latency_ms/cached/items/signals/checked_at/error/note`；`meta`: `mode/count/ok_count/failed_count/cached_count/online_count`。
- `mode ∈ {online-fetch, cache, offline}`；`cached=true` 时 `latency_ms=0` 且 `mode="cache"`（note 注明缓存命中）；`ok=false` 时 `error` 必填非空原因。
- **2026-10-22 v0.3.1 实测（`--fetch --no-cache`，真实网络）：8/8 源成功、215 条原始 → 211 条信号，`meta.mode="online-fetch"`**：
  - itunes-reviews 200 / 243ms / 30 条（GB storefront）；shopify-changelog 200 / 2102ms / 30（官方 feed.xml）；hnrss 200 / 17222ms / 20；lobsters 200 / 833ms / 25（reddit 替代）；app-store-rss 200 / 1284ms / 30；arxiv-rss 200 / 1683ms / 30；techcrunch-rss 200 / 2618ms / 20；producthunt-feed 200 / 1051ms / 30。
  - 源替换记录：reddit（reddit.com 本机网络持续 40s 超时 → `access="manual"`，新增 Lobsters 公开 RSS 替代）；itunes-reviews（US storefront 空 feed → GB storefront）；shopify-changelog（HTML → `https://shopify.dev/changelog/feed.xml`）。
- 合规：每域 ≤1 req/s、6h 缓存、明确 UA、20s 超时、重试 2 次；红区源不抓取；outbox（`scanner/outbox/`）仅供人工复核，不自动进机会库。

## 6. 报告导出

- `python scanner/report.py --all`（或 `--period day|week|month|year`）→ `data/reports/report-<period>-2026-10-23.{html,md}`。
- HTML 自包含（内联 CSS、可 file:// 打开/打印），含七问摘要、证据链接、风险、免责声明；`generated_at` 为确定性逻辑时间（同日重跑字节一致）。

## 7. AI 富化与实验校准（v0.4.0 新工具，v0.5.1 扩展 provider）

### 7.1 `scanner/enrich.py` —— AI 富化 outbox（人工复核门禁）

- 输入：`scanner/outbox/signals-<date>.json`（`--fetch` 产物）；输出：`scanner/outbox/enriched-<date>.json` + `scanner/outbox/REVIEW.md`（**outbox 已 gitignore**，不入库、不入发布）。
- **provider 三态**：
  - `--provider offline`（默认）：无网络/无 key，关键词/taxonomy 模板映射、七问骨架草稿（标注「待人工补充」）、启发式语言检测、证据 URL 透传；
  - `--provider mock`（v0.5.1）：本地模拟在线响应（**不联网**），走与真实在线相同的请求构造/响应解析/回退流程；`meta.generator="mock-llm"`、`meta.model="mock-model"`，用于测试与演示；
  - `--provider online`：`LLM_API_KEY`（+ `LLM_BASE_URL`/`LLM_MODEL`）调用 OpenAI 兼容 `/chat/completions`；超时（60s）+ 重试（`config.LLM_MAX_RETRIES`，指数退避）；24h 缓存命中标注；失败自动回退 offline 并记录 error。
- **在线/模拟用量**：`meta.usage{input_tokens, output_tokens, estimated_cost_usd, calls, cache_hits, prices}`；价格常量为 `config.LLM_PRICE_INPUT_PER_1K_USD` / `LLM_PRICE_OUTPUT_PER_1K_USD`（示例价格、注释说明，非真实账单；缓存命中不重复计费）。`--limit N` 限制最多处理的信号数。**缓存语义**：24h 内二次运行命中缓存 → `cache_hits>0` 且 `input_tokens/output_tokens=0`、`calls=0`（不重复计费属预期），候选 `_llm.cached=true`、`_mode` 含 `cache`。
- **安全与门禁**：key 只从环境变量读取、绝不写入文件；`--dry-run` 只打印摘要不落盘；所有候选 `needs_human:true`；**永不自动写入 `data/opportunities.json`**（单测断言 opportunities 内容不变）。
- 2026-10-22 实测：offline-template **211 条候选 / 0 跳过**；`--provider mock --limit 5` **5 条候选**（`generator=mock-llm`，tokens input 1446 / output 869，成本估算 $0.000738）；产物均在 `scanner/outbox/`。

### 7.2 `scanner/calibrate.py` —— 实验校准报告

- 输入：前端 `/calibration` 导出的实验 JSON（schema_version 0.4.0，`experiments[].outcome ∈ {positive,negative,inconclusive}` 等）；输出：`data/reports/calibration-<date>.html/.md`。
- **Brier 公式（docs/04 §12.9.5）**：`p = clamp(total/100, 0.01, 0.99)`；`o = positive→1 / negative→0`；`inconclusive` 排除；`Brier = mean((p−o)²)`；基线 0.25，样本 < 3 显示「样本不足」。
- 报告内容：样本数/结果分布/状态分布、等级×成功率、Brier 与排除明细、花费/耗时汇总、校准建议、免责声明。
- 2026-10-22 样例运行（`--sample`，标注为演示数据）：6 条实验、5 条有效样本、**Brier 0.2338**；产物 `data/reports/calibration-2026-10-22.{html,md}`。

## 8. 年度年鉴与本地数据包（v0.5.0）

### 8.1 `scanner/yearbook.py` —— 年度年鉴

- `python scanner/yearbook.py --year 2026 [--experiments <export.json>] [--sample]` → `data/reports/yearbook-2026.html/.md`（HTML 自包含可打印，`generated_at` 用 as_of 固定值保证确定性）。
- 内容：年榜 Top20（等级/行业/区域/窗口）、月度时间线（按 `activity_dates` 聚合，无活动月份显示 0，含行业/信息差 Top2 主题）、行业/区域/信息差/等级/窗口状态分布、A 级清单（≥75）、窗口收尾或 ≤3 个月机会、评分分布（CSS 条形）、可选实验摘要（复用 `calibrate.py` 的 Brier/成功率/花费口径）、规则化「年度 3 个方向建议」（标注「规则生成，非投资建议」）、免责。
- 2026 年鉴当前关键统计：46 条机会 / Top20 20 条 / A 级及以上 11 条 / 收尾窗口 0 条；带样例实验摘要时 Brier 0.2338（sample 标注）。

### 8.2 个人数据包与 `rec_log`（仅前端本地，不进入 data/）

- 前端 `/data` 导出/导入单个 JSON：`{schema_version:"0.5.0", exported_at, profile, experiments, alerts_state, rec_log, settings}`；纯本地、不上传，用于多设备手动迁移（详见 docs/12 §1.4）。
- `rec_log`：前端 localStorage 记录推荐曝光/查看/加入实验/忽略（上限 500 条滚动），用于「推荐命中率 = 加入实验数 / 曝光去重机会数」；**不入库、不进 data/**。
- 数据工程只消费前端导出的 experiments JSON（供 `calibrate.py` / `yearbook.py --experiments`），不读写 `profile`/`alerts_state`/`rec_log`。

## 9. SQLite 派生库（`data/radar.db`，gitignore）

- 表：`meta / opportunities / evidence / rankings_history / source_health`；当前 80 / 156 / 654 / 92 行。
- `--all` 后自动从 JSON 全量重建（临时文件 + 原子替换），`python scanner/db.py --rebuild` 可单独重建；**不入库、不入发布**（`data/.gitignore`）。

## 10. 证据与可信度分级

- `verified:true`（**32 条**，2026-10-22 用 HTTP 直连逐一打开核验）全部证据 URL 实测 200；其余 48 条 `verified:false`，`compliance_notes` 已说明核验状态（`verified` 仍需使用前复核）。
- `evidence[].date` 优先来源发布日，无法确认时取检索/核验日并说明；`quote` 无法获得具体帖子/评论链接时降级为品类/主题/功能级事实描述，不编造 URL。
- `tier`：`primary` 一手｜`secondary` 二手｜`marketing` 营销稿。

## 11. 校验（`python scanner/validate.py`）

V01–V18（V18 支持 history/adjacent 双口径）· **V19**（所有历史快照结构合法、`snapshot_at` 日期与文件名一致、回放必须有 `replay_as_of`、最新快照=当日真实快照且与 rankings 一致）· **V20**（source-health：`mode` 枚举、`cached`/`latency_ms` 一致性、`http_status` int/null、`ok=false` 必须有 `error`、`meta.mode` 合法）。
**v0.6.0 配额收紧**：V02（机会 ≥80、14 行业各 ≥2、11 区域全覆盖、目标国家/地区 ≥50、中国角度 ≥25）· V08（day ≥10 / week ≥20 / month ≥30 / year ≥80）。
当前结果：**20/20 PASS，退出码 0**。

## 12. v0.9.2 商机系统评估 + 中文候选 + 漏斗修复

- **边界**：商机是否成立=系统职责（`system_validation`：需求/信息差/证据/时效/可执行性/地理具体性/竞争窗口共 8 项检查，自动计算）；能否赚钱=个人线下实体验证（`verification_status` 默认 `not_started`，可选 observing/tested），不参与收录/排序。meta `system_validation_summary` 分布 high 53 / medium 133 / low 14，avg 92.9；`verified_by_system=true`。
- **中文候选**：`title_zh(≤28)/one_liner_zh(≤60)/title_original/translation_method(template|source-zh)`；英文源词典+行业/信息差模板生成中文主标题，中文源保留原文；实测 **200/200 有中文标题（ratio 1.0；template 194 / source-zh 6）**，无整句英文搬运。
- **漏斗真值**：`/api/status.outbox.funnel` 与 candidates meta `funnel` 以 source-health 为准：**attempted 101 / ok 101 / failed 0**，raw 2420 → deduped 1892 → new 1865 → business 344 → candidates 200（含失败源原因字段）。
- **源修复/扩充**：fetch.py 增加 XML 容错（未转义 &/控制字符）→ rest-of-world 恢复（12 条）；Arab News 403 换源 Middle East Monitor；补 The New Arab/BBC Business/Guardian Business/NPR Business/Phys.org/ScienceDaily/MIT Tech Review/Wired → **168 平台 / 101 enabled / 11 区域**；干净重置 ledger/outbox 后 `--fetch --no-cache --fetch-limit 160` 实测 **101/101 成功**。

## 13. v0.9.1 源扩充与候选质量

- **源扩充**：160 平台 / **91 enabled 自动源** / 11/11 区域；并入 researcher 25 个实测 RSS（Supply Chain Dive、FreightWaves、Skift、Petfood Industry、Tech.eu、RetailDetail、Euronews Business、36Kr、Japan Times、iFanr、SSPAI、CNA Asia、Bangkok Post、YourStory、ET Tech、Nairametrics、BusinessDay NG、Brazil Journal、Startup i、SmartCompany AU、vc.ru、Federal Register、WTO News、EU Commission Press 等；Arab News 403 disabled）、restofworld URL 修复（仍 XML 解析失败→disabled）、Google News **TR** + 3 query（retail startup funding US / 宠物消费 CN / 清真阿语 SA）、App Store **jp/br/in/ng/ae/au** 6 国（access=json）。
- **干净首跑**：重置账本/outbox 后真实 `--fetch --no-cache --fetch-limit 120`：92 源尝试 **91 成功**（rest-of-world 失败）、2177 原始 → 1653 信号、**new 1627 / seen 26**（账本 1627）；source-health 92 行 items 2177。
- **候选质量**：标题/摘要去 HTML/空白/来源尾缀/截断；gap 启发式兜底（industry/source_category/关键词）→ **覆盖 200/200、missing 0、fallback 28**；region 来源+关键词推断 → **11/11、inferred 0**；country 28；同 canonical URL 保留最新（first/last_seen）；上限 `config.CANDIDATE_LIMIT=200` 可配（CLI `--candidates-limit` / `candidates.py --limit`）；仍无验证门禁。

## 14. v0.9.0 自动候选与发现榜（双轨，去掉验证门禁）

- **产品原则**：验证/实验**不是**信息获取与上榜的门禁；自动发现候选直接进入发现榜，无需人工复核/商业验证/实验盈利；`verification_status` 仅标签展示，不参与收录/排序。
- `scanner/candidates.py`：读最新 `scanner/outbox/signals-*.json` 的 `tier=business` 信号（184 条）优先、不足按 relevance 补 `maybe` 高分，上限 200、同 URL/同标题去重、确定性；每条含 `candidate_id/title(≤28)/one_liner/industry_ids/gap_type_ids/region_ids/target_countries/source/evidence≥1/seven_questions(自动草稿)/roi(行业默认区间,estimated)/scores(10 维+total/rank_score/grade)/confidence/status=auto-discovered/verification_status=unverified/first_seen/last_seen/disclaimer`。
- 输出 `data/candidates.json`（meta + 200 条）与 `data/candidate-rankings.json`（day/week/month/year，按 first_seen 归窗、排序同 rank 规则）；**不改** `rankings.json`/`opportunities.json`；`stats.json` 增加候选计数（候选 200 / 今日新增 21 / unverified 200）。
- 生成：`python scanner/candidates.py --as-of 2026-10-23`、`python scanner/pipeline.py --candidates --as-of 2026-10-23`；`--all` 自动包含；幂等（同输入同字节）。

## 15. v0.8.0 采集增强（源注册表 / 持久去重 / 相关性初筛）

- **源注册表**：`data/sources.json` 增加 `access(rss|json|api|manual)`、`regions`、`lang`、`enabled`、`priority`、`limits`、`kind`；`--fetch` 只抓 `enabled=true` 且合规绿/黄、`access ∈ {rss,json}` 的源，按 priority/value_score 排序（默认 `--fetch-limit 60`）。
  2026-10-23 实测：57/57 enabled 源成功、1448 条原始 → 1015 条（批内去重后）；不可用源（itunes 空 feed、substack 非 feed、bing/rest-of-world/techinasia/entrackr/nature/dw 等）标 `enabled=false` 并记录原因。
- **持久信号账本**：`scanner/build/signal-ledger.sqlite`（gitignore）保存 `canonical_url/title_hash/content_hash/first_seen/last_seen/seen_count`；fetch 跨批去重，outbox 每条带 `is_new`；meta 增加 `new_count/seen_count/ledger_total`。实测同一天连跑三次：新增 983 → 68 → **0**（账本累计 1051），旧条目以 `is_new=false` 保留不刷屏。
- **相关性初筛**：每条信号增加 `relevance_score(0-100)`、`industry_ids/gap_type_ids/region_ids`、`tier(business/maybe/off-topic)`、`reasons`（离线规则，含招聘/广告/纯论文排除词）；meta 与 `/api/outbox` 提供 `relevant_count/tiers/top_relevant`。实测 1015 条：**business 184 / maybe 712 / off-topic 119**；仅线索排序，**不自动入库**。
- 复现：`python scanner/pipeline.py --fetch --as-of 2026-10-23 --fetch-limit 60`（首跑联网约 3–4 分钟；二次命中缓存更快），重跑验证 `new_count → 0`。

## 16. 复现命令

```powershell
python scanner/pipeline.py --replay-as-of 2026-10-22 --replay-days 2   # 生成 10-20/10-21 回放 + 重算当前榜单(history delta)
python scanner/pipeline.py --all                                       # 离线全链路（幂等，20/20）
python scanner/pipeline.py --all --as-of 2026-10-23                    # v0.6.1：真实每日运行（day 归零，week/month/year 保持）
python scanner/pipeline.py --fetch --no-cache --fetch-limit 120        # 真实采集（v0.9.1：91 enabled 源 + 账本去重 + 相关性）
python scanner/candidates.py --as-of 2026-10-23                        # 从 outbox 自动生成候选 + 发现榜（v0.9.0）
python scanner/pipeline.py --candidates --as-of 2026-10-23             # 同上（流水线步骤）；--all 默认包含
python scanner/report.py --all                                         # 4 窗口报告（确定性）
python scanner/report.py --period day --as-of 2026-10-23               # 报告日期跟随 --as-of
python scanner/enrich.py                                               # AI 富化 outbox（offline-template，永不自动入库）
python scanner/enrich.py --provider mock --limit 5                      # 本地模拟在线（不联网）
python scanner/enrich.py --provider online --limit 5                    # 真实 LLM（需 LLM_API_KEY）
python scanner/calibrate.py --experiments scanner/fixtures/experiments-sample.json --sample  # 校准报告（样例）
python scanner/yearbook.py --year 2026                                 # 年度年鉴（无实验摘要版本）
python scanner/yearbook.py --year 2026 --experiments scanner/fixtures/experiments-sample.json --sample  # 年鉴（含样例实验摘要）
python scanner/db.py --rebuild                                         # SQLite 重建
python scanner/translate.py --text "Pet memorial startup raises funding" --provider glossary  # v0.9.3 系统翻译
python scanner/candidates.py --as-of 2026-10-23 --translate-provider glossary                 # 自动翻译候选
python -m unittest discover -s scanner/tests                           # 123 条单测
```

## 17. v0.9.3 系统级翻译子系统

- `scanner/translate.py`：provider `glossary`（默认离线，**898 条**短语/实体词典）/ `llm`（OpenAI 兼容，读 `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`，失败回退 glossary、`fallback=true`）/ `mock`（测试不联网）/ `source-zh`（中文原文直通）；SQLite 缓存 `scanner/build/translation-cache.sqlite`（key=sha256(provider+target+lang+text)，命中 `cached=true`）；质量 high/medium/low/source-zh 仅展示。
- 候选字段：`title_zh(≤40，真实翻译句子)/one_liner_zh(≤60)/summary_zh(≤160)/title_original/translation{provider,quality,cached,source_lang,target_lang,fallback,disclaimer}`；`translation_method` 保留为 provider 别名。
- 自动翻译：`candidates.py` 每次生成逐条翻译（`--translate-provider`/`--no-translate-cache` 可切换），meta `translation_summary{provider,total,cached,quality_*,source_zh,glossary,llm,coverage,glossary_entries}`；实测 200 条 cached 100%、中文覆盖 100%、provider glossary 194/source-zh 6、quality medium 120/low 74/source-zh 6。
- 质量边界：glossary 为离线词典翻译可能不完美；llm 需 key 且质量更高；两者均不保证语义完全准确；**翻译质量不参与商机收录/排序**，前端默认中文、可切原文并显示「系统翻译」。

## 18. 免责

机会卡片是研究假设与公开信息整理，**不构成投资建议、法律意见或收入承诺**。涉及跨境、金融、医疗、法律、宗教、内容版权时请自行做合规核查。`calendar.json` 中宗教节日日期为预计值，以当地观月/官方公告为准。
