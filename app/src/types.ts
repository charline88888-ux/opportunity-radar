/**
 * 机会雷达 · 数据契约类型（对应 docs/12-数据契约与字段字典.md，data-v0.1.0）
 * 前端只读 data/*.json（构建期由 scripts/sync-data.mjs 同步到 src/data/）。
 * 所有类型宽松可选之处均为了“字段缺失时降级展示、不白屏”。
 */

export type Compliance = 'green' | 'yellow' | 'red'
export type AccessMode = 'api' | 'rss' | 'html' | 'manual' | 'paid-api'
export type Frequency = 'realtime' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'manual'
export type Cost = 'free' | 'freemium' | 'paid'
export type WindowStatus = 'open' | 'peak' | 'closing' | 'closed'
export type Decay = 'slow' | 'medium' | 'fast'
export type GradeId = 'S' | 'A' | 'B' | 'C' | 'D'
export type ChangeType = 'up' | 'down' | 'new' | 'flat'
export type EvidenceTier = 'primary' | 'secondary' | 'marketing'
export type EffortLevel = 'full' | 'side' | 'solo'
export type TrendDirection = 'up' | 'flat' | 'down'

export interface TaxonomyMeta {
  data_version?: string
  app_version?: string
  as_of?: string
  count?: number
  counts?: Record<string, number>
  generator?: string
  window_rules?: string
  mock?: boolean
  [key: string]: unknown
}

export interface Industry {
  id: string
  name: string
  color: string
  icon?: string
  desc?: string
}

export interface HumanNeed {
  id: string
  name: string
  layer?: string
  desc?: string
  typical_emotions?: string[]
  neuro_drivers?: string[]
}

export interface NeuroDriver {
  id: string
  name: string
  theme?: string
  desc?: string
  triggers?: string[]
}

export interface Emotion {
  id: string
  name: string
  polarity?: string
  desc?: string
}

export interface GapType {
  id: string
  name: string
  desc?: string
  half_life_months?: number
}

export interface Driver {
  id: string
  name: string
  desc?: string
}

export interface BusinessModel {
  id: string
  name: string
  desc?: string
}

export interface Region {
  id: string
  name: string
  short?: string
  desc?: string
}

export interface ScoreDimension {
  id: string
  name: string
  weight: number
  desc?: string
  anchors?: Record<string, string>
}

export interface Tag {
  id: string
  name: string
  desc?: string
}

export interface Grade {
  id: GradeId | string
  name: string
  min: number
  desc?: string
}

export interface Taxonomy {
  meta: TaxonomyMeta
  industries: Industry[]
  human_needs: HumanNeed[]
  neuro_drivers: NeuroDriver[]
  emotions: Emotion[]
  gap_types: GapType[]
  drivers: Driver[]
  business_models: BusinessModel[]
  regions: Region[]
  score_dimensions: ScoreDimension[]
  tags: Tag[]
  grades: Grade[]
}

export interface Evidence {
  title: string
  publisher: string
  url: string
  date: string
  quote: string
  lang?: string
  tier?: EvidenceTier
}

export interface Signal {
  summary: string
  evidence: Evidence[]
  signal_strength: number
  trend_direction: TrendDirection
  volume_estimate: string
}

export interface SevenQuestions {
  traffic: string
  money: string
  model: string
  roi: string
  audience: string
  drivers: string[]
  moat: string
}

export interface CnyRange {
  min: number
  max: number
}

export interface Roi {
  capital_cny: CnyRange
  time_to_revenue_months: number
  payback_months: number
  monthly_revenue_cny: CnyRange
  gross_margin_pct: number
  effort_level: EffortLevel
  team_size: number
}

export interface ScoreDimensions {
  signal: number
  gap: number
  feasibility: number
  economics: number
  timing: number
  competition: number
  risk: number
  fit: number
  evidence: number
  leverage: number
  [key: string]: number
}

export interface Scores {
  dimensions: ScoreDimensions
  total: number
  grade: GradeId | string
}

export interface OpportunityWindow {
  status: WindowStatus
  months_left: number
  decay: Decay
}

export interface Opportunity {
  id: string
  slug: string
  title: string
  one_liner: string
  industry_id: string
  gap_type_ids: string[]
  region_ids: string[]
  origin_country: string
  target_countries: string[]
  human_need_ids: string[]
  neuro_drivers: string[]
  emotion_tags: string[]
  source_langs: string[]
  signal: Signal
  seven_questions: SevenQuestions
  roi: Roi
  scores: Scores
  window: OpportunityWindow
  risks: string[]
  first_steps_7d: string[]
  kill_criteria: string[]
  compliance_notes: string
  evidence_count: number
  activity_dates: string[]
  first_seen: string
  last_activity: string
  momentum: number
  rank_score: number
  tags: string[]
  verified: boolean
  disclaimer: string
}

export interface RankingItem {
  opp_id: string
  rank: number
  rank_score: number
  total: number
  delta: number | null
  change: ChangeType
}

