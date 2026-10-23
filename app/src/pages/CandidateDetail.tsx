import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, ChevronRight, ExternalLink, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Panel } from '@/components/ui'
import { candidateById, type Candidate } from '@/lib/candidates'
import { dataAsOf, gapName, industryName, regionName } from '@/lib/data'
import { useI18n } from '@/lib/i18n'
import { fmtCnyRange, fmtDateCn, fmtScore } from '@/lib/utils'

type Dict = Record<string, unknown>
const isObj = (x: unknown): x is Dict => !!x && typeof x === 'object' && !Array.isArray(x)
const asArr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
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
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return undefined
}

function valueText(value: unknown): ReactNode {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (!value.length) return '—'
    return (
      <ul className="space-y-0.5">
        {value.map((x, i) => <li key={i} className="leading-relaxed">· {valueText(x)}</li>)}
      </ul>
    )
  }
  if (isObj(value)) {
    return (
      <div className="space-y-0.5">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="leading-relaxed"><span className="text-muted">{k}: </span>{valueText(v)}</div>
        ))}
      </div>
    )
  }
  return String(value)
}

function fieldRows(obj: Dict | undefined, fields: Array<{ keys: string[]; zh: string; en: string }>): Array<{ zh: string; en: string; value: ReactNode }> {
  return fields.map((f) => ({ zh: f.zh, en: f.en, value: valueText(findField(obj, f.keys)) }))
}

function fallbackCanvas(c: Candidate): Dict {
  const industry = c.industry_ids.map(industryName).join(' / ') || '全球细分市场'
  const gap = c.gap_type_ids.map(gapName).join(' / ') || '信息差'
  const region = c.region_ids.map(regionName).join(' / ') || '目标市场'
  return {
    customer_segments: [`${region}市场中关注${industry}的早期付费客户`, c.target_countries.slice(0, 3).join('、') || '当地中小买家'],
    value_proposition: [`用${gap}提供更本地化、更透明的${industry}供给`],
    channels: ['搜索与平台长尾词', '行业社群与内容', '本地合作方/分销'],
    customer_relationships: ['内容触达 + 一对一咨询 + 复购/转介绍'],
    revenue_streams: ['实物/服务差价', '定制与增值服务', '跨市场代采/代发'],
    key_resources: ['公开信号与来源数据', '供应链/交付伙伴', '本地化内容与案例'],
    key_activities: ['选品与定价', '获客与转化', '交付与售后', '复购与渠道维护'],
    key_partners: ['工厂/服务商', '物流/支付服务商', '本地渠道/社群主'],
    cost_structure: ['采购/生产成本', '获客成本', '物流与售后', '平台与合规成本'],
  }
}

function dimensionRows(c: Candidate): Array<{ key: string; score: number; rationale: string; dataUsed: string }> {
  const judgment = c.judgment
  const rawDims = findField(judgment, ['dimensions', 'scores', 'items'])
  const source: unknown = isObj(rawDims) ? rawDims : Array.isArray(rawDims) ? rawDims : c.scores.dimensions || {}
  return DIMENSIONS.map((d) => {
    const raw = isObj(source) ? source[d.key] : Array.isArray(source) ? (source as unknown[]).find((x): x is Dict => isObj(x) && (x.key === d.key || x.id === d.key)) : undefined
    const score = isObj(raw) ? Number(raw.score ?? raw.value ?? 0) : Number(raw ?? (c.scores.dimensions?.[d.key] ?? 0))
    return {
      key: d.key,
      score: Number.isFinite(score) ? score : 0,
      rationale: isObj(raw) ? (asStr(raw.rationale) || asStr(raw.reason) || '综合公开信号、市场结构与候选证据自动评分') : '综合公开信号、市场结构与候选证据自动评分',
      dataUsed: isObj(raw) ? (Array.isArray(raw.data_used) ? raw.data_used.join('；') : asStr(raw.data_used) || asStr(raw.dataUsed) || '公开信号 / 来源证据 / 行业与区域规则') : '公开信号 / 来源证据 / 行业与区域规则',
    }
  })
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <details className="panel group mb-3 p-3">
      <summary className="flex cursor-pointer list-none items-start gap-2">
        <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dim transition-transform group-open:rotate-90" />
        <span className="min-w-0 flex-1">
          <span className="mono-label block">{title}</span>
          {subtitle && <span className="mt-0.5 block text-[9.5px] leading-relaxed text-dim">{subtitle}</span>}
        </span>
        <span className="font-mono text-[8.5px] text-dim">EXPAND</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

function FieldGrid({ rows }: { rows: Array<{ zh: string; en: string; value: ReactNode }> }) {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {rows.map((r) => (
        <div key={r.zh} className="rounded border border-line/60 px-2.5 py-2 text-[10px]">
          <div className="text-muted">{L(r.zh, r.en)}</div>
          <div className="mt-0.5 leading-relaxed text-dim">{r.value}</div>
        </div>
      ))}
    </div>
  )
}

