# data/ 数据变更记录

格式：`data_version` + 日期 + 变更内容 + 影响面。契约变更（字段/枚举/公式）必须同步更新 `docs/12-数据契约与字段字典.md` 并通知 Lead、前端、红队。

## data-v1.2.0 · 2026-10-23 · MINOR（商机评估深化：商业画布/判断依据/执行方案）

- 新增 `scanner/business.py`：按 **14 行业知识包**（宠物/银发/情绪/AI/跨境/内容/教育/本地/绿色/合规/文化/游戏/金融支付/制造）+ **12 信息差** + **11 区域规则**，为每条候选生成商机评估说明书，全部离线确定性、无人工输入。
- 每条候选新增 10 组字段：`business_canvas`（客户细分/价值主张/渠道/客户关系/收入来源/核心资源/关键活动/重要伙伴/成本结构 9 块）、`judgment`（10 维 score+rationale+data_used、why_opportunity、not_opportunity_if）、`competition`（直接/间接/替代/差异化/护城河/定位）、`cross_market`（目标市场/套利类型/可迁移原因/本地化/定价权）、`timing`（why_now/催化剂/窗口阶段/窗口月数/紧迫性/风险）、`conditions`（资金区间/技能/资质/供应链/伙伴/团队/启动时间）、`barriers`（监管/技术/资金/品牌/渠道/区域）、`profit_model`（收入模型/定价/毛利/成本/单位经济/回本/规模化）、`execution_plan`（0–30 天/30–90 天/里程碑/首笔收入/指标）、`sources`（来源/链接/等级）。
- 内容引用信号标题实体与数字（如 `Malaysia/Thailand/MAS`、`30 million`）；实测 200 条候选 **200 个不同画布**，同行业不同信号内容有差异；候选 JSON 全量 grep `验证/实验/复核/门禁` = **0**。质量迭代：实体清洗（去来源尾缀/题首动词/泛化词，保留品牌/国家/机构/数字，无数字不写占位语）；主行业按标题关键词优先判定（支付→fintech、短剧→content、跨境→crossborder、宠物→pet…）；事件类型（policy/funding/launch/partnership/demand/cost/market）驱动 why/not_opportunity_if/窗口/条件/执行方案；区域按标题国家/城市优先匹配（MAS→东南亚）。二次质量迭代：`industry_ids` 以 primary_industry 为首并仅保留强相关第二行业（MAS=fintech+crossborder；PineDrama=content；Z 世代非洲=crossborder），顶层新增 `primary_industry`；why_opportunity 改为「实体（事件）意味着事件逻辑；在区域，行业专属缺口；可用商业模式切入，窗口约 X 个月」；执行方案第 3 步改为具体动作（合规材料/通道测试/本地客服），不再塞事件说明；profit_model 增加 `revenue_streams` 数组（保留 `revenue_model`）。
- 数据版本 **1.2.0**（全部 meta）；候选 200、四窗口 day99/week200/month200/year200 不变；报告/榜单/统计已重生成；cold-cache determinism（删翻译缓存冷跑 candidates 与冻结一致）；`--all` 幂等。
- validate **20/20**；unittest **97/97**（新增画布/判断/实体引用/同行业差异/确定性测试）。
- 指纹（SHA256 前 16）：candidates `36624C7995E2C676`（全值 `36624C7995E2C6769456F191034AF722A7B6C55DC7BFD9A131C4DB858140F27F`）、candidate-rankings `755BC10BB80FD2FB`（`755BC10BB80FD2FB64243419AD696027B40AF28606AB05C2253EEF4A0087423D`）、stats `2B11F3B81F52A6B5`、rankings `B5ED9A22569464BC`、report-day `37D33C34CD1D89E1`；代码 business.py `C9E51A0FF53887E4`（全值 `C9E51A0FF53887E4D36ACE11EDE80EA5DB9B87F1043FEF9089187313029D70B7`）、candidates.py `37A8F5F64895218C`（全值 `37A8F5F64895218C82D09AD4F861C374E318F4694B12677EF08385F1C8E50AE6`）、translate.py `2350C346277FD68C`（未变）。

## data-v1.0.1 · 2026-10-23 · PATCH（候选文案清洗）


- 候选 `seven_questions` 彻底移除验证/实验/复核/门禁措辞：`渠道` → 小成本测试；原 `验证` 键改为 **`跟踪`**（答案「14 天内观察到询价/预约/加购等可量化信号再投入（自动草稿）。」）；成本问句 → 「最小启动成本与最大风险分别是什么？」。
- `one_liner` 结尾统一为「（自动发现线索，系统已初筛）」；`system_validation.notes` 改为「系统自动评估商机信号…不代表收入承诺。」；候选 JSON 全量 grep `验证/实验/复核/门禁` = **0**。
- 重生成 candidates/candidate-rankings（评分/窗口/排序不变：day99/week200/month200/year200）；data/candidates meta 升 **1.0.1**。
- 校验：validate **20/20**；unittest **95/95**（当前 tests 仅 test_scanner.py，控制台测试已随控制台移除）；cold-cache determinism：删翻译缓存冷跑两次 candidates 与冻结文件字节一致。
- 指纹：candidates `9BBCEF35F3DEB438`（全值 `9BBCEF35F3DEB438D40BFEC178123AA18F0F2E6C2A0443AF0C33D93F84E77034`）、candidate-rankings `55EDA0E369FAED1D`（`55EDA0E369FAED1D79D0B2794511DC71CE4081E993D431FBB52798F15C78B186`）、stats `3D5040A0A56D6680`、rankings `8C2A9476599EAADF`、sources `F46C8D8DA0D6C905`、source-health `10921D63AFFD43D2`、radar.db `7292BD1D772DE786`、report-day `AE1A0B9ABD9BFDE4`、candidates.py `31E44FB0C8D81484`；translate.py `2350C346277FD68C` 未变。
- funnel 以当前 `data/source-health.json` 为准：**attempted 101 / ok 100 / failed 1（tech-eu HTTP 403）**；冷缓存 candidates 与冻结文件一致。

## data-v1.0.0 · 2026-10-23 · MAJOR 核心回归（只留扫描→候选→四窗口榜）


> 产品边界回归：**每日扫描 → 系统评估商机 → 自动候选/精选入榜**。删除验证/实验/校准/年度/画像/预警/数据包/控制台等非核心功能与产物；系统只负责发现与评估，不验证个人商业结果。

### 保留
- `opportunities.json`（80 条精选：七问/证据/评分）、`candidates.json`（200 条自动候选：title_zh/one_liner_zh/summary_zh/评分/等级/行业/信息差/区域/来源/七问草稿/证据/ROI/免责）、`candidate-rankings.json`（四窗口 day99/week200/month200/year200）、`rankings.json`（四窗口精选）、`sources/source-health`（168 平台/101 enabled）、`taxonomy/playbooks/calendar/stats/history`、四窗口报告 `report-*-2026-10-23`（day/week/month/year × html/md）。

### 删除/停用
- `data/reports/calibration-*`、`data/reports/yearbook-*` 已删除；报告只保留四窗口 8 文件。
- 候选与 meta 去掉 `verification_status`、`verification_default`、`verification_affects_ranking`、`verified_by_system` 等实体验证字段；保留纯系统评估 `system_validation`（level/score/checks/notes，仅评估商机信号，不代表收入承诺）。
- stats 去掉验证计数（保留 candidates_total/today_new_candidates）；非核心功能（calibration/yearbook/experiments/profile/alerts/data-package/console）不再生成或停用。

