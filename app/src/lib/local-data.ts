import dayjs from 'dayjs'
import { getAlertState, mergeAlertState, replaceAlertState } from './alerts'
import {
  getExperiments,
  mergeExperiments,
  replaceExperiments,
  type Experiment,
} from './experiments'
import { getLang, setStoredLang, type Lang } from './i18n'
import {
  getNotificationState,
  mergeNotificationState,
  replaceNotificationState,
} from './notifications'
import { clearProfile, getProfile, normalizeProfile, saveProfile, type Profile } from './profile'
import { getRecLog, mergeRecLog, replaceRecLog, type RecRecord } from './rec_log'

/** v0.5.0 个人数据包：纯本地 JSON，用于跨设备手动迁移。 */
export const DATA_BUNDLE_SCHEMA = '0.5.0'
export const DATA_BUNDLE_VERSION = '0.5.0'

export interface AlertMirror {
  read: string[]
  ignored: string[]
}

export interface DataBundleSettings {
  language: Lang
  notifications: { enabled: boolean; seen: string[] }
}

export interface DataBundle {
  schema_version: string
  exported_at: string
  profile: Profile | null
  experiments: Experiment[]
  alerts_state: AlertMirror
  rec_log: RecRecord[]
  settings: DataBundleSettings
}

export interface BundlePreview {
  schema_version: string
  exported_at: string
  profile: boolean
  experiments: number
  alertsRead: number
  alertsIgnored: number
  recLog: number
  language: Lang
  notifications: boolean
  warnings: string[]
}

export function buildDataBundle(): DataBundle {
  const alerts = getAlertState()
  return {
    schema_version: DATA_BUNDLE_SCHEMA,
    exported_at: dayjs().toISOString(),
    profile: getProfile(),
    experiments: getExperiments(),
    alerts_state: { read: alerts.read, ignored: alerts.ignored },
    rec_log: getRecLog(),
    settings: {
      language: getLang(),
      notifications: getNotificationState(),
    },
  }
}

export function dataBundleJson(bundle: DataBundle): string {
  return JSON.stringify(bundle, null, 2)
}

export interface BundleValidation {
  ok: boolean
  errors: string[]
  bundle?: DataBundle
  preview?: BundlePreview
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

export function validateDataBundle(raw: unknown): BundleValidation {
  const errors: string[] = []
  if (!isObj(raw)) return { ok: false, errors: ['文件不是 JSON 对象 / File is not a JSON object'] }
  const schema = typeof raw.schema_version === 'string' ? raw.schema_version : ''
  if (schema !== DATA_BUNDLE_VERSION) errors.push(`schema_version 必须为 ${DATA_BUNDLE_VERSION}（实际 ${schema || '缺失'}）`)
  const profile = raw.profile
  if (profile !== null && profile !== undefined && !isObj(profile)) errors.push('profile 必须为对象或 null')
  const normalizedProfile = profile == null ? null : normalizeProfile(profile)
  if (profile != null && !normalizedProfile) errors.push('profile 字段不合法（缺少 capitalBand/skills 等）')
  if (!Array.isArray(raw.experiments)) errors.push('experiments 必须为数组')
  if (!isObj(raw.alerts_state)) errors.push('alerts_state 必须为对象')
  if (!Array.isArray(raw.rec_log)) errors.push('rec_log 必须为数组')
  if (!isObj(raw.settings)) errors.push('settings 必须为对象')
  if (errors.length) return { ok: false, errors }
  const alertState = raw.alerts_state as Record<string, unknown>
  const settings = raw.settings as Record<string, unknown>
  const language: Lang = settings.language === 'en' ? 'en' : 'zh'
  const notifications = isObj(settings.notifications)
    ? { enabled: settings.notifications.enabled === true, seen: Array.isArray(settings.notifications.seen) ? settings.notifications.seen.filter((x): x is string => typeof x === 'string') : [] }
    : { enabled: false, seen: [] }
  const bundle: DataBundle = {
    schema_version: schema,
    exported_at: typeof raw.exported_at === 'string' && dayjs(raw.exported_at).isValid() ? raw.exported_at : dayjs().toISOString(),
    profile: normalizedProfile,
    experiments: raw.experiments as Experiment[],
    alerts_state: {
      read: Array.isArray(alertState.read) ? alertState.read.filter((x): x is string => typeof x === 'string') : [],
      ignored: Array.isArray(alertState.ignored) ? alertState.ignored.filter((x): x is string => typeof x === 'string') : [],
    },
    rec_log: raw.rec_log as RecRecord[],
    settings: { language, notifications },
  }
  const warnings: string[] = []
  if (!bundle.profile) warnings.push('数据包没有画像 / no profile')
  if (!bundle.experiments.length) warnings.push('数据包没有实验 / no experiments')
  if (!bundle.rec_log.length) warnings.push('数据包没有推荐记录 / no rec_log')
  return {
    ok: true,
    errors: [],
    bundle,
    preview: {
      schema_version: schema,
      exported_at: bundle.exported_at,
      profile: !!bundle.profile,
      experiments: bundle.experiments.length,
      alertsRead: bundle.alerts_state.read.length,
      alertsIgnored: bundle.alerts_state.ignored.length,
      recLog: bundle.rec_log.length,
      language,
      notifications: bundle.settings.notifications.enabled,
      warnings,
    },
  }
}

export type BundleApplyMode = 'replace' | 'merge'

function dispatchRefresh(key: string) {
  try {
    window.dispatchEvent(new StorageEvent('storage', { key }))
  } catch {
    /* ignore */
  }
}

/** 应用数据包；覆盖或按 id 取较新的合并。返回应用后的摘要。 */
export function applyDataBundle(bundle: DataBundle, mode: BundleApplyMode) {
  const currentProfile = getProfile()
  if (mode === 'replace') {
    if (bundle.profile) saveProfile(bundle.profile)
    else clearProfile()
  } else if (bundle.profile && (!currentProfile || bundle.profile.updated_at > currentProfile.updated_at)) {
    saveProfile(bundle.profile)
  }
  if (mode === 'replace') replaceExperiments(bundle.experiments)
  else mergeExperiments(bundle.experiments)
  if (mode === 'replace') replaceAlertState(bundle.alerts_state)
  else mergeAlertState(bundle.alerts_state)
  if (mode === 'replace') replaceRecLog(bundle.rec_log)
  else mergeRecLog(bundle.rec_log)
  if (mode === 'replace') replaceNotificationState(bundle.settings.notifications)
  else mergeNotificationState(bundle.settings.notifications)
  setStoredLang(bundle.settings.language)
  for (const key of ['radar:profile:v1', 'radar:experiments:v1', 'radar:alerts:v1', 'radar:rec_log:v1', 'radar:notifications:v1', 'radar:lang:v1']) {
    dispatchRefresh(key)
  }
  return buildPreview()
}

function buildPreview(): BundlePreview {
  const profile = getProfile()
  const alerts = getAlertState()
  return {
    schema_version: DATA_BUNDLE_VERSION,
    exported_at: dayjs().toISOString(),
    profile: !!profile,
    experiments: getExperiments().length,
    alertsRead: alerts.read.length,
    alertsIgnored: alerts.ignored.length,
    recLog: getRecLog().length,
    language: getLang() as Lang,
    notifications: getNotificationState().enabled,
    warnings: [],
  }
}