export default function CandidateDetail() {
  const { id } = useParams()
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const c = id ? candidateById.get(id) : undefined

  if (!c) {
    return (
      <div className="panel flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-[15px] font-semibold">{L('候选不存在', 'Candidate not found')}</div>
        <Link to="/rankings" className="text-[12px] text-signal">← {L('返回商机榜', 'Back to rankings')}</Link>
      </div>
    )
  }

  const title = c.title_zh || c.title
  const original = c.title_original || c.source.raw_title || c.title
  const why = asStr(findField(c.judgment, ['why_opportunity', 'why', 'summary'])) || c.one_liner_zh || c.one_liner
  const notIf = findField(c.judgment, ['not_opportunity_if', 'falsify', 'not_if'])
  const eventType = asStr(findField(c.judgment, ['event_type']))
  const primaryIndustry = c.primary_industry || asStr(findField(c.judgment, ['primary_industry']))
  const canvas = c.business_canvas || fallbackCanvas(c)
  const dims = dimensionRows(c)
  const competition = c.competition || {}
  const crossMarket = c.cross_market || {}
  const timing = c.timing || {}
  const conditions = c.conditions || {}
  const barriers = c.barriers || {}
  const profit = c.profit_model || {}
  const execution = c.execution_plan || {}
  const evidence = c.evidence || []
  const sourceItems = Array.isArray(c.eval_sources) ? c.eval_sources : []

  const competitionRows = fieldRows(competition, [
    { keys: ['direct_competitors', 'direct'], zh: '直接竞品', en: 'Direct competitors' },
    { keys: ['indirect_competitors', 'indirect'], zh: '间接竞品', en: 'Indirect competitors' },
    { keys: ['alternatives', 'substitutes'], zh: '替代方案', en: 'Alternatives' },
    { keys: ['differentiation'], zh: '差异化', en: 'Differentiation' },
    { keys: ['moat'], zh: '护城河', en: 'Moat' },
    { keys: ['positioning'], zh: '定位', en: 'Positioning' },
  ])
  const crossRows = fieldRows(crossMarket, [
    { keys: ['targets', 'target_markets', 'markets'], zh: '可迁移市场', en: 'Target markets' },
    { keys: ['arbitrage_types', 'arbitrage_type', 'arbitrage'], zh: '套利类型', en: 'Arbitrage type' },
    { keys: ['why_migratable', 'why'], zh: '为什么可迁移', en: 'Why transferable' },
    { keys: ['localization', 'localization_needs'], zh: '本地化需求', en: 'Localization needs' },
    { keys: ['pricing_power'], zh: '定价权', en: 'Pricing power' },
  ])
  const timingRows = fieldRows(timing, [
    { keys: ['why_now', 'why'], zh: '为什么是现在', en: 'Why now' },
    { keys: ['catalysts'], zh: '催化剂', en: 'Catalysts' },
    { keys: ['stage', 'window_stage'], zh: '窗口阶段', en: 'Window stage' },
    { keys: ['window_months', 'months'], zh: '预计窗口月数', en: 'Window months' },
    { keys: ['urgency'], zh: '紧迫性', en: 'Urgency' },
    { keys: ['risks'], zh: '窗口风险', en: 'Window risks' },
  ])
  const conditionRows = [
    { zh: '启动资金', en: 'Startup capital', value: fmtCnyRange(c.roi.capital_cny?.min ?? 0, c.roi.capital_cny?.max ?? 0) },
    ...fieldRows(conditions, [
      { keys: ['skills'], zh: '所需技能', en: 'Skills' },
      { keys: ['licenses', 'qualifications'], zh: '资质 / 许可', en: 'Licenses' },
      { keys: ['supply_chain'], zh: '供应链', en: 'Supply chain' },
      { keys: ['partners'], zh: '伙伴', en: 'Partners' },
      { keys: ['team'], zh: '团队', en: 'Team' },
      { keys: ['time_to_launch', 'time_to_launch_months', 'launch_time'], zh: '启动时间', en: 'Time to launch' },
    ]),
    ...fieldRows(barriers, [
      { keys: ['regulation', 'regulatory'], zh: '监管门槛', en: 'Regulatory barrier' },
      { keys: ['technology', 'technical'], zh: '技术门槛', en: 'Technical barrier' },
      { keys: ['capital'], zh: '资金门槛', en: 'Capital barrier' },
      { keys: ['brand'], zh: '品牌门槛', en: 'Brand barrier' },
      { keys: ['channel', 'channels'], zh: '渠道门槛', en: 'Channel barrier' },
    ]),
  ]
  const profitRows = fieldRows(profit, [
    { keys: ['revenue_streams', 'revenue_items', 'revenue', 'revenue_model', 'pricing_range'], zh: '收入项', en: 'Revenue items' },
    { keys: ['gross_margin'], zh: '毛利', en: 'Gross margin' },
    { keys: ['cost_items', 'costs'], zh: '成本项', en: 'Cost items' },
    { keys: ['unit_economics'], zh: '单位经济', en: 'Unit economics' },
    { keys: ['payback_months', 'payback'], zh: '回本周期', en: 'Payback' },
    { keys: ['scaling_leverage', 'scale', 'scale_levers'], zh: '规模化杠杆', en: 'Scaling leverage' },
  ])
  const executionRows = fieldRows(execution, [
    { keys: ['days_0_30', 'd0_30', 'first_30_days', 'phase_0_30_days'], zh: '0–30 天', en: 'Days 0–30' },
    { keys: ['days_30_90', 'd30_90', 'days_30_90', 'phase_30_90_days'], zh: '30–90 天', en: 'Days 30–90' },
    { keys: ['milestones'], zh: '里程碑', en: 'Milestones' },
    { keys: ['first_revenue', 'first_revenue_path'], zh: '首笔收入路径', en: 'First revenue path' },
  ])

  return (
    <div>
      <PageHeader
        index="03"
        kicker={L('EVALUATION · 商机评估说明书', 'EVALUATION · OPPORTUNITY BRIEF')}
        title={title}
        description={why}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">{L('自动发现', 'Auto-discovered')}</Badge>
            {primaryIndustry && <Badge tone="signal">{L('主行业', 'Primary industry')}: {primaryIndustry}</Badge>}
            {eventType && <Badge tone="amber">{L('事件', 'Event')}: {eventType}</Badge>}
            <span className="num rounded border border-line px-2 py-0.5 text-[12px] text-signal">{fmtScore(c.scores.total)} · {c.scores.grade}</span>
            <Link to="/rankings" className="inline-flex h-7 items-center gap-1 rounded border border-line px-2.5 text-[11px] text-muted hover:text-ink">← {L('商机榜', 'Rankings')}</Link>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-1 gap-2.5 md:grid-cols-4">
        <Panel className="p-3"><div className="mono-label">{L('评分 / 等级', 'Score / grade')}</div><div className="mt-1 flex items-end gap-2"><span className="num text-[28px] font-semibold text-signal">{fmtScore(c.scores.total)}</span><Badge tone="signal">{c.scores.grade}</Badge></div><div className="font-mono text-[9px] text-dim">conf {c.confidence} · rank {fmtScore(c.scores.rank_score)}</div></Panel>
        <Panel className="p-3"><div className="mono-label">{L('投入与回本', 'Capital & payback')}</div><div className="mt-1 text-[10.5px] text-muted">{c.roi.capital_cny ? fmtCnyRange(c.roi.capital_cny.min ?? 0, c.roi.capital_cny.max ?? 0) : '—'}</div><div className="text-[9.5px] text-dim">{L('回本', 'Payback')} {c.roi.payback_months ?? '—'} {L('个月', 'months')} · {L('月收入', 'Monthly')} {c.roi.monthly_revenue_cny ? fmtCnyRange(c.roi.monthly_revenue_cny.min ?? 0, c.roi.monthly_revenue_cny.max ?? 0) : '—'}</div></Panel>
        <Panel className="p-3"><div className="mono-label">{L('行业 / 信息差', 'Industry / gap')}</div><div className="mt-1 text-[10.5px] text-muted">{c.industry_ids.map(industryName).join(' / ') || '—'}</div><div className="text-[9.5px] text-dim">{c.gap_type_ids.map(gapName).join(' / ') || '—'}</div></Panel>
        <Panel className="p-3"><div className="mono-label">{L('区域 / 首次发现', 'Region / first seen')}</div><div className="mt-1 text-[10.5px] text-muted">{c.region_ids.map(regionName).join(' / ') || '—'}</div><div className="text-[9.5px] text-dim">{fmtDateCn(c.first_seen || dataAsOf)}</div></Panel>
      </div>

      {original && original !== title && <div className="mb-2 text-[9.5px] text-dim">{L('原文', 'Original')}: {original}</div>}

      <Section title={L('商业画布 · 9 格', 'Business canvas · 9 blocks')} subtitle={L('客户、价值、渠道、收入、资源、活动、伙伴与成本的完整结构。', 'A complete structure of customers, value, channels, revenue, resources, activities, partners and costs.')}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {CANVAS.map((block) => (
            <div key={block.en} className="rounded border border-line/60 px-2.5 py-2 text-[10px]">
              <div className="text-muted">{L(block.zh, block.en)}</div>
              <div className="mt-0.5 leading-relaxed text-dim">{valueText(findField(canvas, block.keys))}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={L('为什么是商机 · 10 维判断依据', 'Why an opportunity · 10-dimension rationale')} subtitle={L('每一维给出评分、判断理由和使用的数据；证伪条件帮助判断什么时候不该做。', 'Each dimension includes score, rationale and data used; the falsification condition clarifies when not to pursue.')}>
        <div className="mb-2 rounded border border-signal/20 bg-signal/[0.03] px-2.5 py-2 text-[10.5px] leading-relaxed text-muted">
          <span className="text-signal">{L('商机判断：', 'Opportunity judgment: ')}</span>{why}
        </div>
        {notIf != null && <div className="mb-2 rounded border border-amber/25 bg-amber/[0.03] px-2.5 py-2 text-[9.5px] leading-relaxed text-amber">{L('什么情况下不是商机：', 'When it is not an opportunity: ')}{valueText(notIf)}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[9.5px]">
            <thead className="text-dim">
              <tr className="border-b border-line/60">
                <th className="py-1.5 pr-2 font-normal">{L('维度', 'Dimension')}</th>
                <th className="py-1.5 pr-2 font-normal">{L('分数', 'Score')}</th>
                <th className="py-1.5 pr-2 font-normal">{L('判断理由', 'Rationale')}</th>
                <th className="py-1.5 font-normal">{L('使用数据', 'Data used')}</th>
              </tr>
            </thead>
            <tbody>
              {dims.map((d) => {
                const def = DIMENSIONS.find((x) => x.key === d.key)!
                return (
                  <tr key={d.key} className="border-b border-line/30 align-top">
                    <td className="py-1.5 pr-2 text-muted">{L(def.zh, def.en)}</td>
                    <td className="py-1.5 pr-2 font-mono text-signal">{fmtScore(d.score)}</td>
                    <td className="py-1.5 pr-2 leading-relaxed text-dim">{d.rationale}</td>
                    <td className="py-1.5 leading-relaxed text-dim">{d.dataUsed}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={L('竞争与差异', 'Competition & differentiation')}>
        <FieldGrid rows={competitionRows} />
      </Section>

      <Section title={L('跨市场机会', 'Cross-market opportunity')}>
        <FieldGrid rows={crossRows} />
      </Section>

      <Section title={L('时机与窗口', 'Timing & window')}>
        <FieldGrid rows={timingRows} />
      </Section>

      <Section title={L('条件、门槛与资金', 'Conditions, barriers & capital')}>
        <FieldGrid rows={conditionRows} />
      </Section>

      <Section title={L('利润模型', 'Profit model')}>
        <FieldGrid rows={profitRows} />
      </Section>

      <Section title={L('执行方案 · 0–90 天', 'Execution plan · 0–90 days')} subtitle={L('从启动到首笔收入的行动路径。', 'A path from launch to first revenue.')}>
        <FieldGrid rows={executionRows} />
      </Section>

      <Section title={L('信息来源与依据', 'Sources & evidence')}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="space-y-1">
            {evidence.map((e, i) => (
              <a key={`${e.url}-${i}`} href={e.url} target="_blank" rel="noreferrer" className="block rounded border border-line/60 px-2 py-1.5 text-[9.5px] text-muted hover:text-signal">
                <div className="truncate">{e.title || e.url} <ExternalLink className="inline h-2.5 w-2.5" /></div>
                <div className="truncate text-[8.5px] text-dim">{e.publisher} · {e.date}</div>
              </a>
            ))}
          </div>
          <div className="rounded border border-amber/25 bg-amber/[0.04] px-2 py-1.5 text-[9.5px] leading-relaxed text-amber">
            <ShieldAlert className="mr-1 inline h-3 w-3" /> {L('自动发现并评估的商机线索，仅作研究参考，不构成投资建议；能否赚钱取决于个人线下执行。', 'Automatically discovered and evaluated lead for research only; not investment advice. Commercial success depends on your own execution.')}
          </div>
        </div>
        {c.source.url && <a href={c.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[9.5px] text-dim hover:text-signal">{L('原始来源', 'Original source')}: {c.source.name || c.source.url} <ArrowUpRight className="h-3 w-3" /></a>}
      </Section>
    </div>
  )
}
