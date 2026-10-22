# data/ 数据底座使用说明（data-v0.2.0）

> 唯一接口标准：`docs/12-数据契约与字段字典.md`（data-v0.2.0 增量已冻结）。本目录所有 JSON 必须通过 `python scanner/validate.py`（V01–V20，退出码 0）。
> 数据基准日 `as_of = 2026-10-22`（Asia/Shanghai），当前周 `2026-W43`（10-19～10-25），当前月 `2026-10`，当前年 `2026`。
> v0.2.0 为 MINOR 增量（向后兼容）：只新增可选文件/字段与历史快照机制，**不删除、不改名 v0.1.0 的任何必填字段**。

## 1. 文件清单与规模（data-v0.2.0）

| 文件 | 作用 | 规模 | 生产者 | 消费者 |
|---|---|---|---|---|
| `taxonomy.json` | 14 行业（color/icon）/ 12 人性需求 / 6 神经递质 / 24 情绪 / 12 信息差 / 7 驱动 / 12 商业模式 / 11 区域 / 10 评分维度 / 20 标签 / 5 等级 | 11 组固定枚举 | 数据工程（手工） | 全队 |
| `opportunities.json` | 机会库 | **46 条**，14 行业各 ≥1、11 区域全覆盖、12 类信息差全覆盖、38 个目标国家/地区、18 条中国供应链/中文市场角度 | 数据工程（撰写 + 扫描器物化） | 前端、扫描器 |
| `rankings.json` | 日/周/月/年唯一权威榜单（v0.2.0 增 `delta_basis`/`history_as_of`/`tie_breaker`） | day 8 / week 15 / month 23 / year 46 | 扫描器 `pipeline.py --all` | 前端 |
| `stats.json` | 首屏 KPI 与图表聚合 | KPI + 4 组分布 + 直方图 + 14 天趋势 | 扫描器 | 前端 |
| `history/rankings-<date>.json` | 每日榜单历史快照（v0.2.0 新增，真实 delta 与趋势） | 当前 1 份（2026-10-22） | 扫描器 `--all` | 扫描器、前端 |
| `source-health.json` | 在线采集源健康度（v0.2.0 新增，可选；`--fetch` 后生成） | 8 个源（7 成功 / 1 失败） | 扫描器 `--fetch` | 前端、运营 |
| `reports/report-<period>-<date>.{html,md}` | 四窗口自包含 HTML + Markdown 报告（v0.2.0 新增，可打印/分发） | 4 窗口 × 2 格式 | 扫描器 `report.py` | 用户、归档 |
| `sources.json` | 数据源矩阵 12 大类 | **67 个平台**（v0.2.0 新增 4 个可采集 RSS 源） | 数据工程 | 前端、扫描器 `--fetch` |
| `playbooks.json` | 扫描剧本 | **12 个**（steps ≥5、platforms ≥2） | 数据工程 | 前端、运营 |
| `calendar.json` | 全球商业日历 2026-11～2028 | **33 个节点** | 数据工程 | 前端、方法论 |
| `radar.db`（gitignore） | SQLite 派生库（opportunities/evidence/rankings_history/source_health） | 46 / 88 / 92 / 8 行 | 扫描器 `--all`（可 `--db-rebuild` 重建） | 扫描器 |

`scanner/outbox/signals-<date>.json` 是 `--fetch` 的**人工复核队列**（gitignore，不自动写入机会库）；前端构建前由 `node scripts/sync-data.mjs` 把 `data/*.json`（含 `history/`、`source-health.json`，可选缺失优雅降级）拷入 `app/src/data/`。

## 2. 派生字段口径（扫描器统一计算，手工不要硬写）

| 字段 | 口径 |
|---|---|
| `scores.total` | `round_half_up(Σ(dimension_i × weight_i) × 10, 1)`（Decimal，非银行家舍入） |
| `scores.grade` | 用四舍五入后的 total 判定：S ≥ 85 / A ≥ 75 / B ≥ 65 / C ≥ 55 / D < 55 |
| `rank_score` | `round_half_up(min(100, total × (1 + 0.12 × (momentum − 1))), 1)` |
| `momentum` | 最近 30 天证据变化倍数，clip `[0.5, 2.5]`，保留 1 位小数 |
| `evidence_count` | 恒等于 `signal.evidence.length` |
| `last_activity` | 恒等于 `max(activity_dates)`；`activity_dates` 升序且不晚于 `as_of` |
| `first_seen` | 首次进入机会库日期，≤ 任何 `activity_dates` 最小值（若有偏差 validate 仅提示） |

