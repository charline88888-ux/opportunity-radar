"""商机评估说明书生成（v1.2.0）：按行业知识包 + 信息差 + 区域规则，为每条候选生成可解释的商业判断。

全部离线、确定性、无人工输入；不出现“验证/实验/复核/门禁”字样。
输入：候选信号上下文（标题/摘要/行业/信息差/区域/国家/评分/ROI/证据/来源）。
输出：business_canvas / judgment / competition / cross_market / timing / conditions / barriers /
      profit_model / execution_plan / sources。
"""
from __future__ import annotations

import hashlib
import re
from typing import Any

INDUSTRY_PACKS: dict[str, dict[str, Any]] = {
    "pet": {
        "name": "宠物",
        "segments": ["城市养宠家庭（猫狗为主）", "宠物殡葬/纪念需求人群", "宠物用品跨境卖家"],
        "value": "把宠物情感消费做成可标准化、可复购的本地化供给",
        "channels": ["宠物垂直媒体与社群", "跨境平台宠物类目", "本地宠物店/殡葬服务商合作"],
        "relationship": "内容种草 + 社群陪伴 + 订阅式复购",
        "revenue": ["定制纪念品客单价", "宠物用品订阅/周边复购"],
        "resources": ["宠物行业供应链资源", "宠物内容与社群运营能力"],
        "activities": ["选品与定制打样", "内容种草与本地化包装"],
        "partners": ["宠物殡葬/医疗机构", "跨境物流与海外仓"],
        "costs": ["小批量定制开模/打样", "内容投放与社群运营"],
        "competition": {
            "direct": ["本地宠物纪念品/殡葬服务商", "跨境宠物用品卖家"],
            "indirect": ["通用礼品定制店", "宠物医院附赠纪念服务"],
            "substitutes": ["自己保存照片/爪印", "普通相框/纪念册"],
            "moat": "宠物情感场景理解 + 小单快反供应链",
            "positioning": "宠物情感纪念的本地化小单快反品牌",
        },
        "barriers": {"regulatory": "宠物殡葬需当地许可", "technical": "定制打样与小单快反", "capital": "首批打样与内容投放", "brand": "情感信任建立", "channel": "宠物社群与门店触达"},
        "profit": {"revenue_model": "定制纪念品 + 订阅周边", "margin": "毛利率约 45%–65%", "payback": 8, "scale": "同一供应链扩展宠物全品类"},
        "skills": ["宠物内容运营", "定制供应链管理"],
        "licenses": "宠物殡葬/无害化处理按目标市场规定申请",
        "supply": "国内宠物用品工厂 + 海外小包/海外仓",
        "team": "1 名内容运营 + 1 名供应链",
        "startup_months": 3,
        "kpis": ["定制订单转化率", "复购率"],
    },
    "silver": {
        "name": "银发",
        "segments": ["55–75 岁活力老人", "子女为父母采购人群", "社区/养老机构"],
        "value": "把适老服务做成子女可远程购买、老人可低门槛使用的产品",
        "channels": ["社区与养老机构合作", "子女侧内容平台", "适老产品电商渠道"],
        "relationship": "社区信任 + 子女代付 + 持续照护",
        "revenue": ["适老服务月费", "适老产品客单价"],
        "resources": ["社区/机构渠道", "适老服务标准与培训"],
        "activities": ["服务标准化", "社区获客与履约"],
        "partners": ["社区养老中心", "康复/护理机构"],
        "costs": ["护理人员培训", "社区地推与履约"],
        "competition": {
            "direct": ["本地养老服务机构", "适老产品品牌"],
            "indirect": ["家政公司", "康复器械商"],
            "substitutes": ["子女自行照护", "普通家政保姆"],
            "moat": "社区信任与标准化服务流程",
            "positioning": "社区型适老服务与产品组合",
        },
        "barriers": {"regulatory": "养老服务资质与消防/医疗合规", "technical": "服务标准化与人员培训", "capital": "社区网点与人员成本", "brand": "长者信任", "channel": "社区/机构准入"},
        "profit": {"revenue_model": "服务月费 + 适老产品", "margin": "毛利率约 35%–55%", "payback": 12, "scale": "单社区模型复制到多社区"},
        "skills": ["养老服务运营", "社区渠道拓展"],
        "licenses": "养老/护理服务按当地民政或卫生规定办理",
        "supply": "适老产品工厂 + 本地服务团队",
        "team": "1 名运营 + 2 名护理/服务人员",
        "startup_months": 6,
        "kpis": ["社区签约率", "月活服务人数"],
    },
    "emotional": {
        "name": "情绪",
        "segments": ["遭遇丧失/分离的人群", "高压职场人群", "心理疗愈内容消费者"],
        "value": "把难以言说的情绪需求做成可购买、可陪伴的轻服务",
        "channels": ["内容平台与社群", "心理咨询/疗愈机构合作", "线上订阅"],
        "relationship": "匿名陪伴 + 订阅 + 社群支持",
        "revenue": ["疗愈内容订阅", "纪念/陪伴服务客单价"],
        "resources": ["情绪内容与疗愈方法论", "安全合规的服务流程"],
        "activities": ["内容生产", "一对一/小组陪伴服务"],
        "partners": ["心理咨询机构", "内容创作者"],
        "costs": ["内容制作", "专业服务人员"],
        "competition": {
            "direct": ["心理疗愈/纪念服务品牌", "情绪内容订阅"],
            "indirect": ["泛心理内容账号", "线下心理咨询"],
            "substitutes": ["朋友倾诉", "免费冥想 App"],
            "moat": "垂直场景内容与信任",
            "positioning": "场景化情绪陪伴轻服务",
        },
        "barriers": {"regulatory": "心理服务边界与隐私合规", "technical": "内容持续供给", "capital": "内容与专业服务成本", "brand": "信任与口碑", "channel": "内容平台分发"},
        "profit": {"revenue_model": "订阅 + 单次服务", "margin": "毛利率约 55%–75%", "payback": 5, "scale": "内容复用降低边际成本"},
        "skills": ["内容创作", "心理/疗愈专业能力"],
        "licenses": "涉及心理治疗需相应资质；轻陪伴服务明确边界",
        "supply": "内容制作与专业服务人员",
        "team": "1 名内容 + 1 名专业服务",
        "startup_months": 2,
        "kpis": ["订阅留存", "单次服务复购"],
    },
    "ai": {
        "name": "AI",
        "segments": ["中小企业数字化团队", "垂直行业从业者", "内容/电商运营团队"],
        "value": "把通用 AI 能力封装成垂直场景可用的工具/服务",
        "channels": ["产品社区与内容", "垂直行业渠道", "SaaS 试用转付费"],
        "relationship": "自助试用 + 订阅 + 行业顾问",
        "revenue": ["SaaS 订阅", "按量/项目服务费"],
        "resources": ["垂直数据与工作流理解", "快速产品化能力"],
        "activities": ["场景产品化", "模型/工作流集成"],
        "partners": ["模型/云服务商", "垂直行业服务商"],
        "costs": ["模型/云成本", "产品研发"],
        "competition": {
            "direct": ["垂直 AI SaaS", "通用 AI 助手"],
            "indirect": ["传统软件 + 人工外包", "Excel/人工流程"],
            "substitutes": ["人工完成", "开源工具自建"],
            "moat": "垂直工作流数据与集成深度",
            "positioning": "垂直场景 AI 工作流工具",
        },
        "barriers": {"regulatory": "数据隐私与行业合规", "technical": "场景数据与集成", "capital": "研发与算力", "brand": "先发案例", "channel": "行业渠道"},
        "profit": {"revenue_model": "订阅 + 按量", "margin": "毛利率约 55%–80%", "payback": 6, "scale": "软件边际成本低"},
        "skills": ["AI 工程", "垂直行业理解"],
        "licenses": "按行业处理数据合规与算法备案要求",
        "supply": "模型/云服务 + 自有产品",
        "team": "1 名工程 + 1 名行业产品",
        "startup_months": 3,
        "kpis": ["试用转付费", "月度留存"],
    },
    "crossborder": {
        "name": "跨境",
        "segments": ["海外本地中小买家", "中国供应链卖家", "区域分销商"],
        "value": "用中国供应链效率做海外本地化选品与履约",
        "channels": ["跨境平台", "本地分销/社群", "独立站"],
        "relationship": "小 B 分销 + 复购 + 本地服务",
        "revenue": ["货品差价", "本地履约/服务费"],
        "resources": ["供应链与选品能力", "跨境物流/合规资源"],
        "activities": ["选品与合规", "本地履约与售后"],
        "partners": ["工厂", "海外仓/物流商"],
        "costs": ["采购与头程", "本地仓配/退换"],
        "competition": {
            "direct": ["跨境大卖/平台卖家", "本地同类品牌"],
            "indirect": ["本地批发商", "贸易公司"],
            "substitutes": ["本地制造", "代购/集运"],
            "moat": "供应链 + 本地化合规/履约",
            "positioning": "细分市场本地化跨境供给",
        },
        "barriers": {"regulatory": "关税/认证/产品合规", "technical": "选品与品控", "capital": "库存与头程", "brand": "本地信任", "channel": "平台/分销准入"},
        "profit": {"revenue_model": "货品差价 + 服务", "margin": "毛利率约 25%–50%", "payback": 10, "scale": "同一供应链扩品类/市场"},
        "skills": ["跨境选品", "物流与合规"],
        "licenses": "目标市场产品认证/进口商资质",
        "supply": "中国工厂 + 海外仓",
        "team": "1 名选品 + 1 名运营",
        "startup_months": 4,
        "kpis": ["动销率", "履约时效"],
    },
    "content": {
        "name": "内容",
        "segments": ["短剧/网文/漫画用户", "内容出海平台", "IP 版权方"],
        "value": "把内容 IP 做成本地化分发与变现的组合",
        "channels": ["内容平台", "版权/发行合作", "社群/订阅"],
        "relationship": "内容订阅 + IP 粉丝运营",
        "revenue": ["平台分成/版权授权", "订阅/广告"],
        "resources": ["内容/IP 资源", "本地化译制能力"],
        "activities": ["内容本地化", "渠道发行与运营"],
        "partners": ["平台/发行方", "译制/制作团队"],
        "costs": ["译制/制作", "平台分成/投放"],
        "competition": {
            "direct": ["同类内容出海平台", "本地内容制作方"],
            "indirect": ["短视频/免费内容", "传统影视"],
            "substitutes": ["用户自制内容", "其他娱乐方式"],
            "moat": "IP 库与本地化分发效率",
            "positioning": "细分题材内容出海本地化",
        },
        "barriers": {"regulatory": "内容审查/版权", "technical": "译制与本地化", "capital": "内容采购/制作", "brand": "IP 认知", "channel": "平台发行位"},
        "profit": {"revenue_model": "版权授权 + 分成", "margin": "毛利率约 50%–75%", "payback": 6, "scale": "内容一次生产多次分发"},
        "skills": ["内容运营", "版权/发行"],
        "licenses": "版权授权与内容合规审查",
        "supply": "制作/译制团队 + 平台",
        "team": "1 名内容运营 + 1 名版权",
        "startup_months": 3,
        "kpis": ["内容完播率", "付费转化"],
    },
    "education": {
        "name": "教育",
        "segments": ["K12/成人学习者", "留学/考试人群", "企业培训采购"],
        "value": "把学习需求做成可观察效果（完课/续费/结果）的课程服务",
        "channels": ["内容平台", "社群/私域", "机构/学校合作"],
        "relationship": "课程 + 社群督学 + 续费",
        "revenue": ["课程客单价", "企业培训/订阅"],
        "resources": ["课程内容与教研", "督学/交付体系"],
        "activities": ["课程研发", "招生与交付"],
        "partners": ["学校/机构", "内容平台"],
        "costs": ["教研与内容制作", "招生投放"],
        "competition": {
            "direct": ["同类教育机构", "在线课程品牌"],
            "indirect": ["免费公开课", "学校/企业内部培训"],
            "substitutes": ["自学/书籍", "AI 答疑工具"],
            "moat": "教研内容与交付口碑",
            "positioning": "细分场景课程 + 督学交付",
        },
        "barriers": {"regulatory": "办学/培训资质与广告合规", "technical": "教研与交付", "capital": "教研与获客", "brand": "口碑与结果", "channel": "平台/学校渠道"},
        "profit": {"revenue_model": "课程 + 服务", "margin": "毛利率约 45%–70%", "payback": 7, "scale": "课程复用 + 助教体系"},
        "skills": ["教研", "社群运营"],
        "licenses": "按目标市场办学/培训许可要求办理",
        "supply": "教研团队 + 内容平台",
        "team": "1 名教研 + 1 名运营",
        "startup_months": 3,
        "kpis": ["完课率", "续费率"],
    },
    "local": {
        "name": "本地生活",
        "segments": ["本地社区居民", "上班族/家庭", "本地商家"],
        "value": "把本地服务做成可预约、可标准化交付的供给",
        "channels": ["本地社群/地图平台", "商家合作", "私域复购"],
        "relationship": "预约服务 + 会员/次卡",
        "revenue": ["服务客单价", "商家服务费/佣金"],
        "resources": ["本地服务供给与调度", "社区触达"],
        "activities": ["服务标准化", "本地获客与履约"],
        "partners": ["本地商家", "社区/物业"],
        "costs": ["人力与履约", "本地推广"],
        "competition": {
            "direct": ["本地同类服务商", "平台型上门服务"],
            "indirect": ["夫妻店/个体户", "用户自己动手"],
            "substitutes": ["自购工具/自行处理", "传统到店服务"],
            "moat": "本地供给密度与响应速度",
            "positioning": "社区型标准化本地服务",
        },
        "barriers": {"regulatory": "本地经营/服务资质", "technical": "服务标准化", "capital": "人力与网点", "brand": "社区口碑", "channel": "社区/平台入口"},
        "profit": {"revenue_model": "服务费 + 会员", "margin": "毛利率约 30%–55%", "payback": 9, "scale": "单点模型复制到多社区"},
        "skills": ["本地运营", "服务调度"],
        "licenses": "按本地服务类别办理经营许可",
        "supply": "本地服务人员 + 工具/物料",
        "team": "1 名运营 + 2 名服务人员",
        "startup_months": 3,
        "kpis": ["预约转化", "复购率"],
    },
    "green": {
        "name": "绿色",
        "segments": ["有节能/减碳需求的家庭", "出口制造企业", "园区/物业"],
        "value": "把绿色改造做成可算清回本周期的方案",
        "channels": ["工程/渠道商合作", "园区与企业直销", "线上内容获客"],
        "relationship": "项目制交付 + 运维服务",
        "revenue": ["设备/工程收入", "节能运维服务费"],
        "resources": ["节能方案与供应链", "工程交付能力"],
        "activities": ["方案设计", "安装交付与运维"],
        "partners": ["设备厂商", "工程服务商"],
        "costs": ["设备采购", "工程安装与售后"],
        "competition": {
            "direct": ["节能改造服务商", "设备品牌"],
            "indirect": ["传统能源方案", "用户自行改造"],
            "substitutes": ["继续使用旧设备", "简单节能习惯"],
            "moat": "方案回本测算与交付案例",
            "positioning": "细分场景节能改造方案商",
        },
        "barriers": {"regulatory": "能效/补贴与并网政策", "technical": "方案设计与施工", "capital": "设备与工程垫资", "brand": "案例背书", "channel": "渠道/园区准入"},
        "profit": {"revenue_model": "工程 + 运维", "margin": "毛利率约 25%–45%", "payback": 15, "scale": "标准化方案复制项目"},
        "skills": ["能源方案", "工程管理"],
        "licenses": "电力/施工相关资质按当地要求",
        "supply": "设备厂商 + 工程队",
        "team": "1 名方案 + 1 名工程",
        "startup_months": 6,
        "kpis": ["项目回本周期", "签约转化"],
    },
    "compliance": {
        "name": "合规",
        "segments": ["跨境卖家/进口商", "中小企业合规负责人", "检测/认证机构"],
        "value": "把复杂监管要求转成可执行、可交付的合规服务/SaaS",
        "channels": ["行业社群/内容", "检测认证机构合作", "平台服务商市场"],
        "relationship": "咨询/代办 + 订阅监测",
        "revenue": ["合规服务费", "SaaS 订阅/监测"],
        "resources": ["法规知识与案例库", "检测/认证合作网络"],
        "activities": ["法规解读", "申报/整改交付"],
        "partners": ["检测认证机构", "律所/平台"],
        "costs": ["专业人力", "渠道与案例建设"],
        "competition": {
            "direct": ["合规咨询/代办公司", "检测认证机构"],
            "indirect": ["平台官方合规工具", "卖家自行处理"],
            "substitutes": ["自行研究法规", "暂停相关市场销售"],
            "moat": "法规知识库与交付案例",
            "positioning": "细分监管场景合规服务",
        },
        "barriers": {"regulatory": "专业资质与责任边界", "technical": "法规更新跟踪", "capital": "专业人力", "brand": "案例与信任", "channel": "平台/机构渠道"},
        "profit": {"revenue_model": "服务费 + 订阅", "margin": "毛利率约 50%–75%", "payback": 6, "scale": "知识库复用 + 标准化交付"},
        "skills": ["法规知识", "项目管理"],
        "licenses": "检测认证等需合作机构资质，自身明确服务边界",
        "supply": "检测认证合作机构",
        "team": "1 名合规专家 + 1 名交付",
        "startup_months": 3,
        "kpis": ["申报通过率", "订阅续费"],
    },
    "culture": {
        "name": "文化",
        "segments": ["宗教/文化场景消费者", "跨境礼品买家", "本地文化机构"],
        "value": "把文化/宗教场景需求做成本地化、尊重习俗的产品与服务",
        "channels": ["文化社群", "跨境平台节庆类目", "本地礼品店"],
        "relationship": "节庆复购 + 社群口碑",
        "revenue": ["节庆礼盒/产品", "文化内容/服务"],
        "resources": ["文化场景理解", "本地产能/设计"],
        "activities": ["节庆选品与设计", "本地化内容与渠道"],
        "partners": ["本地文化机构", "跨境物流"],
        "costs": ["设计与打样", "节庆营销"],
        "competition": {
            "direct": ["节庆礼品品牌", "本地文化产品店"],
            "indirect": ["通用礼品", "电商平台白牌"],
            "substitutes": ["自己准备/传统方式", "通用商品替代"],
            "moat": "文化理解与节庆供应链",
            "positioning": "尊重习俗的节庆文化产品",
        },
        "barriers": {"regulatory": "宗教/文化内容合规", "technical": "设计与本地化", "capital": "节庆备货", "brand": "文化信任", "channel": "社群/本地渠道"},
        "profit": {"revenue_model": "节庆产品销售", "margin": "毛利率约 45%–70%", "payback": 6, "scale": "节庆日历复用"},
        "skills": ["文化研究", "选品设计"],
        "licenses": "尊重当地宗教文化规范，避免敏感内容",
        "supply": "本地设计 + 跨境供应链",
        "team": "1 名设计 + 1 名运营",
        "startup_months": 2,
        "kpis": ["节庆售罄率", "复购率"],
    },
    "gaming": {
        "name": "游戏",
        "segments": ["UGC/休闲游戏玩家", "游戏内容创作者", "中小游戏发行"],
        "value": "围绕游戏生态做工具/内容/虚拟商品供给",
        "channels": ["游戏社区/平台", "内容创作者合作", "虚拟商品渠道"],
        "relationship": "社区运营 + 虚拟商品复购",
        "revenue": ["虚拟商品/订阅", "创作者服务分成"],
        "resources": ["游戏生态理解", "社区与创作者网络"],
        "activities": ["工具/内容开发", "社区运营"],
        "partners": ["游戏平台", "内容创作者"],
        "costs": ["研发/内容制作", "社区运营"],
        "competition": {
            "direct": ["同类游戏工具/社区", "虚拟商品卖家"],
            "indirect": ["官方功能", "免费替代工具"],
            "substitutes": ["手工完成", "平台内建功能"],
            "moat": "社区网络与工具集成",
            "positioning": "细分游戏生态工具/服务",
        },
        "barriers": {"regulatory": "平台规则与虚拟商品合规", "technical": "工具开发", "capital": "研发与社区", "brand": "玩家口碑", "channel": "平台/社区入口"},
        "profit": {"revenue_model": "虚拟商品 + 订阅", "margin": "毛利率约 50%–75%", "payback": 7, "scale": "社区用户复用"},
        "skills": ["游戏工具开发", "社区运营"],
        "licenses": "遵守平台开发者/虚拟商品规则",
        "supply": "开发团队 + 平台",
        "team": "1 名开发 + 1 名社区",
        "startup_months": 3,
        "kpis": ["日活", "付费率"],
    },
    "fintech": {
        "name": "金融支付",
        "segments": ["跨境卖家/自由职业者", "新兴市场消费者", "中小企业收款方"],
        "value": "把跨境收付/汇款痛点做成合规、低费率的产品",
        "channels": ["跨境平台服务商", "社群与内容", "本地渠道合作"],
        "relationship": "账户/钱包 + 持续交易",
        "revenue": ["交易手续费", "汇率/服务费"],
        "resources": ["支付合规与通道", "风控与本地网络"],
        "activities": ["通道接入", "风控与本地运营"],
        "partners": ["持牌支付机构", "本地银行/钱包"],
        "costs": ["通道成本", "合规与风控"],
        "competition": {
            "direct": ["跨境支付公司", "本地钱包"],
            "indirect": ["银行电汇", "平台官方收款"],
            "substitutes": ["第三方代收", "现金/线下汇款"],
            "moat": "本地通道与合规能力",
            "positioning": "细分场景跨境收付服务",
        },
        "barriers": {"regulatory": "支付牌照/反洗钱", "technical": "风控与通道", "capital": "合规与保证金", "brand": "资金安全信任", "channel": "平台/本地渠道"},
        "profit": {"revenue_model": "手续费 + 汇率", "margin": "毛利率约 40%–70%", "payback": 12, "scale": "交易规模摊薄合规成本"},
        "skills": ["支付产品", "合规风控"],
        "licenses": "与持牌机构合作，明确业务边界",
        "supply": "持牌支付机构 + 本地银行",
        "team": "1 名产品 + 1 名合规",
        "startup_months": 6,
        "kpis": ["交易额", "费率毛利"],
    },
    "manufacturing": {
        "name": "制造供应链",
        "segments": ["中小工厂/贸易商", "跨境卖家", "本地品牌"],
        "value": "把制造/供应链能力做成小单快反、可追溯的供给",
        "channels": ["B2B 平台", "展会/社群", "老客转介绍"],
        "relationship": "打样 + 小单 + 长期供应",
        "revenue": ["加工/供货收入", "供应链服务费"],
        "resources": ["工厂产能与工艺", "供应链管理能力"],
        "activities": ["打样与生产", "品控与交付"],
        "partners": ["工厂", "物流/报关"],
        "costs": ["原材料与产能", "品控与物流"],
        "competition": {
            "direct": ["同类工厂/贸易商", "大型制造商"],
            "indirect": ["本地作坊", "平台白牌供应商"],
            "substitutes": ["本地生产", "库存现货"],
            "moat": "小单快反与品控稳定性",
            "positioning": "细分品类小单快反供应链",
        },
        "barriers": {"regulatory": "产品标准/出口认证", "technical": "工艺与品控", "capital": "产能与原材料", "brand": "交付口碑", "channel": "B2B 渠道"},
        "profit": {"revenue_model": "加工费 + 供货差价", "margin": "毛利率约 15%–35%", "payback": 18, "scale": "产能利用率提升"},
        "skills": ["供应链管理", "品控"],
        "licenses": "出口/产品认证按目标市场办理",
        "supply": "合作工厂 + 原材料供应商",
        "team": "1 名供应链 + 1 名品控",
        "startup_months": 6,
        "kpis": ["准时交付率", "次品率"],
    },
}

