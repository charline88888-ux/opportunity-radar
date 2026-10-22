# 早期静态审查报告（qa/early-review.md）

> 项目：机会雷达 Opportunity Radar · v0.1.0
> 审查人：redteam（红队负责人）　｜　任务：task-8（早期静态审查）
> 审查快照时间：2026-10-22 10:00（Asia/Shanghai）
> 审查范围：docs/01–05、docs/12 契约、scanner/ 代码、research/cases.md、data/taxonomy.json（已产出部分）
> 原则：**只报告、不代改**；所有结论可复现。数据/前端仍在生产中的，按「快照状态」记录，发布前需按阶段 2 复核。

---

## 0. 结论摘要

| 项 | 结论 |
|---|---|
| P0（阻塞发布/造假/白屏/公式不一致） | **0 个**（截至本快照） |
| P1（发布前必须修） | **6 个**：scanner 静默补 0、validate 缺必填字段校验、评分单元测试缺失、scanner/README 缺失、docs/04 对 docs/12 的错误指控、前端当前数据为 mixed（mock 占位）不得进入发布构建 |
| P2（建议修） | 12 个（见 §2） |
| 契约一致性（权重/公式/阈值/窗口/枚举/七问/ROI） | 文档侧**一致**；实现侧有 1 处舍入方式不一致（P2）；契约本身有 3 处定义缺口（delta 口径、round 口径、months_left 语义） |
| scanner 代码 | `py_compile` 全部通过；纯标准库；确定性 OK；异常处理分层合理；公式实现与契约一致（除舍入细节） |
| 研究底稿 URL 实测 | 抽查 8 条：**8/8 HTTP 200 且内容与描述相符**；1 条标 ⛔ 的 URL 实测确实 403，标注诚实 |
| 当前 `scanner/validate.py` | **10/15 通过、5 失败**（数据未就绪：机会数 12、榜单 day=4、sources/playbooks/calendar 缺失）——属预期，不计入缺陷 |
| 早期结论 | 文档质量整体高于预期、可执行性强；**当前不满足发布条件**（数据/前端/扫描器测试未完成） |

---

## 1. 审查基线与方法

- 逐份通读 docs/01–05 与 docs/12 契约；用脚本核对 `data/taxonomy.json` 计数/权重/等级/半衰期；用 Python 复算 docs/04 §8 全部 7 个评分案例；用 `date.isocalendar()` 验证 ISO 周；用 `web_fetch` 实测 research/cases.md 链接。
- 自动核对：`python -m py_compile`（scanner 全部 .py）、`python scanner/validate.py --json`。
- 文档现状快照（审查时最后写入时间）：
  - docs/01 2026-10-22 09:52:13（72,763 B）｜docs/02 09:52:13（97,158 B）｜docs/03 09:53:30（124,214 B）｜docs/04 09:50:47（99,183 B）｜docs/05 09:52:49（67,612 B）｜docs/12 09:50:33（28,255 B）
  - docs/05 已从「写到 §2.5 的半成品」完成到 1,050 行、§0–§8 全部章节。
  - 文件名现状：`docs/05-商业驱动七问框架.md`（短名）；README/docs/00/01/03/08 的交叉引用均已同步为短名，**无断链**。

---

## 2. 问题清单

### 2.1 P0（0 个）

无。当前快照未发现数据造假、白屏、公式不一致、明确合规红线或伪造证据。

### 2.2 P1（6 个，发布前必须修）

