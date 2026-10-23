import candidatesJson from '@/data/candidates.json'
import candidateRankingsJson from '@/data/candidate-rankings.json'
import type { WindowKey } from '@/types'

export interface CandidateSource {
  id?: string
  name?: string
  url?: string
  published_at?: string
  summary?: string
  cleaned?: string
  raw_title?: string
}

export interface CandidateEvidence {
  title?: string
  url?: string
  publisher?: string
  date?: string
}

export interface CandidateRoi {
  capital_cny?: { min?: number; max?: number }
  time_to_revenue_months?: number
  payback_months?: number
  monthly_revenue_cny?: { min?: number; max?: number }
  gross_margin_pct?: number
}

export interface SystemValidationCheck {
  id?: string
  name?: string
  passed?: boolean
  note?: string
}

export interface SystemValidation {
  level: 'high' | 'medium' | 'low' | string
  score: number
  checks: SystemValidationCheck[]
  notes?: string
}

export interface CandidateTranslation {
  provider?: string
  quality?: string
  cached?: boolean
  source_lang?: string
  target_lang?: string
  template?: boolean
}

export interface Candidate {
  candidate_id: string
  title: string
  title_zh?: string
  title_original?: string
  one_liner_zh?: string
  summary_zh?: string
  translation_method?: string
  translation?: CandidateTranslation
  one_liner: string
  industry_ids: string[]
  primary_industry?: string
  gap_type_ids: string[]
  region_ids: string[]
  target_countries: string[]
  source: CandidateSource
  evidence: CandidateEvidence[]
  seven_questions: Record<string, string> | Array<{ question?: string; answer?: string; key?: string; value?: string }>
  roi: CandidateRoi
  scores: { total: number; rank_score: number; grade: string; dimensions?: Record<string, number> }
  confidence: number
  status: string
  verification_status: string
  system_validation?: SystemValidation
  verified_by_system?: boolean
  first_seen: string
  last_seen: string
  disclaimer: string
  gap_inference?: string
  gap_inferred?: boolean
  region_inferred?: boolean
  business_canvas?: Record<string, unknown>
  judgment?: Record<string, unknown>
  competition?: Record<string, unknown>
  cross_market?: Record<string, unknown>
  timing?: Record<string, unknown>
  conditions?: Record<string, unknown>
  barriers?: Record<string, unknown>
  profit_model?: Record<string, unknown>
  execution_plan?: Record<string, unknown>
  /** v1.5.0 理论测算字段（真实字段优先，缺失时前端确定性派生） */
  investment_breakdown?: Record<string, unknown>
  unit_economics?: Record<string, unknown>
  analyst_narrative?: Record<string, unknown>
  eval_sources?: unknown
  raw?: Record<string, unknown>
}

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)
const str = (x: unknown, fallback = '') => (typeof x === 'string' ? x : fallback)
const num = (x: unknown, fallback = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : fallback)
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
const strs = (x: unknown): string[] => arr(x).filter((v): v is string => typeof v === 'string')

function normalizeScores(raw: unknown): Candidate['scores'] {
  if (isObj(raw)) {
    const dims = isObj(raw.dimensions) ? Object.fromEntries(Object.entries(raw.dimensions).map(([k, v]) => [k, num(v)])) : undefined
    return { total: num(raw.total), rank_score: num(raw.rank_score, num(raw.total)), grade: str(raw.grade, '—'), dimensions: dims }
  }
  const total = num(raw)
  return { total, rank_score: total, grade: total >= 80 ? 'A' : total >= 70 ? 'B' : 'C' }
}

function normalizeRoi(raw: unknown): CandidateRoi {
  if (!isObj(raw)) return {}
  const cap = isObj(raw.capital_cny)
    ? { min: num(raw.capital_cny.min), max: num(raw.capital_cny.max) }
    : raw.capital_min != null || raw.capital_max != null
      ? { min: num(raw.capital_min), max: num(raw.capital_max) }
      : undefined
  const monthly = isObj(raw.monthly_revenue_cny)
    ? { min: num(raw.monthly_revenue_cny.min), max: num(raw.monthly_revenue_cny.max) }
    : raw.monthly_revenue_min != null || raw.monthly_revenue_max != null
      ? { min: num(raw.monthly_revenue_min), max: num(raw.monthly_revenue_max) }
      : undefined
  return {
    capital_cny: cap,
    time_to_revenue_months: raw.time_to_revenue_months == null ? undefined : num(raw.time_to_revenue_months),
    payback_months: raw.payback_months == null ? undefined : num(raw.payback_months),
    monthly_revenue_cny: monthly,
    gross_margin_pct: raw.gross_margin_pct != null ? num(raw.gross_margin_pct) : raw.gross_margin_min != null ? num(raw.gross_margin_min) : undefined,
  }
}

