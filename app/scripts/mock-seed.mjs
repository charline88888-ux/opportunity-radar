/**
 * mock-seed.mjs —— 契约占位数据（机会库 / 榜单 / 统计 / 数据源 / 剧本 / 日历）
 * 所有内容均为演示占位，不得当作真实研究结论；真实 data/ 就绪后自动被替换。
 */
import { AS_OF, mockTaxonomy, industryProfiles } from './mock-data.mjs'

const round1 = (n) => Math.round(n * 10) / 10
const clamp = (n, min, max) => Math.min(max, Math.max(min, n))
const pad2 = (n) => String(n).padStart(2, '0')
const DISCLAIMER = '演示占位数据：用于前端结构与视觉验收，非投资建议，不构成任何收入承诺。'

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

const driverMap = {
  language: ['info', 'cross-border'], culture: ['info', 'cross-border'], time: ['info'],
  geo: ['cross-border', 'supply'], knowledge: ['info', 'tech'], regulation: ['regulation'],
  platform: ['ops', 'info'], price: ['supply', 'cross-border'], channel: ['ops', 'info'],
  demographic: ['info', 'ops'], emotion: ['info'], infrastructure: ['tech', 'ops'],
}

/* ============================ 机会种子（52 条，14 行业全覆盖） ============================ */
const seeds = [
  {
    slug: 'pet-memorial-glass', title: '宠物离世纪念玻璃：骨灰/毛发封装定制',
    one: '欧美宠物殡葬情绪消费升级，客单 120–400 美元，手工定制 + 独立站 + 跨境代发即可验证。',
    ind: 'pet', gaps: ['culture', 'emotion'], regions: ['north-america', 'europe'], origin: '美国',
    targets: ['美国', '英国', '加拿大', '澳大利亚'], needs: ['belonging', 'nostalgia', 'meaning'],
    neuro: ['oxytocin', 'serotonin'], emo: ['grief', 'nostalgia', 'love'], langs: ['en'],
    tags: ['low-capital', 'side-hustle', 'solo', 'cross-border', 'physical'],
    roi: [3000, 8000, 2, 5, 8000, 30000, 65, 'side'], st: 'open', mo: 18, dc: 'slow',
  },
  {
    slug: 'ai-vertical-agents', title: '行业垂类 AI Agent 模板市场',
    one: '企业愿为嵌入具体工作流的 Agent 模板付费，先用 3 个行业模板验证订阅与分成。',
    ind: 'ai', gaps: ['knowledge', 'platform'], regions: ['north-america', 'china'], origin: '美国',
    targets: ['美国', '中国', '印度'], needs: ['ease', 'growth'], neuro: ['dopamine', 'endorphin'],
    emo: ['aspiration', 'relief'], langs: ['en', 'zh'], tags: ['ai-native', 'digital', 'b2b', 'remote'],
    roi: [5000, 20000, 1, 4, 15000, 80000, 80, 'side'], st: 'open', mo: 12, dc: 'medium',
  },
  {
    slug: 'cb-hajj-umbrella', title: '朝觐季便携降温与遮阳装备',
    one: '海湾高温 + 朝觐/副朝人流，便携降温装备需求刚性，客单低、复购与团购渠道清晰。',
    ind: 'crossborder', gaps: ['culture', 'time'], regions: ['mena'], origin: '沙特',
    targets: ['沙特', '印尼', '马来西亚'], needs: ['health', 'survival'], neuro: ['cortisol', 'endorphin'],
    emo: ['fear', 'hope'], langs: ['ar', 'en'], tags: ['physical', 'seasonal', 'needs-supply-chain', 'cross-border'],
    roi: [20000, 60000, 2, 6, 30000, 120000, 40, 'side'], st: 'peak', mo: 8, dc: 'fast',
  },
  {
    slug: 'emotional-grief-cards', title: '哀悼陪伴卡片订阅：按月寄送',
    one: '哀悼期长、社交支持缺失，按月寄送的低打扰陪伴卡片订阅可低成本验证复购。',
    ind: 'emotional', gaps: ['emotion', 'culture'], regions: ['north-america', 'europe'], origin: '美国',
    targets: ['美国', '英国', '加拿大'], needs: ['belonging', 'meaning'], neuro: ['oxytocin', 'serotonin'],
    emo: ['grief', 'loneliness', 'love'], langs: ['en'], tags: ['low-capital', 'solo', 'digital', 'recurring'],
    roi: [2000, 6000, 1, 4, 5000, 20000, 70, 'side'], st: 'open', mo: 24, dc: 'slow',
  },
  {
    slug: 'silver-remote-install', title: '给爸妈装智能设备的远程照护安装服务',
    one: '子女愿为「装好、教會、能远程看」付费，同城安装 + 月度巡检可先从 1 个小区跑通。',
    ind: 'silver', gaps: ['demographic', 'infrastructure'], regions: ['east-asia', 'europe'], origin: '中国',
    targets: ['中国', '日本', '德国'], needs: ['control', 'health', 'belonging'], neuro: ['cortisol', 'oxytocin'],
    emo: ['anxiety', 'guilt', 'relief'], langs: ['zh', 'en'], tags: ['localization-heavy', 'b2c', 'recurring', 'needs-license'],
    roi: [8000, 25000, 2, 6, 12000, 40000, 55, 'side'], st: 'open', mo: 24, dc: 'medium',
  },
  {
    slug: 'culture-ramadan-gift', title: '斋月礼赠礼盒：中东审美 + 中国供应链',
    one: '斋月礼赠客单高、节前 90 天决策，中国供应链 + 本地审美与禁忌审校是核心组合。',
    ind: 'culture', gaps: ['culture', 'price'], regions: ['mena'], origin: '阿联酋',
    targets: ['阿联酋', '沙特', '卡塔尔'], needs: ['belonging', 'status', 'meaning'], neuro: ['oxytocin', 'serotonin'],
    emo: ['love', 'devotion', 'pride'], langs: ['ar', 'en'], tags: ['seasonal', 'physical', 'china-advantage', 'cross-border'],
    roi: [30000, 90000, 3, 7, 50000, 180000, 45, 'full'], st: 'peak', mo: 6, dc: 'fast',
  },
  {
    slug: 'fintech-remittance', title: '海湾—南亚汇款比价与代理点',
    one: '汇款费率与到账时效长期被抱怨，聚合比价 + 社区代理点可与持牌机构分成验证。',
    ind: 'fintech', gaps: ['infrastructure', 'demographic'], regions: ['mena', 'south-asia'], origin: '阿联酋',
    targets: ['阿联酋', '印度', '巴基斯坦'], needs: ['survival', 'fairness'], neuro: ['cortisol', 'dopamine'],
    emo: ['anxiety', 'hope'], langs: ['en', 'hi', 'ur'], tags: ['needs-license', 'b2c', 'localization-heavy', 'recurring'],
    roi: [15000, 50000, 3, 9, 20000, 100000, 35, 'full'], st: 'open', mo: 30, dc: 'slow',
  },
  {
    slug: 'cb-eu-epr-packaging', title: '欧盟包装 EPR 合规代注册服务',
    one: '平台下架倒逼卖家合规，EPR 代注册 + 年度申报打包成标准化服务，按国别年费订阅。',
    ind: 'crossborder', gaps: ['regulation', 'language'], regions: ['europe'], origin: '德国',
    targets: ['德国', '法国', '西班牙'], needs: ['control', 'survival'], neuro: ['cortisol', 'serotonin'],
    emo: ['anxiety', 'relief'], langs: ['de', 'en'], tags: ['b2b', 'needs-license', 'recurring', 'cross-border'],
    roi: [10000, 30000, 1, 4, 20000, 80000, 60, 'side'], st: 'open', mo: 20, dc: 'medium',
  },
  {
    slug: 'content-vertical-shorts', title: '拉美西语「中国制造测评」内容矩阵',
    one: '拉美消费者对中国货好奇但缺可信测评，垂类短视频 + 联盟分佣可低资本起步。',
    ind: 'content', gaps: ['language', 'channel'], regions: ['latam'], origin: '墨西哥',
    targets: ['墨西哥', '巴西', '哥伦比亚'], needs: ['novelty', 'status'], neuro: ['dopamine', 'adrenaline'],
    emo: ['curiosity', 'envy'], langs: ['es', 'pt'], tags: ['content-driven', 'low-capital', 'solo', 'remote'],
    roi: [2000, 10000, 2, 6, 5000, 30000, 75, 'side'], st: 'open', mo: 15, dc: 'medium',
  },
  {
    slug: 'edu-ielts-speaking', title: '雅思口语 AI 陪练：先做越南/沙特市场',
    one: '考生苦于口语无人陪练，AI 陪练 + 人工批改混合交付，客单低但复购与转介绍强。',
    ind: 'education', gaps: ['language', 'platform'], regions: ['sea', 'mena'], origin: '越南',
    targets: ['越南', '印尼', '沙特'], needs: ['growth', 'status'], neuro: ['dopamine', 'cortisol'],
    emo: ['aspiration', 'anxiety'], langs: ['vi', 'en', 'ar'], tags: ['digital', 'ai-native', 'b2c', 'recurring'],
    roi: [3000, 12000, 1, 4, 8000, 40000, 70, 'side'], st: 'open', mo: 18, dc: 'medium',
  },
  {
    slug: 'green-heatpump', title: '欧洲热泵安装排程与补贴代办',
    one: '补贴流程复杂、安装队排期长，做「排程 + 补贴材料 + 验收」的轻服务，按项目抽成。',
    ind: 'green', gaps: ['regulation', 'infrastructure'], regions: ['europe'], origin: '德国',
    targets: ['德国', '荷兰', '英国'], needs: ['ease', 'control', 'health'], neuro: ['cortisol', 'serotonin'],
    emo: ['anxiety', 'relief'], langs: ['de', 'en'], tags: ['b2b', 'localization-heavy', 'needs-license', 'service'],
    roi: [8000, 25000, 2, 5, 15000, 60000, 55, 'side'], st: 'open', mo: 24, dc: 'slow',
  },
  {
    slug: 'compliance-gdpr-tools', title: 'GDPR 数据地图 SaaS：小企业版',
    one: '中小企业被要求做数据清单却请不起律所，模板化数据地图 + 年度提醒是最小可行产品。',
    ind: 'compliance', gaps: ['regulation', 'knowledge'], regions: ['europe'], origin: '德国',
    targets: ['德国', '法国', '荷兰'], needs: ['control', 'fairness'], neuro: ['cortisol', 'serotonin'],
    emo: ['anxiety', 'guilt'], langs: ['de', 'en'], tags: ['saas', 'b2b', 'digital', 'recurring'],
    roi: [5000, 20000, 2, 6, 10000, 50000, 78, 'side'], st: 'open', mo: 30, dc: 'slow',
  },
  {
    slug: 'gaming-cozy-games', title: '东南亚 Cozy 手游本地化运营',
    one: '轻度手游在东南亚留存靠本地化活动与社群，小团队可接「运营 + 本地化」外包按月收费。',
    ind: 'gaming', gaps: ['language', 'platform'], regions: ['sea'], origin: '越南',
    targets: ['越南', '泰国', '印尼'], needs: ['ease', 'belonging'], neuro: ['dopamine', 'oxytocin'],
    emo: ['relief', 'curiosity'], langs: ['vi', 'th', 'id'], tags: ['b2b', 'digital', 'localization-heavy', 'recurring'],
    roi: [3000, 10000, 1, 3, 8000, 35000, 70, 'side'], st: 'open', mo: 12, dc: 'medium',
  },
  {
    slug: 'manufacturing-spare-parts', title: '欧洲工业设备备件电商：中国替代件',
    one: '原厂备件贵且交期长，验证 3 个高频易损件的质量与价差，可做小批量 B2B 供应。',
    ind: 'manufacturing', gaps: ['price', 'knowledge'], regions: ['europe'], origin: '德国',
    targets: ['德国', '波兰', '意大利'], needs: ['ease', 'control'], neuro: ['cortisol', 'serotonin'],
    emo: ['complaint', 'relief'], langs: ['de', 'en'], tags: ['b2b', 'needs-supply-chain', 'physical', 'china-advantage'],
    roi: [30000, 100000, 3, 9, 50000, 200000, 35, 'full'], st: 'open', mo: 24, dc: 'slow',
  },
  {
    slug: 'local-tour-guide', title: '城市中文深度游 + 摄影师套餐',
    one: '入境游恢复后个性化小团稀缺，中文/日文深度路线 + 随行摄影可按单收费验证。',
    ind: 'local', gaps: ['culture', 'channel'], regions: ['europe', 'east-asia'], origin: '日本',
    targets: ['日本', '法国', '意大利'], needs: ['novelty', 'expression'], neuro: ['dopamine', 'oxytocin'],
    emo: ['curiosity', 'pride'], langs: ['zh', 'ja', 'en'], tags: ['localization-heavy', 'b2c', 'seasonal', 'solo'],
    roi: [3000, 12000, 1, 3, 10000, 40000, 65, 'side'], st: 'open', mo: 18, dc: 'medium',
  },
  {
    slug: 'pet-senior-mobility', title: '老年犬关节辅具租赁订阅：按月换尺寸',
    one: '老犬家庭愿为「能再走两步」按月付费，辅具租赁 + 康复内容订阅可小成本验证。',
    ind: 'pet', gaps: ['demographic', 'price'], regions: ['north-america', 'east-asia'], origin: '日本',
    targets: ['日本', '美国', '德国'], needs: ['health', 'belonging'], neuro: ['oxytocin', 'endorphin'],
    emo: ['love', 'relief'], langs: ['ja', 'en'], tags: ['recurring', 'physical', 'needs-supply-chain', 'b2c'],
    roi: [8000, 20000, 2, 7, 15000, 40000, 55, 'side'], st: 'peak', mo: 24, dc: 'medium',
  },
  {
    slug: 'emotional-asmr-app', title: '睡前 ASMR/白噪音中文付费 App',
    one: '睡眠焦虑人群愿为「今晚能睡着」订阅，先用小程序 + 人工精选内容测留存。',
    ind: 'emotional', gaps: ['channel', 'emotion'], regions: ['china', 'east-asia'], origin: '中国',
    targets: ['中国', '日本', '新加坡'], needs: ['health', 'ease'], neuro: ['endorphin', 'serotonin'],
    emo: ['anxiety', 'relief'], langs: ['zh', 'ja'], tags: ['digital', 'b2c', 'recurring', 'platform-dependent'],
    roi: [5000, 15000, 1, 4, 8000, 30000, 75, 'side'], st: 'closing', mo: 3, dc: 'fast',
  },
  {
    slug: 'ai-localization-ugc', title: '短视频 AI 本地化配音与字幕代运营',
    one: '东南亚/中东内容团队缺小语种本地化产能，AI 配音 + 人工校对按条收费可快速起量。',
    ind: 'ai', gaps: ['language', 'channel'], regions: ['sea', 'mena'], origin: '印尼',
    targets: ['印尼', '越南', '沙特'], needs: ['expression', 'status'], neuro: ['dopamine', 'serotonin'],
    emo: ['pride', 'curiosity'], langs: ['id', 'vi', 'ar'], tags: ['b2b', 'ai-native', 'digital', 'remote'],
    roi: [2000, 8000, 1, 3, 10000, 50000, 65, 'side'], st: 'open', mo: 9, dc: 'fast',
  },
  {
    slug: 'silver-hearing-aids-otc', title: 'OTC 助听器验配与订阅（美国）',
    one: 'OTC 助听器放开后价格下探，但验配与售后缺失，订阅式验配服务存在窗口。',
    ind: 'silver', gaps: ['regulation', 'price'], regions: ['north-america'], origin: '美国',
    targets: ['美国', '加拿大'], needs: ['health', 'belonging'], neuro: ['cortisol', 'oxytocin'],
    emo: ['shame', 'hope', 'relief'], langs: ['en', 'es'], tags: ['needs-license', 'b2c', 'recurring', 'localization-heavy'],
    roi: [15000, 40000, 3, 8, 20000, 70000, 50, 'full'], st: 'open', mo: 30, dc: 'slow',
  },
  {
    slug: 'content-ai-comic', title: '日本轻小说 AI 漫改出海',
    one: '网文/轻小说 IP 过剩、漫改进度慢，AI 分镜 + 人工精修可把单部改编成本降一个量级。',
    ind: 'content', gaps: ['language', 'culture'], regions: ['east-asia', 'north-america'], origin: '日本',
    targets: ['日本', '美国', '法国'], needs: ['novelty', 'expression'], neuro: ['dopamine', 'adrenaline'],
    emo: ['curiosity', 'awe'], langs: ['ja', 'en'], tags: ['digital', 'ai-native', 'b2b', 'localization-heavy'],
    roi: [10000, 30000, 2, 6, 15000, 60000, 60, 'side'], st: 'open', mo: 12, dc: 'fast',
  },
  {
    slug: 'edu-trade-skills', title: '外贸业务员实战训练营（中文）',
    one: '中小工厂缺能独立开发客户的外贸业务员，实战营 + 企业内训可先验证付费意愿。',
    ind: 'education', gaps: ['knowledge', 'channel'], regions: ['china'], origin: '中国',
    targets: ['中国', '马来西亚', '越南'], needs: ['growth', 'status'], neuro: ['dopamine', 'endorphin'],
    emo: ['aspiration', 'anxiety'], langs: ['zh'], tags: ['infoproduct', 'b2b', 'digital', 'content-driven'],
    roi: [3000, 15000, 2, 5, 15000, 60000, 75, 'side'], st: 'open', mo: 18, dc: 'medium',
  },
  {
    slug: 'local-pet-taxi', title: '城市宠物专车与急救接送服务',
    one: '宠物就医/搬家/寄养的专车需求稳定但供给分散，会员制 + 夜间急救加价可验证。',
    ind: 'local', gaps: ['infrastructure', 'emotion'], regions: ['china', 'east-asia'], origin: '中国',
    targets: ['中国', '新加坡', '日本'], needs: ['belonging', 'control'], neuro: ['oxytocin', 'cortisol'],
    emo: ['anxiety', 'love'], langs: ['zh', 'en'], tags: ['service', 'b2c', 'localization-heavy', 'needs-license'],
    roi: [30000, 80000, 2, 8, 40000, 120000, 40, 'full'], st: 'open', mo: 18, dc: 'medium',
  },
  {
    slug: 'green-battery-reuse', title: '电动车退役电池家用储能改装包',
    one: '退役电池价格洼地 + 家庭储能需求上升，标准化改装包与安装服务存在合规与安全门槛。',
    ind: 'green', gaps: ['price', 'knowledge'], regions: ['china', 'africa'], origin: '中国',
    targets: ['中国', '尼日利亚', '肯尼亚'], needs: ['survival', 'control'], neuro: ['cortisol', 'dopamine'],
    emo: ['greed', 'hope'], langs: ['zh', 'en'], tags: ['physical', 'needs-license', 'china-advantage', 'b2b'],
    roi: [50000, 150000, 4, 12, 60000, 250000, 35, 'full'], st: 'closing', mo: 10, dc: 'medium',
  },
  {
    slug: 'compliance-halal-cert', title: '清真认证咨询：东南亚工厂出口中东',
    one: '中东准入要求清真认证，工厂缺流程与材料能力，代咨询 + 年度维护可收年费。',
    ind: 'compliance', gaps: ['culture', 'regulation'], regions: ['sea'], origin: '马来西亚',
    targets: ['马来西亚', '印尼', '沙特'], needs: ['meaning', 'control'], neuro: ['serotonin', 'cortisol'],
    emo: ['devotion', 'anxiety'], langs: ['ms', 'en', 'ar'], tags: ['b2b', 'needs-license', 'recurring', 'localization-heavy'],
    roi: [8000, 30000, 2, 6, 15000, 70000, 60, 'side'], st: 'open', mo: 24, dc: 'slow',
  },
  {
    slug: 'culture-anime-shrine', title: '日本寺庙/神社数字御朱印服务',
    one: '御朱印文化年轻化 + 海外动漫游客增长，数字御朱印与实体邮寄结合存在文化新鲜感。',
    ind: 'culture', gaps: ['culture', 'infrastructure'], regions: ['east-asia'], origin: '日本',
    targets: ['日本', '美国', '法国'], needs: ['meaning', 'nostalgia', 'expression'], neuro: ['serotonin', 'oxytocin'],
    emo: ['devotion', 'nostalgia', 'pride'], langs: ['ja', 'en'], tags: ['digital', 'culture', 'localization-heavy', 'b2c'],
    roi: [5000, 20000, 2, 6, 8000, 40000, 65, 'side'], st: 'open', mo: 24, dc: 'slow',
  },
  {
    slug: 'pet-raw-food-cn', title: '冻干生骨肉小批量定制：中国工厂直连海外 DTC',
    one: '海外生骨肉订阅客单高、复购强，中国冻干产能与配方能力可做小批量 OEM 出海。',
    ind: 'pet', gaps: ['price', 'geo'], regions: ['china', 'north-america'], origin: '中国',
    targets: ['中国', '美国', '新加坡'], needs: ['health', 'status'], neuro: ['dopamine', 'serotonin'],
    emo: ['aspiration', 'pride'], langs: ['zh', 'en'], tags: ['china-advantage', 'physical', 'cross-border', 'recurring'],
    roi: [20000, 60000, 3, 8, 30000, 80000, 45, 'side'], st: 'open', mo: 18, dc: 'medium',
  },
  {
    slug: 'pet-mental-toy', title: '分离焦虑益智玩具 + 训练内容订阅',
    one: '上班族宠物分离焦虑普遍，玩具硬件 + 训练课程订阅可做内容驱动的轻品牌。',
    ind: 'pet', gaps: ['emotion', 'channel'], regions: ['europe', 'oceania'], origin: '英国',
    targets: ['英国', '德国', '澳大利亚'], needs: ['belonging', 'ease'], neuro: ['oxytocin', 'dopamine'],
    emo: ['loneliness', 'guilt'], langs: ['en'], tags: ['low-capital', 'content-driven', 'physical', 'b2c'],
    roi: [5000, 15000, 2, 6, 10000, 35000, 60, 'side'], st: 'open', mo: 15, dc: 'fast',
  },
  {
    slug: 'silver-senior-travel', title: '银发慢旅行小团：中日泰分线',
    one: '退休人群时间自由但市面产品节奏过快，慢旅行小团 + 医疗随行可按高客单验证。',
    ind: 'silver', gaps: ['culture', 'demographic'], regions: ['east-asia', 'sea'], origin: '日本',
    targets: ['日本', '泰国', '中国'], needs: ['novelty', 'belonging', 'health'], neuro: ['oxytocin', 'dopamine'],
    emo: ['aspiration', 'loneliness'], langs: ['ja', 'zh', 'th'], tags: ['service', 'b2c', 'seasonal', 'needs-license'],
    roi: [20000, 60000, 3, 8, 30000, 120000, 30, 'full'], st: 'open', mo: 18, dc: 'medium',
  },
  {
    slug: 'silver-grip-cutlery', title: '适老化餐具与握把的跨境品牌',
    one: '帕金森/关节炎人群餐具选择少且丑，设计感适老化餐具在欧美溢价明显。',
    ind: 'silver', gaps: ['price', 'geo'], regions: ['china', 'north-america'], origin: '中国',
    targets: ['美国', '英国', '日本'], needs: ['health', 'ease', 'status'], neuro: ['endorphin', 'serotonin'],
    emo: ['shame', 'relief'], langs: ['en', 'zh'], tags: ['china-advantage', 'physical', 'cross-border', 'b2c'],
    roi: [10000, 30000, 2, 7, 15000, 50000, 55, 'side'], st: 'open', mo: 24, dc: 'slow',
  },
  {
    slug: 'emotional-therapy-match', title: '心理咨询师匹配与督导会员制',
    one: '来访者找不到合适咨询师、新手咨询师缺个案，匹配 + 督导会员可做双边平台。',
    ind: 'emotional', gaps: ['knowledge', 'platform'], regions: ['china'], origin: '中国',
    targets: ['中国', '马来西亚', '新加坡'], needs: ['health', 'belonging'], neuro: ['oxytocin', 'cortisol'],
    emo: ['anxiety', 'hope'], langs: ['zh'], tags: ['platform-dependent', 'needs-license', 'b2b', 'recurring'],
    roi: [10000, 30000, 3, 9, 15000, 60000, 50, 'full'], st: 'open', mo: 24, dc: 'medium',
  },
  {
    slug: 'emotional-breakup-kit', title: '分手复原工具箱：实体 + 课程',
    one: '分手复原内容在社媒高互动，实体工具包 + 21 天课程可把情绪流量变成付费产品。',
    ind: 'emotional', gaps: ['emotion', 'channel'], regions: ['north-america', 'europe'], origin: '美国',
    targets: ['美国', '英国', '巴西'], needs: ['belonging', 'growth'], neuro: ['dopamine', 'oxytocin'],
    emo: ['grief', 'shame', 'hope'], langs: ['en', 'pt'], tags: ['low-capital', 'content-driven', 'digital', 'b2c'],
    roi: [3000, 12000, 1, 4, 8000, 30000, 70, 'side'], st: 'open', mo: 15, dc: 'fast',
  },
  {
    slug: 'ai-invoice-mena', title: '中东小商户阿拉伯语票据/记账工具',
    one: '海湾小商户开票与 VAT 申报仍靠手工，阿语优先的轻记账工具可按年订阅。',
    ind: 'ai', gaps: ['language', 'infrastructure'], regions: ['mena'], origin: '阿联酋',
    targets: ['阿联酋', '沙特', '埃及'], needs: ['ease', 'control'], neuro: ['cortisol', 'serotonin'],
    emo: ['anxiety', 'relief'], langs: ['ar', 'en'], tags: ['saas', 'b2b', 'localization-heavy', 'recurring'],
    roi: [10000, 30000, 2, 7, 15000, 60000, 75, 'side'], st: 'open', mo: 24, dc: 'medium',
  },
  {
    slug: 'ai-teacher-tools', title: '教师 AI 备课模板与校本知识库',
    one: '教师减负是政策与舆情共识，模板市场 + 校本知识库部署可以 B2B2C 双线收费。',
    ind: 'ai', gaps: ['knowledge', 'channel'], regions: ['china', 'east-asia'], origin: '中国',
    targets: ['中国', '韩国', '新加坡'], needs: ['ease', 'growth'], neuro: ['dopamine', 'serotonin'],
    emo: ['relief', 'aspiration'], langs: ['zh', 'ko'], tags: ['ai-native', 'b2b', 'digital', 'china-advantage'],
    roi: [5000, 20000, 2, 6, 10000, 50000, 70, 'side'], st: 'open', mo: 18, dc: 'medium',
  },
  {
    slug: 'cb-pet-grooming-supply', title: '宠物美容工具中东专供（斋月后换毛季）',
    one: '中东长毛宠物换毛季需求集中，线下美容店缺高性价比工具，可做区域批发 + 本地仓。',
    ind: 'crossborder', gaps: ['geo', 'culture'], regions: ['mena', 'china'], origin: '中国',
    targets: ['阿联酋', '沙特', '土耳其'], needs: ['ease', 'status'], neuro: ['dopamine', 'oxytocin'],
    emo: ['pride', 'complaint'], langs: ['en', 'ar'], tags: ['china-advantage', 'physical', 'b2b', 'seasonal'],
    roi: [20000, 70000, 2, 6, 30000, 120000, 40, 'side'], st: 'peak', mo: 12, dc: 'medium',
  },
  {
    slug: 'cb-mexico-sourcing', title: '墨西哥近岸仓 + 中国小家电组装',
    one: '美墨关税与近岸外包让「墨西哥组装、美国销售」成为新链路，小家电是最小切口。',
    ind: 'crossborder', gaps: ['geo', 'price'], regions: ['latam', 'china'], origin: '墨西哥',
    targets: ['墨西哥', '美国', '巴西'], needs: ['ease', 'status'], neuro: ['dopamine', 'cortisol'],
    emo: ['aspiration', 'envy'], langs: ['es', 'zh', 'en'], tags: ['needs-supply-chain', 'b2b', 'cross-border', 'china-advantage'],
    roi: [100000, 400000, 5, 14, 150000, 600000, 30, 'full'], st: 'open', mo: 30, dc: 'slow',
  },
  {
    slug: 'content-skill-videos', title: '蓝领技能短视频课程化（北美）',
    one: '水电/木工等蓝领技能搜索量大，短视频 + 付费课程 + 工具联盟是内容变现闭环。',
    ind: 'content', gaps: ['knowledge', 'channel'], regions: ['north-america', 'europe'], origin: '美国',
    targets: ['美国', '英国', '澳大利亚'], needs: ['growth', 'status'], neuro: ['dopamine', 'endorphin'],
    emo: ['aspiration', 'pride'], langs: ['en'], tags: ['content-driven', 'solo', 'digital', 'recurring'],
    roi: [2000, 8000, 2, 5, 6000, 25000, 75, 'side'], st: 'open', mo: 18, dc: 'medium',
  },
  {
    slug: 'content-kids-podcast', title: '中英双语儿童播客 + 订阅盒子',
    one: '双语启蒙内容稀缺，播客 + 实体活动盒子订阅可把内容资产变成月度复购。',
    ind: 'content', gaps: ['language', 'emotion'], regions: ['china', 'north-america'], origin: '中国',
    targets: ['中国', '美国', '新加坡'], needs: ['growth', 'belonging'], neuro: ['oxytocin', 'dopamine'],
    emo: ['love', 'curiosity'], langs: ['zh', 'en'], tags: ['content-driven', 'recurring', 'physical', 'b2c'],
    roi: [5000, 20000, 2, 7, 10000, 40000, 55, 'side'], st: 'open', mo: 24, dc: 'slow',
  },
  {
    slug: 'edu-homeschool-eu', title: '欧洲家庭学校中文/数学教材',
    one: '欧洲 homeschool 群体扩大，但中文教材与数学练习册不合本地课标，可做本地化出版。',
    ind: 'education', gaps: ['culture', 'regulation'], regions: ['europe'], origin: '德国',
    targets: ['德国', '奥地利', '瑞士'], needs: ['growth', 'belonging'], neuro: ['dopamine', 'serotonin'],
    emo: ['hope', 'anxiety'], langs: ['de', 'zh'], tags: ['digital', 'infoproduct', 'localization-heavy', 'b2c'],
    roi: [3000, 12000, 2, 7, 5000, 25000, 70, 'side'], st: 'open', mo: 30, dc: 'slow',
  },
  {
    slug: 'edu-cert-prep-us', title: '美国蓝领执照考试题库（HVAC/电工）',
    one: '蓝领执照考试题库更新慢、移动端体验差，按州做题库 + 订阅可验证付费。',
    ind: 'education', gaps: ['knowledge', 'regulation'], regions: ['north-america'], origin: '美国',
    targets: ['美国', '加拿大'], needs: ['growth', 'survival'], neuro: ['dopamine', 'cortisol'],
    emo: ['aspiration', 'anxiety'], langs: ['en'], tags: ['digital', 'infoproduct', 'recurring', 'b2c'],
    roi: [5000, 20000, 2, 6, 10000, 50000, 80, 'side'], st: 'open', mo: 24, dc: 'slow',
  },
  {
    slug: 'local-night-market', title: '夜市摊主 SaaS：点单 + 排号',
    one: '夜市摊主用微信接单、手工记账，轻量点单排号工具 + 抽成可在 1 个夜市验证。',
    ind: 'local', gaps: ['infrastructure', 'platform'], regions: ['sea', 'china'], origin: '泰国',
    targets: ['泰国', '越南', '中国'], needs: ['ease', 'control'], neuro: ['dopamine', 'serotonin'],
    emo: ['complaint', 'relief'], langs: ['th', 'vi', 'zh'], tags: ['saas', 'b2b', 'localization-heavy', 'recurring'],
    roi: [5000, 20000, 2, 6, 8000, 30000, 70, 'side'], st: 'open', mo: 18, dc: 'medium',
  },
  {
    slug: 'local-home-organization', title: '上门收纳 + 内容资产（日式整理中式改良）',
    one: '收纳需求从一线城市向新一线扩散，服务 + 课程 + 收纳用品带货可形成内容闭环。',
    ind: 'local', gaps: ['culture', 'channel'], regions: ['east-asia', 'china'], origin: '日本',
    targets: ['中国', '日本', '韩国'], needs: ['control', 'ease'], neuro: ['serotonin', 'dopamine'],
    emo: ['relief', 'pride'], langs: ['zh', 'ja'], tags: ['service', 'content-driven', 'localization-heavy', 'b2c'],
    roi: [5000, 15000, 1, 4, 10000, 40000, 60, 'side'], st: 'open', mo: 18, dc: 'medium',
  },
  {
    slug: 'green-solar-africa', title: '非洲离网太阳能 + 分期支付',
    one: '离网光伏需求刚性但一次性支付门槛高，分期 + 代理点模式在尼日利亚已验证。',
    ind: 'green', gaps: ['infrastructure', 'price'], regions: ['africa'], origin: '尼日利亚',
    targets: ['尼日利亚', '肯尼亚', '加纳'], needs: ['survival', 'health'], neuro: ['cortisol', 'dopamine'],
    emo: ['hope', 'fear'], langs: ['en'], tags: ['needs-supply-chain', 'physical', 'b2c', 'localization-heavy'],
    roi: [50000, 200000, 4, 12, 60000, 250000, 35, 'full'], st: 'open', mo: 36, dc: 'slow',
  },
  {
    slug: 'green-refill-eu', title: '欧盟 refill/补充装门店加盟包',
    one: '包装法规推动补充装，社区零包装门店缺标准化供应链与加盟包，可做 B2B 供货 + 品牌。',
    ind: 'green', gaps: ['regulation', 'culture'], regions: ['europe'], origin: '法国',
    targets: ['法国', '西班牙', '意大利'], needs: ['meaning', 'ease'], neuro: ['serotonin', 'oxytocin'],
    emo: ['guilt', 'pride'], langs: ['fr', 'es'], tags: ['b2b', 'physical', 'localization-heavy', 'recurring'],
    roi: [20000, 60000, 3, 9, 30000, 100000, 45, 'full'], st: 'open', mo: 30, dc: 'slow',
  },
  {
    slug: 'compliance-labeling-us', title: '美国各州产品标签合规审查（小卖家）',
    one: '各州标签与警示要求碎片化，小卖家被平台抽查下架，单次审查 + 年度订阅可标准化。',
    ind: 'compliance', gaps: ['regulation', 'language'], regions: ['north-america'], origin: '美国',
    targets: ['美国', '加拿大'], needs: ['survival', 'control'], neuro: ['cortisol', 'serotonin'],
    emo: ['anxiety', 'relief'], langs: ['en'], tags: ['b2b', 'needs-license', 'recurring', 'digital'],
    roi: [5000, 20000, 1, 5, 10000, 50000, 65, 'side'], st: 'open', mo: 24, dc: 'medium',
  },
  {
    slug: 'compliance-ip-monitor', title: '品牌出海商标监测 + 预警',
    one: '中国品牌出海被抢注/跟卖频发，商标监测 + 预警报告可按年订阅，与律所分成。',
    ind: 'compliance', gaps: ['knowledge', 'regulation'], regions: ['china', 'north-america'], origin: '中国',
    targets: ['中国', '美国', '欧盟'], needs: ['survival', 'status'], neuro: ['cortisol', 'serotonin'],
    emo: ['fear', 'justice'], langs: ['zh', 'en'], tags: ['b2b', 'needs-license', 'digital', 'recurring'],
    roi: [10000, 30000, 2, 6, 15000, 60000, 65, 'side'], st: 'open', mo: 30, dc: 'slow',
  },
  {
    slug: 'culture-indian-wedding', title: '印度婚礼季定制请柬/伴手礼',
    one: '印度婚礼季客单高、周期长，定制请柬与伴手礼依赖本地审美与手工，跨境供给少。',
    ind: 'culture', gaps: ['culture', 'time'], regions: ['south-asia'], origin: '印度',
    targets: ['印度', '美国', '英国'], needs: ['status', 'belonging', 'meaning'], neuro: ['oxytocin', 'serotonin'],
    emo: ['love', 'pride', 'devotion'], langs: ['en', 'hi'], tags: ['physical', 'seasonal', 'localization-heavy', 'b2c'],
    roi: [10000, 40000, 3, 8, 20000, 90000, 50, 'side'], st: 'peak', mo: 9, dc: 'fast',
  },
  {
    slug: 'culture-africa-church', title: '非洲教会音响/直播设备套装',
    one: '非洲教会直播与扩声需求增长，成套设备 + 安装培训可做区域 B2B 供应。',
    ind: 'culture', gaps: ['infrastructure', 'channel'], regions: ['africa'], origin: '尼日利亚',
    targets: ['尼日利亚', '加纳', '肯尼亚'], needs: ['meaning', 'status', 'belonging'], neuro: ['oxytocin', 'serotonin'],
    emo: ['devotion', 'pride'], langs: ['en'], tags: ['b2b', 'physical', 'needs-supply-chain', 'localization-heavy'],
    roi: [30000, 100000, 3, 9, 40000, 150000, 35, 'full'], st: 'open', mo: 30, dc: 'slow',
  },
  {
    slug: 'gaming-esports-coaching', title: '中东/日本电竞陪练与青训',
    one: '海湾电竞投资热但青训体系薄，陪练 + 青训营 + 内容可社群化运营。',
    ind: 'gaming', gaps: ['channel', 'culture'], regions: ['mena', 'east-asia'], origin: '沙特',
    targets: ['沙特', '阿联酋', '日本'], needs: ['status', 'growth'], neuro: ['dopamine', 'adrenaline'],
    emo: ['envy', 'pride'], langs: ['ar', 'ja', 'en'], tags: ['content-driven', 'service', 'localization-heavy', 'b2c'],
    roi: [5000, 25000, 2, 6, 10000, 50000, 60, 'side'], st: 'open', mo: 18, dc: 'medium',
  },
  {
    slug: 'fintech-cross-border-pay', title: '拉美跨境收款合规咨询',
    one: '拉美各国收款与税制复杂，卖家频繁因资金路径被冻结，合规咨询 + 聚合方案可收费。',
    ind: 'fintech', gaps: ['regulation', 'infrastructure'], regions: ['latam'], origin: '巴西',
    targets: ['巴西', '墨西哥', '哥伦比亚'], needs: ['survival', 'control'], neuro: ['cortisol', 'serotonin'],
    emo: ['fear', 'relief'], langs: ['pt', 'es'], tags: ['b2b', 'needs-license', 'localization-heavy', 'recurring'],
    roi: [10000, 30000, 2, 7, 15000, 70000, 60, 'side'], st: 'open', mo: 24, dc: 'medium',
  },
  {
    slug: 'manufacturing-3d-print', title: '中小企业 3D 打印备件代工平台',
    one: '停产设备备件难买，3D 打印 + 扫描逆向可做小批量替代件，按件收费毛利高。',
    ind: 'manufacturing', gaps: ['knowledge', 'infrastructure'], regions: ['north-america', 'europe'], origin: '美国',
    targets: ['美国', '德国', '英国'], needs: ['ease', 'control'], neuro: ['serotonin', 'dopamine'],
    emo: ['complaint', 'relief'], langs: ['en', 'de'], tags: ['b2b', 'physical', 'tech-driven', 'needs-supply-chain'],
    roi: [20000, 80000, 3, 9, 30000, 150000, 55, 'full'], st: 'open', mo: 24, dc: 'medium',
  },
  {
    slug: 'cb-cis-ecommerce', title: '中亚电商 COD 履约（乌兹别克斯坦）',
    one: '中亚电商增长但支付与物流基建落后，COD 履约 + 本地客服是当前最短缺环节。',
    ind: 'crossborder', gaps: ['infrastructure', 'geo'], regions: ['cis'], origin: '乌兹别克斯坦',
    targets: ['乌兹别克斯坦', '哈萨克斯坦', '中国'], needs: ['ease', 'status'], neuro: ['dopamine', 'cortisol'],
    emo: ['aspiration', 'anxiety'], langs: ['ru', 'uz', 'zh'], tags: ['b2b', 'cross-border', 'localization-heavy', 'needs-supply-chain'],
    roi: [30000, 100000, 4, 12, 50000, 200000, 35, 'full'], st: 'open', mo: 30, dc: 'slow',
  },
  {
    slug: 'manufacturing-cis-machinery', title: '中亚农业机械配件（替代件）',
    one: '中亚农机保有量大、原厂配件慢，替代件供应 + 维修培训可做长期 B2B 生意。',
    ind: 'manufacturing', gaps: ['price', 'infrastructure'], regions: ['cis', 'south-asia'], origin: '哈萨克斯坦',
    targets: ['哈萨克斯坦', '乌兹别克斯坦', '巴基斯坦'], needs: ['survival', 'ease'], neuro: ['cortisol', 'serotonin'],
    emo: ['complaint', 'hope'], langs: ['ru', 'en', 'zh'], tags: ['b2b', 'physical', 'needs-supply-chain', 'china-advantage'],
    roi: [30000, 120000, 4, 12, 60000, 260000, 30, 'full'], st: 'open', mo: 36, dc: 'slow',
  },
]