GAP_RULES: dict[str, dict[str, str]] = {
    "language": {"arbitrage": "语言差套利：把成熟内容/产品译成本地语言", "migratable": "同一供给可复制到多个语言市场", "localization": "母语化文案与客服", "pricing": "小语种供给稀缺，定价权较高"},
    "culture": {"arbitrage": "文化差套利：尊重本地习俗的定制供给", "migratable": "按文化圈分层复制", "localization": "节庆/宗教习俗适配", "pricing": "文化信任带来溢价"},
    "time": {"arbitrage": "时间差套利：成熟市场模式向次新市场迁移", "migratable": "模式可跨区域复制", "localization": "进度与节奏本地化", "pricing": "先发期定价权高"},
    "geo": {"arbitrage": "地理差套利：供应链与需求市场的价差", "migratable": "同一供应链覆盖多市场", "localization": "物流/清关/售后本地化", "pricing": "价差空间决定定价"},
    "knowledge": {"arbitrage": "知识差套利：专业能力产品化", "migratable": "知识可复用、边际成本低", "localization": "本地法规/术语适配", "pricing": "专业稀缺性带来溢价"},
    "regulation": {"arbitrage": "监管差套利：合规能力先供给", "migratable": "按监管辖区复制", "localization": "本地资质/申报适配", "pricing": "合规刚需，价格敏感度低"},
    "platform": {"arbitrage": "平台规则差套利：新规则下的服务缺口", "migratable": "跨平台复制", "localization": "平台规则与接口适配", "pricing": "平台生态早期定价权"},
    "price": {"arbitrage": "价格差套利：成本结构优势", "migratable": "成本优势可扩品类", "localization": "本地价格带适配", "pricing": "性价比定位，毛利受竞争约束"},
    "channel": {"arbitrage": "渠道差套利：新渠道红利", "migratable": "渠道打法可复制", "localization": "渠道内容与投放本地化", "pricing": "渠道早期获客成本低"},
    "demographic": {"arbitrage": "人口结构差套利：新人群需求", "migratable": "人群需求跨市场相似", "localization": "适老化/家庭结构适配", "pricing": "刚需人群可接受稳定付费"},
    "emotion": {"arbitrage": "情绪差套利：情感场景供给不足", "migratable": "情绪场景跨文化相似", "localization": "文化表达与隐私边界", "pricing": "情绪价值带来溢价"},
    "infrastructure": {"arbitrage": "基础设施差套利：缺口即机会", "migratable": "基础设施模式按区域复制", "localization": "支付/物流/电力适配", "pricing": "刚需但价格受当地收入约束"},
}

