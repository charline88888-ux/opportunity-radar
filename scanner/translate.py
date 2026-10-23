"""系统级翻译子系统（v0.9.3）：每条新候选自动翻译，带 SQLite 缓存、可切换 provider、失败回退。

Provider：
- `source-zh`：原文已含中文 → 直接保留（quality=source-zh）；
- `glossary`（默认离线，无需 key）：≥200 条高频短语/实体词典 + 数字/品牌保留；
- `llm`：OpenAI 兼容（需 `LLM_API_KEY`，可选 `LLM_BASE_URL`/`LLM_MODEL`），失败自动回退 glossary；
- `mock`：测试用确定性假翻译，不联网。

缓存：`scanner/build/translation-cache.sqlite`（gitignore），key=sha256(provider+target+source_lang+text)；
命中 `cached=true`。质量字段 high/medium/low/source-zh，仅展示，不参与商机收录/排序。
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # 支持 python scanner/translate.py
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from scanner import config  # noqa: E402
else:  # pragma: no cover
    from . import config

PROVIDERS = {"auto", "glossary", "llm", "mock", "source-zh"}
QUALITIES = {"high", "medium", "low", "source-zh"}
DISCLAIMER = "系统翻译（自动生成，可能不完美）；质量不参与商机收录/排序，前端可切换原文。"

# ≥200 条高频短语/实体词典（电商/合规/宠物/银发/AI/支付/绿色/区域/品牌等）
GLOSSARY: dict[str, str] = {
    # 商业/创业/资本
    "startup": "创业公司", "startups": "创业公司", "founder": "创始人", "founders": "创始人",
    "venture capital": "风投", "vc": "风投", "seed round": "种子轮", "pre-seed": "种子前轮",
    "series a": "A 轮", "series b": "B 轮", "series c": "C 轮", "ipo": "上市",
    "funding": "融资", "fundraise": "融资", "fundraising": "融资", "raised": "融资",
    "raises": "融资", "investment": "投资", "investor": "投资人", "investors": "投资人",
    "valuation": "估值", "acquisition": "收购", "acquires": "收购", "acquire": "收购",
    "merger": "合并", "partnership": "合作", "partners": "合作", "partnerships": "合作",
    "growth": "增长", "revenue": "收入", "profit": "利润", "margin": "利润率",
    "market share": "市场份额", "competition": "竞争", "competitor": "竞争对手",
    "expansion": "扩张", "expands": "扩张", "scale": "规模化", "scaling": "规模化",
    "business model": "商业模式", "unit economics": "单位经济", "cash flow": "现金流",
    "fund": "基金", "funds": "基金", "billion": "十亿", "million": "百万",
    "thousand": "千", "billion-dollar": "十亿美元级",
    # 零售/电商/供应链
    "retail": "零售", "retailer": "零售商", "retailers": "零售商", "ecommerce": "电商",
    "e-commerce": "电商", "marketplace": "平台", "marketplaces": "平台", "dtc": "DTC 品牌",
    "brand": "品牌", "brands": "品牌", "consumer": "消费者", "consumers": "消费者",
    "customer": "客户", "customers": "客户", "shopper": "购物者", "shoppers": "购物者",
    "sales": "销售额", "price": "价格", "pricing": "定价", "discount": "折扣",
    "promotion": "促销", "inventory": "库存", "supply chain": "供应链",
    "supply": "供应", "logistics": "物流", "warehouse": "仓库", "warehousing": "仓储",
    "shipping": "运输", "delivery": "配送", "freight": "货运", "fulfillment": "履约",
    "tariff": "关税", "tariffs": "关税", "import": "进口", "imports": "进口",
    "export": "出口", "exports": "出口", "cross-border": "跨境", "customs": "海关",
    "factory": "工厂", "factories": "工厂", "manufacturing": "制造", "supplier": "供应商",
    "suppliers": "供应商", "sourcing": "采购", "procurement": "采购", "wholesale": "批发",
    "subscription": "订阅", "subscriptions": "订阅", "loyalty": "会员忠诚",
    "checkout": "结账", "payments": "支付", "payment": "支付",
    # 平台/渠道/营销
    "platform": "平台", "platforms": "平台", "app": "应用", "apps": "应用",
    "mobile app": "移动应用", "market": "市场", "markets": "市场", "marketing": "营销",
    "advertising": "广告", "advertisers": "广告主", "campaign": "活动", "campaigns": "活动",
    "traffic": "流量", "seo": "搜索引擎优化", "social media": "社交媒体",
    "influencer": "网红", "influencers": "网红", "creator": "创作者",
    "creators": "创作者", "community": "社区", "communities": "社区",
    "newsletter": "邮件通讯", "podcast": "播客", "video": "视频", "content": "内容",
    "launch": "上线", "launches": "上线", "launched": "上线", "feature": "功能",
    "features": "功能", "update": "更新", "updates": "更新", "release": "发布",
    "algorithm": "算法", "policy": "政策", "policies": "政策", "rules": "规则",
    "regulation": "监管", "regulations": "监管", "compliance": "合规",
    "certification": "认证", "standard": "标准", "standards": "标准",
    "ai act": "AI 法案", "gdpr": "GDPR", "epr": "生产者责任延伸",
    # 行业垂直
    "pet": "宠物", "pets": "宠物", "pet food": "宠物食品", "pet care": "宠物护理",
    "veterinary": "兽医", "vet": "兽医", "dog": "狗", "cat": "猫", "puppy": "幼犬",
    "senior": "银发", "seniors": "银发人群", "elderly": "老年人", "aging": "老龄化",
    "ageing": "老龄化", "retirement": "退休", "care home": "养老院",
    "nursing": "护理", "home care": "居家护理", "healthcare": "医疗",
    "health": "健康", "medical": "医疗", "clinic": "诊所", "hospital": "医院",
    "pharmaceutical": "制药", "pharma": "制药", "biotech": "生物科技",
    "fitness": "健身", "wellness": "健康养生", "mental health": "心理健康",
    "beauty": "美妆", "cosmetics": "化妆品", "skincare": "护肤", "fragrance": "香水",
    "fashion": "时尚", "apparel": "服装", "wearable": "可穿戴", "jewelry": "珠宝",
    "food": "食品", "beverage": "饮料", "restaurant": "餐厅", "restaurants": "餐厅",
    "grocery": "杂货", "delivery app": "外卖应用", "travel": "旅行",
    "tourism": "旅游业", "hotel": "酒店", "airline": "航空公司", "logistics-tech": "物流科技",
    "game": "游戏", "gaming": "游戏", "esports": "电竞", "education": "教育",
    "edtech": "教育科技", "tutoring": "辅导", "course": "课程", "school": "学校",
    "university": "大学", "student": "学生", "students": "学生",
    "real estate": "房地产", "housing": "住房", "construction": "建筑",
    "energy": "能源", "solar": "太阳能", "renewable": "可再生能源",
    "battery": "电池", "electric vehicle": "电动车", "ev": "电动车",
    "sustainability": "可持续", "recycling": "回收", "waste": "废弃物",
    "packaging": "包装", "plastic": "塑料", "carbon": "碳", "emissions": "排放",
    "green": "绿色", "climate": "气候", "agriculture": "农业", "farm": "农场",
    "fertilizer": "化肥", "water": "水", "mining": "采矿",
    # 金融支付
    "fintech": "金融科技", "bank": "银行", "banks": "银行", "banking": "银行业",
    "payment": "支付", "payments": "支付", "wallet": "钱包", "remittance": "汇款",
    "lending": "借贷", "loan": "贷款", "loans": "贷款", "credit": "信贷",
    "insurance": "保险", "insurtech": "保险科技", "crypto": "加密货币",
    "blockchain": "区块链", "stablecoin": "稳定币", "defi": "去中心化金融",
    "interest rate": "利率", "inflation": "通胀", "currency": "货币",
    "central bank": "央行", "central banks": "央行", "stock": "股票",
    "stocks": "股票", "bond": "债券", "fund manager": "基金经理",
    # 政策/贸易
    "government": "政府", "ministry": "部委", "commission": "委员会",
    "parliament": "议会", "senate": "参议院", "congress": "国会",
    "president": "总统", "prime minister": "总理", "legislation": "立法",
    "law": "法律", "bill": "法案", "ban": "禁令", "bans": "禁令",
    "investigation": "调查", "antitrust": "反垄断", "lawsuit": "诉讼",
    "court": "法院", "ruling": "裁决", "sanction": "制裁", "sanctions": "制裁",
    "wto": "世贸组织", "eu": "欧盟", "european union": "欧盟",
    "european commission": "欧盟委员会", "white house": "白宫",
    "federal register": "联邦公报", "cpsc": "美国消费品安全委员会",
    "fda": "美国食品药品监督管理局", "sec": "美国证券交易委员会",
    # 情绪/需求/人群
    "demand": "需求", "demands": "需求", "customer demand": "客户需求",
    "complaint": "投诉", "complaints": "投诉", "pain point": "痛点",
    "problem": "问题", "solutions": "解决方案", "solution": "解决方案",
    "opportunity": "机会", "opportunities": "机会", "gap": "信息差",
    "localization": "本地化", "translation": "翻译", "language": "语言",
    "culture": "文化", "cultural": "文化", "religion": "宗教",
    "halal": "清真", "ramadan": "斋月", "eid": "开斋节", "quran": "古兰经",
    "gen z": "Z 世代", "millennials": "千禧一代", "women": "女性",
    "family": "家庭", "families": "家庭", "children": "儿童",
    "baby": "婴儿", "parent": "父母", "parents": "父母",
    # 地区/国家/城市
    "united states": "美国", "us": "美国", "usa": "美国", "canada": "加拿大",
    "mexico": "墨西哥", "brazil": "巴西", "argentina": "阿根廷", "chile": "智利",
    "united kingdom": "英国", "uk": "英国", "germany": "德国", "france": "法国",
    "spain": "西班牙", "italy": "意大利", "netherlands": "荷兰", "poland": "波兰",
    "sweden": "瑞典", "switzerland": "瑞士", "turkey": "土耳其", "russia": "俄罗斯",
    "kazakhstan": "哈萨克斯坦", "uzbekistan": "乌兹别克斯坦", "india": "印度",
    "pakistan": "巴基斯坦", "bangladesh": "孟加拉国", "indonesia": "印尼",
    "vietnam": "越南", "thailand": "泰国", "malaysia": "马来西亚",
    "singapore": "新加坡", "philippines": "菲律宾", "japan": "日本",
    "south korea": "韩国", "korea": "韩国", "china": "中国", "chinese": "中国",
    "taiwan": "台湾", "hong kong": "香港", "saudi arabia": "沙特阿拉伯",
    "saudi": "沙特", "uae": "阿联酋", "dubai": "迪拜", "egypt": "埃及",
    "nigeria": "尼日利亚", "kenya": "肯尼亚", "south africa": "南非",
    "australia": "澳大利亚", "new zealand": "新西兰", "europe": "欧洲",
    "asia": "亚洲", "africa": "非洲", "latin america": "拉美",
    "middle east": "中东", "southeast asia": "东南亚", "global": "全球",
    # 品牌/平台实体
    "amazon": "亚马逊", "shopify": "Shopify", "temu": "Temu", "shein": "Shein",
    "tiktok": "TikTok", "bytedance": "字节跳动", "alibaba": "阿里巴巴",
    "alipay": "支付宝", "wechat": "微信", "google": "谷歌", "apple": "苹果",
    "microsoft": "微软", "meta": "Meta", "openai": "OpenAI",
    "chatgpt": "ChatGPT", "nvidia": "英伟达", "tesla": "特斯拉",
    "walmart": "沃尔玛", "costco": "好市多", "target": "Target",
    "etsy": "Etsy", "ebay": "eBay", "stripe": "Stripe", "paypal": "PayPal",
    "airbnb": "爱彼迎", "uber": "优步", "netflix": "奈飞",
    # 时间/数字/通用
    "new": "新", "latest": "最新", "record": "创纪录", "first": "首个",
    "second": "第二", "third": "第三", "quarter": "季度", "annual": "年度",
    "monthly": "月度", "weekly": "每周", "daily": "每日", "today": "今天",
    "yesterday": "昨天", "tomorrow": "明天", "year": "年", "month": "月",
    "week": "周", "day": "日", "percent": "%", "rate": "率",
    "increase": "增长", "decrease": "下降", "rise": "上升", "fall": "下降",
    "up": "上升", "down": "下降", "high": "高", "low": "低",
    "report": "报告", "reports": "报告", "data": "数据", "survey": "调查",
    "study": "研究", "research": "研究", "analysis": "分析", "forecast": "预测",
    "trend": "趋势", "trends": "趋势", "shift": "变化", "change": "变化",
    "industry": "行业", "industries": "行业", "sector": "行业", "market size": "市场规模",
    "customer experience": "客户体验", "user": "用户", "users": "用户",
    "technology": "科技", "tech": "科技", "innovation": "创新",
    "digital": "数字化", "automation": "自动化", "artificial intelligence": "人工智能",
    "machine learning": "机器学习", "robot": "机器人", "robotics": "机器人",
    "logistics network": "物流网络", "infrastructure": "基础设施",
    "energy transition": "能源转型", "circular economy": "循环经济",
    "supply chain finance": "供应链金融", "stable": "稳定", "price war": "价格战",
    "fee": "费用", "fees": "费用", "commission": "佣金", "subscription fee": "订阅费",
    "withdraw": "提现", "withdrawal": "提现", "transfer": "转账",
    "cross-border payment": "跨境支付", "remittances": "汇款",
    "initiative": "倡议", "program": "计划", "programs": "计划",
    "joins": "加入", "join": "加入", "partners with": "合作",
    "aims": "目标", "plans": "计划", "expects": "预计", "said": "表示",
    "announced": "宣布", "announces": "宣布", "warns": "警告",
    "faces": "面临", "facing": "面临", "risk": "风险", "risks": "风险",
    "opportunity radar": "机会雷达", "small business": "中小企业",
    "sme": "中小企业", "smb": "中小企业", "freelancer": "自由职业者",
    "remote": "远程", "office": "办公", "work": "工作", "workers": "工人",
    "hiring": "招聘", "jobs": "岗位", "job": "工作", "talent": "人才",
    "employee": "员工", "employees": "员工", "salary": "薪资",
    "wages": "工资", "benefits": "福利", "union": "工会", "strike": "罢工",
    # 功能词/介词（提升句子可读性）
    "in": "在", "on": "在", "at": "在", "for": "为", "with": "与", "without": "无",
    "from": "来自", "to": "到", "by": "由", "of": "的", "and": "与", "or": "或",
    "the": "", "a": "", "an": "", "is": "是", "are": "是", "was": "是", "were": "是",
    "will": "将", "would": "将", "has": "有", "have": "有", "had": "有",
    "more": "更多", "less": "更少", "than": "比", "over": "超过", "under": "低于",
    "across": "跨", "amid": "在…中", "as": "作为", "its": "其", "their": "他们的",
    "this": "这", "that": "那", "which": "其", "also": "也", "still": "仍",
    "only": "仅", "most": "多数", "many": "许多", "some": "一些", "can": "可",
    "may": "可能", "not": "不", "no": "无", "all": "全部", "both": "两者",
    "after": "之后", "before": "之前", "during": "期间", "among": "之中",
    "between": "之间", "through": "通过", "about": "关于", "into": "进入",
    "out": "出", "up": "上升", "now": "现在", "just": "刚刚", "very": "非常",
    "such": "此类", "these": "这些", "those": "那些", "what": "什么",
    "how": "如何", "why": "为何", "when": "何时", "where": "何处",
    "who": "谁", "while": "同时", "but": "但", "if": "如果", "then": "然后",
    "so": "因此", "because": "因为", "however": "然而", "according": "根据",
    "says": "表示", "says": "表示", "said": "表示", "says": "表示",
    # 宠物/纪念/银发等细分场景
    "memorial": "纪念", "keepsake": "纪念品", "funeral": "殡葬", "cremation": "火化",
    "urn": "骨灰盒", "ashes": "骨灰", "grief": "哀伤", "grieving": "哀伤",
    "widow": "遗属", "pet owner": "宠物主", "pet owners": "宠物主",
    "owners": "主人", "owner": "主人", "seek": "寻求", "seeking": "寻求",
    "seeks": "寻求", "search": "搜索", "searching": "搜索", "custom": "定制",
    "customized": "定制", "personalized": "个性化", "glass": "玻璃",
    "ceramic": "陶瓷", "photo": "照片", "portrait": "画像", "gift": "礼物",
    "gifts": "礼物", "souvenir": "纪念品", "souvenirs": "纪念品",
    "care": "照护", "caregiver": "照护者", "caregivers": "照护者",
    "nursing home": "养老院", "assisted living": "辅助生活", "dementia": "失智症",
    "alzheimer": "阿尔茨海默", "rehabilitation": "康复", "rehab": "康复",
    "companion": "陪伴", "companionship": "陪伴", "loneliness": "孤独",
    "lonely": "孤独", "therapy": "疗愈", "therapist": "治疗师",
    "wellbeing": "福祉", "nutrition": "营养", "supplement": "补充剂",
    "supplements": "补充剂", "ingredient": "成分", "ingredients": "成分",
    "pet food": "宠物食品", "pet care": "宠物护理", "pet insurance": "宠物保险",
    # 合规/监管/贸易补充
    "eudr": "欧盟零毁林法规", "gpsr": "通用产品安全法规", "ppwr": "包装法规",
    "cpsc": "美国消费品安全委员会", "ce marking": "CE 认证",
    "certificate": "证书", "certificates": "证书", "labelling": "标签",
    "labeling": "标签", "label": "标签", "labels": "标签", "recall": "召回",
    "recalls": "召回", "inspection": "检查", "inspections": "检查",
    "filing": "申报", "efiling": "电子申报", "registration": "注册",
    "license": "许可", "licenses": "许可", "permit": "许可",
    "duty": "关税", "duties": "关税", "quota": "配额", "quotas": "配额",
    "supply chain finance": "供应链金融", "trade finance": "贸易金融",
    "export controls": "出口管制", "sanctions": "制裁", "customs clearance": "清关",
    # 绿色/能源/农业补充
    "heat pump": "热泵", "solar panel": "太阳能板", "solar panels": "太阳能板",
    "off-grid": "离网", "microgrid": "微电网", "grid": "电网",
    "hydrogen": "氢能", "wind": "风能", "nuclear": "核能", "coal": "煤炭",
    "oil": "石油", "gas": "天然气", "electricity": "电力", "utility": "公用事业",
    "water treatment": "水处理", "desalination": "海水淡化", "irrigation": "灌溉",
    "yield": "产量", "crop": "作物", "crops": "作物", "harvest": "收成",
    "livestock": "牲畜", "dairy": "乳制品", "organic": "有机",
    # 数字/AI/科技补充
    "api": "API", "saas": "SaaS", "cloud": "云", "cloud computing": "云计算",
    "data center": "数据中心", "datacenter": "数据中心", "semiconductor": "半导体",
    "chip": "芯片", "chips": "芯片", "cybersecurity": "网络安全",
    "privacy": "隐私", "quantum": "量子", "robot": "机器人",
    "autonomous": "自动驾驶", "self-driving": "自动驾驶", "drone": "无人机",
    "drones": "无人机", "satellite": "卫星", "5g": "5G", "iot": "物联网",
    "digital wallet": "数字钱包", "super app": "超级应用", "mini app": "小程序",
    "live commerce": "直播电商", "livestream": "直播", "short video": "短视频",
    "short drama": "短剧", "webtoon": "网络漫画", "webtoons": "网络漫画",
    "licensing": "版权授权", "royalty": "版税", "royalties": "版税",
    "intellectual property": "知识产权", "patent": "专利", "patents": "专利",
    "trademark": "商标", "copyright": "版权",
    # 常见动词/形容词（新闻句）
    "product": "产品", "products": "产品", "hit": "冲击", "hits": "冲击",
    "impact": "影响", "impacts": "影响", "boost": "提振", "boosts": "提振",
    "drive": "推动", "drives": "推动", "push": "推动", "pushes": "推动",
    "cut": "削减", "cuts": "削减", "open": "开设", "opens": "开设",
    "close": "关闭", "closes": "关闭", "add": "新增", "adds": "新增",
    "develop": "开发", "develops": "开发", "build": "建设", "builds": "建设",
    "make": "制造", "makes": "制造", "use": "使用", "uses": "使用",
    "sell": "销售", "sells": "销售", "buy": "购买", "buys": "购买",
    "offer": "提供", "offers": "提供", "provide": "提供", "provides": "提供",
    "help": "帮助", "helps": "帮助", "support": "支持", "supports": "支持",
    "allow": "允许", "allows": "允许", "enable": "赋能", "enables": "赋能",
    "create": "创造", "creates": "创造", "expand": "扩张", "expands": "扩张",
    "invest": "投资", "invests": "投资", "compete": "竞争", "competes": "竞争",
    "small": "小型", "large": "大型", "local": "本地", "global": "全球",
    "keepsakes": "纪念品", "memorials": "纪念", "grievers": "哀伤者",
    "owners": "主人", "small business owners": "中小企业主",
    "ecommerce brands": "电商品牌", "retailers": "零售商",
    "consumers": "消费者", "shoppers": "购物者", "purchases": "购买",
    # 更多词形/新闻高频
    "business": "商业", "businesses": "企业", "changing": "改变", "changes": "变化",
    "changed": "改变", "african": "非洲的", "american": "美国的", "european": "欧洲的",
    "asian": "亚洲的", "be": "是", "been": "是", "being": "正", "sitting": "坐拥",
    "goldmine": "金矿", "requiring": "要求", "required": "要求", "require": "要求",
    "cosmetic": "美妆", "cosmetics": "化妆品", "packaging": "包装",
    "regulations": "监管", "regulatory": "监管", "governments": "政府",
    "countries": "国家", "country": "国家", "cities": "城市", "city": "城市",
    "regions": "地区", "region": "地区", "market": "市场", "markets": "市场",
    "worker": "工人", "workers": "工人", "farmer": "农民", "farmers": "农民",
    "women": "女性", "men": "男性", "young": "年轻", "old": "老旧",
    "online": "线上", "offline": "线下", "physical": "实体", "digital": "数字化",
    "buying": "购买", "selling": "销售", "shopping": "购物", "ordering": "订购",
    "trending": "走热", "rising": "上升", "falling": "下降", "growing": "增长",
    "booming": "繁荣", "emerging": "新兴", "leading": "领先", "major": "主要",
    "key": "关键", "top": "头部", "best": "最佳", "worst": "最差",
    "allowed": "允许", "banned": "禁止", "required": "要求", "mandatory": "强制",
    "voluntary": "自愿", "official": "官方", "reportedly": "据报道",
    "million-dollar": "百万美元级", "billion-dollar": "十亿美元级",
    "month": "月", "months": "月", "year": "年", "years": "年",
    "week": "周", "weeks": "周", "day": "日", "days": "日", "hour": "小时",
    "hours": "小时", "minute": "分钟", "minutes": "分钟",
    "according to": "根据", "as well as": "以及", "such as": "例如",
    "in order to": "以", "due to": "由于", "because of": "由于",
    "instead of": "而非", "in addition": "此外", "for example": "例如",
    "for instance": "例如", "at least": "至少", "more than": "超过",
    "less than": "少于", "up to": "高达", "as much as": "高达",
    "one of": "之一", "part of": "部分", "kind of": "一种",
    "new york": "纽约", "los angeles": "洛杉矶", "san francisco": "旧金山",
    "london": "伦敦", "paris": "巴黎", "berlin": "柏林", "tokyo": "东京",
    "seoul": "首尔", "beijing": "北京", "shanghai": "上海", "shenzhen": "深圳",
    "mumbai": "孟买", "delhi": "德里", "jakarta": "雅加达", "bangkok": "曼谷",
    "ho chi minh": "胡志明市", "kuala lumpur": "吉隆坡", "manila": "马尼拉",
    "riyadh": "利雅得", "dubai": "迪拜", "cairo": "开罗", "lagos": "拉各斯",
    "nairobi": "内罗毕", "johannesburg": "约翰内斯堡", "cape town": "开普敦",
    "sao paulo": "圣保罗", "mexico city": "墨西哥城", "buenos aires": "布宜诺斯艾利斯",
    "sydney": "悉尼", "melbourne": "墨尔本", "auckland": "奥克兰",
    "moscow": "莫斯科", "almaty": "阿拉木图", "istanbul": "伊斯坦布尔",
}

# 短语级替换优先（更自然）；其余单词按词典替换
PHRASES = {key: value for key, value in GLOSSARY.items() if " " in key}
WORDS = {key: value for key, value in GLOSSARY.items() if " " not in key}
PHRASE_KEYS = sorted(PHRASES, key=len, reverse=True)
WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’\-]*")
EN_TOKEN_RE = re.compile(r"[A-Za-z]{2,}")
# v0.9.3 缓存版本：词典或质量算法变更时自动失效，保证冷/热缓存同输入同输出
GLOSSARY_VERSION = hashlib.sha256(
    json.dumps(GLOSSARY, ensure_ascii=False, sort_keys=True).encode("utf-8")
).hexdigest()[:16]
CACHE_VERSION = f"v0.9.3-{GLOSSARY_VERSION}"


def has_cjk(text: str) -> bool:
    return any("\u4e00" <= char <= "\u9fff" for char in text or "")


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _connect(path: Path | None = None) -> sqlite3.Connection:
    path = path or config.TRANSLATION_CACHE_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(path))
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS translations (
            cache_key TEXT PRIMARY KEY,
            source_text TEXT NOT NULL,
            source_lang TEXT,
            target_lang TEXT,
            provider TEXT,
            translated TEXT NOT NULL,
            quality TEXT,
            created_at TEXT,
            last_used_at TEXT,
            hit_count INTEGER NOT NULL DEFAULT 1
        )
        """
    )
    connection.commit()
    return connection


