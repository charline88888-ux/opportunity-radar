/**
 * v1.5.0 理论经济测算（Investment / Unit economics / Payback / Sensitivity）
 *
 * 设计原则：
 * 1. 真实数据字段优先：`investment_breakdown` / `unit_economics` / `profit_model` / `roi`；
 * 2. 字段之间冲突（如精选投资合计与 roi.capital 不一致、毛利率上下界倒置、月收入与 unit_economics 不一致）时，
 *    以「手工整理的 ROI 区间」为锚做透明校准，并在 UI 标注「理论测算 · 非实盘验证」；
 * 3. 任何派生值都由公式可复算，不编造来源；缺失字段才使用行业默认假设并在 `sources` 中标记 derived。
 *
 * 单位约定：金额 = 人民币元；比率 = 0–1；单量 = 单 / 月；回本 = 月。
 */

export interface NumRange {
  min: number
  max: number
}

export interface InvestmentItem {
  key: string
  labelZh: string
  labelEn: string
  min: number
  max: number
  share: number
  basis: string
  note?: string
}

export interface RevenueStream {
  name: string
  sharePct: number
  amountMin: number
  amountMax: number
  basis?: string
}

export interface PaybackPoint {
  month: number
  revenue: number
  grossProfit: number
  netProfit: number
  cumulative: number
  ramp: number
}

export interface SensitivityPoint {
  orders: number
  revenue: number
  grossProfit: number
  profit: number
  base?: boolean
}

export type DataOrigin = 'data' | 'calibrated' | 'derived'

export interface EconomicsSources {
  capital: DataOrigin
  investment: DataOrigin
  aov: DataOrigin
  revenue: DataOrigin
  margin: DataOrigin
  payback: DataOrigin
}

export interface EconomicsBase {
  capital: number
  aov: number
  orders: number
  revenue: number
  marginPct: number
  grossProfit: number
  fixedCost: number
  netProfit: number
  netMarginPct: number
  unitCost: number
  unitGrossProfit: number
  unitNetProfit: number
  paybackMonths: number
}

export interface EconomicsModel {
  currency: 'CNY'
  base: EconomicsBase
  ranges: {
    capital: NumRange
    aov: NumRange
    orders: NumRange
    revenue: NumRange
    marginPct: NumRange
    netProfit: NumRange
    paybackMonths: { min: number | null; max: number | null }
  }
  investment: {
    items: InvestmentItem[]
    total: NumRange
    calibrated: boolean
    basis: string
  }
  revenueStreams: RevenueStream[]
  unitCostItems: Array<{ name: string; min: number; max: number; basis?: string }>
  sensitivity: SensitivityPoint[]
  steadyCurve: PaybackPoint[]
  rampCurve: PaybackPoint[]
  monthly: PaybackPoint[]
  breakevenOrders: number
  paybackTarget: number | null
  timeToRevenue: number
  rampMonths: number
  formula: string
  assumptions: string[]
  sources: EconomicsSources
  dataNotes: string[]
}

export interface EconParams {
  aov: number
  orders: number
  marginPct: number
  fixedCost: number
}

export interface EconCalc {
  aov: number
  orders: number
  marginPct: number
  fixedCost: number
  revenue: number
  grossProfit: number
  netProfit: number
  netMarginPct: number
  unitCost: number
  unitGrossProfit: number
  unitNetProfit: number
  unitFixedCost: number
  breakevenOrders: number
  paybackMonths: number
  rampPaybackMonths: number | null
  monthly: PaybackPoint[]
  steadyCurve: PaybackPoint[]
  rampCurve: PaybackPoint[]
  sensitivity: SensitivityPoint[]
}

type Obj = Record<string, unknown>

const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
const str = (x: unknown): string => (typeof x === 'string' ? x : '')

function num(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x
  if (typeof x === 'string') {
    const cleaned = x.replace(/[,\s]/g, '').replace(/[¥￥$%]/g, '')
    if (cleaned && Number.isFinite(Number(cleaned))) return Number(cleaned)
  }
  return null
}

function rangeOf(x: unknown): NumRange | null {
  if (!isObj(x)) return null
  const min = num(x.min) ?? num(x.min_cny) ?? num(x.minimum) ?? num(x.amount_min) ?? num(x.from)
  const max = num(x.max) ?? num(x.max_cny) ?? num(x.maximum) ?? num(x.amount_max) ?? num(x.to)
  if (min == null || max == null) return null
  return { min: Math.min(min, max), max: Math.max(min, max) }
}

