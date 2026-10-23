# v0.8.0 全球可自动采集源扩充（sources-expansion.md）

> 研究底稿 · 机会雷达 Opportunity Radar · **data-v0.8.0**
> 目标：回应「8 源×30 条太少、数据重复、没有新源入库」——为采集器提供 **38 个实测可用**的公开 RSS/JSON 源 + 3 套聚合模板（Google News / App Store），覆盖 **11 区域**、多行业；全部免登录、免 API key。
> **实测时间：2026-10-23 13:55–14:25（Asia/Shanghai）**。实测方式：`Invoke-WebRequest`（UA 标明 research）→ HTTP 状态、`<item>/<entry>` 条目数、`pubDate` 最新时间、标题解析；两轮探测（首轮 88 个候选，次轮对入选源按 item 精解析标题）。
> 合规总原则：**只取标题/摘要/链接，不全文转载、不绕过付费墙**；每域限速 ≤1 req/15min、缓存 ≥6h；Google News 属聚合器（黄），仅个人研究用。

---

## 0. 结论摘要（给 Lead/数据工程的一页纸）

| 项 | 结果 |
|---|---|
| 实测候选 | **88 个**（首轮）+ 38 个精解析 |
| 可用新增源（HTTP 200 + 可解析 + 有近期条目） | **38 个**（见 §1），远超 ≥15 要求 |
| 区域覆盖 | **11/11 全覆盖**：北美 9、欧洲 7、东亚 3、中国 4、东南亚 3、南亚 3、中东北非 2、非洲 3、拉美 3、大洋洲 2、独联体 1（含跨区源重复计） |
| 聚合模板 | Google News RSS（18 个地区 headlines 实测 + 3 个 query 实测）、App Store Top Free JSON（7 国实测，各 50 条） |
| 不可用/低质 | 15 个，均列原因（§4），**不推荐入库** |
| 与现有 `data/sources.json` 重复 | 仅 HN / Lobsters / Product Hunt / TechCrunch / App Store RSS / Substack 已在库，本文件不重复计入（§3） |

**首选入库（时间有限时的最小集，16 个）**：Retail Dive、Modern Retail、Supply Chain Dive、Sifted、EU-Startups、Tech.eu、Rest of World、Tech in Asia、CNA Asia、Inc42、ET Tech、Wamda、TechCabal、Nairametrics、LatamList、Startup Daily AU、TechNode、36Kr（18 个，含 11 区域）。

---

## 1. 可用源 A：38 个新增 RSS（全部实测 200 + 可解析）

