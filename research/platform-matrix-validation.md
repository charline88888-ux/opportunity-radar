# 平台可访问性验证底稿（platform-matrix-validation.md）

> 研究底稿 · 机会雷达 Opportunity Radar · 对应 `data/sources.json`（12 大类）
> **核验日期：2026-10-22（Asia/Shanghai）**
> 方法：`web_fetch` 直连每个平台入口，记录 HTTP 状态/是否需登录/是否被反爬拦截；再结合平台公开文档判断 API/RSS/ToS。
> 说明：单日直连只能证明"当日可访问性"；平台随时改规则，`data/` 中引用时应带 `last_checked: 2026-10-22`。
> 合规分级：**绿** = 公开、明确允许或官方接口 ｜ **黄** = 灰区，需限速/遵守 ToS/仅人工 ｜ **红** = 不建议自动抓取，只人工浏览。

---

## 0. 核验结论摘要

- 本轮共整理 **62 个条目（约 60 个独立平台，12 大类）**；对其中 **20 个平台入口做了 `web_fetch` 直连尝试**：**✅ 成功 14 个**（Reddit RSS、iTunes 评论 RSS、Product Hunt、Naver DataLab、TikTok Creative Center、Amazon Movers、Etsy 开发者文档、Shopify App Store、1688、EUR-Lex、GEM、GitHub Trending、Drewry WCI、Etsy API Terms），**⛔ 被拦截/失败 6 个**（Trustpilot、Google Trends、Jumia、Noon、my.gov.sa、Salam Gateway），**⏳ 其余 42 个为文档级/间接验证**（依据平台公开文档与检索结果判断，未逐页直连）。
- 另：`research/cases.md` 中已对 30+ 个证据页做过直连（含政府/平台/媒体），可与本文件交叉使用。
- 最容易被反爬拦截的：Jumia、Noon、Trustpilot、Google Trends、沙特政府站、Fiverr、LinkedIn、小红书、1688（部分接口）。**不要尝试绕行**，改用替代源或人工。
- 最稳的免费源：政府/监管（EUR-Lex、CCPC、France Num、PEP、国家统计局）、官方 API（YouTube、arXiv、GitHub、World Bank、OECD、Eurostat、openFDA、iTunes RSS、Reddit RSS、GEM、Etsy API）。
- 对个人版扫描器最实用的 8 个源：**Reddit RSS、Naver DataLab、TikTok Creative Center、Amazon Movers & Shakers、Etsy Open API、GEM、Drewry WCI、iTunes Reviews RSS**。

---

## 1. 逐类平台验证表（48 个）

图例：访问 = `api` / `rss` / `html` / `manual` / `paid-api`；合规 = 绿/黄/红；核验 = ✅直连成功 / ⛔拦截 / ⏳文档级（未逐页直连）。

### 1.1 需求与抱怨 `demand`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Reddit | https://www.reddit.com/r/Entrepreneur/.rss | rss/api | 免费（API 有付费档） | 限制商业抓取，需遵守 API Terms；RSS 公开 | 中 | 抱怨/愿望/对比/真实收入 | 🟢 | ✅200，2026-10-22 成功取到条目 |
| 2 | Trustpilot | https://www.trustpilot.com/review/etsy.com | html | 免费浏览 | 明确禁止自动抓取（Business API 另议） | 高 | 1–2 星服务抱怨 | 🔴 | ⛔403 验证页 |
| 3 | Apple App Store 评论 | https://itunes.apple.com/us/rss/customerreviews/page=1/id=389801252/sortby=mostrecent/json | rss | 免费 | 公开 RSS，允许订阅 | 低 | App 差评/功能抱怨 | 🟢 | ✅200 JSON |
| 4 | Product Hunt | https://www.producthunt.com/ | api/html | 免费 | GraphQL API 需 token；页面可读 | 低 | 新品/工具需求/早期采用者 | 🟡 | ✅200 |