| # | 文件:行号 | 问题 | 建议 | 负责人 |
|---|---|---|---|---|
| P1-01 | `scanner/materialize.py:83-84` | 缺失评分维度被**静默填 0.0**（`raw_dims.get(dim_id, 0.0)`），与 docs/04 §10.3「维度缺失 → 抛错，不默认 0」、docs/12 §4.5「dimensions 恰含 10 维」直接冲突。若 data-engineer 用 `--fix`，会把「没有依据的 0 分」固化进 opportunities.json，且此后 V05 只校验 10 键齐全，**无法再发现**。 | 缺维度直接 raise（聚合到 materialize_all 的 issues 后 exit 1）；0 分必须显式写入数据。 | data-engineer |
| P1-02 | `scanner/validate.py`（V-rules 全局） | 契约必填字段无校验：①`disclaimer`（docs/12 §2「所有机会必须带」、§4.1 ✅）；②`roi` 结构与类型（docs/12 §4.4）；③证据 `date ≤ as_of`；④`signal.signal_strength ∈ [0,10]`；⑤`momentum` 1 位小数/范围。当前删掉 disclaimer、把 roi 写坏的 opportunities.json 仍能 V01–V15 全 PASS（V13 扫不到缺失字段）。 | 建议在 docs/12 §9 增加 V16（必填字段/ROI schema/免责声明/证据日期）并同步 validate.py；契约变更走 §10 流程（或由 Lead 明确 v0.1.0 以 V01–V15 为准、这些降级为 P2）。 | data-engineer + Lead（契约） |
| P1-03 | `docs/04:539-540`、`docs/04:1795` | **对契约的错误指控（已过时）**：docs/04 称「docs/12 §4.6 示例标注 total: 78.6、rank_score: 81.4，与其公式重算不一致」。实测当前 docs/12:247/294/305 已写 **78.9 / 81.7**，且 `data/CHANGELOG.md` 记载「按 Lead 修正：docs/12 §4.6 示例数值修正为 total=78.9 / rank_score=81.7」。docs/04 的「已知样例偏差（必读）」与评分日志示例 `notes` 均为陈旧结论，会误导 data-engineer 二次「修正」同一数字、也会误导红队按错误基准复核。 | 删除/改写 §3.6 该段：改为「已修复（见 data/CHANGELOG）；公式唯一，示例以 78.9/81.7 为准」；同步 §11.2 notes 与 §11.5 交接清单（Lead 待决项已关闭）。 | methodologist |
| P1-04 | `scanner/`（无测试文件） | docs/04:591「一致性断言（写入扫描器单元测试）」与 §10.4「T01–T20，给 data-engineer 直接实现」承诺的测试**不存在**（`Get-ChildItem scanner -Recurse -Filter *test*` 为空）。边界行为（84.96 舍入判级、momentum clip、rank_score min(100)、ISO 周、WVI）目前无回归保护。 | 新增 `scanner/tests/test_score.py`（纯标准库 `unittest`）实现 T01–T20；`python -m unittest` 纳入发布验收命令。 | data-engineer |
| P1-05 | `scanner/README.md` | 缺失（task-3 明确要求「含 scanner/README.md」）。扫描器用法、模块职责、--fix 风险、build 目录说明、测试命令均无文档。 | 补 README：命令、数据流（fixtures→normalize→dedupe→score→rank→stats→validate）、`--fix` 警示、T01–T20 运行方式。 | data-engineer |
| P1-06 | `app/src/data/_meta.json` + `app/scripts/sync-data.mjs` | 前端当前数据为 **mixed**：sources/playbooks/calendar 为 mock 占位（`mock_files` 三项），opportunities/rankings 为 12 条早期真实数据。`pnpm build`（strict）当前必然失败；若误用 `build:demo` 发布，会把「mock 数据 + 演示数据角标」带上线——违反「真实数据交付」与契约 §1「不允许多份手写副本」的精神。 | 发布构建只能走 strict：`node scripts/sync-data.mjs --strict` 必须 exit 0 且 `_meta.json.source == "real"`；发布前检查 dist 内无「演示数据/mock」文案。 | frontend + data-engineer |

### 2.3 P2（12 个，建议修，不阻塞）