### P1 修复（翻译冷缓存 determinism）
- `translation.quality` 改为只由最终翻译文本/provider 计算（`translate.quality_for_translated`），缓存命中时重算，不受 warm-cache 历史影响；缓存 key 加入 glossary/cache 版本。
- 验证：清空 `scanner/build/translation-cache.sqlite*` 后冷跑两次 `candidates.py` 字节一致，且与冻结文件一致（cold1==committed、cold2==cold1、`--all`==cold）；`--all` 双跑 0 变化。

### 版本/复核
- data 全部 meta **1.0.0**；validate **20/20**；unittest **123/123**；报告/候选/统计/榜单已重生成；db 80/156/654/101。
- 指纹（SHA256 前 16）：opportunities `88FDA5AB84B7F826`（未变）、rankings `4CF2818567471AB8`、stats `9280D34B27CFECEE`、candidates `7FA17E2719DE342E`、candidate-rankings `666E1C66D04B06CE`、sources `3DC888F74A98E536`、source-health `8239A155E8215994`、radar.db `9CE2AD8540BEACD1`、report-day-10-23 `0B1E887AB73956D0`；代码 translate.py `2350C346277FD68C`、candidates.py `36F3556796FDE918`。

## data-v0.9.3 · 2026-10-23 · MINOR 增量（系统级翻译子系统）


> 翻译是**系统功能**：每次候选生成自动翻译，带 SQLite 缓存、可切换 provider、失败回退；翻译质量不参与商机收录/排序。

### A) `scanner/translate.py`（新增）
- provider：`glossary`（默认离线，**898 条**高频短语/实体词典 + 功能词 + 城市/品牌/行业）、`llm`（OpenAI 兼容，需 `LLM_API_KEY`，可选 `LLM_BASE_URL`/`LLM_MODEL`，失败回退 glossary 并标 `fallback=true`）、`mock`（测试用、不联网）、`source-zh`（原文含中文直通）。
- 缓存：`scanner/build/translation-cache.sqlite`（gitignore），key=sha256(provider+target+source_lang+text)，命中 `cached=true`；`translate()` 返回 `{text,provider,quality,cached,source_lang,target_lang,fallback}`；质量 high/medium/low/source-zh。
- CLI：`python scanner/translate.py --text ... --provider glossary|llm|mock`、`--stats`、`--clear-cache`、`--no-cache`。

### B) 候选自动翻译（`candidates.py`）
- 每条候选自动生成 `title_zh(≤40，真实翻译句子，不做行业标签拼接)/one_liner_zh(≤60)/summary_zh(≤160)/title_original/translation{provider,quality,cached,source_lang,target_lang,fallback,disclaimer}`（`translation_method` 保留为 provider 别名）；`--translate-provider`/`--no-translate-cache` 可切换；无 `LLM_API_KEY` 时默认 glossary、**不联网**。
- meta `translation_summary`：实测 200 条 **provider glossary 194 / source-zh 6**、**cached 200（100%）**、**中文覆盖 1.0**、quality medium 107 / low 87 / source-zh 6（按英文残留 token 比例+长度判定；仅残留 >50% 才回退中文模板 quality=low/template=true）、glossary_entries 898；翻译不参与排序，保留 `title_original` 供前端切原文。
- 抽检 10 条标题示例：`马来西亚、泰国央行加入 MAS 跨境支付倡议`、`如何 Z 世代消费者是改变商业在非洲`、`字节跳动’s PineDrama targets overseas 增长与 e…`、`Lianlian 全球合作 PayPal 到 Power 跨境 Payouts…`、`欧盟 Council agrees negotiating stance 为中…` 等。

### C) 版本/复核
- data 全部 meta 升 **0.9.3**（含 history/outbox）；candidate-rankings 四窗口 day 99/week 200/month 200/year 200；stats 候选 200/今日新增 99；报告/年鉴/校准 0.9.3；db 80/156/654/101。
- validate **20/20**；unittest **123/123**（新增翻译 glossary/缓存/source-zh/无 key 回退/mock/LLM mock server 等 6 条）；`--all --as-of 2026-10-23` 双跑幂等（data JSON+db+reports 0 变化）。
- 指纹（SHA256 前 16）：opportunities `88FDA5AB84B7F826`（未变）、rankings `836198F64B04EC7E`、stats `482DEFFA9B32E4B6`、candidates `EDF645EC7EA065C5`、candidate-rankings `E93AD02ADB011265`、sources `6C44A7205E094616`、source-health `6610891B734027D8`、radar.db `655B8DA58A019464`、report-day-10-23 `F09089F3719797FB`、yearbook `EDF3454B0C8FD5DA`、calibration `3DDBD5C27A5E85C7`；代码 translate.py `40E52B557530C807`、candidates.py `7965625ED832CD07`、config.py `7506A64C61F95AFE`、pipeline.py `98B56D04CA8030DC`。

### 已知不足
- glossary 为词典式翻译（quality medium 120 / low 74），个别标题仍偏模板/带英文残词；LLM 需 key 才能高质量。
- 候选标题额外做「行业·信息差 + 中文片段」拼接以保证可读性与 ≤28 字，可能丢失部分原文细节；`title_original` 始终保留原文。

## data-v0.9.2 · 2026-10-23 · MINOR 增量（商机系统评估 + 中文候选 + 漏斗修复 + 源 168/101）

> 边界原则（用户明确）：**“是不是商机”由系统评估（需求/信息差/证据/时效/可执行性），无需人工；“能不能赚钱”是个人线下实体验证（可选），系统不验证、不承诺、不作为门禁。**

### A) 商机系统评估（`scanner/candidates.py`）
- 每条候选新增 `system_validation`：`verified_by_system=true`、`level(high|medium|low)`、`score(0-100)`、`checks`（**8 项**：需求信号、信息差明确、证据链接、来源质量、时效、可执行性、地理/场景具体性、竞争/窗口）、`notes`（边界说明）；meta 新增 `system_validation_summary{high,medium,low,avg_score,verified_by_system,note}`。实测 200 条：**high 53 / medium 133 / low 14，avg 92.9**，纯自动计算、无人工/实验输入。
- `verification_status` 语义改为**个人实体验证**：默认 **not_started**（可选 observing/tested），仅展示、**不参与收录/排序**；meta 增加 `verification_status_default`、`verification_affects_ranking=false`；stats 新增 `verification_not_started_candidates=200`、`system_verified_candidates=200`。

### B) 候选中文化
- 新增 `title_zh(≤28)/one_liner_zh(≤60)/title_original/translation_method(template|source-zh)`；英文源用词典+行业/信息差模板生成中文主标题，中文源保留原文；质量实测 **200/200 有中文标题（ratio 1.0；template 194 / source-zh 6）**，无英文整句直接搬运；英文原标题保留在 `title_original`。

### C) 漏斗计数（控制台）
- `serve.py` 的 `/api/status.outbox.funnel` 与 `source_count` 改为以 `data/source-health.json` 真值为准：**attempted 101 / ok 101 / failed 0**（含 `failed_sources[{id,http_status,error}]`）；raw 2420 → deduped 1892 → new 1865 → relevant(business) 344 → candidates 200（candidates meta 同步 `funnel`）。

### D) 源修复/扩充（168 平台 / 101 enabled / 11 区域）
- `fetch.py` 增加 XML 容错（清理未转义 `&`/控制字符后重试）→ **rest-of-world 恢复**（200/12 条）；**Arab News 403 换源 Middle East Monitor**（200/50）；补 8 个实测源：The New Arab、BBC Business、Guardian Business、NPR Business、Phys.org、ScienceDaily、MIT Technology Review、Wired；8 个 disabled 保留原因。
- 干净重置 ledger/outbox 后 `--fetch --no-cache --fetch-limit 160`：**101/101 源成功**、2420 原始 → 1892 信号、**new 1865 / seen 27 / ledger 1865**；source-health 101 行 items 2420、mode=online-fetch。
- 控制台 fetch 命令增加 `--fetch-limit 120`（覆盖全部 enabled）；job 日志流式解码改为 `_decode_locale` 逐行（UTF-8 严格优先/本地编码兜底）并给子进程设 `PYTHONIOENCODING=utf-8`。

