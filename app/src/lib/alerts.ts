import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { dataMeta, opportunities, sourceHealth } from './data'
import { useExperiments, type Experiment } from './experiments'
import { capitalCap, useProfile, type Profile } from './profile'
import { scoreOpportunity } from './recommend'
import { freshness } from './freshness'

/**
 * 本地预警规则引擎（v0.3.1：告警 id 带数据版本指纹，升版自动重提醒）。
 * 所有阈值集中在此，前端按当前数据 + localStorage 实验/画像实时计算；
 * 已读 / 忽略状态只保存在本机（radar:alerts:v1），不上传。
 */
export const ALERT_DATA_VERSION = dataMeta.data_version || 'unknown'

/** 告警去重键：type:target:fingerprint（数据版本/采集时间），升版后旧已读不命中，重新提醒 */
export function alertId(type: AlertType, targetId: string, fingerprint: string = ALERT_DATA_VERSION): string {
  return `${type}:${targetId}:${fingerprint}`
}
export const ALERT_RULES = {
  /** 窗口剩余 ≤3 个月 → 窗口关闭预警 */
  WINDOW_CLOSING_MONTHS: 3,
  /** 距离开始超过 7 天仍未结案 → 实验超期 */
  EXPERIMENT_OVERDUE_DAYS: 7,
  /** 实验超期 14 天 → 严重 */
  EXPERIMENT_CRITICAL_DAYS: 14,
  /** 画像 fit ≥0.75 且尚未行动 → 高匹配未行动 */
  HIGH_MATCH_FIT: 0.75,
  /** 未核验证据预警的等级范围（A 级以上） */
  UNVERIFIED_GRADES: ['S', 'A'] as string[],
  /** 最多展示的高匹配未行动条数，避免刷屏 */
  HIGH_MATCH_LIMIT: 6,
} as const

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertType = 'window' | 'experiment' | 'source' | 'unverified' | 'high-match' | 'data-stale'

export interface AlertItem {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  detail: string
  actionLabel: string
  actionHref: string
  targetId: string
  createdAt: string
}

export const ALERT_TYPE_META: Record<AlertType, { label: string; color: string }> = {
  window: { label: '窗口关闭', color: '#ff5d5d' },
  experiment: { label: '实验超期', color: '#ffb547' },
  source: { label: '采集源失败', color: '#ff5d5d' },
  unverified: { label: '未核验证据', color: '#4cc9f0' },
  'high-match': { label: '高匹配未行动', color: '#3ddc97' },
  'data-stale': { label: '数据过期', color: '#ff5d5d' },
}

export const ALERT_SEVERITY: Record<AlertSeverity, { label: string; color: string; tone: 'danger' | 'amber' | 'cyan' }> = {
  critical: { label: '严重', color: '#ff5d5d', tone: 'danger' },
  warning: { label: '注意', color: '#ffb547', tone: 'amber' },
  info: { label: '提示', color: '#4cc9f0', tone: 'cyan' },
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }

export const ALERT_STORAGE_KEY = 'radar:alerts:v1'

interface AlertState {
  read: string[]
  ignored: string[]
}

function loadState(): AlertState {
  try {
    const raw = JSON.parse(localStorage.getItem(ALERT_STORAGE_KEY) || 'null')
    if (!raw || typeof raw !== 'object') return { read: [], ignored: [] }
    return {
      read: Array.isArray(raw.read) ? raw.read.filter((x: unknown) => typeof x === 'string') : [],
      ignored: Array.isArray(raw.ignored) ? raw.ignored.filter((x: unknown) => typeof x === 'string') : [],
    }
  } catch {
    return { read: [], ignored: [] }
  }
}

function persistState(state: AlertState) {
  try {
    localStorage.setItem(ALERT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* localStorage 不可用时降级为内存态 */
  }
}

const listeners = new Set<() => void>()
let stateCache: AlertState = loadState()

function emit() {
  listeners.forEach((fn) => fn())
}

function commit(next: AlertState) {
  stateCache = next
  persistState(next)
  emit()
}

export function getAlertState(): AlertState {
  return stateCache
}

function normalizeAlertState(raw: unknown): AlertState {
  const x = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    read: Array.isArray(x.read) ? [...new Set(x.read.filter((v): v is string => typeof v === 'string'))] : [],
    ignored: Array.isArray(x.ignored) ? [...new Set(x.ignored.filter((v): v is string => typeof v === 'string'))] : [],
  }
}

