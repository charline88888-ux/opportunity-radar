/**
 * v1.5.0 统一商机评估模型
 *
 * 自动候选（Candidate）与精选机会（Opportunity）都映射到同一 `Assessment`，
 * 详情页 `AssessmentDetail` 只消费这一种模型 → 精选与候选使用同一套评估详情、同一组图表。
 */
import type { Candidate } from './candidates'
import type { Opportunity } from '@/types'
import { gapName, industryColor, industryName, regionName, taxonomy } from './data'
import { localizeNarrativeText, windowStageLabel } from './labels'
import { buildEconomics, type EconomicsModel } from './economics'
import type { Lang } from './i18n'

export type AssessmentKind = 'candidate' | 'curated'

export interface AssessmentDimension {
  key: string
  labelZh: string
  labelEn: string
  score: number
  rationale: string
  dataUsed: string
}

export interface AssessmentCanvasBlock {
  key: string
  labelZh: string
  labelEn: string
  value: unknown
}

export interface AssessmentNarrative {
  thesis: string
  market: string
  competition: string
  crossMarket: string
  timing: string
  verdict: string
}

export interface AssessmentEvidence {
  title: string
  url: string
  publisher: string
  date: string
  quote?: string
  tier?: string
}

export interface AssessmentTag {
  kind: 'industry' | 'gap' | 'region'
  id: string
  labelZh: string
  labelEn: string
}

export interface Assessment {
  id: string
  kind: AssessmentKind
  href: string
  title: string
  titleOriginal: string
  oneLiner: string
  thesis: string
  market: string
  boundary: string[]
  verdict: string
  industryId: string
  primaryIndustry: string
  industryZh: string
  industryEn: string
  industryColor: string
  gapIds: string[]
  regionIds: string[]
  eventType: string
  eventTypeZh: string
  eventTypeEn: string
  windowStage: string
  windowStageZh: string
  windowStageEn: string
  windowMonths: string
  urgency: string
  score: { total: number; grade: string }
  dimensions: AssessmentDimension[]
  confidence: number | null
  firstSeen: string
  lastSeen: string
  sourceName: string
  sourceUrl: string
  evidenceCount: number
  economics: EconomicsModel
  canvas: AssessmentCanvasBlock[]
  competition: Record<string, unknown>
  competitionRows: Array<{ key: string; labelZh: string; labelEn: string; value: unknown }>
  crossMarket: Record<string, unknown>
  timing: Record<string, unknown>
  conditions: Record<string, unknown>
  barriers: Record<string, unknown>
  execution: Record<string, unknown>
  judgment: Record<string, unknown>
  narrative: AssessmentNarrative
  evidence: AssessmentEvidence[]
  sevenQuestions: Array<{ key: string; labelZh: string; labelEn: string; value: string }>
  risks: string[]
  killCriteria: string[]
  disclaimer: string
  tags: AssessmentTag[]
  theoryNote: string
}

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
const str = (x: unknown): string => (typeof x === 'string' ? x : '')
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)

const INDUSTRY_EN: Record<string, string> = {
  pet: 'Pet economy',
  silver: 'Silver economy & health',
  emotional: 'Emotional wellness',
  ai: 'AI & productivity',
  crossborder: 'Cross-border commerce',
  content: 'Content & IP',
  education: 'Education',
  local: 'Local services',
  green: 'Green & new energy',
  compliance: 'Compliance & professional services',
  culture: 'Culture & religion',
  gaming: 'Gaming & social',
  fintech: 'Payments & fintech',
  manufacturing: 'Manufacturing',
}

const GAP_EN: Record<string, string> = {
  language: 'Language gap',
  culture: 'Culture / religion gap',
  time: 'Timing gap',
  geo: 'Geographic / market gap',
  knowledge: 'Knowledge gap',
  regulation: 'Regulatory gap',
  platform: 'Platform-rule gap',
  price: 'Price / supply-chain gap',
  channel: 'Channel / traffic gap',
  demographic: 'Demographic gap',
  emotion: 'Emotional gap',
  infrastructure: 'Infrastructure gap',
}