### E) 版本/复核
- 全部 data meta 升 **0.9.2**（含 4 份 history、outbox/source-health）；候选四窗口 **day 99 / week 200 / month 200 / year 200**；stats 候选 200 / 今日新增 99；精选 80 条与 opportunities 内容口径不变；报告/年鉴/校准按 0.9.2 重生成；db 80/156/654/101。
- validate **20/20**；unittest **117/117**（新增 XML 容错、system_validation/中文覆盖等）；`--all --as-of 2026-10-23` 双跑幂等（data JSON+db+reports 0 变化）。
- 指纹（SHA256 前 16）：opportunities `88FDA5AB84B7F826`（未变）、rankings `70D0970C5FF94AC7`、stats `331BBBB9CA4F71D1`、candidates `EF822C7152AD1A65`、candidate-rankings `FC10B813E4D9C1A6`、sources `1354E3C4DA59AE38`、source-health `3A019B49C4E33311`、radar.db `ACFFA988B489E99B`、report-day-10-23 `B0861D45E123624B`、yearbook `6192622D29872171`、calibration `4B6E84C2F7B2918F`；代码 candidates.py `04E32E9976FFE079`、fetch.py `39F9E07D636F5125`、serve.py `BE893F5EA3B20176`、stats.py `56BB4E8C1BB26385`、config.py `64BE106E19F3B845`。

### 已知不足
- system_validation 为启发式评分，`level_thresholds={high:95,medium:87}` 按当前数据分布设定，后续可校准；不代表“能赚钱”。
- 中文标题模板化（template 194/200），品牌/专名仍保留原文；后续可接离线词典/可选 LLM 提升自然度。
- Google News/聚合源仍为宏观新闻；源 101 enabled，首跑联网约 6–8 分钟。

## data-v0.9.1 · 2026-10-23 · MINOR 增量（源 160/91 + 候选质量：清洗/gap 兜底/新鲜度）

> 双轨与验证原则不变：自动候选直接上榜，`verification_status` 仅展示、不参与收录/排序；机会库仍 80 条人工库。

### A) 源扩充（`data/sources.json`：125 → **160 平台 / 91 enabled 自动源 / 11/11 区域**）
- 并入 researcher `sources-expansion.md` 的 **25 个实测 RSS**：Supply Chain Dive、FreightWaves、Skift、Petfood Industry、Tech.eu、RetailDetail EU、Euronews Business、36Kr、Japan Times、iFanr、SSPAI、CNA Asia、Bangkok Post、YourStory、ET Tech、Nairametrics、BusinessDay NG、Brazil Journal、Startup i、SmartCompany AU、vc.ru、Federal Register、WTO News、EU Commission Press（Arab News 403 → enabled=false）。
- `rest-of-world` URL 已修复为 `https://restofworld.org/feed/latest/`（researcher 实测 200/12），但本机 XML 解析报 invalid token（feed 含未转义字符）→ enabled=false 并记录；后续可加 XML 容错后重启。
- Google News 新增 **TR 地区** + 3 条实测 query（`retail startup funding` US / `宠物 消费` CN / `حلال أعمال` SA）；App Store Top Free JSON 新增 **jp/br/in/ng/ae/au 6 国**（`access="json"`，`config.ACCESS_MODES` 增加 json）。
- 干净首跑（重置 ledger/outbox 后，`--fetch --no-cache --fetch-limit 120`）：**92 源尝试 / 91 成功**、2177 原始 → 1653 信号、**new 1627 / seen 26**（账本 1627）；source-health 92 行、items 2177、mode=online-fetch；仅 rest-of-world 失败。

### B) 候选质量（`scanner/candidates.py`）
- **标题/摘要清洗**：去 HTML 标签/实体/多余空白/来源尾缀（" - 来源"）/引号，标题 ≤28 字、摘要 ≤160 字，剔除 Read more/阅读全文 等残句。
- **gap 启发式兜底**：industry → gap、source_category → gap、关键词 → gap 三层映射（并保留信号显式 gap）；实测 **gap 覆盖 200/200（missing 0、ratio 1.0、fallback 28）**，meta 新增 `gap_inference_coverage{inferred,missing,ratio,fallback_used,target_max_missing_ratio}`；候选增加 `gap_inferred` 标记。
- **新鲜度/去重**：business/maybe 均按 published_date 降序处理，同 canonical URL 只保留最新（first/last_seen 取最新），同标题去重；新增 `region_inferred`。
- **区域/国家覆盖**：region 取信号 → 来源注册表 → 关键词推断（normalize.REGION_KEYWORDS）→ 默认；实测 **region 11/11（missing []）、country 28**；meta 新增 `region_coverage{covered,total,missing,ratio,inferred}`、`country_coverage`。
- **上限可配置**：`config.CANDIDATE_LIMIT=200`；`pipeline.py --candidates-limit N`、`candidates.py --limit N`；实测 200 条（business 320 信号 → 取前 200）。

### C) 统计/版本/复核
- stats KPI：`candidates_total=200`、`today_new_candidates=95`、`unverified_candidates=200`；候选四窗口 **day 95 / week 200 / month 200 / year 200**（day 显著提升因新源今日条目多）。
- 全部 data meta 升 **0.9.1**（含 4 份 history 快照、candidates/candidate-rankings、source-health/outbox）；rankings as_of 2026-10-23（day0/week49/month57/year80，精选 80 条内容口径不变）；报告/年鉴/校准按 0.9.1 重生成；radar.db 重建（80/156/654/92）。
- validate **20/20**（V10 增加 access=json 校验）；unittest **114/114**（新增 gap 兜底/同 URL 最新/清洗/区域覆盖/limit 可配等 5 条）；`--all --as-of 2026-10-23` 双跑幂等（全部 data JSON + db + reports SHA256 0 变化）。
- **前端展示字段补全（v0.9.1 追加，P2 修复）**：每条候选新增 `gap_inference`（中文说明：显式信息差 / 自动推断，前者来自信号原文、后者标注「推断」）与 `source.cleaned`（清洗后标题）、`source.raw_title`（原始标题），供 CandidateBoard 展示；仅候选文件变化，机会库/精选榜/统计口径不变。
- 指纹（SHA256 前 16）：opportunities `88FDA5AB84B7F826`（未变）、rankings `9D1C171808EAF5D3`、stats `1409469C9BADD89F`、candidates `C3798E6D55B6AFDD`、candidate-rankings `C98B65E2A184C41F`、sources `C4E3421036FB4688`、source-health `B25ADF6DF9E0CC26`、radar.db `E275243A61C0FF11`、report-day-10-23 `C4CA5C93B7C97B49`、yearbook `A5BFC797D6D1E1EE`、calibration `5121E3E4E8C8838A`；代码 candidates.py `8C925BE3F21137C1`、config.py `5D0B537D95C648A8`、pipeline.py `B79B027E9689B02F`、fetch.py `CA8A9B2F7A580C00`（未改）、stats.py `808A81EF92D19557`、validate.py `BDE87EBA7D13E7BD`。

### 已知不足
- `rest-of-world` URL 修复后仍因 feed 内未转义字符解析失败（enabled=false）；Arab News 403（enabled=false）；其余 8 个历史 disabled 源保留原因。
- gap 兜底会为无显式信息差的候选填入最接近的 gap（fallback 28），UI 可结合 `gap_inferred` 标注「推断」。
- 候选首次只取前 200 条 business（当前 business 320），后续可通过 `--candidates-limit` 扩容或做去重聚类。

