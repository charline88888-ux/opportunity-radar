import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import type { EChartsOption } from 'echarts'
import { CalendarDays, Clock3, Compass, Filter, MapPin, Sparkles } from 'lucide-react'
import { Chart } from '@/components/charts/Chart'
import { PageHeader } from '@/components/PageHeader'
import { Badge, EmptyState, Panel, SectionCard } from '@/components/ui'
import { calendarEvents, dataAsOf, regionName, taxonomy } from '@/lib/data'
import { CAL_TYPE_HEX, CAL_TYPE_LABEL, cn, dateRangeText, fmtDate, fmtMonthCn, shiftDate } from '@/lib/utils'
import type { CalendarType } from '@/types'

const TYPE_ORDER: CalendarType[] = ['religious', 'festival', 'tax', 'school', 'fiscal', 'shopping', 'national']

function EventStatus({ event }: { event: (typeof calendarEvents)[number] }) {
  const asOf = dayjs(dataAsOf)
  const start = dayjs(event.date).subtract(event.lead_time_days, 'day')
  const end = dayjs(event.end_date || event.date)
  const daysToEvent = dayjs(event.date).diff(asOf, 'day')
  const daysToStart = start.diff(asOf, 'day')
  if (daysToEvent < 0 && end.diff(asOf, 'day') < 0) {
    return <Badge tone="muted">已结束</Badge>
  }
  if (daysToStart <= 0) {
    return <Badge tone="amber">布局窗口内 · 节点前 {Math.max(0, daysToEvent)} 天</Badge>
  }
  if (daysToStart <= 30) {
    return <Badge tone="signal">建议启动布局 · 还有 {daysToStart} 天</Badge>
  }
  return <Badge tone="neutral">距布局窗口 {daysToStart} 天</Badge>
}

