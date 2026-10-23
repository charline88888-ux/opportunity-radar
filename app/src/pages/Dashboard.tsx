import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, Database, Radar, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Panel } from '@/components/ui'
import { candidateTodayCount, candidateWindowItems, candidates } from '@/lib/candidates'
import { dataAsOf, dataMeta, gapName, industryName, opportunities, regionName, sourceHealth, stats } from '@/lib/data'
import { freshness } from '@/lib/freshness'
import { useI18n } from '@/lib/i18n'
import { fmtScore } from '@/lib/utils'

export default function Dashboard() {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const today = candidateWindowItems('day')
  const todayCount = candidateTodayCount(dataAsOf)
  const top = today.slice(0, 10)
  const fresh = freshness(dataAsOf)
  const autoSources = sourceHealth.ok_count || sourceHealth.total || 0
  const regionCount = stats.kpi.regions_covered

  return (
    <div>
      <PageHeader
        index="01"
        kicker={L('COMMAND · 指挥台', 'COMMAND · OVERVIEW')}
        title={L('全球商机雷达 · 每天扫描，商机入榜', 'Global Opportunity Radar · scan daily, rank opportunities')}
        description={L('只做一件事：每天扫描公开信号，评估商机，把可做的线索放进商机榜。自动候选与精选机会统一展示，按评分排序。', 'One job: scan public signals daily, evaluate opportunities, and put actionable leads on the opportunity board. Auto candidates and curated opportunities share one ranked board.')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={fresh.level === 'fresh' ? 'signal' : fresh.level === 'warning' ? 'amber' : 'danger'}>
              {L('数据基准', 'Data as of')} {fresh.asOf} · {L('距今', 'ago')} {fresh.days} {L('天', 'days')}
            </Badge>
            <Badge tone="cyan"><Sparkles className="h-3 w-3" /> {L(`今日新候选 ${todayCount}`, `${todayCount} new candidates today`)}</Badge>
            <Link to="/rankings" className="inline-flex h-7 items-center gap-1 rounded border border-signal/40 bg-signal/10 px-2.5 text-[11.5px] text-signal hover:bg-signal/20">
              {L('进入商机榜', 'Open opportunity board')} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          { label: L('今日新候选', 'New candidates today'), value: todayCount, hint: L('日榜入榜', 'in day window'), icon: Sparkles, tone: 'cyan' },
          { label: L('候选总数', 'Total candidates'), value: candidates.length, hint: L('全部自动发现', 'all auto-discovered'), icon: Radar, tone: 'signal' },
          { label: L('自动源', 'Auto sources'), value: autoSources, hint: L(`本轮成功 ${sourceHealth.ok_count}/${sourceHealth.total}`, `${sourceHealth.ok_count}/${sourceHealth.total} ok`), icon: Database, tone: 'muted' },
          { label: L('覆盖区域', 'Regions covered'), value: regionCount, hint: L('全球区域', 'global regions'), icon: CalendarDays, tone: 'amber' },
        ].map((k) => {
          const Icon = k.icon
          return (
            <Panel key={k.label} className="p-3">
              <div className="flex items-center gap-1.5 text-[9.5px] text-dim"><Icon className="h-3 w-3" /> {k.label}</div>
              <div className="num mt-1 text-[28px] font-semibold text-ink">{k.value}</div>
              <div className="mt-0.5 font-mono text-[9px] text-dim">{k.hint}</div>
            </Panel>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
        <Panel className="p-3 lg:col-span-8">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="mono-label">{L('今日 Top 候选', 'Top candidates today')}</div>
              <div className="mt-0.5 text-[10px] text-dim">{L('来自公开信号自动发现，按评分排序，点击看详情', 'Auto-discovered from public signals, sorted by score; click for detail')}</div>
            </div>
            <Link to="/rankings" className="text-[10px] text-signal hover:underline">{L('查看全部', 'View all')} →</Link>
          </div>
          {!top.length ? (
            <div className="py-8 text-center text-[11px] text-dim">{L('今天暂无新候选，商机榜历史窗口仍可查看。', 'No new candidates today; historical windows are still on the board.')}</div>
          ) : (
            <div className="space-y-1">
              {top.map(({ candidate: c, rank }, i) => (
                <Link key={c.candidate_id} to={`/candidates/${c.candidate_id}`} className="flex items-center gap-2 rounded border border-line/50 px-2 py-1.5 text-left transition-colors hover:border-line-strong hover:bg-panel-2">
                  <span className="num w-5 text-[11px] text-dim">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] text-ink">{c.title_zh || c.title}</div>
                    <div className="truncate text-[9px] text-dim">{c.industry_ids.map(industryName).join(' / ')} · {c.gap_type_ids.map(gapName).join(' / ')} · {c.region_ids.map(regionName).join(' / ')}</div>
                  </div>
                  <span className="num text-[12px] text-signal">{fmtScore(c.scores.total)}</span>
                  <span className="font-mono text-[9px] text-dim">{c.scores.grade}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-3 lg:col-span-4">
          <div className="mono-label">{L('核心状态', 'Core status')}</div>
          <div className="mt-2 space-y-2 text-[10.5px] text-muted">
            <div className="flex items-center justify-between"><span>{L('今日候选', 'Today candidates')}</span><span className="num text-cyan">{todayCount}</span></div>
            <div className="flex items-center justify-between"><span>{L('本周候选', 'Week candidates')}</span><span className="num">{candidateWindowItems('week').length}</span></div>
            <div className="flex items-center justify-between"><span>{L('本月候选', 'Month candidates')}</span><span className="num">{candidateWindowItems('month').length}</span></div>
            <div className="flex items-center justify-between"><span>{L('本年候选', 'Year candidates')}</span><span className="num">{candidateWindowItems('year').length}</span></div>
            <div className="flex items-center justify-between border-t border-line/50 pt-2"><span>{L('精选机会', 'Curated opportunities')}</span><span className="num text-signal">{opportunities.length}</span></div>
            <div className="flex items-center justify-between"><span>{L('自动源成功', 'Auto sources ok')}</span><span className="num">{sourceHealth.ok_count}/{sourceHealth.total}</span></div>
            <div className="flex items-center justify-between"><span>{L('数据版本', 'Data version')}</span><span className="font-mono text-dim">{dataMeta.data_version || '—'}</span></div>
          </div>
          <div className="mt-3 rounded border border-line/60 bg-panel-2 px-2 py-2 text-[9.5px] leading-relaxed text-dim">
            {L('扫描 → 评估 → 入榜是唯一主线。商机线索均来自公开信号自动生成，不构成投资建议。', 'Scan → evaluate → rank is the only pipeline. Leads are generated automatically from public signals and are not investment advice.')}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[9.5px]">
            <Link to="/scanner" className="rounded border border-line px-1.5 py-0.5 text-muted hover:text-ink">{L('扫描室', 'Scanner')}</Link>
            <Link to="/sources" className="rounded border border-line px-1.5 py-0.5 text-muted hover:text-ink">{L('数据源', 'Sources')}</Link>
            <Link to="/method" className="rounded border border-line px-1.5 py-0.5 text-muted hover:text-ink">{L('方法论', 'Method')}</Link>
            <Link to="/calendar" className="rounded border border-line px-1.5 py-0.5 text-muted hover:text-ink">{L('商业日历', 'Calendar')}</Link>
          </div>
        </Panel>
      </div>
    </div>
  )
}
