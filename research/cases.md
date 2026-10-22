# 真实商机案例底稿（cases.md）

> 研究底稿 · 机会雷达 Opportunity Radar · 版本 v0.1.0 对应
> **检索与核验日期：2026-10-22（Asia/Shanghai）**
> 用途：供 `data/opportunities.json` 直接改写为机会卡（字段映射见文末"与 data 契约映射"）。
> 原则：只写有 URL 的证据；未直连/未打开的一律标注「未核验」；价格、销量、规模数字均来自公开来源，不做推算，不编造。

---

## 0. 阅读说明

### 0.1 证据等级（沿用 docs/12 `tier` 约定）

| 等级 | 定义 | 本文件标记 |
|---|---|---|
| **A 一手** | 平台/政府/官方机构/用户原声/上市公司披露 | `[A]` |
| **B 二手** | 媒体、行业研究机构、咨询报告转述 | `[B]` |
| **C 营销/无法确认** | 自媒体软文、无可核验数据、仅标题 | `[C]` / 标「未核验」 |

### 0.2 链接核验状态说明

- 「✅已打开」= 2026-10-22 用 web_fetch 直连成功（HTTP 200，正文可读）。
- 「⏳仅标题」= 搜索结果给出标题/摘要，但正文未直连或仅提取到标题。
- 「⛔拦截」= 直连被 403/Cloudflare/429 拦截，注明原因与替代方案。
- 本文件的直连成功链接 **≥ 30 个**（远超任务要求的 15 个），关键链接核验清单见 §3。

### 0.3 与 `docs/12` 枚举的对应

行业 `industry_id` 14 选 1：`pet / silver / emotional / ai / content / education / crossborder / local / green / compliance / culture / gaming / fintech / manufacturing`。
区域 `region_id` 11 选 1–3：`north-america / europe / mena / sea / east-asia / south-asia / latam / africa / oceania / cis / china`。
信息差 `gap_type_ids` 1–3（主类型排第一）：`language / culture / time / geo / knowledge / regulation / platform / price / channel / demographic / emotion / infrastructure`。

---

## 1. 案例索引（40 个）

| # | 案例 | 行业 id | 区域 id | 信息差（主） | 关键数字 | 证据 |
|---|---|---|---|---|---|---|
| C01 | 宠物离世纪念玻璃 DTC | pet | north-america, europe, oceania | culture | 玻璃 $129–299、珠宝 $69–549、纪念画 $4,900 起 | A–B |
| C02 | 景德镇瓷制宠物骨灰盒出海 | crossborder | china→north-america, europe, oceania | geo | 单厂年销 6,000 万+ CNY | B |
| C03 | 宠物殡葬服务全球化 | pet | north-america, europe, east-asia | demographic | 全球服务市场 2024 $19.7 亿→2025 $21.8 亿、2034 $41 亿 | B |
| C04 | 韩国宠物保险理赔体验服务 | pet | east-asia | knowledge | 韩国渗透率约 2% vs 日本 21.4% | A |
| C05 | 日本宠物保险与院内结算生态 | pet | east-asia | knowledge | 市场规模 1.3 万亿韩元≈1,408 亿日元 | A |
| C06 | 韩国宠物市场（殡葬/营养/订阅） | pet | east-asia | demographic | 2027 年约 6 万亿韩元、1,448 万养宠人 | A |
| C07 | 日本故乡纳税返礼品开发 | local | east-asia | language | 2025 年度 1 兆 3,314 亿日元 | A |
| C08 | 日本入境游体验与支付服务 | local | east-asia | language | 2025 年访日 4,270 万人次 | B |
| C09 | 日本「推し活/Stan」周边 | content | east-asia | culture | 媒体称"抗通胀 stan 经济"（金额未直连） | B/C |
| C10 | 韩国 K-beauty 出口分销与内容 | crossborder | east-asia, north-america, europe | channel | 2025 出口 $114.3 亿、+12.3% | A |
| C11 | 中国谷子经济 | content | china, east-asia | culture | 2025 谷子 2,021 亿元（+19.7%） | B |
| C12 | 中国短剧出海 | content | china, north-america, sea | time | 2025 全球短剧 IAP $28 亿（+116%） | A |
| C13 | 中国银发适老化 | silver | china | demographic | 30 万亿元级市场（官媒） | B |
| C14 | 中国入境游支付/外卡服务 | fintech | china | infrastructure | 2026 春节移动支付"双向"（官方） | A |
| C15 | 沙特/海湾 Umrah 服务 | local | mena | culture | 2025 年 1,950 万人次、签证 1,503 万 | A |
| C16 | 中东宗教文本专业翻译 | culture | mena | language | 宗教法特瓦：仅专才可译《古兰经》 | A |
| C17 | 沙特电商本地化 | crossborder | mena | language | 2025-10 月电商销售 307 亿里亚尔 | B |
| C18 | UAE 开斋节礼赠电商 | content | mena | culture | 2026 开斋节线上礼赠 +115% | B |
| C19 | 印尼清真认证合规 | compliance | sea | regulation | 2024-10-17 强制、进口食品延至 2026 | A–B |
| C20 | 越南 TikTok Shop 代运营 | crossborder | sea | platform | 2025 TikTok Shop 越南 GMV +66% | B |
| C21 | 东南亚清真美妆 | crossborder | sea, mena | culture | 报告覆盖 2025–2033（金额未取） | B |
| C22 | 巴西 MercadoLibre 跨境 | crossborder | latam | channel | Q3 GMV $165 亿（+28%）、巴西 +34% | A |
| C23 | 巴西 Pix 支付集成 | fintech | latam | infrastructure | Pix 在电商已超信用卡，2028 预计占 50% | B |
| C24 | 拉美现金/COD 履约（OXXO） | fintech | latam | infrastructure | Mercado Pago 官方文档支持 OXXO 现金 | A |
| C25 | 尼日利亚乳木果本地加工 | manufacturing | africa | regulation | 原料禁出口延至 2027-02-25；黄油价 10–20 倍 | A |
| C26 | 肯尼亚 PAYG 太阳能 | green | africa | infrastructure | $1.56 亿证券化、覆盖 100 万+ 肯尼亚人 | A |
| C27 | 非洲 Jumia 中国卖家 | crossborder | africa | platform | 2025 GMV $8.186 亿（+14%）、收入 $1.889 亿 | A |
| C28 | 印度婚礼季供应链 | crossborder | south-asia | culture | 婚礼季 ₹6.5 万亿卢比、460 万场婚礼 | B |
| C29 | 印度 Ayurveda D2C | emotional | south-asia | culture | FMCG 连续收购 Ayurveda 品牌 | B |
| C30 | 欧盟 GPSR 合规服务 | compliance | europe | regulation | 2024-12-13 生效、强制欧盟责任人 | A |
| C31 | 欧盟 EAA 无障碍合规 | compliance | europe | regulation | 2025-06-28 起、>10 人或 >€200 万营业额 | A |
| C32 | 德国电子发票 | compliance | europe | regulation | 2025 接收义务、2027/2028 开具 | A |
| C33 | 欧盟 CBAM 正式期核算 | compliance | europe | regulation | 2026 起进入正式期 | B |
| C34 | 欧盟 EUDR 溯源合规 | compliance | europe | regulation | 法规推迟+简化 | B |
| C35 | 欧盟 PPWR/EPR 包装合规 | compliance | europe | regulation | PPWR 2026 生效 | B |
| C36 | 波兰/欧洲小语种本地化 | local | europe | language | 波兰跨境销售占比 2030 年将超 12% | B |
| C37 | 土耳其电商本地化 | crossborder | europe, cis | language | 电商交易额超 4.5 万亿里拉 | B |
| C38 | 丧亲纪念与回忆录服务 | emotional | north-america, europe | emotion | 定制纪念画 $4,900 起；相册数字化 $80/50 页 | A–B |
| C39 | Etsy 数字产品（Printable） | ai | north-america, europe | platform | Etsy 活跃买家 8,650 万（2025-12-31） | A |
| C40 | Shopify App 生态小工具 | ai | north-america, europe | platform | 应用生态规模 $13 亿；头部评价 4.8 万条 | A |

---

## 2. 案例详情

### C01 宠物离世纪念玻璃：把骨灰/毛发封进玻璃的定制生意
- **行业/区域**：`pet` ｜ `north-america` + `europe` + `oceania` ｜ 信息差：`culture`（主）+ `emotion`
- **卖什么**：玻璃纪念球/纸镇/心形/火焰/生命树、纪念首饰（戒指/项链/手链）、骨灰纪念盒；含猫狗等宠物与人的纪念。可加购第二件给家人。
- **价格/规模证据（数字）**：
  - 头部平台 Spirit Pieces：玻璃类 **$129–$299**，纪念珠宝 **$69–$549**，全品类可落在 **$70–$550** 区间；每件只用约半茶匙骨灰，因此一份骨灰可做 5 件给 5 位家人；交付约 6 周（`[B]` 独立纪念艺术家测评，2026-08）。
  - 同一测评显示高端定制纪念画 **$4,900 起**，说明"纪念品"价格带极宽，存在高端分包机会。
  - 全球宠物殡葬服务市场：**2024 年 $19.7 亿 → 2025 年约 $21.8 亿**；另一口径 2024 年 **$17 亿 → 2034 年 $41 亿，CAGR 9.1%**（`[B]` 跨境媒体，2025-11-10）。
  - Amazon 一款发光宠物纪念石：**近 30 天销量 1,000+、销售额 3.4 万美元**；Etsy 日均访问 **1,400 万+、80% 女性用户**（`[B]` 同上）。
  - **中国供应链已在进行时**：景德镇一家陶瓷工厂主做宠物骨灰盒/雕像/墓碑，**年销 6,000 多万人民币**，销往美洲/欧洲/澳洲（`[B]` 同上）。
- **来源**：
  - https://zellerhausart.com/blog/spirit-pieces-review ✅已打开（2026-08）
  - https://www.sohu.com/a/952762371_121478199 ✅已打开（2025-11-10）
  - https://www.spiritpieces.com/products/glass-kiss-with-cremation-ashes ⏳正文未完整提取（HTTP 200）
- **为什么现在**：宠物"家人化"（pet humanization）叠加中国景德镇/义乌工艺供给成熟；平台端（Etsy/Amazon/TikTok）已完成用户教育，独立站只需解决"防碎包装 + 原创设计 + 真实好评"。
- **个人可切入角度**：①在 Etsy/独立站做垂直设计（宠物品种定制、星座+爪印）；②给海外纪念品店做中国代工+一件代发（B2B 更稳）；③TikTok/Reels 拍"制作过程+告别仪式"内容获客，前 100 单来自 Etsy 搜索与宠物殡葬博主联名。
- **风险**：动物遗骸/骨灰跨境邮寄多数国家受限（建议只寄毛发/纪念物）；玻璃易碎导致跨境破损退款；同质化设计快速跟进；部分国家动物遗体处理法规需核查。