| # | 文件:行号 | 问题 | 建议 | 负责人 |
|---|---|---|---|---|
| P2-01 | `scanner/common.py:90-91` | 舍入实现为 `round(value + 1e-9, 1)`（Python 银行家舍入 + epsilon 补偿），与 docs/04:1674 锁定的 `Decimal ROUND_HALF_UP` 不一致。绝大多数输入结果相同（有 ±0.05 容差兜底），但属「文档要求 = 实现」不符，且 epsilon 对「恰好 .5 以下 1e-9」的输入会向上多舍。 | 改为 `Decimal(str(x)).quantize(Decimal("0.1"), ROUND_HALF_UP)`（docs/04 §3.5 已给实现），或改文档为显式允许 epsilon 方案。 | data-engineer + methodologist |
| P2-02 | `scanner/rank.py:10-12` vs `docs/12:330` | `delta` 口径：rank.py 定义为「相对相邻更大窗口」（day←week, week←month, month←year, year 无参照），契约只写「相对上一窗口名次变化」，歧义。前端若标「较昨日」会与实现矛盾。 | 在 docs/12 §5.1 明确参照窗口（建议直接采用 rank.py 口径，且 v0.1.0 无历史快照，必须写清）；前端 tooltip 用「相对周榜排名」。 | Lead（契约）+ data-engineer + frontend |
| P2-03 | `scanner/rank.py:28` | 排序键额外加 `-total, id` 作为 tie-breaker，契约只规定按 `rank_score` 降序。V09 由同一实现自洽，但前端演示重算/未来实现可能不一致；并列时顺序成为隐式契约。 | 在 docs/12 §5.1 写明 tie-breaker（rank_score → total → id 升序），V09 同时校验降序 + 并列规则。 | Lead + data-engineer |
| P2-04 | `docs/04:499` | ISO 周示例错误：写「2026-12-28 可能属于 2027-W01」；实测 `date(2026,12,28).isocalendar() == (2026, 53, 1)`，属 **2026-W53**（docs/04:1679 与 T15 自己也是 W53）。 | 把示例改为「2026-12-28 → 2026-W53；2027-01-04 → 2027-W01」等正确样例。 | methodologist |
| P2-05 | `docs/04:1336` | 案例 D 写「H = 24（infrastructure）→ slow」，但 §8.8 对比表同案例主 gap 为 `infrastructure+price`；按 §4.1「组合取最短半衰期」应为 min(24,12)=**12 → medium**。 | 修正为 H=12/medium，或把该案例 gap 改为仅 infrastructure 并同步对比表。 | methodologist |
| P2-06 | `docs/04:676-684`、`docs/12:295` | `window.months_left` 语义未定义：docs/12 示例写 18，按 docs/04 WVI/寿命模型只余约 7 个月（差 11 个月 > 6 个月复核阈值）。文档自己也标注「需 data-engineer 明确语义」，但至今无结论、无复核记录。 | 在 docs/12 §4.1 与 data/README 明确 months_left = 「剩余月数」还是「窗口总寿命」，并统一重估 40+ 条数据；在 qa 复核记录中留痕。 | Lead + data-engineer |
| P2-07 | `validate.py:254`、`validate.py:335` | 校验器**比契约更严**：V04 增加「七问字段 <12 字即失败」；V07 增加「first_seen 不得早于 activity_dates 最小值」。契约 V04/V07 未规定。可能误杀合规数据，也让「契约=唯一标准」失效。 | 二选一：把限制写进 docs/12（升数据版本），或从 validate.py 移除/降级为 warning。 | data-engineer + Lead |
| P2-08 | `scanner/validate.py`（建议新增检查点） | 证据 `date` 未校验 ≤ as_of（可写入未来日期证据）；`evidence` 2–4 条「优先」未提示；`source_langs`/`origin_country` 无基本格式校验；`business_models` 无机会字段引用（当前无该字段，属信息项）。 | 把「未来日期证据」纳入 P1-02 的 V16；其余按需。 | data-engineer |
| P2-09 | `scanner/pipeline.py:109-132` + `scanner/validate.py:369-373` | 榜单生成用 materialize 后的重算值，V09 用文件值重算；当文件 rank_score 与重算值差 ≤0.05 且两条机会分差极小/相等时，排序可能翻转，V09 偶发不一致（当前数据未触发）。 | 固定单一权威来源：要么 `--all` 先 `--fix` 再排榜，要么 V09 也按 recompute 后的值重算；并在 V05 对「文件 vs 重算」差异 >0 即 warning。 | data-engineer |
| P2-10 | `scanner/dedupe.py:105` | 去重报告 `merge_groups[].kept = ids[0]`，但实际保留的是 `_merge_group` 选出的 primary（可能不是 ids[0]），报告与产物不一致（只影响 build 报告，不影响主数据）。 | kept 写 primary 的 signal_id。 | data-engineer |
| P2-11 | `scanner/normalize.py:64` | `EMOTION_KEYWORDS` 含 `"complaint_zh"`，不是 taxonomy 合法 emotion id，会出现在 `emotion_hints` 中，下游若直接引用会触发 V01 类错误。 | 合并进 `complaint`，或删掉该键。 | data-engineer |
| P2-12 | `docs/01:115-116/136/878-879`；`docs/01:136` vs `docs/00:145-148` | 90 天目标三处不一致：①指标树「付费订阅 90 天 ≥10、MRR ≥¥1,000」（115-116 行）vs P2「付费 ≥3 人」、K06「≥3」、K07「MRR ≥¥300」（136/878/879 行）；②P0 阶段「T0~T0+30 天完成 3 个验证实验」vs 本文 §10.1 计划（W2 第一个、W4 第二个、W7 第三个 ≈ 63 天）vs docs/00 §8（W3–4/W5–6/W9–10）。 | 统一为一条基线：建议以 §10.1 周计划 + K 表为准（90 天付费 ≥3、MRR ≥¥300、P0 不写「30 天 3 个实验」），docs/00 路线图同步。 | strategist + Lead |

### 2.4 其他观察（不计入问题数）

