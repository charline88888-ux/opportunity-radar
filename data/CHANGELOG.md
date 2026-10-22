# data/ 数据变更记录

格式：`data_version` + 日期 + 变更内容 + 影响面。契约变更（字段/枚举/公式）必须同步更新 `docs/12-数据契约与字段字典.md` 并通知 Lead、前端、红队。

## data-v0.3.0 · 2026-10-22 · MINOR 增量（source-health v2 / 历史回放 / 真实 delta）

> 向后兼容：不删除、不改名既有字段。v0.1.0/v0.2.0 快照见 `releases/`。

### 增量
- **source-health v2**：每源 `mode ∈ {online-fetch,cache,offline}`、`http_status`(int/null)、`latency_ms`（真实测量；缓存命中 0 且 `cached=true`）、`cached`、`items`、`error`（`ok=false` 必填非空原因）、`checked_at`；`meta.mode/cached_count/online_count`。
- **历史回放快照**：`--replay-as-of <date> --replay-days N` 生成基准日前 N 天的确定性回放（`meta.reconstructed=true`、`meta.replay_as_of`、`snapshot_at` 确定性、只纳入 `last_activity ≤ 回放日` 的机会）。当前 `data/history/` 3 份：`rankings-2026-10-20.json`（回放，day3/week5/month13/year36，adjacent-window）、`rankings-2026-10-21.json`（回放，day2/week7/month15/year38，history）、`rankings-2026-10-22.json`（真实，day8/week15/month23/year46，history）。
- **真实 delta**：`rankings.json.meta.delta_basis="history"`、`history_as_of="2026-10-21"`；窗口对比 day 用上一日快照、week/month/year 用同 key 上期；仅两期都出现的机会有 delta，新增 `null/new`；回退口径保留（回放 10-20 即 adjacent-window 示例）。当前 week/month/year 分别 7/15/38 条有 delta，8 条 10-22 新机会为 new。
- **V19/V20 收紧**：V19 校验全部快照结构、`snapshot_at` 日期对齐、回放必须 `replay_as_of`、最新快照=当日真实快照且与 rankings 一致；V20 校验 source-health v2 全部字段与一致性（缓存 latency=0、失败必须有 error、`meta.mode` 合法）。
- 数据版本：taxonomy/rankings/stats/sources/playbooks/calendar `meta.data_version` → `0.3.0`；报告改为确定性 `generated_at`（同日重跑字节一致）；单测 28 → **36 条**（新增回放链/幂等、source-health 合法/非法、history 新增不回退）。

### 真实验证结果（2026-10-22 实际运行）
- `pipeline.py --replay-as-of 2026-10-22 --replay-days 2`：生成 10-20/10-21 回放并重算当前榜单 → 10-22 `delta_basis=history`、`history_as_of=2026-10-21`。
- `pipeline.py --all`：exit 0，**幂等**（连跑两次 opportunities/rankings/3 份 history/stats/radar.db/reports SHA256 全一致）；validate **20/20 PASS**。
- `pipeline.py --fetch --no-cache`：真实网络，8 源 **5 成功 / 3 失败**（129 条信号）；失败原因如实写入 source-health：reddit `URLError: timed out`、itunes-reviews 与 shopify-changelog「返回内容不是可解析的 feed（http_status=200，有效条目 0 条）」。成功源真实 latency 848–9218ms。
- `report.py --all`：4 窗口 × HTML/MD，确定性生成、重跑一致。
- `db.py --rebuild`：46 opportunities / 88 evidence / 211 rankings_history / 8 source_health。
- `python -m unittest discover -s scanner/tests`：**36/36 OK**。

### 指纹（SHA256 前 16）
`opportunities.json` `52B30E45B356CEA9`（未变）｜`rankings.json` `DBF852C62C9B7DDE`｜`history/rankings-2026-10-20.json` `4C48B00AEA36F74E`｜`rankings-2026-10-21.json` `DE8D5A63223EC52C`｜`rankings-2026-10-22.json` `B74E31E950CC39AA`｜`stats.json` `C8C0B24735B933D1`｜`source-health.json` `C3021C8973860B90`｜`radar.db` `424F46DE30F9E368`