export interface RankingWindow {
  key: string
  label: string
  delta_basis?: DeltaBasis
  items: RankingItem[]
}

export type WindowKey = 'day' | 'week' | 'month' | 'year'

export type DeltaBasis = 'history' | 'adjacent-window'

export interface RankingsMeta extends TaxonomyMeta {
  delta_basis?: DeltaBasis
  history_as_of?: string | null
  tie_breaker?: string
  snapshot_at?: string
  reconstructed?: boolean
}

export interface Rankings {
  meta: RankingsMeta
  windows: Record<WindowKey, RankingWindow>
}

/** sync-data.mjs 生成的 history 快照元信息（v0.2.0 可选） */
export interface HistorySnapshotMeta {
  file: string
  date: string
  data_version?: string
  as_of?: string
  snapshot_at?: string | null
  reconstructed?: boolean
  delta_basis?: string | null
  window_counts?: Record<string, number>
}

export interface HistoryMeta {
  available: boolean
  count: number
  latest_date?: string | null
  history_as_of?: string | null
  snapshots: HistorySnapshotMeta[]
  note?: string
}

/** data/source-health.json（v0.2.0 可选，真实 --fetch 后生成） */
export interface SourceHealthEntry {
  id: string
  name?: string
  ok: boolean
  checked_at?: string
  latency_ms?: number
  http_status?: number | null
  error?: string | null
  note?: string | null
  consecutive_failures?: number
  category?: string
  items?: number
  signals?: number
  cached?: boolean
  access?: string
  compliance?: string
  [key: string]: unknown
}

export interface SourceHealth {
  available: boolean
  checked_at?: string | null
  total: number
  ok_count: number
  fail_count: number
  sources: SourceHealthEntry[]
  meta?: TaxonomyMeta
  note?: string
}

export interface StatsKpi {
  total_opps: number
  new_today: number
  grade_a_plus: number
  industries_covered: number
  regions_covered: number
  avg_total: number
  new_week?: number
  new_month?: number
}

export interface StatsBucket {
  id: string
  name?: string
  count: number
  avg_total?: number
  avg_rank_score?: number
}

export interface TrendPoint {
  date: string
  new_count: number
  active_count?: number
  avg_score: number
}

export interface Stats {
  meta?: TaxonomyMeta
  kpi: StatsKpi
  by_industry: StatsBucket[]
  by_gap_type: StatsBucket[]
  by_region: StatsBucket[]
  by_need: StatsBucket[]
  score_histogram: number[]
  trend_14d: TrendPoint[]
  open_window_value_cny?: number
}

export interface Source {
  id: string
  name: string
  url: string
  regions: string[]
  signal_types: string[]
  access: AccessMode
  frequency: Frequency
  cost: Cost
  compliance: Compliance
  value_score: number
  notes: string
}

export interface SourceCategory {
  id: string
  name: string
  desc?: string
  sources: Source[]
}

export interface Sources {
  meta: TaxonomyMeta
  categories: SourceCategory[]
}

export interface Playbook {
  id: string
  name: string
  purpose: string
  human_need_ids: string[]
  emotion_ids: string[]
  time_box_min: number
  frequency: string
  platforms: string[]
  steps: string[]
  keywords: string[]
  output: string
  quality_checks: string[]
}

export interface Playbooks {
  meta: TaxonomyMeta
  playbooks: Playbook[]
}

export type CalendarType =
  | 'religious'
  | 'festival'
  | 'tax'
  | 'school'
  | 'fiscal'
  | 'shopping'
  | 'national'

export interface CalendarEvent {
  date: string
  end_date?: string
  name: string
  region_ids: string[]
  type: CalendarType
  lead_time_days: number
  themes: string[]
  notes: string
}

export interface CalendarData {
  meta: TaxonomyMeta
  events: CalendarEvent[]
}

/** 由 sync-data.mjs 生成的同步元信息 */
export interface DataValidationCheck {
  level: 'PASS' | 'FAIL' | string
  name: string
  detail: string
}

export interface DataMeta {
  source?: 'real' | 'mock' | 'mixed'
  files?: Record<string, 'real' | 'mock'>
  synced_at?: string
  data_version?: string
  as_of?: string
  delta_basis?: DeltaBasis
  history_as_of?: string | null
  mock_files?: string[]
  counts?: Record<string, unknown>
  optional?: {
    history?: {
      available: boolean
      count: number
      latest_date?: string | null
      history_as_of?: string | null
      snapshots?: HistorySnapshotMeta[]
    }
    source_health?: { available: boolean; checked_at?: string | null; total?: number; ok?: number; failed?: number }
  }
  validation?: { passed: number; failed: number; checks: DataValidationCheck[] }
  notes?: string
}

export interface DataBundle {
  taxonomy: Taxonomy
  opportunities: Opportunity[]
  rankings: Rankings
  sources: Sources
  playbooks: Playbooks
  calendar: CalendarData
  stats: Stats
  meta: DataMeta
}