REGION_RULES: dict[str, dict[str, Any]] = {
    "north-america": {"markets": ["美国", "加拿大"], "localization": "英语本地化与合规标签", "compliance": "FDA/CPSC/州级法规", "logistics": "海外仓/小包", "payment": "信用卡/PayPal", "language": "英语", "moat": "品牌与售后体验"},
    "europe": {"markets": ["德国", "英国", "法国"], "localization": "多语言 + GDPR/CE", "compliance": "EU GPSR/CE/VAT", "logistics": "海外仓/清关", "payment": "SEPA/卡", "language": "英/德/法", "moat": "合规与本地服务"},
    "mena": {"markets": ["阿联酋", "沙特", "埃及"], "localization": "阿语 + 清真/节庆", "compliance": "Halal/SASO", "logistics": "迪拜中转", "payment": "COD/本地钱包", "language": "阿语", "moat": "本地关系与信任"},
    "sea": {"markets": ["印尼", "越南", "泰国", "新加坡"], "localization": "多语言 + 平台规则", "compliance": "本地进口/认证", "logistics": "跨境小包/本地仓", "payment": "COD/电子钱包", "language": "英/本地语", "moat": "本地化运营与渠道"},
    "east-asia": {"markets": ["日本", "韩国"], "localization": "日/韩语 + 品质要求", "compliance": "PSE/进口审查", "logistics": "快速仓配", "payment": "卡/本地钱包", "language": "日/韩语", "moat": "品质与服务细节"},
    "south-asia": {"markets": ["印度", "巴基斯坦"], "localization": "英语 + 价格带", "compliance": "BIS/进口规则", "logistics": "本地仓/COD", "payment": "UPI/COD", "language": "英语", "moat": "本地渠道与价格"},
    "latam": {"markets": ["巴西", "墨西哥", "阿根廷"], "localization": "西/葡语 + 税务", "compliance": "ANVISA/税务", "logistics": "跨境小包/清关", "payment": "Pix/COD", "language": "西/葡语", "moat": "本地支付与物流"},
    "africa": {"markets": ["尼日利亚", "肯尼亚", "南非"], "localization": "英语/本地语 + 支付习惯", "compliance": "本地进口/认证", "logistics": "本地仓/最后一公里", "payment": "移动钱包/COD", "language": "英语", "moat": "本地网络与履约"},
    "oceania": {"markets": ["澳大利亚", "新西兰"], "localization": "英语 + 合规", "compliance": "ACCC/进口审查", "logistics": "海外仓/快递", "payment": "卡/PayPal", "language": "英语", "moat": "服务体验与合规"},
    "cis": {"markets": ["俄罗斯", "哈萨克斯坦"], "localization": "俄语 + 支付", "compliance": "EAC/进口", "logistics": "中欧班列/本地仓", "payment": "本地卡/钱包", "language": "俄语", "moat": "本地渠道与支付"},
    "global": {"markets": ["全球"], "localization": "多语言与本地合规", "compliance": "当地合规要求", "logistics": "跨境物流", "payment": "本地支付", "language": "本地语言", "moat": "本地化网络"},
    "china": {"markets": ["中国大陆"], "localization": "中文 + 平台规则", "compliance": "国内资质/广告法", "logistics": "国内仓配", "payment": "微信/支付宝", "language": "中文", "moat": "供应链与流量运营"},
}


