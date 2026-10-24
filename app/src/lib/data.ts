/**
 * 数据接入层：只读构建期同步到 src/data/ 的 JSON。
 * 关键原则：任何字段缺失都降级展示，不白屏、不抛错。
 */
import type {
  CalendarData,
  CalendarEvent,
  DataMeta,
  DeltaBasis,
  GapType,
  Grade,
  GradeId,
  HistoryMeta,
  HumanNeed,
  Industry,
  NeuroDriver,
  Opportunity,
  Playbook,
  Playbooks,
  Rankings,
  RankingsMeta,
  RankingWindow,
  Region,
  ScoreDimension,
  Scores,
  SevenQuestions,
  SourceCategory,
  SourceHealth,
  Sources,
  Stats,
  StatsBucket,
  Tag,
  Taxonomy,
  WindowKey,
} from '@/types'
import taxonomyJson from '@/data/taxonomy.json'
import opportunitiesJson from '@/data/opportunities.json'
import rankingsJson from '@/data/rankings.json'
import sourcesJson from '@/data/sources.json'
import playbooksJson from '@/data/playbooks.json'
import calendarJson from '@/data/calendar.json'
import statsJson from '@/data/stats.json'
import historyJson from '@/data/_history.json'
import sourceHealthJson from '@/data/source-health.json'
import dataMetaJson from '@/data/_meta.json'
import { clamp, isoWeekKey, round1 } from './utils'

type Obj = Record<string, any>

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const int = (v: unknown, fallback = 0): number => Math.round(num(v, fallback))
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const strArr = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === 'string')
const obj = (v: unknown): Obj => (isObj(v) ? v : {})

/** 从 {items|opportunities|events|playbooks|data: []} 或裸数组里取列表 */
function pickList(raw: unknown, keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw
  if (isObj(raw)) {
    for (const k of keys) {
      if (Array.isArray(raw[k])) return raw[k]
    }
    if (Array.isArray(raw.data)) return raw.data
  }
  return []
}

const FALLBACK_AS_OF = '2026-10-22'
const rawTaxonomy = taxonomyJson as unknown as Obj
const rawMeta = dataMetaJson as unknown as Obj
const rawTaxMeta = obj(rawTaxonomy.meta)
const asOf = str(rawMeta.as_of) || str(rawTaxMeta.as_of) || FALLBACK_AS_OF

/* ============================ taxonomy ============================ */

const FALLBACK_DIMENSIONS: ScoreDimension[] = [
  ['signal', '信号强度', 0.15],
  ['gap', '信息差窗口', 0.15],
  ['feasibility', '个人可执行性', 0.15],
  ['economics', '回报空间', 0.15],
  ['timing', '时机窗口', 0.1],
  ['competition', '竞争与壁垒', 0.08],
  ['risk', '风险可控性', 0.07],
  ['fit', '人群适配度', 0.05],
  ['evidence', '证据可信度', 0.05],
  ['leverage', '杠杆放大', 0.05],
].map(([id, name, weight]) => ({ id: String(id), name: String(name), weight: Number(weight) }))

const FALLBACK_GRADES: Grade[] = [
  { id: 'S', name: 'S 级 · 可重注', min: 85 },
  { id: 'A', name: 'A 级 · 优先验证', min: 75 },
  { id: 'B', name: 'B 级 · 观察/小试', min: 65 },
  { id: 'C', name: 'C 级 · 记录', min: 55 },
  { id: 'D', name: 'D 级 · 不入榜', min: 0 },
]

const FALLBACK_INDUSTRIES: Industry[] = [
  ['pet', '宠物经济', '#ffb547'], ['silver', '银发与健康', '#9ca3af'], ['emotional', '情绪疗愈与心理', '#f472b6'],
  ['ai', 'AI 与效率工具', '#4cc9f0'], ['crossborder', '跨境电商与供应链', '#3ddc97'], ['content', '内容与 IP 出海', '#eab308'],
  ['education', '教育与知识服务', '#60a5fa'], ['local', '本地生活与服务', '#fb923c'], ['green', '绿色能源与可持续', '#84cc16'],
  ['compliance', '合规与专业服务', '#94a3b8'], ['culture', '文化与宗教', '#f87171'], ['gaming', '游戏与社交', '#a78bfa'],
  ['fintech', '支付与金融科技', '#2dd4bf'], ['manufacturing', '产业与制造', '#cbd5e1'],
].map(([id, name, color]) => ({ id: String(id), name: String(name), color: String(color) }))

