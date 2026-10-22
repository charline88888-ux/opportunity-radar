import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Download,
  FileJson,
  FileText,
  FlaskConical,
  Pencil,
  Plus,
  Timer,
  Trash2,
  Wallet,
  XCircle,
  Target,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, EmptyState, Panel, ProgressBar, SectionCard, Segmented } from '@/components/ui'
import { dataAsOf, opportunities, oppById, rankingsDeltaBasis, rankingsHistoryAsOf, historyMeta } from '@/lib/data'
import {
  ACTIVE_CAPACITY,
  EXPERIMENT_OUTCOME,
  EXPERIMENT_STATUS,
  OUTCOME_OPTIONS,
  REVIEW_CYCLE_DAYS,
  experimentDay,
  experimentReviewInfo,
  experimentStats,
  statusLabel,
  useExperiments,
  type Experiment,
  type ExperimentOutcome,
  type ExperimentStatus,
} from '@/lib/experiments'
import { downloadExperiments } from '@/lib/exports'
import { cn, fmtCnyRange, fmtInt, fmtPct } from '@/lib/utils'
import type { Opportunity } from '@/types'

type Filter = 'all' | ExperimentStatus

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'verified', label: '已验证' },
  { value: 'abandoned', label: '已放弃' },
]

const inputCls =
  'h-7 w-full rounded border border-line bg-panel-2 px-2 text-[11.5px] text-ink outline-none transition-colors placeholder:text-dim focus:border-signal/50'

function StatusBadge({ status }: { status: ExperimentStatus }) {
  const meta = EXPERIMENT_STATUS[status]
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px]"
      style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}12` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

function OutcomeBadge({ outcome }: { outcome: ExperimentOutcome | null }) {
  if (!outcome) return <span className="rounded border border-line/70 px-1.5 py-0.5 font-mono text-[9.5px] text-dim">未结案结果</span>
  const meta = EXPERIMENT_OUTCOME[outcome]
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9.5px]"
      style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}12` }}
      title={meta.description}
    >
      结果 · {meta.short}
    </span>
  )
}