- `docs/02:817-830` 源健康度用 A/B/C/D 分级（A≥85/B70-84.9/C50-69.9/D<50），与 docs/12 机会等级 S/A/B/C/D 同形不同义；建议 UI/文档显式写「源健康 A 级」，避免与机会等级混淆。
- `docs/02:496`、`docs/12` 与 research 的核验结论一致；docs/02 §11「待验证清单」是**带验证方法+截止日的行动清单**，不算空话/未完成项（15 项均可在 2026-11 前验证）。
- `docs/05:885` JSON 模板 `disclaimer` = 「研究假设，非投资建议；使用前请核验原始来源」，与 `scanner/config.py:55`、docs/12 §4.6 示例（含「示例数据用于演示」）不同；建议模板直接引用 config 常量文本，避免前端/数据出现三套免责声明。
- `docs/03` §5 标题在审查过程中由「37 条」修正为「39 条」（当前 685 行 + 表 1–39），已自洽；记录留痕。
- `scanner/build/` 内含 4 个中间 JSON 与 3 份分片机会（`parts/opps_a/b/c.json`，合计约 135 KB）及 `__pycache__`；根 `.gitignore` 只忽略 pycache，`scanner/build` 未被忽略（仅内部一个 `.gitignore` 声明 `*`）。建议把 `scanner/build/` 加入根 `.gitignore`，防止半成品数据被误当真实数据/误提交。
- `docs/04:500` 要求「扫描器统一用 `zoneinfo`」；实际 scanner 全用 `date`（无时区换算），对「按 Asia/Shanghai 日界」反而更安全。建议改文档为「全部以 date 处理，不做时区换算；adapter 采集时间戳统一 +08:00」，避免实现者做无意义依赖。
- `docs/00:195-204`「验收结果」表已预填「数据校验 V01–V15 全 PASS / 红队结论见 qa/report.md（P0 问题 0 个方可发布）」——当前实际 validate 为 10/15 通过。属 Lead 文档，**发布前必须用红队实测结果替换**，否则构成「未验证即宣称通过」的诚信问题。

---

## 3. 契约一致性核对（docs/12 为唯一标准）

### 3.1 自动核对结果（`data/taxonomy.json`，脚本实测）

| 项 | 契约要求 | 实测 | 结论 |
|---|---|---|---|
| industries | 14，固定 id | 14，id 全部匹配 | ✅ |
| human_needs | 12 | 12 | ✅ |
| neuro_drivers | 6 | 6 | ✅ |
| emotions | 24 | 24 | ✅ |
| gap_types | 12（含默认半衰期） | 12，半衰期 language24/culture36/time9/geo18/knowledge30/regulation24/platform6/price12/channel9/demographic30/emotion18/infrastructure24 | ✅ |
| drivers | 7 | 7 | ✅ |
| business_models | 12 | 12 | ✅ |
| regions | 11 | 11 | ✅ |
| score_dimensions | 10，权重合计 1.00 | 10；0.15×4+0.10+0.08+0.07+0.05×3 = 1.00（浮点 1.0） | ✅ |
| grades | S≥85 / A≥75 / B≥65 / C≥55 / D≥0 | 完全一致 | ✅ |
| tags | 20 | 20 | ✅ |
| desc / anchors | 枚举含 name/desc；10 维含 anchors | 全部非空 | ✅ |
| meta.counts | 与数组一致 | 全部一致 | ✅ |

### 3.2 文档侧一致性

| 契约项 | 结论 | 证据（文件:行号） |
|---|---|---|
| 10 维 id/权重/理由 | ✅ 一致 | docs/04:72-87（权重合计校验 1.00）、docs/04:1518-1557（机器常量 JSON）；docs/03:27、docs/01:5 均声明「以 docs/12 为准」 |
| `total` 公式 | ✅ 一致 | docs/12:249-253；docs/04:406-430；docs/04:524-540 复算正确（78.886→78.9） |
| `rank_score` 公式 | ✅ 一致 | docs/12:252；docs/04:454-458；docs/04:580-582 伪代码 |
| 等级阈值 | ✅ 一致 | docs/12:143；docs/04:466-484；docs/04:1535-1541 |
| 窗口归属 | ✅ 规则一致 | docs/12:327；docs/04:486-501；`scanner/rank.py:31-49` 与 `common.iso_week_key` 实现一致（W43 验证：2026-10-22 isocalendar=(2026,43,4)） |
| 枚举 id/数量 | ✅ 一致 | docs/03 §4/§9（12 gap 全表、6 递质、12 需求、14 行业）；docs/05:584-599（12 商业模式逐条对齐 docs/12 §3.7）；docs/02:135-162（12 采集大类 id 与 docs/12 §6 完全一致） |
| 七问字段 | ✅ 一致 | docs/05:28-42 与 docs/12 §4.3 七个字段一一对应（traffic/money/model/roi/audience/drivers/moat），并正确区分「七问文字版 roi」与顶层结构化 `roi` |
| ROI 字段 | ✅ 一致 | docs/05:871-876 JSON 模板与 docs/12:222-235 完全一致；docs/12 示例内 `seven_questions.roi` 文字（5–6 个月回本、毛利 60–75%）与顶层 `roi`（payback 5、gross_margin 65）互洽 |
| 免责声明 | ⚠️ 文本三处略异 | docs/12:306 示例 vs `scanner/config.py:55` vs docs/05:885（缺「示例数据用于演示」），属 P2 观察 |