function normalizeTaxonomy(raw: Obj): Taxonomy {
  const industries = arr(raw.industries)
    .filter(isObj)
    .map((x, i) => ({
      id: str(x.id, `industry-${i}`),
      name: str(x.name, str(x.id, `行业 ${i + 1}`)),
      color: str(x.color, '#8b93a7'),
      icon: str(x.icon) || undefined,
      desc: str(x.desc) || undefined,
    }))
  const dimsRaw = arr(raw.score_dimensions)
    .filter(isObj)
    .map((x) => ({
      id: str(x.id),
      name: str(x.name, str(x.id)),
      weight: num(x.weight),
      desc: str(x.desc) || undefined,
      anchors: isObj(x.anchors) ? (x.anchors as Record<string, string>) : undefined,
    }))
    .filter((x) => !!x.id)
  const dims = dimsRaw.length ? dimsRaw : FALLBACK_DIMENSIONS
  // 权重归一：兼容 15 / 0.15 两种写法
  const weightSum = dims.reduce((a, d) => a + d.weight, 0)
  if (weightSum > 1.5 && weightSum > 0) dims.forEach((d) => (d.weight = d.weight / 100))

  const grades = arr(raw.grades)
    .filter(isObj)
    .map((x) => ({ id: str(x.id, 'D'), name: str(x.name, str(x.id)), min: num(x.min), desc: str(x.desc) || undefined }))
    .filter((x) => !!x.id)
  const normalizedGrades = (grades.length ? grades : FALLBACK_GRADES).sort((a, b) => b.min - a.min)

  const industriesFinal = industries.length ? industries : FALLBACK_INDUSTRIES

  return {
    meta: rawTaxMeta,
    industries: industriesFinal,
    human_needs: arr(raw.human_needs).filter(isObj).map((x, i) => ({
      id: str(x.id, `need-${i}`),
      name: str(x.name, str(x.id, `需求 ${i + 1}`)),
      layer: str(x.layer) || undefined,
      desc: str(x.desc) || undefined,
      typical_emotions: strArr(x.typical_emotions),
      neuro_drivers: strArr(x.neuro_drivers),
    })),
    neuro_drivers: arr(raw.neuro_drivers).filter(isObj).map((x, i) => ({
      id: str(x.id, `neuro-${i}`),
      name: str(x.name, str(x.id, `神经递质 ${i + 1}`)),
      theme: str(x.theme) || undefined,
      desc: str(x.desc) || undefined,
      triggers: strArr(x.triggers),
    })),
    emotions: arr(raw.emotions).filter(isObj).map((x, i) => ({
      id: str(x.id, `emotion-${i}`),
      name: str(x.name, str(x.id, `情绪 ${i + 1}`)),
      polarity: str(x.polarity) || undefined,
      desc: str(x.desc) || undefined,
    })),
    gap_types: arr(raw.gap_types).filter(isObj).map((x, i) => ({
      id: str(x.id, `gap-${i}`),
      name: str(x.name, str(x.id, `信息差 ${i + 1}`)),
      desc: str(x.desc) || undefined,
      half_life_months: num(x.half_life_months, 18),
    })),
    drivers: arr(raw.drivers).filter(isObj).map((x, i) => ({
      id: str(x.id, `driver-${i}`), name: str(x.name, str(x.id)), desc: str(x.desc) || undefined,
    })),
    business_models: arr(raw.business_models).filter(isObj).map((x, i) => ({
      id: str(x.id, `model-${i}`), name: str(x.name, str(x.id)), desc: str(x.desc) || undefined,
    })),
    regions: arr(raw.regions).filter(isObj).map((x, i) => ({
      id: str(x.id, `region-${i}`), name: str(x.name, str(x.id)), short: str(x.short) || undefined, desc: str(x.desc) || undefined,
    })),
    score_dimensions: dims,
    tags: arr(raw.tags).filter(isObj).map((x, i) => ({
      id: str(x.id, `tag-${i}`), name: str(x.name, str(x.id)), desc: str(x.desc) || undefined,
    })),
    grades: normalizedGrades,
  }
}

export const taxonomy = normalizeTaxonomy(rawTaxonomy)

/* ============================ opportunities ============================ */

export function computeTotal(dimensions: Partial<Record<string, number>>, dims = taxonomy.score_dimensions): number {
  let total = 0
  for (const d of dims) total += num(dimensions[d.id], 0) * d.weight
  return round1(total * 10)
}

export function gradeOf(total: number, grades = taxonomy.grades): GradeId {
  for (const g of [...grades].sort((a, b) => b.min - a.min)) {
    if (total >= g.min) return g.id as GradeId
  }
  return 'D'
}

const DIM_KEYS = taxonomy.score_dimensions.map((d) => d.id)
const DEFAULT_DIMS = Object.fromEntries(DIM_KEYS.map((k) => [k, 0])) as Record<string, number>

function normalizeSevenQuestions(raw: unknown): SevenQuestions {
  const q = obj(raw)
  return {
    traffic: str(q.traffic, '暂未提供'),
    money: str(q.money, '暂未提供'),
    model: str(q.model, '暂未提供'),
    roi: str(q.roi, '暂未提供'),
    audience: str(q.audience, '暂未提供'),
    drivers: strArr(q.drivers),
    moat: str(q.moat, '暂未提供'),
  }
}

