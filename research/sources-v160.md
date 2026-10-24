# v1.6.0 全球可自动采集源扩充（sources-v160.md）

> 研究底稿 · 机会雷达 Opportunity Radar · **data-v1.6.0**
> 背景：用户要求「扩源把高质量商机从 63 恢复到 100–150」。本文件为采集器提供 **32 个实测可用、免登录免 key、含日期+链接的新 RSS 源**，覆盖欧洲/东南亚/南亚/中东/非洲/拉美/日韩/中国出海，并给出**现有 200 平台 / 126 enabled 源的健康复核与可恢复/替换清单**。
> **实测时间：2026-10-24 16:20–17:05（Asia/Shanghai）**；三轮共尝试 **200 个候选**（90 + 79 + 31），方法：Python `urllib`（`Accept: rss/xml/json`、15–18s 超时、最多 2 次重试、UA 标明 research）逐源解析 `<item>/<entry>`、`pubDate`、`link`；`techNode/rest-of-world` 等用 `curl` 交叉验证。
> 只取标题/摘要/链接，不抓全文、不绕付费墙；每域限速 ≤1 req/5s、缓存 ≥6h。

---

## 0. 结论摘要（给 Lead / data-engineer）

| 项 | 结果 |
|---|---|
| 三轮尝试候选 | **200 个**（第 1 轮 90、第 2 轮 79、第 3 轮 31） |
| 可用且新鲜（HTTP 200 + 可解析 + 含日期/链接 + 最近 21 天有更新 + 与现有源不同 host） | **42 个** |
| 本文件主表推荐入库 | **32 个**（P0 10 / P1 20 / P2 2） |
| 区域覆盖 | 欧洲 8、东南亚 4、南亚 3、中东北非 1（+ 现有 Middle East Monitor/Wamda 可复用）、非洲 3、拉美 3、日韩 3、中国 3、全球产业垂直 4 |
| 语言覆盖 | 英/法/德/意/西/葡/越/泰 共 8 种语言 |
| 现有源复核 | `tech-eu`、`japantimes`、`contxto` **可恢复**；`technode` 需 curl；`e27`、`entrackr`、`dealstreetasia`、`koreaherald`、`siliconcanals`、`digitalnewsasia` 建议 **enabled=false / 替换**；`Arab News` 已由 Middle East Monitor 替换（本轮验证 200/50） |
| 对 100–150 条目标的估算 | 32 源 × 15–30 条/次 × 2 次/日 ≈ 1,000–1,900 条原始信号/日；经跨源去重（URL/title hash）+ 行业/需求相关性过滤 + 人工复核，**约 10–20 条可用候选/日、两周可达 100–150 条高质量机会**（前提：task-44 的 ledger 去重 + 相关性初筛上线） |

---

## 1. 新增可用源（32 个，全部实测 HTTP 200、可解析、含日期与链接）

> 列说明：`kind`=rss/json；`状态/条目`=本次 HTTP 状态与解析条目数；`日期/链接`=每条是否含 pubDate 与 link；`优先级`=P0 建议首批接入。