### 1.2 趋势与搜索 `trend`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 5 | Google Trends | https://trends.google.com/trends/explore | manual | 免费 | 无官方 API，自动抓取违反 ToS | 高 | 搜索趋势/地区差异 | 🟡 | ⛔429 限流（人工浏览可用） |
| 6 | Naver DataLab（韩） | https://datalab.naver.com/ | api/html | 免费（API 需 key） | 官方 API 有配额；页面公开 | 低 | 韩国搜索/购物趋势 | 🟢 | ✅200，可取 2026-10 日榜 |
| 7 | TikTok Creative Center | https://ads.tiktok.com/business/creativecenter/ | html | 免费 | 页面可浏览；研究/广告 API 分档 | 中 | 广告创意/热梗/爆品 | 🟡 | ✅200 |
| 8 | Amazon Movers & Shakers | https://www.amazon.com/gp/movers-and-shakers | html | 免费 | Amazon ToS 禁止自动抓取 | 中 | 销量飙升/品类缺口 | 🟡 | ✅200（页面可读） |

### 1.3 电商与交易 `marketplace`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 9 | Etsy | https://developers.etsy.com/documentation/ | api | 免费（Commercial Access 审核） | **明确禁止 screen-scraping**，须用 Open API v3 | 中 | 价格带/评价/店铺增长 | 🟡 | ✅200（官方文档） |
| 10 | Amazon Seller/PA-API | https://webservices.amazon.com/paapi5/documentation/ | paid-api | 需联盟/卖家账号 | 禁止抓取，须用 PA-API/SP-API | 高 | 竞品价格/BSR/评论 | 🔴 | ⏳文档级 |
| 11 | eBay | https://developer.ebay.com/ | api | 免费（有配额） | 官方 Browse API 可用 | 中 | 二手价格/需求 | 🟢 | ⏳文档级 |
| 12 | MercadoLibre | https://developers.mercadolibre.com/ | api | 免费（需应用） | 官方 API，有限速 | 中 | 拉美价格/品类 | 🟡 | ⏳文档级（官网新闻 ✅200） |
| 13 | Shopify App Store | https://apps.shopify.com/ | html | 免费 | 页面可读；无公开数据 API | 低 | 商家工具缺口/评价 | 🟡 | ✅200 |
| 14 | Jumia | https://www.jumia.com.ng/ | html | 免费 | 卖家中心接口；站点反爬强 | 高 | 非洲品类/价格 | 🔴 | ⛔403 Cloudflare |
| 15 | Noon（中东） | https://www.noon.com/uae-en/ | html | 免费 | 站点反爬；无公开 API | 高 | 中东品类/价格 | 🔴 | ⛔fetch failed |
| 16 | 1688 | https://www.1688.com/ | html | 免费 | 需登录；开放平台仅卖家 | 高 | 中国供应链价格 | 🟡 | ✅200（首页可达） |

### 1.4 社媒与内容 `social`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 17 | YouTube Data API | https://developers.google.com/youtube/v3 | api | 免费（10,000 配额/日） | 官方 API 允许 | 低 | 内容趋势/长尾需求 | 🟢 | ⏳文档级 |
| 18 | Meta Graph/Marketing API | https://developers.facebook.com/docs/graph-api/ | api | 免费（需应用审核） | 禁止抓取；仅官方 API | 高 | 广告/主页数据 | 🔴 | ⏳文档级 |
| 19 | X（Twitter）API | https://developer.x.com/ | paid-api | 付费档位 | 禁止抓取 | 高 | 舆情/趋势 | 🟡 | ⏳文档级 |
| 20 | Substack / 播客 RSS | https://substack.com/ | rss | 免费 | 公开 RSS 可订阅 | 低 | 付费内容主题/受众 | 🟢 | ⏳文档级 |
| 21 | 小红书 | https://www.xiaohongshu.com/ | manual | 免费 | 无公开 API，反爬强 | 高 | 中文消费趋势 | 🔴 | ⏳文档级（不自动抓） |
| 22 | Pinterest Trends | https://trends.pinterest.com/ | html | 免费 | 页面可浏览；API v5 需 token | 中 | 欧美审美/礼品 | 🟡 | ⏳文档级 |