def cache_stats(path: Path | None = None) -> dict[str, Any]:
    connection = _connect(path)
    try:
        row = connection.execute("SELECT COUNT(*), COALESCE(SUM(hit_count), 0) FROM translations").fetchone()
        return {"entries": int(row[0]), "hits": int(row[1])}
    finally:
        connection.close()


def clear_cache(path: Path | None = None) -> None:
    connection = _connect(path)
    try:
        connection.execute("DELETE FROM translations")
        connection.commit()
    finally:
        connection.close()


def quality_for_translated(text: str, provider: str = "glossary") -> str:
    """公开确定性质量判定：仅由翻译后文本/provider 决定（不依赖缓存历史）。"""
    if provider == "source-zh":
        return "source-zh"
    if provider == "llm":
        return "high"
    return _quality_for("", text or "", provider)


def _cache_get(connection: sqlite3.Connection, key: str, source_text: str, provider: str) -> dict[str, Any] | None:
    row = connection.execute(
        "SELECT translated, provider FROM translations WHERE cache_key = ?",
        (key,),
    ).fetchone()
    if row is None:
        return None
    translated, cached_provider = row[0], row[1]
    # v0.9.3 P1：命中缓存时也按当前文本/算法重算 quality，避免冷/热路径不一致
    quality = _quality_for(source_text, translated, cached_provider or provider)
    connection.execute(
        "UPDATE translations SET last_used_at = ?, hit_count = hit_count + 1, quality = ? WHERE cache_key = ?",
        (datetime.now().astimezone().isoformat(timespec="seconds"), quality, key),
    )
    connection.commit()
    return {"text": translated, "provider": cached_provider or provider, "quality": quality, "cached": True}