/* ============================ 机会对象构建 ============================ */
const gradeOf = (total) => {
  for (const g of mockTaxonomy.grades) {
    if (total >= g.min) return g.id
  }
  return 'D'
}
const dimsOfTaxonomy = mockTaxonomy.score_dimensions

function buildOpportunities() {
  return seeds.map((s, i) => {
    const rnd = mulberry32(4000 + i * 97)
    const profile = industryProfiles[s.ind]
    const bucket = i < 7 ? 'day' : i < 15 ? 'week' : i < 25 ? 'month' : 'year'
    let last
    if (bucket === 'day') last = AS_OF
    else if (bucket === 'week') last = shiftDate('2026-10-19', [0, 1, 2, 4, 5, 6, 0, 1][i - 7])
    else if (bucket === 'month') last = shiftDate('2026-10-01', (i - 15) * 2)
    else last = shiftDate('2026-01-08', (i - 25) * 9)

    const early1 = shiftDate(last, -(22 + Math.floor(rnd() * 26)))
    const early2 = shiftDate(early1, -(30 + Math.floor(rnd() * 45)))
    const activity_dates = [early2, early1, last].sort()

    const dimensions = {}
    const dimBoost = i % 11 === 0 ? 1.55 : i % 7 === 0 ? 0.5 : i % 5 === 0 ? -0.75 : 0
    let acc = 0
    for (const d of dimsOfTaxonomy) {
      const v = round1(clamp(6.0 + rnd() * 3.1 + dimBoost, 0, 10))
      dimensions[d.id] = v
      acc += v * d.weight
    }
    const total = round1(clamp(acc * 10, 42, 96))
    const momentum = bucket === 'day'
      ? round1(1.6 + rnd() * 0.8)
      : bucket === 'week' ? round1(1.2 + rnd() * 0.5)
        : bucket === 'month' ? round1(0.9 + rnd() * 0.5)
          : round1(0.6 + rnd() * 0.6)
    const rank_score = round1(Math.min(100, total * (1 + 0.12 * (momentum - 1))))

    const evidencePool = profile.evidence
    const evCount = i % 3 === 0 ? 3 : 2
    const evidence = evidencePool.slice(0, evCount).map((e, j) => ({
      ...e,
      date: shiftDate(last, -(12 + j * 23 + Math.floor(rnd() * 30))),
    }))

    const driverSet = [...new Set(s.gaps.flatMap((g) => driverMap[g] || ['info']))].slice(0, 2)
    const capMin = s.roi[0], capMax = s.roi[1], ttr = s.roi[2], payback = s.roi[3]
    const revMin = s.roi[4], revMax = s.roi[5], margin = s.roi[6], effort = s.roi[7]
    const roiText = `启动 ${capMin.toLocaleString('zh-CN')}–${capMax.toLocaleString('zh-CN')} 元；约 ${ttr} 个月出首单，${payback} 个月回本；月收入 ${revMin.toLocaleString('zh-CN')}–${revMax.toLocaleString('zh-CN')} 元，毛利 ${margin}%，${effort === 'full' ? '需全职投入' : effort === 'side' ? '可兼职验证' : '单人可做'}。`
    const digits = String(i + 1).padStart(3, '0')
    const priceMid = Math.round((revMin + revMax) / 2)
    return {
      id: `opp-${s.ind}-${s.slug.replace(/^[a-z]+-/, '')}-${digits}`,
      slug: s.slug,
      title: s.title,
      one_liner: s.one,
      industry_id: s.ind,
      gap_type_ids: s.gaps,
      region_ids: s.regions,
      origin_country: s.origin,
      target_countries: s.targets,
      human_need_ids: s.needs,
      neuro_drivers: s.neuro,
      emotion_tags: s.emo,
      source_langs: s.langs,
      signal: {
        summary: `${profile.summary} 本条聚焦：${s.one}`,
        evidence,
        signal_strength: dimensions.signal,
        trend_direction: momentum >= 1.35 ? 'up' : momentum >= 0.95 ? 'flat' : 'down',
        volume_estimate: profile.volume,
      },
      seven_questions: {
        traffic: profile.traffic,
        money: profile.money,
        model: profile.model,
        roi: roiText,
        audience: profile.audience,
        drivers: driverSet,
        moat: profile.moat,
      },
      roi: {
        capital_cny: { min: capMin, max: capMax },
        time_to_revenue_months: ttr,
        payback_months: payback,
        monthly_revenue_cny: { min: revMin, max: revMax },
        gross_margin_pct: margin,
        effort_level: effort,
        team_size: effort === 'full' ? 2 : 1,
      },
      scores: { dimensions, total, grade: gradeOf(total) },
      window: { status: s.st, months_left: s.mo, decay: s.dc },
      risks: profile.risks,
      first_steps_7d: profile.steps,
      kill_criteria: profile.kill,
      compliance_notes: profile.compliance,
      evidence_count: evidence.length,
      activity_dates,
      first_seen: activity_dates[0],
      last_activity: last,
      momentum,
      rank_score,
      tags: s.tags,
      verified: false,
      disclaimer: DISCLAIMER,
      _mock_price_mid: priceMid,
    }
  })
}