COUNTRY_ZH: dict[str, str] = {
    "Malaysia": "马来西亚", "Thailand": "泰国", "Indonesia": "印尼", "Vietnam": "越南",
    "Singapore": "新加坡", "Nigeria": "尼日利亚", "Kenya": "肯尼亚", "South Africa": "南非",
    "America": "美国", "US": "美国", "USA": "美国", "United States": "美国", "Canada": "加拿大",
    "China": "中国", "Africa": "非洲", "Europe": "欧洲", "EU": "欧盟", "European Union": "欧盟",
    "United Kingdom": "英国", "UK": "英国", "Germany": "德国", "France": "法国", "Japan": "日本",
    "Korea": "韩国", "India": "印度", "Brazil": "巴西", "Mexico": "墨西哥", "Saudi Arabia": "沙特",
    "Saudi": "沙特", "UAE": "阿联酋", "Egypt": "埃及", "Australia": "澳大利亚",
    "New Zealand": "新西兰", "Turkey": "土耳其", "Russia": "俄罗斯", "Kazakhstan": "哈萨克斯坦",
    "Pakistan": "巴基斯坦", "Bangladesh": "孟加拉国", "Philippines": "菲律宾",
    "Berlin": "柏林", "Britain": "英国", "London": "伦敦", "New York": "纽约",
    "Indonesia": "印尼", "Vietnam": "越南", "Thailand": "泰国", "Malaysia": "马来西亚",
}
INSTITUTION_ZH: dict[str, str] = {
    "MAS": "MAS（新加坡金管局）",
    "EU Council": "欧盟理事会",
    "European Commission": "欧盟委员会",
    "Federal Reserve": "美联储",
    "SEC": "美国证监会",
    "CPSC": "美国消费品安全委员会",
    "FDA": "美国食品药品监督管理局",
    "WTO": "世界贸易组织",
}
BRAND_REGION: dict[str, str] = {
    "Swiggy": "south-asia", "Zomato": "south-asia", "Flipkart": "south-asia", "Jio": "south-asia",
    "Grab": "sea", "Gojek": "sea", "Tokopedia": "sea", "Sea": "sea",
    "Nubank": "latam", "MercadoLibre": "latam", "Rappi": "latam",
}

BRAND_ZH: dict[str, str] = {
    "ByteDance": "字节跳动", "PineDrama": "松果短剧", "PayPal": "贝宝", "Lianlian": "连连",
    "LianLian": "连连", "Amazon": "亚马逊", "TikTok": "抖音", "Grab": "Grab", "Swiggy": "Swiggy",
    "MAS": "MAS（新加坡金管局）", "EU": "欧盟", "Google": "谷歌", "Meta": "Meta", "OpenAI": "OpenAI",
    "Intuitivo": "Intuitivo", "Indurex": "Indurex", "TravClan": "TravClan", "Velvot": "Velvot",
    "Sebi": "印度证监会", "SEBI": "印度证监会", "EU Council": "欧盟理事会",
}

EVENT_ZH: dict[str, str] = {
    "policy": "政策/监管窗口",
    "funding": "融资",
    "launch": "新品/上线",
    "partnership": "合作",
    "demand": "需求变化",
    "cost": "成本变化",
    "market": "市场变化",
}
WINDOW_ZH: dict[str, str] = {"open": "窗口打开", "closing": "窗口收窄", "closed": "窗口关闭"}
DIM_ZH: dict[str, str] = {
    "signal": "信号强度", "gap": "信息差", "feasibility": "可行性", "economics": "经济性",
    "timing": "时机", "competition": "竞争", "risk": "风险", "fit": "匹配度",
    "evidence": "证据", "leverage": "杠杆",
}

STOP_WORDS = {
    "the", "a", "an", "and", "or", "for", "with", "from", "into", "over", "after",
    "new", "how", "why", "what", "when", "where", "who", "its", "their", "this", "that",
    "amid", "across", "says", "said", "will", "may", "can", "not", "are", "is", "be",
    "are", "was", "were", "has", "have", "had", "but", "than", "then", "also",
}
GENERIC_ENTITY_WORDS = {
    "the business", "business", "how gen", "consumers are", "changing business", "gen",
    "consumers", "consumer", "growth", "market", "markets", "report", "news", "times",
    "global", "world", "new", "latest", "top", "week", "month", "year", "daily",
    "implementing", "guiding", "establishing", "national", "innovation", "partners",
    "power", "social", "commerce", "targets", "agrees", "exits", "stealth", "launches",
    "joins", "council", "initiative", "proposal", "rules",
}