/** v0.5.0 数据包导入：覆盖已读/忽略状态 */
export function replaceAlertState(raw: unknown) {
  commit(normalizeAlertState(raw))
}

/** v0.5.0 数据包导入：合并已读/忽略（取并集，不取消已有状态） */
export function mergeAlertState(raw: unknown) {
  const imported = normalizeAlertState(raw)
  commit({
    read: [...new Set([...stateCache.read, ...imported.read])],
    ignored: [...new Set([...stateCache.ignored, ...imported.ignored])],
  })
}

export function buildAlerts(input: {
  profile: Profile | null
  experiments: Experiment[]
  now?: dayjs.Dayjs
}): AlertItem[] {
  const { profile, experiments } = input
  const now = input.now || dayjs()
  const alerts: AlertItem[] = []

  // 1) 窗口关闭：months_left ≤ 3
  for (const opp of opportunities) {
    if (opp.window.months_left <= ALERT_RULES.WINDOW_CLOSING_MONTHS) {
      const critical = opp.window.months_left <= 1 || opp.window.status === 'closed'
      alerts.push({
        id: alertId('window', opp.id),
        type: 'window',
        severity: critical ? 'critical' : 'warning',
        title: `窗口仅剩 ${opp.window.months_left} 个月：${opp.title}`,
        detail: `当前窗口状态 ${opp.window.status}，衰减 ${opp.window.decay}；如果要做，现在就该进入 7 天验证（${opp.first_steps_7d[0] || '先做最小验证'}）。`,
        actionLabel: '查看机会',
        actionHref: `/opportunities/${opp.id}`,
        targetId: opp.id,
        createdAt: now.toISOString(),
      })
    }
  }

  // 2) 实验超期：开始 >7 天仍未结案
  const seenExperimentOpps = new Set<string>()
  for (const exp of experiments) {
    seenExperimentOpps.add(exp.opp_id)
    if (exp.status !== 'active' || exp.outcome || exp.ended_at) continue
    const days = now.startOf('day').diff(dayjs(exp.started_at).startOf('day'), 'day')
    if (days > ALERT_RULES.EXPERIMENT_OVERDUE_DAYS) {
      alerts.push({
        id: alertId('experiment', exp.id),
        type: 'experiment',
        severity: days > ALERT_RULES.EXPERIMENT_CRITICAL_DAYS ? 'critical' : 'warning',
        title: `实验已超期 ${days} 天未结案：${exp.title}`,
        detail: `开始于 ${exp.started_at}，花费 ¥${exp.spend_cny} / 耗时 ${exp.hours} 小时；请到实验台记录 outcome 并结案，或按证伪条件止损。`,
        actionLabel: '去实验台',
        actionHref: '/lab',
        targetId: exp.id,
        createdAt: now.toISOString(),
      })
    }
  }

  // 3) 采集源失败（source-health 可选；不存在不告警）
  if (sourceHealth.available) {
    for (const src of sourceHealth.sources) {
      if (src.ok) continue
      alerts.push({
        id: alertId('source', src.id, src.checked_at || ALERT_DATA_VERSION),
        type: 'source',
        severity: 'warning',
        title: `采集源失败：${src.name || src.id}`,
        detail: `检查于 ${src.checked_at || '—'} · mode ${src.mode || sourceHealth.mode || '—'} · latency ${
          src.latency_ms != null ? `${src.latency_ms}ms` : '—'
        } · ${src.error || src.note || '未返回可用内容'}。可到数据源矩阵查看合规与替代方案。`,
        actionLabel: '查看数据源',
        actionHref: '/sources',
        targetId: src.id,
        createdAt: now.toISOString(),
      })
    }
  }

  // 4) 未核验证据：verified=false 且 A 级以上
  for (const opp of opportunities) {
    if (!opp.verified && ALERT_RULES.UNVERIFIED_GRADES.includes(opp.scores.grade)) {
      alerts.push({
        id: alertId('unverified', opp.id),
        type: 'unverified',
        severity: 'warning',
        title: `A 级以上但证据未核验：${opp.title}`,
        detail: `${opp.scores.grade} 级 / 总分 ${opp.scores.total.toFixed(1)}，证据 ${opp.evidence_count} 条但 verified=false；行动前请复核原始来源，避免把营销稿当一手证据。`,
        actionLabel: '复核证据',
        actionHref: `/opportunities/${opp.id}`,
        targetId: opp.id,
        createdAt: now.toISOString(),
      })
    }
  }

  // 5) 画像高匹配但未行动：fit ≥0.75 且未加入实验
  if (profile) {
    const capLimit = capitalCap(profile)
    const scored = opportunities
      .filter((opp) => opp.window.status !== 'closed' && !seenExperimentOpps.has(opp.id))
      .filter((opp) => !profile.strictCapital || opp.roi.capital_cny.min <= capLimit)
      .map((opp) => {
        const row = scoreOpportunity(profile, opp)
        return { opp, fit: row.fit, hard: row.hardConstraints.length, rec: row.recScore }
      })
      .filter((x) => x.fit >= ALERT_RULES.HIGH_MATCH_FIT && x.hard === 0)
      .sort((a, b) => b.rec - a.rec)
      .slice(0, ALERT_RULES.HIGH_MATCH_LIMIT)
    for (const x of scored) {
      alerts.push({
        id: alertId('high-match', x.opp.id),
        type: 'high-match',
        severity: 'info',
        title: `高匹配但未行动：${x.opp.title}`,
        detail: `画像 fit ${(x.fit * 100).toFixed(0)}% · rec_score ${x.rec.toFixed(1)}；如果认同这个匹配，可以先加入 7 天实验验证。`,
        actionLabel: '查看并行动',
        actionHref: `/opportunities/${x.opp.id}`,
        targetId: x.opp.id,
        createdAt: now.toISOString(),
      })
    }
  }

  const fresh = freshness()
  if (fresh.level !== 'fresh') {
    alerts.push({
      id: alertId('data-stale', fresh.asOf),
      type: 'data-stale',
      severity: fresh.level === 'stale' ? 'critical' : 'warning',
      title: `数据已 ${fresh.days} 天未更新（as_of ${fresh.asOf}）`,
      detail: `数据基准日 ${fresh.asOf}，距今 ${fresh.days} 天；建议运行每日任务 scripts/daily-run.ps1，或手动 python scanner/pipeline.py --all --as-of YYYY-MM-DD 更新数据与构建。`,
      actionLabel: '查看数据页',
      actionHref: '/data',
      targetId: fresh.asOf,
      createdAt: now.toISOString(),
    })
  }

  return alerts.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.type.localeCompare(b.type) || a.id.localeCompare(b.id),
  )
}

