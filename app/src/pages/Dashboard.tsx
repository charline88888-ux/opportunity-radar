import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import {
  ArrowUpRight,
  Activity,
  BarChart3,
  CalendarClock,
  Database,
  Flame,
  FlaskConical,
  Globe2,
  History,
  Layers3,
  PieChart,
  Radar as RadarIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Chart } from '@/components/charts/Chart'
import { OpportunityCard } from '@/components/OpportunityCard'
import { PageHeader } from '@/components/PageHeader'
import { Badge, GradeBadge, Panel, ProgressBar, SectionCard, Sparkline } from '@/components/ui'
import {
  dataAsOf,
  dataMeta,
  deltaBasisLabel,
  gapName,
  historyMeta,
  industryColor,
  industryName,
  lookups,
  needName,
  oppById,
  opportunities,
  rankings,
  rankingsDeltaBasis,
  rankingsHistoryAsOf,
  regionName,
  sourceHealth,
  stats,
  taxonomy,
  WINDOW_LABEL,
} from '@/lib/data'
import { ACTIVE_CAPACITY, experimentReviewInfo, useExperiments } from '@/lib/experiments'
import { cn, fmtCny, fmtInt, fmtPct, fmtScore, gradeColor } from '@/lib/utils'

const KPI_DEFS = [
  { key: 'total', label: '机会总数', en: 'TOTAL OPPS', accent: '#3ddc97', icon: Layers3 },
  { key: 'today', label: '今日新信号', en: 'NEW TODAY', accent: '#ffb547', icon: Flame },
  { key: 'week', label: '本周新上榜', en: 'NEW THIS WEEK', accent: '#4cc9f0', icon: TrendingUp },
  { key: 'aplus', label: 'A 级以上', en: 'GRADE A+', accent: '#ffd166', icon: Sparkles },
  { key: 'value', label: '开放窗口价值', en: 'OPEN VALUE / MO', accent: '#f472b6', icon: Globe2 },
] as const