function normalizeOpportunity(raw: unknown, index: number): Opportunity {
  const x = obj(raw)
  const id = str(x.id) || str(x.slug) || `opp-fallback-${String(index + 1).padStart(3, '0')}`
  const rawDims = obj(obj(x.scores).dimensions)
  const dimensions: Record<string, number> = { ...DEFAULT_DIMS }
  for (const key of DIM_KEYS) dimensions[key] = round1(clamp(num(rawDims[key]), 0, 10))
  const rawTotal = obj(x.scores).total
  const hasDims = Object.keys(rawDims).length > 0
  const total = typeof rawTotal === 'number' ? round1(rawTotal) : hasDims ? computeTotal(dimensions) : 0
  const momentum = round1(clamp(num(x.momentum, 1), 0, 5))
  const rankScore = typeof x.rank_score === 'number' ? round1(x.rank_score) : round1(Math.min(100, total * (1 + 0.12 * (momentum - 1))))

  const rawSignal = obj(x.signal)
  const evidence = arr(rawSignal.evidence).filter(isObj).map((e) => ({
    title: str(e.title, '未命名证据'),
    publisher: str(e.publisher, '未知来源'),
    url: str(e.url),
    date: str(e.date),
    quote: str(e.quote),
    lang: str(e.lang) || undefined,
    tier: (['primary', 'secondary', 'marketing'].includes(str(e.tier)) ? str(e.tier) : 'secondary') as any,
  }))
  const activityDates = [...new Set(strArr(x.activity_dates).filter(Boolean))].sort()
  const firstSeen = str(x.first_seen) || activityDates[0] || ''
  const lastActivity = str(x.last_activity) || activityDates[activityDates.length - 1] || firstSeen || asOf
  if (!activityDates.length) activityDates.push(lastActivity)

  const status = str(obj(x.window).status, 'open')
  const decay = str(obj(x.window).decay, 'medium')
  const effort = str(obj(x.roi).effort_level, 'side')
  const trend = str(rawSignal.trend_direction, 'flat')

  return {
    id,
    slug: str(x.slug) || id,
    title: str(x.title, '未命名机会'),
    one_liner: str(x.one_liner, ''),
    industry_id: str(x.industry_id, taxonomy.industries[0]?.id || 'pet'),
    business_canvas: isObj(x.business_canvas) ? x.business_canvas : undefined,
    judgment: isObj(x.judgment) ? x.judgment : undefined,
    analyst_narrative: isObj(x.analyst_narrative) ? x.analyst_narrative : undefined,
    competition: isObj(x.competition) ? x.competition : undefined,
    cross_market: isObj(x.cross_market) ? x.cross_market : undefined,
    timing: isObj(x.timing) ? x.timing : undefined,
    conditions: isObj(x.conditions) ? x.conditions : undefined,
    barriers: isObj(x.barriers) ? x.barriers : undefined,
    profit_model: isObj(x.profit_model) ? x.profit_model : undefined,
    execution_plan: isObj(x.execution_plan) ? x.execution_plan : undefined,
    investment_breakdown: isObj(x.investment_breakdown) ? x.investment_breakdown : undefined,
    unit_economics: isObj(x.unit_economics) ? x.unit_economics : undefined,
    gap_type_ids: strArr(x.gap_type_ids),
    region_ids: strArr(x.region_ids),
    origin_country: str(x.origin_country, '—'),
    target_countries: strArr(x.target_countries),
    human_need_ids: strArr(x.human_need_ids),
    neuro_drivers: strArr(x.neuro_drivers),
    emotion_tags: strArr(x.emotion_tags),
    source_langs: strArr(x.source_langs),
    signal: {
      summary: str(rawSignal.summary, '暂无信号摘要'),
      evidence,
      signal_strength: round1(num(rawSignal.signal_strength, dimensions.signal)),
      trend_direction: (['up', 'flat', 'down'].includes(trend) ? trend : 'flat') as any,
      volume_estimate: str(rawSignal.volume_estimate, '暂无规模数据'),
    },
    seven_questions: normalizeSevenQuestions(x.seven_questions),
    roi: {
      capital_cny: { min: num(obj(obj(x.roi).capital_cny).min), max: num(obj(obj(x.roi).capital_cny).max) },
      time_to_revenue_months: int(obj(x.roi).time_to_revenue_months),
      payback_months: int(obj(x.roi).payback_months),
      monthly_revenue_cny: { min: num(obj(obj(x.roi).monthly_revenue_cny).min), max: num(obj(obj(x.roi).monthly_revenue_cny).max) },
      gross_margin_pct: num(obj(x.roi).gross_margin_pct),
      effort_level: (['full', 'side', 'solo'].includes(effort) ? effort : 'side') as any,
      team_size: int(obj(x.roi).team_size, 1) || 1,
    },
    scores: {
      dimensions: dimensions as Scores['dimensions'],
      total,
      grade: (str(obj(x.scores).grade) || gradeOf(total)) as any,
    },
    window: {
      status: (['open', 'peak', 'closing', 'closed'].includes(status) ? status : 'open') as any,
      months_left: int(obj(x.window).months_left, 1),
      decay: (['slow', 'medium', 'fast'].includes(decay) ? decay : 'medium') as any,
    },
    risks: strArr(x.risks),
    first_steps_7d: strArr(x.first_steps_7d),
    kill_criteria: strArr(x.kill_criteria),
    compliance_notes: str(x.compliance_notes, '暂无合规备注，使用前请自行核查。'),
    evidence_count: typeof x.evidence_count === 'number' ? x.evidence_count : evidence.length,
    activity_dates: activityDates,
    first_seen: firstSeen || lastActivity,
    last_activity: lastActivity,
    momentum,
    rank_score: rankScore,
    tags: strArr(x.tags),
    verified: bool(x.verified),
    disclaimer: str(x.disclaimer, '研究假设，非投资建议；使用前请核验原始来源。'),
  }
}