const round = (n: number, digits = 0): number => {
  const f = 10 ** digits
  return Math.round(n * f) / f
}
const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))
const mid = (r: NumRange): number => (r.min + r.max) / 2
const geo = (r: NumRange): number => {
  if (r.min > 0 && r.max > 0) return Math.sqrt(r.min * r.max)
  return mid(r)
}

/* ------------------------------------------------------------------ */
/* 行业默认客单价（仅在机会文案/数据字段都没有价格时兜底，UI 会标注 derived） */
/* ------------------------------------------------------------------ */

const INDUSTRY_AOV: Record<string, NumRange> = {
  pet: { min: 300, max: 1500 },
  silver: { min: 800, max: 5000 },
  emotional: { min: 200, max: 1200 },
  ai: { min: 99, max: 999 },
  crossborder: { min: 100, max: 800 },
  content: { min: 99, max: 699 },
  education: { min: 300, max: 3000 },
  local: { min: 100, max: 800 },
  green: { min: 3000, max: 30000 },
  compliance: { min: 3000, max: 30000 },
  culture: { min: 120, max: 900 },
  gaming: { min: 30, max: 300 },
  fintech: { min: 1000, max: 20000 },
  manufacturing: { min: 5000, max: 80000 },
}
const DEFAULT_AOV: NumRange = { min: 300, max: 3000 }

/* ------------------------------------------------------------------ */
/* 投资拆项：9 类默认占比（数据缺失时兜底；UI 会标注 derived）              */
/* ------------------------------------------------------------------ */

export const INVESTMENT_KEYS = [
  'compliance',
  'inventory',
  'channels',
  'logistics',
  'tools',
  'marketing',
  'labor',
  'working_capital',
  'reserve',
] as const
export type InvestmentKey = (typeof INVESTMENT_KEYS)[number]

const INVESTMENT_LABELS: Record<string, { zh: string; en: string }> = {
  registration: { zh: '注册/合规', en: 'Registration & compliance' },
  compliance: { zh: '注册/合规/资质', en: 'Registration & compliance' },
  inventory: { zh: '首批库存/样品', en: 'First inventory & samples' },
  channels: { zh: '平台/渠道开通', en: 'Platform & channel setup' },
  platform: { zh: '平台/渠道开通', en: 'Platform & channel setup' },
  logistics: { zh: '物流仓储', en: 'Logistics & warehousing' },
  warehouse: { zh: '物流仓储', en: 'Logistics & warehousing' },
  tools: { zh: '工具/软件', en: 'Tools & software' },
  software: { zh: '工具/软件', en: 'Tools & software' },
  marketing: { zh: '市场推广', en: 'Marketing' },
  labor: { zh: '人力/外包', en: 'Labor & outsourcing' },
  hr: { zh: '人力/外包', en: 'Labor & outsourcing' },
  working_capital: { zh: '流动资金', en: 'Working capital' },
  reserve: { zh: '预备金', en: 'Contingency reserve' },
}

const DEFAULT_SHARES: Record<string, number> = {
  compliance: 8,
  inventory: 30,
  channels: 12,
  logistics: 10,
  tools: 7,
  marketing: 18,
  labor: 10,
  working_capital: 3,
  reserve: 2,
}

const INDUSTRY_SHARES: Record<string, Record<string, number>> = {
  fintech: { compliance: 18, inventory: 8, channels: 14, logistics: 8, tools: 12, marketing: 14, labor: 16, working_capital: 6, reserve: 4 },
  compliance: { compliance: 16, inventory: 16, channels: 10, logistics: 8, tools: 8, marketing: 14, labor: 18, working_capital: 6, reserve: 4 },
  crossborder: { compliance: 8, inventory: 32, channels: 12, logistics: 14, tools: 6, marketing: 15, labor: 7, working_capital: 4, reserve: 2 },
  manufacturing: { compliance: 6, inventory: 34, channels: 10, logistics: 14, tools: 8, marketing: 10, labor: 10, working_capital: 5, reserve: 3 },
  green: { compliance: 10, inventory: 32, channels: 10, logistics: 14, tools: 8, marketing: 10, labor: 8, working_capital: 5, reserve: 3 },
}

