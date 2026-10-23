import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BadgeCheck, BookmarkPlus, Compass, ExternalLink, Filter, Search, ShieldAlert, Sparkles, X } from 'lucide-react'
import { Badge, Button, EmptyState, Panel } from '@/components/ui'
import { dataAsOf, gapName, industryName, regionName, taxonomy } from '@/lib/data'
import { candidateWindowItems, candidates, candidatesAvailable, candidatesMeta, gapInferenceCoverage, translationSummary, type Candidate } from '@/lib/candidates'
import { useI18n } from '@/lib/i18n'
import { cn, fmtCnyRange, fmtDateCn, fmtScore } from '@/lib/utils'
import type { WindowKey } from '@/types'

type L = (zh: string, en: string) => string

const WINDOWS: Array<{ key: WindowKey; zh: string; en: string }> = [
  { key: 'day', zh: '日榜', en: 'Day' },
  { key: 'week', zh: '周榜', en: 'Week' },
  { key: 'month', zh: '月榜', en: 'Month' },
  { key: 'year', zh: '年榜', en: 'Year' },
]

const QUESTION_LABELS: Record<string, { zh: string; en: string }> = {
  traffic: { zh: '流量 / 获客入口', en: 'Traffic / acquisition' },
  money: { zh: '赚钱方式', en: 'How money is made' },
  model: { zh: '交付模型', en: 'Delivery model' },
  roi: { zh: '投入与回报', en: 'Investment & return' },
  audience: { zh: '目标人群', en: 'Audience' },
  drivers: { zh: '驱动因子', en: 'Drivers' },
  moat: { zh: '壁垒 / 风险', en: 'Moat / risks' },
  需求: { zh: '需求', en: 'Need' },
  人群: { zh: '人群', en: 'Audience' },
  竞品: { zh: '竞品', en: 'Competition' },
  差异: { zh: '差异', en: 'Differentiation' },
  渠道: { zh: '渠道', en: 'Channels' },
  成本: { zh: '成本', en: 'Cost' },
  验证: { zh: '验证（可选）', en: 'Validation (optional)' },
}

const WATCHLIST_KEY = 'radar:watchlist:v1'

