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

export interface CandidateEvidenceRef {
  title: string
  url?: string
}

/** v1.8.0：信息价值 5 维（0–10 统一归一） */
export interface CandidateInformationValue {
  score: number | null
  dimensions: Array<{ key: string; value: number }>
}

/** v1.8.0：关键事实 / 推断 */
export interface CandidateKeyFact {
  text: string
  type: 'fact' | 'inference'
  sourceTitle?: string
  sourceUrl?: string
}

/** v1.8.0：证据质量（来源数/独立性/权威/时效/评分） */
export interface CandidateEvidenceQuality {
  sourceCount: number | null
  independence: number | null
  authority: number | null
  timeliness: number | null
  score: number | null
  note?: string
}

export interface CandidateAnalysis {
  thesis?: string
  dominant_driver: string[]
  strengths: string[]
  weaknesses: string[]
  unknowns: string[]
  causal_chain: string[]
  entry_point?: string
  differentiation?: string
  commercial_structure?: Record<string, string>
  evidence_refs: CandidateEvidenceRef[]
  falsifiers: string[]
  confidence?: number
  analysis_score?: number
  single_axis_strong?: boolean
  scenario?: string
  scenario_label?: string
  not_a_gate?: boolean
  /** v1.8.0 增量（缺失时 UI 自动隐藏对应卡片） */
  information_value?: CandidateInformationValue
  key_facts: CandidateKeyFact[]
  evidence_quality?: CandidateEvidenceQuality
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
  /** v1.7.0：DeepSeek 商机分析（仅候选；精选无字段时隐藏区块） */
  analysis?: CandidateAnalysis
  analysis_score?: number
  single_axis_strong?: boolean
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

function normalizeTextList(x: unknown): string[] {
  return arr(x)
    .map((v) => (typeof v === 'string' ? v : isObj(v) ? str(v.text, str(v.value, str(v.name))) : ''))
    .map((v) => v.trim())
    .filter(Boolean)
}

/* ---------------------- v1.8.0 信息价值 / 事实 / 证据质量 ---------------------- */

const INFO_VALUE_KEYS = ['novelty', 'specificity', 'impact', 'urgency', 'actionability'] as const

/** 统一到 0–10（兼容 0–100 分制与字符串数字） */
function normalizeScore10(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace('%', '').trim()) : NaN
  if (!Number.isFinite(n)) return null
  const x = n > 10 ? n / 10 : n
  return Math.round(Math.max(0, Math.min(10, x)) * 10) / 10
}

function normalizeInformationValue(raw: unknown): CandidateInformationValue | undefined {
  if (!isObj(raw)) return undefined
  const dimRaw = isObj(raw.dimensions) ? raw.dimensions : isObj(raw.scores) ? raw.scores : isObj(raw.value_dimensions) ? raw.value_dimensions : raw
  const byKey = new Map<string, number>()
  if (Array.isArray(dimRaw)) {
    for (const item of dimRaw) {
      if (!isObj(item)) continue
      const key = str(item.id, str(item.key, str(item.name))).toLowerCase()
      const value = normalizeScore10(item.score ?? item.value)
      if (key && value != null) byKey.set(key, value)
    }
  } else {
    for (const key of INFO_VALUE_KEYS) {
      const value = normalizeScore10(dimRaw[key])
      if (value != null) byKey.set(key, value)
    }
  }
  const dimensions = INFO_VALUE_KEYS.map((key) => ({ key, value: byKey.get(key) ?? 0 })).filter((d) => byKey.has(d.key))
  const scoreRaw = normalizeScore10(raw.score ?? raw.average ?? raw.avg ?? raw.total)
  const score = scoreRaw ?? (dimensions.length ? Math.round((dimensions.reduce((a, b) => a + b.value, 0) / dimensions.length) * 10) / 10 : null)
  if (!dimensions.length && score == null) return undefined
  return { score, dimensions }
}

