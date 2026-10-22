import dayjs from 'dayjs'
import { dataMeta } from './data'

/**
 * v0.6.1 数据新鲜度：as_of 相对浏览器当天。
 * 支持 URL 参数模拟（hash 查询或 search）：as_of / data_as_of / freshness_as_of = YYYY-MM-DD。
 * 仅用于本地展示与验收，不改变数据本身。
 */
export type FreshnessLevel = 'fresh' | 'warning' | 'stale'

export interface FreshnessInfo {
  asOf: string
  days: number
  level: FreshnessLevel
  color: string
  label: string
  labelEn: string
}

function validDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return dayjs(value).isValid() ? value : null
}

export function readAsOfOverride(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const query = window.location.search ? window.location.search.slice(1) : ''
    const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?').slice(1).join('?') : ''
    for (const source of [query, hashQuery]) {
      const params = new URLSearchParams(source)
      for (const key of ['as_of', 'data_as_of', 'freshness_as_of']) {
        const v = validDate(params.get(key))
        if (v) return v
      }
    }
    const stored = validDate(sessionStorage.getItem('radar:freshness:as_of'))
    if (stored) return stored
  } catch {
    /* file:// / privacy mode */
  }
  return null
}

export function freshness(asOfInput?: string): FreshnessInfo {
  const asOf = validDate(asOfInput || '') || readAsOfOverride() || dataMeta.as_of || dayjs().format('YYYY-MM-DD')
  const days = Math.max(0, dayjs().startOf('day').diff(dayjs(asOf).startOf('day'), 'day'))
  const level: FreshnessLevel = days > 7 ? 'stale' : days >= 3 ? 'warning' : 'fresh'
  const colors: Record<FreshnessLevel, string> = { fresh: '#3ddc97', warning: '#ffb547', stale: '#ff5d5d' }
  return {
    asOf,
    days,
    level,
    color: colors[level],
    label: level === 'stale' ? `数据已 ${days} 天未更新` : level === 'warning' ? `数据 ${days} 天未更新` : `数据新鲜（${days} 天）`,
    labelEn: level === 'stale' ? `Data is ${days} days old` : level === 'warning' ? `Data is ${days} days old` : `Data is fresh (${days}d)`,
  }
}

export function freshnessCommand(): string {
  return 'scripts/daily-run.ps1'
}
