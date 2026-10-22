import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import dayjs from 'dayjs'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
export const round1 = (n: number) => Math.round(n * 10) / 10
export const round2 = (n: number) => Math.round(n * 100) / 100

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('zh-CN').format(Math.round(n))
}

export function fmtCny(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e8) return `${(n / 1e8).toFixed(2)} 亿`
  if (abs >= 1e4) return `${(n / 1e4).toFixed(abs >= 1e6 ? 0 : 1)} 万`
  return fmtInt(n)
}

export function fmtCnyFull(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return `¥${fmtInt(n)}`
}

/** 统一单位的金额区间：¥3,000–8,000 / ¥1.0–3.0 万 / ¥1.20–3.50 亿 */
export function fmtCnyRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min === null || min === undefined || max === null || max === undefined) return '—'
  if (!Number.isFinite(min) || !Number.isFinite(max)) return '—'
  const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)))
  if (max >= 1e8) return `¥${trim(min / 1e8, 2)}–${trim(max / 1e8, 2)} 亿`
  if (max >= 1e4) return `¥${trim(min / 1e4, 1)}–${trim(max / 1e4, 1)} 万`
  return `¥${fmtInt(min)}–${fmtInt(max)}`
}

export function fmtPct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return `${n.toFixed(digits)}%`
}

export function fmtScore(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return n.toFixed(1)
}

export function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const v = dayjs(d)
  return v.isValid() ? v.format('YYYY-MM-DD') : d
}

export function fmtDateCn(d?: string | null): string {
  if (!d) return '—'
  const v = dayjs(d)
  return v.isValid() ? v.format('YYYY年M月D日') : d
}

export function fmtMonthCn(d?: string | null): string {
  if (!d) return '—'
  const v = dayjs(d)
  return v.isValid() ? v.format('YYYY年M月') : d
}

export function dateRangeText(start?: string | null, end?: string | null): string {
  if (!start) return '—'
  if (!end || end === start) return fmtDate(start)
  return `${fmtDate(start)} → ${fmtDate(end)}`
}