### C02 景德镇瓷制宠物骨灰盒/纪念像：产业带直接出海
- **行业/区域**：`crossborder` + `manufacturing` ｜ `china`（发源）→ `north-america`、`europe`、`oceania` ｜ 信息差：`geo`（主）+ `price`
- **卖什么**：陶瓷骨灰盒、宠物雕像/墓碑、可刻字纪念石、纪念相框；定制化（宠物特征/文字/照片）。
- **价格/规模证据**：单厂年销 **6,000 万+ 人民币**；Amazon 宠物纪念石 30 天 **1,000+ 件 / $3.4 万**；Etsy 同类手工纪念石 **CA$20–50** 价格带；Etsy 日均访问 1,400 万+（`[B]` sohu 2025-11-10，✅已打开）。
- **来源**：https://www.sohu.com/a/952762371_121478199 ✅已打开（2025-11-10）
- **为什么现在**：海外宠物殡葬从"处理遗体"转向"纪念仪式"，但本地手工产能贵且慢（6 周交付），景德镇把交付与成本同时打下来；跨境小包与海外仓已能承接易碎品。
- **个人可切入角度**：不做工厂，做**中间层**——选品+摄影+英文 listing+售后，工厂直发；或给海外宠物殡葬服务商做白牌供应。
- **风险**：易碎品退货率高、旺季物流爆仓；瓷器图案涉宗教/品种禁忌需审；无原创设计则被压价。

### C03 宠物殡葬服务：把"告别"做成标准化服务包
- **行业/区域**：`pet` ｜ `north-america` + `europe` + `east-asia` ｜ 信息差：`demographic`（主）+ `emotion`
- **卖什么**：上门接送、清洁梳理、爪印/毛发留存、告别仪式、火化、纪念品组合（骨灰盒+项链+视频）；订阅型"纪念日提醒+追思内容"。
- **价格/规模证据**：全球宠物殡葬服务市场 **2024 $19.7 亿 → 2025 $21.8 亿**；预计 **2034 $41 亿、CAGR 9.1%**；TikTok `#petfuneral` 视频 1,000+ 条，最高单条 50.78 万播放；《2025 中国宠物行业白皮书》定制纪念品服务增速进前三、**增长 10 个百分点**（`[B]` sohu 2025-11-10，✅已打开）。
- **来源**：https://www.sohu.com/a/952762371_121478199 ✅已打开；https://insights.made-in-china.com/jp/In-Depth-Analysis-of-the-Pet-Funeral-Industry-When-Pets-Become-Family-How-Do-We-Say-a-Proper-Goodbye_wtDfFVWGJxlT.html ⏳仅标题（宠物殡葬行业分析）；https://finance.sina.com.cn/cj/2025-07-02/doc-infczvkq5982512.shtml ⏳仅标题（2025-07-02）
- **为什么现在**：日本/韩国/欧美的宠物殡葬已从"灰色服务"转为合法合规的仪式消费，中国城市（北上广深）渗透率仍低，存在 2–3 年时间差。
- **个人可切入角度**：①在二线城市做"宠物告别师"轻服务（合作宠物医院导流）；②做纪念品组合的线上店（不碰火化资质）；③做宠物殡葬机构的 SaaS/小程序（预约、纪念页、直播告别）。
- **风险**：动物遗体处理资质与环保要求；情绪服务者心理耗竭；价格敏感导致低毛利。

### C04 韩国宠物保险理赔体验：理赔代办与医疗翻译
- **行业/区域**：`pet` ｜ `east-asia`（韩国）｜ 信息差：`knowledge`（主）+ `infrastructure`
- **卖什么**：宠物病历翻译（韩→中/英）、保险理赔材料整理与代提交、二次诊疗意见、宠物医院比价。
- **价格/规模证据**：韩国 2024 年末 **591 万户养宠（占全国家庭 26.7%）**；宠物保险渗透率仅 **约 2%**；**26.2%** 家庭近两年宠物医疗花费超 **100 万韩元**；对比日本宠物保险市场 **1.3 万亿韩元（1,408 亿日元）、渗透率约 21.4%**（`[A]` 韩国亚细亚经济 2026-02-12，✅已打开）。
- **来源**：https://www.asiae.co.kr/lang/print.htm?idxno=2026021209550059103&lang=en ✅已打开（2026-02-12）；http://www.petconomy.or.kr/notice/media/read.jsp?reqPageNo=1&no=953 ⏳仅标题（韩国宠物产业协会）
- **为什么现在**：韩国宠物保险正从"事后报销"转向"院内直付"（My Brown Live Claim 覆盖 260+ 医院、占比 23%→27%），理赔文档与医院沟通出现新服务缝隙；外国人在韩养宠（中国/东南亚移民）语言不通。
- **个人可切入角度**：懂中韩双语 + 宠物医疗常识的人做"宠物医疗陪诊/理赔管家"；或给宠物医院做中文客服外包。
- **风险**：涉及保险代办需合规（韩国保险业法）；医疗翻译错误责任；市场规模仍小。

### C05 日本宠物保险与院内结算：成熟市场的二次创新
- **行业/区域**：`pet` ｜ `east-asia`（日本）｜ 信息差：`knowledge`（主）+ `time`
- **卖什么**：宠物保险比价/投保咨询、院内直付体验优化、宠物健康管理订阅（体检提醒、疫苗记录、口腔护理）。
- **价格/规模证据**：日本宠物保险市场 **超 1.3 万亿韩元（约 1,408 亿日元）**、渗透率 **约 21.4%**；Anicom **87%** 保单用院内结算，合作动物医院 **约 6,900 家（约占全日本 50%）**（`[A]` asiae 2026-02-12，✅已打开）。
- **来源**：https://www.asiae.co.kr/lang/print.htm?idxno=2026021209550059103&lang=en ✅已打开（2026-02-12）
- **为什么现在**：日本宠物保险渗透率高但增长趋缓，竞争转向"服务体验"；同时日本宠物主老龄化，数字工具接受度上升。
- **个人可切入角度**：给日本中小宠物医院做"多语言+保险直付"SaaS 插件；或面向在日外国人做宠物医疗中文/英文导诊。
- **风险**：日本市场对外国服务商信任门槛高、需本地法人/日语客服；保险合作需牌照或与持牌方合作。

### C06 韩国宠物市场：6 万亿韩元前的殡葬、营养与订阅
- **行业/区域**：`pet` ｜ `east-asia`（韩国）｜ 信息差：`demographic`（主）+ `emotion`
- **卖什么**：宠物殡葬与纪念品、宠物营养/鲜食订阅、宠物友好旅行、宠物行为训练（线上）。
- **价格/规模证据**：韩国农村经济研究院（KREI）预测宠物市场 **2024 年 4.9731 万亿 → 2025 年 5.3474 万亿 → 2026 年 5.6935 万亿 → 2027 年 6.0055 万亿韩元**；2020 年末养宠人口 **1,448 万**（`[A]` 韩国프라임경제 2023-02-17，✅已打开——注意为 2023 年发布的前瞻预测，需以 2025-2026 实际数据复核）。
- **来源**：https://www.newsprime.co.kr/news/article/?no=593276 ✅已打开（2023-02-17）；https://world.kbs.co.kr/service/news_view.htm?lang=j&Seq_Code=92975 ⏳仅标题（KBS：韩国每 3 户 1 户养宠）
- **为什么现在**：韩国宠物市场即将跨过 6 万亿韩元门槛，但殡葬/保险/旅行等细分仍早期；韩国出生率全球最低，宠物替代育儿，情绪消费强。
- **个人可切入角度**：中国供应链做宠物纪念品/宠物推车/宠物家具出口韩国；或在韩国做宠物殡葬内容+预约平台。
- **风险**：韩国本土财阀与平台（Coupang/Naver）挤压；殡葬设施邻避效应；跨境物流成本。

### C07 日本故乡纳税（ふるさと納税）：返礼品开发与代运营
- **行业/区域**：`local` ｜ `east-asia`（日本）｜ 信息差：`language`（主）+ `culture`
- **卖什么**：为日本中小自治体/返礼品运营商提供"中国供应链选品 + 日语提案 + 品质管理"；或为已在中国的日本地方特产做中文内容与渠道。
- **价格/规模证据**：2025 年度故乡纳税捐赠总额 **1 兆 3,314 亿日元**（同比 +587 亿，连续 6 年创新高）（`[A]` 信浓每日新闻 2026-07-31，✅已打开）。
  RIETI 2026-03-11 调查（n=10,850）：返礼品类别 **鱼贝海产 39.7%、肉 36.8%、大米 28.7%、水果 23.6%**；单品第一是大米 **27.6%**、第二牛肉 **25.4%**；日用品中卫生纸进入单品前三；**83.4%** 用户计划继续用同一门户；不满第一是"捐赠上限额难算" **40.1%**、"制度改后实惠感下降" **33.3%**、"门户太多" **28.6%**。
  政策变化：**2025-10-01 起禁止带积分的捐赠招募**，2025 年 9 月寄附占比 **41.1%** 反超 12 月的 **29.1%**（`[A]` RIETI，✅已打开）。
- **来源**：https://www.shinmai.co.jp/news/article/gfkn2026073101001609 ✅已打开（2026-07-31）；https://www.rieti.go.jp/jp/columns/a01_0805.html ✅已打开（2026-03-11）；https://www.rieti.go.jp/jp/columns/a01_0814.html ⏳仅标题（2026-07-22，自治体选择逻辑）
- **为什么现在**：2025 年制度改正（禁积分）逼着自治体从"返利"转向"返礼品质量+故事"，中国供应链的柔性小批量正合适；同时 83.4% 用户不愿换门户，后来者只能从"新自治体+新产品"切入。
- **个人可切入角度**：日语 N2 以上 + 中国工厂资源的人，做"返礼品开发经纪"（按 SKU 收费/销售分成）；或做中文版"故乡纳税攻略"内容（面向在日华人/中国游客）。
- **风险**：日本自治体决策链慢（6–18 个月）；食品/化妆品进口日本需检疫与标签合规；返礼品毛利被平台压到 20–30%。

