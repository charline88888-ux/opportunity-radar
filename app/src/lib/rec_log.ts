import { useEffect, useState } from 'react'
import dayjs from 'dayjs'

/** v0.5.0 推荐行为记录：曝光 / 查看 / 加入实验 / 忽略；localStorage 上限 500 条滚动。 */
export type RecEvent = 'impression' | 'view' | 'experiment' | 'dismiss'

export interface RecRecord {
  id: string
  opp_id: string
  event: RecEvent
  rec_score: number
  fit: number
  at: string
}

export const REC_LOG_STORAGE_KEY = 'radar:rec_log:v1'
export const REC_LOG_LIMIT = 500
const EVENTS = new Set<RecEvent>(['impression', 'view', 'experiment', 'dismiss'])

const sessionImpressions = new Set<string>()
const listeners = new Set<() => void>()

function normalizeRecord(raw: unknown): RecRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const x = raw as Record<string, unknown>
  const event = String(x.event) as RecEvent
  if (!EVENTS.has(event)) return null
  if (typeof x.opp_id !== 'string' || !x.opp_id) return null
  return {
    id: typeof x.id === 'string' && x.id ? x.id : `rec-${x.opp_id}-${event}-${String(x.at || '')}`,
    opp_id: x.opp_id,
    event,
    rec_score: Number(x.rec_score) || 0,
    fit: Number(x.fit) || 0,
    at: typeof x.at === 'string' && dayjs(x.at).isValid() ? x.at : dayjs().toISOString(),
  }
}

export function normalizeRecLog(raw: unknown): RecRecord[] {
  if (!Array.isArray(raw)) return []
  const map = new Map<string, RecRecord>()
  for (const item of raw) {
    const rec = normalizeRecord(item)
    if (!rec) continue
    const old = map.get(rec.id)
    if (!old || rec.at > old.at) map.set(rec.id, rec)
  }
  return [...map.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, REC_LOG_LIMIT)
}

function load(): RecRecord[] {
  try {
    return normalizeRecLog(JSON.parse(localStorage.getItem(REC_LOG_STORAGE_KEY) || '[]'))
  } catch {
    return []
  }
}

let cache: RecRecord[] = load()

function persist() {
  try {
    localStorage.setItem(REC_LOG_STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* localStorage 不可用时降级为内存态 */
  }
}

function emit() {
  listeners.forEach((fn) => fn())
}

function commit(next: RecRecord[]) {
  cache = normalizeRecLog(next)
  persist()
  emit()
}

export function getRecLog(): RecRecord[] {
  return [...cache]
}

export function recordRecEvent(input: {
  opp_id: string
  event: RecEvent
  rec_score?: number
  fit?: number
}): RecRecord | null {
  if (!input.opp_id) return null
  if (input.event === 'impression') {
    // 曝光每会话去重
    if (sessionImpressions.has(input.opp_id)) return null
    sessionImpressions.add(input.opp_id)
  }
  const record: RecRecord = {
    id: `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    opp_id: input.opp_id,
    event: input.event,
    rec_score: Number(input.rec_score) || 0,
    fit: Number(input.fit) || 0,
    at: dayjs().toISOString(),
  }
  commit([record, ...cache])
  return record
}

export function replaceRecLog(records: unknown) {
  commit(normalizeRecLog(records))
}

/** 合并：按 id 去重，同 id 取 at 较新者；上限 500 条滚动。 */
export function mergeRecLog(records: unknown) {
  const map = new Map<string, RecRecord>()
  for (const rec of [...cache, ...normalizeRecLog(records)]) {
    const old = map.get(rec.id)
    if (!old || rec.at > old.at) map.set(rec.id, rec)
  }
  commit([...map.values()])
}

export function clearRecLog() {
  sessionImpressions.clear()
  commit([])
}

export interface RecLogSummary {
  impressions: number
  unique_impressions: number
  views: number
  unique_views: number
  experiments: number
  unique_experiments: number
  dismisses: number
  unique_dismisses: number
  hit_rate: number
  view_rate: number
  total: number
}

export function recLogSummary(records: RecRecord[] = cache): RecLogSummary {
  const uniq = (event: RecEvent) => new Set(records.filter((x) => x.event === event).map((x) => x.opp_id)).size
  const count = (event: RecEvent) => records.filter((x) => x.event === event).length
  const uniqueImpressions = uniq('impression')
  const uniqueExperiments = uniq('experiment')
  return {
    impressions: count('impression'),
    unique_impressions: uniqueImpressions,
    views: count('view'),
    unique_views: uniq('view'),
    experiments: count('experiment'),
    unique_experiments: uniqueExperiments,
    dismisses: count('dismiss'),
    unique_dismisses: uniq('dismiss'),
    hit_rate: uniqueImpressions ? Math.round((uniqueExperiments / uniqueImpressions) * 1000) / 10 : 0,
    view_rate: uniqueImpressions ? Math.round((uniq('view') / uniqueImpressions) * 1000) / 10 : 0,
    total: records.length,
  }
}

export function useRecLog() {
  const [records, setRecords] = useState<RecRecord[]>(getRecLog)
  useEffect(() => {
    const listener = () => setRecords(getRecLog())
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
      if (e.key === REC_LOG_STORAGE_KEY) setRecords(load())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return { records, summary: recLogSummary(records) }
}