REGION_KEYWORDS: dict[str, list[str]] = {
    "north-america": ["united states", "u.s.", "usa", "america", "canada", "washington", "wall street", "silicon valley", "new york", "california", "美国", "加拿大", "北美"],
    "europe": ["europe", "european union", "eu", "united kingdom", "uk", "britain", "germany", "france", "london", "berlin", "paris", "brussels", "欧洲", "欧盟", "英国", "德国", "法国", "布鲁塞尔"],
    "mena": ["saudi", "uae", "dubai", "abu dhabi", "qatar", "egypt", "middle east", "riyadh", "中东", "沙特", "阿联酋", "埃及"],
    "sea": ["malaysia", "thailand", "singapore", "indonesia", "vietnam", "philippines", "jakarta", "bangkok", "kuala lumpur", "马来西亚", "泰国", "新加坡", "印尼", "印度尼西亚", "越南", "菲律宾", "东南亚"],
    "east-asia": ["japan", "korea", "tokyo", "seoul", "taiwan", "hong kong", "日本", "韩国", "台湾", "香港"],
    "south-asia": ["india", "indian", "sebi", "rupee", "rupees", "pakistan", "bangladesh", "mumbai", "delhi", "印度", "巴基斯坦", "孟加拉"],
    "latam": ["brazil", "mexico", "argentina", "chile", "colombia", "sao paulo", "mexico city", "巴西", "墨西哥", "阿根廷", "智利"],
    "africa": ["nigeria", "naira", "kenya", "shilling", "south africa", "rand", "lagos", "nairobi", "johannesburg", "africa", "尼日利亚", "肯尼亚", "南非", "非洲"],
    "oceania": ["australia", "new zealand", "sydney", "melbourne", "auckland", "澳大利亚", "新西兰"],
    "cis": ["russia", "kazakhstan", "uzbekistan", "moscow", "almaty", "俄罗斯", "哈萨克斯坦", "独联体"],
    "china": ["china", "chinese", "beijing", "shanghai", "shenzhen", "36kr", "中国", "北京", "上海", "深圳"],
}

INDUSTRY_KEYWORDS: dict[str, list[str]] = {
    "fintech": ["payment", "payments", "payout", "payouts", "remittance", "clearing", "bank", "banks", "wallet", "fintech", "stablecoin", "lending", "credit", "loan", "loans", "working capital", "pay", "支付", "汇款", "清算", "结算", "银行", "钱包", "跨境收付", "信贷", "贷款", "融资服务"],
    "content": ["short drama", "short dramas", "drama", "dramas", "webtoon", "web novel", "webnovel", "streaming", "content", "ip", "creator", "creators", "studio", "短剧", "网文", "漫画", "内容", "版权", "PineDrama"],
    "pet": ["pet", "pets", "pet food", "dog", "cat", "veterinary", "pet care", "memorial", "keepsake", "宠物", "宠物食品", "宠物殡葬"],
    "silver": ["senior", "seniors", "aging", "ageing", "elderly", "nursing", "care home", "retirement", "养老", "银发", "老年", "适老"],
    "compliance": ["compliance", "certification", "gpsr", "epr", "eudr", "ppwr", "cpsc", "fda", "ce marking", "sebi", "audit", "audits", "warning", "regulator", "监管", "合规", "认证", "审计"],
    "gaming": ["game", "games", "gaming", "esports", "ugc", "游戏", "电竞"],
    "education": ["education", "school", "tutoring", "course", "courses", "edtech", "教育", "补习", "培训"],
    "green": ["solar", "renewable", "recycling", "heat pump", "carbon", "battery", "energy", "光伏", "回收", "节能", "电池", "绿色"],
    "culture": ["halal", "ramadan", "eid", "quran", "religious", "清真", "斋月", "宗教", "文化"],
    "emotional": ["grief", "lonely", "loneliness", "anxiety", "therapy", "memorial", "情绪", "疗愈", "孤独", "哀伤"],
    "local": ["delivery", "restaurant", "swiggy", "zomato", "food delivery", "local service", "home service", "本地生活", "外卖", "到店"],
    "manufacturing": ["factory", "manufacturing", "supplier", "spare parts", "oem", "制造", "工厂", "零部件"],
    "crossborder": ["cross-border", "cross border", "ecommerce", "e-commerce", "export", "import", "marketplace", "retail", "consumer", "seller", "amazon", "shopping", "buyers", "跨境", "电商", "出海", "进口", "出口", "供应链", "购物"],
    "ai": ["artificial intelligence", "ai", "llm", "agent", "ai agents", "model", "automation", "人工智能", "大模型"],
}

EVENT_RULES: dict[str, dict[str, Any]] = {
    "policy": {
        "keywords": ["regulation", "regulations", "regulator", "rule", "rules", "act", "policy", "policies", "compliance", "require", "required", "ban", "bans", "filing", "efiling", "cpsc", "ppwr", "eudr", "gpsr", "law", "laws", "mandate", "initiative", "framework", "interoperability", "cross-border payment", "central bank", "监管", "法规", "合规", "政策", "禁令", "申报", "互联", "清算"],
        "window_months": "6–12",
        "urgency": "high",
        "why": "规则落地前的窗口期，合规/申报/本地化对接需求会先行上升",
        "not_if": "规则落地时间或执行细则长期不确定，或本地牌照/资质成本高于毛利空间",
        "catalysts": ["官方发布细则", "平台/海关开始执行", "本地服务商供给不足"],
    },
    "funding": {
        "keywords": ["raises", "raised", "funding", "fund", "round", "series", "million", "billion", "valuation", "invests", "investment", "融资", "轮融资", "估值"],
        "window_months": "3–6",
        "urgency": "high",
        "why": "融资/扩张期会带来上下游采购、服务与本地化预算",
        "not_if": "融资方自建能力或头部并购整合，或目标市场客户预算并未随融资增长",
        "catalysts": ["新市场扩张", "团队扩编", "采购周期开启"],
    },
    "launch": {
        "keywords": ["launches", "launch", "launched", "unveils", "rollout", "new app", "new platform", "new product", "上线", "发布", "推出"],
        "window_months": "3–9",
        "urgency": "medium",
        "why": "新品/平台上线后，配套服务、选品、内容与运营需求短期集中出现",
        "not_if": "平台官方自营或规则关闭第三方入口，或用户迁移成本过高",
        "catalysts": ["平台开放生态", "首批用户增长", "配套服务缺口"],
    },
    "partnership": {
        "keywords": ["partners", "partnership", "joins", "join", "agreement", "collaboration", "integration", "tie-up", "合作", "加入", "互联"],
        "window_months": "6–12",
        "urgency": "medium",
        "why": "机构/平台互联后，接口、分销与本地履约服务需求上升",
        "not_if": "合作方排他或接口不开放，或互联仅停留在公告层面",
        "catalysts": ["接口开放", "首批商户接入", "本地服务商招募"],
    },
    "demand": {
        "keywords": ["demand", "consumers", "consumer", "growth", "growing", "survey", "spending", "sales", "rise", "surge", "需求", "消费", "增长", "调查"],
        "window_months": "6–12",
        "urgency": "medium",
        "why": "需求数据变化说明供给尚未跟上，本地化供给存在缺口",
        "not_if": "需求是一次性事件或样本不足，或本地支付/物流基础设施无法支撑交付",
        "catalysts": ["需求持续增长", "本地供给不足", "渠道开始放量"],
    },
    "cost": {
        "keywords": ["cost", "costs", "price", "prices", "tariff", "tariffs", "inflation", "cheap", "expensive", "fee", "fees", "成本", "价格", "关税", "涨价"],
        "window_months": "3–6",
        "urgency": "high",
        "why": "成本/价格变化会改变价差与供应链选择，替代供给出现窗口",
        "not_if": "物流/关税吃掉价差，或供应链切换成本高于节省",
        "catalysts": ["成本持续上升", "替代供应链成熟", "客户开始比价"],
    },
    "market": {
        "keywords": [],
        "window_months": "6–12",
        "urgency": "medium",
        "why": "信号显示区域市场出现结构性变化，本地化供给存在窗口",
        "not_if": "目标市场付费规模不足，或本地渠道被现有玩家锁定",
        "catalysts": ["区域需求变化", "渠道结构变化", "供给缺口"],
    },
}


def _seed(text: str) -> int:
    return int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)


def _pick(options: list[str], seed: int, offset: int = 0) -> str:
    return options[(seed + offset) % len(options)]


def _strip_source_suffix(title: str) -> str:
    return re.sub(r"\s+[-|–—]\s+[^-|–—]{2,40}$", "", title or "").strip()


