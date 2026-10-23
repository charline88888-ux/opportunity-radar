/**
 * 经济性驾驶舱：启动资金明细 / 单位经济 / 回本曲线 / 月收入利润 / 收入结构 / 敏感性
 * 交互滑杆只用于图表探索，核心 KPI 与结论始终可见。
 */
import { useEffect, useMemo, useState } from 'react'
import { RotateCcw, ShieldAlert, SlidersHorizontal } from 'lucide-react'
import { Badge, Panel, Slider } from '@/components/ui'
import { Chart } from '@/components/charts/Chart'
import {
  capitalBreakdownOption,
  monthlyProfitOption,
  paybackCurveOption,
  revenueStructureOption,
  sensitivityOption,
  unitEconomicsOption,
} from '@/components/charts/econ-options'
import type { EconomicsModel, EconParams } from '@/lib/economics'
import { recompute } from '@/lib/economics'
import { useI18n } from '@/lib/i18n'
import { cn, fmtCny, fmtCnyFull, fmtCnyRange, fmtInt, fmtPct } from '@/lib/utils'

function DataOriginBadge({ origin, lang }: { origin: 'data' | 'calibrated' | 'derived'; lang: 'zh' | 'en' }) {
  const map = {
    data: { zh: '数据字段', en: 'Data field', tone: 'signal' as const },
    calibrated: { zh: '按 ROI 校准', en: 'ROI-calibrated', tone: 'cyan' as const },
    derived: { zh: '系统推导', en: 'Derived', tone: 'muted' as const },
  }
  const item = map[origin]
  return <Badge tone={item.tone}>{lang === 'en' ? item.en : item.zh}</Badge>
}

