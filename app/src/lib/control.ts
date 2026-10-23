import dayjs from 'dayjs'

/** v0.7.0 本地控制台 API 客户端。仅同源调用；token 只存 sessionStorage，不发往第三方。 */
export const CONTROL_TOKEN_KEY = 'radar:control-token'

export interface ControlJob {
  id: string
  task: 'update' | 'fetch' | 'build' | string
  state: 'running' | 'ok' | 'failed'
  started_at?: string
  finished_at?: string | null
  exit_code?: number | null
  log_tail?: string[]
}

export interface ControlOutbox {
  file?: string
  as_of?: string
  generated_at?: string
  source_count?: number
  raw_count?: number
  signal_count?: number
  by_source?: Record<string, number> | Array<{ source_id?: string; source?: string; count?: number; name?: string }>
  top?: Array<{ title?: string; source_id?: string; url?: string }>
  review_md?: { exists?: boolean; modified_at?: string }
}

export interface ControlStatus {
  ok: boolean
  server?: { version?: string; started_at?: string; port?: number }
  data?: {
    as_of?: string
    data_version?: string
    opportunities?: number
    counts?: Record<string, number>
    current_build?: { path?: string; size?: number; mtime?: string }
    frozen_latest?: { version?: string; size?: number }
  }
  schedule?: {
    task_name?: string
    enabled?: boolean
    status?: string
    status_raw?: string
    next_run?: string | null
    last_run?: string | null
    last_result?: string | null
  }
  alert?: { exists?: boolean; content?: string }
  outbox?: ControlOutbox | null
  jobs?: ControlJob[]
  logs?: Array<{ name: string; size?: number; mtime?: string }>
}

export class ControlApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

export function readControlToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    // 1) serve.py 注入到页面 head 的 token（直接打开 http://127.0.0.1:8787/ 场景）
    const injected = (window as unknown as { __RADAR_CONSOLE_TOKEN__?: unknown }).__RADAR_CONSOLE_TOKEN__
    if (typeof injected === 'string' && injected) {
      sessionStorage.setItem(CONTROL_TOKEN_KEY, injected)
      cleanTokenFromUrl()
      return injected
    }
    // 2) URL hash token（serve.py --open 打开 #/control?token=...）
    const hash = window.location.hash || ''
    const query = hash.includes('?') ? hash.split('?').slice(1).join('?') : window.location.search.slice(1)
    const fromUrl = new URLSearchParams(query).get('token') || ''
    if (fromUrl) {
      sessionStorage.setItem(CONTROL_TOKEN_KEY, fromUrl)
      cleanTokenFromUrl()
      return fromUrl
    }
    // 3) sessionStorage
    return sessionStorage.getItem(CONTROL_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function getStoredControlToken(): string {
  try {
    return sessionStorage.getItem(CONTROL_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function clearControlToken() {
  try {
    sessionStorage.removeItem(CONTROL_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

function cleanTokenFromUrl() {
  try {
    const hash = window.location.hash || ''
    if (!hash.includes('token=')) return
    const [path, query = ''] = hash.split('?')
    const params = new URLSearchParams(query)
    params.delete('token')
    const next = `${path}${params.toString() ? `?${params.toString()}` : ''}`
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`)
  } catch {
    /* file:// restrictions */
  }
}

export function isLocalConsoleOrigin(): boolean {
  if (typeof window === 'undefined') return false
  const { protocol, hostname } = window.location
  return (protocol === 'http:' || protocol === 'https:') && (hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1')
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 10000): Promise<T> {
  const token = getStoredControlToken()
  if (!token) throw new ControlApiError('缺少控制台 token；请使用 serve.py --open 或 #/control?token=... 打开。', 401)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Radar-Token': token,
        ...(init?.headers || {}),
      },
    })
    if (res.status === 401) throw new ControlApiError('token 无效或已过期，请重新用启动脚本打开控制台。', 401)
    if (res.status === 403) throw new ControlApiError('来源校验失败：仅允许本机 127.0.0.1/localhost 访问。', 403)
    if (res.status === 409) throw new ControlApiError('已有任务在运行，请等待当前任务完成。', 409)
    if (!res.ok) {
      let detail = `控制台接口返回 ${res.status}`
      try {
        const body = (await res.json()) as { error?: string; output?: string }
        detail = body.error || body.output || detail
      } catch {
        /* keep status text */
      }
      throw new ControlApiError(detail, res.status)
    }
    return (await res.json()) as T
  } catch (e) {
    if (e instanceof ControlApiError) throw e
    if (e instanceof DOMException && e.name === 'AbortError') throw new ControlApiError('控制台请求超时', 0)
    throw new ControlApiError('无法连接本地控制台；请确认 serve.py 已启动。', 0)
  } finally {
    clearTimeout(timer)
  }
}

export function fetchStatus() {
  return request<ControlStatus>('/api/status')
}

export function runTask(task: 'update' | 'fetch' | 'build') {
  return request<{ ok: boolean; job_id: string }>('/api/run', { method: 'POST', body: JSON.stringify({ task }) })
}

export function fetchJob(id: string) {
  return request<{ ok: boolean; job: ControlJob }>(`/api/job?id=${encodeURIComponent(id)}`)
}

export function fetchLogs() {
  return request<{ ok: boolean; logs: Array<{ name: string; size?: number; mtime?: string }> }>('/api/logs')
}

export function fetchLog(name: string) {
  return request<{ ok: boolean; name?: string; text?: string; content?: string; size?: number }>(`/api/log?name=${encodeURIComponent(name)}`)
}

export function setSchedule(action: 'enable' | 'disable', withFetch = false) {
  return request<{ ok: boolean; schedule?: ControlStatus['schedule']; message?: string }>('/api/schedule', {
    method: 'POST',
    body: JSON.stringify({ action, fetch: withFetch }),
  }, 60000)
}

export function formatControlTime(value?: string | null): string {
  if (!value) return '—'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : String(value)
}

export function controlAgeDays(asOf?: string): number | null {
  if (!asOf) return null
  const d = dayjs(asOf)
  if (!d.isValid()) return null
  return Math.max(0, dayjs().startOf('day').diff(d.startOf('day'), 'day'))
}
