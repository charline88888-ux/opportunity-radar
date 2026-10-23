import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, ExternalLink, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Panel } from '@/components/ui'
import { candidateById, type Candidate } from '@/lib/candidates'
import { dataAsOf, gapName, industryName, regionName } from '@/lib/data'
import { useI18n } from '@/lib/i18n'
import { fmtCnyRange, fmtDateCn, fmtScore } from '@/lib/utils'

const QUESTION_LABELS: Record<string, { zh: string; en: string }> = {
  需求: { zh: '需求', en: 'Demand' },
  人群: { zh: '人群', en: 'Audience' },
  竞品: { zh: '竞品', en: 'Competition' },
  差异: { zh: '差异', en: 'Differentiation' },
  渠道: { zh: '渠道', en: 'Channels' },
  成本: { zh: '成本', en: 'Cost' },
  验证: { zh: '执行检查', en: 'Execution check' },
}

function questionEntries(c: Candidate): Array<{ key: string; value: string }> {
  if (Array.isArray(c.seven_questions)) return c.seven_questions.map((x, i) => ({ key: x.key || `q${i + 1}`, value: x.value || '' }))
  return Object.entries(c.seven_questions).map(([key, value]) => ({ key, value }))
}

export default function CandidateDetail() {
  const { id } = useParams()
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const candidate = id ? candidateById.get(id) : undefined

  if (!candidate) {
    return (
      <div className="panel flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-[15px] font-semibold">{L('候选不存在', 'Candidate not found')}</div>
        <Link to="/rankings" className="text-[12px] text-signal">← {L('返回商机榜', 'Back to rankings')}</Link>
      </div>
    )
  }

  const title = candidate.title_zh || candidate.title
  const original = candidate.title_original || candidate.source.raw_title || candidate.title
  const oneLiner = candidate.one_liner_zh || candidate.one_liner
  const checks = questionEntries(candidate)
  const dims = candidate.scores.dimensions || {}

  return (
    <div>
      <PageHeader
        index="03"
        kicker={L('RANKING · 商机详情', 'RANKING · OPPORTUNITY DETAIL')}
        title={title}
        description={oneLiner}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">{L('自动发现', 'Auto-discovered')}</Badge>
            <span className="num rounded border border-line px-2 py-0.5 text-[12px] text-signal">{fmtScore(candidate.scores.total)} · {candidate.scores.grade}</span>
            <Link to="/rankings" className="inline-flex h-7 items-center gap-1 rounded border border-line px-2.5 text-[11px] text-muted hover:text-ink">← {L('商机榜', 'Rankings')}</Link>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <Panel className="p-3">
          <div className="mono-label">{L('评分与等级', 'Score & grade')}</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="num text-[32px] font-semibold text-signal">{fmtScore(candidate.scores.total)}</span>
            <Badge tone="signal">{candidate.scores.grade}</Badge>
            <span className="font-mono text-[10px] text-dim">conf {candidate.confidence}</span>
          </div>
          <div className="mt-2 space-y-0.5">
            {Object.entries(dims).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[10px] text-dim"><span>{k}</span><span className="num">{fmtScore(v)}</span></div>
            ))}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="mono-label">{L('ROI 估算', 'ROI estimate')}</div>
          <div className="mt-1 space-y-1 text-[10.5px] text-muted">
            <div>{L('启动资金', 'Capital')}: {candidate.roi.capital_cny ? fmtCnyRange(candidate.roi.capital_cny.min ?? 0, candidate.roi.capital_cny.max ?? 0) : '—'}</div>
            <div>{L('回本周期', 'Payback')}: {candidate.roi.payback_months ?? '—'} {L('个月', 'months')}</div>
            <div>{L('月收入估算', 'Monthly revenue')}: {candidate.roi.monthly_revenue_cny ? fmtCnyRange(candidate.roi.monthly_revenue_cny.min ?? 0, candidate.roi.monthly_revenue_cny.max ?? 0) : '—'}</div>
            <div>{L('毛利率', 'Gross margin')}: {candidate.roi.gross_margin_pct ?? '—'}%</div>
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="mono-label">{L('发现信息', 'Discovery metadata')}</div>
          <div className="mt-1 space-y-1 text-[10.5px] text-muted">
            <div>{L('行业', 'Industry')}: {candidate.industry_ids.map(industryName).join(' / ') || '—'}</div>
            <div>{L('信息差', 'Gap')}: {candidate.gap_type_ids.map(gapName).join(' / ') || '—'}</div>
            <div>{L('区域', 'Regions')}: {candidate.region_ids.map(regionName).join(' / ') || '—'}</div>
            <div>{L('首次发现', 'First seen')}: {fmtDateCn(candidate.first_seen || dataAsOf)}</div>
            <div>{L('来源', 'Source')}: {candidate.source.name || '—'}</div>
          </div>
        </Panel>
      </div>

      <Panel className="mb-3 p-3">
        <div className="mono-label mb-2">{L('七问自动草稿', 'Seven questions (auto draft)')}</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {checks.map((x) => (
            <div key={x.key} className="rounded border border-line/60 px-2.5 py-2 text-[10.5px]">
              <div className="text-muted">{QUESTION_LABELS[x.key] ? L(QUESTION_LABELS[x.key].zh, QUESTION_LABELS[x.key].en) : x.key}</div>
              <div className="mt-0.5 leading-relaxed text-dim">{x.value || '—'}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <Panel className="p-3">
          <div className="mono-label mb-1">{L('来源证据', 'Source evidence')}</div>
          <div className="space-y-1">
            {candidate.evidence.map((e, i) => (
              <a key={`${e.url}-${i}`} href={e.url} target="_blank" rel="noreferrer" className="block truncate rounded border border-line/60 px-2 py-1.5 text-[10px] text-muted hover:text-signal">
                {e.title || e.url} <ExternalLink className="inline h-2.5 w-2.5" />
              </a>
            ))}
          </div>
          {original && original !== title && (
            <a href={candidate.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-dim hover:text-signal">{original} <ArrowUpRight className="h-3 w-3" /></a>
          )}
        </Panel>
        <Panel className="p-3">
          <div className="mono-label mb-1">{L('说明与边界', 'Notes & boundaries')}</div>
          <div className="rounded border border-amber/25 bg-amber/[0.04] px-2 py-1.5 text-[9.5px] leading-relaxed text-amber">
            <ShieldAlert className="mr-1 inline h-3 w-3" /> {L('自动发现线索，仅作商机线索展示，不构成投资建议；能否赚钱取决于个人线下执行。', 'Automatically discovered lead for research only; not investment advice. Commercial success depends on your own execution.')}
          </div>
          <div className="mt-2 text-[9.5px] leading-relaxed text-dim">
            {L('本页仅展示系统自动发现与评估的线索，不构成投资建议；商机能否赚钱取决于个人线下执行。', 'This page shows automatically discovered and evaluated leads only; it is not investment advice. Whether a business makes money depends on your own execution.')}
          </div>
        </Panel>
      </div>
    </div>
  )
}