function ReportPanel({
  title,
  sub,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: string
  sub?: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Panel className={cn('p-4', className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight text-ink">{title}</div>
          {sub && <div className="mt-0.5 text-[12.5px] leading-relaxed text-dim">{sub}</div>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </Panel>
  )
}

const signedCny = (n: number) => `${n < 0 ? '-' : ''}¥${fmtCny(Math.abs(n))}`

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: 'signal' | 'amber' | 'danger' | 'cyan' }) {
  const color = tone === 'signal' ? 'text-signal' : tone === 'amber' ? 'text-amber' : tone === 'danger' ? 'text-danger' : tone === 'cyan' ? 'text-cyan' : 'text-ink'
  return (
    <div className="min-w-0 rounded-lg border border-line/70 bg-panel-2/40 px-3.5 py-3">
      <div className="text-[12px] text-dim">{label}</div>
      <div className={cn('num mt-1 truncate text-[22px] font-semibold leading-none', color)}>{value}</div>
      {sub && <div className="mt-1.5 truncate text-[12px] text-dim">{sub}</div>}
    </div>
  )
}

export function EconCockpit({ model }: { model: EconomicsModel }) {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const defaults = useMemo<EconParams>(
    () => ({
      aov: Math.max(1, model.base.aov),
      orders: Math.max(1, model.base.orders),
      marginPct: model.base.marginPct,
      fixedCost: Math.round(model.base.fixedCost),
    }),
    [model],
  )
  const [params, setParams] = useState<EconParams>(defaults)
  useEffect(() => setParams(defaults), [defaults])
  const calc = useMemo(() => recompute(model, params), [model, params])
  const [rampView, setRampView] = useState(false)

  const aovMin = Math.max(1, Math.round(model.ranges.aov.min * 0.6))
  const aovMax = Math.max(aovMin + 2, Math.round(model.ranges.aov.max * 1.4))
  const ordersMax = Math.max(10, Math.round(model.base.orders * 2.2))
  const fixedMax = Math.max(1000, Math.round(Math.max(model.base.fixedCost, model.base.grossProfit) * 1.6))

  const capitalRows = [...model.investment.items].sort((a, b) => b.max - a.max)
  const theory = L('理论测算 · 非实盘验证', 'Theoretical model · not live-tested')
  const sourceLabel = (origin: 'data' | 'calibrated' | 'derived') =>
    origin === 'data' ? L('数据字段', 'Data') : origin === 'calibrated' ? L('ROI 校准', 'ROI-calibrated') : L('系统推导', 'Derived')

  return (
    <div className="space-y-4">
      {/* 结论条：核心数字始终可见 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={L('理论月收入', 'Theoretical revenue / mo')} value={fmtCny(calc.revenue)} sub={`${fmtCny(model.ranges.revenue.min)}–${fmtCny(model.ranges.revenue.max)}`} tone="cyan" />
        <Kpi label={L('理论月毛利', 'Gross profit / mo')} value={fmtCny(calc.grossProfit)} sub={`${L('毛利率', 'Margin')} ${fmtPct(params.marginPct * 100, 1)}`} tone="signal" />
        <Kpi
          label={L('理论月净利', 'Net profit / mo')}
          value={fmtCny(calc.netProfit)}
          sub={`${signedCny(model.ranges.netProfit.min)} – ${signedCny(model.ranges.netProfit.max)} ${L('区间', 'range')}`}
          tone={calc.netProfit >= 0 ? 'signal' : 'danger'}
        />
        <Kpi label={L('理论回本（稳态）', 'Payback (steady)')} value={calc.paybackMonths > 0 ? `${calc.paybackMonths.toFixed(1)} ${L('个月', 'mo')}` : '—'} sub={model.paybackTarget ? `${L('数据目标', 'Target')} ${model.paybackTarget} ${L('个月', 'mo')}` : undefined} tone="amber" />
        <Kpi label={L('盈亏平衡单量', 'Break-even orders')} value={`${fmtInt(calc.breakevenOrders)} ${L('单/月', '/mo')}`} sub={`${L('当前测算', 'Current')} ${fmtInt(params.orders)} ${L('单/月', '/mo')}`} />
        <Kpi label={L('启动资金', 'Startup capital')} value={fmtCnyRange(model.investment.total.min, model.investment.total.max)} sub={`${L('9 类拆项 · 数据字段', '9 items · data fields')}`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber/25 bg-amber/[0.05] px-3 py-2 text-[12.5px] leading-relaxed text-amber">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        <span>{theory}：</span>
        <span className="text-amber/85">
          {L(
            '投入、客单、单量、毛利与回本均由真实字段（ROI / investment_breakdown / unit_economics / profit_model）按公式推导，可能与你所在市场的报价与成交不同；不构成收入承诺。',
            'Investment, AOV, volume, margin and payback are derived by formula from real data fields (ROI / investment_breakdown / unit_economics / profit_model). They may differ from your market and are not a revenue promise.',
          )}
        </span>
      </div>

      {/* 启动资金拆项 */}
      <ReportPanel
        title={L('启动资金明细 · 9 类拆项', 'Startup capital breakdown · 9 items')}
        sub={L('每类给出理论 min–max 与依据；合计与 ROI 启动资金一致。', 'Theoretical min–max and basis for each item; total matches ROI startup capital.')}
        right={
          <>
            <DataOriginBadge origin={model.sources.investment} lang={lang} />
            <span className="num whitespace-nowrap text-[13px] text-ink">{fmtCnyRange(model.investment.total.min, model.investment.total.max)}</span>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Chart option={capitalBreakdownOption(model, lang)} height={360} />
            <div className="mt-1 text-[11.5px] text-dim">{L('横轴：投入金额（元）· 纵轴：9 类投入项 · 悬浮查看依据', 'X: amount (CNY) · Y: 9 items · hover for basis')}</div>
          </div>
          <div className="min-w-0 lg:col-span-7">
            <div className="max-h-[360px] overflow-auto rounded border border-line/50">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-[1] bg-panel-2 text-[12px] text-dim">
                  <tr>
                    <th className="px-3 py-2 font-normal">{L('投入项', 'Item')}</th>
                    <th className="px-3 py-2 text-right font-normal">{L('理论区间', 'Range')}</th>
                    <th className="px-3 py-2 font-normal">{L('依据', 'Basis')}</th>
                  </tr>
                </thead>
                <tbody>
                  {capitalRows.map((item) => (
                    <tr key={item.key} className="border-t border-line/40 align-top">
                      <td className="px-3 py-1.5 text-[13px] text-ink">
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-sm" style={{ background: '#4cc9f0' }} />
                        {lang === 'en' ? item.labelEn : item.labelZh}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right num text-[12.5px] text-ink">{fmtCnyRange(item.min, item.max)}</td>
                      <td className="px-3 py-1.5 text-[12.5px] leading-relaxed text-muted">{item.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-dim">
              {L('校准说明：', 'Calibration: ')}
              {model.investment.calibrated
                ? L('数据分项合计与 ROI 启动资金不一致，已按 ROI 区间等比校准（保留原始比例与依据）。', 'Item totals differed from ROI capital; scaled proportionally to the ROI range (original ratios and basis kept).')
                : model.sources.investment === 'data'
                  ? L('直接读取数据字段，分项合计 = ROI 启动资金。', 'Read from data fields; item totals = ROI startup capital.')
                  : L('数据无分项，按行业默认比例推导。', 'No item data; derived from industry-default ratios.')}
            </div>
          </div>
        </div>
      </ReportPanel>

      {/* 单位经济 + 收入结构 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ReportPanel
          className="xl:col-span-7"
          title={L('单位经济 · 客单价 → 成本 → 毛利 → 净贡献', 'Unit economics · AOV → cost → margin → net')}
          sub={L('按当前假设拆到「每单」，把商业模式是否成立讲清楚。', 'Broken down per order under current assumptions.')}
          right={<DataOriginBadge origin={model.sources.aov} lang={lang} />}
        >
          <Chart option={unitEconomicsOption(model, calc, lang)} height={270} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded border border-line/50 bg-panel-2/30 px-2 py-1.5">
              <div className="text-[11.5px] text-dim">{L('客单价区间', 'AOV range')}</div>
              <div className="num text-[13px] text-ink">{fmtCnyRange(model.ranges.aov.min, model.ranges.aov.max)}</div>
            </div>
            <div className="rounded border border-line/50 bg-panel-2/30 px-2 py-1.5">
              <div className="text-[11.5px] text-dim">{L('单位成本', 'Unit cost')}</div>
              <div className="num text-[13px] text-ink">{fmtCny(calc.unitCost)}</div>
            </div>
            <div className="rounded border border-line/50 bg-panel-2/30 px-2 py-1.5">
              <div className="text-[11.5px] text-dim">{L('单品净贡献', 'Unit net')}</div>
              <div className={cn('num text-[13px]', calc.unitNetProfit >= 0 ? 'text-signal' : 'text-danger')}>{fmtCny(calc.unitNetProfit)}</div>
            </div>
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-dim">
            {L('成本明细：', 'Cost items: ')}
            {model.unitCostItems.map((x) => `${x.name} ${fmtCnyRange(x.min, x.max)}`).join('；')}
          </div>
        </ReportPanel>

        <ReportPanel
          className="xl:col-span-5"
          title={L('收入结构 · 理论月收入', 'Revenue mix · theoretical monthly revenue')}
          sub={L('按收入项拆分，避免只看一个总收入数字。', 'Split by revenue stream instead of one aggregate number.')}
          right={<DataOriginBadge origin="data" lang={lang} />}
        >
          <Chart option={revenueStructureOption(model, lang)} height={250} />
          <div className="mt-1 space-y-1.5">
            {model.revenueStreams.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate text-muted">{s.name}</span>
                <span className="num shrink-0 text-ink">{fmtPct(s.sharePct, 0)}</span>
                <span className="num w-[120px] shrink-0 text-right text-dim">{fmtCnyRange(s.amountMin, s.amountMax)}</span>
              </div>
            ))}
          </div>
        </ReportPanel>
      </div>

      {/* 回本 / 月收入利润 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ReportPanel
          className="xl:col-span-7"
          title={L('回本曲线 · 累计现金流', 'Payback curve · cumulative cash flow')}
          sub={L('启动资金为初始投入；曲线穿越 0 的月份即理论回本点。', 'Startup capital is the initial outlay; the month the curve crosses 0 is the theoretical payback point.')}
          right={
            <div className="inline-flex overflow-hidden rounded border border-line">
              {[
                { key: false, zh: '稳态', en: 'Steady' },
                { key: true, zh: '含爬坡', en: 'With ramp' },
              ].map((opt) => (
                <button
                  key={String(opt.key)}
                  type="button"
                  onClick={() => setRampView(opt.key)}
                  className={cn('px-2.5 py-1 text-[12px]', rampView === opt.key ? 'bg-signal/15 text-signal' : 'text-dim hover:text-muted')}
                >
                  {L(opt.zh, opt.en)}
                </button>
              ))}
            </div>
          }
        >
          <Chart option={paybackCurveOption(model, calc, rampView, lang)} height={260} />
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-dim">
            <span>
              {L('稳态回本', 'Steady payback')}：<span className="num text-ink">{calc.paybackMonths > 0 ? `${calc.paybackMonths.toFixed(1)} ${L('个月', 'mo')}` : '—'}</span>
            </span>
            <span>
              {L('含爬坡回本', 'With ramp')}：<span className="num text-amber">{calc.rampPaybackMonths != null ? `${calc.rampPaybackMonths} ${L('个月', 'mo')}` : L('18 个月内未回本', 'not within 18 months')}</span>
            </span>
            <span>{L('爬坡按首单/收入爬升期', 'Ramp uses time-to-revenue')} {model.rampMonths} {L('个月估算', 'months')}</span>
          </div>
        </ReportPanel>

        <ReportPanel
          className="xl:col-span-5"
          title={L('月收入 / 毛利 / 净利（爬坡期）', 'Monthly revenue / gross / net (ramp)')}
          sub={L('前 12 个月的月度现金流形态。', 'Monthly cash-flow shape for the first 12 months.')}
        >
          <Chart option={monthlyProfitOption(calc, lang)} height={260} />
          <div className="mt-1 text-[11.5px] text-dim">{L('柱：月收入 / 月毛利 · 线：月净利（含爬坡）', 'Bars: revenue / gross profit · line: net profit (with ramp)')}</div>
        </ReportPanel>
      </div>

      {/* 敏感性 + 假设调节 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ReportPanel
          className="xl:col-span-7"
          title={L('敏感性 · 单量 → 月净利', 'Sensitivity · orders → monthly net profit')}
          sub={L('固定其他假设，只看单量变化对利润的影响；标出基准点与盈亏平衡。', 'Holding other assumptions fixed, vary orders to see profit impact; base and break-even points are marked.')}
        >
          <Chart option={sensitivityOption(model, calc, lang)} height={250} />
          <div className="mt-1 text-[11.5px] text-dim">{L('横轴：月单量 · 纵轴：月净利 · 绿点为基准，黄点为盈亏平衡', 'X: orders/month · Y: monthly net profit · green = base, amber = break-even')}</div>
          <div className="mt-1 text-[12px] text-dim">
            {L('盈亏平衡单量', 'Break-even orders')}：<span className="num text-amber">{fmtInt(calc.breakevenOrders)}</span>
            {' · '}
            {L('当前测算', 'Current')}：<span className="num text-ink">{fmtInt(params.orders)}</span>
            {' · '}
            {L('基准单量（数据推导）', 'Base orders (data)')}：<span className="num text-ink">{fmtInt(model.base.orders)}</span>
          </div>
        </ReportPanel>

        <ReportPanel
          className="xl:col-span-5"
          title={L('测算假设 · 可调', 'Assumptions · adjustable')}
          sub={L('拖动仅改变测算结果，不改变数据与结论；重置恢复数据推导基准。', 'Sliders only change the model, not the data or verdict; reset restores data-derived defaults.')}
          right={
            <button type="button" onClick={() => setParams(defaults)} className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-[12px] text-muted hover:text-ink">
              <RotateCcw className="h-3 w-3" /> {L('重置', 'Reset')}
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                label: L('客单价', 'Avg. order value'),
                value: params.aov,
                min: aovMin,
                max: aovMax,
                step: Math.max(1, Math.round((aovMax - aovMin) / 120)),
                format: fmtCnyFull,
                onChange: (v: number) => setParams((p) => ({ ...p, aov: v })),
              },
              {
                label: L('月单量', 'Orders / month'),
                value: params.orders,
                min: 1,
                max: ordersMax,
                step: Math.max(1, Math.round(ordersMax / 120)),
                format: (v: number) => `${fmtInt(v)} ${L('单', 'orders')}`,
                onChange: (v: number) => setParams((p) => ({ ...p, orders: v })),
              },
              {
                label: L('毛利率', 'Gross margin'),
                value: Math.round(params.marginPct * 1000) / 10,
                min: 5,
                max: 90,
                step: 0.5,
                format: (v: number) => fmtPct(v, 1),
                onChange: (v: number) => setParams((p) => ({ ...p, marginPct: v / 100 })),
              },
              {
                label: L('月固定成本', 'Monthly fixed cost'),
                value: params.fixedCost,
                min: 0,
                max: fixedMax,
                step: Math.max(10, Math.round(fixedMax / 200)),
                format: fmtCnyFull,
                onChange: (v: number) => setParams((p) => ({ ...p, fixedCost: v })),
              },
            ].map((item) => (
              <div key={item.label} className="rounded border border-line/50 bg-panel-2/30 px-3 py-2.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-muted">{item.label}</span>
                  <span className="num text-[13px] text-ink">{item.format(item.value)}</span>
                </div>
                <Slider className="mt-2" value={item.value} min={item.min} max={item.max} step={item.step} onValueChange={item.onChange} label={item.label} />
              </div>
            ))}
          </div>
          <div className="mt-3 rounded border border-line/50 bg-panel-2/20 px-3 py-2 text-[12px] leading-relaxed text-dim">
            <div className="flex items-center gap-1.5 text-[12px] text-muted">
              <SlidersHorizontal className="h-3 w-3" /> {L('数据锚点（真实字段）', 'Data anchors (real fields)')}
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
              <span>{L('启动资金', 'Capital')}：<span className="num text-ink">{fmtCnyRange(model.ranges.capital.min, model.ranges.capital.max)}</span></span>
              <span>{L('月收入', 'Revenue')}：<span className="num text-ink">{fmtCnyRange(model.ranges.revenue.min, model.ranges.revenue.max)}</span></span>
              <span>{L('毛利率', 'Margin')}：<span className="num text-ink">{fmtPct(model.ranges.marginPct.min * 100, 0)}–{fmtPct(model.ranges.marginPct.max * 100, 0)}</span></span>
              <span>{L('回本目标', 'Payback target')}：<span className="num text-ink">{model.paybackTarget ? `${model.paybackTarget} ${L('个月', 'mo')}` : '—'}</span></span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone="cyan">{L('客单价来源', 'AOV')} · {sourceLabel(model.sources.aov)}</Badge>
              <Badge tone="cyan">{L('收入来源', 'Revenue')} · {sourceLabel(model.sources.revenue)}</Badge>
              <Badge tone="cyan">{L('毛利率', 'Margin')} · {sourceLabel(model.sources.margin)}</Badge>
              <Badge tone="cyan">{L('回本', 'Payback')} · {sourceLabel(model.sources.payback)}</Badge>
            </div>
          </div>
          <div className="mt-2 text-[12px] leading-relaxed text-dim">
            {L('公式：', 'Formula: ')}
            {model.formula}
          </div>
          {model.assumptions.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11.5px] leading-relaxed text-dim/90">
              {model.assumptions.slice(0, 3).map((x, i) => (
                <li key={i}>· {x}</li>
              ))}
            </ul>
          )}
        </ReportPanel>
      </div>
    </div>
  )
}
