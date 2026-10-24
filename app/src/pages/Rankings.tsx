import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Download, LayoutGrid, Search, SlidersHorizontal, Zap } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, EmptyState, Panel } from '@/components/ui'
import { OpportunityCard, type CardFilterKind } from '@/components/OpportunityCard'
import { buildCandidateAssessment, buildOpportunityAssessment, type Assessment } from '@/lib/assessment'
import { candidateWindowItems, candidates } from '@/lib/candidates'
import { dataAsOf, gapName, gradeOf, industryName, oppById, opportunities, rankings, regionName, taxonomy } from '@/lib/data'
import { useI18n } from '@/lib/i18n'
import { cn, fmtCny, fmtInt, fmtScore } from '@/lib/utils'
import type { WindowKey } from '@/types'

type Row = {
  key: string
  kind: 'candidate' | 'curated'
  id: string
  assessment: Assessment
}

type SortKey = 'score' | 'payback' | 'capital' | 'margin' | 'profit'
type CapitalBand = 'all' | 'le10k' | '10k-50k' | '50k-200k' | 'ge200k'
type PaybackBand = 'all' | 'le6' | 'le12' | 'le24' | 'gt24'

const WINDOWS: Array<{ key: WindowKey; zh: string; en: string }> = [
  { key: 'day', zh: '日榜', en: 'Day' },
  { key: 'week', zh: '周榜', en: 'Week' },
  { key: 'month', zh: '月榜', en: 'Month' },
  { key: 'year', zh: '年榜', en: 'Year' },
]

const RETIRED_TERMS = /验证|实验|复核|门禁/

function visibleText(value: string): string {
  return RETIRED_TERMS.test(value) ? '' : value
}

