import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import { ArrowUpRight, CalendarRange, Download, FileText, Globe2, ShieldCheck } from 'lucide-react'
import { Chart } from '@/components/charts/Chart'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Panel, SectionCard } from '@/components/ui'
import { dataAsOf, gapName, industryName, oppById, opportunities, rankings, regionName, taxonomy } from '@/lib/data'
import { useExperiments } from '@/lib/experiments'
import { useI18n } from '@/lib/i18n'
import { downloadText } from '@/lib/exports'
import { cn, fmtInt, fmtScore } from '@/lib/utils'
import type { Opportunity } from '@/types'

type L = (zh: string, en: string) => string

const MONTH_LABELS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

export default function Yearbook() {
  const { lang } = useI18n()
  const { items: experiments } = useExperiments()
  const L: L = (zh, en) => (lang === 'en' ? en : zh)
  const year = dataAsOf.slice(0, 4)
  const yearItems = rankings.windows.year.items.map((x) => oppById.get(x.opp_id)).filter((x): x is Opportunity => !!x)
  const top20 = yearItems.slice(0, 20)
  const maxTotalOverall = opportunities.reduce((max, o) => Math.max(max, o.scores.total), 0)
  const aGrade = yearItems.filter((o) => o.scores.grade === 'S' || o.scores.grade === 'A' || o.scores.total >= 75).sort((a, b) => b.scores.total - a.scores.total)
  const closing = yearItems.filter((o) => o.window.status === 'closed' || o.window.months_left <= 3).sort((a, b) => a.window.months_left - b.window.months_left)

  const monthly = useMemo(() => {
    const rows = MONTH_LABELS.map((m) => ({ month: m, count: 0, themes: new Map<string, number>(), grades: new Map<string, number>(), gaps: new Map<string, number>() }))
    for (const o of yearItems) {
      for (const d of o.activity_dates) {
        if (!d.startsWith(`${year}-`)) continue
        const idx = Math.max(0, Math.min(11, Number(d.slice(5, 7)) - 1))
        const row = rows[idx]
        row.count += 1
        row.grades.set(o.scores.grade, (row.grades.get(o.scores.grade) || 0) + 1)
        for (const g of o.gap_type_ids) {
          row.gaps.set(gapName(g), (row.gaps.get(gapName(g)) || 0) + 1)
          row.themes.set(gapName(g), (row.themes.get(gapName(g)) || 0) + 1)
        }
        row.themes.set(industryName(o.industry_id), (row.themes.get(industryName(o.industry_id)) || 0) + 0.5)
      }
    }
    return rows.map((r) => ({
      month: r.month,
      count: r.count,
      themes: [...r.themes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]),
      grades: ['S', 'A', 'B', 'C'].map((g) => ({ grade: g, value: r.grades.get(g) || 0 })),
      gaps: [...r.gaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    }))
  }, [yearItems, year])

  const gapHeat = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of monthly) for (const [g, n] of row.gaps) totals.set(g, (totals.get(g) || 0) + n)
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => ({ gap: g, values: monthly.map((row) => row.gaps.find((x) => x[0] === g)?.[1] || 0) }))
  }, [monthly])

  const windowStats = useMemo(() => {
    const statuses = ['open', 'peak', 'closing', 'closed']
    return {
      byStatus: statuses.map((s) => ({ status: s, count: yearItems.filter((o) => o.window.status === s).length })),
      buckets: [
        { label: '≤0M', count: yearItems.filter((o) => o.window.months_left <= 0).length },
        { label: '1-3M', count: yearItems.filter((o) => o.window.months_left > 0 && o.window.months_left <= 3).length },
        { label: '4-6M', count: yearItems.filter((o) => o.window.months_left > 3 && o.window.months_left <= 6).length },
        { label: '7-12M', count: yearItems.filter((o) => o.window.months_left > 6 && o.window.months_left <= 12).length },
        { label: '>12M', count: yearItems.filter((o) => o.window.months_left > 12).length },
      ],
    }
  }, [yearItems])

  const experimentStats = useMemo(() => {
    const closed = experiments.filter((e) => e.status !== 'active' && e.outcome)
    const positive = closed.filter((e) => e.outcome === 'positive').length
    const negative = closed.filter((e) => e.outcome === 'negative').length
    const inconclusive = closed.filter((e) => e.outcome === 'inconclusive').length
    return {
      total: experiments.length,
      active: experiments.filter((e) => e.status === 'active').length,
      closed: closed.length,
      positive,
      negative,
      inconclusive,
      successRate: positive + negative ? Math.round((positive / (positive + negative)) * 1000) / 10 : 0,
    }
  }, [experiments])

  const distributions = useMemo(() => {
    const byIndustry = new Map<string, number>()
    const byRegion = new Map<string, number>()
    const byGap = new Map<string, number>()
    const byGrade = new Map<string, number>()
    const byStatus = new Map<string, number>()
    for (const o of yearItems) {
      byIndustry.set(industryName(o.industry_id), (byIndustry.get(industryName(o.industry_id)) || 0) + 1)
      for (const r of o.region_ids) byRegion.set(regionName(r), (byRegion.get(regionName(r)) || 0) + 1)
      for (const g of o.gap_type_ids) byGap.set(gapName(g), (byGap.get(gapName(g)) || 0) + 1)
      byGrade.set(o.scores.grade, (byGrade.get(o.scores.grade) || 0) + 1)
      byStatus.set(o.window.status, (byStatus.get(o.window.status) || 0) + 1)
    }
    const toSorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])
    return { byIndustry: toSorted(byIndustry), byRegion: toSorted(byRegion), byGap: toSorted(byGap), byGrade: toSorted(byGrade), byStatus: toSorted(byStatus) }
  }, [yearItems])

  const timelineOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 4, right: 8, top: 20, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: monthly.map((x) => x.month) },
      yAxis: { type: 'value', name: L('新信号数', 'Signals'), minInterval: 1, nameTextStyle: { fontSize: 9, color: '#5a6273' } },
      series: [
        { name: L('新信号', 'Signals'), type: 'bar', barMaxWidth: 26, itemStyle: { color: '#3ddc97', opacity: 0.85 }, data: monthly.map((x) => x.count) },
        { name: L('活动月份', 'Active months'), type: 'line', smooth: true, symbolSize: 5, lineStyle: { color: '#4cc9f0', width: 1.5 }, itemStyle: { color: '#4cc9f0' }, data: monthly.map((x) => (x.count > 0 ? x.count : null)) },
      ],
    }),
    [monthly, lang],
  )

  const industryOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 4, right: 8, top: 16, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: distributions.byIndustry.map((x) => x[0]), axisLabel: { fontSize: 8.5, rotate: 25 } },
      yAxis: { type: 'value', minInterval: 1, name: L('机会数', 'Opportunities'), nameTextStyle: { fontSize: 9, color: '#5a6273' } },
      series: [{ type: 'bar', barMaxWidth: 24, itemStyle: { color: '#4cc9f0', opacity: 0.85 }, data: distributions.byIndustry.map((x) => x[1]) }],
    }),
    [distributions, lang],
  )

  const gradeOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 4, right: 8, top: 22, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: { color: '#8b93a7', fontSize: 9 }, itemWidth: 8, itemHeight: 8 },
      xAxis: { type: 'category', data: monthly.map((x) => x.month) },
      yAxis: { type: 'value', minInterval: 1, name: L('新信号', 'Signals'), nameTextStyle: { fontSize: 9, color: '#5a6273' } },
      series: ['S', 'A', 'B', 'C'].map((grade, i) => ({
        name: grade,
        type: 'bar',
        stack: 'grade',
        barMaxWidth: 24,
        itemStyle: { color: ['#ffd166', '#3ddc97', '#4cc9f0', '#8b93a7'][i] },
        data: monthly.map((x) => x.grades.find((g) => g.grade === grade)?.value || 0),
      })),
    }),
    [monthly, lang],
  )

  const md = () => {
    const lines: string[] = [
      `# ${L('机会雷达 · 年度复盘', 'Opportunity Radar · Yearbook')} ${year}`,
      '',
      `- ${L('数据基准日', 'Data as-of')}：${dataAsOf}`,
      `- ${L('年榜机会数', 'Year-ranked opportunities')}：${yearItems.length}`,
      `- ${L('A 级/≥75 分机会', 'A-grade / ≥75 opportunities')}：${aGrade.length}`,
      `- ${L('窗口关闭/≤3 个月', 'Window closed / ≤3 months')}：${closing.length}`,
      '',
      `## ${L('年榜 Top20', 'Yearly Top 20')}`,
      '',
      `| # | ${L('机会', 'Opportunity')} | ${L('等级', 'Grade')} | ${L('总分', 'Total')} | ${L('行业', 'Industry')} | ${L('区域', 'Region')} |`,
      '|---|---|---|---|---|---|',
      ...top20.map((o, i) => `| ${i + 1} | ${o.title} | ${o.scores.grade} | ${o.scores.total} | ${industryName(o.industry_id)} | ${o.region_ids.map(regionName).join(' / ')} |`),
      '',
      `## ${L('月度时间线', 'Monthly timeline')}`,
      '',
      '| 月份 | 新信号 | 主题 |',
      '|---|---:|---|',
      ...monthly.map((x) => `| ${year}-${x.month} | ${x.count} | ${x.themes.join(' / ') || '—'} |`),
      '',
      `## ${L('分布', 'Distributions')}`,
      '',
      `- ${L('行业', 'Industry')}：${distributions.byIndustry.map((x) => `${x[0]} ${x[1]}`).join(' · ')}`,
      `- ${L('区域', 'Region')}：${distributions.byRegion.map((x) => `${x[0]} ${x[1]}`).join(' · ')}`,
      `- ${L('信息差', 'Gap type')}：${distributions.byGap.map((x) => `${x[0]} ${x[1]}`).join(' · ')}`,
      `- ${L('等级', 'Grade')}：${distributions.byGrade.map((x) => `${x[0]} ${x[1]}`).join(' · ')}`,
      '',
      `## ${L('A 级清单', 'A-grade list')}`,
      '',
      ...aGrade.slice(0, 20).map((o) => `- ${o.scores.grade} · ${o.scores.total} · ${o.title}（${industryName(o.industry_id)}）`),
      '',
      `## ${L('窗口关闭 / 即将关闭', 'Closed / closing windows')}`,
      '',
      ...closing.slice(0, 20).map((o) => `- ${o.window.status} · ${o.window.months_left}M · ${o.title}`),
      '',
      `## ${L('后端可打印年鉴', 'Backend printable yearbook')}`,
      '',
      L('运行 `python scanner/yearbook.py --year 2026` 生成自包含可打印 HTML/Markdown；可选传入实验导出 JSON。', 'Run `python scanner/yearbook.py --year 2026` to generate a self-contained printable HTML/Markdown; optionally pass an experiments JSON export.'),
      '',
      '---',
      '',
      L('免责声明：本页基于打包数据在浏览器本地生成；研究假设与公开信息整理，不构成投资建议、法律意见或收入承诺。', 'Disclaimer: generated locally in the browser from bundled data; research hypotheses and public information only, not investment, legal, or income advice.'),
    ]
    return lines.join('\n') + '\n'
  }

  const html = () => {
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] || c)
    return `<!doctype html><html lang="${lang === 'en' ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><title>${esc(L('年度复盘', 'Yearbook'))} ${year}</title><style>
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;background:#0d1117;color:#e6e9f0;margin:0;padding:40px;line-height:1.65}h1,h2{color:#3ddc97}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #2a3140;padding:6px 8px;text-align:left;font-size:12px}th{background:#151b24}small,.muted{color:#8b93a7}@media print{body{background:#fff;color:#111}h1,h2{color:#0b6b45}th{background:#eee}th,td{border-color:#bbb}}</style></head><body>
<h1>${esc(L('机会雷达 · 年度复盘', 'Opportunity Radar · Yearbook'))} ${year}</h1>
<p class="muted">${esc(L('数据基准日', 'Data as-of'))}：${dataAsOf}</p>
<h2>${esc(L('年榜 Top20', 'Yearly Top 20'))}</h2>
<table><tr><th>#</th><th>${esc(L('机会', 'Opportunity'))}</th><th>${esc(L('等级', 'Grade'))}</th><th>${esc(L('总分', 'Total'))}</th></tr>
${top20.map((o, i) => `<tr><td>${i + 1}</td><td>${esc(o.title)}</td><td>${o.scores.grade}</td><td>${o.scores.total}</td></tr>`).join('')}
</table>
<h2>${esc(L('月度时间线', 'Monthly timeline'))}</h2>
<table><tr><th>${esc(L('月份', 'Month'))}</th><th>${esc(L('新信号', 'Signals'))}</th><th>${esc(L('主题', 'Themes'))}</th></tr>
${monthly.map((x) => `<tr><td>${year}-${x.month}</td><td>${x.count}</td><td>${esc(x.themes.join(' / ') || '—')}</td></tr>`).join('')}
</table>
<h2>${esc(L('A 级清单', 'A-grade list'))}</h2>
<ul>${aGrade.slice(0, 20).map((o) => `<li>${o.scores.grade} · ${o.scores.total} · ${esc(o.title)}</li>`).join('')}</ul>
<h2>${esc(L('窗口关闭 / 即将关闭', 'Closed / closing windows'))}</h2>
<ul>${closing.slice(0, 20).map((o) => `<li>${o.window.status} · ${o.window.months_left}M · ${esc(o.title)}</li>`).join('')}</ul>
<p class="muted">${esc(L('免责声明：研究假设与公开信息整理，不构成投资建议、法律意见或收入承诺。', 'Disclaimer: research hypotheses and public information only; not investment, legal, or income advice.'))}</p>
<small>${esc(L('后端可打印版', 'Backend printable version'))}：python scanner/yearbook.py --year ${year}</small>
</body></html>`
  }

  return (
    <div>
      <PageHeader
        index="11"
        kicker={L('YEARBOOK · 年度复盘', 'YEARBOOK')}
        title={L(`${year} 年度复盘 · 机会年鉴`, `${year} Yearbook · Opportunity review`)}
        description={L('把年榜、月度时间线、行业/区域/信息差分布、A 级清单与窗口关闭机会整理成一份可导出的年度复盘；数据来自打包机会库与年榜。', 'A yearly review of the Top 20, monthly timeline, industry/region/gap distributions, A-grade list, and closing windows. Data comes from the bundled opportunity library and yearly ranking.')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal"><CalendarRange className="h-3 w-3" /> {yearItems.length} {L('条年榜机会', 'year-ranked')}</Badge>
            <Button size="sm" variant="outline" onClick={() => downloadText(`radar-yearbook-${year}.md`, md(), 'text/markdown;charset=utf-8')}><FileText className="h-3.5 w-3.5" /> {L('导出年鉴 MD', 'Export yearbook MD')}</Button>
            <Button size="sm" variant="outline" onClick={() => downloadText(`radar-yearbook-${year}.html`, html(), 'text/html;charset=utf-8')}><Download className="h-3.5 w-3.5" /> {L('导出年鉴 HTML', 'Export yearbook HTML')}</Button>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
        {[
          { label: L('年榜机会', 'Year-ranked'), value: yearItems.length, hint: L('year 窗口', 'year window') },
          { label: L('A 级/≥75', 'A-grade / ≥75'), value: aGrade.length, hint: L('高分机会', 'high-score opportunities') },
          { label: L('年榜第 1 名总分', 'Rank 1 total'), value: fmtScore(top20[0]?.scores.total), hint: L('year 窗口 rank 1', 'year window rank 1'), title: L('年榜第 1 名机会的总分（rank1.total），不是全部机会的最高分。', 'Total score of the rank-1 opportunity in the yearly ranking (rank1.total), not the max across all opportunities.') },
          { label: L('年度最高总分', 'Year max total'), value: fmtScore(maxTotalOverall), hint: L('全部机会 max(total)', 'max(total) across all opportunities'), title: L('全部机会中的最高总分（max(total)），可能来自未进入年榜 Top20 的机会。', 'Highest total across all opportunities (max(total)); it may come from an opportunity outside the yearly Top 20.') },
          { label: L('关闭/≤3 月', 'Closed / ≤3 mo'), value: closing.length, hint: L('窗口风险', 'window risk') },
          { label: L('覆盖行业', 'Industries'), value: distributions.byIndustry.length, hint: L('行业数', 'industry count') },
          { label: L('覆盖区域', 'Regions'), value: distributions.byRegion.length, hint: L('区域数', 'region count') },
        ].map((s) => (
          <Panel key={s.label} className="px-3 py-2" title={(s as { title?: string }).title}>
            <div className="mono-label">{s.label}</div>
            <div className="num mt-0.5 text-[19px] font-semibold text-ink">{s.value}</div>
            <div className="mt-0.5 text-[9.5px] text-dim">{s.hint}</div>
          </Panel>
        ))}
      </div>

      <div className="mb-3 rounded border border-line/60 bg-white/[0.015] px-3 py-1.5 text-[9.5px] leading-relaxed text-dim">
        {L('「年榜第 1 名总分」取 data/rankings.json year 窗口 rank1.total；「年度最高总分」取所有机会 max(total)，两者口径不同，可能来自不同机会（悬停卡片可看说明）。', '“Rank 1 total” uses rank1.total from data/rankings.json (year window); “Year max total” uses max(total) across all opportunities. They may refer to different opportunities (hover a card for details).')}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <SectionCard className="xl:col-span-7" eyebrow="TIMELINE" title={L('月度时间线', 'Monthly timeline')} subtitle={L('按 activity_dates 聚合新信号；主题取当月 top 2', 'Signals by activity_dates; top 2 themes per month')} right={<Globe2 className="h-4 w-4 text-dim" />}>
          <Chart option={timelineOption} height={250} />
          <div className="mt-2 overflow-x-auto">
            <table className="table-dense min-w-[620px]">
              <thead><tr><th>{L('月份', 'Month')}</th><th className="text-right">{L('新信号', 'Signals')}</th><th>{L('主题', 'Themes')}</th></tr></thead>
              <tbody>
                {monthly.map((x) => (
                  <tr key={x.month}><td className="font-mono">{year}-{x.month}</td><td className="num text-right">{x.count}</td><td className="text-[10px] text-dim">{x.themes.join(' / ') || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-5" eyebrow="INDUSTRY" title={L('行业分布', 'Industry distribution')} subtitle={L('按年榜机会的行业归属计数', 'Year-ranked opportunities by industry')}>
          <Chart option={industryOption} height={250} />
          <div className="mt-1 flex flex-wrap gap-1">
            {distributions.byIndustry.slice(0, 10).map((x) => (
              <span key={x[0]} className="rounded border border-line px-1.5 py-0.5 text-[9.5px] text-dim">{x[0]} · {x[1]}</span>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-8" eyebrow="GRADE / REGION / GAP" title={L('等级 / 区域 / 信息差分布', 'Grade / region / gap distributions')}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { title: L('等级', 'Grade'), rows: distributions.byGrade },
              { title: L('区域', 'Region'), rows: distributions.byRegion.slice(0, 8) },
              { title: L('信息差', 'Gap type'), rows: distributions.byGap.slice(0, 8) },
            ].map((block) => (
              <div key={block.title}>
                <div className="mono-label mb-1">{block.title}</div>
                <div className="space-y-1">
                  {block.rows.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="truncate text-muted">{name}</span>
                      <span className="num text-dim">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded border border-line/60 bg-black/15 px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
            {L('年榜口径来自 data/rankings.json（year 窗口）；本页不重算榜单，只做年度聚合与导出。', 'Year ranking comes from data/rankings.json (year window); this page only aggregates and exports, never re-ranks.')}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
            <Link to="/rankings?w=year" className="inline-flex items-center gap-1 text-signal hover:underline">{L('查看年榜', 'View year ranking')} <ArrowUpRight className="h-3 w-3" /></Link>
            <span className="text-dim">·</span>
            <span className="text-dim">python scanner/yearbook.py --year {year}</span>
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-5" eyebrow="MONTHLY GRADE" title={L('月度等级分布', 'Monthly grade distribution')} subtitle={L('按 activity_dates 统计每月新信号的 S/A/B/C 构成', 'S/A/B/C mix of monthly signals by activity_dates')}>
          <Chart option={gradeOption} height={230} />
        </SectionCard>

        <SectionCard className="xl:col-span-7" eyebrow="GAP HEAT" title={L('信息差类型热度', 'Gap-type heatmap')} subtitle={L('每月 top 信息差类型的信号数（数字越大越热）', 'Monthly signal counts by top gap type (higher is hotter)')}>
          {gapHeat.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full border-collapse text-[9px]">
                <thead><tr><th className="p-1 text-left text-dim">{L('信息差', 'Gap')}</th>{MONTH_LABELS.map((m) => <th key={m} className="p-1 text-center font-mono text-dim">{m}</th>)}</tr></thead>
                <tbody>
                  {gapHeat.map((row) => (
                    <tr key={row.gap}>
                      <td className="max-w-[130px] truncate p-1 text-muted">{row.gap}</td>
                      {row.values.map((v, i) => (
                        <td key={`${row.gap}-${i}`} className="p-0.5 text-center">
                          <span className="inline-flex h-5 w-full min-w-[18px] items-center justify-center rounded-sm font-mono" style={{ background: v ? `rgba(61,220,151,${Math.min(0.85, 0.12 + v * 0.18)})` : 'rgba(255,255,255,0.02)', color: v > 2 ? '#0b1117' : '#8b93a7' }}>{v || '·'}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="text-[10px] text-dim">{L('暂无足够信息差活动数据', 'Not enough gap activity data')}</div>}
        </SectionCard>

        <SectionCard className="xl:col-span-7" eyebrow="WINDOW DECAY" title={L('窗口衰减统计', 'Window decay stats')} subtitle={L('按窗口状态与剩余窗口（months_left）分桶', 'By window status and remaining months buckets')}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {windowStats.byStatus.map((x) => (
              <div key={x.status} className="rounded border border-line/70 px-2 py-1.5">
                <div className="mono-label">{x.status}</div>
                <div className="num text-[15px] text-ink">{x.count}</div>
                <div className="h-1.5 rounded bg-panel-2"><div className="h-1.5 rounded bg-signal" style={{ width: `${yearItems.length ? (x.count / yearItems.length) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {windowStats.buckets.map((b) => (
              <div key={b.label} className="rounded border border-line/60 px-1.5 py-1 text-center">
                <div className="font-mono text-[9px] text-dim">{b.label}</div>
                <div className="num text-[13px] text-muted">{b.count}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[9px] leading-relaxed text-dim">{L('窗口衰减口径来自 opportunities.window（status / months_left）；关闭/≤3 月机会进入年度风险清单。', 'Window decay uses opportunities.window (status / months_left); closed/≤3-month opportunities enter the risk list.')}</div>
        </SectionCard>

        <SectionCard className="xl:col-span-5" eyebrow="EXPERIMENT FUNNEL" title={L('实验漏斗', 'Experiment funnel')} subtitle={L('从本机实验记录统计，不读取后端报告', 'Computed from local experiments; backend reports are not read')}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: L('实验总数', 'Total'), value: experimentStats.total, color: '#cdd6e5' },
              { label: L('进行中', 'Active'), value: experimentStats.active, color: '#4cc9f0' },
              { label: L('已结案', 'Closed'), value: experimentStats.closed, color: '#a78bfa' },
              { label: L('成功率', 'Success rate'), value: `${experimentStats.successRate}%`, color: '#ffd166' },
            ].map((x) => (
              <div key={x.label} className="rounded border border-line/70 px-2 py-1.5">
                <div className="mono-label">{x.label}</div>
                <div className="num text-[17px] font-semibold" style={{ color: x.color }}>{x.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            {[
              { label: L('正向', 'Positive'), value: experimentStats.positive, color: '#3ddc97' },
              { label: L('负向', 'Negative'), value: experimentStats.negative, color: '#ff5d5d' },
              { label: L('不明确', 'Inconclusive'), value: experimentStats.inconclusive, color: '#8b93a7' },
            ].map((x) => (
              <div key={x.label} className="rounded border border-line/60 px-1.5 py-1">
                <div className="font-mono text-[9px] text-dim">{x.label}</div>
                <div className="num text-[13px]" style={{ color: x.color }}>{x.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[9px] leading-relaxed text-dim">{L('成功率 = 正向 / (正向 + 负向)，不明确不计入分母；实验数据仅存本机。', 'Success rate = positive / (positive + negative), inconclusive excluded; experiments stay local.')}</div>
        </SectionCard>

        <SectionCard className="xl:col-span-4" eyebrow="A GRADE / CLOSING" title={L('A 级清单与窗口风险', 'A-grade list & window risk')}>
          <div className="max-h-[240px] space-y-1 overflow-auto">
            {aGrade.slice(0, 12).map((o) => (
              <Link key={o.id} to={`/opportunities/${o.id}`} className="flex items-center gap-2 rounded border border-line/60 px-2 py-1 text-[10.5px] hover:border-line-strong">
                <Badge tone="signal">{o.scores.grade}</Badge>
                <span className="num text-muted">{fmtScore(o.scores.total)}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{o.title}</span>
              </Link>
            ))}
          </div>
          <div className="mt-2 border-t border-line/70 pt-2">
            <div className="mono-label mb-1">{L('关闭 / ≤3 个月', 'Closed / ≤3 months')}</div>
            {closing.length ? closing.slice(0, 8).map((o) => (
              <div key={o.id} className="flex items-center gap-2 py-0.5 text-[10px]">
                <span className={cn('h-1.5 w-1.5 rounded-full', o.window.months_left <= 0 ? 'bg-danger' : 'bg-amber')} />
                <span className="min-w-0 flex-1 truncate text-muted">{o.title}</span>
                <span className="font-mono text-dim">{o.window.status} · {o.window.months_left}M</span>
              </div>
            )) : <div className="text-[10px] text-dim">{L('没有即将关闭的窗口', 'No closing windows')}</div>}
          </div>
          <div className="mt-2 rounded border border-amber/25 bg-amber/[0.05] px-2 py-1.5 text-[9.5px] leading-relaxed text-amber">
            <ShieldCheck className="mb-0.5 inline h-3 w-3" /> {L('后端可生成自包含可打印年鉴；实验摘要可用 --experiments 传入前端导出 JSON。', 'Backend can generate a self-contained printable yearbook; pass an experiments JSON with --experiments for the experiment summary.')}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