### 1.5 政策与监管 `policy`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 23 | EUR-Lex | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956 | html/api | 免费 | 公开法规，允许引用 | 低 | 新法规/CBAM/PPWR | 🟢 | ✅202 可访问 |
| 24 | 欧盟 TARIC | https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp | html | 免费 | 公开 | 低 | 关税/编码 | 🟢 | ⏳文档级 |
| 25 | 美国 CBP | https://www.cbp.gov/trade | html | 免费 | 公开 | 低 | 关税/清关 | 🟢 | ⏳文档级 |
| 26 | 美国 FDA / openFDA | https://open.fda.gov/apis/ | api | 免费 | 官方 API | 低 | 产品合规/召回 | 🟢 | ⏳文档级 |
| 27 | 中国商务部（WTO 事务局） | http://chinawto.mofcom.gov.cn/ | html | 免费 | 公开 | 低 | 出口合规/PPWR | 🟢 | ⏳文档级（2026-10 文章存在） |
| 28 | 沙特政府门户 | https://my.gov.sa/ | html | 免费 | 公开但 Cloudflare | 高 | 沙特电商/政策 | 🟡 | ⛔403 |
| 29 | 日本观光厅 | https://www.mlit.go.jp/kankocho/ | html | 免费 | 公开 PDF | 低 | 入境游/消费 | 🟢 | ⏳文档级（2025 年报存在） |

### 1.6 资本与融资 `capital`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 30 | SEC EDGAR | https://www.sec.gov/edgar/search/ | api | 免费 | 官方全文检索 API | 低 | 上市公司/行业财报 | 🟢 | ⏳文档级 |
| 31 | Crunchbase | https://www.crunchbase.com/ | paid-api | 付费 | 禁止抓取 | 高 | 融资事件 | 🟡 | ⏳文档级 |
| 32 | GEM（全球创业观察） | https://www.gemconsortium.org/report | html | 免费 | 报告免费下载 | 低 | 创业环境/国别 | 🟢 | ✅200（2025/2026 报告） |
| 33 | IT桔子（中） | https://www.itjuzi.com/ | paid-api | 付费 | 付费数据 | 中 | 中国融资 | 🟡 | ⏳文档级 |

### 1.7 学术与技术 `academic`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 34 | arXiv | https://arxiv.org/ | api | 免费 | 官方 API 允许 | 低 | 新技术/论文 | 🟢 | ⏳文档级 |
| 35 | GitHub Trending | https://github.com/trending | html/api | 免费 | 页面可读；REST API 有配额 | 低 | 开发者趋势/工具 | 🟢 | ✅200 |
| 36 | Google Patents | https://patents.google.com/ | html | 免费 | 页面可读；批量需 BigQuery | 中 | 专利/技术空白 | 🟡 | ⏳文档级 |
| 37 | Hugging Face | https://huggingface.co/ | api | 免费 | 官方 API | 低 | AI 模型/应用趋势 | 🟢 | ⏳文档级 |

### 1.8 供应链与价格 `supply`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 38 | Drewry WCI | https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry | html | 免费（指数）；追踪器需注册 | 公开可引用 | 低 | 海运运价/成本 | 🟢 | ✅200（2026-10-15 WCI $4,485/40ft） |
| 39 | Freightos FBX | https://fbx.freightos.com/ | html | 免费指数 | 公开 | 低 | 空运/海运价格 | 🟢 | ⏳文档级 |
| 40 | 上海航运交易所 SCFI | https://www.sse.net.cn/ | html | 免费 | 公开周报 | 低 | 中国出口运价 | 🟢 | ⏳文档级 |
| 41 | Alibaba.com | https://www.alibaba.com/ | html | 免费 | 无公开商品 API；反爬强 | 高 | 供应价格/新品 | 🟡 | ⏳文档级 |
| 42 | 中国海关总署 | http://www.customs.gov.cn/ | html | 免费 | 公开统计 | 低 | 进出口量价 | 🟢 | ⏳文档级 |
| 43 | Trading Economics | https://tradingeconomics.com/ | api | 免费额度+付费 | API 需 key | 中 | 宏观/汇率/价格 | 🟡 | ⏳文档级 |

### 1.9 文化与宗教 `culture`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 44 | Pew Research | https://www.pewresearch.org/ | html | 免费 | 公开报告 | 低 | 宗教/人口/价值观 | 🟢 | ⏳文档级 |
| 45 | Hofstede Insights | https://www.hofstede-insights.com/country-comparison-tool | html | 免费工具 | 公开 | 低 | 文化六维 | 🟢 | ⏳文档级 |
| 46 | World Values Survey | https://www.worldvaluessurvey.org/ | html | 免费数据 | 公开 | 低 | 价值观差异 | 🟢 | ⏳文档级 |
| 47 | Salam Gateway（伊斯兰经济） | https://salaamgateway.com/ | html | 免费 | 公开 | 低 | 清真/伊斯兰金融 | 🟡 | ⛔跨域重定向（需直连） |
| 48 | 伊斯兰历/节日日历 | https://www.islamicfinder.org/ | html | 免费 | 公开 | 低 | 斋月/开斋节时点 | 🟢 | ⏳文档级 |