const REGION_EN: Record<string, string> = {
  'north-america': 'North America',
  europe: 'Europe',
  mena: 'Middle East & North Africa',
  sea: 'Southeast Asia',
  'east-asia': 'East Asia',
  'south-asia': 'South Asia',
  latam: 'Latin America',
  africa: 'Africa',
  oceania: 'Oceania',
  cis: 'CIS & Central Asia',
  china: 'Mainland China',
}

const DIM_EN: Record<string, { zh: string; en: string }> = {
  signal: { zh: '信号强度', en: 'Signal strength' },
  gap: { zh: '信息差窗口', en: 'Information gap' },
  feasibility: { zh: '个人可执行性', en: 'Feasibility' },
  economics: { zh: '回报空间', en: 'Economics' },
  timing: { zh: '时机窗口', en: 'Timing' },
  competition: { zh: '竞争与壁垒', en: 'Competition' },
  risk: { zh: '风险可控性', en: 'Risk' },
  fit: { zh: '人群适配度', en: 'Fit' },
  evidence: { zh: '证据可信度', en: 'Evidence' },
  leverage: { zh: '杠杆放大', en: 'Leverage' },
}

const CANVAS_BLOCKS: Array<{ key: string; zh: string; en: string }> = [
  { key: 'customer_segments', zh: '客户细分', en: 'Customer segments' },
  { key: 'value_proposition', zh: '价值主张', en: 'Value proposition' },
  { key: 'channels', zh: '渠道', en: 'Channels' },
  { key: 'customer_relationships', zh: '客户关系', en: 'Customer relationships' },
  { key: 'revenue_streams', zh: '收入来源', en: 'Revenue streams' },
  { key: 'key_resources', zh: '核心资源', en: 'Key resources' },
  { key: 'key_activities', zh: '关键活动', en: 'Key activities' },
  { key: 'key_partners', zh: '重要伙伴', en: 'Key partners' },
  { key: 'cost_structure', zh: '成本结构', en: 'Cost structure' },
]

const COMPETITION_FIELDS: Array<{ key: string; zh: string; en: string; aliases?: string[] }> = [
  { key: 'direct', zh: '直接竞品', en: 'Direct competitors', aliases: ['direct_competitors'] },
  { key: 'indirect', zh: '间接竞品', en: 'Indirect competitors', aliases: ['indirect_competitors'] },
  { key: 'substitutes', zh: '替代方案', en: 'Substitutes', aliases: ['alternatives'] },
  { key: 'differentiation', zh: '差异化', en: 'Differentiation' },
  { key: 'moat', zh: '护城河', en: 'Moat' },
  { key: 'positioning', zh: '定位', en: 'Positioning' },
]

export const SEVEN_QUESTION_LABELS: Record<string, { zh: string; en: string }> = {
  traffic: { zh: '流量 / 获客入口', en: 'Traffic / acquisition' },
  money: { zh: '赚钱方式', en: 'How money is made' },
  model: { zh: '交付模型', en: 'Delivery model' },
  roi: { zh: '投入与回报', en: 'Investment & return' },
  audience: { zh: '目标人群', en: 'Audience' },
  drivers: { zh: '驱动因子', en: 'Drivers' },
  moat: { zh: '壁垒 / 风险', en: 'Moat / risks' },
}

export const EVENT_EN: Record<string, string> = {
  policy: 'Policy / regulatory window',
  funding: 'Funding',
  launch: 'Launch',
  partnership: 'Partnership',
  demand: 'Demand shift',
  cost: 'Cost shift',
  market: 'Market shift',
}

function flatten(value: unknown, depth = 0): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (depth > 3) return ''
  if (Array.isArray(value)) return value.map((x) => flatten(x, depth + 1)).filter(Boolean).join('；')
  if (isObj(value)) return Object.values(value).map((x) => flatten(x, depth + 1)).filter(Boolean).join('；')
  return ''
}

function firstText(...values: unknown[]): string {
  for (const v of values) {
    const text = flatten(v).trim()
    if (text) return text
  }
  return ''
}

function toArrayText(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/[；;\n]/).map((x) => x.trim()).filter(Boolean)
  if (Array.isArray(value)) return value.map((x) => flatten(x).trim()).filter(Boolean)
  if (isObj(value)) return Object.values(value).map((x) => flatten(x).trim()).filter(Boolean)
  return []
}

function localize(text: string, lang: Lang): string {
  return localizeNarrativeText(text, lang)
}