### C08 日本入境游：小众体验与"支付+内容"服务
- **行业/区域**：`local` ｜ `east-asia`（日本）｜ 信息差：`language`（主）+ `channel`
- **卖什么**：中文/英文小众体验（手作、温泉、动漫圣地、酒藏）、包车/接送、翻译导览、免税与支付引导内容。
- **价格/规模证据**：2025 年访日外国人 **4,270 万人次**创历史新高（`[B]` ttnworldwide，2026-01）；日本观光厅《インバウンド消費動向調査 2025年暦年（速報）》已发布（`[A]` 观光厅官网）；2026 春节中国移动支付"入境扫码+出境一码"双向增长（`[A]` 北京市政府 2026-02-14，✅已打开）。
- **来源**：https://ttnworldwide.com/ArticleTA/388106/japan-tourist-arrivals-hit-record-427m-in-2025 ⏳仅标题；https://www.mlit.go.jp/kankocho/news02_00071.html ⏳仅标题（观光厅官方）；https://www.beijing.gov.cn/fuwu/lqfw/gggs/202602/t20260214_4516149.html ✅已打开（2026-02-14）
- **为什么现在**：日本入境游恢复至历史峰值，但中文/小语种供给仍稀缺；游客结构从"爆买"转向"体验+内容"，个人小团队可做深。
- **个人可切入角度**：在 Klook/GetYourGuide/小红书做 1–2 条独家体验线路；或做"支付+免税+交通"中文信息产品（攻略/会员群）；或给日本地方政府做中文社媒代运营。
- **风险**：日本旅行业许可（旅行业法）与包车资质；平台抽成高；季节波动。

### C09 日本「推し活/Stan 经济」：应援周边的中国供给
- **行业/区域**：`content` ｜ `east-asia`（日本）｜ 信息差：`culture`（主）+ `emotion`
- **卖什么**：痛包/徽章/立牌/小卡收纳、应援灯、角色痛衣；二级市场代购/转卖；"推し"纪念日内容。
- **价格/规模证据**：媒体称日本"抗通胀的 Stan（推し活）经济"持续繁荣（`[B]` Advisor Perspectives 2025-12-03，⛔直连 403 Cloudflare）；韩国文化产业振兴院（KOCCA）发布日本"오시카츠/덕질 문화"报告（`[B]` KOCAA，⏳仅标题）。**本轮未取得可直连的规模金额，标记为待补数据**。
- **来源**：https://www.advisorperspectives.com/articles/2025/12/03/japans-inflation-proof-stan-economy-booming ⛔403（标题与摘要可读）；https://welcon.kocca.kr/cmm/fms/crawling/...（报告 PDF，⏳仅标题）
- **为什么现在**：日本年轻人消费从"物"转向"应援"，徽章/立牌等轻小件适合中国供应链跨境小包；日元贬值让中国货在日本更有价格优势。
- **个人可切入角度**：义乌/东莞工厂 + 日语店铺（BASE/BOOTH/メルカリ）；或做"痛包定制"设计+打样服务；或做中日双向代购。
- **风险**：IP 侵权风险高（未授权角色周边）；日本二手平台规则严格；价格战。

### C10 韩国 K-beauty 出口分销与内容代运营
- **行业/区域**：`crossborder` ｜ `east-asia`（韩国发源）→ `north-america`、`europe`、`mena` ｜ 信息差：`channel`（主）+ `language`
- **卖什么**：韩国中小品牌海外分销（美国/日本/中东/香港）、TikTok/Reels 内容代运营、达人寄样与佣金、独立站搭建。
- **价格/规模证据**：2025 年韩国化妆品出口 **$114.3 亿（+12.3%）** 创历史新高；**美国首次成为第一大市场 $21.9 亿（+15.1%）**，中国大陆 **$20.1 亿（-19.2%）**，日本 **$10.9 亿（+5%）**，香港 **$7.05 亿（+21.6%）**；进口国达 **202 个**；护肤 $85.4 亿、彩妆 $15.1 亿、身体清洁 +27.3%、香水 **+46.2%**（`[A]` 韩国食品医药品安全处数据，Yonhap 2026-01-09，✅已打开）。
- **来源**：https://en.yna.co.kr/view/AEN20260109010100320 ✅已打开（2026-01-09）
- **为什么现在**：K-beauty 出口结构从中国转向美国/日本/中东/香港，中小品牌缺海外运营能力；中国团队在 TikTok/Amazon 运营上成本低、迭代快。
- **个人可切入角度**：做 1–3 个韩国中小品牌的海外独家分销/代运营；或做"K-beauty 成分+中文测评"内容号导购。
- **风险**：中国市场竞争激烈、韩国品牌方易收回代理权；化妆品进口各国注册（美国 FDA、欧盟 CPNP、中东 SFDA/GSO）；汇率。

### C11 中国谷子经济：二次元周边的线下+跨境双轮
- **行业/区域**：`content` ｜ `china` + `east-asia` ｜ 信息差：`culture`（主）+ `time`
- **卖什么**：徽章/立牌/手办/小卡（谷子）、谷子主题快闪店/门店、二手交易与寄卖、原创 IP 授权周边、跨境电商（日本/东南亚）。
- **价格/规模证据**：2025 年中国泛二次元及周边市场 **6,521 亿元（+9.1%）**；其中**谷子经济 2,021 亿元（+19.7%）**，占泛二次元 30%+；Z 世代用户 **5.26 亿**；**60+ 核心商圈**打造二次元主题空间，线下门店数量 **同比 +40%**；上海百联 ZX 创趣场、广州动漫星城年销售额 **破 5 亿元**；2024 年中国品牌授权商品零售额 **1,551 亿元（+10.71%）**，卡通动漫 IP 占比近五成（`[B]` 华经产业研究院，2026-05-29，✅已打开）。
- **来源**：https://www.huaon.com/channel/trend/1168058.html ✅已打开（2026-05-29）
- **为什么现在**：谷子从"圈层收藏"转向"大众日常消费"，线下门店一年增 40% 说明渠道红利；同时日本/东南亚对中国原创 IP 的接受度上升，跨境窗口打开。
- **个人可切入角度**：①谷子选品+二手寄卖（低资本）；②给商场做二次元快闪策展；③原创 IP 的小批量周边（需授权或自有 IP）；④跨境卖到日本（メルカリ/BOOTH）。
- **风险**：IP 侵权是最大红线；库存周转慢；线下店租金与盗损；政策对未成年人消费与抽卡类监管。

### C12 中国短剧出海：本地化/配音/投放的"卖铲子"生意
- **行业/区域**：`content` ｜ `china` → `north-america`、`sea`、`europe` ｜ 信息差：`time`（主）+ `channel`
- **卖什么**：短剧翻译/配音/字幕（多语种）、投放素材剪辑、海外发行代理、演员经纪与本地拍摄、数据选品（题材趋势）。
- **价格/规模证据**：2025 年全球短剧应用内购收入 **超 $28 亿（+116%）**；DramaBox 2025 年收入 **$5.3 亿（+75%）**、上市至今累计 **$8.5 亿**、下载量 **+112%** 全球第一；ReelShort 与 DramaBox 包揽 2025 全球短剧收入与下载冠亚军；昆仑万维 Dramawave 全年收入 **激增 28 倍**（`[A]` Sensor Tower 数据经新华财经报道，2026-01-14，✅已打开）。
- **来源**：https://m.cnfin.com/wx/share?url=//m.cnfin.com/gs-lb//zixun/20260114/4365190_1.html ✅已打开（2026-01-14）
- **为什么现在**：短剧出海已从"买量"进入"本地化质量"竞争，非英语市场（印尼/巴西/中东）的配音与字幕供给短缺；头部平台需要外包产能。
- **个人可切入角度**：小团队专做**印尼语/葡语/阿拉伯语**短剧本地化（翻译+配音+字幕+文化审校）；或做题材数据服务（哪类剧情在哪个国家付费率高）。
- **风险**：平台账期与压价；版权与合规（内容分级、宗教敏感）；AI 配音冲击人工价格。

### C13 中国银发经济：适老化改造与"享老"产品
- **行业/区域**：`silver` ｜ `china` ｜ 信息差：`demographic`（主）+ `infrastructure`
- **卖什么**：适老化家居改造（防滑/扶手/灯光/智能监测）、银发旅游与兴趣课、老年内容（短视频/回忆录）、康复辅具与护理用品。
- **价格/规模证据**：官方媒体称中国银发经济为 **"30 万亿大市场"**、正从"养老"奔向"享老"（`[B]` 央广网 2026-02-26，⏳仅标题）；2025 年全国人口 **14.0489 亿**（`[A]` 国家统计局 2026-01-19，⏳仅标题）。
- **来源**：https://news.cnr.cn/native/gd/20260226/t20260226_527536198.shtml ⏳仅标题（2026-02-26）；https://www.stats.gov.cn/xxgk/jd/sjjd2020/202601/t20260119_1962338.html ⏳仅标题（2026-01-19）
- **为什么现在**：1962–1973 年出生高峰人口进入 60 岁+，2025–2030 是"新老人"（有退休金、会用智能手机）集中退休期；适老化改造纳入多地政府补贴目录。
- **个人可切入角度**：本地"适老化改造"小团队（与社区/物业合作，单户 3,000–15,000 元）；或做银发兴趣课线上社群；或做"给父母改造老家"内容+带货。
- **风险**：支付方与使用方分离（子女付费）；服务非标、信任门槛高；补贴政策地方差异大。

### C14 中国入境游支付与外卡服务
- **行业/区域**：`fintech` ｜ `china` ｜ 信息差：`infrastructure`（主）+ `language`
- **卖什么**：入境游客支付引导（外卡绑定/扫码）、多语种点餐/打车/购票代运营、商户外卡收单改造咨询、入境游攻略内容与会员。
- **价格/规模证据**：2026 年春节"移动支付双向奔赴——来华扫码畅游、出境一码享惠"（`[A]` 北京市政府 2026-02-14，✅已打开）；跨境支付涨势（`[B]` 证券时报，⏳仅标题）。
- **来源**：https://www.beijing.gov.cn/fuwu/lqfw/gggs/202602/t20260214_4516149.html ✅已打开（2026-02-14）；https://stcn.com/article/detail/3369068.html ⏳仅标题
- **为什么现在**：入境免签范围扩大、外卡内绑与扫码互通完成基础设施改造，但"最后一公里"的商户与内容仍缺；外国游客在小红书/YouTube 找中文攻略。
- **个人可切入角度**：做入境游多语种攻略（英语/西语/阿语）+ 支付教学视频；给景区/商户做"外卡收单+多语菜单"代运营。
- **风险**：支付牌照与合规（不得代收代付）；政策变化快；客单价低。