`python scanner/pipeline.py --all` 会重算上述字段、不一致时自动回写（契约 5.2.1「以计算值为准」），**幂等**：重复运行不改变 `opportunities.json / rankings.json / history/*.json / stats.json / radar.db` 的字节内容（已用 SHA256 验证）。数据中的评分向量已避开 `.xx05` 四舍五入歧义边界。

## 3. `window` 语义（docs/12 §4.7）

- `months_left`：人工估算的仍可切入月数（整数 1–36），估算口径 = 主信息差半衰期 × 调整系数（0.5–1.0）− 已过月数，向上取整；`status` 由 `months_left` 推导：`open` ≥ 9；`peak` 3–8；`closing` 1–2；`closed` 0。
- `decay`：由主信息差半衰期推导——`slow` ≥ 24 个月、`medium` 12–23、`fast` < 12。
- 当前数据全部为 `open` 或 `peak`，V16 校验映射一致性。

## 4. 榜单窗口与 delta 口径（docs/12 §5.1，v0.2.0 升级）

- 窗口归属：`day` = `last_activity == 2026-10-22`；`week` = ISO 周 `2026-W43`；`month` = `2026-10`；`year` = `2026`。同一机会可同时出现在多个窗口。
- 排序链：`rank_score` 降序 → `momentum` 降序 → `evidence_count` 降序 → `last_activity` 降序 → `opp_id` 升序；`rank` 从 1 连续（`rankings.json.meta.tie_breaker`）。
- **delta**：优先「上一份历史快照的同窗口名次」：`delta = 上期名次 − 本期名次`（正=上升），整文件 `meta.delta_basis = "history"`、`meta.history_as_of = 上一快照日期`；无更早快照时回退 v0.1.0 相邻窗口口径（day←week、week←month、month←year，year 无参照），`delta_basis = "adjacent-window"`。每个窗口另有 `windows[].delta_basis` 标明该窗口实际口径。`change ∈ {new,up,down,flat}` 与 delta 符号一致；完全无参照时 `delta:null, change:"new"`。
- 配额：day ≥ 6、week ≥ 12、month ≥ 20、year ≥ 40（当前 8/15/23/46）。
- 当前仓库只有 2026-10-22 一份快照，因此真实数据为 `adjacent-window`；history 路径由单测用临时快照验证（见 `scanner/tests/test_scanner.py::TestHistoryDelta`）。次日运行时会自动切换到 `history` 口径。

## 5. 历史快照（`data/history/`）

- 每次 `--all` 按 `as_of` 写 `rankings-<date>.json`（**同日覆盖、内容确定**）：内容 = `rankings.json` + `meta.snapshot_at`（逻辑时间 `<as_of>T00:00:00+08:00`，确定性）+ `meta.reconstructed=false` + `meta.data_version`。
- 同日快照不作为自身参照（`find_previous_snapshot` 只取严格早于 `as_of` 的快照），因此同日重复运行 `--all` 完全幂等。
- V19 校验：快照结构、`meta.snapshot_at`、与同日 `rankings.json` 的窗口 items 顺序/分数一致、`reconstructed=false`、日期不晚于 `as_of`。
- `data/history/` 入库（v0.2.0 新增必需目录）；`radar.db` 与 `scanner/outbox/` 不入库。

## 6. 真实采集与 `source-health.json`（`pipeline.py --fetch`）

- **默认离线**：`--all` 永远不联网；只有显式 `--fetch` 才执行真实采集。
- 源选择：`sources.json` 中 `access = rss` 且 `compliance ∈ {green, yellow}` 的源，按 `value_score` 取前 8 个；红区源（Jumia/Noon/Trustpilot/Fiverr/LinkedIn 等）不抓取。
- 合规：每域限速 ≤1 req/s、6 小时文件缓存（`scanner/build/fetch-cache/`）、明确 UA、12s 超时、失败重试 2 次、不绕过登录/付费墙/验证码。
- 输出：`scanner/outbox/signals-<date>.json`（**人工复核，不自动进机会库**）+ `data/source-health.json`。
- `source-health.json` 字段：`id/name/category/url/access/compliance/ok/status/latency_ms/items/signals/cached/checked_at/error/note`；V20 校验 id 存在于 sources.json、`ok` bool、`checked_at` 合法、`latency_ms ≥ 0`。
- 2026-10-22 实测：**7/8 个源成功**（reddit / itunes-reviews / hnrss / app-store-rss / arxiv-rss / techcrunch-rss / producthunt-feed，共 185 条原始信号），1 个失败（shopify-changelog 返回 HTML 非 feed，已如实记录）。outbox 仅供人工复核，本次不做机会库写入。