const opportunities = buildOpportunities()

/* ============================ rankings.json ============================ */
function buildRankings(opps) {
  const weekKey = isoWeekKey(AS_OF)
  const monthKey = AS_OF.slice(0, 7)
  const yearKey = AS_OF.slice(0, 4)
  const weekNo = Number(weekKey.split('W')[1])
  const defs = [
    ['day', AS_OF, '2026年10月22日', (o) => o.last_activity === AS_OF],
    ['week', weekKey, `2026年第${weekNo}周`, (o) => isoWeekKey(o.last_activity) === weekKey],
    ['month', monthKey, '2026年10月', (o) => o.last_activity.slice(0, 7) === monthKey],
    ['year', yearKey, '2026年', (o) => o.last_activity.slice(0, 4) === yearKey],
  ]
  const windows = {}
  for (const [key, wkey, label, filter] of defs) {
    const items = opps
      .filter(filter)
      .sort((a, b) => b.rank_score - a.rank_score || b.scores.total - a.scores.total)
      .map((o, idx) => {
        const h = (idx * 7 + key.length) % 10
        const change = h < 2 ? 'new' : h < 6 ? 'up' : h < 9 ? 'down' : 'flat'
        const delta = change === 'new' ? null : change === 'up' ? (h % 4) + 1 : change === 'down' ? -((h % 3) + 1) : 0
        return {
          opp_id: o.id,
          rank: idx + 1,
          rank_score: o.rank_score,
          total: o.scores.total,
          delta,
          change,
        }
      })
    windows[key] = { key: wkey, label, items }
  }
  return {
    meta: {
      data_version: '0.1.0-mock',
      as_of: AS_OF,
      generator: 'app/scripts/mock-seed.mjs',
      window_rules: 'day=last_activity==as_of; week=ISO week; month=YYYY-MM; year=YYYY',
      mock: true,
    },
    windows,
  }
}