| id | 名称 | Feed 直链 | kind | 内容类型 | 区域 | 语言 | 行业 | 优先级 | 状态/条目 | 日期/链接 | 标题样例（实测前 1–2 条） |
|---|---|---|---|---|---|---|---|---|---|---|---|
| euobserver-business | EUobserver | https://euobserver.com/rss | rss | application/rss+xml | europe | en | 政策/商业（欧盟） | P0 | 200 / 20 条 | ✅/✅ | [Interview] Bulgaria’s presidential election becomes a test of Rumen Radev’s grip ｜ Ousting Netanyahu won’t curb right-wing nationalism |
| techfundingnews | Tech Funding News | https://techfundingnews.com/feed/ | rss | application/rss+xml | europe | en | 创业/融资（欧洲） | P0 | 200 / 10 条 | ✅/✅ | Why trade-weighted sterling can tell a different story from GBP/USD ｜ Small business owners: Tax moves worth making before year-end |
| maddyness | Maddyness | https://www.maddyness.com/feed/ | rss | application/rss+xml | europe | fr | 创业/融资（法国） | P1 | 200 / 10 条 | ✅/✅ | French Tech : près de 271 millions d’euros levés en une semaine, portés par Pigment |
| gruenderszene | Gruenderszene | https://www.gruenderszene.de/feed | rss | application/rss+xml | europe | de | 创业/融资（德国） | P1 | 200 / 20 条 | ✅/✅ | Startup züchtet mit Gentechnik Superhunde fürs Militär – Palantir-Berater wird CEO ｜ 500.000 Euro Darlehen, kaum Umsatz – trotzdem reißen sich vier Löwen um dieses DHDL-Startup |
| startupitalia | StartupItalia | https://startupitalia.eu/feed | rss | application/rss+xml | europe | it | 创业/融资（意大利） | P1 | 200 / 100 条 | ✅/✅ | L’unicorno svedese che fa magie con l’AI. Per Legora round da 491 milioni |
| elreferente | El Referente | https://elreferente.es/feed/ | rss | application/rss+xml | europe | es | 创业/融资（西班牙） | P2 | 200 / 10 条 | ✅/✅ | Venture on the Road celebra diez años recorriendo España en busca de startups |
| deutsche-startups | Deutsche Startups | https://www.deutsche-startups.de/feed/ | rss | application/rss+xml | europe | de | 创业/融资（德国） | P1 | 200 / 15 条 | ✅/✅ | #Gastbeitrag - Seedstrapping: Wie KI die Startup-Finanzierung verändert ｜ #DHDL - Wer entscheidet, ob Frauen ein Hockurinal benutzen? |
| t3n | t3n | https://t3n.de/rss.xml | rss | application/rss+xml | europe | de | 科技/数字化（德语区） | P1 | 200 / 20 条 | ✅/✅ | Blackjack-Studie: KI-Agenten erfinden heimlich eine Geheimsprache ｜ Expansion nach Asien: Warum europäische Tech-Gründer:innen jetzt auf Hongkong setzen |
| vulcanpost | Vulcan Post | https://vulcanpost.com/feed/ | rss | application/rss+xml | sea | en | 创业/科技（新加坡/东南亚） | P1 | 200 / 10 条 | ✅/✅ | GovTech lays off 38 employees in second wave of retrenchments ｜ Jobs in Singapore: Top hiring industries revealed |
| techsauce | Techsauce | https://techsauce.co/feed | rss | application/xml | sea | th | 创业/科技（泰国） | P1 | 200 / 10 条 | ✅/✅ | ทักษะที่ AI แทนไม่ได้ บทเรียนจาก 4 ผู้นำธุรกิจโลก ｜ สาระ ล่ำซำ คว้ารางวัล “สุดยอดซีอีโอขวัญใจสื่อมวลชน” ปี 2569 |
| technode-global | TechNode Global | https://technode.global/feed/ | rss | application/rss+xml | sea | en | 科技/出海（新加坡） | P0 | 200 / 30 条 | ✅/✅ | Singapore breaks ground on low-carbon testbed ｜ Singapore-founded AnyMind enters the U.S. market |
| vnexpress-kinhdoanh | VnExpress Business | https://vnexpress.net/rss/kinh-doanh.rss | rss | application/xml | sea | vi | 商业/财经（越南） | P1 | 200 / 60 条 | ✅/✅ | Đề xuất hỗ trợ đầu tư đặc biệt cho công nghiệp văn hóa ｜ Giá đồng thế giới tăng vượt trội so với vàng năm nay |
| businesstoday-in | Business Today India | https://www.businesstoday.in/rss/home | rss | application/xml | south-asia | en | 商业/财经（印度） | P0 | 200 / 119 条 | ✅/✅ | Why are Indians facing backlash over US tech jobs? How H-1B visas became a flashpoint ｜ Can India find its own Starlink moment? |
| hindubusinessline-companies | BusinessLine Companies | https://www.thehindubusinessline.com/companies/feeder/default.rss | rss | application/xml | south-asia | en | 商业/公司（印度） | P0 | 200 / 60 条 | ✅/✅ | Q2 Results Today Live: Kotak Mahindra Bank, AU Small Finance Bank… ｜ Dr Reddy’s launches two new semaglutide brands |
| tribune-pk | Tribune Pakistan Business | https://tribune.com.pk/feed/business | rss | application/xml | south-asia | en | 商业（巴基斯坦） | P1 | 200 / 25 条 | ✅/✅ | Mohmand Dam cost jumps 115% ｜ Public transport carries less than 1% of commuters |
| al-monitor | Al-Monitor | https://www.al-monitor.com/rss | rss | application/rss+xml | mena | en | 商业/政治（中东北非） | P1 | 200 / 20 条 | ✅/✅ | To bring down Netanyahu, Arab-Israeli parties ready for opposition alliance ｜ Marco Rubio calls on those seeking change in Cuba to partner with CIA |
| african-business | African Business | https://african.business/feed | rss | application/rss+xml | africa | en | 商业/产业（非洲） | P0 | 200 / 25 条 | ✅/✅ | Four technologies that could reshape Africa's energy future ｜ Nigeria prepares as first case of Ebola confirmed |
| capitalfm-ke | Capital FM Kenya Business | https://www.capitalfm.co.ke/business/feed/ | rss | application/rss+xml | africa | en | 商业（肯尼亚/东非） | P1 | 200 / 10 条 | ✅/✅ | KenGen appoints Ronoh Kibet Charles as next CEO ｜ NCA names developer, contractor of collapsed Eastleigh building |
| technext24 | Technext24 | https://technext24.com/feed/ | rss | application/rss+xml | africa | en | 科技/创业（尼日利亚/西非） | P1 | 200 / 10 条 | ✅/✅ | Bosun Tijani, Samuel Nartey George and other African candidates to watch in the race for ITU council 2027–2030 ｜ Stanbic IBTC profit surges 33% |
| elfinanciero-mx | El Financiero (MX) | https://www.elfinanciero.com.mx/rss/ | rss | application/xml | latam | es | 商业/财经（墨西哥） | P0 | 200 / 100 条 | ✅/✅ | Consultorios vacíos, médicos indispensables（综合 feed，需关键词过滤商业条目） |
| lanacion-economia | La Nacion（综合 feed） | https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml | rss | application/xml | latam | es | 商业/综合（阿根廷） | P1 | 200 / 96 条 | ✅/✅ | Es oficial: en qué caso el Uscis aplica la regla del DHS（综合 feed，需关键词过滤） |
| exame-br | Exame | https://exame.com/feed/ | rss | text/xml | latam | pt | 商业/财经（巴西） | P1 | 200 / 25 条 | ✅/✅ | Estudo revela como comunidades sobreviveram a uma erupção no Japão ｜ IA aumentou em 26% as tarefas concluídas por desenvolvedores |
| koreatimes | The Korea Times | https://www.koreatimes.co.kr/www/rss/rss.xml | rss | application/xml | east-asia | en | 商业/综合（韩国） | P1 | 200 / 38 条 | ✅/✅ | KBO saves leader out for Lions' postseason series ｜ FC Seoul crowned K League 1 champions（综合，需过滤商业） |
| yonhap-en | Yonhap English | https://en.yna.co.kr/RSS/news.xml | rss | application/xml | east-asia | en | 商业/综合（韩国） | P0 | 200 / 98 条 | ✅/✅ | (LEAD) FC Seoul crowned K League 1 champions ｜ Ryu Hae-ran builds 4-shot lead at LPGA（综合，需过滤） |
| businesskorea | Business Korea | https://www.businesskorea.co.kr/rss/allArticle.xml | rss | application/xml | east-asia | en | 产业/商业（韩国） | P1 | 200 / 50 条 | ✅/✅ | China Biotech Curbs Could Rattle K-Bio ｜ KIC Sovereign Wealth Fund Faces Questions |
| pandaily | Pandaily | https://pandaily.com/feed/ | rss | application/xml | china | en | 科技/出海（中国） | P0 | 200 / 20 条 | ✅/✅ | 360's Zhou Hongyi Says Its Sovereign AI OS Is Already in Use ｜ Qwen Go! Adds My Apps |
| sixthtone | Sixth Tone | https://www.sixthtone.com/rss | rss | application/xml | china | en | 社会/消费（中国） | P1 | 200 / 51 条 | ✅/✅ | China Develops 1-Gram, Wireless Microscope ｜ In Stitches: Why Young Chinese Are Buying Clothes They Can Throw Away |
| cgtn-business | CGTN Business | https://www.cgtn.com/subscribe/rss/section/business.xml | rss | application/rss+xml | china | en | 商业/官方（中国） | P2 | 200 / 50 条 | ✅/✅ | Angola's fuel subsidies spending projected to hit $4 billion ｜ What happens after people are lifted out of poverty |
| pv-magazine | pv magazine | https://www.pv-magazine.com/feed/ | rss | application/rss+xml | global | en | 光伏/新能源 | P0 | 200 / 10 条 | ✅/✅ | Glass-free European photovoltaic modules for vehicles ｜ Vietnam orders provinces to introduce rooftop solar incentives |
| cleantechnica | CleanTechnica | https://cleantechnica.com/feed/ | rss | application/rss+xml | global | en | 清洁能源/电动汽车 | P1 | 200 / 45 条 | ✅/✅ | US Tech Leaders Are Urgently Calling for Rules on AI — China Already Has Them ｜ Is A PHEV Diesel Hybrid A Viable Option? |
| carbonbrief | Carbon Brief | https://www.carbonbrief.org/feed | rss | application/rss+xml | global | en | 气候/政策 | P1 | 200 / 12 条 | ✅/✅ | Chart: A record two-thirds of car sales in China are now electric vehicles ｜ How are climate scientists using AI? |
| pymnts | PYMNTS | https://www.pymnts.com/feed/ | rss | application/rss+xml | global | en | 支付/金融科技 | P1 | 200 / 10 条 | ✅/✅ | Who You Gonna Call? The Librarian. ｜ American Express Expands Travel Platform With Airbnb Integration |