function normalizeCandidate(raw: unknown, index = 0): Candidate | null {
  if (!isObj(raw)) return null
  const id = str(raw.candidate_id, str(raw.id, `candidate-${index + 1}`))
  const title = str(raw.title)
  if (!title) return null
  const sourceRaw = isObj(raw.source) ? raw.source : {}
  const evidence = arr(raw.evidence).filter(isObj).map((e) => ({ title: str(e.title), url: str(e.url), publisher: str(e.publisher), date: str(e.date) }))
  if (!evidence.length && str(sourceRaw.url)) evidence.push({ title: str(sourceRaw.name, title), url: str(sourceRaw.url), publisher: str(sourceRaw.name), date: '' })
  const seven = isObj(raw.seven_questions)
    ? Object.fromEntries(Object.entries(raw.seven_questions).map(([k, v]) => [k, typeof v === 'string' ? v : isObj(v) ? str(v.answer, str(v.value)) : String(v)]))
    : arr(raw.seven_questions).map((q, i) => ({ key: str((q as Obj)?.key, `q${i + 1}`), value: str((q as Obj)?.value, str((q as Obj)?.answer)) }))
  const scores = normalizeScores(raw.scores)
  const svRaw = isObj(raw.system_validation) ? raw.system_validation : {}
  const level = str(svRaw.level, scores.total >= 75 ? 'high' : scores.total >= 65 ? 'medium' : 'low')
  const systemValidation: SystemValidation = {
    level,
    score: num(svRaw.score, scores.total),
    checks: arr(svRaw.checks).filter(isObj).map((c) => ({ id: str(c.id), name: str(c.name), passed: c.passed === true, note: str(c.note) })),
    notes: str(svRaw.notes),
  }
  return {
    candidate_id: id,
    title,
    title_zh: str(raw.title_zh),
    title_original: str(raw.title_original),
    one_liner_zh: str(raw.one_liner_zh),
    summary_zh: str(raw.summary_zh),
    translation_method: str(raw.translation_method),
    translation: isObj(raw.translation) ? {
      provider: str(raw.translation.provider),
      quality: str(raw.translation.quality),
      cached: raw.translation.cached === true,
      source_lang: str(raw.translation.source_lang),
      target_lang: str(raw.translation.target_lang),
      template: raw.translation.template === true,
    } : undefined,
    one_liner: str(raw.one_liner, str(raw.summary)),
    industry_ids: strs(raw.industry_ids),
    primary_industry: str(raw.primary_industry),
    gap_type_ids: strs(raw.gap_type_ids),
    region_ids: strs(raw.region_ids),
    target_countries: strs(raw.target_countries),
    source: { id: str(sourceRaw.id), name: str(sourceRaw.name), url: str(sourceRaw.url), published_at: str(sourceRaw.published_at), summary: str(sourceRaw.summary), cleaned: str(sourceRaw.cleaned), raw_title: str(sourceRaw.raw_title) },
    evidence,
    seven_questions: seven,
    roi: normalizeRoi(raw.roi),
    scores,
    confidence: num(raw.confidence, 60),
    status: str(raw.status, 'auto-discovered'),
    verification_status: str(raw.verification_status, 'not_started'),
    system_validation: systemValidation,
    verified_by_system: raw.verified_by_system !== false,
    first_seen: str(raw.first_seen),
    last_seen: str(raw.last_seen, str(raw.first_seen)),
    disclaimer: str(raw.disclaimer, '自动发现候选，未经验证，仅作研究线索，不构成投资建议。'),
    gap_inference: str(raw.gap_inference) || (isObj(raw.gap_inference) ? JSON.stringify(raw.gap_inference) : ''),
    gap_inferred: raw.gap_inferred === true,
    region_inferred: raw.region_inferred === true,
    business_canvas: isObj(raw.business_canvas) ? raw.business_canvas : undefined,
    judgment: isObj(raw.judgment) ? raw.judgment : undefined,
    competition: isObj(raw.competition) ? raw.competition : undefined,
    cross_market: isObj(raw.cross_market) ? raw.cross_market : undefined,
    timing: isObj(raw.timing) ? raw.timing : undefined,
    conditions: isObj(raw.conditions) ? raw.conditions : undefined,
    barriers: isObj(raw.barriers) ? raw.barriers : undefined,
    profit_model: isObj(raw.profit_model) ? raw.profit_model : undefined,
    execution_plan: isObj(raw.execution_plan) ? raw.execution_plan : undefined,
    analyst_narrative: isObj(raw.analyst_narrative) ? raw.analyst_narrative : undefined,
    investment_breakdown: isObj(raw.investment_breakdown) ? raw.investment_breakdown : undefined,
    unit_economics: isObj(raw.unit_economics) ? raw.unit_economics : undefined,
    eval_sources: raw.sources ?? raw.eval_sources,
    raw,
  }
}