export const opportunities: Opportunity[] = pickList(opportunitiesJson, ['opportunities', 'items'])
  .map((x, i) => normalizeOpportunity(x, i))
  .filter((o) => !!o.id)

export const oppById = new Map<string, Opportunity>(opportunities.map((o) => [o.id, o]))
export const oppBySlug = new Map<string, Opportunity>(opportunities.map((o) => [o.slug, o]))

/* ============================ rankings ============================ */

const WINDOW_KEYS: WindowKey[] = ['day', 'week', 'month', 'year']
const WINDOW_LABEL: Record<WindowKey, string> = { day: '日榜', week: '周榜', month: '月榜', year: '年榜' }
export const RANKING_WINDOWS = WINDOW_KEYS.map((key) => ({ key, label: WINDOW_LABEL[key] }))

function windowFilter(key: WindowKey): (o: Opportunity) => boolean {
  const weekKey = isoWeekKey(asOf)
  const monthKey = asOf.slice(0, 7)
  const yearKey = asOf.slice(0, 4)
  if (key === 'day') return (o) => o.last_activity === asOf
  if (key === 'week') return (o) => isoWeekKey(o.last_activity) === weekKey
  if (key === 'month') return (o) => o.last_activity.slice(0, 7) === monthKey
  return (o) => o.last_activity.slice(0, 4) === yearKey
}

/** 降级：当 rankings.json 缺失/窗口为空时，由机会库按契约规则本地推算（仅兜底展示） */
function deriveWindow(key: WindowKey): RankingWindow {
  const weekNo = Number(isoWeekKey(asOf).split('W')[1])
  const keyLabels: Record<WindowKey, { key: string; label: string }> = {
    day: { key: asOf, label: `${asOf.slice(0, 4)}年${Number(asOf.slice(5, 7))}月${Number(asOf.slice(8, 10))}日` },
    week: { key: isoWeekKey(asOf), label: `${asOf.slice(0, 4)}年第${weekNo}周` },
    month: { key: asOf.slice(0, 7), label: `${asOf.slice(0, 4)}年${Number(asOf.slice(5, 7))}月` },
    year: { key: asOf.slice(0, 4), label: `${asOf.slice(0, 4)}年` },
  }
  const items = opportunities
    .filter(windowFilter(key))
    .sort((a, b) => b.rank_score - a.rank_score)
    .map((o, i) => ({ opp_id: o.id, rank: i + 1, rank_score: o.rank_score, total: o.scores.total, delta: null, change: 'new' as const }))
  return { ...keyLabels[key], items }
}

function normalizeRankingsMeta(raw: unknown): RankingsMeta {
  const m = obj(raw)
  const basis = str(m.delta_basis)
  return {
    ...(m as RankingsMeta),
    data_version: str(m.data_version) || undefined,
    as_of: str(m.as_of) || asOf,
    delta_basis: (basis === 'history' || basis === 'adjacent-window' ? basis : 'adjacent-window') as DeltaBasis,
    history_as_of: m.history_as_of === null ? null : str(m.history_as_of) || null,
    tie_breaker: str(m.tie_breaker) || undefined,
    snapshot_at: str(m.snapshot_at) || undefined,
    reconstructed: bool(m.reconstructed),
  }
}

function normalizeRankings(raw: unknown): Rankings {
  const root = obj(raw)
  const windowsRaw = obj(root.windows)
  const windows = {} as Record<WindowKey, RankingWindow>
  for (const key of WINDOW_KEYS) {
    const w = obj(windowsRaw[key])
    const items = arr(w.items)
      .filter(isObj)
      .map((it, i) => {
        const change = str(it.change, 'flat')
        return {
          opp_id: str(it.opp_id, str(it.id)),
          rank: int(it.rank, i + 1) || i + 1,
          rank_score: round1(num(it.rank_score)),
          total: round1(num(it.total)),
          delta: it.delta === null || it.delta === undefined ? null : int(it.delta),
          change: (['up', 'down', 'new', 'flat'].includes(change) ? change : 'flat') as any,
        }
      })
      .filter((it) => !!it.opp_id && oppById.has(it.opp_id))
      .sort((a, b) => a.rank - b.rank)
    const derived = deriveWindow(key)
    windows[key] = items.length
      ? {
          key: str(w.key, derived.key),
          label: str(w.label, derived.label),
          delta_basis: (w.delta_basis === 'history' || w.delta_basis === 'adjacent-window' ? w.delta_basis : undefined) as
            | DeltaBasis
            | undefined,
          items,
        }
      : derived
  }
  return {
    meta: normalizeRankingsMeta(root.meta),
    windows,
  }
}