const median = (values: number[]): number => {
  const list = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!list.length) return 0
  const mid = Math.floor(list.length / 2)
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2
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
  const [capitalBand, setCapitalBand] = useState<CapitalBand>('all')
  const [paybackBand, setPaybackBand] = useState<PaybackBand>('all')
  const [sort, setSort] = useState<SortKey>('score')
  const [visibleCount, setVisibleCount] = useState(30)
  const [onlySingleAxis, setOnlySingleAxis] = useState(false)

  const candidateRows = useMemo<Row[]>(
    () =>
      candidateWindowItems(win).map(({ candidate }) => ({
        key: `c-${candidate.candidate_id}`,
        kind: 'candidate' as const,
        id: candidate.candidate_id,
        assessment: buildCandidateAssessment(candidate),
      })),
    [win],
  )

  const curatedRows = useMemo<Row[]>(() => {
    const items = rankings.windows[win]?.items || []
    return items.flatMap((item) => {
      const opp = oppById.get(item.opp_id)
      if (!opp) return []
      return [{ key: `o-${opp.id}`, kind: 'curated' as const, id: opp.id, assessment: buildOpportunityAssessment(opp) }]
    })
  }, [win])

  const baseRows = useMemo(() => {
    const base = track === 'curated' ? curatedRows : [...candidateRows, ...curatedRows]
    const seen = new Set<string>()
    return base.filter((row) => {
      if (seen.has(row.assessment.href)) return false
      seen.add(row.assessment.href)
      return true
    })
  }, [track, candidateRows, curatedRows])

  const industryOptions = useMemo(() => {
    const ids = new Set(baseRows.map((r) => r.assessment.industryId).filter(Boolean))
    return taxonomy.industries.filter((x) => ids.has(x.id))
  }, [baseRows])
  const regionOptions = useMemo(() => {
    const ids = new Set(baseRows.flatMap((r) => r.assessment.regionIds))
    return taxonomy.regions.filter((x) => ids.has(x.id))
  }, [baseRows])
  const gapOptions = useMemo(() => {
    const ids = new Set(baseRows.flatMap((r) => r.assessment.gapIds))
    return taxonomy.gap_types.filter((x) => ids.has(x.id))
  }, [baseRows])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = baseRows.filter((row) => {
      const a = row.assessment
      if (industry !== 'all' && a.industryId !== industry) return false
      if (region !== 'all' && !a.regionIds.includes(region)) return false
      if (gap !== 'all' && !a.gapIds.includes(gap)) return false
      if (onlySingleAxis && !a.singleAxisStrong) return false
      const capital = a.economics.base.capital
      if (capitalBand === 'le10k' && capital > 10_000) return false
      if (capitalBand === '10k-50k' && (capital <= 10_000 || capital > 50_000)) return false
      if (capitalBand === '50k-200k' && (capital <= 50_000 || capital > 200_000)) return false
      if (capitalBand === 'ge200k' && capital <= 200_000) return false
      const payback = a.economics.base.paybackMonths
      if (paybackBand === 'le6' && !(payback > 0 && payback <= 6)) return false
      if (paybackBand === 'le12' && !(payback > 0 && payback <= 12)) return false
      if (paybackBand === 'le24' && !(payback > 0 && payback <= 24)) return false
      if (paybackBand === 'gt24' && !(payback > 24 || payback <= 0)) return false
      if (q) {
        const hay = `${a.title} ${a.titleOriginal} ${a.oneLiner} ${a.thesis} ${a.sourceName} ${a.industryZh}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const sorted = [...filtered]
    sorted.sort((x, y) => {
      const ax = x.assessment.economics
      const ay = y.assessment.economics
      if (sort === 'payback') {
        const px = ax.base.paybackMonths > 0 ? ax.base.paybackMonths : 999
        const py = ay.base.paybackMonths > 0 ? ay.base.paybackMonths : 999
        if (px !== py) return px - py
      } else if (sort === 'capital') {
        if (ax.base.capital !== ay.base.capital) return ax.base.capital - ay.base.capital
      } else if (sort === 'margin') {
        if (ax.base.marginPct !== ay.base.marginPct) return ay.base.marginPct - ax.base.marginPct
      } else if (sort === 'profit') {
        if (ax.base.netProfit !== ay.base.netProfit) return ay.base.netProfit - ax.base.netProfit
      }
      return y.assessment.score.total - x.assessment.score.total
    })
    return sorted
  }, [baseRows, industry, region, gap, onlySingleAxis, capitalBand, paybackBand, query, sort])

  const singleAxisCount = useMemo(() => baseRows.filter((r) => r.assessment.singleAxisStrong).length, [baseRows])

  const stats = useMemo(() => {
    const capitals = rows.map((r) => r.assessment.economics.base.capital)
    const paybacks = rows.map((r) => r.assessment.economics.base.paybackMonths).filter((x) => x > 0)
    const scores = rows.map((r) => r.assessment.score.total)
    const curated = rows.filter((r) => r.kind === 'curated').length
    return {
      total: rows.length,
      curated,
      auto: rows.length - curated,
      medianCapital: median(capitals),
      medianPayback: median(paybacks),
      avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    }
  }, [rows])

  const applyFilter = (kind: CardFilterKind, id: string) => {
    if (kind === 'industry') setIndustry(id)
    else if (kind === 'gap') setGap(id)
    else setRegion(id)
    setVisibleCount(30)
  }

  const resetFilters = () => {
    setQuery('')
    setIndustry('all')
    setRegion('all')
    setGap('all')
    setCapitalBand('all')
    setPaybackBand('all')
    setSort('score')
    setOnlySingleAxis(false)
  }

  return (
    <div>
      <PageHeader
        index="02"
        kicker={L('RANKINGS · 商机榜', 'RANKINGS · OPPORTUNITY BOARD')}
        title={L('商机榜 · 自动候选与精选机会同一套评估', 'Opportunity board · auto candidates and curated opportunities, one assessment')}
        description={L('日 / 周 / 月 / 年四个窗口。每张卡都带启动资金、客单价、毛利率、理论回本与迷你图表；点击进入统一的图表化评估详情。', 'Day/week/month/year windows. Every card carries capital, AOV, margin, theoretical payback and a mini chart; open the same chart-driven assessment detail for auto and curated leads.')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">{L(`自动候选 ${candidates.length}`, `${candidates.length} auto candidates`)}</Badge>
            <Badge tone="signal">{L(`精选 ${opportunities.length}`, `${opportunities.length} curated`)}</Badge>
            <span className="font-mono text-[11px] text-dim">{L('数据基准', 'Data as of')} {dataAsOf}</span>
          </div>
        }
      />

      {/* 窗口 + 轨道 */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            type="button"
            onClick={() => {
              setWin(w.key)
              setVisibleCount(30)
            }}
            className={cn('rounded border px-3 py-1.5 text-[13px]', win === w.key ? 'border-signal/50 bg-signal/10 text-signal' : 'border-line text-muted hover:border-line-strong hover:text-ink')}
          >
            {L(w.zh, w.en)}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        <button type="button" onClick={() => setTrack('all')} className={cn('rounded border px-3 py-1.5 text-[13px]', track === 'all' ? 'border-cyan/50 bg-cyan/10 text-cyan' : 'border-line text-muted hover:border-line-strong hover:text-ink')}>
          {L('全部', 'All')} · {candidateRows.length + curatedRows.length}
        </button>
        <button type="button" onClick={() => setTrack('curated')} className={cn('rounded border px-3 py-1.5 text-[13px]', track === 'curated' ? 'border-signal/50 bg-signal/10 text-signal' : 'border-line text-muted hover:border-line-strong hover:text-ink')}>
          {L('精选', 'Curated')} · {curatedRows.length}
        </button>
        <button
          type="button"
          onClick={() => {
            setOnlySingleAxis((v) => !v)
            setVisibleCount(30)
          }}
          className={cn(
            'inline-flex items-center gap-1 rounded border px-3 py-1.5 text-[13px]',
            onlySingleAxis ? 'border-amber/50 bg-amber/10 text-amber' : 'border-line text-muted hover:border-line-strong hover:text-ink',
          )}
          title={L('仅看单一主导驱动强的机会；分析 ≠ 门禁，不改变排序', 'Show opportunities with a strong single dominant driver only; analysis ≠ gate and does not change ranking')}
        >
          <Zap className="h-3.5 w-3.5" /> {L('主导型', 'Single-axis')} · {singleAxisCount}
        </button>
        <span className="ml-auto text-[12px] text-dim">{L(`当前 ${rows.length} 条`, `${rows.length} rows`)}</span>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded border border-line bg-panel-2 px-3">
          <Search className="h-3.5 w-3.5 text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={L('搜索商机 / 国家 / 来源…', 'Search opportunities / countries / source…')}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-dim"
          />
        </label>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-9 rounded border border-line bg-panel-2 px-2.5 text-[12.5px] text-muted outline-none" aria-label={L('行业筛选', 'Industry filter')}>
          <option value="all">{L('全部行业', 'All industries')}</option>
          {industryOptions.map((x) => <option key={x.id} value={x.id}>{lang === 'en' ? x.name : x.name}</option>)}
        </select>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="h-9 rounded border border-line bg-panel-2 px-2.5 text-[12.5px] text-muted outline-none" aria-label={L('区域筛选', 'Region filter')}>
          <option value="all">{L('全部区域', 'All regions')}</option>
          {regionOptions.map((x) => <option key={x.id} value={x.id}>{regionName(x.id)}</option>)}
        </select>
        <select value={gap} onChange={(e) => setGap(e.target.value)} className="h-9 rounded border border-line bg-panel-2 px-2.5 text-[12.5px] text-muted outline-none" aria-label={L('信息差筛选', 'Gap filter')}>
          <option value="all">{L('全部信息差', 'All gaps')}</option>
          {gapOptions.map((x) => <option key={x.id} value={x.id}>{gapName(x.id)}</option>)}
        </select>
        <select value={capitalBand} onChange={(e) => setCapitalBand(e.target.value as CapitalBand)} className="h-9 rounded border border-line bg-panel-2 px-2.5 text-[12.5px] text-muted outline-none" aria-label={L('启动资金筛选', 'Capital filter')}>
          <option value="all">{L('启动资金：全部', 'Capital: all')}</option>
          <option value="le10k">{L('≤ ¥1 万', '≤ ¥10K')}</option>
          <option value="10k-50k">{L('¥1–5 万', '¥10–50K')}</option>
          <option value="50k-200k">{L('¥5–20 万', '¥50–200K')}</option>
          <option value="ge200k">{L('≥ ¥20 万', '≥ ¥200K')}</option>
        </select>
        <select value={paybackBand} onChange={(e) => setPaybackBand(e.target.value as PaybackBand)} className="h-9 rounded border border-line bg-panel-2 px-2.5 text-[12.5px] text-muted outline-none" aria-label={L('回本周期筛选', 'Payback filter')}>
          <option value="all">{L('回本：全部', 'Payback: all')}</option>
          <option value="le6">{L('≤ 6 个月', '≤ 6 mo')}</option>
          <option value="le12">{L('≤ 12 个月', '≤ 12 mo')}</option>
          <option value="le24">{L('≤ 24 个月', '≤ 24 mo')}</option>
          <option value="gt24">{L('> 24 个月', '> 24 mo')}</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 rounded border border-line bg-panel-2 px-2.5 text-[12.5px] text-muted outline-none" aria-label={L('排序', 'Sort')}>
          <option value="score">{L('按评分', 'By score')}</option>
          <option value="payback">{L('按回本（短→长）', 'By payback (short first)')}</option>
          <option value="capital">{L('按启动资金（低→高）', 'By capital (low first)')}</option>
          <option value="margin">{L('按毛利率（高→低）', 'By margin (high first)')}</option>
          <option value="profit">{L('按月净利（高→低）', 'By net profit (high first)')}</option>
        </select>
        <button type="button" onClick={resetFilters} className="inline-flex h-9 items-center gap-1 rounded border border-line px-2.5 text-[12px] text-dim hover:text-ink">
          <SlidersHorizontal className="h-3 w-3" /> {L('重置', 'Reset')}
        </button>
      </div>

      {/* 汇总条 */}
      <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-line/70 bg-panel/60 px-3 py-2.5 md:grid-cols-5">
        {[
          { label: L('当前结果', 'Current results'), value: `${fmtInt(stats.total)} ${L('条', 'items')}`, sub: `${L('自动', 'Auto')} ${fmtInt(stats.auto)} · ${L('精选', 'Curated')} ${fmtInt(stats.curated)}` },
          { label: L('中位启动资金', 'Median capital'), value: fmtCny(stats.medianCapital), sub: L('理论中位（几何均值）', 'Theoretical median (geo)') },
          { label: L('中位回本', 'Median payback'), value: stats.medianPayback > 0 ? `${stats.medianPayback.toFixed(1)} ${L('个月', 'mo')}` : '—', sub: L('理论测算', 'Theoretical') },
          { label: L('平均评分', 'Avg. score'), value: fmtScore(stats.avgScore), sub: L('10 维加权', '10-dim weighted') },
          { label: L('榜单窗口', 'Window'), value: L(WINDOWS.find((w) => w.key === win)?.zh || '', WINDOWS.find((w) => w.key === win)?.en || ''), sub: `${L('数据基准', 'As of')} ${dataAsOf}` },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <div className="text-[11.5px] text-dim">{item.label}</div>
            <div className="num mt-0.5 truncate text-[17px] font-semibold text-ink">{item.value}</div>
            <div className="truncate text-[11px] text-dim">{item.sub}</div>
          </div>
        ))}
      </div>

      {!rows.length ? (
        <Panel className="p-6 text-center">
          <EmptyState
            title={L('当前筛选下暂无商机', 'No opportunities match the current filters')}
            hint={L('切换窗口、选「全部」或重置筛选即可；自动候选与精选机会均为每日更新。', 'Switch windows, choose “All”, or reset filters; both auto candidates and curated opportunities refresh daily.')}
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.slice(0, visibleCount).map((row, index) => (
            <OpportunityCard key={row.key} assessment={row.assessment} rank={index + 1} onFilter={applyFilter} />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {visibleCount < rows.length && (
          <button type="button" onClick={() => setVisibleCount((n) => n + 30)} className="rounded border border-line px-4 py-2 text-[13px] text-muted hover:text-ink">
            {L(`加载更多（还有 ${rows.length - visibleCount} 条）`, `Load more (${rows.length - visibleCount} left)`)}
          </button>
        )}
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="ml-auto rounded border border-line px-4 py-2 text-[13px] text-dim hover:text-ink">↑ {L('返回顶部', 'Back to top')}</button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-dim">
        <span>{L('唯一商机榜：自动候选与精选均按评分与理论经济性排序，无人工门禁；点击卡片标签可直接筛选。', 'One board only: auto candidates and curated opportunities ranked by score and theoretical economics, with no manual gate; click tags to filter.')}</span>
        <span className="inline-flex items-center gap-1">{L('点击卡片查看统一评估详情', 'Open the unified assessment detail')} <ArrowUpRight className="h-3.5 w-3.5" /></span>
      </div>
    </div>
  )
}