function ExperimentCard({
  item,
  editing,
  onEdit,
  onCancelEdit,
  onUpdate,
  onRemove,
}: {
  item: Experiment
  editing: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onUpdate: (patch: Partial<Experiment>) => void
  onRemove: () => void
}) {
  const opp = oppById.get(item.opp_id)
  const review = experimentReviewInfo(item)
  const day = experimentDay(item)
  const [draft, setDraft] = useState<Partial<Experiment>>({
    status: item.status,
    outcome: item.outcome,
    ended_at: item.ended_at,
    spend_cny: item.spend_cny,
    hours: item.hours,
    conclusion: item.conclusion,
  })

  useEffect(() => {
    setDraft({
      status: item.status,
      outcome: item.outcome,
      ended_at: item.ended_at,
      spend_cny: item.spend_cny,
      hours: item.hours,
      conclusion: item.conclusion,
    })
  }, [item.status, item.outcome, item.ended_at, item.spend_cny, item.hours, item.conclusion, editing])

  const closeWith = (status: ExperimentStatus, outcome: ExperimentOutcome) =>
    onUpdate({
      status,
      outcome,
      ended_at: dayjs().format('YYYY-MM-DD'),
      conclusion: item.conclusion || EXPERIMENT_OUTCOME[outcome].description,
    })

  return (
    <Panel className={cn('p-3', item.status === 'active' && 'border-amber/25')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <StatusBadge status={item.status} />
            <OutcomeBadge outcome={item.outcome} />
            <Link to={`/opportunities/${item.opp_id}`} className="min-w-0 truncate text-[13px] font-semibold text-ink hover:text-signal">
              {item.title}
            </Link>
            <ArrowUpRight className="h-3 w-3 shrink-0 text-dim" />
            {opp && <span className="rounded border border-line px-1.5 py-0.5 text-[9.5px] text-dim">{opp.scores.grade} 级 · {opp.scores.total.toFixed(1)}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9.5px] text-dim">
            <span>开始 {item.started_at}</span>
            {item.ended_at && <span>结案 {item.ended_at}</span>}
            <span>第 {day} 天 / {REVIEW_CYCLE_DAYS} 天周期</span>
            <span className={cn(review.overdue ? 'text-danger' : review.daysLeft <= 1 ? 'text-amber' : '')}>
              复盘 {review.dueDate}{review.overdue ? ' · 已逾期' : review.daysLeft === 0 ? ' · 今天' : ` · 还有 ${review.daysLeft} 天`}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!editing && (
            <>
              {item.status === 'active' && (
                <>
                  <Button size="xs" variant="primary" onClick={() => closeWith('verified', 'positive')}>
                    <CheckCircle2 className="h-3 w-3" /> 正向结案
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => closeWith('abandoned', 'negative')}>
                    <XCircle className="h-3 w-3" /> 负向结案
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => closeWith('abandoned', 'inconclusive')}>
                    结果不明确
                  </Button>
                </>
              )}
              <Button size="xs" variant="ghost" onClick={onEdit}><Pencil className="h-3 w-3" /> 更新</Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-danger/80 hover:bg-danger/10 hover:text-danger"
                onClick={() => {
                  if (window.confirm(`删除实验「${item.title}」？此操作不可恢复。`)) onRemove()
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <div className="mono-label">预算</div>
          <div className="num text-[12px] text-muted">{fmtCnyRange(item.budget_cny, item.budget_cny)}</div>
        </div>
        <div>
          <div className="mono-label">已花费</div>
          <div className="num text-[12px] text-ink">{fmtCnyRange(item.spend_cny, item.spend_cny)}</div>
        </div>
        <div>
          <div className="mono-label">耗时</div>
          <div className="num text-[12px] text-muted">{fmtInt(item.hours)} h</div>
        </div>
        <div>
          <div className="mono-label">预算使用率</div>
          <div className="mt-1 flex items-center gap-1.5">
            <ProgressBar value={item.spend_cny} max={Math.max(1, item.budget_cny)} tone={item.spend_cny > item.budget_cny ? 'amber' : 'signal'} className="flex-1" />
            <span className="num text-[9.5px] text-dim">{item.budget_cny ? fmtPct((item.spend_cny / item.budget_cny) * 100) : '—'}</span>
          </div>
        </div>
      </div>

      {!editing && (
        <div className="mt-2 rounded border border-line/60 bg-black/15 px-2 py-1.5 text-[10.5px] leading-relaxed text-muted">
          <span className="font-mono text-[9px] text-dim">CONCLUSION. </span>
          {item.conclusion || '尚未填写结论；7 天周期结束时请写下「验证到什么 / 是否继续」。'}
        </div>
      )}

      {editing && (
        <div className="mt-2 rounded border border-signal/25 bg-signal/[0.03] p-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mono-label">状态</span>
              <select
                className={inputCls}
                value={draft.status || item.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as ExperimentStatus }))}
              >
                <option value="active">进行中</option>
                <option value="verified">已验证</option>
                <option value="abandoned">已放弃</option>
              </select>
            </label>
            <label className="block">
              <span className="mono-label">结果 outcome（用于校准）</span>
              <select
                className={inputCls}
                value={draft.outcome || ''}
                onChange={(e) => setDraft((d) => ({ ...d, outcome: (e.target.value || null) as ExperimentOutcome | null }))}
              >
                <option value="">未结案 / 暂无结果</option>
                {OUTCOME_OPTIONS.map((o) => (
                  <option key={o} value={o}>{EXPERIMENT_OUTCOME[o].label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mono-label">结案日期</span>
              <input
                type="date"
                className={inputCls}
                value={draft.ended_at || ''}
                onChange={(e) => setDraft((d) => ({ ...d, ended_at: e.target.value || null }))}
              />
            </label>
            <label className="block">
              <span className="mono-label">已花费 CNY</span>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={draft.spend_cny ?? 0}
                onChange={(e) => setDraft((d) => ({ ...d, spend_cny: Number(e.target.value) || 0 }))}
              />
            </label>
            <label className="block">
              <span className="mono-label">耗时（小时）</span>
              <input
                type="number"
                min={0}
                step={0.5}
                className={inputCls}
                value={draft.hours ?? 0}
                onChange={(e) => setDraft((d) => ({ ...d, hours: Number(e.target.value) || 0 }))}
              />
            </label>
            <div className="rounded border border-line/60 bg-black/15 px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
              outcome 与机会评分 join 后，会在「回测校准」页检查预测等级是否说得准；样本 &lt;3 只做方向性提示。
            </div>
          </div>
          <label className="mt-2 block">
            <span className="mono-label">结论 / 复盘记录</span>
            <textarea
              rows={2}
              className={cn(inputCls, 'h-auto py-1.5')}
              placeholder="验证到什么？数据/访谈/订单证据？下一步继续、加注还是止损？"
              value={draft.conclusion ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, conclusion: e.target.value }))}
            />
          </label>
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button size="xs" variant="ghost" onClick={onCancelEdit}>取消</Button>
            <Button
              size="xs"
              variant="primary"
              onClick={() => {
                const patch: Partial<Experiment> = { ...draft }
                if (patch.outcome && !patch.ended_at) patch.ended_at = dayjs().format('YYYY-MM-DD')
                onUpdate(patch)
              }}
            >
              保存记录
            </Button>
          </div>
        </div>
      )}
    </Panel>
  )
}

