import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { UI_EN } from './i18n-dict'

/** v0.4.0 双语：zh（默认）/ en；静态 UI 文案统一走 UI_EN 字典。 */
export type Lang = 'zh' | 'en'

export const LANG_STORAGE_KEY = 'radar:lang:v1'
export const DOC_TITLE = {
  zh: '机会雷达 · 全球商机扫描器',
  en: 'Opportunity Radar · Global Niche Intelligence',
} as const

export const EN_CONTENT_NOTICE =
  'Opportunity and auto-discovered candidate content (titles, one-liners, evidence, Q&A) is Chinese-only in v1.2.1.'

let currentLang: Lang = loadLang()

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    return saved === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export function getLang(): Lang {
  return currentLang
}

export function setStoredLang(lang: Lang) {
  currentLang = lang
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    /* file:// 下 localStorage 不可用时仅内存态 */
  }
}

export function normalizeI18nKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * 翻译单个静态 UI 字符串（精确匹配，保留首尾空白）。
 * 机会数据/长叙述不进入字典 → 保持中文；PageHeader 等显式调用 t() 翻译标题与描述。
 */
export function translateString(text: string): string {
  if (!text) return text
  if (currentLang !== 'en') return text
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!m) return text
  const raw = m[2]
  const patterned = patternTranslate(raw)
  if (patterned !== null) return `${m[1]}${patterned}${m[3]}`
  const key = normalizeI18nKey(raw)
  const hit = UI_EN[key] ?? UI_EN[raw]
  if (hit === undefined) {
    // 国家/区域组合："美国 / 英国" → "United States / United Kingdom"（仅当每一段都是已翻译标签）
    if (raw.includes(' / ')) {
      const parts = raw.split(' / ').map((x) => normalizeI18nKey(x)).filter(Boolean)
      const mapped = parts.map((p) => UI_EN[p])
      if (parts.length > 1 && mapped.every((x) => x !== undefined)) return `${m[1]}${mapped.join(' / ')}${m[3]}`
    }
    return text
  }
  return `${m[1]}${hit}${m[3]}`
}

