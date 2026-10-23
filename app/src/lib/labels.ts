import type { Lang } from './i18n'

const INDUSTRY: Record<string, { zh: string; en: string }> = {
  fintech: { zh: '金融支付', en: 'Fintech' },
  crossborder: { zh: '跨境', en: 'Cross-border' },
  content: { zh: '内容', en: 'Content' },
  ai: { zh: 'AI', en: 'AI' },
  compliance: { zh: '合规', en: 'Compliance' },
  pet: { zh: '宠物', en: 'Pets' },
  silver: { zh: '银发', en: 'Silver economy' },
  emotion: { zh: '情绪/心理', en: 'Emotion / psychology' },
  local: { zh: '本地生活', en: 'Local services' },
  green: { zh: '绿色/新能源', en: 'Green / new energy' },
  education: { zh: '教育', en: 'Education' },
  culture: { zh: '文化', en: 'Culture' },
  game: { zh: '游戏', en: 'Gaming' },
  manufacturing: { zh: '制造', en: 'Manufacturing' },
}

const EVENT: Record<string, { zh: string; en: string }> = {
  policy: { zh: '政策/监管窗口', en: 'Policy / regulatory window' },
  funding: { zh: '融资', en: 'Funding' },
  launch: { zh: '新品/上线', en: 'Launch' },
  partnership: { zh: '合作', en: 'Partnership' },
  demand: { zh: '需求变化', en: 'Demand shift' },
  cost: { zh: '成本变化', en: 'Cost shift' },
  market: { zh: '市场变化', en: 'Market shift' },
}

const WINDOW: Record<string, { zh: string; en: string }> = {
  open: { zh: '窗口打开', en: 'Window open' },
  closing: { zh: '窗口收窄', en: 'Window narrowing' },
  closed: { zh: '窗口关闭', en: 'Window closed' },
}

function pick(map: Record<string, { zh: string; en: string }>, value: string, lang: Lang): string {
  const hit = map[value.toLowerCase()]
  if (!hit) return value
  return lang === 'en' ? hit.en : hit.zh
}

export const industryLabel = (value: string, lang: Lang) => pick(INDUSTRY, value, lang)
export const eventTypeLabel = (value: string, lang: Lang) => pick(EVENT, value, lang)
export const windowStageLabel = (value: string, lang: Lang) => pick(WINDOW, value, lang)

const NARRATIVE_ENUMS: Array<[RegExp, string]> = [
  [/\bpolicy\b/gi, '政策/监管窗口'],
  [/\bfunding\b/gi, '融资'],
  [/\blaunch\b/gi, '新品/上线'],
  [/\bpartnership\b/gi, '合作'],
  [/\bdemand\b/gi, '需求变化'],
  [/\bcost\b/gi, '成本变化'],
  [/\bmarket\b/gi, '市场变化'],
  [/\bclosing\b/gi, '窗口收窄'],
  [/\bopen\b/gi, '窗口打开'],
  [/\bclosed\b/gi, '窗口关闭'],
]

/** 中文展示层：把数据里的英文枚举词转成中文（EN 模式保留原词，保证 i18n 白名单）。 */
export function localizeNarrativeText(value: string, lang: Lang): string {
  if (!value || lang === 'en') return value
  return NARRATIVE_ENUMS.reduce((text, [re, zh]) => text.replace(re, zh), value)
}
