/**
 * v1.7.0 商机分析区块（DeepSeek 结构化分析，仅候选有字段时展示）
 * 默认展开、放在「核心判断」之后；分析 ≠ 门禁：弱项只标注，不参与过滤/排序。
 */
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowRight, BadgeCheck, Brain, ExternalLink, Gauge, GitBranch, HelpCircle, Lightbulb, Link2, ListChecks, ShieldAlert, Target, TrendingUp, Zap } from 'lucide-react'
import { Badge, Panel } from '@/components/ui'
import type { AssessmentAnalysis } from '@/lib/assessment'
import { useI18n } from '@/lib/i18n'
import { cn, fmtScore } from '@/lib/utils'

function Head({ icon, title, sub, right }: { icon: ReactNode; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-ink">
          <span className="text-signal">{icon}</span>
          {title}
        </div>
        {sub && <div className="mt-0.5 text-[12.5px] leading-relaxed text-dim">{sub}</div>}
      </div>
      {right}
    </div>
  )
}

function BulletList({ items, tone, icon }: { items: string[]; tone: 'signal' | 'amber' | 'muted'; icon?: ReactNode }) {
  const dot = tone === 'signal' ? 'bg-signal' : tone === 'amber' ? 'bg-amber' : 'bg-dim'
  return (
    <ul className="space-y-2">
      {items.map((text, i) => (
        <li key={i} className="flex gap-2 text-[13.5px] leading-[1.7] text-ink/85">
          {icon ? <span className={cn('mt-[3px] shrink-0', tone === 'signal' ? 'text-signal' : tone === 'amber' ? 'text-amber' : 'text-dim')}>{icon}</span> : <span className={cn('mt-[8px] h-1 w-1 shrink-0 rounded-full', dot)} />}
          <span className="min-w-0 flex-1">{text}</span>
        </li>
      ))}
    </ul>
  )
}

