import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import {
  Activity,
  ChevronRight,
  Clock3,
  Database,
  FlaskConical,
  Gauge,
  Layers3,
  PlayCircle,
  Radar,
  ScanLine,
  ShieldAlert,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react'
import { Chart } from '@/components/charts/Chart'
import { PageHeader } from '@/components/PageHeader'
import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  EmptyState,
  GradeBadge,
  Panel,
  ProgressBar,
  SectionCard,
} from '@/components/ui'
import {
  allSources,
  gapHalfLife,
  gapName,
  industryColor,
  industryName,
  lookups,
  opportunities,
  playbooks,
  sources,
  taxonomy,
} from '@/lib/data'
import {
  ACCESS_LABEL,
  CAL_TYPE_LABEL,
  cn,
  COMPLIANCE_HEX,
  COMPLIANCE_LABEL,
  COST_LABEL,
  FREQUENCY_LABEL,
  GAP_SIGNAL_MAP,
  SIGNAL_GAP_MAP,
  SIGNAL_TYPES,
  fmtScore,
} from '@/lib/utils'
import type { Opportunity, Source } from '@/types'

const SCAN_STEPS = [
  { title: '读取数据源矩阵', desc: '加载 12 大类平台与健康度状态' },
  { title: '拉取需求信号', desc: '按人性需求 × 信号类型匹配候选' },
  { title: '扣除噪声与重复', desc: '过滤营销稿、单一来源与过期窗口' },
  { title: '重算评分与动量', desc: '按 10 维权重与 rank_score 公式评分' },
  { title: '生成候选清单', desc: '输出待人工复核的扫描结果' },
]

const HEALTH_META: Record<string, { label: string; tone: 'signal' | 'amber' | 'danger'; desc: string }> = {
  green: { label: '健康', tone: 'signal', desc: '公开且明确允许，可稳定采集' },
  yellow: { label: '注意', tone: 'amber', desc: '灰区，需限速并遵守 ToS' },
  red: { label: '受限', tone: 'danger', desc: '不建议自动抓取，仅人工浏览' },
}