| id | 名称 | Feed 直链 | 区域 | 语言 | 类别 | 状态/条目 | 最近条目时间 | 更新频率（推断） | 示例标题（前 2 条实测） |
|---|---|---|---|---|---|---|---|---|---|
| retaildive | Retail Dive | https://www.retaildive.com/feeds/news/ | north-america | en | 零售/电商 | 200/10 | 2026-10-22 12:34 | 每日多次 | Beyond Yoga aims to have ‘many’ stores. They’ll probably be yellow. ｜ David’s Bridal to spin off Pearl |
| modernretail | Modern Retail | https://www.modernretail.co/feed/ | north-america | en | 零售/DTC | 200/10 | 2026-10-22 14:00 | 每日多次 | Big-Box Briefing: How brands are juggling new marketplaces ｜ Modern Retail+ Research: 2026 holiday season |
| supplychaindive | Supply Chain Dive | https://www.supplychaindive.com/feeds/news/ | north-america | en | 供应链/物流 | 200/10 | 2026-10-22 13:56 | 每日 | Ikea accused of harmful wood sourcing in Europe’s forests ｜ Nestlé to close Ohio factory by end of 2027 |
| freightwaves | FreightWaves | https://www.freightwaves.com/feed | north-america | en | 供应链/物流 | 200/50 | 2026-10-22 21:47 | 每日多次 | Ryder fleet facing possible growth need as EPA ‘27 nears ｜ Daimler Truck sues former fleet manager |
| skift | Skift | https://skift.com/feed/ | north-america | en | 旅行/本地生活 | 200/10 | 2026-10-23 05:00 | 每日多次 | Death Toll From Europe’s Extreme Summer Heat Estimated At More Than 50,000 ｜ Accor Builds Caution Into Outlook |
| petfoodindustry | Petfood Industry | https://www.petfoodindustry.com/rss | north-america | en | 宠物（垂直） | 200/10 | 2026-10-22 10:02 | 每日 | 5 takeaways: Leading through crisis takes calm, credibility and courage ｜ Pet supplement compliance risks |
| restofworld | Rest of World | https://restofworld.org/feed/latest/ | 跨区（NA/AF/SA/SEA/LatAm） | en | 科技/新兴市场 | 200/12 | 2026-10-22 10:00 | 每周 2–3 次 | Big Tech’s thirst for water is sparking a global resistance ｜ Will developing nations handle millions of AI agents? |
| sifted | Sifted | https://sifted.eu/feed | europe | en | 创业/融资 | 200/24 | 2026-10-23 05:00 | 每日 | Nvidia funds European startups. They spend it on Nvidia ｜ Palantir chief: Europe must ‘accept some dependency’ |
| eu-startups | EU-Startups | https://www.eu-startups.com/feed/ | europe | en | 创业/融资 | 200/10 | 2026-10-22 16:00 | 每日 | Top 50: Journalists and PR pros in European Tech ｜ What does the failure of the Clarity Act mean for crypto? |
| tech-eu | Tech.eu | https://tech.eu/feed/ | europe | en | 创业/融资 | 200/20 | 2026-10-22 15:06 | 每日 | Körber takes stake in bootstrapped German robotics startup NAiSE ｜ Seaya raises €600M for new growth fund |
| retaildetail | RetailDetail EU | https://www.retaildetail.eu/rss/ | europe | en | 零售/电商 | 200/30 | 2026-10-22 14:35 | 每日多次 | Retailers in Brussels and Paris barricade their stores out of fear of new riots ｜ Controversial “corporate doctor” |
| euronews-business | Euronews Business | https://www.euronews.com/rss?level=theme&name=business | europe | en | 宏观/商业 | 200/50 | 2026-10-22 22:56 | 每日多次 | Spanish and Portuguese unions discuss joint general strike ｜ Why Elon Musk wants to merge Tesla and SpaceX |
| technode | TechNode | https://technode.com/feed/ | china, east-asia | en | 科技/中国 | 200/2000 | 2026-10-23 04:26 | 每日多次（需 limit 50） | Why This AI Startup Is Taking a Different Path From Wonderful ｜ The Race to Reinvent the Everyday Ride |
| 36kr-feed | 36Kr | https://www.36kr.com/feed | china | zh | 科技/创投 | 200/30 | 2026-10-23 13:51 | 每日多次 | 科氪｜荣耀亮相 CEIC：Magic9 领衔 AI 智能体手机 ｜ “德杯”出海这步棋，下在虎牙转型的第三年 |
| japantimes | The Japan Times | https://www.japantimes.co.jp/feed/ | east-asia | en | 商业/日本 | 200/30 | 2026-10-23 14:59 | 每日多次 | Nippon Steel to invest $3 billion in new U.S. Steel hot-strip mill ｜ Venezuelans call for elections |
| ifanr | iFanr（爱范儿） | https://www.ifanr.com/feed | china | zh | 科技/消费 | 200/20 | 2026-10-23 00:00 | 每日 | 早报｜微信回应未适配 iPhone Duo / 比亚迪 L3 ｜ OpenAI 发现 PHP「世纪漏洞」 |
| sspai | SSPAI（少数派） | https://sspai.com/feed | china | zh | 消费/工具 | 200/10 | 2026-10-23 11:07 | 每日 | 破与立：设计视角下的 iPhone Duo ｜ 派早报：Insta360 发布 Mic，Anthropic 推出 Claude Duet |
| techinasia | Tech in Asia | https://www.techinasia.com/feed | sea | en | 创业/东南亚 | 200/36 | 2026-10-23 06:00 | 每日 | What Singapore does differently to fuel emerging tech ｜ Microsoft AI twice as accurate as doctors |
| cna-asia | CNA Asia | https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml | sea | en | 商业/亚洲 | 200/20 | 2026-10-23 13:41 | 每日多次 | South Korean economy’s growth likely picked up in Q3 on chip exports ｜ India’s Kishan ruled out |
| bangkokpost | Bangkok Post | https://www.bangkokpost.com/rss/data/topstories.xml | sea | en | 商业/泰国 | 200/10 | 2026-10-23 12:00 | 每日 | DSI to review sedition complaint against poll-watchers ｜ BoT seeks feedback on THB stablecoins |
| inc42 | Inc42 | https://inc42.com/feed/ | south-asia | en | 创业/印度 | 200/24 | 2026-10-23 04:57 | 每日 | Swiggy’s Q2 Report Card, eMudhra To Exit Certificate Biz ｜ Zetwerk Makes NSE Debut At 5.5% Premium |
| yourstory | YourStory | https://yourstory.com/feed | south-asia | en | 创业/印度 | 200/20 | 2026-10-22 08:03 | 每日 | Can AI make debt collections less about chasing? ｜ Jio Platforms IPO draws strong demand |
| et-tech | ET Tech（Economic Times） | https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms | south-asia | en | 科技/印度 | 200/50 | 2026-10-23 11:12 | 每日多次 | Zetwerk eyes manufacturing demand from AI, clean energy ｜ FCC grants Intel waiver |
| wamda | Wamda | https://www.wamda.com/feed | mena | en | 创业/中东北非 | 200/20 | 2026-10-22 15:27 | 每日 | INVE raises $300,000 from Outliers VC to scale eventtech ｜ UAE’s Ziina secures central bank approvals |
| arabnews | Arab News | https://www.arabnews.com/rss.xml | mena | en | 商业/中东 | 200/50 | 2026-10-23 05:52 | 每日多次 | Abdulmajeed Albalawi: ‘There is nothing I do not like to photograph’ ｜ REVIEW: ‘VisionQuest’ |
| techcabal | TechCabal | https://techcabal.com/feed/ | africa | en | 创业/非洲 | 200/10 | 2026-10-22 17:13 | 每日 | A new live tech show wants to change African tech coverage ｜ Spend first, measure later: Africa’s AI boom |
| nairametrics | Nairametrics | https://nairametrics.com/feed/ | africa | en | 商业/尼日利亚 | 200/20 | 2026-10-23 05:58 | 每日 | FG harmonises 2027 exam timetable ｜ NEC approves 90-day plan to cut food costs |
| businessday-ng | BusinessDay NG | https://businessday.ng/feed/ | africa | en | 商业/尼日利亚 | 200/5 | 2026-10-23 05:25 | 每日（条目少） | Collaboration, innovation key to unlocking Nigeria’s capital market ｜ BOI targets N1.85trn lending |
| latamlist | LatamList | https://latamlist.com/feed/ | latam | en | 创业/拉美 | 200/10 | 2026-10-20 23:24 | 每周 2–3 次 | Argentine fintech Rebill raises $5.4M Pre Series A round ｜ iFood acquires Brazilian HR startup Caju |
| braziljournal | Brazil Journal | https://braziljournal.com/feed | latam | pt | 商业/巴西 | 200/15 | 2026-10-23 00:56 | 每日 | EDITORIAL. Um dia triste ｜ A nova Nokia que pouca gente conhece |
| startupi | Startupi | https://startupi.com.br/feed/ | latam | pt | 创业/巴西 | 200/10 | 2026-10-22 17:26 | 每日 | A IA invadiu as urnas — e ninguém controla ｜ Anthropic quer valer US$ 2 trilhões na bolsa |
| startupdaily-au | Startup Daily AU | https://www.startupdaily.net/feed/ | oceania | en | 创业/大洋洲 | 200/10 | 2026-10-23 03:54 | 每日 | In the AI era, the crucial questions all founders dread ｜ What the truck, Musk? Tesla abandons cyber ute |
| smartcompany-au | SmartCompany AU | https://www.smartcompany.com.au/feed/ | oceania | en | 中小企业/澳洲 | 200/10 | 2026-10-23 04:46 | 每日 | July takes off with new frequent flyer rewards program ｜ Five AI finance mistakes businesses should avoid |
| vc-ru | vc.ru | https://vc.ru/rss | cis | ru | 创业/独联体 | 200/12 | 2026-10-22 16:44 | 每日 | Cloudflare зафиксировала «миллионы» атак на сайты ｜ Госдума поддержала законопроект |
| federalregister | US Federal Register（RULE） | https://www.federalregister.gov/api/v1/documents.rss?conditions%5Btype%5D=RULE | north-america | en | 政策/监管 | 200/200 | 2026-10-23 04:00 | 每日多次（需 limit） | Implementing the GENIUS Act for Stablecoins ｜ Revision of NEPA Implementing Procedures |
| wto-news | WTO Latest News | https://www.wto.org/library/rss/latest_news_e.xml | europe/global | en | 贸易政策 | 200/10 | 2026-10-22 14:22 | 每周 2–3 次 | The Philippines launches safeguard investigation on pork ｜ WTO reviews supply chain finance initiative |
| eu-commission-press | European Commission Press | https://ec.europa.eu/commission/presscorner/api/rss?language=en | europe | en | 政策/监管 | 200/10 | 2026-10-22 11:45 | 每日 | Speech by Commissioner Lahbib at Resilient Europe Conference ｜ Commission welcomes Coca-Cola/Nestlé/Danone commitments |
| shopify-changelog-rss | Shopify Changelog | https://shopify.dev/changelog/feed | 全球 | en | 平台规则 | 200/782 | 2026-10-22 18:00 | 每周 2–4 次（需 limit） | Discover a merchant’s retail stores with UCP location search ｜ POS UI extensions support reactive storage |