### 1.10 服务与人才 `talent`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 49 | Upwork | https://www.upwork.com/ | html | 免费浏览 | 禁止抓取；API 需合作 | 中 | 服务需求/报价 | 🟡 | ⏳文档级 |
| 50 | Fiverr | https://www.fiverr.com/ | html | 免费浏览 | 禁止抓取 | 高 | 微型服务价格 | 🔴 | ⏳文档级 |
| 51 | LinkedIn Jobs | https://www.linkedin.com/jobs/ | manual | 免费 | **明确禁止**抓取 | 高 | 岗位/技能需求 | 🔴 | ⏳文档级 |
| 52 | RemoteOK | https://remoteok.com/ | api | 免费 | 公开 API | 低 | 远程岗位趋势 | 🟢 | ⏳文档级 |

### 1.11 数据与研究机构 `data`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 53 | World Bank Open Data | https://data.worldbank.org/ | api | 免费 | 官方 API | 低 | 国别宏观 | 🟢 | ⏳文档级 |
| 54 | OECD Data | https://data.oecd.org/ | api | 免费 | 官方 SDMX API | 低 | 发达国家指标 | 🟢 | ⏳文档级 |
| 55 | Eurostat | https://ec.europa.eu/eurostat | api | 免费 | 官方 API | 低 | 欧盟市场数据 | 🟢 | ⏳文档级 |
| 56 | 中国国家统计局 | https://www.stats.gov.cn/ | html | 免费 | 公开 | 低 | 中国人口/消费 | 🟢 | ⏳文档级（2025 人口公报 2026-01-19） |
| 57 | Statista | https://www.statista.com/ | paid | 付费 | 禁止抓取 | 高 | 行业规模 | 🟡 | ⏳文档级 |

### 1.12 平台规则与开放生态 `platform`

| # | 平台 | 入口 URL | 访问 | 收费 | ToS 抓取限制 | 反爬强度 | 适合信号 | 合规 | 核验 |
|---|---|---|---|---|---|---|---|---|---|
| 58 | Etsy API Terms | https://www.etsy.com/legal/api | html | 免费 | 明确禁止 scraping；需注册 app | 中 | 平台规则/卖家工具 | 🟡 | ✅文档可访问（developers.etsy.com ✅200） |
| 59 | Shopify Dev Changelog | https://shopify.dev/changelog | rss/html | 免费 | 公开 | 低 | 平台新功能/套利 | 🟢 | ⏳文档级 |
| 60 | Google Play 政策 | https://play.google.com/about/developer-content-policy/ | html | 免费 | 公开 | 低 | 应用合规 | 🟢 | ⏳文档级 |
| 61 | Apple App Store 审核指南 | https://developer.apple.com/app-store/review/guidelines/ | html | 免费 | 公开 | 低 | 应用合规/新品类 | 🟢 | ⏳文档级 |
| 62 | Stripe 文档/费率 | https://stripe.com/pricing | html | 免费 | 公开 | 低 | 支付能力/费率 | 🟢 | ⏳文档级 |

> 合计 62 个条目（部分平台重复出现在不同用途，实际独立平台 48+）。满足"≥40 个平台、12 大类"要求。

---

## 2. 合规分级标准（给 `data/sources.json` 的 compliance 取值）

| 等级 | 判定条件 | 允许动作 | 例子 |
|---|---|---|---|
| 🟢 绿 | 官方 API/RSS；或政府/研究机构公开文件；ToS 明确允许 | 自动采集、限频 1 req/s、缓存 24h | YouTube API、arXiv、GEM、EUR-Lex、Drewry、iTunes RSS、Reddit RSS |
| 🟡 黄 | 页面公开但 ToS 禁止抓取或未明确；需登录/付费墙边缘 | 只读人工浏览；自动采集需限频、只取公开字段、不绕过登录；保留原始链接 | Etsy（用 API）、Amazon Movers（人工）、TikTok CC（人工）、Google Trends（人工）、Upwork |
| 🔴 红 | 明确禁止 + 强反爬（Cloudflare/验证码）；或涉及个人信息/付费墙 | 只人工浏览；**不自动抓取**；改用官方合作/替代源 | Jumia、Noon、Trustpilot、Fiverr、LinkedIn、Meta、小红书、Statista |

