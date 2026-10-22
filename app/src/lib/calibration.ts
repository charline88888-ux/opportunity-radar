import dayjs from 'dayjs'
import type { Opportunity } from '@/types'
import { oppById } from './data'
import type { Experiment, ExperimentOutcome } from './experiments'
import { EXPERIMENT_OUTCOME } from './experiments'
import { round1 } from './utils'

/**
 * 回测校准：把 /lab 实验的 outcome 与机会预测（总分/等级）join，检查评分是否「说得准」。
 * 样本 <3 时只显示空态引导，避免小样本误导。
 */
export const CALIBRATION_MIN_SAMPLES = 3

export interface CalibrationSample {
  experiment: Experiment
  opp: Opportunity | undefined
  grade: string
  total: number
  rankScore: number
  outcome: ExperimentOutcome
  spend: number
  hours: number
  ended_at: string
}

export const CALIBRATION_GRADES = ['S', 'A', 'B', 'C', 'D'] as const
export const CALIBRATION_BUCKETS = [
  { id: '50-59', min: 50, max: 60 },
  { id: '60-69', min: 60, max: 70 },
  { id: '70-79', min: 70, max: 80 },
  { id: '80-89', min: 80, max: 90 },
  { id: '90-100', min: 90, max: 100.1 },
]

export interface CalibrationStats {
  samples: number
  positive: number
  negative: number
  inconclusive: number
  decided: number
  successRate: number
  avgTotal: number
  avgTotalPositive: number | null
  avgTotalNegative: number | null
  avgTotalInconclusive: number | null
  avgSpend: number
  avgHours: number
  totalSpend: number
  totalHours: number
}

export interface GradeOutcomeRow {
  grade: string
  positive: number
  negative: number
  inconclusive: number
  total: number
}

export interface BucketOutcomeRow {
  bucket: string
  positive: number
  negative: number
  inconclusive: number
  total: number
}

export interface CalibrationData {
  samples: CalibrationSample[]
  stats: CalibrationStats
  byGrade: GradeOutcomeRow[]
  byBucket: BucketOutcomeRow[]
  suggestions: string[]
  ready: boolean
}

function avg(values: number[]): number | null {
  if (!values.length) return null
  return round1(values.reduce((a, b) => a + b, 0) / values.length)
}

export function collectCalibrationSamples(experiments: Experiment[]): CalibrationSample[] {
  return experiments
    .filter((x) => !!x.outcome && (x.status !== 'active' || !!x.ended_at))
    .map((x) => {
      const opp = oppById.get(x.opp_id)
      return {
        experiment: x,
        opp,
        grade: opp?.scores.grade || '—',
        total: opp?.scores.total ?? 0,
        rankScore: opp?.rank_score ?? 0,
        outcome: x.outcome as ExperimentOutcome,
        spend: Number(x.spend_cny) || 0,
        hours: Number(x.hours) || 0,
        ended_at: x.ended_at || x.updated_at || x.started_at,
      }
    })
}

export function calibrationStats(samples: CalibrationSample[]): CalibrationStats {
  const positive = samples.filter((s) => s.outcome === 'positive')
  const negative = samples.filter((s) => s.outcome === 'negative')
  const inconclusive = samples.filter((s) => s.outcome === 'inconclusive')
  const decided = positive.length + negative.length
  return {
    samples: samples.length,
    positive: positive.length,
    negative: negative.length,
    inconclusive: inconclusive.length,
    decided,
    successRate: decided ? round1((positive.length / decided) * 100) : 0,
    avgTotal: samples.length ? round1(samples.reduce((a, s) => a + s.total, 0) / samples.length) : 0,
    avgTotalPositive: avg(positive.map((s) => s.total)),
    avgTotalNegative: avg(negative.map((s) => s.total)),
    avgTotalInconclusive: avg(inconclusive.map((s) => s.total)),
    avgSpend: samples.length ? Math.round(samples.reduce((a, s) => a + s.spend, 0) / samples.length) : 0,
    avgHours: samples.length ? round1(samples.reduce((a, s) => a + s.hours, 0) / samples.length) : 0,
    totalSpend: samples.reduce((a, s) => a + s.spend, 0),
    totalHours: round1(samples.reduce((a, s) => a + s.hours, 0)),
  }
}