function itemBasis(key: string): string {
  const map: Record<string, string> = {
    registration: '营业执照/备案/资质申报/翻译公证',
    compliance: '注册、许可、认证或合规咨询',
    inventory: '首批样品/小批量库存与打样',
    channels: '平台入驻、店铺/渠道建设',
    platform: '平台入驻、店铺/渠道建设',
    logistics: '头程/仓储/退换与本地配送',
    warehouse: '头程/仓储/退换与本地配送',
    tools: '店铺/内容/数据工具订阅',
    software: '店铺/内容/数据工具订阅',
    marketing: '内容投放、达人/社群与冷启动获客',
    labor: '运营/客服/设计/外包',
    working_capital: '现金流缓冲与补货周转',
    reserve: '汇率/物流/退款等意外预备',
  }
  return map[key] || '行业默认投入口径'
}

/* ------------------------------------------------------------------ */
/* 客单价解析：从机会文案/七问中提取价格区间（中文/美元/日元/欧元）          */
/* ------------------------------------------------------------------ */

const CURRENCY: Array<{ re: RegExp; rate: number; code: string }> = [
  { re: /美元|美金|USD/gi, rate: 7.2, code: 'USD' },
  { re: /日元|JPY/gi, rate: 0.048, code: 'JPY' },
  { re: /欧元|EUR/gi, rate: 7.8, code: 'EUR' },
  { re: /人民币|RMB/gi, rate: 1, code: 'CNY' },
]

const PRICE_KEYWORD = /(客单|客单价|单价|售价|单套|单件|每件|套餐|价格|收费|定价|手续费|服务费|月费|会员费)/
const MONTHLY_AFTER = /^\s*(?:\/|每)?\s*(?:月|month)|^\s*月(?:收入|流水|营收)/
const RANGE_RE = /([0-9][0-9,.]*)\s*[–\-~至—]\s*([0-9][0-9,.]*)\s*(美元|美金|USD|日元|JPY|欧元|EUR|人民币|RMB|元)?/g

function toMoney(value: string, code: string): number {
  const n = Number(value.replace(/,/g, ''))
  if (!Number.isFinite(n)) return 0
  const rate = CURRENCY.find((c) => c.code === code)?.rate ?? 1
  return n * rate
}

/**
 * 从文本解析客单价区间（CNY）。返回最低/最高与来源片段，解析不到返回 null。
 * 仅接受带价格关键词或明确外币单位的区间，避免误把月收入/年份当客单价。
 */
export function parsePriceRange(texts: string[]): NumRange | null {
  const joined = texts.filter(Boolean).join('；')
  if (!joined) return null
  // 1) 带价格关键词的区间（可能是「客单 120–400 美元」或「套餐 599–2999 元」）
  const keywordRe = new RegExp(PRICE_KEYWORD.source + '[^。；\\n]{0,18}?' + RANGE_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = keywordRe.exec(joined))) {
    const after = joined.slice(m.index + m[0].length, m.index + m[0].length + 8)
    if (MONTHLY_AFTER.test(after)) continue
    const [, , a, b, unitRaw] = m
    const code = unitRaw ? (/(美元|美金|USD)/.test(unitRaw) ? 'USD' : /(日元|JPY)/.test(unitRaw) ? 'JPY' : /(欧元|EUR)/.test(unitRaw) ? 'EUR' : 'CNY') : 'CNY'
    const min = Math.min(toMoney(a, code), toMoney(b, code))
    const max = Math.max(toMoney(a, code), toMoney(b, code))
    if (validPrice(min, max)) return { min: round(min), max: round(max) }
  }
  // 2) 明确外币区间（不要求关键词），如「120–400 美元」「8,000–20,000 日元」
  const currencyRe = /([0-9][0-9,.]*)\s*[–\-~至—]\s*([0-9][0-9,.]*)\s*(美元|美金|USD|日元|JPY|欧元|EUR)/g
  while ((m = currencyRe.exec(joined))) {
    const after = joined.slice(m.index + m[0].length, m.index + m[0].length + 8)
    if (MONTHLY_AFTER.test(after)) continue
    const code = /(美元|美金|USD)/.test(m[3]) ? 'USD' : /(日元|JPY)/.test(m[3]) ? 'JPY' : 'EUR'
    const min = Math.min(toMoney(m[1], code), toMoney(m[2], code))
    const max = Math.max(toMoney(m[1], code), toMoney(m[2], code))
    if (validPrice(min, max)) return { min: round(min), max: round(max) }
  }
  // 3) 带人民币/元单位的区间（要求关键词在附近，避免月收入）
  const cnyRe = /([0-9][0-9,.]*)\s*[–\-~至—]\s*([0-9][0-9,.]*)\s*(?:元|人民币|RMB)/g
  const keywordIdx = joined.search(PRICE_KEYWORD)
  while ((m = cnyRe.exec(joined))) {
    if (keywordIdx < 0 || Math.abs(m.index - keywordIdx) > 40) continue
    const after = joined.slice(m.index + m[0].length, m.index + m[0].length + 8)
    if (MONTHLY_AFTER.test(after)) continue
    const min = Math.min(toMoney(m[1], 'CNY'), toMoney(m[2], 'CNY'))
    const max = Math.max(toMoney(m[1], 'CNY'), toMoney(m[2], 'CNY'))
    if (validPrice(min, max)) return { min: round(min), max: round(max) }
  }
  return null
}