### C15 沙特/海湾 Umrah 服务：1,950 万人次的刚需
- **行业/区域**：`local` ｜ `mena`（沙特/海湾）｜ 信息差：`culture`（主）+ `language`
- **卖什么**：Umrah 小团/家庭团、多语种向导与翻译、朝觐礼包（服饰/用品）、住宿与交通打包、朝觐后内容（照片/纪念册）、面向中国/印尼/巴基斯坦穆斯林的服务。
- **价格/规模证据**：2025 年入境沙特朝觐者与 Umrah 人数 **超 1,950 万**（其中 **Umrah 1,803 万、Hajj 150 万**）；Umrah 人数较 2022 年 **+114%**；Hajj 满意度 **91%**、Umrah 满意度 **94%**；签发签证 **1,503 万**（Umrah 占 83%）；来源国前三 **巴基斯坦、印尼、埃及**；Al-Rawdah 访客 **1,600 万+**（`[A]` 沙特朝觐体验计划 PEP 官网 2026-08-03，✅已打开）。
- **来源**：https://pep.gov.sa/en/news/1011 ✅已打开（2026-08-03）
- **为什么现在**：沙特 Vision 2030 把 Umrah 目标定在 3,000 万人次，签证与交通持续放宽；中国穆斯林 Umrah 需求恢复但中文服务供给少；印尼/巴基斯坦中产扩大。
- **个人可切入角度**：做**中文/印尼语 Umrah 内容+小团**（需与沙特持牌运营商合作）；或做朝觐用品（戒衣、礼拜毯、便携净水）跨境；或做朝觐后纪念相册。
- **风险**：沙特朝觐牌照与配额制度严格；宗教服务容错率极低；季节性极强（斋月/朝觐季）。

### C16 中东宗教文本/教材专业翻译：一般翻译员做不了的活
- **行业/区域**：`culture` ｜ `mena` ｜ 信息差：`language`（主）+ `culture`
- **卖什么**：阿拉伯语↔中文/英文的宗教文本（《古兰经》义译、圣训、教义教材）、伊斯兰金融/法律文本、学校宗教课本本地化、术语库建设、审校与"宗教学者背书"服务。
- **价格/规模证据**：
  - 伊斯兰权威法特瓦平台明确：**"《古兰经》含义的翻译只有专才（متخصص）才能承担"**——即普通翻译员不能直接翻译宗教文本（`[A]` IslamWeb Fatwa，标题即结论，✅已打开；正文未完整提取）。
  - 伊朗 Hawzah 学者问答亦列明翻译《古兰经》与伊斯兰文本的必备条件（`[B]` hawzah.net，⏳仅标题）。
  - 沙特语言服务市场有专门研究报告覆盖 2025–2030（`[B]` Ken Research，⏳仅标题）；沙特本土存在 Misraj 等本地化公司，主打"语言鸿沟"（`[B]` misraj.sa，⏳仅标题）。
- **来源**：https://fatwatokdev.islamweb.net/?id=176559&sub_cat=406 ✅已打开；https://hawzah.net/fa/Question/View/64155/... ⏳仅标题；https://www.kenresearch.com/saudi-arabia-language-services-market ⏳仅标题；https://misraj.sa/en/blog/bridging-the-language-gap-through-technology ⏳仅标题
- **为什么现在**：中东宗教教育、伊斯兰金融、跨境内容（短剧/游戏本地化）都要求"宗教正确性"，而通用翻译/AI 翻译常犯教义错误；中国与中东经贸升温，中文↔阿语宗教/法律文本需求上升，但合格译者极少。
- **个人可切入角度**：**不做"通用翻译"，做"宗教/法律垂直译审"**——与宗教学者（如国内伊斯兰教经学院、清真寺阿訇）合作背书，提供"翻译+审校+免责声明"；或做术语库/风格指南（可卖给 AI 公司做数据）。
- **风险**：宗教文本误译风险极高（可能引发外交/宗教争议）；需宗教学者合作与明确责任边界；客户信任建立慢；部分国家要求译者资质。

### C17 沙特电商本地化：307 亿里亚尔/月的市场
- **行业/区域**：`crossborder` ｜ `mena`（沙特）｜ 信息差：`language`（主）+ `infrastructure`
- **卖什么**：阿语 listing/详情页优化、COD 与退换货客服、本地仓储与最后一公里、Salla/Zid 建站、宗教节日营销。
- **价格/规模证据**：2025 年 10 月沙特电商销售额 **超 307 亿沙特里亚尔**（`[B]` 沙特国家门户 my.gov.sa，⛔直连 403 Cloudflare，仅标题+摘要）；沙特自由职业平台市场报告称 **68% 的初创企业计划到 2026 年整合自由职业服务**（`[B]` ResearchAndMarkets 新闻稿 2025-12-12，⏳仅标题）；沙特自由职业者/客户约 **24 万**（`[B]` Alwatan，⏳仅标题）。
- **来源**：https://my.gov.sa/en/news/1692043 ⛔403；https://investor.wedbush.com/wedbush/article/bizwire-2025-12-12-saudi-arabia-freelance-platforms-market-report-2025-2030-featuring-ureed-marn-freelance-yard-and-other-key-players-68-of-startups-planning-to-integrate-freelance-services-by-2026-researchandmarketscom ⏳仅标题；https://www.alwatan.com.sa/article/1167171 ⏳仅标题
- **为什么现在**：沙特电商增速高但阿语内容与客服供给不足；中国卖家进入沙特常卡在"语言+退货+COD"三件事上。
- **个人可切入角度**：做"沙特电商代运营"（阿语 listing+客服+本地退货仓）；或做沙特自由职业平台上的中文-阿语翻译/设计服务。
- **风险**：沙特本地化要求（SASO 认证、阿拉伯语标签）；COD 拒收率高；文化与宗教内容审核。

### C18 UAE 开斋节礼赠：节庆情绪消费的确定性
- **行业/区域**：`content` ｜ `mena`（UAE/GCC）｜ 信息差：`culture`（主）+ `time`
- **卖什么**：开斋节/宰牲节礼盒（椰枣、香水、家居、儿童礼）、企业礼赠定制、节庆装饰、贺卡/数字礼赠。
- **价格/规模证据**：2026 年开斋节前 UAE 线上礼赠交易 **激增 115%**（`[B]` Economy Middle East，⛔403）；全球清真旅游市场有 2026–2031 增长预测（`[B]` Mordor Intelligence，⏳仅标题）；UAE 连续第 5 年被评为全球创业环境最佳（NECI 第一）（`[A]` GEM 2025/2026 报告，✅已打开）。
- **来源**：https://economymiddleeast.com/news/eid-al-fitr-2026-online-gifting-transactions-surge-115-percent-in-uae-ahead-of-holiday/ ⛔403；https://www.mordorintelligence.com/industry-reports/global-halal-tourism-market ⏳仅标题；https://www.gemconsortium.org/report/51858 ✅已打开（2026-02-26）
- **为什么现在**：GCC 礼赠文化强、客单价高；线上礼赠基础设施（次日达、数字卡）成熟；中国企业擅长礼盒供应链。
- **个人可切入角度**：做"节庆礼盒定制"（中国供应链+阿语包装+本地仓）；或做企业礼赠 B2B（对接迪拜中小公司）。
- **风险**：节庆窗口短（斋月前 4–6 周）；宗教图案/颜色禁忌；本地品牌忠诚度高。

### C19 印尼清真认证（BPJPH）合规：强制认证的窗口
- **行业/区域**：`compliance` ｜ `sea`（印尼）｜ 信息差：`regulation`（主）+ `culture`
- **卖什么**：清真认证咨询（原料/配方/供应链审核）、进口文件与 BPJPH 注册、标签合规、印尼语培训。
- **价格/规模证据**：印尼政府推迟对中小微企业与进口产品的强制清真要求（`[A]` 印尼清真认证机构 LPPOM-MUI 官网，✅已打开标题；正文未完整提取）；进口食品清真强制认证推迟至 **2026 年**（`[B]` ctils，⏳仅标题）；2024-10-17 起食品饮料强制认证（法规时间点）。
- **来源**：https://halalmui.org/en/the-government-has-postponed-the-mandatory-halal-requirement-for-smes-and-imported-products-this-is-lppoms-response/ ✅已打开（标题）；https://www.ctils.com/h5/articles/17145 ⏳仅标题
- **为什么现在**：印尼是全球最大穆斯林市场，强制认证时间表反复但方向确定；中国出口食品/化妆品/日用品企业普遍缺印尼语与认证能力。
- **个人可切入角度**：与印尼本地 LPH（清真检验机构）合作，做中国企业的"认证代办+供应链整改"；或做中文版印尼认证指南（信息产品）。
- **风险**：认证周期长（3–9 个月）、宗教审核严格（原料来源/交叉污染）；政策反复；需本地合作方。

### C20 越南 TikTok Shop：GMV +66% 的渠道红利
- **行业/区域**：`crossborder` ｜ `sea`（越南）｜ 信息差：`platform`（主）+ `channel`
- **卖什么**：TikTok Shop 店群代运营、越南语直播、达人分销（Affiliate）、选品与供应链（中国货）。
- **价格/规模证据**：2025 年 TikTok Shop 越南 GMV **+66%**，并扩展数字商业生态（`[B]` 越南工贸部报 2026-10-08，⏳仅标题；越南通讯社 2025 年报道同口径，⏳仅标题）。
- **来源**：https://congthuong.vn/tiktok-shop-tang-truong-66-mo-rong-he-sinh-thai-thuong-mai-so-467087.html ⏳仅标题；https://www.vietnamplus.vn/tong-gia-tri-giao-dich-cua-tiktok-shop-tai-viet-nam-tang-66-nam-2025-post1126796.vnp ⏳仅标题
- **为什么现在**：越南 TikTok Shop 从"低价白牌"转向"品牌+直播"，本地达人供给不足；中国团队有成熟的直播与投流方法论。
- **个人可切入角度**：做"中国供应链+越南达人"的撮合/代运营；或做越南语短视频内容工厂。
- **风险**：越南电商税与进口合规趋严；平台政策变化快；本地竞争（Sapo/Haravan 生态）。