**可采集性说明**：
- 全部为公开 RSS，**无需登录/key**；`application/xml` 与 `text/xml` 需按 XML 解析器处理（不要按 JSON 解析）。
- `techsauce(泰语)`、`maddyness/frenchweb(法语)`、`gruenderszene/t3n/deutsche-startups(德语)`、`startupitalia(意大利语)`、`elreferente/elfinanciero/lanacion(西语)`、`exame(葡语)`、`vnexpress(越南语)` 需 UTF-8 解码 + 语言标注（对应 v0.9.3 的翻译层）。
- **综合新闻源**（`koreatimes`、`yonhap-en`、`lanacion-economia`、`elfinanciero-mx`、`cgtn-business`）不是纯商业 feed：采集时需用商业/产业关键词过滤（见 §5），否则噪声高。
- 大 feed（`startupitalia` 100、`exame` 25、`yonhap` 98）建议 `max_items=20–30`。

---

## 2. 覆盖矩阵

| 区域 | 商业/财经 | 创业/融资 | 科技/出海 | 政策/监管 | 产业垂直 | 语言 |
|---|---|---|---|---|---|---|
| europe | EUobserver、techfundingnews | maddyness、gruenderszene、startupitalia、elreferente、deutsche-startups | t3n | EUobserver | — | en/fr/de/it/es |
| sea | VnExpress Business | Vulcan Post、Techsauce | TechNode Global | — | — | en/th/vi |
| south-asia | Business Today、BusinessLine、Tribune PK | — | — | — | — | en |
| mena | Al-Monitor（+ 现有 mena-middleeastmonitor、wamda） | — | — | — | — | en |
| africa | African Business、Capital FM KE | Technext24 | — | — | — | en |
| latam | El Financiero MX、La Nacion、Exame | — | — | — | — | es/pt |
| east-asia | Korea Times、Yonhap | — | Business Korea | — | — | en |
| china | CGTN Business | — | Pandaily、Sixth Tone | — | — | en |
| global | — | — | — | Carbon Brief | pv magazine、CleanTechnica、PYMNTS | en |