## 7. 报告导出（`scanner/report.py`）

- 命令：`python scanner/report.py --all`（四窗口）或 `--period day|week|month|year`（可重复）。
- 输出：`data/reports/report-<period>-2026-10-22.html`（自包含 HTML，内联 CSS、可离线打开/打印，含七问摘要、证据链接、风险、免责声明）与 `.md`（表格 + 逐条七问与证据）。当前 4 窗口共 8 个文件。
- 报告内容来自 `rankings.json` + `opportunities.json`，与前端读取同一权威数据；`generated_at` 为生成时间，不影响数据指纹。

## 8. SQLite 派生库（`data/radar.db`，gitignore）

- 表：`meta` / `opportunities` / `evidence` / `rankings_history` / `source_health`。
- `--all` 后自动从 JSON 全量重建（先写 `.db.tmp` 再原子替换），也可 `python scanner/db.py --rebuild`；`python scanner/db.py --info` 查看行数。
- 可从 `data/*.json` + `data/history/*.json` 完全重建，**不入库、不入发布**（`data/.gitignore`）；当前 46/88/92/8 行。

## 9. 证据与可信度分级

- `verified: true`（5 条：024 / 025 / 029 / 030 / 031）：其**全部** `evidence[].url` 已由数据工程/研究组实际打开核验（HTTP 200，内容与 title/quote 一致）。
- `verified: false`：链接来自公开检索或官方页面，未逐条打开核验；`compliance_notes` 已说明。使用前必须自行复核。
- `evidence[].date` 口径：优先来源发布日；无法确认时取检索/核验日并说明。
- `evidence[].quote` 口径：优先原文摘录；若只能获得平台店铺页/社区首页，引文降级为「品类存在 / 讨论主题 / 产品功能」级别事实描述，并在 `compliance_notes` 说明、保持 `verified:false`，不编造新 URL。
- `tier`：`primary` 一手｜`secondary` 二手｜`marketing` 营销稿（不计入证据分）。

## 10. 校验（docs/12 §9，`python scanner/validate.py`）

V01 枚举完整性 · V02 数量/行业/区域覆盖 · V03 证据链 · V04 七问 · V05 评分公式 · V06 窗口枚举 · V07 日期链 · V08 榜单配额 · V09 榜单与重算一致（含 delta_basis） · V10 数据源矩阵 · V11 剧本 · V12 日历 · V13 禁用词 · V14 stats 聚合 · V15 id/slug 唯一 · V16 必填字段与窗口映射 · V17 证据日期/tier/URL · V18 榜单 change/delta 语义 · **V19 历史快照与 rankings 一致** · **V20 source-health 字段合法（可选）**。
当前结果：**20/20 PASS，退出码 0**。

## 11. 更新 SOP

1. 改机会/数据：`python scanner/pipeline.py --all`（自动物化 + 榜单 + 历史快照 + stats + SQLite + 校验）。
2. 只重建数据库：`python scanner/db.py --rebuild`；只出报告：`python scanner/report.py --all`。
3. 真实采集：`python scanner/pipeline.py --fetch`（联网）→ 人工复核 `scanner/outbox/` → 需要入库时手工改写 `opportunities.json` 再 `--all`。
4. 改 taxonomy：禁止增删 id；改结构必须升 `data_version` + 更新 docs/12 + CHANGELOG + 通知 Lead/前端/红队。
5. 每次数据变更：CHANGELOG → `--all` → `validate.py` 退出码 0 → 通知前端重新 sync。新增机会须满足四窗口配额与覆盖要求。

## 12. 免责

机会卡片是研究假设与公开信息整理，**不构成投资建议、法律意见或收入承诺**。涉及跨境、金融、医疗、法律、宗教、内容版权时请自行做合规核查。`data/calendar.json` 中宗教节日日期为预计值，以当地观月/官方公告为准。