function readWatchlist(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function autoDraftEntries(candidate: Candidate): Array<{ key: string; value: string }> {
  if (Array.isArray(candidate.seven_questions)) {
    return candidate.seven_questions.map((x, i) => ({ key: x.key || `q${i + 1}`, value: x.value || '' }))
  }
  return Object.entries(candidate.seven_questions).map(([key, value]) => ({ key, value }))
}

function displayTitle(c: Candidate, original = false): string {
  return original ? (c.title_original || c.source.raw_title || c.title) : (c.title_zh || c.title)
}

function displayOriginal(c: Candidate): string {
  return c.title_original || c.source.raw_title || (c.title_zh && c.title_zh !== c.title ? c.title : '')
}

function displayOneLiner(c: Candidate, original = false): string {
  return original ? c.one_liner : (c.one_liner_zh || c.one_liner)
}

function translationProvider(c: Candidate): string {
  if (c.translation?.template) return 'template'
  return c.translation?.provider || (c.translation_method === 'source-zh' ? 'source-zh' : c.title_zh ? 'glossary' : 'template')
}

function translationProviderLabel(c: Candidate, L: L): string {
  const p = translationProvider(c)
  if (p === 'llm') return L('LLM 在线翻译', 'LLM online')
  if (p === 'source-zh') return L('中文源', 'Chinese source')
  if (p === 'mock') return L('Mock 翻译', 'Mock')
  if (p === 'template') return L('模板翻译', 'Template translation')
  return L('离线词典', 'Offline glossary')
}

function translationQuality(c: Candidate): { zh: string; en: string; tone: 'signal' | 'amber' | 'muted' | 'cyan' } {
  const q = c.translation?.quality || (translationProvider(c) === 'source-zh' ? 'source-zh' : c.title_zh ? 'medium' : 'low')
  if (q === 'high') return { zh: '高质量', en: 'high', tone: 'signal' }
  if (q === 'source-zh') return { zh: '中文源', en: 'source-zh', tone: 'cyan' }
  if (q === 'medium') return { zh: '中等质量', en: 'medium', tone: 'amber' }
  return { zh: '模板/低质量', en: 'low', tone: 'muted' }
}

function systemLevel(c: Candidate): 'high' | 'medium' | 'low' {
  const level = c.system_validation?.level
  return level === 'high' || level === 'medium' || level === 'low' ? level : (c.scores.total >= 75 ? 'high' : c.scores.total >= 65 ? 'medium' : 'low')
}

function systemLevelLabel(level: 'high' | 'medium' | 'low', L: L, score?: number): string {
  return `${L('系统已评估', 'System-assessed')} · ${level}${score != null ? `/${Math.round(score)}` : ''}`
}

function physicalStatusLabel(status: string | undefined, L: L): string {
  if (status === 'observing') return L('观察中（可选）', 'Observing (optional)')
  if (status === 'tested') return L('已测试（可选）', 'Tested (optional)')
  return L('未开始（可选）', 'Not started (optional)')
}

const CHECK_LABELS: Record<string, { zh: string; en: string }> = {
  demand_signal: { zh: '需求信号', en: 'Demand signal' },
  demand: { zh: '需求信号', en: 'Demand signal' },
  gap_clear: { zh: '信息差明确', en: 'Clear information gap' },
  gap: { zh: '信息差明确', en: 'Clear information gap' },
  evidence: { zh: '公开证据', en: 'Public evidence' },
  evidence_1: { zh: '公开证据', en: 'Public evidence' },
  source_quality: { zh: '来源质量', en: 'Source quality' },
  freshness: { zh: '时效性', en: 'Freshness' },
  feasibility: { zh: '可执行性', en: 'Feasibility' },
  geo_specific: { zh: '地理具体性', en: 'Geographic specificity' },
  competition_window: { zh: '竞争与窗口', en: 'Competition / window' },
  window: { zh: '竞争与窗口', en: 'Competition / window' },
}

function fallbackChecks(c: Candidate): Array<{ id?: string; name?: string; passed?: boolean; note?: string }> {
  return [
    { id: 'demand_signal', passed: c.confidence >= 55 || c.evidence.length > 0 },
    { id: 'gap', passed: c.gap_type_ids.length > 0 },
    { id: 'evidence', passed: c.evidence.length > 0 },
    { id: 'source_quality', passed: !!c.source.name },
    { id: 'freshness', passed: !!c.first_seen },
    { id: 'feasibility', passed: true },
  ]
}

function systemChecks(c: Candidate): Array<{ id?: string; name?: string; passed?: boolean; note?: string }> {
  const checks = c.system_validation?.checks || []
  return checks.length ? checks : fallbackChecks(c)
}

export function CandidateBoard({ className }: { className?: string }) {
  const { lang } = useI18n()
  const L: L = (zh, en) => (lang === 'en' ? en : zh)
  const [win, setWin] = useState<WindowKey>('day')
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState('all')
  const [region, setRegion] = useState('all')
  const [gap, setGap] = useState('all')
  const [onlyGaps, setOnlyGaps] = useState(false)
  const [viewOriginal, setViewOriginal] = useState(false)
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [watched, setWatched] = useState<string[]>(readWatchlist)

  const windowRows = useMemo(() => candidateWindowItems(win), [win])
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return windowRows.filter(({ candidate: c }) => {
      if (industry !== 'all' && !c.industry_ids.includes(industry)) return false
      if (region !== 'all' && !c.region_ids.includes(region)) return false
      if (gap !== 'all' && !c.gap_type_ids.includes(gap)) return false
      if (onlyGaps && !c.gap_type_ids.length) return false
      if (q && !`${c.title} ${c.one_liner} ${c.target_countries.join(' ')} ${c.source.name || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [windowRows, industry, region, gap, onlyGaps, query])

  const toggleWatch = (id: string) => {
    const next = watched.includes(id) ? watched.filter((x) => x !== id) : [...watched, id]
    setWatched(next)
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next))
    } catch {
      /* local only */
    }
  }

  const sourceOptions = useMemo(() => {
    const industrySet = new Set(candidates.flatMap((c) => c.industry_ids))
    const regionSet = new Set(candidates.flatMap((c) => c.region_ids))
    const gapSet = new Set(candidates.flatMap((c) => c.gap_type_ids))
    return {
      industries: taxonomy.industries.filter((x) => industrySet.has(x.id)),
      regions: taxonomy.regions.filter((x) => regionSet.has(x.id)),
      gaps: taxonomy.gap_types.filter((x) => gapSet.has(x.id)),
    }
  }, [])

  if (!candidatesAvailable) {
    return (
      <Panel className={cn('p-4', className)}>
        <EmptyState title={L('自动发现候选尚未生成', 'Auto-discovered candidates are not ready yet')} hint={L('发现榜与验证/实验无关；数据构建完成候选后会自动出现在这里。', 'Discovery is independent of validation/experiments; candidates appear here once the data build produces them.')} />
      </Panel>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {WINDOWS.map((w) => (
          <button key={w.key} type="button" onClick={() => setWin(w.key)} className={cn('rounded border px-2.5 py-1 text-[11px]', win === w.key ? 'border-signal/50 bg-signal/10 text-signal' : 'border-line text-muted hover:border-line-strong')}>
            {L(w.zh, w.en)}
          </button>
        ))}
        <Badge tone="signal" title={L('系统已评估商机成立度（需求 / 信息差 / 证据 / 时效 / 可执行），无需人工验证；实体验证仅为个人可选。', 'The system assessed business viability (demand, gap, evidence, timing, feasibility); no human validation is required. Physical validation is optional and personal.')}>
          <BadgeCheck className="h-3 w-3" /> {L('系统评估 · 无需人工验证', 'System-assessed · no manual validation needed')}
        </Badge>
        <Badge tone="cyan" title={L('系统翻译状态来自数据 meta.translation_summary', 'Translation status from data meta.translation_summary')}>
          {L('系统翻译', 'System translation')} · {translationSummary.provider === 'llm' ? 'LLM' : translationSummary.provider === 'source-zh' ? L('中文源', 'Chinese source') : L('离线词典', 'Offline glossary')}
        </Badge>
        <span className="ml-auto flex items-center gap-1 rounded border border-line p-0.5">
          <button type="button" onClick={() => setViewOriginal(false)} className={cn('rounded px-1.5 py-0.5 text-[9.5px]', !viewOriginal ? 'bg-signal/15 text-signal' : 'text-dim')}>{L('中文', 'Chinese')}</button>
          <button type="button" onClick={() => setViewOriginal(true)} className={cn('rounded px-1.5 py-0.5 text-[9.5px]', viewOriginal ? 'bg-cyan/15 text-cyan' : 'text-dim')}>{L('原文', 'Original')}</button>
        </span>
        <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-dim">
          {L(`信息差推断 ${gapInferenceCoverage.inferred}/${gapInferenceCoverage.total}`, `Gap inferred ${gapInferenceCoverage.inferred}/${gapInferenceCoverage.total}`)}
        </span>
        <span className="font-mono text-[9.5px] text-dim">{windowRows.length} {L('条候选', 'candidates')} · {candidatesMeta.data_version ? `v${candidatesMeta.data_version}` : ''}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-7 min-w-[190px] flex-1 items-center gap-1.5 rounded border border-line bg-panel-2 px-2">
          <Search className="h-3 w-3 text-dim" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('搜索候选 / 国家 / 来源…', 'Search candidates / countries / source…')} className="min-w-0 flex-1 bg-transparent text-[11px] text-ink outline-none placeholder:text-dim" />
        </label>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-7 rounded border border-line bg-panel-2 px-2 text-[10.5px] text-muted outline-none" aria-label={L('行业筛选', 'Industry filter')}>
          <option value="all">{L('全部行业', 'All industries')}</option>
          {sourceOptions.industries.map((x) => <option key={x.id} value={x.id}>{industryName(x.id)}</option>)}
        </select>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="h-7 rounded border border-line bg-panel-2 px-2 text-[10.5px] text-muted outline-none" aria-label={L('区域筛选', 'Region filter')}>
          <option value="all">{L('全部区域', 'All regions')}</option>
          {sourceOptions.regions.map((x) => <option key={x.id} value={x.id}>{regionName(x.id)}</option>)}
        </select>
        <select value={gap} onChange={(e) => setGap(e.target.value)} className="h-7 rounded border border-line bg-panel-2 px-2 text-[10.5px] text-muted outline-none" aria-label={L('信息差筛选', 'Gap filter')}>
          <option value="all">{L('全部信息差', 'All gaps')}</option>
          {sourceOptions.gaps.map((x) => <option key={x.id} value={x.id}>{gapName(x.id)}</option>)}
        </select>
        <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded border border-line px-2 text-[10px] text-muted">
          <input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} className="accent-signal" />
          {L('仅看有信息差', 'Only with gap inference')}
        </label>
        <span className="ml-auto inline-flex items-center gap-1 text-[9.5px] text-dim"><Filter className="h-3 w-3" /> {rows.length} / {windowRows.length}</span>
      </div>

      {!rows.length ? (
        <Panel className="p-6 text-center">
          <EmptyState
            title={L('当前窗口暂无自动发现候选', 'No auto-discovered candidates in this window')}
            hint={L('发现榜不要求验证或实验；可切换其他窗口或清空筛选。候选由采集信号自动生成，数量会随每日采集增长。', 'Discovery never requires verification or experiments. Switch windows or clear filters; candidates are generated from fetched signals and grow with daily fetching.')}
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ candidate: c, rank }) => (
            <button key={c.candidate_id} type="button" onClick={() => setSelected(c)} className="panel panel-hover accent-top group relative flex flex-col overflow-hidden p-3 text-left" style={{ '--accent': '#4cc9f0' } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <span className="num text-[20px] font-semibold text-dim">{String(rank).padStart(2, '0')}</span>
                <Badge tone="signal" title={L('系统已评估商机成立度（需求 / 信息差 / 证据 / 时效 / 可执行），无需人工验证。', 'The system assessed business viability (demand, gap, evidence, timing, feasibility); no human validation is required.')}>{systemLevelLabel(systemLevel(c), L, c.system_validation?.score ?? c.scores.total)}</Badge>
                <span className="ml-auto rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-dim">conf {c.confidence}</span>
              </div>
              <div className="mt-1.5 line-clamp-2 text-[13px] font-semibold text-ink">{displayTitle(c, viewOriginal)}</div>
              {displayOriginal(c) && displayOriginal(c) !== displayTitle(c, viewOriginal) && <div className="mt-0.5 truncate text-[9px] text-dim">{viewOriginal ? (c.title_zh || '') : displayOriginal(c)}</div>}
              <div className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-muted">{displayOneLiner(c, viewOriginal)}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Badge tone={translationQuality(c).tone} title={L(`provider: ${translationProvider(c)} · quality: ${c.translation?.quality || 'fallback'} · cached: ${c.translation?.cached ? 'yes' : 'no'}`, `provider: ${translationProvider(c)} · quality: ${c.translation?.quality || 'fallback'} · cached: ${c.translation?.cached ? 'yes' : 'no'}`)}>
                  {L('系统翻译', 'System translation')} · {translationProviderLabel(c, L)} · {L(translationQuality(c).zh, translationQuality(c).en)}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.industry_ids.slice(0, 1).map((id) => <span key={id} className="rounded border border-line/60 px-1 py-0.5 text-[8.5px] text-dim">{industryName(id)}</span>)}
                {c.gap_type_ids.slice(0, 1).map((id) => <span key={id} className="rounded border border-line/60 px-1 py-0.5 text-[8.5px] text-dim">{gapName(id)}{c.gap_inferred ? L(' · 推断', ' · inferred') : ''}</span>)}
                {!c.gap_type_ids.length && <span className="rounded border border-line/60 border-dashed px-1 py-0.5 text-[8.5px] text-dim">{L('—（无信息差推断）', '— (no gap inference)')}</span>}
                {c.region_ids.slice(0, 1).map((id) => <span key={id} className="rounded border border-line/60 px-1 py-0.5 text-[8.5px] text-dim">{regionName(id)}</span>)}
              </div>
              <div className="mt-2 flex items-end justify-between border-t border-line/50 pt-2">
                <div>
                  <div className="mono-label">{L('来源', 'Source')}</div>
                  <div className="max-w-[150px] truncate text-[9.5px] text-muted">{c.source.name || c.source.id || '—'}</div>
                </div>
                <div className="text-right">
                  <div className="num text-[16px] font-semibold text-signal">{fmtScore(c.scores.total)}</div>
                  <div className="font-mono text-[9px] text-dim">{c.scores.grade} · {L('首次', 'first')} {c.first_seen || '—'}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-[900px] overflow-auto rounded border border-line bg-panel p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="signal" title={L('系统已评估商机成立度（需求 / 信息差 / 证据 / 时效 / 可执行），无需人工验证。', 'The system assessed business viability (demand, gap, evidence, timing, feasibility); no human validation is required.')}>{systemLevelLabel(systemLevel(selected), L, selected.system_validation?.score ?? selected.scores.total)}</Badge>
                  <span className="font-mono text-[9.5px] text-dim">{selected.candidate_id}</span>
                  <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-dim">conf {selected.confidence}</span>
                </div>
                <h2 className="mt-2 text-[18px] font-semibold text-ink">{displayTitle(selected, viewOriginal)}</h2>
                {displayOriginal(selected) && displayOriginal(selected) !== displayTitle(selected, viewOriginal) && <div className="mt-0.5 text-[10px] text-dim">{L('原文标题', 'Original title')}: {displayOriginal(selected)}</div>}
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{displayOneLiner(selected, viewOriginal)}</p>
                <div className="mt-2 rounded border border-cyan/20 bg-cyan/[0.03] px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={translationQuality(selected).tone}>{L('系统翻译', 'System translation')} · {translationProviderLabel(selected, L)}</Badge>
                    <span className="font-mono">quality {selected.translation?.quality || 'fallback'} · cached {selected.translation?.cached ? 'yes' : 'no'} · {selected.translation?.source_lang || 'en'} → {selected.translation?.target_lang || 'zh'}</span>
                    <button type="button" onClick={() => setViewOriginal((v) => !v)} className="ml-auto rounded border border-line px-1.5 py-0.5 text-[9px] text-muted hover:text-ink">{viewOriginal ? L('看中文', 'Chinese') : L('看原文', 'Original')}</button>
                  </div>
                  {selected.summary_zh && <div className="mt-1">{L('中文摘要', 'Chinese summary')}: {selected.summary_zh}</div>}
                  {viewOriginal && selected.title_zh && <div>{L('中文标题', 'Chinese title')}: {selected.title_zh}</div>}
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded border border-line p-1 text-dim hover:text-ink" aria-label={L('关闭详情', 'Close details')}><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded border border-line/60 p-2.5">
                <div className="mono-label mb-1">{L('评分与置信度', 'Scores & confidence')}</div>
                <div className="flex items-center gap-3">
                  <span className="num text-[26px] font-semibold text-signal">{fmtScore(selected.scores.total)}</span>
                  <Badge tone="signal">{selected.scores.grade}</Badge>
                  <span className="font-mono text-[10px] text-dim">rank {fmtScore(selected.scores.rank_score)} · conf {selected.confidence}</span>
                </div>
                {selected.scores.dimensions && (
                  <div className="mt-1.5 space-y-0.5">
                    {Object.entries(selected.scores.dimensions).map(([k, v]) => <div key={k} className="flex justify-between text-[9.5px] text-dim"><span>{k}</span><span className="num">{fmtScore(v)}</span></div>)}
                  </div>
                )}
              </div>
              <div className="rounded border border-line/60 p-2.5">
                <div className="mono-label mb-1">{L('ROI 估算（自动）', 'ROI estimate (auto)')}</div>
                <div className="space-y-0.5 text-[10px] text-muted">
                  <div>{L('启动资金', 'Capital')}: {selected.roi.capital_cny ? fmtCnyRange(selected.roi.capital_cny.min ?? 0, selected.roi.capital_cny.max ?? 0) : '—'}</div>
                  <div>{L('回本周期', 'Payback')}: {selected.roi.payback_months ?? '—'} {L('个月', 'months')}</div>
                  <div>{L('月收入估算', 'Monthly revenue')}: {selected.roi.monthly_revenue_cny ? fmtCnyRange(selected.roi.monthly_revenue_cny.min ?? 0, selected.roi.monthly_revenue_cny.max ?? 0) : '—'}</div>
                  <div>{L('毛利率', 'Gross margin')}: {selected.roi.gross_margin_pct ?? '—'}%</div>
                </div>
              </div>
            </div>
            <div className="mt-3 rounded border border-signal/20 bg-signal/[0.03] p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mono-label">{L('系统评估', 'System assessment')}</div>
                <Badge tone="signal">{systemLevelLabel(systemLevel(selected), L, selected.system_validation?.score ?? selected.scores.total)}</Badge>
                <span className="font-mono text-[10px] text-dim">score {selected.system_validation?.score ?? selected.scores.total}</span>
              </div>
              <div className="mt-1 text-[9.5px] leading-relaxed text-dim">
                {L('系统已评估商机成立度（需求 / 信息差 / 证据 / 时效 / 可执行），无需人工验证；这是自动评估，不是收益保证。', 'The system assessed business viability (demand, gap, evidence, timing, feasibility); no human validation is required. This is an automated assessment, not a revenue guarantee.')}
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2">
                {systemChecks(selected).map((check, i) => (
                  <div key={`${check.id || check.name || i}`} className="flex items-start gap-1.5 rounded border border-line/50 px-2 py-1 text-[9.5px]">
                    <span className={cn('mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full', check.passed ? 'bg-signal' : 'bg-amber')} />
                    <span className="min-w-0 flex-1">
                      <span className="text-muted">{check.id && CHECK_LABELS[check.id] ? L(CHECK_LABELS[check.id].zh, CHECK_LABELS[check.id].en) : (check.name || check.id || `check ${i + 1}`)}</span>
                      {check.note && <span className="block text-[8.5px] text-dim">{check.note}</span>}
                    </span>
                    <span className={check.passed ? 'text-signal' : 'text-amber'}>{check.passed ? 'PASS' : L('待观察', 'WATCH')}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <div className="mono-label mb-1">{L('七问自动草稿', 'Seven questions (auto draft)')}</div>
              <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                {autoDraftEntries(selected).map((x) => (
                  <div key={x.key} className="rounded border border-line/50 px-2 py-1.5 text-[10px]">
                    <div className="text-muted">{QUESTION_LABELS[x.key] ? L(QUESTION_LABELS[x.key].zh, QUESTION_LABELS[x.key].en) : x.key}</div>
                    <div className="mt-0.5 text-dim">{x.value || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <div className="mono-label mb-1">{L('证据来源', 'Evidence sources')}</div>
                <div className="space-y-1">
                  {selected.evidence.map((e, i) => (
                    <a key={`${e.url}-${i}`} href={e.url} target="_blank" rel="noreferrer" className="block truncate rounded border border-line/50 px-2 py-1 text-[9.5px] text-muted hover:text-signal">
                      {e.title || e.url} <ExternalLink className="inline h-2.5 w-2.5" />
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <div className="mono-label mb-1">{L('发现信息', 'Discovery metadata')}</div>
                <div className="space-y-0.5 text-[10px] text-muted">
                  <div>{L('行业', 'Industries')}: {selected.industry_ids.map(industryName).join(' / ') || '—'}</div>
                  <div>{L('信息差', 'Gaps')}: {selected.gap_type_ids.map(gapName).join(' / ') || L('—（无信息差推断）', '— (no gap inference)')}{selected.gap_inferred ? L('（推断）', ' (inferred)') : ''}</div>
                  <div>{L('区域', 'Regions')}: {selected.region_ids.map(regionName).join(' / ') || '—'}{selected.region_inferred ? L('（推断）', ' (inferred)') : ''}</div>
                  <div>{L('首次发现', 'First seen')}: {selected.first_seen || '—'} · {fmtDateCn(selected.first_seen || dataAsOf)}</div>
                </div>
                {(selected.gap_inference || selected.source.cleaned || selected.source.raw_title) && (
                  <div className="mt-1.5 space-y-0.5 rounded border border-line/50 px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
                    {selected.gap_inference && <div>{L('信息差推断说明', 'Gap inference')}: {selected.gap_inference}</div>}
                    {selected.source.cleaned && <div>{L('清洗后标题', 'Cleaned title')}: {selected.source.cleaned}</div>}
                    {selected.source.raw_title && selected.source.raw_title !== selected.source.cleaned && <div>{L('原始标题', 'Original title')}: {selected.source.raw_title}</div>}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 rounded border border-amber/25 bg-amber/[0.04] px-2 py-1.5 text-[9.5px] leading-relaxed text-amber">
              <ShieldAlert className="mr-1 inline h-3 w-3" /> {selected.disclaimer}
            </div>
            <div className="mt-3 rounded border border-cyan/25 bg-cyan/[0.03] p-2.5">
              <div className="mono-label mb-1">{L('实体验证（可选，个人）', 'Physical validation (optional, personal)')}</div>
              <p className="text-[9.5px] leading-relaxed text-dim">
                {L('仅当你打算线下尝试时使用；系统已评估商机成立度，无需人工验证。实体验证状态不参与候选收录、排序或展示。', 'Use only if you plan to test this offline; the system already assessed business viability, so no human validation is required. Physical-validation status never affects candidate listing, ranking or display.')}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleWatch(selected.candidate_id)}>
                  <BookmarkPlus className="h-3.5 w-3.5" /> {watched.includes(selected.candidate_id) ? L('已加入观察', 'Watching') : L('加入观察（可选）', 'Watch (optional)')}
                </Button>
                <Link to="/lab" className="inline-flex h-7 items-center gap-1 rounded border border-line px-2 text-[10.5px] text-muted hover:text-ink">
                  {L('记录实验 / 结案（可选）', 'Log experiment / close (optional)')}
                </Link>
                {selected.source.url && <a href={selected.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10.5px] text-signal hover:underline">{L('打开原始来源', 'Open original source')} <ArrowUpRight className="h-3 w-3" /></a>}
                <span className="ml-auto font-mono text-[9px] text-dim">{L('实体验证状态', 'Physical status')}: {physicalStatusLabel(selected.verification_status, L)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