## data-v0.9.0 · 2026-10-23 · MINOR 增量（自动发现流：信号 → 候选商机 → 发现榜，去掉验证门禁）

> 产品原则（冻结）：**验证/实验不是信息获取与上榜的门禁。** 自动发现候选无需人工复核、无需商业验证、无需实验盈利即可进入发现榜；验证/实验只是个人可选功能，**不参与候选收录/排序/评级**。

### A) 自动候选生成（`scanner/candidates.py`，新增）
- 读最新 `scanner/outbox/signals-*.json`：`tier=business` 优先（184 条），不足时按 relevance 补 `maybe` 高分；上限 **200**；同 URL/同标题去重；确定性（同输入同字节）；**不写 `data/opportunities.json`**。
- 每条候选字段：`candidate_id`（稳定 hash）、`title(≤28 字)`、`one_liner`、`industry_ids/gap_type_ids/region_ids/target_countries`、`source{id,name,url,published_at,summary}`、`evidence`（≥1 链接，无需人工核验）、`seven_questions`（七问自动草稿，标注 draft）、`roi`（行业默认区间，`estimated=true`）、`scores`（10 维启发式 + 公式 total/rank_score/grade）、`confidence(0-100)`、`status="auto-discovered"`、`verification_status="unverified"`、`first_seen/last_seen`、`disclaimer`。
- 实测生成 **200 条**：business 184 + maybe 16（去重 0）；样例：`cand-fcec83287419`（PPWR 包装法规·合规/银发·欧洲/北美，total 74.2 / B / confidence 95）、`cand-d437276be348`（CPSC 电子申报新规·合规/宠物·北美，66.7 / B）；全部 200 条均为 `unverified` 但仍全部上榜。

### B) 发现榜（`data/candidate-rankings.json`，新增；与精选榜双轨）
- 四窗口按 **first_seen** 归属，排序同 rank 规则（rank_score/momentum/evidence/last_seen/candidate_id）：**day 21 / week 124 / month 168 / year 199**（total 200）。
- meta 明确 `verification_affects_ranking=false`；**不改** `data/rankings.json`（精选人工库 80 条）与 `data/opportunities.json`（指纹未变）。
- `stats.json` 增加 `kpi.candidates_total=200`、`today_new_candidates=21`、`unverified_candidates=200`；V14 校验含候选计数。
- pipeline：新增 `--candidates` 步骤，`--all` 自动包含（在 stats 前生成）；`python scanner/candidates.py --as-of 2026-10-23` 可单独重生成。

### C) 版本与复核
- 全部 data meta 升 **0.9.0**（含 4 份 history 快照）；rankings as_of 2026-10-23（day0/week49/month57/year80，内容口径不变）；四窗口报告/校准/年鉴按 0.9.0 重生成；`radar.db` 重建（80/156/654/57）。
- `validate.py` **20/20 PASS**（V14 扩展候选计数一致性）；unittest **109/109 OK**（新增候选生成/窗口/去重/确定性/上限/验证不门禁/pipeline 步骤等 8 条）；`--all --as-of 2026-10-23` 连跑两次幂等（全部 data JSON + db + reports SHA256 一致）。
- 指纹（SHA256 前 16）：opportunities `88FDA5AB84B7F826`（未变）、rankings `612AC90F132CCBD4`、stats `09321616A713F987`、candidates `360C473EB4E5111E`、candidate-rankings `DD3CC40F8815E205`、sources `3B164CAE70990742`、source-health `E9A9E5D943F88321`、radar.db `A06BD31A8FD7C64A`、yearbook `9849B0FD00CC2952`、calibration `E895743BAB7CD154`、report-day-10-23 `087F443F17E830F3`；代码 candidates.py `64896F3E9280822B`、stats.py `808A81EF92D19557`、pipeline.py `5B11A431E0CE9863`、config.py `A97DDDB44D4E9F8A`。

### 已知不足
- 候选标题/七问/ROI 为自动草稿（启发式），需人工判断细节；`confidence` 仅用于排序参考，不是成功率。
- `candidate_id` 依赖信号 URL/标题，源标题变化会生成新候选（已有 ledger 防重复采集，但候选层未做人工合并）。
- 阈值/上限（business 优先、补 maybe、200 条）按当前 outbox 规模设定，后续可配置。

## data-v0.8.0 · 2026-10-23 · MINOR 增量（全球源扩充 + 跨批去重 + 相关性初筛）

> 机会库内容不变（仍 80 条人工库）；本次只增强采集/线索层与版本号，validate V01–V20 通过。

### A) 源注册表扩充（`data/sources.json` 68 → 125 平台）
- 新增 **57 个候选源**（Google News 多地区 query 33 个 + Google Trends 3 个 + 垂直/行业媒体 21 个），实测 **50 个可用**、7 个失败；随后又停用 2 个旧的失效源（itunes 空 feed / substack 非 feed），最终 **125 平台 / 57 个 enabled 自动源 / 9 个 enabled=false（记录原因）**。
- 新字段：`access(rss|json|api|manual)`、`regions`、`lang`、`enabled`、`priority`、`limits{max_items,min_interval_sec}`、`kind(news-aggregator|trend-feed|vertical-media)`、`check_result`；覆盖 **11/11 区域**（北美/欧洲/东亚/东南亚/南亚/中东北非/非洲/拉美/大洋洲/独联体/中国大陆）。
- `fetch.select_sources` 只抓 `enabled != false`、合规绿/黄、`access ∈ {rss,json}` 的源，按 priority/value_score 排序；`FETCH_DEFAULT_LIMIT` 8 → **60**；RSS/Atom/JSON 解析带 `lang` 透传。
- 2026-10-23 真实首跑：**57/57 源成功**、1448 条原始 → 1015 条信号（批内去重后）、1448 items 写入 source-health（`mode=online-fetch`，0 失败）。

### B) 持久信号账本（`scanner/build/signal-ledger.sqlite`，gitignore）
- 新增 `scanner/ledger.py`：SQLite 表 `signals(fingerprint UNIQUE, canonical_url, title_hash, content_hash, first_seen, last_seen, seen_count, source_id)`；`classify()` 跨批去重并标注每条 `is_new/first_seen/last_seen/seen_count`，返回 `new_count/seen_count/ledger_total`。
- outbox meta 新增 `new_count/seen_count/ledger_total/ledger_path`；实测同一天连跑三次：**新增 983 → 68 → 0**（已见 27 → 947 → 1015；账本累计 **1051**），同 feed 重跑不再重复出现新信号。
- 账本为本地派生文件，不入 git、不入发布。

### C) 相关性初筛（`scanner/relevance.py`）
- 每条信号新增：`relevance_score(0-100)`、`industry_ids`、`gap_type_ids`、`region_ids`、`tier(business/maybe/off-topic)`、`reasons`（taxonomy hints + 商业词 + 来源类别权重 + 招聘/广告/纯论文等排除词）。
- outbox meta 与 `/api/outbox` 新增 `relevant_count/tiers/top_relevant`（top 最多 8 条）；**仅线索排序，不自动入库**。
- 实测 1015 条：**business 184 / maybe 712 / off-topic 119**（relevant_count=184）；top_relevant 含 PPWR 法规、非洲支付、Saudi autotech 融资等高相关条目。

