# 交给 data 团队的 12 个高价值案例（handoff-to-data.md）

> 来源：`research/cases.md`（C01–C40）中挑出 **证据最硬、可个人切入、覆盖不同行业**的 12 个。
> 目标：data-engineer 可直接改写成 `data/opportunities.json` 的机会卡（字段与 `docs/12` 完全对齐）。
> **核验日期：2026-10-22**。证据 tier：`primary`=官方/平台/用户原声；`secondary`=媒体/报告。
> ⚠️ `verified` 只在 URL 本轮直连成功（✅200）时才可标 `true`；标 ⛔/⏳ 的必须 `verified:false` 并在 `compliance_notes` 说明。

---

## 0. 使用说明

1. 每条已给：`id / slug / title / one_liner / industry_id / gap_type_ids / region_ids / origin_country / target_countries / human_need_ids / neuro_drivers / emotion_tags / source_langs`。
2. `seven_questions` 给的是**要点**（不是终稿），data 团队可润色为 60–120 字；`drivers` 用 `docs/12` 的 7 个枚举。
3. `roi` 为**粗估**，标注"研究估算"；`capital_cny`、`monthly_revenue_cny` 按个人/1–3 人小团队口径。
4. `scores` 已按公式验算：`total = round(Σ(dim×weight)×10, 1)`，`rank_score = round(min(100, total×(1+0.12×(momentum−1))),1)`——可直接用，也可微调。
5. 每条末尾给「为何现在」+「证据 URL」，日期与 tier 可直接进 `signal.evidence`。
6. 候选池：其余 28 个案例在 `cases.md` §2，data 团队做 40 条机会库时按 §1 索引表补齐。

---

## 1. H01 宠物离世纪念玻璃（含景德镇陶瓷供应链）

```json
{
  "id": "opp-pet-memorial-glass-001",
  "slug": "pet-memorial-glass",
  "title": "宠物离世纪念玻璃：把骨灰/毛发封进玻璃的定制生意",
  "one_liner": "欧美宠物殡葬情绪消费升级，玻璃件 $129–299、珠宝 $69–549，中国景德镇/玻璃供应链可代工，个人可做设计+独立站验证",
  "industry_id": "pet",
  "gap_type_ids": ["culture", "emotion", "geo"],
  "region_ids": ["north-america", "europe", "oceania"],
  "origin_country": "美国",
  "target_countries": ["美国", "英国", "加拿大", "澳大利亚"],
  "human_need_ids": ["belonging", "nostalgia", "meaning"],
  "neuro_drivers": ["oxytocin", "serotonin"],
  "emotion_tags": ["grief", "nostalgia", "love"],
  "source_langs": ["en", "zh"],
  "roi": { "capital_cny": {"min": 3000, "max": 8000}, "time_to_revenue_months": 2, "payback_months": 5, "monthly_revenue_cny": {"min": 8000, "max": 30000}, "gross_margin_pct": 65, "effort_level": "side", "team_size": 1 },
  "scores": { "dimensions": {"signal": 8.6, "gap": 7.5, "feasibility": 8.4, "economics": 8.0, "timing": 7.5, "competition": 6.5, "risk": 7.0, "fit": 8.2, "evidence": 7.8, "leverage": 6.8}, "total": 77.8, "grade": "A" },
  "window": { "status": "open", "months_left": 18, "decay": "slow" },
  "tags": ["low-capital", "side-hustle", "solo", "cross-border", "physical", "needs-supply-chain"],
  "verified": false
}
```

- **卖什么**：玻璃纪念球/纸镇/心形/生命树、纪念首饰（$69–549）、骨灰纪念盒；可加购第二件给家人。
- **价格/规模证据**：玻璃 **$129–299**、珠宝 **$69–549**、每件用约半茶匙骨灰（一份骨灰可做 5 件）——独立纪念艺术家测评 `secondary` 2026-08；全球宠物殡葬服务 2024 **$19.7 亿 → 2025 $21.8 亿**、2034 $41 亿、Amazon 纪念石 30 天 **1,000+ 件/$3.4 万**——跨境媒体 `secondary` 2025-11-10；景德镇工厂宠物骨灰盒/雕像**年销 6,000 万+ CNY**，销往美欧澳——同上。
- **七问要点**：
  - `traffic`：Etsy SEO + Pinterest 场景图 + TikTok/Reels 制作过程；前 100 单来自 Etsy 搜索与宠物殡葬博主联名。
  - `money`：实物定制 $129–299 为主，加购纪念首饰/相框；毛利 60–75%。
  - `model`：DTC 定制 + Etsy/独立站成交 + 景德镇/玻璃工艺厂代工 + 海外仓/直邮。
  - `roi`：启动 3,000–8,000 元（样品/拍摄/独立站）；2–3 个月首单，5–6 个月回本。
  - `audience`：有审美、有情感支付意愿、英语可读的 30–55 岁宠物主；适合兼职。
  - `drivers`：["info", "cross-border", "supply"]
  - `moat`：工艺良率 + 原创设计 + 真实好评；前置条件是稳定玻璃/陶瓷供应商与防碎包装。
- **为何现在**：宠物"家人化"+ 中国工艺供给成熟 + 平台已完成用户教育；本地手工 6 周交付慢。
- **风险**：骨灰跨境邮寄受限（只寄毛发/纪念物）；易碎破损退款；同质化。
- **证据 URL**：
  - `primary`? 否：https://zellerhausart.com/blog/spirit-pieces-review（2026-08，secondary，✅200）
  - https://www.sohu.com/a/952762371_121478199（2025-11-10，secondary，✅200）
  - https://www.spiritpieces.com/products/glass-kiss-with-cremation-ashes（✅200，正文截断）→ 建议 `verified:false`

---

## 2. H02 日本故乡纳税返礼品开发与代运营