### 3.3 docs/04 §8 七案例复算（红队独立复算）

| 案例 | 文档 total | 复算 | 文档 rank_score | 复算 | 结论 |
|---|---|---|---|---|---|
| A 宠物纪念玻璃 | 78.9 | 78.9 | 81.7 | 81.7 | ✅ |
| B 中东宗教内容 | 78.6 | 78.6 | 80.5 | 80.5 | ✅ |
| C 日本宠物推车 | 72.0 | 72.0 | 72.9 | 72.9 | ✅ |
| D 尼日利亚太阳能 | 71.3 | 71.3 | 75.6 | 75.6 | ✅（H 取 min 有误，见 P2-05） |
| E 海湾合规咨询 | 74.4 | 74.4 | 74.4 | 74.4 | ✅ |
| F AI 语音陪伴 | 64.5 | 64.5 | 63.7 | 63.7 | ✅ |
| G 越南代运营 | 71.7 | 71.7 | 75.1 | 75.1 | ✅ |

> 复算脚本口径：Σ(dim×weight)，ROUND_HALF_UP 1 位；rank_score = min(100, total×(1+0.12×(m−1)))，1 位。

---

## 4. 逐文档审查（每份 ≥3 个可执行性检查点）

### 4.1 docs/01 业务蓝图与商业模式（770+ 行）

**可执行性检查点**
1. **NSM 可计算**：§1.2 定义「每 ISO 周完成 7 天验证实验并回填结论文档的机会数」+ 5 项必填判据 + 证据要求 → 可被实验追踪表直接判定。✅
2. **90 天路线可验收**：§10.1 W0–W13 每周有「关键动作/交付物/验收标准」，§10.2 只保留 4 个里程碑且有「不达标处理」。✅（但目标数字有冲突，见 P2-12）
3. **KPI 可审计**：§11.1 K01–K15 均有公式/数据源/频率；§11.5 有造假自查。✅

**问题**：P2-12（90 天目标三处不一致、与 docs/00 路线冲突）。

### 4.2 docs/02 平台与数据源全矩阵（836+ 行）

**可执行性检查点**
1. **源注册表字段可落地**：§7.1 给出契约字段 + 6 个运营扩展字段（last_checked/fail_streak/items_30d/health 等），可直接建表。✅
2. **健康度公式可计算**：§7.2 `health_score = 可用性×0.40 + 增量×0.25 + 合规×0.20 + 独家×0.15`，分级 A/B/C/D 有阈值与处置动作。✅
3. **失效判定/替换 SOP 可执行**：§7.3 六类触发条件 + 处理动作 + 时限；§8.1 每日请求预算与免费额度可对账。✅
4. **采集动作可照做**：§6 每类 5 个动作（60 个），§9 十条合规红线明确「见墙即停」。✅

**问题**：源健康 A/B/C/D 与机会等级同形不同义（观察项，建议显式区分）；§11 待验证清单 15 项建议按截止日跟踪（属运营动作，不是缺陷）。

### 4.3 docs/03 扫描方法论（1,600+ 行）

**可执行性检查点**
1. **六步链逐步可操作**：§2.1–2.6 每步有输入/动作/产出/判断标准/失败信号；§2.7 两个完整走查案例。✅
2. **信号强度可量化**：§3.8 给出 0–10 评分公式与档位；§3.9 噪声识别清单。✅
3. **12 类信息差可执行**：§9.1–9.12 每类含「本质/识别信号/验证方法/变现方式/案例方向/陷阱」，半衰期与契约一致；§9.13 组合矩阵取最短半衰期。✅
4. **国家 checklist 可落地**：§8.1–8.14 共 14 国，每国「五问 + 信号源关键词 + 7 天验证」。✅

**问题**：无 P1；§5 标题计数已修正为 39 条（留痕）。

### 4.4 docs/04 评分体系（1,845 行）

**可执行性检查点**
1. **评分锚点可判定**：§2.1–2.10 每维 0/2/5/8/10 档均为可观察行为描述 + 常见偏差 + 数据来源。✅
2. **公式/伪代码/测试用例完整**：§3 公式与伪代码；§10.1 常量 JSON；§10.2 Python 伪代码；§10.4 T01–T20 测试用例可直接实现。✅（但测试未落地，见 P1-04）
3. **窗口/衰减可计算**：§4 半衰期表、WVI/L 公式、状态判定优先级表、衰减曲线。✅
4. **防操纵/回测可执行**：§6 证据三角、营销稿 12 特征、6 项刷量特征；§7 Brier/校准曲线/回测模板。✅

**问题**：P1-03（错误指控）、P2-04（ISO 周示例）、P2-05（案例 D 半衰期）、P2-06（months_left 语义）、`zoneinfo` 要求与实现不符（观察）、舍入方式与 scanner 不一致（P2-01）。