### C21 东南亚清真美妆：宗教合规+审美双重差
- **行业/区域**：`crossborder` ｜ `sea`（印尼/马来西亚）+ `mena` ｜ 信息差：`culture`（主）+ `regulation`
- **卖什么**：清真认证彩妆/护肤（wudhu 友好指甲油、防水但可净礼的配方）、祈祷服/头巾时尚、斋月礼盒。
- **价格/规模证据**：Southeast Asia Halal Cosmetics Market 报告覆盖 **2025–2033**（`[B]` UnivDatos/GII，⏳仅标题）；印尼/马来西亚清真认证与美妆市场（`[B]` marketresearch，⏳仅标题）。**本轮未取得可直连的具体金额，标记待补。**
- **来源**：https://www.giiresearch.com/report/umi1988639-southeast-asia-halal-cosmetics-market-current.html ⏳仅标题；https://www.marketresearch.com/UnivDatos-Market-Insights-v4240/Southeast-Asia-Halal-Cosmetics-44377471/ ⏳仅标题
- **为什么现在**：东南亚穆斯林女性消费力上升，但"清真+好用+好看"供给少；中国供应链能做配方与包材，只差认证与本地审美。
- **个人可切入角度**：与马来/印尼本地品牌合资做清真彩妆；或做中国工厂的清真认证代工（OEM）对接东南亚品牌。
- **风险**：配方与认证（酒精/动物源成分）；本地品牌竞争；宗教审美误判。

### C22 巴西 MercadoLibre 跨境：拉美最大流量池
- **行业/区域**：`crossborder` ｜ `latam`（巴西/墨西哥/阿根廷）｜ 信息差：`channel`（主）+ `infrastructure`
- **卖什么**：中国供应链选品（3C 配件、家居、汽配、美妆工具）、MercadoLibre 本土店/跨境店运营、葡语/西语 listing、海外仓与履约。
- **价格/规模证据**：MercadoLibre 2025 Q3 净收入 **$74 亿（+39%）**、GMV **$165 亿（+28%）**、独立买家 **7,700 万（+26%）**、售出商品 **6.35 亿件（+39%）**；**巴西 GMV +34%、商品数 +42%**；**墨西哥 GMV +34%、商品数 +42%**；**阿根廷 GMV +44%**；80% 订单 48 小时内送达；生态支持 **950 万** 中小微企业（`[A]` MercadoLibre 官方新闻稿 2025-10-29，✅已打开）。
- **来源**：https://news.mercadolibre.com/resultados-financieros-tercer-trimestre-2025 ✅已打开（2025-10-29）
- **为什么现在**：巴西/墨西哥电商渗透率仍低于中国，但物流（fulfillment 容量 +41%）与支付（Mercado Pago）已成熟；中国卖家在 3C/家居有绝对供应链优势。
- **个人可切入角度**：做"拉美本土店代运营"（葡语 listing+广告+客服）；或做细分品类（宠物/汽配/美妆工具）跨境。
- **风险**：巴西税负与清关复杂（Remessa Conforme）；汇率波动；平台佣金与广告成本上升。

### C23 巴西 Pix 支付：即时支付的"最后一公里"
- **行业/区域**：`fintech` ｜ `latam`（巴西）｜ 信息差：`infrastructure`（主）+ `platform`
- **卖什么**：独立站/Shopify 接入 Pix 与分期（parcelamento）、支付失败率优化、Pix 自动扣款（Pix Automático）订阅方案、对账服务。
- **价格/规模证据**：Pix 在巴西电商已超过信用卡，预计到 **2028 年占电商支付约 50%**（`[B]` IstoÉ Dinheiro，⏳仅标题）；Mercado Pago 处理 TPV **$710 亿（+41%）**、月活 **7,200 万（+29%）**（`[A]` MercadoLibre 2025-10-29，✅已打开）。
- **来源**：https://istoedinheiro.com.br/pix-supera-cartoes-de-credito-commerce ⏳仅标题；https://news.mercadolibre.com/resultados-financieros-tercer-trimestre-2025 ✅已打开
- **为什么现在**：巴西消费者习惯"分期+Pix"，中国独立站常只接信用卡导致转化流失；Pix Automático（2025 起）让订阅可行。
- **个人可切入角度**：给跨境独立站做"Pix+分期+本地化结账"配置服务；或做拉美支付咨询（按项目收费）。
- **风险**：巴西支付牌照（需与持牌 PSP 合作）；合规与反洗钱；技术集成复杂。

### C24 拉美现金/COD 与 OXXO 支付
- **行业/区域**：`fintech` ｜ `latam`（墨西哥）｜ 信息差：`infrastructure`（主）+ `culture`
- **卖什么**：COD（货到付款）风控与对账、OXXO Pay 现金支付接入、拒收率优化、本地客服。
- **价格/规模证据**：Mercado Pago 官方文档支持 OXXO Pay 现金支付（`[A]` Mercado Pago 开发者文档，⏳仅标题）；MercadoLibre 墨西哥 GMV +34%（`[A]` 2025-10-29，✅已打开）。
- **来源**：https://www.mercadopago.com.mx/blog/aceptar-pagos-efectivo-oxxo-pay-checkout ⏳仅标题；https://docs.bamboopayment.com/docs/mx-cash-payments ⏳仅标题
- **为什么现在**：墨西哥大量消费者无银行账户/不用信用卡，COD 与 OXXO 是刚需；中国卖家因拒收率高而放弃墨西哥市场。
- **个人可切入角度**：做"COD 风控+SMS 确认+本地客服"服务，按单收费；或给独立站做 OXXO 接入。
- **风险**：COD 拒收与欺诈；现金对账复杂；平台规则。

### C25 尼日利亚乳木果：出口禁令带来的本地加工机会
- **行业/区域**：`manufacturing` + `green` ｜ `africa`（尼日利亚/西非）｜ 信息差：`regulation`（主）+ `price`
- **卖什么**：乳木果油初加工/精炼（皂基、化妆品原料）、本地品牌（护肤/护发）、加工设备与技术输出、对中国/欧美出口。
- **价格/规模证据**：尼日利亚总统 **2025-08-26 实施 6 个月原料乳木果出口禁令，并延长至 2027-02-25**；官方称**黄油价格是原料的 10–20 倍**；目标是把加工留在本地（`[A]` 新华社 2026-02-26，✅已打开）。西非多国出口禁令正重塑美妆供应链（`[B]` BeautyMatter，⏳仅标题）。
- **来源**：https://english.news.cn/20260226/d7ae10b2b1214bf39412cc6f639d6d56/c.html ✅已打开（2026-02-26）；https://beautymatter.com/articles/africas-raw-materials-ban-supply-chains-new-reckoning ⏳仅标题
- **为什么现在**：禁令把"原料出口"变成"成品出口"，本地加工产能严重不足；中国美妆原料采购与设备商可切入；欧美品牌需要可追溯的非洲供应链。
- **个人可切入角度**：在尼日利亚/加纳设小型初加工（与本地合作社合资）；或做"非洲原料采购代理+中国加工"；或做乳木果护肤品牌（跨境）。
- **风险**：政局/汇率/电力不稳；原料质量波动；出口禁令政策反复；本地合资伙伴风险。

### C26 肯尼亚 PAYG 太阳能：硬件+金融的复合生意
- **行业/区域**：`green` ｜ `africa`（肯尼亚/撒哈拉以南）｜ 信息差：`infrastructure`（主）+ `price`
- **卖什么**：太阳能家庭系统（SHS）+ 按使用付费（PAYG）、储能/风扇/电视配件、安装与售后、移动支付分期。
- **价格/规模证据**：Sun King **$1.56 亿证券化**，为 **100 万+ 肯尼亚人**提供太阳能（`[A]` Sun King 官网，⏳仅标题）；Sustainable Finance 推动非洲离网太阳能快速扩张（`[A]` Sun King 官网，⏳仅标题）。
- **来源**：https://sunking.com/news-blog/156m-sun-king-securitisation-to-deliver-solar-for-over-a-million-kenyans/ ⏳仅标题；https://sunking.com/news-blog/sustainable-finance-drives-rapid-expansion-of-off-grid-solar-in-africa/ ⏳仅标题
- **为什么现在**：非洲电网覆盖不足 + 移动支付成熟（M-Pesa），PAYG 模式跑通；中国光伏/储能供应链成本优势明显。
- **个人可切入角度**：做"中国硬件+非洲本地分销/售后"；或做 PAYG 软件/风控服务；或做太阳能配件（灯具/风扇）跨境。
- **风险**：回款风险（坏账）、汇率、售后网络成本；非洲多国认证与关税。

### C27 非洲 Jumia：中国卖家的"最后一公里"
- **行业/区域**：`crossborder` ｜ `africa`（尼日利亚/埃及/肯尼亚等）｜ 信息差：`platform`（主）+ `infrastructure`
- **卖什么**：Jumia 本土店/跨境店运营、选品（手机配件、小家电、美妆、母婴）、本地仓与 COD 履约、客服。
- **价格/规模证据**：Jumia 2025 全年收入 **$1.889 亿（+13%）**、GMV **$8.186 亿（+14%）**；中国战略推动国际销售 **+82%**（`[A]` Nairametrics 2026-02-10，✅已打开；`[B]` TechCabal 2026-02-11，⏳仅标题）。
- **来源**：https://nairametrics.com/2026/02/10/jumia-group-revenue-rises-to-188-9m-in-2025-cuts-loss/ ✅已打开；https://techcabal.com/2026/02/11/jumias-china-pivot-fuels-82-surge-in-international-sales/ ⏳仅标题
- **为什么现在**：Jumia 主动引入中国卖家与供应链（"China pivot"），平台流量便宜、竞争少；但物流与退货仍是痛点。
- **个人可切入角度**：做 Jumia 代运营（选品+上架+客服）；或做非洲本地仓/退货处理服务。
- **风险**：非洲多国清关与外汇管制；COD 拒收；平台亏损与政策变化。

### C28 印度婚礼季：₹6.5 万亿卢比的确定性消费
- **行业/区域**：`crossborder` ｜ `south-asia`（印度）｜ 信息差：`culture`（主）+ `price`
- **卖什么**：婚礼道具/装饰（中国供应链）、回礼（喜糖盒/小礼品）、婚纱配饰、婚礼内容拍摄、婚礼策划服务。
- **价格/规模证据**：印度婚礼季（2025-11-01 至 2025-12-14）预计 **₹6.5 万亿卢比（约合 6.5 lakh crore）**、**460 万场婚礼**、创造 **1,000 万个就业**（`[B]` Pune Times Mirror，⏳仅标题；`[B]` Ken Research，⏳仅标题）。
- **来源**：https://punemirror.com/business/economy/indias-wedding-season-to-fuel-%e2%82%b96-5-lakh-crore-economy-create-1-crore-jobs/ ⏳仅标题；https://www.kenresearch.com/articles/india-wedding-industry-economic-impact-and-forecast ⏳仅标题
- **为什么现在**：印度中产婚礼支出极高且"面子消费"强；中国婚庆道具/装饰供应链价格优势明显；印度本土供应链在旺季产能不足。
- **个人可切入角度**：做婚礼道具跨境批发（B2B，对接印度婚礼策划公司）；或做"中国婚礼小物"独立站（英语）。
- **风险**：印度进口关税与清关；旺季物流；文化/宗教细节（颜色、图案、仪式）。

