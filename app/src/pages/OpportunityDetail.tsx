import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { EChartsOption } from 'echarts'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  Check,
  CircleCheck,
  Clock3,
  Coins,
  Copy,
  Crosshair,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Info,
  ListChecks,
  Megaphone,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { Chart } from '@/components/charts/Chart'
import { OpportunityCard } from '@/components/OpportunityCard'
import { PageHeader } from '@/components/PageHeader'
import {
  Badge,
  Button,
  EmptyState,
  GradeBadge,
  InfoTip,
  Panel,
  ProgressBar,
  SectionCard,
  Slider,
} from '@/components/ui'
import {
  dataAsOf,
  defaultWeights,
  deltaBasisLabel,
  driverName,
  gapHalfLife,
  gapName,
  getOppRanks,
  gradeName,
  historyBasisReplayLabel,
  industryColor,
  industryName,
  lookups,
  neuroName,
  needName,
  emotionName,
  oppById,
  oppBySlug,
  rankingsDeltaBasis,
  rankingsHistoryAsOf,
  rankingsHistoryReplayAsOf,
  regionName,
  relatedOpportunities,
  tagName,
  taxonomy,
} from '@/lib/data'
import { copyText, downloadOpportunityMarkdown, downloadPeriodReport, opportunityCardMarkdown } from '@/lib/exports'
import {
  ACTIVE_CAPACITY,
  EXPERIMENT_STATUS,
  experimentDay,
  experimentReviewInfo,
  useExperiments,
} from '@/lib/experiments'
import {
  decayCurve,
  industryDimensionAverage,
  normalizeWeights,
  rankByWeights,
  scoreWithWeights,
  weightsChanged,
} from '@/lib/score'
import { cn, DECAY_LABEL, EFFORT_LABEL, fmtCny, fmtCnyRange, fmtDate, fmtInt, fmtScore, gradeColor, TREND_LABEL, WINDOW_STATUS_HEX, WINDOW_STATUS_LABEL } from '@/lib/utils'
import type { Opportunity } from '@/types'

const QUESTION_META = [
  { key: 'traffic', no: 'Q1', title: '流量怎么来', icon: Megaphone, hint: '具体渠道 + 内容形式 + 前 100 个客户来源' },
  { key: 'money', no: 'Q2', title: '赚什么钱', icon: Coins, hint: '售卖实物 / 服务 / 信息 / 订阅，客单与占比' },
  { key: 'model', no: 'Q3', title: '商业模式形态', icon: Boxes, hint: '一句模式 + 价值链条 + 交付方式' },
  { key: 'roi', no: 'Q4', title: '投入回报与时间周期', icon: TrendingUp, hint: '启动资金 / 回本周期 / 月收入 / 毛利' },
  { key: 'audience', no: 'Q5', title: '适合人群', icon: Users, hint: '什么资源/技能/身份的人最适合，谁不适合' },
  { key: 'drivers', no: 'Q6', title: '驱动类型', icon: Zap, hint: '资本 / 技术 / 信息 / 跨国 / 政策 / 运营 / 供应链' },
  { key: 'moat', no: 'Q7', title: '壁垒是什么', icon: ShieldCheck, hint: '壁垒类型 + 所需前置条件；没有壁垒要如实说' },
] as const

const TIER_META: Record<string, { label: string; color: string; desc: string }> = {
  primary: { label: '一手', color: '#3ddc97', desc: '用户原声 / 平台数据 / 官方文件' },
  secondary: { label: '二手', color: '#4cc9f0', desc: '媒体报道 / 研究报告' },
  marketing: { label: '营销稿', color: '#ffb547', desc: '仅作参考，不计入证据分' },
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function useChecklist(key: string, count: number) {
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`radar:checklist:${key}`)
      setChecked(raw ? JSON.parse(raw) : {})
    } catch {
      setChecked({})
    }
  }, [key])
  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = { ...prev, [i]: !prev[i] }
      try {
        localStorage.setItem(`radar:checklist:${key}`, JSON.stringify(next))
      } catch {
        /* localStorage 不可用时静默降级 */
      }
      return next
    })
  }
  const reset = () => {
    setChecked({})
    try {
      localStorage.removeItem(`radar:checklist:${key}`)
    } catch {
      /* ignore */
    }
  }
  const done = Object.entries(checked).filter(([i, v]) => v && Number(i) < count).length
  return { checked, toggle, reset, done }
}

function RangeText({ min, max, suffix }: { min: number; max: number; suffix?: string }) {
  return (
    <span className="num text-[12.5px] text-ink">
      {fmtCnyRange(min, max)}
      {suffix && <span className="ml-0.5 text-[10px] text-dim">{suffix}</span>}
    </span>
  )
}

