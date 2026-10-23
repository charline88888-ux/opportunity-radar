import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, ExternalLink, ShieldAlert } from 'lucide-react'
import type { EChartsOption } from 'echarts'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Panel } from '@/components/ui'
import { Chart } from '@/components/charts/Chart'
import { candidateById, type Candidate } from '@/lib/candidates'
import { dataAsOf, gapName, industryName, regionName } from '@/lib/data'
import { eventTypeLabel, industryLabel, localizeNarrativeText, windowStageLabel } from '@/lib/labels'
import { useI18n } from '@/lib/i18n'
import { fmtCnyRange, fmtDateCn, fmtScore } from '@/lib/utils'

type Dict = Record<string, unknown>
const isObj = (x: unknown): x is Dict => !!x && typeof x === 'object' && !Array.isArray(x)
const asStr = (x: unknown): string => (typeof x === 'string' ? x : '')

const CANVAS: Array<{ keys: string[]; zh: string; en: string }> = [
  { keys: ['customer_segments', 'customer'], zh: '客户细分', en: 'Customer segments' },
  { keys: ['value_proposition', 'value'], zh: '价值主张', en: 'Value proposition' },
  { keys: ['channels', 'channel'], zh: '渠道', en: 'Channels' },
  { keys: ['customer_relationships', 'relationship'], zh: '客户关系', en: 'Customer relationships' },
  { keys: ['revenue_streams', 'revenue'], zh: '收入来源', en: 'Revenue streams' },
  { keys: ['key_resources', 'resources'], zh: '核心资源', en: 'Key resources' },
  { keys: ['key_activities', 'activities'], zh: '关键活动', en: 'Key activities' },
  { keys: ['key_partners', 'partners'], zh: '重要伙伴', en: 'Key partners' },
  { keys: ['cost_structure', 'costs'], zh: '成本结构', en: 'Cost structure' },
]

const DIMENSIONS: Array<{ key: string; zh: string; en: string }> = [
  { key: 'signal', zh: '信号强度', en: 'Signal strength' },
  { key: 'gap', zh: '信息差', en: 'Information gap' },
  { key: 'feasibility', zh: '可行性', en: 'Feasibility' },
  { key: 'economics', zh: '经济性', en: 'Economics' },
  { key: 'timing', zh: '时机', en: 'Timing' },
  { key: 'competition', zh: '竞争', en: 'Competition' },
  { key: 'risk', zh: '风险', en: 'Risk' },
  { key: 'fit', zh: '匹配度', en: 'Fit' },
  { key: 'evidence', zh: '证据', en: 'Evidence' },
  { key: 'leverage', zh: '杠杆', en: 'Leverage' },
]

function findField(obj: Dict | undefined, keys: string[]): unknown {
  if (!obj) return undefined
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  return undefined
}

function renderValue(value: unknown): ReactNode {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) return <ul className="space-y-1">{value.map((x, i) => <li key={i} className="leading-[1.7]">· {renderValue(x)}</li>)}</ul>
  if (isObj(value)) return <div className="space-y-1">{Object.entries(value).map(([k, v]) => <div key={k}><span className="text-dim">{k}: </span>{renderValue(v)}</div>)}</div>
  return String(value)
}

function plainValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(plainValue).filter(Boolean).join('；')
  if (isObj(value)) return Object.entries(value).map(([k, v]) => `${k}: ${plainValue(v)}`).join('；')
  return String(value)
}