function validPrice(min: number, max: number): boolean {
  if (!(min > 5) || !(max > min)) return false
  if (max > 5_000_000) return false
  if (max / min > 200) return false
  // 排除 1990–2030 这类年份区间
  if (min >= 1990 && max <= 2030) return false
  return true
}

/* ------------------------------------------------------------------ */
/* 输入与构建                                                          */
/* ------------------------------------------------------------------ */

export interface EconomicsInput {
  roi?: unknown
  investmentBreakdown?: unknown
  unitEconomics?: unknown
  profitModel?: unknown
  conditions?: unknown
  industryId?: string
  /** 客单价解析文本：一句话、七问、信号摘要等 */
  priceTexts?: string[]
  /** 精选机会文案里价格更具体时优先文案；候选默认优先真实字段 */
  preferTextAov?: boolean
  /** 缺字段时的兜底资本区间 */
  fallbackCapital?: NumRange
}

function readRoi(input: EconomicsInput): Obj {
  return isObj(input.roi) ? input.roi : {}
}

function pickCapital(roi: Obj, ib: Obj, conditions: Obj): { range: NumRange | null; origin: DataOrigin } {
  const fromRoi = rangeOf(roi.capital_cny) ?? (() => {
    const min = num(roi.capital_min)
    const max = num(roi.capital_max)
    return min != null && max != null ? { min: Math.min(min, max), max: Math.max(min, max) } : null
  })()
  if (fromRoi && fromRoi.max > 0) return { range: fromRoi, origin: 'data' }
  const fromIb = (() => {
    const min = num(ib.total_min)
    const max = num(ib.total_max)
    return min != null && max != null ? { min: Math.min(min, max), max: Math.max(min, max) } : null
  })()
  if (fromIb && fromIb.max > 0) return { range: fromIb, origin: 'data' }
  const fromConditions = rangeOf(conditions.capital_range_cny)
  if (fromConditions && fromConditions.max > 0) return { range: fromConditions, origin: 'data' }
  return { range: null, origin: 'derived' }
}

function pickMargin(roi: Obj, ue: Obj, pm: Obj): { range: NumRange; origin: DataOrigin } {
  const roiMin = num(roi.gross_margin_min)
  const roiMax = num(roi.gross_margin_max)
  if (roiMin != null && roiMax != null && roiMax > 0) {
    return { range: { min: Math.min(roiMin, roiMax) / 100, max: Math.max(roiMin, roiMax) / 100 }, origin: 'data' }
  }
  const roiPct = num(roi.gross_margin_pct)
  if (roiPct != null && roiPct > 0) return { range: { min: roiPct / 100, max: roiPct / 100 }, origin: 'data' }
  const ueRange = rangeOf(ue.gross_margin_pct)
  if (ueRange && ueRange.max > 0) {
    const a = Math.min(ueRange.min, ueRange.max) / 100
    const b = Math.max(ueRange.min, ueRange.max) / 100
    return { range: { min: clamp(a, 0.01, 0.95), max: clamp(b, 0.01, 0.95) }, origin: 'data' }
  }
  const text = str(pm.gross_margin)
  const matches = text.match(/(\d+(?:\.\d+)?)\s*%?/g)?.map((x) => Number(x.replace('%', ''))).filter(Number.isFinite) ?? []
  if (matches.length >= 2) return { range: { min: Math.min(matches[0], matches[1]) / 100, max: Math.max(matches[0], matches[1]) / 100 }, origin: 'data' }
  if (matches.length === 1) return { range: { min: matches[0] / 100, max: matches[0] / 100 }, origin: 'data' }
  return { range: { min: 0.35, max: 0.6 }, origin: 'derived' }
}

