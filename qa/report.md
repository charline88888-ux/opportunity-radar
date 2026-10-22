# 红队独立验收报告（qa/report.md）

> 项目：机会雷达 Opportunity Radar · v0.1.0（data-v0.1.0）
> 验收人：redteam（红队负责人）　｜　验收时间：2026-10-22 10:00–10:22（Asia/Shanghai）
> 任务：task-6「红队独立验收：文档/数据/评分/前端/合规」
> 原则：**独立复现、不修改他人成果**；只写 `qa/` 与 `docs/09`；所有问题只报告不代改。
> 快照：**最终冻结候选**——`data/opportunities.json` 46 条（mtime 10:15:36，SHA256 52B30E45…F4A42）、`data/rankings.json`（10:18:48，60F06FE8…8D27）、`app/dist/index.html`（10:19:15，1,979,378 B，F24B0755…B7737）。
> 签署：**可冻结（P0=0、P1=0；最终复验记录见 §10.4）**。早期快照（10:00）的 P1/P2 已在 §10 跟踪闭环。

---

## 0. 结论（发布判定）

| 项 | 结果 |
|---|---|
| **P0（阻塞发布）** | **0 个** |
| **P1（发布前应修复/明确接受）** | **0 个（3 个 P1 全部闭环：证据引文可回溯性、docs/00 验收表、tie-breaker 契约对齐）** |
| P2（建议修，不阻塞） | 遗留 2 个（前端 1024 卡片栅格/「新上榜」文案、cases.md RSS 证据；均登记 v0.2.0） |
| 数据验收 | `pipeline --all` exit 0 且幂等；`validate.py` **V01–V18 全 PASS（18/18，exit 0）**；unittest 19/19；红队独立脚本 P0/P1/P2=0 |
| 前端验收 | `pnpm install && pnpm build` exit 0（strict 真实数据）；8 路由 file:// 截图 8/8 渲染正常；无白屏/无控制台错误/无布局溢出；图表非空 |
| 文档验收 | docs/01–05 与契约一致；早期审查 P1 全部闭环；最终候选见 §10 |
| **一句话结论** | **可冻结（P0=0、P1=0）**：最终候选 dist `F24B0755…B7737` 已通过数据/前端/文档全链路复验；冻结后核对 releases MANIFEST sha256 + file:// 冒烟即可发布。 |

> **复验更新（2026-10-22 10:22，最终）**：P1-1、P1-2、P1-3 均已由负责人修复并经红队复验关闭；**红队签署「可冻结」**。最终候选：`app/dist/index.html` 1,979,378 B / SHA256 `F24B0755F9BF05F7AB24D16BCB891BA4260F4F0CB31E3B567EAB188F50BB7737`；`data/opportunities.json` `52B30E45…F4A42`、`rankings.json` `60F06FE8…8D27`、`stats.json` `FBC0F6D5…071C`。详见 §10.4。

> 依据 `docs/00` §12 / `docs/09` §9.5 的发布 gate：**P0 = 0 方可发布**。本报告 P0=0、P1=0，满足冻结条件。

---

## 1. 验收环境与复现命令

- OS：Windows；Python 3.11（`python`）；Node v24.15.0 / pnpm 11.2.2；Chrome（`C:\Program Files\Google\Chrome\Application\chrome.exe`）。
- 数据基准日：2026-10-22（Asia/Shanghai）；工作目录：`E:\全球商机扫描器`。

```powershell
cd 'E:\全球商机扫描器'

# 1) 数据流水线（幂等性：前后 SHA256 一致）
python scanner/pipeline.py --all
python scanner/validate.py            # 期望：18/18 PASS，exit 0
python scanner/validate.py --json     # 机器可读
python -m unittest discover -s scanner/tests -v   # 期望：18 tests OK
python qa/data-qa.py                  # 红队独立口径（Decimal 精确复算）

# 2) 前端构建（strict：数据必须全 real）
cd app
pnpm install
pnpm build                            # 期望：sync-data strict PASS + tsc + vite build 成功
node scripts/sync-data.mjs --strict   # 期望：数据来源=real，exit 0

# 3) 8 路由截图（file:// 方式，Chrome headless）
# 见 §4.1 的截图索引；命令示例：
# & $chrome --headless=new --disable-gpu --hide-scrollbars --user-data-dir=qa/tmp/chrome-profile `
#   --window-size=1600,1000 --virtual-time-budget=15000 `
#   --screenshot="E:\全球商机扫描器\qa\screenshots\01-dashboard.png" `
#   "file:///E:/全球商机扫描器/app/dist/index.html#/"

# 4) 运行时布局/控制台检查（Chrome DevTools Protocol）
node qa/cdp-routes.mjs 9334 "file:///E:/全球商机扫描器/app/dist/index.html" 1024 1000 `
  '#/' '#/rankings' '#/opportunities/opp-pet-memorial-glass-001' '#/scanner' `
  '#/method' '#/sources' '#/calendar' '#/about'
