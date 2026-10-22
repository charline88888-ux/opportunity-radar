import { useEffect, useRef, useState } from 'react'
import type { AlertItem } from './alerts'

/**
 * v0.4.0 可选桌面通知：默认关闭，状态存本机 localStorage。
 * 仅当 /alerts 页面打开且处于前台时，对新出现的「严重」预警发 Notification；
 * 不支持 / 权限拒绝 / 构造失败均优雅降级，不影响页面。
 */
export const NOTIFICATION_STORAGE_KEY = 'radar:notifications:v1'

interface NotificationState {
  enabled: boolean
  seen: string[]
}

const loadState = (): NotificationState => {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || 'null')
    if (!raw || typeof raw !== 'object') return { enabled: false, seen: [] }
    return {
      enabled: raw.enabled === true,
      seen: Array.isArray(raw.seen) ? raw.seen.filter((x: unknown) => typeof x === 'string') : [],
    }
  } catch {
    return { enabled: false, seen: [] }
  }
}

const saveState = (state: NotificationState) => {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* localStorage 不可用时仅本次会话 */
  }
}

export function getNotificationState(): NotificationState {
  return loadState()
}

/** v0.5.0 数据包导入：覆盖通知设置 */
export function replaceNotificationState(raw: unknown) {
  const x = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  saveState({
    enabled: x.enabled === true,
    seen: Array.isArray(x.seen) ? x.seen.filter((v): v is string => typeof v === 'string') : [],
  })
}

/** v0.5.0 数据包导入：合并通知设置（seen 取并集） */
export function mergeNotificationState(raw: unknown) {
  const current = loadState()
  const x = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const seen = Array.isArray(x.seen) ? x.seen.filter((v): v is string => typeof v === 'string') : []
  saveState({ enabled: current.enabled || x.enabled === true, seen: [...new Set([...current.seen, ...seen])] })
}

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function currentNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationSupported()) return 'unsupported'
  return Notification.permission
}

export function useAlertNotifications(activeAlerts: AlertItem[]) {
  const [state, setState] = useState<NotificationState>(loadState)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    currentNotificationPermission(),
  )
  const [error, setError] = useState('')
  const stateRef = useRef(state)
  stateRef.current = state
  const criticalIds = activeAlerts.filter((a) => a.severity === 'critical').map((a) => a.id)
  const criticalKey = criticalIds.join('|')

  const commit = (next: NotificationState) => {
    stateRef.current = next
    setState(next)
    saveState(next)
  }

  // 页面打开时监听新严重级别告警；已读/忽略不影响通知去重（按 alert id）。
  useEffect(() => {
    if (!state.enabled || permission !== 'granted' || !notificationSupported()) return
    const notified = new Set(stateRef.current.seen)
    const fresh = activeAlerts.filter((a) => a.severity === 'critical' && !notified.has(a.id))
    if (!fresh.length) return
    let sent = false
    for (const alert of fresh.slice(0, 3)) {
      try {
        // eslint-disable-next-line no-new
        new Notification('机会雷达 · 严重预警', { body: alert.title, tag: alert.id })
        notified.add(alert.id)
        sent = true
      } catch {
        setError('桌面通知发送失败，已降级为页面内提醒')
      }
    }
    if (sent) commit({ ...stateRef.current, seen: [...notified] })
  }, [state.enabled, permission, criticalKey])

  const toggle = async () => {
    setError('')
    if (stateRef.current.enabled) {
      commit({ ...stateRef.current, enabled: false })
      return
    }
    if (!notificationSupported()) {
      setPermission('unsupported')
      setError('当前浏览器不支持桌面通知，已保留页面内预警')
      return
    }
    try {
      const nextPermission =
        Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== 'granted') {
        setError(nextPermission === 'denied' ? '通知权限被拒绝，可在浏览器站点设置中重新开启' : '未获得通知权限')
        return
      }
      // 开启时把当前严重告警记为已见，避免立即补发历史通知
      const seen = [...new Set([...stateRef.current.seen, ...criticalIds])]
      commit({ enabled: true, seen })
    } catch {
      setError('无法请求通知权限，已保留页面内提醒')
    }
  }

  return {
    enabled: state.enabled,
    supported: notificationSupported(),
    permission,
    error,
    toggle,
  }
}