export const rankings = normalizeRankings(rankingsJson)
export const rankingWindowMeta = rankings.windows
export const rankingsDeltaBasis: DeltaBasis = rankings.meta.delta_basis || 'adjacent-window'
export const rankingsHistoryAsOf: string | null = rankings.meta.history_as_of ?? null
export const rankingsTieBreaker: string = rankings.meta.tie_breaker || ''

/** 某个机会在所有榜单中的名次 */
export function getOppRanks(oppId: string) {
  return WINDOW_KEYS.map((key) => {
    const item = rankings.windows[key]?.items.find((it) => it.opp_id === oppId)
    return item ? { window: key, label: WINDOW_LABEL[key], ...item } : null
  }).filter(Boolean) as Array<{ window: WindowKey; label: string; opp_id: string; rank: number; rank_score: number; total: number; delta: number | null; change: any }>
}

/* ============================ stats（缺失时由机会库计算） ============================ */

function computeBuckets(opps: Opportunity[], getIds: (o: Opportunity) => string[], lookup: Map<string, string>): StatsBucket[] {
  const m = new Map<string, { count: number; sum: number }>()
  for (const o of opps) {
    for (const id of getIds(o)) {
      const cur = m.get(id) || { count: 0, sum: 0 }
      cur.count += 1
      cur.sum += o.scores.total
      m.set(id, cur)
    }
  }
  return [...m.entries()]
    .map(([id, v]) => ({ id, name: lookup.get(id) || id, count: v.count, avg_total: round1(v.sum / v.count) }))
    .sort((a, b) => b.count - a.count)
}

function mapNames(items: Array<{ id: string; name: string }>): Map<string, string> {
  return new Map(items.map((x) => [x.id, x.name]))
}

export function computeStats(opps: Opportunity[] = opportunities): Stats {
  const weekKey = isoWeekKey(asOf)
  const histogram = Array.from({ length: 10 }, () => 0)
  for (const o of opps) histogram[clamp(Math.floor(o.scores.total / 10), 0, 9)] += 1
  const trend_14d = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(Date.parse(asOf + 'T00:00:00Z') - (13 - i) * 86400000).toISOString().slice(0, 10)
    const active = opps.filter((o) => o.activity_dates.includes(date) || o.last_activity === date)
    return {
      date,
      new_count: new Set(active.map((o) => o.id)).size,
      avg_score: active.length ? round1(active.reduce((a, o) => a + o.scores.total, 0) / active.length) : 0,
    }
  })
  const openValue = opps
    .filter((o) => o.window.status === 'open' || o.window.status === 'peak')
    .reduce((a, o) => a + (o.roi.monthly_revenue_cny.min + o.roi.monthly_revenue_cny.max) / 2, 0)
  return {
    meta: { data_version: 'derived', as_of: asOf },
    kpi: {
      total_opps: opps.length,
      new_today: opps.filter((o) => o.last_activity === asOf).length,
      new_week: opps.filter((o) => isoWeekKey(o.last_activity) === weekKey).length,
      new_month: opps.filter((o) => o.last_activity.slice(0, 7) === asOf.slice(0, 7)).length,
      grade_a_plus: opps.filter((o) => o.scores.grade === 'S' || o.scores.grade === 'A').length,
      industries_covered: new Set(opps.map((o) => o.industry_id)).size,
      regions_covered: new Set(opps.flatMap((o) => o.region_ids)).size,
      avg_total: opps.length ? round1(opps.reduce((a, o) => a + o.scores.total, 0) / opps.length) : 0,
    },
    by_industry: computeBuckets(opps, (o) => [o.industry_id], mapNames(taxonomy.industries)),
    by_gap_type: computeBuckets(opps, (o) => o.gap_type_ids, mapNames(taxonomy.gap_types)),
    by_region: computeBuckets(opps, (o) => o.region_ids, mapNames(taxonomy.regions)),
    by_need: computeBuckets(opps, (o) => o.human_need_ids, mapNames(taxonomy.human_needs)),
    score_histogram: histogram,
    trend_14d,
    open_window_value_cny: Math.round(openValue),
  }
}