### 4.5 docs/05 七问框架（1,050 行，审查时已完稿）

**可执行性检查点**
1. **七问模板能直接填**：§0.2 字段映射、§0.3 不合格/合格/优秀三档标准、§1.1–1.7 每问含必答结构/信息来源/判断标准/常见错误/追问清单/双行业示范。✅
2. **驱动判定可执行**：§2.1 判定树（命中即停）+ §2.2 七类驱动深表 + §2.3 演练 + §2.5 常见误判。✅
3. **卡片/尽调可复制**：§6.1 机会卡片 Markdown 模板、§6.2 JSON 模板（对齐 docs/12 §4）、§6.3 一页纸尽调 35 项、§7 两个完整示范。✅
4. **壁垒清单可判定**：§4.1 14 种壁垒含定义/建立方法/前置条件/验证方法/个人可行性。✅

**问题**：P2 观察（disclaimer 文本）；其余无阻塞。

---

## 5. scanner/ 代码审查

### 5.1 通过项

- `python -m py_compile`：`scanner/*.py` 与 `scanner/adapters/*.py` 全部通过（递归批量编译无输出）。
- **纯标准库**：`json/hashlib/re/unicodedata/datetime/pathlib/urllib/typing/abc/email.utils/argparse/sys`——无第三方依赖。✅
- **公式实现一致**：`score.py:29-37` total、`score.py:47-50` rank_score、`score.py:40-44` grade（阈值来自 taxonomy，避免硬编码漂移）、`score.py:33-35` 权重合计 1.00 校验。✅
- **确定性**：无随机数；排序键完整（rank_score → total → id）；hashlib 生成 signal_id；dedupe 用并查集 + 固定顺序；同一输入重复运行输出一致。✅
- **异常处理分层**：adapter 单源失败不拖垮流水线（`adapters/__init__.py:44-48`）；materialize 聚合错误（`materialize.py:102-107`）；validate 每条规则独立捕获（`validate.py:77-88`），退出码 0/1 正确。✅
- **窗口实现**：`rank.py:31-49` + `common.iso_week_key` 与契约一致；`day=last_activity==as_of`、ISO 周、月、年；同一机会可多窗口共存。✅
- **stats 生成**：KPI/分组/直方图/trend_14d/open_window_value 与 docs/12 §5.2 要求字段对齐（多出 active_count 属兼容扩展）。✅

### 5.2 问题

- P1-01（静默补 0）、P1-02（校验缺口）、P1-04（无测试）、P1-05（无 README）。
- P2-01/02/03/07/08/09/10/11 见 §2.3。
- `rank.py:37-40` 对非法 `last_activity` 静默 `continue`（该机会不进入任何窗口）；建议改为收集错误并在 stage 报错，避免「数据坏了但榜单静默少一条」。
- `pipeline.py:35-39` 在 `scanner/build/` 内写 `.gitignore` 属临时代码；建议根 `.gitignore` 统一忽略 `scanner/build/` 与 `qa/tmp/`（后者已忽略）。

### 5.3 当前 validate 运行结果（快照）

```
python scanner/validate.py
V01 PASS / V02 FAIL（12<40）/ V03 PASS / V04 PASS / V05 PASS / V06 PASS / V07 PASS
V08 FAIL（day=4<6）/ V09 PASS / V10 FAIL（sources.json 缺失）
V11 FAIL（playbooks.json 缺失）/ V12 FAIL（calendar.json 缺失）
V13 PASS / V14 PASS / V15 PASS
结果：10/15 通过，5 条失败（退出码 1）
附加提示：区域覆盖 7/11、目标国家 18<30、中国供应链角度 3<12
```

> 说明：失败项均为「数据阶段 B 未完成」的预期结果，**不构成本次文档/代码缺陷**；但发布前必须 15/15 通过（exit 0）。

---

## 6. research/cases.md URL 实测（web_fetch，8 条）