未覆盖：大洋洲、独联体（不在本任务 8 区域要求内；现有 `startupdaily-au`、`smartcompany-au`、`vc-ru` 已覆盖）。

---

## 3. 现有源健康复核：可恢复 / 建议替换（对应 data/sources.json 当前 200 平台、126 enabled）

| 现有源 | 本轮实测 | 结论 | 建议动作 |
|---|---|---|---|
| `tech-eu` | **200 / 20 条**，最新 2026-10-23 | ✅ **可恢复**（此前疑似 403 不成立） | `enabled=true`，无需替换 |
| `japantimes` | 第 1 轮超时，第 3 轮 **200 / 30 条**（最新 2026-10-24） | ✅ **可恢复** | 超时提高到 20s、重试 2 次 |
| `contxto` | **200 / 100 条**，最新 2026-10-23 | ✅ **可恢复**（此前半停更） | `enabled=true`，`max_items=30` |
| `wamda` | 200 / 20 条，最新 2026-10-13（10 天未更） | ⚠️ 可用但低频 | 保留，`frequency=weekly` |
| `technode` | urllib 403；**curl 200（3.3MB，2000 条）** | ⚠️ 需专用抓取 | 保留；fetch 用 curl/浏览器 UA、超时 30s、`max_items=30` |
| `rest-of-world` | urllib 403/超时；v0.8 曾 200 | ⚠️ 待复测 | 用 curl 复测；暂 `enabled=false` |
| `e27` | **403** | ❌ 不可用 | `enabled=false`；替换 Tech in Asia / Vulcan Post / Techsauce |
| `entrackr` | **403**（此前 404） | ❌ 不可用 | `enabled=false`；替换 Business Today / BusinessLine |
| `dealstreetasia` | **503** | ❌ 不可用 | `enabled=false`；替换 TechNode Global / Tech in Asia |
| `koreaherald` | 200 但 **0 条** | ❌ 不可解析 | `enabled=false`；替换 Korea Times / Yonhap / Business Korea |
| `siliconcanals` | 200 但最新 **2026-09-22** | ❌ 停更 | `enabled=false`；替换 EU-Startups / Tech.eu |
| `digitalnewsasia` | 200 但最新 **2021-08** | ❌ 停更 | `enabled=false`（注意：该源当前不在 enabled 清单，勿误启用） |
| `moneycontrol` | 200 但最新 **2024-04** | ❌ 疑似停更 | 不推荐入库 |
| `fiercehealthcare` | 200 但最新 **2026-01** | ⚠️ 低频 | 保留观察或替换 |
| `yicaiglobal` | `/rss` 与 `/rss/news` 均 **404** | ❌ URL 失效 | 替换 Pandaily / Sixth Tone / CGTN |
| `caixinglobal` | **403** | ❌ 不可用 | 替换 Pandaily / CGTN |
| `krasia` | SSL 握手超时 / 404 | ❌ 不可用 | 替换 Tech in Asia / Vulcan Post |
| `Arab News` | **403** | ❌ 已被替换（data meta 已记录换 `mena-middleeastmonitor`） | 本轮验证 Middle East Monitor **200/50**，保留；新增 Al-Monitor 作备份 |

