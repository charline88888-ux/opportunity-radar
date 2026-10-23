/**
 * 商机卡片 v2（自动候选与精选共用）
 * - 板块：身份/评分 → 结论 → 经济指标 → 迷你图表（回本曲线 / 资金结构）→ 标签 → 来源
 * - 交互：图表 Tab 切换、标签点击筛选、hover 显示理论月净利、整卡进入统一评估详情
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui'
import { Chart } from '@/components/charts/Chart'
import { cardCapitalOption, cardPaybackOption } from '@/components/charts/econ-options'
import type { Assessment } from '@/lib/assessment'
import { useI18n } from '@/lib/i18n'
import { cn, fmtCny, fmtCnyRange, fmtInt, fmtPct, fmtScore } from '@/lib/utils'

export type CardFilterKind = 'industry' | 'gap' | 'region'

export function OpportunityCard({
  assessment,
  rank,
  compact = false,
  onFilter,
}: {
  assessment: Assessment
  rank?: number
  compact?: boolean
  onFilter?: (kind: CardFilterKind, id: string) => void
}) {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const navigate = useNavigate()
  const [chartTab, setChartTab] = useState<'payback' | 'capital'>('payback')
  const a = assessment
  const econ = a.economics
  const go = () => navigate(a.href)
  const tagButtons = a.tags.filter((t) => t.kind !== 'industry').slice(0, 4)
  const industryTag = a.tags.find((t) => t.kind === 'industry')
  const marginLabel = econ.ranges.marginPct.min === econ.ranges.marginPct.max ? fmtPct(econ.ranges.marginPct.min * 100, 0) : `–`

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`${a.title} · ${L('打开评估详情', 'open assessment')}`}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          go()
        }
      }}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-line bg-panel/70 transition-all duration-150',
        'hover:-translate-y-0.5 hover:border-line-strong hover:bg-panel-2/70 hover:shadow-[0_10px_30px_rgba(0,0,0,.35)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal/60',
        compact ? 'p-3.5' : 'p-4',
      )}
      style={{ '--accent': a.kind === 'candidate' ? '#4cc9f0' : '#3ddc97' } as React.CSSProperties}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[color:var(--accent)] to-transparent opacity-80" />

      {/* 头部：排名 / 类型 / 评分 */}
      <div className="flex items-start gap-2">
        {rank != null && <span className="num mt-0.5 w-6 shrink-0 text-[13px] text-dim">{String(rank).padStart(2, '0')}</span>}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Badge tone={a.kind === 'candidate' ? 'cyan' : 'signal'}>{a.kind === 'candidate' ? L('自动发现', 'Auto') : L('精选', 'Curated')}</Badge>
          {industryTag && (
            <span className="rounded border border-line/70 px-1.5 py-0.5 text-[11.5px] text-muted">
              {lang === 'en' ? industryTag.labelEn : industryTag.labelZh}
            </span>
          )}
          {a.eventType && <span className="rounded border border-amber/25 bg-amber/[0.05] px-1.5 py-0.5 text-[11.5px] text-amber/90">{lang === 'en' ? a.eventTypeEn : a.eventTypeZh}</span>}
        </div>
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className="num text-[22px] font-semibold leading-none text-signal">{fmtScore(a.score.total)}</span>
          <span className="rounded bg-signal/12 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-signal">{a.score.grade}</span>
        </div>
      </div>

      {/* 标题与结论 */}
      <h3 className={cn('mt-2 line-clamp-2 font-semibold leading-[1.4] text-ink', compact ? 'text-[15px]' : 'text-[17px]')}>{a.title}</h3>
      {!compact && a.titleOriginal && a.titleOriginal !== a.title && <div className="mt-0.5 truncate text-[11.5px] text-dim">{a.titleOriginal}</div>}
      <p className={cn('mt-1 line-clamp-2 leading-[1.65] text-muted', compact ? 'text-[12px]' : 'text-[13px]')}>{a.oneLiner || a.thesis}</p>

      {/* 经济指标 */}
      <div className={cn('mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded border border-line/50 bg-panel-2/40 px-2.5 py-2', compact && 'gap-y-1')}>
        <div className="min-w-0">
          <div className="text-[11px] text-dim">{L('启动资金', 'Capital')}</div>
          <div className="num truncate text-[12.5px] text-ink">{fmtCnyRange(econ.investment.total.min, econ.investment.total.max)}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[11px] text-dim">{L('客单价', 'AOV')}</div>
          <div className="num truncate text-[12.5px] text-ink">{fmtCnyRange(econ.ranges.aov.min, econ.ranges.aov.max)}</div>
        </div>
        {!compact && (
          <div className="min-w-0">
            <div className="text-[11px] text-dim">{L('毛利率', 'Margin')}</div>
            <div className="num truncate text-[12.5px] text-ink">{marginLabel}</div>
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[11px] text-dim">{L('理论回本', 'Payback')}</div>
          <div className="num truncate text-[12.5px] text-signal">
            {econ.base.paybackMonths > 0 ? `${econ.base.paybackMonths.toFixed(1)} ${L('月', 'mo')}` : '—'}
          </div>
        </div>
      </div>

      {/* 迷你图表 + Tab */}
      {!compact && (
        <div className="relative mt-2">
          <div className="flex items-center justify-between">
            <div className="inline-flex overflow-hidden rounded border border-line/70 bg-panel-2/40">
              {[
                { key: 'payback' as const, zh: '回本曲线', en: 'Payback' },
                { key: 'capital' as const, zh: '资金结构', en: 'Capital mix' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setChartTab(tab.key)
                  }}
                  className={cn('px-2 py-0.5 text-[11px] transition-colors', chartTab === tab.key ? 'bg-signal/15 text-signal' : 'text-dim hover:text-muted')}
                >
                  {L(tab.zh, tab.en)}
                </button>
              ))}
            </div>
            <span className="truncate text-[11px] text-dim">{L('理论测算 · 非实盘', 'Theory · not live')}</span>
          </div>
          <div className="mt-1 transition-opacity">
            <Chart option={chartTab === 'payback' ? cardPaybackOption(econ, lang) : cardCapitalOption(econ, lang)} height={72} notMerge />
          </div>
          <div className="pointer-events-none absolute right-1 top-7 hidden items-center gap-1 rounded border border-line/70 bg-panel-3/95 px-2 py-1 text-[11.5px] text-ink shadow-lg group-hover:flex">
            <span className="text-dim">{L('理论月净利', 'Net / mo')}</span>
            <span className={cn('num font-semibold', econ.base.netProfit >= 0 ? 'text-signal' : 'text-danger')}>{fmtCny(econ.base.netProfit)}</span>
            <span className="text-dim">·</span>
            <span className="text-dim">{L('单量', 'Orders')}</span>
            <span className="num">{fmtInt(econ.base.orders)}</span>
          </div>
        </div>
      )}

      {/* 标签（点击筛选，不进入详情） */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tagButtons.map((tag) => (
          <button
            key={`${tag.kind}-${tag.id}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onFilter?.(tag.kind, tag.id)
            }}
            className={cn(
              'rounded border border-line/60 px-1.5 py-0.5 text-[11.5px] text-dim transition-colors',
              onFilter && 'hover:border-signal/40 hover:text-signal',
            )}
            title={onFilter ? L(`按${tag.kind === 'gap' ? '信息差' : '区域'}筛选`, `Filter by ${tag.kind}`) : undefined}
          >
            {lang === 'en' ? tag.labelEn : tag.labelZh}
          </button>
        ))}
      </div>

      {/* 底部 */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/40 pt-2 text-[11.5px] text-dim">
        <span className="truncate">
          {L('来源', 'Source')}：{a.sourceName || '—'}
          {a.windowMonths ? ` · ${L('窗口', 'Window')} ${a.windowMonths} ${L('个月', 'mo')}` : ''}
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-signal opacity-85 group-hover:opacity-100">
          {L('打开评估', 'Open brief')} <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </article>
  )
}