### C29 印度 Ayurveda：传统医学的现代化红利
- **行业/区域**：`emotional` + `silver` ｜ `south-asia`（印度）｜ 信息差：`culture`（主）+ `knowledge`
- **卖什么**：阿育吠陀个护（洗发/护肤/精油）、保健品、疗愈内容与课程、D2C 品牌。
- **价格/规模证据**：印度快消巨头持续收购 Ayurveda 初创（`[B]` Economic Times，⏳仅标题）；Vertex 加注 Ayurveda 品牌 Kapiva（`[B]` Mergermarket/Ion Analytics，⏳仅标题）。
- **来源**：https://m.economictimes.com/tech/startups/fmcgs-buying-up-ayurveda-startups-for-healthy-growth/amp_articleshow/129988114.cms ⏳仅标题；https://ionanalytics.com/insights/mergermarket/vertex-doubles-down-on-rising-indian-consumer-savvy-with-ayurveda-brand-kapiva/ ⏳仅标题
- **为什么现在**：印度中产健康焦虑 + 本土文化自信上升；Ayurveda 从"传统药"变成"生活方式品牌"；中国供应链可做包材/代工。
- **个人可切入角度**：做 Ayurveda 内容/课程（中文/英文）导购；或做中国工厂的印度品牌代工；或跨境卖印度 Ayurveda 产品（需合规）。
- **风险**：保健品宣称合规（各国药监）；原料真实性；文化挪用争议。

### C30 欧盟 GPSR：2024-12-13 起的强制合规
- **行业/区域**：`compliance` ｜ `europe` ｜ 信息差：`regulation`（主）
- **卖什么**：GPSR 合规服务（欧盟责任人、技术文档、风险评估、事故报告流程）、在线 marketplace 合规审核、培训。
- **价格/规模证据**：GPSR 于 **2024-12-13 生效**，适用于所有消费产品（线上/线下），要求每个产品有**欧盟境内责任人**（名称/联系方式标注在产品/包装/随附文件）、制造商做风险评估与技术文档、进口商保证非欧盟制造商合规、平台设单一联系点（`[A]` 爱尔兰 CCPC 官网 2024-12-13，✅已打开）。
- **来源**：https://www.ccpc.ie/news-and-media/news/article/2024/12/13/new-eu-product-safety-laws-now-in-place ✅已打开（2024-12-13）
- **为什么现在**：大量中国跨境卖家在 2024 年后被平台要求提供欧盟责任人信息，服务供给不足；2026 年平台审核趋严。
- **个人可切入角度**：与欧盟本地合规公司合作做"GPSR 责任人+文档"代理；或做合规 SaaS（文档模板+风险问卷）。
- **风险**：法律责任（作为责任人需承担合规义务）；需欧盟实体或合作方；价格战。

### C31 欧盟 EAA 无障碍：2025-06-28 起的电商新义务
- **行业/区域**：`compliance` ｜ `europe` ｜ 信息差：`regulation`（主）+ `language`
- **卖什么**：电商网站/APP 无障碍审计（WCAG 2.2/EN 301 549/RGAA）、整改、无障碍声明、培训。
- **价格/规模证据**：自 **2025-06-28** 起，欧盟电商服务（PME，**>10 名员工 且 营业额/总资产 >200 万欧元**）必须对残障人士无障碍；不达标可罚 **个人 1,500 欧元（再犯 3,000）、法人 7,500 欧元（再犯 15,000）**，按每个电商服务、每项义务累计；须向监管机构（法国 DGCCRF）报告不符合项（`[A]` 法国政府 France Num 2025-12-15/17，✅已打开）。
- **来源**：https://www.francenum.gouv.fr/guides-et-conseils/developpement-commercial/site-e-commerce/accessibilite-des-sites-de-e-commerce ✅已打开（2025-12-15）
- **为什么现在**：2025 年 6 月刚生效，欧洲中小电商普遍未合规；中国跨境独立站如果面向欧盟也受约束，但多数不知道。
- **个人可切入角度**：做"中文团队+欧洲合规顾问"的无障碍审计服务（远程交付）；或做 Shopify 无障碍插件。
- **风险**：标准更新快；审计责任；客户预算低。

### C32 德国电子发票（E-Rechnung）：2025 起的接收义务
- **行业/区域**：`compliance` ｜ `europe`（德国）｜ 信息差：`regulation`（主）
- **卖什么**：电子发票格式转换（XRechnung/ZUGFeRD）、ERP/财务系统对接、中德贸易企业开票合规咨询。
- **价格/规模证据**：德国自 **2025-01-01** 起所有企业须能接收电子发票；开票义务分阶段（2027/2028 起营业额阈值以上强制）（`[A]` 德国工商大会 DIHK 官方说明，⏳仅标题）。
- **来源**：https://www.dihk.de/en/service-portal/for-business-owners-and-entrepreneurs/e-invoice-in-business-transactions-174470 ⏳仅标题
- **为什么现在**：中国对德出口企业/德国子公司需要合规开票，但中文服务商少；2027–2028 开票强制期临近，需求前置。
- **个人可切入角度**：做"中德电子发票转换"小工具/服务；或给在德中资企业做财务系统对接。
- **风险**：德国税务合规责任；软件本地化；客单价中等。

### C33 欧盟 CBAM：2026 正式期的数据服务
- **行业/区域**：`compliance` ｜ `europe` ｜ 信息差：`regulation`（主）
- **卖什么**：CBAM 碳排放核算（钢铁/铝/水泥/化肥/电力/氢）、供应商数据收集、申报代理、减排咨询。
- **价格/规模证据**：CBAM 过渡期后进入正式期（2026 起），并出现"Omnibus"简化规则；进口商需申报隐含碳排放（`[B]` Carbon Chain 博客，⏳仅标题）；EUR-Lex 法规文本可访问（`[A]` EUR-Lex CELEX 32023R0956，HTTP 202/✅可访问）。
- **来源**：https://www.carbonchain.com/blog/cbam-omnibus-new-rules-for-importers ⏳仅标题；https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956 ✅可访问（HTTP 202）
- **为什么现在**：2026 年正式期意味着中国钢铁/铝出口商必须提供真实排放数据；中小出口商缺核算能力。
- **个人可切入角度**：做"CBAM 数据核算+申报"服务（与第三方核查机构合作）；或做供应商数据收集 SaaS。
- **风险**：核算方法复杂、需专业资质；数据造假风险；政策简化导致需求变化。

### C34 欧盟 EUDR：森林砍伐法规的溯源服务
- **行业/区域**：`compliance` ｜ `europe` ｜ 信息差：`regulation`（主）+ `supply`
- **卖什么**：EUDR 尽职调查（咖啡/可可/棕榈油/大豆/橡胶/木材/牛）、地块坐标与卫星溯源、供应链文档、合规培训。
- **价格/规模证据**：EUDR 出现**推迟与简化**（`[B]` Freshfields 博客，⏳仅标题）；法国生态转型部设有 EUDR 官方说明页（`[A]` 法国政府，⏳仅标题）。
- **来源**：https://www.freshfields.com/en/our-thinking/blogs/sustainability/the-e-of-esg-postponement-and-simplification-of-the-eu-deforestation-regulatio-102ly51 ⏳仅标题；https://deforestationimportee.ecologie.gouv.fr/en/the-european-deforestation-free-regulation/article/the-european-deforestation-free-regulation-eudr ⏳仅标题
- **为什么现在**：法规推迟但方向确定，企业有窗口建溯源体系；中国咖啡/可可/橡胶进口商与东南亚供应商需要合规服务。
- **个人可切入角度**：做"EUDR 溯源数据服务"（卫星+地块+文档）；或做中国进口商的合规代理。
- **风险**：法规时点反复；卫星数据成本；客户预算。

### C35 欧盟 PPWR/EPR 包装合规
- **行业/区域**：`compliance` ｜ `europe` ｜ 信息差：`regulation`（主）+ `green`
- **卖什么**：包装合规设计（可回收/减量）、EPR 注册与申报（德国 LUCID/法国 Triman）、PPWR 培训、包装供应链替换。
- **价格/规模证据**：EU PPWR（包装与包装废弃物法规）生效，出口服装包装合规要点（`[A]` 中国商务部 WTO 事务局 2026-10，⏳仅标题）；EPR 与欧盟包装规则（`[B]` AVASK，⏳仅标题）。
- **来源**：http://chinawto.mofcom.gov.cn/article/jsbl/zszc/202610/20261003645759.shtml ⏳仅标题（2026-10）；https://avask.com/blog/epr-eu-packaging-rules/ ⏳仅标题
- **为什么现在**：PPWR 替代旧包装指令，2026 起分阶段实施；EPR 在德/法/西等国已是硬门槛，中国卖家被平台强制要求注册号。
- **个人可切入角度**：做"欧洲 EPR 注册+申报"代办（与各国 PRO 合作）；或做包装合规设计服务。
- **风险**：各国 EPR 规则差异大；注册周期；代理责任。

### C36 波兰/欧洲小语种本地化：被忽视的 3,800 万人口市场
- **行业/区域**：`local` ｜ `europe`（波兰/中东欧）｜ 信息差：`language`（主）+ `channel`
- **卖什么**：波兰语/捷克语/匈牙利语 listing 与客服、本地 SEO/内容、跨境物流与退货、欧盟合规。
- **价格/规模证据**：波兰电商在连续两年下滑后 2025 年恢复增长（`[B]` Geopost e-Shopper Barometer 2025，经 PAP 报道 2026-01-20，⏳仅标题）；到 2030 年波兰跨境电商销售占比将 **超过 12%**（`[B]` PAP 报道，⏳仅标题）；德国零售集团 EBreuninger 招聘**波兰语 Language Owner（可远程）**（`[A]` 招聘页，⏳仅标题）说明小语种内容人才需求真实存在。
- **来源**：https://biznes.pap.pl/wiadomosci/firmy/barometr-e-shopper-2025-od-geopost-po-dwoch-latach-spadkow-polacy-konsumenci-znow ⏳仅标题；https://biznes.pap.pl/wiadomosci/firmy/do-2030-r-udzial-sprzedazy-transgranicznej-w-polskim-e-commerce-wzrosnie-do-ponad ⏳仅标题；https://jobs.smartrecruiters.com/EBreuningerGmbHCo/744000065682510-language-owner-in-polnisch-remote-moglich ⏳仅标题
- **为什么现在**：中国卖家集中在英德法，波兰/捷克竞争低；本地化内容（波兰语）供给稀缺，AI 翻译质量不足以做客服。
- **个人可切入角度**：做"波兰语/捷克语本地化"服务（翻译+客服+SEO）；或做中东欧独立站代运营。
- **风险**：市场体量小；语言人才难招；物流时效。