function KpiCard({
  label,
  en,
  value,
  unit,
  sub,
  accent,
  icon: Icon,
  spark,
}: {
  label: string
  en: string
  value: string
  unit?: string
  sub: React.ReactNode
  accent: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  spark?: number[]
}) {
  return (
    <Panel className="accent-top relative overflow-hidden p-3.5" style={{ ['--accent' as any]: accent }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
            <span className="text-[11.5px] text-muted">{label}</span>
          </div>
          <div className="mono-label mt-0.5">{en}</div>
        </div>
        {spark && <Sparkline data={spark} color={accent} width={64} height={20} />}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="num text-[26px] font-semibold leading-none tracking-tight text-ink">{value}</span>
        {unit && <span className="text-[10.5px] text-dim">{unit}</span>}
      </div>
      <div className="mt-1.5 flex min-h-[16px] items-center gap-1 text-[10.5px] text-dim">{sub}</div>
    </Panel>
  )
}

function topRankingItems(windowKey: 'day' | 'week' | 'month' | 'year', n: number) {
  const w = rankings.windows[windowKey]
  const items = (w?.items || []).map((it) => ({ ...it, opp: oppById.get(it.opp_id) })).filter((x) => x.opp)
  if (items.length >= n) return items.slice(0, n)
  const seen = new Set(items.map((x) => x.opp_id))
  const extra = opportunities
    .filter((o) => !seen.has(o.id))
    .sort((a, b) => b.rank_score - a.rank_score)
    .slice(0, n - items.length)
    .map((o, i) => ({
      opp_id: o.id,
      rank: items.length + i + 1,
      rank_score: o.rank_score,
      total: o.scores.total,
      delta: null,
      change: 'new' as const,
      opp: o,
    }))
  return [...items, ...extra].slice(0, n)
}

export default function Dashboard() {
  const kpi = stats.kpi
  const { items: experiments } = useExperiments()
  const activeExperiments = experiments.filter((x) => x.status === 'active')
  const dayCount = rankings.windows.day?.items?.length || 0
  const weekCount = rankings.windows.week?.items?.length || 0
  const weekChangeCount = (rankings.windows.week?.items || []).filter((x) => x.change !== 'flat').length
  const weekKpiLabel = rankingsDeltaBasis === 'history' ? '本周新上榜' : '较周榜变化'
  const weekKpiValue = rankingsDeltaBasis === 'history' ? kpi.new_week ?? weekCount : weekChangeCount
  const aPlusShare = kpi.total_opps ? (kpi.grade_a_plus / kpi.total_opps) * 100 : 0
  const openWindows = opportunities.filter((o) => o.window.status === 'open' || o.window.status === 'peak').length
  const trend = stats.trend_14d || []
  const trendActive = trend.map((t) => t.active_count ?? t.new_count)
  const hasActiveCount = trend.some((t) => typeof t.active_count === 'number')
  const sparkNew = trendActive
  const sparkScore = trend.map((t) => t.avg_score)

  const top5 = useMemo(() => topRankingItems('day', 5), [])

  const recent = useMemo(
    () =>
      [...opportunities]
        .sort((a, b) => b.last_activity.localeCompare(a.last_activity) || b.rank_score - a.rank_score)
        .slice(0, 7),
    [],
  )

  const histogramOption = useMemo<EChartsOption>(() => {
    const data = stats.score_histogram || []
    const avgBucket = Math.min(9, Math.max(0, Math.floor(kpi.avg_total / 10)))
    return {
      grid: { left: 4, right: 8, top: 24, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: any) => `${p[0].axisValue} 分段<br/>机会数：<b>${p[0].value}</b>` },
      xAxis: { type: 'category', data: ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-100'], axisLabel: { fontSize: 9, interval: 0 } },
      yAxis: { type: 'value', name: '机会数', nameTextStyle: { fontSize: 9, color: '#5a6273' }, minInterval: 1 },
      series: [
        {
          type: 'bar',
          data: data.map((v, i) => ({
            value: v,
            itemStyle: {
              color: i === avgBucket ? '#3ddc97' : i >= 8 ? 'rgba(255,209,102,.8)' : i >= 7 ? 'rgba(61,220,151,.62)' : 'rgba(76,201,240,.35)',
              borderRadius: [2, 2, 0, 0],
            },
          })),
          label: { show: true, position: 'top', color: '#8b93a7', fontSize: 9, formatter: (p: any) => (p.value ? String(p.value) : '') },
        },
      ],
    }
  }, [stats.score_histogram, kpi.avg_total])

  const trendOption = useMemo<EChartsOption>(() => ({
    grid: { left: 4, right: 4, top: 30, bottom: 2, containLabel: true },
    legend: { right: 0, top: 0, data: [hasActiveCount ? '活跃信号' : '新信号', '平均分'], textStyle: { fontSize: 10 } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: trend.map((t) => t.date.slice(5)), boundaryGap: false, axisLabel: { fontSize: 9, interval: 1 } },
    yAxis: [
      { type: 'value', name: '条', nameTextStyle: { fontSize: 9, color: '#5a6273' }, minInterval: 1 },
      { type: 'value', name: '分', min: 0, max: 100, nameTextStyle: { fontSize: 9, color: '#5a6273' }, splitLine: { show: false } },
    ],
    series: [
      {
        name: hasActiveCount ? '活跃信号' : '新信号',
        type: 'bar',
        data: trendActive.map((v, i) => ({ value: v, itemStyle: { color: v > 0 ? 'rgba(61,220,151,.62)' : 'rgba(61,220,151,.18)' } })),
        barMaxWidth: 14,
        itemStyle: { borderRadius: [2, 2, 0, 0] },
      },
      {
        name: '平均分',
        type: 'line',
        yAxisIndex: 1,
        data: trend.map((t) => t.avg_score),
        symbolSize: 4,
        smooth: true,
        lineStyle: { color: '#ffb547', width: 1.6 },
        itemStyle: { color: '#ffb547' },
        areaStyle: { color: 'rgba(255,181,71,.08)' },
      },
    ],
  }), [trend, trendActive, hasActiveCount])

  const regionHeatOption = useMemo<EChartsOption>(() => {
    const gaps = taxonomy.gap_types
    const regions = taxonomy.regions
    const cells: Array<[number, number, number]> = []
    const counts = new Map<string, number>()
    for (const o of opportunities) {
      for (const r of o.region_ids) {
        for (const g of o.gap_type_ids) {
          const k = `${r}|${g}`
          counts.set(k, (counts.get(k) || 0) + 1)
        }
      }
    }
    let max = 1
    regions.forEach((r, ri) => {
      gaps.forEach((g, gi) => {
        const v = counts.get(`${r.id}|${g.id}`) || 0
        max = Math.max(max, v)
        cells.push([gi, ri, v])
      })
    })
    return {
      grid: { left: 6, right: 8, top: 10, bottom: 24, containLabel: true },
      tooltip: {
        formatter: (p: any) => `${regions[p.value[1]]?.name || ''} × ${gaps[p.value[0]]?.name || ''}<br/>机会数：<b>${p.value[2]}</b>`,
      },
      xAxis: { type: 'category', data: gaps.map((g) => g.name.replace(/ \/.*/, '')), axisLabel: { fontSize: 9, interval: 0, rotate: 32, color: '#8b93a7' } },
      yAxis: { type: 'category', data: regions.map((r) => r.name), axisLabel: { fontSize: 9.5, color: '#8b93a7' } },
      visualMap: { show: false, min: 0, max, inRange: { color: ['#131821', '#173c33', '#21795d', '#3ddc97'] } },
      series: [
        {
          type: 'heatmap',
          data: cells,
          label: { show: true, fontSize: 9, color: '#c8cfdb', formatter: (p: any) => (p.value[2] ? p.value[2] : '') },
          emphasis: { itemStyle: { borderColor: '#e6e9f0', borderWidth: 1 } },
          itemStyle: { borderColor: '#0a0c10', borderWidth: 1 },
        },
      ],
    }
  }, [])

  const treemapOption = useMemo<EChartsOption>(() => {
    const data = (stats.by_industry || [])
      .filter((b) => b.count > 0)
      .map((b) => ({
        name: industryName(b.id),
        value: b.count,
        itemStyle: { color: industryColor(b.id), opacity: 0.82 },
        avg: b.avg_total,
      }))
    return {
      tooltip: {
        formatter: (p: any) => `${p.name}<br/>机会数：<b>${p.value}</b>${p.data?.avg ? `<br/>平均总分：<b>${p.data.avg}</b>` : ''}`,
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          width: '100%',
          height: '100%',
          top: 2,
          left: 2,
          right: 2,
          bottom: 2,
          label: {
            show: true,
            color: '#0a0c10',
            fontSize: 10.5,
            fontWeight: 600,
            overflow: 'truncate',
            formatter: (p: any) => `${String(p.name).length > 7 ? String(p.name).slice(0, 7) + '…' : p.name}\n${p.value}`,
            lineHeight: 13,
          },
          itemStyle: { borderColor: '#0a0c10', borderWidth: 2, gapWidth: 2 },
          data,
        },
      ],
    }
  }, [stats.by_industry])

  const needRadarOption = useMemo<EChartsOption>(() => {
    const buckets = stats.by_need || []
    const counts = new Map(buckets.map((b) => [b.id, b.count]))
    const max = Math.max(2, ...buckets.map((b) => b.count))
    return {
      tooltip: { trigger: 'item' },
      radar: {
        center: ['50%', '52%'],
        radius: '64%',
        indicator: taxonomy.human_needs.map((n) => ({ name: n.name.slice(0, 5), max: max + 1 })),
        axisName: { fontSize: 9.5 },
        splitNumber: 4,
      },
      series: [
        {
          type: 'radar',
          symbolSize: 3.5,
          lineStyle: { color: '#3ddc97', width: 1.6 },
          itemStyle: { color: '#3ddc97' },
          areaStyle: { color: 'rgba(61,220,151,.18)' },
          data: [
            {
              value: taxonomy.human_needs.map((n) => counts.get(n.id) || 0),
              name: '机会数',
            },
          ],
        },
      ],
    }
  }, [stats.by_need])

  return (
    <div>
      <PageHeader
        index="01"
        kicker="COMMAND DECK · 指挥台"
        title="全球机会雷达 · 指挥台"
        description={
          <>
            以 <span className="mono text-muted">{dataAsOf}</span> 为数据基准日，汇总今日新信号、四窗口榜单、评分分布、区域 / 行业 / 人性需求与最近爆发机会。
            全部数据本地构建、离线可用。
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal">
              <ShieldCheck className="h-3 w-3" /> 契约自检 {dataMeta.validation?.failed ? 'FAIL' : 'PASS'}
            </Badge>
            <Badge tone="neutral">数据基准 {dataAsOf}</Badge>
            <Link
              to="/lab"
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded border px-2.5 text-[11.5px] transition-colors',
                activeExperiments.length > ACTIVE_CAPACITY
                  ? 'border-amber/40 bg-amber/10 text-amber hover:bg-amber/20'
                  : 'border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/20',
              )}
              title="实验台：7 天验证记录与复盘"
            >
              <FlaskConical className="h-3 w-3" /> 进行中实验 {activeExperiments.length}/{ACTIVE_CAPACITY}
            </Link>
            <Link to="/rankings" className="inline-flex h-7 items-center gap-1 rounded border border-signal/40 bg-signal/10 px-2.5 text-[11.5px] text-signal hover:bg-signal/20">
              查看完整榜单 <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label={KPI_DEFS[0].label} en={KPI_DEFS[0].en} accent={KPI_DEFS[0].accent} icon={KPI_DEFS[0].icon}
          value={fmtInt(kpi.total_opps)}
          sub={<><span>覆盖 {kpi.industries_covered} 行业 / {kpi.regions_covered} 区域</span><span className="ml-auto font-mono text-dim">AVG {fmtScore(kpi.avg_total)}</span></>}
          spark={sparkNew}
        />
        <KpiCard
          label={KPI_DEFS[1].label} en={KPI_DEFS[1].en} accent={KPI_DEFS[1].accent} icon={KPI_DEFS[1].icon}
          value={fmtInt(kpi.new_today)}
          sub={<><span>今日榜单 {dayCount} 条</span><span className="ml-auto font-mono text-amber">+{fmtInt(kpi.new_today)}</span></>}
          spark={sparkNew.map((n) => n + (kpi.new_today || 1))}
        />
        <KpiCard
          label={weekKpiLabel} en={rankingsDeltaBasis === 'history' ? 'NEW THIS WEEK' : 'WEEK DELTA'} accent={KPI_DEFS[2].accent} icon={KPI_DEFS[2].icon}
          value={fmtInt(weekKpiValue)}
          sub={<>
            <span>{rankingsDeltaBasis === 'history' ? rankings.windows.week?.label || '本周' : deltaBasisLabel}</span>
            <span className="ml-auto font-mono text-cyan">{weekCount} 入榜</span>
          </>}
        />
        <KpiCard
          label={KPI_DEFS[3].label} en={KPI_DEFS[3].en} accent={KPI_DEFS[3].accent} icon={KPI_DEFS[3].icon}
          value={fmtInt(kpi.grade_a_plus)}
          sub={<><span>占全部 {fmtPct(aPlusShare, 1)}</span><span className="ml-auto font-mono text-grade-s">S+A</span></>}
        />
        <KpiCard
          label={KPI_DEFS[4].label} en={KPI_DEFS[4].en} accent={KPI_DEFS[4].accent} icon={KPI_DEFS[4].icon}
          value={`¥${fmtCny(stats.open_window_value_cny)}`}
          unit="/ 月"
          sub={<><span>{openWindows} 个开放/鼎盛窗口</span><span className="ml-auto font-mono text-dim">SUM</span></>}
        />
      </section>

      <Panel className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2">
        <span className="mono-label flex items-center gap-1"><Database className="h-3 w-3 text-cyan" /> DATA HEALTH</span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-dim">
          榜单口径
          <Badge tone={rankingsDeltaBasis === 'history' ? 'signal' : 'amber'}>
            {deltaBasisLabel}
          </Badge>
          {rankingsDeltaBasis === 'history' && <span className="font-mono">上期 {rankingsHistoryAsOf || '—'}</span>}
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-dim">
          <History className="h-3 w-3 text-dim" />
          历史快照 <span className="num text-muted">{historyMeta.count}</span>
          {historyMeta.available ? <span className="font-mono">最新 {historyMeta.latest_date}</span> : <span className="text-amber">未提供（可选）</span>}
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-dim">
          采集健康
          {sourceHealth.available ? (
            <span className="font-mono text-muted">成功 {sourceHealth.ok_count}/{sourceHealth.total} · {sourceHealth.checked_at || '—'}</span>
          ) : (
            <span className="text-dim">未提供（可选）</span>
          )}
        </span>
        <Link to="/about" className="ml-auto text-[10.5px] text-muted hover:text-signal">数据说明 →</Link>
      </Panel>

      {activeExperiments.length > 0 && (
        <Panel className={cn('mt-2.5 flex flex-wrap items-center gap-2 px-3 py-2', activeExperiments.length > ACTIVE_CAPACITY ? 'border-amber/35 bg-amber/[0.05]' : 'border-cyan/25 bg-cyan/[0.04]')}>
          <FlaskConical className={cn('h-4 w-4', activeExperiments.length > ACTIVE_CAPACITY ? 'text-amber' : 'text-cyan')} />
          <span className="text-[11px] text-ink">
            进行中实验 <span className={cn('num font-semibold', activeExperiments.length > ACTIVE_CAPACITY ? 'text-amber' : 'text-cyan')}>{activeExperiments.length}/{ACTIVE_CAPACITY}</span>
            {activeExperiments.length > ACTIVE_CAPACITY ? ' · 超过个人产能上限，建议先结案' : ' · 保持每周复盘'}
          </span>
          <span className="min-w-0 flex-1 truncate text-[10.5px] text-dim">
            {activeExperiments.slice(0, 2).map((x) => {
              const review = experimentReviewInfo(x)
              return `${x.title}（${review.overdue ? '复盘逾期' : review.daysLeft === 0 ? '今天复盘' : `${review.daysLeft} 天后复盘`}）`
            }).join(' · ')}
          </span>
          <Link to="/lab" className="inline-flex h-6 shrink-0 items-center gap-1 rounded border border-line bg-panel-2 px-2 text-[10.5px] text-muted hover:text-ink">
            打开实验台 <ArrowUpRight className="h-3 w-3" />
          </Link>
        </Panel>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <SectionCard
          className="xl:col-span-7"
          eyebrow="TODAY RANKING"
          title={`今日榜 · Top 5`}
          subtitle={`窗口 ${rankings.windows.day?.key || dataAsOf} · 按 rank_score 降序`}
          right={<Link to="/rankings" className="text-[11px] text-muted hover:text-signal">全部榜单 →</Link>}
          bodyClassName="p-2"
        >
          <div className="space-y-1.5">
            {top5.map((item) => (
              <OpportunityCard
                key={item.opp_id}
                opp={item.opp!}
                rank={item.rank}
                showRank
                change={item.change}
                delta={item.delta}
              />
            ))}
            {!top5.length && <div className="p-6 text-center text-[12px] text-dim">暂无今日榜单数据（等待 data-engineer 产出 rankings.json）</div>}
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-5"
          eyebrow="SCORE DISTRIBUTION"
          title="评分分布 · 总分直方图"
          subtitle={`平均总分 ${fmtScore(kpi.avg_total)} · 高分机会集中在 70+`}
          right={<BarChart3 className="h-4 w-4 text-dim" />}
        >
          <Chart option={histogramOption} height={274} />
          <div className="mt-1 flex items-center justify-between font-mono text-[9.5px] text-dim">
            <span>10 个分段 · 每段 10 分</span>
            <span>绿色 = 平均分段</span>
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-7"
          eyebrow="14-DAY TREND"
          title="近 14 天信号趋势"
          subtitle="柱：每日新增信号条数 · 线：当日机会平均总分"
          right={<Activity className="h-4 w-4 text-dim" />}
        >
          <Chart option={trendOption} height={242} />
        </SectionCard>

        <SectionCard
          className="xl:col-span-5"
          eyebrow="HUMAN NEEDS"
          title="人性底层需求雷达"
          subtitle="机会库在 12 类底层需求上的分布"
          right={<RadarIcon className="h-4 w-4 text-dim" />}
        >
          <Chart option={needRadarOption} height={242} />
        </SectionCard>

        <SectionCard
          className="xl:col-span-7"
          eyebrow="REGION × GAP COVERAGE"
          title="区域覆盖热力"
          subtitle="区域 × 信息差类型的机会密度（颜色越亮机会越多）"
          right={<Globe2 className="h-4 w-4 text-dim" />}
        >
          <Chart option={regionHeatOption} height={292} />
        </SectionCard>

        <SectionCard
          className="xl:col-span-5"
          eyebrow="INDUSTRY COVERAGE"
          title="行业板块覆盖 Treemap"
          subtitle="面积 = 机会数量 · 颜色 = 行业色"
          right={<PieChart className="h-4 w-4 text-dim" />}
        >
          <Chart option={treemapOption} height={292} />
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {(stats.by_industry || []).slice(0, 7).map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1 text-[9.5px] text-dim">
                <span className="h-1.5 w-1.5 rounded-sm" style={{ background: industryColor(b.id) }} />
                {industryName(b.id)} <span className="num text-muted">{b.count}</span>
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-7"
          eyebrow="SIGNAL TIMELINE"
          title="最近爆发信号时间轴"
          subtitle="按 last_activity 倒序 · 仅显示最近 7 条"
          right={<CalendarClock className="h-4 w-4 text-dim" />}
          bodyClassName="p-3"
        >
          <ol className="relative ml-1 border-l border-line pl-4">
            {recent.map((o, i) => (
              <li key={o.id} className="relative pb-3 last:pb-0">
                <span
                  className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border"
                  style={{ background: i === 0 ? industryColor(o.industry_id) : '#12151c', borderColor: industryColor(o.industry_id) }}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] text-dim">{o.last_activity}</span>
                  <GradeBadge grade={o.scores.grade} />
                  <Link to={`/opportunities/${o.id}`} className="text-[12px] font-medium text-ink hover:text-signal">
                    {o.title}
                  </Link>
                  <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-dim">
                    <span className="text-amber">MOM ×{o.momentum.toFixed(1)}</span>
                    <span>·</span>
                    <span>{o.signal.evidence.length} 证据</span>
                    <span>·</span>
                    <span style={{ color: industryColor(o.industry_id) }}>{industryName(o.industry_id)}</span>
                  </span>
                </div>
                <div className="mt-0.5 line-clamp-1 text-[10.5px] text-dim">{o.signal.summary}</div>
              </li>
            ))}
            {!recent.length && <li className="text-[12px] text-dim">暂无信号</li>}
          </ol>
        </SectionCard>

        <SectionCard
          className="xl:col-span-5"
          eyebrow="WINDOW OVERVIEW"
          title="四窗口速览"
          subtitle={`日 / 周 / 月 / 年榜单规模与榜首 · 口径：${deltaBasisLabel}`}
          right={<Link to="/rankings" className="text-[11px] text-muted hover:text-signal">去排行榜 →</Link>}
          bodyClassName="p-3"
        >
          <div className="space-y-2">
            {(['day', 'week', 'month', 'year'] as const).map((w) => {
              const win = rankings.windows[w]
              const top = win?.items?.[0]
              const opp = top ? oppById.get(top.opp_id) : undefined
              const quota = { day: 6, week: 12, month: 20, year: 40 }[w]
              return (
                <Link key={w} to={`/rankings?w=${w}`} className="block rounded border border-line/80 bg-white/[0.015] p-2 transition-colors hover:border-line-strong">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11.5px] text-ink">
                      <span className="mono-label text-signal">{WINDOW_LABEL[w]}</span>
                      <span className="font-mono text-[9.5px] text-dim">{win?.key}</span>
                    </span>
                    <span className="num text-[11px] text-muted">
                      {win?.items?.length || 0}
                      <span className="font-mono text-[9px] text-dim"> / 配额 {quota}</span>
                    </span>
                  </div>
                  <ProgressBar value={Math.min(win?.items?.length || 0, quota)} max={quota} tone={(win?.items?.length || 0) >= quota ? 'signal' : 'amber'} className="mt-1.5" />
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {opp ? (
                      <>
                        <GradeBadge grade={opp.scores.grade} />
                        <span className="truncate text-[10.5px] text-muted">{opp.title}</span>
                        <span className="num ml-auto text-[10.5px] text-dim">{fmtScore(top?.total ?? opp.scores.total)}</span>
                      </>
                    ) : (
                      <span className="text-[10.5px] text-dim">暂无榜首数据</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-line/70 pt-2 text-center">
            <div>
              <div className="num text-[13px] text-signal">{fmtInt(kpi.industries_covered)}</div>
              <div className="mono-label !text-[8.5px]">行业</div>
            </div>
            <div>
              <div className="num text-[13px] text-cyan">{fmtInt(kpi.regions_covered)}</div>
              <div className="mono-label !text-[8.5px]">区域</div>
            </div>
            <div>
              <div className="num text-[13px] text-amber">{fmtInt(kpi.grade_a_plus)}</div>
              <div className="mono-label !text-[8.5px]">A 级以上</div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <SectionCard
          eyebrow="TOP NEEDS"
          title="需求热度 Top 6"
          subtitle="按机会覆盖数量排序"
          className="lg:col-span-1"
          bodyClassName="p-3"
        >
          <div className="space-y-2">
            {(stats.by_need || []).slice(0, 6).map((b) => {
              const max = Math.max(...(stats.by_need || []).map((x) => x.count), 1)
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">{b.name || needName(b.id)}</span>
                    <span className="num text-dim">{b.count}</span>
                  </div>
                  <ProgressBar value={b.count} max={max} className="mt-1" tone="cyan" />
                </div>
              )
            })}
          </div>
        </SectionCard>
        <SectionCard
          eyebrow="INFO GAP"
          title="信息差类型分布"
          subtitle="机会主类型 + 复合类型计数"
          className="lg:col-span-2"
          bodyClassName="p-3"
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
            {(stats.by_gap_type || []).slice(0, 12).map((b) => {
              const max = Math.max(...(stats.by_gap_type || []).map((x) => x.count), 1)
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-muted">{b.name || gapName(b.id)}</span>
                    <span className="num shrink-0 text-dim">{b.count}</span>
                  </div>
                  <ProgressBar value={b.count} max={max} className="mt-1" />
                </div>
              )
            })}
          </div>
          <div className="mt-3 rounded border border-line/70 bg-white/[0.015] px-2.5 py-2 text-[10.5px] leading-relaxed text-dim">
            说明：信息差是机会的「窗口来源」，半衰期越短的类型越需要快速验证。完整 12 类定义见
            <Link to="/method" className="mx-1 text-signal/90 hover:text-signal">方法论</Link>
            页面。
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