/** 校准建议（规则化文案，样本不足时只做方向性提示） */
export function calibrationSuggestions(samples: CalibrationSample[], stats: CalibrationStats): string[] {
  if (samples.length === 0) {
    return ['还没有带 outcome 的结案实验。先到实验台把进行中的实验结案，并标记「正向 / 负向 / 不明确」。']
  }
  if (samples.length < CALIBRATION_MIN_SAMPLES) {
    return [
      `当前只有 ${samples.length} 个带 outcome 的样本（建议 ≥${CALIBRATION_MIN_SAMPLES}），统计仅作方向性参考，不构成评分有效性结论。`,
      '继续积累样本：优先选择不同等级（A/B/C）的机会各做一次小成本验证，避免只验证自己偏爱的机会。',
    ]
  }
  const tips: string[] = []
  const aPlus = samples.filter((s) => ['S', 'A'].includes(s.grade))
  const lower = samples.filter((s) => ['B', 'C', 'D'].includes(s.grade))
  const aPlusDecided = aPlus.filter((s) => s.outcome !== 'inconclusive')
  const lowerDecided = lower.filter((s) => s.outcome !== 'inconclusive')
  const aPlusSuccess = aPlusDecided.length ? (aPlusDecided.filter((s) => s.outcome === 'positive').length / aPlusDecided.length) * 100 : null
  const lowerSuccess = lowerDecided.length ? (lowerDecided.filter((s) => s.outcome === 'positive').length / lowerDecided.length) * 100 : null

  if (stats.decided >= 3 && stats.successRate < 35) {
    tips.push(`成功率 ${stats.successRate}% 偏低：预测整体偏乐观。建议下调新机会的初始权重，或在评分时更严格对待「证据可信度」与「风险可控性」。`)
  } else if (stats.decided >= 3 && stats.successRate >= 60) {
    tips.push(`成功率 ${stats.successRate}% 偏高（注意样本选择偏差）：是否只验证了自己偏爱的机会？建议主动抽 1–2 条低等级机会做盲测。`)
  }

  if (stats.avgTotalPositive != null && stats.avgTotalNegative != null) {
    const gap = round1(stats.avgTotalPositive - stats.avgTotalNegative)
    if (gap < 0) {
      tips.push(`成功样本平均总分（${stats.avgTotalPositive}）低于失败样本（${stats.avgTotalNegative}）：当前评分与结果方向相反，需复核 10 维锚点与评分证据。`)
    } else if (gap < 3) {
      tips.push(`成功与失败样本的平均总分只差 ${gap} 分，评分对结果的区分度偏弱；可优先观察「fit / 信息差窗口 / 证据可信度」这三项是否被高估。`)
    } else {
      tips.push(`成功样本平均总分比失败样本高 ${gap} 分，评分方向与结果基本一致；继续保持记录以扩大样本。`)
    }
  }

  if (aPlusSuccess != null && lowerSuccess != null && aPlusDecided.length >= 2 && lowerDecided.length >= 2 && aPlusSuccess < lowerSuccess) {
    tips.push(`A 级以上成功率（${round1(aPlusSuccess)}%）低于 B/C/D（${round1(lowerSuccess)}%）：高等级预测与结果错位，建议检查是否被「信号强但壁垒低」的机会带偏。`)
  }

  if (stats.avgSpend > 3000 && stats.successRate < 50) {
    tips.push(`平均单次实验花费 ¥${stats.avgSpend}、成功率 ${stats.successRate}%：先用更低成本验证（信息型/预订型/访谈型），再投入实物或资质成本。`)
  }

  if (tips.length < 2) {
    tips.push('继续按 7 天周期记录 outcome，并尽量保持「同一机会只用一种主要验证方式」，否则很难判断结果来自哪里。')
  }
  tips.push('样本 <10 时不要据此调整评分权重；校准建议只用于发现「系统性偏差」。')
  return tips
}

