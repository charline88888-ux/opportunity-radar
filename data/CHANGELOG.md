# data/ 数据变更记录

格式：`data_version` + 日期 + 变更内容 + 影响面。契约变更（字段/枚举/公式）必须同步更新 `docs/12-数据契约与字段字典.md` 并通知 Lead、前端、红队。

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
