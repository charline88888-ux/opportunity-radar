# data/ 数据底座使用说明（data-v0.3.0）

> 唯一接口标准：`docs/12-数据契约与字段字典.md`（data-v0.3.0 增量已冻结）。本目录所有 JSON 必须通过 `python scanner/validate.py`（V01–V20，退出码 0）。
> 数据基准日 `as_of = 2026-10-22`（Asia/Shanghai），当前周 `2026-W43`（10-19～10-25），当前月 `2026-10`，当前年 `2026`。
> v0.3.0 为 MINOR 增量（向后兼容）：新增 source-health v2 字段、历史回放快照与真实 delta（history 口径），**不删除、不改名既有必填字段**。

## 1. 文件清单与规模（data-v0.3.0）

| 文件 | 作用 | 规模 | 生产者 | 消费者 |
|---|---|---|---|---|
| `taxonomy.json` | 14 行业 / 12 人性需求 / 6 神经递质 / 24 情绪 / 12 信息差 / 7 驱动 / 12 商业模式 / 11 区域 / 10 评分维度 / 20 标签 / 5 等级 | 11 组固定枚举 | 数据工程 | 全队 |
| `opportunities.json` | 机会库 | **46 条**（14 行业、11 区域、12 信息差、38 国家/地区、18 条中国供应链角度） | 数据工程 | 前端、扫描器 |
| `rankings.json` | 唯一权威榜单；v0.3.0 `meta.delta_basis="history"`、`meta.history_as_of="2026-10-21"`、`windows[].delta_basis` | day 8 / week 15 / month 23 / year 46 | 扫描器 `--all` | 前端 |
| `stats.json` | 首屏 KPI 与图表聚合 | KPI + 4 组分布 + 直方图 + 14 天趋势 | 扫描器 | 前端 |
| `history/rankings-2026-10-20.json` | **历史回放**（`reconstructed=true`、`replay_as_of=2026-10-20`） | day 3 / week 5 / month 13 / year 36 | `--replay-*` | 扫描器、前端 |
| `history/rankings-2026-10-21.json` | **历史回放**（`reconstructed=true`、`replay_as_of=2026-10-21`，basis=history） | day 2 / week 7 / month 15 / year 38 | `--replay-*` | 扫描器、前端 |
| `history/rankings-2026-10-22.json` | **真实每日快照**（`reconstructed=false`，与 rankings 一致） | day 8 / week 15 / month 23 / year 46 | `--all` | 扫描器、前端 |
| `source-health.json` | 在线采集源健康度 **v2**（`mode`/`http_status`/`latency_ms`/`cached`/`items`/`error`/`checked_at`，`meta.mode`） | 8 个源（5 成功 / 3 失败；2026-10-22 实测） | `--fetch` | 前端、运营 |
| `reports/report-<period>-2026-10-22.{html,md}` | 四窗口自包含 HTML + Markdown 报告（确定性生成，可打印/分发） | 4 窗口 × 2 格式 | `report.py --all` | 用户、归档 |
| `sources.json` | 数据源矩阵 12 大类 | **67 个平台**（含 4 个可采集 RSS 源） | 数据工程 | 前端、`--fetch` |
| `playbooks.json` | 扫描剧本 | **12 个** | 数据工程 | 前端、运营 |
| `calendar.json` | 全球商业日历 2026-11～2028 | **33 个节点** | 数据工程 | 前端、方法论 |
| `radar.db`（gitignore） | SQLite 派生库（opportunities/evidence/rankings_history/source_health） | 46 / 88 / 211 / 8 行 | 扫描器 `--all`（`--db-rebuild` 可重建） | 扫描器 |

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

## 5. source-health v2（`--fetch`，v0.3.0）

- 每源字段：`id/name/category/url/access/compliance/ok/mode/http_status/latency_ms/cached/items/signals/checked_at/error/note`；`meta`: `mode/count/ok_count/failed_count/cached_count/online_count`。
- `mode ∈ {online-fetch, cache, offline}`；`cached=true` 时 `latency_ms=0` 且 `mode="cache"`（note 注明缓存命中）；`ok=false` 时 `error` 必填非空原因。
- 2026-10-22 实测（真实网络）：8 源中 **5 成功**（hnrss / app-store-rss / arxiv-rss / techcrunch-rss / producthunt-feed，真实 latency 848–9218ms，共 129 条信号）；**3 失败**并如实记录原因：reddit `URLError: timed out`、itunes-reviews/shopify-changelog「返回内容不是可解析的 feed（http_status=200，有效条目 0 条）」。
- 合规：每域 ≤1 req/s、6h 缓存、明确 UA、12s 超时、重试 2 次；红区源不抓取；outbox（`scanner/outbox/`）仅供人工复核，不自动进机会库。

## 6. 报告导出

- `python scanner/report.py --all`（或 `--period day|week|month|year`）→ `data/reports/report-<period>-2026-10-22.{html,md}`。
- HTML 自包含（内联 CSS、可 file:// 打开/打印），含七问摘要、证据链接、风险、免责声明；`generated_at` 为确定性逻辑时间（同日重跑字节一致）。

## 7. SQLite 派生库（`data/radar.db`，gitignore）

- 表：`meta / opportunities / evidence / rankings_history / source_health`；当前 46 / 88 / 211 / 8 行。
- `--all` 后自动从 JSON 全量重建（临时文件 + 原子替换），`python scanner/db.py --rebuild` 可单独重建；**不入库、不入发布**（`data/.gitignore`）。

## 8. 证据与可信度分级

- `verified:true`（5 条：024/025/029/030/031）全部证据 URL 实测 200；其余 41 条 `verified:false`，`compliance_notes` 已说明核验状态。
- `evidence[].date` 优先来源发布日，无法确认时取检索/核验日并说明；`quote` 无法获得具体帖子/评论链接时降级为品类/主题/功能级事实描述，不编造 URL。
- `tier`：`primary` 一手｜`secondary` 二手｜`marketing` 营销稿。

## 9. 校验（`python scanner/validate.py`）

V01–V18（V18 支持 history/adjacent 双口径）· **V19**（所有历史快照结构合法、`snapshot_at` 日期与文件名一致、回放必须有 `replay_as_of`、最新快照=当日真实快照且与 rankings 一致）· **V20**（source-health：`mode` 枚举、`cached`/`latency_ms` 一致性、`http_status` int/null、`ok=false` 必须有 `error`、`meta.mode` 合法）。
当前结果：**20/20 PASS，退出码 0**。

## 10. 复现命令

```powershell
python scanner/pipeline.py --replay-as-of 2026-10-22 --replay-days 2   # 生成 10-20/10-21 回放 + 重算当前榜单(history delta)
python scanner/pipeline.py --all                                       # 离线全链路（幂等，20/20）
python scanner/pipeline.py --fetch --no-cache                          # 真实采集刷新 source-health v2（联网）
python scanner/report.py --all                                         # 4 窗口报告（确定性）
python scanner/db.py --rebuild                                         # SQLite 重建
python -m unittest discover -s scanner/tests                           # 36 条单测
```

## 11. 免责

机会卡片是研究假设与公开信息整理，**不构成投资建议、法律意见或收入承诺**。涉及跨境、金融、医疗、法律、宗教、内容版权时请自行做合规核查。`calendar.json` 中宗教节日日期为预计值，以当地观月/官方公告为准。
