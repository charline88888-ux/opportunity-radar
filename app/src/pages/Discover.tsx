import { Link } from 'react-router-dom'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { CandidateBoard } from '@/components/CandidateBoard'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui'
import { candidateTodayCount, candidates, candidatesAvailable, candidatesMeta } from '@/lib/candidates'
import { dataAsOf } from '@/lib/data'
import { useI18n } from '@/lib/i18n'

export default function Discover() {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const today = candidateTodayCount(dataAsOf)
  return (
    <div>
      <PageHeader
        index="04"
        kicker={L('DISCOVER · 自动发现', 'DISCOVER')}
        title={L('自动发现榜 · 不用等验证的商机线索', 'Discovery board · opportunities without validation gating')}
        description={L('从公开采集信号自动生成候选商机，直接按日/周/月/年展示。验证与实验只是可选的个人动作，不是上榜或展示的门禁，也不参与候选排序。', 'Candidates are generated automatically from public fetched signals and ranked by day/week/month/year. Validation and experiments are optional personal actions—never a gate for listing or display, and never part of ranking.')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan"><Sparkles className="h-3 w-3" /> {L('自动发现 · 未验证', 'Auto-discovered · unverified')}</Badge>
            <Badge tone="signal">{L(`候选 ${candidates.length} 条`, `${candidates.length} candidates`)}</Badge>
            <Link to="/rankings?w=day" className="inline-flex h-7 items-center gap-1 rounded border border-line bg-panel-2 px-2.5 text-[11px] text-muted hover:text-ink">
              {L('精选榜（人工）', 'Curated rankings')} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-cyan/20 bg-cyan/[0.03] px-3 py-2 text-[10px] leading-relaxed text-muted">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan" />
        {L(`自动发现候选由采集信号生成，今日新增 ${today} 条；候选展示不要求人工复核、商业验证或实验盈利。`, `${today} new candidates today, generated from fetched signals. Display never requires manual review, business validation, or experiment profit.`)}
        {!candidatesAvailable && <span className="text-amber">{L('候选数据尚未生成。', 'Candidate data is not generated yet.')}</span>}
        {Boolean(candidatesMeta.data_version) && <span className="ml-auto font-mono text-[9px] text-dim">v{String(candidatesMeta.data_version)} · as_of {String(candidatesMeta.as_of || dataAsOf)}</span>}
      </div>
      <CandidateBoard />
    </div>
  )
}