/** 动态数字/日期类 UI 文案的英文模板（仅匹配明确的 UI 结构，避免误翻机会数据） */
function patternTranslate(raw: string): string | null {
  const text = normalizeI18nKey(raw)
  let m: RegExpMatchArray | null
  if ((m = text.match(/^(\d{4})年第(\d+)周$/))) return `Week ${m[2]}, ${m[1]}`
  if ((m = text.match(/^窗口 (\d{4}-\d{2}-\d{2}) · 按 rank_score 降序$/))) return `Window ${m[1]} · sorted by rank_score`
  if ((m = text.match(/^按 last_activity 倒序 · 仅显示最近 (\d+) 条$/))) return `By last_activity desc · latest ${m[1]}`
  if ((m = text.match(/^数据已更新（v(.+)）$/))) return `Data updated (v${m[1]})`
  if (text.startsWith('拖动 10 个维度权重')) return 'Drag the 10 dimension weights; after normalization, calculate'
  if (text === '维度分') return 'dimension score'
  if (text === '重算全部机会，并实时刷新') return 'recalculate all opportunities and refresh live'
  if (text.startsWith('榜单与柱状图（演示，不写回')) return 'rankings and bar chart (demo, not written back)'
  if (text.startsWith('每类的源数量与价值分均值')) return 'Source count and average value per category'
  if (text === '% · total = round(Σ(维度得分 × 权重) × 10, 1) · ') return '% · total = round(Σ(dimension score × weight) × 10, 1) · '
  if (text.startsWith('% · total = round(')) return '% · total = round(Σ(dimension score × weight) × 10, 1) · '
  if (text.startsWith('还没有加入实验')) return 'No experiment yet. Treat this opportunity as a 7-day testable hypothesis: record budget and daily actions, then decide whether to continue or stop using the falsification conditions after 7 days.'
  if (text.startsWith('窗口价值衰减（按')) return `Window value decay (by ${text.replace(/^窗口价值衰减（按/, '').replace(/）$/, '')})`
  if (text.includes('现有分桶')) return text.replace(/现有分桶/g, 'buckets')
  if (text.startsWith('报告在浏览器本地用已打包数据生成')) return 'Reports are generated locally from bundled data (Blob download, offline); the scanner also produces same-structure reports, complementing each other.'
  if (text.startsWith('当前窗口状态 ')) {
    return text
      .replace(/^当前窗口状态 /, 'Current window status ')
      .replace(/，衰减 /, ', decay ')
      .replace(/；如果要做，现在就该进入 7 天验证（/, '; if pursuing, start the 7-day validation now (')
      .replace(/）。$/, ').')
  }
  if ((m = text.match(/^全部有效 (\d+) 条$/))) return `${m[1]} active`
  if ((m = text.match(/^数据基准 (.+) · 距今 (\d+) 天$/))) return `Data as-of ${m[1]} · ${m[2]} days ago`
  if ((m = text.match(/^数据已 (\d+) 天未更新（as_of (.+)）$/))) return `Data is ${m[1]} days old (as_of ${m[2]})`
  if (text.startsWith('数据基准日 ')) {
    return text
      .replace(/^数据基准日 /, 'Data as-of ')
      .replace(/，距今 /, ', age ')
      .replace(/ 天；建议运行每日任务 /, ' days; run the daily task ')
      .replace(/，或手动 python scanner\/pipeline.py --all --as-of YYYY-MM-DD 更新数据与构建。/, ', or manually run python scanner/pipeline.py --all --as-of YYYY-MM-DD to rebuild.')
  }
  if ((m = text.match(/^(\d+) 天验证动作清单$/))) return `${m[1]}-day validation checklist`
  if (text === '暂无榜首数据') return 'No leaderboard data yet'
  if ((m = text.match(/^(\d+) 个 · 见 About\/预警中心$/))) return `${m[1]} · see About / Alerts`
  if (text.includes('About/预警中心')) return text.replace(/About\/预警中心/g, 'About/Alerts')
  if (text.startsWith('返回内容不是可解析的 feed')) return text.replace(/^返回内容不是可解析的 feed/, 'Unparsable feed').replace(/有效条目 /, 'valid items: ').replace(/ 条/, '')
  if ((m = text.match(/^当前榜单 delta 较上一快照（(.+)）。$/))) return `Current ranking delta vs previous snapshot (${m[1]}).`
  if ((m = text.match(/^· 历史快照 (\d+) 份$/))) return `· ${m[1]} history snapshots`
  if (text.startsWith('检查于 ')) {
    return text
      .replace(/^检查于 /, 'Checked at ')
      .replace(/返回内容不是可解析的 feed/, 'Unparsable feed')
      .replace(/有效条目 /, 'valid items: ')
      .replace(/ 条）/, ')')
      .replace(/。可到数据源矩阵查看合规与替代方案。/, '. See Sources for compliance and alternatives.')
  }
  if (text === '勾选即本地保存（localStorage），不联网、不上传。') return 'Checked items save in localStorage; no network, no upload.'
  if (text === '区域 × 类别覆盖热力') return 'Region × category coverage heatmap'
  if (text === '按全部节点 lead_time_days 均值') return 'Average lead_time_days across all nodes'
  if (text === ' · 现有分桶 ') return ' · buckets '
  if (text.startsWith('报告可导出')) return 'Reports can be exported; experiment JSON uses the docs/12 §1.3 schema and can be passed to python scanner/calibrate.py --experiments <file>.'
  if ((m = text.match(/^现有分桶 (\d+)$/))) return `${m[1]} buckets`
  if ((m = text.match(/^候选池：(\d+) 机会 · (\d+)$/))) return `Candidate pool: ${m[1]} opportunities · ${m[2]}`
  if ((m = text.match(/^条 \/ 窗口 (\d+)$/))) return `${m[1]} items / window`
  if ((m = text.match(/^\/ 建议 ≥(\d+)$/))) return `/ recommended ≥${m[1]}`
  if (text === '= ISO 周（') return '= ISO week ('
  if ((m = text.match(/^（上期快照 (.+)，delta = 上期名次 − 本期名次，正数=上升）$/)))
    return `(previous snapshot ${m[1]}, delta = previous rank − current rank; positive = up)`
  if ((m = text.match(/^开启后过滤启动资金 > 档位上限（¥([\d,]+)）的机会；关闭沿用分数差硬约束$/)))
    return `Filter opportunities whose startup capital exceeds the band cap (¥${m[1]}) when on; score-gap rule when off`
  if ((m = text.match(/^([SABCD]) 级 \/ 总分 ([\d.]+)，证据 (\d+) 条但 verified=false；行动前请复核原始来源，避免把营销稿当一手证据。$/)))
    return `Grade ${m[1]} / total ${m[2]}, ${m[3]} evidence items but verified=false; verify original sources before acting, not marketing copy.`
  if (text === '每') return 'Every'
  if ((m = text.match(/^日 \/ 周 \/ 月 \/ 年榜单规模与榜首 · 口径：较上一快照（(.+)）$/)))
    return `Day / Week / Month / Year size & top · basis: vs previous snapshot (${m[1]})`
  if ((m = text.match(/^较上一快照（(.+)）$/))) return `vs previous snapshot (${m[1]})`
  if ((m = text.match(/^(\d+) 个开放\/鼎盛窗口$/))) return `${m[1]} open/peak windows`
  if ((m = text.match(/^平均总分 ([\d.]+) · 高分机会集中在 (.+)$/))) return `Avg. total ${m[1]} · high scores cluster in ${m[2]}`
  if ((m = text.match(/^共 (\d+) 条$/))) return `${m[1]} total`
  if ((m = text.match(/^(\d+) 条匹配 · ↵ 打开第一条$/))) return `${m[1]} matches · ↵ open first`
  if ((m = text.match(/^第 (\d+) 天(.*)$/))) return `Day ${m[1]}${m[2] ? ` ${m[2].trim()}` : ''}`
  if ((m = text.match(/^(\d+) 天后$/))) return `in ${m[1]}d`
  if ((m = text.match(/^还有 (\d+) 天$/))) return `${m[1]}d left`
  if ((m = text.match(/^(\d+) 个月$/))) return `${m[1]} mo`
  if ((m = text.match(/^(\d+) 天$/))) return `${m[1]} d`
  if ((m = text.match(/^(\d+) 小时$/))) return `${m[1]} h`
  if ((m = text.match(/^(\d+) 年$/))) return `${m[1]} yr`
  if ((m = text.match(/^(\d+) 条$/))) return `${m[1]} items`
  if ((m = text.match(/^(\d+) 个$/))) return `${m[1]}`
  if ((m = text.match(/^窗口仅剩 (\d+) 个月：(.+)$/))) return `Window closes in ${m[1]} months: ${m[2]}`
  if ((m = text.match(/^实验已超期 (\d+) 天未结案：(.+)$/))) return `Experiment overdue ${m[1]} days: ${m[2]}`
  if ((m = text.match(/^A 级以上但证据未核验：(.+)$/))) return `Grade A+ but evidence unverified: ${m[1]}`
  if ((m = text.match(/^高匹配但未行动：(.+)$/))) return `High fit but no action: ${m[1]}`
  if ((m = text.match(/^采集源失败：(.+)$/))) return `Source failed: ${m[1]}`
  return null
}