export function AnalysisPanel({ analysis }: { analysis: AssessmentAnalysis }) {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const a = analysis
  const confidencePct = a.confidence != null ? Math.round(a.confidence * 100) : null
  const infoDims = a.informationValue?.dimensions || []
  const infoAvg = a.informationValue?.score ?? (infoDims.length ? Math.round((infoDims.reduce((sum, d) => sum + d.value, 0) / infoDims.length) * 10) / 10 : null)
  const evidenceQuality = a.evidenceQuality
  const nonGate = L('分析≠门禁：弱项只标注，不参与过滤/排序。', 'Analysis ≠ gate: weaknesses are annotated only and never filter or rank.')

  return (
    <div className="space-y-4">
      {/* 头部：评分 / 主导型 / 置信度 / 论点 / 主导驱动 */}
      <Panel className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded border border-cyan/35 bg-cyan/10 px-2 py-0.5 text-[12px] text-cyan">
            <Brain className="h-3.5 w-3.5" /> {L('商机分析', 'Opportunity analysis')}
          </span>
          {a.score != null && (
            <span className="inline-flex items-baseline gap-1 rounded border border-line/70 bg-panel-2/50 px-2 py-0.5 text-[12px] text-muted">
              {L('分析评分', 'Analysis score')}
              <span className="num text-[15px] font-semibold text-ink">{fmtScore(a.score)}</span>
            </span>
          )}
          {infoAvg != null && (
            <span className="inline-flex items-baseline gap-1 rounded border border-cyan/35 bg-cyan/[0.06] px-2 py-0.5 text-[12px] text-cyan">
              {L('信息价值均分', 'Info value avg')}
              <span className="num text-[15px] font-semibold text-cyan">{fmtScore(infoAvg)}</span>
              <span className="text-[11px] text-cyan/70">/10</span>
            </span>
          )}
          {a.singleAxisStrong && (
            <span className="inline-flex items-center gap-1 rounded border border-amber/40 bg-amber/10 px-2 py-0.5 text-[12px] font-medium text-amber">
              <Zap className="h-3.5 w-3.5" /> {L('主导型机会', 'Single-axis opportunity')}
            </span>
          )}
          {a.scenarioLabel && <Badge tone="muted">{a.scenarioLabel}</Badge>}
          {confidencePct != null && (
            <span className="inline-flex items-baseline gap-1 rounded border border-line/70 px-2 py-0.5 text-[12px] text-dim">
              {L('置信度', 'Confidence')} <span className="num text-[13px] text-muted">{confidencePct}%</span>
            </span>
          )}
          <span className="ml-auto text-[11.5px] text-dim">{L('结构化分析 · 非收入承诺', 'Structured analysis · not a revenue promise')}</span>
        </div>

        <p className="mt-3 max-w-[1100px] text-[15.5px] leading-[1.8] text-ink/90">{a.thesis}</p>

        {a.dominantDrivers.length > 0 && (
          <div className="mt-3 rounded-lg border border-line/50 bg-panel-2/25 px-3 py-2.5">
            <div className="mb-1.5 text-[12px] text-dim">{L('主导驱动', 'Dominant drivers')}</div>
            <div className="flex flex-wrap gap-1.5">
              {a.dominantDrivers.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full border border-signal/25 bg-signal/[0.06] px-2.5 py-1 text-[12.5px] leading-snug text-signal/90">
                  <TrendingUp className="h-3 w-3" /> {d}
                </span>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* v1.8.0：信息价值 5 维 + 证据质量行 */}
      {(infoDims.length > 0 || evidenceQuality) && (
        <Panel className="p-5">
          <Head
            icon={<Gauge className="h-4 w-4" />}
            title={L('信息价值 · 5 维', 'Information value · 5 dimensions')}
            sub={L('新颖度、具体度、影响力、紧迫度、可执行性（0–10）；证据质量用于判断信息可信度。', 'Novelty, specificity, impact, urgency and actionability (0–10); evidence quality indicates how trustworthy the information is.')}
            right={infoAvg != null ? <Badge tone="cyan">{L('均分', 'Average')} {fmtScore(infoAvg)} / 10</Badge> : undefined}
          />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="xl:col-span-7">
              {infoDims.length ? (
                <div className="space-y-2.5">
                  {infoDims.map((d) => (
                    <div key={d.key}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] text-muted">{lang === 'en' ? d.labelEn : d.labelZh}</span>
                        <span className="num text-[13px] font-medium text-ink">{fmtScore(d.value)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded bg-line/60">
                        <div className="h-full rounded bg-gradient-to-r from-cyan/70 to-signal" style={{ width: `${Math.max(0, Math.min(100, d.value * 10))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] text-dim">—</div>
              )}
            </div>
            <div className="min-w-0 xl:col-span-5">
              <div className="mb-2 flex items-center gap-1.5 text-[12px] text-dim">
                <BadgeCheck className="h-3.5 w-3.5" /> {L('证据质量', 'Evidence quality')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: L('来源数', 'Sources'), value: evidenceQuality?.sourceCount != null ? String(evidenceQuality.sourceCount) : '—', unit: '' },
                  { label: L('独立性', 'Independence'), value: evidenceQuality?.independence != null ? fmtScore(evidenceQuality.independence) : '—', unit: '/10' },
                  { label: L('权威性', 'Authority'), value: evidenceQuality?.authority != null ? fmtScore(evidenceQuality.authority) : '—', unit: '/10' },
                  { label: L('时效性', 'Timeliness'), value: evidenceQuality?.timeliness != null ? fmtScore(evidenceQuality.timeliness) : '—', unit: '/10' },
                  { label: L('证据评分', 'Evidence score'), value: evidenceQuality?.score != null ? fmtScore(evidenceQuality.score) : '—', unit: '/10' },
                ].map((cell) => (
                  <div key={cell.label} className="rounded-lg border border-line/60 bg-panel-2/25 px-3 py-2">
                    <div className="text-[11.5px] text-dim">{cell.label}</div>
                    <div className="num mt-0.5 text-[15px] font-semibold text-ink">
                      {cell.value}
                      {cell.unit && <span className="ml-0.5 text-[11px] font-normal text-dim">{cell.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {evidenceQuality?.note && <div className="mt-2 text-[12px] leading-[1.65] text-dim">{evidenceQuality.note}</div>}
            </div>
          </div>
        </Panel>
      )}

      {/* v1.8.0：关键事实 / 推断 */}
      {a.keyFacts.length > 0 && (
        <Panel className="p-5">
          <Head
            icon={<ListChecks className="h-4 w-4" />}
            title={L('关键事实与推断', 'Key facts & inferences')}
            sub={L('事实可回溯来源；推断为分析判断，需人工复核。', 'Facts trace to sources; inferences are analytical judgements that need manual review.')}
            right={<Badge tone="muted">{a.keyFacts.length} {L('条', 'items')}</Badge>}
          />
          <ul className="divide-y divide-line/40">
            {a.keyFacts.map((fact, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    'mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium',
                    fact.type === 'inference' ? 'border-amber/35 bg-amber/[0.07] text-amber' : 'border-signal/35 bg-signal/[0.07] text-signal',
                  )}
                >
                  {fact.type === 'inference' ? L('推断', 'Inference') : L('事实', 'Fact')}
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] leading-[1.7] text-ink/85">{fact.text}</span>
                {fact.sourceUrl ? (
                  <a
                    href={fact.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={fact.sourceTitle || fact.sourceUrl}
                    className="inline-flex max-w-full shrink-0 items-center gap-1 truncate rounded border border-cyan/30 bg-cyan/[0.05] px-2 py-0.5 text-[11.5px] text-cyan/90 hover:border-cyan/60 hover:text-cyan"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" /> <span className="max-w-[180px] truncate">{fact.sourceTitle || L('来源', 'Source')}</span>
                  </a>
                ) : fact.sourceTitle ? (
                  <span className="shrink-0 rounded border border-line/70 px-2 py-0.5 text-[11.5px] text-dim">{fact.sourceTitle}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {a.causalChain.length > 0 && (
        <Panel className="p-5">
          <Head
            icon={<GitBranch className="h-4 w-4" />}
            title={L('因果链 · 从事实到切入点', 'Causal chain · from fact to entry point')}
            sub={L('事实 → 变化 → 受影响主体 → 缺口 → 切入点，逐段可追溯。', 'Fact → change → affected parties → gap → entry point, traceable step by step.')}
            right={<Badge tone="muted">{a.causalChain.length} {L('步', 'steps')}</Badge>}
          />
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {a.causalChain.map((step, i) => (
              <li key={i} className="relative rounded-lg border border-line/60 bg-panel-2/30 px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-signal/40 bg-signal/10 font-mono text-[11px] text-signal">{i + 1}</span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-dim">{[L('事实', 'Fact'), L('变化', 'Change'), L('主体', 'Actors'), L('缺口', 'Gap'), L('切入', 'Entry')][i] || L('步骤', 'Step')}</span>
                </div>
                <div className="mt-1.5 text-[13px] leading-[1.65] text-ink/85">{step}</div>
                {i < a.causalChain.length - 1 && (
                  <ArrowRight className="absolute -right-[9px] top-1/2 hidden h-4 w-4 -translate-y-1/2 text-signal/50 xl:block" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {/* 切入点 / 差异化 / 商业结构 */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <Panel className="p-5 xl:col-span-5">
          <Head icon={<Target className="h-4 w-4" />} title={L('切入点与差异化', 'Entry point & differentiation')} />
          <div className="space-y-3">
            <div className="rounded-lg border border-signal/25 bg-signal/[0.05] px-3 py-2.5">
              <div className="text-[12px] text-signal/80">{L('切入点', 'Entry point')}</div>
              <div className="mt-1 text-[13.5px] leading-[1.75] text-ink/90">{a.entryPoint || '—'}</div>
            </div>
            <div className="rounded-lg border border-line/60 bg-panel-2/25 px-3 py-2.5">
              <div className="text-[12px] text-dim">{L('差异化', 'Differentiation')}</div>
              <div className="mt-1 text-[13.5px] leading-[1.75] text-ink/85">{a.differentiation || '—'}</div>
            </div>
          </div>
        </Panel>

        {a.commercial.length > 0 && (
          <Panel className="p-5 xl:col-span-7">
            <Head
              icon={<Lightbulb className="h-4 w-4" />}
              title={L('商业结构 · 5 项', 'Commercial structure · 5 items')}
              sub={L('价值主张、定价、成本结构、渠道与启动条件。', 'Value proposition, pricing, cost structure, channels and startup conditions.')}
            />
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {a.commercial.map((item) => (
                <div key={item.key} className="rounded-lg border border-line/60 bg-panel-2/25 px-3 py-2.5">
                  <div className="text-[12px] text-dim">{lang === 'en' ? item.labelEn : item.labelZh}</div>
                  <div className="mt-1 text-[13px] leading-[1.7] text-ink/85">{item.value}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {/* 强项 / 弱项 / 未知 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Panel className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13.5px] font-medium text-signal">{L('强项', 'Strengths')}</span>
            <span className="num text-[12px] text-dim">{a.strengths.length}</span>
          </div>
          {a.strengths.length ? <BulletList items={a.strengths} tone="signal" /> : <div className="text-[13px] text-dim">—</div>}
        </Panel>
        <Panel className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13.5px] font-medium text-amber">{L('弱项（仅标注）', 'Weaknesses (annotated only)')}</span>
            <span className="num text-[12px] text-dim">{a.weaknesses.length}</span>
          </div>
          {a.weaknesses.length ? <BulletList items={a.weaknesses} tone="amber" icon={<AlertTriangle className="h-3.5 w-3.5" />} /> : <div className="text-[13px] text-dim">—</div>}
        </Panel>
        <Panel className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13.5px] font-medium text-muted">{L('未知', 'Unknowns')}</span>
            <span className="num text-[12px] text-dim">{a.unknowns.length}</span>
          </div>
          {a.unknowns.length ? <BulletList items={a.unknowns} tone="muted" icon={<HelpCircle className="h-3.5 w-3.5" />} /> : <div className="text-[13px] text-dim">—</div>}
        </Panel>
      </div>

      {/* 证伪条件 + 证据引用 + 非门禁说明 */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <Panel className="p-5 xl:col-span-8">
          <Head
            icon={<ShieldAlert className="h-4 w-4" />}
            title={L('证伪条件 · 出现即降权/放弃', 'Falsifiers · downgrade or stop when present')}
            sub={L('这些条件不参与排序，但用于人工复核与行动前的最后检查。', 'These conditions do not affect ranking; they are for manual review before acting.')}
          />
          {a.falsifiers.length ? <BulletList items={a.falsifiers} tone="amber" icon={<AlertTriangle className="h-3.5 w-3.5" />} /> : <div className="text-[13px] text-dim">—</div>}
        </Panel>
        <Panel className="p-5 xl:col-span-4">
          <Head icon={<Link2 className="h-4 w-4" />} title={L('证据引用', 'Evidence references')} />
          {a.evidenceRefs.length ? (
            <div className="flex flex-wrap gap-1.5">
              {a.evidenceRefs.map((ref, i) =>
                ref.url ? (
                  <a
                    key={i}
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                    title={ref.title}
                    className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-cyan/30 bg-cyan/[0.05] px-2.5 py-1 text-[12px] leading-snug text-cyan/90 hover:border-cyan/60 hover:text-cyan"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{ref.title}</span>
                  </a>
                ) : (
                  <span key={i} className="rounded-full border border-line/70 bg-panel-2/40 px-2.5 py-1 text-[12px] leading-snug text-muted">{ref.title}</span>
                ),
              )}
            </div>
          ) : (
            <div className="text-[13px] text-dim">—</div>
          )}
          <div className="mt-3 rounded border border-cyan/25 bg-cyan/[0.05] px-3 py-2 text-[12px] leading-[1.7] text-cyan/90">
            {L('分析由系统结构化生成，可能不完整或过时；引用为信号标题，请回看上方「来源与证据」原始链接。', 'Analysis is generated structurally and may be incomplete or outdated; references are signal titles—check the original links in Sources & evidence above.')}
          </div>
        </Panel>
      </div>

      <div className="rounded-lg border border-amber/30 bg-amber/[0.06] px-4 py-2.5 text-[12.5px] leading-[1.75] text-amber">
        <ShieldAlert className="mr-1.5 inline h-3.5 w-3.5" />
        {nonGate}
      </div>
    </div>
  )
}
