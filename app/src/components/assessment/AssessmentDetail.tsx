/**
 * 统一评估详情：自动候选（Candidate）与精选机会（Opportunity）共用。
 * 结构：决策头（结论 + 核心 KPI + 评分）→ 经济性驾驶舱（6 图）→ 核心判断 → 10 维 → 画布 → 竞争/跨市场 → 时机/条件/执行 → 证据。
 * 无 accordion 隐藏核心结论；锚点导航只有一份（不再有侧栏重复）。
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronLeft, ExternalLink, ShieldAlert } from 'lucide-react'
import type { EChartsOption } from 'echarts'
import { Badge, Panel } from '@/components/ui'
import { Chart } from '@/components/charts/Chart'
import { scoreRadarOption } from '@/components/charts/econ-options'
import { EconCockpit } from './EconCockpit'
import { localizedText, textOf, urgencyLabel, type Assessment } from '@/lib/assessment'
import { dataAsOf, dataMeta } from '@/lib/data'
import { useI18n } from '@/lib/i18n'
import { cn, fmtCny, fmtCnyRange, fmtDate, fmtInt, fmtPct, fmtScore } from '@/lib/utils'

const SECTIONS = [
  { id: 'economics', zh: '经济性', en: 'Economics' },
  { id: 'judgment', zh: '核心判断', en: 'Thesis' },
  { id: 'score', zh: '10 维', en: '10 dims' },
  { id: 'canvas', zh: '画布', en: 'Canvas' },
  { id: 'competition', zh: '竞争 / 跨市场', en: 'Competition' },
  { id: 'execution', zh: '时机 / 执行', en: 'Execution' },
  { id: 'evidence', zh: '证据', en: 'Evidence' },
] as const

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)
const signedCny = (n: number) => `${n < 0 ? '-' : ''}¥${fmtCny(Math.abs(n))}`

function findField(obj: Obj | undefined, keys: string[]): unknown {
  if (!obj) return undefined
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  return undefined
}

/* ------------------------------- 基础渲染 ------------------------------- */

function ValueText({ value }: { value: unknown }) {
  const { lang } = useI18n()
  if (value == null || value === '') return <span className="text-dim">—</span>
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1.5">
        {value.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-signal/70" />
            <span className="min-w-0 flex-1">{typeof item === 'object' && item !== null ? <ValueText value={item} /> : localizedText(String(item), lang)}</span>
          </li>
        ))}
      </ul>
    )
  }
  if (isObj(value)) {
    return (
      <div className="space-y-1.5">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="shrink-0 text-dim">{k}</span>
            <span className="min-w-0 flex-1">{typeof v === 'object' && v !== null ? <ValueText value={v} /> : localizedText(String(v), lang)}</span>
          </div>
        ))}
      </div>
    )
  }
  return <>{localizedText(String(value), lang)}</>
}