function dimensionRows(raw: Obj, rationaleSource: unknown, lang: Lang): AssessmentDimension[] {
  const source = isObj(rationaleSource) ? rationaleSource : {}
  const scoreSource = isObj(raw.dimensions) ? raw.dimensions : {}
  const rationaleById: Record<string, Obj> = {}
  const rawRationale = source.dimensions
  if (Array.isArray(rawRationale)) {
    rawRationale.filter(isObj).forEach((x) => {
      const key = str(x.id) || str(x.key)
      if (key) rationaleById[key] = x
    })
  } else if (isObj(rawRationale)) {
    Object.entries(rawRationale).forEach(([key, value]) => {
      if (isObj(value)) rationaleById[key] = value
    })
  }
  return taxonomy.score_dimensions.map((d) => {
    const item = rationaleById[d.id] || null
    const score = (item ? num(item.score) ?? num(item.value) : null) ?? num(scoreSource[d.id])
    const rationale = item ? firstText(item.rationale, item.reason) : ''
    const dataUsed = item ? toArrayText(item.data_used).join('；') : ''
    const def = DIM_EN[d.id] || { zh: d.name, en: d.id }
    return {
      key: d.id,
      labelZh: def.zh || d.name,
      labelEn: def.en,
      score: score ?? 0,
      rationale: rationale || (lang === 'en' ? '' : '综合公开信号与市场结构自动评估'),
      dataUsed,
    }
  })
}

function canvasBlocks(raw: unknown): AssessmentCanvasBlock[] {
  if (!isObj(raw)) return []
  return CANVAS_BLOCKS.map((b) => ({
    key: b.key,
    labelZh: b.zh,
    labelEn: b.en,
    value: raw[b.key],
  })).filter((b) => b.value != null && flatten(b.value).trim() !== '')
}

function competitionRows(raw: unknown): Array<{ key: string; labelZh: string; labelEn: string; value: unknown }> {
  if (!isObj(raw)) return []
  return COMPETITION_FIELDS.map((f) => {
    const keys = [f.key, ...(f.aliases || [])]
    const value = keys.map((k) => raw[k]).find((v) => v != null)
    return { key: f.key, labelZh: f.zh, labelEn: f.en, value }
  }).filter((x) => x.value != null && flatten(x.value).trim() !== '')
}

function narrativeOf(raw: unknown, fallbackThesis: string, fallbackMarket: string, fallbackVerdict: string): AssessmentNarrative {
  const n = isObj(raw) ? raw : {}
  return {
    thesis: firstText(n.thesis) || fallbackThesis,
    market: firstText(n.market) || fallbackMarket,
    competition: firstText(n.competition),
    crossMarket: firstText(n.cross_market) || firstText(n.crossMarket),
    timing: firstText(n.timing),
    verdict: firstText(n.verdict) || fallbackVerdict,
  }
}

function sevenQuestionsOf(raw: unknown): Array<{ key: string; labelZh: string; labelEn: string; value: string }> {
  const q = isObj(raw) ? raw : {}
  const order = ['traffic', 'money', 'model', 'roi', 'audience', 'drivers', 'moat']
  const entries = order.map((key) => {
    const value = flatten(q[key])
    const label = SEVEN_QUESTION_LABELS[key]
    return { key, labelZh: label.zh, labelEn: label.en, value }
  })
  // 兼容七问以数组形式存储的数据
  for (const x of arr(raw)) {
    if (!isObj(x)) continue
    const key = str(x.key) || `q${entries.length + 1}`
    const label = SEVEN_QUESTION_LABELS[key]
    entries.push({ key, labelZh: label?.zh || key, labelEn: label?.en || key, value: flatten(x.value) || flatten(x.answer) })
  }
  return entries.filter((x) => x.value)
}

function tagsOf(industryId: string, gapIds: string[], regionIds: string[]): AssessmentTag[] {
  const tags: AssessmentTag[] = []
  if (industryId) tags.push({ kind: 'industry', id: industryId, labelZh: industryName(industryId), labelEn: INDUSTRY_EN[industryId] || industryId })
  gapIds.slice(0, 3).forEach((id) => tags.push({ kind: 'gap', id, labelZh: gapName(id), labelEn: GAP_EN[id] || id }))
  regionIds.slice(0, 3).forEach((id) => tags.push({ kind: 'region', id, labelZh: regionName(id), labelEn: REGION_EN[id] || id }))
  return tags
}

