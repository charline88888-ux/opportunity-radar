# data/ 数据底座使用说明（data-v0.1.0）

> 唯一接口标准：`docs/12-数据契约与字段字典.md`（已冻结）。本目录所有 JSON 必须通过 `python scanner/validate.py`（V01–V18，退出码 0）。
> 数据基准日 `as_of = 2026-10-22`（Asia/Shanghai），当前周 `2026-W43`（10-19～10-25），当前月 `2026-10`，当前年 `2026`。

## 1. 文件清单与规模（data-v0.1.0）

| 文件 | 作用 | 规模 | 生产者 | 消费者 |
|---|---|---|---|---|
| `taxonomy.json` | 14 行业（color/icon）/ 12 人性需求 / 6 神经递质 / 24 情绪 / 12 信息差 / 7 驱动 / 12 商业模式 / 11 区域 / 10 评分维度 / 20 标签 / 5 等级 | 11 组固定枚举 | 数据工程（手工） | 全队 |
| `opportunities.json` | 机会库 | **46 条**，14 行业各 ≥1、11 区域全覆盖、12 类信息差全覆盖、38 个目标国家/地区、18 条中国供应链/中文市场角度 | 数据工程（撰写 + 扫描器物化） | 前端、扫描器 |
| `rankings.json` | 日/周/月/年唯一权威榜单 | day 8 / week 15 / month 23 / year 46 | 扫描器 | 前端 |
| `stats.json` | 首屏 KPI 与图表聚合 | KPI + 4 组分布 + 直方图 + 14 天趋势 | 扫描器 | 前端 |
| `sources.json` | 数据源矩阵 12 大类 | **63 个平台**（含访问方式/频率/成本/合规/价值分/坑） | 数据工程（引用 research/platform-matrix-validation.md） | 前端、战略 |
| `playbooks.json` | 扫描剧本 | **12 个**（steps ≥5、platforms ≥2、含关键词与质检点） | 数据工程 | 前端、运营 |
| `calendar.json` | 全球商业日历 2026-11～2028 | **33 个节点**（宗教/节日/税季/开学/财政年/购物节/国庆） | 数据工程 | 前端、方法论 |

前端构建前由 `node scripts/sync-data.mjs` 把本目录 `*.json` 整体拷入 `app/src/data/`；前端只读、不写回、**不重算榜单窗口归属**。

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

`python scanner/pipeline.py --all` 会重算上述字段、不一致时自动回写（契约 5.2.1「以计算值为准」），**幂等**：重复运行不改变文件内容（已验证文件哈希一致）。数据中的评分向量已避开 `.xx05` 四舍五入歧义边界，Python Decimal 与前端 JS 严格自检交叉验证 0 差异。

## 3. `window` 语义（docs/12 §4.7）

- `months_left`：人工估算的仍可切入月数（整数 1–36），估算口径 = 主信息差半衰期 × 调整系数（0.5–1.0）− 已过月数，向上取整；它是判断辅助，不是精确预测模型。`status` 由 `months_left` 推导：`open` ≥ 9；`peak` 3–8；`closing` 1–2；`closed` 0。
- `decay`：由主信息差半衰期推导——`slow` ≥ 24 个月、`medium` 12–23、`fast` < 12（平台 6 / 时间与渠道 9 / 价格 12 / 情绪与地理 18 / 语言与监管与基础设施 24 / 认知与人口 30 / 文化 36）。
- 当前数据全部为 `open` 或 `peak`（v0.1.0 允许），V16 校验映射一致性。

## 4. 榜单窗口与 delta 口径（docs/12 §5.1）

- `day` = `last_activity == 2026-10-22`；`week` = ISO 周 `2026-W43`；`month` = `2026-10`；`year` = `2026`。同一机会可同时出现在多个窗口。
- 排序链（docs/12 §5.1）：`rank_score` 降序 → `momentum` 降序 → `evidence_count` 降序 → `last_activity` 降序 → `opp_id` 升序；`rank` 从 1 连续（口径同步写入 `rankings.json.meta.tie_breaker`）。
- `delta` = 相邻更大窗口名次 − 本窗口名次（day←week、week←month、month←year，year 无参照 → `delta:null, change:"new"`）；`change ∈ {new,up,down,flat}`。口径以保证金句以 `rankings.json.meta.delta_rules` 为准。
- 配额：day ≥ 6、week ≥ 12、month ≥ 20、year ≥ 40（当前 8/15/23/46）。

## 5. 证据与可信度分级