```json
{
  "id": "opp-local-furusato-nozei-001",
  "slug": "japan-furusato-nozei-gift",
  "title": "日本故乡纳税返礼品：1.33 兆日元市场里的中国供应链机会",
  "one_liner": "2025 年度捐赠 1 兆 3,314 亿日元、83.4% 用户不换门户，返礼品开发/代运营是懂日语者的高门槛生意",
  "industry_id": "local",
  "gap_type_ids": ["language", "culture", "channel"],
  "region_ids": ["east-asia"],
  "origin_country": "日本",
  "target_countries": ["日本"],
  "human_need_ids": ["status", "gift", "control"],
  "neuro_drivers": ["serotonin", "dopamine"],
  "emotion_tags": ["pride", "ritual", "aspiration"],
  "source_langs": ["ja", "zh"],
  "roi": { "capital_cny": {"min": 5000, "max": 20000}, "time_to_revenue_months": 6, "payback_months": 12, "monthly_revenue_cny": {"min": 10000, "max": 40000}, "gross_margin_pct": 40, "effort_level": "side", "team_size": 2 },
  "scores": { "dimensions": {"signal": 8.8, "gap": 8.8, "feasibility": 7.2, "economics": 7.6, "timing": 8.0, "competition": 7.5, "risk": 6.8, "fit": 6.5, "evidence": 8.6, "leverage": 7.5}, "total": 78.7, "grade": "A" },
  "window": { "status": "open", "months_left": 24, "decay": "medium" },
  "tags": ["b2b", "localization-heavy", "needs-supply-chain", "recurring"],
  "verified": true
}
```

- **卖什么**：为日本中小自治体/返礼品运营商提供"中国供应链选品 + 日语提案 + 品控"；或做中文版故乡纳税内容/代购。
- **价格/规模证据**：2025 年度捐赠 **1 兆 3,314 亿日元**（连续 6 年新高，2026-07-31 信浓每日新闻，`primary`）；返礼品类别：海产 **39.7%**、肉 **36.8%**、大米 **28.7%**、水果 **23.6%**；单品第一大米 **27.6%**、牛肉 **25.4%**；卫生纸进日用品单品前三；**83.4%** 用户继续用同一门户；不满第一"上限额难算" **40.1%**（RIETI 2026-03-11，`primary`）；2025-10-01 起禁止积分，9 月寄附占比 41.1% 反超 12 月 29.1%。
- **七问要点**：
  - `traffic`：日本自治体/地域商社名单（总务省指定通知）+ 地方银行/商工会议所渠道；日语提案书+样品。
  - `money`：按 SKU 收开发费（10–50 万日元/款）+ 销售分成（5–15%）+ 代运营月费。
  - `model`：B2B 服务 + 供应链撮合；交付=提案/打样/质检/物流方案。
  - `roi`：启动 5,000–20,000 元（日语资料/样品/差旅）；6 个月首单，12 个月回本。
  - `audience`：日语 N2+、有中国工厂资源、能做 B2B 提案的人；不适合无日语能力者。
  - `drivers`：["cross-border", "supply", "regulation"]
  - `moat`：日语提案能力 + 日本自治体信任 + 工厂柔性小批量；窗口期 2–3 年。
- **为何现在**：制度改正逼自治体从"积分返利"转向"返礼品质量+故事"；83.4% 用户不换门户 → 新品/新自治体是唯一入口。
- **风险**：决策链 6–18 个月；食品/化妆品进口检疫；毛利被门户压到 20–30%。
- **证据 URL**：
  - https://www.shinmai.co.jp/news/article/gfkn2026073101001609（2026-07-31，primary，✅200）
  - https://www.rieti.go.jp/jp/columns/a01_0805.html（2026-03-11，primary，✅200）

---

## 3. H03 沙特/海湾 Umrah 中文小团与服务

```json
{
  "id": "opp-local-umrah-service-001",
  "slug": "saudi-umrah-service",
  "title": "沙特 Umrah 服务：1,950 万人次刚需里的中文/印尼语缺口",
  "one_liner": "2025 年 1,950 万入境朝觐者、1,503 万签证，中文/印尼语向导与内容供给不足，个人可与持牌运营商合作切入",
  "industry_id": "local",
  "gap_type_ids": ["culture", "language", "channel"],
  "region_ids": ["mena", "sea"],
  "origin_country": "沙特",
  "target_countries": ["沙特", "阿联酋"],
  "human_need_ids": ["meaning", "belonging", "status"],
  "neuro_drivers": ["oxytocin", "serotonin"],
  "emotion_tags": ["devotion", "awe", "belonging"],
  "source_langs": ["ar", "en", "zh"],
  "roi": { "capital_cny": {"min": 10000, "max": 50000}, "time_to_revenue_months": 4, "payback_months": 10, "monthly_revenue_cny": {"min": 20000, "max": 80000}, "gross_margin_pct": 25, "effort_level": "full", "team_size": 2 },
  "scores": { "dimensions": {"signal": 8.5, "gap": 8.6, "feasibility": 6.8, "economics": 8.0, "timing": 8.2, "competition": 7.0, "risk": 6.0, "fit": 6.5, "evidence": 8.8, "leverage": 7.0}, "total": 77.0, "grade": "A" },
  "window": { "status": "open", "months_left": 24, "decay": "medium" },
  "tags": ["needs-license", "localization-heavy", "seasonal", "b2c"],
  "verified": true
}
```