### D) 版本与复核
- 全部 data meta 升 **0.8.0**（含 4 份 history 快照 10-20/21/22/23）；rankings as_of **2026-10-23**（day0/week49/month57/year80）；四窗口报告 8 文件、校准、年鉴按 0.8.0 重生成；`radar.db` 重建（80/156/654/57 行）。
- `validate.py` **20/20 PASS**（V10 新增：125 平台 / 57 enabled 自动源 ≥20 / 字段合法性）；unittest **101/101 OK**（新增 ledger 3 + relevance 3 + fetch 跨批集成 1 + serve outbox 扩展）；`--all --as-of 2026-10-23` 连跑两次幂等（JSON + db SHA256 一致）。
- 指纹（SHA256 前 16）：opportunities `88FDA5AB84B7F826`（未变）、rankings `04DD9871FAB15074`、stats `B79BDB3BFB7A16E7`、sources `2E1AC5D220E9DE71`、source-health `F2956A6F8AF886E3`、radar.db `69151D7425DD5AA1`、yearbook html `FA50DADBF091D30C`、calibration html `C60846FFE68987FF`、fetch.py `CA8A9B2F7A580C00`、ledger.py `62CBF68474B28FF6`、relevance.py `A80C200FE6E4CA93`。

### 已知不足
- 首跑联网 57 源约 3–4 分钟（同域限速 + 单源 timeout）；后续命中 6h 缓存会快很多。若只想快速验证，可 `--fetch-limit 20`。
- Google News/Trends 为新闻聚合，信号偏宏观；已在 `kind` 标注，相关性初筛会降权纯新闻/论文。
- researcher 的 `research/sources-expansion.md` 另列 38 个实测源（含 Supply Chain Dive/FreightWaves/36Kr 等），本轮已覆盖 57 个可用源，剩余可在下一 PATCH 合并。
- 9 个 enabled=false 源（bing ×2、rest-of-world、techinasia 403、entrackr 404、nature-news 空、dw-news 空、itunes 空、substack 非 feed）保留原因，换 URL 后可重启。

## data-v0.7.0 · 2026-10-23 · MINOR 增量（本地控制台后端 `scanner/serve.py`）

> 数据内容不变（机会库 80 条/四窗口 day17/week49/month57/year80/validate 20/20），仅版本号升 0.7.0 以配合 v0.7.0 本地控制台。

### 新增能力（`scanner/serve.py`，仅 scanner/ 代码；数据侧无 schema 变化）
- 本地 HTTP 控制台后端：仅绑定 `127.0.0.1`，启动生成随机 token 写仓库根 `.radar-console-token`（建议 gitignore，不打印/不落日志）；`--open` 打开 `#/control?token=...`。
- 静态服务：`current/index.html` → `app/dist/index.html` → 最新 `releases/*/dist/index.html`，无构建 503 引导；**index.html 注入 `window.__RADAR_CONSOLE_TOKEN__`**（内存响应，方便自启动后直接访问 `/`）。
- API：`/api/health`（免 token）、`/api/status`、`/api/run {update|fetch|build}`（单任务 409）、`/api/job?id=`、`/api/logs`、`/api/log?name=`、`/api/schedule {enable|disable}`；header `X-Radar-Token` + Origin 校验；路径穿越防护；每次调用写 `scanner/logs/console.log`（不含 token）。
- 单测新增 17 条（`scanner/tests/test_serve.py`），全套 **81/81 OK**；本次仅版本号变更：全部 data meta → 0.7.0，四窗口报告/校准/年鉴按 0.7.0 重生成，validate 20/20。

### 红队复验 P2 修复（v0.7.0 内，2026-10-23）
- **P2-1 `POST /api/schedule {action:"disable"}` 任务不存在时返回 500**：改为幂等——先查 `schedule_status()`，`not_installed` 直接返回 200 + `already:true`；卸载执行 exit≠0 且输出含 cannot find/找不到/不存在 等标记时同样按已停用成功返回；enable 失败仍如实报 500。真实服务复测：无任务时 disable → 200 `{ok:true, already:true, schedule.status:"not_installed"}`。
- **P2-2 `/api/health` 未校验 Origin**：health 仍免 token，但统一走 `_origin_ok()`；非 loopback Origin → 403，loopback/无 Origin → 200（与其余 API 一致）。
- 回归：serve 单测 17/17、全套 81/81、validate 20/20；新增 4 条单测覆盖上述两处。
- 指纹（SHA256 前 16）：opportunities `88FDA5AB84B7F826`、rankings `A8EC7EF573091C36`、stats `33F4868622F7C8A6`、source-health `3C0527E6953AE7E3`、sources `0A37F7ACB6BAA03F`、radar.db `1FCE72C7A0B628FA`、yearbook html `271F176A4138513C`、calibration html `9DA388B3AF28FBD3`、serve.py `D721F672E0E37269`（P2 修复后）。

## data-v0.6.1 · 2026-10-22 · PATCH（`--as-of` 真实每日运行 + V08 配额规则调整）

> 向后兼容：默认行为不变（仍以 `DEFAULT_AS_OF=2026-10-22` 为基准）；新增可选 `--as-of`；机会库/榜单字段不变，版本号升 0.6.1。

### `pipeline.py --as-of YYYY-MM-DD`（作用于 --all/rank/stats/history/report 等）
- 新增 `resolve_as_of()`：`None → config.DEFAULT_AS_OF`，显式日期解析，非法日期 exit 2；`--all/--rank/--stats` 的窗口归属、历史快照文件名/内容、`rankings.meta.as_of`、`stats.meta.as_of` 全部按该日。
- `--replay-as-of` 与 `--as-of` 互不影响：replay 基于 `--as-of` 往前推（`replay_base ≤ as_of` 校验保留）。
- `report.py --period ... --as-of D`：报告文件名与 `generated_at` 跟随该日（`build_window_data` 支持 as_of 覆盖）。
- `yearbook.py`：`generated_at`/年份数据跟随 `rankings.meta.as_of`（每日运行后自动取最新数据日）。
- 同输入重复运行字节级确定性；测试不同日期后须用 `--all` 恢复基准日。

### validate V08 配额规则调整（V07/V19 使用 meta.as_of）
- `_as_of()` 优先取 `rankings.meta.as_of`（`--as-of` 每日运行），缺失回退 taxonomy（基准日）——V07/V09/V14/V19 等日期规则不再硬编码。
- **V08 完整配额（day≥10/week≥20/month≥30/year≥80）只在基准发布日 `as_of == 2026-10-22` 强制**；其他 as_of 只校验结构（rank 连续、rank_score 降序、opp_id 存在、change 合法），允许条数为 0，并在结果明细标注「非基准日 as_of=…，仅校验结构、允许空榜」。
- 单测：as_of=2026-10-23（day 0 / week 49 / month 57 / year 80）、2026-11-01（month 0）、2027-01-01（year 0）在临时目录/纯函数下验证不崩溃且 validate 通过；基准日空榜仍应 FAIL（保证发布日配额）。

### 验证结果（2026-10-22 实测）
- 基准日：`--all` → day 17 / week 49 / month 57 / year 80；validate **20/20 PASS**；unittest **64/64 OK**；`--all` 幂等。
- `--as-of 2026-10-23`：day=0 / week=49 / month=57 / year=80，validate 20/20（V08 结构模式、V19 最新快照=10-23）。
- `--as-of 2026-11-01`：day=0/week=0/month=0/year=80，validate 20/20。
- `--as-of 2027-01-01`：四窗口全 0，validate 20/20。
- 测试产生的临时快照/报告已清理，仓库 data 已恢复基准日 2026-10-22 状态。
- 数据版本升 **0.6.1**（全部 meta）；四窗口报告 8 文件、校准报告、年鉴按 0.6.1 重生成；`radar.db` 重建（80/156/468/8 行）。
- 指纹（SHA256 前 16）：opportunities `88FDA5AB84B7F826`、rankings `5A89046173507CD7`、history-10-20 `C3062497B40003F3`、history-10-21 `579029757BEA1A0A`、history-10-22 `71BF1115A112DBAE`、stats `607FBCA64EFBFA92`、source-health `C199113DDF570B85`、sources `AFB1FDC10EAFEC60`、radar.db `1D248A1DA534F200`、yearbook html `49ACD2DAE3CFF73F`、calibration html `C22053F7AAF04081`。

