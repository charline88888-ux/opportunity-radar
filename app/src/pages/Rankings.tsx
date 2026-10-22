import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownWideNarrow, FileJson, FileText, LayoutGrid, ListOrdered, Rows3, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { OpportunityCard } from '@/components/OpportunityCard'
import {
  Badge,
  DeltaBadge,
  EmptyState,
  GradeBadge,
  Panel,
  ProgressBar,
  SectionCard,
  Segmented,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import {
  deltaBasisLabel,
  deltaBasisText,
  gapName,
  gapHalfLife,
  industryColor,
  industryName,
  oppById,
  opportunities,
  rankings,
  rankingsDeltaBasis,
  rankingsHistoryAsOf,
  RANKING_WINDOWS,
  regionName,
  taxonomy,
  WINDOW_LABEL,
} from '@/lib/data'
import { downloadPeriodReport } from '@/lib/exports'
import type { ChangeType, Opportunity, WindowKey } from '@/types'
import { cn, fmtInt, fmtScore, gradeColor } from '@/lib/utils'

type SortKey = 'rank' | 'total' | 'momentum'
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'rank', label: 'rank_score' },
  { value: 'total', label: '总分' },
  { value: 'momentum', label: '动量' },
]
const WINDOW_QUOTA: Record<WindowKey, number> = { day: 6, week: 12, month: 20, year: 40 }

interface RankRow {
  opp: Opportunity
  rank: number
  rank_score: number
  total: number
  delta: number | null
  change: ChangeType
}

