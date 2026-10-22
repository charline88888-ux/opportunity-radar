import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { dataMeta, gapName, industryName, oppById } from './data'
import type { Profile } from './profile'
import { recordRecEvent } from './rec_log'
import { fmtCnyRange, fmtScore } from './utils'

export type ExperimentStatus = 'active' | 'verified' | 'abandoned'
export type ExperimentOutcome = 'positive' | 'negative' | 'inconclusive'

export interface Experiment {
  id: string
  opp_id: string
  title: string
  started_at: string
  budget_cny: number
  status: ExperimentStatus
  outcome: ExperimentOutcome | null
  ended_at: string | null
  conclusion: string
  spend_cny: number
  hours: number
  created_at: string
  updated_at: string
}

export const EXPERIMENT_STATUS: Record<ExperimentStatus, { label: string; color: string; tone: 'amber' | 'signal' | 'danger' }> = {
  active: { label: '进行中', color: '#ffb547', tone: 'amber' },
  verified: { label: '已验证', color: '#3ddc97', tone: 'signal' },
  abandoned: { label: '已放弃', color: '#ff5d5d', tone: 'danger' },
}

export const EXPERIMENT_OUTCOME: Record<ExperimentOutcome, { label: string; short: string; color: string; description: string }> = {
  positive: { label: '正向结果', short: '正向', color: '#3ddc97', description: '验证到真实需求/付费/可交付信号，值得继续' },
  negative: { label: '负向结果', short: '负向', color: '#ff5d5d', description: '证伪或未达到验证标准，应止损' },
  inconclusive: { label: '结果不明确', short: '不明确', color: '#8b93a7', description: '样本不足或外部因素干扰，需要下一轮验证' },
}

export const OUTCOME_OPTIONS: ExperimentOutcome[] = ['positive', 'negative', 'inconclusive']

export const REVIEW_CYCLE_DAYS = 7
export const ACTIVE_CAPACITY = 1
export const STORAGE_KEY = 'radar:experiments:v1'

function normalizeExperimentList(raw: unknown): Experiment[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x) => x && typeof x === 'object' && typeof (x as any).opp_id === 'string')
    .map((x: any) => ({
      id: String(x.id || `exp-${x.opp_id}`),
      opp_id: String(x.opp_id),
      title: String(x.title || oppById.get(x.opp_id)?.title || '未命名实验'),
      started_at: String(x.started_at || dayjs().format('YYYY-MM-DD')),
      budget_cny: Number(x.budget_cny) || 0,
      status: (['active', 'verified', 'abandoned'].includes(x.status) ? x.status : 'active') as ExperimentStatus,
      outcome: (['positive', 'negative', 'inconclusive'].includes(x.outcome) ? x.outcome : null) as ExperimentOutcome | null,
      ended_at: x.ended_at == null ? null : String(x.ended_at),
      conclusion: String(x.conclusion || ''),
      spend_cny: Number(x.spend_cny) || 0,
      hours: Number(x.hours) || 0,
      created_at: String(x.created_at || x.started_at || dayjs().toISOString()),
      updated_at: String(x.updated_at || dayjs().toISOString()),
    }))
}