> 风险提醒：当前 data/sources.json 中 `e27` 仍为 `enabled=true` 且 `check_result=ok`（v0.9.1 的旧记录），本轮实测 403，**建议 data-engineer 置 `enabled=false` 并更新 `check_result=http_403`**，否则 `--fetch` 会持续失败。

---

## 4. 实测失败清单（不推荐入库，节选 26 个）

| 源 | 实测 | 原因类别 | 替代建议 |
|---|---|---|---|
| uktn | 404 | feed 下线 | Tech.eu / Sifted（现有） |
| tnw | 403 | 反爬 | Tech.eu / Tech Funding News |
| retailgazette | 403 | 反爬 | Retail Dive / Modern Retail（现有） |
| arcticstartup | 403 | 反爬 | ArcticStartup 暂不可采；用 EU-Startups |
| fashionunited | 404 | feed 下线 | — |
| e27 | 403 | Cloudflare | Vulcan Post / Techsauce / TechNode Global |
| krasia | SSL 超时 | 反爬/网络 | Tech in Asia（现有）/ Vulcan Post |
| vietnamnet | 404 | RSS 下线 | VnExpress Business |
| jakartaglobe | 404 | RSS 下线 | Antara（弱）/ Google News ID |
| dealstreetasia | 503 | 服务不可用 | TechNode Global |
| thestar-my | 404 | RSS 下线 | Vulcan Post（东南亚英文） |
| livemint | 超时 | 反爬/慢 | Business Today / BusinessLine |
| business-standard | 超时 | 反爬/慢 | Business Today |
| thehindubusinessline（首页 feed） | 404 | 路径错误 | 用 `companies/feeder/default.rss`（本文件已收录） |
| dawn-business | 403 | 反爬 | Tribune Pakistan |
| profit-pakistan | SSL 超时 / 404 | feed 下线 | Tribune Pakistan |
| entrackr | 403 | 反爬 | Business Today / BusinessLine |
| zawya（所有 RSS 路径） | 404 / 0 条 | RSS 下线 | Al-Monitor / Middle East Monitor |
| gulfnews / khaleejtimes / arabnews / alarabiya | 403 | 反爬 | Al-Monitor / Middle East Monitor / Wamda |
| thenational | 404/超时 | RSS 下线 | Al-Monitor |
| businessdailyafrica / theeastafrican | 404 / 403 | RSS 下线/反爬 | African Business / Capital FM KE |
| mybroadband / moneyweb / ventureburn | 403/超时 | 反爬 | TechCentral ZA / Technext24 |
| eleconomista-mx / economista-mx2 / forbes-mx / neofeed / ambito | 404/403 | 反爬/RSS 下线 | El Financiero / Exame / La Nacion |
| japantoday / japan-forward / nippon | 403/超时/404 | 反爬 | Japan Times（现有，可恢复）/ Asahi |
| yicaiglobal / caixinglobal / chinadaily / globaltimes | 404/403 | URL 失效/反爬 | Pandaily / Sixth Tone / CGTN |
| 220+ 其他候选 | — | — | 见探针原始 JSON（交付前已删除，如需可复跑脚本逻辑） |