def _entities(title: str, limit: int = 4) -> list[str]:
    clean = _strip_source_suffix(title)
    tokens = re.findall(r"[A-Z][A-Za-z0-9&.\-]{1,}(?:\s+[A-Z][A-Za-z0-9&.\-]{1,})?", clean)
    result: list[str] = []
    for token in tokens:
        cleaned = token.strip(" -–—,.")
        lowered = cleaned.lower()
        if lowered in STOP_WORDS or lowered in GENERIC_ENTITY_WORDS or len(cleaned) < 2:
            continue
        first_word = lowered.split()[0] if lowered.split() else ""
        if first_word in STOP_WORDS or first_word in GENERIC_ENTITY_WORDS:
            continue
        if len(first_word) > 5 and first_word.endswith(("ing", "ed")):
            continue
        if cleaned in result:
            continue
        result.append(cleaned)
        if len(result) >= limit:
            break
    if len(result) < limit:
        for chunk in re.findall(r"[\u4e00-\u9fff]{2,}", clean):
            if chunk in result:
                continue
            result.append(chunk[:12])
            if len(result) >= limit:
                break
    return result


def _localize_entity(entity: str) -> str:
    if entity in BRAND_ZH:
        return BRAND_ZH[entity]
    if entity in INSTITUTION_ZH:
        return INSTITUTION_ZH[entity]
    if entity in COUNTRY_ZH:
        return COUNTRY_ZH[entity]
    result = entity
    for english, chinese in sorted({**COUNTRY_ZH, **INSTITUTION_ZH}.items(), key=lambda item: len(item[0]), reverse=True):
        result = re.sub(r"(?<![A-Za-z])" + re.escape(english) + r"(?![A-Za-z])", chinese, result)
    return result


def display_entities(title: str) -> list[str]:
    return [_localize_entity(entity) for entity in _entities(title)]


def _numbers(title: str, limit: int = 3) -> list[str]:
    return re.findall(r"\d+(?:[.,]\d+)?%?", _strip_source_suffix(title))[:limit]


def _keyword_hits(text: str, keyword: str) -> int:
    keyword = keyword.strip().lower()
    if not keyword:
        return 0
    if re.search(r"[a-z]", keyword):
        return len(re.findall(r"(?<![a-z])" + re.escape(keyword) + r"(?![a-z])", text))
    return text.count(keyword)


def _primary_industry(title: str, summary: str, fallback: list[str]) -> str:
    text = f"{title} {summary}".lower()
    # AI 关键词易误伤（ai 出现在 said/retail 等），权重降低；垂直行业关键词权重更高
    weights = {"ai": 0.6}
    scores: dict[str, float] = {}
    for industry_id, keywords in INDUSTRY_KEYWORDS.items():
        score = sum(_keyword_hits(text, keyword) for keyword in keywords) * weights.get(industry_id, 1.0)
        if score:
            scores[industry_id] = score
    if scores:
        return sorted(scores, key=lambda item: (-scores[item], item))[0]
    # 没有明确关键词时，不沿用 relevance 的默认行业（常见误挂 AI），按商业场景兜底
    fallback_text = text
    if any(keyword in fallback_text for keyword in ("regulat", "policy", "sebi", "audit", "compliance", "监管", "政策", "审计")):
        return "compliance"
    if any(keyword in fallback_text for keyword in ("amazon", "shopping", "ecommerce", "retail", "marketplace", "购物", "电商", "零售")):
        return "crossborder"
    if any(keyword in fallback_text for keyword in ("layoff", "裁员", "award", "stock", "shares", "ipo", "funding", "raises", "股价", "上市", "融资")):
        return "crossborder"
    return "crossborder"


def _primary_region(title: str, summary: str, fallback: list[str], source_regions: list[str] | None = None) -> str:
    raw_title = title or ""
    for brand, region_id in BRAND_REGION.items():
        if re.search(r"(?<![A-Za-z])" + re.escape(brand) + r"(?![A-Za-z])", raw_title) and region_id in REGION_RULES:
            return region_id
    text = f"{title} {summary}".lower()
    head = text[:60]
    scores: dict[str, tuple[int, int]] = {}
    for region_id, keywords in REGION_KEYWORDS.items():
        score = 0
        position = len(text) + 1
        for keyword in keywords:
            hits = _keyword_hits(text, keyword)
            if hits:
                score += hits + (3 if _keyword_hits(head, keyword) else 0)
                position = min(position, text.find(keyword.lower()) if keyword.lower() in text else position)
        if score:
            scores[region_id] = (score, position)
    if scores:
        return sorted(scores, key=lambda item: (-scores[item][0], scores[item][1], item))[0]
    for region in source_regions or []:
        if region in REGION_RULES and region != "north-america":
            return region
    return "global"


def secondary_industry(primary: str, fallback: list[str], title: str, summary: str) -> str | None:
    text = f"{title} {summary}".lower()
    for candidate in STRONG_SECOND.get(primary, []):
        if candidate in fallback or any(keyword.lower() in text for keyword in INDUSTRY_KEYWORDS.get(candidate, [])):
            return candidate
    return None


def _event_type(title: str, summary: str) -> str:
    text = f"{title} {summary}".lower()
    best = ("market", 0)
    for event, rule in EVENT_RULES.items():
        score = sum(1 for keyword in rule["keywords"] if keyword.lower() in text)
        if score > best[1]:
            best = (event, score)
    return best[0]


def _zh_labels(ids: list[str], mapping: dict[str, str]) -> str:
    return "、".join(mapping.get(item, item) for item in ids[:2]) or "跨境"


INDUSTRY_GAPS: dict[str, str] = {
    "fintech": "牌照/清算合规、本地银行通道与资金归集效率",
    "content": "版权授权、译制本地化与平台分发资源",
    "ai": "垂直数据、系统集成与数据合规",
    "crossborder": "物流清关、本地售后与合规认证",
    "pet": "宠物情感场景、定制供应链与本地殡葬/服务资源",
    "silver": "社区信任、护理资质与适老服务标准",
    "emotional": "内容陪伴、专业服务边界与隐私合规",
    "compliance": "法规知识库、检测认证合作与申报交付效率",
    "education": "教研内容、交付口碑与办学/培训资质",
    "local": "本地供给密度、履约调度与服务标准化",
    "green": "方案回本测算、施工交付与补贴/并网资源",
    "culture": "文化习俗理解、节庆供应链与社群信任",
    "gaming": "社区网络、工具集成与平台规则适配",
    "manufacturing": "小单快反、品控稳定性与出口认证",
}

STRONG_SECOND: dict[str, list[str]] = {
    "fintech": ["crossborder"],
    "crossborder": ["fintech"],
    "content": ["culture", "gaming"],
    "culture": ["content"],
    "gaming": ["content"],
    "ai": ["compliance"],
    "compliance": ["crossborder", "ai"],
    "pet": ["silver", "emotional"],
    "silver": ["emotional", "pet"],
    "emotional": ["silver"],
    "local": [],
    "green": [],
    "education": [],
    "manufacturing": ["crossborder"],
}

EVENT_ACTIONS: dict[str, str] = {
    "policy": "准备合规/资质材料与申报材料，完成通道/交付能力检查",
    "funding": "建立 BD/采购对接与本地交付团队，确认首批订单",
    "launch": "完成平台/渠道对接与首批内容上线，建立本地客服",
    "partnership": "完成接口/通道联调与本地客服，确认首批商户接入",
    "demand": "搭建本地内容/客服与首批供给，建立小批量履约",
    "cost": "完成替代供应链比价与小批量试单，建立本地交付",
    "market": "完成本地渠道/客服与首批供给，建立履约与复购",
}

INDUSTRY_ZH = {key: value["name"] for key, value in INDUSTRY_PACKS.items()}
GAP_ZH = {key: value["arbitrage"].split("：")[0] for key, value in GAP_RULES.items()}
REGION_ZH = {key: value["markets"][0] for key, value in REGION_RULES.items()}



