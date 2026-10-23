import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Search, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, EmptyState, Panel } from '@/components/ui'
import { candidates, candidateWindowItems } from '@/lib/candidates'
import { OpportunityCard, type OpportunityCardModel } from '@/components/OpportunityCard'
import { dataAsOf, gapName, gradeOf, industryName, opportunities, rankings, regionName, taxonomy } from '@/lib/data'
import { useI18n } from '@/lib/i18n'
import { fmtScore } from '@/lib/utils'
import type { WindowKey } from '@/types'

type Row = {
  key: string
  kind: 'candidate' | 'curated'
  id: string
  title: string
  original?: string
  oneLiner: string
  score: number
  grade: string
  industry: string[]
  gaps: string[]
  regions: string[]
  source: string
  firstSeen: string
  primaryIndustry?: string
  eventType?: string
  capital?: { min?: number; max?: number }
  paybackMonths?: number
  windowMonths?: number | string
}

const WINDOWS: Array<{ key: WindowKey; zh: string; en: string }> = [
  { key: 'day', zh: '日榜', en: 'Day' },
  { key: 'week', zh: '周榜', en: 'Week' },
  { key: 'month', zh: '月榜', en: 'Month' },
  { key: 'year', zh: '年榜', en: 'Year' },
]

const RETIRED_TERMS = /验证|实验|复核|门禁/

function visibleOneLiner(value: string): string {
  return RETIRED_TERMS.test(value) ? '' : value
}