def _cache_put(connection: sqlite3.Connection, key: str, source_text: str, source_lang: str, target_lang: str, provider: str, translated: str, quality: str) -> None:
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    connection.execute(
        """
        INSERT INTO translations
            (cache_key, source_text, source_lang, target_lang, provider, translated, quality, created_at, last_used_at, hit_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(cache_key) DO UPDATE SET translated = excluded.translated, quality = excluded.quality, last_used_at = excluded.last_used_at
        """,
        (key, source_text, source_lang, target_lang, provider, translated, quality, now, now),
    )
    connection.commit()


def _quality_for(source: str, translated: str, provider: str) -> str:
    """质量判定（v0.9.3 修订）：按英文残留 token 比例 + 长度判断 medium/low。"""
    if provider == "source-zh":
        return "source-zh"
    if provider == "llm":
        return "high"
    cjk = sum(1 for char in translated if "\u4e00" <= char <= "\u9fff")
    english = len(EN_TOKEN_RE.findall(translated))
    total = cjk + english
    ratio = english / total if total else 1.0
    if cjk >= 4 and ratio <= 0.30 and len(translated) <= 80:
        return "medium"
    if cjk >= 4 and ratio <= 0.50 and len(translated) <= 120:
        return "medium"
    return "low"


def _apply_glossary(text: str) -> tuple[str, int]:
    result = text
    hits = 0
    for phrase in PHRASE_KEYS:
        pattern = re.compile(r"(?<![A-Za-z])" + re.escape(phrase) + r"(?![A-Za-z])", re.IGNORECASE)
        if pattern.search(result):
            result = pattern.sub(PHRASES[phrase], result)
            hits += 1
    for word in sorted(WORDS, key=len, reverse=True):
        pattern = re.compile(r"(?<![A-Za-z])" + re.escape(word) + r"(?![A-Za-z])", re.IGNORECASE)
        if pattern.search(result):
            result = pattern.sub(WORDS[word], result)
            hits += 1
    result = re.sub(r"\s+", " ", result).strip()
    result = re.sub(r"\s*([，。、；：！？])\s*", r"\1", result)
    return result, hits


