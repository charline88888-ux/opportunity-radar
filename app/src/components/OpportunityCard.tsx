import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock3 } from 'lucide-react'
import type { ChangeType, Opportunity } from '@/types'
import { gapName, industryColor, industryName, regionName } from '@/lib/data'
import { cn, fmtCnyRange, fmtScore, gradeColor, WINDOW_STATUS_HEX, WINDOW_STATUS_LABEL } from '@/lib/utils'
import { DeltaBadge, GradeBadge } from './ui'

export function OppMetaChips({ opp, maxGaps = 2, className }: { opp: Opportunity; maxGaps?: number; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span
        className="inline-flex items-center gap-1 rounded border border-line bg-panel-2 px-1.5 py-0.5 text-[10.5px] text-muted"
        title={`行业：${industryName(opp.industry_id)}`}
      >
        <span className="h-1.5 w-1.5 rounded-sm" style={{ background: industryColor(opp.industry_id) }} />
        {industryName(opp.industry_id)}
      </span>
      {opp.gap_type_ids.slice(0, maxGaps).map((g) => (
        <span key={g} className="rounded border border-line/80 bg-white/[0.02] px-1.5 py-0.5 text-[10.5px] text-dim">
          {gapName(g)}
        </span>
      ))}
      {opp.region_ids.slice(0, 2).map((r) => (
        <span key={r} className="rounded px-1 py-0.5 text-[10.5px] text-dim">
          {regionName(r)}
        </span>
      ))}
    </div>
  )
}

export function OpportunityCard({
  opp,
  rank,
  compact = false,
  showRank = false,
  change,
  delta,
  className,
}: {
  opp: Opportunity
  rank?: number
  compact?: boolean
  showRank?: boolean
  change?: ChangeType | null
  delta?: number | null
  className?: string
}) {
  const total = opp.scores.total
  return (
    <Link
      to={`/opportunities/${opp.id}`}
      className={cn(
        'panel panel-hover group flex gap-3 p-3',
        compact && 'gap-2.5 p-2.5',
        className,
      )}
    >
      {showRank && (
        <div className="flex w-8 shrink-0 flex-col items-center pt-0.5">
          <span
            className={cn(
              'num text-[20px] font-semibold leading-none',
              rank === 1 ? 'text-amber' : rank === 2 ? 'text-ink' : rank === 3 ? 'text-cyan' : 'text-dim',
            )}
          >
            {rank != null ? String(rank).padStart(2, '0') : '—'}
          </span>
          <span className="mt-1 font-mono text-[8px] tracking-widest text-dim">RANK</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0"><GradeBadge grade={opp.scores.grade} /></span>
            {change && <span className="shrink-0"><DeltaBadge change={change} delta={delta} /></span>}
            <span className={cn('min-w-0 truncate font-semibold text-ink', compact ? 'text-[12.5px]' : 'text-[13.5px]')} title={opp.title}>
              {opp.title}
            </span>
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-dim transition-colors group-hover:text-signal" />
        </div>
        {!compact && <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted">{opp.one_liner}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded border border-line bg-panel-2 px-1.5 py-0.5 text-[10.5px] text-muted"
            title={`行业：${industryName(opp.industry_id)}`}
          >
            <span className="h-1.5 w-1.5 rounded-sm" style={{ background: industryColor(opp.industry_id) }} />
            {industryName(opp.industry_id)}
          </span>
          {opp.gap_type_ids.slice(0, compact ? 1 : 2).map((g) => (
            <span key={g} className="rounded border border-line/80 bg-white/[0.02] px-1.5 py-0.5 text-[10.5px] text-dim">
              {gapName(g)}
            </span>
          ))}
          {!compact && opp.region_ids.slice(0, 2).map((r) => (
            <span key={r} className="px-0.5 text-[10.5px] text-dim">
              {regionName(r)}
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/60 pt-1.5">
          <span className="flex items-baseline gap-1">
            <span className="num text-[14px] font-semibold" style={{ color: gradeColor(opp.scores.grade) }}>
              {fmtScore(total)}
            </span>
            <span className="font-mono text-[9px] text-dim">TOTAL</span>
          </span>
          <span className="flex items-baseline gap-1">
            <span className="num text-[11.5px] text-muted">{fmtScore(opp.rank_score)}</span>
            <span className="font-mono text-[9px] text-dim">RANK</span>
          </span>
          {!compact && (
            <span className="hidden items-baseline gap-1 sm:flex">
              <span className="num text-[11.5px] text-muted">
                {fmtCnyRange(opp.roi.monthly_revenue_cny.min, opp.roi.monthly_revenue_cny.max)}
              </span>
              <span className="font-mono text-[9px] text-dim">/月</span>
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-dim">
            <Clock3 className="h-3 w-3" />
            <span style={{ color: WINDOW_STATUS_HEX[opp.window.status] }}>{WINDOW_STATUS_LABEL[opp.window.status]}</span>
            <span className="font-mono">{opp.window.months_left}M</span>
          </span>
        </div>
      </div>
    </Link>
  )
}