function TopCard({ row, index }: { row: RankRow; index: number }) {
  const o = row.opp
  const accents = ['#ffd166', '#cdd6e5', '#4cc9f0']
  const accent = accents[index] || '#8b93a7'
  return (
    <Link
      to={`/opportunities/${o.id}`}
      className="panel panel-hover accent-top group relative flex flex-col overflow-hidden p-3.5"
      style={{ ['--accent' as any]: accent }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-end gap-2">
          <span className="num text-[40px] font-semibold leading-none" style={{ color: accent }}>
            {String(row.rank).padStart(2, '0')}
          </span>
          <div className="pb-1">
            <div className="mono-label">TOP {row.rank}</div>
            <DeltaBadge change={row.change} delta={row.delta} />
          </div>
        </div>
        <div className="text-right">
          <div className="num text-[19px] font-semibold leading-none" style={{ color: gradeColor(o.scores.grade) }}>
            {fmtScore(row.total)}
          </div>
          <div className="mono-label mt-0.5">TOTAL</div>
        </div>
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-1.5">
        <span className="shrink-0"><GradeBadge grade={o.scores.grade} /></span>
        <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink group-hover:text-signal">{o.title}</span>
      </div>
      <p className="mt-1 line-clamp-2 min-h-[34px] text-[11px] leading-relaxed text-muted">{o.one_liner}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded border border-line bg-panel-2 px-1.5 py-0.5 text-[10px] text-muted">
          <span className="h-1.5 w-1.5 rounded-sm" style={{ background: industryColor(o.industry_id) }} />
          {industryName(o.industry_id)}
        </span>
        {o.gap_type_ids.slice(0, 2).map((g) => (
          <span key={g} className="rounded border border-line/80 px-1.5 py-0.5 text-[10px] text-dim">{gapName(g)}</span>
        ))}
      </div>
      <div className="mt-auto pt-2">
        <div className="flex items-center justify-between font-mono text-[9.5px] text-dim">
          <span>RANK_SCORE</span>
          <span className="num text-muted">{fmtScore(row.rank_score)}</span>
        </div>
        <ProgressBar value={row.rank_score} max={100} tone={index === 0 ? 'amber' : 'signal'} className="mt-1" />
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-dim">
          <span>{o.origin_country} · {o.target_countries.slice(0, 2).join(' / ')}</span>
          <span className="font-mono text-amber">MOM ×{o.momentum.toFixed(1)}</span>
        </div>
      </div>
    </Link>
  )
}

function RankTable({ rows }: { rows: RankRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-dense min-w-[980px]">
        <thead>
          <tr>
            <th className="w-12">#</th>
            <th className="w-16">变化</th>
            <th>机会</th>
            <th className="w-28">行业</th>
            <th className="w-32">信息差</th>
            <th className="w-32">区域</th>
            <th className="w-16 text-right">总分</th>
            <th className="w-12">等级</th>
            <th className="w-20 text-right">rank_score</th>
            <th className="w-16 text-right">动量</th>
            <th className="w-24">窗口</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const o = row.opp
            return (
              <tr key={o.id}>
                <td>
                  <span className={cn('num text-[13px]', row.rank <= 3 ? 'text-amber' : 'text-muted')}>
                    {String(row.rank).padStart(2, '0')}
                  </span>
                </td>
                <td><DeltaBadge change={row.change} delta={row.delta} /></td>
                <td>
                  <Link to={`/opportunities/${o.id}`} className="group block max-w-[380px]">
                    <span className="block truncate text-[12px] font-medium text-ink group-hover:text-signal">{o.title}</span>
                    <span className="block truncate text-[10px] text-dim">{o.one_liner}</span>
                  </Link>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1 text-[10.5px] text-muted">
                    <span className="h-1.5 w-1.5 rounded-sm" style={{ background: industryColor(o.industry_id) }} />
                    {industryName(o.industry_id)}
                  </span>
                </td>
                <td className="text-[10.5px] text-dim">{o.gap_type_ids.map(gapName).join(' / ')}</td>
                <td className="text-[10.5px] text-dim">{o.region_ids.map(regionName).join(' / ')}</td>
                <td className="text-right">
                  <span className="num text-[12px]" style={{ color: gradeColor(o.scores.grade) }}>{fmtScore(row.total)}</span>
                </td>
                <td><GradeBadge grade={o.scores.grade} /></td>
                <td className="num text-right text-[11.5px] text-muted">{fmtScore(row.rank_score)}</td>
                <td className="num text-right text-[11px] text-amber">×{o.momentum.toFixed(1)}</td>
                <td>
                  <span className="font-mono text-[10px] text-dim">{o.window.status.toUpperCase()} / {o.window.months_left}M</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Rankings() {
  const [params, setParams] = useSearchParams()
  const initialWindow = (['day', 'week', 'month', 'year'].includes(params.get('w') || '') ? params.get('w') : 'week') as WindowKey
  const [win, setWin] = useState<WindowKey>(initialWindow)
  const [industry, setIndustry] = useState<string>('all')
  const [gap, setGap] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('rank')
  const [view, setView] = useState<'cards' | 'table'>(params.get('view') === 'table' ? 'table' : 'cards')

  const switchWindow = (w: WindowKey) => {
    setWin(w)
    const next = new URLSearchParams(params)
    next.set('w', w)
    setParams(next, { replace: true })
  }

  const windowData = rankings.windows[win]
  const windowBasis = windowData?.delta_basis || rankingsDeltaBasis
  const allRows = useMemo<RankRow[]>(
    () =>
      (windowData?.items || [])
        .map((it) => {
          const opp = oppById.get(it.opp_id)
          return opp ? { opp, rank: it.rank, rank_score: it.rank_score, total: it.total, delta: it.delta, change: it.change } : null
        })
        .filter((x): x is RankRow => !!x),
    [windowData],
  )

  const filtered = useMemo(() => {
    let rows = allRows
    if (industry !== 'all') rows = rows.filter((r) => r.opp.industry_id === industry)
    if (gap !== 'all') rows = rows.filter((r) => r.opp.gap_type_ids.includes(gap))
    if (sort === 'total') rows = [...rows].sort((a, b) => b.total - a.total || b.rank_score - a.rank_score)
    if (sort === 'momentum') rows = [...rows].sort((a, b) => b.opp.momentum - a.opp.momentum || b.rank_score - a.rank_score)
    return rows
  }, [allRows, industry, gap, sort])

  const stats = useMemo(() => {
    const totals = filtered.map((r) => r.total)
    const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
    const max = totals.length ? Math.max(...totals) : 0
    const newCount = filtered.filter((r) => r.change === 'new').length
    return { avg, max, newCount }
  }, [filtered])

  const top3 = sort === 'rank' && industry === 'all' && gap === 'all' ? filtered.slice(0, 3) : []
  const rest = top3.length ? filtered.slice(3) : filtered
  const activeIndustry = taxonomy.industries.find((x) => x.id === industry)
  const daysLeft = windowData?.items?.length || 0

  return (
    <div>
      <PageHeader
        index="02"
        kicker="RANKINGS · 排行榜"
        title="机会排行榜 · 四窗口"
        description="以 rank_score 排序的权威榜单（唯一来源 data/rankings.json）。窗口归属、名次与排名变化均由扫描器计算，前端不重算；支持 14 行业板块、12 类信息差、总分/动量排序与卡片/表格双视图。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal"><ListOrdered className="h-3 w-3" /> {windowData?.key || '—'}</Badge>
            <Badge tone="neutral">{windowData?.label || WINDOW_LABEL[win]}</Badge>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'cards', label: <><LayoutGrid className="h-3 w-3" /> 卡片</> },
                { value: 'table', label: <><Rows3 className="h-3 w-3" /> 表格</> },
              ]}
            />
          </div>
        }
      />

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex cursor-help items-center gap-1 rounded border border-cyan/30 bg-cyan/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-cyan"
          title={
            windowBasis === 'history'
              ? `delta 口径：较上一份历史快照（${rankingsHistoryAsOf || '—'}），正数=上升`
              : 'delta 口径：相邻窗口（历史快照不足 1 天）；day←week、week←month、month←year'
          }
        >
          口径：{deltaBasisText(windowBasis)}
        </span>
        {windowBasis === 'history' && rankingsHistoryAsOf && (
          <span className="font-mono text-[9.5px] text-dim">history_as_of {rankingsHistoryAsOf}</span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => downloadPeriodReport(win, 'md')}
            disabled={!windowData?.items?.length}
            className="inline-flex h-7 items-center gap-1 rounded border border-line bg-panel-2 px-2 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-45"
            title="导出本期报告 Markdown（浏览器本地生成，无需联网）"
          >
            <FileText className="h-3 w-3" /> 导出本期报告 MD
          </button>
          <button
            onClick={() => downloadPeriodReport(win, 'html')}
            disabled={!windowData?.items?.length}
            className="inline-flex h-7 items-center gap-1 rounded border border-line bg-panel-2 px-2 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-45"
            title="导出本期报告自包含 HTML（可打印）"
          >
            <FileJson className="h-3 w-3" /> 导出本期报告 HTML
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={win} onValueChange={(v) => switchWindow(v as WindowKey)}>
          <TabsList>
            {RANKING_WINDOWS.map((w) => {
              const count = rankings.windows[w.key]?.items?.length || 0
              return (
                <TabsTrigger key={w.key} value={w.key}>
                  {w.label}
                  <span className="num text-[9.5px] opacity-70">{count}</span>
                  {count < WINDOW_QUOTA[w.key] && (
                    <span className="ml-0.5 h-1 w-1 rounded-full bg-amber" title={`未达配额 ${WINDOW_QUOTA[w.key]}`} />
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10.5px] text-dim">
            <SlidersHorizontal className="h-3 w-3" /> 排序
          </div>
          <Segmented value={sort} onChange={setSort} options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
          <div className="relative">
            <select
              value={gap}
              onChange={(e) => setGap(e.target.value)}
              className="h-[27px] appearance-none rounded border border-line bg-panel-2 pl-2 pr-6 text-[11px] text-muted outline-none hover:border-line-strong"
              aria-label="信息差类型筛选"
            >
              <option value="all">全部信息差</option>
              {taxonomy.gap_types.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <ArrowDownWideNarrow className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-dim" />
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1 chip-scroll">
        <button
          onClick={() => setIndustry('all')}
          className={cn(
            'shrink-0 rounded border px-2 py-1 text-[11px] transition-colors',
            industry === 'all' ? 'border-signal/45 bg-signal/12 text-signal' : 'border-line text-muted hover:text-ink',
          )}
        >
          全部行业 <span className="num ml-1 text-[9.5px] opacity-70">{opportunities.length}</span>
        </button>
        {taxonomy.industries.map((ind) => {
          const count = opportunities.filter((o) => o.industry_id === ind.id).length
          const active = industry === ind.id
          return (
            <button
              key={ind.id}
              onClick={() => setIndustry(active ? 'all' : ind.id)}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition-colors',
                active ? 'border-line-strong bg-white/[0.06] text-ink' : 'border-line text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-sm" style={{ background: ind.color }} />
              {ind.name}
              <span className="num text-[9.5px] text-dim">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: '当前入榜', value: fmtInt(filtered.length), unit: `条 / 窗口 ${daysLeft}`, color: '#3ddc97' },
          { label: '平均总分', value: fmtScore(stats.avg), unit: '分', color: '#4cc9f0' },
          { label: '最高总分', value: fmtScore(stats.max), unit: '分', color: '#ffd166' },
          windowBasis === 'history'
            ? { label: '新上榜', value: fmtInt(stats.newCount), unit: '条（较上一快照）', color: '#ffb547' }
            : { label: '较上期变化', value: fmtInt(filtered.filter((r) => r.change !== 'flat').length), unit: '条（相邻窗口口径）', color: '#ffb547' },
        ].map((s) => (
          <Panel key={s.label} className="flex items-center justify-between px-3 py-2">
            <div>
              <div className="mono-label">{s.label}</div>
              <div className="num mt-0.5 text-[18px] font-semibold leading-none" style={{ color: s.color }}>{s.value}</div>
              <div className="mt-0.5 text-[9.5px] text-dim">{s.unit}</div>
            </div>
            <div className="h-8 w-px bg-line" />
          </Panel>
        ))}
      </div>

      {!filtered.length && (
        <EmptyState
          title="当前筛选条件下暂无上榜机会"
          hint={
            activeIndustry
              ? `${activeIndustry.name} 板块在当前窗口（${windowData?.label}）没有机会进入榜单；可切换窗口或选择「全部行业」。`
              : '该窗口的 rankings.json 尚未产出数据，待数据工程完成配额后自动显示。'
          }
        />
      )}

      {!!top3.length && (
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {top3.map((row, i) => (
            <TopCard key={row.opp.id} row={row} index={i} />
          ))}
        </div>
      )}

      {!!rest.length && view === 'cards' && (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {rest.map((row) => (
            <OpportunityCard key={row.opp.id} opp={row.opp} rank={row.rank} showRank change={row.change} delta={row.delta} />
          ))}
        </div>
      )}

      {!!filtered.length && view === 'table' && (
        <SectionCard dense eyebrow="DENSE TABLE" title="榜单明细" subtitle={`${filtered.length} 条 · 点击标题进入机会详情`}>
          <RankTable rows={filtered} />
        </SectionCard>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SectionCard eyebrow="WINDOW RULES" title="榜单窗口规则" right={<Badge tone="muted">data/rankings.json 唯一来源</Badge>} bodyClassName="p-3">
          <div className="space-y-1.5 font-mono text-[10.5px] leading-relaxed text-muted">
            <div><span className="text-signal">day</span> = last_activity == as_of（{rankings.windows.day?.key || '—'}）</div>
            <div><span className="text-signal">week</span> = ISO 周（{rankings.windows.week?.key || '—'}）</div>
            <div><span className="text-signal">month</span> = YYYY-MM（{rankings.windows.month?.key || '—'}）</div>
            <div><span className="text-signal">year</span> = YYYY（{rankings.windows.year?.key || '—'}）</div>
            <div className="pt-1 text-dim">
              delta 口径：{deltaBasisText(windowBasis)}
              {windowBasis === 'history'
                ? `（上期快照 ${rankingsHistoryAsOf || '—'}，delta = 上期名次 − 本期名次，正数=上升）`
                : '（day←week、week←month、month←year；year 无参照时为 new）'}
            </div>
            <div className="text-dim">change ∈ {'{new, up, down, flat}'}，与 delta 符号一致；同一机会可同时出现在多个窗口。</div>
            <div className="text-dim">tie_breaker：rank_score → momentum → evidence_count → last_activity → opp_id。</div>
          </div>
          <div className="mt-2 rounded border border-line/70 bg-black/20 px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-dim">
            <div>rank_score = min(100, total × (1 + 0.12 × (momentum − 1)))</div>
            <div>total = round( Σ(dimension_i × weight_i) × 10 , 1 )</div>
          </div>
        </SectionCard>
        <SectionCard eyebrow="GRADE & GAP" title="等级阈值 · 信息差半衰期" bodyClassName="p-3">
          <div className="flex flex-wrap gap-1.5">
            {taxonomy.grades.map((g) => (
              <span key={g.id} className="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10.5px]" style={{ borderColor: `${gradeColor(g.id)}44`, color: gradeColor(g.id) }}>
                <GradeBadge grade={g.id} /> {g.name} <span className="font-mono text-[9.5px] opacity-70">≥{g.min}</span>
              </span>
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
            {taxonomy.gap_types.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 border-b border-line/40 py-0.5 text-[10.5px]">
                <span className="truncate text-muted">{g.name}</span>
                <span className="num shrink-0 text-dim">{gapHalfLife(g.id)}M</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