function pickRevenue(roi: Obj, ue: Obj, pm: Obj): { range: NumRange | null; origin: DataOrigin } {
  const fromRoi = rangeOf(roi.monthly_revenue_cny) ?? (() => {
    const min = num(roi.monthly_revenue_min)
    const max = num(roi.monthly_revenue_max)
    return min != null && max != null ? { min: Math.min(min, max), max: Math.max(min, max) } : null
  })()
  if (fromRoi && fromRoi.max > 0) return { range: fromRoi, origin: 'data' }
  const fromUe = rangeOf(ue.monthly_revenue)
  if (fromUe && fromUe.max > 0) return { range: fromUe, origin: 'data' }
  const fromPm = rangeOf(pm.monthly_revenue)
  if (fromPm && fromPm.max > 0) return { range: fromPm, origin: 'data' }
  return { range: null, origin: 'derived' }
}

function pickPayback(roi: Obj, ue: Obj, pm: Obj): number | null {
  const direct = num(roi.payback_months)
  if (direct != null && direct > 0) return direct
  const ueTarget = isObj(ue.payback_months) ? num(ue.payback_months.target) : num(ue.payback_months)
  if (ueTarget != null && ueTarget > 0) return ueTarget
  const pmTarget = isObj(pm.payback_months) ? num(pm.payback_months.target) : num(pm.payback_months)
  if (pmTarget != null && pmTarget > 0) return pmTarget
  return null
}

function pickTimeToRevenue(roi: Obj): number {
  const n = num(roi.time_to_revenue_months)
  return n != null && n > 0 ? clamp(n, 1, 12) : 2
}

function buildInvestment(
  ib: Obj,
  capital: NumRange,
  industryId: string,
): { items: InvestmentItem[]; total: NumRange; calibrated: boolean; basis: string; origin: DataOrigin } {
  const rawItems = arr(ib.items).filter(isObj)
  const dataTotalMin = num(ib.total_min)
  const dataTotalMax = num(ib.total_max)
  const dataTotal = dataTotalMin != null && dataTotalMax != null ? { min: Math.min(dataTotalMin, dataTotalMax), max: Math.max(dataTotalMin, dataTotalMax) } : null
  const mismatch = dataTotal ? Math.abs(dataTotal.min - capital.min) / Math.max(1, capital.min) > 0.12 || Math.abs(dataTotal.max - capital.max) / Math.max(1, capital.max) > 0.12 : false
  const calibrated = !!dataTotal && mismatch
  const fMin = calibrated && dataTotal ? capital.min / Math.max(1, dataTotal.min) : 1
  const fMax = calibrated && dataTotal ? capital.max / Math.max(1, dataTotal.max) : 1

  if (rawItems.length) {
    const items: InvestmentItem[] = rawItems.map((it, index) => {
      const key = str(it.key) || INVESTMENT_KEYS[index] || `item-${index}`
      const label = INVESTMENT_LABELS[key]
      const min = Math.max(0, round((num(it.min) ?? 0) * fMin))
      const max = Math.max(min, round((num(it.max) ?? 0) * fMax))
      return {
        key,
        labelZh: label?.zh || str(it.label) || key,
        labelEn: label?.en || str(it.label) || key,
        min,
        max,
        share: 0,
        basis: str(it.basis) || str(it.note) || itemBasis(key),
        note: str(it.note) || undefined,
      }
    })
    normalizeInvestmentItems(items, capital)
    return {
      items,
      total: capital,
      calibrated,
      basis: str(ib.basis) || (calibrated ? '分项按 ROI 启动资金区间等比校准' : '投资分项来自数据字段'),
      origin: calibrated ? 'calibrated' : 'data',
    }
  }

  // 无明细：按行业默认占比拆分（derived）
  const shares = INDUSTRY_SHARES[industryId] || DEFAULT_SHARES
  const items: InvestmentItem[] = INVESTMENT_KEYS.map((key) => {
    const label = INVESTMENT_LABELS[key]
    const share = shares[key] ?? 0
    return {
      key,
      labelZh: label.zh,
      labelEn: label.en,
      min: round(capital.min * (share / 100)),
      max: round(capital.max * (share / 100)),
      share: share / 100,
      basis: itemBasis(key),
    }
  })
  normalizeInvestmentItems(items, capital)
  return { items, total: capital, calibrated: false, basis: '行业默认投入比例（系统派生）', origin: 'derived' }
}