> 说明：`状态/条目` = HTTP 状态 / 本次解析条目数；`最近条目时间` 取 feed 内最新 pubDate（UTC 近似）；`更新频率` 按最新时间 + 近 7 日条目密度推断，接入后应连续观察 3 天再定阈值。

---

## 2. 可用源 B：Google News RSS 多地区模板（18 个地区 headlines 实测 + 3 个 query 实测）

### 2.1 模板

**地区头条（免 key、免登录）**：
```
https://news.google.com/rss/headlines/section/topic/BUSINESS?hl={hl}&gl={gl}&ceid={gl}:{lang}
```
**关键词检索（支持 `when:7d` 时间过滤）**：
```
https://news.google.com/rss/search?q={URL编码关键词}+when:7d&hl={hl}&gl={gl}&ceid={gl}:{lang}
```

### 2.2 实测通过的 18 个地区（2026-10-23）

| 区域 | hl | gl | ceid | 实测条目 | 最近条目 |
|---|---|---|---|---|---|
| 北美/美国 | en-US | US | US:en | 51 | 2026-10-23 05:15 |
| 欧洲/英国 | en-GB | GB | GB:en | 70 | 2026-10-23 05:00 |
| 欧洲/德国 | de | DE | DE:de | 70 | 2026-10-23 05:16 |
| 东亚/日本 | ja | JP | JP:ja | 70 | 2026-10-23 04:22 |
| 东亚/韩国 | ko | KR | KR:ko | 70 | 2026-10-23 05:37 |
| 中国 | zh-CN | CN | CN:zh-Hans | 70 | 2026-10-23 05:34 |
| 南亚/印度 | en-IN | IN | IN:en | 70 | 2026-10-23 04:20 |
| 东南亚/印尼 | id | ID | ID:id | 70 | 2026-10-23 03:06 |
| 东南亚/越南 | vi | VN | VN:vi | 70 | 2026-10-23 04:44 |
| 中东/UAE | en-AE | AE | AE:en | 51 | 2026-10-23 05:15 |
| 中东/沙特 | ar | SA | SA:ar | 31 | 2026-10-22 18:02 |
| 非洲/尼日利亚 | en-NG | NG | NG:en | 70 | 2026-10-23 03:41 |
| 非洲/南非 | en-ZA | ZA | ZA:en | 70 | 2026-10-23 01:52 |
| 拉美/巴西 | pt-BR | BR | BR:pt-419 | 70 | 2026-10-23 00:03 |
| 拉美/墨西哥 | es-419 | MX | MX:es-419 | 36 | 2026-10-23 01:17 |
| 大洋洲/澳洲 | en-AU | AU | AU:en | 70 | 2026-10-23 05:26 |
| 独联体/哈萨克 | ru | KZ | KZ:ru | 70 | 2026-10-22 23:53 |
| 欧洲/土耳其 | tr | TR | TR:tr | 64 | 2026-10-23 04:57 |