| # | URL | 底稿声明 | 实测（2026-10-22） | 符合性 |
|---|---|---|---|---|
| 1 | https://www.sohu.com/a/952762371_121478199 | 宠物殡葬：全球市场 2024 $19.7亿→2025 $21.8亿、2034 $41亿 CAGR9.1%；景德镇工厂年销 6000 万+；Amazon 近 30 天 1000+/$3.4 万；Etsy 日均 1400 万+、80% 女性；#petfuneral 1000+、单条 50.78 万播放 | HTTP 200；上述数字与表述逐条命中（原文 2025-11-10） | ✅ 相符 |
| 2 | https://zellerhausart.com/blog/spirit-pieces-review | Spirit Pieces 玻璃 $129–299、珠宝 $69–549、区间 $70–550、约 6 周、半茶匙骨灰、纪念画 $4,900 起 | HTTP 200；逐项命中（作者 Preston Zeller，2026-08） | ✅ 相符 |
| 3 | https://www.rieti.go.jp/jp/columns/a01_0805.html | 故乡纳税 83.4% 用户计划继续用同一门户；类别占比等 | HTTP 200；83.4%、39.7%/36.8%/28.7%/23.6% 等全部命中 | ✅ 相符 |
| 4 | https://www.shinmai.co.jp/news/article/gfkn2026073101001609 | 2025 年度故乡纳税总额 1 兆 3,314 亿日元（+587 亿，连续 6 年新高） | HTTP 200；标题与正文「1兆3314億円」命中 | ✅ 相符 |
| 5 | https://en.yna.co.kr/view/AEN20260109010100320 | 韩国 K-beauty 2025 出口 $114.3 亿、+12.3%、202 个进口国 | HTTP 200；$11.43B、12.3%、202 countries 命中 | ✅ 相符 |
| 6 | https://www.huaon.com/channel/trend/1168058.html | 中国谷子经济 2025 年 2,021 亿元、+19.7% | HTTP 200；2021 亿元、19.7% 命中 | ✅ 相符 |
| 7 | https://pep.gov.sa/en/news/1011 | 2025 年 1,950 万国际朝觐/Umrah 人次、签证 1,503 万（Umrah 占 83%） | HTTP 200；19.5M、15.03M visas、83% 命中 | ✅ 相符 |
| 8 | https://my.gov.sa/en/news/1692043 | 底稿标「⛔403 Cloudflare」 | 实测 HTTP 403 Cloudflare 拦截页 | ✅ 标注诚实 |

**结论**：抽查 8/8 通过；research/cases.md 的链接核验状态标注与实测一致，未发现编造 URL/数字。

**建议（P3，不阻塞）**：
- cases.md:485 用动态 RSS（`reddit.com/r/Entrepreneur/.rss`）作为「扫描旧相册 $80/50 页」的证据不可复现（RSS 内容随时间变化）；建议改为「具体帖子 URL + 抓取日期」。
- C04/C05 用「万亿韩元」表述日本宠物保险市场规模（1.3 万亿韩元≈1,408 亿日元），来源是韩媒（asiae）换算；建议同时给日元原始数字并注明换算，避免读者误读为国别错配（本条未实测 asiae 原文，列入阶段 2 抽查）。

---

## 7. 发布前必须闭环的动作（对应 task-6）

1. 数据：40+ 机会、14 行业、≥10 区域、12 信息差、四窗口配额、sources/playbooks/calendar 全部就绪；`python scanner/pipeline.py --all` → `python scanner/validate.py` **exit 0（15/15）**。
2. 扫描器：P1-01/02/04/05 修复；`python -m unittest discover -s scanner/tests` 全绿。
3. 前端：`node scripts/sync-data.mjs --strict` exit 0；`cd app; pnpm build` 成功；8 路由截图人工目检（非只查文件存在）；file:// 双击可用。
4. 文档：P1-03 修复；P2-04/05/06 至少修复或由 Lead 书面接受；README/docs/00 与 docs/09 的真实验收结果（不得预填 PASS）。
5. 红队：独立复算 total/rank_score、抽查 ≥8 条证据 URL、检查 verified 诚实性（verified:true 必须全部可打开）、核对 docs/09 合规清单。

---

## 8. 复现命令

```powershell
cd 'E:\全球商机扫描器'

# 1) 编译
Get-ChildItem scanner -Recurse -Filter *.py | ForEach-Object { python -m py_compile $_.FullName }

# 2) 契约校验（数据未就绪时预期 exit 1）
python scanner/validate.py
python scanner/validate.py --json

# 3) 全流水线（数据阶段 B 完成后应 exit 0）
python scanner/pipeline.py --all

# 4) 评分复算（红队独立口径）
python - <<'PY'
print(round((8.4*.15+7.8*.15+8.6*.15+8.2*.15+7.5*.10+6.5*.08+7.8*.07+8.0*.05+7.6*.05+6.8*.05)*10,1))
PY

# 5) ISO 周验证
python -c "from datetime import date; print(date(2026,12,28).isocalendar())"

# 6) 前端（阶段 2）
cd app; node scripts/sync-data.mjs --strict; pnpm build
```

---

## 9. 审查限制与待复核

- 本报告是**早期快照**：data-engineer 仍在生产 40+ 机会与 sources/playbooks/calendar；frontend 尚未构建；docs 可能仍有微调。阶段 2（task-6）会以最新文件重跑全部检查。
- `docs/09` 与 `qa/report.md` 尚未产出（task-6 交付），本文件不替代最终验收报告。
- asiae.co.kr、部分 ⏳ 标记链接未在本次实测（已抽查 8 条覆盖 A/B 级与 ❌ 类）；阶段 2 按 ≥8 条机会证据链再抽查。
- `verified` 诚实性需在数据就绪后逐条核对（当前 12 条 opportunities 均为 verified:false，无法验证其标注策略）。