function normalizeStats(raw: unknown): Stats {
  const fallback = computeStats()
  const r = obj(raw)
  if (!Object.keys(r).length) return fallback
  const kpiRaw = obj(r.kpi)
  const buckets = (v: unknown, fb: StatsBucket[]) =>
    arr(v).filter(isObj).length
      ? arr(v).filter(isObj).map((b) => ({
          id: str(b.id), name: str(b.name, str(b.id)), count: int(b.count),
          avg_total: typeof b.avg_total === 'number' ? round1(b.avg_total) : undefined,
        }))
      : fb
  return {
    meta: isObj(r.meta) ? r.meta : fallback.meta,
    kpi: {
      total_opps: int(kpiRaw.total_opps, fallback.kpi.total_opps),
      new_today: int(kpiRaw.new_today, fallback.kpi.new_today),
      new_week: int(kpiRaw.new_week, fallback.kpi.new_week || 0),
      new_month: int(kpiRaw.new_month, fallback.kpi.new_month || 0),
      grade_a_plus: int(kpiRaw.grade_a_plus, fallback.kpi.grade_a_plus),
      industries_covered: int(kpiRaw.industries_covered, fallback.kpi.industries_covered),
      regions_covered: int(kpiRaw.regions_covered, fallback.kpi.regions_covered),
      avg_total: num(kpiRaw.avg_total, fallback.kpi.avg_total),
    },
    by_industry: buckets(r.by_industry, fallback.by_industry),
    by_gap_type: buckets(r.by_gap_type, fallback.by_gap_type),
    by_region: buckets(r.by_region, fallback.by_region),
    by_need: buckets(r.by_need, fallback.by_need),
    score_histogram: arr(r.score_histogram).length === 10 ? arr(r.score_histogram).map((n) => int(n)) : fallback.score_histogram,
    trend_14d: arr(r.trend_14d).filter(isObj).length
      ? arr(r.trend_14d).filter(isObj).map((p) => ({
          date: str(p.date),
          new_count: int(p.new_count),
          active_count: typeof p.active_count === 'number' ? int(p.active_count) : undefined,
          avg_score: num(p.avg_score),
        }))
      : fallback.trend_14d,
    open_window_value_cny: num(r.open_window_value_cny, fallback.open_window_value_cny),
  }
}

export const stats = normalizeStats(statsJson)

/* ============================ sources ============================ */

function normalizeSources(raw: unknown): Sources {
  const r = obj(raw)
  const categories: SourceCategory[] = arr(r.categories).filter(isObj).map((c, i) => ({
    id: str(c.id, `category-${i}`),
    name: str(c.name, str(c.id, `分类 ${i + 1}`)),
    desc: str(c.desc) || undefined,
    sources: arr(c.sources).filter(isObj).map((s, j) => ({
      id: str(s.id, `source-${i}-${j}`),
      name: str(s.name, str(s.id, `数据源 ${j + 1}`)),
      url: str(s.url),
      regions: strArr(s.regions),
      signal_types: strArr(s.signal_types),
      access: (['api', 'rss', 'json', 'html', 'manual', 'paid-api'].includes(str(s.access)) ? str(s.access) : 'manual') as any,
      frequency: (['realtime', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'manual'].includes(str(s.frequency)) ? str(s.frequency) : 'weekly') as any,
      cost: (['free', 'freemium', 'paid'].includes(str(s.cost)) ? str(s.cost) : 'free') as any,
      compliance: (['green', 'yellow', 'red'].includes(str(s.compliance)) ? str(s.compliance) : 'yellow') as any,
      value_score: clamp(num(s.value_score, 5), 0, 10),
      notes: str(s.notes, ''),
      enabled: s.enabled === false ? false : true,
      limits: isObj(s.limits) ? s.limits : undefined,
    })),
  }))
  return {
    meta: isObj(r.meta) ? r.meta : { data_version: 'unknown', as_of: asOf },
    categories,
  }
}

export const sources = normalizeSources(sourcesJson)
export const allSources = sources.categories.flatMap((c) => c.sources)

/* ============================ playbooks ============================ */

export const playbooks: Playbook[] = pickList(playbooksJson, ['playbooks', 'items']).filter(isObj).map((p, i) => ({
  id: str(p.id, `playbook-${i}`),
  name: str(p.name, `剧本 ${i + 1}`),
  purpose: str(p.purpose),
  human_need_ids: strArr(p.human_need_ids),
  emotion_ids: strArr(p.emotion_ids),
  time_box_min: int(p.time_box_min, 30),
  frequency: str(p.frequency, 'weekly'),
  platforms: strArr(p.platforms),
  steps: strArr(p.steps),
  keywords: strArr(p.keywords),
  output: str(p.output),
  quality_checks: strArr(p.quality_checks),
}))

/* ============================ calendar ============================ */

export const calendarEvents: CalendarEvent[] = pickList(calendarJson, ['events', 'items']).filter(isObj).map((e) => ({
  date: str(e.date),
  end_date: str(e.end_date) || undefined,
  name: str(e.name, '未命名节点'),
  region_ids: strArr(e.region_ids),
  type: (['religious', 'festival', 'tax', 'school', 'fiscal', 'shopping', 'national'].includes(str(e.type)) ? str(e.type) : 'festival') as any,
  lead_time_days: int(e.lead_time_days, 30),
  themes: strArr(e.themes),
  notes: str(e.notes),
})).filter((e) => !!e.date).sort((a, b) => a.date.localeCompare(b.date))

/* ============================ v0.2.0 可选数据：history / source-health ============================ */