### 2.3 query 模板实测（3 条证据）

| query（URL 编码前） | 参数 | 实测 | 示例标题 |
|---|---|---|---|
| `retail startup funding when:7d` | hl=en-US&gl=US&ceid=US:en | 200 / **63 条** / 最新 2026-10-20 15:54 GMT | "AI startup ASI valued at $3 billion in latest funding round - Reuters" ｜ "ShopMy Backer Inspired Capital Closes on $450 Million Fund" |
| `宠物 消费 when:7d` | hl=zh-CN&gl=CN&ceid=CN:zh-Hans | 200 / **28 条** / 最新 2026-10-20 11:32 GMT | "宠物经济，未老先衰 - CBNData-第一财经商业数据中心" ｜ "池州青阳宠物经济“加速跑” - 央视网" ｜ "宠物险高赔付背后" |
| `حلال أعمال when:7d` | hl=ar&gl=SA&ceid=SA:ar | 200 / **23 条** / 最新 2026-10-23 00:45 GMT | "هدى حسين «أم حلال» في دراما رمضان 2027..."（阿语商业/清真内容） |

**建议 query 词表**（每个地区 3–5 个，避免过窄）：`startup funding`、`retail ecommerce`、`halal food`、`pet care`、`senior care`、`solar energy`、`export import`、`regulation compliance`、`AI tools`。
**合规/注意**：①Google News 是聚合器，条目 URL 为 `news.google.com/rss/articles/...` 跳转链接，需先保存原链接再解析（或只做标题/来源/时间去重）；②仅个人研究，不转售、不全文转载；③**黄级**：按地区限速 ≤1 req/10min、缓存 ≥6h；④同一条新闻会被多地区重复，去重需标题+来源域名。