- **卖什么**：Umrah 小团/家庭团、中文+阿拉伯语向导、朝觐礼包（戒衣/礼拜毯/便携净水）、朝觐后纪念相册/视频、住宿与交通打包。
- **价格/规模证据**：2025 年 **1,950 万+** 入境朝觐者/Umrah（Umrah **1,803 万**、Hajj **150 万**）；Umrah 较 2022 年 **+114%**；Hajj 满意度 **91%**、Umrah **94%**；签证 **1,503 万**（Umrah 占 83%）；来源国前三 **巴基斯坦、印尼、埃及**；87 个历史遗址/文化点吸引 5,500 万+ 访问（PEP 官网 2026-08-03，`primary`，✅200）。
- **七问要点**：
  - `traffic`：微信/小红书/抖音的穆斯林社群 + 印尼语 YouTube/TikTok + 清真寺/旅行社合作。
  - `money`：团费加价 + 礼包 + 纪念品 + 地接佣金；客单 8,000–25,000 元/人。
  - `model`：与沙特持牌 Umrah 运营商合作的地接+内容+社群；轻资产。
  - `roi`：启动 1–5 万元（内容/资质/保证金）；4 个月出团，10 个月回本；毛利 20–30%。
  - `audience`：懂阿拉伯语/印尼语、有穆斯林社群资源或旅行社经验的人；需与持牌方合作。
  - `drivers`：["cross-border", "info", "regulation"]
  - `moat`：牌照/地接资源 + 社群信任；无牌照者只能做内容与获客。
- **为何现在**：Vision 2030 目标 3,000 万人次、签证持续放宽；中文/印尼语服务稀缺；中国穆斯林 Umrah 需求恢复。
- **风险**：朝觐牌照与配额；宗教服务容错率极低；季节性极强（斋月/朝觐季）。
- **证据 URL**：
  - https://pep.gov.sa/en/news/1011（2026-08-03，primary，✅200）

---

## 4. H04 中东宗教文本/教材专业翻译（垂直译审）

```json
{
  "id": "opp-culture-religious-translation-001",
  "slug": "religious-text-translation",
  "title": "宗教文本专业译审：普通翻译员做不了的阿语市场",
  "one_liner": "伊斯兰权威裁定《古兰经》含义翻译只可由专才承担，宗教教材/金融/内容本地化存在资质型信息差，个人可做译审+学者背书",
  "industry_id": "culture",
  "gap_type_ids": ["language", "culture", "knowledge"],
  "region_ids": ["mena", "sea"],
  "origin_country": "沙特",
  "target_countries": ["沙特", "阿联酋", "埃及", "印尼", "马来西亚"],
  "human_need_ids": ["meaning", "belonging", "control"],
  "neuro_drivers": ["serotonin", "oxytocin"],
  "emotion_tags": ["devotion", "awe", "fear"],
  "source_langs": ["ar", "zh", "en"],
  "roi": { "capital_cny": {"min": 2000, "max": 10000}, "time_to_revenue_months": 3, "payback_months": 6, "monthly_revenue_cny": {"min": 8000, "max": 30000}, "gross_margin_pct": 70, "effort_level": "side", "team_size": 2 },
  "scores": { "dimensions": {"signal": 7.6, "gap": 9.2, "feasibility": 6.5, "economics": 7.8, "timing": 7.5, "competition": 8.0, "risk": 5.8, "fit": 6.0, "evidence": 8.2, "leverage": 7.2}, "total": 75.3, "grade": "A" },
  "window": { "status": "open", "months_left": 36, "decay": "slow" },
  "tags": ["needs-license", "localization-heavy", "b2b", "digital"],
  "verified": false
}
```

- **卖什么**：阿语↔中文/英文宗教文本（《古兰经》义译、圣训、教义教材）、伊斯兰金融/法律合同、学校宗教课本、术语库、审校+学者背书。
- **价格/规模证据**：IslamWeb 法特瓦明确"《古兰经》含义翻译只有专才可承担"（`primary`，✅200 标题即结论）；伊朗 Hawzah 问答列明翻译条件（`secondary`，⏳）；沙特语言服务市场有 2025–2030 专门报告（`secondary`，⏳）。
- **七问要点**：
  - `traffic`：中东/东南亚宗教出版社、伊斯兰学校、清真认证机构、伊斯兰金融公司；学术会议+LinkedIn。
  - `money`：按字/按项目（译审 0.15–0.5 元/字，审校 0.1–0.3 元/字）+ 术语库授权 + 长期顾问。
  - `model`：垂直译审工作室（初译+学者终审+免责声明）；数字交付。
  - `roi`：启动 2,000–10,000 元（术语库/网站/学者合作）；3 个月首单，6 个月回本；毛利 70%。
  - `audience`：阿语专业 + 宗教学者背书 + 中文能力；不适合无宗教知识者。
  - `drivers`：["info", "cross-border"]
  - `moat`：宗教学者网络 + 术语库 + 案例；信任壁垒高。
- **为何现在**：中东宗教教育/伊斯兰金融/内容本地化需求上升；AI 翻译放大了"宗教正确性"风险，反而抬高人工审校价值。
- **风险**：误译引发宗教/外交争议；需学者合作与责任边界；部分国家要求译者资质。
- **证据 URL**：
  - https://fatwatokdev.islamweb.net/?id=176559&sub_cat=406（`primary`，✅200，正文截断 → `verified:false` 保守处理）
  - https://hawzah.net/fa/Question/View/64155/...（`secondary`，⏳）
  - https://www.kenresearch.com/saudi-arabia-language-services-market（`secondary`，⏳）

---

## 5. H05 韩国 K-beauty 出口分销与内容代运营