const THEORY_NOTE =
  '投资拆项、单位经济、回本周期与敏感性均为理论测算（非实盘验证），用于快速判断商业模式是否成立；实际成本、单量与回本以你所在市场的真实报价和成交为准。'

const WINDOW_STAGE_LABELS: Record<string, { zh: string; en: string }> = {
  open: { zh: '窗口打开', en: 'Window open' },
  peak: { zh: '窗口鼎盛', en: 'Window peak' },
  closing: { zh: '窗口收窄', en: 'Window narrowing' },
  closed: { zh: '窗口关闭', en: 'Window closed' },
  '窗口打开': { zh: '窗口打开', en: 'Window open' },
  '窗口鼎盛': { zh: '窗口鼎盛', en: 'Window peak' },
  '窗口收窄': { zh: '窗口收窄', en: 'Window narrowing' },
  '窗口关闭': { zh: '窗口关闭', en: 'Window closed' },
}

export function windowStageLabels(raw: string): { zh: string; en: string } {
  if (WINDOW_STAGE_LABELS[raw]) return WINDOW_STAGE_LABELS[raw]
  return { zh: windowStageLabel(raw, 'zh'), en: windowStageLabel(raw, 'en') }
}

const URGENCY_LABELS: Record<string, { zh: string; en: string }> = {
  low: { zh: '低', en: 'Low' },
  medium: { zh: '中', en: 'Medium' },
  high: { zh: '高', en: 'High' },
  '低': { zh: '低', en: 'Low' },
  '中': { zh: '中', en: 'Medium' },
  '高': { zh: '高', en: 'High' },
}

export function urgencyLabel(raw: string, lang: Lang): string {
  const hit = URGENCY_LABELS[raw]
  if (!hit) return raw
  return lang === 'en' ? hit.en : hit.zh
}

function eventTypeLabels(raw: string): { zh: string; en: string } {
  const map: Record<string, { zh: string; en: string }> = {
    policy: { zh: '政策 / 监管窗口', en: 'Policy / regulatory window' },
    funding: { zh: '融资', en: 'Funding' },
    launch: { zh: '新品 / 上线', en: 'Launch' },
    partnership: { zh: '合作', en: 'Partnership' },
    demand: { zh: '需求变化', en: 'Demand shift' },
    cost: { zh: '成本变化', en: 'Cost shift' },
    market: { zh: '市场变化', en: 'Market shift' },
    '需求变化': { zh: '需求变化', en: 'Demand shift' },
    '政策/监管窗口': { zh: '政策 / 监管窗口', en: 'Policy / regulatory window' },
    '成本变化': { zh: '成本变化', en: 'Cost shift' },
    '市场变化': { zh: '市场变化', en: 'Market shift' },
  }
  return map[raw] || { zh: raw, en: EVENT_EN[raw] || raw }
}

/* ------------------------------------------------------------------ */
/* 候选 → Assessment                                                   */
/* ------------------------------------------------------------------ */