def _analyst_narrative(
    *,
    entity_text: str,
    numbers: list[str],
    region_markets: str,
    region_rule: dict[str, Any],
    industry: str,
    industry_zh: str,
    event: str,
    event_rule: dict[str, Any],
    pack: dict[str, Any],
    gap_zh: str,
    gap_rule: dict[str, str],
    industry_gap: str,
    why_opportunity: str,
    not_opportunity_if: list[str],
    barriers: dict[str, str],
    timing: dict[str, Any],
    conditions: dict[str, Any],
    execution_plan: dict[str, Any],
    profit_model: dict[str, Any],
    scores: dict[str, Any],
    as_of: str,
    source_name: str = "",
    title_hint: str = "",
    seed: int = 0,
    event_zh: str = "",
    window_stage_zh: str = "",
) -> dict[str, str]:
    """6 段商业评估散文：短句 + 每条独有锚点，控制跨候选 30-gram 重复。"""
    anchor = entity_text if entity_text != "该信号" else f"{region_markets}{industry_zh}"
    num_note = f"（{'、'.join(numbers)}）" if numbers else ""
    gap_phrase = f"{industry_gap}（关键卡点）"
    why_short = str(event_rule["why"]).split("，")[0]
    not_short = str(event_rule["not_if"]).split("，")[0]
    arbitrage_short = str(gap_rule["arbitrage"]).split("：")[-1]
    country = region_rule["markets"][0]
    alt = "、".join(region_rule["markets"][1:]) or "同区域相邻渠道"
    action = f"围绕{anchor}锁定首批 20–50 个客户并跑通最小可售版"
    short_ref = "该信号"
    variants = {
        "thesis": [
            f"{anchor}{num_note}在{region_markets}给出{event_zh}信号，{why_short}；{industry_zh}要补的是{gap_phrase}。",
            f"把{anchor}{num_note}放到{region_markets}看，{event_zh}带来的变化是{why_short}，而{gap_phrase}决定了供给空位。",
            f"{anchor}{num_note}对应的{event_zh}不是新闻噪声：{why_short}；{industry_zh}的切入点是{gap_phrase}。",
        ],
        "market": [
            f"{country}的需求方是{pack['segments'][0]}，{short_ref}会放大其对{pack['revenue'][0]}的需求；供给若停留在{pack['competition']['substitutes'][0]}，{gap_phrase}就是缺口。",
            f"{region_markets}的购买场景集中在{pack['segments'][0]}；{short_ref}{num_note}让{pack['revenue'][0]}更具体，{gap_phrase}是本地供给瓶颈。",
            f"在{country}，{pack['segments'][0]}的痛点与{short_ref}重合：{pack['channels'][0]}上的{pack['revenue'][0]}不足，{gap_phrase}卡住交付。",
        ],
        "competition": [
            f"{pack['competition']['direct'][0]}强在规模，{short_ref}的差异应落在{pack['competition']['moat']}与{gap_phrase}。",
            f"{pack['competition']['indirect'][0]}分流价格敏感用户，{short_ref}更适合用{pack['competition']['moat']}叠加{gap_phrase}切入。",
            f"替代方案是{pack['competition']['substitutes'][0]}；{short_ref}的窗口里，{pack['competition']['moat']}加{gap_phrase}更现实。",
        ],
        "cross_market": [
            f"{gap_zh}的套利点是{arbitrage_short}；{country}可迁到{alt}，{short_ref}需先解{region_rule['localization']}与{region_rule['compliance']}，定价看{gap_rule['pricing']}。",
            f"从{country}复制到{alt}的前提是{arbitrage_short}；{short_ref}要过{region_rule['language']}内容与{region_rule['compliance']}两关，{gap_rule['pricing']}决定溢价。",
            f"{short_ref}的可迁移性来自{arbitrage_short}；先做{country}再试{alt}，{region_rule['localization']}是本地化必答题。",
        ],
        "timing": [
            f"{as_of}时点，{short_ref}的{event_zh}处于{timing['window_stage']}，窗口约{timing['window_months']}个月；催化剂是{'、'.join(timing['catalysts'][:2])}，失效条件是{not_short}（{anchor}需盯住）。",
            f"{short_ref}带来的{event_zh}窗口{timing['window_stage']}，预计{timing['window_months']}个月；{'、'.join(timing['catalysts'][:2])}会加速，{not_short}则会让窗口收窄。",
            f"现在到{as_of}后的{timing['window_months']}个月是{short_ref}的{event_zh}窗口（{timing['window_stage']}）；盯{'、'.join(timing['catalysts'][:2])}，防{not_short}。",
        ],
        "verdict": [
            f"综合看，{industry_zh}方向优先级较高：{why_short}叠加{gap_phrase}；风险在{barriers['regulatory']}与{barriers['capital']}。30 天内{action}，首单后校准单位经济，约{profit_model['payback_months']}个月跑通{profit_model['revenue_model']}；不构成收入承诺。",
            f"结论：{anchor}对应的{industry_zh}机会值得先做小规模尝试，核心是{why_short}遇上{gap_phrase}；主要风险为{barriers['regulatory']}与{barriers['capital']}。先{action}，再用首单校准{profit_model['revenue_model']}，目标{profit_model['payback_months']}个月；不构成收入承诺。",
            f"{anchor}的{industry_zh}商机应优先推进：{gap_phrase}尚未满足，{why_short}又打开{timing['window_months']}个月窗口；风险集中在{barriers['regulatory']}与{barriers['capital']}。30 天内{action}，首单后校准单位经济，{profit_model['payback_months']}个月左右检验模式；不构成收入承诺。",
        ],
    }
    return {section: options[seed % len(options)] for section, options in variants.items() if section in {"thesis", "market", "verdict"}}


