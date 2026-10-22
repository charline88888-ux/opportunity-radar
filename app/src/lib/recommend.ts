import type { Opportunity } from '@/types'
import { opportunities } from './data'
import { capitalCap, profileToCapability, type CapabilityVector, type Profile } from './profile'
import { clamp, round1 } from './utils'

/**
 * 机会需求向量与个性化推荐（docs/04 §5，v0.3.0 前端实现）
 * - 7 维：capital / time / tech / content / supply / english / risk（0–10）
 * - 硬约束：资金不足 / 需资质 / 需供应链 / 英语弱
 * - fit = 加权匹配度（0–1）；rec_score = 0.6 × total + 0.4 × fit × 100
 * - 排序：MMR（λ=0.7）做多样性 + Top10 行业/区域/信息差配额
 */

export type CapabilityKey = keyof CapabilityVector

export interface DemandVector extends CapabilityVector {}

export interface HardConstraint {
  id: 'capital' | 'license' | 'supply' | 'english'
  label: string
  detail: string
}

export interface RecommendationRow {
  opp: Opportunity
  rank: number
  demand: DemandVector
  match: number
  fit: number
  recScore: number
  hardConstraints: HardConstraint[]
  reasons: { positive: string; caution: string }
}

export const CAPABILITY_KEYS: CapabilityKey[] = ['capital', 'time', 'tech', 'content', 'supply', 'english', 'risk']

export const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  capital: '资金',
  time: '时间',
  tech: '技术',
  content: '内容',
  supply: '供应链',
  english: '英语',
  risk: '风险承受',
}

/** 软匹配权重（docs/04 §5.3；按本版 7 维调整后归一为 1.00） */
export const FIT_WEIGHTS: Record<CapabilityKey, number> = {
  capital: 0.2,
  time: 0.15,
  tech: 0.15,
  content: 0.1,
  supply: 0.15,
  english: 0.1,
  risk: 0.15,
}

export const HARD_CONSTRAINT_RULES = {
  /** 机会资金需求比用户能力高出 2 分以上 → 不现实（docs/04 §5.3） */
  CAPITAL_GAP: 2,
  /** 供应链技能低于 4/10 且机会需要供应链 → 交付不了 */
  MIN_SUPPLY: 4,
  /** 英语能力低于 4/10 且机会是纯英语/非中文市场 → 无法验证 */
  MIN_ENGLISH: 4,
  /** 风险偏好低于 4/10 且机会 risk 维度 < 4 → 风险不匹配（解释用，不硬过滤） */
  RISK_FLOOR: 4,
} as const

export const MMR_LAMBDA = 0.7
export const MMR_TOP_QUOTA = 10
export const REC_WEIGHT_TOTAL = 0.6
export const REC_WEIGHT_FIT = 0.4

const CHINESE_COUNTRY = /中国|香港|台湾|澳门/
const ENGLISH_COUNTRY = /美国|英国|加拿大|澳大利亚|新西兰|爱尔兰|新加坡/
const NON_GENERIC_LANGS = new Set(['ar', 'ja', 'ko', 'vi', 'th', 'id', 'ms', 'tr', 'ru', 'hi', 'ur', 'pt', 'es', 'fr', 'de', 'it', 'he', 'fa'])

function capitalNeed(opp: Opportunity): number {
  const c = opp.roi.capital_cny.min
  if (c < 3000) return 2
  if (c < 10000) return 4
  if (c < 30000) return 6
  if (c < 100000) return 8
  return 10
}

function timeNeed(opp: Opportunity): number {
  if (opp.roi.team_size >= 3) return 10
  if (opp.roi.effort_level === 'full') return 8
  if (opp.roi.effort_level === 'side') return 5
  return 3
}

function techNeed(opp: Opportunity): number {
  if (opp.industry_id === 'ai') return 9
  if (opp.tags.includes('tech-driven') || opp.tags.includes('ai-native')) return 8
  if (opp.tags.includes('needs-license')) return 6
  if (opp.tags.includes('platform-dependent')) return 5
  return 3
}