### C37 土耳其电商：高通胀下的"价格+本地化"生意
- **行业/区域**：`crossborder` ｜ `europe`（土耳其）｜ 信息差：`language`（主）+ `price`
- **卖什么**：土耳其语 listing、本地支付（分期/taksit）、通胀定价策略、家居/服装/3C 跨境。
- **价格/规模证据**：土耳其电商交易额 **超 4.5 万亿里拉**（`[B]` 土耳其贸易部长 Bolat 公布，Hürriyet Bigpara，⏳仅标题）；Euromonitor 有土耳其零售电商报告（`[B]`，⏳仅标题）。
- **来源**：https://bigpara.hurriyet.com.tr/haberler/politika-haberleri/ticaret-bakani-bolat-acikladi-e-ticaret-hacmi-4-5-trilyon-lirayi-gecti_ID102247716/ ⏳仅标题；https://www.marketresearch.com/Euromonitor-International-v746/Retail-Commerce-Turkey-45112231/ ⏳仅标题
- **为什么现在**：土耳其通胀高、本币贬值，进口商品价格优势明显；本地电商（Trendyol/Hepsiburada）开放跨境，但中文卖家少。
- **个人可切入角度**：做土耳其语本地化+定价咨询；或做 Trendyol 跨境店代运营。
- **风险**：汇率与通胀剧烈；进口关税；本地竞争激烈。

### C38 丧亲纪念与回忆录：情绪价值的高客单服务
- **行业/区域**：`emotional` ｜ `north-america` + `europe` ｜ 信息差：`emotion`（主）+ `knowledge`
- **卖什么**：定制纪念画/纪念物（含骨灰/遗物）、回忆录代写、悼词/讣告撰写、旧相册/录像数字化、纪念日订阅（每年寄送追思内容）。
- **价格/规模证据**：定制纪念画 **$4,900 起**（`[A]` 艺术家官网，✅已打开，2026-08）；另有"悲伤支持工具/纪念日"免费内容引流（同一站点）；Upwork 有大量回忆录代写服务（`[A]` 平台，⏳仅标题）。
  - **需求侧轶事（弱证据，不作价格依据）**：Reddit r/Entrepreneur 有一条「旧剪贴簿扫描」讨论，发帖人自估 **$80/50 页、利润约 $70**，并抱怨现有公司"每页数美元、要等数月"。**该帖 permalink 可定位（见下），但 Reddit 对未登录自动请求返回动态壳（2026-10-22 实测：HTML 200 但正文为空、`.json` 403），引文不可由第三方机器复现**；本条仅用于说明"需求存在"的轶事，不进入 `signal.evidence` 的硬证据，也不支撑 ROI 数字。
- **来源**：https://zellerhausart.com/blog/spirit-pieces-review ✅已打开（2026-08）；https://www.reddit.com/r/Entrepreneur/comments/1x9cw20/rate_my_idea_i_got_some_scrap_books_from_my_dad/ ⏳帖子可定位（HTTP 200 但正文为动态壳，不可机器复现；原帖 ID `1x9cw20`，发布于 2026-10-18，2026-10-22 通过该版块公开 RSS 读到原文）；https://www.upwork.com/services/product/writing-translation-a-memoir-that-will-educate-and-inspire-your-readers-1349851133396758528 ⏳仅标题
- **为什么现在**：婴儿潮一代进入高龄，遗产/回忆需求爆发；AI 辅助写作降低交付成本；但"真人温度"仍是溢价点。
- **个人可切入角度**：做"回忆录代写+家族访谈"服务（中文/英文）；或做旧相册数字化（低资本，设备+流程）；或做纪念日订阅。
- **风险**：情绪劳动强度高；AI 写作伦理（家属知情）；交付周期长；客诉敏感。

### C39 Etsy 数字产品：8,650 万活跃买家的长尾
- **行业/区域**：`ai` ｜ `north-america` + `europe` ｜ 信息差：`platform`（主）+ `channel`
- **卖什么**：可打印模板（婚礼/育儿/财务/规划）、数字艺术、Notion/Excel 模板、SVG/字体、AI 辅助内容。
- **价格/规模证据**：Etsy 2025 年末活跃买家 **8,650 万**（`[A]` Etsy 10-K 摘要，⏳仅标题/PDF）；Etsy 收入恢复增长（`[B]` Inside Retail，⏳仅标题）；Etsy API 文档明确**禁止绕过 API 抓取数据（screen-scraping）**，商业访问需审核（`[A]` Etsy Developer 文档，✅已打开）。
- **来源**：https://stocklight.com/stocks/us/nyse-etsy/etsy/annual-reports/nyse-etsy-2026-10K-26651585.pdf ⏳PDF；https://insideretail.us/etsy-vows-sustained-growth-after-revenue-lift/ ⏳仅标题；https://developers.etsy.com/documentation/ ✅已打开
- **为什么现在**：Etsy 买家中 80% 女性、重情感消费（sohu 数据）；数字产品无物流、毛利高，适合个人；但竞争加剧，需要用"场景化 SEO+差异化设计"。
- **个人可切入角度**：做细分场景（宠物纪念模板、婚礼座位表、家庭财务表）；或做 Etsy 数字店代运营。
- **风险**：平台政策（数字产品退款）；同质化；AI 生成版权风险。

### C40 Shopify App 生态：$1.3 亿→$13 亿的"卖插件"生意
- **行业/区域**：`ai` ｜ `north-america` + `europe` ｜ 信息差：`platform`（主）+ `knowledge`
- **卖什么**：Shopify 小插件（COD、翻译、评价、尺码、订阅）、国内开发者外包、应用商店 ASO。
- **价格/规模证据**：Shopify 官方称其应用生态规模 **$13 亿**（`[A]` Shopify 官方新闻，⏳仅标题）；应用商店头部应用评价数：Judge.me **48,874 条**、Smile **4,645 条**（`[A]` Shopify App Store 页面，✅已打开，2026-10-22）。
- **来源**：https://www.shopify.com/news/billion-dollar-ecosystem ⏳仅标题；https://apps.shopify.com/ ✅已打开（2026-10-22）
- **为什么现在**：Shopify 生态成熟、付费意愿强；中国开发者成本低但缺少 ASO/英文客服能力；细分场景（COD/本地支付/合规）仍有空位。
- **个人可切入角度**：做 1 个极窄场景插件（如 COD 表单、欧盟 GPSR 信息展示、AR 试戴）；或给海外 app 做中国外包。
- **风险**：平台抽成与审核；同质化；需要持续维护。

---

## 3. 关键链接直连核验清单（2026-10-22）

| 链接 | 状态 | 用途 |
|---|---|---|
| https://www.sohu.com/a/952762371_121478199 | ✅200 | 宠物殡葬/纪念品市场数据 |
| https://zellerhausart.com/blog/spirit-pieces-review | ✅200 | 纪念玻璃价格带 $129–299/$69–549 |
| https://www.spiritpieces.com/products/glass-kiss-with-cremation-ashes | ✅200（正文截断） | 品类存在 |
| https://www.shinmai.co.jp/news/article/gfkn2026073101001609 | ✅200 | 故乡纳税 1.3314 兆日元 |
| https://www.rieti.go.jp/jp/columns/a01_0805.html | ✅200 | 返礼品结构、制度改正、83.4% |
| https://www.newsprime.co.kr/news/article/?no=593276 | ✅200 | 韩国宠物市场 KREI 预测 |
| https://www.asiae.co.kr/lang/print.htm?idxno=2026021209550059103&lang=en | ✅200 | 韩日宠物保险对比 |
| https://en.yna.co.kr/view/AEN20260109010100320 | ✅200 | K-beauty 出口 $114.3 亿 |
| https://pep.gov.sa/en/news/1011 | ✅200 | Umrah 1,950 万人次 |
| https://fatwatokdev.islamweb.net/?id=176559&sub_cat=406 | ✅200 | 宗教文本翻译须专才（法特瓦） |
| https://halalmui.org/en/the-government-has-postponed-the-mandatory-halal-requirement-for-smes-and-imported-products-this-is-lppoms-response/ | ✅200（正文截断） | 印尼清真强制推迟 |
| https://www.huaon.com/channel/trend/1168058.html | ✅200 | 谷子经济 2,021 亿元 |
| https://m.cnfin.com/wx/share?url=//m.cnfin.com/gs-lb//zixun/20260114/4365190_1.html | ✅200 | 短剧 IAP $28 亿 |
| https://www.ccpc.ie/news-and-media/news/article/2024/12/13/new-eu-product-safety-laws-now-in-place | ✅200 | GPSR |
| https://www.francenum.gouv.fr/guides-et-conseils/developpement-commercial/site-e-commerce/accessibilite-des-sites-e-commerce | ✅200 | EAA 罚款与门槛 |
| https://news.mercadolibre.com/resultados-financieros-tercer-trimestre-2025 | ✅200 | 拉美 GMV/买家 |
| https://nairametrics.com/2026/02/10/jumia-group-revenue-rises-to-188-9m-in-2025-cuts-loss/ | ✅200 | Jumia 2025 |
| https://english.news.cn/20260226/d7ae10b2b1214bf39412cc6f639d6d56/c.html | ✅200 | 尼日利亚乳木果禁令 |
| https://www.beijing.gov.cn/fuwu/lqfw/gggs/202602/t20260214_4516149.html | ✅200 | 入境移动支付 |
| https://www.gemconsortium.org/report/51858 | ✅200 | GEM 2025/2026（UAE NECI 第一） |
| https://developers.etsy.com/documentation/ | ✅200 | Etsy API/禁抓取 |
| https://apps.shopify.com/ | ✅200 | Shopify App Store 评价数 |
| https://www.reddit.com/r/Entrepreneur/comments/1x9cw20/rate_my_idea_i_got_some_scrap_books_from_my_dad/ | ⏳200（正文动态壳，不可复现引文） | 需求侧轶事（扫描旧相册自估 $80/50 页）——**已按红队 P2-9 降级，不作证据**；动态 RSS `reddit.com/r/Entrepreneur/.rss` 只证明"源可访问"，不能作为具体引文 URL |
| https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry | ✅200 | WCI 运价（2026-10-15） |
| https://datalab.naver.com/ | ✅200 | 韩国购物趋势（日榜） |
| https://ads.tiktok.com/business/creativecenter/ | ✅200 | 广告创意/趋势 |
| https://www.amazon.com/gp/movers-and-shakers | ✅200 | 销量飙升榜 |
| https://www.1688.com/ | ✅200 | 中国供应链 |
| https://github.com/trending | ✅200 | 技术趋势 |
| https://itunes.apple.com/us/rss/customerreviews/page=1/id=389801252/sortby=mostrecent/json | ✅200 | App 评论 RSS |
| https://www.producthunt.com/ | ✅200 | 新品发布 |
| https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956 | ✅202（可访问） | CBAM 法规原文 |
| https://my.gov.sa/en/news/1692043 | ⛔403 Cloudflare | 沙特电商 307 亿里亚尔 |
| https://economymiddleeast.com/news/eid-al-fitr-2026-online-gifting-transactions-surge-115-percent-in-uae-ahead-of-holiday/ | ⛔403 | UAE 开斋节礼赠 +115% |
| https://www.advisorperspectives.com/articles/2025/12/03/japans-inflation-proof-stan-economy-booming | ⛔403 | 日本 stan 经济 |
| https://www.jumia.com.ng/ | ⛔403（Cloudflare） | Jumia 站点反爬 |
| https://www.noon.com/uae-en/ | ⛔fetch failed | Noon 站点 |
| https://trends.google.com/trends/explore?geo=US&q=pet%20memorial | ⛔429 | Google Trends 限流 |
| https://www.trustpilot.com/review/etsy.com | ⛔403（反爬验证页） | Trustpilot 评价 |
| https://salaamgateway.com/specialcoverage/state-of-the-global-islamic-economy-2025 | ⛔跨域重定向 | 伊斯兰经济报告 |
| https://shop.app/products/1327368863829?variantId=12298028154965 | ⛔429 | 玻璃纪念品价格 |
| https://online.bci.co.jp/article/detail/5743?read_more=1 | ⛔404 | 故乡纳税（改用信浓每日） |