function safeLoad(): Experiment[] {
  try {
    return normalizeExperimentList(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
  } catch {
    return []
  }
}

function persist(items: Experiment[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* file:// 下 localStorage 被禁用时降级为内存态，不影响页面 */
  }
}

const listeners = new Set<() => void>()
let cache: Experiment[] = safeLoad()

function emit() {
  listeners.forEach((fn) => fn())
}

function commit(next: Experiment[]) {
  cache = next
  persist(cache)
  emit()
}

export function getExperiments(): Experiment[] {
  return [...cache]
}

export function refreshExperiments() {
  cache = safeLoad()
  emit()
}

export function addExperiment(input: {
  opp_id: string
  budget_cny?: number
  started_at?: string
  title?: string
}): Experiment {
  const opp = oppById.get(input.opp_id)
  const now = dayjs().toISOString()
  const item: Experiment = {
    id: `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    opp_id: input.opp_id,
    title: input.title || opp?.title || '未命名实验',
    started_at: input.started_at || dayjs().format('YYYY-MM-DD'),
    budget_cny: Number(input.budget_cny) || 0,
    status: 'active',
    outcome: null,
    ended_at: null,
    conclusion: '',
    spend_cny: 0,
    hours: 0,
    created_at: now,
    updated_at: now,
  }
  commit([item, ...cache])
  recordRecEvent({ opp_id: item.opp_id, event: 'experiment', rec_score: opp?.rank_score ?? 0, fit: 0 })
  return item
}

/** v0.5.0 数据包导入：覆盖全部实验 */
export function replaceExperiments(raw: unknown) {
  commit(normalizeExperimentList(raw))
}

/** v0.5.0 数据包导入：按 id 去重合并，同 id 取 updated_at 较新者 */
export function mergeExperiments(raw: unknown) {
  const map = new Map<string, Experiment>()
  for (const item of [...cache, ...normalizeExperimentList(raw)]) {
    const old = map.get(item.id)
    if (!old || item.updated_at > old.updated_at) map.set(item.id, item)
  }
  commit([...map.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
}

export function updateExperiment(id: string, patch: Partial<Omit<Experiment, 'id' | 'opp_id' | 'created_at'>>) {
  commit(
    cache.map((x) =>
      x.id === id
        ? {
            ...x,
            ...patch,
            updated_at: dayjs().toISOString(),
          }
        : x,
    ),
  )
}

export function removeExperiment(id: string) {
  commit(cache.filter((x) => x.id !== id))
}

export function findExperimentByOpp(oppId: string): Experiment | undefined {
  return cache.find((x) => x.opp_id === oppId)
}

/** 订阅式 hook：实验台/详情页/Dashboard 共享 localStorage 数据 */
export function useExperiments() {
  const [items, setItems] = useState<Experiment[]>(getExperiments)

  useEffect(() => {
    const listener = () => setItems(getExperiments())
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refreshExperiments()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return {
    items,
    add: addExperiment,
    update: updateExperiment,
    remove: removeExperiment,
    find: (oppId: string) => items.find((x) => x.opp_id === oppId),
  }
}

export interface ExperimentStats {
  total: number
  active: number
  verified: number
  abandoned: number
  completed: number
  totalSpend: number
  totalHours: number
  successRate: number
}

export function experimentStats(items: Experiment[]): ExperimentStats {
  const verified = items.filter((x) => x.status === 'verified').length
  const abandoned = items.filter((x) => x.status === 'abandoned').length
  const completed = verified + abandoned
  return {
    total: items.length,
    active: items.filter((x) => x.status === 'active').length,
    verified,
    abandoned,
    completed,
    totalSpend: items.reduce((a, x) => a + (Number(x.spend_cny) || 0), 0),
    totalHours: items.reduce((a, x) => a + (Number(x.hours) || 0), 0),
    successRate: completed ? (verified / completed) * 100 : 0,
  }
}

export function experimentDay(item: Experiment): number {
  const start = dayjs(item.started_at)
  if (!start.isValid()) return 1
  return Math.max(1, dayjs().startOf('day').diff(start.startOf('day'), 'day') + 1)
}

export function experimentReviewInfo(item: Experiment): { dueDate: string; daysLeft: number; overdue: boolean; cycle: number } {
  const start = dayjs(item.started_at)
  const day = experimentDay(item)
  const cycle = Math.max(1, Math.ceil(day / REVIEW_CYCLE_DAYS))
  const due = start.isValid() ? start.add(cycle * REVIEW_CYCLE_DAYS, 'day') : dayjs()
  const daysLeft = due.startOf('day').diff(dayjs().startOf('day'), 'day')
  return {
    dueDate: due.format('YYYY-MM-DD'),
    daysLeft,
    overdue: daysLeft < 0,
    cycle,
  }
}

export function statusLabel(status: ExperimentStatus): string {
  return EXPERIMENT_STATUS[status]?.label || status
}

/** 实验台 Markdown 导出 */
export function experimentsToMarkdown(items: Experiment[]): string {
  const s = experimentStats(items)
  const lines: string[] = [
    '# 机会雷达 · 实验台记录',
    '',
    `- 导出时间：${dayjs().format('YYYY-MM-DD HH:mm')}`,
    `- 实验总数：${s.total}（进行中 ${s.active} / 已验证 ${s.verified} / 已放弃 ${s.abandoned}）`,
    `- 累计花费：¥${s.totalSpend.toLocaleString('zh-CN')} · 累计耗时：${s.totalHours} 小时 · 成功率：${s.completed ? s.successRate.toFixed(1) : '—'}%`,
    '',
  ]
  if (!items.length) lines.push('> 暂无实验记录。')
  for (const x of items) {
    const opp = oppById.get(x.opp_id)
    const review = experimentReviewInfo(x)
    lines.push(
      `## ${x.title}`,
      '',
      `- 状态：${statusLabel(x.status)}${x.outcome ? ` · 结果：${EXPERIMENT_OUTCOME[x.outcome].label}` : ''} · 开始日期：${x.started_at}${
        x.ended_at ? ` · 结案日期：${x.ended_at}` : ''
      }（第 ${experimentDay(x)} 天，第 ${review.cycle} 个周期）`,
      `- 机会 ID：${x.opp_id} · 行业：${opp ? industryName(opp.industry_id) : '—'} · 信息差：${opp ? opp.gap_type_ids.map(gapName).join(' / ') : '—'}`,
      `- 预算：¥${x.budget_cny.toLocaleString('zh-CN')} · 已花费：¥${x.spend_cny.toLocaleString('zh-CN')} · 耗时：${x.hours} 小时`,
      `- 复盘日期：${review.dueDate}${review.overdue ? '（已逾期）' : ''}`,
      opp ? `- 机会一句话：${opp.one_liner}` : '',
      opp ? `- ROI 区间：启动 ${fmtCnyRange(opp.roi.capital_cny.min, opp.roi.capital_cny.max)} · 月收入 ${fmtCnyRange(opp.roi.monthly_revenue_cny.min, opp.roi.monthly_revenue_cny.max)} · 总分 ${fmtScore(opp.scores.total)}` : '',
      x.conclusion ? `- 结论：${x.conclusion}` : '- 结论：未填写',
      '',
    )
  }
  lines.push('---', '', '免责声明：实验记录为个人研究过程，不构成投资建议、法律意见或收入承诺。')
  return lines.filter(Boolean).join('\n')
}