---

## 5. 对「高质量商机 100–150 条」的采集与筛选建议（与 task-44 对齐）

1. **接入顺序**：先 P0 10 个（euobserver、techfundingnews、technode-global、businesstoday-in、hindubusinessline-companies、african-business、elfinanciero-mx、yonhap-en、pandaily、pv-magazine），再 P1、P2。
2. **抓取参数**：`max_items=20–30`、`timeout=20s`、`min_interval=5min/域`、`cache=6h`；大 feed（startupitalia/yonhap）截断；`application/xml` 走 XML 解析器而非 JSON。
3. **商业相关性过滤（必须）**：综合新闻源需关键词表：`funding|raises|IPO|revenue|market|export|import|tariff|regulation|ban|shortage|demand|price|launch|subscription|B2B|SME|petition|complaint` + 行业词（宠物/银发/光伏/支付/供应链…）；纯体育/娱乐/犯罪条目剔除。
4. **跨源去重**：同题多源（尤其 Yonhap/Korea Times、El Financiero/La Nacion）按 `canonical URL + title hash + 日期` 去重；配合 task-44 的持久化 ledger。
5. **产能估算**：32 源 × 20 条 × 2 次/日 = 1,280 条原始；去重/过滤后约 150–300 条/日相关信号；人工复核 10–20 条/日 → **10 个工作日可达 100–200 条候选**，满足 100–150 目标。
6. **映射**：每条信号输出 `region_id`（本表区域列）、`industry_ids`（行业列 + 关键词）、`source_id`、`published_at`、`url`、`lang`，进入 `scanner/outbox` 等待人工复核（不直接入机会库）。
7. **合规**：全为公开 RSS；保留原始链接与标题；不全文转载；Google News/聚合器类源保持 yellow（本表未新增聚合器，均为媒体自有 feed）。

---

## 6. 复现与说明

- 探测方法：Python 3.11 `urllib` 并行（16 线程），每源最多 2 次尝试、`User-Agent` 标明 research、接受 `rss/xml/json`；判定可用 = HTTP 200 + `<item>/<entry>` 可解析 + 存在 pubDate/updated + 存在 link/guid + 最新条目 ≥ 2026-10-03 + host 不与现有 200 源重复。
- 交叉验证：`technode`、`rest-of-world`、`japantimes` 用 `curl 8.21` 复测；`technode` curl 200（3.3MB）、`japantimes` 第 3 轮 urllib 200。
- 已知限制：单日/单网络环境（本机出口）；部分海外媒体对数据中心 IP 有 403，生产环境如仍失败应标 `enabled=false` 并记录 `check_result`；TLS 校验在探测时关闭（仅用于测试，不写入生产采集器）。
- 临时探测脚本（`research/_probe_v160*.py`）已在交付前删除，仅保留本文件与数据结论。