function contentNeed(opp: Opportunity): number {
  if (opp.tags.includes('content-driven')) return 8
  if (opp.tags.includes('localization-heavy')) return 7
  if (['content', 'gaming', 'emotional', 'culture'].includes(opp.industry_id)) return 6
  return 4
}

function supplyNeed(opp: Opportunity): number {
  let need = 3
  if (opp.tags.includes('needs-supply-chain')) need = 7
  if (opp.tags.includes('china-advantage')) need = Math.max(need, 7)
  if (opp.tags.includes('physical')) need = Math.max(need, 5)
  if (opp.tags.includes('digital') && !opp.tags.includes('physical') && !opp.tags.includes('needs-supply-chain')) need = 2
  return need
}

function isChineseMarket(opp: Opportunity): boolean {
  const hasChinaRegion = opp.region_ids.includes('china')
  const allTargetsChinese = opp.target_countries.length > 0 && opp.target_countries.every((c) => CHINESE_COUNTRY.test(c))
  return hasChinaRegion && (allTargetsChinese || opp.source_langs.every((l) => l === 'zh'))
}

function isEnglishMarket(opp: Opportunity): boolean {
  if (opp.source_langs.some((l) => l === 'en')) return true
  if (opp.region_ids.some((r) => ['north-america', 'europe', 'oceania'].includes(r))) return true
  return opp.target_countries.some((c) => ENGLISH_COUNTRY.test(c))
}

function englishNeed(opp: Opportunity): number {
  if (isChineseMarket(opp)) return 2
  if (opp.industry_id === 'culture' && opp.tags.includes('localization-heavy')) return 9
  if (opp.source_langs.some((l) => NON_GENERIC_LANGS.has(l.toLowerCase()))) return 8
  if (isEnglishMarket(opp)) return 5
  return 6
}

function riskNeed(opp: Opportunity): number {
  return clamp(Math.round(11 - (opp.scores.dimensions.risk || 5)), 2, 10)
}

/** 机会需求向量（由机会字段推导，docs/04 §5.2） */
export function demandVector(opp: Opportunity): DemandVector {
  return {
    capital: capitalNeed(opp),
    time: timeNeed(opp),
    tech: techNeed(opp),
    content: contentNeed(opp),
    supply: supplyNeed(opp),
    english: englishNeed(opp),
    risk: riskNeed(opp),
  }
}

/** 硬约束标记（资金不足 / 需资质 / 需供应链 / 英语弱） */
export function hardConstraintsFor(profile: Profile, opp: Opportunity, demand = demandVector(opp)): HardConstraint[] {
  const cap = profileToCapability(profile)
  const constraints: HardConstraint[] = []
  if (cap.capital + HARD_CONSTRAINT_RULES.CAPITAL_GAP < demand.capital) {
    constraints.push({
      id: 'capital',
      label: '资金不足',
      detail: `该机会启动资金约 ${opp.roi.capital_cny.min}–${opp.roi.capital_cny.max} 元，超出你的资金档位（差 2 分以上）。`,
    })
  }
  if (opp.tags.includes('needs-license') && !profile.hasLicensePartner) {
    constraints.push({
      id: 'license',
      label: '需资质/持牌',
      detail: '该机会需要资质、牌照或持牌合作方；画像中未勾选「有持牌/资质伙伴」。',
    })
  }
  if (opp.tags.includes('needs-supply-chain') && cap.supply < HARD_CONSTRAINT_RULES.MIN_SUPPLY) {
    constraints.push({
      id: 'supply',
      label: '需供应链',
      detail: '该机会需要稳定货源/工厂/履约能力，当前供应链能力不足以交付。',
    })
  }
  if (cap.english < HARD_CONSTRAINT_RULES.MIN_ENGLISH && demand.english >= 5 && !isChineseMarket(opp)) {
    constraints.push({
      id: 'english',
      label: '英语弱',
      detail: '目标市场以英语/非中文为主，英语能力不足会增加验证与沟通成本。',
    })
  }
  return constraints
}

function ratioScore(user: number, need: number): number {
  return clamp((10 * user) / Math.max(need, 1), 0, 10)
}