```json
{
  "id": "opp-crossborder-kbeauty-export-001",
  "slug": "kbeauty-export-distribution",
  "title": "K-beauty 出口分销：美国超过中国后的渠道重排",
  "one_liner": "2025 年韩国化妆品出口 $114.3 亿、美国首超中国，中小品牌缺海外运营，中国团队可做分销+内容代运营",
  "industry_id": "crossborder",
  "gap_type_ids": ["channel", "language", "platform"],
  "region_ids": ["east-asia", "north-america", "europe"],
  "origin_country": "韩国",
  "target_countries": ["美国", "日本", "中国香港", "阿联酋"],
  "human_need_ids": ["status", "health", "expression"],
  "neuro_drivers": ["dopamine", "serotonin"],
  "emotion_tags": ["aspiration", "pride", "identity"],
  "source_langs": ["ko", "en"],
  "roi": { "capital_cny": {"min": 20000, "max": 80000}, "time_to_revenue_months": 3, "payback_months": 8, "monthly_revenue_cny": {"min": 30000, "max": 120000}, "gross_margin_pct": 35, "effort_level": "full", "team_size": 3 },
  "scores": { "dimensions": {"signal": 8.8, "gap": 7.2, "feasibility": 7.8, "economics": 7.5, "timing": 7.8, "competition": 5.5, "risk": 7.0, "fit": 7.5, "evidence": 8.8, "leverage": 7.8}, "total": 76.1, "grade": "A" },
  "window": { "status": "open", "months_left": 12, "decay": "fast" },
  "tags": ["b2b", "cross-border", "content-driven", "recurring"],
  "verified": true
}
```

- **卖什么**：韩国中小美妆品牌的海外分销/独家代理、TikTok/Reels 内容代运营、达人寄样与佣金、独立站搭建。
- **价格/规模证据**：2025 出口 **$114.3 亿（+12.3%）**；美国 **$21.9 亿（+15.1%，首次第一）**、中国大陆 **$20.1 亿（-19.2%）**、日本 **$10.9 亿（+5%）**、香港 **$7.05 亿（+21.6%）**；进口国 **202 个**；护肤 **$85.4 亿**、彩妆 **$15.1 亿**、身体清洁 **+27.3%**、香水 **+46.2%**（韩国食药处数据，Yonhap 2026-01-09，`primary`，✅200）。
- **七问要点**：
  - `traffic`：TikTok/Instagram 达人矩阵 + Amazon/独立站 + 中东/日本本地 KOL。
  - `money`：分销差价（30–50%）+ 代运营月费 + 佣金。
  - `model`：品牌代理/代运营；轻库存（先接单后采购）。
  - `roi`：启动 2–8 万元（首批货/内容/达人）；3 个月首单，8 个月回本；毛利 30–40%。
  - `audience`：有跨境电商运营/内容能力、能飞韩国谈品牌的人。
  - `drivers`：["cross-border", "info", "supply"]
  - `moat`：品牌授权 + 达人关系 + 内容能力；窗口期短（12 个月内会被抢）。
- **为何现在**：K-beauty 出口结构从中国转向美国/日本/中东/香港，中小品牌缺海外团队；中国团队在 TikTok 运营上成本低。
- **风险**：代理权被收回；各国化妆品注册（FDA/CPNP/SFDA）；汇率。
- **证据 URL**：
  - https://en.yna.co.kr/view/AEN20260109010100320（2026-01-09，primary，✅200）

---

## 6. H06 短剧出海本地化（翻译/配音/投放）

```json
{
  "id": "opp-content-short-drama-localization-001",
  "slug": "short-drama-localization",
  "title": "短剧出海本地化：$28 亿大盘里的多语种交付缺口",
  "one_liner": "2025 全球短剧 IAP $28 亿（+116%）、DramaBox $5.3 亿，印尼语/葡语/阿语本地化与投放素材是个人可做的卖铲子生意",
  "industry_id": "content",
  "gap_type_ids": ["time", "language", "channel"],
  "region_ids": ["china", "north-america", "sea", "latam"],
  "origin_country": "中国",
  "target_countries": ["美国", "印尼", "巴西", "沙特"],
  "human_need_ids": ["novelty", "belonging", "status"],
  "neuro_drivers": ["dopamine", "adrenaline"],
  "emotion_tags": ["curiosity", "love", "envy"],
  "source_langs": ["zh", "en", "id", "pt", "ar"],
  "roi": { "capital_cny": {"min": 3000, "max": 15000}, "time_to_revenue_months": 2, "payback_months": 4, "monthly_revenue_cny": {"min": 10000, "max": 40000}, "gross_margin_pct": 60, "effort_level": "side", "team_size": 2 },
  "scores": { "dimensions": {"signal": 8.9, "gap": 8.0, "feasibility": 8.2, "economics": 7.8, "timing": 8.0, "competition": 6.0, "risk": 6.8, "fit": 7.8, "evidence": 8.8, "leverage": 7.5}, "total": 79.0, "grade": "A" },
  "window": { "status": "open", "months_left": 12, "decay": "medium" },
  "tags": ["content-driven", "localization-heavy", "remote", "b2b"],
  "verified": true
}
```

- **卖什么**：短剧翻译/配音/字幕（印尼语/葡语/阿语/西语）、投放素材剪辑、文化审校、海外发行代理、演员经纪。
- **价格/规模证据**：2025 全球短剧 App 内购 **$28 亿（+116%）**；DramaBox 收入 **$5.3 亿（+75%）**、累计 **$8.5 亿**、下载 **+112%**；ReelShort 与 DramaBox 包揽收入与下载冠亚军；Dramawave 全年收入 **+28 倍**（Sensor Tower 经新华财经 2026-01-14，`primary`，✅200）。
- **七问要点**：
  - `traffic`：短剧平台外包招标、MCN、翻译社群；先用 1–2 部样片打样。
  - `money`：按分钟计价（翻译 20–60 元/分钟、配音 50–150 元/分钟）+ 包月产能。
  - `model`：本地化工作室；交付=字幕+配音+文化审校。
  - `roi`：启动 3,000–15,000 元（工具/样片）；2 个月首单，4 个月回本；毛利 60%。
  - `audience`：小语种能力 + 影视/短视频经验；适合远程小团队。
  - `drivers`：["info", "cross-border"]
  - `moat`：语种产能 + 交付质量；窗口期 12–18 个月（AI 配音在追赶）。
- **为何现在**：短剧从"买量"进入"本地化质量"竞争，非英语市场配音/字幕供给短缺。
- **风险**：平台账期与压价；宗教/内容分级合规；AI 配音冲击。
- **证据 URL**：
  - https://m.cnfin.com/wx/share?url=//m.cnfin.com/gs-lb//zixun/20260114/4365190_1.html（2026-01-14，primary，✅200）