const rawHistory = obj(historyJson)
export const historyMeta: HistoryMeta = {
  available: bool(rawHistory.available),
  count: int(rawHistory.count),
  latest_date: str(rawHistory.latest_date) || null,
  history_as_of: str(rawHistory.history_as_of) || null,
  snapshots: arr(rawHistory.snapshots)
    .filter(isObj)
    .map((s) => ({
      file: str(s.file),
      date: str(s.date),
      data_version: str(s.data_version) || undefined,
      as_of: str(s.as_of) || undefined,
      snapshot_at: str(s.snapshot_at) || null,
      reconstructed: bool(s.reconstructed),
      replay_as_of: s.replay_as_of == null ? null : str(s.replay_as_of) || null,
      delta_basis: s.delta_basis == null ? null : str(s.delta_basis),
      window_counts: isObj(s.window_counts)
        ? Object.fromEntries(Object.entries(s.window_counts).map(([k, v]) => [k, int(v)]))
        : undefined,
    })),
  note: str(rawHistory.note) || undefined,
}

const rawSourceHealth = obj(sourceHealthJson)
export const sourceHealth: SourceHealth = {
  available: bool(rawSourceHealth.available),
  mode: str(rawSourceHealth.mode) || null,
  checked_at: str(rawSourceHealth.checked_at) || null,
  total: int(rawSourceHealth.total),
  ok_count: int(rawSourceHealth.ok_count),
  fail_count: int(rawSourceHealth.fail_count),
  sources: arr(rawSourceHealth.sources)
    .filter(isObj)
    .map((s) => ({
      id: str(s.id),
      name: str(s.name) || undefined,
      url: str(s.url) || undefined,
      ok: bool(s.ok),
      mode: str(s.mode) || undefined,
      checked_at: str(s.checked_at) || undefined,
      latency_ms: typeof s.latency_ms === 'number' ? num(s.latency_ms) : undefined,
      http_status:
        typeof s.http_status === 'number' ? int(s.http_status) : typeof s.status === 'number' ? int(s.status) : null,
      error: s.error == null ? null : str(s.error),
      note: s.note == null ? null : str(s.note),
      consecutive_failures: int(s.consecutive_failures),
      category: str(s.category) || undefined,
      items: typeof s.items === 'number' ? int(s.items) : undefined,
      signals: typeof s.signals === 'number' ? int(s.signals) : undefined,
      cached: typeof s.cached === 'boolean' ? bool(s.cached) : undefined,
      access: str(s.access) || undefined,
      compliance: str(s.compliance) || undefined,
    })),
  meta: isObj(rawSourceHealth.meta) ? (rawSourceHealth.meta as any) : undefined,
  note: str(rawSourceHealth.note) || undefined,
}
export const sourceHealthById = new Map(sourceHealth.sources.map((s) => [s.id, s]))

/** v0.3.1：采集源 id 可能变化，按 id → URL → 名称兼容匹配（不因改动报错/白屏） */
const normalizeSourceUrl = (u?: string | null) =>
  (u || '').trim().replace(/\/+$/, '').toLowerCase()
export const sourceHealthByUrl = new Map(
  sourceHealth.sources.filter((s) => s.url).map((s) => [normalizeSourceUrl(s.url), s]),
)
export const sourceHealthByName = new Map(
  sourceHealth.sources.filter((s) => s.name).map((s) => [s.name as string, s]),
)

export function getSourceHealth(source: { id?: string; url?: string; name?: string }) {
  if (source.id) {
    const byId = sourceHealthById.get(source.id)
    if (byId) return byId
  }
  if (source.url) {
    const byUrl = sourceHealthByUrl.get(normalizeSourceUrl(source.url))
    if (byUrl) return byUrl
  }
  if (source.name) {
    const byName = sourceHealthByName.get(source.name)
    if (byName) return byName
  }
  return undefined
}

/* ============================ v0.3.0 delta / history 口径展示 ============================ */

export const rankingsHistorySnapshot =
  historyMeta.snapshots.find((s) => s.date === rankingsHistoryAsOf) || null
export const rankingsHistoryReconstructed = rankingsHistorySnapshot?.reconstructed ?? false
export const rankingsHistoryReplayAsOf = rankingsHistorySnapshot?.replay_as_of ?? null
export const historyReplaySnapshots = historyMeta.snapshots.filter((s) => s.reconstructed)

export const deltaBasisLabel =
  rankingsDeltaBasis === 'history' && rankingsHistoryAsOf
    ? `较上一快照（${rankingsHistoryAsOf}）`
    : '相邻窗口（历史快照不足 1 天）'
export const deltaBasisShort =
  rankingsDeltaBasis === 'history' ? '较上一快照' : '相邻窗口口径'
export function deltaBasisText(basis: DeltaBasis | undefined | null): string {
  if (basis === 'history') {
    return rankingsHistoryAsOf ? `较上一快照（${rankingsHistoryAsOf}）` : '较上一快照'
  }
  return '相邻窗口（历史快照不足 1 天）'
}
/** 上一份用于 delta 的快照是否为历史回放（reconstructed=true） */
export const historyBasisReplayLabel =
  rankingsDeltaBasis === 'history' && rankingsHistoryReconstructed ? '历史回放' : null

/* ============================ meta & lookups ============================ */