export function buildCandidateAssessment(c: Candidate): Assessment {
  const judgment = isObj(c.judgment) ? c.judgment : {}
  const narrativeRaw = isObj(c.analyst_narrative) ? c.analyst_narrative : {}
  const seven = c.seven_questions
  const sevenFlat = isObj(seven) ? seven : {}
  const oneLiner = c.one_liner_zh || c.one_liner
  const thesis = firstText(narrativeRaw.thesis, judgment.why_opportunity, oneLiner)
  const market = firstText(narrativeRaw.market, isObj(c.business_canvas) ? c.business_canvas.customer_segments : '')
  const boundary = toArrayText(judgment.not_opportunity_if).concat(c.gap_inference ? [] : []).slice(0, 6)
  const verdict = firstText(narrativeRaw.verdict, judgment.why_opportunity, oneLiner)
  const industryId = c.primary_industry || c.industry_ids[0] || ''
  const eventType = str(judgment.event_type)
  const eventLabels = eventTypeLabels(eventType)
  const windowStageRaw = str(isObj(c.timing) ? c.timing.window_stage : '') || str(c.raw?.window_stage) || 'open'
  const stageLabels = windowStageLabels(windowStageRaw)
  const windowStageZh = stageLabels.zh
  const windowStageEn = stageLabels.en
  const windowMonths = firstText(isObj(c.timing) ? c.timing.window_months : '', c.raw?.window_months)
  const urgency = str(isObj(c.timing) ? c.timing.urgency : '')
  const economics = buildEconomics({
    roi: c.roi,
    investmentBreakdown: c.investment_breakdown,
    unitEconomics: c.unit_economics,
    profitModel: c.profit_model,
    conditions: c.conditions,
    industryId,
    priceTexts: [
      oneLiner,
      c.one_liner,
      flatten(sevenFlat.money),
      flatten(sevenFlat.roi),
      flatten(sevenFlat.model),
      isObj(c.profit_model) ? flatten(c.profit_model.pricing_range) : '',
    ],
    preferTextAov: false,
  })
  const evidence: AssessmentEvidence[] = c.evidence.map((e) => ({ title: e.title || e.url || '', url: e.url || '', publisher: e.publisher || '', date: e.date || '', quote: '', tier: undefined }))
  const score = c.scores
  return {
    id: c.candidate_id,
    kind: 'candidate',
    href: `/candidates/${c.candidate_id}`,
    title: c.title_zh || c.title,
    titleOriginal: c.title_original || c.source.raw_title || '',
    oneLiner,
    thesis,
    market,
    boundary: boundary.length ? boundary : toArrayText(isObj(c.barriers) ? c.barriers.regulatory : '').slice(0, 5),
    verdict,
    industryId,
    primaryIndustry: industryId,
    industryZh: industryName(industryId),
    industryEn: INDUSTRY_EN[industryId] || industryId,
    industryColor: industryColor(industryId),
    gapIds: c.gap_type_ids,
    regionIds: c.region_ids,
    eventType,
    eventTypeZh: eventLabels.zh,
    eventTypeEn: eventLabels.en,
    windowStage: windowStageRaw,
    windowStageZh,
    windowStageEn,
    windowMonths,
    urgency,
    score: { total: score.total, grade: score.grade },
    dimensions: dimensionRows(
      { dimensions: score.dimensions || {} },
      judgment,
      'zh',
    ),
    confidence: c.confidence ?? null,
    firstSeen: c.first_seen,
    lastSeen: c.last_seen,
    sourceName: c.source.name || c.source.id || '',
    sourceUrl: c.source.url || '',
    evidenceCount: evidence.length,
    economics,
    canvas: canvasBlocks(c.business_canvas),
    competition: isObj(c.competition) ? c.competition : {},
    competitionRows: competitionRows(c.competition),
    crossMarket: isObj(c.cross_market) ? c.cross_market : {},
    timing: isObj(c.timing) ? c.timing : {},
    conditions: isObj(c.conditions) ? c.conditions : {},
    barriers: isObj(c.barriers) ? c.barriers : {},
    execution: isObj(c.execution_plan) ? c.execution_plan : {},
    judgment,
    narrative: narrativeOf(narrativeRaw, thesis, market, verdict),
    evidence,
    sevenQuestions: sevenQuestionsOf(c.seven_questions),
    risks: toArrayText(isObj(c.barriers) ? c.barriers.regulatory : ''),
    killCriteria: [],
    disclaimer: c.disclaimer,
    tags: tagsOf(industryId, c.gap_type_ids, c.region_ids),
    theoryNote: THEORY_NOTE,
  }
}

/* ------------------------------------------------------------------ */
/* 精选机会 → Assessment                                               */
/* ------------------------------------------------------------------ */