---

## 3. 可用源 C：App Store Top Free JSON 多国模板（7 国实测）

**模板**：`https://itunes.apple.com/{cc}/rss/topfreeapplications/limit=50/json`
**实测（2026-10-23）**：`us` 50 条、`jp` 50 条、`br` 50 条、`in` 50 条、`ng` 50 条、`ae` 50 条、`au` 50 条，均 HTTP 200，`feed.entry[]` 可解析（`im:name.label`、`id.attributes.im:id`、`category.attributes.label`、`im:image`）。
**示例（US 榜首）**：`Capital One Mobile`、`Vinted: Pre-loved marketplace`；**JP**：`Google Authenticator`、`MUJI アプリ`；**BR**：`Disney+`、`Wepink App`；**IN**：`Sony LIV`、`Groww`；**NG**：`ChatGPT`、`Temu`；**AE**：`ChatGPT`、`DARB - Urban mobility`；**AU**：`AXS Tickets`、`ING Banking`。
**用途**：跨市场应用榜单差异 = 平台生态/消费趋势信号（如 Temu 在 NG 榜、ChatGPT 在 NG/AE 榜）。
**合规**：苹果公开营销 RSS，**绿级**；按国家缓存 12h，限速 ≤1 req/10min。

---

## 4. 不可用 / 低质清单（不推荐入库，15 个）