export const dataMeta: DataMeta = {
  source: (['real', 'mock', 'mixed'].includes(str(rawMeta.source)) ? rawMeta.source : 'unknown') as any,
  files: isObj(rawMeta.files) ? (rawMeta.files as Record<string, 'real' | 'mock'>) : undefined,
  synced_at: str(rawMeta.synced_at) || undefined,
  data_version: str(rawMeta.data_version) || str(obj(rawTaxonomy.meta).data_version) || undefined,
  as_of: asOf,
  delta_basis: rankingsDeltaBasis,
  history_as_of: str(rawMeta.history_as_of) || rankingsHistoryAsOf,
  mock_files: strArr(rawMeta.mock_files),
  counts: isObj(rawMeta.counts) ? (rawMeta.counts as Record<string, unknown>) : undefined,
  optional: {
    history: historyMeta,
    source_health: sourceHealth.available
      ? {
          available: true,
          mode: sourceHealth.mode,
          checked_at: sourceHealth.checked_at,
          total: sourceHealth.total,
          ok: sourceHealth.ok_count,
          failed: sourceHealth.fail_count,
          failed_ids: sourceHealth.sources.filter((s) => !s.ok).map((s) => s.id),
        }
      : { available: false },
  },
  validation: isObj(rawMeta.validation)
    ? {
        passed: num(rawMeta.validation.passed),
        failed: num(rawMeta.validation.failed),
        checks: arr(rawMeta.validation.checks)
          .filter(isObj)
          .map((c) => ({ level: str(c.level, 'FAIL'), name: str(c.name, '—'), detail: str(c.detail, '') })),
      }
    : undefined,
  notes: str(rawMeta.notes) || undefined,
}

export const isMockData = dataMeta.source !== 'real'
export const appVersion = '1.8.1'
export const dataAsOf = asOf
export const repoUrl = 'https://github.com/charline88888-ux/opportunity-radar'
export const onlineUrl = 'https://charline88888-ux.github.io/opportunity-radar/'

const industryMap = mapNames(taxonomy.industries)
const gapMap = mapNames(taxonomy.gap_types)
const regionMap = mapNames(taxonomy.regions)
const needMap = mapNames(taxonomy.human_needs)
const neuroMap = mapNames(taxonomy.neuro_drivers)
const emotionMap = mapNames(taxonomy.emotions)
const driverMap = mapNames(taxonomy.drivers)
const tagMap = mapNames(taxonomy.tags)

export const lookups = {
  industries: new Map(taxonomy.industries.map((x) => [x.id, x])),
  gapTypes: new Map(taxonomy.gap_types.map((x) => [x.id, x])),
  regions: new Map(taxonomy.regions.map((x) => [x.id, x])),
  needs: new Map(taxonomy.human_needs.map((x) => [x.id, x])),
  neuro: new Map(taxonomy.neuro_drivers.map((x) => [x.id, x])),
  emotions: new Map(taxonomy.emotions.map((x) => [x.id, x])),
  drivers: new Map(taxonomy.drivers.map((x) => [x.id, x])),
  tags: new Map(taxonomy.tags.map((x) => [x.id, x])),
  grades: new Map(taxonomy.grades.map((x) => [x.id, x])),
}

export const industryName = (id: string) => industryMap.get(id) || id
export const industryColor = (id: string) => lookups.industries.get(id)?.color || '#8b93a7'
export const gapName = (id: string) => gapMap.get(id) || id
export const gapHalfLife = (id: string) => lookups.gapTypes.get(id)?.half_life_months ?? 18
export const regionName = (id: string) => regionMap.get(id) || id
export const needName = (id: string) => needMap.get(id) || id
export const neuroName = (id: string) => neuroMap.get(id) || id
export const emotionName = (id: string) => emotionMap.get(id) || id
export const driverName = (id: string) => driverMap.get(id) || id
export const tagName = (id: string) => tagMap.get(id) || id
export const gradeName = (id: string) => lookups.grades.get(id)?.name || id

/** 自定义权重下的总分（与 docs/12 4.5 公式一致；用于详情页/方法论“演示”） */
export function weightedTotal(dimensions: Partial<Record<string, number>>, weights: Record<string, number>): number {
  let total = 0
  for (const d of taxonomy.score_dimensions) total += num(dimensions[d.id], 0) * num(weights[d.id], 0)
  return round1(total * 10)
}

export function defaultWeights(): Record<string, number> {
  return Object.fromEntries(taxonomy.score_dimensions.map((d) => [d.id, d.weight]))
}

/** 相关机会：同行业 > 同信息差 > 同需求，最多 n 条 */
export function relatedOpportunities(opp: Opportunity, n = 4): Opportunity[] {
  const scored = opportunities
    .filter((o) => o.id !== opp.id)
    .map((o) => {
      let score = 0
      if (o.industry_id === opp.industry_id) score += 3
      score += o.gap_type_ids.filter((g) => opp.gap_type_ids.includes(g)).length * 2
      score += o.human_need_ids.filter((g) => opp.human_need_ids.includes(g)).length
      return { o, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.o.scores.total - a.o.scores.total)
  return scored.slice(0, n).map((x) => x.o)
}

export { WINDOW_KEYS, WINDOW_LABEL }
