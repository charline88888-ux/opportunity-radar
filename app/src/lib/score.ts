import type { Opportunity, ScoreDimensions } from '@/types'
import {
  computeTotal,
  defaultWeights,
  gradeOf,
  opportunities,
  taxonomy,
  weightedTotal,
} from './data'
import { round1 } from './utils'

/** 归一化权重（保证合计 = 1，公式与 docs/12 §4.5 一致） */
export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const entries = taxonomy.score_dimensions.map((d) => [d.id, Math.max(0, weights[d.id] ?? 0)] as const)
  const sum = entries.reduce((a, [, w]) => a + w, 0)
  if (sum <= 0) return defaultWeights()
  return Object.fromEntries(entries.map(([id, w]) => [id, w / sum]))
}

export interface WeightedScore {
  total: number
  grade: string
}

export function scoreWithWeights(opp: Opportunity, weights: Record<string, number>): WeightedScore {
  const normalized = normalizeWeights(weights)
  const total = weightedTotal(opp.scores.dimensions, normalized)
  return { total, grade: gradeOf(total) }
}

export interface WeightedRankRow {
  opp: Opportunity
  total: number
  grade: string
  rank: number
}

export function rankByWeights(weights: Record<string, number>, source = opportunities): WeightedRankRow[] {
  const normalized = normalizeWeights(weights)
  return source
    .map((opp) => {
      const total = weightedTotal(opp.scores.dimensions, normalized)
      return { opp, total, grade: gradeOf(total), rank: 0 }
    })
    .sort((a, b) => b.total - a.total)
    .map((row, i) => ({ ...row, rank: i + 1 }))
}

/** 行业平均维度分（用于雷达对比；样本不足时退回机会库均值） */
export function industryDimensionAverage(industryId: string): ScoreDimensions {
  const same = opportunities.filter((o) => o.industry_id === industryId)
  const pool = same.length >= 3 ? same : opportunities
  const keys = taxonomy.score_dimensions.map((d) => d.id)
  const avg = Object.fromEntries(
    keys.map((k) => [k, round1(pool.reduce((a, o) => a + ((o.scores.dimensions as Record<string, number>)[k] || 0), 0) / Math.max(1, pool.length))]),
  )
  return avg as ScoreDimensions
}

/** 指数衰减：保留价值 %，t 个月后 = 0.5^(t / 半衰期) */
export function decayCurve(halfLifeMonths: number, months = 36): Array<{ month: number; value: number }> {
  const hl = halfLifeMonths > 0 ? halfLifeMonths : 18
  return Array.from({ length: months + 1 }, (_, m) => ({
    month: m,
    value: round1(Math.pow(0.5, m / hl) * 100),
  }))
}

/** 自定义权重与契约权重的差异（用于“当前为演示态”提示） */
export function weightsChanged(weights: Record<string, number>): boolean {
  const base = defaultWeights()
  return taxonomy.score_dimensions.some((d) => Math.abs((weights[d.id] ?? 0) - base[d.id]) > 0.0005)
}

export { computeTotal, weightedTotal, defaultWeights }