| 源 | 实测 | 原因 | 替代 |
|---|---|---|---|
| e27（https://e27.co/feed/） | **403** | Cloudflare 反爬 | 用 Tech in Asia / CNA Asia 覆盖 SEA |
| Entrackr（https://entrackr.com/feed/） | **404**（`/feed/rss/` 也 404） | RSS 已下线/改版 | 用 Inc42 / YourStory / ET Tech |
| The Jakarta Post（https://www.thejakartapost.com/rss） | **404** | feed 路径失效 | 用 CNA Asia / Bangkok Post / Google News ID |
| DealStreetAsia（https://www.dealstreetasia.com/feed/） | **503** | 服务不可用/付费墙 | 用 Tech in Asia / e27 替代（已不可用）→ Google News SEA |
| Infobae（https://www.infobae.com/feeds/rss/） | **404** | 路径错误/需具体栏目 feed | 用 Brazil Journal / Startupi / Google News MX |
| Techpoint Africa（https://techpoint.africa/feed/） | **403** | 反爬 | TechCabal / Nairametrics |
| McKnight's Senior Living（https://www.mcknights.com/feed/） | **403** | Cloudflare | 用 Google News `senior care` query |
| Retail Brew（https://www.retailbrew.com/feed） | **404** | RSS 已下线 | Retail Dive / Modern Retail |
| 虎嗅（https://www.huxiu.com/rss/0.xml） | **超时 25s** | 不稳定/反爬 | 36Kr / iFanr |
| RB.ru（https://rb.ru/feeds/news/） | **SSL 失败** | 证书/连接问题 | vc.ru |
| Kazinform（https://qazinform.com/rss） | **500** | 服务端错误 | Google News KZ（ru） |
| Bing News RSS（`?format=RSS`） | **200 但 0 条**（返回 HTML 搜索页） | RSS 参数已失效 | **Google News RSS**（§2） |
| MENAbytes（https://www.menabytes.com/feed/） | **202 但 0 条** | WAF/挑战页 | Wamda / Arab News / Google News AE/SA |
| Korea Herald（RSS XML） | **200 但 0 条** | feed 格式不兼容（需适配 XML/CDATA） | Google News KR / Japan Times |
| Disrupt Africa（https://disrupt-africa.com/feed/） | 200 但最新 **2024-01** | 已停更 | TechCabal / Nairametrics |
| Contxto（https://contxto.com/en/feed/） | 200 但最新 **2026-10-08**、低频 | 周更/半停更 | LatamList / Brazil Journal |
| Silicon Canals（https://siliconcanals.com/feed/） | 200 但最新 **2026-09-22** | 低频 | Sifted / EU-Startups / Tech.eu |
| GOV.UK DBT（.atom） | 200 但最新 **2026-10-09** | 政府发布低频 | EU Commission Press / Federal Register |

> 说明：`Bing News RSS` 与 `e27/Entrackr` 是任务点名的方向，本轮已实测并给出失败原因与替代，未编造可用结论。

---

## 5. 覆盖矩阵（11 区域 × 类别）