function ScanConsole() {
  const [state, setState] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [step, setStep] = useState(0)
  const [results, setResults] = useState<Array<{ opp: Opportunity; reason: string; score: number }>>([])
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [])

  const start = () => {
    if (state === 'scanning') return
    setState('scanning')
    setStep(0)
    setResults([])
    let i = 0
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      i += 1
      setStep(i)
      if (i >= SCAN_STEPS.length) {
        if (timerRef.current) window.clearInterval(timerRef.current)
        const pool = [...opportunities].sort((a, b) => b.momentum - a.momentum || b.rank_score - a.rank_score)
        const picked = pool.slice(0, 4).map((opp, idx) => {
          const gap = opp.gap_type_ids[0]
          const sourceCat = gap ? Object.entries(SIGNAL_GAP_MAP).find(([, gaps]) => gaps.includes(gap))?.[0] : undefined
          const catName = sourceCat ? sources.categories.find((c) => c.id === sourceCat)?.name : '综合来源'
          const need = opp.human_need_ids[0] ? lookups.needs.get(opp.human_need_ids[0])?.name : '需求'
          return {
            opp,
            reason: `${catName || '综合来源'} 出现「${need || '需求'}」高频信号，命中「${gapName(gap || '')}」窗口；同源噪声已剔除，建议人工复核。`,
            score: Math.min(100, opp.scores.total + (idx % 2 === 0 ? 1.2 : -0.8)),
          }
        })
        setResults(picked)
        setState('done')
      }
    }, 460)
  }

  return (
    <Panel className="accent-top overflow-hidden" style={{ ['--accent' as any]: '#4cc9f0' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan" />
          <span className="text-[13px] font-semibold">模拟扫描控制台</span>
          <Badge tone="amber">纯前端演示 · 无网络请求</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-dim">
            {state === 'idle' ? 'STANDBY' : state === 'scanning' ? `RUNNING ${step}/${SCAN_STEPS.length}` : 'COMPLETE'}
          </span>
          <button
            onClick={start}
            disabled={state === 'scanning'}
            className="inline-flex h-7 items-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 px-3 text-[11.5px] text-cyan transition-colors hover:bg-cyan/20 disabled:opacity-50"
          >
            {state === 'scanning' ? <Activity className="h-3.5 w-3.5 animate-pulse" /> : <PlayCircle className="h-3.5 w-3.5" />}
            {state === 'scanning' ? '扫描中…' : state === 'done' ? '重新扫描' : '开始模拟扫描'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-12">
        <div className="border-b border-line/70 p-3.5 lg:col-span-4 lg:border-b-0 lg:border-r">
          <div className="mono-label mb-2">PIPELINE / 扫描步骤</div>
          <div className="space-y-2">
            {SCAN_STEPS.map((s, i) => {
              const done = state !== 'idle' && step > i
              const active = state === 'scanning' && step === i
              return (
                <div key={s.title} className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border font-mono text-[8.5px]',
                      done ? 'border-signal/60 bg-signal/15 text-signal' : active ? 'border-cyan/60 bg-cyan/15 text-cyan' : 'border-line text-dim',
                    )}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className={cn('text-[11.5px]', done ? 'text-muted' : active ? 'text-cyan' : 'text-dim')}>{s.title}</div>
                    <div className="text-[9.5px] leading-snug text-dim">{s.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 border-t border-line/60 pt-2 font-mono text-[9.5px] leading-relaxed text-dim">
            候选池：{opportunities.length} 机会 · {allSources.length} 数据源
            <br />
            全部在浏览器内完成，不发起任何外部请求。
          </div>
        </div>
        <div className="p-3.5 lg:col-span-8">
          <div className="mb-2 flex items-center justify-between">
            <div className="mono-label">SCAN RESULTS / 扫描结果</div>
            {state === 'done' && <Badge tone="signal">{results.length} 条候选</Badge>}
          </div>
          {state === 'idle' && (
            <div className="flex min-h-[190px] flex-col items-center justify-center gap-2 rounded border border-dashed border-line text-center">
              <Radar className="h-7 w-7 text-dim" />
              <div className="text-[12px] text-muted">点击「开始模拟扫描」生成示例候选</div>
              <div className="max-w-[420px] text-[10.5px] leading-relaxed text-dim">
                演示会按动量排序挑选 4 条机会并生成「信号来源 → 信息差 → 建议」说明；结果仅供界面演示，不改变真实榜单。
              </div>
            </div>
          )}
          {state === 'scanning' && (
            <div className="flex min-h-[190px] flex-col justify-center gap-3 rounded border border-line/70 bg-black/20 px-4">
              <div className="flex items-center gap-2 font-mono text-[11px] text-cyan">
                <ScanLine className="h-4 w-4 animate-pulse" /> 正在扫描 {SIGNAL_STEPS_NAME[Math.min(step, SCAN_STEPS.length - 1)]}…
              </div>
              <ProgressBar value={step} max={SCAN_STEPS.length} tone="cyan" />
              <div className="font-mono text-[9.5px] text-dim">{[...Array(Math.min(6, step + 2))].map(() => '█████').join(' ')}</div>
            </div>
          )}
          {state === 'done' && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {results.map((r) => (
                <Link
                  key={r.opp.id}
                  to={`/opportunities/${r.opp.id}`}
                  className="rounded border border-line/80 bg-white/[0.015] p-2.5 transition-colors hover:border-cyan/40"
                >
                  <div className="flex items-center gap-1.5">
                    <GradeBadge grade={r.opp.scores.grade} />
                    <span className="truncate text-[11.5px] font-medium text-ink">{r.opp.title}</span>
                    <span className="num ml-auto text-[11px] text-cyan">{fmtScore(r.score)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-dim">{r.reason}</p>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[9px] text-dim">
                    <span>{industryName(r.opp.industry_id)}</span>
                    <span>·</span>
                    <span>{gapName(r.opp.gap_type_ids[0] || '')}</span>
                    <span className="ml-auto text-amber">MOM ×{r.opp.momentum.toFixed(1)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}

const SIGNAL_STEPS_NAME = ['数据源矩阵', '需求信号', '去噪', '评分', '候选清单']

function PlaybookCard({ pb, index, open, onToggle }: { pb: typeof playbooks[number]; index: number; open: boolean; onToggle: () => void }) {
  const needs = pb.human_need_ids.map((id) => lookups.needs.get(id)?.name || id)
  const emotions = pb.emotion_ids.map((id) => lookups.emotions.get(id)?.name || id)
  return (
    <Collapsible open={open} onOpenChange={onToggle} className={cn('panel transition-colors', open && 'border-line-strong bg-panel-2/60')}>
      <div className="p-3">
        <CollapsibleTrigger open={open} className="items-start">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line bg-panel-2 font-mono text-[10px] text-signal">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12.5px] font-medium text-ink">{pb.name}</span>
                <Badge tone="amber"><Clock3 className="h-2.5 w-2.5" /> {pb.time_box_min} min</Badge>
                <Badge tone="muted">{pb.frequency}</Badge>
              </div>
              <div className="mt-0.5 line-clamp-1 text-[10.5px] text-dim">{pb.purpose}</div>
            </div>
          </div>
        </CollapsibleTrigger>
        <div className="mt-2 flex flex-wrap gap-1">
          {needs.map((n) => <span key={n} className="rounded border border-line/70 px-1.5 py-0.5 text-[9.5px] text-muted">{n}</span>)}
          {emotions.map((n) => <span key={n} className="rounded px-1.5 py-0.5 font-mono text-[9px] text-dim">#{n}</span>)}
        </div>
      </div>
      <CollapsibleContent>
        <div className="border-t border-line/70 px-3 py-2.5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="mono-label mb-1">STEPS / 操作步骤</div>
              <ol className="space-y-1">
                {pb.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted">
                    <span className="mt-0.5 font-mono text-[8.5px] text-signal">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="space-y-2">
              <div>
                <div className="mono-label mb-1">PLATFORMS / 平台</div>
                <div className="flex flex-wrap gap-1">
                  {pb.platforms.map((p) => (
                    <span key={p} className="rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[9px] text-muted">{p}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="mono-label mb-1">KEYWORDS / 关键词</div>
                <div className="flex flex-wrap gap-1">
                  {pb.keywords.map((k) => (
                    <span key={k} className="rounded bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-dim">{k}</span>
                  ))}
                </div>
              </div>
              <div className="rounded border border-line/60 bg-black/20 px-2 py-1.5">
                <div className="mono-label mb-0.5">OUTPUT</div>
                <div className="text-[10.5px] leading-relaxed text-muted">{pb.output}</div>
              </div>
            </div>
          </div>
          <div className="mt-2 border-t border-line/60 pt-2">
            <div className="mono-label mb-1">QUALITY CHECKS / 质检点</div>
            <div className="flex flex-wrap gap-1.5">
              {pb.quality_checks.map((q) => (
                <span key={q} className="inline-flex items-center gap-1 rounded border border-signal/20 bg-signal/[0.05] px-1.5 py-0.5 text-[9.5px] text-signal/90">
                  ✓ {q}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function Scanner() {
  const [openPlaybook, setOpenPlaybook] = useState<string | null>(playbooks[0]?.id || null)
  const [sourceCategory, setSourceCategory] = useState('all')
  const [sourceCompliance, setSourceCompliance] = useState('all')

  const heatOption = useMemo<EChartsOption>(() => {
    const needs = taxonomy.human_needs
    const signals = SIGNAL_TYPES
    const counts = new Map<string, number>()
    const examples = new Map<string, string[]>()
    for (const o of opportunities) {
      for (const need of o.human_need_ids) {
        for (const gap of o.gap_type_ids) {
          const sig = GAP_SIGNAL_MAP[gap] || 'complaint'
          const key = `${need}|${sig}`
          counts.set(key, (counts.get(key) || 0) + 1)
          const list = examples.get(key) || []
          if (list.length < 2) list.push(o.title)
          examples.set(key, list)
        }
      }
    }
    let max = 1
    const cells: Array<[number, number, number]> = []
    needs.forEach((n, ni) => {
      signals.forEach((s, si) => {
        const v = counts.get(`${n.id}|${s.id}`) || 0
        max = Math.max(max, v)
        cells.push([si, ni, v])
      })
    })
    return {
      grid: { left: 6, right: 10, top: 34, bottom: 4, containLabel: true },
      tooltip: {
        formatter: (p: any) => {
          const n = needs[p.value[1]]
          const s = signals[p.value[0]]
          const ex = examples.get(`${n.id}|${s.id}`) || []
          return `<b>${n?.name || ''} × ${s?.name || ''}</b><br/>信号命中：<b>${p.value[2]}</b>${
            ex.length ? `<br/><span style="color:#8b93a7">例：${ex.join('；')}</span>` : ''
          }`
        },
      },
      xAxis: { type: 'category', data: signals.map((s) => s.name), axisLabel: { fontSize: 10, interval: 0 } },
      yAxis: { type: 'category', data: needs.map((n) => n.name), axisLabel: { fontSize: 9.5 } },
      visualMap: { show: false, min: 0, max, inRange: { color: ['#131821', '#173c33', '#21795d', '#3ddc97'] } },
      series: [
        {
          type: 'heatmap',
          data: cells,
          label: { show: true, fontSize: 9, color: '#c8cfdb', formatter: (p: any) => (p.value[2] ? p.value[2] : '') },
          itemStyle: { borderColor: '#0a0c10', borderWidth: 1 },
          emphasis: { itemStyle: { borderColor: '#e6e9f0', borderWidth: 1 } },
        },
      ],
    }
  }, [])

  const sankeyOption = useMemo<EChartsOption>(() => {
    const cats = sources.categories
    const gaps = taxonomy.gap_types
    const industries = taxonomy.industries
    const srcNode = (name: string) => `源·${name}`
    const gapNode = (name: string) => `差·${name}`
    const indNode = (name: string) => `行·${name}`
    // ECharts sankey 要求节点名全局唯一：给三层加前缀，避免大类与行业重名（如「文化与宗教」）
    const nodes: any[] = []
    const links: any[] = []
    const gapIndustryCount = new Map<string, number>()
    for (const o of opportunities) {
      for (const g of o.gap_type_ids) {
        const k = `${g}|${o.industry_id}`
        gapIndustryCount.set(k, (gapIndustryCount.get(k) || 0) + 1)
      }
    }
    cats.forEach((c) => nodes.push({ name: srcNode(c.name), itemStyle: { color: '#4cc9f0' } }))
    gaps.forEach((g) => nodes.push({ name: gapNode(g.name), itemStyle: { color: '#ffb547' } }))
    industries.forEach((i) => nodes.push({ name: indNode(i.name), itemStyle: { color: industryColor(i.id) } }))
    cats.forEach((c) => {
      const affinity = SIGNAL_GAP_MAP[c.id] || []
      affinity.forEach((gapId, idx) => {
        const gap = gaps.find((g) => g.id === gapId)
        if (gap) links.push({ source: srcNode(c.name), target: gapNode(gap.name), value: Math.max(1, c.sources.length * (2.2 - idx * 0.5)) })
      })
    })
    const gapIndustryLinks = [...gapIndustryCount.entries()]
      .map(([k, count]) => {
        const [gapId, indId] = k.split('|')
        return { gapId, indId, count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 40)
    for (const gl of gapIndustryLinks) {
      const gap = gaps.find((g) => g.id === gl.gapId)
      const ind = industries.find((i) => i.id === gl.indId)
      if (gap && ind) links.push({ source: gapNode(gap.name), target: indNode(ind.name), value: gl.count })
    }
    // 保证每个 gap 至少有一条下游，避免孤立节点
    gaps.forEach((g) => {
      if (!links.some((l) => l.source === gapNode(g.name))) {
        const ind = industries.find((i) => opportunities.some((o) => o.industry_id === i.id)) || industries[0]
        links.push({ source: gapNode(g.name), target: indNode(ind.name), value: 0.6 })
      }
    })
    const cleanName = (name: string) => String(name || '').replace(/^(源|差|行)·/, '')
    return {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (p: any) =>
          p.dataType === 'edge'
            ? `${cleanName(p.data.source)} → ${cleanName(p.data.target)}<br/>流向权重：<b>${p.data.value}</b>`
            : `<b>${cleanName(p.name)}</b>`,
      },
      series: [
        {
          type: 'sankey',
          left: 4,
          right: 122,
          top: 12,
          bottom: 8,
          nodeWidth: 9,
          nodeGap: 8,
          emphasis: { focus: 'adjacency' },
          label: { fontSize: 9.5, color: '#e6e9f0', formatter: (p: any) => cleanName(p.name) },
          lineStyle: { color: 'gradient', opacity: 0.2, curveness: 0.5 },
          data: nodes,
          links,
          levels: [
            { depth: 0, itemStyle: { color: '#4cc9f0' }, lineStyle: { color: 'source', opacity: 0.22 } },
            { depth: 1, itemStyle: { color: '#ffb547' }, lineStyle: { color: 'source', opacity: 0.22 } },
            { depth: 2, itemStyle: { color: '#3ddc97' }, lineStyle: { color: 'source', opacity: 0.22 } },
          ],
        },
      ],
    }
  }, [])

  const categoryOverview = sources.categories.map((c) => ({ ...c, count: c.sources.length }))

  const filteredSources = useMemo(() => {
    let list: Array<Source & { categoryName: string; categoryId: string }> = sources.categories.flatMap((c) =>
      c.sources.map((s) => ({ ...s, categoryName: c.name, categoryId: c.id })),
    )
    if (sourceCategory !== 'all') list = list.filter((s) => s.categoryId === sourceCategory)
    if (sourceCompliance !== 'all') list = list.filter((s) => s.compliance === sourceCompliance)
    return list.sort((a, b) => b.value_score - a.value_score)
  }, [sourceCategory, sourceCompliance])

  return (
    <div>
      <PageHeader
        index="04"
        kicker="SCANNER · 扫描室"
        title="扫描室 · 信号采集与验证"
        description="把「人性需求 × 信号类型」变成可执行的扫描流程：热力矩阵看需求密度，桑基图看信息差流向，12 个剧本可直接照做，数据源健康度决定信号质量。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal"><Database className="h-3 w-3" /> {allSources.length} 个数据源</Badge>
            <Badge tone="cyan"><Layers3 className="h-3 w-3" /> {sources.categories.length} 大类</Badge>
            <Badge tone="amber"><FlaskConical className="h-3 w-3" /> {playbooks.length} 个剧本</Badge>
          </div>
        }
      />

      <ScanConsole />

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <SectionCard
          className="xl:col-span-7"
          eyebrow="NEED × SIGNAL HEATMAP"
          title="人性需求 × 信号类型热力矩阵"
          subtitle="按机会库中的需求 × 信息差映射推导（演示性质），数字 = 命中信号数"
          right={<Gauge className="h-4 w-4 text-dim" />}
        >
          <Chart option={heatOption} height={352} />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-1 font-mono text-[9.5px] text-dim">
            <span>行 = 12 类底层需求 · 列 = 10 类信号</span>
            <span className="inline-flex items-center gap-1">
              低
              <span className="inline-block h-1.5 w-12 rounded" style={{ background: 'linear-gradient(90deg,#131821,#173c33,#21795d,#3ddc97)' }} />
              高
            </span>
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-5"
          eyebrow="SOURCE COVERAGE"
          title="12 大类数据源覆盖"
          subtitle="每类的源数量与价值分均值（来源于 data/sources.json）"
          right={<Database className="h-4 w-4 text-dim" />}
          bodyClassName="p-3"
        >
          <div className="space-y-1.5">
            {categoryOverview.map((c) => {
              const avg = c.sources.length ? c.sources.reduce((a, s) => a + s.value_score, 0) / c.sources.length : 0
              const max = Math.max(...categoryOverview.map((x) => x.sources.length), 1)
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="w-[92px] shrink-0 truncate text-[10.5px] text-muted" title={c.name}>{c.name}</span>
                  <ProgressBar value={c.sources.length} max={max} className="flex-1" tone="cyan" />
                  <span className="num w-5 text-right text-[10px] text-dim">{c.sources.length}</span>
                  <span className="num w-8 text-right text-[9.5px] text-amber">{fmtScore(avg)}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-line/70 pt-2">
            <div>
              <div className="mono-label">高价值源</div>
              <div className="num text-[15px] text-signal">{allSources.filter((s) => s.value_score >= 8.5).length}</div>
            </div>
            <div>
              <div className="mono-label">需限速</div>
              <div className="num text-[15px] text-amber">{allSources.filter((s) => s.compliance === 'yellow').length}</div>
            </div>
            <div>
              <div className="mono-label">仅人工</div>
              <div className="num text-[15px] text-danger">{allSources.filter((s) => s.compliance === 'red').length}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-12"
          eyebrow="SANKEY · SOURCE → INFO GAP → INDUSTRY"
          title="信息差类型桑基图"
          subtitle="信号源大类 → 信息差类型 → 行业板块的流向；流量宽度为源数量/机会数（前端由数据推导）"
          right={<Zap className="h-4 w-4 text-dim" />}
        >
          <Chart option={sankeyOption} height={430} />
          <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[9.5px] text-dim">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-cyan" />信号源大类</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber" />信息差类型</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-signal" />行业板块</span>
            <span className="ml-auto">左侧流向由源大类 × 信息差亲和度推导；右侧按机会库计数</span>
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-12"
          eyebrow="PLAYBOOKS · 12"
          title="12 个扫描剧本（可直接照做）"
          subtitle="点击卡片展开：步骤 / 平台 / 关键词 / 时间盒 / 质检点 / 产出物"
          right={<Badge tone="cyan">{playbooks.length} 个</Badge>}
          bodyClassName="p-3"
        >
          <div className="grid grid-cols-1 items-start gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
            {playbooks.map((pb, i) => (
              <PlaybookCard key={pb.id} pb={pb} index={i} open={openPlaybook === pb.id} onToggle={() => setOpenPlaybook(openPlaybook === pb.id ? null : pb.id)} />
            ))}
            {!playbooks.length && <div className="md:col-span-2"><EmptyState title="暂无扫描剧本" /></div>}
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-12"
          eyebrow="SOURCE HEALTH"
          title="数据源健康度表"
          subtitle="合规色：绿 = 公开允许 / 黄 = 灰区限速 / 红 = 仅人工浏览；价值分越高越优先"
          right={
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={sourceCategory}
                onChange={(e) => setSourceCategory(e.target.value)}
                className="h-[26px] rounded border border-line bg-panel-2 px-1.5 text-[10.5px] text-muted outline-none"
                aria-label="数据源分类"
              >
                <option value="all">全部分类</option>
                {sources.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={sourceCompliance}
                onChange={(e) => setSourceCompliance(e.target.value)}
                className="h-[26px] rounded border border-line bg-panel-2 px-1.5 text-[10.5px] text-muted outline-none"
                aria-label="合规等级"
              >
                <option value="all">全部合规色</option>
                <option value="green">绿 · 公开允许</option>
                <option value="yellow">黄 · 灰区限速</option>
                <option value="red">红 · 人工浏览</option>
              </select>
            </div>
          }
          bodyClassName="p-0"
        >
          <div className="max-h-[430px] overflow-auto">
            <table className="table-dense min-w-[900px]">
              <thead>
                <tr>
                  <th>数据源</th>
                  <th>分类</th>
                  <th>访问</th>
                  <th>频率</th>
                  <th>成本</th>
                  <th>合规</th>
                  <th className="w-24">价值分</th>
                  <th className="w-20">健康度</th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map((s) => {
                  const health = HEALTH_META[s.compliance] || HEALTH_META.yellow
                  return (
                    <tr key={`${s.categoryId}-${s.id}`}>
                      <td>
                        <a href={s.url} target="_blank" rel="noreferrer noopener" className="group inline-flex items-center gap-1 text-[11.5px] text-ink hover:text-signal">
                          {s.name}
                          <span className="text-[9px] text-dim group-hover:text-cyan">↗</span>
                        </a>
                        {s.notes && <div className="max-w-[360px] truncate text-[9.5px] text-dim" title={s.notes}>{s.notes}</div>}
                      </td>
                      <td className="text-[10px] text-dim">{s.categoryName}</td>
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
                      <td>
                        <Badge tone={health.tone} title={health.desc}>{health.label}</Badge>
                      </td>
                    </tr>
                  )
                })}
                {!filteredSources.length && (
                  <tr><td colSpan={8} className="py-8 text-center text-[12px] text-dim">当前筛选无数据源</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line/70 px-3 py-2 font-mono text-[9.5px] text-dim">
            <span>共 {filteredSources.length} / {allSources.length} 个源</span>
            <span>合规提醒：红色源仅人工浏览，禁止自动抓取；黄色源需限速并遵守平台 ToS。</span>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