function normalizeKeyFacts(raw: unknown): CandidateKeyFact[] {
  return arr(raw)
    .map((v): CandidateKeyFact | null => {
      if (typeof v === 'string') return v.trim() ? { text: v.trim(), type: 'fact' } : null
      if (!isObj(v)) return null
      const text = str(v.text, str(v.statement, str(v.content, str(v.fact, str(v.value)))))
      if (!text) return null
      const typeRaw = str(v.type, str(v.kind)).toLowerCase()
      const type: 'fact' | 'inference' = /infer|推断|推测|假设|hypoth/.test(typeRaw) ? 'inference' : 'fact'
      let sourceTitle: string | undefined
      let sourceUrl: string | undefined
      const ref = v.source_ref ?? v.sourceRef ?? v.source ?? v.ref ?? v.evidence_ref
      if (typeof ref === 'string') {
        if (/^https?:\/\//i.test(ref)) sourceUrl = ref
        else sourceTitle = ref
      } else if (isObj(ref)) {
        sourceTitle = str(ref.title, str(ref.name, str(ref.label))) || undefined
        sourceUrl = str(ref.url, str(ref.link, str(ref.href))) || undefined
      }
      sourceTitle = sourceTitle || str(v.source_title, str(v.sourceTitle)) || undefined
      sourceUrl = sourceUrl || str(v.source_url, str(v.url, str(v.link))) || undefined
      return { text, type, sourceTitle, sourceUrl }
    })
    .filter((v): v is CandidateKeyFact => !!v)
}

function normalizeEvidenceQuality(raw: unknown): CandidateEvidenceQuality | undefined {
  if (!isObj(raw)) return undefined
  const pick = (...keys: string[]): number | null => {
    for (const key of keys) {
      const n = num(raw[key])
      if (n != null) return n
    }
    return null
  }
  const quality: CandidateEvidenceQuality = {
    sourceCount: pick('source_count', 'sources', 'count', 'source_num', 'sources_count'),
    independence: normalizeScore10(pick('independence', 'independence_score', 'independent')),
    authority: normalizeScore10(pick('authority', 'authority_score', 'credibility')),
    timeliness: normalizeScore10(pick('timeliness', 'timeliness_score', 'freshness', 'recency')),
    score: normalizeScore10(pick('score', 'overall', 'total', 'evidence_score')),
    note: str(raw.note) || undefined,
  }
  const hasAny = Object.values(quality).some((v) => v != null)
  return hasAny ? quality : undefined
}

function normalizeAnalysis(raw: unknown): CandidateAnalysis | undefined {
  if (!isObj(raw)) return undefined
  const commercialRaw = isObj(raw.commercial_structure) ? raw.commercial_structure : {}
  const commercial_structure = Object.keys(commercialRaw).length
    ? Object.fromEntries(Object.entries(commercialRaw).map(([k, v]) => [k, str(v)]).filter(([, v]) => !!v))
    : undefined
  const analysis: CandidateAnalysis = {
    thesis: str(raw.thesis) || undefined,
    dominant_driver: normalizeTextList(raw.dominant_driver),
    strengths: normalizeTextList(raw.strengths),
    weaknesses: normalizeTextList(raw.weaknesses),
    unknowns: normalizeTextList(raw.unknowns),
    causal_chain: normalizeTextList(raw.causal_chain),
    entry_point: str(raw.entry_point) || undefined,
    differentiation: str(raw.differentiation) || undefined,
    commercial_structure,
    evidence_refs: arr(raw.evidence_refs)
      .map((v) =>
        typeof v === 'string'
          ? { title: v }
          : isObj(v)
            ? { title: str(v.title, str(v.name, str(v.text, str(v.value)))), url: str(v.url) || undefined }
            : null,
      )
      .filter((v): v is CandidateEvidenceRef => !!v && !!v.title),
    falsifiers: normalizeTextList(raw.falsifiers),
    confidence: raw.confidence == null ? undefined : num(raw.confidence),
    analysis_score: raw.analysis_score == null ? undefined : num(raw.analysis_score),
    single_axis_strong: raw.single_axis_strong === true,
    scenario: str(raw.scenario) || undefined,
    scenario_label: str(raw.scenario_label) || undefined,
    not_a_gate: raw.not_a_gate === true,
    information_value: normalizeInformationValue(raw.information_value ?? raw.info_value),
    key_facts: normalizeKeyFacts(raw.key_facts ?? raw.facts ?? raw.facts_and_inferences),
    evidence_quality: normalizeEvidenceQuality(raw.evidence_quality ?? raw.evidence_quality_score),
  }
  const hasContent =
    !!analysis.thesis ||
    analysis.dominant_driver.length > 0 ||
    analysis.causal_chain.length > 0 ||
    analysis.entry_point != null ||
    analysis.strengths.length > 0 ||
    analysis.weaknesses.length > 0 ||
    analysis.unknowns.length > 0 ||
    analysis.falsifiers.length > 0
  return hasContent ? analysis : undefined
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
  // v1.8.0 字段可能位于 analysis 内，也可能挂在候选顶层；两种都兼容
  const analysis = normalizeAnalysis(raw.analysis)
  if (analysis) {
    if (!analysis.information_value) analysis.information_value = normalizeInformationValue(raw.information_value ?? raw.info_value)
    if (!analysis.key_facts.length) analysis.key_facts = normalizeKeyFacts(raw.key_facts ?? raw.facts)
    if (!analysis.evidence_quality) analysis.evidence_quality = normalizeEvidenceQuality(raw.evidence_quality)
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
    analysis,
    analysis_score: raw.analysis_score != null ? num(raw.analysis_score) : isObj(raw.analysis) && raw.analysis.analysis_score != null ? num(raw.analysis.analysis_score) : undefined,
    single_axis_strong: raw.single_axis_strong === true || (isObj(raw.analysis) && raw.analysis.single_axis_strong === true),
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
