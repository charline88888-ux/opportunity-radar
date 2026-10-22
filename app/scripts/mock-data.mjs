/**
 * mock-data.mjs —— 契约占位数据生成器（fallback）
 *
 * 用途：当 ../data/*.json 尚未产出或暂时不可解析时，sync-data.mjs 用本文件生成
 * 与 docs/12 契约同构的演示数据，保证前端可构建、可截图、绝不白屏。
 * 一旦 ../data 出现合法 JSON，真实数据优先，本文件不会覆盖。
 *
 * 数据基准日 as_of = 2026-10-22；全部为演示占位，非真实研究结论。
 */

export const AS_OF = '2026-10-22'
const DISCLAIMER = '演示占位数据：用于前端结构与视觉验收，非投资建议，不构成任何收入承诺。'

const round1 = (n) => Math.round(n * 10) / 10
const clamp = (n, min, max) => Math.min(max, Math.max(min, n))
const pad2 = (n) => String(n).padStart(2, '0')

function shiftDate(dateStr, days) {
  const t = Date.parse(dateStr + 'T00:00:00Z') + days * 86400000
  return new Date(t).toISOString().slice(0, 10)
}

function isoWeekKey(dateStr) {
  const date = new Date(dateStr + 'T00:00:00Z')
  const target = new Date(date.valueOf())
  const dayNr = (date.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round((target - firstThursday) / 7 / 86400000)
  return `${target.getUTCFullYear()}-W${pad2(week)}`
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ============================ 1. taxonomy.json ============================ */

const industries = [
  ['pet', '宠物经济', '#ffb547', 'PawPrint', '宠物食品用品、医疗殡葬、美容寄养、智能硬件与情绪消费。'],
  ['silver', '银发与健康', '#9ca3af', 'HeartPulse', '适老化产品、慢病管理、康复辅具、养老服务与老年消费。'],
  ['emotional', '情绪疗愈与心理', '#f472b6', 'Brain', '心理咨询、情绪陪伴、睡眠与解压、哀悼与关系修复。'],
  ['ai', 'AI 与效率工具', '#4cc9f0', 'Sparkles', '垂直 AI 应用、Agent、自动化、内容生成与效率工具。'],
  ['crossborder', '跨境电商与供应链', '#3ddc97', 'Globe2', '平台电商、独立站、供应链服务、履约与合规。'],
  ['content', '内容与 IP 出海', '#eab308', 'Clapperboard', '短视频、漫画、网文、播客、IP 授权与多语内容。'],
  ['education', '教育与知识服务', '#60a5fa', 'GraduationCap', '语言、技能、考试、家庭教育与成人学习。'],
  ['local', '本地生活与服务', '#fb923c', 'MapPin', '同城服务、餐饮零售、上门服务与本地流量。'],
  ['green', '绿色能源与可持续', '#84cc16', 'Leaf', '新能源、储能、循环经济、碳与环保合规。'],
  ['compliance', '合规与专业服务', '#94a3b8', 'ShieldCheck', '认证、法务、税务、知识产权、审计与咨询。'],
  ['culture', '文化与宗教', '#f87171', 'Landmark', '宗教节庆、文化礼赠、非遗、朝觐与跨文化内容。'],
  ['gaming', '游戏与社交', '#a78bfa', 'Gamepad2', '手游、主机、电竞、陪练、游戏内容与社区。'],
  ['fintech', '支付与金融科技', '#2dd4bf', 'Wallet', '跨境支付、汇款、钱包、风控、理财与保险科技。'],
  ['manufacturing', '产业与制造', '#cbd5e1', 'Factory', '工业品、备件、3D 打印、设备与 B2B 供应链。'],
].map(([id, name, color, icon, desc]) => ({ id, name, color, icon, desc }))

const humanNeeds = [
  ['survival', '生存与安全', 'physiological', '免于匮乏、风险与不确定性的基本需求。', ['fear', 'anxiety', 'greed'], ['cortisol']],
  ['health', '健康与身体', 'physiological', '身体机能、疾病管理、睡眠与运动表现。', ['anxiety', 'hope', 'relief'], ['endorphin', 'cortisol']],
  ['belonging', '归属与陪伴', 'social', '亲密关系、社群认同、被需要与被理解。', ['loneliness', 'love', 'grief'], ['oxytocin']],
  ['status', '尊重与身份', 'social', '被看见、被尊重、圈层身份与比较优势。', ['envy', 'pride', 'identity'], ['serotonin', 'dopamine']],
  ['growth', '自我实现与成长', 'esteem', '成为更好的自己、掌握新技能、达成目标。', ['aspiration', 'hope', 'pride'], ['dopamine', 'endorphin']],
  ['novelty', '新奇与探索', 'esteem', '新鲜刺激、未知体验、逃离无聊。', ['curiosity', 'boredom', 'awe'], ['dopamine', 'adrenaline']],
  ['control', '掌控与秩序', 'practical', '让混乱变可控，流程、收纳、计划与确定性。', ['control', 'anxiety'], ['serotonin', 'cortisol']],
  ['ease', '舒适与省力', 'practical', '减少摩擦、解放时间、减少决策成本。', ['laziness', 'relief', 'complaint'], ['endorphin', 'serotonin']],
  ['meaning', '意义与信仰', 'spiritual', '仪式、信念、使命与超越性体验。', ['devotion', 'awe', 'hope'], ['serotonin', 'oxytocin']],
  ['nostalgia', '怀旧与记忆', 'spiritual', '对过去、故乡、亲人与旧物的情感连接。', ['nostalgia', 'love', 'grief'], ['oxytocin', 'serotonin']],
  ['fairness', '公平与补偿', 'social', '被公正对待、获得补偿、纠正不公。', ['justice', 'guilt', 'shame'], ['cortisol', 'oxytocin']],
  ['expression', '表达与创造', 'esteem', '自我表达、创造、被听见与被记住。', ['identity', 'pride', 'curiosity'], ['dopamine', 'endorphin']],
].map(([id, name, layer, desc, typical_emotions, neuro_drivers]) => ({
  id, name, layer, desc, typical_emotions, neuro_drivers,
}))

const neuroDrivers = [
  ['dopamine', '多巴胺', '新奇 / 奖励 / 即时满足', ['盲盒', '抽奖', '游戏化', '限时优惠', '短视频', '进度条']],
  ['endorphin', '内啡肽', '成就 / 解压 / 疗愈', ['运动', '拉伸', 'ASMR', '解压玩具', '冥想', '完成感']],
  ['oxytocin', '催产素', '亲密 / 信任 / 联结', ['宠物', '母婴', '陪伴', '社群', '手写信', '照护']],
  ['serotonin', '血清素', '秩序 / 身份 / 仪式', ['收纳', '仪式感', '香氛', '身份符号', '打卡', '宗教仪式']],
  ['cortisol', '皮质醇', '压力 / 恐惧 → 安全需求', ['保险', '安全监测', '焦虑缓解', '隐私', '防诈骗']],
  ['adrenaline', '肾上腺素', '刺激 / 竞争 / 冒险', ['竞技', '极限运动', '抽卡', '投资', '限量抢购', '直播拍卖']],
].map(([id, name, theme, triggers]) => ({ id, name, theme, triggers, desc: `${theme}：${triggers.join('、')}` }))

const emotions = [
  ['complaint', '抱怨', 'negative'], ['anxiety', '焦虑', 'negative'], ['loneliness', '孤独', 'negative'],
  ['grief', '哀悼', 'negative'], ['nostalgia', '怀旧', 'mixed'], ['shame', '羞耻', 'negative'],
  ['envy', '攀比', 'negative'], ['fear', '恐惧', 'negative'], ['hope', '希望', 'positive'],
  ['aspiration', '向往', 'positive'], ['boredom', '无聊', 'negative'], ['ritual', '仪式感', 'positive'],
  ['identity', '身份认同', 'positive'], ['control', '掌控感', 'positive'], ['curiosity', '好奇', 'positive'],
  ['laziness', '偷懒省力', 'neutral'], ['greed', '贪婪占便宜', 'negative'], ['justice', '正义感', 'positive'],
  ['devotion', '虔诚', 'positive'], ['pride', '自豪', 'positive'], ['guilt', '内疚', 'negative'],
  ['relief', '解压', 'positive'], ['love', '爱意', 'positive'], ['awe', '敬畏', 'positive'],
].map(([id, name, polarity]) => ({ id, name, polarity, desc: `${name}（情绪信号，用于需求逆向）` }))

const gapTypes = [
  ['language', '语言 / 翻译差', 24, '非通用语市场未被英文/中文覆盖；专业术语盲区。'],
  ['culture', '文化 / 宗教差', 36, '宗教合规、审美、禁忌、节日、家庭结构差异。'],
  ['time', '时间差（趋势时差）', 9, '趋势从美/日/韩 → 欧 → 中 → 东南亚/中东/拉美的滞后。'],
  ['geo', '地理 / 市场差', 18, '需求在 A 国、供给在 B 国。'],
  ['knowledge', '认知 / 圈层差', 30, '学术、专利、开发者社区、专业圈层内的信息。'],
  ['regulation', '监管 / 政策差', 24, '新法规、认证、补贴、招标、关税产生的刚需。'],
  ['platform', '平台规则差', 6, '平台新功能/新站点/政策变化带来的短期套利。'],
  ['price', '价格 / 供应链差', 12, '同物不同价、供应链层级差、汇率与运费差。'],
  ['channel', '渠道 / 流量结构差', 9, '新流量池、低竞争关键词、KOL 结构空白。'],
  ['demographic', '人口 / 结构差', 30, '老龄化、单身、移民、少子化、Z 世代结构变化。'],
  ['emotion', '情绪 / 心理差', 18, '未被满足的情绪价值、耻感、孤独、哀悼、解压。'],
  ['infrastructure', '基础设施差', 24, '支付、物流、履约、身份认证、电力/网络覆盖差。'],
].map(([id, name, half_life_months, desc]) => ({ id, name, desc, half_life_months }))

const drivers = [
  ['capital', '资本驱动'], ['tech', '技术驱动'], ['info', '传播信息驱动'], ['cross-border', '跨国驱动'],
  ['regulation', '政策驱动'], ['ops', '运营驱动'], ['supply', '供应链驱动'],
].map(([id, name]) => ({ id, name, desc: `${name}：机会的主要驱动力` }))

const businessModels = [
  ['dtc', 'DTC 品牌'], ['marketplace', '平台/撮合'], ['service', '服务交付'], ['subscription', '订阅制'],
  ['infoproduct', '信息产品（课程/报告/社群）'], ['saas', '工具/SaaS'], ['agency', '代运营/代理'],
  ['licensing', '授权/IP'], ['affiliate', '联盟/分成'], ['arbitrage', '套利/贸易'],
  ['community', '社群会员'], ['consulting', '咨询顾问'],
].map(([id, name]) => ({ id, name, desc: `${name}：一种可组合的收入结构` }))

const regions = [
  ['north-america', '北美', 'NA'], ['europe', '欧洲', 'EU'], ['mena', '中东与北非', 'MENA'],
  ['sea', '东南亚', 'SEA'], ['east-asia', '东亚', 'EA'], ['south-asia', '南亚', 'SA'],
  ['latam', '拉美', 'LATAM'], ['africa', '非洲', 'AF'], ['oceania', '大洋洲', 'OC'],
  ['cis', '独联体与中亚', 'CIS'], ['china', '中国大陆', 'CN'],
].map(([id, name, short]) => ({ id, name, short, desc: `${name}市场` }))

const scoreDimensions = [
  ['signal', '信号强度', 0.15, '多来源、可量化、增速明确的真实需求信号', '只有单一模糊传闻', '2 个可交叉来源，趋势方向明确', '多主体一手证据 + 可量化增速 + 平台数据印证'],
  ['gap', '信息差窗口', 0.15, '知道的人少、传播滞后、短期难被抹平', '人尽皆知且供给拥挤', '局部有人在做，尚未跨语言/跨区域扩散', '跨语言跨市场信息差，供给几乎空白'],
  ['feasibility', '个人可执行性', 0.15, '1–3 人、低资质门槛、30 天内能启动验证', '需要重资产/牌照/大团队', '1–3 人可做，启动需 1–2 个月', '单人 30 天内可完成最小验证并出单'],
  ['economics', '回报空间', 0.15, '毛利高、客单可持续、有复购或放大空间', '毛利 < 15%，一次性买卖', '毛利 40–60%，客单中等', '毛利 > 70%，复购/加购与规模化空间明确'],
  ['timing', '时机窗口', 0.10, '现在进场正当时，窗口期 ≥ 12 个月', '窗口已过或只剩 < 3 个月', '窗口 6–12 个月，竞争开始出现', '窗口 ≥ 18 个月且需求加速'],
  ['competition', '竞争与壁垒', 0.08, '竞争尚不拥挤，且能建立至少一种壁垒', '红海且无差异化', '有竞争但可凭内容/供应链卡位', '供给稀缺，可建立工艺/资质/数据壁垒'],
  ['risk', '风险可控性', 0.07, '合规、平台、地缘、交付风险可识别可兜底', '存在不可控的合规/地缘风险', '风险可识别，需预案与合同兜底', '风险清晰，可用合同/保险/多平台对冲'],
  ['fit', '人群适配度', 0.05, '对个人/小团队友好，可兼职冷启动', '只适合大机构', '适合小团队，需一定专业能力', '个人可兼职冷启动，能力可迁移'],
  ['evidence', '证据可信度', 0.05, '一手证据多、可交叉验证、非营销稿', '只有营销稿或传闻', '2 条以上二手来源交叉', '多个一手来源（平台数据/官方文件/用户原声）'],
  ['leverage', '杠杆放大', 0.05, '可模板化/自动化/可复制到多国多平台', '纯人力线性交付', '部分环节可标准化', '可模板化复制到多个国家/平台/语言'],
].map(([id, name, weight, desc, a0, a5, a10]) => ({
  id, name, weight, desc, anchors: { '0': a0, '5': a5, '10': a10 },
}))

const tags = [
  ['low-capital', '低资本'], ['side-hustle', '可兼职'], ['solo', '单人可做'], ['remote', '可远程'],
  ['cross-border', '跨境'], ['content-driven', '内容驱动'], ['tech-driven', '技术驱动'], ['needs-license', '需资质'],
  ['needs-supply-chain', '需供应链'], ['english-ok', '英语可做'], ['localization-heavy', '本地化要求高'],
  ['b2b', 'B2B'], ['b2c', 'B2C'], ['recurring', '有复购'], ['seasonal', '季节性强'],
  ['platform-dependent', '依赖平台'], ['ai-native', 'AI 原生'], ['physical', '实物'], ['digital', '数字交付'],
  ['china-advantage', '中国供应链优势'],
].map(([id, name]) => ({ id, name, desc: `机会标签：${name}` }))

const grades = [
  ['S', 'S 级 · 可重注', 85, '九十分位机会：证据与窗口俱佳，可加大投入。'],
  ['A', 'A 级 · 优先验证', 75, '优先进入 7 天验证，重点分配注意力。'],
  ['B', 'B 级 · 观察/小试', 65, '值得小规模试水，跟踪窗口变化。'],
  ['C', 'C 级 · 记录', 55, '先记录，补充证据后再评估。'],
  ['D', 'D 级 · 不入榜', 0, '证据不足或风险过高，不进榜。'],
].map(([id, name, min, desc]) => ({ id, name, min, desc }))

export const mockTaxonomy = {
  meta: {
    data_version: '0.1.0-mock',
    app_version: '0.1.0',
    as_of: AS_OF,
    generator: 'app/scripts/mock-data.mjs',
    mock: true,
    counts: {
      industries: industries.length,
      human_needs: humanNeeds.length,
      neuro_drivers: neuroDrivers.length,
      emotions: emotions.length,
      gap_types: gapTypes.length,
      drivers: drivers.length,
      business_models: businessModels.length,
      regions: regions.length,
      score_dimensions: scoreDimensions.length,
      tags: tags.length,
      grades: grades.length,
    },
  },
  industries, human_needs: humanNeeds, neuro_drivers: neuroDrivers, emotions, gap_types: gapTypes,
  drivers, business_models: businessModels, regions, score_dimensions: scoreDimensions, tags, grades,
}

/* ======================== 2. 行业内容模板（七问 / 证据池） ======================== */

export const industryProfiles = {
  pet: {
    summary: '宠物消费从「用品」转向「纪念、陪伴与健康管理」，欧美高客单定制供给仍稀缺，东亚老龄化养宠同步升温。',
    traffic: 'Pinterest 场景图 + Etsy SEO 长尾词 + TikTok 制作过程视频；前 100 单来自宠物殡葬机构、兽医与宠物博主联盟。',
    money: '实物定制为主（纪念摆件/毛发首饰/辅具），加购相框、护理与订阅内容；客单 120–400 美元，多宠家庭复购。',
    model: 'DTC 定制 + Etsy/独立站成交 + 国内工艺厂代工 + 海外仓/直邮履约。',
    audience: '有审美、有情感支付意愿、英语可读的宠物主；适合 1–2 人兼职起步，不适合追求短期规模化的团队。',
    moat: '工艺良率 + 原创设计 + 真实评价与内容资产；前置条件是稳定供应链与防碎/防潮包装方案。',
    risks: ['跨境物流破损导致退款与差评', '动物纪念品在部分国家受遗体处理法规限制', '同质化设计快速跟进压价'],
    steps: ['Etsy 搜 20 个同类 listing，记录价格/评价/交期', '1688 找 3 家工厂打样并索要报价', '做 1 张对比图发 Pinterest 测点击', '算一单直邮 vs 海外仓的到岸成本'],
    kill: ['样品良率 < 80% 或破损率 > 8%', '3 个月无自然流量询盘', '头部卖家把价格打到成本线以下'],
    compliance: '动物遗骸/骨灰跨境邮寄多数国家受限，建议只寄毛发等纪念物；上架前确认平台禁售条款与目的国进口规定。',
    volume: 'Etsy 同类目 90 天新增 listing 约 40%，头部店铺月销 200+ 单，客单价集中在 $120–400。',
    evidence: [
      { title: 'Etsy 宠物纪念定制类目增长观察', publisher: 'Etsy', url: 'https://www.etsy.com/search?q=pet+memorial+gift', lang: 'en', tier: 'primary', quote: 'pet memorial 相关 listing 数量与评价数持续上升，定制类客单价显著高于通用用品。' },
      { title: '美国宠物行业支出结构报告', publisher: 'APPA', url: 'https://americanpetproducts.org/industry-trends-and-stats', lang: 'en', tier: 'secondary', quote: '宠物主在纪念、健康与体验类支出占比提升，情绪消费成为新增量。' },
      { title: 'r/Petloss 社区讨论：如何纪念离世宠物', publisher: 'Reddit', url: 'https://www.reddit.com/r/Petloss/', lang: 'en', tier: 'primary', quote: '用户高频询问定制纪念物、毛发保存与纪念仪式，愿意为「像把 Ta 留在身边」付费。' },
    ],
  },
  silver: {
    summary: '全球老龄化叠加「远程照护」与适老化改造，产品标准化程度低、服务链路长，是典型供给缺口。',
    traffic: 'Google 搜索「aging in place / 适老化改造」+ 本地社区与药店合作 + YouTube 安装教程；前 100 单来自子女代购与社工转介。',
    money: '硬件 + 安装服务 + 月度照护订阅；客单 300–2000 元，服务续费与耗材带来复购。',
    model: '产品分销 + 上门安装服务 + 远程监测订阅（B2C/B2B2C）。',
    audience: '有本地服务能力、懂基础安装与沟通的 1–3 人团队；适合有社区/医院资源的人。',
    moat: '本地服务网络 + 安装标准化 SOP + 信任口碑；前置条件是责任保险与售后响应。',
    risks: ['适老化产品涉及医疗宣称合规', '上门服务的安全与责任风险', '支付方（子女）与使用者（老人）决策分离'],
    steps: ['访谈 10 位有老人的家庭，记录最痛的 3 个场景', '对比 5 款适老化产品与安装报价', '在一个小区做 3 户免费改造并拍摄案例', '测算单户服务毛利与响应成本'],
    kill: ['单户服务毛利 < 25% 且无法标准化', '3 个月获客成本高于客单 30%', '出现无法兜底的医疗/安全纠纷'],
    compliance: '不得做医疗效果承诺；涉及医疗器械销售需资质；上门服务需明确责任边界与保险。',
    volume: '中国 60 岁以上人口超 3 亿，适老化改造渗透率仍低；欧美 aging-in-place 服务需求年增两位数。',
    evidence: [
      { title: '中国老龄产业发展报告', publisher: '中国老龄科研中心', url: 'https://www.cncaprc.gov.cn/', lang: 'zh', tier: 'secondary', quote: '居家养老与适老化改造需求持续增长，服务供给标准化不足。' },
      { title: 'Aging in place 消费趋势', publisher: 'AARP', url: 'https://www.aarp.org/research/topics/home-and-family/', lang: 'en', tier: 'secondary', quote: '多数老年人希望原地养老，愿意为安全与便利改造付费。' },
      { title: 'r/CaregiverSupport 照护者原声', publisher: 'Reddit', url: 'https://www.reddit.com/r/CaregiverSupport/', lang: 'en', tier: 'primary', quote: '照护者高频抱怨设备难用、安装复杂与远程监测缺失。' },
    ],
  },
  emotional: {
    summary: '孤独、哀悼、焦虑与睡眠问题成为全球性需求，情绪价值从内容消费走向可付费的服务与产品。',
    traffic: 'TikTok/小红书情绪内容 + 搜索「grief gift / 睡前焦虑」+ 心理咨询师与社群合作；前 100 单来自内容评论区与邮件列表。',
    money: '订阅盒子 + 数字课程 + 1 对 1 陪伴服务；客单 99–499 元，订阅带来稳定复购。',
    model: '内容获客 + 订阅制/会员社群 + 轻交付（卡片/音频/陪伴）。',
    audience: '有内容能力、共情力强、能持续输出的个人或 2 人小组；需要有危机转介预案。',
    moat: '内容资产 + 社群信任 + 专业背书；前置条件是心理危机识别与转介流程。',
    risks: ['心理服务边界与伦理风险', '用户危机事件处置责任', '内容同质化与平台限流'],
    steps: ['抓取 100 条相关评论，聚类 5 类情绪场景', '做一个 7 天情绪陪伴邮件/社群 MVP', '找 3 位心理咨询师做内容审校', '在 1 个平台测试内容→订阅转化'],
    kill: ['出现无法妥善处置的危机个案', '订阅 30 天留存 < 15%', '获客成本高于客单 50%'],
    compliance: '不得宣称治疗或替代专业医疗；必须提供危机热线与转介；用户数据按隐私法规处理。',
    volume: '全球心理健康应用与情绪消费持续增长；哀悼/孤独垂直内容互动率高但供给分散。',
    evidence: [
      { title: '全球心理健康服务需求变化', publisher: 'WHO', url: 'https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response', lang: 'en', tier: 'primary', quote: '焦虑与抑郁相关需求上升，服务供给与可及性存在显著缺口。' },
      { title: '情绪消费与治愈经济观察', publisher: '第一财经', url: 'https://www.yicai.com/', lang: 'zh', tier: 'secondary', quote: '情绪价值成为新消费关键词，陪伴、疗愈与解压类产品增长明显。' },
      { title: 'r/GriefSupport 社区原声', publisher: 'Reddit', url: 'https://www.reddit.com/r/GriefSupport/', lang: 'en', tier: 'primary', quote: '用户希望获得不冒犯的陪伴与纪念方式，讨厌被推销。' },
    ],
  },
  ai: {
    summary: '通用模型能力外溢后，垂直场景的「最后一公里」——数据、工作流、本地化交付——成为真正机会。',
    traffic: 'Product Hunt / Hacker News / GitHub 发布 + SEO 对比页 + 行业社群演示；前 100 个付费用户来自垂直社群与免费工具引流。',
    money: 'SaaS 订阅（$19–199/月）+ 一次性部署/定制；客单中等但复购强。',
    model: '工具/SaaS + 行业模板市场 + 服务型部署。',
    audience: '懂一个具体行业工作流、能独立交付的开发者/产品人；不适合只会调 API 的纯技术团队。',
    moat: '垂直数据与工作流沉淀 + 用户切换成本 + 模板生态；前置条件是数据合规与评测集。',
    risks: ['大模型厂商向上吞并场景', '数据隐私与版权风险', '订阅付费意愿不足'],
    steps: ['访谈 10 个目标岗位，画出一天的工作流', '用现成模型做一个单点工具 demo', '在 1 个社群收 10 个试用反馈', '测算推理成本与定价毛利'],
    kill: ['试用转付费 < 3%', '推理成本占收入 > 40%', '目标用户拒绝把数据接入第三方'],
    compliance: '注意用户数据跨境与隐私、模型输出合规、行业资质（医疗/金融/法律）限制。',
    volume: '垂直 AI 工具在 Product Hunt 与 GitHub 持续高增，企业级 Agent 采购预算快速上升。',
    evidence: [
      { title: '垂直 AI 应用融资与发布趋势', publisher: 'Product Hunt', url: 'https://www.producthunt.com/topics/artificial-intelligence', lang: 'en', tier: 'primary', quote: '面向具体岗位的 AI 工具持续占据日榜，付费意愿高于通用助手。' },
      { title: '生成式 AI 企业采用调研', publisher: 'McKinsey', url: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights', lang: 'en', tier: 'secondary', quote: '企业更愿意为嵌入工作流的垂直方案付费，而非通用 API。' },
      { title: 'GitHub Trending：Agent 工具', publisher: 'GitHub', url: 'https://github.com/trending', lang: 'en', tier: 'primary', quote: 'Agent、RAG、工作流编排类仓库星标增速显著。' },
    ],
  },
  crossborder: {
    summary: '平台红利消退后，跨境机会转向「本地化合规、履约效率与区域供给差」，服务型跨境需求上升。',
    traffic: 'LinkedIn/行业展会获客 + 平台卖家社群 + 通关/合规内容 SEO；前 100 单来自卖家群与货代转介。',
    money: '服务费 + 代运营佣金 + 供应链差价；客单 3000–50000 元，年度合约带来复购。',
    model: 'B2B 服务 + 供应链撮合 + 合规代理。',
    audience: '有跨境实操经验、懂平台规则与物流的人；适合 1–3 人小团队。',
    moat: '本地资质 + 渠道关系 + 案例数据；前置条件是目的国合规能力。',
    risks: ['政策与关税突变', '平台规则封店风险', '跨境资金合规风险'],
    steps: ['选 1 个目的国与 1 个品类，梳理准入要求', '访谈 5 个已在做的卖家，记录卡点', '跑通 1 单小批量合规通关', '核算全链路成本与账期'],
    kill: ['合规成本高于毛利', '平台政策明确禁止该类目', '90 天无法跑通首单闭环'],
    compliance: '需关注目的国进口许可、产品认证、税务与数据合规；不得协助规避关税。',
    volume: '跨境 B2B 服务需求随卖家数量增长，合规/履约类支出占比提升。',
    evidence: [
      { title: '跨境电商出口结构变化', publisher: '海关总署', url: 'http://www.customs.gov.cn/', lang: 'zh', tier: 'primary', quote: '跨境电商进出口保持增长，合规与本地化服务需求同步上升。' },
      { title: 'Global ecommerce logistics 趋势', publisher: 'Freightos', url: 'https://www.freightos.com/freight-resources/', lang: 'en', tier: 'secondary', quote: '运费波动与履约时效成为卖家选择市场与服务商的关键因素。' },
      { title: 'Amazon Sellers 社群讨论', publisher: 'Reddit', url: 'https://www.reddit.com/r/AmazonSeller/', lang: 'en', tier: 'primary', quote: '卖家高频讨论合规审核、EPR 与本地退货处理，服务供给分散。' },
    ],
  },
  content: {
    summary: '中国制造与中国故事的内容供给在海外仍处早期，多语种、垂类化、可本地交付的内容矩阵存在窗口。',
    traffic: 'YouTube/TikTok 垂类频道 + X/Reddit 分发 + SEO 长尾；前 1 万粉来自 3–5 条爆款选题。',
    money: '广告分成 + 品牌合作 + 课程/社群 + 带货佣金；收入结构决定稳定性。',
    model: '内容矩阵 + IP 授权 + 会员社群。',
    audience: '有选题能力、能持续更新、懂目标语言文化的内容创作者；不适合追求速成的人。',
    moat: '选题库 + 本地化表达 + 案例数据；前置条件是稳定产能与版权合规。',
    risks: ['平台算法波动导致收入不稳定', '内容版权与素材侵权', '跨文化表达冒犯风险'],
    steps: ['选 1 个垂类，拆解 20 条爆款结构', '用 AI + 人工做 5 条测试内容', '测 3 个平台的完播与转化', '设计广告/带货/社群三条收入线'],
    kill: ['连续 30 条内容无一条破万播放', '单条产能成本高于广告收入', '出现明确版权/文化合规风险'],
    compliance: '素材与音乐需授权；避免文化刻板印象；品牌合作需标注广告。',
    volume: '海外短视频与播客消费时长持续增长，垂类中文视角内容供给不足。',
    evidence: [
      { title: '短视频平台创作者生态报告', publisher: 'TikTok', url: 'https://www.tiktok.com/business/creativecenter', lang: 'en', tier: 'secondary', quote: '垂类知识与生活方式内容互动率高于泛娱乐，创作者变现路径增多。' },
      { title: 'YouTube 频道增长观察', publisher: 'YouTube', url: 'https://www.youtube.com/creators/', lang: 'en', tier: 'primary', quote: '长尾垂类频道依靠搜索与推荐获得稳定增长，广告外收入占比提升。' },
      { title: '内容出海行业讨论', publisher: '36氪', url: 'https://36kr.com/', lang: 'zh', tier: 'secondary', quote: '内容出海从流量套利转向本地化与 IP 长期运营。' },
    ],
  },
  education: {
    summary: '语言与技能教育需求向「结果导向 + AI 陪练 + 本地认证」迁移，小语种与蓝领技能是洼地。',
    traffic: '搜索广告 + 短视频案例 + 社群口碑；前 100 单来自免费测评与 7 天训练营。',
    money: '课程/训练营（客单 299–4999 元）+ 订阅题库 + 1 对 1 辅导；复购来自考试季。',
    model: '信息产品 + 社群训练营 + AI 工具订阅。',
    audience: '有教学或行业实战经验、能做结果交付的个人/小团队；需要有可信的成果案例。',
    moat: '教研体系 + 通过率数据 + 学员案例；前置条件是内容版权与讲师资质。',
    risks: ['教育广告合规与效果承诺限制', '退费与交付争议', '平台流量成本上涨'],
    steps: ['访谈 20 个目标学员，记录最痛的备考/求职环节', '做一个 7 天免费训练营', '统计完成率与付费转化', '按结果设计退款条款'],
    kill: ['训练营完课率 < 30%', '退款率 > 15%', '获客成本高于客单 40%'],
    compliance: '不得承诺「保过/包就业」；需明确退费规则；涉及学历与资质宣传需可核验。',
    volume: '全球语言学习与职业技能市场持续增长，AI 陪练降低交付边际成本。',
    evidence: [
      { title: '全球在线教育市场趋势', publisher: 'HolonIQ', url: 'https://www.holoniq.com/edtech', lang: 'en', tier: 'secondary', quote: '技能型与语言类在线学习需求稳定增长，结果导向产品更受青睐。' },
      { title: '中国职业教育政策动态', publisher: '教育部', url: 'http://www.moe.gov.cn/', lang: 'zh', tier: 'primary', quote: '职业教育与技能培训获得政策支持，规范化要求同步提高。' },
      { title: 'r/IELTS 备考原声', publisher: 'Reddit', url: 'https://www.reddit.com/r/IELTS/', lang: 'en', tier: 'primary', quote: '考生高频寻找口语陪练与批改，抱怨价格高、反馈慢。' },
    ],
  },
  local: {
    summary: '本地生活从「流量平台」转向「履约与体验差异」，小城市与入境游客场景存在服务空白。',
    traffic: '大众点评/Google Maps 评价 + 小红书/Instagram 场景内容 + 酒店/社区合作；前 100 单来自本地社群与转介绍。',
    money: '服务费 + 套餐 + 会员储值；客单 100–800 元，复购来自本地常住客。',
    model: '本地服务 + 预约系统 + 内容获客。',
    audience: '熟悉本地资源、能做服务交付与口碑运营的个人/小团队；适合有门店或地推能力的人。',
    moat: '本地口碑 + 履约 SOP + 独家资源；前置条件是服务标准化与保险。',
    risks: ['服务非标导致体验波动', '平台抽佣与流量成本', '本地竞争快速复制'],
    steps: ['蹲点 3 个商圈，记录 50 个未被满足的本地需求', '做 1 个单点服务 MVP 并接 10 单', '测算单均毛利与复购率', '设计会员/套餐提高 LTV'],
    kill: ['复购率 < 10% 且获客成本高', '单均毛利 < 30%', '出现安全/卫生类投诉'],
    compliance: '涉及食品、宠物、出行、上门服务需对应许可与保险；广告不得虚假宣传。',
    volume: '本地服务线上化率提升，入境游与宠物/银发等细分场景供给不足。',
    evidence: [
      { title: '本地生活服务消费趋势', publisher: '美团研究院', url: 'https://about.meituan.com/research', lang: 'zh', tier: 'secondary', quote: '服务零售增速高于商品零售，体验型与上门服务需求上升。' },
      { title: 'Inbound travel 体验消费', publisher: 'Skift', url: 'https://skift.com/', lang: 'en', tier: 'secondary', quote: '入境游客更愿意为深度体验与小团服务付费。' },
      { title: 'r/AskNYC 本地服务讨论', publisher: 'Reddit', url: 'https://www.reddit.com/r/AskNYC/', lang: 'en', tier: 'primary', quote: '本地居民频繁询问可靠的上门服务与预约方式，信息分散。' },
    ],
  },
  green: {
    summary: '能源转型与循环经济从政策驱动走向「安装、回收、补贴代办」等落地服务，个人仍有切口。',
    traffic: '政策补贴搜索 + 本地安装商合作 + B2B 展会；前 100 单来自补贴咨询与转介绍。',
    money: '设备差价 + 安装服务费 + 补贴代办佣金；客单 5000–80000 元，项目制。',
    model: '渠道分销 + 安装/回收服务 + 合规咨询。',
    audience: '有工程/安装资源、懂本地补贴政策的小团队；需具备安全与资质意识。',
    moat: '本地安装网络 + 政策解读能力 + 安全记录；前置条件是认证与保险。',
    risks: ['补贴政策变化导致需求骤降', '安装安全与售后责任', '设备认证与并网合规'],
    steps: ['整理目标市场 10 项补贴政策与申请流程', '找 3 家设备商谈渠道价', '做 5 个免费上门评估获取线索', '跑通 1 个项目的安装与验收'],
    kill: ['补贴退坡后需求消失', '安装事故风险无法保险覆盖', '项目回款周期 > 6 个月'],
    compliance: '涉及电力并网、消防、建筑安装需资质；不得虚假申报补贴。',
    volume: '欧盟热泵与储能装机目标明确，非洲离网光伏需求快速增长。',
    evidence: [
      { title: '欧盟热泵装机目标与进展', publisher: 'European Commission', url: 'https://energy.ec.europa.eu/topics/energy-efficiency/heat-pumps_en', lang: 'en', tier: 'primary', quote: '欧盟设定了热泵装机增长目标，安装能力与补贴流程成为瓶颈。' },
      { title: '全球离网光伏市场观察', publisher: 'IRENA', url: 'https://www.irena.org/', lang: 'en', tier: 'secondary', quote: '离网可再生能源在非洲与南亚持续扩张，分期支付模式提升渗透率。' },
      { title: '新能源补贴申报讨论', publisher: 'Reddit', url: 'https://www.reddit.com/r/solar/', lang: 'en', tier: 'primary', quote: '用户抱怨补贴申请流程复杂、安装商报价不透明。' },
    ],
  },
  compliance: {
    summary: '监管复杂度上升让「合规即服务」成为刚需，中小卖家与出海企业愿意为省心付费。',
    traffic: '搜索「EPR / GDPR / 认证」+ 平台卖家社群 + 律所/服务商转介；前 100 单来自被平台通知整改的卖家。',
    money: '合规审查费 + 代理注册费 + 年度订阅监测；客单 2000–30000 元，续费稳定。',
    model: '专业服务 + SaaS 监测 + 年度顾问。',
    audience: '有法律/认证/行业背景，或能与持牌机构合作的个人；不适合无资质硬做。',
    moat: '持牌资质 + 监管数据库 + 案例；前置条件是专业责任与数据来源合法。',
    risks: ['无资质经营的法律风险', '监管变化导致建议过时', '客户期望「包过」的交付风险'],
    steps: ['选 1 个监管主题，整理官方原文与流程', '访谈 5 个被处罚/整改的卖家', '与 1 家持牌机构谈合作分成', '做一份可交付的合规模板'],
    kill: ['无法与持牌机构建立合作', '客单低于交付成本', '监管明确禁止第三方代办'],
    compliance: '明确服务边界与免责；不得承诺审批结果；数据来源使用官方公开信息。',
    volume: '欧盟 EPR、美国各州标签、跨境数据合规等新规密集落地，中小企业合规预算上升。',
    evidence: [
      { title: '欧盟 EPR 包装法规说明', publisher: 'EUR-Lex', url: 'https://eur-lex.europa.eu/', lang: 'en', tier: 'primary', quote: '生产者责任延伸要求覆盖包装、电子与纺织品，跨境卖家需在各成员国注册。' },
      { title: '美国各州产品标签要求', publisher: 'Federal Register', url: 'https://www.federalregister.gov/', lang: 'en', tier: 'primary', quote: '产品标签与警示要求在各州存在差异，小卖家合规成本高。' },
      { title: '跨境合规服务讨论', publisher: '知产力', url: 'https://www.zhichanli.com/', lang: 'zh', tier: 'secondary', quote: '出海企业合规需求从被动应对转向常态化预算。' },
    ],
  },
  culture: {
    summary: '宗教节庆、文化礼赠与身份表达构成高溢价场景，中国供应链 + 本地审美是核心组合。',
    traffic: 'TikTok/Instagram 节庆场景内容 + Etsy/Noon 搜索 + 本地 KOL 合作；前 100 单来自节前 90 天内容预热。',
    money: '礼盒/定制实物 + 文化内容 + 节庆服务；客单 50–800 美元，季节性强。',
    model: 'DTC 礼赠 + 平台店铺 + 本地文化内容。',
    audience: '懂目标文化禁忌与审美、能做本地化设计的小团队；需要有本地顾问把关。',
    moat: '文化理解 + 设计版权 + 供应链响应；前置条件是宗教/文化合规审查。',
    risks: ['宗教禁忌误用导致舆情', '节庆窗口短、库存风险', '文化挪用争议'],
    steps: ['整理目标节日的 20 个礼赠场景与禁忌', '找本地顾问审校设计与文案', '小批量测 3 款设计', '按节前 90/60/30 天排内容与备货'],
    kill: ['节前 60 天未跑通设计审校', '库存周转率 < 1 次/季', '出现文化冒犯投诉'],
    compliance: '宗教相关内容需尊重禁忌与本地法规；避免未经授权的宗教符号商用；节庆营销素材需本地审校。',
    volume: '斋月、排灯节、婚礼季等节庆消费规模大，跨境供给同质化严重。',
    evidence: [
      { title: '全球宗教与节庆消费观察', publisher: 'Pew Research Center', url: 'https://www.pewresearch.org/religion/', lang: 'en', tier: 'secondary', quote: '宗教节庆相关消费在多个区域持续增长，文化适配决定转化。' },
      { title: '斋月消费行为报告', publisher: 'RedSeer', url: 'https://redseer.com/', lang: 'en', tier: 'secondary', quote: '斋月期间夜间消费与礼赠支出显著上升，家居与食品礼盒最集中。' },
      { title: 'Etsy 节庆礼赠搜索趋势', publisher: 'Etsy', url: 'https://www.etsy.com/market/ramadan_gifts', lang: 'en', tier: 'primary', quote: '节前 2–3 个月相关搜索快速抬升，定制类目供给不足。' },
    ],
  },
  gaming: {
    summary: '游戏增长转向新兴市场与社区运营，陪练、内容本地化与电竞青训存在服务型机会。',
    traffic: 'Discord/TikTok 游戏社区 + 主播合作 + 本地电竞赛事；前 100 单来自社群口碑。',
    money: '陪练课时费 + 战队/青训订阅 + 内容广告；客单 30–300 美元，复购取决于社群运营。',
    model: '社群服务 + 教练平台 + 内容变现。',
    audience: '高段位玩家或懂社区运营的团队；需要有安全与未成年人保护意识。',
    moat: '教练供给 + 社群文化 + 赛事资源；前置条件是平台规则合规。',
    risks: ['平台代练/代打规则风险', '未成年人保护与支付合规', '社群舆情与骚扰问题'],
    steps: ['选 1 款游戏与 1 个区域，进 10 个社群潜水', '招募 5 名教练做服务 SOP', '在 Discord 做 1 场免费训练营', '测算课时抽佣与获客成本'],
    kill: ['平台明令禁止相关服务', '社群 30 天留存 < 20%', '投诉率 > 5%'],
    compliance: '遵守游戏平台用户协议，避免账号代打；保护未成年人；支付与抽佣需合规。',
    volume: '东南亚与中东手游市场增长，电竞用户与陪练需求同步上升。',
    evidence: [
      { title: '全球游戏市场与新兴市场增长', publisher: 'Newzoo', url: 'https://newzoo.com/insights', lang: 'en', tier: 'secondary', quote: '中东与东南亚手游收入增长快于全球平均，社区与赛事生态扩张。' },
      { title: 'Discord 游戏社群生态', publisher: 'Discord', url: 'https://discord.com/blog', lang: 'en', tier: 'primary', quote: '游戏社群成为组队、教学与内容分发的核心场景。' },
      { title: '中东电竞市场观察', publisher: 'Esports Insider', url: 'https://esportsinsider.com/', lang: 'en', tier: 'secondary', quote: '海湾国家持续投资电竞基础设施与青训体系。' },
    ],
  },
  fintech: {
    summary: '跨境支付与汇款成本高、到账慢，区域牌照与本地钱包碎片化创造服务与聚合机会。',
    traffic: '跨境卖家/外劳社群 + 搜索比价 + 支付服务商转介；前 100 单来自社群与代理点。',
    money: '汇兑点差 + 服务费 + SaaS 订阅；客单低但频次高，风控决定利润。',
    model: '聚合支付 + 代理网络 + 合规 SaaS。',
    audience: '有金融合规背景或能与持牌机构合作的团队；个人不可独立碰资金池。',
    moat: '牌照/合作渠道 + 风控数据 + 本地网络；前置条件是反洗钱与合规。',
    risks: ['无牌照经营的法律风险', '反洗钱与制裁合规', '汇率波动与资金安全'],
    steps: ['梳理目标走廊的持牌机构与费率', '访谈 20 个汇款用户记录痛点', '与持牌机构谈聚合合作', '跑通小额合规流程'],
    kill: ['无法获得合规合作通道', '费率无法覆盖风控成本', '监管明确限制该模式'],
    compliance: '支付/汇款属强监管业务，必须与持牌机构合作；严禁资金池与变相换汇。',
    volume: '全球汇款规模巨大，海湾—南亚、美国—拉美走廊费率与到账时效痛点明显。',
    evidence: [
      { title: '全球汇款成本与走廊数据', publisher: 'World Bank', url: 'https://remittanceprices.worldbank.org/', lang: 'en', tier: 'primary', quote: '部分走廊汇款成本仍显著高于可持续发展目标建议水平。' },
      { title: '跨境支付合规要求', publisher: 'FATF', url: 'https://www.fatf-gafi.org/', lang: 'en', tier: 'primary', quote: '跨境支付服务需满足反洗钱与客户尽职调查要求。' },
      { title: 'r/fintech 行业讨论', publisher: 'Reddit', url: 'https://www.reddit.com/r/fintech/', lang: 'en', tier: 'primary', quote: '从业者讨论区域牌照碎片化与本地钱包集成成本。' },
    ],
  },
  manufacturing: {
    summary: '欧洲与中亚工业设备老化、备件供应慢，中国替代件与 3D 打印小批量供给存在价差窗口。',
    traffic: 'Google 工业关键词 + LinkedIn 采购 + 展会；前 100 单来自维修服务商与工厂采购。',
    money: '备件差价 + 小批量加工费 + 年度供应协议；客单 5000–200000 元，B2B 账期。',
    model: 'B2B 贸易 + 小批量制造 + 供应商代理。',
    audience: '有工业背景或工厂资源、能看懂图纸与标准的小团队；适合 B2B 长线。',
    moat: '供应商关系 + 图纸/标准能力 + 交付记录；前置条件是质量检测与认证。',
    risks: ['质量不达标导致索赔', '认证与标准不符', '跨境账期与汇率风险'],
    steps: ['锁定 3 个高频易损备件型号', '找 5 家工厂比价与打样', '做 1 次第三方检测', '给 10 家维修商发报价测试反馈'],
    kill: ['样品检测不达标', '毛利 < 20% 且账期 > 90 天', '客户集中度 > 70%'],
    compliance: '工业品需符合目的国标准与认证；涉及出口管制物项需审查；提供真实质检报告。',
    volume: '欧洲工业备件交付周期长、价格高；中亚农业与矿业设备维护需求稳定。',
    evidence: [
      { title: '欧洲工业供应链韧性报告', publisher: 'European Commission', url: 'https://single-market-economy.ec.europa.eu/', lang: 'en', tier: 'primary', quote: '关键备件交付周期与供应集中度成为制造业韧性痛点。' },
      { title: '中亚农业机械进口数据', publisher: 'World Bank', url: 'https://data.worldbank.org/', lang: 'en', tier: 'secondary', quote: '中亚农业机械化率提升，进口设备与备件需求增长。' },
      { title: '工业备件采购讨论', publisher: 'Reddit', url: 'https://www.reddit.com/r/manufacturing/', lang: 'en', tier: 'primary', quote: '采购抱怨原厂备件贵、交期长，愿意测试合格替代件。' },
    ],
  },
}
