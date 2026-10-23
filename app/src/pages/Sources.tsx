import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import { Activity, CloudOff, Database, ExternalLink, Filter, Search, ShieldCheck } from 'lucide-react'
import { Chart } from '@/components/charts/Chart'
import { PageHeader } from '@/components/PageHeader'
import { Badge, EmptyState, Panel, ProgressBar, SectionCard } from '@/components/ui'
import { allSources, getSourceHealth, regionName, sourceHealth, sources } from '@/lib/data'
import {
  ACCESS_LABEL,
  cn,
  COMPLIANCE_HEX,
  COMPLIANCE_LABEL,
  COST_LABEL,
  fmtScore,
  FREQUENCY_LABEL,
} from '@/lib/utils'
import type { Compliance } from '@/types'

const LEGEND = [
  { id: 'green', label: '绿 · 公开且明确允许', desc: '可稳定采集，遵守 robots 与频率限制' },
  { id: 'yellow', label: '黄 · 灰区需限速', desc: '抓取前读 ToS，控制频率，优先官方接口' },
  { id: 'red', label: '红 · 不建议自动抓取', desc: '仅人工浏览，不绕过登录/付费墙' },
] as const

function SourceHealthCell({ source }: { source: { id: string; url?: string; name?: string } }) {
  const sh = getSourceHealth(source)
  if (!sourceHealth.available || !sh) return <span className="text-[9.5px] text-dim">—</span>
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', sh.ok ? 'bg-signal' : 'bg-danger')} />
        <span className={cn('font-mono text-[9.5px]', sh.ok ? 'text-muted' : 'text-danger')}>{sh.ok ? 'OK' : 'FAIL'}</span>
        <span className="font-mono text-[9px] text-dim">{sh.mode || '—'}</span>
        {sh.latency_ms != null && <span className="font-mono text-[9px] text-dim">{sh.latency_ms}ms</span>}
        {sh.cached && <span className="font-mono text-[8.5px] text-cyan">cached</span>}
      </div>
      {!sh.ok && (
        <div className="mt-0.5 truncate font-mono text-[8.5px] text-danger/80" title={String(sh.error || '')}>
          {String(sh.error || '失败')}
        </div>
      )}
      {sh.ok && sh.http_status != null && <div className="font-mono text-[8.5px] text-dim">HTTP {sh.http_status} · {sh.items ?? 0} items</div>}
    </div>
  )
}