```

---

## 2. 数据验收（实测）

### 2.1 流水线与契约校验

| 检查 | 结果 |
|---|---|
| `python scanner/pipeline.py --all` | exit 0；采集 27 条→归一 27→去重 22；评分 46 条公式一致；榜单 day=8/week=15/month=23/year=46；校验 18/18 PASS |
| 幂等性 | 运行前后 7 个 `data/*.json` 的 SHA256 **全部一致**（opportunities/rankings/stats 未漂移） |
| `python scanner/validate.py` | **18/18 PASS，0 失败，exit 0**（输出留存 `qa/validate-final.txt`） |
| `python -m unittest discover -s scanner/tests` | **18 tests OK**（T01 舍入、84.96/85 等级边界、momentum clip、min(100)、ISO 周、validate 失败路径等） |
| 红队独立校验 `qa/data-qa.py` | **P0=0 / P1=0 / P2=8**（P2 均为七问 moat 偏短 22–29 字，建议性） |

### 2.2 规模与覆盖

| 契约/任务要求 | 实测 | 结论 |
|---|---|---|
| 机会 ≥40 | **46** | ✅ |
| 14 行业各 ≥1 | 14/14 | ✅ |
| ≥10 区域 | 11/11 | ✅ |
| 12 类信息差全覆盖 | 12/12 | ✅ |
| 目标国家/地区 ≥30 | **38** | ✅ |
| 中国供应链/中文市场角度 ≥12 | **18**（`china-advantage`） | ✅ |
| 四窗口配额（day≥6/week≥12/month≥20/year≥40） | day **8** / week **15** / month **23** / year **46** | ✅ |
| 榜单 rank 从 1 连续、按 rank_score 降序、opp_id 存在 | 全部通过（V08/V09/V18） | ✅ |
| stats KPI 与实际聚合一致 | total_opps=46 / new_today=8 / grade_a_plus=11 / avg_total=71.4 / open_window_value=¥4,180,000 | ✅ |
| taxonomy 固定枚举 | 14/12/6/24/12/7/12/11/10/20/5，权重合计 1.0，等级阈值/半衰期/anchors 均与契约一致 | ✅ |

### 2.3 评分公式独立复算（红队口径，不用 scanner 代码）

- 用 `Decimal(str(dim)) × Decimal(str(weight))` 逐项累加，`ROUND_HALF_UP` 保留 1 位：
  - `total`：**46/46 与文件值一致**（差 ≤0.05；实际全部相等）。
  - `grade`：46/46 一致（S≥85/A≥75/B≥65/C≥55/D<55，用舍入后 total 判定）。
  - `rank_score`：`round_half_up(min(100, total×(1+0.12×(momentum−1))),1)`，46/46 一致。
- docs/04 §8 七个评分案例复算：A 78.9/81.7、B 78.6/80.5、C 72.0/72.9、D 71.3/75.6、E 74.4/74.4、F 64.5/63.7、G 71.7/75.1，全部与文档一致。
- 舍入精度备注（P2-7）：`scanner/score.py` 为「float 求和 → Decimal(str(x)) 量化」，当前 46 条无 `.xx05` 边界样本，红队精确复算与实现一致；若未来出现精确 .05 边界，float 求和可能差 0.1（早期数据曾出现 76.95 → 77.0 vs 76.9 的两种结果）。建议 `compute_total` 改成 Decimal 逐项累加。

### 2.4 `verified` 诚实性核查（重点）

`verified:true` 共 **5 条**，红队逐条实测证据 URL：

| 机会 | 证据 URL | 实测 | quote 与页面一致？ |
|---|---|---|---|
| opp-local-furusato-nozei-024 | https://www.shinmai.co.jp/news/article/gfkn2026073101001609 | 200 | ✅「1 兆 3,314 亿日元」命中 |
| opp-local-furusato-nozei-024 | https://www.rieti.go.jp/jp/columns/a01_0805.html | 200 | ✅「83.4% 继续使用同一门户」命中 |
| opp-local-umrah-service-025 | https://pep.gov.sa/en/news/1011 | 200 | ✅「19.5 百万朝觐/副朝、1,503 万签证」命中 |
| opp-crossborder-kbeauty-029 | https://en.yna.co.kr/view/AEN20260109010100320 | 200 | ✅「$11.43B、+12.3%、美国第一」命中 |
| opp-crossborder-mercadolibre-030 | https://news.mercadolibre.com/resultados-financieros-tercer-trimestre-2025 | 200 | ✅「GMV $16.5B、+28% YoY」命中 |
| opp-manufacturing-shea-butter-031 | https://english.news.cn/20260226/d7ae10b2b1214bf39412cc6f639d6d56/c.html | 200 | ✅「禁令延至 2027-02-25、黄油 10–20 倍」命中 |

- 其余 41 条为 `verified:false`，`compliance_notes` 均说明「未逐条核验/需人工复核」；原 EAA 一条的 France Num 404 已在上轮修复（改用 EUR-Lex 2019/882 并置 false），**verified 标注诚实性通过**。
- 备注（P2-2）：5 条 `verified:true` 中 4 条只有 1 条证据（024 有 2 条），与 docs/12 §2「优先 2–4 条来自不同主体」的三角验证建议有差距，建议后续补第二独立来源。

### 2.5 证据 URL 抽查（红队独立 web_fetch，≥8 个机会 / 12 个 URL）

| # | 机会 | URL | HTTP | 与描述相符 | 备注 |
|---|---|---|---|---|---|
| 1 | opp-pet-memorial-glass-001 | https://www.etsy.com/ca/shop/CrystalsCustomsArt | **403** | ❌ 店铺页不含评论引文 | 引文「Beautiful piece but it arrived cracked」无法在页面核对（P1-1） |
| 2 | opp-pet-memorial-glass-001 | https://www.etsy.com/de-en/shop/AshEmberGlass | **403** | ❌ 同上 | 引文「Bracelet runs tiny…」不可回溯（P1-1） |
| 3 | opp-pet-memorial-glass-001 | https://www.cnstock.com/commonDetail/763132 | 200 | ✅ 标题/数字相符 | 原文发布日期 **2026-08-19**，数据写 2026-10-19（P2-1） |
| 4 | opp-gaming-arabic-l10n-043 | https://www.reddit.com/r/gamedev/ | 200（动态壳） | ❌ 首页无「阿语本地化让收入翻倍」 | 应给具体帖子/评论 URL（P1-1） |
| 5 | opp-culture-quran-app-028 | https://www.reddit.com/r/islam/ | 200（动态壳） | ❌ 首页无具体引文 | 同上（P1-1） |
| 6 | opp-culture-quran-app-028 | https://quran.com/ | 200 | ⚠️ 首页只有产品描述 | 作为「category 存在」证据可接受，作为具体引文偏弱 |
| 7 | opp-compliance-gpsr-epr-037 | https://www.verpackungsregister.org/en/i-want-to-know-what-will-change-from-12-august | 200（跳转新版页） | ✅ PPWR/VerpackDG 内容相符 | 建议直接使用最终 URL |
| 8 | opp-compliance-eaa-accessibility-034 | 旧 France Num URL（已替换） | **404** | ❌ 已修复为 EUR-Lex | 修复后 https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882 实测 HTTP 202（可访问，需 JS），该机会保持 verified:false，处置诚实 |
| 9 | research/cases.md 抽检 | sohu / zellerhaus / RIETI / 信浓每日 / Yonhap / 华经 / PEP / my.gov.sa | 200/200/200/200/200/200/200/403 | ✅ 8/8 与底稿描述相符 | my.gov.sa 403 与底稿「⛔拦截」标注一致，诚实 |

**结论**：verified:true 的 6 条证据全部可打开且内容相符；`verified:false` 的引文存在 **5 条不可回溯**（P1-1），不影响「verified 标注诚实性」，但违反 docs/12 §12「证据必须可回溯到 URL」。

**证据结构统计（红队观察，不阻塞）**：88 条证据中 `primary` 22 / `secondary` 66；日期 `2026-10-20` 占 **52/88（59%）**（data/README 已声明「无法确认发布日时取核验日」的回退口径，但其中 cnstock 可查到原文日期却记错，见 P2-1）。

### 2.6 七问质量抽查（8 条机会，覆盖 8 个行业）

抽查：001 宠物纪念玻璃 / 005 更年期护理 / 011 AI 前台 / 016 日本免税退税 / 028 古兰经 App / 036 CBAM / 041 非洲离网太阳能 / 046 阿联酋数字游民签证。

- 8/8 七问 7 字段齐全、无占位符；均为具体渠道 + 价格带/毛利 + ROI 区间 + 明确「适合/不适合谁」+ 壁垒与前置条件，可直接照做（例如 001 明确 Etsy 长尾词/Pinterest/TikTok 与前 100 单来源；036 明确碳核算方法、客单与 5 个月回本）。
- 不足：8 条中 6 条 `moat` 仅 22–29 字（P2-8），虽具体但偏短；`first_steps_7d` 均为 4 条、`kill_criteria` 3 条、`risks` 3–4 条，符合契约条数。

---

## 3. 前端验收（实测）

### 3.1 构建与数据来源

| 检查 | 结果 |
|---|---|
| `pnpm install` | ✅ exit 0（Already up to date） |
| `node scripts/sync-data.mjs --strict`（build 内自动执行） | ✅ PASS，`数据来源=real`，机会 46 / day8-week15-month23-year46 / 数据源 63 / 剧本 12 / 日历 33 |
| `pnpm build`（strict + tsc + vite） | ✅ exit 0；`vite:singlefile` 内联为 `dist/index.html` **1,977,854 B**（单文件、无 assets 依赖） |
| mock 检查 | `app/src/data/_meta.json`：`source=real`、`mock_files=[]`；页面「REAL DATA / 数据状态 REAL」角标；dist 内无运行期「演示数据」提示（代码中存在开发占位提示逻辑，但被 `mock_files.length=0` 关闭） |
| 外部依赖 | dist 中 `<script src>`/`<link href=http>` 等外链 **0 个**（无 CDN） |

### 3.2 8 路由截图与目检（file:// 方式，Chrome headless）

> 截图全部由红队**重新生成**（未引用 `app/screenshots/final/`）；逐张用 read_image 人工目检。索引见 §7。

| 路由 | 截图 | 目检结论 |
|---|---|---|
| `#/` 指挥台 | 01-dashboard.png | 5 张 KPI 卡（46/8/15/11/¥418 万）、今日榜 Top5、评分分布图（真实数据 18+28 柱）、REAL DATA 角标均正常 |
| `#/rankings` 排行榜 | 02-rankings.png | 四窗口 tab（8/15/23/46）、14 行业筛选 chips、卡片/表格切换、排名/rank_score/动量显示正常 |
| `#/opportunities/opp-pet-memorial-glass-001` 详情 | 03-detail.png / 12-tall-detail.png | 10 维雷达与滑杆（标注「演示：权重可调」）、七问 7/7、证据链 3 条（带「未核验」标）、7 天动作、证伪条件、风险、合规提示、相关机会、页脚免责声明均可见 |
| `#/scanner` 扫描室 | 04-scanner.png | 需求×信号热力矩阵（有数据）、12 类源覆盖条、模拟扫描控制台明确标注「纯前端演示·无网络请求」 |
| `#/method` 方法论 | 05-method.png | 权重滑杆实时 Top10（74–78 分真实重排）、公式说明、等级阈值；「较默认」列当前均为「—」（默认权重下正常） |
| `#/sources` 数据源矩阵 | 06-sources.png / 14-tall-sources | 63 平台、绿 35/黄 20/红 8、区域×类别热力图、逐源表格（URL/访问方式/频率/成本/合规/价值分/坑） |
| `#/calendar` 商业日历 | 07-calendar.png | 33 节点、未来 90 天 8 个、按月份/类型时间轴图、节点卡片（双 11/黑五/网一）与建议动作 |
| `#/about` 关于 | 08-about.png / 13-tall-about.png | 版本 v0.1.0 / 数据版本 0.1.0 / as_of / REAL / strict 8 PASS；文档索引；README 式免责声明与数据伦理段完整可见 |

**目检结论**：**无白屏、无图表空白、无控制台报错、无文字重叠/溢出**；深色专业风格与中文排版正常；`file://` 双击可用（全部截图即 file:// 打开）。

### 3.3 运行时客观检查（CDP：`qa/cdp-routes.mjs`）

- **1024 视口**（8 路由）：`innerWidth=1008/1024`（滚动条差异）、`docScrollWidth==innerWidth`（无横向溢出）、`clippedElements=0`、`canvasCount` = 5/0/2/2/4/2/1/0 且 `zeroSizeCanvas=0`、`consoleErrors=[]`、`hasDisclaimer/hasVersion=true`。
- **1024 精确设备模拟**（排行榜）：`matchMedia('(min-width:1024px)')=true`，侧栏 236px，卡片网格 `233.328×3`，三卡 right=992 < 1024，**无裁切**。
- **1600 视口**（8 路由 + 404）：全部无横向溢出、无裁切、图表 canvas 非 0、控制台错误 0；`#/not-exist` 正确渲染「页面不存在 / RADAR · 404」。
- 结论：**布局溢出 = 无；白屏 = 无；控制台报错 = 无**。前端验收通过。

### 3.4 前端遗留观察（P2/P3，不阻塞）

- P2-6：1024 下排行榜卡片宽度约 233px，标题/描述截断较多（内容仍可点进详情）；「新上榜 0 条」因 v0.1.0 delta 口径（相邻更大窗口对比，day⊂week 恒有参照）而为 0——契约允许，但建议 KPI 改为「较周榜变化 ↑/↓」或隐藏该格。
- 详情页 `03-detail.png` 中「当前榜单名次」显示 `日榜 #2 / 周榜 #2 / 月榜 #2 / 年榜 #2`（该机会在四个窗口均第 2），正常。
- 方法论页「较默认」列均为「—」：默认权重下自定义=默认，展示正确。

---

## 4. 文档验收

### 4.1 契约一致性（docs/01–05 vs docs/12，实测）

| 契约项 | 文档一致性 | 证据 |
|---|---|---|
| 10 维 id/权重/合计 1.00 | ✅ | docs/04 §1/§3.1/§10.1（0.15×4+0.10+0.08+0.07+0.05×3=1.00）；taxonomy 实测一致 |
| total / rank_score / grade 公式 | ✅ | docs/04 §3 与 docs/12 §4.5 逐字一致；7 案例复算全对 |
| 等级阈值 S85/A75/B65/C55/D | ✅ | docs/04 §3.3、taxonomy、validate V05 |
| 窗口归属 + delta 口径 | ✅（实现与契约已对齐） | docs/12 §5:340「相邻更大窗口」；rank.py/meta.delta_rules 一致；V18 通过 |
| 12/14/6/24/12/7/12/11/10/20 枚举 | ✅ | taxonomy 脚本核对；docs/03 §4/§9、docs/05 §3/§4、docs/02 §2 均一致 |
| 七问 7 字段 | ✅ | docs/05 §0.2 与 docs/12 §4.3 一一对应；46/46 数据通过 V04 |
| ROI 字段 | ✅ | docs/05 §6.2 模板与 docs/12 §4.4 完全一致；46/46 通过 V16 |
| 免责声明 | ⚠️ 文本不统一（P2-5） | docs/05:885 缺「示例数据用于演示」，与 `scanner/config.py`、docs/12 §4.6 不一致 |

### 4.2 早期审查（qa/early-review.md）P1/P2 闭环核实

| 编号 | 问题 | 状态 |
|---|---|---|
| P1-01 | materialize 缺维度静默补 0 | ✅ 已改为抛错（materialize.py:83-90，校验 10 维整/多） |
| P1-02 | validate 缺 disclaimer/roi/证据日期校验 | ✅ 已实现 V16/V17/V18（validate.py:540-620），18/18 PASS |
| P1-03 | docs/04 对 docs/12 的过时错误指控 | ✅ 已改为「口径说明（2026-10-22 契约修订后）」并确认 78.9/81.7 |
| P1-04 | 无单元测试 | ✅ `scanner/tests/test_scanner.py` 18 tests OK |
| P1-05 | scanner/README 缺失 | ✅ 已补（7,023 B） |
| P1-06 | 前端 mixed/mock 数据 | ✅ strict 构建 `source=real`、`mock_files=[]` |
| P2-01 | 舍入实现 | ✅ common.round1 改 Decimal ROUND_HALF_UP（累加精度见 P2-7） |
| P2-02/03 | delta 口径/tie-breaker | delta ✅ 契约已明确；tie-breaker 仍未写入契约（P2-4） |
| P2-04 | ISO 周示例错误 | ✅ 已改为 2026-12-28→W53 等正确示例 |
| P2-05 | 案例 D 半衰期 | ✅ 已按「主 gap=infrastructure H=24/slow，price 仅压力测试」修正 |
| P2-06 | months_left 语义 | ✅ docs/12 §4.7 + docs/04 §4.2 已定义；但 V06 与 closed=0 仍矛盾（P2-3） |
| P2-07 | validate 比契约更严 | ✅ 已降级为 advisory（validate.py:673） |
| P2-09 | 榜单生成/校验分值来源不一致 | ✅ 未复现（数据一致 + V05/V09 双通过） |
| P2-10/11/12 | dedupe kept/complaint_zh/构建产物忽略 | ✅ 已修；`.gitignore` 已加 `scanner/build/`、`app/screenshots/` |
| docs/03 §5 条数 | 37→39 | ✅ 已修 |
| docs/01 目标基线 | 90 天目标三处不一致 | ✅ 已统一（§1.3/§1.5/§10.1.1/K 表） |
| docs/02 源健康命名 | A/B/C/D 同形不同义 | ✅ 已加「命名防混淆」并与机会等级区分 |

### 4.3 剩余文档问题

- **P1-2（Lead）**：`docs/00:198-207` §12「验收结果」在红队验收前已预填，且口径过时——写「数据校验 V01–V15 全 PASS」，实际为 **V01–V18**；「前端构建/截图/版本冻结」也应在 task-7 完成后才可写「PASS」。发布前必须替换为红队实测结果（本报告 §0/§2/§3）。
- **P2-3（Lead/契约）**：`docs/12:317-318` 规定 `months_left` 整数 1–36、`closed=0`；但 `docs/12:447` V06 要求「正整数」、`docs/12:457` V16 要求 `closed` 时 `months_left=0`，三处互相矛盾（closed 状态无法用合法 months_left 表达）。建议 v0.1.1 将范围改为 0–36，或 V06 允许 0（仅 closed）。
- **P2-4（Lead/契约）**：`docs/12:340` 只规定按 rank_score 降序，未定义并列 tie-breaker；`scanner/rank.py:28` 实际使用 `(rank_score, total, id)`，第三方/前端重算可能不一致。建议在契约补一句。
- **P2-5（methodologist）**：`docs/05:885` JSON 模板 disclaimer 与 `scanner/config.py:55`、`docs/12:309` 不完全一致；建议直接引用 config 文案。
- **发布前置条件（Lead/task-7，非缺陷）**：`README.md:6,21,71` 指向 `releases/v0.1.0/`（含 DEV/OPS/CHANGELOG），当前 `releases/` 为空——属 task-7 未执行；冻结后需重新验证链接与 MANIFEST。

---

## 5. 问题清单（P0/P1/P2）

### 5.1 P0（0 个）

无。

### 5.2 P1（2 个，发布前修复或书面接受）

| # | 文件:行号 | 问题 | 建议 | 负责人 |
|---|---|---|---|---|
| P1-1 | `data/opportunities.json:49-65`（Etsy×2）、`:4113`（r/islam）、`:4122`（quran.com）、`:6338`（r/gamedev） | **证据引文不可回溯**：Etsy 店铺页（实测 403 且店铺页不含评论）配具体买家评论引文；Reddit 版块首页/Quran 首页配具体引文。违反 docs/12 §12「证据必须可回溯到 URL」；虽然是 `verified:false`，但「引文不可核对」等同于弱化版不实证据。 | 换成具体 review/评论/产品页 URL（Etsy review 页通常需登录，可改用可公开访问的第三方测评）；找不到就删除 quote、只保留「品类存在」的证据并降级说明。 | data-engineer |
| P1-2 | `docs/00:198-207` | 验收表在红队验收前预填「V01–V15 全 PASS / 构建成功 / 截图 / 冻结」，口径过时（V01–V18）；若原样发布 = 未验证即宣称通过。 | 用本报告 §0/§2/§3 的实测结果替换；写明「validate 18/18 PASS」「红队 P0=0」；冻结结果由 task-7 完成后补。 | Lead |

### 5.3 P2（9 个，建议修，不阻塞）

| # | 文件:行号 | 问题 | 建议 | 负责人 |
|---|---|---|---|---|
| P2-1 | `data/opportunities.json:67` 等（52/88 条证据 date=2026-10-20） | 证据日期批量同值；实测 cnstock 原文 2026-08-19 却记 2026-10-19，存在「可查到发布日却回填核验日」的情况。 | 有明确发布日的用原文日期；无法确认的保留回退并在 `compliance_notes` 说明；建议未来区分 `published_date`/`checked_date`（需契约变更）。 | data-engineer |
| P2-2 | `data/opportunities.json`（verified:true 5 条） | 4 条仅 1 个证据源，与 docs/12 §2「优先 2–4 条来自不同主体」有差距。 | 为 025/029/030/031 各补 1 条独立来源（官方+媒体/行业）。 | data-engineer |
| P2-3 | `docs/12:317-318` vs `:447` vs `:457` | months_left 1–36 与 closed=0 / V06 正整数 / V16 closed=0 三处矛盾。 | 契约 v0.1.1 统一为 0–36（closed 仅 0），或 V06 允许 0 且限定 closed。 | Lead |
| P2-4 | `docs/12:340`（缺失） | 未定义 rank_score 并列时的 tie-breaker；实现已用 total/id。 | 契约补「并列按 total 降序、再 id 升序」。 | Lead |
| P2-5 | `docs/05:885` | JSON 模板 disclaimer 文本与 config/docs12 不一致（缺「示例数据用于演示」）。 | 统一引用 `scanner/config.py` 文案。 | methodologist |
| P2-6 | `app/src/pages/Rankings.tsx:343`、`app/src/pages/Dashboard.tsx` | 1024 下排行榜卡片约 233px，标题/描述截断较多；「新上榜 0 条」在 day/week/month 恒为 0（delta 口径所致），易误读。 | 1024 可改 2 列（`md:grid-cols-2 xl:grid-cols-3`）；KPI 文案改「较周榜变化」或隐藏。 | frontend |
| P2-7 | `scanner/score.py:29-37` | 先 float 求和再 Decimal 量化；当前 46 条无 .xx05 边界样本，但与「精确十进制」在边界值上可能差 0.1（历史数据出现过 76.95 两种结果）。 | `compute_total` 用 Decimal 逐项累加（与 docs/12 §4.5 的 round_half_up 完全一致）。 | data-engineer |
| P2-8 | `data/opportunities.json`（8 条） | 七问 `moat` 22–29 字，偏短（虽然具体）。 | 每条补 1–2 句「壁垒类型 + 前置条件 + 被复制时间」，不影响结构。 | data-engineer/methodologist |
| P2-9 | `research/cases.md:485` | 用动态 RSS（`reddit.com/r/Entrepreneur/.rss`）作为具体引文证据，不可复现。 | 改为具体帖子 URL + 抓取日期。 | researcher（已完成，可下版修） |

---

## 6. 发布前 checklist（对照 docs/09 §9）

| 项 | 状态 |
|---|---|
| pipeline exit 0 / validate 18/18 PASS | ✅ |
| 机会 ≥40、14 行业、11 区域、12 信息差、四窗口配额 | ✅ |
| 独立复算 total/rank_score/grade | ✅ 46/46 |
| 抽查 ≥8 条机会证据 URL 可访问性 | ✅ 12 URL / 9 机会（1 个 404 已修复、5 条引文不可回溯见 P1-1） |
| verified:true 证据 100% 可打开 | ✅ 6/6（5 个机会） |
| disclaimer 每条机会都有且页面可见 | ✅（V16 + 页面页脚/详情） |
| 无禁用词（稳赚/保证/躺赚/内幕/100% 成功） | ✅ V13 |
| pnpm install / build 成功（strict real） | ✅ |
| 8 路由截图 + read_image 目检 | ✅ qa/screenshots/01–08 |
| file:// 双击可用 | ✅（全部截图即 file://） |
| 无白屏/控制台报错/布局溢出/空图表 | ✅（CDP + 截图双重验证） |
| 1024 宽度检查 | ✅ 3 页截图 + 8 路由 CDP |
| 免责声明/verified 提示/版本号可见 | ✅ |
| mock 不入发布构建 | ✅ `_meta.source=real` |
| docs/01–05 契约一致 + 早期 P1 闭环 | ✅ |
| docs/00 验收表为实测结果 | ❌ **P1-2 待 Lead 替换** |
| releases/v0.1.0 冻结 + MANIFEST + git tag | ⏳ task-7（发布前必做） |

---

## 7. 截图索引（全部 file:// 方式，Chrome headless，红队现场生成）

| 文件 | 路由 | 视口 | 说明 |
|---|---|---|---|
| qa/screenshots/00-smoke-home.png | `#/` | 1600×1000 | 冒烟（与 01 相同） |
| qa/screenshots/01-dashboard.png | `#/` | 1600×1000 | 指挥台 |
| qa/screenshots/02-rankings.png | `#/rankings` | 1600×1000 | 排行榜四窗口 |
| qa/screenshots/03-detail.png | `#/opportunities/opp-pet-memorial-glass-001` | 1600×1000 | 机会详情 |
| qa/screenshots/04-scanner.png | `#/scanner` | 1600×1000 | 扫描室 |
| qa/screenshots/05-method.png | `#/method` | 1600×1000 | 方法论 |
| qa/screenshots/06-sources.png | `#/sources` | 1600×1000 | 数据源矩阵 |
| qa/screenshots/07-calendar.png | `#/calendar` | 1600×1000 | 商业日历 |
| qa/screenshots/08-about.png | `#/about` | 1600×1000 | 关于/版本/免责 |
| qa/screenshots/09-1024-dashboard.png | `#/` | 1024×1000 | 1024 响应式 |
| qa/screenshots/10-1024-rankings.png | `#/rankings` | 1024×1000 | 1024 响应式 |
| qa/screenshots/11-1024-detail.png | `#/opportunities/…-001` | 1024×1000 | 1024 响应式 |
| qa/screenshots/12-tall-detail.png | `#/opportunities/…-001` | 1600×3600 | 详情全页（七问/证据/风险/合规） |
| qa/screenshots/13-tall-about.png | `#/about` | 1600×2600 | 关于全页（免责声明/版本历史） |
| qa/screenshots/14-tall-sources.png | `#/sources` | 1600×2600 | 数据源全页（63 源明细） |

辅助产物：`qa/data-qa.py`（独立数据验收脚本）、`qa/cdp-routes.mjs` / `qa/cdp-check.mjs`（CDP 运行时检查）、`qa/validate-final.txt`（validate 原始输出）、`qa/early-review.md`（早期静态审查）。

---

## 8. 限制与未覆盖项（诚实声明）

1. **证据 URL 未全量核验**：88 条中红队实测 12 条（覆盖 9 个机会 + 6 条 verified:true 全量），未逐条打开全部 88 条；`verified:false` 条目按契约本来就不要求全量可访问。
2. **控制台错误**：通过 Chrome stderr + CDP Runtime.exceptionThrown/console error 捕获为 0；未做完整网络请求日志（应用无运行时网络请求、无外部资源，风险低）。
3. **浏览器兼容**：只在 Chrome headless（同机）验证；未测 Firefox/Safari/移动真机。
4. **路径迁移**：file:// 在 `E:\全球商机扫描器\app\dist` 验证通过；未测复制 dist 到其他含空格/中文路径（单文件 + HashRouter + base './' 理论上可用）。
5. **a11y/性能**：未做 WCAG 审计与 Lighthouse 性能评分。
6. **releases/ 冻结产物**：验收时 `releases/` 为空（task-7 未执行）；冻结后需对 `releases/v0.1.0/dist/index.html` 做一次同样的 file:// 冒烟 + MANIFEST sha256 校验。
7. **数据真实性**：红队验证的是「证据 URL 可访问 + 引文与页面相符」，不等于商业结论正确；机会卡片仍是研究假设（页面与 README 均已声明）。

---

## 9. 建议的发布动作（给 Lead）

1. 修 P1-1（data-engineer：5 条引文改具体 URL 或删引文降级）——预计 10–15 分钟。
2. 替换 `docs/00` §12 验收表（Lead），写入本报告实测结果（V01–V18 18/18、构建 PASS、8 路由截图、P0=0）。
3. task-7 冻结 `releases/v0.1.0/` 后，红队（或 Lead）对冻结产物复跑一次 file:// 冒烟 + validate 18/18 + MANIFEST sha256，即可发布。
4. 发布说明中记录 P2 清单与「数据证据为研究假设、非投资建议」免责声明。

---

## 10. 复验更新记录（最终候选，2026-10-22 10:16）

> 本节是对 §0–§9 的追加复验：数据与前端均在发现 P1 后做过修订，以下为最终候选快照与结论。

### 10.1 修订与复验（P1-1 / P1-2 / P2 批量闭环）

| 项 | 修订内容 | 红队复验 |
|---|---|---|
| P1-1 证据引文可回溯性 | data-engineer 采用「保留真实 URL + quote 降级为可回溯描述 + verified 保持 false + compliance_notes 说明」：001 的 Etsy 两条改为 listing 标题级事实描述；028 的 r/islam/quran.com 改为社区主题/产品功能描述；043 的 r/gamedev 同；并修正了 043 evidence[0] 一度出现的 publisher/url 与 title/quote 错配 | ✅ 已复核：三条机会的 evidence 字段自洽、compliance_notes 明示 403/具体链接未取得；verified:false 标注诚实 |
| P1-2 docs/00 验收表 | Lead 已将 §12 替换为红队实测（V01–V18 18/18、pipeline 幂等、build/file:// 8 路由、verified 5/6、P0=0） | ✅ 已复核（docs/00:198-215）；仅遗留 dist 大小数字 1,977,854 B 未同步为最终 1,979,278 B（P3） |
| P2-1 证据日期 | cnstock 763132 三处证据日期由检索日改为原文发布日 **2026-08-19**；其余无法确认发布日的按 data/README 口径保留检索日 | ✅ 已复核 |
| P2-2 verified:true 单证据 | 契约 §2 为「优先 2–4 条」非强制；data/README §5 与 CHANGELOG 已记录为后续补强项 | ✅ 接受（P2 关闭） |
| P2-3 months_left/closed 矛盾 | docs/12 §4.7 + V06 已统一为「整数 0–36，0 仅用于 closed」 | ✅ 已复核（docs/12:317、447） |
| P2-4 tie-breaker 缺失 | docs/12 §5:341 新增并列排序链（momentum→evidence_count→last_activity→opp_id） | ⚠️ **引发 P1-3**：scanner 未按该链实现（见 §10.2） |
| P2-5 docs/05 disclaimer | 已统一为含「示例数据用于演示」的文案并加唯一口径说明 | ✅ 已复核 |
| P2-7 score 累加精度 | `scanner/score.py:compute_total` 已改为 Decimal 逐项累加 | ✅ 已复核（代码 + 46/46 复算） |
| P2-8 moat 偏短 | 8 条 moat 扩写为「壁垒+前置条件+被复制周期」完整表述 | ✅ 已复核（data-qa P2=0） |
| P2-6 前端 1024/新上榜文案 | 前端登记为 v0.2.0 待办，v0.1.0 不改 dist | ⏳ 遗留（不阻塞） |
| P2-9 cases.md RSS 证据 | 研究底稿已定稿，未改 | ⏳ 遗留（不阻塞，下版修） |

### 10.2 冻结前新发现 P1-3（待 Lead 决策，暂缓签署）

契约 docs/12 §5 新增的并列 tie-breaker 与实现不一致：
- 契约顺序：`rank_score` 降序 → `momentum` 降序 → `evidence_count` 降序 → `last_activity` 降序 → `opp_id` 升序（docs/12:341）。
- 实现顺序：`scanner/rank.py:28` `_sort_key = (-rank_score, -total, id)`。
- 受影响的实际数据（rank_score 并列组）：
  - month：81.4 组（furusato mom1.3/ev2 vs umrah mom1.5/ev1）、69.9 组（offline-club vs ai-companion）；
  - year：81.4 / 78.2 / 69.9 三组，共 5 对机会的顺序与契约口径不同（rank 3/4、8/9、36/37 等）。
- V09/V18 均 PASS 是因为校验复用同一实现、未校验契约 tie-breaker。
- 修法：A=改 rank.py 按契约链并重跑 pipeline + 重建 dist（rankings 变化）；B=把契约改为实际实现口径（total 降序 → id 升序，零数据/前端变更）。红队建议 A（语义更好），时间紧则 B 也可接受，但必须二者一致。
- 状态：**待 Lead 选择修法后红队复验再签「可冻结」**。

### 10.3 最终候选快照（截至 10:16）

| 项 | 值 |
|---|---|
| `data/opportunities.json` | mtime 10:15:36，size 245,094，SHA256 `52B30E45B356CEA9B635DCC82CF44C4557DC5F5B9427750D376ABFC4B96F4A42` |
| `data/rankings.json` / `stats.json` | SHA256 `A8EDABB4…6503` / `FBC0F6D5…071C`（pipeline 幂等，内容未变） |
| `app/dist/index.html` | mtime 10:15:58，size **1,979,278 B**，SHA256 `CD525DD89E78B3DAD89238E3456A040CCC32A83040FEFCE80C7D123E9535AD80` |
| validate / data-qa | **18/18 PASS（exit 0）** / **P0=0 · P1=0 · P2=0** |
| dist 内嵌最终数据 | grep 命中「Global Video Game Translation Services Market 2026-2032」「Etsy 店铺页对自动访问返回 403」「2026-08-19」等修复文本 ✅ |
| 8 路由截图 | 已用最终候选 dist 重新生成（10:16:12–10:16:28）并逐张 read_image 目检：无白屏/无图表空白/无控制台错误/无溢出 |
| CDP 1024 / 1600 | 8 路由 + 404：`overflow=False`、`clippedElements=0`、`zeroSizeCanvas=0`、`consoleErrors=0`、404=True |
| 结论 | 除 P1-3 外的所有 gate 已通过；P1-3 决策并复验后即可签署「可冻结」。 |

### 10.4 最终签署：**可冻结（2026-10-22 10:22）**

P1-3（tie-breaker）已由 data-engineer 方案 A 修复并经红队复验：

- 契约链 `rank_score↓ → momentum↓ → evidence_count↓ → last_activity↓ → opp_id↑` 已写入 `scanner/rank.py::_sort_key`；`rankings.json.meta.tie_breaker` 存在；
- 红队独立复算 5 组并列（month 81.4/69.9；year 81.4/78.2/69.9）**全部与契约顺序一致**；
- **界面实测**（CDP 真实鼠标事件切换 tab）：月榜 rank3=沙特 Umrah（025，mom1.5）在 rank4=日本故乡纳税（024，mom1.3）之前 ✅；年榜全部 `NEW` ✅；
- validate **18/18 PASS（exit 0）**；`python -m unittest discover -s scanner/tests` **19/19 OK**；data-qa **P0/P1/P2=0**；`pipeline --all` exit 0 且 7 个 data JSON 幂等；
- 最终候选哈希（与 Lead 核对一致）：
  - `data/opportunities.json` = `52B30E45B356CEA9B635DCC82CF44C4557DC5F5B9427750D376ABFC4B96F4A42`
  - `data/rankings.json` = `60F06FE8DE9E29EDF36DB41AAC0997FBD0C092F38BB01A946A7D729A9F528D27`
  - `data/stats.json` = `FBC0F6D5E646EA4909FED141AE261FADC1BF6F79DD9155B51AF07C7A1FB5071C`
  - `app/dist/index.html` = **1,979,378 B**，SHA256 `F24B0755F9BF05F7AB24D16BCB891BA4260F4F0CB31E3B567EAB188F50BB7737`（mtime 10:19:15）
  - `app/src/data/rankings.json` 与 `data/rankings.json` **内容相等**（build 时 strict sync 确认）
- 截图：已用最终 dist 重新生成 `qa/screenshots/01–15`（含 8 路由 1600、3 张 1024、3 张全页、**15-detail-043-gaming** 043 修复后详情、**02-rankings** 新排序），逐张 read_image 目检通过；CDP 1024/1600 共 20 路由次：`overflow=False`、`clippedElements=0`、`zeroSizeCanvas=0`、`consoleErrors=0`、404 兜底正常（404 页 textLength=278 属正常短页，非白屏）。
- **结论：P0=0、P1=0（全部闭环），满足冻结条件，红队签署「可冻结」**。
- 冻结后待办：核对 `releases/v0.1.0/MANIFEST.json` 的 sha256 是否等于上述值，并对 `releases/v0.1.0/dist/index.html` 做 file:// 冒烟 + 8 路由抽查。

---

## 11. 冻结产物核验（releases/v0.1.0，2026-10-22 10:26）

> v0.1.0 已由 Lead 执行 `release.ps1` 冻结；本节为红队对**冻结产物**（非工作区候选）的最终核验。

### 11.1 文件清单与 MANIFEST sha256（全量核对）

`releases/v0.1.0/` 结构：`dist/index.html`、`dist/VERSION-README.md`、`README.md`、`DEV.md`、`OPS.md`、`CHANGELOG.md`、`MANIFEST.json`、`docs-snapshot/`（00–12 共 13 份）。

- MANIFEST `files` 共 **19 条**：红队逐条重算 `bytes` + `sha256` → **19/19 全部一致（ALL OK）**。
- `dist/index.html`：1,979,378 B，SHA256 `f24b0755f9bf05f7ab24d16bcb891ba4260f4f0cb31e3b567eab188f50bb7737` —— 与候选 dist 完全一致。
- `MANIFEST.counts`：opportunities=46、sources=63、playbooks=12、calendar=33、docs=13 —— 与工作区实测一致。
- `MANIFEST.validation`：pipeline/validate/build = pass（与红队实测一致）。

### 11.2 git tag / commit 一致性

- `git cat-file -p v0.1.0`：annotated tag 对象 `6ec99c9` → target **commit 267197b**（= HEAD，`docs: record v0.1.0 manifest`）。
- commit `267197b` 的 parent = **401af1e**（`release: v0.1.0`，内容提交）——与 MANIFEST `git_commit=401af1e`、tag 注释「content commit 401af1e」一致。
- `git rev-parse 'v0.1.0^{commit}'` → `267197bc915e7a5ace6767d1a15d86cd53ab945`；`git ls-tree 267197b releases/v0.1.0/MANIFEST.json` 存在 → tag 指向的提交包含冻结清单。**一致。**

### 11.3 冻结 dist 的 file:// 冒烟（不引用工作区 app/dist）

- 从 `releases/v0.1.0/dist/index.html` 直接 file:// 打开：8 路由（指挥台/排行榜/机会详情/扫描室/方法论/数据源/商业日历/关于）+ 1024 指挥台共 **9 张截图**（`qa/screenshots/frozen/frozen-*.png`）。
- 均渲染成功、`jsErrors=0`；read_image 目检 frozen-01/02/03/08/09：KPI/榜单/详情/关于（v0.1.0 + REAL + 免责声明）/1024 布局均正常，无白屏、无报错。
- 结论：冻结产物可直接双击打开、离线可用。

### 11.4 冻结核验结论

| 项 | 结果 |
|---|---|
| MANIFEST sha256 全量 | ✅ 19/19 一致 |
| dist 与候选一致 | ✅ 同一 SHA256 |
| tag/commit/MANIFEST 一致 | ✅ v0.1.0→267197b→401af1e |
| 冻结 dist file:// 冒烟 | ✅ 8 路由 + 1024 正常，0 控制台错误 |
| **结论** | **冻结产物核验通过，v0.1.0 可发布。** |

> 发布后监控项：2 个 P2（前端 1024 卡片栅格/「新上榜」文案、cases.md RSS 证据）已在 v0.2.0 backlog；`verified:false` 仍是研究假设，使用前须复核原始来源（页面与 README 已声明）。

---

# 第 12 章 · v0.2.0 红队独立验收（2026-10-22 11:00）

> 项目版本：v0.2.0（app 0.2.0 / data 0.2.0）　｜　验收人：redteam　｜　任务：task-12
> 冻结：`releases/v0.2.0/`（git tag v0.2.0）　｜　线上：<https://charline88888-ux.github.io/opportunity-radar/>
> 结论：**P0=0 / P1=0 / P2=6（均不阻塞）；可发布 ✅**

## 12.1 结论

| 项 | 结果 |
|---|---|
| P0（阻塞） | **0** |
| P1（发布前应修） | **0** |
| P2（建议修，不阻塞） | 6（见 §12.8） |
| 数据 | pipeline --all exit 0 且 21 个 data 文件**字节级幂等**；validate **V01–V20 20/20 PASS（exit 0）**；unittest **28/28 OK**；红队独立脚本 data-qa-v02 **P0/P1/P2=0** |
| 历史/真实 delta | history 快照与 rankings 一致（V19）；无历史时回退 adjacent-window ✅；红队**内存构造上期快照**独立验证 history 路径（delta=+1/up、-1/down、缺窗口回退、无副作用）PASS |
| SQLite | `data/radar.db` 5 表（opportunities 46 / evidence 88 / rankings_history 92 / source_health 8 / meta 4）；`db.py --rebuild` 重建后 SHA256 **完全一致**；gitignore ✅ |
| 真实采集 | `--fetch` 实际结果：8 源尝试、**7 源成功**、185 条信号入 outbox（review.status=pending，未进机会库）；红队独立联网 `fetch_url` 实测 HTTP 200/1.76s；选中源均 green/yellow、**red 源 0 个被选中** |
| 报告 | 四窗口 HTML/MD 共 8 文件；HTML 自包含（0 外链 CSS/JS）、Chrome file:// 渲染正常；条目数与 rankings 一致（8/15/23/46）、含七问摘要+证据链接+免责；MD 同 |
| 前端 | `pnpm install && pnpm build` exit 0；strict 11 PASS、source=real、mock=[]；**构建可复现**（重跑 SHA256 与交付一致）；9 路由 file:// 截图目检无白屏；CDP 1024/1600 共 20 路由次无溢出/裁切/console error；`/lab` 实验新增/持久化/导出全部通过 |
| 冻结产物 | MANIFEST **19/19 sha256 一致**；dist SHA256 = `DE48EF7A…D0A7`；tag v0.2.0→e49364e（manifest 提交）→ d2ac16a（内容提交）；冻结 dist file:// 9 路由渲染 0 错误 |
| 线上一致 | 下载线上根 `/` 与 `/v0.2.0/` 的 index.html，SHA256 均为 `DE48EF7A…D0A7`，与冻结 dist **完全相同**；`/v0.1.0/` = `F24B0755…B7737` 与 v0.1.0 冻结版相同；`versions.json` latest=v0.2.0；线上 `/lab` 可访问 |
| **一句话结论** | **可发布**：数据/前端/报告/冻结产物/线上五层一致，P0=0、P1=0；6 个 P2 记入 v0.2.x backlog。 |

## 12.2 数据与扫描器验收（实测）

- `python scanner/pipeline.py --all` 连跑两次：exit 0；`data/` 下 **21 个文件（含 history / reports / radar.db / source-health）SHA256 前后完全一致**（幂等）。
- `python scanner/validate.py`：**20/20 PASS**，新增 V19（history 快照与同日 rankings 一致：1 份快照合法）、V20（source-health 8 源字段合法）。
- `python -m unittest discover -s scanner/tests`：**28 tests OK**（覆盖 history delta/回退、报告、SQLite 重建、RSS/Atom/JSON 解析、红源筛选）。
- 红队独立脚本：
  - `qa/data-qa-v02.py`：P0/P1/P2=0（版本 0.2.0、history、delta_basis、source-health、reports、SQLite 全覆盖）；
  - `qa/history-check.py`：PASS（无历史重建与文件一致；构造上期快照后 delta/change 精确 +1/up、-1/down；缺窗口回退；无副作用）。
- 数据指纹（SHA256 前 16，与 data-engineer 交付一致）：opportunities `52B30E45B356CEA9`、rankings `AD79B0AA1B8CFFF8`、history `170F44478DC20A5D`、stats `4F58F249566C5627`、source-health `9335EFF3455805D6`、taxonomy `D0B01FF00FE79CCD`、radar.db `D8F67AD20FE11CA0`。
- 版本：taxonomy/rankings/stats/sources/playbooks/calendar `meta.data_version` 均为 0.2.0；rankings.meta 含 `delta_basis=adjacent-window`、`history_as_of=null`、`tie_breaker`；榜单 8/15/23/46，排序链与契约 §5.1 一致。
- 报告：`data/reports/report-{day,week,month,year}-2026-10-22.{html,md}`；sections=8/15/23/46 与 rankings 一致；HTML 含 `<div class="seven">` 七问摘要、证据链、风险、免责（“研究假设，非投资建议”）；Chrome file:// 渲染成功（qa/tmp/report-day.png）。
- 采集：`scanner/outbox/signals-2026-10-22.json` 185 条（7 源），meta.mode=online-fetch、review.status=pending；outbox 未混入 opportunities（抽样核对）；`data/source-health.json` 8 源、7 ok、1 失败（shopify-changelog）。

## 12.3 前端验收（实测）

- `cd app && pnpm install && pnpm build`：install exit 0；build exit 0；strict 自检 **11 PASS**（taxonomy/weights/opportunities/rankings/rankings-meta/sources 67/playbooks 12/calendar 33/stats/history 1/source-health 7-8 ok）；`source=real`、`mock_files=[]`；单文件 dist 2,049,902 B。
- **构建可复现**：红队重跑 `pnpm build` 前后 dist SHA256 均为 `DE48EF7AA93FE473DBCE9C2F35AB7E419BEECC2486E21388DF5292F4B854D0A7`（与前端交付一致）。
- 9 路由 file:// 截图（`qa/screenshots/v02/01–09`）+ read_image 目检：指挥台（进行中实验 0/1、较周榜变化 12、数据健康条）、排行榜（口径标签「相邻窗口（历史快照不足1天）」、导出按钮）、详情（7 天实验卡、机会卡 MD、榜单口径）、扫描室/方法论/数据源（67 平台）/日历/实验台/关于（v0.2.0、数据 0.2.0、历史快照 1、采集 7/8、GitHub+Pages 链接、11 PASS）均正常；无白屏。
- CDP（1024/1600 × 10 路由次）：`horizontalOverflow=false`、`clippedElements=0`、`zeroSizeCanvas=0`、`consoleErrors=0`；404 兜底正常。
- `/lab` 实验台：从详情点击「开始 7 天实验」→「加入并开始」→ localStorage `radar:experiments:v1` 写入 1 条 → `/lab` 列表显示进行中 1；导出 MD/JSON 下载成功（实验记录 MD 含状态/预算/复盘日期）；详情导出 `opportunity-opp-pet-memorial-glass-001.md`（含七问/证据/免责，4107B）；榜单导出 `report-week-2026-10-22.md/html`（含七问/证据/免责）。
- P2 修复验证：1024 无溢出（栅格修复生效）；Dashboard/榜单/详情均显示 delta 口径标签；「新上榜」改为「较周榜变化 12」。
- 已知（前端声明，核实一致）：根 VERSION 已在发布时 bump 为 0.2.0；剪贴板无权限时降级为下载（属浏览器权限，非缺陷）。

## 12.4 冻结产物核验（releases/v0.2.0）

- MANIFEST `files` 19 条：逐条重算 bytes+sha256 → **19/19 全部一致**；`app_version=0.2.0`、`data_version=0.2.0`、counts 46/67/12/33/13、open_path/rollback 正常。
- dist：2,049,902 B，SHA256 `DE48EF7A…D0A7`（= 前端交付 = 红队可复现构建）。
- git：annotated tag `v0.2.0`（tag 对象 e49364e）→ commit e49364e（docs: record manifest）→ parent `d2ac16a`（release: v0.2.0，内容提交）；MANIFEST `git_commit=d2ac16a`、`git_tag=v0.2.0` 一致。
- 冻结 dist file:// 冒烟：`qa/screenshots/v02-frozen/01–10`（9 路由 + 1024 /lab），全部渲染、jsErrors=0；read_image 目检 dashboard/rankings/lab/about 正常（v0.2.0、REAL、免责、实验台、11 PASS）。
- 旧版本隔离：`releases/v0.1.0/` 未被修改，线上 `/v0.1.0/` 仍是 v0.1.0（见 §12.5）。

## 12.5 线上（GitHub Pages）核验

- `https://charline88888-ux.github.io/opportunity-radar/`：HTTP 200；Chrome headless 截图 4 张（`qa/screenshots/v02-online/`），read_image 目检：指挥台/实验台/关于均为 v0.2.0 + REAL DATA + 数据 0.2.0，KPI 46 / 今日新信号 8 / A+ 11 / 开放窗口价值 ¥418 万。
- **字节级一致性**：下载线上 index.html 与冻结 dist 比对——
  - `/` 与 `/v0.2.0/`：2,049,902 B，SHA256 `DE48EF7A…D0A7` = `releases/v0.2.0/dist/index.html` ✅
  - `/v0.1.0/`：1,979,378 B，SHA256 `F24B0755…B7737` = `releases/v0.1.0/dist/index.html` ✅
  - `versions.json`：HTTP 200，latest=v0.2.0，versions 含 v0.1.0(`/v0.1.0/`)、v0.2.0(`/`)，与仓库 `qa/tmp/pages-site/versions.json` 一致。
- `/lab` 线上可访问（hash 路由截图 normal）；线上与本地冻结版 bodyHash/文本长度/卡片顺序 CDP 对比 `consistent=True`。
- 结论：线上版本与 v0.2.0 冻结产物**完全一致**，旧版归档可用，无版本串台。

## 12.6 复现命令

```powershell
cd 'E:\全球商机扫描器'
python scanner/pipeline.py --all
python scanner/validate.py                 # 20/20 PASS
python -m unittest discover -s scanner/tests   # 28 OK
python qa/data-qa-v02.py                   # P0/P1/P2=0
python qa/history-check.py                 # PASS（构造上期快照验证真实 delta）
python scanner/db.py --rebuild             # 重建后 SHA256 不变
cd app; pnpm install; pnpm build           # strict 11 PASS，dist 可复现
# file:// 9 路由截图（qa/screenshots/v02/）与 CDP：见 qa/cdp-routes.mjs、qa/frontend-qa-v02.mjs
node qa/online-qa.mjs <port> https://charline88888-ux.github.io/opportunity-radar/ "file:///…/releases/v0.2.0/dist/index.html"
```

## 12.7 截图索引（v0.2）

| 目录/文件 | 内容 |
|---|---|
| `qa/screenshots/v02/01–09` | 工作区 dist 9 路由（dashboard/rankings/detail/scanner/method/sources/calendar/**lab**/about）1600×1000 |
| `qa/screenshots/v02/10–12` | 详情长页 / Lab 长页 / About 长页 |
| `qa/screenshots/v02/13–15` | 1024 下 dashboard / rankings / lab（无溢出） |
| `qa/screenshots/v02-frozen/01–09 + 10` | **冻结 dist** 9 路由 + 1024 /lab（发布基线） |
| `qa/screenshots/v02-online/online-01…05` | 线上 dashboard / rankings / **lab** / about / v0.1.0 归档 |
| `qa/tmp/report-day.png` | 后端报告 HTML（data/reports/report-day）Chrome 渲染 |
| `qa/tmp/downloads/*` | 前端导出的机会卡 MD、实验记录 MD/JSON、周报 MD/HTML |

