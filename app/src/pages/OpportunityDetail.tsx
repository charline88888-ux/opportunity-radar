import { useParams, Link } from 'react-router-dom'
import { ExternalLink, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Panel } from '@/components/ui'
import { gapName, industryName, opportunities, regionName } from '@/lib/data'
import { useI18n } from '@/lib/i18n'
import { fmtCnyRange, fmtDate, fmtScore } from '@/lib/utils'

const QUESTION_LABELS: Record<string, { zh: string; en: string }> = {
  traffic: { zh: '流量 / 获客入口', en: 'Traffic / acquisition' },
  money: { zh: '赚钱方式', en: 'How money is made' },
  model: { zh: '交付模型', en: 'Delivery model' },
  roi: { zh: '投入与回报', en: 'Investment & return' },
  audience: { zh: '目标人群', en: 'Audience' },
  drivers: { zh: '驱动因子', en: 'Drivers' },
  moat: { zh: '壁垒 / 风险', en: 'Moat / risks' },
}

export default function OpportunityDetail() {
  const { id } = useParams()
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const opp = opportunities.find((o) => o.id === id)

  if (!opp) {
    return (
      <div className="panel flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-[15px] font-semibold">{L('商机不存在', 'Opportunity not found')}</div>
        <Link to="/rankings" className="text-[12px] text-signal">← {L('返回商机榜', 'Back to rankings')}</Link>
      </div>
    )
  }

  const title = opp.title
  const oneLiner = opp.one_liner
  const seven = Object.entries(opp.seven_questions || {})
  const dims = opp.scores.dimensions || {}
  const evidence = opp.signal?.evidence || []

  return (
    <div>
      <PageHeader
        index="02"
        kicker={L('CURATED · 精选商机', 'CURATED · OPPORTUNITY')}
        title={title}
        description={oneLiner}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal">{L('精选', 'Curated')}</Badge>
            <span className="num rounded border border-line px-2 py-0.5 text-[12px] text-signal">{fmtScore(opp.scores.total)} · {opp.scores.grade}</span>
            <Link to="/rankings" className="inline-flex h-7 items-center gap-1 rounded border border-line px-2.5 text-[11px] text-muted hover:text-ink">← {L('商机榜', 'Rankings')}</Link>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <Panel className="p-3">
          <div className="mono-label">{L('评分与等级', 'Score & grade')}</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="num text-[32px] font-semibold text-signal">{fmtScore(opp.scores.total)}</span>
            <Badge tone="signal">{opp.scores.grade}</Badge>
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
            <div>{L('启动资金', 'Capital')}: {opp.roi.capital_cny ? fmtCnyRange(opp.roi.capital_cny.min, opp.roi.capital_cny.max) : '—'}</div>
            <div>{L('回本周期', 'Payback')}: {opp.roi.payback_months ?? '—'} {L('个月', 'months')}</div>
            <div>{L('月收入估算', 'Monthly revenue')}: {opp.roi.monthly_revenue_cny ? fmtCnyRange(opp.roi.monthly_revenue_cny.min, opp.roi.monthly_revenue_cny.max) : '—'}</div>
            <div>{L('毛利率', 'Gross margin')}: {opp.roi.gross_margin_pct ?? '—'}%</div>
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="mono-label">{L('发现信息', 'Discovery metadata')}</div>
          <div className="mt-1 space-y-1 text-[10.5px] text-muted">
            <div>{L('行业', 'Industry')}: {industryName(opp.industry_id)}</div>
            <div>{L('信息差', 'Gap')}: {opp.gap_type_ids.map(gapName).join(' / ') || '—'}</div>
            <div>{L('区域', 'Regions')}: {opp.region_ids.map(regionName).join(' / ') || '—'}</div>
            <div>{L('首次发现', 'First seen')}: {fmtDate(opp.first_seen)}</div>
            <div>{L('来源', 'Source')}: {opp.origin_country || '—'}</div>
          </div>
        </Panel>
      </div>

      <Panel className="mb-3 p-3">
        <div className="mono-label mb-2">{L('七问自动草稿', 'Seven questions (auto draft)')}</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {seven.map(([key, value]) => (
            <div key={key} className="rounded border border-line/60 px-2.5 py-2 text-[10.5px]">
              <div className="text-muted">{QUESTION_LABELS[key] ? L(QUESTION_LABELS[key].zh, QUESTION_LABELS[key].en) : key}</div>
              <div className="mt-0.5 leading-relaxed text-dim">{Array.isArray(value) ? value.join(' / ') : String(value)}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <Panel className="p-3">
          <div className="mono-label mb-1">{L('来源证据', 'Source evidence')}</div>
          <div className="space-y-1">
            {evidence.map((e, i) => (
              <a key={`${e.url}-${i}`} href={e.url} target="_blank" rel="noreferrer" className="block rounded border border-line/60 px-2 py-1.5 text-[10px] text-muted hover:text-signal">
                <div className="truncate">{e.title} <ExternalLink className="inline h-2.5 w-2.5" /></div>
                <div className="truncate text-[9px] text-dim">{e.publisher} · {e.date}</div>
              </a>
            ))}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="mono-label mb-1">{L('说明与边界', 'Notes & boundaries')}</div>
          <div className="rounded border border-amber/25 bg-amber/[0.04] px-2 py-1.5 text-[9.5px] leading-relaxed text-amber">
            <ShieldAlert className="mr-1 inline h-3 w-3" /> {L('精选商机线索，仅作研究参考，不构成投资建议；能否赚钱取决于个人线下执行。', 'Curated lead for research only; not investment advice. Commercial success depends on your own execution.')}
          </div>
          <div className="mt-2 text-[9.5px] leading-relaxed text-dim">
            {L('本页展示精选商机线索，不构成投资建议；能否赚钱取决于个人线下执行。', 'This page shows a curated lead and is not investment advice; commercial success depends on your own execution.')}
          </div>
        </Panel>
      </div>
    </div>
  )
}