export function isoWeekKey(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z')
  const target = new Date(date.valueOf())
  const dayNr = (date.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / 7 / 86400000)
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function shiftDate(dateStr: string, days: number): string {
  const t = Date.parse(dateStr + 'T00:00:00Z') + days * 86400000
  return new Date(t).toISOString().slice(0, 10)
}

/** 等级色（S/A/B/C/D） */
export const GRADE_HEX: Record<string, string> = {
  S: '#ffd166',
  A: '#3ddc97',
  B: '#4cc9f0',
  C: '#8b93a7',
  D: '#5a6273',
}
export const gradeColor = (grade?: string | null) => GRADE_HEX[grade || 'D'] || GRADE_HEX.D

export const GRADE_LABEL: Record<string, string> = {
  S: 'S 级 · 可重注',
  A: 'A 级 · 优先验证',
  B: 'B 级 · 观察/小试',
  C: 'C 级 · 记录',
  D: 'D 级 · 不入榜',
}

/** 合规色 */
export const COMPLIANCE_HEX: Record<string, string> = {
  green: '#3ddc97',
  yellow: '#ffb547',
  red: '#ff5d5d',
}
export const COMPLIANCE_LABEL: Record<string, string> = {
  green: '绿 · 公开允许',
  yellow: '黄 · 灰区限速',
  red: '红 · 人工浏览',
}

/** 窗口状态 */
export const WINDOW_STATUS_LABEL: Record<string, string> = {
  open: '窗口开放',
  peak: '窗口鼎盛',
  closing: '窗口收窄',
  closed: '窗口关闭',
}
export const WINDOW_STATUS_HEX: Record<string, string> = {
  open: '#3ddc97',
  peak: '#ffb547',
  closing: '#ff8f5d',
  closed: '#5a6273',
}
export const DECAY_LABEL: Record<string, string> = { slow: '慢衰减', medium: '中衰减', fast: '快衰减' }
export const TREND_LABEL: Record<string, string> = { up: '上升', flat: '走平', down: '下降' }
export const CHANGE_LABEL: Record<string, string> = { up: '上升', down: '下降', new: '新上榜', flat: '持平' }
export const EFFORT_LABEL: Record<string, string> = { full: '全职', side: '兼职可做', solo: '单人可做' }
export const ACCESS_LABEL: Record<string, string> = {
  api: 'API', rss: 'RSS', html: '网页', manual: '人工', 'paid-api': '付费 API',
}
export const FREQUENCY_LABEL: Record<string, string> = {
  realtime: '实时', daily: '每日', weekly: '每周', monthly: '每月', quarterly: '每季', yearly: '每年', manual: '人工',
}
export const COST_LABEL: Record<string, string> = { free: '免费', freemium: '免费+付费', paid: '付费' }
export const CAL_TYPE_LABEL: Record<string, string> = {
  religious: '宗教', festival: '节庆', tax: '税季', school: '开学', fiscal: '财政年', shopping: '购物节', national: '国家节日',
}
export const CAL_TYPE_HEX: Record<string, string> = {
  religious: '#f472b6',
  festival: '#ffb547',
  tax: '#4cc9f0',
  school: '#3ddc97',
  fiscal: '#8b93a7',
  shopping: '#ff5d5d',
  national: '#60a5fa',
}
export const EFFORT_ICON_LABEL: Record<string, string> = { full: '全职', side: '兼职', solo: '单人' }

/** 信号类型（扫描室矩阵用，与 sources.signal_types 对齐） */
export const SIGNAL_TYPES = [
  { id: 'complaint', name: '抱怨' },
  { id: 'wish', name: '愿望' },
  { id: 'comparison', name: '对比' },
  { id: 'tutorial', name: '教程' },
  { id: 'policy', name: '政策' },
  { id: 'hiring', name: '招聘' },
  { id: 'funding', name: '融资' },
  { id: 'price', name: '价格' },
  { id: 'community', name: '社群' },
  { id: 'ritual', name: '仪式' },
] as const

/** gap_type -> 典型信号类型（用于扫描室热力/桑基推导） */
export const GAP_SIGNAL_MAP: Record<string, string> = {
  language: 'comparison',
  culture: 'ritual',
  time: 'wish',
  geo: 'price',
  knowledge: 'tutorial',
  regulation: 'policy',
  platform: 'community',
  price: 'price',
  channel: 'comparison',
  demographic: 'hiring',
  emotion: 'complaint',
  infrastructure: 'funding',
}

export const SIGNAL_GAP_MAP: Record<string, string[]> = {
  demand: ['knowledge', 'emotion', 'language'],
  trend: ['time', 'channel', 'platform'],
  marketplace: ['price', 'geo', 'channel'],
  social: ['channel', 'culture', 'emotion'],
  policy: ['regulation', 'culture'],
  capital: ['knowledge', 'time'],
  academic: ['knowledge', 'time'],
  supply: ['price', 'geo', 'infrastructure'],
  culture: ['culture', 'language', 'time'],
  talent: ['knowledge', 'language', 'demographic'],
  data: ['demographic', 'knowledge'],
  platform: ['platform', 'infrastructure'],
}

/** 6 维霍夫斯泰德文化维度（参考值，用于跨文化假设） */
export interface CultureCountry {
  id: string
  name: string
  flag: string
  values: number[]
}
export const HOFSTEDE_DIMENSIONS = ['权力距离', '个人主义', '男性气质', '不确定性规避', '长期导向', '放纵程度']
export const HOFSTEDE_COUNTRIES: CultureCountry[] = [
  { id: 'cn', name: '中国', flag: 'CN', values: [80, 20, 66, 30, 87, 24] },
  { id: 'us', name: '美国', flag: 'US', values: [40, 91, 62, 46, 26, 68] },
  { id: 'de', name: '德国', flag: 'DE', values: [35, 67, 66, 65, 83, 40] },
  { id: 'jp', name: '日本', flag: 'JP', values: [54, 46, 95, 92, 88, 42] },
  { id: 'sa', name: '沙特', flag: 'SA', values: [80, 25, 45, 80, 36, 10] },
  { id: 'br', name: '巴西', flag: 'BR', values: [69, 38, 49, 76, 44, 59] },
  { id: 'in', name: '印度', flag: 'IN', values: [77, 48, 56, 40, 51, 26] },
  { id: 'ng', name: '尼日利亚', flag: 'NG', values: [70, 30, 60, 55, 20, 62] },
]