/** 实验台 JSON 导出 */
export function experimentsToJson(items: Experiment[]): string {
  return JSON.stringify(
    {
      schema: 'opportunity-radar/experiments@0.4.0',
      exported_at: dayjs().toISOString(),
      stats: experimentStats(items),
      items,
    },
    null,
    2,
  )
}

/**
 * v0.4.0 校准导出（docs/12 §1.3）：供 `python scanner/calibrate.py --experiments <file>` 使用。
 * 只包含实验与画像摘要，不包含其他个人数据。
 */
export function calibrationExperimentsExport(items: Experiment[], profile: Profile | null): string {
  const dataVersion = dataMeta.data_version || '0.4.0'
  return JSON.stringify(
    {
      schema_version: '0.4.0',
      exported_at: dayjs().toISOString(),
      profile: profile
        ? {
            capitalBand: profile.capitalBand,
            weeklyHours: profile.weeklyHours,
            skills: profile.skills,
            english: profile.english,
            risk: profile.risk,
            fullTime: profile.fullTime,
            hasLicensePartner: profile.hasLicensePartner,
            strictCapital: profile.strictCapital,
            updated_at: profile.updated_at,
          }
        : null,
      experiments: items.map((x) => ({
        id: x.id,
        opp_id: x.opp_id,
        title: x.title,
        started_at: x.started_at,
        ended_at: x.ended_at,
        status: x.status,
        outcome: x.outcome,
        budget_cny: x.budget_cny,
        spend_cny: x.spend_cny,
        hours: x.hours,
        conclusion: x.conclusion,
        data_version: dataVersion,
      })),
    },
    null,
    2,
  )
}