/** 先按占比归一，再修正四舍五入误差，保证分项合计 = 总投资 */
function normalizeInvestmentItems(items: InvestmentItem[], total: NumRange) {
  const sumMin = items.reduce((a, x) => a + x.min, 0) || 1
  const sumMax = items.reduce((a, x) => a + x.max, 0) || 1
  items.forEach((it) => {
    it.share = total.max > 0 ? it.max / total.max : it.max / sumMax
  })
  // 强制合计等于 total（优先调整最大项，避免出现 0/负数）
  const fix = (key: 'min' | 'max', target: number) => {
    const current = items.reduce((a, x) => a + x[key], 0)
    const diff = target - current
    if (Math.abs(diff) < 1) return
    const biggest = [...items].sort((a, b) => b[key] - a[key])[0]
    if (biggest) biggest[key] = Math.max(0, biggest[key] + diff)
  }
  fix('min', total.min)
  fix('max', total.max)
  // 保证 min ≤ max
  items.forEach((it) => {
    if (it.min > it.max) [it.min, it.max] = [it.max, it.min]
  })
  // 修正后重算占比（用于展示）
  const finalSum = items.reduce((a, x) => a + x.max, 0) || 1
  items.forEach((it) => (it.share = it.max / finalSum))
}

function buildRevenueStreams(pm: Obj, base: EconomicsBase): RevenueStream[] {
  const raw = arr(pm.revenue_streams).filter(isObj)
  const streams: RevenueStream[] = raw
    .map((x) => {
      const share = num(x.share_pct)
      return {
        name: str(x.name) || '主营收入',
        sharePct: share != null ? share : 0,
        amountMin: num(x.monthly_amount_min) ?? 0,
        amountMax: num(x.monthly_amount_max) ?? 0,
        basis: str(x.basis) || undefined,
      }
    })
    .filter((x) => x.name)
    .slice(0, 6)
  if (!streams.length) {
    return [{ name: '主营产品/服务收入', sharePct: 100, amountMin: base.revenue, amountMax: base.revenue, basis: '理论模型：按单一主营收入测算' }]
  }
  const total = streams.reduce((a, x) => a + (x.sharePct > 0 ? x.sharePct : 0), 0)
  if (total <= 0) {
    streams.forEach((x) => (x.sharePct = 100 / streams.length))
  } else if (Math.abs(total - 100) > 0.5) {
    streams.forEach((x) => (x.sharePct = (x.sharePct / total) * 100))
  }
  return streams
}

function buildUnitCostItems(ue: Obj, unitCost: number): Array<{ name: string; min: number; max: number; basis?: string }> {
  const cost = isObj(ue.cost_per_unit) ? ue.cost_per_unit : {}
  const items = arr(cost.items).filter(isObj)
  if (items.length) {
    return items.map((x) => ({
      name: str(x.name) || '直接成本',
      min: num(x.min) ?? 0,
      max: num(x.max) ?? num(x.min) ?? 0,
      basis: str(x.basis) || undefined,
    }))
  }
  return [{ name: '直接成本（按毛利率反推）', min: round(unitCost), max: round(unitCost) }]
}

function pickAov(
  input: EconomicsInput,
  ue: Obj,
  industryId: string,
): { range: NumRange; origin: DataOrigin } {
  const textPrice = parsePriceRange(input.priceTexts || [])
  const dataPrice = rangeOf(ue.price_per_unit) ?? rangeOf(ue.unit_price) ?? rangeOf(isObj(input.profitModel) ? input.profitModel.unit_price : undefined)
  const dataAov = dataPrice && dataPrice.max > 0 ? dataPrice : null
  if (dataAov && (!input.preferTextAov || !textPrice)) return { range: dataAov, origin: 'data' }
  if (textPrice) return { range: textPrice, origin: 'derived' } // 文案解析：理论假设
  if (dataAov) return { range: dataAov, origin: 'data' }
  return { range: INDUSTRY_AOV[industryId] || DEFAULT_AOV, origin: 'derived' }
}

