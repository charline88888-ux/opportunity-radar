import type { ReactNode } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as SliderPrimitive from '@radix-ui/react-slider'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { ChevronDown, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------- Panel ------------------------------- */

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel', className)} {...rest}>
      {children}
    </div>
  )
}

interface SectionCardProps {
  title?: ReactNode
  eyebrow?: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
  dense?: boolean
}

export function SectionCard({ title, eyebrow, subtitle, right, className, bodyClassName, children, dense }: SectionCardProps) {
  return (
    <Panel className={cn('flex flex-col', className)}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 border-b border-line/70 px-4 py-3">
          <div className="min-w-0">
            {eyebrow && <div className="mono-label mb-0.5">{eyebrow}</div>}
            {title && <div className="text-[13.5px] font-semibold tracking-wide text-ink">{title}</div>}
            {subtitle && <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{subtitle}</div>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className={cn(dense ? 'p-0' : 'p-4', 'min-w-0 flex-1', bodyClassName)}>{children}</div>
    </Panel>
  )
}

/* ------------------------------- Button ------------------------------- */

type ButtonVariant = 'default' | 'primary' | 'outline' | 'ghost' | 'danger' | 'amber'
type ButtonSize = 'xs' | 'sm' | 'md'

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  default: 'border-line bg-panel-2 text-ink hover:border-line-strong hover:bg-panel-3',
  primary: 'border-signal/45 bg-signal/12 text-signal hover:bg-signal/20',
  outline: 'border-line bg-transparent text-muted hover:border-line-strong hover:text-ink',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-white/[0.04] hover:text-ink',
  danger: 'border-danger/45 bg-danger/10 text-danger hover:bg-danger/20',
  amber: 'border-amber/45 bg-amber/10 text-amber hover:bg-amber/20',
}
const BTN_SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-[11px] gap-1 rounded',
  sm: 'h-7 px-2.5 text-[12px] gap-1.5 rounded',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-md',
}