**通用红线**：
1. 不绕过登录/付费墙/验证码；不使用代理池对抗反爬。
2. 不采集个人信息（用户名可公开，但不得聚合个人画像）。
3. 遵守 `robots.txt`；每域限速 ≤1 请求/秒；夜间批量。
4. 抓取内容只用于个人研究，不转售原始数据；引用必须带原始 URL。
5. 平台改规则后 7 天内更新 `data/sources.json`（源健康度 SOP 见 docs/08）。

---

## 3. 采集频率与信号类型建议

| 类别 | 建议频率 | 单次动作 | 输出 |
|---|---|---|---|
| demand | 每日 | 5 个 subreddit RSS + 1 个 App 评论 RSS | 10 条抱怨/愿望 |
| trend | 每日/每周 | Naver DataLab 日榜 + TikTok CC Top Ads + Amazon Movers 前 20 | 5 个异常上升词 |
| marketplace | 每周 | Etsy API 搜 10 个关键词、记录价格/评价数 | 价格带与竞争度 |
| social | 每周 | YouTube/TikTok 话题 + Substack RSS | 3 个内容缺口 |
| policy | 每周 | EUR-Lex/CCPC/商务部/观光厅挂网 | 1–2 条新规 |
| capital | 每月 | GEM/EDGAR/融资新闻 | 1 个赛道热度 |
| academic | 每月 | arXiv/GitHub Trending | 1 个技术拐点 |
| supply | 每周 | Drewry WCI + SCFI + 1688 报价 | 运价/成本变化 |
| culture | 每月 | Pew/Hofstede/WVS + 宗教日历 | 1 个文化差异点 |
| talent | 每月 | Upwork/Fiverr 搜索量价 | 1 个服务缺口 |
| data | 每月 | World Bank/OECD/Eurostat/统计局 | 宏观校验 |
| platform | 每周 | Shopify changelog/Etsy ToS/App Store 指南 | 平台规则变化 |

---

## 4. 被拦截源的替代方案表

| 被拦平台 | 原因 | 替代源 | 用法 |
|---|---|---|---|
| Jumia / Noon | Cloudflare / 区域反爬 | 卖家中心公告、非洲/中东媒体（Nairametrics、Economy Middle East）、MercadoLibre 同类数据 | 只做二手交叉 |
| Trustpilot | 验证页 | Reddit/App Store RSS + 品牌官方论坛 | 用户原声替代 |
| Google Trends | 429 限流 | Naver DataLab（韩）、TikTok CC（全球）、Amazon Movers（美） | 趋势三角验证 |
| Meta/Instagram | 禁止抓取 | YouTube API/公开主页人工浏览 | 不自动采集 |
| 小红书 | 反爬 | 人工浏览 + 微信指数（需授权） | 只手动记录 |
| Statista/PitchBook | 付费墙 | 政府统计、GEM、上市公司财报 | 免费替代 |
| 沙特 my.gov.sa | Cloudflare | PEP 官网（✅已直连）、沙特媒体、GEM | 官方数据优先 |
| Salam Gateway | 跨域重定向 | 直连 https://salaamgateway.com/ 或 SGIE 报告 PDF | 人工下载 |

---

## 5. 对 `data/sources.json` 的字段建议

```json
{
  "id": "reddit",
  "name": "Reddit",
  "url": "https://www.reddit.com",
  "regions": ["north-america", "europe"],
  "signal_types": ["complaint", "wish", "comparison"],
  "access": "rss",
  "frequency": "daily",
  "cost": "free",
  "compliance": "green",
  "value_score": 9.2,
  "last_checked": "2026-10-22",
  "check_result": "http_200_rss",
  "notes": "RSS 公开可订阅；API 有付费档；遵守 ToS，限速 ≤1 req/s"
}
```

- `compliance` 只能取 `green/yellow/red`（与 docs/12 一致）。
- `last_checked` 用 `2026-10-22`；`check_result` 建议枚举：`http_200` / `http_403` / `http_429` / `login_required` / `doc_only`。
- 每个源至少给 1 个「具体入口 URL」（本文件 §1 已给）。