### 已知不足
- `--as-of` 只改变「按日期派生」的窗口/榜单/统计/快照/报告日期，不会凭空产生新信号；真实新增仍依赖 `--fetch` 或人工扩库。
- 非基准日历史快照仅用于本地每日运行验证，不应提交到仓库（仓库保持 10-20/10-21/10-22 三份）。

## data-v0.6.0 · 2026-10-22 · MINOR 增量（机会库 46→80、配额提高、年鉴指标细化）

> 向后兼容：字段不变；数量/覆盖要求与榜单配额提高。机会库 46 → **80 条**（新增 34 条，id 047–080）。

### 机会库扩充（34 条新增，基于 research/cases.md / handoff-to-data.md）
- **覆盖**（80 条合并后）：14 行业各 ≥2（最少 gaming 2、education 3、culture 3）；11 区域全覆盖；12 类信息差全覆盖；目标国家/地区 **53 个**；中国供应链/中文市场角度 **42 条**；`verified:true` **32 条**（2026-10-22 逐条 HTTP 直连核验 URL 后置 true，含原有 5 条）。
- **等级分布**：A 12 / B 66 / C 2；均分 70.8；证据总数 156 条（每条 ≥2）。
- **日期配额**：按 `last_activity` 布置 → day 17 / week 49 / month 57 / year 80（配额 day≥10/week≥20/month≥30/year≥80）。
- 新增 id（供前端核对）：
  `opp-manufacturing-ceramic-pet-memorial-supply-047`、`opp-pet-kr-pet-insurance-claims-048`、`opp-pet-jp-pet-insurance-settlement-049`、`opp-pet-kr-pet-funeral-subscription-050`、`opp-local-jp-inbound-experience-051`、`opp-content-jp-oshi-goods-supply-052`、`opp-content-china-guzi-economy-053`、`opp-silver-china-aging-retrofit-054`、`opp-fintech-china-inbound-payment-guide-055`、`opp-xb-saudi-ecommerce-localization-056`、`opp-content-uae-eid-gifting-057`、`opp-xb-vietnam-tiktok-shop-ops-058`、`opp-xb-sea-halal-beauty-supply-059`、`opp-fintech-brazil-pix-payment-060`、`opp-fintech-mexico-cod-oxxo-ops-061`、`opp-green-kenya-payg-solar-channel-062`、`opp-xb-africa-jumia-ops-063`、`opp-xb-india-wedding-supply-064`、`opp-emotional-india-ayurveda-d2c-065`、`opp-compliance-germany-einvoice-service-066`、`opp-compliance-eu-ppwr-epr-packaging-067`、`opp-local-poland-cee-localization-068`、`opp-xb-turkey-ecommerce-localization-069`、`opp-emotional-grief-memoir-service-070`、`opp-ai-etsy-digital-templates-071`、`opp-ai-shopify-app-niche-072`、`opp-manufacturing-west-africa-shea-processing-073`、`opp-green-africa-solar-accessories-074`、`opp-content-japan-anime-pilgrimage-content-075`、`opp-xb-saudi-salla-zid-build-076`、`opp-pet-kr-pet-food-subscription-077`、`opp-silver-jp-senior-digital-care-078`、`opp-content-china-shortdrama-id-l10n-079`、`opp-xb-china-pet-memorial-b2b-080`。

### 配额与校验（V02/V08 按 v0.6.0 契约收紧）
- **V02**：机会 ≥80、14 行业各 ≥2、11 区域全覆盖、目标国家/地区 ≥50、中国角度 ≥25。
- **V08**：day ≥10 / week ≥20 / month ≥30 / year ≥80（`config.WINDOW_QUOTAS` 同步提高）。
- 物化后 `rankings.json` day 17 / week 49 / month 57 / year 80；`stats.kpi`（total_opps 80 / grade_a_plus 12 / verified_count 32 / evidence_total 156）与实际一致。
- 历史回放重生成：10-20（day13/week23/month31/year54）、10-21（day9/week32/month40/year63）；10-22 真实快照与 rankings 一致。

### 年鉴指标细化（`scanner/yearbook.py`）
- 新增 **月度等级分布**（S/A/B/C/D × 12 个月）、**信息差热度**（每月 Top3）、**窗口衰减统计**（status/decay/months_left 分桶）、**实验漏斗**（有 `--experiments` 时：总样本→已决→成功率）。
- 其余保持：年榜 Top20、月度时间线、行业/区域/信息差分布、A 级清单、窗口收尾、评分分布、3 条规则化建议、免责；`generated_at` 确定性。
- 2026 年鉴实际运行（含样例实验摘要）：80 条机会 / Top20 20 / A 级及以上 12 / 收尾 3 / Brier 0.2338；HTML 27,092 B、MD 12,320 B。

### 版本与复核
- 全部 data meta 升 **0.6.0**；四窗口报告 8 文件、校准报告、年鉴按 0.6.0 重生成；`radar.db` 重建（80/156/468/8 行）。
- `--all` exit 0 且**幂等**（data 下所有 JSON + radar.db 连跑两次 SHA256 全一致）；validate **20/20 PASS**；unittest **58/58 OK**（新增年鉴指标/配额测试）。
- 指纹（SHA256 前 16）：opportunities `88FDA5AB84B7F826`、rankings `DBC3784F4E404AF4`、history-10-20 `32385A95E403A167`、history-10-21 `1CBF6DCD43F6AF89`、history-10-22 `EB54D17C9F6F02F0`、stats `FEDE36584020035F`、source-health `E7DDFDE8DE62E62D`、sources `046E14E942E3AF83`、radar.db `40A02F54FAD02471`、yearbook html `89514DC57EE819EE`、calibration html `701D4CCD9FAFA8A9`。

### 已知不足
- 新增 34 条为研究底稿改写，证据以公开报道/官网为主；`verified:true` 表示核验日 URL 可打开，不保证长期有效。
- 部分目标国家/地区仅作市场参考（未逐国做合规尽调）；跨境/宗教/医疗/金融类机会仍须人工合规核查。
- 榜单 day/week 窗口条数受 `last_activity` 布置影响（当前均超配额），后续每日运行应保持当日新增 6+。

## data-v0.5.1 · 2026-10-22 · PATCH（AI 富化 provider mock / 在线路径可验证）

> PATCH：只扩展 `scanner/enrich.py` 与版本号；机会库/榜单/历史/source-health 口径不变（JSON 内容仅 meta.data_version 变化）。

### `scanner/enrich.py` provider 扩展（docs/12 §1.5）
- **`--provider mock`（新增）**：本地模拟 OpenAI 兼容响应（**不联网**），走与真实在线相同的请求构造/响应解析/合并/回退流程；`meta.generator="mock-llm"`、`meta.provider="mock"`、`meta.model="mock-model"`；产物 schema 与 offline 相同，所有候选 `needs_human:true`。
- **在线模式完善**：`--limit N` 限制处理条数；`meta.usage{input_tokens, output_tokens, estimated_cost_usd, calls, cache_hits, prices}`（价格常量 `config.LLM_PRICE_INPUT_PER_1K_USD` / `LLM_PRICE_OUTPUT_PER_1K_USD`，注释标明示例价格、非真实账单；缓存命中不重复计费）；超时 60s + `config.LLM_MAX_RETRIES` 次指数退避重试；24h 缓存命中在候选 `_llm.cached` 与 `meta.cache_hits` 标注；失败自动回退 offline 并记录 `meta.error`。
- **铁律保留**：key 只从 `LLM_API_KEY` 环境变量读取、绝不落盘；不写 `data/opportunities.json`；`--dry-run` 不落盘；无 key 时 online 清晰报错（exit 2，不崩溃）；outbox 仍 gitignore。
- **测试（新增 5 条，共 55）**：本地 `http.server.ThreadingHTTPServer` 起 OpenAI 兼容 `/chat/completions`，验证请求头（`Authorization: Bearer …`）/请求体（model/messages）/响应解析/token 记录/缓存命中/失败回退；断言 key 不出现在产物中、opportunities 内容不变；不依赖外网/真实 key。
- 实际运行（2026-10-22，`--provider mock --limit 5`）：**5 条候选**（跳过 206）、`generator=mock-llm`、`model=mock-model`、tokens input **1446** / output **869**、成本估算 **$0.000738**、`cache_hits=0`；产物 `scanner/outbox/enriched-2026-10-22.json` + `REVIEW.md`（outbox gitignore）。