function fallbackCanvas(c: Candidate): Dict {
  const industry = c.industry_ids.map(industryName).join(' / ') || '全球细分市场'
  const gap = c.gap_type_ids.map(gapName).join(' / ') || '信息差'
  const region = c.region_ids.map(regionName).join(' / ') || '目标市场'
  return {
    customer_segments: [`${region}市场中关注${industry}的早期付费客户`],
    value_proposition: [`用${gap}提供更本地化、更透明的${industry}供给`],
    channels: ['搜索与平台长尾词', '行业社群与内容', '本地合作方/分销'],
    customer_relationships: ['内容触达 + 一对一咨询 + 复购/转介绍'],
    revenue_streams: ['实物/服务差价', '定制与增值服务', '跨市场代采/代发'],
    key_resources: ['公开信号与来源数据', '供应链/交付伙伴', '本地化内容与案例'],
    key_activities: ['选品与定价', '获客与转化', '交付与售后'],
    key_partners: ['工厂/服务商', '物流/支付服务商', '本地渠道/社群主'],
    cost_structure: ['采购/生产成本', '获客成本', '物流与售后', '平台与合规成本'],
  }
}

function dimensionRows(c: Candidate): Array<{ key: string; score: number; rationale: string; dataUsed: string }> {
  const rawDims = findField(c.judgment, ['dimensions', 'scores', 'items'])
  const source: unknown = isObj(rawDims) ? rawDims : Array.isArray(rawDims) ? rawDims : c.scores.dimensions || {}
  return DIMENSIONS.map((d) => {
    const raw = isObj(source) ? source[d.key] : Array.isArray(source) ? (source as unknown[]).find((x): x is Dict => isObj(x) && (x.id === d.key || x.key === d.key)) : undefined
    const score = isObj(raw) ? Number(raw.score ?? raw.value ?? 0) : Number(raw ?? (c.scores.dimensions?.[d.key] ?? 0))
    return {
      key: d.key,
      score: Number.isFinite(score) ? score : 0,
      rationale: isObj(raw) ? asStr(raw.rationale) || asStr(raw.reason) || '综合公开信号与市场结构自动评估' : '综合公开信号与市场结构自动评估',
      dataUsed: isObj(raw) ? (Array.isArray(raw.data_used) ? raw.data_used.map((x) => String(x)).join('；') : asStr(raw.data_used)) : '公开信号 / 来源证据',
    }
  })
}

function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[20px] font-semibold tracking-tight text-ink">{children}</h2>
      {sub && <div className="mt-1 text-[13px] leading-[1.7] text-dim">{sub}</div>}
    </div>
  )
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-lg border border-line/60 bg-panel-2/30 p-4"><div className="mb-2 text-[13px] font-medium text-muted">{title}</div><div className="text-[15px] leading-[1.7] text-ink/90">{children}</div></div>
}