### 已知不足
- 回放快照是「按当日窗口规则重排现有机会」的演示口径（非真实历史存档），UI/文档需明示 `reconstructed=true`。
- 采集仍只覆盖 RSS/JSON feed；reddit 本次网络超时、itunes/shopify 返回非 feed，属真实网络/源变化，已如实记录，可重跑 `--fetch` 刷新。
- `verified:true` 仍 5 条；公开 API 源未接线。

## data-v0.2.0 · 2026-10-22 · MINOR 增量（历史快照 / SQLite / 真实采集 / 报告）

> 向后兼容：不删除、不改名 v0.1.0 的任何必填字段；只新增可选文件/字段与历史快照机制。v0.1.0 快照见 `releases/v0.1.0/`。

### 新增文件与增量
- `data/history/rankings-<date>.json`：每日榜单历史快照，`meta.snapshot_at`（确定性逻辑时间）+ `meta.reconstructed=false`；每次 `--all` 按 as_of 写入、同日覆盖。当前 1 份（2026-10-22）。
- `rankings.json.meta` 新增 `delta_basis`（`history` / `adjacent-window`）、`history_as_of`（上一快照日期或 null）；`windows[].delta_basis` 标明该窗口实际口径；`tie_breaker` 落盘排序链。
- `delta` 机制升级：有更早快照时按「上一快照同窗口名次」计算（delta=上期名次−本期名次）；否则回退相邻窗口口径。当前数据无更早快照 → `adjacent-window`，history 路径由单测临时快照覆盖。
- `data/source-health.json`：在线采集源健康度（`--fetch` 生成，8 个源：7 成功 / 1 失败）。
- `data/reports/`：四窗口自包含 HTML + Markdown 报告（8 个文件），含七问摘要、证据链接、风险与免责声明。
- `data/radar.db`（gitignore）：SQLite 派生库，表 opportunities/evidence/rankings_history/source_health，当前 46/88/92/8 行，可由 JSON 全量重建。
- `scanner/` 新增 `history.py` / `db.py` / `fetch.py` / `report.py`；`rank.py` 支持双 delta 口径；`validate.py` 新增 V19（历史快照一致性）/V20（source-health 合法性）→ **20/20 PASS**。
- `data/sources.json` 从 63 → **67 个平台**：新增 4 个可采集公开 RSS 源（hnrss / techcrunch-rss / producthunt-feed / arxiv-rss）。
- `scanner/outbox/`（gitignore）：`--fetch` 输出的人工复核队列，不自动写入机会库。

### 真实验证结果（2026-10-22 实际运行）
- `python scanner/pipeline.py --all`：exit 0，**幂等**（连跑两次：opportunities/rankings/history/stats/radar.db SHA256 全部一致），validate **20/20 PASS**。
- `python scanner/pipeline.py --fetch`：**7/8 个源成功**，185 条原始信号：
  - 成功：reddit（25）、itunes-reviews（30）、hnrss（20）、app-store-rss（30）、arxiv-rss（30）、techcrunch-rss（20）、producthunt-feed（30）；缓存命中后二次运行 0ms。
  - 失败：shopify-changelog（返回 HTML 而非 feed，items=0）——已如实记录在 source-health。
  - 合规：每域 ≤1 req/s、6h 缓存、明确 UA、12s 超时、失败重试 2 次；红区源不抓取；outbox 仅人工复核。
- `python scanner/report.py --all`：4 窗口 × HTML/MD 共 8 个文件（day 8 条、week 15、month 23、year 46）。
- `python -m unittest discover -s scanner/tests`：**28 条全绿**（新增 history delta/回退、报告生成、SQLite 重建、RSS/Atom/JSON feed 解析、红源筛选）。