function NotFound() {
  return (
    <div className="panel flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
      <Crosshair className="h-8 w-8 text-amber" />
      <div className="text-[15px] font-semibold">未找到该机会</div>
      <div className="text-[12px] text-muted">链接中的 ID 不在当前机会库中（可能已被重命名或数据尚未同步）。</div>
      <Link to="/rankings" className="mt-1 inline-flex h-8 items-center gap-1.5 rounded border border-signal/40 bg-signal/10 px-3 text-[12px] text-signal">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回排行榜
      </Link>
    </div>
  )
}

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>()
  const opp = (id && (oppById.get(id) || oppBySlug.get(id))) as Opportunity | undefined

  const [weights, setWeights] = useState<Record<string, number>>(defaultWeights())
  useEffect(() => {
    setWeights(defaultWeights())
  }, [id])

  const ranks = opp ? getOppRanks(opp.id) : []
  const related = opp ? relatedOpportunities(opp, 3) : []
  const checklist = useChecklist(opp?.id || 'unknown', opp?.first_steps_7d.length || 0)
  const { find: findExperiment, add: addExperiment, update: updateExperiment, items: experiments } = useExperiments()
  const experiment = opp ? findExperiment(opp.id) : undefined

  const [showExpForm, setShowExpForm] = useState(false)
  const [expBudget, setExpBudget] = useState(opp?.roi.capital_cny.min || 3000)
  const [expStart, setExpStart] = useState(dayjs().format('YYYY-MM-DD'))
  const [expEditing, setExpEditing] = useState(false)
  const [draftSpend, setDraftSpend] = useState(0)
  const [draftHours, setDraftHours] = useState(0)
  const [draftConclusion, setDraftConclusion] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  useEffect(() => {
    setShowExpForm(false)
    setExpEditing(false)
    setExpBudget(opp?.roi.capital_cny.min || 3000)
    setExpStart(dayjs().format('YYYY-MM-DD'))
    setCopied(false)
    setCopyFailed(false)
  }, [id])

  useEffect(() => {
    if (!experiment) return
    setDraftSpend(experiment.spend_cny)
    setDraftHours(experiment.hours)
    setDraftConclusion(experiment.conclusion)
  }, [experiment?.id, experiment?.updated_at])

  const experimentReview = experiment ? experimentReviewInfo(experiment) : null
  const experimentDayNo = experiment ? experimentDay(experiment) : 0
  const activeExperimentCount = experiments.filter((x) => x.status === 'active').length

  const normalized = useMemo(() => normalizeWeights(weights), [weights])
  const custom = useMemo(() => (opp ? scoreWithWeights(opp, weights) : { total: 0, grade: 'D' }), [opp, weights])
  const ranked = useMemo(() => rankByWeights(weights), [weights])
  const customRank = opp ? ranked.find((r) => r.opp.id === opp.id)?.rank ?? null : null
  const changed = weightsChanged(weights)

  const radarOption = useMemo<EChartsOption>(() => {
    if (!opp) return {}
    const avg = industryDimensionAverage(opp.industry_id)
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, data: ['本机会', '行业均值'], textStyle: { fontSize: 10 } },
      radar: {
        center: ['50%', '46%'],
        radius: '62%',
        splitNumber: 5,
        indicator: taxonomy.score_dimensions.map((d) => ({ name: d.name.replace('与', '/'), max: 10 })),
        axisName: { fontSize: 9 },
      },
      series: [
        {
          type: 'radar',
          symbolSize: 3.5,
          data: [
            {
              name: '本机会',
              value: taxonomy.score_dimensions.map((d) => (opp.scores.dimensions as Record<string, number>)[d.id] || 0),
              lineStyle: { color: gradeColor(opp.scores.grade), width: 1.8 },
              itemStyle: { color: gradeColor(opp.scores.grade) },
              areaStyle: { color: `${gradeColor(opp.scores.grade)}2e` },
            },
            {
              name: '行业均值',
              value: taxonomy.score_dimensions.map((d) => (avg as Record<string, number>)[d.id] || 0),
              lineStyle: { color: '#4cc9f0', width: 1.2, type: 'dashed' },
              itemStyle: { color: '#4cc9f0' },
              areaStyle: { color: 'rgba(76,201,240,.06)' },
            },
          ],
        },
      ],
    }
  }, [opp])

  const decayOption = useMemo<EChartsOption>(() => {
    if (!opp) return {}
    const hl = gapHalfLife(opp.gap_type_ids[0] || '')
    const data = decayCurve(hl, 36)
    return {
      grid: { left: 2, right: 6, top: 8, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis', formatter: (p: any) => `第 ${p[0].axisValue} 个月<br/>窗口价值：<b>${p[0].value}%</b>` },
      xAxis: { type: 'category', data: data.map((d) => d.month), axisLabel: { interval: 11, fontSize: 8.5 } },
      yAxis: { type: 'value', max: 100, axisLabel: { fontSize: 8.5, formatter: '{value}%' }, splitNumber: 2 },
      series: [
        {
          type: 'line',
          data: data.map((d) => d.value),
          symbol: 'none',
          lineStyle: { color: '#ffb547', width: 1.4 },
          areaStyle: { color: 'rgba(255,181,71,.10)' },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { fontSize: 8.5, color: '#8b93a7' },
            lineStyle: { color: '#39424f', type: 'dashed' },
            data: [{ xAxis: Math.max(0, Math.min(36, opp.window.months_left)), label: { formatter: `剩余 ${opp.window.months_left}M` } }],
          },
        },
      ],
    }
  }, [opp])

  if (!opp) return <NotFound />

  const dims = taxonomy.score_dimensions
  const scoreRows = dims.map((d) => ({
    dim: d,
    score: (opp.scores.dimensions as Record<string, number>)[d.id] || 0,
    weight: normalized[d.id] || 0,
    raw: weights[d.id] ?? 0,
  }))

  return (
    <div>
      <PageHeader
        index="02"
        kicker={
          <span className="flex items-center gap-2">
            <Link to="/rankings" className="inline-flex items-center gap-1 text-muted hover:text-signal">
              <ArrowLeft className="h-3 w-3" /> 排行榜
            </Link>
            <span className="text-dim">/</span>
            <span>OPPORTUNITY DETAIL</span>
          </span>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            <GradeBadge grade={opp.scores.grade} />
            <span>{opp.title}</span>
            {opp.verified ? <Badge tone="signal"><CircleCheck className="h-3 w-3" /> 已核验</Badge> : <Badge tone="amber"><AlertTriangle className="h-3 w-3" /> 待二次核验</Badge>}
          </span>
        }
        description={opp.one_liner}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">ID {opp.id}</Badge>
            <Badge tone="cyan">{opp.momentum.toFixed(1)}× 动量</Badge>
            <Badge tone="neutral">as_of {dataAsOf}</Badge>
            <button
              onClick={() => downloadOpportunityMarkdown(opp)}
              className="inline-flex h-7 items-center gap-1 rounded border border-signal/35 bg-signal/10 px-2.5 text-[11.5px] text-signal transition-colors hover:bg-signal/20"
              title="下载 Markdown 机会卡（七问 + 证据 + 动作 + 证伪 + 免责）"
            >
              <Download className="h-3 w-3" /> 机会卡 MD
            </button>
            <Link to="/rankings" className="inline-flex h-7 items-center gap-1 rounded border border-line bg-panel-2 px-2.5 text-[11.5px] text-muted hover:border-line-strong hover:text-ink">
              查看榜单 <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        }
      />

      <Panel className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11.5px]">
          <span className="h-2 w-2 rounded-sm" style={{ background: industryColor(opp.industry_id) }} />
          <span className="text-muted">{industryName(opp.industry_id)}</span>
        </span>
        <span className="text-[11.5px] text-dim">
          信息差：{opp.gap_type_ids.map((g) => <span key={g} className="ml-1 text-muted">{gapName(g)}</span>)}
        </span>
        <span className="text-[11.5px] text-dim">
          区域：{opp.region_ids.map((r) => <span key={r} className="ml-1 text-muted">{regionName(r)}</span>)}
        </span>
        <span className="text-[11.5px] text-dim">
          需求：{opp.human_need_ids.slice(0, 3).map((n) => <span key={n} className="ml-1 text-muted">{needName(n)}</span>)}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className="rounded border border-cyan/30 bg-cyan/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-cyan"
            title={
              rankingsDeltaBasis === 'history'
                ? `榜单 delta 为「较上一份历史快照」口径（上期 ${rankingsHistoryAsOf || '—'}）`
                : '榜单 delta 为「相邻窗口」口径（历史快照不足 1 天）'
            }
          >
            榜单口径：{deltaBasisLabel}
          </span>
          {historyBasisReplayLabel && (
            <span
              className="rounded border border-amber/40 bg-amber/10 px-1.5 py-0.5 font-mono text-[10px] text-amber"
              title={`上一份快照为历史回放（replay_as_of ${rankingsHistoryReplayAsOf || '—'}），仅用于补足 delta 演示与历史对照`}
            >
              {historyBasisReplayLabel}
            </span>
          )}
          <span className="font-mono text-[10px] text-dim">WINDOW</span>
          <span className="rounded border px-1.5 py-0.5 font-mono text-[10px]" style={{ color: WINDOW_STATUS_HEX[opp.window.status], borderColor: `${WINDOW_STATUS_HEX[opp.window.status]}55`, background: `${WINDOW_STATUS_HEX[opp.window.status]}14` }}>
            {WINDOW_STATUS_LABEL[opp.window.status]} · {opp.window.months_left}M · {DECAY_LABEL[opp.window.decay]}
          </span>
        </span>
      </Panel>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <SectionCard
            eyebrow="SCORE BREAKDOWN"
            title="10 维评分拆解 · 自定义权重实时重算"
            subtitle="拖动滑杆调整维度权重：归一化后按 docs/12 §4.5 公式实时计算总分、等级与库内排名。属演示交互，不写回数据文件。"
            right={
              <div className="flex items-center gap-2">
                <Badge tone="amber"><Sparkles className="h-3 w-3" /> 演示：权重可调</Badge>
                <button
                  onClick={() => setWeights(defaultWeights())}
                  className="inline-flex h-6 items-center gap-1 rounded border border-line px-2 text-[10.5px] text-muted hover:border-line-strong hover:text-ink"
                >
                  <RotateCcw className="h-3 w-3" /> 重置
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <Chart option={radarOption} height={286} />
                <div className="mt-1 flex items-center justify-between text-[10px] text-dim">
                  <span>实线 = 本机会，虚线 = 行业均值</span>
                  <span className="font-mono">MAX 10</span>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="mb-1.5 grid grid-cols-[94px_1fr_40px_52px] items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-dim">
                  <span>维度 / 得分</span>
                  <span>权重滑杆（相对）</span>
                  <span className="text-right">得分</span>
                  <span className="text-right">占比</span>
                </div>
                <div className="space-y-[7px]">
                  {scoreRows.map(({ dim, score, weight, raw }) => (
                    <div key={dim.id} className="grid grid-cols-[94px_1fr_40px_52px] items-center gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-[10.5px] text-muted">{dim.name}</span>
                          <InfoTip
                            content={
                              <span>
                                <b>{dim.name}</b> · 权重 {(dim.weight * 100).toFixed(0)}%
                                <br />
                                {dim.desc}
                                <br />
                                0 分：{dim.anchors?.['0'] || '—'}
                                <br />
                                5 分：{dim.anchors?.['5'] || '—'}
                                <br />
                                10 分：{dim.anchors?.['10'] || '—'}
                              </span>
                            }
                          >
                            <Info className="h-2.5 w-2.5 shrink-0 cursor-help text-dim" />
                          </InfoTip>
                        </div>
                        <div className="num text-[12.5px]" style={{ color: score >= 8 ? '#3ddc97' : score >= 6.5 ? '#e6e9f0' : '#8b93a7' }}>
                          {fmtScore(score)}
                        </div>
                      </div>
                      <Slider value={raw} min={0} max={0.3} step={0.005} onValueChange={(v) => setWeights((prev) => ({ ...prev, [dim.id]: v }))} label={dim.name} />
                      <span className="num text-right text-[10.5px] text-dim">{fmtScore(score)}</span>
                      <span className="num text-right text-[10.5px] text-muted">{(weight * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded border border-line/80 bg-black/20 p-2.5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <div className="mono-label">自定义总分</div>
                      <div className="num mt-0.5 text-[20px] font-semibold" style={{ color: gradeColor(custom.grade) }}>
                        {fmtScore(custom.total)}
                        {changed && <span className="ml-1 text-[10px] text-amber">({custom.total >= opp.scores.total ? '+' : ''}{fmtScore(custom.total - opp.scores.total)})</span>}
                      </div>
                    </div>
                    <div>
                      <div className="mono-label">等级</div>
                      <div className="mt-1"><GradeBadge grade={custom.grade} /></div>
                    </div>
                    <div>
                      <div className="mono-label">库内排名</div>
                      <div className="num mt-0.5 text-[16px] text-ink">#{customRank ?? '—'}<span className="text-[10px] text-dim"> / {ranked.length}</span></div>
                    </div>
                    <div>
                      <div className="mono-label">契约权重总分</div>
                      <div className="num mt-0.5 text-[16px] text-muted">{fmtScore(opp.scores.total)}</div>
                    </div>
                  </div>
                  <div className="mt-2 border-t border-line/60 pt-1.5 font-mono text-[9.5px] leading-relaxed text-dim">
                    归一化权重合计 {(Object.values(normalized).reduce((a, b) => a + b, 0) * 100).toFixed(0)}% · total = round(Σ(维度得分 × 权重) × 10, 1) · {changed ? <span className="text-amber">当前为演示权重</span> : <span className="text-signal">当前为契约权重</span>}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="SEVEN QUESTIONS"
            title="商业驱动七问 · 全部必答"
            subtitle="任何机会卡片都要回答清楚的七个问题；缺答即视为不合格机会。"
            right={<Badge tone="signal">7 / 7 已答</Badge>}
          >
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {QUESTION_META.map((q) => {
                const Icon = q.icon
                const isDrivers = q.key === 'drivers'
                return (
                  <Panel
                    key={q.key}
                    className={cn('p-2.5', q.key === 'moat' && 'md:col-span-2')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-signal">{q.no}</span>
                      <Icon className="h-3.5 w-3.5 text-dim" />
                      <span className="text-[12px] font-medium text-ink">{q.title}</span>
                      <span className="ml-auto hidden text-[9.5px] text-dim lg:inline">{q.hint}</span>
                    </div>
                    {isDrivers ? (
                      <div className="mt-1.5 space-y-1">
                        {opp.seven_questions.drivers.map((d) => {
                          const info = lookups.drivers.get(d)
                          return (
                            <div key={d} className="flex items-start gap-2">
                              <Badge tone="amber">{driverName(d)}</Badge>
                              <span className="text-[11px] leading-relaxed text-muted">{info?.desc || '驱动类型'}</span>
                            </div>
                          )
                        })}
                        {!opp.seven_questions.drivers.length && <div className="text-[11px] text-dim">暂无驱动类型</div>}
                      </div>
                    ) : (
                      <p className="mt-1.5 whitespace-pre-line text-[11.5px] leading-relaxed text-muted">
                        {String(opp.seven_questions[q.key as keyof typeof opp.seven_questions] || '暂无')}
                      </p>
                    )}
                  </Panel>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="EVIDENCE CHAIN"
            title={`证据链 · ${opp.signal.evidence.length} 条`}
            subtitle="优先多个不同主体来源做三角验证；营销稿不计入证据分。"
            right={
              <div className="flex items-center gap-1.5">
                <Badge tone={opp.verified ? 'signal' : 'amber'}>{opp.verified ? 'URL 已核验' : '待二次核验'}</Badge>
                <Badge tone="muted">{opp.evidence_count} / 文本 {opp.signal.evidence.length}</Badge>
              </div>
            }
          >
            <div className="mb-2 rounded border border-line/70 bg-white/[0.015] px-2.5 py-2 text-[11.5px] leading-relaxed text-muted">
              <span className="font-mono text-[10px] text-signal">SIGNAL.</span> {opp.signal.summary}
            </div>
            <div className="space-y-2">
              {opp.signal.evidence.map((e, i) => {
                const tier = TIER_META[e.tier || 'secondary'] || TIER_META.secondary
                return (
                  <div key={`${e.url}-${i}`} className="rounded border border-line/80 p-2.5 transition-colors hover:border-line-strong">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9.5px]" style={{ color: tier.color, borderColor: `${tier.color}55`, background: `${tier.color}12` }} title={tier.desc}>
                        TIER · {tier.label}
                      </span>
                      <span className="text-[10.5px] text-muted">{e.publisher}</span>
                      <span className="font-mono text-[9.5px] text-dim">{e.date}</span>
                      <span className="ml-auto flex items-center gap-2">
                        <span className="font-mono text-[9px] uppercase text-dim">{e.lang}</span>
                        {e.url && (
                          <a href={e.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[10px] text-cyan hover:text-signal">
                            {hostOf(e.url)} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] font-medium text-ink">{e.title}</div>
                    {e.quote && (
                      <blockquote className="mt-1 border-l-2 border-line-strong pl-2 text-[11px] leading-relaxed text-muted">“{e.quote}”</blockquote>
                    )}
                  </div>
                )
              })}
              {!opp.signal.evidence.length && <EmptyState title="暂无证据" hint="该机会的 signal.evidence 为空，使用前必须补充来源。" />}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <SectionCard
              eyebrow="7-DAY VALIDATION"
              title="7 天验证动作清单"
              subtitle="勾选即本地保存（localStorage），不联网、不上传。"
              right={
                <button onClick={checklist.reset} className="inline-flex items-center gap-1 text-[10.5px] text-dim hover:text-ink">
                  <RotateCcw className="h-3 w-3" /> 重置
                </button>
              }
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10.5px] text-dim">完成进度</span>
                <span className="num text-[11px] text-signal">{checklist.done} / {opp.first_steps_7d.length}</span>
              </div>
              <ProgressBar value={checklist.done} max={Math.max(1, opp.first_steps_7d.length)} />
              <div className="mt-2.5 space-y-1">
                {opp.first_steps_7d.map((step, i) => {
                  const done = !!checklist.checked[i]
                  return (
                    <button
                      key={i}
                      onClick={() => checklist.toggle(i)}
                      className={cn(
                        'flex w-full items-start gap-2 rounded border px-2 py-1.5 text-left transition-colors',
                        done ? 'border-signal/30 bg-signal/[0.06]' : 'border-line/70 hover:border-line-strong',
                      )}
                    >
                      <span className={cn('mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border', done ? 'border-signal bg-signal/20 text-signal' : 'border-line-strong text-transparent')}>
                        <Check className="h-2.5 w-2.5" />
                      </span>
                      <span className={cn('text-[11px] leading-relaxed', done ? 'text-dim line-through' : 'text-muted')}>
                        <span className="mr-1 font-mono text-[9.5px] text-dim">D{i + 1}</span>
                        {step}
                      </span>
                    </button>
                  )
                })}
                {!opp.first_steps_7d.length && <EmptyState title="暂无验证动作" />}
              </div>
            </SectionCard>

            <div className="space-y-3">
              <SectionCard eyebrow="FALSIFICATION" title="证伪条件 · 何时放弃" right={<XCircle className="h-4 w-4 text-danger" />}>
                <ul className="space-y-1.5">
                  {opp.kill_criteria.map((k, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted">
                      <span className="mt-1 font-mono text-[9px] text-danger">K{i + 1}</span>
                      <span>{k}</span>
                    </li>
                  ))}
                  {!opp.kill_criteria.length && <li className="text-[11px] text-dim">暂无证伪条件</li>}
                </ul>
              </SectionCard>
              <SectionCard eyebrow="RISK" title="风险清单" right={<ShieldAlert className="h-4 w-4 text-amber" />}>
                <ul className="space-y-1.5">
                  {opp.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber/80" />
                      <span>{r}</span>
                    </li>
                  ))}
                  {!opp.risks.length && <li className="text-[11px] text-dim">暂无风险条目</li>}
                </ul>
              </SectionCard>
            </div>
          </div>

          <SectionCard eyebrow="COMPLIANCE" title="合规与注意事项" right={<Scale className="h-4 w-4 text-cyan" />}>
            <p className="text-[11.5px] leading-relaxed text-muted">{opp.compliance_notes || '暂无合规备注；涉及跨境 / 金融 / 医疗 / 宗教时请自行核查。'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="cyan">来源语言 {opp.source_langs.join(' / ') || '—'}</Badge>
              <Badge tone="neutral">证据 {opp.evidence_count} 条</Badge>
              <Badge tone={opp.verified ? 'signal' : 'amber'}>{opp.verified ? '已核验' : '未二次核验'}</Badge>
            </div>
          </SectionCard>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="mono-label">RELATED OPPORTUNITIES</div>
                <div className="text-[13.5px] font-semibold">相关机会</div>
              </div>
              <Link to="/rankings" className="text-[11px] text-muted hover:text-signal">浏览全部 →</Link>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              {related.map((r) => (
                <OpportunityCard key={r.id} opp={r} compact />
              ))}
              {!related.length && <div className="md:col-span-3"><EmptyState title="暂无相关机会" /></div>}
            </div>
          </div>
        </div>

        <aside className="space-y-3 xl:col-span-4">
          <SectionCard eyebrow="SCORE" title="评分与排名" bodyClassName="p-3.5">
            <div className="flex items-end justify-between gap-2">
              <div className="flex items-end gap-2">
                <span className="num text-[42px] font-semibold leading-none tracking-tight" style={{ color: gradeColor(opp.scores.grade) }}>
                  {fmtScore(opp.scores.total)}
                </span>
                <div className="pb-1">
                  <GradeBadge grade={opp.scores.grade} />
                  <div className="mt-1 text-[10px] text-dim">{gradeName(opp.scores.grade)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="mono-label">RANK_SCORE</div>
                <div className="num text-[18px] text-ink">{fmtScore(opp.rank_score)}</div>
                <div className="mono-label mt-1">动量</div>
                <div className="num text-[13px] text-amber">×{opp.momentum.toFixed(1)}</div>
              </div>
            </div>
            <ProgressBar value={opp.scores.total} max={100} className="mt-2.5" tone={opp.scores.total >= 85 ? 'amber' : 'signal'} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded border border-line/70 bg-white/[0.015] px-2 py-1.5">
                <div className="mono-label">信号强度</div>
                <div className="num text-[14px] text-ink">{fmtScore(opp.signal.signal_strength)}<span className="text-[9px] text-dim"> / 10</span></div>
              </div>
              <div className="rounded border border-line/70 bg-white/[0.015] px-2 py-1.5">
                <div className="mono-label">证据数</div>
                <div className="num text-[14px] text-ink">{opp.evidence_count}<span className="text-[9px] text-dim"> 条</span></div>
              </div>
            </div>
            <div className="mt-3 border-t border-line/70 pt-2">
              <div className="mono-label mb-1.5">当前榜单名次</div>
              {ranks.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {ranks.map((r) => (
                    <span key={r.window} className="inline-flex items-center gap-1 rounded border border-line bg-panel-2 px-1.5 py-0.5 text-[10.5px]">
                      <span className="text-dim">{r.label}</span>
                      <span className="num text-signal">#{r.rank}</span>
                      <span className="font-mono text-[9px] text-dim">{fmtScore(r.total)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-dim">当前未进入日 / 周 / 月 / 年榜单</div>
              )}
            </div>
            {changed && (
              <div className="mt-2 rounded border border-amber/30 bg-amber/[0.06] px-2 py-1.5 text-[10px] leading-relaxed text-amber">
                已启用自定义权重：演示总分 {fmtScore(custom.total)}，库内排名 #{customRank}。此状态仅本页有效。
              </div>
            )}
          </SectionCard>

          <SectionCard
            eyebrow="EXPERIMENT"
            title="7 天实验"
            right={<FlaskConical className="h-4 w-4 text-cyan" />}
            bodyClassName="p-3.5"
          >
            {experiment ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px]"
                    style={{
                      color: EXPERIMENT_STATUS[experiment.status].color,
                      borderColor: `${EXPERIMENT_STATUS[experiment.status].color}55`,
                      background: `${EXPERIMENT_STATUS[experiment.status].color}12`,
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: EXPERIMENT_STATUS[experiment.status].color }} />
                    {EXPERIMENT_STATUS[experiment.status].label}
                  </span>
                  <span className="font-mono text-[9.5px] text-dim">第 {experimentDayNo} 天 / 7 天周期</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <div className="mono-label">预算</div>
                    <div className="num text-[11.5px] text-muted">{fmtCnyRange(experiment.budget_cny, experiment.budget_cny)}</div>
                  </div>
                  <div>
                    <div className="mono-label">已花费</div>
                    <div className="num text-[11.5px] text-ink">{fmtCnyRange(experiment.spend_cny, experiment.spend_cny)}</div>
                  </div>
                  <div>
                    <div className="mono-label">耗时</div>
                    <div className="num text-[11.5px] text-muted">{experiment.hours} h</div>
                  </div>
                </div>
                <div className="mt-1.5 font-mono text-[9.5px] text-dim">
                  开始 {experiment.started_at}
                  {experimentReview && (
                    <span className={cn('ml-2', experimentReview.overdue ? 'text-danger' : experimentReview.daysLeft <= 1 ? 'text-amber' : '')}>
                      复盘 {experimentReview.dueDate}{experimentReview.overdue ? ' · 已逾期' : experimentReview.daysLeft === 0 ? ' · 今天' : ` · 还有 ${experimentReview.daysLeft} 天`}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 rounded border border-line/60 bg-black/15 px-2 py-1.5 text-[10.5px] leading-relaxed text-muted">
                  <span className="font-mono text-[9px] text-dim">CONCLUSION. </span>
                  {experiment.conclusion || '尚未填写结论；点「更新记录」记录花费、耗时与验证结果。'}
                </div>
                {expEditing && (
                  <div className="mt-2 rounded border border-cyan/25 bg-cyan/[0.03] p-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mono-label">已花费 CNY</span>
                        <input type="number" min={0} value={draftSpend} onChange={(e) => setDraftSpend(Number(e.target.value) || 0)} className="h-7 w-full rounded border border-line bg-panel-2 px-2 text-[11.5px] outline-none focus:border-signal/50" />
                      </label>
                      <label className="block">
                        <span className="mono-label">耗时（小时）</span>
                        <input type="number" min={0} step={0.5} value={draftHours} onChange={(e) => setDraftHours(Number(e.target.value) || 0)} className="h-7 w-full rounded border border-line bg-panel-2 px-2 text-[11.5px] outline-none focus:border-signal/50" />
                      </label>
                    </div>
                    <label className="mt-2 block">
                      <span className="mono-label">结论 / 复盘记录</span>
                      <textarea rows={2} value={draftConclusion} onChange={(e) => setDraftConclusion(e.target.value)} className="w-full rounded border border-line bg-panel-2 px-2 py-1 text-[11px] outline-none focus:border-signal/50" placeholder="验证到什么？下一步继续、加注还是止损？" />
                    </label>
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      <Button size="xs" variant="ghost" onClick={() => setExpEditing(false)}>取消</Button>
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => {
                          updateExperiment(experiment.id, { spend_cny: Number(draftSpend) || 0, hours: Number(draftHours) || 0, conclusion: draftConclusion })
                          setExpEditing(false)
                        }}
                      >
                        保存记录
                      </Button>
                    </div>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {experiment.status === 'active' && (
                    <>
                      <Button size="xs" variant="primary" onClick={() => updateExperiment(experiment.id, { status: 'verified', conclusion: experiment.conclusion || '已验证：达到 7 天验证目标' })}>
                        <CircleCheck className="h-3 w-3" /> 标记已验证
                      </Button>
                      <Button size="xs" variant="outline" onClick={() => updateExperiment(experiment.id, { status: 'abandoned', conclusion: experiment.conclusion || '已放弃：未达验证标准' })}>
                        <XCircle className="h-3 w-3" /> 已放弃
                      </Button>
                    </>
                  )}
                  <Button size="xs" variant="ghost" onClick={() => setExpEditing((v) => !v)}>
                    <Clock3 className="h-3 w-3" /> 更新记录
                  </Button>
                  <Link to="/lab" className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-muted hover:text-signal">
                    实验台 <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] leading-relaxed text-muted">
                  还没有加入实验。把这条机会当作一个 7 天可验证假设：记录预算、每天动作，7 天后按证伪条件决定继续或止损。
                  {activeExperimentCount > ACTIVE_CAPACITY && (
                    <span className="mt-1 block text-amber">当前已有 {activeExperimentCount} 个进行中实验，超过个人产能上限 {ACTIVE_CAPACITY}，建议先结案。</span>
                  )}
                </p>
                {showExpForm ? (
                  <div className="mt-2 rounded border border-signal/25 bg-signal/[0.03] p-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mono-label">开始日期</span>
                        <input type="date" value={expStart} onChange={(e) => setExpStart(e.target.value)} className="h-7 w-full rounded border border-line bg-panel-2 px-2 text-[11.5px] outline-none focus:border-signal/50" />
                      </label>
                      <label className="block">
                        <span className="mono-label">预算 CNY</span>
                        <input type="number" min={0} value={expBudget} onChange={(e) => setExpBudget(Number(e.target.value) || 0)} className="h-7 w-full rounded border border-line bg-panel-2 px-2 text-[11.5px] outline-none focus:border-signal/50" />
                      </label>
                    </div>
                    <div className="mt-2 flex justify-end gap-1.5">
                      <Button size="xs" variant="ghost" onClick={() => setShowExpForm(false)}>取消</Button>
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => {
                          addExperiment({ opp_id: opp.id, started_at: expStart, budget_cny: Number(expBudget) || 0, title: opp.title })
                          setShowExpForm(false)
                        }}
                      >
                        <FlaskConical className="h-3 w-3" /> 加入并开始
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="xs" variant="primary" className="mt-2" onClick={() => setShowExpForm(true)}>
                    <FlaskConical className="h-3 w-3" /> 开始 7 天实验
                  </Button>
                )}
                <div className="mt-2 flex items-center justify-between text-[9.5px] text-dim">
                  <span>数据仅存本机 localStorage · 不联网</span>
                  <Link to="/lab" className="hover:text-signal">打开实验台 →</Link>
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard eyebrow="ROI" title="投入与回报" right={<TrendingUp className="h-4 w-4 text-signal" />} bodyClassName="p-3.5">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              <div>
                <div className="mono-label">启动资金</div>
                <div className="mt-0.5"><RangeText min={opp.roi.capital_cny.min} max={opp.roi.capital_cny.max} /></div>
              </div>
              <div>
                <div className="mono-label">月收入</div>
                <div className="mt-0.5"><RangeText min={opp.roi.monthly_revenue_cny.min} max={opp.roi.monthly_revenue_cny.max} /></div>
              </div>
              <div>
                <div className="mono-label">回本周期</div>
                <div className="num mt-0.5 text-[15px] text-ink">{opp.roi.payback_months}<span className="text-[9px] text-dim"> 个月</span></div>
              </div>
              <div>
                <div className="mono-label">首次收入</div>
                <div className="num mt-0.5 text-[15px] text-ink">{opp.roi.time_to_revenue_months}<span className="text-[9px] text-dim"> 个月</span></div>
              </div>
              <div>
                <div className="mono-label">毛利率</div>
                <div className="num mt-0.5 text-[15px] text-signal">{opp.roi.gross_margin_pct}%</div>
                <ProgressBar value={opp.roi.gross_margin_pct} max={100} className="mt-1" />
              </div>
              <div>
                <div className="mono-label">投入程度</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge tone="amber">{EFFORT_LABEL[opp.roi.effort_level] || opp.roi.effort_level}</Badge>
                  <span className="text-[10px] text-dim">{opp.roi.team_size} 人</span>
                </div>
              </div>
            </div>
            <div className="mt-2.5 border-t border-line/70 pt-2 text-[10.5px] leading-relaxed text-muted">
              {opp.seven_questions.roi}
            </div>
          </SectionCard>

          <SectionCard eyebrow="SIGNAL & WINDOW" title="信号与窗口" bodyClassName="p-3.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mono-label">窗口状态</div>
                <div className="mt-0.5 text-[12px]" style={{ color: WINDOW_STATUS_HEX[opp.window.status] }}>{WINDOW_STATUS_LABEL[opp.window.status]}</div>
              </div>
              <div>
                <div className="mono-label">剩余窗口</div>
                <div className="num mt-0.5 text-[16px] text-ink">{opp.window.months_left}<span className="text-[9px] text-dim"> 个月</span></div>
              </div>
              <div>
                <div className="mono-label">衰减速度</div>
                <div className="mt-0.5 text-[11.5px] text-muted">{DECAY_LABEL[opp.window.decay] || opp.window.decay}</div>
              </div>
              <div>
                <div className="mono-label">趋势</div>
                <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted">
                  {opp.signal.trend_direction === 'up' ? <TrendingUp className="h-3.5 w-3.5 text-signal" /> : opp.signal.trend_direction === 'down' ? <XCircle className="h-3.5 w-3.5 text-danger" /> : <Clock3 className="h-3.5 w-3.5 text-dim" />}
                  {TREND_LABEL[opp.signal.trend_direction] || opp.signal.trend_direction}
                </div>
              </div>
            </div>
            <div className="mt-2 rounded border border-line/70 bg-white/[0.015] px-2 py-1.5 text-[10.5px] leading-relaxed text-muted">
              <span className="mono text-[9px] text-dim">VOLUME.</span> {opp.signal.volume_estimate}
            </div>
            <div className="mt-2">
              <div className="mono-label mb-1">窗口价值衰减（按 {gapName(opp.gap_type_ids[0] || '')} 半衰期 {gapHalfLife(opp.gap_type_ids[0] || '')}M 估算）</div>
              <Chart option={decayOption} height={116} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {opp.activity_dates.slice(-4).map((d) => (
                <span key={d} className="rounded border border-line/70 px-1.5 py-0.5 font-mono text-[9.5px] text-dim">{d}</span>
              ))}
              <span className="ml-auto font-mono text-[9.5px] text-dim">首次 {fmtDate(opp.first_seen)}</span>
            </div>
          </SectionCard>

          <SectionCard eyebrow="TAGS & META" title="标签与元信息" bodyClassName="p-3.5">
            <div className="flex flex-wrap gap-1">
              {opp.tags.map((t) => (
                <span key={t} className="rounded border border-line bg-panel-2 px-1.5 py-0.5 text-[10px] text-muted">{tagName(t)}</span>
              ))}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px]">
              <div><span className="text-dim">信号发源：</span><span className="text-muted">{opp.origin_country}</span></div>
              <div><span className="text-dim">目标市场：</span><span className="text-muted">{opp.target_countries.join(' / ') || '—'}</span></div>
              <div><span className="text-dim">需求：</span><span className="text-muted">{opp.human_need_ids.map(needName).join(' / ')}</span></div>
              <div><span className="text-dim">神经递质：</span><span className="text-muted">{opp.neuro_drivers.map(neuroName).join(' / ')}</span></div>
              <div><span className="text-dim">情绪：</span><span className="text-muted">{opp.emotion_tags.map(emotionName).join(' / ')}</span></div>
              <div><span className="text-dim">语言：</span><span className="text-muted">{opp.source_langs.join(' / ') || '—'}</span></div>
            </div>
            <div className="mt-2 rounded border border-line/60 bg-black/20 px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
              <span className="text-amber">免责声明：</span>{opp.disclaimer}
            </div>
          </SectionCard>

          <SectionCard eyebrow="EXPORT" title="导出与分享" right={<Download className="h-4 w-4 text-cyan" />} bodyClassName="p-3.5">
            <div className="grid grid-cols-1 gap-1.5">
              <button
                onClick={async () => {
                  const ok = await copyText(opportunityCardMarkdown(opp))
                  setCopied(ok)
                  setCopyFailed(!ok)
                  window.setTimeout(() => {
                    setCopied(false)
                    setCopyFailed(false)
                  }, 2600)
                }}
                className="flex items-center justify-between rounded border border-line/70 px-2 py-1.5 text-[10.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <span className="flex items-center gap-1.5"><Copy className="h-3 w-3" /> 复制机会卡 Markdown</span>
                <span className={cn('font-mono text-[9.5px]', copied ? 'text-signal' : copyFailed ? 'text-amber' : 'text-dim')}>
                  {copied ? '已复制 ✓' : copyFailed ? '复制受限 · 请用下载' : '七问 + 证据 + 免责'}
                </span>
              </button>
              <button
                onClick={() => downloadOpportunityMarkdown(opp)}
                className="flex items-center justify-between rounded border border-line/70 px-2 py-1.5 text-[10.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> 下载机会卡 .md</span>
                <span className="font-mono text-[9.5px] text-dim">单条机会</span>
              </button>
              <button
                onClick={() => downloadPeriodReport('week', 'md')}
                className="flex items-center justify-between rounded border border-line/70 px-2 py-1.5 text-[10.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <span className="flex items-center gap-1.5"><Download className="h-3 w-3" /> 导出本周报告 .md</span>
                <span className="font-mono text-[9.5px] text-dim">含 Top10 七问</span>
              </button>
              <button
                onClick={() => downloadPeriodReport('week', 'html')}
                className="flex items-center justify-between rounded border border-line/70 px-2 py-1.5 text-[10.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> 导出本周报告 .html</span>
                <span className="font-mono text-[9.5px] text-dim">自包含可打印</span>
              </button>
            </div>
            <div className="mt-2 rounded border border-line/60 bg-white/[0.015] px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
              报告在浏览器本地用已打包数据生成（Blob 下载，不联网）；扫描器也会在 <span className="font-mono">data/reports/</span> 生成同结构报告，二者互为补充。
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  )
}