export function buildEconomics(input: EconomicsInput): EconomicsModel {
  const roi = readRoi(input)
  const ib = isObj(input.investmentBreakdown) ? input.investmentBreakdown : {}
  const ue = isObj(input.unitEconomics) ? input.unitEconomics : {}
  const pm = isObj(input.profitModel) ? input.profitModel : {}
  const conditions = isObj(input.conditions) ? input.conditions : {}
  const industryId = input.industryId || ''
  const dataNotes: string[] = []

  const capitalPick = pickCapital(roi, ib, conditions)
  const capital = capitalPick.range || input.fallbackCapital || { min: 10_000, max: 50_000 }
  if (capitalPick.origin === 'derived') dataNotes.push('启动资金区间缺失，使用行业默认估算')

  const investment = buildInvestment(ib, capital, industryId)

  const marginPick = pickMargin(roi, ue, pm)
  const revenuePick = pickRevenue(roi, ue, pm)
  const aovPick = pickAov(input, ue, industryId)
  const paybackTarget = pickPayback(roi, ue, pm)
  const timeToRevenue = pickTimeToRevenue(roi)

  const aov = geo(aovPick.range)
  let revenue = revenuePick.range ? geo(revenuePick.range) : 0
  if (!revenue && revenuePick.range == null) {
    const ordersData = rangeOf(ue.monthly_orders)
    revenue = ordersData ? geo(ordersData) * aov : aov * 20
    dataNotes.push('月收入区间缺失，按客单价 × 理论单量估算')
  }
  const marginPct = mid(marginPick.range)
  const grossProfit = revenue * marginPct
  const capitalBase = geo(capital)
  let fixedCost = 0
  if (paybackTarget && paybackTarget > 0) {
    fixedCost = grossProfit - capitalBase / paybackTarget
    if (fixedCost < 0) {
      fixedCost = 0
      dataNotes.push('数据回本周期与毛利区间冲突，固定成本按 0 处理')
    }
  } else {
    const ueFixed = rangeOf(ue.monthly_fixed_cost)
    fixedCost = ueFixed ? geo(ueFixed) : Math.max(0, grossProfit * 0.45)
    if (!ueFixed) dataNotes.push('固定成本缺失，按毛利 45% 估算')
  }
  const netProfit = grossProfit - fixedCost
  const netMarginPct = revenue > 0 ? netProfit / revenue : 0
  const orders = aov > 0 ? revenue / aov : 0
  const unitCost = aov * (1 - marginPct)
  const unitGrossProfit = aov - unitCost
  const unitNetProfit = orders > 0 ? netProfit / orders : 0
  const paybackMonths = netProfit > 0 ? capitalBase / netProfit : 0

  const base: EconomicsBase = {
    capital: capitalBase,
    aov,
    orders,
    revenue,
    marginPct,
    grossProfit,
    fixedCost,
    netProfit,
    netMarginPct,
    unitCost,
    unitGrossProfit,
    unitNetProfit,
    paybackMonths,
  }

  // 区间：真实字段上下界 + 固定成本基准（保守/乐观）
  const revenueRange = revenuePick.range || { min: revenue * 0.7, max: revenue * 1.3 }
  const aovRange = aovPick.range
  const ordersRange = {
    min: aovRange.max > 0 ? revenueRange.min / aovRange.max : orders * 0.7,
    max: aovRange.min > 0 ? revenueRange.max / aovRange.min : orders * 1.3,
  }
  const netMin = revenueRange.min * marginPick.range.min - fixedCost
  const netMax = revenueRange.max * marginPick.range.max - fixedCost
  const netProfitRange = { min: round(netMin), max: round(netMax) }
  const paybackRange = {
    min: netMax > 0 ? capital.min / netMax : null,
    max: netMin > 0 ? capital.max / netMin : null,
  }

  const revenueStreams = buildRevenueStreams(pm, base)
  const unitCostItems = buildUnitCostItems(ue, unitCost)

  const model: EconomicsModel = {
    currency: 'CNY',
    base,
    ranges: {
      capital,
      aov: aovRange,
      orders: ordersRange,
      revenue: revenueRange,
      marginPct: marginPick.range,
      netProfit: netProfitRange,
      paybackMonths: paybackRange,
    },
    investment: {
      items: investment.items,
      total: capital,
      calibrated: investment.calibrated,
      basis: investment.basis,
    },
    revenueStreams,
    unitCostItems,
    sensitivity: [],
    steadyCurve: [],
    rampCurve: [],
    monthly: [],
    breakevenOrders: 0,
    paybackTarget,
    timeToRevenue,
    rampMonths: clamp(Math.round(timeToRevenue), 1, 6),
    formula:
      str(ue.formula) ||
      str(pm.formula) ||
      '毛利/单 = 客单价 − 单位成本；月收入 = 客单价 × 月单量；月净利 = 月收入 × 毛利率 − 月固定成本；回本 = 启动资金 / 月净利',
    assumptions: [
      ...(arr(ue.assumptions).filter((x): x is string => typeof x === 'string').slice(0, 6)),
      '所有金额为理论测算，不含实盘数据；客单价、单量、成本需按实际市场校准。',
    ],
    sources: {
      capital: capitalPick.origin,
      investment: investment.origin,
      aov: aovPick.origin,
      revenue: revenuePick.origin,
      margin: marginPick.origin,
      payback: paybackTarget ? 'data' : 'derived',
    },
    dataNotes,
  }

  const calc = recompute(model, {
    aov: model.base.aov,
    orders: model.base.orders,
    marginPct: model.base.marginPct,
    fixedCost: model.base.fixedCost,
  })
  model.sensitivity = calc.sensitivity
  model.steadyCurve = calc.steadyCurve
  model.rampCurve = calc.rampCurve
  model.monthly = calc.monthly
  model.breakevenOrders = calc.breakevenOrders
  return model
}