export default function Sources() {
  const [query, setQuery] = useState('')
  const [compliance, setCompliance] = useState<'all' | Compliance>('all')
  const [category, setCategory] = useState<string>('all')

  const counts = useMemo(() => {
    return {
      total: allSources.length,
      green: allSources.filter((s) => s.compliance === 'green').length,
      yellow: allSources.filter((s) => s.compliance === 'yellow').length,
      red: allSources.filter((s) => s.compliance === 'red').length,
      highValue: allSources.filter((s) => s.value_score >= 8.5).length,
    }
  }, [])

  const unmatchedHealthCount = useMemo(() => {
    if (!sourceHealth.available) return 0
    const matched = new Set(allSources.map((s) => getSourceHealth(s)?.id).filter(Boolean))
    return sourceHealth.sources.filter((sh) => !matched.has(sh.id)).length
  }, [])

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sources.categories
      .filter((c) => category === 'all' || c.id === category)
      .map((c) => {
        const list = c.sources.filter((s) => {
          if (compliance !== 'all' && s.compliance !== compliance) return false
          if (!q) return true
          return [s.name, s.notes, s.url, ...s.regions, ...s.signal_types].join(' ').toLowerCase().includes(q)
        })
        return { ...c, sources: list }
      })
      .filter((c) => c.sources.length > 0)
  }, [query, compliance, category])

  const heatOption = useMemo<EChartsOption>(() => {
    const categories = sources.categories
    const regions = [...new Set(allSources.flatMap((s) => s.regions))].map((id) => ({ id, name: regionName(id) }))
    const countsMap = new Map<string, number>()
    for (const s of allSources) {
      for (const r of s.regions) {
        for (const c of categories) {
          if (c.sources.some((x) => x.id === s.id)) {
            const k = `${r}|${c.id}`
            countsMap.set(k, (countsMap.get(k) || 0) + 1)
          }
        }
      }
    }
    const cells: Array<[number, number, number]> = []
    let max = 1
    regions.forEach((r, ri) => {
      categories.forEach((c, ci) => {
        const v = countsMap.get(`${r.id}|${c.id}`) || 0
        max = Math.max(max, v)
        cells.push([ci, ri, v])
      })
    })
    return {
      grid: { left: 8, right: 8, top: 10, bottom: 30, containLabel: true },
      tooltip: { formatter: (p: any) => `${regions[p.value[1]]?.name || ''} × ${categories[p.value[0]]?.name || ''}<br/>数据源数量：<b>${p.value[2]}</b>` },
      xAxis: { type: 'category', data: categories.map((c) => c.name.slice(0, 4)), axisLabel: { fontSize: 8.5, interval: 0, rotate: 32 } },
      yAxis: { type: 'category', data: regions.map((r) => r.name), axisLabel: { fontSize: 9 } },
      visualMap: { show: false, min: 0, max, inRange: { color: ['#131821', '#173c33', '#21795d', '#3ddc97'] } },
      series: [
        {
          type: 'heatmap',
          data: cells,
          label: { show: true, fontSize: 8.5, color: '#c8cfdb', formatter: (p: any) => (p.value[2] ? p.value[2] : '') },
          itemStyle: { borderColor: '#0a0c10', borderWidth: 1 },
        },
      ],
    }
  }, [])

  const categoryChartOption = useMemo<EChartsOption>(() => {
    const data = sources.categories.map((c) => ({ name: c.name, count: c.sources.length, avg: c.sources.length ? c.sources.reduce((a, s) => a + s.value_score, 0) / c.sources.length : 0 }))
    return {
      grid: { left: 4, right: 10, top: 26, bottom: 4, containLabel: true },
      legend: { top: 0, right: 0, data: ['源数量', '平均价值分'], textStyle: { fontSize: 9 } },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: data.map((d) => d.name.slice(0, 4)), axisLabel: { fontSize: 8.5, interval: 0, rotate: 32 } },
      yAxis: [
        { type: 'value', name: '源', nameTextStyle: { fontSize: 8, color: '#5a6273' } },
        { type: 'value', name: '分', min: 0, max: 10, nameTextStyle: { fontSize: 8, color: '#5a6273' }, splitLine: { show: false } },
      ],
      series: [
        { name: '源数量', type: 'bar', data: data.map((d) => d.count), barMaxWidth: 14, itemStyle: { color: 'rgba(76,201,240,.55)', borderRadius: [2, 2, 0, 0] } },
        { name: '平均价值分', type: 'line', yAxisIndex: 1, data: data.map((d) => Number(d.avg.toFixed(1))), symbolSize: 4, lineStyle: { color: '#ffb547', width: 1.5 }, itemStyle: { color: '#ffb547' } },
      ],
    }
  }, [])

  return (
    <div>
      <PageHeader
        index="06"
        kicker="SOURCES · 数据源矩阵"
        title="数据源矩阵 · 12 大类平台"
        description="所有信息源按「需求 / 趋势 / 电商 / 社媒 / 政策 / 资本 / 学术 / 供应链 / 文化 / 人才 / 数据 / 平台生态」12 大类整理；标注访问方式、频率、成本、合规色与价值分，是扫描室的上游。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal"><Database className="h-3 w-3" /> {counts.total} 个平台</Badge>
            <Badge tone="cyan"><ShieldCheck className="h-3 w-3" /> 高价值 {counts.highValue}</Badge>
            <Badge tone="neutral">{sources.categories.length} 大类</Badge>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          { label: '平台总数', value: counts.total, color: '#3ddc97', unit: '个' },
          { label: '绿 · 可稳定采集', value: counts.green, color: '#3ddc97', unit: '个' },
          { label: '黄 · 灰区限速', value: counts.yellow, color: '#ffb547', unit: '个' },
          { label: '红 · 仅人工浏览', value: counts.red, color: '#ff5d5d', unit: '个' },
        ].map((s) => (
          <Panel key={s.label} className="px-3 py-2">
            <div className="mono-label">{s.label}</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="num text-[20px] font-semibold leading-none" style={{ color: s.color }}>{s.value}</span>
              <span className="text-[9.5px] text-dim">{s.unit}</span>
            </div>
          </Panel>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2 rounded-md border border-line bg-panel/60 p-2 lg:flex-row lg:items-center">
        <div className="flex h-7 flex-1 items-center gap-2 rounded border border-line bg-panel-2 px-2">
          <Search className="h-3.5 w-3.5 text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索平台名称 / 备注 / 区域…"
            className="w-full bg-transparent text-[11.5px] outline-none placeholder:text-dim"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="h-3 w-3 text-dim" />
          <button
            onClick={() => setCompliance('all')}
            className={cn('rounded border px-1.5 py-0.5 text-[10.5px]', compliance === 'all' ? 'border-signal/45 bg-signal/10 text-signal' : 'border-line text-muted')}
          >
            全部合规色
          </button>
          {LEGEND.map((l) => (
            <button
              key={l.id}
              onClick={() => setCompliance(compliance === l.id ? 'all' : l.id)}
              className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px]', compliance === l.id ? 'border-line-strong bg-white/[0.06] text-ink' : 'border-line text-muted')}
              title={l.desc}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: COMPLIANCE_HEX[l.id] }} />
              {l.label.split(' · ')[0]}
            </button>
          ))}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-7 rounded border border-line bg-panel-2 px-1.5 text-[10.5px] text-muted outline-none"
          aria-label="数据源分类筛选"
        >
          <option value="all">全部分类</option>
          {sources.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <SectionCard
          className="xl:col-span-7"
          eyebrow="REGION × CATEGORY"
          title="区域 × 类别覆盖热力"
          subtitle="某区域在某大类下可用数据源数量；空白=该区域缺少该类型源"
          right={<Badge tone="muted">11 区域 × 12 类</Badge>}
        >
          <Chart option={heatOption} height={300} />
        </SectionCard>
        <SectionCard
          className="xl:col-span-5"
          eyebrow="CATEGORY OVERVIEW"
          title="分类数量与平均价值"
          subtitle="柱 = 源数量 · 线 = 平均价值分"
          right={<Database className="h-4 w-4 text-dim" />}
        >
          <Chart option={categoryChartOption} height={300} />
        </SectionCard>
      </div>

      <Panel className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        {sourceHealth.available ? (
          <>
            <Activity className="h-4 w-4 text-signal" />
            <span className="text-[11px] text-muted">
              在线采集健康：<span className="num text-signal">{sourceHealth.ok_count}/{sourceHealth.total} ok</span>
              <span className="ml-2 font-mono text-[10px] text-dim">mode {sourceHealth.mode || '—'}</span>
              <span className="ml-2 font-mono text-[10px] text-dim">{sourceHealth.checked_at || '—'}</span>
            </span>
            {sourceHealth.fail_count > 0 && <Badge tone="danger">失败 {sourceHealth.fail_count} 个 · 见 About/预警中心</Badge>}
            {unmatchedHealthCount > 0 && <Badge tone="amber">{unmatchedHealthCount} 源未匹配矩阵</Badge>}
            <span className="ml-auto flex items-center gap-2 text-[10px]">
              <span className="text-dim">v2 字段：mode / latency / cached / error / checked_at；id 变化时按 url/name 兼容</span>
              <Link to="/alerts" className="text-muted hover:text-signal">查看预警 →</Link>
            </span>
          </>
        ) : (
          <>
            <CloudOff className="h-4 w-4 text-dim" />
            <span className="text-[11px] text-muted">
              离线模式：未运行在线采集（<span className="font-mono text-dim">data/source-health.json</span> 可选缺失）；下表为静态数据源矩阵。
            </span>
            <span className="ml-auto text-[10px] text-dim">运行 <span className="font-mono">python scanner/pipeline.py --fetch</span> 后显示实测健康</span>
          </>
        )}
      </Panel>

      <Panel className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2">
        <span className="mono-label">合规色图例</span>
        {LEGEND.map((l) => (
          <span key={l.id} className="inline-flex items-center gap-1.5 text-[10.5px]">
            <span className="h-2 w-2 rounded-full" style={{ background: COMPLIANCE_HEX[l.id] }} />
            <span style={{ color: COMPLIANCE_HEX[l.id] }}>{l.label}</span>
            <span className="text-dim">— {l.desc}</span>
          </span>
        ))}
      </Panel>

      {!filteredCategories.length && (
        <EmptyState title="没有匹配的数据源" hint="尝试清空搜索词或切换合规色 / 分类筛选。" />
      )}

      <div className="space-y-3">
        {filteredCategories.map((c, idx) => {
          const avg = c.sources.length ? c.sources.reduce((a, s) => a + s.value_score, 0) / c.sources.length : 0
          return (
            <SectionCard
              key={c.id}
              dense
              eyebrow={`CATEGORY ${String(idx + 1).padStart(2, '0')}`}
              title={
                <span className="flex items-center gap-2">
                  {c.name}
                  <Badge tone="muted">{c.sources.length} 源</Badge>
                  <Badge tone="cyan">价值均值 {fmtScore(avg)}</Badge>
                </span>
              }
              subtitle={c.desc}
              bodyClassName="p-0"
            >
              <div className="overflow-x-auto">
                <table className="table-dense min-w-[1100px]">
                  <thead>
                    <tr>
                      <th className="w-44">名称</th>
                      <th className="w-40">区域</th>
                      <th className="w-20">访问方式</th>
                      <th className="w-16">频率</th>
                      <th className="w-20">成本</th>
                      <th className="w-24">合规色</th>
                      <th className="w-24">价值分</th>
                      <th className="w-36">在线健康</th>
                      <th>备注 / 采集要点</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.sources.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <a href={s.url} target="_blank" rel="noreferrer noopener" className="group inline-flex items-center gap-1 text-[11.5px] text-ink hover:text-signal">
                            {s.name}
                            <ExternalLink className="h-2.5 w-2.5 text-dim group-hover:text-cyan" />
                          </a>
                          <div className="font-mono text-[9px] text-dim">{s.id}</div>
                        </td>
                        <td className="text-[10px] text-muted">{s.regions.map(regionName).join(' / ') || '—'}</td>
                        <td><Badge tone="neutral">{ACCESS_LABEL[s.access] || s.access}</Badge></td>
                        <td className="text-[10px] text-muted">{FREQUENCY_LABEL[s.frequency] || s.frequency}</td>
                        <td className="text-[10px] text-muted">{COST_LABEL[s.cost] || s.cost}</td>
                        <td>
                          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: COMPLIANCE_HEX[s.compliance] }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: COMPLIANCE_HEX[s.compliance] }} />
                            {COMPLIANCE_LABEL[s.compliance] || s.compliance}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <ProgressBar value={s.value_score} max={10} className="w-12" tone={s.value_score >= 8.5 ? 'signal' : 'cyan'} />
                            <span className="num text-[10px] text-muted">{fmtScore(s.value_score)}</span>
                          </div>
                        </td>
                        <td><SourceHealthCell source={s} /></td>
                        <td className="max-w-[460px] text-[10px] leading-relaxed text-dim">{s.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )
        })}
      </div>
    </div>
  )
}