export function buildCalibration(experiments: Experiment[]): CalibrationData {
  const samples = collectCalibrationSamples(experiments)
  const stats = calibrationStats(samples)
  const byGrade = CALIBRATION_GRADES.map((grade) => {
    const rows = samples.filter((s) => s.grade === grade)
    return {
      grade,
      positive: rows.filter((s) => s.outcome === 'positive').length,
      negative: rows.filter((s) => s.outcome === 'negative').length,
      inconclusive: rows.filter((s) => s.outcome === 'inconclusive').length,
      total: rows.length,
    }
  }).filter((r) => r.total > 0)
  const byBucket = CALIBRATION_BUCKETS.map((bucket) => {
    const rows = samples.filter((s) => s.total >= bucket.min && s.total < bucket.max)
    return {
      bucket: bucket.id,
      positive: rows.filter((s) => s.outcome === 'positive').length,
      negative: rows.filter((s) => s.outcome === 'negative').length,
      inconclusive: rows.filter((s) => s.outcome === 'inconclusive').length,
      total: rows.length,
    }
  })
  return {
    samples,
    stats,
    byGrade,
    byBucket,
    suggestions: calibrationSuggestions(samples, stats),
    ready: samples.length >= CALIBRATION_MIN_SAMPLES,
  }
}

export function calibrationToMarkdown(data: CalibrationData): string {
  const s = data.stats
  const lines: string[] = [
    '# 机会雷达 · 回测校准报告',
    '',
    `- 导出时间：${dayjs().format('YYYY-MM-DD HH:mm')}`,
    `- 样本数：${s.samples}（正向 ${s.positive} / 负向 ${s.negative} / 不明确 ${s.inconclusive}）`,
    `- 成功率：${s.decided ? `${s.successRate}%` : '—'}（正向 / 已决策）`,
    `- 平均总分：${s.avgTotal} · 成功样本 ${s.avgTotalPositive ?? '—'} · 失败样本 ${s.avgTotalNegative ?? '—'}`,
    `- 平均花费：¥${s.avgSpend} · 平均耗时：${s.avgHours} 小时 · 累计花费 ¥${s.totalSpend}`,
    '',
    '## 等级 × 结果分布',
    '',
    '| 等级 | 正向 | 负向 | 不明确 | 合计 |',
    '|---|---:|---:|---:|---:|',
    ...data.byGrade.map((r) => `| ${r.grade} | ${r.positive} | ${r.negative} | ${r.inconclusive} | ${r.total} |`),
    '',
    '## 评分分桶 × 结果',
    '',
    '| 总分区间 | 正向 | 负向 | 不明确 | 合计 |',
    '|---|---:|---:|---:|---:|',
    ...data.byBucket.map((r) => `| ${r.bucket} | ${r.positive} | ${r.negative} | ${r.inconclusive} | ${r.total} |`),
    '',
    '## 校准建议',
    '',
    ...data.suggestions.map((x) => `- ${x}`),
    '',
    '## 样本明细',
    '',
    '| 机会 | 等级 | 总分 | 结果 | 花费 | 耗时 | 结案日期 |',
    '|---|---|---:|---|---:|---:|---|',
    ...data.samples.map(
      (x) =>
        `| ${x.experiment.title} | ${x.grade} | ${x.total} | ${EXPERIMENT_OUTCOME[x.outcome].label} | ¥${x.spend} | ${x.hours}h | ${x.ended_at} |`,
    ),
    '',
    '---',
    '',
    '免责声明：本报告为个人实验记录的统计复盘，不构成投资建议或收入承诺；样本量有限时结论仅作方向性参考。',
  ]
  return lines.join('\n') + '\n'
}

export function calibrationToJson(data: CalibrationData): string {
  return JSON.stringify(
    {
      schema: 'opportunity-radar/calibration@0.3.0',
      exported_at: dayjs().toISOString(),
      stats: data.stats,
      by_grade: data.byGrade,
      by_bucket: data.byBucket,
      suggestions: data.suggestions,
      samples: data.samples.map((x) => ({
        opp_id: x.experiment.opp_id,
        title: x.experiment.title,
        grade: x.grade,
        total: x.total,
        outcome: x.outcome,
        spend_cny: x.spend,
        hours: x.hours,
        ended_at: x.ended_at,
        conclusion: x.experiment.conclusion,
      })),
    },
    null,
    2,
  )
}