export function buildOpportunityAssessment(o: Opportunity): Assessment {
  const judgment = isObj(o.judgment) ? o.judgment : {}
  const narrativeRaw = isObj(o.analyst_narrative) ? o.analyst_narrative : {}
  const canvasRaw = isObj(o.business_canvas) ? o.business_canvas : {}
  const oneLiner = o.one_liner
  const thesis = firstText(narrativeRaw.thesis, judgment.why_opportunity, o.signal.summary)
  const market = firstText(narrativeRaw.market, canvasRaw.customer_segments, o.signal.summary)
  const boundary = toArrayText(judgment.not_opportunity_if)
  const verdict = firstText(narrativeRaw.verdict, judgment.why_opportunity, oneLiner)
  const eventType = str(judgment.event_type)
  const eventLabels = eventTypeLabels(eventType)
  const timing = isObj(o.timing) ? o.timing : {}
  const windowStageRaw = str(timing.window_stage) || o.window.status
  const windowMonths = firstText(timing.window_months, `${o.window.months_left}`)
  const economics = buildEconomics({
    roi: o.roi,
    investmentBreakdown: o.investment_breakdown,
    unitEconomics: o.unit_economics,
    profitModel: o.profit_model,
    conditions: o.conditions,
    industryId: o.industry_id,
    priceTexts: [
      oneLiner,
      flatten(o.seven_questions.money),
      flatten(o.seven_questions.roi),
      flatten(o.seven_questions.model),
      flatten(isObj(o.profit_model) ? o.profit_model.pricing_range : ''),
      o.signal.summary,
    ],
    preferTextAov: false,
  })
  const evidence: AssessmentEvidence[] = o.signal.evidence.map((e) => ({
    title: e.title,
    url: e.url,
    publisher: e.publisher,
    date: e.date,
    quote: e.quote,
    tier: e.tier,
  }))
  return {
    id: o.id,
    kind: 'curated',
    href: `/opportunities/${o.id}`,
    title: o.title,
    titleOriginal: '',
    oneLiner,
    thesis,
    market,
    boundary: boundary.length ? boundary : [...o.risks, ...o.kill_criteria].slice(0, 6),
    verdict,
    industryId: o.industry_id,
    primaryIndustry: o.industry_id,
    industryZh: industryName(o.industry_id),
    industryEn: INDUSTRY_EN[o.industry_id] || o.industry_id,
    industryColor: industryColor(o.industry_id),
    gapIds: o.gap_type_ids,
    regionIds: o.region_ids,
    eventType,
    eventTypeZh: eventLabels.zh,
    eventTypeEn: eventLabels.en,
    windowStage: windowStageRaw,
    windowStageZh: windowStageLabels(windowStageRaw).zh,
    windowStageEn: windowStageLabels(windowStageRaw).en,
    windowMonths,
    urgency: str(timing.urgency),
    score: { total: o.scores.total, grade: o.scores.grade },
    dimensions: dimensionRows({ dimensions: o.scores.dimensions as unknown as Obj }, judgment, 'zh'),
    confidence: null,
    firstSeen: o.first_seen,
    lastSeen: o.last_activity,
    sourceName: o.origin_country || '',
    sourceUrl: '',
    evidenceCount: evidence.length,
    economics,
    canvas: canvasBlocks(o.business_canvas),
    competition: isObj(o.competition) ? o.competition : {},
    competitionRows: competitionRows(o.competition),
    crossMarket: isObj(o.cross_market) ? o.cross_market : {},
    timing,
    conditions: isObj(o.conditions) ? o.conditions : {},
    barriers: isObj(o.barriers) ? o.barriers : {},
    execution: isObj(o.execution_plan) ? o.execution_plan : {},
    judgment,
    narrative: narrativeOf(narrativeRaw, thesis, market, verdict),
    evidence,
    sevenQuestions: sevenQuestionsOf(o.seven_questions),
    risks: o.risks,
    killCriteria: o.kill_criteria,
    disclaimer: o.disclaimer,
    tags: tagsOf(o.industry_id, o.gap_type_ids, o.region_ids),
    theoryNote: THEORY_NOTE,
  }
}

/* ------------------------------------------------------------------ */
/* 展示辅助                                                            */
/* ------------------------------------------------------------------ */

export function textOf(value: unknown): string {
  return flatten(value)
}

export function labelOf(kind: 'gap' | 'region' | 'industry', id: string, lang: Lang): string {
  if (kind === 'industry') return lang === 'en' ? INDUSTRY_EN[id] || id : industryName(id)
  if (kind === 'gap') return lang === 'en' ? GAP_EN[id] || id : gapName(id)
  return lang === 'en' ? REGION_EN[id] || id : regionName(id)
}

export function localizedText(text: string, lang: Lang): string {
  return localize(text, lang)
}

export function assessmentTitle(a: Assessment): string {
  return a.title
}

export function sevenLabel(key: string, lang: Lang): string {
  const hit = SEVEN_QUESTION_LABELS[key]
  if (!hit) return key
  return lang === 'en' ? hit.en : hit.zh
}