export default function CandidateDetail() {
  const { id } = useParams()
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const c = id ? candidateById.get(id) : undefined

  if (!c) {
    return (
      <div className="panel flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-[16px] font-semibold">{L('候选不存在', 'Candidate not found')}</div>
        <Link to="/rankings" className="text-[14px] text-signal">← {L('返回商机榜', 'Back to rankings')}</Link>
      </div>
    )
  }

  const title = c.title_zh || c.title
  const original = c.title_original || c.source.raw_title || c.title
  const why = asStr(findField(c.judgment, ['why_opportunity', 'why', 'summary'])) || c.one_liner_zh || c.one_liner
  const notIf = findField(c.judgment, ['not_opportunity_if', 'falsify', 'not_if'])
  const primaryIndustry = c.primary_industry || asStr(findField(c.judgment, ['primary_industry']))
  const eventType = asStr(findField(c.judgment, ['event_type']))
  const canvas = c.business_canvas || fallbackCanvas(c)
  const dims = dimensionRows(c)
  const competition = c.competition || {}
  const crossMarket = c.cross_market || {}
  const timing = c.timing || {}
  const conditions = c.conditions || {}
  const barriers = c.barriers || {}
  const profit = c.profit_model || {}
  const execution = c.execution_plan || {}
  const narrative = c.analyst_narrative || {}

  const capitalArray = findField(conditions, ['capital_range_cny'])
  const capitalLabel = c.roi.capital_cny
    ? fmtCnyRange(c.roi.capital_cny.min ?? 0, c.roi.capital_cny.max ?? 0)
    : Array.isArray(capitalArray) ? fmtCnyRange(Number(capitalArray[0] ?? 0), Number(capitalArray[1] ?? capitalArray[0] ?? 0)) : '—'
  const paybackRaw = c.roi.payback_months ?? findField(profit, ['payback_months', 'payback'])
  const paybackLabel = paybackRaw ? `${String(paybackRaw)}${String(paybackRaw).includes('月') ? '' : ` ${L('个月', 'mo')}`}` : '—'
  const grossRaw = c.roi.gross_margin_pct ?? findField(profit, ['gross_margin'])
  const grossNumbers = String(grossRaw ?? '').match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const grossPct = grossNumbers.length ? Math.round((grossNumbers[0] + (grossNumbers[1] ?? grossNumbers[0])) / 2) : null
  const grossLabel = grossPct != null ? `${grossPct}%` : '—'
  const windowRaw = findField(timing, ['window_months', 'window', 'months'])
  const windowLabel = windowRaw == null ? '' : String(windowRaw)
  const windowNum = Number(windowLabel.match(/\d+(?:\.\d+)?/)?.[0] ?? 0)
  const stripWindow = (text: string) => {
    if (!text || !windowLabel) return text
    const re = /\d+(?:[–-]\d+)?\s*个月/
    return text.split(/(?<=[。；;])/).filter((seg) => !seg.includes(windowLabel) && !re.test(seg)).join('').trim()
  }

  const narrativeText = (key: string, fallback: string) => stripWindow(localizeNarrativeText(asStr(narrative[key]) || fallback, lang))
  const competitionRows: Array<[string, unknown]> = [[L('直接竞品', 'Direct'), competition.direct ?? competition.direct_competitors], [L('间接竞品', 'Indirect'), competition.indirect ?? competition.indirect_competitors], [L('替代方案', 'Substitutes'), competition.substitutes ?? competition.alternatives], [L('差异化', 'Differentiation'), competition.differentiation], [L('护城河', 'Moat'), competition.moat], [L('定位', 'Positioning'), competition.positioning]]
  const thesis = narrativeText('thesis', why)
  const market = narrativeText('market', plainValue(findField(canvas, ['customer_segments'])) || why)
  const competitionNarr = narrativeText('competition', asStr(findField(competition, ['differentiation'])) || asStr(findField(competition, ['moat'])))
  const crossNarr = narrativeText('cross_market', asStr(findField(crossMarket, ['why_migratable'])) || asStr(findField(crossMarket, ['arbitrage_type'])))
  const timingNarr = narrativeText('timing', asStr(findField(timing, ['why_now'])))
  const verdict = narrativeText('verdict', `${asStr(findField(execution, ['first_revenue_path']))}${notIf ? ` · ${L('边界：', 'Boundary: ')}${plainValue(notIf)}` : ''}`)

  const gaugeOption: EChartsOption = {
    series: [{
      type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: 100, radius: '92%', center: ['50%', '58%'],
      progress: { show: true, width: 10, itemStyle: { color: '#3ddc97' } },
      axisLine: { lineStyle: { width: 10, color: [[1, '#243040']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
      detail: { valueAnimation: true, fontSize: 30, color: '#e8edf7', offsetCenter: [0, '0%'], formatter: (v: number) => String(Math.round(v)) },
      data: [{ value: c.scores.total }],
    }],
  }
  const radarOption: EChartsOption = {
    backgroundColor: 'transparent',
    radar: {
      indicator: DIMENSIONS.map((d) => ({ name: L(d.zh, d.en), max: 10 })), radius: '66%', center: ['50%', '54%'],
      axisName: { color: '#9aa4ba', fontSize: 11 }, splitLine: { lineStyle: { color: '#2a3140' } },
      splitArea: { areaStyle: { color: ['rgba(61,220,151,0.02)', 'rgba(76,201,240,0.03)'] } }, axisLine: { lineStyle: { color: '#2a3140' } },
    },
    series: [{ type: 'radar', data: [{ value: dims.map((d) => d.score), name: L('10 维评分', '10 dimensions'), areaStyle: { color: 'rgba(61,220,151,0.18)' }, lineStyle: { color: '#3ddc97', width: 2 }, itemStyle: { color: '#3ddc97' } }] }],
  }
  const donutOption: EChartsOption = {
    series: [{
      type: 'pie', radius: ['58%', '78%'], center: ['50%', '50%'], label: { show: false }, labelLine: { show: false },
      data: [{ value: grossPct ?? 0, name: L('毛利', 'Gross margin'), itemStyle: { color: '#3ddc97' } }, { value: 100 - (grossPct ?? 0), name: L('成本', 'Cost'), itemStyle: { color: '#314058' } }],
    }],
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <section className="mb-6 grid grid-cols-1 gap-6 rounded-xl border border-line/70 bg-panel/60 p-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">{L('自动发现', 'Auto-discovered')}</Badge>{primaryIndustry && <Badge tone="signal">{L('主行业', 'Primary industry')}: {industryLabel(primaryIndustry, lang)}</Badge>}{eventType && <Badge tone="amber">{L('事件', 'Event')}: {eventTypeLabel(eventType, lang)}</Badge>}</div>
          <h1 className="mt-4 text-[34px] font-semibold leading-[1.2] tracking-tight text-ink">{title}</h1>
          {original && original !== title && <div className="mt-2 text-[13px] leading-[1.7] text-dim">{L('原文', 'Original')}: {original}</div>}
          <p className="mt-4 text-[17px] leading-[1.75] text-ink/90">{thesis}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[13px] text-dim">{[...c.industry_ids, ...c.gap_type_ids.slice(0, 3), ...c.region_ids].map((x, i) => <span key={`${x}-${i}`} className="rounded border border-line/70 px-2 py-1">{i < c.industry_ids.length ? industryName(x) : i < c.industry_ids.length + Math.min(c.gap_type_ids.length, 3) ? gapName(x) : regionName(x)}</span>)}</div>
        </div>
        <div className="lg:col-span-4">
          <div className="flex items-center gap-2"><div className="flex-1"><Chart option={gaugeOption} height={210} /></div><div className="text-right"><div className="text-[13px] text-dim">{L('综合评分', 'Overall score')}</div><div className="num text-[44px] font-semibold leading-none text-signal">{fmtScore(c.scores.total)}</div><div className="mt-2 inline-flex rounded bg-signal/15 px-2 py-1 text-[20px] font-semibold text-signal">{c.scores.grade}</div></div></div>
          <div className="mt-2 text-center font-mono text-[12px] text-dim">{L('置信度', 'Confidence')} {c.confidence} · {fmtDateCn(c.first_seen || dataAsOf)}</div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: L('启动资金', 'Startup capital'), value: capitalLabel, hint: 'CNY' },
          { label: L('回本周期', 'Payback'), value: paybackLabel, hint: L('越短越好', 'shorter is better') },
          { label: L('毛利率', 'Gross margin'), value: grossLabel, hint: L('参考区间', 'reference range') },
          { label: L('窗口月数', 'Window'), value: windowLabel ? `${windowLabel}${windowLabel.includes('月') ? '' : ` ${L('个月', 'months')}`}` : '—', hint: L('预计窗口', 'expected window') },
        ].map((k) => <div key={k.label} className="rounded-xl border border-line/70 bg-panel/60 p-5"><div className="text-[13px] text-dim">{k.label}</div><div className="num mt-2 text-[34px] font-semibold leading-none text-ink">{k.value}</div><div className="mt-2 text-[12px] text-dim">{k.hint}</div></div>)}
      </section>

      <nav className="mb-4 flex flex-wrap gap-2 text-[13px]">
        {[['logic', L('机会逻辑', 'Logic')], ['dimensions', L('10 维', '10 dimensions')], ['canvas', L('画布', 'Canvas')], ['competition', L('竞争', 'Competition')], ['cross', L('跨市场', 'Cross-market')], ['execution', L('执行', 'Execution')]].map(([id, label]) => (
          <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="rounded-full border border-line/70 px-3 py-1.5 text-dim hover:border-signal/40 hover:text-signal">{label}</button>
        ))}
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="ml-auto rounded-full border border-line/70 px-3 py-1.5 text-dim hover:text-ink">↑ {L('顶部', 'Top')}</button>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <main className="space-y-6 lg:col-span-8">
          <Panel id="logic" className="scroll-mt-24 p-6">
            <SectionTitle sub={L('结论先行：为什么成立、市场缺口在哪、什么时候会失效。', 'Conclusion first: why it exists, where the gap is, and when it fails.')}>{L('核心判断', 'Core judgment')}</SectionTitle>
            <div className="space-y-4 text-[15px] leading-[1.75] text-ink/90"><p>{market}</p>{why && why !== thesis && <p>{stripWindow(why)}</p>}</div>
          </Panel>

          <Panel id="dimensions" className="scroll-mt-24 p-6">
            <SectionTitle sub={L('10 个维度逐项打分；右侧分数条直接看强弱，下面是判断理由与使用的数据。', 'Ten dimensions scored; bars show relative strength with rationale and data used.')}>{L('10 维判断依据', '10-dimension rationale')}</SectionTitle>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12"><div className="xl:col-span-5"><Chart option={radarOption} height={330} /></div><div className="space-y-3 xl:col-span-7">{dims.map((d) => { const def = DIMENSIONS.find((x) => x.key === d.key)!; return <div key={d.key}><div className="flex items-center justify-between text-[14px]"><span className="text-ink">{L(def.zh, def.en)}</span><span className="num text-signal">{fmtScore(d.score)}</span></div><div className="mt-1 h-2 overflow-hidden rounded bg-line/60"><div className="h-full rounded bg-signal" style={{ width: `${Math.max(0, Math.min(100, d.score * 10))}%` }} /></div><div className="mt-1 text-[13px] leading-[1.7] text-dim">{stripWindow(localizeNarrativeText(d.rationale, lang))}</div><div className="text-[12px] leading-[1.6] text-dim/80">{L('数据：', 'Data: ')}{stripWindow(localizeNarrativeText(d.dataUsed, lang))}</div></div> })}</div></div>
          </Panel>

          <Panel id="canvas" className="scroll-mt-24 p-6">
            <SectionTitle>{L('商业画布 · 9 格', 'Business canvas · 9 blocks')}</SectionTitle>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{CANVAS.map((block) => <div key={block.en} className="rounded-lg border border-line/60 bg-panel-2/30 p-4"><div className="text-[13px] font-medium text-muted">{L(block.zh, block.en)}</div><div className="mt-2 text-[14px] leading-[1.7] text-ink/80">{renderValue(findField(canvas, block.keys))}</div></div>)}</div>
          </Panel>

          <Panel id="competition" className="scroll-mt-24 p-6">
            <SectionTitle sub={L('分别看直接/间接/替代、差异化和护城河。', 'Compare direct/indirect/substitute options, differentiation and moat.')}>{L('竞争与差异', 'Competition & differentiation')}</SectionTitle>
                        <div className="overflow-x-auto"><table className="w-full text-left text-[14px]"><thead className="text-dim"><tr className="border-b border-line/60"><th className="py-2 pr-3 font-normal">{L('类型', 'Type')}</th><th className="py-2 pr-3 font-normal">{L('内容', 'Detail')}</th></tr></thead><tbody>
              {competitionRows.map(([label, value]) => <tr key={String(label)} className="border-b border-line/30 align-top"><td className="w-[150px] py-2 pr-3 text-muted">{label}</td><td className="py-2 leading-[1.7] text-ink/85">{renderValue(value)}</td></tr>)}
            </tbody></table></div>
            <div className="mt-4 flex flex-wrap gap-2">{[competition.differentiation, competition.moat, competition.positioning].map((v, i) => v ? <span key={i} className="rounded-full border border-signal/30 bg-signal/[0.06] px-3 py-1 text-[13px] text-signal">{renderValue(v)}</span> : null)}</div>
          </Panel>

          <Panel id="cross" className="scroll-mt-24 p-6">
            <SectionTitle sub={L('同一机会能否迁移到其他市场，靠什么套利、需要哪些本地化。', 'Can it move to other markets, what arbitrage exists, and what localization is required.')}>{L('跨市场机会', 'Cross-market opportunity')}</SectionTitle>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InfoBlock title={L('可迁移市场', 'Target markets')}>{renderValue(crossMarket.target_markets ?? crossMarket.targets ?? crossMarket.markets)}</InfoBlock>
              <InfoBlock title={L('套利类型', 'Arbitrage type')}>{renderValue(crossMarket.arbitrage_type ?? crossMarket.arbitrage)}</InfoBlock>
              <InfoBlock title={L('本地化需求', 'Localization')}>{renderValue(crossMarket.localization_needs ?? crossMarket.localization)}</InfoBlock>
              <InfoBlock title={L('定价权', 'Pricing power')}>{renderValue(crossMarket.pricing_power)}</InfoBlock>
            </div>
          </Panel>

            <Panel className="p-5"><div className="text-[13px] text-dim">{L('利润结构', 'Profit structure')}</div><Chart option={donutOption} height={210} /><div className="mt-3 text-[13px] leading-[1.7] text-dim">{renderValue(profit.revenue_model ?? profit.revenue_streams)}</div><div className="mt-2 text-[13px] leading-[1.7] text-ink/80">{renderValue(profit.unit_economics)}</div></Panel>
            <Panel className="p-5"><div className="text-[13px] text-dim">{L('时机窗口', 'Timing window')}</div><div className="mt-3 flex flex-wrap gap-2 text-[12px]"><Badge tone="cyan">{windowStageLabel(String(findField(timing, ['window_stage']) || '—'), lang)}</Badge><Badge tone="amber">{String(findField(timing, ['urgency']) || '—')}</Badge></div><div className="mt-3 text-[13px] leading-[1.7] text-dim">{stripWindow(localizeNarrativeText(String(findField(timing, ['why_now']) || ''), lang))}</div><div className="mt-2 text-[13px] leading-[1.7] text-ink/80">{L('催化剂', 'Catalysts')}: {renderValue(findField(timing, ['catalysts']))}</div></Panel>
            <Panel className="p-5"><div className="text-[13px] text-dim">{L('条件与门槛', 'Conditions & barriers')}</div><div className="mt-2 space-y-2 text-[13px] leading-[1.7]"><div><span className="text-dim">{L('技能', 'Skills')}: </span><span className="text-ink/85">{renderValue(conditions.skills)}</span></div><div><span className="text-dim">{L('资质/许可', 'Licenses')}: </span><span className="text-ink/85">{renderValue(conditions.licenses)}</span></div><div><span className="text-dim">{L('供应链', 'Supply chain')}: </span><span className="text-ink/85">{renderValue(conditions.supply_chain)}</span></div><div><span className="text-dim">{L('伙伴/团队', 'Partners/team')}: </span><span className="text-ink/85">{renderValue(conditions.partners ?? conditions.team)}</span></div><div><span className="text-dim">{L('进入门槛', 'Barriers')}: </span><span className="text-ink/85">{renderValue(barriers.regulatory ?? barriers.technical ?? barriers.capital)}</span></div></div></Panel>
          <Panel id="execution" className="scroll-mt-24 p-6">
            <SectionTitle sub={L('从启动到首笔收入的行动路径；每个阶段有明确动作与里程碑。', 'Action path from launch to first revenue, with concrete actions and milestones.')}>{L('执行方案', 'Execution plan')}</SectionTitle>
                        <div className="space-y-4">
              {[{ phase: '0–30', title: L('启动与落地', 'Launch'), value: execution.phase_0_30_days ?? execution.days_0_30 ?? execution.d0_30 }, { phase: '30–90', title: L('增长与首笔收入', 'Growth & first revenue'), value: execution.phase_30_90_days ?? execution.days_30_90 ?? execution.d30_90 }, { phase: '90+', title: L('里程碑与扩量', 'Milestones & scale'), value: execution.milestones ?? execution.scale }].map((step, i) => (
                <div key={step.phase} className="flex gap-4"><div className="flex w-16 shrink-0 flex-col items-center"><div className="flex h-10 w-10 items-center justify-center rounded-full border border-signal/40 bg-signal/10 font-mono text-[13px] text-signal">{step.phase}</div>{i < 2 && <div className="mt-1 h-full w-px bg-line/70" />}</div><div className="flex-1 rounded-lg border border-line/60 bg-panel-2/30 p-4"><div className="text-[14px] font-medium text-ink">{step.title}</div><div className="mt-1 text-[14px] leading-[1.7] text-ink/80">{renderValue(step.value)}</div></div></div>
              ))}
              <InfoBlock title={L('首笔收入路径', 'First revenue path')}>{renderValue(execution.first_revenue_path)}</InfoBlock>
            </div>
          </Panel>
          <Panel id="sources" className="scroll-mt-24 p-6">
            <SectionTitle>{L('来源与证据', 'Sources & evidence')}</SectionTitle>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{c.evidence.slice(0, 6).map((e, i) => <a key={`${e.url}-${i}`} href={e.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-line/60 px-4 py-3 text-[14px] leading-[1.6] text-muted hover:text-signal"><div className="line-clamp-2">{e.title || e.url} <ExternalLink className="inline h-3 w-3" /></div><div className="mt-1 text-[13px] text-dim">{e.publisher} · {e.date}</div></a>)}</div>
            <div className="mt-4 rounded-lg border border-amber/25 bg-amber/[0.04] px-4 py-3 text-[13px] leading-[1.7] text-amber"><ShieldAlert className="mr-1 inline h-3 w-3" /> {L('自动发现并评估的商机线索，仅作研究参考，不构成投资建议。', 'Automatically discovered and evaluated lead for research only; not investment advice.')}</div>
            {c.source.url && <a href={c.source.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[13px] text-signal hover:underline">{L('原始来源', 'Original source')} <ArrowUpRight className="h-3 w-3" /></a>}
          </Panel>
        </main>

        <aside className="space-y-4 lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-4">
            <Panel className="p-5">
              <div className="text-[13px] text-dim">{L('锚点导航', 'On this page')}</div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[13px]">
                {['logic','dimensions','canvas','competition','cross','timing','conditions','profit','execution','sources'].map((id) => (
                  <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})} className="rounded-full border border-line/70 px-2.5 py-1 text-dim hover:text-signal">{({logic:L('逻辑','Logic'),dimensions:L('10 维','10 dims'),canvas:L('画布','Canvas'),competition:L('竞争','Competition'),cross:L('跨市场','Cross-market'),timing:L('时机','Timing'),conditions:L('条件','Conditions'),profit:L('利润','Profit'),execution:L('执行','Execution'),sources:L('来源','Sources')} as Record<string,string>)[id]}</button>
                ))}
              </div>
            </Panel>
            <Panel className="p-5"><div className="text-[13px] text-dim">{L('结论摘要', 'Conclusion')}</div><p className="mt-2 text-[15px] leading-[1.75] text-ink/90">{verdict}</p>{c.source.url && <a href={c.source.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[13px] text-signal hover:underline">{L('原始来源', 'Original source')} <ArrowUpRight className="h-3 w-3" /></a>}</Panel>
            <Panel className="p-5"><div className="text-[13px] text-dim">{L('风险与边界', 'Risks & boundaries')}</div><div className="mt-2 text-[14px] leading-[1.7] text-amber/90">{notIf != null ? renderValue(notIf) : '—'}</div></Panel>

          </div>
        </aside>
      </div>
    </div>
  )
}