/** 递归翻译 ECharts option 中的字符串（图表 canvas 文案无法用 DOM 翻译层处理） */
export function localizeChartOption<T>(option: T): T {
  if (currentLang !== 'en') return option
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return translateString(value)
    if (Array.isArray(value)) return value.map(walk)
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = walk(v)
      return out
    }
    return value
  }
  return walk(option) as T
}

/** 组件内使用：依赖 I18nProvider 的 lang 触发重渲染 */
export function t(text: string): string {
  return currentLang === 'en' ? translateString(text) : text
}

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: typeof t
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

/* ============================ DOM 翻译层 ============================ */

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'aria-description'] as const
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])
const SKIP_SELECTOR = '[data-i18n-skip]'

let observer: MutationObserver | null = null
let applying = false
const textOriginal = new WeakMap<Text, string>()
const textLast = new WeakMap<Text, string>()
const trackedText = new Set<Text>()
const attrOriginal = new Map<Element, Map<string, string>>()
const attrLast = new WeakMap<Element, Map<string, string>>()

function skipped(node: Node | null): boolean {
  const el = node instanceof Element ? node : node?.parentElement
  if (!el) return true
  if (SKIP_TAGS.has(el.tagName)) return true
  return !!el.closest(SKIP_SELECTOR)
}