export default function CalendarPage() {
  const [type, setType] = useState<'all' | CalendarType>('all')
  const [region, setRegion] = useState('all')
  const [upcomingOnly, setUpcomingOnly] = useState(false)

  const asOf = dayjs(dataAsOf)

  const filtered = useMemo(() => {
    return calendarEvents
      .filter((e) => (type === 'all' ? true : e.type === type))
      .filter((e) => (region === 'all' ? true : e.region_ids.includes(region)))
      .filter((e) => (upcomingOnly ? dayjs(e.end_date || e.date).diff(asOf, 'day') >= -1 : true))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [type, region, upcomingOnly, asOf])

  const months = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const e of filtered) {
      const key = dayjs(e.date).format('YYYY-MM')
      const list = map.get(key) || []
      list.push(e)
      map.set(key, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const chartOption = useMemo<EChartsOption>(() => {
    const allMonths = [...new Set([dayjs(dataAsOf).format('YYYY-MM'), ...calendarEvents.map((e) => dayjs(e.date).format('YYYY-MM'))])].sort()
    const series = TYPE_ORDER.map((t) => ({
      name: CAL_TYPE_LABEL[t],
      type: 'bar' as const,
      stack: 'total',
      barMaxWidth: 16,
      itemStyle: { color: CAL_TYPE_HEX[t], borderRadius: t === 'national' ? [2, 2, 0, 0] : 0 },
      data: allMonths.map((m) => filtered.filter((e) => e.type === t && dayjs(e.date).format('YYYY-MM') === m).length || 0),
    }))
    return {
      grid: { left: 6, right: 8, top: 28, bottom: 2, containLabel: true },
      legend: { top: 0, right: 0, textStyle: { fontSize: 9 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: allMonths,
        axisLabel: {
          fontSize: 9,
          interval: 1,
          formatter: (v: string) => `${v.slice(2, 4)}/${v.slice(5, 7)}`,
        },
      },
      yAxis: { type: 'value', minInterval: 1, name: '节点数', nameTextStyle: { fontSize: 8.5, color: '#5a6273' } },
      series: [
        ...series,
        {
          name: 'as_of',
          type: 'line',
          data: [],
          markLine: {
            silent: true,
            symbol: 'none',
            label: { fontSize: 8.5, color: '#8b93a7', formatter: `as_of ${dataAsOf.slice(5)}` },
            lineStyle: { color: '#ff5d5d', type: 'dashed' },
            data: [{ xAxis: dayjs(dataAsOf).format('YYYY-MM') }],
          },
        },
      ],
    }
  }, [filtered])

  const stats = useMemo(() => {
    const upcoming = calendarEvents.filter((e) => dayjs(e.date).diff(asOf, 'day') >= 0)
    const next = upcoming.sort((a, b) => a.date.localeCompare(b.date))[0]
    const in90 = upcoming.filter((e) => dayjs(e.date).diff(asOf, 'day') <= 90)
    const avgLead = calendarEvents.length ? Math.round(calendarEvents.reduce((a, e) => a + e.lead_time_days, 0) / calendarEvents.length) : 0
    return { upcoming: upcoming.length, next, in90: in90.length, avgLead }
  }, [asOf])

  return (
    <div>
      <PageHeader
        index="07"
        kicker="CALENDAR · 全球商业日历"
        title="全球商业日历 · 节庆与布局窗口"
        description="宗教节庆、国家节日、税季、开学、购物节与财政年节点。每个节点都有建议提前布局天数：晚于起始日再动手，通常只能吃残羹。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal"><CalendarDays className="h-3 w-3" /> {calendarEvents.length} 个节点</Badge>
            <Badge tone="amber"><Clock3 className="h-3 w-3" /> 未来 90 天 {stats.in90} 个</Badge>
            <Badge tone="neutral">as_of {dataAsOf}</Badge>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Panel className="px-3 py-2">
          <div className="mono-label">节点总数</div>
          <div className="num mt-0.5 text-[20px] font-semibold text-signal">{calendarEvents.length}</div>
          <div className="text-[9.5px] text-dim">覆盖 {new Set(calendarEvents.flatMap((e) => e.region_ids)).size} 个区域</div>
        </Panel>
        <Panel className="px-3 py-2">
          <div className="mono-label">未来 90 天</div>
          <div className="num mt-0.5 text-[20px] font-semibold text-amber">{stats.in90}</div>
          <div className="text-[9.5px] text-dim">需要现在启动布局</div>
        </Panel>
        <Panel className="px-3 py-2">
          <div className="mono-label">下一个节点</div>
          <div className="mt-0.5 truncate text-[13px] font-medium text-ink">{stats.next?.name || '—'}</div>
          <div className="font-mono text-[9.5px] text-dim">{stats.next ? `${fmtDate(stats.next.date)} · ${CAL_TYPE_LABEL[stats.next.type]}` : ''}</div>
        </Panel>
        <Panel className="px-3 py-2">
          <div className="mono-label">平均提前布局</div>
          <div className="num mt-0.5 text-[20px] font-semibold text-cyan">{stats.avgLead}<span className="text-[10px] text-dim"> 天</span></div>
          <div className="text-[9.5px] text-dim">按全部节点 lead_time_days 均值</div>
        </Panel>
      </div>

      <SectionCard
        eyebrow="DENSITY"
        title="未来节点密度 · 按类型堆叠"
        subtitle="横轴为月份 · 红色虚线为数据基准日 as_of"
        right={<ChartDays />}
      >
        <Chart option={chartOption} height={190} />
      </SectionCard>

      <div className="my-3 flex flex-col gap-2 rounded-md border border-line bg-panel/60 p-2 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="h-3 w-3 text-dim" />
          <button onClick={() => setType('all')} className={cn('rounded border px-1.5 py-0.5 text-[10.5px]', type === 'all' ? 'border-signal/45 bg-signal/10 text-signal' : 'border-line text-muted')}>全部类型</button>
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => setType(type === t ? 'all' : t)}
              className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px]', type === t ? 'border-line-strong bg-white/[0.06] text-ink' : 'border-line text-muted')}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: CAL_TYPE_HEX[t] }} />
              {CAL_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="h-7 rounded border border-line bg-panel-2 px-1.5 text-[10.5px] text-muted outline-none" aria-label="区域筛选">
            <option value="all">全部区域</option>
            {taxonomy.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button
            onClick={() => setUpcomingOnly(!upcomingOnly)}
            className={cn('rounded border px-2 py-1 text-[10.5px]', upcomingOnly ? 'border-signal/45 bg-signal/10 text-signal' : 'border-line text-muted')}
          >
            只看未来节点
          </button>
        </div>
      </div>

      {!months.length && <EmptyState title="没有匹配的日历节点" hint="尝试清空类型 / 区域筛选。" />}

      <div className="space-y-4">
        {months.map(([month, events]) => (
          <div key={month}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[15px] font-semibold text-ink">{fmtMonthCn(month)}</span>
              <span className="font-mono text-[10px] text-dim">{month}</span>
              <div className="ml-1 h-px flex-1 bg-line" />
              <Badge tone="muted">{events.length} 个节点</Badge>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {events.map((e) => {
                const start = shiftDate(e.date, -e.lead_time_days)
                return (
                  <Panel key={`${e.name}-${e.date}`} className="panel-hover p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9.5px] text-dim">{dateRangeText(e.date, e.end_date)}</span>
                      <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9.5px]" style={{ color: CAL_TYPE_HEX[e.type], borderColor: `${CAL_TYPE_HEX[e.type]}55`, background: `${CAL_TYPE_HEX[e.type]}12` }}>
                        {CAL_TYPE_LABEL[e.type] || e.type}
                      </span>
                    </div>
                    <div className="mt-1 text-[13px] font-semibold text-ink">{e.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {e.region_ids.map((r) => (
                        <span key={r} className="inline-flex items-center gap-0.5 rounded border border-line/70 px-1.5 py-0.5 text-[9.5px] text-muted">
                          <MapPin className="h-2.5 w-2.5 text-dim" /> {regionName(r)}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone="cyan"><Clock3 className="h-2.5 w-2.5" /> 提前 {e.lead_time_days} 天</Badge>
                      <EventStatus event={e} />
                    </div>
                    <div className="mt-1.5 rounded border border-line/60 bg-white/[0.015] px-2 py-1 font-mono text-[9.5px] text-dim">
                      建议布局起始日 <span className="text-muted">{fmtDate(start)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {e.themes.map((t) => (
                        <span key={t} className="rounded bg-white/[0.03] px-1.5 py-0.5 text-[9.5px] text-muted">{t}</span>
                      ))}
                    </div>
                    <p className="mt-1.5 line-clamp-3 text-[10.5px] leading-relaxed text-dim">{e.notes}</p>
                  </Panel>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <Panel className="mt-4 flex items-start gap-2 px-3 py-2">
        <Compass className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
        <div className="text-[10.5px] leading-relaxed text-dim">
          <span className="text-muted">使用建议：</span>
          节点营销不是「到日子发内容」，而是按「设计 → 打样 → 内容预热 → 备货 → 物流截单」倒排。宗教类节点务必先做本地文化审校（禁忌、素材、祝福语），避免踩雷。
          <span className="ml-1 inline-flex items-center gap-0.5 text-cyan"><Sparkles className="h-3 w-3" /> 布局窗口比节点日期更重要。</span>
        </div>
      </Panel>
    </div>
  )
}

function ChartDays() {
  return <CalendarDays className="h-4 w-4 text-dim" />
}