### 版本与复核
- 全部 data meta 升 **0.5.1**（taxonomy/rankings/stats/sources/playbooks/calendar/source-health + 3 份 history 快照）；四窗口报告 8 文件、校准报告、年鉴按 0.5.1 重生成；`radar.db` 重建（46/88/211/8 行）。
- `python scanner/pipeline.py --all`：exit 0、**幂等**；`validate.py` **20/20 PASS**；unittest **55/55 OK**；yearbook 双跑字节一致；offline enrich / calibrate / yearbook 回归可用。
- 指纹（SHA256 前 16）：opportunities `52B30E45B356CEA9`（未变）、rankings `69B7F0F8401C4735`、history-10-22 `CA5C8426D8096A42`、stats `90DD20B1889B2E93`、source-health `3972812DDB43D574`、sources `45EB59ACED43626C`、radar.db `692920C029711881`、yearbook-2026.html `056F7EFF17C63B15`、calibration-2026-10-22.html `5EC1CEC0883D9A6C`。

### 已知不足
- 真实 LLM 路径仅用本地 mock server 验证（无真实 provider key，未产生真实调用）；成本常量是示例价格，真实账单以 provider 为准。
- mock 响应为模板化内容（非真实模型输出），仅用于流程测试/演示，不代表 AI 质量。
- 个人数据包/`rec_log` 由前端负责，数据侧不落盘；采集仍只覆盖 RSS/JSON feed。

### 红队复验修正（v0.5.1 PATCH 内，2026-10-22）
- **P1 CLI 相对路径崩溃（已修）**：`enrich.py` / `calibrate.py` / `yearbook.py` 的 `--out-dir` 为相对路径时，打印 `Path(...).relative_to(config.ROOT)` 抛 `ValueError`（文件已写出但进程 exit 1）。修复：新增 `common.display_path()`（`resolve().relative_to(root.resolve())`，越界/相对路径降级原样打印、绝不抛错）；`enrich/calibrate/yearbook.generate()` 入口把 `out_dir` 统一 `resolve()`；打印改用 `display_path`。新增 2 条回归单测（enrich CLI 相对 out-dir、yearbook+calibrate CLI 相对 out-dir），复现命令 `python scanner/enrich.py --signals scanner/outbox/signals-2026-10-22.json --out-dir qa/tmp/enrich-rel --provider mock --limit 2` 现为 **exit 0** 且产物正常。
- **P2 缓存 usage 语义（已说明）**：24h 内二次运行命中缓存时 `meta.usage={input_tokens:0, output_tokens:0, calls:0, cache_hits:N}`（不重复计费，属预期行为）；首次运行记录估算 tokens 与成本。已写入 data/README §7.1 与 scanner/README。
- 回归：unittest **57/57 OK**（新增 2 条），validate **20/20 PASS**，`--all` 幂等；数据 JSON 未变更（仅 scanner 代码 + 文档），指纹不变。

## data-v0.5.0 · 2026-10-22 · MINOR 增量（年度年鉴）