/* ============================ stats.json ============================ */
function buildStats(opps) {
  const tax = mockTaxonomy
  const byId = (arr) => new Map(arr.map((x) => [x.id, x]))
  const indMap = byId(tax.industries)
  const gapMap = byId(tax.gap_types)
  const regionMap = byId(tax.regions)
  const needMap = byId(tax.human_needs)
  const classMap = byId(tax.business_models)

  const group = (getIdList, lookup) => {
    const m = new Map()
    for (const o of opps) {
      const ids = getIdList(o)
      for (const id of ids) {
        const cur = m.get(id) || { id, count: 0, sum: 0 }
        cur.count += 1
        cur.sum += o.scores.total
        m.set(id, cur)
      }
    }
    return [...m.values()]
      .map((x) => ({
        id: x.id,
        name: lookup.get(x.id)?.name || x.id,
        count: x.count,
        avg_total: round1(x.sum / x.count),
      }))
      .sort((a, b) => b.count - a.count)
  }

  const histogram = Array.from({ length: 10 }, () => 0)
  for (const o of opps) histogram[clamp(Math.floor(o.scores.total / 10), 0, 9)] += 1

  const trend_14d = []
  for (let d = 13; d >= 0; d--) {
    const date = shiftDate(AS_OF, -d)
    const active = opps.filter((o) => o.activity_dates.includes(date))
    trend_14d.push({
      date,
      new_count: active.length,
      avg_score: active.length ? round1(active.reduce((a, o) => a + o.scores.total, 0) / active.length) : 0,
    })
  }

  const weekKey = isoWeekKey(AS_OF)
  const newWeek = opps.filter((o) => isoWeekKey(o.last_activity) === weekKey).length
  const newMonth = opps.filter((o) => o.last_activity.slice(0, 7) === AS_OF.slice(0, 7)).length
  const openValue = opps
    .filter((o) => o.window.status === 'open' || o.window.status === 'peak')
    .reduce((a, o) => a + (o.roi.monthly_revenue_cny.min + o.roi.monthly_revenue_cny.max) / 2, 0)

  return {
    meta: { data_version: '0.1.0-mock', as_of: AS_OF, generator: 'app/scripts/mock-seed.mjs', mock: true },
    kpi: {
      total_opps: opps.length,
      new_today: opps.filter((o) => o.last_activity === AS_OF).length,
      new_week: newWeek,
      new_month: newMonth,
      grade_a_plus: opps.filter((o) => o.scores.grade === 'S' || o.scores.grade === 'A').length,
      industries_covered: new Set(opps.map((o) => o.industry_id)).size,
      regions_covered: new Set(opps.flatMap((o) => o.region_ids)).size,
      avg_total: round1(opps.reduce((a, o) => a + o.scores.total, 0) / opps.length),
    },
    by_industry: group((o) => [o.industry_id], indMap),
    by_gap_type: group((o) => o.gap_type_ids, gapMap),
    by_region: group((o) => o.region_ids, regionMap),
    by_need: group((o) => o.human_need_ids, needMap),
    score_histogram: histogram,
    trend_14d,
    open_window_value_cny: Math.round(openValue),
  }
}

