import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { translateString, useI18n } from '@/lib/i18n'

export function PageHeader({
  index,
  kicker,
  title,
  description,
  actions,
  className,
}: {
  index: string
  kicker?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const { lang } = useI18n()
  const tr = (value: ReactNode): ReactNode =>
    lang === 'en' && typeof value === 'string' ? translateString(value) : value
  return (
    <div className={cn('mb-4 flex flex-col gap-3 border-b border-line/70 pb-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <div className="mono-label flex items-center gap-2">
          <span className="text-signal">RADAR / {index}</span>
          <span className="inline-block h-px w-6 bg-line-strong" />
          <span>{tr(kicker)}</span>
        </div>
        <h1 className="mt-1.5 text-[21px] font-semibold leading-tight tracking-tight text-ink">{tr(title)}</h1>
        {description && <p className="mt-1.5 max-w-[880px] text-[12px] leading-relaxed text-muted">{tr(description)}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