/** 计算单条机会的 fit（0–1）、match（0–10）、rec_score 与解释 */
export function scoreOpportunity(profile: Profile, opp: Opportunity): Omit<RecommendationRow, 'rank'> {
  const cap = profileToCapability(profile)
  const demand = demandVector(opp)
  let weighted = 0
  let weightSum = 0
  for (const key of CAPABILITY_KEYS) {
    weighted += FIT_WEIGHTS[key] * ratioScore(cap[key], demand[key])
    weightSum += FIT_WEIGHTS[key]
  }
  const match = round1(weighted / Math.max(weightSum, 0.0001))
  const fit = Math.round((match / 10) * 1000) / 1000
  const recScore = round1(REC_WEIGHT_TOTAL * opp.scores.total + REC_WEIGHT_FIT * fit * 100)
  const hardConstraints = hardConstraintsFor(profile, opp, demand)

  const rankedDims = CAPABILITY_KEYS.map((key) => ({
    key,
    ratio: ratioScore(cap[key], demand[key]),
    user: cap[key],
    need: demand[key],
  })).sort((a, b) => b.ratio - a.ratio)
  const strengths = rankedDims.filter((x) => x.ratio >= 7.5).slice(0, 2)
  const gaps = rankedDims.filter((x) => x.ratio < 7).sort((a, b) => a.ratio - b.ratio).slice(0, 2)

  const positiveParts = strengths.length
    ? strengths.map((x) => `${CAPABILITY_LABELS[x.key]}（你 ${x.user.toFixed(1)} / 需求 ${x.need}）`)
    : rankedDims.slice(0, 1).map((x) => `${CAPABILITY_LABELS[x.key]}（你 ${x.user.toFixed(1)} / 需求 ${x.need}）接近达标`)
  const gapPart = hardConstraints.length
    ? `硬约束未满足：${hardConstraints.map((c) => c.label).join('、')}`
    : gaps.length
      ? `主要缺口在${gaps.map((x) => `${CAPABILITY_LABELS[x.key]}（${(x.ratio * 10).toFixed(0)}% 覆盖）`).join('、')}`
      : '各项能力基本覆盖需求，仍需用小成本验证真实付费'
  const nextStep = opp.first_steps_7d[0] || '先用最小成本跑一次验证'
  const primaryGap = opp.gap_type_ids[0] || ''

  const positive = `【为什么推荐】你的${positiveParts.join('、')}与该机会需求匹配；机会总分 ${opp.scores.total.toFixed(1)}（${opp.scores.grade} 级），主要靠「${primaryGap}」类信息差，窗口状态 ${opp.window.status}、剩余约 ${opp.window.months_left} 个月（模型估算，建议复核）。`
  const caution = `【注意】${gapPart}；${hardConstraints.length ? '默认不会进入「为你推荐」候选，可在榜单中切换「显示硬约束」查看。' : `7 天内建议先做：${nextStep}`}`

  return { opp, demand, match, fit, recScore, hardConstraints, reasons: { positive, caution } }
}

/** 单条机会的 fit（供预警中心/详情页使用） */
export function fitForOpportunity(profile: Profile | null, opp: Opportunity): number | null {
  if (!profile) return null
  return scoreOpportunity(profile, opp).fit
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a)
  const B = new Set(b)
  if (!A.size && !B.size) return 0
  let inter = 0
  A.forEach((x) => {
    if (B.has(x)) inter += 1
  })
  return inter / (A.size + B.size - inter || 1)
}

function similarity(a: Opportunity, b: Opportunity): number {
  const industrySim = a.industry_id === b.industry_id ? 1 : 0
  const regionSim = jaccard(a.region_ids, b.region_ids)
  const gapSim = jaccard(a.gap_type_ids, b.gap_type_ids)
  return (industrySim + regionSim + gapSim) / 3
}

export interface RecommendOptions {
  source?: Opportunity[]
  limit?: number
  includeHard?: boolean
  lambda?: number
  /** v0.3.1：按资金档位上限（CNY）严格过滤，而不是只看 0–10 分差 */
  strictCapital?: boolean
}