| 区域 | 零售/电商 | 创业/融资 | 科技/趋势 | 政策/监管 | 供应链/物流 | 商业/宏观 | 行业垂直 | 平台 |
|---|---|---|---|---|---|---|---|---|
| north-america | Retail Dive, Modern Retail | TechCrunch(已有) | Rest of World | Federal Register | Supply Chain Dive, FreightWaves | Euronews(欧) | Skift(旅行), Petfood Industry | Shopify Changelog |
| europe | RetailDetail | Sifted, EU-Startups, Tech.eu | — | EU Commission, WTO | — | Euronews Business | — | — |
| east-asia | — | — | TechNode, Japan Times | — | — | — | — | — |
| china | — | 36Kr | TechNode, iFanr, SSPAI | — | — | — | — | 36Kr |
| sea | — | Tech in Asia | CNA Asia | — | — | Bangkok Post | — | — |
| south-asia | — | Inc42, YourStory | ET Tech | — | — | — | — | — |
| mena | — | Wamda | — | — | — | Arab News | — | — |
| africa | — | TechCabal | — | — | — | Nairametrics, BusinessDay NG | — | — |
| latam | — | LatamList, Startupi | — | — | — | Brazil Journal | — | — |
| oceania | — | Startup Daily AU | — | — | — | SmartCompany | — | — |
| cis | — | vc.ru | — | — | — | — | — | — |

> 补强建议：`south-asia` 缺零售垂直、`cis` 仅 1 源、`east-asia` 缺日语/韩语源；下版可补 Nikkei Asia（付费墙慎用）、Korea Herald 适配版、India Retailing、中亚 Google News query（已可用）。

---

## 6. 与现有 `data/sources.json` 的去重说明

现有 68 个平台中与本文件重叠、**不重复计入新增**的有：`hnrss`、`lobsters`、`producthunt`、`producthunt-feed`、`techcrunch-rss`、`app-store-rss`、`substack-rss`。本轮新增的 38 个 RSS + Google News 模板 + App Store 多国 JSON 均不在现有清单中，可直接追加。

---

## 7. 给 data-engineer 的接入建议（对应 `sources.json` 字段）

```json
{
  "id": "retaildive",
  "name": "Retail Dive",
  "url": "https://www.retaildive.com/feeds/news/",
  "access": "rss",
  "regions": ["north-america"],
  "signal_types": ["complaint", "wish", "comparison"],
  "categories": ["marketplace"],
  "lang": "en",
  "frequency": "daily",
  "cost": "free",
  "compliance": "green",
  "value_score": 8.6,
  "priority": 1,
  "enabled": true,
  "limits": {"max_items": 20, "timeout_ms": 15000, "min_interval_min": 15, "cache_hours": 6},
  "last_checked": "2026-10-23",
  "check_result": "http_200_items_10",
  "notes": "RSS 公开；只取标题/摘要/链接，不全文转载；限速 1 req/15min"
}
```

- **Google News 地区 query**：按区域注册为独立源（如 `gnews-ae-business`、`gnews-ng-business`），`access: rss`、`compliance: yellow`（聚合器）、`limits.max_items: 30`、`min_interval_min: 10`；`url` 带 `hl/gl/ceid` 参数。
- **App Store JSON**：`access: json`、每国一个源、`limits.cache_hours: 12`；解析 `feed.entry[].im:name.label`。
- **采集器要求**：UA 标明 research；`--fetch` 失败重试 ≤2 次并写入 `source-health`（ok/items/error/ms）；大 feed（TechNode 2000、Federal Register 200、Shopify 782）必须 `max_items` 截断，否则 outbox 爆炸。
- **去重**：Google News 同题多地区重复率高，需按「标题 hash + 来源域名 + 日期」跨源去重（对应 task-44 的 ledger）。
- **禁用**：§4 全部标 `enabled:false` 并写 `notes` 原因，避免采集器反复重试。

---

## 8. 复现说明

- 实测口径：`Invoke-WebRequest -UseBasicParsing -TimeoutSec 25 -Headers @{User-Agent='...OpportunityRadarResearch/0.8'}`；RSS 按 `<item>`/`<entry>` 计数、取前 3 条 `<title>` 与首个 `<pubDate>`；JSON 按 `feed.entry` 计数。
- 两轮探测脚本为临时文件（`research/_probe*.ps1`），交付前已删除，避免污染 research 目录；如需复跑，可按 §1 表格逐条 curl。
- 所有「最近条目时间」为探测时 feed 内最新发布时间（UTC），非本机时间。