export function Button({
  variant = 'default',
  size = 'sm',
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ------------------------------- Badge ------------------------------- */

export type Tone = 'neutral' | 'signal' | 'amber' | 'cyan' | 'danger' | 'muted'

const TONE_BADGE: Record<Tone, string> = {
  neutral: 'border-line bg-panel-2 text-muted',
  signal: 'border-signal/35 bg-signal/10 text-signal',
  amber: 'border-amber/35 bg-amber/10 text-amber',
  cyan: 'border-cyan/35 bg-cyan/10 text-cyan',
  danger: 'border-danger/35 bg-danger/10 text-danger',
  muted: 'border-line-soft bg-white/[0.02] text-dim',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] leading-[1.5] tracking-wide',
        TONE_BADGE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}

export function GradeBadge({ grade, className, withLabel = false }: { grade?: string | null; className?: string; withLabel?: boolean }) {
  const g = grade || 'D'
  const color = { S: '#ffd166', A: '#3ddc97', B: '#4cc9f0', C: '#8b93a7', D: '#5a6273' }[g] || '#8b93a7'
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-[1.5]', className)}
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
      title={`等级 ${g}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ background: color }} />
      {g}
      {withLabel && <span className="font-sans text-[10px] font-normal opacity-80">级</span>}
    </span>
  )
}

export function DeltaBadge({ change, delta }: { change?: string | null; delta?: number | null }) {
  if (change === 'new') return <Badge tone="amber">NEW</Badge>
  if (change === 'up') return <Badge tone="signal">▲ {delta ?? 1}</Badge>
  if (change === 'down') return <Badge tone="danger">▼ {Math.abs(delta ?? 1)}</Badge>
  return <Badge tone="muted">— 0</Badge>
}

/* ------------------------------- Tabs ------------------------------- */

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex items-center gap-1 rounded-md border border-line bg-panel/70 p-1', className)}
    >
      {children}
    </TabsPrimitive.List>
  )
}

export function TabsTrigger({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[11.5px] text-muted transition-colors',
        'hover:text-ink data-[state=active]:bg-signal/12 data-[state=active]:text-signal data-[state=active]:shadow-[inset_0_0_0_1px_rgba(61,220,151,0.25)]',
        className,
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  )
}

export const TabsContent = TabsPrimitive.Content

/* ------------------------------- Slider ------------------------------- */

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 10,
  step = 0.1,
  label,
  className,
}: {
  value: number
  onValueChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  className?: string
}) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-4 w-full touch-none select-none items-center', className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onValueChange(v[0] ?? min)}
      aria-label={label}
    >
      <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-line">
        <SliderPrimitive.Range className="absolute h-full bg-signal/80" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block h-3 w-3 rounded-full border border-signal bg-bg shadow-[0_0_0_3px_rgba(61,220,151,0.12)] transition-colors hover:bg-signal focus-visible:outline-none"
        aria-label={label}
      />
    </SliderPrimitive.Root>
  )
}

/* ------------------------------- Tooltip ------------------------------- */

export const TooltipProvider = TooltipPrimitive.Provider

export function InfoTip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <TooltipPrimitive.Root delayDuration={120}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-[280px] rounded-md border border-line bg-panel-3 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-ink shadow-xl"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-panel-3" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/* ------------------------------- Collapsible ------------------------------- */

export const Collapsible = CollapsiblePrimitive.Root
export const CollapsibleContent = CollapsiblePrimitive.Content

export function CollapsibleTrigger({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <CollapsiblePrimitive.Trigger asChild>
      <button className={cn('group flex w-full items-center justify-between gap-3 text-left', className)}>
        {children}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-dim transition-transform', open && 'rotate-180 text-signal')} />
      </button>
    </CollapsiblePrimitive.Trigger>
  )
}

/* ------------------------------- Misc ------------------------------- */

export function ProgressBar({ value, max = 100, tone = 'signal', className }: { value: number; max?: number; tone?: 'signal' | 'amber' | 'cyan'; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const color = tone === 'amber' ? '#ffb547' : tone === 'cyan' ? '#4cc9f0' : '#3ddc97'
  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-line', className)}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  className,
}: {
  options: Array<{ value: T; label: ReactNode; title?: string }>
  value: T
  onChange: (v: T) => void
  size?: 'xs' | 'sm'
  className?: string
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-md border border-line bg-panel/70 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1 rounded px-2 font-mono transition-colors',
            size === 'xs' ? 'h-5 text-[10.5px]' : 'h-[26px] text-[11.5px]',
            value === o.value ? 'bg-white/[0.06] text-ink shadow-[inset_0_0_0_1px_rgba(57,66,79,0.7)]' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ title = '暂无数据', hint, icon }: { title?: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-line px-4 py-8 text-center">
      <div className="text-dim">{icon || <Inbox className="h-5 w-5" />}</div>
      <div className="text-[12.5px] text-muted">{title}</div>
      {hint && <div className="max-w-[360px] text-[11.5px] leading-relaxed text-dim">{hint}</div>}
    </div>
  )
}

export function Sparkline({
  data,
  width = 74,
  height = 22,
  color = '#3ddc97',
  fill = true,
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
}) {
  const vals = data.filter((n) => Number.isFinite(n))
  if (vals.length < 2) return null
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * (width - 2) + 1
    const y = height - 2 - ((v - min) / span) * (height - 4)
    return [x, y] as const
  })
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {fill && (
        <path
          d={`${path} L${width - 1},${height} L1,${height} Z`}
          fill={color}
          opacity={0.1}
        />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function Metric({ label, value, unit, hint, tone }: { label: ReactNode; value: ReactNode; unit?: string; hint?: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="mono-label">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="num text-[19px] font-semibold leading-none" style={tone ? { color: tone } : undefined}>
          {value}
        </span>
        {unit && <span className="text-[10.5px] text-dim">{unit}</span>}
      </div>
      {hint && <div className="mt-1 truncate text-[10.5px] text-dim">{hint}</div>}
    </div>
  )
}