/* ------------------------------------------------------------------ */
/* 交互重算                                                            */
/* ------------------------------------------------------------------ */

export const ECON_MONTHS = 18

function makeCurve(
  capital: number,
  revenue: number,
  marginPct: number,
  fixedCost: number,
  rampMonths: number,
  ramp: boolean,
  months = ECON_MONTHS,
): PaybackPoint[] {
  const points: PaybackPoint[] = []
  let cumulative = -capital
  for (let m = 1; m <= months; m += 1) {
    const factor = ramp ? clamp((m + 0.5) / Math.max(1, rampMonths), 0.08, 1) : 1
    const r = revenue * factor
    const g = r * marginPct
    const n = g - fixedCost
    cumulative += n
    points.push({ month: m, revenue: r, grossProfit: g, netProfit: n, cumulative, ramp: factor })
  }
  return points
}

export function recompute(model: EconomicsModel, params: EconParams): EconCalc {
  const aov = Math.max(1, params.aov)
  const orders = Math.max(0, params.orders)
  const marginPct = clamp(params.marginPct, 0.01, 0.95)
  const fixedCost = Math.max(0, params.fixedCost)
  const revenue = aov * orders
  const grossProfit = revenue * marginPct
  const netProfit = grossProfit - fixedCost
  const unitCost = aov * (1 - marginPct)
  const unitGrossProfit = aov - unitCost
  const unitNetProfit = orders > 0 ? netProfit / orders : 0
  const breakevenOrders = aov * marginPct > 0 ? fixedCost / (aov * marginPct) : 0
  const paybackMonths = netProfit > 0 ? model.base.capital / netProfit : 0
  const steadyCurve = makeCurve(model.base.capital, revenue, marginPct, fixedCost, model.rampMonths, false)
  const rampCurve = makeCurve(model.base.capital, revenue, marginPct, fixedCost, model.rampMonths, true)
  const rampHit = rampCurve.find((p) => p.cumulative >= 0)
  const monthly = rampCurve.slice(0, 12)

  const minOrders = Math.max(0.5, orders * 0.4)
  const maxOrders = Math.max(minOrders + 1, orders * 1.8)
  const step = (maxOrders - minOrders) / 8
  const sensitivity: SensitivityPoint[] = []
  for (let i = 0; i < 9; i += 1) {
    const o = i === 8 ? maxOrders : minOrders + step * i
    const r = aov * o
    const g = r * marginPct
    sensitivity.push({ orders: round(o, 1), revenue: round(r), grossProfit: round(g), profit: round(g - fixedCost), base: Math.abs(o - orders) < step / 2 })
  }

  return {
    aov,
    orders,
    marginPct,
    fixedCost,
    revenue,
    grossProfit,
    netProfit,
    netMarginPct: revenue > 0 ? netProfit / revenue : 0,
    unitCost,
    unitGrossProfit,
    unitNetProfit,
    unitFixedCost: orders > 0 ? fixedCost / orders : 0,
    breakevenOrders,
    paybackMonths,
    rampPaybackMonths: rampHit ? rampHit.month : null,
    monthly,
    steadyCurve,
    rampCurve,
    sensitivity,
  }
}

/* ------------------------------------------------------------------ */
/* 展示辅助                                                            */
/* ------------------------------------------------------------------ */

export function investmentLabel(item: InvestmentItem, lang: 'zh' | 'en'): string {
  return lang === 'en' ? item.labelEn : item.labelZh
}

export function paybackMonthsOf(model: EconomicsModel): number {
  return model.base.paybackMonths
}