### 数据指纹（SHA256 前 16 位）
- `opportunities.json` `52B30E45B356CEA9`（内容未变）
- `rankings.json` `AD79B0AA1B8CFFF8`
- `history/rankings-2026-10-22.json` `170F44478DC20A5D`
- `stats.json` `4F58F249566C5627`
- `radar.db` `D8F67AD20FE11CA0`（派生库，不入库）

### 已知不足
- 当前仓库只有 1 份历史快照 → 真实数据使用 adjacent-window；history 口径待次日运行自然生效（单测已覆盖）。
- `--fetch` 只覆盖 RSS/JSON feed 类源；公开 API 源（YouTube/SEC/openFDA 等）尚未接线，openFDA 在部分网络有证书链问题。
- `verified:true` 仍为 5 条（025/029/030/031 单证据待补第二独立来源）。
- 4 个离线适配器继续保留用于可复现回归；真实采集与离线 fixtures 互不影响。

## data-v0.1.0 · 2026-10-22 · 首个冻结数据版本

### 最终交付规模
- `taxonomy.json`：11 组固定枚举全量（14 行业含 color/icon、12 需求、6 神经递质、24 情绪、12 信息差含半衰期、7 驱动、12 商业模式、11 区域、10 评分维度权重、20 标签、5 等级），id 与 `docs/12` §3 完全一致。
- `opportunities.json`：**46 条**高质量机会；14 行业各 ≥1、11 区域全覆盖、12 类信息差全覆盖、38 个目标国家/地区、18 条中国供应链/中文市场角度；混合实物跨境/服务/信息产品/SaaS/合规专业/文化宗教/内容 IP/本地生活/银发/宠物/情绪疗愈；七问全答、88 条证据、10 维评分齐全。
- `rankings.json`：day 8 / week 15 / month 23 / year 46（配额 day ≥6 / week ≥12 / month ≥20 / year ≥40）。
- `stats.json`：KPI + 分布 + 直方图 + 14 天趋势 + 开放窗口价值。
- `sources.json`：12 大类 **63 个平台**（含访问方式/频率/成本/合规等级/价值分/坑，引用 `research/platform-matrix-validation.md`）。
- `playbooks.json`：**12 个**可照做剧本（steps ≥5、platforms ≥2、关键词与质检点）。
- `calendar.json`：**33 个** 2026-11～2028 全球商业日历节点（宗教/节日/税季/开学/财政年/购物节）。
- `scanner/`：纯标准库流水线（adapters / normalize / dedupe / materialize / score / rank / stats / validate / pipeline），`python scanner/pipeline.py --all` 退出码 0，`validate.py` **18/18 PASS**，`python -m unittest discover -s scanner/tests` 18 个测试全绿。

### 阶段 A（12 条机会里程碑）
- 新增 taxonomy、12 条机会（宠物/银发/情绪/AI）、rankings/stats、扫描器骨架（4 个离线适配器 + fixtures）。
- 修正阶段 A 非法枚举引用（`gap_type_ids` 误用 `tech`、`tags` 误用 `subscription/local/service`）与超长标题。

### 阶段 B 关键变更
- 机会库扩到 46 条，按四窗口配额布置 `last_activity`（当天 8 / 本周 15 / 本月 23 / 全年 46）。
- 新增 sources / playbooks / calendar 三件套。
- 引用 `research/handoff-to-data.md` 的 12 个高价值案例（故乡纳税、Umrah、宗教译审、K-beauty、短剧本地化、MercadoLibre、乳木果、EAA 无障碍、回忆录、印尼清真、Etsy 数字产品等）。
- 证据核验：5 条机会 `verified:true`（024/025/029/030/031，全部证据 URL 实测 HTTP 200）；其余 `verified:false` 并在 `compliance_notes` 说明。
- 诚实性修正：`opp-compliance-eaa-accessibility-034` 原引 France Num 页面实测 404 → 改用 EUR-Lex 官方指令（2019/882）并置 `verified:false`；DEHSt CBAM 抓取时处于维护页，相关机会保持 `verified:false`。