/* ============================ sources.json ============================ */
const S = (id, name, url, regions, signal_types, access, frequency, cost, compliance, value_score, notes) => ({
  id, name, url, regions, signal_types, access, frequency, cost, compliance, value_score, notes,
})

const sourceCategories = [
  {
    id: 'demand', name: '需求与抱怨', desc: '用户原声：抱怨、愿望、求助、比较与替代方案。',
    sources: [
      S('reddit', 'Reddit', 'https://www.reddit.com', ['north-america', 'europe', 'oceania'], ['complaint', 'wish', 'comparison'], 'api', 'daily', 'freemium', 'yellow', 9.2, '2023 后 API 收费；个人版用 RSS/网页需限速。子版块订阅是性价比最高的需求源。'),
      S('trustpilot', 'Trustpilot', 'https://www.trustpilot.com', ['europe', 'north-america'], ['complaint', 'comparison'], 'html', 'daily', 'free', 'yellow', 8.1, '1–3 星评论是最干净的抱怨语料；注意剔除刷评。'),
      S('g2', 'G2 Reviews', 'https://www.g2.com', ['north-america', 'europe'], ['comparison', 'complaint'], 'html', 'weekly', 'free', 'yellow', 8.0, 'B2B 软件差评与替代方案对比，适合 SaaS 选题。'),
      S('app-store', 'App Store / Google Play 评论', 'https://apps.apple.com', ['north-america', 'europe', 'china'], ['complaint', 'wish'], 'rss', 'daily', 'free', 'green', 8.4, '官方 RSS 可读最新评论；按国家区切换可做跨市场对比。'),
      S('amazon-reviews', 'Amazon Reviews', 'https://www.amazon.com', ['north-america', 'europe', 'east-asia'], ['complaint', 'comparison'], 'html', 'daily', 'free', 'yellow', 8.7, '评论是需求金矿，但抓取受 ToS 限制，个人建议人工抽样。'),
      S('discord', 'Discord 社群', 'https://discord.com', ['north-america', 'europe', 'sea'], ['wish', 'complaint', 'community'], 'api', 'realtime', 'free', 'yellow', 7.8, '垂类社群里的求助与吐槽；需遵守服务器规则。'),
    ],
  },
  {
    id: 'trend', name: '趋势与搜索', desc: '搜索热度、社媒趋势、平台新兴话题。',
    sources: [
      S('google-trends', 'Google Trends', 'https://trends.google.com', ['north-america', 'europe', 'latam', 'sea'], ['trend', 'seasonality'], 'api', 'daily', 'free', 'green', 9.4, '支持按国家/地区对比与相关查询；注意采样限制。'),
      S('exploding-topics', 'Exploding Topics', 'https://explodingtopics.com', ['north-america', 'europe'], ['trend', 'emerging'], 'html', 'weekly', 'freemium', 'yellow', 8.2, '提前捕捉上升话题；免费层足够做方向判断。'),
      S('tiktok-cc', 'TikTok Creative Center', 'https://ads.tiktok.com/business/creativecenter', ['north-america', 'europe', 'sea', 'mena'], ['trend', 'creative'], 'html', 'weekly', 'free', 'yellow', 8.0, '热门话题、素材与受众洞察；广告后台公开数据。'),
      S('pinterest-trends', 'Pinterest Trends', 'https://trends.pinterest.com', ['north-america', 'europe'], ['trend', 'visual'], 'html', 'weekly', 'free', 'green', 7.9, '视觉消费趋势，适合家居/宠物/礼赠品类。'),
      S('naver-datalab', 'Naver DataLab', 'https://datalab.naver.com', ['east-asia'], ['trend', 'korea'], 'api', 'weekly', 'free', 'green', 7.6, '韩国搜索趋势，做东亚时差套利必看。'),
      S('douyin-hot', '抖音热点宝 / 巨量算数', 'https://trendinsight.oceanengine.com', ['china'], ['trend', 'china'], 'manual', 'daily', 'freemium', 'yellow', 7.8, '中国站内趋势与人群画像；需登录后台，人工采集。'),
    ],
  },
  {
    id: 'marketplace', name: '电商与交易', desc: '平台销量、价格带、评论与供给缺口。',
    sources: [
      S('amazon', 'Amazon', 'https://www.amazon.com', ['north-america', 'europe', 'east-asia'], ['sales', 'price', 'reviews'], 'api', 'daily', 'paid', 'yellow', 9.5, '官方 SP-API 需卖家账号；第三方工具可补充 BSR 与销量估算。'),
      S('etsy', 'Etsy', 'https://www.etsy.com', ['north-america', 'europe', 'oceania'], ['handmade', 'price', 'trend'], 'api', 'daily', 'freemium', 'yellow', 9.0, '手工/定制类需求风向标；搜索页可直接人工调研。'),
      S('shopee', 'Shopee', 'https://shopee.com', ['sea', 'latam'], ['sales', 'price'], 'api', 'daily', 'free', 'yellow', 8.3, '东南亚主战场，站点数据可用卖家工具获取。'),
      S('mercadolibre', 'MercadoLibre', 'https://www.mercadolibre.com', ['latam'], ['sales', 'price'], 'api', 'daily', 'free', 'green', 8.2, '拉美电商数据开放度较高，适合区域选品。'),
      S('1688', '1688', 'https://www.1688.com', ['china'], ['supply', 'price'], 'manual', 'daily', 'free', 'yellow', 8.8, '中国供应链价格基准；人工询价与打样最可靠。'),
      S('aliexpress', 'AliExpress', 'https://www.aliexpress.com', ['north-america', 'europe', 'latam', 'africa'], ['sales', 'price'], 'api', 'daily', 'free', 'yellow', 7.9, '跨境价格锚点；注意区分平台补贴价。'),
    ],
  },
  {
    id: 'social', name: '社媒与内容', desc: '内容爆款、创作者生态、社群情绪与传播路径。',
    sources: [
      S('tiktok', 'TikTok', 'https://www.tiktok.com', ['north-america', 'europe', 'sea', 'mena'], ['content', 'trend', 'community'], 'manual', 'daily', 'free', 'yellow', 9.1, '内容与需求双料信号；禁止绕过登录抓取。'),
      S('youtube', 'YouTube', 'https://www.youtube.com', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['content', 'search'], 'api', 'daily', 'free', 'green', 8.9, '官方 Data API 可搜关键词与频道；配额有限。'),
      S('instagram', 'Instagram', 'https://www.instagram.com', ['north-america', 'europe', 'latam'], ['content', 'visual'], 'manual', 'daily', 'free', 'yellow', 8.6, '视觉审美与礼赠趋势；人工观察为主。'),
      S('x-twitter', 'X / Twitter', 'https://x.com', ['north-america', 'europe', 'east-asia'], ['news', 'community'], 'api', 'realtime', 'freemium', 'yellow', 7.7, '科技与政策圈层快讯；API 价格较高。'),
      S('bilibili', 'Bilibili', 'https://www.bilibili.com', ['china'], ['content', 'community'], 'manual', 'daily', 'free', 'green', 7.5, '中文年轻圈层内容风向；人工检索。'),
      S('line-openchat', 'LINE OpenChat', 'https://openchat.line.me', ['east-asia', 'sea'], ['community', 'wish'], 'manual', 'daily', 'free', 'yellow', 7.0, '日韩泰社群真实讨论；需本地账号。'),
    ],
  },
  {
    id: 'policy', name: '政策与监管', desc: '法规、认证、关税、招标、补贴的一手信息。',
    sources: [
      S('eur-lex', 'EUR-Lex', 'https://eur-lex.europa.eu', ['europe'], ['regulation', 'standards'], 'rss', 'weekly', 'free', 'green', 9.0, '欧盟法规原文与时间表；做合规服务必读。'),
      S('federal-register', 'Federal Register', 'https://www.federalregister.gov', ['north-america'], ['regulation', 'notices'], 'api', 'daily', 'free', 'green', 8.8, '美国联邦法规与征求意见；有公开 API。'),
      S('gov-cn', '中国政府网', 'https://www.gov.cn', ['china'], ['policy', 'subsidy'], 'rss', 'daily', 'free', 'green', 8.7, '政策文件与解读；订阅国务院政策 RSS。'),
      S('wto', 'WTO 贸易政策', 'https://www.wto.org', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['trade', 'tariff'], 'manual', 'weekly', 'free', 'green', 8.0, '关税与贸易争端信息；人工检索。'),
      S('uae-moec', '阿联酋经济部', 'https://www.moec.gov.ae', ['mena'], ['regulation', 'standard'], 'manual', 'weekly', 'free', 'green', 7.3, '海湾合规与公司注册要求；阿语/英语双语。'),
      S('cbp', 'US CBP 海关', 'https://www.cbp.gov', ['north-america'], ['customs', 'tariff'], 'rss', 'weekly', 'free', 'green', 7.6, '关税与原产地规则更新；跨境卖家必看。'),
    ],
  },
  {
    id: 'capital', name: '资本与融资', desc: '融资事件、退出、招股书与资本流向。',
    sources: [
      S('crunchbase', 'Crunchbase', 'https://www.crunchbase.com', ['north-america', 'europe'], ['funding', 'startup'], 'paid-api', 'weekly', 'paid', 'yellow', 8.2, '融资事件数据全但价格高；可先用免费层。'),
      S('pitchbook', 'PitchBook', 'https://pitchbook.com', ['north-america', 'europe'], ['funding', 'valuation'], 'paid-api', 'monthly', 'paid', 'yellow', 7.8, '机构级数据；个人版成本高。'),
      S('sec-edgar', 'SEC EDGAR', 'https://www.sec.gov/edgar', ['north-america'], ['filings', 's1'], 'api', 'daily', 'free', 'green', 8.4, '招股书与年报是商业模式富矿；需遵守访问频率。'),
      S('itjuzi', 'IT桔子', 'https://www.itjuzi.com', ['china'], ['funding', 'china'], 'html', 'weekly', 'freemium', 'yellow', 8.0, '中国一级市场融资数据；免费层够看趋势。'),
      S('techcrunch', 'TechCrunch', 'https://techcrunch.com', ['north-america', 'europe'], ['startup', 'news'], 'rss', 'daily', 'free', 'green', 7.9, '创业公司报道与融资快讯；RSS 可订阅。'),
    ],
  },
  {
    id: 'academic', name: '学术与技术', desc: '论文、专利、开源项目与开发者生态的前沿信号。',
    sources: [
      S('arxiv', 'arXiv', 'https://arxiv.org', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['paper', 'research'], 'api', 'daily', 'free', 'green', 8.1, '论文预印本；适合寻找商业化滞后的技术。'),
      S('google-patents', 'Google Patents', 'https://patents.google.com', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['patent', 'ip'], 'html', 'weekly', 'free', 'green', 7.9, '专利检索看技术布局与到期时间。'),
      S('github-trending', 'GitHub Trending', 'https://github.com/trending', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['oss', 'developer'], 'html', 'daily', 'free', 'green', 8.6, '开源趋势与工具需求；可发现可产品化的项目。'),
      S('product-hunt', 'Product Hunt', 'https://www.producthunt.com', ['north-america', 'europe'], ['launch', 'tool'], 'rss', 'daily', 'free', 'yellow', 8.3, '新产品发布与评论；侧证需求与竞品。'),
      S('papers-with-code', 'Papers with Code', 'https://paperswithcode.com', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['paper', 'benchmark'], 'api', 'weekly', 'free', 'green', 7.2, '论文+代码，评估技术成熟度。'),
    ],
  },
  {
    id: 'supply', name: '供应链与价格', desc: '工厂、原材料、运费、产能与价格指数。',
    sources: [
      S('alibaba', 'Alibaba.com', 'https://www.alibaba.com', ['china', 'north-america', 'europe', 'sea'], ['supply', 'price'], 'manual', 'daily', 'freemium', 'yellow', 9.0, '海外买家视角的供应链入口；询价是核心动作。'),
      S('yiwu-index', '义乌小商品指数', 'https://www.ywindex.com', ['china'], ['price', 'supply'], 'manual', 'weekly', 'free', 'yellow', 8.1, '小商品价格与景气度指数；适合快消选品。'),
      S('freightos', 'Freightos', 'https://www.freightos.com', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['freight', 'price'], 'html', 'weekly', 'freemium', 'yellow', 7.8, '海运/空运价格指数；跨境成本测算必用。'),
      S('made-in-china', 'Made-in-China', 'https://www.made-in-china.com', ['china', 'north-america', 'europe'], ['supply', 'manufacturer'], 'manual', 'weekly', 'free', 'yellow', 8.0, '中国工厂名录；适合找替代供应商。'),
      S('thomasnet', 'Thomasnet', 'https://www.thomasnet.com', ['north-america'], ['supplier', 'industrial'], 'manual', 'weekly', 'free', 'green', 7.4, '北美工业供应商目录；B2B 选品用。'),
      S('sse-shipping', '上海航运交易所', 'https://www.sse.net.cn', ['china', 'north-america', 'europe'], ['freight', 'index'], 'manual', 'weekly', 'free', 'green', 7.9, '集装箱运价指数；判断物流成本趋势。'),
    ],
  },
  {
    id: 'culture', name: '文化与宗教', desc: '宗教日历、文化维度、语言与消费审美差异。',
    sources: [
      S('pew', 'Pew Research Center', 'https://www.pewresearch.org/religion', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['religion', 'demographics'], 'manual', 'monthly', 'free', 'green', 8.2, '宗教与人口结构研究；文化机会的基础数据。'),
      S('hofstede', 'Hofstede Insights', 'https://www.hofstede-insights.com', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['culture', 'dimensions'], 'manual', 'quarterly', 'free', 'green', 7.8, '六维文化模型；只作假设，不可机械套用。'),
      S('islamic-calendar', '伊斯兰历/朝觐日历', 'https://www.islamicfinder.org', ['mena', 'sea'], ['religious', 'calendar'], 'manual', 'monthly', 'free', 'green', 7.5, '斋月/朝觐窗口；营销与备货提前量关键。'),
      S('anthropology-blogs', '民族志与人类学博客', 'https://www.anthro{days}.com', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['culture', 'ethnography'], 'rss', 'weekly', 'free', 'green', 7.2, '深描式文化观察；启发跨文化产品假设。'),
      S('reddit-culture', 'Reddit 文化类社区', 'https://www.reddit.com/r/AskAnthropology', ['north-america', 'europe'], ['culture', 'community'], 'api', 'daily', 'free', 'yellow', 7.6, '真实文化困惑与原声；注意样本偏差。'),
      S('un-wpp', 'UN World Population Prospects', 'https://population.un.org/wpp', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['demographics', 'aging'], 'api', 'quarterly', 'free', 'green', 8.0, '人口预测；银发/少子化机会的长期底图。'),
    ],
  },
  {
    id: 'talent', name: '服务与人才市场', desc: '招聘、自由职业、外包价格与技能缺口。',
    sources: [
      S('upwork', 'Upwork', 'https://www.upwork.com', ['north-america', 'europe', 'east-asia'], ['hiring', 'skills'], 'api', 'daily', 'free', 'yellow', 8.3, '职位与报价反映技能缺口；API 有限制。'),
      S('fiverr', 'Fiverr', 'https://www.fiverr.com', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['services', 'price'], 'html', 'daily', 'free', 'yellow', 8.0, '服务化需求与价格锚点；适合找可交付切口。'),
      S('linkedin', 'LinkedIn', 'https://www.linkedin.com', ['north-america', 'europe', 'mena'], ['hiring', 'network'], 'manual', 'daily', 'freemium', 'red', 8.6, '招聘信号强但 ToS 严格；只做人工浏览。'),
      S('boss-zhipin', 'BOSS 直聘', 'https://www.zhipin.com', ['china'], ['hiring', 'salary'], 'manual', 'weekly', 'freemium', 'yellow', 7.4, '中国招聘与薪资信号；人工观察。'),
      S('remoteok', 'RemoteOK', 'https://remoteok.com', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['remote', 'hiring'], 'rss', 'daily', 'free', 'green', 7.2, '远程岗位信号；RSS 免费。'),
    ],
  },
  {
    id: 'data', name: '数据与研究机构', desc: '统计机构、行业报告与开放数据集。',
    sources: [
      S('statista', 'Statista', 'https://www.statista.com', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['statistics', 'market'], 'manual', 'monthly', 'paid', 'yellow', 8.8, '现成图表多但需付费；引用时核对原始来源。'),
      S('world-bank', 'World Bank Open Data', 'https://data.worldbank.org', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['macro', 'development'], 'api', 'monthly', 'free', 'green', 8.5, '国家级宏观数据，开放 API。'),
      S('oecd', 'OECD Data', 'https://data.oecd.org', ['europe', 'north-america', 'east-asia'], ['macro', 'policy'], 'api', 'monthly', 'free', 'green', 8.0, '发达国家宏观与政策指标；免费 API。'),
      S('un-data', 'UN Data', 'https://data.un.org', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['demographics', 'trade'], 'api', 'monthly', 'free', 'green', 7.8, '人口、贸易与发展指标；口径需注意。'),
      S('owid', 'Our World in Data', 'https://ourworldindata.org', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['research', 'charts'], 'rss', 'weekly', 'free', 'green', 7.7, '长期趋势可视化与原始数据下载。'),
    ],
  },
  {
    id: 'platform', name: '平台规则与开放生态', desc: '平台新功能、政策变化、开发者生态与广告规则。',
    sources: [
      S('stripe-docs', 'Stripe Changelog', 'https://stripe.com/docs/changelog', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['api', 'payment'], 'rss', 'weekly', 'free', 'green', 8.2, '支付能力变化；做跨境收款必跟。'),
      S('shopify-changelog', 'Shopify Changelog', 'https://shopify.dev/changelog', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['commerce', 'api'], 'rss', 'weekly', 'free', 'green', 8.4, '电商平台新能力；应用与代运营机会来源。'),
      S('apple-rules', 'App Store Review Guidelines', 'https://developer.apple.com/app-store/review/guidelines', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['policy', 'app'], 'manual', 'monthly', 'free', 'green', 8.0, '应用审核规则；做 App 必读。'),
      S('google-ads-policy', 'Google Ads 政策更新', 'https://support.google.com/adspolicy/answer/6008942', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], ['ads', 'policy'], 'rss', 'weekly', 'free', 'green', 7.8, '广告政策变化；影响投放与合规。'),
      S('tiktok-shop', 'TikTok Shop 学院', 'https://seller.tiktokglobalshop.com', ['north-america', 'europe', 'sea'], ['commerce', 'platform'], 'manual', 'weekly', 'free', 'yellow', 7.6, '新站点与规则变化；跨境卖家必跟。'),
    ],
  },
]

