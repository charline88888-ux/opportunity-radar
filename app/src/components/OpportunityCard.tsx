import { Link, } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { cn, fmtCnyRange, fmtScore } from '@/lib/utils'
import { gapName, regionName } from '@/lib/data'
import { eventTypeLabel, industryLabel } from '@/lib/labels'
import { useI18n } from '@/lib/i18n'

export type OpportunityCardModel = {
  id: string
  kind: 'candidate' | 'curated'
  title: string
  original?: string
  why: string
  score: number
  grade: string
  primaryIndustry?: string
  eventType?: string
  capital?: { min?: number; max?: number }
  paybackMonths?: number
  windowMonths?: number | string
  gaps: string[]
  regions: string[]
  source?: string
}

export function OpportunityCard({ model, compact = false }: { model: OpportunityCardModel; compact?: boolean }) {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const href = model.kind === 'candidate' ? `/candidates/${model.id}` : `/opportunities/${model.id}`
  const industry = model.primaryIndustry ? industryLabel(model.primaryIndustry, lang) : ''

  return (
    <Link to={href} className={cn('panel panel-hover accent-top group flex flex-col p-5', compact && 'p-4')} style={{ '--accent': model.kind === 'candidate' ? '#4cc9f0' : '#3ddc97' } as React.CSSProperties}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={model.kind === 'candidate' ? 'cyan' : 'signal'}>{model.kind === 'candidate' ? L('自动发现', 'Auto') : L('精选', 'Curated')}</Badge>
        {industry && <span className="rounded border border-line/60 px-2 py-0.5 text-[12px] text-dim">{industry}</span>}
        {model.eventType && <span className="rounded border border-amber/30 bg-amber/[0.04] px-1 py-0.5 font-mono text-[8.5px] text-amber/90">{eventTypeLabel(model.eventType, lang)}</span>}
        <span className="ml-auto font-mono text-[12px] text-dim">{L('评分', 'Score')}</span>
        <span className="num text-[26px] font-semibold text-signal">{fmtScore(model.score)}</span>
        <span className="font-mono text-[12px] text-dim">{model.grade}</span>
      </div>

      <div className="mt-3 line-clamp-2 text-[19px] font-semibold leading-[1.35] text-ink">{model.title}</div>
      {model.original && model.original !== model.title && <div className="mt-0.5 truncate text-[12px] text-dim">{model.original}</div>}
      <div className="mt-1 line-clamp-2 text-[13px] leading-[1.65] text-muted">{model.why}</div>

      <div className="mt-2 grid grid-cols-3 gap-1 rounded border border-line/50 bg-panel-2/40 px-1.5 py-1.5">
        <div>
          <div className="font-mono text-[12px] text-dim">{L('启动资金', 'Capital')}</div>
          <div className="truncate text-[13px] text-muted">{model.capital ? fmtCnyRange(model.capital.min ?? 0, model.capital.max ?? 0) : '—'}</div>
        </div>
        <div>
          <div className="font-mono text-[12px] text-dim">{L('回本', 'Payback')}</div>
          <div className="truncate text-[13px] text-muted">{model.paybackMonths != null ? `${model.paybackMonths} ${L('个月', 'mo')}` : '—'}</div>
        </div>
        <div>
          <div className="font-mono text-[12px] text-dim">{L('窗口', 'Window')}</div>
          <div className="truncate text-[13px] text-muted">{model.windowMonths != null ? `${String(model.windowMonths)} ${String(model.windowMonths).includes('月') ? '' : L('个月', 'mo')}` : '—'}</div>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {model.gaps.slice(0, 2).map((g) => <span key={g} className="rounded border border-line/60 px-2 py-0.5 text-[12px] text-dim">{gapName(g)}</span>)}
        {model.regions.slice(0, 2).map((r) => <span key={r} className="rounded border border-line/60 px-2 py-0.5 text-[12px] text-dim">{regionName(r)}</span>)}
      </div>
      <div className="mt-1.5 flex items-center justify-between border-t border-line/40 pt-1.5 text-[12px] text-dim">
        <span className="truncate">{L('来源', 'Source')}: {model.source || '—'}</span>
        <span className="shrink-0 text-signal opacity-80 group-hover:opacity-100">{L('查看评估', 'Open brief')} →</span>
      </div>
    </Link>
  )
}