---

## 7. H07 巴西 MercadoLibre 跨境

```json
{
  "id": "opp-crossborder-mercadolibre-brazil-001",
  "slug": "mercadolibre-brazil-crossborder",
  "title": "巴西 MercadoLibre：Q3 GMV $165 亿、巴西 +34% 的渠道红利",
  "one_liner": "MercadoLibre Q3 GMV $165 亿（+28%）、巴西商品数 +42%，中国供应链+葡语运营可切入",
  "industry_id": "crossborder",
  "gap_type_ids": ["channel", "infrastructure", "language"],
  "region_ids": ["latam"],
  "origin_country": "巴西",
  "target_countries": ["巴西", "墨西哥", "阿根廷"],
  "human_need_ids": ["ease", "status", "novelty"],
  "neuro_drivers": ["dopamine", "serotonin"],
  "emotion_tags": ["aspiration", "curiosity"],
  "source_langs": ["pt", "es", "zh"],
  "roi": { "capital_cny": {"min": 20000, "max": 80000}, "time_to_revenue_months": 3, "payback_months": 9, "monthly_revenue_cny": {"min": 30000, "max": 150000}, "gross_margin_pct": 30, "effort_level": "full", "team_size": 2 },
  "scores": { "dimensions": {"signal": 8.7, "gap": 7.8, "feasibility": 7.5, "economics": 8.0, "timing": 8.5, "competition": 5.8, "risk": 7.2, "fit": 7.2, "evidence": 8.8, "leverage": 8.0}, "total": 78.2, "grade": "A" },
  "window": { "status": "open", "months_left": 18, "decay": "medium" },
  "tags": ["cross-border", "needs-supply-chain", "platform-dependent", "b2b"],
  "verified": true
}
```

- **卖什么**：3C 配件、家居、汽配、美妆工具的中国供应链选品；MercadoLibre 本土店/跨境店运营、葡语 listing、海外仓履约。
- **价格/规模证据**：Q3 净收入 **$74 亿（+39%）**、GMV **$165 亿（+28%）**、独立买家 **7,700 万（+26%）**、商品 **6.35 亿件（+39%）**；巴西 GMV **+34%**、商品 **+42%**；墨西哥 GMV **+34%**；阿根廷 GMV **+44%**；80% 订单 48h 内送达；生态支持 **950 万** 中小微（MercadoLibre 官方 2025-10-29，`primary`，✅200）。
- **七问要点**：
  - `traffic`：MercadoLibre 站内广告 + 站外 TikTok/Instagram + 本地达人。
  - `money`：商品差价（30–50%）+ 广告优化服务费。
  - `model`：跨境店/本土店；先小批量测品。
  - `roi`：启动 2–8 万元（首批货/广告/海外仓）；3 个月首单，9 个月回本；毛利 30%。
  - `audience`：有跨境运营经验、能处理葡语客服的人；建议 2 人。
  - `drivers`：["cross-border", "supply", "ops"]
  - `moat`：选品+本地仓+评分；平台规则变化是主要风险。
- **为何现在**：巴西/墨西哥电商渗透率仍低，但物流（fulfillment 容量 +41%）与支付（Mercado Pago）成熟。
- **风险**：巴西税负与清关（Remessa Conforme）；汇率；佣金/广告上涨。
- **证据 URL**：
  - https://news.mercadolibre.com/resultados-financieros-tercer-trimestre-2025（2025-10-29，primary，✅200）

---

## 8. H08 尼日利亚乳木果本地加工

```json
{
  "id": "opp-manufacturing-shea-butter-001",
  "slug": "nigeria-shea-butter-processing",
  "title": "尼日利亚乳木果：原料出口禁令下的本地加工窗口",
  "one_liner": "原料出口禁令延至 2027-02-25、黄油价格是原料 10–20 倍，本地初加工+中国设备/采购可切入",
  "industry_id": "manufacturing",
  "gap_type_ids": ["regulation", "price", "geo"],
  "region_ids": ["africa"],
  "origin_country": "尼日利亚",
  "target_countries": ["尼日利亚", "加纳", "科特迪瓦"],
  "human_need_ids": ["health", "survival", "expression"],
  "neuro_drivers": ["serotonin", "oxytocin"],
  "emotion_tags": ["hope", "pride"],
  "source_langs": ["en", "zh"],
  "roi": { "capital_cny": {"min": 50000, "max": 300000}, "time_to_revenue_months": 6, "payback_months": 18, "monthly_revenue_cny": {"min": 30000, "max": 150000}, "gross_margin_pct": 35, "effort_level": "full", "team_size": 3 },
  "scores": { "dimensions": {"signal": 8.3, "gap": 9.0, "feasibility": 5.8, "economics": 8.5, "timing": 8.6, "competition": 7.8, "risk": 5.5, "fit": 5.0, "evidence": 8.5, "leverage": 7.5}, "total": 76.6, "grade": "A" },
  "window": { "status": "open", "months_left": 30, "decay": "medium" },
  "tags": ["needs-supply-chain", "b2b", "cross-border", "physical"],
  "verified": true
}
```

- **卖什么**：乳木果油初加工/精炼（皂基、化妆品原料）、本地护肤/护发品牌、加工设备与技术输出、对中国/欧美出口。
- **价格/规模证据**：2025-08-26 起 6 个月原料出口禁令，**延长至 2027-02-25**；官方称**黄油价格是原料的 10–20 倍**（新华社 2026-02-26，`primary`，✅200）；西非多国禁令重塑美妆供应链（BeautyMatter，`secondary`，⏳）。
- **七问要点**：
  - `traffic`：本地合作社/州政府招商 + 中国美妆原料采购商 + 欧美品牌可持续采购。
  - `money`：原料差价 + 加工费 + 成品出口；毛利 30–40%。
  - `model`：合资初加工厂/代加工；重资产，需本地伙伴。
  - `roi`：启动 5–30 万元；6 个月出首批，18 个月回本；毛利 35%。
  - `audience`：有非洲资源/外贸经验、能承受重资产的人；不适合纯兼职。
  - `drivers`：["supply", "regulation", "cross-border"]
  - `moat`：本地关系+许可证+加工产能；政策窗口 2–3 年。