const sourcesJson = {
  meta: {
    data_version: '0.1.0-mock', as_of: AS_OF, generator: 'app/scripts/mock-seed.mjs', mock: true,
    count: sourceCategories.reduce((a, c) => a + c.sources.length, 0),
  },
  categories: sourceCategories,
}

/* ============================ playbooks.json ============================ */
const playbooks = [
  {
    id: 'pb-complaint-mining', name: '抱怨挖掘：从 1–3 星评论里捞商机', purpose: '把高频抱怨转成可售卖的解决方案假设。',
    human_need_ids: ['ease', 'control'], emotion_ids: ['complaint', 'anxiety'], time_box_min: 45, frequency: 'weekly',
    platforms: ['amazon', 'trustpilot', 'reddit', 'app-store'],
    steps: ['选 3 个品类，各取 20 条 1–3 星评论', '按「现有方案哪里烂」聚类', '统计出现频次与情绪强度', '对每个聚类写出 1 句机会假设', '用搜索结果与竞品供给做初筛'],
    keywords: ['broken after', 'waste of money', 'customer service', "doesn't work", '太坑了'],
    output: '机会假设卡 × 5，每张含证据链接、频次、现有替代方案', quality_checks: ['至少 2 个独立平台交叉', '排除刷单/水军特征', '区分产品缺陷与需求缺口'],
  },
  {
    id: 'pb-trend-time-lag', name: '趋势时差扫描：美日韩 → 其他市场', purpose: '找同一需求在不同市场之间的滞后窗口。',
    human_need_ids: ['novelty', 'status'], emotion_ids: ['curiosity', 'envy'], time_box_min: 40, frequency: 'weekly',
    platforms: ['google-trends', 'tiktok', 'naver-datalab', 'pinterest-trends'],
    steps: ['选 3 个已在美/日/韩起量的关键词', '在 Google Trends 对比 5 个目标国家曲线', '标注起量时间差与搜索量级', '检查目标市场本地供给与价格带', '写下窗口剩余时间与进入动作'],
    keywords: ['vs', 'near me', 'alternative', 'how to'], output: '趋势时差表 × 1，含曲线截图与窗口判断', quality_checks: ['区分真实需求与媒体炒作', '确认目标市场语言/文化适配', '检查平台政策风险'],
  },
  {
    id: 'pb-marketplace-gap', name: '电商长尾缺口：搜索有、供给差', purpose: '用平台搜索结果与评价数找供需失衡品类。',
    human_need_ids: ['ease', 'status'], emotion_ids: ['complaint', 'aspiration'], time_box_min: 50, frequency: 'weekly',
    platforms: ['amazon', 'etsy', 'shopee', 'mercadolibre'],
    steps: ['选 1 个平台与 1 个区域', '抓 30 个长尾关键词的搜索建议', '记录 TOP10 结果的价格/评价/上新时间', '标记「需求存在但结果差」的词', '核算一件代发毛利'],
    keywords: ['gift for', 'best', 'custom', 'portable'], output: '候选品 × 10，含价格带、评论数、毛利测算', quality_checks: ['排除季节性单点', '确认无品牌垄断', '检查物流与合规限制'],
  },
  {
    id: 'pb-reddit-need-mining', name: 'Reddit 需求挖掘：子版块田野调查', purpose: '从社群原声提取高情绪强度需求。',
    human_need_ids: ['belonging', 'control'], emotion_ids: ['loneliness', 'anxiety', 'hope'], time_box_min: 40, frequency: 'twice-weekly',
    platforms: ['reddit', 'discord', 'quora'],
    steps: ['按主题列 15 个子版块', '搜 "how do I / I wish / recommend" 句式', '记录高赞求助帖与评论共识', '按需求/情绪/现有方案三列归类', '挑 3 个做 5 人小访谈'],
    keywords: ['how do I', 'I wish', 'any recommendations', 'is there a service'], output: '需求卡片 × 5，含原帖链接与评论摘录', quality_checks: ['样本去重', '区分美国中心偏差', '不抓取个人隐私'],
  },
  {
    id: 'pb-regulatory-watch', name: '监管变更雷达：新规即需求', purpose: '把法规变更转成企业刚需服务。',
    human_need_ids: ['survival', 'control'], emotion_ids: ['anxiety', 'fear'], time_box_min: 35, frequency: 'weekly',
    platforms: ['eur-lex', 'federal-register', 'gov-cn', 'cbp'],
    steps: ['订阅 3 个官方 RSS/邮件提醒', '筛出 90 天内生效的新规', '列出受影响的企业类型与义务', '评估第三方服务空间与资质要求', '写 1 页合规服务假设'],
    keywords: ['effective date', 'shall', 'compliance', 'registration'], output: '合规服务假设 × 3，含生效日、义务、客群', quality_checks: ['只引用官方原文', '标注核验日期', '不夸大处罚后果'],
  },
  {
    id: 'pb-patent-academic', name: '专利/论文商业化扫描', purpose: '找技术外溢后的产品化空窗。',
    human_need_ids: ['health', 'ease'], emotion_ids: ['hope', 'curiosity'], time_box_min: 60, frequency: 'monthly',
    platforms: ['arxiv', 'google-patents', 'papers-with-code', 'github-trending'],
    steps: ['选 1 个技术方向，检索近 2 年论文', '标记已有代码/样机的项目', '查专利到期与许可情况', '找现有产品未覆盖的场景', '评估个人可承担的工程成本'],
    keywords: ['open source', 'dataset', 'benchmark', 'commercial'], output: '技术机会卡 × 3，含成熟度与许可风险', quality_checks: ['区分实验室与可交付', '检查开源协议', '警惕论文营销'],
  },
  {
    id: 'pb-culture-calendar', name: '文化日历前置：节前 90 天布局', purpose: '用宗教/文化日历提前卡位礼赠与内容。',
    human_need_ids: ['meaning', 'belonging'], emotion_ids: ['devotion', 'love', 'nostalgia'], time_box_min: 30, frequency: 'monthly',
    platforms: ['islamic-calendar', 'google-trends', 'etsy', 'tiktok'],
    steps: ['列出未来 12 个月目标市场节日', '标注宗教禁忌与内容红线', '查节前搜索曲线与竞品上新', '确定设计/内容/备货时间点', '找本地顾问做文化审校'],
    keywords: ['gift', 'decoration', 'menu', 'greeting'], output: '节庆作战表 × 1，含时间轴与禁忌清单', quality_checks: ['本地人审校', '避免宗教符号滥用', '确认物流截单日'],
  },
  {
    id: 'pb-supply-price-arbitrage', name: '供应链价差扫描：同物不同价', purpose: '找供应链层级与区域之间的价差。',
    human_need_ids: ['ease', 'fairness'], emotion_ids: ['greed', 'complaint'], time_box_min: 50, frequency: 'weekly',
    platforms: ['1688', 'alibaba', 'freightos', 'amazon'],
    steps: ['选 1 个品类，记录 1688 出厂价', '对比目标平台售价与运费', '核算关税/平台佣金/退货成本', '找 3 家可小批量打样的工厂', '计算盈亏平衡销量'],
    keywords: ['MOQ', 'OEM', 'sample', 'FOB'], output: '价差测算表 × 1，含盈亏平衡点', quality_checks: ['核对含税与不含税价', '确认认证要求', '警惕侵权款式'],
  },
  {
    id: 'pb-community-infiltration', name: '社群黑话渗透：圈层需求字典', purpose: '进圈层，建立别人没有的需求词典。',
    human_need_ids: ['belonging', 'expression'], emotion_ids: ['identity', 'pride'], time_box_min: 45, frequency: 'weekly',
    platforms: ['discord', 'reddit', 'bilibili', 'line-openchat'],
    steps: ['挑 3 个高付费意愿圈层', '潜水 2 周记录黑话与痛点', '整理「圈内人才懂的 30 个词」', '找现有供给的鄙视链与替代品', '设计一个圈层专属 MVP'],
    keywords: ['术语', '圈内', '入坑', '避雷'], output: '圈层词典 × 1 + 产品假设 × 3', quality_checks: ['尊重社群规则', '不搬运私密内容', '区分伪需求'],
  },
  {
    id: 'pb-cross-border-localization', name: '跨境本地化找茬：截图即需求', purpose: '用本地化缺陷反推服务与产品机会。',
    human_need_ids: ['ease', 'status'], emotion_ids: ['complaint', 'shame'], time_box_min: 40, frequency: 'weekly',
    platforms: ['amazon', 'shopee', 'mercadolibre', 'app-store'],
    steps: ['下载 10 个目标市场 App/店铺', '记录翻译、支付、尺寸、宗教适配问题', '按「本地人用不了」严重度排序', '找可提供的本地化服务切口', '给 3 个卖家发改进建议换访谈'],
    keywords: ['translation', 'payment', 'size', 'halal'], output: '本地化问题清单 × 20 + 服务假设 × 3', quality_checks: ['找本地人确认', '避免文化傲慢', '核对平台规则'],
  },
  {
    id: 'pb-app-store-teardown', name: '应用商店差评拆解：付费点与流失点', purpose: '从差评找替代方案与订阅设计机会。',
    human_need_ids: ['ease', 'health'], emotion_ids: ['complaint', 'anxiety'], time_box_min: 35, frequency: 'weekly',
    platforms: ['app-store', 'product-hunt', 'g2'],
    steps: ['选 3 个垂类 App，各读 50 条差评', '按功能缺失/价格/稳定性归类', '标出用户已付费却不满的点', '设计一个更窄的替代方案', '用 1 页落地页测预约'],
    keywords: ['subscription', 'refund', 'crash', 'missing feature'], output: '窄切口产品假设 × 3 + 预约页 × 1', quality_checks: ['区分版本 bug 与结构缺陷', '检查平台抽成', '验证付费意愿'],
  },
  {
    id: 'pb-hiring-signal', name: '招聘信号反推：谁在扩张、缺什么', purpose: '从招聘与外包需求反推行业缺口。',
    human_need_ids: ['growth', 'status'], emotion_ids: ['aspiration', 'envy'], time_box_min: 30, frequency: 'weekly',
    platforms: ['linkedin', 'upwork', 'boss-zhipin', 'remoteok'],
    steps: ['选 3 个目标行业，导出近 30 天新岗位', '统计重复出现的技能与工具', '找「招不到人」的高频岗位', '评估培训/工具/外包供给机会', '访谈 3 位招聘负责人'],
    keywords: ['urgent', 'remote', 'contract', 'experience with'], output: '技能缺口表 × 1 + 供给机会 × 3', quality_checks: ['人工浏览遵守 ToS', '区分真招聘与广告', '核对薪资口径'],
  },
]