- `verified: true`（5 条：`opp-local-furusato-nozei-024`、`opp-local-umrah-service-025`、`opp-crossborder-kbeauty-029`、`opp-crossborder-mercadolibre-030`、`opp-manufacturing-shea-butter-031`）：其**全部** `evidence[].url` 已由数据工程/研究组实际打开核验（HTTP 200，内容与 title/quote 一致）。
- `verified: false`：链接来自公开检索或官方页面，**未逐条打开核验**（或仅部分可访问）；`compliance_notes` 已说明。使用前必须自行复核原始来源。
- 过程修正：`opp-compliance-eaa-accessibility-034` 原引 France Num 页面实测 404，已改用 EUR-Lex 官方指令（2019/882）并置 `verified:false`；DEHSt CBAM 页面抓取时处于维护页，相关机会保留 `verified:false`。**不编造 URL 与数据。**
- `evidence[].date` 口径：优先来源发布日；无法确认发布日时取检索/核验日（2026-10-20 或 2026-10-22），并写在该机会 `compliance_notes`。
- `evidence[].quote` 口径：优先原文摘录；若只能获得平台店铺页/社区首页（无法取得具体评论或帖子链接），引文降级为「品类存在 / 社区讨论主题 / 产品功能」级别的事实描述，并在 `compliance_notes` 说明、保持 `verified:false`，不编造新 URL。
- 三角验证：`verified:true` 中 024 有 2 条独立证据；025/029/030/031 为单一权威一手来源（PEP / Yonhap / MercadoLibre / Xinhua，均实测 200），第二独立来源列为后续补强项（契约 §2 为「优先」而非强制）。
- `tier`：`primary` 一手（官方文件/平台数据/用户原声）｜`secondary` 二手（媒体报道/研究报告）｜`marketing` 营销稿（不计入证据分）。

## 6. `sources.json` 口径

- 12 大类固定 id：`demand / trend / marketplace / social / policy / capital / academic / supply / culture / talent / data / platform`。
- `access ∈ {api,rss,html,manual,paid-api}`；`frequency ∈ {realtime,daily,weekly,monthly,quarterly,yearly,manual}`（`yearly` 为契约冻结前补充，GEM/Pew/Hofstede/WVS 等年度源合法）；`cost ∈ {free,freemium,paid}`；`compliance ∈ {green,yellow,red}`。
- `last_checked`（2026-10-22）与 `check_result`（http_200/http_403/http_429/login_required/doc_only/fetch_failed）来自 `research/platform-matrix-validation.md`。红/黄源只允许人工浏览，不自动抓取、不绕过登录与验证码。

## 7. `stats.json` 结构（前端图表直接取用）

```
kpi: { total_opps, new_today, new_first_seen_today, grade_a_plus, industries_covered,
       regions_covered, avg_total, verified_count, evidence_total }
by_grade: { S, A, B, C, D }
by_industry / by_gap_type / by_region / by_need: [{ id, name, count, avg_total }]（含 0 计数项）
score_histogram: [10 个整数]，对应 score_histogram_ranges: ["0-9",...,"90-100"]
trend_14d: [{ date, new_count, active_count, avg_score }]（as_of 往前 14 天）
open_window_value_cny: status ∈ {open, peak} 的机会月度收入上限之和（估算值，非收入承诺）
```

## 8. 校验（docs/12 §9，`python scanner/validate.py`）

V01 枚举完整性 · V02 数量/行业/区域覆盖 · V03 证据链与 evidence_count · V04 七问齐全 · V05 评分公式 · V06 窗口枚举 · V07 日期链 · V08 榜单配额与 rank 连续 · V09 榜单与重算一致 · V10 数据源矩阵 · V11 剧本 · V12 日历 · V13 禁用词 · V14 stats 聚合一致 · V15 id/slug 唯一 · **V16 必填字段完整性与窗口映射** · **V17 证据日期/tier/URL** · **V18 榜单 change/delta 语义**。
当前结果：**18/18 PASS，退出码 0**。

## 9. 更新 SOP

1. 改机会：编辑 `opportunities.json` → `python scanner/pipeline.py --all`（自动物化派生字段 + 重算榜单/统计 + 校验）。
2. 改 taxonomy：**禁止增删 id**（契约冻结）；只允许补 `name/desc/color/icon` 等展示字段，并按 docs/12 §10 升 `data_version` + 更新 `CHANGELOG.md` + 通知 Lead/前端/红队。
3. 每次数据变更：更新 `data/CHANGELOG.md` → `python scanner/pipeline.py --all` → `python scanner/validate.py` 退出码 0 → 通知前端重新 sync。
4. 新增机会必须满足四窗口配额与 covered 要求（14 行业、≥10 区域、12 类信息差、≥30 国家/地区），否则 V02/V08 失败。
5. 证据核验：新增 `verified:true` 前必须逐条打开 URL；不确定就 `verified:false` 并在 `compliance_notes` 说明。

## 10. 免责

机会卡片是研究假设与公开信息整理，**不构成投资建议、法律意见或收入承诺**。涉及跨境、金融、医疗、法律、宗教、内容版权时请自行做合规核查。`data/calendar.json` 中宗教节日日期为预计值，以当地观月/官方公告为准。