export default function Lab() {
  const { items, add, update, remove } = useExperiments()
  const [filter, setFilter] = useState<Filter>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newOppId, setNewOppId] = useState(opportunities[0]?.id || '')
  const [newStart, setNewStart] = useState(dayjs().format('YYYY-MM-DD'))
  const [newBudget, setNewBudget] = useState<number>(opportunities[0]?.roi.capital_cny.min || 3000)

  const stats = experimentStats(items)
  const overCapacity = stats.active > ACTIVE_CAPACITY
  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((x) => x.status === filter)),
    [items, filter],
  )
  const activeItems = items.filter((x) => x.status === 'active')
  const newOpp: Opportunity | undefined = oppById.get(newOppId)

  const handleAdd = () => {
    if (!newOppId) return
    add({ opp_id: newOppId, budget_cny: newBudget, started_at: newStart })
    setShowForm(false)
    setFilter('all')
  }

  return (
    <div>
      <PageHeader
        index="07"
        kicker="LAB · 实验台"
        title="实验台 · 7 天验证与复盘"
        description={
          <>
            把榜单里的机会变成可追踪的实验：记录开始日期、预算、花费、耗时与结论。数据只保存在本机浏览器（localStorage），不上传、不联网。
            {rankingsDeltaBasis === 'adjacent-window' ? '当前榜单 delta 为相邻窗口口径，历史快照不足 1 天。' : `当前榜单 delta 较上一快照（${rankingsHistoryAsOf || '—'}）。`}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-3.5 w-3.5" /> {showForm ? '收起新建' : '新建实验'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadExperiments(items, 'md')} disabled={!items.length}>
              <FileText className="h-3.5 w-3.5" /> 导出 MD
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadExperiments(items, 'json')} disabled={!items.length}>
              <FileJson className="h-3.5 w-3.5" /> 导出 JSON
            </Button>
            <Link
              to="/calibration"
              className="inline-flex h-7 items-center gap-1.5 rounded border border-cyan/35 bg-cyan/10 px-2.5 text-[12px] text-cyan transition-colors hover:bg-cyan/20"
              title="回测校准：预测等级 vs 实验结果"
            >
              <Target className="h-3.5 w-3.5" /> 回测校准
            </Link>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        {[
          { label: '进行中实验', value: `${stats.active}`, unit: `/ ${ACTIVE_CAPACITY} 产能上限`, color: overCapacity ? '#ffb547' : '#3ddc97', warn: overCapacity },
          { label: '已完成', value: `${stats.completed}`, unit: `已验证 ${stats.verified} · 放弃 ${stats.abandoned}`, color: '#4cc9f0' },
          { label: '累计花费', value: `¥${fmtInt(stats.totalSpend)}`, unit: '本地记录', color: '#e6e9f0' },
          { label: '成功率', value: stats.completed ? fmtPct(stats.successRate, 0) : '—', unit: '已验证 / 已完成', color: '#ffd166' },
          { label: '累计耗时', value: fmtInt(stats.totalHours), unit: '小时', color: '#8b93a7' },
        ].map((s) => (
          <Panel key={s.label} className="px-3 py-2">
            <div className="mono-label">{s.label}</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="num text-[20px] font-semibold leading-none" style={{ color: s.color }}>{s.value}</span>
            </div>
            <div className={cn('mt-0.5 text-[9.5px]', s.warn ? 'text-amber' : 'text-dim')}>{s.unit}</div>
          </Panel>
        ))}
      </div>

      {overCapacity && (
        <Panel className="mb-3 flex items-start gap-2 border-amber/40 bg-amber/[0.06] p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
          <div className="text-[11.5px] leading-relaxed text-amber">
            个人产能上限为 {ACTIVE_CAPACITY} 个进行中实验，当前有 {stats.active} 个。建议先给旧实验结案（已验证/已放弃）再开新实验，避免注意力摊薄。
          </div>
        </Panel>
      )}

      {showForm && (
        <Panel className="mb-3 border-signal/30 p-3">
          <div className="mono-label mb-2">NEW EXPERIMENT · 新建实验</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <label className="block md:col-span-2">
              <span className="mono-label">选择机会</span>
              <select className={inputCls} value={newOppId} onChange={(e) => {
                setNewOppId(e.target.value)
                const o = oppById.get(e.target.value)
                if (o) setNewBudget(o.roi.capital_cny.min || 3000)
              }}>
                {opportunities.map((o) => (
                  <option key={o.id} value={o.id}>{o.scores.grade} · {o.title}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mono-label">开始日期</span>
              <input type="date" className={inputCls} value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </label>
            <label className="block">
              <span className="mono-label">预算 CNY</span>
              <input type="number" min={0} className={inputCls} value={newBudget} onChange={(e) => setNewBudget(Number(e.target.value) || 0)} />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] text-dim">
              {newOpp ? `建议启动资金 ${fmtCnyRange(newOpp.roi.capital_cny.min, newOpp.roi.capital_cny.max)} · 7 天动作 ${newOpp.first_steps_7d.length} 项 · 复盘周期 ${REVIEW_CYCLE_DAYS} 天` : '请选择机会'}
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>取消</Button>
              <Button size="sm" variant="primary" onClick={handleAdd}><Plus className="h-3.5 w-3.5" /> 加入并开始</Button>
            </div>
          </div>
        </Panel>
      )}

      <div className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <SectionCard
          className="xl:col-span-8"
          eyebrow="EXPERIMENTS"
          title="实验列表"
          subtitle="点击更新记录状态、花费、耗时与结论；删除不可恢复"
          right={<Segmented size="xs" options={FILTERS} value={filter} onChange={setFilter} />}
          bodyClassName="p-3"
        >
          {!filtered.length ? (
            <EmptyState
              icon={<FlaskConical className="h-5 w-5" />}
              title={items.length ? '该筛选下暂无实验' : '还没有实验记录'}
              hint={items.length ? '切换筛选查看其它状态。' : '从机会详情页点「开始 7 天实验」，或点右上角「新建实验」选择机会。'}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => (
                <ExperimentCard
                  key={item.id}
                  item={item}
                  editing={editingId === item.id}
                  onEdit={() => setEditingId(item.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onUpdate={(patch) => {
                    update(item.id, patch)
                    setEditingId(null)
                  }}
                  onRemove={() => remove(item.id)}
                />
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2 text-[10px] text-dim">
            <span><FlaskConical className="mr-1 inline h-3 w-3" /> 共 {items.length} 条 · 显示 {filtered.length} 条 · 数据仅存本机浏览器</span>
            <Link to="/rankings" className="text-muted hover:text-signal">去排行榜挑机会 →</Link>
          </div>
        </SectionCard>

        <div className="space-y-3 xl:col-span-4">
          <SectionCard eyebrow="REVIEW RHYTHM" title={`每 ${REVIEW_CYCLE_DAYS} 天复盘`} right={<CalendarClock className="h-4 w-4 text-dim" />}>
            <div className="space-y-2 text-[11px] leading-relaxed text-muted">
              <p>每 {REVIEW_CYCLE_DAYS} 天一个周期：检查进行中实验，更新「花费 / 耗时 / 结论」，决定继续、加注还是止损。</p>
              <p>连续 2 个周期没有任何新证据 → 按证伪条件停止，把精力放回扫描。</p>
              <div className="rounded border border-line/70 bg-black/15 px-2 py-1.5 font-mono text-[10px] text-dim">
                个人产能上限 {ACTIVE_CAPACITY} · 当前 {stats.active}/{ACTIVE_CAPACITY}
                {historyMeta.available ? ` · 历史快照 ${historyMeta.count} 份` : ' · 暂无历史快照'}
              </div>
            </div>
            <div className="mt-2 border-t border-line/60 pt-2">
              <div className="mono-label mb-1">ACTIVE / 待复盘</div>
              {activeItems.length ? (
                <div className="space-y-1.5">
                  {activeItems.map((item) => {
                    const review = experimentReviewInfo(item)
                    return (
                      <Link key={item.id} to={`/opportunities/${item.opp_id}`} className="block rounded border border-line/70 px-2 py-1.5 hover:border-amber/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-ink">{item.title}</span>
                          <span className={cn('shrink-0 font-mono text-[9.5px]', review.overdue ? 'text-danger' : review.daysLeft <= 1 ? 'text-amber' : 'text-dim')}>
                            {review.overdue ? `逾期 ${Math.abs(review.daysLeft)} 天` : review.daysLeft === 0 ? '今天复盘' : `${review.daysLeft} 天后`}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono text-[9px] text-dim">第 {experimentDay(item)} 天 · 周期 {review.cycle} · 花费 ¥{fmtInt(item.spend_cny)} / 预算 ¥{fmtInt(item.budget_cny)}</div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="text-[10.5px] text-dim">暂无进行中实验。加入一个后开始 7 天周期。</div>
              )}
            </div>
          </SectionCard>

          <SectionCard eyebrow="EXPORT & STORAGE" title="导出与本地存储">
            <div className="space-y-1.5 text-[10.5px] leading-relaxed text-muted">
              <div className="flex items-center justify-between rounded border border-line/70 px-2 py-1.5">
                <span>实验记录 Markdown</span>
                <Button size="xs" variant="outline" onClick={() => downloadExperiments(items, 'md')} disabled={!items.length}><Download className="h-3 w-3" /> 下载</Button>
              </div>
              <div className="flex items-center justify-between rounded border border-line/70 px-2 py-1.5">
                <span>实验记录 JSON 备份</span>
                <Button size="xs" variant="outline" onClick={() => downloadExperiments(items, 'json')} disabled={!items.length}><FileJson className="h-3 w-3" /> 下载</Button>
              </div>
              <p className="pt-1 text-[10px] text-dim">
                数据仅保存在当前浏览器 localStorage；换浏览器 / 清缓存会丢失，建议每周期导出一次 JSON 备份。
              </p>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-dim">
        <Wallet className="h-3 w-3" /> 花费按实际支出记录，预算仅作计划参考。
        <Timer className="ml-2 h-3 w-3" /> 耗时按专注小时估算。
        <span className="ml-auto font-mono">data_as_of {dataAsOf} · {rankingsDeltaBasis === 'history' ? '较上一快照' : '相邻窗口口径'}</span>
      </div>
    </div>
  )
}
