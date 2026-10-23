import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  HardDrive,
  Play,
  RefreshCw,
  Rocket,
  Server,
  ShieldAlert,
  Square,
  TerminalSquare,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Panel, SectionCard } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import {
  clearControlToken,
  controlAgeDays,
  fetchJob,
  fetchLog,
  fetchLogs,
  fetchOutbox,
  fetchStatus,
  formatControlTime,
  getStoredControlToken,
  isLocalConsoleOrigin,
  readControlToken,
  runTask,
  setSchedule,
  type ControlJob,
  type ControlSignal,
  type ControlStatus,
} from '@/lib/control'
import { allSources, sourceHealth } from '@/lib/data'
import { cn } from '@/lib/utils'

type L = (zh: string, en: string) => string
type Task = 'update' | 'fetch' | 'build'

const isJobRunning = (job?: ControlJob | null) => job?.state === 'running'

export default function Control() {
  const { lang } = useI18n()
  const L: L = (zh, en) => (lang === 'en' ? en : zh)
  const [token, setToken] = useState(() => readControlToken())
  const [status, setStatus] = useState<ControlStatus | null>(null)
  const [logs, setLogs] = useState<Array<{ name: string; size?: number; mtime?: string }>>([])
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null)
  const [job, setJob] = useState<ControlJob | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [offline, setOffline] = useState(() => typeof window !== 'undefined' && !isLocalConsoleOrigin())
  const [loading, setLoading] = useState(false)
  const [withFetch, setWithFetch] = useState(false)
  const [starting, setStarting] = useState<Task | 'schedule' | null>(null)
  const [outboxSignals, setOutboxSignals] = useState<ControlSignal[]>([])
  const [inboxTab, setInboxTab] = useState<'relevant' | 'new' | 'all'>('relevant')
  const logRef = useRef<HTMLPreElement>(null)

  const loadStatus = async (quiet = false) => {
    if (!token) {
      setOffline(true)
      return
    }
    if (!quiet) setLoading(true)
    try {
      const s = await fetchStatus()
      setStatus(s)
      setOffline(false)
      setError('')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      if (!quiet) setStatus(null)
      setOffline(true)
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  const loadLogs = async () => {
    try {
      const r = await fetchLogs()
      setLogs(r.logs || [])
    } catch {
      /* keep page usable */
    }
  }

  const loadOutbox = async () => {
    try {
      const r = await fetchOutbox(100)
      if (r.outbox) setStatus((prev) => (prev ? { ...prev, outbox: r.outbox } : prev))
      if (r.signals) setOutboxSignals(r.signals)
    } catch {
      /* old backend or no outbox endpoint; keep status.outbox/top */
    }
  }

  useEffect(() => {
    if (!token) return
    void loadStatus(false)
    void loadLogs()
    void loadOutbox()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadStatus(true)
    }, 3000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadStatus(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!job || job.state !== 'running') return
    const id = window.setInterval(async () => {
      try {
        const r = await fetchJob(job.id)
        setJob(r.job)
        if (r.job.state !== 'running') {
          void loadStatus(true)
          void loadLogs()
          void loadOutbox()
          setNotice(r.job.state === 'ok' ? L('任务完成', 'Task completed') : L('任务失败，请查看日志', 'Task failed; check the log'))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    }, 1200)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.state])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [job?.log_tail])

  useEffect(() => {
    if (job) return
    const running = status?.jobs?.find((j) => isJobRunning(j))
    if (running) setJob(running)
  }, [status, job])

  const activeJob = job || status?.jobs?.find((j) => isJobRunning(j)) || null
  const busy = isJobRunning(activeJob) || !!starting
  const asOfAge = controlAgeDays(status?.data?.as_of)
  const schedule = status?.schedule
  const outbox = status?.outbox || null
  const outboxSources = useMemo(() => {
    const raw = outbox?.by_source
    if (!raw) return [] as Array<{ name: string; count: number }>
    if (Array.isArray(raw)) {
      return raw
        .map((x) => ({ name: x.name || x.source_id || x.source || 'unknown', count: Number(x.count) || 0 }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)
    }
    return Object.entries(raw).map(([name, count]) => ({ name, count: Number(count) || 0 })).sort((a, b) => b.count - a.count)
  }, [outbox])

  const autoSourceCount = useMemo(
    () => sourceHealth.ok_count || allSources.filter((s) => s.enabled === true && ['rss', 'json', 'api'].includes(s.access)).length,
    [],
  )
  const manualSourceCount = allSources.length - autoSourceCount
  const sourceRegionCount = new Set(allSources.flatMap((s) => s.regions)).size
  const failedHealthSources = sourceHealth.sources.filter((s) => !s.ok).slice(0, 6)
  const funnel = outbox?.funnel
  const sourceHealthRows: Array<{ id?: string; name?: string; items?: number; ok?: boolean; error?: string }> = outbox?.source_health?.sources?.length
    ? outbox.source_health.sources
    : outboxSources.map((s) => ({ name: s.name, items: s.count, ok: true }))
  const attempted = outbox?.funnel?.attempted ?? outbox?.source_health?.attempted ?? outbox?.source_count ?? 0
  const okSources = outbox?.funnel?.ok ?? outbox?.source_health?.ok ?? outbox?.source_count ?? 0
  const failedSources = outbox?.funnel?.failed ?? outbox?.source_health?.failed ?? Math.max(0, attempted - okSources)
  const inboxBase: ControlSignal[] = outboxSignals.length
    ? outboxSignals
    : (outbox?.top || []).map((x, i): ControlSignal => ({ signal_id: `top-${i}`, title: x.title, url: x.url, source_id: x.source_id, is_new: true, relevance_score: x.relevance_score }))
  const isRelevantSignal = (s: ControlSignal) => (s.relevance_score ?? -1) >= 50 || s.tier === 'business' || s.tier === 'maybe'
  const inboxRows = inboxBase
    .filter((s) => {
      if (inboxTab === 'new') return s.is_new !== false
      if (inboxTab === 'relevant') return isRelevantSignal(s)
      return true
    })
    .sort((a, b) => Number(b.is_new !== false) - Number(a.is_new !== false) || (b.relevance_score ?? 0) - (a.relevance_score ?? 0))

  const startTask = async (task: Task) => {
    setStarting(task)
    setError('')
    setNotice('')
    setPreview(null)
    try {
      const r = await runTask(task)
      const j = await fetchJob(r.job_id).catch(() => null)
      setJob(j?.job || {
        id: r.job_id,
        task,
        state: 'running',
        log_tail: [L('任务已提交，等待日志…', 'Job submitted, waiting for log…')],
      })
      setNotice(L('任务已提交，运行日志将自动刷新。', 'Job submitted; live log will refresh automatically.'))
      void loadStatus(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(null)
    }
  }

  const toggleSchedule = async (action: 'enable' | 'disable') => {
    setStarting('schedule')
    setError('')
    setNotice('')
    try {
      const r = await setSchedule(action, withFetch)
      setNotice(r.message || (action === 'enable' ? L('已提交启用每日任务', 'Daily task enable requested') : L('已提交停用每日任务', 'Daily task disable requested')))
      await loadStatus(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(null)
    }
  }

  const loadPreview = async (name: string) => {
    try {
      const r = await fetchLog(name)
      setPreview({ name, content: r.text || r.content || '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const serviceBadge = useMemo(() => {
    if (offline) return <Badge tone="danger"><XCircle className="h-3 w-3" /> {L('本地服务未连接', 'Local service offline')}</Badge>
    if (loading && !status) return <Badge tone="amber"><RefreshCw className="h-3 w-3 animate-spin" /> {L('连接中', 'Connecting')}</Badge>
    return <Badge tone="signal"><CheckCircle2 className="h-3 w-3" /> {L('本地服务已连接', 'Local service connected')}</Badge>
  }, [offline, loading, status, lang])

  return (
    <div>
      <PageHeader
        index="02"
        kicker={L('CONTROL · 控制台', 'CONTROL')}
        title={L('本地控制台 · 一键更新与采集', 'Local control · update & fetch')}
        description={L('在网页上触发本地数据更新、采集、构建工作副本与每日自动任务，并查看实时日志。控制台只在本机 serve.py 启动时可用；线上静态页不会执行任何本地命令。', 'Trigger local updates, fetching, working-copy builds and the daily task from the browser, with live logs. The console is available only when local serve.py is running; static online pages never execute local commands.')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {serviceBadge}
            <Button size="sm" variant="outline" onClick={() => { void loadStatus(false); void loadLogs(); void loadOutbox() }} disabled={!token || busy}>
              <RefreshCw className="h-3.5 w-3.5" /> {L('刷新状态', 'Refresh')}
            </Button>
          </div>
        }
      />

      {offline && (
        <Panel className="mb-3 border-amber/35 bg-amber/[0.05] p-3">
          <div className="flex items-start gap-2">
            <Server className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-amber">{L('本地控制台未启动', 'Local console is not running')}</div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                {L('要一键更新/采集，请在本机仓库根目录双击 启动机会雷达.bat，或运行：', 'To update/fetch from the browser, double-click Start Opportunity Radar.bat in the repository root, or run:')}
              </p>
              <pre className="mt-2 overflow-x-auto rounded border border-line/60 bg-black/30 p-2 font-mono text-[10px] text-signal">python scanner/serve.py --open</pre>
              <p className="mt-2 text-[10px] leading-relaxed text-dim">
                {L('线上静态页（GitHub Pages / file://）无法执行本地更新——这是架构限制，不是 bug。serve.py 仅绑定 127.0.0.1，用启动脚本会打开带 token 的本机控制台。', 'A static online page (GitHub Pages / file://) cannot execute local updates—this is an architectural limit, not a bug. serve.py binds 127.0.0.1 only; the launcher opens the local console with a token.')}
              </p>
              {token ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="font-mono text-dim">token: {'•'.repeat(12)}</span>
                  <Button size="sm" variant="outline" onClick={() => void loadStatus(false)}>{L('重试连接', 'Retry connection')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { clearControlToken(); setToken(''); setStatus(null) }}>{L('清除 token', 'Clear token')}</Button>
                </div>
              ) : (
                <div className="mt-2 rounded border border-amber/25 bg-amber/[0.04] px-2 py-1.5 text-[10px] leading-relaxed text-amber">
                  {L('当前 URL 没有 token。请用 启动机会雷达.bat / serve.py --open 打开；手动地址形如 #/control?token=<token>（token 见仓库根 .radar-console-token）。', 'No token in the current URL. Open via the launcher / serve.py --open; manual URL form: #/control?token=<token> (token file: .radar-console-token).')}
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

      {error && (
        <Panel className="mb-3 border-danger/35 bg-danger/[0.05] px-3 py-2 text-[10.5px] text-danger">
          <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="min-w-0 flex-1">{error}</span></div>
        </Panel>
      )}
      {notice && <Panel className="mb-3 border-signal/30 bg-signal/[0.05] px-3 py-2 text-[10.5px] text-signal">{notice}</Panel>}

      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: L('服务', 'Server'), value: status?.server?.port ? `:${status.server.port}` : '—', hint: status?.server?.version || '—' },
          { label: L('数据基准日', 'Data as-of'), value: status?.data?.as_of || '—', hint: asOfAge == null ? '—' : L(`距今 ${asOfAge} 天`, `${asOfAge} days ago`) },
          { label: L('机会数', 'Opportunities'), value: status?.data?.opportunities ?? '—', hint: status?.data?.data_version ? `v${status.data.data_version}` : '—' },
          { label: L('工作副本', 'Working copy'), value: status?.data?.current_build?.mtime ? formatControlTime(status.data.current_build.mtime) : '—', hint: status?.data?.current_build?.size ? `${Math.round((status.data.current_build.size || 0) / 1024)} KB` : '—' },
          { label: L('冻结版本', 'Frozen'), value: status?.data?.frozen_latest?.version || '—', hint: status?.data?.frozen_latest?.size ? `${Math.round((status.data.frozen_latest.size || 0) / 1024)} KB` : '—' },
          { label: L('每日任务', 'Daily task'), value: schedule?.enabled ? L('已启用', 'Enabled') : L('未启用', 'Disabled'), hint: schedule?.status || (schedule?.next_run ? `${L('下次', 'next')} ${formatControlTime(schedule.next_run)}` : '—') },
        ].map((x) => (
          <Panel key={x.label} className="px-3 py-2">
            <div className="mono-label">{x.label}</div>
            <div className="num mt-0.5 truncate text-[15px] font-semibold text-ink" title={String(x.value)}>{x.value}</div>
            <div className="mt-0.5 truncate text-[9px] text-dim" title={x.hint}>{x.hint}</div>
          </Panel>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <SectionCard className="xl:col-span-7" eyebrow="ACTIONS" title={L('一键操作', 'One-click actions')} subtitle={L('任务在本地后台执行；运行中禁止重复触发，日志自动刷新。', 'Jobs run in the local background; duplicate triggers are blocked while running, logs refresh automatically.')} right={<Rocket className="h-4 w-4 text-dim" />}>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => void startTask('update')} disabled={busy || offline}>
              {starting === 'update' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {L('立即更新数据', 'Update data now')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void startTask('fetch')} disabled={busy || offline}>
              <ClipboardList className="h-3.5 w-3.5" /> {L('立即采集', 'Fetch now')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void startTask('build')} disabled={busy || offline}>
              <HardDrive className="h-3.5 w-3.5" /> {L('构建工作副本', 'Build working copy')}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
            <Button size="sm" variant="outline" onClick={() => void toggleSchedule('enable')} disabled={busy || offline || schedule?.enabled}>
              <CalendarClock className="h-3.5 w-3.5" /> {L('启用每日自动', 'Enable daily task')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void toggleSchedule('disable')} disabled={busy || offline || !schedule?.enabled}>
              <Square className="h-3.5 w-3.5" /> {L('停用每日自动', 'Disable daily task')}
            </Button>
            <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted">
              <input type="checkbox" checked={withFetch} onChange={(e) => setWithFetch(e.target.checked)} className="accent-signal" />
              {L('启用时同时采集（可选）', 'Also fetch when enabling (optional)')}
            </label>
          </div>
          <div className="mt-2 rounded border border-line/60 bg-black/15 px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
            {L('「立即更新数据」运行 scripts/daily-run.ps1（pipeline → validate → build → current）；「立即采集」运行 pipeline.py --fetch，结果进 outbox 等待人工复核；「构建工作副本」更新 app/dist 并复制 current/index.html。', '“Update data” runs scripts/daily-run.ps1 (pipeline → validate → build → current); “Fetch now” runs pipeline.py --fetch and writes candidates to outbox for review; “Build working copy” rebuilds app/dist and copies current/index.html.')}
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-5" eyebrow="JOB LOG" title={L('实时任务日志', 'Live job log')} subtitle={L('最近 200 行；运行状态与退出码来自本地服务。', 'Latest 200 lines; state/exit code come from the local service.')} right={<TerminalSquare className="h-4 w-4 text-dim" />}>
          {activeJob ? (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
                <Badge tone={activeJob.state === 'ok' ? 'signal' : activeJob.state === 'failed' ? 'danger' : 'amber'}>
                  {activeJob.state === 'running' ? L('运行中', 'Running') : activeJob.state === 'ok' ? L('成功', 'OK') : L('失败', 'Failed')}
                </Badge>
                <span className="font-mono text-dim">{activeJob.task}</span>
                <span className="text-dim">{formatControlTime(activeJob.started_at)}</span>
                {activeJob.exit_code != null && <span className="font-mono text-dim">exit {activeJob.exit_code}</span>}
                {activeJob.finished_at && <span className="text-dim">· {formatControlTime(activeJob.finished_at)}</span>}
              </div>
              <pre ref={logRef} className="max-h-[260px] overflow-auto rounded border border-line/60 bg-black/35 p-2 font-mono text-[9.5px] leading-relaxed text-muted">
                {(activeJob.log_tail || []).join('\n') || L('等待日志…', 'Waiting for log…')}
              </pre>
            </>
          ) : (
            <div className="space-y-2 text-[10.5px] leading-relaxed text-dim">
              <div>{L('尚未触发任务。点击左侧按钮后，这里会显示实时 stdout/stderr 日志。', 'No job triggered yet. Click an action on the left to stream stdout/stderr here.')}</div>
              {status?.jobs?.length ? (
                <div>
                  <div className="mono-label mb-1">{L('最近任务', 'Recent jobs')}</div>
                  {status.jobs.slice(0, 3).map((j) => (
                    <div key={j.id} className="flex items-center gap-2 py-0.5 font-mono text-[9.5px]">
                      <span className={cn('h-1.5 w-1.5 rounded-full', j.state === 'ok' ? 'bg-signal' : j.state === 'failed' ? 'bg-danger' : 'bg-amber')} />
                      <span className="text-muted">{j.task}</span>
                      <span className="text-dim">{formatControlTime(j.started_at)}</span>
                      <span className="ml-auto text-dim">{j.state}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </SectionCard>

        <SectionCard className="xl:col-span-5" eyebrow="SCHEDULE / ALERT" title={L('每日任务与告警', 'Daily task & alert')} right={<ShieldAlert className="h-4 w-4 text-dim" />}>
          <div className="space-y-1.5 text-[10.5px]">
            <div className="flex justify-between border-b border-line/50 pb-1"><span className="text-dim">{L('任务名', 'Task name')}</span><span className="font-mono text-muted">{schedule?.task_name || '—'}</span></div>
            <div className="flex justify-between border-b border-line/50 pb-1"><span className="text-dim">{L('状态', 'Status')}</span><span className="text-muted">{schedule?.status || (schedule?.enabled ? 'enabled' : '—')}</span></div>
            <div className="flex justify-between border-b border-line/50 pb-1"><span className="text-dim">{L('下次运行', 'Next run')}</span><span className="font-mono text-muted">{formatControlTime(schedule?.next_run)}</span></div>
            <div className="flex justify-between border-b border-line/50 pb-1"><span className="text-dim">{L('最近运行', 'Last run')}</span><span className="font-mono text-muted">{formatControlTime(schedule?.last_run)}</span></div>
            <div className="flex justify-between"><span className="text-dim">{L('最近结果', 'Last result')}</span><span className="text-muted">{schedule?.last_result || '—'}</span></div>
          </div>
          <div className="mt-2 rounded border border-line/60 bg-black/15 px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
            <div className="mono-label mb-1">{L('告警 ALERT.txt', 'ALERT.txt')}</div>
            {status?.alert?.exists ? (
              <div className="text-amber">{status.alert.content || L('检测到告警文件（内容为空）', 'Alert file detected (empty)')}</div>
            ) : (
              <span>{L('无告警文件', 'No alert file')}</span>
            )}
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-12" eyebrow="SCAN BOUNDARY / FUNNEL" title={L('扫描边界与漏斗', 'Scan boundary & funnel')} subtitle={L('每源尝试/成功/失败、原始→去重→本轮新增→生意相关漏斗；未覆盖平台不会假装已采集。', 'Per-source attempts/success/failures and the raw → deduped → new → relevant funnel; unsupported platforms are never treated as fetched.')} right={<ShieldAlert className="h-4 w-4 text-dim" />}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
            {[
              { label: L('源尝试', 'Attempted'), value: attempted },
              { label: L('成功', 'OK'), value: okSources, color: '#3ddc97' },
              { label: L('失败', 'Failed'), value: failedSources, color: failedSources ? '#ff5d5d' : undefined },
              { label: L('原始信号', 'Raw'), value: funnel?.raw ?? outbox?.raw_count ?? 0 },
              { label: L('去重后', 'Deduped'), value: funnel?.deduped ?? outbox?.signal_count ?? 0 },
              { label: L('本轮新增', 'New'), value: funnel?.new ?? outbox?.new_count ?? 0, color: '#4cc9f0' },
              { label: L('生意相关', 'Relevant'), value: funnel?.relevant ?? outbox?.relevant_count ?? 0, color: '#3ddc97' },
              { label: L('已见（历史去重）', 'Seen (ledger)'), value: funnel?.seen ?? outbox?.seen_count ?? 0, color: '#ffb547' },
            ].map((x) => (
              <div key={x.label} className="rounded border border-line/70 px-2 py-1.5">
                <div className="mono-label">{x.label}</div>
                <div className="num text-[17px] font-semibold" style={{ color: x.color || '#cdd6e5' }}>{x.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded border border-line/60 bg-black/15 px-2 py-1.5 text-[10px] leading-relaxed text-muted">
            {L('漏斗：原始信号 → 批内/历史去重 → 本轮新信号 → 生意相关初筛；只有人工复核通过的候选才会进入机会库。', 'Funnel: raw signals → batch/history dedupe → new this round → business-relevance triage; only human-approved candidates enter the opportunity library.')}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="mono-label mb-1">{L('逐源结果', 'Per-source result')}</div>
              <div className="max-h-[150px] space-y-1 overflow-auto">
                {sourceHealthRows.length ? sourceHealthRows.map((s, i) => (
                  <div key={`${s.id || s.name || i}`} className="flex items-center gap-2 text-[10px]">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.ok === false ? 'bg-danger' : 'bg-signal')} />
                    <span className="min-w-0 flex-1 truncate text-muted">{s.name || s.id || 'source'}</span>
                    <span className="num text-dim">{s.items ?? 0}</span>
                    {s.error && <span className="max-w-[110px] truncate font-mono text-[8.5px] text-danger" title={s.error}>{s.error}</span>}
                  </div>
                )) : <div className="text-[10px] text-dim">{L('服务尚未返回逐源明细（旧版后端或暂无采集）', 'No per-source detail returned (old backend or no fetch yet)')}</div>}
              </div>
            </div>
            <div>
              <div className="mono-label mb-1">{L('覆盖边界 / 未覆盖平台', 'Coverage boundary / unsupported platforms')}</div>
              <div className="space-y-1 text-[10px] leading-relaxed text-muted">
                <div>{L(`目录共 ${allSources.length} 个平台：可自动采集 ${autoSourceCount} 个，需人工/API ${manualSourceCount} 个，覆盖 ${sourceRegionCount}/11 区域。`, `${allSources.length} platforms in the directory: ${autoSourceCount} auto-fetchable, ${manualSourceCount} manual/API, covering ${sourceRegionCount}/11 regions.`)}</div>
                <div>{L(`本轮采集覆盖 ${outbox?.source_count ?? 0} 个源；其余平台不在自动扫描范围内。`, `${outbox?.source_count ?? 0} sources covered this round; the rest are outside automatic scanning.`)}</div>
                {failedHealthSources.length > 0 && (
                  <div className="text-danger/80">{L('失败源', 'Failed sources')}: {failedHealthSources.map((s) => `${s.name || s.id}${s.error ? ` (${s.error})` : ''}`).join(' · ')}</div>
                )}
                <div className="text-dim">{L('抓取规则：仅公开 RSS/JSON/API，每源限流与缓存、仅标题摘要，不抓评论/付费墙/登录内容；失败源保留 error 不静默。', 'Rules: public RSS/JSON/API only, per-source rate limits/cache, title/summary only; no comments/paywalls/logins; failed sources keep their error.')}</div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-12" eyebrow="INBOX" title={L('采集收件箱', 'Fetch inbox')} subtitle={L('原始采集信号不会自动变成机会，需人工复核后才能入库。', 'Raw fetched signals never become opportunities automatically; human review is required before ingestion.')} right={<ClipboardList className="h-4 w-4 text-dim" />}>
          {outbox ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: L('最近文件', 'Latest file'), value: outbox.file || '—' },
                    { label: L('采集基准日', 'as_of'), value: outbox.as_of || '—' },
                    { label: L('原始信号', 'Raw signals'), value: outbox.raw_count ?? outbox.signal_count ?? '—' },
                    { label: L('信号数', 'Signals'), value: outbox.signal_count ?? '—' },
                    { label: L('来源数', 'Sources'), value: outbox.source_count ?? outboxSources.length },
                    { label: L('生成时间', 'Generated'), value: formatControlTime(outbox.generated_at) },
                  ].map((x) => (
                    <div key={x.label} className="rounded border border-line/70 px-2 py-1.5">
                      <div className="mono-label">{x.label}</div>
                      <div className="truncate font-mono text-[10.5px] text-muted">{String(x.value)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[9.5px] leading-relaxed text-dim">
                  {L('原始信号只写入 scanner/outbox 等待人工复核；仅 REVIEW.md 中确认过的候选才应进入 data/opportunities.json。', 'Raw signals only go to scanner/outbox for review; only candidates confirmed in REVIEW.md should enter data/opportunities.json.')}
                </div>
                <div className="mt-1 text-[9.5px] text-dim">
                  REVIEW.md：{outbox.review_md?.exists ? L(`存在 · ${formatControlTime(outbox.review_md.modified_at)}`, `present · ${formatControlTime(outbox.review_md.modified_at)}`) : L('未找到', 'not found')}
                </div>
              </div>
              <div className="md:col-span-3">
                <div className="mono-label mb-1">{L('按来源分布', 'By source')}</div>
                <div className="max-h-[160px] space-y-1 overflow-auto">
                  {outboxSources.length ? outboxSources.slice(0, 10).map((s) => (
                    <div key={s.name} className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="truncate text-muted">{s.name}</span>
                      <span className="num text-dim">{s.count}</span>
                    </div>
                  )) : <div className="text-[10px] text-dim">—</div>}
                </div>
              </div>
              <div className="md:col-span-4">
                <div className="mono-label mb-1">{L('Top 5 标题', 'Top 5 titles')}</div>
                <div className="space-y-1">
                  {(outbox.top || []).slice(0, 5).map((item, i) => (
                    <div key={`${item.title || 'item'}-${i}`} className="rounded border border-line/60 px-2 py-1 text-[10px]">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="block truncate text-muted hover:text-signal" title={item.title}>{item.title || item.url}</a>
                      ) : <span className="block truncate text-muted">{item.title || '—'}</span>}
                      {item.source_id && <span className="font-mono text-[8.5px] text-dim">{item.source_id}</span>}
                    </div>
                  ))}
                  {!(outbox.top || []).length && <div className="text-[10px] text-dim">{L('无标题预览', 'No title preview')}</div>}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded border border-dashed border-line/70 px-3 py-4 text-center text-[10.5px] text-dim">
              {L('还没有采集记录。点击「立即采集」后，原始信号会进入 scanner/outbox 并显示在这里；不会自动入库。', 'No fetch records yet. Click “Fetch now”; raw signals will land in scanner/outbox and appear here—never auto-ingested.')}
            </div>
          )}
        </SectionCard>

        <SectionCard className="xl:col-span-12" eyebrow="INBOX ITEMS" title={L('收件箱信号', 'Inbox signals')} subtitle={L('默认展示「相关+新增」；相关性初筛只是线索，仍需人工复核，不自动入库。', 'Defaults to relevant+new; relevance triage is only a hint and still requires human review, never auto-ingested.')} right={<ClipboardList className="h-4 w-4 text-dim" />}>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {([
              ['relevant', L('相关（含新增）', 'Relevant + new')],
              ['new', L('新增', 'New')],
              ['all', L('全部', 'All')],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setInboxTab(key)}
                className={cn('rounded border px-2 py-1 text-[10.5px]', inboxTab === key ? 'border-signal/50 bg-signal/10 text-signal' : 'border-line text-muted hover:border-line-strong')}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto font-mono text-[9px] text-dim">{inboxRows.length} / {inboxBase.length}</span>
          </div>
          {inboxRows.length ? (
            <div className="max-h-[320px] space-y-1 overflow-auto">
              {inboxRows.slice(0, 100).map((s, i) => (
                <div key={`${s.signal_id || s.url || i}`} className="rounded border border-line/60 px-2 py-1.5 text-[10px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {s.is_new !== false && <Badge tone="signal">{L('新增', 'NEW')}</Badge>}
                    {typeof s.relevance_score === 'number' && <Badge tone={(s.relevance_score >= 60 ? 'signal' : s.relevance_score >= 40 ? 'amber' : 'muted')}>rel {s.relevance_score}</Badge>}
                    {s.tier && <span className="font-mono text-[8.5px] text-dim">{s.tier}</span>}
                    {s.source_id && <span className="font-mono text-[8.5px] text-dim">{s.source_id}</span>}
                    {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-muted hover:text-signal">{s.title || s.url}</a> : <span className="min-w-0 flex-1 truncate text-muted">{s.title || '—'}</span>}
                  </div>
                  {(((s.industry_ids?.length ?? 0) + (s.industry_hints?.length ?? 0) + (s.gap_type_ids?.length ?? 0) + (s.gap_hints?.length ?? 0) + (s.region_ids?.length ?? 0) + (s.region_hints?.length ?? 0)) > 0) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {[...(s.industry_ids || s.industry_hints || []), ...(s.gap_type_ids || s.gap_hints || []), ...(s.region_ids || s.region_hints || [])].slice(0, 6).map((tag) => (
                        <span key={tag} className="rounded border border-line/50 px-1 py-0.5 text-[8.5px] text-dim">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded border border-dashed border-line/70 px-3 py-4 text-center text-[10.5px] leading-relaxed text-dim">
              {!outbox
                ? L('还没有采集记录。点击「立即采集」后，原始信号会进入 scanner/outbox 并显示在这里。', 'No fetch records yet. Click “Fetch now”; raw signals will appear here from scanner/outbox.')
                : inboxTab === 'new'
                  ? L('本轮没有新信号（全部已在历史去重账本中见过）。', 'No new signals this round (all were already seen by the history dedupe ledger).')
                  : inboxTab === 'relevant'
                    ? L('本轮没有相关性达标的新信号；相关性初筛只用于排序，不代表没有采集能力。', 'No new signals passed relevance triage; triage only ranks signals and does not mean fetching is broken.')
                    : L('采集文件存在，但没有可展示的信号条目。', 'A fetch file exists, but it contains no displayable signals.')}
            </div>
          )}
        </SectionCard>

        <SectionCard className="xl:col-span-7" eyebrow="LOGS" title={L('本地日志', 'Local logs')} subtitle={L('scanner/logs/ 下最近 10 个文件；预览最多 200KB。', 'Latest 10 files under scanner/logs/; preview capped at 200KB.')} right={<FileText className="h-4 w-4 text-dim" />}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="max-h-[240px] space-y-1 overflow-auto">
              {logs.length ? logs.map((l) => (
                <button
                  key={l.name}
                  type="button"
                  onClick={() => void loadPreview(l.name)}
                  className={cn('flex w-full items-center gap-2 rounded border px-2 py-1 text-left text-[10px]', preview?.name === l.name ? 'border-signal/40 bg-signal/[0.05] text-signal' : 'border-line/60 text-muted hover:border-line-strong')}
                >
                  <span className="min-w-0 flex-1 truncate font-mono">{l.name}</span>
                  <span className="text-[9px] text-dim">{l.size ? `${Math.round(l.size / 1024)}KB` : '—'}</span>
                </button>
              )) : <div className="text-[10px] text-dim">{L('暂无日志（服务启动后会生成）', 'No logs yet (generated after the service starts)')}</div>}
            </div>
            <pre className="max-h-[240px] min-h-[100px] overflow-auto rounded border border-line/60 bg-black/30 p-2 font-mono text-[9px] leading-relaxed text-dim">
              {preview ? preview.content : L('点击左侧日志文件名预览内容。', 'Click a log file to preview it.')}
            </pre>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