- **为何现在**：禁令把"原料出口"改成"成品出口"，本地加工产能严重不足；中国设备/采购可填缺口。
- **风险**：政局/汇率/电力不稳；质量波动；政策反复；合资伙伴风险。
- **证据 URL**：
  - https://english.news.cn/20260226/d7ae10b2b1214bf39412cc6f639d6d56/c.html（2026-02-26，primary，✅200）

---

## 9. H09 欧盟 EAA 无障碍合规（电商）

```json
{
  "id": "opp-compliance-eaa-accessibility-001",
  "slug": "eu-eaa-accessibility",
  "title": "欧盟 EAA 无障碍：2025-06-28 起的电商新义务",
  "one_liner": "欧盟电商无障碍强制生效、法国最高罚 15,000 欧元/项，中文团队+欧洲顾问可做审计整改",
  "industry_id": "compliance",
  "gap_type_ids": ["regulation", "language", "knowledge"],
  "region_ids": ["europe"],
  "origin_country": "法国",
  "target_countries": ["法国", "德国", "西班牙", "意大利"],
  "human_need_ids": ["fairness", "control", "ease"],
  "neuro_drivers": ["cortisol", "serotonin"],
  "emotion_tags": ["anxiety", "justice", "relief"],
  "source_langs": ["fr", "en"],
  "roi": { "capital_cny": {"min": 3000, "max": 15000}, "time_to_revenue_months": 2, "payback_months": 4, "monthly_revenue_cny": {"min": 10000, "max": 50000}, "gross_margin_pct": 70, "effort_level": "side", "team_size": 2 },
  "scores": { "dimensions": {"signal": 7.8, "gap": 8.8, "feasibility": 7.0, "economics": 7.6, "timing": 8.4, "competition": 7.2, "risk": 7.5, "fit": 6.8, "evidence": 8.5, "leverage": 6.5}, "total": 77.1, "grade": "A" },
  "window": { "status": "open", "months_left": 18, "decay": "medium" },
  "tags": ["needs-license", "b2b", "remote", "localization-heavy"],
  "verified": true
}
```

- **卖什么**：电商网站/APP 无障碍审计（WCAG 2.2/EN 301 549/RGAA）、整改、无障碍声明、员工培训。
- **价格/规模证据**：自 **2025-06-28** 起，欧盟电商服务（PME：**>10 名员工 且 营业额/总资产 >200 万欧元**）必须无障碍；罚款个人 **€1,500/€3,000（再犯）**、法人 **€7,500/€15,000（再犯）**，按每个电商服务、每项义务累计；不符合须向 DGCCRF 报告（法国政府 France Num 2025-12-15，`primary`，✅200）。
- **七问要点**：
  - `traffic`：欧洲中小电商、跨境独立站、Shopify 服务商；LinkedIn/本地商会。
  - `money`：审计 800–3,000 欧元/站 + 整改 2,000–10,000 欧元 + 年费监测。
  - `model`：远程审计+整改顾问（与欧洲本地无障碍专家合作）。
  - `roi`：启动 3,000–15,000 元；2 个月首单，4 个月回本；毛利 70%。
  - `audience`：前端/可访问性能力 + 英语/法语沟通；不适合无技术背景者。
  - `drivers`：["regulation", "info"]
  - `moat`：可访问性专业能力+认证；先发者窗口 12–24 个月。
- **为何现在**：2025-06 刚生效，欧洲中小电商普遍未合规；中国团队不知道自己也受约束。
- **风险**：标准更新；审计责任；客户预算低。
- **证据 URL**：
  - https://www.francenum.gouv.fr/guides-et-conseils/developpement-commercial/site-e-commerce/accessibilite-des-sites-de-e-commerce（2025-12-15，primary，✅200）

---

## 10. H10 丧亲纪念与回忆录服务

```json
{
  "id": "opp-emotional-memoir-grief-001",
  "slug": "grief-memoir-service",
  "title": "丧亲纪念与回忆录：高客单情绪价值服务",
  "one_liner": "定制纪念画 $4,900 起、旧相册数字化 $80/50 页且供给慢，个人可做回忆录/纪念物代写与数字化",
  "industry_id": "emotional",
  "gap_type_ids": ["emotion", "knowledge", "demographic"],
  "region_ids": ["north-america", "europe"],
  "origin_country": "美国",
  "target_countries": ["美国", "英国", "加拿大", "澳大利亚"],
  "human_need_ids": ["nostalgia", "meaning", "belonging"],
  "neuro_drivers": ["oxytocin", "serotonin"],
  "emotion_tags": ["grief", "love", "nostalgia"],
  "source_langs": ["en", "zh"],
  "roi": { "capital_cny": {"min": 2000, "max": 10000}, "time_to_revenue_months": 1, "payback_months": 3, "monthly_revenue_cny": {"min": 8000, "max": 40000}, "gross_margin_pct": 75, "effort_level": "side", "team_size": 1 },
  "scores": { "dimensions": {"signal": 8.0, "gap": 8.5, "feasibility": 8.6, "economics": 8.2, "timing": 7.6, "competition": 7.0, "risk": 7.2, "fit": 8.4, "evidence": 7.6, "leverage": 6.8}, "total": 79.6, "grade": "A" },
  "window": { "status": "open", "months_left": 24, "decay": "slow" },
  "tags": ["low-capital", "solo", "side-hustle", "digital", "content-driven"],
  "verified": false
}
```