---

## 10. 留痕：审查过程中已自愈的问题

| 时间 | 现象 | 当前状态 |
|---|---|---|
| 09:50 | docs/04 末尾仅到 §7.8（`<!-- PART4 -->`），§8/§9 被 7 处交叉引用但不存在 | 09:50:47 完成后 §8/§9/§10 已在（1,845 行） |
| 09:51 | docs/05 只写到 §2.5（581 行，`<!-- PART3 -->`） | 09:52:49 完稿 1,050 行，§3–§8 齐全 |
| 09:53 | docs/03 §5 标题「37 条」但表有 39 行 | 已修正为「39 条」（685 行） |
| 09:52 | docs/05 文件更名为短名 | README/docs/00/01/03/08 引用已同步，无断链 |

> 以上说明：**并行开发期间文件会变化**，本报告所有结论以文末「快照时间」为准；阶段 2 复核时若已修复，按最新状态判定。

---

## 附录 A：契约澄清复核（2026-10-22 10:05 后追加）

Lead 于审查后更新了 contract（仍 data-v0.1.0，冻结前澄清），红队复核结论：

| 澄清项 | 契约位置 | 红队意见 |
|---|---|---|
| 舍入明确 ROUND_HALF_UP | docs/12 §4.5:253-255 | ✅ 已采纳；但**实现口径仍不够精确**：必须写成「逐维 Decimal(str(dim))×Decimal(str(weight)) 求和后再量化」，否则 float 先算再 Decimal(str(x)) 在 .05 边界会差 0.1（实测 2 条机会：`opp-local-umrah-service-025`、`opp-compliance-indonesia-halal-035` 的精确值 76.95/75.55 → 77.0/75.6，float 路径会得 76.9/75.5 触发 V05 假失败）。已通知 methodologist/data-engineer，建议在 §4.5/§10.2 写明精确实现。 |
| `window` 语义（months_left 1–36；status 映射 open≥9/peak3–8/closing1–2/closed0） | docs/12 §4.7:315-320 | ⚠️ 逻辑自洽但有一处不可达：`closed = 0` 与 `months_left 为 1–36 正整数`（V06）冲突——closed 状态无法用合法 months_left 表示。建议 months_left 允许 0，或 closed 仅用于人工下架标记（不依赖 months_left）。 |
| `delta` 口径（v0.1.0=相邻更大窗口，year=null/new） | docs/12 §5:340 | ✅ 消除了 rank.py 与契约的歧义；V18 可校验。前端 tooltip 应写「相对周/月/年榜」而非「较昨日」。 |
| V16/V17/V18 新增 | docs/12 §9:457-459 | ✅ 方向正确；**实现待落地**：截至快照 scanner/validate.py 尚未包含 V16–V18（last write 09:46），data-engineer 需补实现并重跑；红队将按新规则复验（window 映射、ROI/disclaimer、证据 date≤as_of、delta/change）。 |

> 附录 A 不改变正文 P0=0/P1=6/P2=12 的结论；其中 P1-02（校验缺口）与 P2-02/P2-06 的「契约部分」已由 Lead 关闭，剩余为**代码实现**待完成。

## 附录 B：数据阶段 A→B 早期侦察（非最终验收）

- 09:54 快照已见 46 条机会、14 行业、11 区域、12 信息差、四窗口 8/15/23/46；sources.json 63 平台/12 类；taxonomy 全量契约一致（脚本核对通过）。
- 早期发现（待 data-engineer 修复后按最终数据复验，详见 qa/report.md）：
  1. 3 条 `last_activity` 晚于 as_of（10-23/10-24）；
  2. verified:true 的 `opp-compliance-eaa-accessibility-034` 唯一证据 URL 实测 **HTTP 404**（France Num）；
  3. 88 条证据中 **52 条 date=2026-10-20**（59%），疑似批量回填而非原文发布日期；实测 cnstock 原文为 2026-08-19，数据写 2026-10-19；
  4. 部分证据 quote 无法回溯：`opp-pet-memorial-glass-001` 用 Etsy 店铺首页（403）配评论引文；`opp-gaming-arabic-l10n-043` 用 r/gamedev 首页配「阿语本地化让收入翻倍」引文（首页无该内容）；
  5. sources.json 4 条 frequency=yearly 非法枚举；6 条 title 超 28 字 / 1 条 one_liner 超 60 字；2 条 window.status 与 months_left 映射不符；约 20 条 decay 与主 gap 半衰期不符。
- 以上仅代表 09:54 快照；阶段 2 以 `python scanner/pipeline.py --all` 后的最终数据为准。
