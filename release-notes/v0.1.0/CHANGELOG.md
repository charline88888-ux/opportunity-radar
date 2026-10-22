# v0.1.0 变更明细（CHANGELOG）

> 日期：2026-10-22　｜　应用版本：0.1.0　｜　数据版本：data-v0.1.0　｜　首个版本

## 新增（Added）

### 前端应用（app/）

- 8 个页面：指挥台（Dashboard）、排行榜（Rankings）、机会详情（OpportunityDetail）、扫描室（Scanner）、方法论（Method）、数据源矩阵（Sources）、全球商业日历（Calendar）、关于（About）。
- 18 类数据可视化：KPI 卡、评分直方图、14 天趋势、区域/行业/需求分布、treemap、雷达图（评分/需求/Hofstede）、热力矩阵、桑基图、气泡/散点、折线、仪表、排名变化等。
- 榜单交互：日/周/月/年四窗口、14 行业板块筛选、12 信息差筛选、排序切换、卡片/表格视图、排名变化标记。
- 机会详情：七问全景、10 维评分雷达、自定义权重滑杆实时重算、ROI 卡、证据链（tier 徽章）、7 天验证 checklist（localStorage）、证伪条件、风险合规、相关机会。
- 方法论交互：10 维权重滑杆实时重排 Top10、窗口衰减曲线、Hofstede 文化雷达。
- 深色数据终端设计系统（tokens、字体、图表主题、响应式 1440/1024）。
- 构建期数据同步 + 契约自检（strict 模式禁止 mock）；`vite-plugin-singlefile` 单文件产物，`file://` 双击可用。

### 数据（data/，data-v0.1.0）

- `taxonomy.json`：14 行业、12 人性需求、6 神经递质、24 情绪、12 信息差类型、7 驱动、12 商业模式、11 区域、10 评分维度（权重合计 1.00）、20 标签、5 等级。
- `opportunities.json`：46 条机会（七问全答、88 条证据、38 个目标国家/地区、18 条中国供应链角度；14/14 行业、11/11 区域、12/12 信息差全覆盖）。
- `rankings.json`：日 8 / 周 15 / 月 23 / 年 46，确定性排序，delta/change 口径写入 meta。
- `stats.json`：KPI、4 组分布、评分直方图、14 天趋势、开放窗口价值。
- `sources.json`：12 大类 63 个平台（访问方式/频率/成本/合规/价值分/坑与替代）。
- `playbooks.json`：12 个可执行扫描剧本（步骤/平台/关键词/时间盒/质检点）。
- `calendar.json`：33 个 2026–2028 全球商业日历节点。
- `data/README.md`、`data/CHANGELOG.md`。

### 扫描器（scanner/）

- Python 3.11 纯标准库流水线：adapters(4，离线 fixtures) → normalize → dedupe → materialize → score → rank → stats → validate → pipeline CLI。
- 评分：10 维加权、Decimal ROUND_HALF_UP、momentum 调整、等级映射、窗口状态推导。
- 校验：V01–V18 契约校验，失败 exit 1。
- 测试：18 条 unittest（公式/舍入/等级边界/ISO 周/榜单/异常路径）。
- 文档：`scanner/README.md`。

### 文档（docs/，13 份 00–12）

00 总览路线图、01 业务蓝图与商业模式、02 平台与数据源全矩阵（171 个平台条目/≥110 独立平台）、03 扫描方法论（人性需求逆向工程）、04 评估评分体系与推荐算法、05 商业驱动七问框架、06 产品形态与交付设计、07 技术架构与扫描流水线、08 运营与增长手册、09 风险合规与红队清单、10 版本与发布管理、11 补充清单 40 条、12 数据契约与字段字典。

### 研究（research/）

40 个 2025–2026 真实案例、62 条平台可访问性验证（12 类）、16 国文化差异笔记（含中东宗教文本翻译、宠物纪念玻璃两个专题）、12 个高价值案例交接底稿。

### 工程与发布