const rawCandidates = candidatesJson as unknown as Obj
const candidateList = arr(rawCandidates.candidates ?? (rawCandidates as unknown as unknown[]))
export const candidatesMeta = isObj(rawCandidates.meta) ? rawCandidates.meta : {}
export const candidates: Candidate[] = candidateList.map((x, i) => normalizeCandidate(x, i)).filter((x): x is Candidate => !!x)
export const candidateById = new Map(candidates.map((c) => [c.candidate_id, c]))

const rawRankings = candidateRankingsJson as unknown as Obj
export const candidateRankingsMeta = isObj(rawRankings.meta) ? rawRankings.meta : {}
export const candidateRankings = isObj(rawRankings.windows) ? (rawRankings.windows as Record<string, Obj>) : {}

/** v0.9.1：gap 推断覆盖率；优先读 meta.gap_inference_coverage，缺失时按候选计算。 */
export const gapInferenceCoverage = (() => {
  const metaCoverage = isObj(candidatesMeta.gap_inference_coverage) ? candidatesMeta.gap_inference_coverage : null
  const inferred = metaCoverage ? num(metaCoverage.inferred, candidates.filter((c) => c.gap_type_ids.length > 0).length) : candidates.filter((c) => c.gap_type_ids.length > 0).length
  const total = metaCoverage ? num(metaCoverage.total, candidates.length) : candidates.length
  const missing = metaCoverage ? num(metaCoverage.missing, total - inferred) : total - inferred
  return { inferred, total, missing, ratio: total ? inferred / total : 0 }
})()

/** v0.9.3 系统翻译摘要（无 meta 时回退 glossary 推断）。 */
export const translationSummary = (() => {
  const raw = isObj(candidatesMeta.translation_summary) ? candidatesMeta.translation_summary : null
  return {
    provider: str(raw?.provider, 'glossary'),
    total: num(raw?.total, candidates.length),
    cached: num(raw?.cached, 0),
    qualityHigh: num(raw?.quality_high, 0),
    qualityMedium: num(raw?.quality_medium, 0),
    qualityLow: num(raw?.quality_low, 0),
    sourceZh: num(raw?.source_zh, 0),
    glossary: num(raw?.glossary, candidates.length),
    llm: num(raw?.llm, 0),
  }
})()

export function candidateWindowItems(key: WindowKey): Array<{ candidate: Candidate; rank: number; item: Obj }> {
  const window = candidateRankings[key]
  const items = arr(window?.items).filter(isObj)
  const rows: Array<{ candidate: Candidate; rank: number; item: Obj }> = []
  for (const [i, item] of items.entries()) {
    const direct = isObj(item.candidate) ? normalizeCandidate(item.candidate, i) : null
    const byId = candidateById.get(str(item.candidate_id, str(item.id))) || null
    const candidate = byId || direct
    if (!candidate) continue
    rows.push({ candidate, rank: num(item.rank, i + 1), item })
  }
  return rows.sort((a, b) => a.rank - b.rank)
}

export function candidateTodayCount(asOf: string): number {
  const metaCount = num(candidatesMeta.today_new, -1)
  if (metaCount >= 0) return metaCount
  const dayCount = arr(candidateRankings.day?.items).length
  if (dayCount > 0) return dayCount
  return candidates.filter((c) => c.first_seen === asOf).length
}

export const candidatesAvailable = candidates.length > 0