function translateText(node: Text) {
  if (!node.isConnected || skipped(node)) return
  const current = node.nodeValue ?? ''
  if (!current.trim()) return
  const previous = textLast.get(node)
  // React 重新渲染为中文时，把新的中文源文本记为 original
  if (previous !== undefined && current !== previous) {
    textOriginal.set(node, current)
  } else if (!textOriginal.has(node)) {
    textOriginal.set(node, current)
    trackedText.add(node)
  }
  const original = textOriginal.get(node) ?? current
  const next = translateString(original)
  textLast.set(node, next)
  if (node.nodeValue !== next) {
    applying = true
    node.nodeValue = next
    applying = false
  }
}

function translateAttrs(el: Element) {
  if (skipped(el)) return
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr)
    if (!value || !/[一-龥]/.test(value)) continue
    let map = attrOriginal.get(el)
    if (!map) {
      map = new Map()
      attrOriginal.set(el, map)
    }
    let last = attrLast.get(el)
    if (!last) {
      last = new Map()
      attrLast.set(el, last)
    }
    if (last.has(attr) && last.get(attr) !== value) map.set(attr, value)
    else if (!map.has(attr)) map.set(attr, value)
    const next = translateString(map.get(attr) || value)
    last.set(attr, next)
    if (next !== value) el.setAttribute(attr, next)
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateText(root as Text)
    return
  }
  if (!(root instanceof Element) && root.nodeType !== Node.DOCUMENT_NODE) return
  if (root instanceof Element) translateAttrs(root)
  const doc = root.ownerDocument || document
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n: Node | null = walker.nextNode()
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text)
    else if (n instanceof Element) translateAttrs(n)
    n = walker.nextNode()
  }
}

function restoreDom() {
  observer?.disconnect()
  observer = null
  for (const node of trackedText) {
    if (!node.isConnected) continue
    const original = textOriginal.get(node)
    if (original !== undefined && node.nodeValue !== original) {
      applying = true
      node.nodeValue = original
      applying = false
    }
  }
  for (const [el, map] of attrOriginal) {
    if (!el.isConnected) continue
    for (const [attr, original] of map) el.setAttribute(attr, original)
  }
  trackedText.clear()
  attrOriginal.clear()
}

function installTranslator() {
  restoreDom()
  walk(document.body)
  observer = new MutationObserver((records) => {
    if (applying) return
    for (const rec of records) {
      if (rec.type === 'characterData' && rec.target.nodeType === Node.TEXT_NODE) {
        translateText(rec.target as Text)
      } else if (rec.type === 'childList') {
        rec.addedNodes.forEach((n) => walk(n))
      } else if (rec.type === 'attributes' && rec.target instanceof Element) {
        translateAttrs(rec.target)
      }
    }
  })
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  })
}

/** 语言切换后在 EN 下启用 DOM 翻译；切回 zh 恢复原文。 */
export function installDomTranslation(lang: Lang) {
  if (lang === 'en') installTranslator()
  else restoreDom()
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang)

  // 保证 currentLang 在 render 时与 state 一致，供 t()/translateString() 使用
  currentLang = lang

  useLayoutEffect(() => {
    setStoredLang(lang)
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
    document.title = DOC_TITLE[lang]
    installDomTranslation(lang)
    return () => {
      if (observer) observer.disconnect()
    }
  }, [lang])

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang: (next) => setLangState(next),
      t,
    }),
    [lang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** 按语言选择文案（用于明确的双语常量） */
export function pick<T>(zh: T, en: T, lang: Lang = currentLang): T {
  return lang === 'en' ? en : zh
}