export interface RecommendResult {
  rows: RecommendationRow[]
  filteredByHard: number
  /** 严格资金过滤开启时被 CNY 上限过滤掉的数量 */
  filteredByStrictCapital: number
  candidateCount: number
}

/** MMR 多样性排序：λ=0.7，Top10 内同行业 ≤2、同主区域 ≤3、同主信息差 ≤3 */
export function recommendOpportunities(profile: Profile, options: RecommendOptions = {}): RecommendResult {
  const { source = opportunities, limit, includeHard = false, lambda = MMR_LAMBDA, strictCapital = false } = options
  const capLimit = capitalCap(profile)
  const all = source
    .filter((opp) => opp.window.status !== 'closed')
    .map((opp) => scoreOpportunity(profile, opp))
  const filteredByStrictCapital = strictCapital
    ? all.filter((x) => x.opp.roi.capital_cny.min > capLimit).length
    : 0
  const afterStrict = strictCapital ? all.filter((x) => x.opp.roi.capital_cny.min <= capLimit) : all
  const filteredByHard = afterStrict.filter((x) => x.hardConstraints.length > 0).length
  const pool = includeHard ? afterStrict : afterStrict.filter((x) => x.hardConstraints.length === 0)
  const maxRec = Math.max(...pool.map((x) => x.recScore), 1)
  const selected: RecommendationRow[] = []
  const remaining = [...pool]
  const industryCount = new Map<string, number>()
  const regionCount = new Map<string, number>()
  const gapCount = new Map<string, number>()
  const target = Math.min(limit ?? 10, pool.length)

  while (selected.length < target && remaining.length) {
    const quotaActive = selected.length < MMR_TOP_QUOTA
    let bestIndex = -1
    let bestScore = -Infinity
    for (let i = 0; i < remaining.length; i += 1) {
      const cand = remaining[i]
      if (quotaActive) {
        const primaryRegion = cand.opp.region_ids[0] || ''
        const primaryGap = cand.opp.gap_type_ids[0] || ''
        if ((industryCount.get(cand.opp.industry_id) || 0) >= 2) continue
        if ((regionCount.get(primaryRegion) || 0) >= 3) continue
        if ((gapCount.get(primaryGap) || 0) >= 3) continue
      }
      const rel = cand.recScore / maxRec
      const maxSim = selected.length ? Math.max(...selected.map((s) => similarity(cand.opp, s.opp))) : 0
      const mmr = lambda * rel - (1 - lambda) * maxSim
      if (mmr > bestScore) {
        bestScore = mmr
        bestIndex = i
      }
    }
    // 配额导致无候选时放宽配额再选一次
    if (bestIndex < 0) {
      let fallbackScore = -Infinity
      remaining.forEach((cand, i) => {
        const rel = cand.recScore / maxRec
        const maxSim = selected.length ? Math.max(...selected.map((s) => similarity(cand.opp, s.opp))) : 0
        const mmr = lambda * rel - (1 - lambda) * maxSim
        if (mmr > fallbackScore) {
          fallbackScore = mmr
          bestIndex = i
        }
      })
    }
    const [chosen] = remaining.splice(bestIndex, 1)
    if (!chosen) break
    selected.push({ ...chosen, rank: selected.length + 1 })
    const primaryRegion = chosen.opp.region_ids[0] || ''
    const primaryGap = chosen.opp.gap_type_ids[0] || ''
    industryCount.set(chosen.opp.industry_id, (industryCount.get(chosen.opp.industry_id) || 0) + 1)
    regionCount.set(primaryRegion, (regionCount.get(primaryRegion) || 0) + 1)
    gapCount.set(primaryGap, (gapCount.get(primaryGap) || 0) + 1)
  }

  return { rows: selected, filteredByHard, filteredByStrictCapital, candidateCount: pool.length }
}

/** 推荐 Top N（Dashboard / 快捷入口）；自动遵循画像中的严格资金过滤开关 */
export function recommendTop(profile: Profile | null, n = 3): RecommendationRow[] {
  if (!profile) return []
  return recommendOpportunities(profile, { limit: n, strictCapital: profile.strictCapital }).rows
}
