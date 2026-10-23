import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Search, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, EmptyState, Panel } from '@/components/ui'
import { candidates, candidateWindowItems } from '@/lib/candidates'
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
}

const WINDOWS: Array<{ key: WindowKey; zh: string; en: string }> = [
  { key: 'day', zh: '日榜', en: 'Day' },
  { key: 'week', zh: '周榜', en: 'Week' },
  { key: 'month', zh: '月榜', en: 'Month' },
  { key: 'year', zh: '年榜', en: 'Year' },
]

export default function Rankings() {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const [win, setWin] = useState<WindowKey>('week')
  const [track, setTrack] = useState<'all' | 'curated'>('all')
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState('all')
  const [region, setRegion] = useState('all')
  const [gap, setGap] = useState('all')

  const curatedById = useMemo(() => new Map(opportunities.map((o) => [o.id, o])), [])

  const candidateRows = useMemo<Row[]>(() => candidateWindowItems(win).map(({ candidate: c }) => ({
    key: `c-${c.candidate_id}`,
    kind: 'candidate',
    id: c.candidate_id,
    title: c.title_zh || c.title,
    original: c.title_original || c.source.raw_title,
    oneLiner: c.one_liner_zh || c.one_liner,
    score: c.scores.total,
    grade: c.scores.grade,
    industry: c.industry_ids,
    gaps: c.gap_type_ids,
    regions: c.region_ids,
    source: c.source.name || L('自动采集', 'Auto fetched'),
    firstSeen: c.first_seen,
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
        oneLiner: o.one_liner,
        score: o.scores.total || item.total,
        grade: o.scores.grade || gradeOf(o.scores.total || item.total),
        industry: [o.industry_id],
        gaps: o.gap_type_ids,
        regions: o.region_ids,
        source: o.origin_country || L('精选库', 'Curated'),
        firstSeen: o.first_seen,
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
        kicker={L('RANKINGS · 商机榜', 'RANKINGS · OPPORTUNITIES')}
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
          {rows.map((r, i) => (
            <Link key={r.key} to={r.kind === 'candidate' ? `/candidates/${r.id}` : `/opportunities/${r.id}`} className="panel panel-hover accent-top flex flex-col p-3 text-left" style={{ '--accent': r.kind === 'candidate' ? '#4cc9f0' : '#3ddc97' } as CSSProperties}>
              <div className="flex items-center gap-2">
                <span className="num text-[20px] font-semibold text-dim">{String(i + 1).padStart(2, '0')}</span>
                <Badge tone={r.kind === 'candidate' ? 'cyan' : 'signal'}>{r.kind === 'candidate' ? L('自动发现', 'Auto') : L('精选', 'Curated')}</Badge>
                <span className="ml-auto font-mono text-[9px] text-dim">{r.kind === 'candidate' ? L('自动候选', 'Auto candidate') : L('精选库', 'Curated')}</span>
              </div>
              <div className="mt-1.5 line-clamp-2 text-[13px] font-semibold text-ink">{r.title}</div>
              {r.original && r.original !== r.title && <div className="mt-0.5 truncate text-[9px] text-dim">{r.original}</div>}
              <div className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-muted">{r.oneLiner}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {r.industry.slice(0, 1).map((id) => <span key={id} className="rounded border border-line/60 px-1 py-0.5 text-[8.5px] text-dim">{industryName(id)}</span>)}
                {r.gaps.slice(0, 1).map((id) => <span key={id} className="rounded border border-line/60 px-1 py-0.5 text-[8.5px] text-dim">{gapName(id)}</span>)}
                {r.regions.slice(0, 1).map((id) => <span key={id} className="rounded border border-line/60 px-1 py-0.5 text-[8.5px] text-dim">{regionName(id)}</span>)}
              </div>
              <div className="mt-2 flex items-end justify-between border-t border-line/50 pt-2">
                <div>
                  <div className="mono-label">{L('来源', 'Source')}</div>
                  <div className="max-w-[160px] truncate text-[9.5px] text-muted">{r.source || '—'}</div>
                </div>
                <div className="text-right">
                  <div className="num text-[16px] font-semibold text-signal">{fmtScore(r.score)}</div>
                  <div className="font-mono text-[9px] text-dim">{r.grade} · {L('首次', 'first')} {r.firstSeen || dataAsOf}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[9.5px] text-dim">
        <span>{L('商机榜为唯一榜单；自动候选与精选均按评分排序，不设人工复核门槛。', 'This is the only board; auto candidates and curated opportunities are ranked by score with no manual-review gate.')}</span>
        <span className="inline-flex items-center gap-1">{L('点击卡片查看详情', 'Open a card for details')} <ArrowUpRight className="h-3 w-3" /></span>
      </div>
    </div>
  )
}
