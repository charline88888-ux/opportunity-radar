# v0.6.0 机会卡候选 JSON（handoff-expansion.md）

> 配套 `research/cases-expansion.md`。**34 张候选卡**，按 `docs/12 §4` 机会卡结构编写，可直接被 data-engineer 合并进 `data/opportunities.json`。
> 说明：`scores`、`window`、`rank_score` 未填——由 data-engineer 用 `scanner` 公式统一重算（避免手算误差）。
> **`verified` 口径**：34 条本轮全部为 `false`（第二来源多为 ⏳，按 docs/12「所有证据 URL 可访问」不得标 true）；`meta.verified_opened_ids` 列出 **19 条主证据已实开（✅）且引文相符**的候选，data-engineer 复开第二来源后可置 `true`——现有 46 条已有 5 条 true，新增 ≥7 条即可满足 v0.6 的 ≥12 目标。
> 证据 `tier`：`primary`=官方/平台/用户原声；`secondary`=媒体/报告。✅=本轮 `web_fetch` 实开；⏳=仅检索/未直连。
> JSON 已通过 `json.loads` 校验（34 条、id 唯一、每条 evidence ≥2、七问 7 字段、ROI 7 字段、动作 ≥4、证伪 ≥3、风险 ≥3）。
> 检索与核验日期：**2026-10-22**。