- **卖什么**：回忆录代写、家族访谈、旧相册/录像数字化、悼词/讣告、纪念日订阅、纪念画/纪念物。
- **价格/规模证据**：定制纪念画 **$4,900 起**（艺术家官网 2026-08，`primary`，✅200）；Reddit 用户讨论旧剪贴簿扫描：**$80/50 页、利润约 $70**，抱怨现有公司"每页数美元、要等数月"（用户原声 2026-10-18，`primary`，✅200）；Upwork 有大量回忆录代写供给（`primary`，⏳）。
- **七问要点**：
  - `traffic`：Google SEO（"memoir writer"/"scan old photos"）+ 殡仪馆/临终关怀机构合作 + Reddit/本地社群。
  - `money`：回忆录 3,000–15,000 元/本；数字化 300–1,500 元/单；会员订阅。
  - `model`：服务交付（访谈+写作+设计+印刷）；可外包设计/印刷。
  - `roi`：启动 2,000–10,000 元；1 个月首单，3 个月回本；毛利 75%。
  - `audience`：会写作/采访、有共情能力的人；适合兼职与远程。
  - `drivers`：["info", "ops"]
  - `moat`：真实案例+口碑+情绪安全流程；个人品牌是壁垒。
- **为何现在**：婴儿潮进入高龄，遗产/回忆需求上升；AI 降低排版/初稿成本，"真人温度"溢价。
- **风险**：情绪劳动耗竭；AI 写作伦理；交付周期长；客诉敏感。
- **证据 URL**：
  - https://zellerhausart.com/blog/spirit-pieces-review（2026-08，primary，✅200）
  - https://www.reddit.com/r/Entrepreneur/.rss（2026-10-18 条目，primary，✅200）
  - https://www.upwork.com/services/product/writing-translation-a-memoir-that-will-educate-and-inspire-your-readers-1349851133396758528（⏳）

---

## 11. H11 印尼清真认证合规

```json
{
  "id": "opp-compliance-indonesia-halal-001",
  "slug": "indonesia-halal-certification",
  "title": "印尼清真认证：强制认证时间表下的中国企业缺口",
  "one_liner": "印尼食品饮料强制清真认证已落地、进口食品推迟至 2026，中国出口企业缺印尼语+认证能力",
  "industry_id": "compliance",
  "gap_type_ids": ["regulation", "culture", "language"],
  "region_ids": ["sea"],
  "origin_country": "印度尼西亚",
  "target_countries": ["印度尼西亚", "马来西亚"],
  "human_need_ids": ["survival", "meaning", "control"],
  "neuro_drivers": ["serotonin", "cortisol"],
  "emotion_tags": ["fear", "devotion", "relief"],
  "source_langs": ["id", "en", "zh"],
  "roi": { "capital_cny": {"min": 5000, "max": 30000}, "time_to_revenue_months": 4, "payback_months": 10, "monthly_revenue_cny": {"min": 15000, "max": 60000}, "gross_margin_pct": 50, "effort_level": "side", "team_size": 2 },
  "scores": { "dimensions": {"signal": 8.0, "gap": 8.6, "feasibility": 6.6, "economics": 7.8, "timing": 8.4, "competition": 7.0, "risk": 6.5, "fit": 6.2, "evidence": 7.8, "leverage": 7.0}, "total": 75.6, "grade": "A" },
  "window": { "status": "open", "months_left": 18, "decay": "medium" },
  "tags": ["needs-license", "b2b", "localization-heavy"],
  "verified": false
}
```

- **卖什么**：清真认证咨询（原料/配方/供应链审核）、BPJPH 注册与文件、标签合规、印尼语培训。
- **价格/规模证据**：印尼政府推迟对中小微与进口产品的强制清真要求（LPPOM-MUI 官网，`primary`，✅200 标题）；进口食品强制清真认证推迟至 **2026 年**（ctils，`secondary`，⏳）；2024-10-17 起食品饮料强制（法规时间点）。
- **七问要点**：
  - `traffic`：中国食品/化妆品出口企业、跨境电商卖家、印尼本地进口商；展会+LinkedIn。
  - `money`：认证代办 2–8 万元/项目 + 供应链整改 + 年费。
  - `model`：咨询代理（与印尼 LPH 合作）；数字+差旅交付。
  - `roi`：启动 5,000–30,000 元；4 个月首单，10 个月回本；毛利 50%。
  - `audience`：有印尼资源/食品法规背景、能长期跟进的人。
  - `drivers`：["regulation", "cross-border"]
  - `moat`：本地 LPH 关系+案例；政策反复是风险也是壁垒。
- **为何现在**：印尼全球最大穆斯林市场，强制认证方向确定；中国出口企业普遍缺能力。
- **风险**：周期 3–9 个月；宗教审核严；政策反复；需本地合作。
- **证据 URL**：
  - https://halalmui.org/en/the-government-has-postponed-the-mandatory-halal-requirement-for-smes-and-imported-products-this-is-lppoms-response/（primary，✅200 标题）
  - https://www.ctils.com/h5/articles/17145（secondary，⏳）

---

## 12. H12 Etsy 数字产品（Printable / 模板）