def _clean_zh(text: str) -> str:
    """中文可读性清理：去 CJK 字符间空格、合并重复词、清理标点。"""
    text = re.sub(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "", text or "")
    text = re.sub(r"([\u4e00-\u9fff]{2,6})\1+", r"\1", text)
    text = re.sub(r"([\u4e00-\u9fff])\s+([，。、；：！？])", r"\1\2", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _glossary_translate(text: str, context: dict[str, Any] | None = None) -> tuple[str, str]:
    translated, hits = _apply_glossary(text)
    translated = _clean_zh(translated)
    if not has_cjk(translated):
        context = context or {}
        label = str(context.get("label") or "跨境商机线索")
        translated = f"{label}｜系统翻译"
        return translated, "low"
    translated = translated.strip(" ,.;:-")
    return translated, _quality_for(text, translated, "glossary")


def _mock_translate(text: str) -> tuple[str, str]:
    translated, _hits = _apply_glossary(text)
    translated = _clean_zh(translated)
    if not has_cjk(translated):
        translated = f"【模拟翻译】{text[:40]}"
    return translated, "medium"


def _llm_settings() -> dict[str, str]:
    return {
        "api_key": os.environ.get("LLM_API_KEY", ""),
        "base_url": (os.environ.get("LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/"),
        "model": os.environ.get("LLM_MODEL") or "gpt-4o-mini",
    }


def llm_available() -> bool:
    return bool(os.environ.get("LLM_API_KEY"))


def _llm_translate(text: str, source_lang: str, target_lang: str, timeout: int = 30) -> tuple[str, str] | None:
    settings = _llm_settings()
    if not settings["api_key"]:
        return None
    payload = {
        "model": settings["model"],
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    f"你是专业的商机情报翻译。把{source_lang}内容翻译成简洁自然的{target_lang}，"
                    "保留数字、品牌名和专有名词；只输出译文，不要解释。"
                ),
            },
            {"role": "user", "content": text},
        ],
    }
    request = urllib.request.Request(
        settings["base_url"] + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {settings['api_key']}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8", errors="replace"))
        translated = str(body["choices"][0]["message"]["content"]).strip()
        if translated and has_cjk(translated):
            return translated, "high"
    except (urllib.error.URLError, TimeoutError, OSError, KeyError, IndexError, json.JSONDecodeError):
        return None
    return None


def translate(
    text: str,
    *,
    source_lang: str | None = None,
    target_lang: str = config.TRANSLATION_TARGET_LANG,
    provider: str = config.TRANSLATION_DEFAULT_PROVIDER,
    use_cache: bool = True,
    context: dict[str, Any] | None = None,
    cache_path: Path | None = None,
) -> dict[str, Any]:
    """翻译单段文本；返回 {text,provider,quality,cached,source_lang,target_lang,fallback}。"""
    original = (text or "").strip()
    if not original:
        return {
            "text": "",
            "provider": "source-zh",
            "quality": "low",
            "cached": False,
            "source_lang": source_lang or "unknown",
            "target_lang": target_lang,
            "fallback": False,
        }
    detected_lang = "zh" if has_cjk(original) else (source_lang or "en")
    chosen = provider
    if chosen in ("auto", None):
        if detected_lang.startswith("zh"):
            chosen = "source-zh"
        elif llm_available():
            chosen = "llm"
        else:
            chosen = "glossary"
    if detected_lang.startswith("zh"):
        chosen = "source-zh"
    if chosen not in PROVIDERS or chosen == "auto":
        chosen = "glossary"

    key = _hash(f"{CACHE_VERSION}|{chosen}|{target_lang}|{detected_lang}|{original}")
    connection = _connect(cache_path)
    try:
        if use_cache:
            cached_row = _cache_get(connection, key, original, chosen)
            if cached_row is not None:
                cached_row.update({"source_lang": detected_lang, "target_lang": target_lang, "fallback": False})
                return cached_row
        fallback_from = None
        if chosen == "source-zh":
            translated, quality = original, "source-zh"
        elif chosen == "llm":
            result = _llm_translate(original, detected_lang, target_lang)
            if result is None:
                fallback_from = "llm"
                translated, quality = _glossary_translate(original, context)
                chosen = "glossary"
            else:
                translated, quality = result
        elif chosen == "mock":
            translated, quality = _mock_translate(original)
        else:
            translated, quality = _glossary_translate(original, context)
        if use_cache:
            _cache_put(connection, key, original, detected_lang, target_lang, chosen, translated, quality)
    finally:
        connection.close()
    return {
        "text": translated,
        "provider": chosen,
        "quality": quality,
        "cached": False,
        "source_lang": detected_lang,
        "target_lang": target_lang,
        "fallback": fallback_from is not None,
        "fallback_from": fallback_from,
    }


def _polish(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    text = text.replace("｜", "，").replace("|", "，")
    text = text.replace(" ,", "，").replace(", ", "、")
    text = re.sub(r"[，、]{2,}", "，", text).strip("，、 ")
    if len(text) <= limit:
        return text
    return text[: max(1, limit - 1)].rstrip() + "…"


def translate_fields(
    title: str,
    summary: str,
    one_liner: str,
    *,
    context: dict[str, Any] | None = None,
    provider: str = config.TRANSLATION_DEFAULT_PROVIDER,
    use_cache: bool = True,
    stable_cached: bool = True,
) -> dict[str, Any]:
    """候选三字段自动翻译（title→title_zh、one_liner→one_liner_zh、summary→summary_zh）。

    stable_cached=True 时二次读缓存，保证同输入同输出；title_zh 用真实翻译结果（≤40 字），
    不做行业标签拼接；仅当翻译后无中文时才给中文兜底（candidates 层会再按残留比例决定是否模板化）。
    """

    def run(text: str) -> dict[str, Any]:
        first = translate(text, provider=provider, use_cache=use_cache, context=context)
        if stable_cached and use_cache:
            second = translate(text, provider=provider, use_cache=True, context=context)
            second["quality"] = first.get("quality") or second.get("quality")
            second["provider"] = first.get("provider") or second.get("provider")
            return second
        return first

    title_result = run(title)
    summary_result = run(summary)
    one_result = run(one_liner)
    title_zh = _polish(title_result["text"], 40)
    one_liner_zh = _polish(one_result["text"], 60)
    summary_zh = _polish(summary_result["text"], 160)
    template = False
    if not has_cjk(title_zh):
        title_zh = _polish("系统翻译暂缺，原文见 title_original", 40)
        template = True
    if not has_cjk(one_liner_zh):
        one_liner_zh = _polish("系统翻译暂缺，原文见 title_original", 60)
        template = True
    if not has_cjk(summary_zh):
        summary_zh = _polish("系统翻译暂缺，原文见 title_original", 160)
        template = True
    quality = title_result["quality"]
    if template:
        quality = "low"
    return {
        "title_zh": title_zh,
        "one_liner_zh": one_liner_zh,
        "summary_zh": summary_zh,
        "translation": {
            "provider": title_result["provider"],
            "quality": quality,
            "cached": bool(title_result.get("cached")),
            "source_lang": title_result["source_lang"],
            "target_lang": title_result["target_lang"],
            "fallback": bool(title_result.get("fallback")),
            "template": template,
            "disclaimer": DISCLAIMER,
        },
    }


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="系统级翻译（v0.9.3）")
    parser.add_argument("--text", type=str, default=None, help="要翻译的文本")
    parser.add_argument("--provider", choices=sorted(PROVIDERS), default=config.TRANSLATION_DEFAULT_PROVIDER)
    parser.add_argument("--target-lang", default=config.TRANSLATION_TARGET_LANG)
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--stats", action="store_true", help="显示缓存统计")
    parser.add_argument("--clear-cache", action="store_true")
    args = parser.parse_args(argv)
    if args.clear_cache:
        clear_cache()
        print("翻译缓存已清空")
        return 0
    if args.stats:
        print(json.dumps({"glossary_entries": len(GLOSSARY), "cache": cache_stats(), "llm_available": llm_available()}, ensure_ascii=False))
        return 0
    if args.text is None:
        parser.print_help()
        return 0
    result = translate(args.text, provider=args.provider, target_lang=args.target_lang, use_cache=not args.no_cache)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