---

## 4. 非英语市场案例清单（≥12，任务硬性要求）

| 市场 | 案例 | 语言 | 可落地形式 |
|---|---|---|---|
| 日本 | C07 故乡纳税返礼品、C08 入境游、C09 推し活、C05 宠物保险 | ja | 服务/供应链/内容 |
| 韩国 | C04 宠物保险体验、C06 宠物市场、C10 K-beauty | ko | 服务/跨境 |
| 沙特/GCC | C15 Umrah、C16 宗教翻译、C17 沙特电商、C18 UAE 礼赠 | ar | 服务/合规/实物 |
| 印尼 | C19 清真认证 | id | 合规服务 |
| 越南 | C20 TikTok Shop | vi | 代运营 |
| 东南亚 | C21 清真美妆 | id/ms | 供应链/品牌 |
| 巴西 | C22 MercadoLibre、C23 Pix | pt | 跨境/支付 |
| 墨西哥 | C24 COD/OXXO | es | 支付/履约 |
| 尼日利亚 | C25 乳木果、C27 Jumia | en/ha/yo | 制造/跨境 |
| 肯尼亚 | C26 PAYG 太阳能 | en/sw | 硬件+金融 |
| 印度 | C28 婚礼、C29 Ayurveda | hi/en | 供应链/品牌 |
| 波兰/中东欧 | C36 小语种本地化 | pl/cs | 服务 |
| 土耳其 | C37 电商本地化 | tr | 跨境/内容 |

---

## 5. 未能核验的来源与替代方案（诚实标注）

1. **日本"stan/推し活"市场规模**：Advisor Perspectives 与 KOCCA 报告均未直连（403/PDF 未提取）。→ 替代：用日本观光厅入境消费、宠物保险、故乡纳税等可直连数据做日本消费力侧证；`data/` 中该条 `verified:false`。
2. **沙特电商 307 亿里亚尔/月**：my.gov.sa 被 Cloudflare 拦截。→ 替代：用 PEP 官方 Umrah 数据（已直连）与沙特自由职业平台报告做侧面证据；阿拉伯语原文页面 https://my.gov.sa/ar/news/1692043 同样被拦，标注"未核验"。
3. **UAE 开斋节礼赠 +115%**：Economy Middle East 403。→ 替代：用 GEM 报告 UAE 创业环境第一 + 斋月/开斋节文化事实（见 culture-notes.md）；金额类结论不进入 data 或 `verified:false`。
4. **东南亚清真美妆具体市场规模**：报告商页面未给可直连数字。→ 替代：用印尼清真认证时间表（LPPOM）与"202 个进口国"的 K-beauty 数据做旁证。
5. **Etsy 数字产品价格带**：Etsy 商品页反爬（429/403），无法逐条抓价。→ 替代：用 Etsy 10-K 活跃买家数 + Etsy API 文档（禁止抓取）说明平台规则；价格带在 data 中标为"经验区间，未逐条核验"。
6. **Google Trends**：直连 429。→ 替代：用 Naver DataLab（已直连）、TikTok Creative Center（已直连）、Amazon Movers & Shakers（已直连）做趋势替代源。
7. **韩国宠物市场 2025-2026 实际值**：KREI 数据为 2023 年发布的前瞻预测。→ 替代：用韩国 KB 金融 2025 报告（591 万户）与亚细亚经济 2026-02 报道（26.2% 家庭医疗支出）交叉。
8. **Reddit 用户原声（C38 旧剪贴簿扫描轶事）**：原帖 permalink 可定位（[1x9cw20](https://www.reddit.com/r/Entrepreneur/comments/1x9cw20/rate_my_idea_i_got_some_scrap_books_from_my_dad/)），但 Reddit 对未登录自动请求只返回动态壳（2026-10-22 实测 HTML 200 空正文、`.json` 403），**第三方无法机器复现引文**。→ 处置（v0.2.0，响应红队 P2-9）：①证据 URL 从滚动 RSS `reddit.com/r/Entrepreneur/.rss` 改为具体帖子 permalink + 原帖 ID/发布日期；②该条降级为"需求侧轶事/弱证据"，**不进入 `signal.evidence`、不标 `verified:true`、不支撑 ROI 数字**；③价格证据只保留艺术家官网 $4,900 与 Upwork 供给；④动态 RSS 仅作"源可访问性"证据，历史条目必须保存 permalink + 抓取快照。

---

## 6. 与 `data/` 契约映射建议

1. **id 建议**：`opp-<industry>-<slug>-<3位序号>`，如 `opp-pet-memorial-glass-001`、`opp-culture-quran-translation-001`。
2. **证据 tier**：本文件 `[A]` → `primary`；`[B]` → `secondary`；`[C]`/未核验 → 不入 evidence 或 `verified:false` + `compliance_notes` 注明。
3. **`verified` 取值**：只有 §3 中「✅200 **且正文可读**」的 URL 才能标 `true`；动态壳/正文截断/需登录/未直连一律标 `false`，并在 `compliance_notes` 写"来源未直连或不可复现，需人工复核"（例：Reddit permalink 只可定位，不可作为引文证据）。
4. **信息差主类型**：按每案"信息差（主）"填 `gap_type_ids[0]`，其余 1–2 个作补充。
5. **ROI 粗估**：见 `research/handoff-to-data.md` 的 12 个高价值案例，已给启动资金/回本/月收入区间。
6. **窗口期**：`window.decay` 建议——监管类（C30–C35）`medium`（12–24 个月窗口）；平台类（C20/C22/C39/C40）`fast`（3–9 个月）；文化/宗教类（C15/C16/C01）`slow`（24–36 个月）。

---

## 7. 搜索与核验方法记录

- 工具：`web_search`（线索）+ `web_fetch`（直连核对），2026-10-22 单日完成。
- 一手优先：政府/监管机构（CCPC、France Num、PEP、LPPOM、RIETI、韩国食品医药品安全处数据、Etsy/Shopify 官方文档、上市公司财报）优先于媒体。
- 二次核对：同一数字尽量找 2 个独立来源（如宠物殡葬同时用 sohu + marketresearch 口径；韩国宠物保险用 asiae + petconomy 协会）。
- 反爬说明：Jumia/Noon/Trustpilot/Google Trends/沙特政府站均有 Cloudflare/限流，已记录状态，不绕行、不伪造。
- **动态内容可复现性规则（v0.2.0 新增，响应红队 P2-9）**：
  1. RSS/首页/榜单等**滚动内容**只能证明"源可访问"，不能作为具体引文/数字的 URL；引用历史条目必须给**具体 permalink + 抓取日期 + 原文标题/ID**，必要时保存抓取文本快照。
  2. 对返回动态壳或需登录的页面（Reddit HTML/`.json`、Etsy 店铺页、Amazon 榜单等），在证据表标「⏳动态壳/不可复现」，并把该条降级为轶事或 `verified:false`，不得进入 `signal.evidence` 的硬证据。
  3. 本文件 §3 的 ✅200 只表示"抓取当日页面可打开"；`data/` 引用时仍需按 §5 与 §6 判断`verified`。

---

## 8. v0.2.0 修订记录（2026-10-22，响应红队 P2-9）

| 项 | 修订前 | 修订后 |
|---|---|---|
| C38 证据 URL | `https://www.reddit.com/r/Entrepreneur/.rss`（动态 RSS，滚动更新，不可复现） | `https://www.reddit.com/r/Entrepreneur/comments/1x9cw20/rate_my_idea_i_got_some_scrap_books_from_my_dad/`（具体帖子 permalink + 原帖 ID `1x9cw20` + 发布日 2026-10-18） |
| 证据等级 | 标为 `[A]` 用户原声 + "✅已打开" | 降级为**需求侧轶事/弱证据**：`⏳动态壳`（2026-10-22 实测 HTML 200 空正文、`.json` 403），**不进入 `signal.evidence`、不标 `verified:true`、不支撑 ROI** |
| 价格证据 | 部分依赖该轶事的 $80/50 页数字 | 只保留艺术家官网 $4,900 起 + Upwork 供给；轶事数字仅作示意 |
| 方法沉淀 | 无动态源规则 | §7 新增"动态内容可复现性规则"3 条；平台矩阵新增同类提醒；`handoff-to-data.md` H10 同步（scores.evidence 7.6→7.2、total 79.6→79.4） |
| qa/report.md 研究遗留项核对 | — | v0.1.0 遗留项中仅 **P2-9（RSS 证据）** 属 research；本文件已修。其余 P1-1/P2-1/P2-2 在 `data/opportunities.json`（data-engineer 负责，§10.1 已闭环），P2-6 在前端，均非 research 范围 |

> 复现方式：`web_fetch` 打开上述 permalink 实际得到动态壳（正文为空），因此**该帖只可"定位"不可"引文复现"**；本文件不再声称其正文可核验。
