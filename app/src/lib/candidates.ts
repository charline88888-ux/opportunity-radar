import candidatesJson from '@/data/candidates.json'
import candidateRankingsJson from '@/data/candidate-rankings.json'
import type { WindowKey } from '@/types'

export interface CandidateSource {
  id?: string
  name?: string
  url?: string
  published_at?: string
  summary?: string
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

export interface Candidate {
  candidate_id: string
  title: string
  one_liner: string
  industry_ids: string[]
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
  first_seen: string
  last_seen: string
  disclaimer: string
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
  return {
    candidate_id: id,
    title,
    one_liner: str(raw.one_liner, str(raw.summary)),
    industry_ids: strs(raw.industry_ids),
    gap_type_ids: strs(raw.gap_type_ids),
    region_ids: strs(raw.region_ids),
    target_countries: strs(raw.target_countries),
    source: { id: str(sourceRaw.id), name: str(sourceRaw.name), url: str(sourceRaw.url), published_at: str(sourceRaw.published_at), summary: str(sourceRaw.summary) },
    evidence,
    seven_questions: seven,
    roi: normalizeRoi(raw.roi),
    scores: normalizeScores(raw.scores),
    confidence: num(raw.confidence, 60),
    status: str(raw.status, 'auto-discovered'),
    verification_status: str(raw.verification_status, 'unverified'),
    first_seen: str(raw.first_seen),
    last_seen: str(raw.last_seen, str(raw.first_seen)),
    disclaimer: str(raw.disclaimer, '自动发现候选，未经验证，仅作研究线索，不构成投资建议。'),
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