### 契约澄清同步（docs/12 更新后）
- 评分公式改为 `round_half_up`（Decimal），`score.py` 同步；数据评分向量避开 `.xx05` 歧义边界。
- `window.status` 与 `months_left` 按 §4.7 映射；`decay` 由主信息差半衰期推导。
- 榜单 `delta` 明确为相邻更大窗口对比（day←week、week←month、month←year，year 无参照）。
- 新增校验 V16（必填字段完整性 + 窗口映射）、V17（证据日期/tier/URL）、V18（榜单 change/delta 语义），validate 已实现并全部通过。
- `sources.frequency` 新增 `yearly` 枚举（GEM/Pew/Hofstede/WVS 使用）。
- 移除 `validate.py` 中两处比契约更严的检查（七问 ≥12 字、first_seen ≥ activity 最小值），降级为附加提示。

### 已知不足
- 4 个采集适配器默认仅跑离线 fixtures（不联网），真实源接入需替换 `fetch()` 并按合规等级限速。
- `verified:true` 仅 5 条（全部证据 URL 200）；其余 41 条为 `verified:false`，使用前需复核原始来源。
- 宗教节日日期（斋月/开斋节/朝觐/排灯节等）为预计值，以当地观月/官方公告为准。

### 红队终验修正（2026-10-22 10:20）
- 证据引文可回溯性（P1）：001 的 Etsy 两店铺页引文降级为 listing 标题级事实描述；028 的 r/islam 与 quran.com 引文降级为社区讨论主题/产品功能描述；043 的 r/gamedev 引文降级为讨论主题描述。均保持 `verified:false` 并在 `compliance_notes` 说明，未编造新 URL。
- 证据日期（P2）：cnstock 763132 三处日期由检索日修正为原文发布日 2026-08-19。
- 七问 moat（P2）：8 条 22–29 字的 moat 扩写为「壁垒 + 前置条件 + 被复制周期」完整表述（019 / 025 / 026 / 030 / 031 / 035 / 045 / 046）。
- 复验回归修补（P1，2026-10-22 10:25）：043 在上一轮修补中把 Reddit 描述误写到 `evidence[0]`（MarketResearch 报告 URL）造成字段错配；已恢复 evidence[0] 为报告本身（Global Video Game Translation Services Market 2026-2032），Reddit 讨论描述放回 evidence[1]；并对全部 88 条证据做 publisher/URL/title 语义一致性扫描（0 处告警）。
- 复核：`pipeline.py --all` exit 0 且幂等；`validate.py` 18/18 PASS；unittest 18/18 OK；`rankings.json` / `stats.json` SHA256 未变（评分未受影响），`opportunities.json` SHA256 已变化。
- 已知缺口：`verified:true` 中 025/029/030/031 为单一权威一手来源，第二独立来源待补（契约 §2「优先 2–4 条」非强制）。

### 冻结前 tie-breaker 对齐（2026-10-22 10:40）
- 按 docs/12 §5.1 排序链修正 `scanner/rank.py`：`rank_score` 降序 → `momentum` 降序 → `evidence_count` 降序 → `last_activity` 降序 → `opp_id` 升序（此前实现为 `rank_score`→`total`→`id`），并在 `rankings.json.meta.tie_breaker` 落盘口径。
- 受影响仅 month / year 窗口的并列组：81.4 组 025 升 3、024 降 4；78.2 组（year）002 升 8、036 降 9；69.9 组 008 升 18(y)/36(y)、009 降 19(y)/37(y)。day / week 窗口无变化；`delta/change` 随名次同步更新（V18 通过）。
- `data/opportunities.json` 未改动（SHA256 不变 52B30E45…4B96F4A42）；`rankings.json` SHA256 变为 60F06FE8…528D27；`stats.json` 内容不变。
- 新增 1 条 tie-breaker 单元测试（unittest 19/19 OK）；`validate.py` 18/18 PASS；`pipeline.py --all` exit 0 且幂等。