function Section({
  id,
  index,
  title,
  sub,
  children,
  actions,
}: {
  id?: string
  index: string
  title: string
  sub?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-[118px]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line/60 pb-3">
        <div className="min-w-0">
          <div className="mono-label flex items-center gap-2">
            <span className="text-signal">{index}</span>
            <span className="inline-block h-px w-6 bg-line-strong" />
            <span>RADAR / BRIEF</span>
          </div>
          <h2 className="mt-1.5 text-[21px] font-semibold tracking-tight text-ink">{title}</h2>
          {sub && <p className="mt-1 max-w-[900px] text-[13px] leading-[1.75] text-muted">{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

function InfoCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-line/60 bg-panel-2/30 p-4', className)}>
      <div className="mb-2 text-[12px] font-medium uppercase tracking-wider text-muted">{title}</div>
      <div className="text-[14px] leading-[1.75] text-ink/90">{children}</div>
    </div>
  )
}

/* ------------------------------- 页面 ------------------------------- */

export function AssessmentNotFound({ kind }: { kind: 'candidate' | 'curated' }) {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  return (
    <div className="panel flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-[18px] font-semibold text-ink">{kind === 'candidate' ? L('候选不存在', 'Candidate not found') : L('商机不存在', 'Opportunity not found')}</div>
      <Link to="/rankings" className="text-[14px] text-signal">
        ← {L('返回商机榜', 'Back to rankings')}
      </Link>
    </div>
  )
}

export function AssessmentDetail({ assessment }: { assessment: Assessment }) {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const a = assessment
  const econ = a.economics
  const theoryNote = L('非实盘验证', 'not live-tested')
  const marginLabel =
    econ.ranges.marginPct.min === econ.ranges.marginPct.max
      ? fmtPct(econ.ranges.marginPct.min * 100, 0)
      : `${fmtPct(econ.ranges.marginPct.min * 100, 0)}–${fmtPct(econ.ranges.marginPct.max * 100, 0)}`

  const gaugeOption: EChartsOption = useMemo(
    () => ({
      series: [
        {
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          radius: '96%',
          center: ['50%', '56%'],
          progress: { show: true, width: 12, itemStyle: { color: '#3ddc97' } },
          axisLine: { lineStyle: { width: 12, color: [[1, '#243040']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { show: true, offsetCenter: [0, '34%'], color: '#8b93a7', fontSize: 12 },
          detail: {
            valueAnimation: true,
            fontSize: 34,
            fontWeight: 600,
            color: '#e6e9f0',
            offsetCenter: [0, '0%'],
            formatter: (v: number) => String(Math.round(v * 10) / 10),
          },
          data: [{ value: a.score.total, name: L('综合评分', 'Overall score') }],
        },
      ],
    }),
    [a.score.total, lang],
  )

  const radarOption = useMemo(() => scoreRadarOption(a.dimensions, lang), [a.dimensions, lang])

  const competition = a.competition
  const cross = a.crossMarket
  const timing = a.timing
  const conditions = a.conditions
  const barriers = a.barriers
  const execution = a.execution

  const windowMonths = a.windowMonths || ''
  const executionPhases = [
    { phase: '0–30', title: L('启动与落地', 'Launch'), value: findField(execution, ['phase_0_30_days', 'days_0_30', 'd0_30']) },
    { phase: '30–90', title: L('增长与首笔收入', 'Growth & first revenue'), value: findField(execution, ['phase_30_90_days', 'days_30_90', 'd30_90']) },
    { phase: '90+', title: L('里程碑与扩量', 'Milestones & scale'), value: findField(execution, ['milestones', 'scale', 'phase_90_plus_days']) },
  ].filter((x) => x.value != null && textOf(x.value).trim() !== '')

  const crossRows = [
    [L('可迁移市场', 'Target markets'), findField(cross, ['target_markets', 'targets', 'markets'])],
    [L('套利类型', 'Arbitrage type'), findField(cross, ['arbitrage_type', 'arbitrage'])],
    [L('迁移原因', 'Why transferable'), findField(cross, ['why_migratable', 'why'])],
    [L('本地化需求', 'Localization needs'), findField(cross, ['localization_needs', 'localization'])],
    [L('定价权', 'Pricing power'), findField(cross, ['pricing_power'])],
  ].filter(([, v]) => v != null && textOf(v).trim() !== '')

  const conditionRows = [
    [L('启动资金', 'Startup capital'), fmtCnyRange(econ.investment.total.min, econ.investment.total.max)],
    [L('技能要求', 'Skills'), conditions.skills],
    [L('资质 / 许可', 'Licenses'), conditions.licenses],
    [L('供应链', 'Supply chain'), conditions.supply_chain],
    [L('伙伴', 'Partners'), conditions.partners],
    [L('团队 / 启动时间', 'Team / launch time'), [conditions.team, conditions.time_to_launch_months != null ? `${conditions.time_to_launch_months} ${L('个月', 'mo')}` : ''].filter(Boolean)],
  ].filter(([, v]) => v != null && textOf(v).trim() !== '')

  const barrierRows = [
    [L('监管 / 合规', 'Regulatory'), barriers.regulatory],
    [L('技术', 'Technical'), barriers.technical],
    [L('资金', 'Capital'), barriers.capital],
    [L('品牌', 'Brand'), barriers.brand],
    [L('渠道', 'Channel'), barriers.channel],
  ].filter(([, v]) => v != null && textOf(v).trim() !== '')

  const timingNarr = a.narrative.timing || (isObj(timing) ? textOf(timing.why_now) : '')
  const catalysts = isObj(timing) ? timing.catalysts : undefined

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* 返回 + 面包屑 */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-dim">
        <Link to="/rankings" className="inline-flex items-center gap-1 rounded border border-line/70 px-2 py-1 text-muted hover:border-line-strong hover:text-ink">
          <ChevronLeft className="h-3.5 w-3.5" /> {L('商机榜', 'Opportunity board')}
        </Link>
        <span className="font-mono text-[12px]">/ {a.kind === 'candidate' ? 'candidates' : 'opportunities'} / {a.id}</span>
        <span className="ml-auto font-mono text-[12px]">{L('数据基准', 'Data as of')} {dataAsOf} · v{dataMeta.data_version || '1.5.0'}</span>
      </div>

      {/* 决策头 */}
      <section className="mb-6 overflow-hidden rounded-xl border border-line/70 bg-panel/70">
        <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={a.kind === 'candidate' ? 'cyan' : 'signal'}>{a.kind === 'candidate' ? L('自动发现', 'Auto-discovered') : L('精选机会', 'Curated')}</Badge>
              <span className="inline-flex items-center gap-1.5 rounded border border-line/70 px-2 py-0.5 text-[12.5px] text-muted">
                <span className="h-1.5 w-1.5 rounded-sm" style={{ background: a.industryColor }} />
                {lang === 'en' ? a.industryEn : a.industryZh}
              </span>
              {a.eventType && <span className="rounded border border-amber/30 bg-amber/[0.06] px-2 py-0.5 text-[12.5px] text-amber">{lang === 'en' ? a.eventTypeEn : a.eventTypeZh}</span>}
              <span className="rounded border border-cyan/25 bg-cyan/[0.05] px-2 py-0.5 text-[12.5px] text-cyan">{lang === 'en' ? a.windowStageEn : a.windowStageZh}{windowMonths ? ` · ${windowMonths} ${L('个月', 'mo')}` : ''}</span>
            </div>
            <h1 className="mt-3 text-[28px] font-semibold leading-[1.25] tracking-tight text-ink sm:text-[32px]">{a.title}</h1>
            {a.titleOriginal && a.titleOriginal !== a.title && (
              <div className="mt-1.5 text-[13px] leading-relaxed text-dim">
                {L('原文', 'Original')}：{a.titleOriginal}
              </div>
            )}
            <p className="mt-3 max-w-[980px] text-[16px] leading-[1.8] text-ink/90">{a.thesis}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {a.tags.map((tag) => (
                <span key={`${tag.kind}-${tag.id}`} className="rounded-full border border-line/70 bg-panel-2/40 px-2.5 py-1 text-[12px] text-muted">
                  {lang === 'en' ? tag.labelEn : tag.labelZh}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-dim">
              {a.sourceName && (
                <span>
                  {L('来源', 'Source')}：{a.sourceUrl ? <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="text-cyan hover:underline">{a.sourceName} <ExternalLink className="inline h-3 w-3" /></a> : a.sourceName}
                </span>
              )}
              <span>{L('首次发现', 'First seen')} {fmtDate(a.firstSeen)}</span>
              {a.evidenceCount > 0 && <span>{L('证据', 'Evidence')} {a.evidenceCount} {L('条', 'items')}</span>}
              {a.confidence != null && <span>{L('置信度', 'Confidence')} {a.confidence}</span>}
            </div>
          </div>

          <div className="xl:col-span-4">
            <div className="flex h-full items-center gap-3 rounded-lg border border-line/60 bg-panel-2/30 p-4">
              <div className="min-w-0 flex-1">
                <Chart option={gaugeOption} height={176} />
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[12.5px] text-dim">{L('评分等级', 'Grade')}</div>
                <div className="mt-1 inline-flex rounded bg-signal/15 px-2.5 py-1 text-[22px] font-semibold leading-none text-signal">{a.score.grade}</div>
                <div className="mt-3 text-[12.5px] leading-relaxed text-dim">
                  {L('10 维加权', '10-dim weighted')}
                  <br />
                  {L('理论测算', 'Theoretical')} · {theoryNote}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 常显 */}
        <div className="grid grid-cols-2 gap-px border-t border-line/60 bg-line/40 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: L('启动资金', 'Startup capital'), value: fmtCnyRange(econ.investment.total.min, econ.investment.total.max), sub: L('9 类拆项', '9 items') },
            { label: L('客单价', 'Avg. order value'), value: fmtCnyRange(econ.ranges.aov.min, econ.ranges.aov.max), sub: L('理论区间', 'Theory range') },
            { label: L('理论单量', 'Orders / month'), value: `${fmtInt(econ.base.orders)} ${L('单/月', '/mo')}`, sub: L('基准情景', 'Base case') },
            { label: L('毛利率', 'Gross margin'), value: marginLabel, sub: L('数据区间', 'Data range') },
            {
              label: L('理论回本', 'Payback'),
              value: econ.base.paybackMonths > 0 ? `${econ.base.paybackMonths.toFixed(1)} ${L('个月', 'mo')}` : '—',
              sub: econ.paybackTarget ? `${L('数据目标', 'Target')} ${econ.paybackTarget} ${L('个月', 'mo')}` : L('理论测算', 'Theoretical'),
            },
            {
              label: L('理论月净利', 'Net profit / mo'),
              value: fmtCny(econ.base.netProfit),
              sub: `${signedCny(econ.ranges.netProfit.min)} – ${signedCny(econ.ranges.netProfit.max)} ${L('区间', 'range')} · ${L('理论', 'theory')}`,
            },
          ].map((k) => (
            <div key={k.label} className="bg-panel/80 px-4 py-3">
              <div className="text-[12px] text-dim">{k.label}</div>
              <div className="num mt-1 truncate text-[20px] font-semibold text-ink">{k.value}</div>
              <div className="mt-1 truncate text-[11.5px] text-dim">{k.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 锚点导航（唯一一份，无侧栏重复） */}
      <nav className="sticky top-[52px] z-20 -mx-1 mb-5 flex gap-1 overflow-x-auto rounded-lg border border-line/70 bg-bg/90 px-1.5 py-1.5 backdrop-blur-md">
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="shrink-0 rounded px-2.5 py-1 text-[12.5px] text-muted transition-colors hover:bg-white/[0.04] hover:text-ink"
          >
            <span className="mr-1 font-mono text-[11px] text-dim">{String(i + 1).padStart(2, '0')}</span>
            {L(s.zh, s.en)}
          </button>
        ))}
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="ml-auto shrink-0 rounded px-2.5 py-1 text-[12.5px] text-dim hover:text-ink">
          ↑ {L('顶部', 'Top')}
        </button>
      </nav>

      <div className="space-y-8">
        <Section id="economics" index="01" title={L('经济性驾驶舱 · 投资、单位经济、回本与敏感性', 'Economics cockpit · investment, unit economics, payback & sensitivity')} sub={L('所有可图形化的经济数据都在这里：启动资金拆项、单位经济、收入结构、回本曲线、月收入利润、单量敏感性；滑杆可实时重算。理论测算，非实盘验证。', 'Every graphable economic number: capital breakdown, unit economics, revenue mix, payback curve, monthly revenue/profit and order sensitivity. Sliders recompute live. Theoretical, not live-tested.')}>
          <EconCockpit model={econ} />
        </Section>

        <Section id="judgment" index="02" title={L('核心判断 · 为什么成立、缺口在哪、何时失效', 'Core thesis · why it works, where the gap is, when it fails')} sub={L('结论先行；下面三块分别是机会逻辑、市场缺口与失效边界。', 'Conclusion first: opportunity logic, market gap and falsification boundary.')}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-4">
              <InfoCard title={L('机会逻辑', 'Opportunity logic')}>{localizedText(a.narrative.verdict || a.verdict, lang)}</InfoCard>
              <InfoCard title={L('市场缺口', 'Market gap')}>{localizedText(a.narrative.market || a.market, lang)}</InfoCard>
            </div>
            <div className="lg:col-span-5 space-y-4">
              <InfoCard title={L('失效边界（何时不该做）', 'Falsification boundary')} className="border-amber/30 bg-amber/[0.04]">
                {a.boundary.length ? (
                  <ul className="space-y-2">
                    {a.boundary.map((x, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-amber" />
                        <span>{localizedText(x, lang)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-dim">—</span>
                )}
              </InfoCard>
              {(a.risks.length > 0 || a.killCriteria.length > 0) && (
                <InfoCard title={L('主要风险 / 止损线', 'Key risks / kill criteria')}>
                  <ul className="space-y-2">
                    {[...a.risks.slice(0, 4), ...a.killCriteria.slice(0, 3)].map((x, i) => (
                      <li key={i} className="flex gap-2 text-[13.5px]">
                        <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-danger/80" />
                        <span>{localizedText(x, lang)}</span>
                      </li>
                    ))}
                  </ul>
                </InfoCard>
              )}
            </div>
          </div>
        </Section>

        <Section id="score" index="03" title={L('10 维判断依据', '10-dimension rationale')} sub={L('雷达看结构，右侧逐维看分数、判断理由与本条使用的数据。', 'Radar shows structure; right side shows each score with rationale and data used.')}>
          <Panel className="p-5">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="xl:col-span-5">
                <Chart option={radarOption} height={360} />
                <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[12.5px] text-dim">
                  <div className="rounded border border-line/50 px-2 py-1.5">
                    {L('综合评分', 'Overall')} <span className="num ml-1 text-[15px] text-signal">{fmtScore(a.score.total)}</span>
                  </div>
                  <div className="rounded border border-line/50 px-2 py-1.5">
                    {L('等级', 'Grade')} <span className="num ml-1 text-[15px] text-signal">{a.score.grade}</span>
                  </div>
                </div>
              </div>
              <div className="xl:col-span-7">
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                  {a.dimensions.map((d) => (
                    <div key={d.key}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[14px] font-medium text-ink">{lang === 'en' ? d.labelEn : d.labelZh}</span>
                        <span className="num text-[14px] text-signal">{fmtScore(d.score)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded bg-line/70">
                        <div className="h-full rounded bg-signal" style={{ width: `${Math.max(0, Math.min(100, d.score * 10))}%` }} />
                      </div>
                      {d.rationale && <div className="mt-1 text-[12.5px] leading-[1.65] text-muted">{localizedText(d.rationale, lang)}</div>}
                      {d.dataUsed && <div className="mt-0.5 text-[11.5px] leading-relaxed text-dim">{L('数据：', 'Data: ')}{localizedText(d.dataUsed, lang)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </Section>

        {a.canvas.length > 0 && (
          <Section id="canvas" index="04" title={L('商业画布 · 9 格', 'Business canvas · 9 blocks')} sub={L('客户是谁、卖什么、怎么触达、靠什么交付、钱怎么进怎么出。', 'Who the customer is, what is sold, how it is reached, what delivers it and how money flows.')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {a.canvas.map((block) => (
                <div key={block.key} className="rounded-lg border border-line/60 bg-panel-2/25 p-4">
                  <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wider text-muted">{lang === 'en' ? block.labelEn : block.labelZh}</div>
                  <div className="text-[13.5px] leading-[1.75] text-ink/85">
                    <ValueText value={block.value} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section id="competition" index="05" title={L('竞争与跨市场', 'Competition & cross-market')} sub={L('直接/间接竞品与替代方案，以及同一机会迁移到其他市场的套利与本地化成本。', 'Direct/indirect competitors and substitutes, plus arbitrage and localization cost of moving the opportunity to other markets.')}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Panel className="p-5 lg:col-span-7">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[15px] font-semibold text-ink">{L('竞争与差异化', 'Competition & differentiation')}</div>
                <Badge tone="muted">{a.competitionRows.length} {L('项', 'items')}</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead className="text-[12px] text-dim">
                    <tr className="border-b border-line/60">
                      <th className="py-2 pr-3 font-normal">{L('类型', 'Type')}</th>
                      <th className="py-2 font-normal">{L('内容', 'Detail')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.competitionRows.map((row) => (
                      <tr key={row.key} className="border-b border-line/30 align-top">
                        <td className="w-[120px] py-2.5 pr-3 text-muted">{lang === 'en' ? row.labelEn : row.labelZh}</td>
                        <td className="py-2.5 leading-[1.7] text-ink/85">
                          <ValueText value={row.value} />
                        </td>
                      </tr>
                    ))}
                    {!a.competitionRows.length && (
                      <tr>
                        <td colSpan={2} className="py-3 text-dim">—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel className="p-5 lg:col-span-5">
              <div className="mb-3 text-[15px] font-semibold text-ink">{L('跨市场机会', 'Cross-market opportunity')}</div>
              <div className="space-y-3">
                {crossRows.map(([label, value]) => (
                  <div key={String(label)} className="rounded border border-line/50 bg-panel-2/25 px-3 py-2.5">
                    <div className="text-[12px] text-dim">{label as string}</div>
                    <div className="mt-1 text-[13.5px] leading-[1.7] text-ink/85">
                      <ValueText value={value} />
                    </div>
                  </div>
                ))}
                {!crossRows.length && <div className="text-dim">—</div>}
              </div>
            </Panel>
          </div>
        </Section>

        <Section id="execution" index="06" title={L('时机、条件与执行路线', 'Timing, conditions & execution')} sub={L('现在能不能做、需要什么门槛、0–90 天怎么落地。', 'Whether now is the window, what thresholds are needed, and how to execute in 0–90 days.')}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Panel className="p-5 lg:col-span-5">
              <div className="mb-3 text-[15px] font-semibold text-ink">{L('时机窗口', 'Timing window')}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="cyan">{lang === 'en' ? a.windowStageEn : a.windowStageZh}</Badge>
                {windowMonths && <Badge tone="amber">{windowMonths} {L('个月', 'mo')}</Badge>}
                {a.urgency && <Badge tone="muted">{L('紧迫度', 'Urgency')} {urgencyLabel(a.urgency, lang)}</Badge>}
              </div>
              <p className="mt-3 text-[14px] leading-[1.8] text-ink/85">{localizedText(timingNarr, lang) || '—'}</p>
              {catalysts ? (
                <div className="mt-3">
                  <div className="text-[12px] text-dim">{L('催化剂', 'Catalysts')}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(Array.isArray(catalysts) ? catalysts : [catalysts]).slice(0, 6).map((x, i) => (
                      <span key={i} className="rounded-full border border-cyan/25 bg-cyan/[0.05] px-2.5 py-0.5 text-[12px] text-cyan/90">{textOf(x)}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              {barrierRows.length > 0 && (
                <div className="mt-4 border-t border-line/40 pt-3">
                  <div className="mb-2 text-[12px] text-dim">{L('进入门槛', 'Entry barriers')}</div>
                  <div className="space-y-1.5 text-[13.5px] leading-[1.7] text-ink/85">
                    {barrierRows.map(([label, value]) => (
                      <div key={String(label)} className="flex gap-2">
                        <span className="w-[74px] shrink-0 text-dim">{label as string}</span>
                        <span className="min-w-0 flex-1"><ValueText value={value} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <Panel className="p-5 lg:col-span-7">
              <div className="mb-3 text-[15px] font-semibold text-ink">{L('条件清单', 'Conditions checklist')}</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {conditionRows.map(([label, value]) => (
                  <div key={String(label)} className="rounded border border-line/50 bg-panel-2/25 px-3 py-2">
                    <div className="text-[12px] text-dim">{label as string}</div>
                    <div className="mt-0.5 text-[13.5px] leading-[1.65] text-ink/85">
                      <ValueText value={value} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {(executionPhases.length > 0 || findField(execution, ['first_revenue_path']) != null) && (
            <Panel className="mt-4 p-5">
              <div className="mb-3 text-[15px] font-semibold text-ink">{L('执行方案', 'Execution plan')}</div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {executionPhases.map((step, i) => (
                  <div key={step.phase} className="rounded-lg border border-line/60 bg-panel-2/25 p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-signal/40 bg-signal/10 font-mono text-[12px] text-signal">{step.phase}</span>
                      <span className="text-[14px] font-medium text-ink">{step.title}</span>
                      <span className="ml-auto font-mono text-[11px] text-dim">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="mt-2 text-[13.5px] leading-[1.75] text-ink/85">
                      <ValueText value={step.value} />
                    </div>
                  </div>
                ))}
              </div>
              {findField(execution, ['first_revenue_path']) != null && (
                <div className="mt-3 rounded-lg border border-signal/25 bg-signal/[0.05] px-4 py-3">
                  <div className="text-[12px] text-signal/80">{L('首笔收入路径', 'First revenue path')}</div>
                  <div className="mt-1 text-[14px] leading-[1.75] text-ink/90">
                    <ValueText value={findField(execution, ['first_revenue_path'])} />
                  </div>
                </div>
              )}
            </Panel>
          )}
        </Section>

        <Section id="evidence" index="07" title={L('来源与证据', 'Sources & evidence')} sub={L('所有结论应能回溯到公开来源；自动发现候选未做人工核验，使用前请打开原始链接复核。', 'Every conclusion should trace to a public source; auto-discovered candidates are not manually verified—open the original links before acting.')}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {a.evidence.map((e, i) => (
              <a key={`${e.url}-${i}`} href={e.url} target="_blank" rel="noreferrer" className="group flex flex-col rounded-lg border border-line/60 bg-panel-2/25 p-4 transition-colors hover:border-line-strong">
                <div className="line-clamp-2 text-[14px] font-medium leading-[1.6] text-ink group-hover:text-signal">{e.title || e.url} <ExternalLink className="inline h-3 w-3 opacity-60" /></div>
                {e.quote && <div className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-muted">“{e.quote}”</div>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[12px] text-dim">
                  <span className="truncate">{e.publisher}</span>
                  <span className="shrink-0">{e.date}</span>
                </div>
              </a>
            ))}
            {!a.evidence.length && <div className="text-dim">—</div>}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="rounded-lg border border-amber/25 bg-amber/[0.05] px-4 py-3 text-[13px] leading-[1.75] text-amber lg:col-span-8">
              <ShieldAlert className="mr-1.5 inline h-4 w-4" />
              {L('自动发现与系统评估的商机线索，仅作研究参考，不构成投资建议；经济数据为理论测算，非实盘验证；能否赚钱取决于你的执行与市场真实成交。', 'Auto-discovered and system-assessed leads are for research only and not investment advice. Economic figures are theoretical, not live-tested; outcomes depend on your execution and real market transactions.')}
            </div>
            <div className="rounded-lg border border-line/60 bg-panel-2/25 px-4 py-3 text-[12px] leading-relaxed text-dim lg:col-span-4">
              <div className="text-[12px] text-muted">{L('数据与口径', 'Data & basis')}</div>
              <div className="mt-1.5 space-y-0.5">
                <div>{L('数据基准', 'As of')}：{fmtDate(dataAsOf)} · data {dataMeta.data_version || '—'}</div>
                <div>{L('经济字段', 'Economic fields')}：roi / investment_breakdown / unit_economics / profit_model</div>
                <div>{L('测算声明', 'Theory note')}：{econ.investment.calibrated ? L('投资分项已按 ROI 区间校准', 'Capital items calibrated to ROI range') : L('共 9 类投入拆项', '9 capital items')}</div>
                {a.kind === 'curated' && <div>{L('精选评估', 'Curated assessment')}：{L('与自动候选同一套详情', 'same detail set as auto candidates')}</div>}
              </div>
            </div>
          </div>

          {a.sevenQuestions.length > 0 && (
            <div className="mt-4 rounded-lg border border-line/60 bg-panel-2/20 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[12px] font-medium uppercase tracking-wider text-muted">{L('原始七问（数据底稿，已在上方结构化）', 'Original seven questions (raw draft, structured above)')}</div>
                <span className="font-mono text-[11px] text-dim">{a.sevenQuestions.length}/7</span>
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
                {a.sevenQuestions.map((q) => (
                  <div key={q.key} className="text-[12.5px] leading-[1.7]">
                    <span className="text-dim">{lang === 'en' ? q.labelEn : q.labelZh}：</span>
                    <span className="text-muted">{localizedText(q.value, lang)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link to="/rankings" className="inline-flex h-9 items-center gap-1.5 rounded border border-line bg-panel-2 px-3 text-[13px] text-muted hover:border-line-strong hover:text-ink">
              <ChevronLeft className="h-4 w-4" /> {L('返回商机榜', 'Back to the board')}
            </Link>
            {a.sourceUrl && (
              <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded border border-signal/40 bg-signal/10 px-3 text-[13px] text-signal hover:bg-signal/20">
                {L('打开原始来源', 'Open original source')} <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
            <span className="ml-auto font-mono text-[11.5px] text-dim">{a.kind === 'candidate' ? 'auto-discovered' : 'curated'} · {a.id}</span>
          </div>
        </Section>
      </div>
    </div>
  )
}