> 向后兼容：不删除、不改名既有字段；机会库/榜单/历史/source-health 数据口径不变，仅版本号升 0.5.0。个人数据包与 `rec_log` 为前端 localStorage 本地数据，**不进入 data/**。

### 新增工具
- **`scanner/yearbook.py`（年度年鉴）**：`--year 2026 [--experiments <export.json>] [--sample]` → `data/reports/yearbook-2026.{html,md}`（HTML 自包含可打印、`generated_at` 用 as_of 固定值 → 双跑字节一致）。
  - 年榜 Top20、月度时间线（按 `activity_dates` 聚合 12 个月，无活动月份显示 0，含行业/信息差 Top2 主题）、行业/区域/信息差/等级/窗口状态分布、A 级清单（≥75）、窗口收尾或 ≤3 个月机会、评分分布（CSS 条形，不依赖外网）、可选实验摘要（复用 `calibrate.py` 的 Brier/成功率/花费口径）、规则化「年度 3 个方向建议」（标注「规则生成，非投资建议」）、免责。
  - 2026 年鉴实际运行（含样例实验摘要，`--sample`）：**46 条机会 / Top20 20 条 / A 级及以上 11 条 / 收尾窗口 0 条 / Brier 0.2338**；HTML 70 行 / 23,068 B（无实验版 22,745 B），MD 同步生成。
  - 容错：无实验、空年份（0 机会）、非法实验 JSON（记录 `experiments_error` 并跳过摘要）均不崩溃；单测覆盖无实验/有实验/空年份/双跑确定性/非法 JSON 5 类。
- 新增单测：unittest **45 → 50 条**（`TestYearbook`）；`TestCalibrate.test_generate_reports_and_invalid_export` 仍回归通过。

### 版本与复核
- 全部 data meta 升 **0.5.0**（taxonomy/rankings/stats/sources/playbooks/calendar/source-health + 3 份 history 快照重生成）；四窗口报告 8 文件、校准报告、年鉴全部按 0.5.0 重生成；`radar.db` 重建（46/88/211/8 行）。
- `python scanner/pipeline.py --all`：exit 0、**幂等**；`validate.py` **20/20 PASS**；calibrate/enrich 回归可用。
- 指纹（SHA256 前 16）：opportunities `52B30E45B356CEA9`（未变）、rankings `F6E91C3350377162`、history-10-22 `675AD8BE774B7478`、stats `89915E415CF435D1`、source-health `122B04353B2BC2E3`、sources `8EE05E408700051D`、radar.db `0C6026699FE3CEDD`、yearbook-2026.html `750DF083C29ADC9A` / .md `E73C905615E9A348`、calibration-2026-10-22.html `E23FACA50DF60302`。

### 已知不足
- 年鉴的「年度 3 个方向建议」是规则生成（非投资建议），仅用于复盘提示。
- 年鉴实验摘要当前使用样例实验数据（fixtures/experiments-sample.json，已标注 sample）；真实结论需前端积累真实实验后重跑 `--yearbook --experiments`。
- 采集仍只覆盖 RSS/JSON feed；`verified:true` 仍 5 条；个人数据包/rec_log 由前端负责，数据侧不落盘。

## data-v0.4.0 · 2026-10-22 · MINOR 增量（AI 富化 outbox + 实验校准报告）

> 向后兼容：不删除、不改名既有字段；机会库/榜单/历史/source-health 数据口径不变，仅版本号升 0.4.0。

### 新增工具（scanner/）
- **`scanner/enrich.py`（AI 富化 outbox，人工复核门禁）**：
  - 读 `scanner/outbox/signals-<date>.json` → 写 `scanner/outbox/enriched-<date>.json` + `REVIEW.md`（outbox gitignore，不入库/不入发布）；
  - 默认 **offline-template**：关键词/taxonomy 候选映射（行业/信息差/人性需求/情绪/神经递质）、七问骨架草稿（标注「待人工补充」）、启发式语言检测、证据 URL 透传；
  - 可选 **在线模式**：`--online` + 环境变量 `LLM_API_KEY`（可选 `LLM_BASE_URL`/`LLM_MODEL`）调用 OpenAI 兼容 `/chat/completions`，记录 model/latency/token 估算，24h 缓存，失败自动回退 offline；
  - **安全**：key 只从环境变量读取、绝不写文件；`--dry-run` 不落盘；所有候选 `needs_human:true`；**永不自动写入 `data/opportunities.json`**（单测断言内容不变）。
  - 2026-10-22 实测（现有 outbox，offline-template）：**211 条候选、0 跳过**；产物 `scanner/outbox/enriched-2026-10-22.json`（434 KB）+ `REVIEW.md`（134 KB）。
- **`scanner/calibrate.py`（实验校准报告）**：读前端导出实验 JSON → `data/reports/calibration-<date>.{html,md}`；含样本数/结果与状态分布、等级×成功率、**Brier**（`p=clamp(total/100,0.01,0.99)`、`o=positive1/negative0`、inconclusive 排除、基线 0.25、样本<3 提示不足）、花费/耗时、校准建议、免责。
  - 2026-10-22 样例运行（`--sample`，样例实验 6 条）：**有效样本 5 条、Brier 0.2338（≤ 基线 0.25）**；产物 `data/reports/calibration-2026-10-22.html/.md`（样例已在报告顶部标注）。
- 新增 fixture `scanner/fixtures/experiments-sample.json`（6 条覆盖 positive/negative/inconclusive 的演示实验）。

### 版本与复核
- 全部 data meta 升 **0.4.0**（taxonomy/rankings/stats/sources/playbooks/calendar/source-health + 3 份 history 快照）；replay 重生成、`--all` 重算，榜单内容口径不变（delta_basis=history / history_as_of=2026-10-21）。
- 报告：四窗口 8 文件 + 校准报告 2 文件全部按 0.4.0 重生成；`radar.db` 重建（46/88/211/8 行）。
- `python scanner/pipeline.py --all`：exit 0、**幂等**（连跑两次 data 下所有 JSON 与 radar.db SHA256 全一致）；`validate.py` **20/20 PASS**；unittest **36 → 45 条全绿**（新增 enrich offline/dry-run/no-key/不写机会库、calibrate Brier 公式/边界/样例报告/非法导出）。
- 指纹（SHA256 前 16）：opportunities `52B30E45B356CEA9`（未变）、rankings `435AAEE6A877DC99`、history-10-22 `D7BBF24D2ECAFCDC`、stats `5247BCD3A65FF96D`、source-health `DECC29B3218888FF`、sources `B7400DD9E5D1AA3F`、radar.db `12AA034D1F7FE5AE`。

### 复现命令
```powershell
python scanner/enrich.py                                                        # offline-template 富化
python scanner/enrich.py --dry-run                                              # 不落盘
python scanner/calibrate.py --experiments scanner/fixtures/experiments-sample.json --sample
python scanner/pipeline.py --all && python scanner/validate.py
```

### 已知不足
- 富化草稿是**模板级**候选（offline），行业/信息差映射基于关键词，可能误判；必须人工复核后才能入库。
- 在线 LLM 模式未在本次交付中实际调用（无 LLM_API_KEY 环境），仅由单测覆盖「无 key 报错/回退」路径；真实调用时 token 成本与内容合规需自行评估。
- 校准报告目前为**样例数据**（fixtures/experiments-sample.json），真实结论需等前端实验台积累 ≥3 条已决实验后重跑。
- 采集仍只覆盖 RSS/JSON feed；`verified:true` 仍 5 条。

## data-v0.3.1 · 2026-10-22 · PATCH（采集失败源修复 + 版本号）

> PATCH：仅修复采集源与升版本号，机会库/评分/榜单排序规则不变（`opportunities.json` 指纹不变）。

### 源修复（`sources.json` 63→…→68，详见条目 notes）
1. **reddit**（原 `https://www.reddit.com/r/Entrepreneur/.rss` 持续超时）：实测 `www.reddit.com` / `old.reddit.com` / `.json` 三种入口在 40s 内全部超时（本机网络对 reddit.com 不可达）；
   - 处理：`reddit` 条目改为 `access="manual"`（保留矩阵与人工浏览说明，`check_result="fetch_timeout"`）；
   - 新增可采集替代源 **`lobsters`**（`https://lobste.rs/rss`，green，实测 25 条技术社区讨论）→ 可采集源数量保持 8。
2. **itunes-reviews**（原 US storefront JSON 返回 200 但 `feed` 无 entry）：实测 US/GB/JP 三个 storefront——
   - US 空 feed（873 B，0 条）、page=2/helpful/旧端点/播客均 0 条；
   - **GB storefront 返回 50 条评论**（`.../gb/rss/customerreviews/...json`），JP 50 条；
   - 处理：URL 改为 GB storefront，解析器（`fetch.py` 的 `_parse_json_feed`，支持 `feed.entry`/`im:name`/多 link 结构）无需改动即可解析 50 条 → 按单源上限保留 30 条。
3. **shopify-changelog**（原 `https://shopify.dev/changelog` 为 HTML）：找到官方 RSS **`https://shopify.dev/changelog/feed.xml`**（`Recent changes to Shopify's platform`，实测 1.89 MB / 778 条），更新 URL 并记录替换；抓取按单源上限保留 30 条。
4. 采集器参数：`FETCH_TIMEOUT_SEC` 12→**20s**（hnrss 实测 17.2s）、UA 升 `OpportunityRadar/0.3.1`；限速/缓存/重试/合规策略不变。

### 真实运行结果（2026-10-22 18:2x，`python scanner/pipeline.py --fetch --no-cache`）
- **8/8 个源成功**，215 条原始 → **211 条信号**（outbox 人工复核，未写机会库）：
  - itunes-reviews ok 200 / 243ms / items 30；shopify-changelog ok 200 / 2102ms / 30；hnrss ok 200 / 17222ms / 20；lobsters ok 200 / 833ms / 25；app-store-rss ok 200 / 1284ms / 30；arxiv-rss ok 200 / 1683ms / 30；techcrunch-rss ok 200 / 2618ms / 20；producthunt-feed ok 200 / 1051ms / 30。
- `source-health.json` v2：`meta.mode="online-fetch"`、count 8 / ok 8 / failed 0 / cached 0；失败源集合为空（V20 仍校验「失败必须有 error」逻辑）。

### 版本与复核
- 全部 data meta 升 `0.3.1`（taxonomy/rankings/stats/sources/playbooks/calendar/source-health + 3 份 history 快照）；回放快照重生成（reconstructed=true，仍 10-20/10-21），真实快照 10-22 为 `reconstructed=false`。
- `python scanner/pipeline.py --all`：exit 0、**幂等**；`validate.py` **20/20 PASS**；`unittest` **36/36 OK**；`report.py --all` 8 文件按 0.3.1 重生成；`radar.db` 重建（46/88/211/8 行）。
- 指纹（SHA256 前 16）：opportunities `52B30E45B356CEA9`（未变）、sources `8779D97DA6F82150`、rankings `47A1620F0BFC66A0`、history `4B6F7C3B27030504`/`6B4D9EEB75B7D6D5`/`A3F2931B0E08D332`、stats `9C9F0A9404C16F2D`、source-health `CE657264793DE424`、radar.db `0CC30211191AF4D3`。

### 已知不足
- Reddit 在本机网络不可达（非解析问题），已降级 manual + Lobsters 替代；换网络环境后可重试恢复。
- Apple customerreviews 仅部分 storefront 有数据（US 为空），已固定 GB；如 Apple 再调整，可切 JP 或改源。
- 采集仍只覆盖 RSS/JSON feed 类源；`verified:true` 仍 5 条。

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