const playbooksJson = {
  meta: { data_version: '0.1.0-mock', as_of: AS_OF, generator: 'app/scripts/mock-seed.mjs', mock: true, count: playbooks.length },
  playbooks,
}

/* ============================ calendar.json ============================ */
const C = (date, end_date, name, region_ids, type, lead_time_days, themes, notes) => ({
  date, end_date, name, region_ids, type, lead_time_days, themes, notes,
})

const calendarEvents = [
  C('2026-11-08', null, '排灯节 Diwali', ['south-asia', 'sea'], 'religious', 60, ['礼赠', '灯饰', '甜食', '家居'], '印度教/锡克教/耆那教共同节庆；礼赠与家居装饰需求集中在节前 45 天。'),
  C('2026-11-11', null, '双十一购物节', ['china', 'sea'], 'shopping', 45, ['电商', '折扣', '物流'], '中国及东南亚跨境电商大促；提前锁定备货与海外仓。'),
  C('2026-11-26', null, '美国感恩节', ['north-america'], 'festival', 60, ['家居', '厨具', '礼赠', '食品'], '家庭聚会场景；黑五前哨，内容与备货需提前 2 个月。'),
  C('2026-11-27', null, '黑色星期五', ['north-america', 'europe', 'latam'], 'shopping', 60, ['电商', '折扣', '电子', '玩具'], '全年最大折扣窗口；注意平台比价与库存周转。'),
  C('2026-11-30', null, '网络星期一', ['north-america', 'europe'], 'shopping', 55, ['电商', '数字产品'], '线上消费延续黑五热度；数字课程/软件订阅适合此节点。'),
  C('2026-12-05', '2026-12-13', '光明节 Hanukkah', ['north-america', 'europe'], 'religious', 45, ['礼赠', '烛台', '家庭'], '犹太教节庆；礼赠与家庭用品需求集中，注意文化尊重。'),
  C('2026-12-25', null, '圣诞节', ['north-america', 'europe', 'oceania', 'latam'], 'religious', 90, ['礼赠', '装饰', '食品', '玩具'], '全球最大礼赠季；跨境物流截单日通常为节前 30–45 天。'),
  C('2026-12-26', null, '节礼日 Boxing Day', ['europe', 'oceania'], 'shopping', 60, ['折扣', '电商', '体育'], '英联邦国家促销节点；清库存与运动品类机会。'),
  C('2026-12-26', '2027-01-01', '宽扎节 Kwanzaa', ['north-america'], 'festival', 40, ['文化', '礼赠', '家居'], '非裔美国人文化节庆；文化类内容与手工艺品有空间。'),
  C('2027-01-01', null, '元旦', ['north-america', 'europe', 'east-asia', 'sea', 'latam'], 'festival', 30, ['计划', '健身', '订阅'], '新年目标消费（健身/学习/理财）窗口；订阅类产品重点。'),
  C('2027-01-06', null, '主显节 Epiphany', ['europe', 'latam'], 'religious', 30, ['礼赠', '食品'], '西班牙/拉美「三王节」礼赠高峰；玩具与糖果需求集中。'),
  C('2027-02-06', null, '春节 Chinese New Year', ['china', 'sea', 'east-asia'], 'religious', 75, ['礼赠', '食品', '服饰', '家居'], '中国及东亚最重要节庆；工厂停工与物流停发需提前排期。'),
  C('2027-02-14', null, '情人节', ['north-america', 'europe', 'latam', 'east-asia'], 'festival', 45, ['礼赠', '鲜花', '珠宝', '餐饮'], '礼赠与体验消费；跨境需注意鲜花与食品检疫。'),
  C('2027-02-17', '2027-03-19', '斋月 Ramadan', ['mena', 'sea', 'africa'], 'religious', 90, ['礼赠', '食品', '家居', '服饰', '夜间消费'], '白天消费收缩、夜间消费扩张；营销素材避免饮食/亲密场景。'),
  C('2027-03-20', null, '开斋节 Eid al-Fitr', ['mena', 'sea', 'africa'], 'religious', 90, ['礼赠', '服饰', '食品', '家居'], '斋月结束后的消费高峰；礼赠与企业福利采购集中。'),
  C('2027-03-21', null, '诺鲁孜节 Nowruz', ['mena', 'cis'], 'religious', 45, ['礼赠', '家居', '食品'], '波斯新年（中亚/伊朗）；家居与甜食礼赠需求。'),
  C('2027-03-22', null, '洒红节 Holi', ['south-asia'], 'religious', 30, ['节庆', '美妆', '服饰'], '印度色彩节；美妆与服饰短期需求，注意宗教敏感性。'),
  C('2027-03-28', null, '复活节 Easter', ['europe', 'north-america', 'latam', 'oceania'], 'religious', 60, ['礼赠', '巧克力', '家居', '儿童'], '春季最大节庆之一；食品与儿童礼赠需求集中。'),
  C('2027-04-15', null, '美国报税截止日', ['north-america'], 'tax', 60, ['财税', '软件', '咨询'], '个人与企业报税刚需；财税工具/服务在 1–4 月集中获客。'),
  C('2027-04-13', '2027-04-15', '泰国宋干节 Songkran', ['sea'], 'festival', 45, ['旅游', '防水', '服饰'], '泼水节与旅游旺季；防水用品与本地服务机会。'),
  C('2027-05-09', null, '母亲节（多国）', ['north-america', 'europe', 'latam', 'oceania'], 'festival', 45, ['礼赠', '鲜花', '餐饮', '珠宝'], '礼赠高峰；不同国家日期不同，需按市场排期。'),
  C('2027-05-26', null, '宰牲节 Eid al-Adha', ['mena', 'sea', 'africa'], 'religious', 75, ['礼赠', '食品', '服饰', '慈善'], '朝觐季与家庭聚会；食品与礼赠需求集中。'),
  C('2027-06-01', '2027-06-30', '骄傲月 Pride Month', ['north-america', 'europe'], 'festival', 60, ['服饰', '内容', '社群'], 'LGBTQ+ 主题内容与商品；注意品牌真诚度与文化风险。'),
  C('2027-06-18', null, '618 购物节', ['china', 'sea'], 'shopping', 45, ['电商', '折扣', '家电'], '中国年中大促；跨境卖家可借势东南亚站点。'),
  C('2027-07-13', null, 'Amazon Prime Day（预计）', ['north-america', 'europe', 'east-asia'], 'shopping', 60, ['电商', '电子', '家居'], '平台大促的具体日期以官方公告为准；备货与广告需提前 6 周。'),
  C('2027-08-15', null, '回校季 Back to School', ['north-america', 'europe'], 'school', 90, ['文具', '电子', '服饰', '学习'], '欧美返校采购季；从 7 月中旬开始放量，提前 90 天备货。'),
  C('2027-09-15', null, '中秋节', ['china', 'east-asia', 'sea'], 'religious', 60, ['礼赠', '食品', '茶', '家居'], '华语市场礼赠高峰；食品跨境需注意检疫与保质期。'),
  C('2027-09-30', null, '中国国庆黄金周', ['china'], 'national', 45, ['旅游', '本地生活', '消费'], '中国旅游与本地消费高峰；文旅与体验类机会。'),
  C('2027-10-01', null, '德国统一日 / 欧洲秋季展季', ['europe'], 'national', 60, ['B2B', '展会', '工业'], '欧洲 Q4 展会与采购季；工业品与 B2B 服务获客窗口。'),
  C('2027-11-25', null, '美国感恩节（2027）', ['north-america'], 'festival', 60, ['家居', '厨具', '礼赠'], '年度家庭聚会；与黑五形成连续消费窗口。'),
]

const calendarJson = {
  meta: { data_version: '0.1.0-mock', as_of: AS_OF, generator: 'app/scripts/mock-seed.mjs', mock: true, count: calendarEvents.length },
  events: calendarEvents,
}

/* ============================ 导出 ============================ */
export function generateMockData() {
  return {
    'taxonomy.json': mockTaxonomy,
    'opportunities.json': {
      meta: {
        data_version: '0.1.0-mock', as_of: AS_OF, generator: 'app/scripts/mock-seed.mjs', mock: true,
        count: opportunities.length, note: '演示占位数据，真实数据由 data-engineer 产出',
      },
      opportunities,
    },
    'rankings.json': buildRankings(opportunities),
    'stats.json': buildStats(opportunities),
    'sources.json': sourcesJson,
    'playbooks.json': playbooksJson,
    'calendar.json': calendarJson,
  }
}