/** 预警中心/指挥台共享 hook：规则 + 已读/忽略持久化 */
export function useAlerts() {
  const { profile } = useProfile()
  const { items: experiments } = useExperiments()
  const [state, setState] = useState<AlertState>(getAlertState)

  useEffect(() => {
    const listener = () => setState(getAlertState())
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
      if (e.key === ALERT_STORAGE_KEY) {
        stateCache = loadState()
        emit()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const alerts = useMemo(() => buildAlerts({ profile, experiments }), [profile, experiments])
  const ignored = new Set(state.ignored)
  const read = new Set(state.read)
  const active = alerts.filter((a) => !ignored.has(a.id))
  const unread = active.filter((a) => !read.has(a.id))

  const actions = {
    markRead(id: string) {
      if (state.read.includes(id)) return
      commit({ ...state, read: [...state.read, id] })
    },
    markUnread(id: string) {
      commit({ ...state, read: state.read.filter((x) => x !== id) })
    },
    ignore(id: string) {
      if (state.ignored.includes(id)) return
      commit({ ...state, ignored: [...state.ignored, id] })
    },
    unignore(id: string) {
      commit({ ...state, ignored: state.ignored.filter((x) => x !== id) })
    },
    markAllRead() {
      const ids = new Set([...state.read, ...active.map((a) => a.id)])
      commit({ ...state, read: [...ids] })
    },
    clearIgnored() {
      commit({ ...state, ignored: [] })
    },
  }

  return {
    alerts,
    active,
    unread,
    unreadCount: unread.length,
    activeCount: active.length,
    ignoredCount: state.ignored.length,
    state,
    ...actions,
  }
}