export default function Rankings() {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const [win, setWin] = useState<WindowKey>('week')
  const [track, setTrack] = useState<'all' | 'curated'>('all')
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState('all')
  const [region, setRegion] = useState('all')
  const [gap, setGap] = useState('all')
  const [visibleCount, setVisibleCount] = useState(30)

  const curatedById = useMemo(() => new Map(opportunities.map((o) => [o.id, o])), [])

  const candidateRows = useMemo<Row[]>(() => candidateWindowItems(win).map(({ candidate: c }) => ({
    key: `c-${c.candidate_id}`,
    kind: 'candidate',
    id: c.candidate_id,
    title: c.title_zh || c.title,
    original: c.title_original || c.source.raw_title,
    oneLiner: visibleOneLiner(c.one_liner_zh || c.one_liner),
    score: c.scores.total,
    grade: c.scores.grade,
    industry: c.industry_ids,
    gaps: c.gap_type_ids,
    regions: c.region_ids,
    source: c.source.name || L('自动采集', 'Auto fetched'),
    firstSeen: c.first_seen,
    primaryIndustry: c.primary_industry,
    eventType: typeof c.judgment?.event_type === 'string' ? c.judgment.event_type : undefined,
    capital: c.roi.capital_cny,
    paybackMonths: c.roi.payback_months,
    windowMonths: typeof c.timing?.window_months === 'number' || typeof c.timing?.window_months === 'string' ? c.timing.window_months : undefined,
  })), [win, L])

  const curatedRows = useMemo<Row[]>(() => {
    const items = rankings.windows[win]?.items || []
    return items.flatMap((item) => {
      const o = curatedById.get(item.opp_id)
      if (!o) return []
      return [{
        key: `o-${o.id}`,
        kind: 'curated' as const,
        id: o.id,
        title: o.title,
        oneLiner: visibleOneLiner(o.one_liner),
        score: o.scores.total || item.total,
        grade: o.scores.grade || gradeOf(o.scores.total || item.total),
        industry: [o.industry_id],
        gaps: o.gap_type_ids,
        regions: o.region_ids,
        source: o.origin_country || L('精选库', 'Curated'),
        firstSeen: o.first_seen,
        primaryIndustry: o.industry_id,
        capital: o.roi.capital_cny,
        paybackMonths: o.roi.payback_months,
        windowMonths: o.window?.months_left,
      }]
    })
  }, [win, curatedById, L])

  const rows = useMemo(() => {
    const base = track === 'curated' ? curatedRows : [...candidateRows, ...curatedRows]
    const q = query.trim().toLowerCase()
    return base
      .filter((r) => industry === 'all' || r.industry.includes(industry))
      .filter((r) => region === 'all' || r.regions.includes(region))
      .filter((r) => gap === 'all' || r.gaps.includes(gap))
      .filter((r) => !q || `${r.title} ${r.oneLiner} ${r.source} ${r.original || ''}`.toLowerCase().includes(q))
      .sort((a, b) => b.score - a.score)
      .slice(0, 300)
  }, [track, candidateRows, curatedRows, industry, region, gap, query])

  const industryOptions = useMemo(() => {
    const set = new Set<string>()
    ;[...candidateRows, ...curatedRows].forEach((r) => r.industry.forEach((x) => set.add(x)))
    return taxonomy.industries.filter((x) => set.has(x.id))
  }, [candidateRows, curatedRows])
  const regionOptions = useMemo(() => {
    const set = new Set<string>()
    ;[...candidateRows, ...curatedRows].forEach((r) => r.regions.forEach((x) => set.add(x)))
    return taxonomy.regions.filter((x) => set.has(x.id))
  }, [candidateRows, curatedRows])
  const gapOptions = useMemo(() => {
    const set = new Set<string>()
    ;[...candidateRows, ...curatedRows].forEach((r) => r.gaps.forEach((x) => set.add(x)))
    return taxonomy.gap_types.filter((x) => set.has(x.id))
  }, [candidateRows, curatedRows])

  return (
    <div>
      <PageHeader
        index="02"
        kicker={L('RANKINGS · 排行榜 / 商机榜', 'RANKINGS · OPPORTUNITIES')}
        title={L('商机榜 · 每天扫描，按窗口入榜', 'Opportunity board · scanned daily, ranked by window')}
        description={L('唯一榜单：自动发现候选全部入榜，精选机会以「精选」标签混排。日 / 周 / 月 / 年四个窗口直接可看，按评分排序。', 'The single board: all auto-discovered candidates are listed, with curated opportunities mixed in via a “Curated” tag. Four windows—day/week/month/year—ranked by score.')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">{L(`自动候选 ${candidates.length}`, `${candidates.length} auto candidates`)}</Badge>
            <Badge tone="signal">{L(`精选 ${opportunities.length}`, `${opportunities.length} curated`)}</Badge>
            <span className="font-mono text-[9px] text-dim">{L('数据基准', 'Data as of')} {dataAsOf}</span>
          </div>
        }
      />

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {WINDOWS.map((w) => (
          <button key={w.key} type="button" onClick={() => setWin(w.key)} className={win === w.key ? 'rounded border border-signal/50 bg-signal/10 px-2.5 py-1 text-[11px] text-signal' : 'rounded border border-line px-2.5 py-1 text-[11px] text-muted hover:border-line-strong'}>
            {L(w.zh, w.en)}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        <button type="button" onClick={() => setTrack('all')} className={track === 'all' ? 'rounded border border-cyan/50 bg-cyan/10 px-2.5 py-1 text-[11px] text-cyan' : 'rounded border border-line px-2.5 py-1 text-[11px] text-muted hover:border-line-strong'}>
          {L('全部', 'All')} · {candidateRows.length + curatedRows.length}
        </button>
        <button type="button" onClick={() => setTrack('curated')} className={track === 'curated' ? 'rounded border border-signal/50 bg-signal/10 px-2.5 py-1 text-[11px] text-signal' : 'rounded border border-line px-2.5 py-1 text-[11px] text-muted hover:border-line-strong'}>
          {L('精选', 'Curated')} · {curatedRows.length}
        </button>
        <span className="ml-auto text-[9.5px] text-dim">{L(`当前 ${rows.length} 条`, `${rows.length} rows`)}</span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex h-7 min-w-[190px] flex-1 items-center gap-1.5 rounded border border-line bg-panel-2 px-2">
          <Search className="h-3 w-3 text-dim" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('搜索商机 / 国家 / 来源…', 'Search opportunities / countries / source…')} className="min-w-0 flex-1 bg-transparent text-[11px] text-ink outline-none placeholder:text-dim" />
        </label>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-7 rounded border border-line bg-panel-2 px-2 text-[10.5px] text-muted outline-none" aria-label={L('行业筛选', 'Industry filter')}>
          <option value="all">{L('全部行业', 'All industries')}</option>
          {industryOptions.map((x) => <option key={x.id} value={x.id}>{industryName(x.id)}</option>)}
        </select>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="h-7 rounded border border-line bg-panel-2 px-2 text-[10.5px] text-muted outline-none" aria-label={L('区域筛选', 'Region filter')}>
          <option value="all">{L('全部区域', 'All regions')}</option>
          {regionOptions.map((x) => <option key={x.id} value={x.id}>{regionName(x.id)}</option>)}
        </select>
        <select value={gap} onChange={(e) => setGap(e.target.value)} className="h-7 rounded border border-line bg-panel-2 px-2 text-[10.5px] text-muted outline-none" aria-label={L('信息差筛选', 'Gap filter')}>
          <option value="all">{L('全部信息差', 'All gaps')}</option>
          {gapOptions.map((x) => <option key={x.id} value={x.id}>{gapName(x.id)}</option>)}
        </select>
        <span className="inline-flex items-center gap-1 text-[9.5px] text-dim"><SlidersHorizontal className="h-3 w-3" /> {L('按评分排序', 'Sorted by score')}</span>
      </div>

      {!rows.length ? (
        <Panel className="p-6 text-center"><EmptyState title={L('当前窗口暂无商机', 'No opportunities in this window')} hint={L('切换窗口、选「全部」或清空筛选即可；自动候选与精选均为每日更新。', 'Switch windows, choose “All”, or clear filters; both auto candidates and curated opportunities refresh daily.')} /></Panel>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {rows.slice(0, visibleCount).map((r) => (
            <OpportunityCard
              key={r.key}
              model={{
                id: r.id,
                kind: r.kind,
                title: r.title,
                original: r.original,
                why: r.oneLiner,
                score: r.score,
                grade: r.grade,
                primaryIndustry: r.primaryIndustry,
                eventType: r.eventType,
                capital: r.capital,
                paybackMonths: r.paybackMonths,
                windowMonths: r.windowMonths,
                gaps: r.gaps,
                regions: r.regions,
                source: r.source,
              } satisfies OpportunityCardModel}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {visibleCount < rows.length && <button type="button" onClick={() => setVisibleCount((n) => n + 30)} className="rounded border border-line px-4 py-2 text-[13px] text-muted hover:text-ink">{L(`加载更多（还有 ${rows.length - visibleCount} 条）`, `Load more (${rows.length - visibleCount} left)`)}</button>}
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="ml-auto rounded border border-line px-4 py-2 text-[13px] text-dim hover:text-ink">↑ {L('返回顶部', 'Back to top')}</button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[9.5px] text-dim">
        <span>{L('商机榜为唯一榜单；自动候选与精选均按评分排序。', 'This is the only board; auto candidates and curated opportunities are ranked by score with no manual-review gate.')}</span>
        <span className="inline-flex items-center gap-1">{L('点击卡片查看详情', 'Open a card for details')} <ArrowUpRight className="h-3 w-3" /></span>
      </div>
    </div>
  )
}