- git 仓库初始化、`.gitignore`、`VERSION`、README 导航。
- `scripts/release.ps1`：一键校验 → 构建 → 冻结 `releases/vX.Y.Z/` → MANIFEST（sha256）→ git commit/tag。
- `releases/v0.1.0/`：dist + DEV.md + OPS.md + CHANGELOG.md + MANIFEST.json + docs 快照。
- 任务板与多智能体协作：7 名成员、写域隔离、红队独立验收。

## 修改（Changed）

- 契约示例算术修正：宠物纪念玻璃示例 `total` 78.6 → **78.9**、`rank_score` 81.4 → **81.7**（冻结前澄清，公式优先）。
- 契约补充（data-v0.1.0 冻结前澄清）：§4.7 `window` 语义（months_left/status/decay 映射）、§4.5 四舍五入口径（ROUND_HALF_UP）、§5 delta 口径（v0.1.0 = 相对相邻更大窗口）、§9 新增 V16–V18、sources frequency 增加 `yearly`。
- `docs/05` 文件名统一为 `05-商业驱动七问框架.md`（修复跨文档链接）。
- 年付定价统一为 ¥999（docs/00/01/08）。
- 90 天实验节奏统一以 docs/01 §10.1.1 为基线（EXP-01~04）。
- 前端 `file://` 打开方式：从多文件 ES module 改为单文件内联。

## 修复（Fixed）

- `file://` 双击黑屏（ES module CORS）→ 单文件构建。
- Dashboard「契约自检 FAIL」→ strict 重建后 PASS，并作为发布 Gate。
- data-engineer：V07 日期越界、V10/V12 meta.count、V16 窗口映射、评分舍入口径、materialize 缺维度静默补 0、rank 非法日期静默跳过、dedupe kept 不一致、normalize 非法情绪 id、verified 标记不诚实（034）。
- 前端：mock 数据不得进入发布构建（strict 强制校验）。
- 文档：docs/04 对契约的过时指控；docs/01/02/08 的 P2（90 天目标口径、源健康等级命名防混淆）。
- 红队 P1：扫描器缺必填校验、无测试、无 README；全部关闭。
- 红队终验 P1-1：3 个机会 5 条证据引文不可回溯（Etsy 店铺页配具体评论、Reddit 版块首页配具体抱怨）→ 保留真实 URL，引文降级为可回溯的 listing 标题级/社区讨论主题级描述，`verified` 保持 false，并在 `compliance_notes` 说明；未编造任何 URL。
- 终验 P2：cnstock 证据日期修正为原文发布日；8 条机会 `moat` 扩写为「壁垒+前置条件+被复制周期」；评分 `compute_total` 改 Decimal 逐项累加；`docs/00` 验收表替换为红队实测结果（V01–V18）；契约 §4.7/§5/§9 的 months_left、tie-breaker、V06 口径澄清。
- 冻结前 P1（契约与实现不一致）：`scanner/rank.py` 排序键由 `(-rank_score,-total,id)` 改为契约链 `(-rank_score,-momentum,-evidence_count,-last_activity,opp_id)`，重算 rankings（month/year 共 5 组并列名次调整），新增 1 条 tie-breaker 单测（19/19 OK）。

## 移除（Removed）

- 无（首版）。

## 数据版本变化

- `data-v0.1.0`：首个冻结数据版本。46 条机会 / 63 源 / 12 剧本 / 33 日历节点 / 四窗口榜单。
- 应用版本 v0.1.0 与数据版本 data-v0.1.0 一一对应，记录于 `MANIFEST.json`。

## 已知限制（Known limitations）

- 采集适配器仅离线 fixtures；41/46 机会未二次核验 URL；delta 无历史快照；无 S 级机会；宗教日期为预计值；单文件 1.98 MB。
- 详见 `DEV.md` §7 与 `qa/report.md`。

## 升级与回滚

- 升级：新版本目录 + 新 git tag，旧版本只读（`docs/10`）。
- 回滚：打开上一版本 `releases/vPREV/dist/index.html`。