def build_business(
    signal: dict[str, Any] | None,
    *,
    title_original: str,
    title_zh: str,
    summary_zh: str,
    industries: list[str],
    gaps: list[str],
    regions: list[str],
    countries: list[str],
    scores: dict[str, Any],
    roi: dict[str, Any],
    evidence: list[dict[str, Any]],
    source_name: str,
    as_of: str,
    source_regions: list[str] | None = None,
) -> dict[str, Any]:
    """生成商业画布 + 判断依据 + 竞争/跨市场/时效/条件/门槛/利润/执行方案/来源。"""
    industry = _primary_industry(title_original, f"{summary_zh} {title_zh}", industries)
    gap = gaps[0] if gaps else "knowledge"
    region = _primary_region(title_original, f"{summary_zh} {title_zh}", regions, source_regions)
    event = _event_type(title_original, f"{summary_zh} {title_zh}")
    event_zh = EVENT_ZH.get(event, "市场变化")
    window_stage_code = _pick(["open", "open", "closing"], _seed(f"{title_original}|{event}"))
    window_stage_zh = WINDOW_ZH.get(window_stage_code, "窗口打开")
    pack = INDUSTRY_PACKS.get(industry) or INDUSTRY_PACKS["crossborder"]
    gap_rule = GAP_RULES.get(gap) or GAP_RULES["knowledge"]
    region_rule = REGION_RULES.get(region) or REGION_RULES["north-america"]
    event_rule = EVENT_RULES.get(event) or EVENT_RULES["market"]
    entities = [_localize_entity(entity) for entity in _entities(title_original)]
    numbers = _numbers(title_original)
    entity_text = "、".join(entities) if entities else "该信号"
    number_note = f"（标题数字：{'、'.join(numbers)}）" if numbers else ""
    number_text = "、".join(numbers) if numbers else ""
    industry_zh = INDUSTRY_ZH.get(industry, "跨境")
    gap_zh = GAP_ZH.get(gap, "信息差")
    region_markets = "、".join(region_rule["markets"])
    seed = _seed(f"{title_original}|{industry}|{event}|{gap}|{region}")
    data_used = [f"标题实体：{entity_text}", f"行业：{industry_zh}", f"事件类型：{event_zh}", f"信息差：{gap_zh}", f"区域：{region_markets}"]
    if numbers:
        data_used.insert(1, f"标题数字：{number_text}")

    business_canvas = {
        "customer_segments": pack["segments"][:2] + [f"{region_markets}本地用户/买家"],
        "value_proposition": f"{pack['value']}；信号主体「{entity_text}」{number_note}指向{event_rule['why']}",
        "channels": pack["channels"][:2] + [f"{region_markets}本地社群/渠道"],
        "customer_relationships": pack["relationship"],
        "revenue_streams": pack["revenue"][:2] + [f"{gap_zh}带来的额外溢价/服务费"],
        "key_resources": pack["resources"][:2] + [f"{region_markets}本地合规/物流资源"],
        "key_activities": pack["activities"][:2] + ["本地化选品与内容运营"],
        "key_partners": pack["partners"][:2] + [region_rule["compliance"] + "相关服务商"],
        "cost_structure": pack["costs"][:2] + [f"{gap_zh}本地化成本"],
    }

    dims = scores.get("dimensions") or {}
    dim_rationale = {
        "signal": f"标题提到{entity_text}{number_note}，且属于{event_rule['why']}，不是泛泛趋势。",
        "gap": f"{gap_zh}：{gap_rule['arbitrage']}；{region_markets}市场的{gap_rule['localization']}是切入点。",
        "feasibility": f"可先用{pack['skills'][0]}与{pack['supply']}小规模起步，首期投入控制在 {roi.get('capital_min', 0):,}–{roi.get('capital_max', 0):,} 元。",
        "economics": f"{pack['profit']['revenue_model']}，{pack['profit']['margin']}，预计 {pack['profit']['payback']} 个月回本。",
        "timing": f"信号日期 {as_of}，按{event_zh}事件判断窗口约 {event_rule['window_months']} 个月；{event_rule['why']}。",
        "competition": f"直接竞品：{pack['competition']['direct'][0]}；我们的差异是{pack['competition']['moat']}。",
        "risk": f"主要风险在{pack['barriers']['regulatory']}与{pack['barriers']['capital']}，{region_rule['compliance']}需提前准备。",
        "fit": f"与{industry_zh}知识包和{region_markets}区域规则匹配，{pack['barriers']['channel']}是主要适配点。",
        "evidence": f"已有 {len(evidence)} 条公开来源（{source_name}），可支撑初步判断，商业结果需实操观察。",
        "leverage": f"规模化杠杆：{pack['profit']['scale']}；{region_rule['moat']}可形成本地壁垒。",
    }
    industry_gap = INDUSTRY_GAPS.get(industry, "本地化供给与渠道资源")
    why_opportunity = (
        f"{entity_text}{number_note}（{event_zh}）意味着{event_rule['why']}；"
        f"在{region_markets}，{industry_gap}是{industry_zh}的核心缺口；"
        f"可用{pack['profit']['revenue_model']}切入，窗口约 {event_rule['window_months']} 个月。"
    )
    not_opportunity_if = [
        f"若{region_markets}出现「{event_rule['not_if']}」的情况。",
        f"若{pack['barriers']['regulatory']}（{region_rule['compliance']}）导致进入成本过高，或{pack['barriers']['capital']}超出可承受范围。",
        f"若{pack['competition']['direct'][0]}已形成强网络效应，且我们无法做出{pack['competition']['moat']}差异。",
    ]
    judgment = {
        "dimensions": [
            {
                "id": dim_id,
                "name": DIM_ZH.get(dim_id, dim_id),
                "score": dims.get(dim_id, 0),
                "rationale": dim_rationale.get(dim_id, "按信号与行业规则综合判断。"),
                "data_used": data_used,
            }
            for dim_id in ("signal", "gap", "feasibility", "economics", "timing", "competition", "risk", "fit", "evidence", "leverage")
        ],
        "why_opportunity": why_opportunity,
        "not_opportunity_if": not_opportunity_if,
        "event_type": event_zh,
        "primary_industry": industry,
    }

    competition = {
        "direct": pack["competition"]["direct"],
        "indirect": pack["competition"]["indirect"],
        "substitutes": pack["competition"]["substitutes"],
        "differentiation": f"{pack['competition']['moat']}；结合{gap_zh}做本地化差异",
        "moat": pack["competition"]["moat"],
        "positioning": pack["competition"]["positioning"],
    }
    cross_market = {
        "target_markets": region_rule["markets"],
        "arbitrage_type": gap_zh,
        "why_migratable": f"{gap_rule['migratable']}；{industry_zh}供给可按{gap_rule['localization']}复制，事件类型（{event_zh}）决定进入节奏。",
        "localization_needs": [region_rule["localization"], region_rule["language"] + "内容与客服", region_rule["compliance"]],
        "pricing_power": gap_rule["pricing"],
    }
    launch_months = int(pack.get("startup_months") or 3)
    window_parts = str(event_rule.get("window_months") or "3–6").split("–")
    try:
        window_low = max(int(window_parts[0]), launch_months)
        window_high = max(int(window_parts[-1]), window_low + 2)
        window_months = f"{window_low}–{window_high}"
    except (TypeError, ValueError):
        window_months = str(event_rule.get("window_months") or "6–12")
    timing = {
        "why_now": f"信号日期 {as_of}，{entity_text}{number_note}触发{event_zh}变化：{event_rule['why']}。",
        "catalysts": event_rule["catalysts"] + [f"{region_markets}本地供给缺口"],
        "window_stage": window_stage_zh,
        "window_months": window_months,
        "urgency": event_rule["urgency"],
        "risks": [f"窗口可能被{pack['competition']['direct'][0]}快速跟进", f"{region_rule['compliance']}变化影响节奏"],
    }
    conditions = {
        "capital_range_cny": [int(roi.get("capital_min", 30000)), int(roi.get("capital_max", 150000))],
        "skills": pack["skills"],
        "licenses": pack["licenses"],
        "supply_chain": pack["supply"],
        "partners": pack["partners"][:2],
        "team": pack["team"],
        "time_to_launch_months": launch_months,
        "event_entry_requirement": event_rule["why"],
    }
    barriers = {
        "regulatory": pack["barriers"]["regulatory"],
        "technical": pack["barriers"]["technical"],
        "capital": pack["barriers"]["capital"],
        "brand": pack["barriers"]["brand"],
        "channel": pack["barriers"]["channel"],
        "region_specific": region_rule["compliance"],
        "event_specific": event_rule["not_if"],
    }
    profit_model = {
        "revenue_model": pack["profit"]["revenue_model"],
        "revenue_streams": pack["revenue"][:2] + [f"{gap_zh}带来的服务费/溢价"],
        "pricing_range": f"参考客单价/服务费：{int(roi.get('monthly_revenue_min', 0)):,}–{int(roi.get('monthly_revenue_max', 0)):,} 元/月规模",
        "gross_margin": pack["profit"]["margin"],
        "cost_items": [pack["costs"][0], pack["costs"][1], "本地化与渠道成本"],
        "unit_economics": f"以{pack['segments'][0]}为首批客户，单客贡献 = 客单价 × 毛利率 − 获客/履约成本；参考 ROI 默认区间。",
        "payback_months": pack["profit"]["payback"],
        "scale_levers": pack["profit"]["scale"],
        "event_effect": event_rule["why"],
    }
    execution_plan = {
        "phase_0_30_days": [
            f"锁定{region_markets}首批 20–50 个目标客户/买家（{pack['segments'][0]}），围绕{entity_text}事件切入。",
            f"完成{pack['activities'][0]}的最小可售版本，确认{pack['supply']}。",
            f"搭建{pack['channels'][0]}与本地内容/客服（{region_rule['language']}）；{EVENT_ACTIONS.get(event, EVENT_ACTIONS['market'])}。",
        ],
        "phase_30_90_days": [
            f"小批量投放/试单，目标是首笔收入与 {pack['kpis'][0]} 达标。",
            f"按{gap_rule['localization']}迭代供给，建立{pack['competition']['moat']}。",
            f"评估{pack['profit']['scale']}的复制节奏，跟踪{event_rule['catalysts'][0]}。",
        ],
        "milestones": [
            {"name": "首单/首批客户", "target": "30 天内"},
            {"name": "正向单位经济", "target": "90 天内"},
            {"name": "可复制模型", "target": f"{pack['profit']['payback']} 个月左右"},
        ],
        "first_revenue_path": f"通过{pack['channels'][0]}向{pack['segments'][0]}交付{pack['revenue'][0]}，先收首批订单/服务费。",
        "kpis": pack["kpis"],
    }
    sources = [
        {
            "title": item.get("title"),
            "url": item.get("url"),
            "publisher": item.get("publisher"),
            "date": item.get("date"),
            "tier": item.get("tier"),
            "fetch_status": item.get("fetch_status", "unfetched"),
        }
        for item in evidence
    ]
    analyst_narrative = _analyst_narrative(
        entity_text=entity_text,
        numbers=numbers,
        region_markets=region_markets,
        region_rule=region_rule,
        industry=industry,
        industry_zh=industry_zh,
        event=event,
        event_rule=event_rule,
        pack=pack,
        gap_zh=gap_zh,
        gap_rule=gap_rule,
        industry_gap=industry_gap,
        why_opportunity=why_opportunity,
        not_opportunity_if=not_opportunity_if,
        barriers=barriers,
        timing=timing,
        conditions=conditions,
        execution_plan=execution_plan,
        profit_model=profit_model,
        scores=scores,
        as_of=as_of,
        event_zh=event_zh,
        window_stage_zh=window_stage_zh,
        source_name=source_name,
        title_hint=title_original,
        seed=seed,
    )
    return {
        "primary_industry": industry,
        "primary_region": region,
        "analyst_narrative": analyst_narrative,
        "business_canvas": business_canvas,
        "judgment": judgment,
        "competition": competition,
        "cross_market": cross_market,
        "timing": timing,
        "conditions": conditions,
        "barriers": barriers,
        "profit_model": profit_model,
        "execution_plan": execution_plan,
        "sources": sources,
    }