## 12.8 P2 清单（6 个，均不阻塞）

| # | 位置 | 问题 | 建议 | 负责人 |
|---|---|---|---|---|
| P2-1 | `data/source-health.json`（shopify-changelog） | 失败源 `ok=false` 但 `error=null`、无失败原因（data-engineer 口述「HTML 非 feed」未落到数据）；V20 只校验字段合法，不要求原因 | fetch.py 失败时写 `error`（如 "not a feed / parse_failed:0 items"），并把失败原因写入 outbox meta | data-engineer |
| P2-2 | `data/source-health.json`（全 8 行） | 所有源 `latency_ms=0`、`cached=true`（最终一次 fetch 命中缓存重新生成），但 `meta.mode="online-fetch"`，易被误读为「全部实时成功」 | meta 增加 `cached_count` / `mode=online-fetch(cached)`，或保留首次实时运行的 latency；README 说明健康度可能来自缓存 | data-engineer |
| P2-3 | 发布数据 | 仅 1 份 history 快照 → 线上 `delta_basis=adjacent-window`（按契约回退，正确），但「真实历史 delta」仅靠单测/红队内存构造验证，未在真实数据出现 | 下一次 pipeline 运行自然产生第 2 份快照后，delta_basis 自动切 history；在 DEV/OPS 说明首版限制 | data-engineer / Lead |
| P2-4 | `docs/00` 头部与 §12 | 头部仍写「版本 v0.1.0」，§12 验收表仍是 v0.1.0 数据（46 条、27→22 去重、V01–V15），与新增 §14 v0.2.0 章节并存；§12 引用 `qa/validate-final.txt`（v0.1） | 头部改 v0.2.0；§12 标注「v0.1.0 历史验收」并链接本章 §12；引用更新为 `qa/v02-validate.txt` | Lead |
| P2-5 | `scanner/report.py:126` | `generated_at=datetime.now()`，重跑报告内容会变（`pipeline --all` 不重生成报告，故冻结产物不受影响；但报告不可字节复现） | 在 DEV/README 说明报告生成时间非确定性；如需归档可另存 rendered-at 字段 | data-engineer |
| P2-6 | `releases/v0.2.0/docs-snapshot/09` | 冻结快照中的 docs/09 是 freeze 前版本（未含本次 v0.2 验收记录）——releases 只读，属预期；仓库 docs/09 已在冻结后补 v0.2 记录 | 发布说明注明「docs 快照 = freeze 时点」；后续版本快照自然包含 | Lead |

> 另：`scripts/install-daily-task.ps1` 仅做静态检查（参数/命令正确），**未实际执行**（避免修改本机任务计划）；`scripts/deploy-pages.ps1` 结果由线上核验间接验证。

## 12.9 与 v0.1.0 验收的关系

- v0.1.0 的 P0/P1 全部闭环后冻结；本次 v0.2.0 在其上增量，v0.1.0 冻结产物与线上 `/v0.1.0/` 均未被修改（字节级核对）。
- v0.1 报告 §11 的冻结记录仍有效；本章为 v0.2.0 的独立验收记录（不覆盖历史）。