```json
{
  "meta": {
    "target": "data/opportunities.json",
    "data_version": "0.6.0",
    "generated": "2026-10-22",
    "count": 34,
    "id_range": "071-104",
    "verified_opened_ids": [
      "opp-cis-kazakh-cement-073",
      "opp-africa-ethiopia-coffee-076",
      "opp-africa-kenya-avocado-077",
      "opp-latam-mexico-nearshoring-081",
      "opp-latam-chile-cherry-082",
      "opp-latam-petfood-ecom-083",
      "opp-sasia-bangladesh-rmg-086",
      "opp-mena-saudi-women-gym-090",
      "opp-mena-uae-medtourism-091",
      "opp-mena-halal-preparedfood-092",
      "opp-mena-umrah-goods-093",
      "opp-oceania-au-pet-insurance-094",
      "opp-china-ai-toys-096",
      "opp-china-hanfu-097",
      "opp-china-usedcar-service-098",
      "opp-china-silver-travel-099",
      "opp-china-county-coffee-100",
      "opp-china-guzi-overseas-101",
      "opp-cis-eac-cert-104"
    ],
    "verified_note": "以下 id 的主证据已实开（✅）且引文与页面相符；第二来源多为 ⏳，data-engineer 复开第二来源后可将该条 verified 置 true（现有 46 条已有 5 条 true，只需新增 ≥7 条即可满足 ≥12 目标）"
  },
  "candidates": [
    {
      "id": "opp-cis-ozon-regional-071",
      "slug": "cis-ozon-regional-ops",
      "title": "Ozon 民族地区下沉代运营",
      "one_liner": "Ozon 2025 GMV 4.16 万亿卢布（+45%），中国卖家在民族自治共和国订单最高增 20 倍，代运营窗口打开",
      "industry_id": "crossborder",
      "gap_type_ids": [
        "platform",
        "channel",
        "geo"
      ],
      "region_ids": [
        "cis"
      ],
      "origin_country": "俄罗斯",
      "target_countries": [
        "俄罗斯",
        "哈萨克斯坦",
        "白俄罗斯"
      ],
      "human_need_ids": [
        "ease",
        "status"
      ],
      "neuro_drivers": [
        "dopamine",
        "serotonin"
      ],
      "emotion_tags": [
        "aspiration",
        "envy"
      ],
      "source_langs": [
        "ru",
        "zh"
      ],
      "signal": {
        "summary": "Ozon 2025 年 GMV 4.16 万亿卢布（+45%）、活跃买家 6,510 万；中国卖家在巴什科尔托斯坦订单量同比增 20 倍、鞑靼斯坦 19 倍、滨海边疆区/莫斯科 9 倍。区域下沉是 2026 年最明确的增量，但中国团队普遍只做莫斯科/圣彼得堡。",
        "signal_strength": 8.4,
        "trend_direction": "up",
        "volume_estimate": "Ozon 2025 GMV 4.16 万亿卢布；中国卖家订单区域最高 +20 倍",
        "evidence": [
          {
            "title": "俄罗斯头部电商平台 Ozon 公布 2025 年度业绩：GMV 增长 45%，活跃买家突破 6510 万",
            "publisher": "亿欧",
            "url": "https://www.iyiou.com/news/202603301125610",
            "date": "2026-03-30",
            "quote": "全年 GMV 达 4.16 万亿卢布，同比增长 45%；活跃买家 6510 万；巴什科尔托斯坦订单量同比激增 20 倍",
            "lang": "zh",
            "tier": "secondary"
          },
          {
            "title": "Ozon 新手指南（卖家入驻与运营）",
            "publisher": "出海网",
            "url": "https://www.chwang.com/guide/ozon",
            "date": "2026",
            "quote": "Ozon 对中国卖家开放跨境与本土店模式（标题级，未直连）",
            "lang": "zh",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "Ozon 卖家社群/服务商榜单 + 俄语区中国卖家群 + 平台招商会；前 10 个客户来自已有 Ozon 店铺但只做核心城市的卖家",
        "money": "代运营月费 8,000–20,000 元/店 + 销售额 5%–10% 分成；或按品类项目收费",
        "model": "2–3 人代运营工作室：选品→俄语 listing→广告→区域物流方案→复盘；轻资产",
        "roi": "启动 1–3 万元（俄语外包/工具/样品）；2 个月首单，5 个月回本；月收入 2–6 万元；毛利 55%",
        "audience": "有跨境电商运营经验、能协调俄语翻译/客服的 2–3 人团队；不适合纯新手",
        "drivers": [
          "cross-border",
          "ops"
        ],
        "moat": "区域物流数据 + 俄语内容 + 店铺案例；窗口期 12–18 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 10000,
          "max": 30000
        },
        "time_to_revenue_months": 2,
        "payback_months": 5,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 60000
        },
        "gross_margin_pct": 55,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "卢布汇率波动导致回款缩水",
        "Ozon 平台规则/佣金调整",
        "俄语区本地代运营竞争加剧"
      ],
      "first_steps_7d": [
        "注册 Ozon 卖家账号并拉取 2025 区域订单榜",
        "找 3 个俄罗斯民族地区物流报价对比",
        "用 1 个店铺做俄语 listing A/B 测试",
        "联系 2 家俄语客服外包报价"
      ],
      "kill_criteria": [
        "3 个月无店铺签约",
        "区域物流成本高于莫斯科 30% 以上",
        "Ozon 收紧中国卖家入驻"
      ],
      "compliance_notes": "跨境结算需合规渠道；商品需 EAC 认证（见 104）；不得虚构平台数据",
      "tags": [
        "china-advantage",
        "cross-border",
        "b2b",
        "platform-dependent",
        "localization-heavy"
      ],
      "verified": false
    },
    {
      "id": "opp-cis-ozon-asian-goods-072",
      "slug": "cis-ozon-asian-goods",
      "title": "俄罗斯亚洲食品/谷子跨境",
      "one_liner": "Ozon 2025 奶茶销售增近 9 倍、亚洲零食约 6 倍、动漫手办近 2 倍，中国供应链可直接切入",
      "industry_id": "crossborder",
      "gap_type_ids": [
        "time",
        "channel",
        "platform"
      ],
      "region_ids": [
        "cis"
      ],
      "origin_country": "中国",
      "target_countries": [
        "俄罗斯",
        "哈萨克斯坦"
      ],
      "human_need_ids": [
        "novelty",
        "expression"
      ],
      "neuro_drivers": [
        "dopamine"
      ],
      "emotion_tags": [
        "curiosity",
        "pride"
      ],
      "source_langs": [
        "ru",
        "zh"
      ],
      "signal": {
        "summary": "亚洲文化在俄罗斯受热捧：Ozon 2025 年奶茶销售增长近 9 倍、亚洲零食约 6 倍、动漫手办近 2 倍；中国供应链在食品原料/谷子/周边上有成本与款式优势，缺的是俄语内容与本地合规。",
        "signal_strength": 8.2,
        "trend_direction": "up",
        "volume_estimate": "奶茶 +9 倍、亚洲零食 +6 倍、动漫手办 +2 倍（Ozon 2025）",
        "evidence": [
          {
            "title": "Ozon 2025 年度业绩：中国卖家品类增长",
            "publisher": "亿欧",
            "url": "https://www.iyiou.com/news/202603301125610",
            "date": "2026-03-30",
            "quote": "奶茶销售增长近 9 倍，亚洲零食约 6 倍，动漫手办近 2 倍",
            "lang": "zh",
            "tier": "secondary"
          },
          {
            "title": "Ozon 卖家品类与运营指南",
            "publisher": "出海网",
            "url": "https://www.chwang.com/guide/ozon",
            "date": "2026",
            "quote": "（标题级，未直连）",
            "lang": "zh",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "Ozon 站内搜索/类目 + TikTok/Telegram 亚洲文化社群 + 俄语 KOL 开箱",
        "money": "实物差价 40%–60%；奶茶原料复购强；手办/谷子客单 1,500–5,000 卢布",
        "model": "跨境店/本土店 + 中国产业带直发/莫斯科海外仓",
        "roi": "启动 2–5 万元（首批货/俄语包装/内容）；2 个月首单，6 个月回本；月收入 3–10 万元；毛利 45%",
        "audience": "懂俄语内容或与俄语博主合作、有食品/谷子供应链资源的人",
        "drivers": [
          "cross-border",
          "info",
          "supply"
        ],
        "moat": "俄语内容 + 品类先发 + 供应链；窗口期 9–15 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 20000,
          "max": 50000
        },
        "time_to_revenue_months": 2,
        "payback_months": 6,
        "monthly_revenue_cny": {
          "min": 30000,
          "max": 100000
        },
        "gross_margin_pct": 45,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "食品进口检疫与俄语标签",
        "IP 侵权（未授权动漫周边）",
        "卢布汇率与物流时效"
      ],
      "first_steps_7d": [
        "在 Ozon 搜 10 个亚洲零食/谷子关键词记录价格与评价",
        "找 2 家俄罗斯食品进口清关代理报价",
        "联系 1 个俄语短视频博主试拍",
        "核算奶茶原料到莫斯科的到岸成本"
      ],
      "kill_criteria": [
        "食品清关 3 个月未跑通",
        "IP 授权无法解决",
        "到岸成本高于本地零售价 60%"
      ],
      "compliance_notes": "食品需符合 EAC/俄语标签；动漫周边需 IP 授权；不得销售违禁品",
      "tags": [
        "china-advantage",
        "cross-border",
        "physical",
        "content-driven",
        "needs-supply-chain"
      ],
      "verified": false
    },
    {
      "id": "opp-cis-kazakh-cement-073",
      "slug": "cis-kazakh-cement",
      "title": "哈萨克水泥项目配套服务",
      "one_liner": "中哈 2 亿美元水泥厂落地阿克托别，年产 130 万吨、本地化 ≥50%，设备/备件/翻译配套需求明确",
      "industry_id": "manufacturing",
      "gap_type_ids": [
        "geo",
        "regulation",
        "price"
      ],
      "region_ids": [
        "cis"
      ],
      "origin_country": "哈萨克斯坦",
      "target_countries": [
        "哈萨克斯坦",
        "乌兹别克斯坦",
        "吉尔吉斯斯坦"
      ],
      "human_need_ids": [
        "survival",
        "control"
      ],
      "neuro_drivers": [
        "serotonin",
        "cortisol"
      ],
      "emotion_tags": [
        "hope",
        "pride"
      ],
      "source_langs": [
        "ru",
        "kk",
        "zh"
      ],
      "signal": {
        "summary": "QazCement 与中材水泥（Sinoma/CNBM）推进阿克托别 2 亿美元水泥厂：年产 130 万吨、可扩至 250 万吨，建设期 900 岗位、投产后 250 岗位，投资协议要求 ≥50% 产量供本国并培训本地员工。中企总包带来设备备件、安装、本地采购与翻译需求。",
        "signal_strength": 7.8,
        "trend_direction": "up",
        "volume_estimate": "项目总投资约 2 亿美元；年产 130 万吨",
        "evidence": [
          {
            "title": "Kazakhstan and China advance USD 200 mln cement plant project in Aktobe region",
            "publisher": "Kazinform",
            "url": "https://qazinform.com/news/kazakhstan-and-china-advance-usd-200-mln-cement-plant-project-in-aktobe-region-e4b501",
            "date": "2025-11-13",
            "quote": "total value of approximately 200 million US dollars; annual capacity of 1.3 million tons; at least 50% of production to the domestic market",
            "lang": "en",
            "tier": "primary"
          },
          {
            "title": "哈中投资合作新闻稿",
            "publisher": "哈萨克斯坦外交部",
            "url": "https://sk.kz/press-center/news/78292/?lang=en",
            "date": "2025",
            "quote": "（标题级，未直连）",
            "lang": "en",
            "tier": "primary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "中材/CNBM 供应链名录 + 哈萨克斯坦投资委员会/州政府招商 + 中哈商会",
        "money": "设备备件贸易差价 15%–30%；安装/调试服务按项目；翻译/本地采购代理月费",
        "model": "B2B 贸易+服务：对接中企总包与哈方分包",
        "roi": "启动 5–20 万元（样册/差旅/资质）；6 个月首单，12 个月回本；月收入 3–15 万元；毛利 25%",
        "audience": "有俄语能力/中亚资源、做过工程配套贸易的人；不适合纯小白",
        "drivers": [
          "supply",
          "capital"
        ],
        "moat": "本地关系 + 供应商授权；窗口期 24–36 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 50000,
          "max": 200000
        },
        "time_to_revenue_months": 6,
        "payback_months": 12,
        "monthly_revenue_cny": {
          "min": 30000,
          "max": 150000
        },
        "gross_margin_pct": 25,
        "effort_level": "full",
        "team_size": 2
      },
      "risks": [
        "项目延期/预算削减",
        "本地化采购与合规要求",
        "地缘与制裁外溢"
      ],
      "first_steps_7d": [
        "整理中材/CNBM 供应商名录与招标信息",
        "联系哈萨克斯坦投资委员会获取项目清单",
        "找 2 家俄语工程翻译报价",
        "调研本地水泥备件价格"
      ],
      "kill_criteria": [
        "项目 6 个月无进展",
        "本地化要求导致中国设备无法进入",
        "回款周期超过 12 个月"
      ],
      "compliance_notes": "工程/设备需 EAC 认证；本地含量要求需合同约定；反商业贿赂",
      "tags": [
        "china-advantage",
        "b2b",
        "needs-supply-chain",
        "physical"
      ],
      "verified": false
    },
    {
      "id": "opp-cis-russian-l10n-074",
      "slug": "cis-russian-l10n",
      "title": "俄语区本地化与客服外包",
      "one_liner": "Ozon 中国卖家高速增长，俄语 listing/客服/售后供给不足，远程外包月费模式可验证",
      "industry_id": "local",
      "gap_type_ids": [
        "language",
        "knowledge"
      ],
      "region_ids": [
        "cis"
      ],
      "origin_country": "中国",
      "target_countries": [
        "俄罗斯",
        "哈萨克斯坦"
      ],
      "human_need_ids": [
        "ease",
        "control"
      ],
      "neuro_drivers": [
        "serotonin"
      ],
      "emotion_tags": [
        "relief"
      ],
      "source_langs": [
        "ru",
        "zh"
      ],
      "signal": {
        "summary": "Ozon 2025 年中国卖家在俄区域市场爆发（民族地区订单最高 +20 倍），但中国卖家普遍缺俄语 listing、客服与售后能力；俄语专业人才与本地化工作室供给不足。",
        "signal_strength": 7.6,
        "trend_direction": "up",
        "volume_estimate": "Ozon 中国卖家订单区域最高 +20 倍（2025）",
        "evidence": [
          {
            "title": "Ozon 2025 年度业绩：中国卖家区域增长",
            "publisher": "亿欧",
            "url": "https://www.iyiou.com/news/202603301125610",
            "date": "2026-03-30",
            "quote": "巴什科尔托斯坦订单量同比激增 20 倍；鞑靼斯坦增长 19 倍",
            "lang": "zh",
            "tier": "secondary"
          },
          {
            "title": "Ozon 卖家运营指南",
            "publisher": "出海网",
            "url": "https://www.chwang.com/guide/ozon",
            "date": "2026",
            "quote": "（标题级，未直连）",
            "lang": "zh",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "Ozon/ Wildberries 中国卖家群 + 跨境服务商平台 + 俄语留学生社群",
        "money": "客服外包 3,000–8,000 元/店/月；listing 翻译按条 5–15 元；售后按单",
        "model": "远程工作室：俄语团队 + SOP + 平台后台代操作",
        "roi": "启动 5,000–15,000 元（招聘/培训/工具）；1 个月首单，3 个月回本；月收入 1.5–5 万元；毛利 60%",
        "audience": "俄语专业/留学生、有跨境电商客服经验的人；可兼职",
        "drivers": [
          "ops",
          "info"
        ],
        "moat": "俄语人才 + 平台 SOP + 响应速度；窗口期 18–24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 5000,
          "max": 15000
        },
        "time_to_revenue_months": 1,
        "payback_months": 3,
        "monthly_revenue_cny": {
          "min": 15000,
          "max": 50000
        },
        "gross_margin_pct": 60,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "平台封号/规则变化",
        "俄语人才流失",
        "价格战"
      ],
      "first_steps_7d": [
        "在 3 个跨境卖家群发服务介绍",
        "做 1 份俄语客服 SOP 模板",
        "找 2 名俄语兼职试岗",
        "报价对比 3 家现有外包"
      ],
      "kill_criteria": [
        "2 个月无付费客户",
        "客户续费率 <50%",
        "平台禁止第三方代操作"
      ],
      "compliance_notes": "不得代客户违规刷单；客户数据保密；平台账号操作需客户授权",
      "tags": [
        "remote",
        "b2b",
        "localization-heavy",
        "low-capital"
      ],
      "verified": false
    },
    {
      "id": "opp-cis-ozon-payout-075",
      "slug": "cis-ozon-payout",
      "title": "Ozon 卖家卢布回款顾问",
      "one_liner": "Ozon 中国卖家 GMV 高增，卢布回款/汇率/合规单据是隐性成本，顾问式服务可切入",
      "industry_id": "fintech",
      "gap_type_ids": [
        "infrastructure",
        "regulation",
        "platform"
      ],
      "region_ids": [
        "cis"
      ],
      "origin_country": "中国",
      "target_countries": [
        "俄罗斯",
        "哈萨克斯坦"
      ],
      "human_need_ids": [
        "control",
        "survival"
      ],
      "neuro_drivers": [
        "cortisol"
      ],
      "emotion_tags": [
        "anxiety",
        "relief"
      ],
      "source_langs": [
        "ru",
        "zh"
      ],
      "signal": {
        "summary": "Ozon 2025 年中国卖家订单与 GMV 高速增长，但卢布结算、汇率损失、合规单据与对账是普遍痛点；持牌支付机构之外缺“顾问+对账工具”层。",
        "signal_strength": 7.4,
        "trend_direction": "up",
        "volume_estimate": "Ozon 2025 GMV 4.16 万亿卢布；中国卖家增长为主要增量",
        "evidence": [
          {
            "title": "Ozon 2025 年度业绩",
            "publisher": "亿欧",
            "url": "https://www.iyiou.com/news/202603301125610",
            "date": "2026-03-30",
            "quote": "中国卖家表现亮眼；平台持续加大对中国市场资源投入",
            "lang": "zh",
            "tier": "secondary"
          },
          {
            "title": "Ozon 卖家回款与结算指南",
            "publisher": "出海网",
            "url": "https://www.chwang.com/guide/ozon",
            "date": "2026",
            "quote": "（标题级，未直连）",
            "lang": "zh",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "Ozon 卖家群 + 跨境支付服务商转介 + 行业沙龙",
        "money": "回款方案咨询 5,000–20,000 元/项目；对账 SaaS 月费 500–2,000 元/店",
        "model": "顾问 + 工具：与持牌支付机构合作，不碰资金池",
        "roi": "启动 1–5 万元（合规咨询/工具开发）；3 个月首单，8 个月回本；月收入 1–4 万元；毛利 70%",
        "audience": "有跨境支付/财务背景、能与持牌机构合作的人；需合规意识",
        "drivers": [
          "capital",
          "regulation"
        ],
        "moat": "持牌合作渠道 + 对账工具；窗口期 12–18 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 10000,
          "max": 50000
        },
        "time_to_revenue_months": 3,
        "payback_months": 8,
        "monthly_revenue_cny": {
          "min": 10000,
          "max": 40000
        },
        "gross_margin_pct": 70,
        "effort_level": "side",
        "team_size": 1
      },
      "risks": [
        "支付牌照/反洗钱红线",
        "制裁合规变化",
        "客户数据安全"
      ],
      "first_steps_7d": [
        "调研 3 家持牌跨境支付机构的俄语区方案",
        "访谈 5 个 Ozon 卖家回款痛点",
        "做 1 份回款成本测算模板",
        "咨询律师合规边界"
      ],
      "kill_criteria": [
        "无法与持牌机构合作",
        "合规成本高于客户支付意愿",
        "制裁导致通道中断"
      ],
      "compliance_notes": "不得无牌从事支付结算/资金池；遵守制裁与反洗钱规定；只做咨询与工具",
      "tags": [
        "china-advantage",
        "needs-license",
        "b2b",
        "remote"
      ],
      "verified": false
    },
    {
      "id": "opp-africa-ethiopia-coffee-076",
      "slug": "africa-ethiopia-coffee",
      "title": "埃塞俄比亚咖啡对华直采",
      "one_liner": "埃塞对华咖啡 2025-26 财年近 4.8 万吨、3.47 亿美元，零关税下直采与烘焙品牌窗口打开",
      "industry_id": "crossborder",
      "gap_type_ids": [
        "geo",
        "price",
        "channel"
      ],
      "region_ids": [
        "africa"
      ],
      "origin_country": "埃塞俄比亚",
      "target_countries": [
        "埃塞俄比亚",
        "中国",
        "肯尼亚"
      ],
      "human_need_ids": [
        "novelty",
        "status"
      ],
      "neuro_drivers": [
        "dopamine"
      ],
      "emotion_tags": [
        "curiosity",
        "pride"
      ],
      "source_langs": [
        "en",
        "zh"
      ],
      "signal": {
        "summary": "2025-2026 财年埃塞对华出口咖啡近 4.8 万吨、3.47 亿美元（量 +40%、值 +58%），对华年均增长 27%，中国为第三大市场；中国零关税政策与 CIIE 推动直采。AWO Coffee 约 90% 烘焙产品销往中国。",
        "signal_strength": 8.3,
        "trend_direction": "up",
        "volume_estimate": "对华 4.8 万吨/3.47 亿美元（FY2025-26）",
        "evidence": [
          {
            "title": "China's growing market opens new doors for Ethiopia's coffee industry",
            "publisher": "中国贸促会（转人民网）",
            "url": "https://en.ccpit.org/infoById/89bdd76f97bd11f1b59f0242ac1a0702/4",
            "date": "2026-08-14",
            "quote": "Ethiopia exported nearly 48,000 tons of coffee to China, valued at $347 million, with volumes and value rising by about 40 percent and 58 percent",
            "lang": "en",
            "tier": "primary"
          },
          {
            "title": "China's growing market opens new doors for Ethiopia's coffee industry",
            "publisher": "People's Daily",
            "url": "https://peoplesdaily.pdnews.cn/business/er/30052927770",
            "date": "2026-08-14",
            "quote": "（标题级，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "CIIE/进博会 + 中国咖啡烘焙商社群 + 埃塞驻华使馆/商会",
        "money": "生豆贸易差价 10%–20%；烘焙品牌毛利 50%–65%；企业定制咖啡",
        "model": "产地直采 + 中国烘焙 + 品牌/渠道（B2B 优先）",
        "roi": "启动 5–15 万元（样品/检测/小批量）；3 个月首单，9 个月回本；月收入 2–8 万元；毛利 35%",
        "audience": "有咖啡行业经验/进口资质、能做品控的人；不适合无食品经验者",
        "drivers": [
          "cross-border",
          "supply"
        ],
        "moat": "产地关系 + 品控 + 稳定烘焙；窗口期 18–24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 50000,
          "max": 150000
        },
        "time_to_revenue_months": 3,
        "payback_months": 9,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 80000
        },
        "gross_margin_pct": 35,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "咖啡价格波动",
        "产地质量不稳定",
        "进口检验与仓储"
      ],
      "first_steps_7d": [
        "联系 2 家埃塞咖啡出口商要样",
        "测 3 款豆子的杯测与成本",
        "问 2 家进口报关行费用",
        "做 1 页 B2B 报价单"
      ],
      "kill_criteria": [
        "样品质量不达标",
        "到岸成本高于国内同级 20%",
        "6 个月无企业客户"
      ],
      "compliance_notes": "食品进口需检验检疫/中文标签；咖啡因含量与广告合规",
      "tags": [
        "china-advantage",
        "cross-border",
        "b2b",
        "physical",
        "needs-supply-chain"
      ],
      "verified": false
    },
    {
      "id": "opp-africa-kenya-avocado-077",
      "slug": "africa-kenya-avocado",
      "title": "肯尼亚牛油果对华冷链",
      "one_liner": "肯尼亚 2025 对华牛油果 3,997 吨、占其对华出口 30%，中国成为第三大供应国，冷链与品控缺口大",
      "industry_id": "crossborder",
      "gap_type_ids": [
        "geo",
        "infrastructure",
        "price"
      ],
      "region_ids": [
        "africa"
      ],
      "origin_country": "肯尼亚",
      "target_countries": [
        "肯尼亚",
        "中国"
      ],
      "human_need_ids": [
        "health",
        "status"
      ],
      "neuro_drivers": [
        "oxytocin"
      ],
      "emotion_tags": [
        "hope"
      ],
      "source_langs": [
        "en",
        "zh"
      ],
      "signal": {
        "summary": "肯尼亚 2025 年对华牛油果进口 3,997 吨，成为对华第三大供应国（2022 年获市场准入），中国占其出口约 30%；肯尼亚年产约 60 万吨、出口值 17.5 亿美元，但冷链、催熟与品控能力弱。",
        "signal_strength": 7.9,
        "trend_direction": "up",
        "volume_estimate": "对华 3,997 吨（2025）；肯尼亚年产约 60 万吨",
        "evidence": [
          {
            "title": "Kenya Emerges as Key Avocado Supplier to China with 30% Export Share in 2025",
            "publisher": "Tridge Insights",
            "url": "https://insights.tridge.com/speaker-product-news-reports/KJLyFXpzJzgKuB1Gqsm5QUKHGgR43AVdqL91C54LPvvAnSz6tk9y7fdw",
            "date": "2026-04-29",
            "quote": "imports reaching 3,997 tons in 2025; China accounting for 30% of these exports",
            "lang": "en",
            "tier": "secondary"
          },
          {
            "title": "Kenya Becomes China's 3rd-Largest Avocado Supplier",
            "publisher": "Produce Report",
            "url": "https://www.producereport.com/print/6240?page=9",
            "date": "2025",
            "quote": "（标题级，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "中国进口水果批发市场 + 生鲜电商采购 + 肯尼亚产地出口商",
        "money": "进口分销差价 15%–25%；冷链服务按吨/柜收费",
        "model": "产地直采 + 中国冷链分销（先做单品、小批量）",
        "roi": "启动 8–20 万元（首批货/冷链）；3 个月首单，10 个月回本；月收入 3–10 万元；毛利 20%",
        "audience": "有生鲜进口/冷链资源的人；不适合无食品经验者",
        "drivers": [
          "cross-border",
          "ops"
        ],
        "moat": "产地关系 + 冷链 + 渠道；窗口期 18 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 80000,
          "max": 200000
        },
        "time_to_revenue_months": 3,
        "payback_months": 10,
        "monthly_revenue_cny": {
          "min": 30000,
          "max": 100000
        },
        "gross_margin_pct": 20,
        "effort_level": "full",
        "team_size": 2
      },
      "risks": [
        "生鲜损耗与催熟失败",
        "检疫/农残",
        "海运周期与价格波动"
      ],
      "first_steps_7d": [
        "联系 2 家肯尼亚出口商要样",
        "问 2 家中国进口商冷链与配额",
        "测算到岸成本与损耗率",
        "找 1 家催熟服务商"
      ],
      "kill_criteria": [
        "损耗率 >15%",
        "到岸成本无优势",
        "3 个月无渠道客户"
      ],
      "compliance_notes": "需中国海关准入与检疫；水果不得携带土壤/病虫害；标签合规",
      "tags": [
        "china-advantage",
        "cross-border",
        "b2b",
        "physical",
        "needs-supply-chain"
      ],
      "verified": false
    },
    {
      "id": "opp-africa-nigeria-hair-078",
      "slug": "africa-nigeria-hair",
      "title": "尼日利亚假发跨境分销",
      "one_liner": "非洲假发是高频刚需，许昌产业带成本优势明显，本地仓+COD 与售后是门槛",
      "industry_id": "crossborder",
      "gap_type_ids": [
        "price",
        "geo",
        "channel"
      ],
      "region_ids": [
        "africa"
      ],
      "origin_country": "中国",
      "target_countries": [
        "尼日利亚",
        "加纳",
        "肯尼亚"
      ],
      "human_need_ids": [
        "status",
        "expression"
      ],
      "neuro_drivers": [
        "dopamine",
        "serotonin"
      ],
      "emotion_tags": [
        "identity",
        "envy"
      ],
      "source_langs": [
        "en",
        "zh"
      ],
      "signal": {
        "summary": "尼日利亚自中国进口人发/羽毛/人造花类目长期居前（海关口径），假发/接发是非洲女性高频刚需；中国许昌/青岛产业带在成本与款式上有优势，但本地退货、COD 与售后是主要门槛。",
        "signal_strength": 8.0,
        "trend_direction": "up",
        "volume_estimate": "尼日利亚自中国进口人发类目规模居前（Trading Economics 海关口径）",
        "evidence": [
          {
            "title": "Nigeria Imports from China of Bird skin, feathers, artificial flowers, human hair",
            "publisher": "Trading Economics",
            "url": "https://tradingeconomics.com/nigeria/imports/china/bird-skin-feathers-artificial-flowers-human-hair",
            "date": "2026",
            "quote": "（数据页，未直连；海关口径）",
            "lang": "en",
            "tier": "primary"
          },
          {
            "title": "Nigeria Hair Wig and Extension Market 2026-2032",
            "publisher": "6Wresearch",
            "url": "https://www.6wresearch.com/industry-report/nigeria-hair-wig-and-extension-market",
            "date": "2026",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "Jumia/本地 IG/TikTok 达人 + 拉各斯批发市场 + 中国产业带直播",
        "money": "假发客单 30–200 美元，毛利 40%–60%；本地仓+COD 提升转化",
        "model": "中国产业带直采 + 尼日利亚本地仓/代发 + COD 风控",
        "roi": "启动 5–15 万元（首批货/本地仓）；2 个月首单，8 个月回本；月收入 3–12 万元；毛利 45%",
        "audience": "有非洲渠道/物流资源、能处理退货的人；不适合纯新手",
        "drivers": [
          "supply",
          "cross-border"
        ],
        "moat": "本地仓 + 退货处理 + 达人；窗口期 12–18 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 50000,
          "max": 150000
        },
        "time_to_revenue_months": 2,
        "payback_months": 8,
        "monthly_revenue_cny": {
          "min": 30000,
          "max": 120000
        },
        "gross_margin_pct": 45,
        "effort_level": "full",
        "team_size": 2
      },
      "risks": [
        "外汇管制/回款",
        "COD 拒收与退货",
        "产品质量与售后"
      ],
      "first_steps_7d": [
        "调研 Jumia 假发 top 20 价格与评价",
        "联系 2 家许昌工厂拿货",
        "问 1 家尼日利亚海外仓报价",
        "测算 COD 拒收率对毛利影响"
      ],
      "kill_criteria": [
        "COD 拒收率 >30%",
        "回款周期 >90 天",
        "6 个月无复购"
      ],
      "compliance_notes": "人发/化纤制品进口合规；不得虚假宣传；退货政策需明示",
      "tags": [
        "cross-border",
        "physical",
        "b2b",
        "china-advantage"
      ],
      "verified": false
    },
    {
      "id": "opp-africa-halal-food-079",
      "slug": "africa-halal-food-export",
      "title": "非洲清真食品出口中东",
      "one_liner": "中东年食品进口 3,800 亿美元、清真认证溢价 30–50%，非洲原料+加工+认证缺口可切入",
      "industry_id": "manufacturing",
      "gap_type_ids": [
        "culture",
        "regulation",
        "knowledge"
      ],
      "region_ids": [
        "africa",
        "mena"
      ],
      "origin_country": "尼日利亚",
      "target_countries": [
        "尼日利亚",
        "埃及",
        "阿联酋",
        "沙特"
      ],
      "human_need_ids": [
        "meaning",
        "health"
      ],
      "neuro_drivers": [
        "serotonin",
        "oxytocin"
      ],
      "emotion_tags": [
        "devotion",
        "hope"
      ],
      "source_langs": [
        "en",
        "ar"
      ],
      "signal": {
        "summary": "中东年食品进口额 3,800 亿美元（占全球 8%），清真认证产品溢价 30%–50%；非洲有原料与劳动力，但缺清真认证、加工与对中东出口的合规能力。",
        "signal_strength": 7.8,
        "trend_direction": "up",
        "volume_estimate": "中东食品进口 3,800 亿美元/年；认证溢价 30%–50%",
        "evidence": [
          {
            "title": "预制菜出海爆发！淄博对韩出口 2524 万，中东成下一个千亿市场",
            "publisher": "出海网（大数跨境）",
            "url": "https://www.chwang.com/article/198264912319",
            "date": "2025-10-27",
            "quote": "中东国家每年食品进口额高达 380 亿美元；超 20 家中国企业通过 Halal 认证，认证产品溢价空间提升 30%—50%",
            "lang": "zh",
            "tier": "secondary"
          },
          {
            "title": "Egypt Halal Food Market 2025-2033",
            "publisher": "Deep Market Insights",
            "url": "https://deepmarketinsights.com/vista/insights/halal-food-market/egypt",
            "date": "2025",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "中东进口商/连锁超市 + 非洲出口商 + 清真认证机构合作",
        "money": "贸易差价 15%–30%；认证咨询 2–8 万元/项目；加工服务费",
        "model": "撮合 + 认证咨询 + 加工代工（与非洲工厂合作）",
        "roi": "启动 5–20 万元（认证/差旅/样品）；4 个月首单，10 个月回本；月收入 2–8 万元；毛利 35%",
        "audience": "有非洲/中东贸易资源、懂清真合规的人；不适合无食品经验者",
        "drivers": [
          "cross-border",
          "regulation"
        ],
        "moat": "认证资源 + 加工厂关系；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 50000,
          "max": 200000
        },
        "time_to_revenue_months": 4,
        "payback_months": 10,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 80000
        },
        "gross_margin_pct": 35,
        "effort_level": "full",
        "team_size": 2
      },
      "risks": [
        "宗教合规失误风险高",
        "非洲政局/汇率",
        "食品安全标准"
      ],
      "first_steps_7d": [
        "联系 1 家国际清真认证机构问流程",
        "找 2 家非洲食品加工厂",
        "调研中东进口商需求清单",
        "做 1 份认证成本表"
      ],
      "kill_criteria": [
        "认证无法落地",
        "6 个月无中东买家",
        "食品安全事故"
      ],
      "compliance_notes": "清真认证必须由认可机构出具；严格区分清真/非清真产线；遵守进口国食品法规",
      "tags": [
        "b2b",
        "needs-license",
        "localization-heavy",
        "physical"
      ],
      "verified": false
    },
    {
      "id": "opp-africa-solar-coldchain-080",
      "slug": "africa-solar-coldchain",
      "title": "非洲离网太阳能冷链",
      "one_liner": "非洲农产品上行缺冷链、电力不稳，中国光储+冷库设备成本下降，设备+运维服务可切入",
      "industry_id": "green",
      "gap_type_ids": [
        "infrastructure",
        "price"
      ],
      "region_ids": [
        "africa"
      ],
      "origin_country": "中国",
      "target_countries": [
        "肯尼亚",
        "尼日利亚",
        "坦桑尼亚"
      ],
      "human_need_ids": [
        "survival",
        "control"
      ],
      "neuro_drivers": [
        "cortisol"
      ],
      "emotion_tags": [
        "hope"
      ],
      "source_langs": [
        "en",
        "zh"
      ],
      "signal": {
        "summary": "非洲离网太阳能快速扩张（Sun King 1.56 亿美元证券化、覆盖 100 万+ 肯尼亚人），而农产品上行与食品加工缺冷链；中国光储+冷库设备成本下降，设备+运维是轻资产切入点。",
        "signal_strength": 7.6,
        "trend_direction": "up",
        "volume_estimate": "Sun King 1.56 亿美元证券化、覆盖 100 万+ 肯尼亚人",
        "evidence": [
          {
            "title": "Sustainable Finance Drives Rapid Expansion of Off-Grid Solar in Africa",
            "publisher": "Sun King",
            "url": "https://sunking.com/news-blog/sustainable-finance-drives-rapid-expansion-of-off-grid-solar-in-africa/",
            "date": "2025",
            "quote": "（官网博客，前序已读；本轮未重开）",
            "lang": "en",
            "tier": "primary"
          },
          {
            "title": "预制菜出海：冷链是核心成本项",
            "publisher": "出海网",
            "url": "https://www.chwang.com/article/198264912319",
            "date": "2025-10-27",
            "quote": "冷链物流作为支撑预制菜出海的关键基础设施",
            "lang": "zh",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "非洲农产品合作社/加工厂 + 中国光储厂商 + 国际援助项目",
        "money": "设备差价 20%–30%；安装运维年费 8,000–30,000 元/套",
        "model": "中国设备 + 本地安装/运维（与本地服务商合作）",
        "roi": "启动 10–30 万元（样机/认证）；6 个月首单，14 个月回本；月收入 2–8 万元；毛利 30%",
        "audience": "有光伏/冷链设备经验、能找到非洲本地伙伴的人",
        "drivers": [
          "supply",
          "tech"
        ],
        "moat": "本地运维网络 + 设备成本；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 100000,
          "max": 300000
        },
        "time_to_revenue_months": 6,
        "payback_months": 14,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 80000
        },
        "gross_margin_pct": 30,
        "effort_level": "full",
        "team_size": 3
      },
      "risks": [
        "回款/坏账",
        "售后与备件",
        "非洲政局与汇率"
      ],
      "first_steps_7d": [
        "联系 2 家非洲农产品加工厂了解冷库需求",
        "找 2 家中国光储/冷库设备商报价",
        "问 1 家非洲本地安装服务商",
        "测算单套投资回收期"
      ],
      "kill_criteria": [
        "回款周期 >12 个月",
        "运维成本吃掉毛利",
        "设备故障率过高"
      ],
      "compliance_notes": "设备需符合当地电气/安全标准；跨境收款合规；不得夸大节能收益",
      "tags": [
        "china-advantage",
        "b2b",
        "physical",
        "needs-supply-chain"
      ],
      "verified": false
    },
    {
      "id": "opp-latam-mexico-nearshoring-081",
      "slug": "latam-mexico-nearshoring",
      "title": "墨西哥近岸外包配套服务",
      "one_liner": "墨西哥 2025 年 FDI 408.7 亿美元创纪录（+10.8%），中企落地缺合规/采购/物流配套",
      "industry_id": "manufacturing",
      "gap_type_ids": [
        "geo",
        "regulation",
        "infrastructure"
      ],
      "region_ids": [
        "latam"
      ],
      "origin_country": "墨西哥",
      "target_countries": [
        "墨西哥",
        "美国"
      ],
      "human_need_ids": [
        "status",
        "control"
      ],
      "neuro_drivers": [
        "serotonin"
      ],
      "emotion_tags": [
        "aspiration"
      ],
      "source_langs": [
        "es",
        "en",
        "zh"
      ],
      "signal": {
        "summary": "墨西哥 2025 年 FDI 408.7 亿美元（+10.8%，连续 5 年增长；新投资 73.8 亿美元、+132.9%），近岸外包持续；但关税与政策反复使中企落地更依赖本地合规、采购与物流服务。",
        "signal_strength": 8.2,
        "trend_direction": "up",
        "volume_estimate": "2025 FDI 408.7 亿美元；新投资 73.8 亿美元（+132.9%）",
        "evidence": [
          {
            "title": "Mexico's FDI Hits Record US$40.8 Billion Amid Tariff Risks",
            "publisher": "Mexico Business News",
            "url": "https://mexicobusiness.news/trade-and-investment/news/mexicos-fdi-hits-record-us408-billion-amid-tariff-risks",
            "date": "2026-02-25",
            "quote": "record US$40.87 billion in FDI, up 10.8% year over year; new investments US$7.38 billion, a 132.9% increase",
            "lang": "en",
            "tier": "secondary"
          },
          {
            "title": "墨西哥经济部：2025 年 FDI 创历史纪录",
            "publisher": "墨西哥经济部（gob.mx）",
            "url": "https://www.gob.mx/se/prensa/mexico-alcanza-cifra-historica-de-inversion-extranjera-directa-en-2025-40-871-millones-de-dolares-crecio-un-10-8-anual",
            "date": "2026-02",
            "quote": "（官方新闻稿，未直连）",
            "lang": "es",
            "tier": "primary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "中企出海墨西哥社群 + 工业园招商 + 中墨商会",
        "money": "落地咨询 3–15 万元/项目；采购代理佣金 2%–5%；物流服务费",
        "model": "咨询+代理：选址/合规/采购/物流打包",
        "roi": "启动 3–10 万元（差旅/本地合作）；3 个月首单，8 个月回本；月收入 2–8 万元；毛利 50%",
        "audience": "懂西语/有墨西哥资源、做过外贸或咨询的人",
        "drivers": [
          "ops",
          "regulation"
        ],
        "moat": "本地关系 + 合规经验；窗口期 18–24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 30000,
          "max": 100000
        },
        "time_to_revenue_months": 3,
        "payback_months": 8,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 80000
        },
        "gross_margin_pct": 50,
        "effort_level": "full",
        "team_size": 2
      },
      "risks": [
        "美国关税政策反复",
        "墨西哥安全与劳工问题",
        "合规责任"
      ],
      "first_steps_7d": [
        "联系 2 个墨西哥工业园招商",
        "找 2 家在墨中企访谈痛点",
        "整理 IMMEX/PROSEC 要点",
        "做 1 份落地成本清单"
      ],
      "kill_criteria": [
        "6 个月无签约",
        "政策导致中企投资停滞",
        "合规风险不可控"
      ],
      "compliance_notes": "IMMEX/PROSEC/海关合规复杂，需与本地律师合作；不得协助规避关税",
      "tags": [
        "b2b",
        "localization-heavy",
        "needs-license"
      ],
      "verified": false
    },
    {
      "id": "opp-latam-chile-cherry-082",
      "slug": "latam-chile-cherry",
      "title": "智利车厘子中国渠道分销",
      "one_liner": "智利 2025-26 季出口 65.5 万吨、90%+ 销往中国，价格下行，礼盒/细分渠道比抢货更赚钱",
      "industry_id": "crossborder",
      "gap_type_ids": [
        "price",
        "infrastructure",
        "channel"
      ],
      "region_ids": [
        "latam",
        "china"
      ],
      "origin_country": "智利",
      "target_countries": [
        "智利",
        "中国"
      ],
      "human_need_ids": [
        "status",
        "health"
      ],
      "neuro_drivers": [
        "dopamine"
      ],
      "emotion_tags": [
        "aspiration",
        "pride"
      ],
      "source_langs": [
        "es",
        "zh"
      ],
      "signal": {
        "summary": "智利 2025-26 季预计出口 65.5 万吨（1.31 亿箱×5kg），90%+ 销往中国；中国冬季进口近 59 万吨，批发价同比降 15%–25%，海运缩至 23 天、1 万+ 集装箱到港。价格下行期，礼盒/分级/细分渠道比抢货更赚钱。",
        "signal_strength": 7.8,
        "trend_direction": "up",
        "volume_estimate": "智利出口 65.5 万吨；中国进口近 59 万吨",
        "evidence": [
          {
            "title": "Cherry Prices Plunge in China as Country to Import Nearly 590,000 Tons From Chile",
            "publisher": "Yicai Global（第一财经）",
            "url": "https://www.yicaiglobal.com/news/cherry-prices-plunge-in-china-as-country-to-import-nearly-590000-tons-from-chile",
            "date": "2025-12-24",
            "quote": "expected to bring in almost 590,000 tons from Chile; export about 655,000 tons; more than 90 percent destined for China",
            "lang": "en",
            "tier": "secondary"
          },
          {
            "title": "Cerezas chilenas en China",
            "publisher": "新华网西语版",
            "url": "https://spanish.xinhuanet.com/20260204/97168cc74c6d4a089cad0376ba20645d/c.html",
            "date": "2026-02-04",
            "quote": "（标题级，未直连）",
            "lang": "es",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "社区团购/生鲜电商/直播 + 批发市场 + 企业礼盒",
        "money": "分销差价 10%–20%；礼盒溢价 20%–40%；冷链服务费",
        "model": "小批量分销 + 礼盒品牌（不碰大宗囤货）",
        "roi": "启动 3–10 万元（首批货/包装）；1 个月首单，4 个月回本；月收入 2–8 万元；毛利 18%",
        "audience": "有生鲜渠道/私域流量的人；适合兼职起步",
        "drivers": [
          "cross-border",
          "info"
        ],
        "moat": "渠道 + 分级品控；窗口期季节性（每年 12–2 月）"
      },
      "roi": {
        "capital_cny": {
          "min": 30000,
          "max": 100000
        },
        "time_to_revenue_months": 1,
        "payback_months": 4,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 80000
        },
        "gross_margin_pct": 18,
        "effort_level": "side",
        "team_size": 1
      },
      "risks": [
        "生鲜损耗",
        "价格继续下行",
        "资金占用"
      ],
      "first_steps_7d": [
        "问 3 家进口商批发价与起订量",
        "设计 1 款礼盒包装",
        "联系 2 个社区团购团长",
        "测算损耗与毛利"
      ],
      "kill_criteria": [
        "损耗率 >10%",
        "价格跌破成本线",
        "旺季结束仍未起量"
      ],
      "compliance_notes": "生鲜食品标签/检疫合规；不得虚假宣传产地；冷链温控",
      "tags": [
        "china-advantage",
        "cross-border",
        "physical",
        "seasonal",
        "b2b"
      ],
      "verified": false
    },
    {
      "id": "opp-latam-petfood-ecom-083",
      "slug": "latam-petfood-ecom",
      "title": "拉美宠物食品电商",
      "one_liner": "拉美宠物食品电商 3 年翻 3 倍（$25M→$82M），渗透率仅 6.7%，墨西哥 3.5% 增长空间大",
      "industry_id": "pet",
      "gap_type_ids": [
        "channel",
        "infrastructure",
        "demographic"
      ],
      "region_ids": [
        "latam"
      ],
      "origin_country": "巴西",
      "target_countries": [
        "墨西哥",
        "巴西",
        "阿根廷",
        "智利"
      ],
      "human_need_ids": [
        "love",
        "belonging"
      ],
      "neuro_drivers": [
        "oxytocin"
      ],
      "emotion_tags": [
        "love"
      ],
      "source_langs": [
        "es",
        "pt",
        "zh"
      ],
      "signal": {
        "summary": "拉美宠物食品电商 3 年增长 3 倍（2023Q1 $25M → 2025 年底 $82M），线上渗透率 3.9%→6.7%；墨西哥 3.5%、巴西 6.1%、阿根廷 11.4%；无子女家庭占 65+ 养宠人群 43%。",
        "signal_strength": 8.3,
        "trend_direction": "up",
        "volume_estimate": "线上 $82M（2025 年底）；渗透率 6.7%",
        "evidence": [
          {
            "title": "Pet food e-commerce triples in Latin America as digital adoption reshapes the market",
            "publisher": "GlobalPETS",
            "url": "https://globalpetindustry.com/news/pet-food-e-commerce-triples-in-latin-america-as-digital-adoption-reshapes-the-market/",
            "date": "2026-06-30",
            "quote": "online pet food sales more than tripled in value, rising from $25 million in Q1 2023 to $82 million at the end of 2025",
            "lang": "en",
            "tier": "secondary"
          },
          {
            "title": "Latin America Pet Food Market 2025-2034",
            "publisher": "ResearchAndMarkets",
            "url": "https://www.researchandmarkets.com/report/latin-america-pet-food-market",
            "date": "2025",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "MercadoLibre/Amazon + TikTok 宠物内容 + 本地宠物店合作",
        "money": "宠物食品/零食差价 30%–50%；订阅复购",
        "model": "跨境/本地仓 + 订阅（先做零食，轻小件）",
        "roi": "启动 2–8 万元（首批货/本地仓）；2 个月首单，7 个月回本；月收入 2–8 万元；毛利 35%",
        "audience": "有拉美电商运营/西语能力的人；适合兼职起步",
        "drivers": [
          "cross-border",
          "ops"
        ],
        "moat": "本地仓 + 订阅 + 评价；窗口期 18 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 20000,
          "max": 80000
        },
        "time_to_revenue_months": 2,
        "payback_months": 7,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 80000
        },
        "gross_margin_pct": 35,
        "effort_level": "side",
        "team_size": 1
      },
      "risks": [
        "进口宠物食品注册",
        "物流成本",
        "平台竞争"
      ],
      "first_steps_7d": [
        "看 MercadoLibre 宠物零食 top 20 价格",
        "找 2 家宠物食品代工厂",
        "问 1 家墨西哥海外仓",
        "测算到岸成本"
      ],
      "kill_criteria": [
        "注册 3 个月未完成",
        "毛利 <20%",
        "6 个月无复购"
      ],
      "compliance_notes": "宠物食品需进口注册/标签合规；不得宣称医疗功效",
      "tags": [
        "cross-border",
        "b2c",
        "physical",
        "recurring"
      ],
      "verified": false
    },
    {
      "id": "opp-latam-refurb-phone-084",
      "slug": "latam-refurb-phone",
      "title": "拉美二手手机翻新",
      "one_liner": "巴西与全球消费者转向二手手机，中国翻新产业链可输出质检标准与配件",
      "industry_id": "manufacturing",
      "gap_type_ids": [
        "price",
        "infrastructure",
        "geo"
      ],
      "region_ids": [
        "latam"
      ],
      "origin_country": "巴西",
      "target_countries": [
        "巴西",
        "墨西哥",
        "哥伦比亚"
      ],
      "human_need_ids": [
        "ease",
        "status"
      ],
      "neuro_drivers": [
        "dopamine"
      ],
      "emotion_tags": [
        "relief"
      ],
      "source_langs": [
        "pt",
        "es",
        "zh"
      ],
      "signal": {
        "summary": "巴西与全球消费者转向二手手机（新机价格高+环保），拉美翻新/二手手机市场增长；中国翻新产业链（深圳/华强北）成熟，可输出质检分级与配件。",
        "signal_strength": 7.6,
        "trend_direction": "up",
        "volume_estimate": "拉美翻新/二手手机市场报告至 2034 年",
        "evidence": [
          {
            "title": "Consumers shift to used smartphones in Brazil and globally",
            "publisher": "Valor International",
            "url": "https://valorinternational.globo.com/business/news/2026/04/27/consumers-shift-to-used-smartphones-in-brazil-and-globally.ghtml",
            "date": "2026-04-27",
            "quote": "（标题级，未直连）",
            "lang": "en",
            "tier": "secondary"
          },
          {
            "title": "LATAM Refurbished and Used Mobile Phones Market",
            "publisher": "Deep Market Insights",
            "url": "https://deepmarketinsights.com/vista/insights/refurbished-and-used-mobile-phones-market/latam",
            "date": "2025",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "MercadoLibre/OLX + 本地维修店 + 以旧换新",
        "money": "翻新机差价 15%–30%；质检/配件服务费",
        "model": "回收→翻新→分级→本地销售（先做单一机型）",
        "roi": "启动 5–15 万元（首批货/检测设备）；3 个月首单，9 个月回本；月收入 3–10 万元；毛利 25%",
        "audience": "有手机维修/供应链经验的人；不适合无技术背景者",
        "drivers": [
          "supply",
          "ops"
        ],
        "moat": "质检标准 + 稳定货源；窗口期 12–18 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 50000,
          "max": 150000
        },
        "time_to_revenue_months": 3,
        "payback_months": 9,
        "monthly_revenue_cny": {
          "min": 30000,
          "max": 100000
        },
        "gross_margin_pct": 25,
        "effort_level": "full",
        "team_size": 2
      },
      "risks": [
        "IMEI/来源合规",
        "电池安全",
        "售后与退货"
      ],
      "first_steps_7d": [
        "调研 MercadoLibre 二手手机价格",
        "找 2 家深圳翻新货源",
        "设计质检分级卡",
        "测算退货率"
      ],
      "kill_criteria": [
        "货源不稳定",
        "退货率 >15%",
        "合规风险不可控"
      ],
      "compliance_notes": "二手机需 IMEI 合法、不得销赃；电池运输合规；税务",
      "tags": [
        "physical",
        "cross-border",
        "b2b"
      ],
      "verified": false
    },
    {
      "id": "opp-latam-games-l10n-085",
      "slug": "latam-games-l10n",
      "title": "拉美游戏本地化与发行",
      "one_liner": "巴西提出要「生产游戏而不只是消费」，中手游出海缺葡语/西语本地化与社区运营产能",
      "industry_id": "gaming",
      "gap_type_ids": [
        "language",
        "channel"
      ],
      "region_ids": [
        "latam"
      ],
      "origin_country": "巴西",
      "target_countries": [
        "巴西",
        "墨西哥",
        "阿根廷"
      ],
      "human_need_ids": [
        "novelty",
        "expression"
      ],
      "neuro_drivers": [
        "dopamine",
        "adrenaline"
      ],
      "emotion_tags": [
        "curiosity",
        "envy"
      ],
      "source_langs": [
        "pt",
        "es",
        "zh"
      ],
      "signal": {
        "summary": "巴西在 Gamescom LATAM 2026 提出要“生产游戏而不只是消费”，拉美游戏市场增长；中国手游出海拉美缺葡语/西语本地化、配音、社区与支付接入。",
        "signal_strength": 7.7,
        "trend_direction": "up",
        "volume_estimate": "Gamescom LATAM 2026 巴西产业政策信号（未量化）",
        "evidence": [
          {
            "title": "Brazil wants to produce games, not just consume them as Gamescom LATAM 2026 kicks off",
            "publisher": "PocketGamer.biz",
            "url": "https://www.pocketgamer.biz/brazil-wants-to-produce-games-not-just-consume-them-as-gamescom-latam-2026-kicks-off/",
            "date": "2026",
            "quote": "（标题级，未直连）",
            "lang": "en",
            "tier": "secondary"
          },
          {
            "title": "Brazilský herní průmysl zažívá boom",
            "publisher": "BusinessInfo.cz",
            "url": "https://www.businessinfo.cz/clanky/mobily-e-sport-i-veletrhy-brazilsky-herni-prumysl-zaziva-boom/",
            "date": "2026",
            "quote": "（标题级，未直连）",
            "lang": "cs",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "游戏本地化社群 + 中国出海发行商 + 拉美 KOL",
        "money": "本地化按字/分钟计价；社区运营月费；配音按小时",
        "model": "本地化工作室（翻译+配音+社区+支付接入）",
        "roi": "启动 1–3 万元（工具/样片）；2 个月首单，5 个月回本；月收入 1–5 万元；毛利 60%",
        "audience": "懂葡语/西语、有游戏或本地化经验的人；适合远程小团队",
        "drivers": [
          "info",
          "cross-border"
        ],
        "moat": "语种产能 + 游戏案例；窗口期 12–18 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 10000,
          "max": 30000
        },
        "time_to_revenue_months": 2,
        "payback_months": 5,
        "monthly_revenue_cny": {
          "min": 10000,
          "max": 50000
        },
        "gross_margin_pct": 60,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "平台压价",
        "AI 翻译冲击",
        "回款"
      ],
      "first_steps_7d": [
        "做 1 段游戏本地化样片",
        "联系 3 家中国出海发行商",
        "找 2 名葡语配音",
        "报价对比"
      ],
      "kill_criteria": [
        "2 个月无询单",
        "单价低于成本",
        "AI 替代核心交付"
      ],
      "compliance_notes": "游戏内容分级/文化适配；配音版权；数据保护",
      "tags": [
        "b2b",
        "remote",
        "localization-heavy",
        "digital"
      ],
      "verified": false
    },
    {
      "id": "opp-sasia-bangladesh-rmg-086",
      "slug": "sasia-bangladesh-rmg",
      "title": "孟加拉成衣高端化供应链",
      "one_liner": "孟加拉 2025 成衣出口 388 亿美元但高级品类仅 9.35%（全球 30.46%），面辅料与技术产能缺口大",
      "industry_id": "manufacturing",
      "gap_type_ids": [
        "knowledge",
        "regulation",
        "price"
      ],
      "region_ids": [
        "south-asia"
      ],
      "origin_country": "孟加拉",
      "target_countries": [
        "孟加拉",
        "印度",
        "越南"
      ],
      "human_need_ids": [
        "status",
        "control"
      ],
      "neuro_drivers": [
        "serotonin"
      ],
      "emotion_tags": [
        "pride"
      ],
      "source_langs": [
        "en",
        "zh"
      ],
      "signal": {
        "summary": "孟加拉 2025 年成衣出口 388.25 亿美元（全球 426 亿），但基础款占 76.94%（全球 61.58%）、高级品类仅 9.35%（全球 30.46%），面料 72.7% 为棉（全球非棉 58.4%），外套/技术服严重缺位——高端化需要面辅料、技术产能与检测认证。",
        "signal_strength": 7.9,
        "trend_direction": "up",
        "volume_estimate": "成衣出口 388.25 亿美元；高级品类仅占 9.35%",
        "evidence": [
          {
            "title": "Bangladesh's apparel success has a ceiling",
            "publisher": "The Daily Star",
            "url": "https://www.thedailystar.net/business/column/news/bangladeshs-apparel-success-has-ceiling-4278196",
            "date": "2026-09-21",
            "quote": "$38.825 billion worth of garments in calendar year 2025; advanced categories total $3.629 billion, 9.35% of exports, against 30.46% of world trade",
            "lang": "en",
            "tier": "secondary"
          },
          {
            "title": "BGMEA 官方数据",
            "publisher": "BGMEA",
            "url": "https://www.bgmea.com.bd/",
            "date": "2026",
            "quote": "（官方站，未直连）",
            "lang": "en",
            "tier": "primary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "孟加拉成衣厂/买家 + 中国面辅料展会 + 检测机构合作",
        "money": "面辅料贸易差价 10%–20%；检测认证按项目；产能撮合佣金",
        "model": "面辅料/技术服供应链 + 检测认证服务（B2B）",
        "roi": "启动 5–15 万元（样品/差旅）；4 个月首单，10 个月回本；月收入 2–8 万元；毛利 25%",
        "audience": "有纺织/服装供应链经验、英语可沟通的人",
        "drivers": [
          "supply",
          "ops"
        ],
        "moat": "面辅料资源 + 检测认证；窗口期 24–36 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 50000,
          "max": 150000
        },
        "time_to_revenue_months": 4,
        "payback_months": 10,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 80000
        },
        "gross_margin_pct": 25,
        "effort_level": "full",
        "team_size": 2
      },
      "risks": [
        "LDC 毕业/关税",
        "账期与信用",
        "质量与交期"
      ],
      "first_steps_7d": [
        "找 3 家孟加拉成衣厂访谈",
        "整理 5 种技术面料供应商",
        "问 1 家检测机构报价",
        "做 1 页供应链方案"
      ],
      "kill_criteria": [
        "6 个月无客户",
        "账期 >90 天",
        "物流成本无优势"
      ],
      "compliance_notes": "纺织品环保/化学限制（欧盟 REACH）；劳工合规；贸易制裁",
      "tags": [
        "b2b",
        "needs-supply-chain",
        "cross-border"
      ],
      "verified": false
    },
    {
      "id": "opp-sasia-pakistan-surgical-087",
      "slug": "sasia-pakistan-surgical",
      "title": "巴基斯坦手术器械供应链",
      "one_liner": "Sialkot 是全球手术器械隐形产业带，中国可做材料/包装/认证配套与中巴撮合",
      "industry_id": "manufacturing",
      "gap_type_ids": [
        "price",
        "geo",
        "knowledge"
      ],
      "region_ids": [
        "south-asia"
      ],
      "origin_country": "巴基斯坦",
      "target_countries": [
        "巴基斯坦",
        "中国",
        "中东"
      ],
      "human_need_ids": [
        "health",
        "control"
      ],
      "neuro_drivers": [
        "serotonin"
      ],
      "emotion_tags": [
        "pride",
        "hope"
      ],
      "source_langs": [
        "en",
        "zh"
      ],
      "signal": {
        "summary": "Sialkot 手术器械产业参加 Medical Japan 2025、赴上海拓展全球市场；全球手术器械需求稳定，巴基斯坦在成本上有优势，但缺材料、灭菌包装与国际认证能力。",
        "signal_strength": 7.3,
        "trend_direction": "up",
        "volume_estimate": "Sialkot 手术器械出口产业带（未量化）",
        "evidence": [
          {
            "title": "Pakistan Showcases Surgical Excellence at Medical Japan 2025",
            "publisher": "巴基斯坦外交部",
            "url": "https://mofa.gov.pk/press-releases/pakistan-showcases-surgical-excellence-at-medical-japan-2025",
            "date": "2025",
            "quote": "（标题级，未直连）",
            "lang": "en",
            "tier": "primary"
          },
          {
            "title": "Sialkot surgical manufacturers expand global reach in Shanghai",
            "publisher": "Profit by Pakistan Today",
            "url": "https://profit.pakistantoday.com.pk/2025/04/12/sialkot-surgical-manufacturers-expand-global-reach-in-shanghai",
            "date": "2025-04-12",
            "quote": "（标题级，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "医疗器械展会 + 中巴商会 + 巴基斯坦工厂",
        "money": "撮合佣金 3%–8%；材料/包装贸易差价；认证咨询",
        "model": "中巴器械供应链撮合 + 认证咨询",
        "roi": "启动 3–10 万元（差旅/资质）；5 个月首单，12 个月回本；月收入 1–5 万元；毛利 30%",
        "audience": "有医疗器械/外贸背景、英语可沟通的人",
        "drivers": [
          "supply",
          "regulation"
        ],
        "moat": "工厂关系 + 认证资源；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 30000,
          "max": 100000
        },
        "time_to_revenue_months": 5,
        "payback_months": 12,
        "monthly_revenue_cny": {
          "min": 10000,
          "max": 50000
        },
        "gross_margin_pct": 30,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "医疗合规责任",
        "质量事故",
        "地缘政治"
      ],
      "first_steps_7d": [
        "联系 2 家 Sialkot 工厂",
        "问 CE/ISO 13485 认证成本",
        "调研中国材料供应商",
        "做 1 份撮合方案"
      ],
      "kill_criteria": [
        "无工厂愿意合作",
        "认证成本过高",
        "6 个月无订单"
      ],
      "compliance_notes": "医疗器械需 CE/FDA/ISO 13485；不得代理未认证产品；质量责任重大",
      "tags": [
        "b2b",
        "needs-license",
        "needs-supply-chain"
      ],
      "verified": false
    },
    {
      "id": "opp-sasia-india-pet-088",
      "slug": "sasia-india-pet",
      "title": "印度宠物经济",
      "one_liner": "印度宠物市场随中产扩大、宠物食品工业化低，电商与 D2C 存在早期窗口",
      "industry_id": "pet",
      "gap_type_ids": [
        "demographic",
        "channel",
        "emotion"
      ],
      "region_ids": [
        "south-asia"
      ],
      "origin_country": "印度",
      "target_countries": [
        "印度"
      ],
      "human_need_ids": [
        "love",
        "belonging"
      ],
      "neuro_drivers": [
        "oxytocin"
      ],
      "emotion_tags": [
        "love",
        "aspiration"
      ],
      "source_langs": [
        "hi",
        "en"
      ],
      "signal": {
        "summary": "印度宠物护理市场被多家研究机构列为 2025–2032 增长市场；中产扩大、宠物食品从自制转向工业化，电商与 D2C 处于早期。",
        "signal_strength": 7.5,
        "trend_direction": "up",
        "volume_estimate": "India Pet Care Market 2025–2032（报告口径）",
        "evidence": [
          {
            "title": "India Pet Care Market Share, Companies & Trends Report 2025-2032",
            "publisher": "Ken Research",
            "url": "https://www.kenresearch.com/industry-reports/india-pet-care-market",
            "date": "2025",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          },
          {
            "title": "India Pet Care Market Size, Share & Forecast 2026-2032",
            "publisher": "Ken Research",
            "url": "https://www.kenresearch.com/india-pet-care-market",
            "date": "2025",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "Amazon India/Flipkart + Instagram 宠物内容 + 本地宠物店",
        "money": "宠物零食/用品差价 30%–50%；订阅",
        "model": "跨境/本地采购 + D2C/平台店",
        "roi": "启动 2–6 万元；3 个月首单，8 个月回本；月收入 1–5 万元；毛利 35%",
        "audience": "有印度电商/英语内容能力的人；适合兼职",
        "drivers": [
          "cross-border",
          "info"
        ],
        "moat": "本地供应链 + 内容；窗口期 18–24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 20000,
          "max": 60000
        },
        "time_to_revenue_months": 3,
        "payback_months": 8,
        "monthly_revenue_cny": {
          "min": 10000,
          "max": 50000
        },
        "gross_margin_pct": 35,
        "effort_level": "side",
        "team_size": 1
      },
      "risks": [
        "进口注册/关税",
        "价格敏感",
        "平台竞争"
      ],
      "first_steps_7d": [
        "看 Amazon India 宠物零食 top 20",
        "找 1 家印度本地代工",
        "做 1 条宠物内容测试",
        "测算毛利"
      ],
      "kill_criteria": [
        "6 个月无复购",
        "毛利 <20%",
        "注册失败"
      ],
      "compliance_notes": "宠物食品进口需印度注册；不得宣称医疗功效",
      "tags": [
        "b2c",
        "physical",
        "content-driven"
      ],
      "verified": false
    },
    {
      "id": "opp-sasia-india-meddevice-089",
      "slug": "sasia-india-meddevice",
      "title": "印度医疗器械注册与渠道",
      "one_liner": "印度医疗基建扩张、进口替代政策下，中国耗材企业缺 CDSCO 注册与本地渠道",
      "industry_id": "manufacturing",
      "gap_type_ids": [
        "regulation",
        "knowledge"
      ],
      "region_ids": [
        "south-asia"
      ],
      "origin_country": "印度",
      "target_countries": [
        "印度"
      ],
      "human_need_ids": [
        "health",
        "control"
      ],
      "neuro_drivers": [
        "cortisol"
      ],
      "emotion_tags": [
        "fear",
        "hope"
      ],
      "source_langs": [
        "hi",
        "en"
      ],
      "signal": {
        "summary": "IBEF 与 KOTRA 均把印度列为医疗技术/医疗器械快速增长市场；印度医疗基建扩张+进口替代政策，中国耗材企业进入需 CDSCO 注册与本地代理。",
        "signal_strength": 7.6,
        "trend_direction": "up",
        "volume_estimate": "印度医疗器械行业报告（IBEF 2025-11）",
        "evidence": [
          {
            "title": "Medical Devices Industry Analysis Oct 2025",
            "publisher": "IBEF（印度政府投资促进机构）",
            "url": "https://dev.ibef.org/archives/industry/medical-devices-reports/medical-devices-presentation-nov-25",
            "date": "2025-11",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "primary"
          },
          {
            "title": "인도, 세계 4위 의료기술 시장으로 도약",
            "publisher": "KOTRA",
            "url": "https://dream.kotra.or.kr/kotranews/cms/news/actionKotraBoardDetail.do?SITE_NO=3&MENU_ID=180&CONTENTS_NO=1&bbsGbn=243&bbsSn=243&pNttSn=242618",
            "date": "2025",
            "quote": "（标题级，未直连）",
            "lang": "ko",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "医疗器械展会 + 印度本地代理 + LinkedIn",
        "money": "注册代理 8,000–30,000 元/证；渠道佣金 5%–10%",
        "model": "注册代理 + 本地渠道撮合",
        "roi": "启动 3–10 万元；6 个月首单，12 个月回本；月收入 1–5 万元；毛利 45%",
        "audience": "有医疗器械注册/印度资源的人",
        "drivers": [
          "regulation",
          "info"
        ],
        "moat": "注册经验 + 本地代理；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 30000,
          "max": 100000
        },
        "time_to_revenue_months": 6,
        "payback_months": 12,
        "monthly_revenue_cny": {
          "min": 10000,
          "max": 50000
        },
        "gross_margin_pct": 45,
        "effort_level": "side",
        "team_size": 1
      },
      "risks": [
        "注册周期长",
        "医疗责任",
        "价格管制"
      ],
      "first_steps_7d": [
        "查 CDSCO 注册流程",
        "联系 2 家印度代理",
        "找 2 家中国耗材厂",
        "做 1 份注册成本表"
      ],
      "kill_criteria": [
        "注册 12 个月未下证",
        "无本地代理",
        "利润不足以覆盖合规"
      ],
      "compliance_notes": "医疗器械注册/临床要求严格；不得夸大疗效；需本地授权代理",
      "tags": [
        "b2b",
        "needs-license",
        "needs-supply-chain"
      ],
      "verified": false
    },
    {
      "id": "opp-mena-saudi-women-gym-090",
      "slug": "mena-saudi-women-gym",
      "title": "沙特女性健身与女性空间",
      "one_liner": "沙特女性运动参与率 43.1%、女性俱乐部年费 2,000–34,000 里亚尔，市场 11 亿→18 亿美元",
      "industry_id": "local",
      "gap_type_ids": [
        "culture",
        "demographic",
        "channel"
      ],
      "region_ids": [
        "mena"
      ],
      "origin_country": "沙特",
      "target_countries": [
        "沙特",
        "阿联酋"
      ],
      "human_need_ids": [
        "status",
        "health"
      ],
      "neuro_drivers": [
        "endorphin",
        "serotonin"
      ],
      "emotion_tags": [
        "pride",
        "aspiration"
      ],
      "source_langs": [
        "ar",
        "en"
      ],
      "signal": {
        "summary": "沙特 59% 成年人每周运动 150 分钟，女性 43.1% vs 男性 66.5%；女性俱乐部年费 2,000–34,000 里亚尔；Fitness Time 2025 年 53.2 万会员、女性 12.1 万（23%，+5%/年）；沙特健身房市场 11 亿美元（2024）→18 亿美元（2030）；开店成本 80–150 万里亚尔；PIF 成立 Kiyani 女性俱乐部目标 100 万+ 用户。",
        "signal_strength": 8.1,
        "trend_direction": "up",
        "volume_estimate": "市场 11 亿→18 亿美元（2024→2030）；女性会员 12.1 万",
        "evidence": [
          {
            "title": "النوادي النسائية في السعودية بين توسع الطلب وضغط الأسعار",
            "publisher": "صحيفة الاقتصادية",
            "url": "https://www.aleqt.com/%d8%a7%d9%84%d8%b1%d9%8a%d8%a7%d8%b6%d8%a9/%d8%a7%d9%84%d9%86%d9%88%d8%a7%d8%af%d9%8a-%d8%a7%d9%84%d9%86%d8%b3%d8%a7%d8%a6%d9%8a%d8%a9-%d9%81%d9%8a-%d8%a7%d9%84%d8%b3%d8%b9%d9%88%d8%af%d9%8a%d8%a9-%d8%a8%d9%8a%d9%86-%d8%aa%d9%88%d8%b3%d8%b9-%d8%a7%d9%84%d8%b7%d9%84%d8%a8-%d9%88%d8%b6%d8%ba%d8%b7-%d8%a7%d9%84%d8%a3%d8%b3%d8%b9%d8%a7%d8%b1-5872",
            "date": "2026",
            "quote": "سوق النوادي والصالات الصحية في السعودية 1.1 مليار دولار في 2024، مع توقعات بوصوله إلى 1.8 مليار دولار بحلول 2030",
            "lang": "ar",
            "tier": "secondary"
          },
          {
            "title": "Middle East: Saudi Arabia - 2026 HFA Global Report",
            "publisher": "Health & Fitness Association",
            "url": "https://www.healthandfitnessbusiness.org/2026-global-report/middle-east-saudi-arabia",
            "date": "2026",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "Instagram/Snapchat 女性健身内容 + 本地女性社群 + 商场快闪",
        "money": "女性训练营/私教 200–800 里亚尔/月；线上课程 99–399 里亚尔/期；运动服饰跨境",
        "model": "线上课程/训练营 + 女性教练培训（轻资产）",
        "roi": "启动 2–8 万元（场地/内容/教练）；2 个月首单，6 个月回本；月收入 2–6 万元；毛利 55%",
        "audience": "有女性健身教练资质/中东文化敏感度的人；需本地合伙人",
        "drivers": [
          "info",
          "ops"
        ],
        "moat": "女性教练 + 本地社群 + 文化适配；窗口期 18–24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 20000,
          "max": 80000
        },
        "time_to_revenue_months": 2,
        "payback_months": 6,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 60000
        },
        "gross_margin_pct": 55,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "本地牌照/场地",
        "文化敏感",
        "价格竞争"
      ],
      "first_steps_7d": [
        "调研利雅得 5 家女性俱乐部价格",
        "找 1 位本地女教练合作",
        "做 1 期线上训练营测试",
        "算场地成本"
      ],
      "kill_criteria": [
        "3 个月无付费学员",
        "本地牌照无法解决",
        "文化冲突导致停业"
      ],
      "compliance_notes": "女性运动空间需符合当地文化规范；教练资质；广告内容审慎",
      "tags": [
        "needs-license",
        "localization-heavy",
        "b2c"
      ],
      "verified": false
    },
    {
      "id": "opp-mena-uae-medtourism-091",
      "slug": "mena-uae-medtourism",
      "title": "阿联酋医疗旅游中文配套",
      "one_liner": "UAE 医疗旅游 2025 年 16 亿美元、缺中文礼宾服务，医院丢失 22% 国际患者收入",
      "industry_id": "local",
      "gap_type_ids": [
        "infrastructure",
        "knowledge",
        "language"
      ],
      "region_ids": [
        "mena"
      ],
      "origin_country": "阿联酋",
      "target_countries": [
        "阿联酋",
        "沙特"
      ],
      "human_need_ids": [
        "health",
        "status"
      ],
      "neuro_drivers": [
        "cortisol",
        "oxytocin"
      ],
      "emotion_tags": [
        "hope",
        "fear"
      ],
      "source_langs": [
        "ar",
        "zh",
        "en"
      ],
      "signal": {
        "summary": "UAE 医疗旅游 2025 年收入 16 亿美元；无医疗礼宾服务的医院会丢失 22% 国际患者收入；Emirates 等 14% 辅助收入来自医疗旅游套餐。中国患者对生殖/肿瘤/体检需求上升，但中文礼宾与翻译供给稀缺。",
        "signal_strength": 7.7,
        "trend_direction": "up",
        "volume_estimate": "UAE 医疗旅游 16 亿美元（2025）",
        "evidence": [
          {
            "title": "UAE medical tourism segment captures $1.6 billion in 2025 revenue",
            "publisher": "Zavis",
            "url": "https://www.zavis.ai/intelligence/uae-medical-tourism-captures-1-6-billion-revenue",
            "date": "2026-03-18",
            "quote": "The UAE medical tourism sector reached $1.6 billion in 2025; Hospitals without dedicated medical concierge services lose 22% of revenue",
            "lang": "en",
            "tier": "secondary"
          },
          {
            "title": "UAE Medical Tourism Market 2026-2032",
            "publisher": "Ken Research",
            "url": "https://www.kenresearch.com/uae-medical-tourism-market",
            "date": "2026",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "小红书/微信医疗群 + 医院国际部 + 转诊中介",
        "money": "转诊佣金 5%–15% 或服务费 2,000–10,000 元/人；陪诊翻译 500–1,500 元/天",
        "model": "医疗旅游顾问 + 翻译陪诊 + 住宿/康复套餐",
        "roi": "启动 2–6 万元（资质/保险/渠道）；3 个月首单，9 个月回本；月收入 2–8 万元；毛利 40%",
        "audience": "有医疗背景/中东资源、中英阿语能力的人；需与持牌医院合作",
        "drivers": [
          "ops",
          "info"
        ],
        "moat": "医院渠道 + 语言 + 案例；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 20000,
          "max": 60000
        },
        "time_to_revenue_months": 3,
        "payback_months": 9,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 80000
        },
        "gross_margin_pct": 40,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "医疗责任/纠纷",
        "医院合作门槛",
        "签证与保险"
      ],
      "first_steps_7d": [
        "联系 2 家迪拜医院国际部",
        "找 1 家地接/住宿合作",
        "做 1 份中文服务包",
        "访谈 3 位中国患者"
      ],
      "kill_criteria": [
        "6 个月无医院合作",
        "医疗纠纷风险不可控",
        "客源不足"
      ],
      "compliance_notes": "不得承诺疗效；医疗中介需合规；患者隐私保护",
      "tags": [
        "needs-license",
        "b2b",
        "localization-heavy"
      ],
      "verified": false
    },
    {
      "id": "opp-mena-halal-preparedfood-092",
      "slug": "mena-halal-preparedfood",
      "title": "中东清真预制菜",
      "one_liner": "中东年食品进口 3,800 亿美元、清真认证溢价 30–50%，中国预制菜产能可切入",
      "industry_id": "manufacturing",
      "gap_type_ids": [
        "culture",
        "regulation",
        "price"
      ],
      "region_ids": [
        "mena",
        "china"
      ],
      "origin_country": "中国",
      "target_countries": [
        "阿联酋",
        "沙特",
        "埃及"
      ],
      "human_need_ids": [
        "meaning",
        "health"
      ],
      "neuro_drivers": [
        "serotonin"
      ],
      "emotion_tags": [
        "devotion",
        "pride"
      ],
      "source_langs": [
        "ar",
        "zh"
      ],
      "signal": {
        "summary": "中东年食品进口 3,800 亿美元；阿联酋食品贸易占 GDP 11%、食品行业 2030 年 63 亿美元；2024 年中国对阿联酋农食出口 +18% 至 15 亿美元，高端加工食品占比升至 35%；超 20 家中企获 Halal 认证，认证产品溢价 30%–50%。",
        "signal_strength": 8.2,
        "trend_direction": "up",
        "volume_estimate": "中东食品进口 3,800 亿美元/年；对阿农食出口 15 亿美元",
        "evidence": [
          {
            "title": "预制菜出海爆发！淄博对韩出口 2524 万，中东成下一个千亿市场",
            "publisher": "出海网（大数跨境）",
            "url": "https://www.chwang.com/article/198264912319",
            "date": "2025-10-27",
            "quote": "中东国家每年食品进口额高达 380 亿美元，占全球市场的 8%；认证产品溢价空间提升 30%—50%",
            "lang": "zh",
            "tier": "secondary"
          },
          {
            "title": "Global Halal Tourism Market",
            "publisher": "Mordor Intelligence",
            "url": "https://www.mordorintelligence.com/industry-reports/global-halal-tourism-market",
            "date": "2026",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "中东连锁超市/进口商 + 中国食品展会 + 阿联酋华人渠道",
        "money": "贸易差价 15%–30%；清真认证咨询 2–8 万元；OEM 加工费",
        "model": "中国工厂 + 清真认证 + 中东渠道（先做 1–2 个品类）",
        "roi": "启动 5–20 万元（认证/样品/差旅）；3 个月首单，9 个月回本；月收入 2–10 万元；毛利 30%",
        "audience": "有食品出口/中东渠道、懂清真合规的人",
        "drivers": [
          "supply",
          "cross-border",
          "regulation"
        ],
        "moat": "认证 + 渠道 + 产品适配；窗口期 18–24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 50000,
          "max": 200000
        },
        "time_to_revenue_months": 3,
        "payback_months": 9,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 100000
        },
        "gross_margin_pct": 30,
        "effort_level": "full",
        "team_size": 2
      },
      "risks": [
        "清真认证/宗教合规",
        "食品标准（GSO/SFDA）",
        "冷链与保质期"
      ],
      "first_steps_7d": [
        "找 1 家清真认证机构问流程",
        "联系 2 家中东进口商",
        "选 1 个预制菜品类做样品",
        "测算认证+物流成本"
      ],
      "kill_criteria": [
        "认证 6 个月未落地",
        "无中东买家",
        "食品安全问题"
      ],
      "compliance_notes": "清真认证必须由认可机构出具；标签阿语；符合 GSO/SFDA；不得含禁忌成分",
      "tags": [
        "needs-supply-chain",
        "b2b",
        "physical",
        "china-advantage"
      ],
      "verified": false
    },
    {
      "id": "opp-mena-umrah-goods-093",
      "slug": "mena-umrah-goods",
      "title": "朝觐用品与礼包供应链",
      "one_liner": "2025 年 1,950 万朝觐/Umrah 人次、签证 1,503 万，朝觐用品标准化与礼包需求明确",
      "industry_id": "culture",
      "gap_type_ids": [
        "culture",
        "geo",
        "emotion"
      ],
      "region_ids": [
        "mena"
      ],
      "origin_country": "沙特",
      "target_countries": [
        "沙特",
        "阿联酋",
        "印尼",
        "巴基斯坦"
      ],
      "human_need_ids": [
        "meaning",
        "belonging"
      ],
      "neuro_drivers": [
        "serotonin",
        "oxytocin"
      ],
      "emotion_tags": [
        "devotion"
      ],
      "source_langs": [
        "ar",
        "en"
      ],
      "signal": {
        "summary": "2025 年 1,950 万+ 入境朝觐/Umrah（Umrah 1,803 万、Hajj 150 万）、签证 1,503 万（Umrah 占 83%），来源国前三巴基斯坦/印尼/埃及；朝觐用品（戒衣/礼拜毯/便携净水）标准化程度低，礼包与纪念品有空间。",
        "signal_strength": 7.9,
        "trend_direction": "up",
        "volume_estimate": "1,950 万人次；签证 1,503 万",
        "evidence": [
          {
            "title": "Pilgrim Experience Program Reports Over 19.5 Million International Pilgrims and Umrah Performers in 2025",
            "publisher": "沙特朝觐体验计划（PEP）",
            "url": "https://pep.gov.sa/en/news/1011",
            "date": "2026-08-03",
            "quote": "more than 19.5 million pilgrims and Umrah performers from abroad arrived in Saudi Arabia, including 18.03 million Umrah performers and 1.5 million pilgrims",
            "lang": "en",
            "tier": "primary"
          },
          {
            "title": "Global Halal Tourism Market",
            "publisher": "Mordor Intelligence",
            "url": "https://www.mordorintelligence.com/industry-reports/global-halal-tourism-market",
            "date": "2026",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "Umrah 旅行社/朝觐团 + 穆斯林社群 + 跨境电商",
        "money": "礼包客单 100–500 元，毛利 40%–60%；用品批发",
        "model": "义乌/广州供应链 + 阿语包装 + 旅行社团购",
        "roi": "启动 2–5 万元（样品/包装）；1 个月首单，4 个月回本；月收入 1–5 万元；毛利 45%",
        "audience": "有穆斯林社群/旅行社资源、能做阿语包装的人",
        "drivers": [
          "supply",
          "info"
        ],
        "moat": "渠道 + 设计 + 宗教尊重；窗口期季节性"
      },
      "roi": {
        "capital_cny": {
          "min": 20000,
          "max": 50000
        },
        "time_to_revenue_months": 1,
        "payback_months": 4,
        "monthly_revenue_cny": {
          "min": 10000,
          "max": 50000
        },
        "gross_margin_pct": 45,
        "effort_level": "side",
        "team_size": 1
      },
      "risks": [
        "宗教用品设计失礼",
        "季节性强",
        "同质化"
      ],
      "first_steps_7d": [
        "调研 5 个 Umrah 礼包价格",
        "找 2 家义乌用品供应商",
        "设计 1 款阿语礼盒",
        "联系 2 家旅行社"
      ],
      "kill_criteria": [
        "宗教设计无法确认合规",
        "旺季无订单",
        "毛利 <25%"
      ],
      "compliance_notes": "宗教用品需尊重教义与礼仪；不得使用不当图案；阿语标签准确",
      "tags": [
        "china-advantage",
        "physical",
        "cross-border",
        "seasonal",
        "b2b"
      ],
      "verified": false
    },
    {
      "id": "opp-oceania-au-pet-insurance-094",
      "slug": "oceania-au-pet-insurance",
      "title": "澳洲宠物保险比价与理赔",
      "one_liner": "澳洲宠物保险保费一年涨 26–29%、狗均 1,700+ 澳元，86% 猫主未投保，比价服务有空间",
      "industry_id": "pet",
      "gap_type_ids": [
        "knowledge",
        "price",
        "emotion"
      ],
      "region_ids": [
        "oceania"
      ],
      "origin_country": "澳大利亚",
      "target_countries": [
        "澳大利亚",
        "新西兰"
      ],
      "human_need_ids": [
        "love",
        "control"
      ],
      "neuro_drivers": [
        "cortisol",
        "oxytocin"
      ],
      "emotion_tags": [
        "anxiety",
        "relief"
      ],
      "source_langs": [
        "en"
      ],
      "signal": {
        "summary": "澳洲宠物保险保费一年涨 26%–29%（大型犬平均 1,700+ 澳元、猫近 1,000 澳元）；12 个月宠物保险支出 10 亿澳元；3,160 万只宠物、73% 家庭养宠；86% 猫主/76% 狗主未投保；近半澳洲人拿不出 3,000 澳元急诊费。",
        "signal_strength": 8.0,
        "trend_direction": "up",
        "volume_estimate": "宠物保险支出 10 亿澳元/年；保费 +26%–29%",
        "evidence": [
          {
            "title": "Pet insurance premiums jump 29% - is it still worth it?",
            "publisher": "Money magazine",
            "url": "https://www.moneymag.com.au/pet-insurance-premiums-surge-is-cover-still-worth-it",
            "date": "2026-09-16",
            "quote": "average annual premiums ... increased by 26% for dogs and 27% for cats ... large dogs went up by 29%; Australia is home to 31.6 million pets",
            "lang": "en",
            "tier": "secondary"
          },
          {
            "title": "Australia Pet Insurance Market 2030",
            "publisher": "MarketsandMarkets",
            "url": "https://www.marketsandmarkets.com/Market-Reports/geography/pet-health-insurance-market/australia",
            "date": "2025",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "SEO 内容（比价/理赔）+ 兽医诊所合作 + 华人宠物社群",
        "money": "比价 affiliate 佣金；理赔协助按单 50–200 澳元；咨询费",
        "model": "内容+比价+理赔协助（affiliate/服务）",
        "roi": "启动 5,000–15,000 元（网站/内容）；1 个月首单，3 个月回本；月收入 1–4 万元；毛利 80%",
        "audience": "英语可写、能做 SEO/内容的人；适合兼职",
        "drivers": [
          "info",
          "ops"
        ],
        "moat": "内容 + 评价 + 兽医渠道；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 5000,
          "max": 15000
        },
        "time_to_revenue_months": 1,
        "payback_months": 3,
        "monthly_revenue_cny": {
          "min": 10000,
          "max": 40000
        },
        "gross_margin_pct": 80,
        "effort_level": "side",
        "team_size": 1
      },
      "risks": [
        "金融建议合规（需 disclaimer）",
        "affiliate 透明度",
        "内容同质化"
      ],
      "first_steps_7d": [
        "做 3 篇比价/理赔 SEO 文章",
        "申请 2 家 affiliate",
        "联系 2 家兽医诊所",
        "做 1 个理赔材料清单"
      ],
      "kill_criteria": [
        "6 个月无流量",
        "affiliate 收入 <成本",
        "合规风险"
      ],
      "compliance_notes": "不得提供个人化金融建议；披露 affiliate；数据隐私",
      "tags": [
        "content-driven",
        "digital",
        "b2c",
        "english-ok"
      ],
      "verified": false
    },
    {
      "id": "opp-oceania-au-agedcare-095",
      "slug": "oceania-au-agedcare",
      "title": "澳洲居家养老照护服务",
      "one_liner": "澳洲养老需求跑赢产能、居家养老政策倾斜，中文/多语种护理与适老化改造缺口大",
      "industry_id": "silver",
      "gap_type_ids": [
        "demographic",
        "regulation",
        "infrastructure"
      ],
      "region_ids": [
        "oceania"
      ],
      "origin_country": "澳大利亚",
      "target_countries": [
        "澳大利亚",
        "新西兰"
      ],
      "human_need_ids": [
        "health",
        "survival"
      ],
      "neuro_drivers": [
        "oxytocin",
        "serotonin"
      ],
      "emotion_tags": [
        "hope",
        "fear"
      ],
      "source_langs": [
        "en",
        "zh"
      ],
      "signal": {
        "summary": "澳洲政府需求导向的养老床位规划显示供给缺口，行业报告称“需求跑赢产能”；居家养老政策倾斜，华人/亚裔老人语言与饮食服务缺口大。",
        "signal_strength": 7.8,
        "trend_direction": "up",
        "volume_estimate": "澳洲养老需求缺口（官方报告口径）",
        "evidence": [
          {
            "title": "Health and Aged Care Report on the Operation of the Aged Care Act 2024-25",
            "publisher": "GEN Aged Care Data（澳政府）",
            "url": "https://www.gen-agedcaredata.gov.au/getmedia/cd6a26e3-f236-469b-859b-0e164fa46702/25256-Health-and-Aged-Care-ROACA24-25-WEB",
            "date": "2025",
            "quote": "（官方 PDF，未直连）",
            "lang": "en",
            "tier": "primary"
          },
          {
            "title": "Aged care report shows demand outrunning capacity",
            "publisher": "The Weekly Source",
            "url": "https://www.theweeklysource.com.au/aged-cares-annual-report-card-lands-and-the-numbers-tell-a-bigger-story/",
            "date": "2025",
            "quote": "（标题级，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "华人社区/教会 + 医院出院转介 + 本地 GP",
        "money": "居家照护 35–60 澳元/小时；适老化改造 2,000–15,000 澳元/户",
        "model": "照护中介/护理员培训 + 适老化改造（需资质）",
        "roi": "启动 3–10 万元（资质/培训）；3 个月首单，9 个月回本；月收入 3–10 万元；毛利 35%",
        "audience": "有护理/养老资质、英语/中文双语的人；需本地注册",
        "drivers": [
          "ops",
          "regulation"
        ],
        "moat": "资质 + 双语 + 社区信任；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 30000,
          "max": 100000
        },
        "time_to_revenue_months": 3,
        "payback_months": 9,
        "monthly_revenue_cny": {
          "min": 30000,
          "max": 100000
        },
        "gross_margin_pct": 35,
        "effort_level": "full",
        "team_size": 3
      },
      "risks": [
        "牌照/合规（NDIS/Aged Care）",
        "人力成本",
        "保险与责任"
      ],
      "first_steps_7d": [
        "查澳洲居家养老资质要求",
        "联系 2 家本地照护机构",
        "访谈 5 个华人家庭",
        "做 1 份服务价格表"
      ],
      "kill_criteria": [
        "资质 6 个月未取得",
        "人力成本吃掉毛利",
        "无稳定客源"
      ],
      "compliance_notes": "养老/护理需本地注册与保险；背景审查；不得虚假宣传",
      "tags": [
        "needs-license",
        "b2b",
        "localization-heavy"
      ],
      "verified": false
    },
    {
      "id": "opp-china-ai-toys-096",
      "slug": "china-ai-toys",
      "title": "中国 AI 玩具出海",
      "one_liner": "2025 中国 AI 玩具线上 7.4 亿元（+427%）、ASP 降至 340 元，情绪陪伴硬件出海窗口打开",
      "industry_id": "ai",
      "gap_type_ids": [
        "time",
        "channel",
        "emotion"
      ],
      "region_ids": [
        "china",
        "north-america",
        "europe"
      ],
      "origin_country": "中国",
      "target_countries": [
        "美国",
        "英国",
        "德国",
        "日本"
      ],
      "human_need_ids": [
        "belonging",
        "expression"
      ],
      "neuro_drivers": [
        "oxytocin",
        "dopamine"
      ],
      "emotion_tags": [
        "love",
        "curiosity"
      ],
      "source_langs": [
        "zh",
        "en"
      ],
      "signal": {
        "summary": "2025 年中国 AI 玩具线上销售 7.4 亿元（+427.4%）、销量 160.4 万台（+864.2%）、渗透率 0.2%→4.3%；AI 潮流毛绒玩具 1.8 亿元（+1,465.9%），ASP 从 1,000+ 降至 340 元；女性用户 28%→39%，26–35 岁占 44.7%；2026 年“硬件+订阅”预计成主流。",
        "signal_strength": 8.6,
        "trend_direction": "up",
        "volume_estimate": "线上 7.4 亿元（+427.4%）；160.4 万台（+864.2%）",
        "evidence": [
          {
            "title": "China's AI Toy Market 2025: The Rise of Emotional Companions",
            "publisher": "Moojing Market Intelligence",
            "url": "https://moojing-global.com/news-research/china-ai-toys-market-growth-2025",
            "date": "2026-02-02",
            "quote": "Online sales reached CN¥740 million in 2025 (+427.4% YoY), volume reached 1.604 million units (+864.2% YoY)",
            "lang": "en",
            "tier": "secondary"
          },
          {
            "title": "CTE 见证 AI 玩具进化，京东 JoyInside 生态蓄势 11.11",
            "publisher": "亿欧",
            "url": "https://www.iyiou.com/news/202610221144140",
            "date": "2026-10-22",
            "quote": "（标题级，未直连）",
            "lang": "zh",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "TikTok/Reels 开箱 + 众筹（Kickstarter/Indiegogo）+ 亚马逊/独立站",
        "money": "硬件客单 50–150 美元 + 订阅 5–15 美元/月；毛利 45%–60%",
        "model": "中国供应链 + 海外品牌/众筹 + 内容订阅",
        "roi": "启动 5–20 万元（打样/认证/内容）；3 个月首单，9 个月回本；月收入 3–15 万元；毛利 45%",
        "audience": "有硬件/供应链资源、能做英文内容与海外营销的人",
        "drivers": [
          "tech",
          "info"
        ],
        "moat": "IP/角色 + 内容订阅 + 合规；窗口期 12–18 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 50000,
          "max": 200000
        },
        "time_to_revenue_months": 3,
        "payback_months": 9,
        "monthly_revenue_cny": {
          "min": 30000,
          "max": 150000
        },
        "gross_margin_pct": 45,
        "effort_level": "full",
        "team_size": 3
      },
      "risks": [
        "儿童隐私/安全合规",
        "AI 内容审核",
        "硬件售后与退货"
      ],
      "first_steps_7d": [
        "找 2 家 AI 玩具代工厂打样",
        "做 1 条英文开箱视频测试",
        "查 COPPA/CE 认证要求",
        "设计 1 个订阅内容方案"
      ],
      "kill_criteria": [
        "认证 3 个月未过",
        "退货率 >10%",
        "内容订阅留存 <20%"
      ],
      "compliance_notes": "儿童产品安全（CPSC/CE）；隐私（COPPA/GDPR）；AI 内容不得有害",
      "tags": [
        "china-advantage",
        "ai-native",
        "physical",
        "b2c",
        "cross-border"
      ],
      "verified": false
    },
    {
      "id": "opp-china-hanfu-097",
      "slug": "china-hanfu",
      "title": "中国汉服/新中式婚庆",
      "one_liner": "2025 中国汉服市场超 200 亿元、企业 7,000+ 家，海外华人婚礼与汉服社是出海切口",
      "industry_id": "culture",
      "gap_type_ids": [
        "culture",
        "emotion",
        "time"
      ],
      "region_ids": [
        "china",
        "sea",
        "east-asia"
      ],
      "origin_country": "中国",
      "target_countries": [
        "中国",
        "新加坡",
        "马来西亚",
        "美国"
      ],
      "human_need_ids": [
        "identity",
        "expression"
      ],
      "neuro_drivers": [
        "serotonin"
      ],
      "emotion_tags": [
        "pride",
        "nostalgia"
      ],
      "source_langs": [
        "zh",
        "en"
      ],
      "signal": {
        "summary": "2025 年中国汉服市场规模超 200 亿元、相关企业超 7,000 家，国潮文化消费大热门；曹县汉服成为传统产业焕新样本。海外华人婚礼/汉服社对正版汉服、妆造与摄影需求上升。",
        "signal_strength": 8.0,
        "trend_direction": "up",
        "volume_estimate": "汉服市场 >200 亿元；企业 7,000+ 家",
        "evidence": [
          {
            "title": "中国制造新势力：汉服背后的百亿产业",
            "publisher": "央视网",
            "url": "https://news.cctv.com/2025/12/10/ARTIVDUpHAInGdNAgHKojmQ3251210.shtml",
            "date": "2025-12-10",
            "quote": "2025 年，我国汉服市场规模超过 200 亿元，国内现存汉服相关企业超过了 7000 家",
            "lang": "zh",
            "tier": "primary"
          },
          {
            "title": "汉服经济：国潮消费新图景",
            "publisher": "团结网",
            "url": "https://www.tuanjiewang.cn/m/2026-03/30/content_9031430.htm",
            "date": "2026-03-30",
            "quote": "（标题级，未直连）",
            "lang": "zh",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "TikTok/Instagram 汉服内容 + 海外华人社群 + 婚庆公司",
        "money": "汉服租赁 50–300 美元/次；妆造摄影 300–1,500 美元/套；跨境汉服客单 80–400 美元",
        "model": "海外汉服租赁/妆造 + 跨境汉服电商",
        "roi": "启动 2–8 万元（样衣/妆造）；2 个月首单，6 个月回本；月收入 1–5 万元；毛利 45%",
        "audience": "懂汉服文化/妆造、能做海外内容的人",
        "drivers": [
          "info",
          "cross-border"
        ],
        "moat": "正版设计 + 妆造 + 社群；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 20000,
          "max": 80000
        },
        "time_to_revenue_months": 2,
        "payback_months": 6,
        "monthly_revenue_cny": {
          "min": 10000,
          "max": 50000
        },
        "gross_margin_pct": 45,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "文化误解/失礼",
        "版权（原创设计）",
        "物流与尺码"
      ],
      "first_steps_7d": [
        "调研海外汉服租赁价格",
        "找 2 家曹县汉服工厂",
        "做 1 条英文汉服内容",
        "联系 1 家海外婚庆"
      ],
      "kill_criteria": [
        "6 个月无订单",
        "版权纠纷",
        "毛利 <25%"
      ],
      "compliance_notes": "原创设计版权；文化呈现需尊重；跨境纺织品标签",
      "tags": [
        "china-advantage",
        "physical",
        "content-driven",
        "cross-border"
      ],
      "verified": false
    },
    {
      "id": "opp-china-usedcar-service-098",
      "slug": "china-usedcar-service",
      "title": "二手车出口海外售后",
      "one_liner": "2025 中国二手车出口 50–60 万辆、毛利降至 5–10%，海外售后/配件/检测成下半场",
      "industry_id": "manufacturing",
      "gap_type_ids": [
        "infrastructure",
        "knowledge",
        "price"
      ],
      "region_ids": [
        "china",
        "cis",
        "africa",
        "latam"
      ],
      "origin_country": "中国",
      "target_countries": [
        "俄罗斯",
        "乌兹别克斯坦",
        "尼日利亚",
        "墨西哥"
      ],
      "human_need_ids": [
        "status",
        "control"
      ],
      "neuro_drivers": [
        "serotonin",
        "cortisol"
      ],
      "emotion_tags": [
        "hope",
        "anxiety"
      ],
      "source_langs": [
        "zh",
        "ru"
      ],
      "signal": {
        "summary": "2025 年全国二手车出口预计 50–60 万辆；行业平均毛利率从 2021–2023 的 25%–30% 收窄到 5%–10%；2026-01-01 起出口注册不满 180 天车辆须厂家售后确认；四川双流基地 2025 年出口 2.3 万辆（+280%）、新能源占近 50%，海外服务站覆盖塔什干/莫斯科/比什凯克。",
        "signal_strength": 8.3,
        "trend_direction": "up",
        "volume_estimate": "出口 50–60 万辆（2025）；双流基地 2.3 万辆/30.1 亿元",
        "evidence": [
          {
            "title": "二手车出海驶入下半场，成都如何“换挡”抢滩？",
            "publisher": "新浪财经（转川观新闻）",
            "url": "https://finance.sina.com.cn/jjxw/2026-06-12/doc-iniceimi3394569.shtml",
            "date": "2026-06-12",
            "quote": "2025 年全国二手车出口预计达 50 万—60 万辆；行业平均毛利率已从 25%—30% 收窄至 5%—10%",
            "lang": "zh",
            "tier": "secondary"
          },
          {
            "title": "绥芬河上演“车水马龙”出海记",
            "publisher": "新浪财经",
            "url": "https://finance.sina.com.cn/jjxw/2026-06-29/doc-iniezsva2335884.shtml",
            "date": "2026-06-29",
            "quote": "（标题级，未直连）",
            "lang": "zh",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "二手车出口基地 + 海外车商 + 中欧班列/口岸",
        "money": "配件差价 20%–35%；检测认证按车 100–300 美元；维修培训/延保",
        "model": "海外售后网点 + 配件供应 + 检测认证",
        "roi": "启动 10–30 万元（配件/检测设备）；6 个月首单，14 个月回本；月收入 3–12 万元；毛利 30%",
        "audience": "有汽车/外贸经验、能落地海外服务点的人",
        "drivers": [
          "supply",
          "ops"
        ],
        "moat": "海外服务网络 + 配件供应链；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 100000,
          "max": 300000
        },
        "time_to_revenue_months": 6,
        "payback_months": 14,
        "monthly_revenue_cny": {
          "min": 30000,
          "max": 120000
        },
        "gross_margin_pct": 30,
        "effort_level": "full",
        "team_size": 3
      },
      "risks": [
        "海外合规/认证",
        "配件供应链",
        "回款与汇率"
      ],
      "first_steps_7d": [
        "联系 2 家二手车出口基地",
        "调研俄罗斯/中亚配件价格",
        "找 1 家海外维修合作方",
        "做 1 份售后套餐"
      ],
      "kill_criteria": [
        "海外服务点 6 个月未落地",
        "配件成本无优势",
        "回款 >90 天"
      ],
      "compliance_notes": "车辆出口/进口认证；电池运输；售后责任",
      "tags": [
        "china-advantage",
        "b2b",
        "needs-supply-chain",
        "physical"
      ],
      "verified": false
    },
    {
      "id": "opp-china-silver-travel-099",
      "slug": "china-silver-travel",
      "title": "中国银发旅游/旅居",
      "one_liner": "中国 3 亿+ 老人、60% 每年出游、部分年花费 10 万+，精品小团与旅居供给不足",
      "industry_id": "silver",
      "gap_type_ids": [
        "demographic",
        "emotion",
        "channel"
      ],
      "region_ids": [
        "china"
      ],
      "origin_country": "中国",
      "target_countries": [
        "中国",
        "日本",
        "泰国"
      ],
      "human_need_ids": [
        "meaning",
        "belonging"
      ],
      "neuro_drivers": [
        "serotonin",
        "oxytocin"
      ],
      "emotion_tags": [
        "nostalgia",
        "hope"
      ],
      "source_langs": [
        "zh"
      ],
      "signal": {
        "summary": "中国 3 亿+ 60 岁人口；超 60% 中老年人每年至少旅游 1 次；2024 年中老年旅游订单增速超大盘 7 个百分点；携程老友会 7,000+ 产品；部分老人年花费 3–5 万元、多则 10+ 万元；供给仍以低价团为主。",
        "signal_strength": 8.2,
        "trend_direction": "up",
        "volume_estimate": "3 亿+ 老年人口；订单增速超大盘 7pct",
        "evidence": [
          {
            "title": "一年花 10 万旅行，老年人玩出万亿市场",
            "publisher": "21 世纪经济报道",
            "url": "http://www.21jingji.com/article/20250407/herald/d950b285b41112296b947cf5f72f432f.html",
            "date": "2025-04-07",
            "quote": "超 60% 的中老年人每年至少旅游 1 次；2024 年中老年旅游订单增速超大盘 7 个百分点；携程老友会已上线超 7000 条产品",
            "lang": "zh",
            "tier": "secondary"
          },
          {
            "title": "深耕银发游市场大有可为",
            "publisher": "光明网",
            "url": "https://m.gmw.cn/2025-10/17/content_38348713.htm",
            "date": "2025-10-17",
            "quote": "（标题级，未直连）",
            "lang": "zh",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "社区/老年大学 + 短视频 + 子女代订",
        "money": "精品小团 3,000–10,000 元/人；旅居月租 3,000–8,000 元；会员费",
        "model": "本地银发小团 + 康养旅居 + 内容社群",
        "roi": "启动 2–8 万元（渠道/内容）；1 个月首单，5 个月回本；月收入 2–8 万元；毛利 25%",
        "audience": "有本地老年社群/旅游经验、耐心细致的人",
        "drivers": [
          "info",
          "ops"
        ],
        "moat": "社群信任 + 健康保障 + 供应链；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 20000,
          "max": 80000
        },
        "time_to_revenue_months": 1,
        "payback_months": 5,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 80000
        },
        "gross_margin_pct": 25,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "安全/健康责任",
        "价格战",
        "季节性与退款"
      ],
      "first_steps_7d": [
        "访谈 5 位身边老人需求",
        "设计 1 条本地 2 日精品线",
        "联系 1 家地接/保险",
        "做 1 份健康告知与免责"
      ],
      "kill_criteria": [
        "安全事故/投诉",
        "毛利 <15%",
        "3 个月无成团"
      ],
      "compliance_notes": "旅游业务需资质/与旅行社合作；老年健康告知；保险与免责",
      "tags": [
        "china-advantage",
        "b2c",
        "content-driven",
        "needs-license"
      ],
      "verified": false
    },
    {
      "id": "opp-china-county-coffee-100",
      "slug": "china-county-coffee",
      "title": "中国县域咖啡供应链",
      "one_liner": "星巴克已下沉 1,000+ 县、门店超 8,000 家，县域咖啡设备/原料/培训供给不足",
      "industry_id": "local",
      "gap_type_ids": [
        "price",
        "channel",
        "demographic"
      ],
      "region_ids": [
        "china"
      ],
      "origin_country": "中国",
      "target_countries": [
        "中国"
      ],
      "human_need_ids": [
        "status",
        "ease"
      ],
      "neuro_drivers": [
        "dopamine"
      ],
      "emotion_tags": [
        "aspiration"
      ],
      "source_langs": [
        "zh"
      ],
      "signal": {
        "summary": "星巴克已下沉 1,000+ 县、门店超 8,000 家，平价咖啡迎机遇；县域咖啡店缺设备、原料与咖啡师培训，本地供应链服务是空白。",
        "signal_strength": 7.7,
        "trend_direction": "up",
        "volume_estimate": "星巴克覆盖 1,000+ 县、8,000+ 门店",
        "evidence": [
          {
            "title": "星巴克下沉千县开店超 8000 家，平价咖啡迎来新机遇",
            "publisher": "上海证券报·中国证券网",
            "url": "https://www.cnstock.com/commonDetail/579993",
            "date": "2025-11-01",
            "quote": "星巴克下沉千县开店超 8000 家，平价咖啡迎来新机遇",
            "lang": "zh",
            "tier": "secondary"
          },
          {
            "title": "星巴克中国官网",
            "publisher": "Starbucks China",
            "url": "https://www.starbucks.com.cn/",
            "date": "2026",
            "quote": "（官网，未直连）",
            "lang": "zh",
            "tier": "primary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "县域咖啡店主社群 + 设备展会 + 本地生活平台",
        "money": "设备/原料差价 20%–35%；咖啡师培训 2,000–6,000 元/人；开店咨询",
        "model": "县域咖啡 B2B 供应链 + 培训",
        "roi": "启动 3–10 万元（样机/库存）；2 个月首单，7 个月回本；月收入 2–8 万元；毛利 30%",
        "audience": "有餐饮供应链/咖啡经验、能下沉做服务的人",
        "drivers": [
          "supply",
          "ops"
        ],
        "moat": "本地服务 + 培训 + 供应链；窗口期 18–24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 30000,
          "max": 100000
        },
        "time_to_revenue_months": 2,
        "payback_months": 7,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 80000
        },
        "gross_margin_pct": 30,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "县域消费力不足",
        "价格战",
        "库存积压"
      ],
      "first_steps_7d": [
        "调研 3 个县的咖啡店数量",
        "找 2 家设备/原料供应商",
        "做 1 期咖啡师培训课",
        "算单店投入产出"
      ],
      "kill_criteria": [
        "3 个月无客户",
        "库存周转 >90 天",
        "毛利 <20%"
      ],
      "compliance_notes": "食品经营许可；设备安全；不得虚假宣传",
      "tags": [
        "china-advantage",
        "b2b",
        "needs-supply-chain",
        "physical"
      ],
      "verified": false
    },
    {
      "id": "opp-china-guzi-overseas-101",
      "slug": "china-guzi-overseas",
      "title": "中国谷子/潮玩出海",
      "one_liner": "2025 中国谷子经济 2,021 亿元（+19.7%），国内内卷后东南亚/北美成出海窗口",
      "industry_id": "content",
      "gap_type_ids": [
        "culture",
        "time",
        "channel"
      ],
      "region_ids": [
        "china",
        "sea",
        "north-america"
      ],
      "origin_country": "中国",
      "target_countries": [
        "中国",
        "印尼",
        "泰国",
        "美国"
      ],
      "human_need_ids": [
        "expression",
        "status"
      ],
      "neuro_drivers": [
        "dopamine"
      ],
      "emotion_tags": [
        "identity",
        "pride"
      ],
      "source_langs": [
        "zh",
        "en"
      ],
      "signal": {
        "summary": "2025 年中国泛二次元市场 6,521 亿元（+9.1%），谷子经济 2,021 亿元（+19.7%），线下门店 +40%、60+ 核心商圈；国内竞争激烈，东南亚/北美对中文 IP 接受度上升，跨境电商基础设施成熟。",
        "signal_strength": 8.1,
        "trend_direction": "up",
        "volume_estimate": "谷子经济 2,021 亿元（+19.7%）；门店 +40%",
        "evidence": [
          {
            "title": "2026 年中国泛二次元及周边行业现状及趋势分析，谷子经济线下场景融合拓展消费边界",
            "publisher": "华经产业研究院",
            "url": "https://www.huaon.com/channel/trend/1168058.html",
            "date": "2026-05-29",
            "quote": "2025 年中国谷子经济市场规模达 2021 亿元，同比增长 19.7%；线下门店数量同比增加 40%",
            "lang": "zh",
            "tier": "secondary"
          },
          {
            "title": "China's Analogue Economy: Fuse Beads, Bead Cafés and the Turn to Crafts",
            "publisher": "Moojing",
            "url": "https://moojing-global.com/industry-reports/china-analogue-economy-2026",
            "date": "2026-10",
            "quote": "（报告页，未直连）",
            "lang": "en",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "TikTok/Instagram + 漫展/快闪 + 跨境电商",
        "money": "谷子客单 10–100 美元，毛利 50%–70%；IP 授权分成",
        "model": "原创/授权 IP 谷子 + 跨境店/快闪",
        "roi": "启动 2–8 万元（设计/打样/库存）；2 个月首单，6 个月回本；月收入 1–6 万元；毛利 55%",
        "audience": "有设计/二次元审美、能做海外内容的人",
        "drivers": [
          "info",
          "supply"
        ],
        "moat": "原创设计 + IP + 社群；窗口期 12–18 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 20000,
          "max": 80000
        },
        "time_to_revenue_months": 2,
        "payback_months": 6,
        "monthly_revenue_cny": {
          "min": 10000,
          "max": 60000
        },
        "gross_margin_pct": 55,
        "effort_level": "side",
        "team_size": 2
      },
      "risks": [
        "IP 侵权",
        "库存积压",
        "文化差异"
      ],
      "first_steps_7d": [
        "调研海外谷子价格带",
        "找 2 家义乌/东莞工厂",
        "设计 3 款原创周边",
        "做 1 条 TikTok 内容"
      ],
      "kill_criteria": [
        "侵权风险不可控",
        "库存周转 >120 天",
        "6 个月无复购"
      ],
      "compliance_notes": "IP 授权；原创版权；跨境小包申报",
      "tags": [
        "content-driven",
        "cross-border",
        "physical",
        "china-advantage"
      ],
      "verified": false
    },
    {
      "id": "opp-sea-vietnam-livecommerce-102",
      "slug": "sea-vietnam-livecommerce",
      "title": "越南直播电商代运营",
      "one_liner": "2025 越南 TikTok Shop GMV +66%，品牌化升级缺本地主播与运营，中国团队可切入",
      "industry_id": "crossborder",
      "gap_type_ids": [
        "platform",
        "channel",
        "language"
      ],
      "region_ids": [
        "sea"
      ],
      "origin_country": "越南",
      "target_countries": [
        "越南"
      ],
      "human_need_ids": [
        "status",
        "expression"
      ],
      "neuro_drivers": [
        "dopamine",
        "adrenaline"
      ],
      "emotion_tags": [
        "envy",
        "curiosity"
      ],
      "source_langs": [
        "vi",
        "zh"
      ],
      "signal": {
        "summary": "2025 年 TikTok Shop 越南 GMV 同比 +66%，并扩展数字商业生态；越南直播电商从白牌转向品牌，本地主播与运营供给不足。",
        "signal_strength": 7.9,
        "trend_direction": "up",
        "volume_estimate": "TikTok Shop 越南 GMV +66%（2025）",
        "evidence": [
          {
            "title": "TikTok Shop tăng trưởng 66%, mở rộng hệ sinh thái thương mại số",
            "publisher": "Báo Công Thương（越南工贸部）",
            "url": "https://congthuong.vn/tiktok-shop-tang-truong-66-mo-rong-he-sinh-thai-thuong-mai-so-467087.html",
            "date": "2026-10-08",
            "quote": "（标题级，未直连）",
            "lang": "vi",
            "tier": "secondary"
          },
          {
            "title": "Tổng giá trị giao dịch của TikTok Shop tại Việt Nam tăng 66% năm 2025",
            "publisher": "VietnamPlus",
            "url": "https://www.vietnamplus.vn/tong-gia-tri-giao-dich-cua-tiktok-shop-tai-viet-nam-tang-66-nam-2025-post1126796.vnp",
            "date": "2026",
            "quote": "（标题级，未直连）",
            "lang": "vi",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "TikTok Shop 越南站 + 本地达人 + 中国供应链",
        "money": "代运营月费 5,000–15,000 元 + 佣金 5%–10%；直播场次费",
        "model": "中国供应链 + 越南主播/运营代运营",
        "roi": "启动 3–10 万元（团队/设备）；2 个月首单，7 个月回本；月收入 2–8 万元；毛利 45%",
        "audience": "有直播电商经验、能管理越南团队的人",
        "drivers": [
          "ops",
          "info"
        ],
        "moat": "主播资源 + 供应链 + 本地合规；窗口期 9–15 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 30000,
          "max": 100000
        },
        "time_to_revenue_months": 2,
        "payback_months": 7,
        "monthly_revenue_cny": {
          "min": 20000,
          "max": 80000
        },
        "gross_margin_pct": 45,
        "effort_level": "full",
        "team_size": 3
      },
      "risks": [
        "平台政策变化",
        "税务合规",
        "本地竞争"
      ],
      "first_steps_7d": [
        "调研越南 TikTok Shop 类目",
        "联系 2 个越南主播/MCN",
        "找 1 个本地合规顾问",
        "做 1 场测试直播"
      ],
      "kill_criteria": [
        "3 个月无品牌客户",
        "平台封店",
        "毛利 <25%"
      ],
      "compliance_notes": "越南电商税/进口合规；直播内容合规；主播合同",
      "tags": [
        "china-advantage",
        "platform-dependent",
        "localization-heavy",
        "b2b"
      ],
      "verified": false
    },
    {
      "id": "opp-mena-chinese-vocational-103",
      "slug": "mena-chinese-vocational",
      "title": "中东中文+职业技能培训",
      "one_liner": "沙特把中文纳入学校教育、中企出海带来就业需求，中文+行业术语培训供给短缺",
      "industry_id": "education",
      "gap_type_ids": [
        "language",
        "demographic",
        "knowledge"
      ],
      "region_ids": [
        "mena",
        "sea"
      ],
      "origin_country": "沙特",
      "target_countries": [
        "沙特",
        "阿联酋",
        "印尼"
      ],
      "human_need_ids": [
        "growth",
        "status"
      ],
      "neuro_drivers": [
        "serotonin"
      ],
      "emotion_tags": [
        "hope",
        "pride"
      ],
      "source_langs": [
        "ar",
        "zh"
      ],
      "signal": {
        "summary": "沙特教育部门继续扩大中文在学校开设范围；中文教学被视为“打开通往世界的大门”。中企出海带来本地员工中文/中国员工阿语需求，但“中文+行业术语（电商/新能源/护理）”课程供给短缺。",
        "signal_strength": 7.6,
        "trend_direction": "up",
        "volume_estimate": "沙特中文教育扩张（官方口径）",
        "evidence": [
          {
            "title": "沙特教育部门继续扩大中文在学校的开设范围",
            "publisher": "沙特通讯社（SPA 中文版）",
            "url": "https://www.spa.gov.sa/zh/N2329724",
            "date": "2025",
            "quote": "（标题级，未直连）",
            "lang": "zh",
            "tier": "primary"
          },
          {
            "title": "“中文教学为学生打开了一扇通往世界的大门”",
            "publisher": "人民网",
            "url": "http://world.people.com.cn/n1/2025/1111/c1002-40601394.html",
            "date": "2025-11-11",
            "quote": "（标题级，未直连）",
            "lang": "zh",
            "tier": "secondary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "中企外派群 + 沙特学校/大学合作 + LinkedIn",
        "money": "企业培训 300–800 元/人/课时；在线课程 99–999 元；留学咨询",
        "model": "在线+企业内训（中文+行业术语）",
        "roi": "启动 1–3 万元（课程/网站）；2 个月首单，5 个月回本；月收入 1–4 万元；毛利 65%",
        "audience": "对外汉语/阿语能力、有企业培训经验的人",
        "drivers": [
          "info"
        ],
        "moat": "课程内容 + 企业客户；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 10000,
          "max": 30000
        },
        "time_to_revenue_months": 2,
        "payback_months": 5,
        "monthly_revenue_cny": {
          "min": 10000,
          "max": 40000
        },
        "gross_margin_pct": 65,
        "effort_level": "side",
        "team_size": 1
      },
      "risks": [
        "教育资质",
        "地缘政治",
        "付费能力差异"
      ],
      "first_steps_7d": [
        "设计 1 门“中文+电商”课",
        "联系 2 家中企 HR",
        "找 1 家沙特学校合作",
        "做 1 份试听课"
      ],
      "kill_criteria": [
        "3 个月无企业客户",
        "资质无法解决",
        "续费率 <30%"
      ],
      "compliance_notes": "境外办学/培训资质；文化尊重；数据合规",
      "tags": [
        "china-advantage",
        "digital",
        "localization-heavy",
        "b2c"
      ],
      "verified": false
    },
    {
      "id": "opp-cis-eac-cert-104",
      "slug": "cis-eac-cert",
      "title": "中亚 EAC 认证合规",
      "one_liner": "中国商品进入 EAEU 需 EAC 认证、本地化要求提高，认证代理与标签合规供给少",
      "industry_id": "compliance",
      "gap_type_ids": [
        "regulation",
        "knowledge",
        "geo"
      ],
      "region_ids": [
        "cis"
      ],
      "origin_country": "哈萨克斯坦",
      "target_countries": [
        "哈萨克斯坦",
        "俄罗斯",
        "乌兹别克斯坦"
      ],
      "human_need_ids": [
        "control",
        "fairness"
      ],
      "neuro_drivers": [
        "cortisol",
        "serotonin"
      ],
      "emotion_tags": [
        "anxiety",
        "relief"
      ],
      "source_langs": [
        "ru",
        "zh"
      ],
      "signal": {
        "summary": "哈萨克斯坦水泥项目投资协议要求 ≥50% 本地化产量并使用本地原料，说明 EAEU 本地化/合规要求在提高；中国商品进入俄语区需 EAC（TR CU）认证与俄语标签，服务供给少。",
        "signal_strength": 7.4,
        "trend_direction": "up",
        "volume_estimate": "EAEU 认证需求随中国商品进入增长",
        "evidence": [
          {
            "title": "Kazakhstan and China advance USD 200 mln cement plant project",
            "publisher": "Kazinform",
            "url": "https://qazinform.com/news/kazakhstan-and-china-advance-usd-200-mln-cement-plant-project-in-aktobe-region-e4b501",
            "date": "2025-11-13",
            "quote": "investors have committed to supplying at least 50% of production to the domestic market",
            "lang": "en",
            "tier": "primary"
          },
          {
            "title": "欧亚经济联盟 EEC 官网（技术法规）",
            "publisher": "Eurasian Economic Commission",
            "url": "https://eec.eaeunion.org/",
            "date": "2026",
            "quote": "（官网，未直连）",
            "lang": "ru",
            "tier": "primary"
          }
        ]
      },
      "seven_questions": {
        "traffic": "中国出口企业 + 俄语区实验室/认证机构 + 跨境服务商",
        "money": "EAC 认证代理 5,000–30,000 元/证；标签/文件 1,000–5,000 元；年费",
        "model": "认证代理 + 文件合规（与俄语区实验室合作）",
        "roi": "启动 2–8 万元（合作/资质）；3 个月首单，8 个月回本；月收入 1–5 万元；毛利 50%",
        "audience": "有俄语能力/认证资源的人",
        "drivers": [
          "regulation",
          "info"
        ],
        "moat": "实验室合作 + 案例；窗口期 24 个月"
      },
      "roi": {
        "capital_cny": {
          "min": 20000,
          "max": 80000
        },
        "time_to_revenue_months": 3,
        "payback_months": 8,
        "monthly_revenue_cny": {
          "min": 10000,
          "max": 50000
        },
        "gross_margin_pct": 50,
        "effort_level": "side",
        "team_size": 1
      },
      "risks": [
        "认证责任",
        "制裁合规",
        "政策变化"
      ],
      "first_steps_7d": [
        "查 3 类产品 EAC 要求",
        "联系 2 家俄语区实验室",
        "做 1 份认证清单",
        "访谈 3 家出口企业"
      ],
      "kill_criteria": [
        "无实验室合作",
        "6 个月无客户",
        "制裁导致业务中断"
      ],
      "compliance_notes": "认证须由认可机构出具；不得出具虚假证书；制裁/出口管制合规",
      "tags": [
        "b2b",
        "needs-license",
        "localization-heavy"
      ],
      "verified": false
    }
  ]
}
```