```json
{
  "id": "opp-ai-etsy-digital-printables-001",
  "slug": "etsy-digital-printables",
  "title": "Etsy 数字产品：8,650 万买家与零物流的高毛利长尾",
  "one_liner": "Etsy 活跃买家 8,650 万、80% 女性重情感消费，AI 辅助做可打印模板/Notion 模板，单人可验证",
  "industry_id": "ai",
  "gap_type_ids": ["platform", "channel", "knowledge"],
  "region_ids": ["north-america", "europe"],
  "origin_country": "美国",
  "target_countries": ["美国", "英国", "加拿大", "澳大利亚"],
  "human_need_ids": ["expression", "control", "status"],
  "neuro_drivers": ["dopamine", "serotonin"],
  "emotion_tags": ["identity", "pride", "nostalgia"],
  "source_langs": ["en"],
  "roi": { "capital_cny": {"min": 1000, "max": 5000}, "time_to_revenue_months": 1, "payback_months": 3, "monthly_revenue_cny": {"min": 3000, "max": 20000}, "gross_margin_pct": 90, "effort_level": "side", "team_size": 1 },
  "scores": { "dimensions": {"signal": 8.2, "gap": 7.5, "feasibility": 8.8, "economics": 8.0, "timing": 7.2, "competition": 5.5, "risk": 7.8, "fit": 9.0, "evidence": 8.0, "leverage": 7.0}, "total": 77.8, "grade": "A" },
  "window": { "status": "open", "months_left": 12, "decay": "fast" },
  "tags": ["low-capital", "solo", "side-hustle", "digital", "ai-native", "platform-dependent"],
  "verified": true
}
```

- **卖什么**：可打印模板（婚礼/育儿/财务/规划）、数字艺术、Notion/Excel 模板、SVG/字体；AI 辅助但人工审美把关。
- **价格/规模证据**：Etsy 2025 年末活跃买家 **8,650 万**（Etsy 10-K 摘要，`primary`，⏳PDF）；Etsy 买家中 **80% 女性**、日均访问 **1,400 万+**（sohu 转述，`secondary`，✅200）；Etsy API 文档明确**禁止绕过 API 抓取**（`primary`，✅200）。
- **七问要点**：
  - `traffic`：Etsy 站内 SEO（标题/标签/场景图）+ Pinterest + TikTok；前 100 单来自 Etsy 搜索。
  - `money`：数字下载 $3–20/单，毛利 90%；可加购定制。
  - `model`：数字产品店；交付=文件+说明；可自动化。
  - `roi`：启动 1,000–5,000 元（设计工具/样图）；1 个月首单，3 个月回本；毛利 90%。
  - `audience`：有设计/审美能力、英语 listing 可写的人；适合单人兼职。
  - `drivers`：["info", "supply"]
  - `moat`：设计差异+SEO+评价数；平台政策风险高。
- **为何现在**：Etsy 买家重情感消费、数字产品无物流；AI 降低制作成本，竞争转向"场景+审美"。
- **风险**：平台数字产品退款政策；同质化；AI 版权。
- **证据 URL**：
  - https://stocklight.com/stocks/us/nyse-etsy/etsy/annual-reports/nyse-etsy-2026-10K-26651585.pdf（primary，⏳）
  - https://www.sohu.com/a/952762371_121478199（secondary，✅200）
  - https://developers.etsy.com/documentation/（primary，✅200）

---

## 2. 其余 28 个案例（data 团队做 40 条机会库的候选池）

| 案例 | 行业 | 区域 | 证据等级 | 备注 |
|---|---|---|---|---|
| C02 景德镇陶瓷宠物骨灰盒 | crossborder | china→NA/EU/oceania | B | 可与 H01 合并为供应链卡 |
| C03 宠物殡葬服务 | pet | NA/EU/EA | B | 服务类 |
| C04 韩国宠物保险体验 | pet | east-asia | A | 可与 C06 合并 |
| C05 日本宠物保险 | pet | east-asia | A | 可与 C04 合并 |
| C06 韩国宠物市场 | pet | east-asia | A | 生态卡 |
| C08 日本入境游 | local | east-asia | B | 体验类 |
| C09 日本推し活 | content | east-asia | B/C | 待补数字 |
| C11 中国谷子经济 | content | china/east-asia | B | 国内+跨境 |
| C13 中国银发适老化 | silver | china | B | 服务类 |
| C14 中国入境游支付 | fintech | china | A | 支付服务 |
| C17 沙特电商本地化 | crossborder | mena | B | 可与 H03 互补 |
| C18 UAE 开斋节礼赠 | content | mena | B | 节庆 |
| C20 越南 TikTok Shop | crossborder | sea | B | 代运营 |
| C21 东南亚清真美妆 | crossborder | sea/mena | B | 待补数字 |
| C23 巴西 Pix 支付 | fintech | latam | B | 支付 |
| C24 拉美 COD/OXXO | fintech | latam | A | 支付 |
| C26 肯尼亚 PAYG 太阳能 | green | africa | A | 硬件+金融 |
| C27 非洲 Jumia | crossborder | africa | A | 平台 |
| C28 印度婚礼季 | crossborder | south-asia | B | 供应链 |
| C29 印度 Ayurveda | emotional | south-asia | B | 品牌 |
| C30 欧盟 GPSR | compliance | europe | A | 可与 H09 并列 |
| C32 德国电子发票 | compliance | europe | A | B2B |
| C33 欧盟 CBAM | compliance | europe | B | 专业服务 |
| C34 欧盟 EUDR | compliance | europe | B | 专业服务 |
| C35 欧盟 PPWR/EPR | compliance | europe | B | 专业服务 |
| C36 波兰小语种本地化 | local | europe | B | 服务 |
| C37 土耳其电商 | crossborder | europe | B | 跨境 |
| C40 Shopify App 生态 | ai | NA/EU | A | 工具 |

---

## 3. 给 data 团队的 5 条硬提醒

1. **`verified:true` 只给 §1 中标注 ✅200 的 URL**；`fatwatokdev.islamweb.net` 虽 200 但正文未完整提取，建议保守 `false` 或在 `compliance_notes` 写明"标题即结论"。
2. **宠物骨灰跨境**：`compliance_notes` 必须写"多数国家限制骨灰邮寄，建议毛发/纪念物"。
3. **宗教内容**：`compliance_notes` 必须写"需宗教学者审校、避免教义错误"。
4. **平台依赖类**（H05/H06/H07/H12）：`window.decay` 用 `fast/medium`，`risks` 写平台政策变化。
5. **ROI 数字**：全部是研究估算，`disclaimer` 写"研究假设，非收入承诺"。
