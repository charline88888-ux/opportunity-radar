import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  Clock3,
  Database,
  EyeOff,
  FlaskConical,
  RotateCcw,
  ShieldAlert,
  Target,
  UserRound,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, EmptyState, Panel, SectionCard, Segmented } from '@/components/ui'
import {
  ALERT_DATA_VERSION,
  ALERT_RULES,
  ALERT_SEVERITY,
  ALERT_TYPE_META,
  useAlerts,
  type AlertItem,
  type AlertType,
} from '@/lib/alerts'
import { useProfile } from '@/lib/profile'
import { useAlertNotifications } from '@/lib/notifications'
import { cn, fmtInt } from '@/lib/utils'

type Filter = 'unread' | 'all' | 'ignored'

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'unread', label: '未读' },
  { value: 'all', label: '全部' },
  { value: 'ignored', label: '已忽略' },
]

const TYPE_ICONS: Record<AlertType, React.ComponentType<{ className?: string }>> = {
  window: Clock3,
  experiment: FlaskConical,
  source: Database,
  unverified: ShieldAlert,
  'high-match': Target,
  'data-stale': Clock3,
}

function AlertCard({ alert, ignored, read, onRead, onIgnore, onUnignore }: {
  alert: AlertItem
  ignored: boolean
  read: boolean
  onRead: () => void
  onIgnore: () => void
  onUnignore: () => void
}) {
  const sev = ALERT_SEVERITY[alert.severity]
  const typeMeta = ALERT_TYPE_META[alert.type]
  const Icon = TYPE_ICONS[alert.type] || Bell
  return (
    <Panel className={cn('p-3', alert.severity === 'critical' && 'border-danger/30', alert.severity === 'warning' && 'border-amber/25', (ignored || read) && 'opacity-65')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border" style={{ borderColor: `${sev.color}44`, background: `${sev.color}10`, color: sev.color }}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9.5px]" style={{ color: sev.color, borderColor: `${sev.color}55`, background: `${sev.color}10` }}>
                {sev.label}
              </span>
              <span className="rounded border border-line/70 px-1.5 py-0.5 font-mono text-[9.5px]" style={{ color: typeMeta.color }}>{typeMeta.label}</span>
              <span className="text-[12px] font-medium text-ink">{alert.title}</span>
              {ignored && <Badge tone="muted">已忽略</Badge>}
              {!ignored && read && <Badge tone="muted">已读</Badge>}
            </div>
            <div className="mt-1 text-[10.5px] leading-relaxed text-muted">{alert.detail}</div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {!ignored && <Link to={alert.actionHref} className="inline-flex h-6 items-center rounded border border-line bg-panel-2 px-2 text-[10.5px] text-muted hover:border-line-strong hover:text-ink">{alert.actionLabel}</Link>}
          {ignored ? (
            <Button size="xs" variant="outline" onClick={onUnignore}><RotateCcw className="h-3 w-3" /> 恢复</Button>
          ) : (
            <>
              <Button size="xs" variant="ghost" onClick={onRead} title="标为已读"><Check className="h-3 w-3" /> 已读</Button>
              <Button size="xs" variant="ghost" onClick={onIgnore} title="忽略该提醒"><EyeOff className="h-3 w-3" /> 忽略</Button>
            </>
          )}
        </div>
      </div>
    </Panel>
  )
}

export default function Alerts() {
  const center = useAlerts()
  const { profile } = useProfile()
  const notifications = useAlertNotifications(center.active)
  const [filter, setFilter] = useState<Filter>('unread')

  const visible = useMemo(() => {
    if (filter === 'ignored') return center.alerts.filter((a) => center.state.ignored.includes(a.id))
    const active = center.alerts.filter((a) => !center.state.ignored.includes(a.id))
    if (filter === 'unread') return active.filter((a) => !center.state.read.includes(a.id))
    return active
  }, [center.alerts, center.state, filter])

  const criticalCount = center.active.filter((a) => a.severity === 'critical').length
  const warningCount = center.active.filter((a) => a.severity === 'warning').length
  const infoCount = center.active.filter((a) => a.severity === 'info').length
  const currentIds = new Set(center.alerts.map((a) => a.id))
  const staleRead = center.state.read.filter((id) => !currentIds.has(id)).length
  const staleIgnored = center.state.ignored.filter((id) => !currentIds.has(id)).length
  const staleCount = staleRead + staleIgnored

  return (
    <div>
      <PageHeader
        index="09"
        kicker="ALERTS · 预警中心"
        title="预警中心 · 该行动的信号"
        description="本地规则引擎：窗口关闭、实验超期、采集源失败、A 级以上证据未核验、画像高匹配但未行动。已读 / 忽略只保存在本机 localStorage，不上传、不联网。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={center.unreadCount ? 'amber' : 'signal'}><Bell className="h-3 w-3" /> 未读 {center.unreadCount} 条</Badge>
            <Badge tone="muted" title="告警 id 含数据版本指纹；升版后旧已读/忽略自动失效，重新提醒">数据 v{ALERT_DATA_VERSION}</Badge>
            <Button size="sm" variant="outline" onClick={() => void notifications.toggle()} title="仅当本页打开时，对新的严重预警发送桌面通知">
              <Bell className="h-3.5 w-3.5" /> 桌面通知 {notifications.enabled ? '开' : '关'}
            </Button>
            <Button size="sm" variant="outline" onClick={center.markAllRead} disabled={!center.unreadCount}>
              <CheckCheck className="h-3.5 w-3.5" /> 全部已读
            </Button>
            {center.ignoredCount > 0 && (
              <Button size="sm" variant="ghost" onClick={center.clearIgnored}>清空忽略（{center.ignoredCount}）</Button>
            )}
            <Link to="/profile" className="inline-flex h-7 items-center gap-1 rounded border border-line bg-panel-2 px-2.5 text-[11.5px] text-muted hover:border-line-strong hover:text-ink">
              <UserRound className="h-3 w-3" /> 调整画像
            </Link>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          { label: '未读预警', value: center.unreadCount, unit: `全部有效 ${center.activeCount} 条`, color: center.unreadCount ? '#ffb547' : '#3ddc97' },
          { label: '严重', value: criticalCount, unit: '窗口关闭 / 长期未结案', color: '#ff5d5d' },
          { label: '注意', value: warningCount, unit: '源失败 / 未核验 / 超期', color: '#ffb547' },
          { label: '提示', value: infoCount, unit: '高匹配未行动', color: '#4cc9f0' },
        ].map((s) => (
          <Panel key={s.label} className="px-3 py-2">
            <div className="mono-label">{s.label}</div>
            <div className="num mt-0.5 text-[20px] font-semibold leading-none" style={{ color: s.color }}>{s.value}</div>
            <div className="mt-0.5 text-[9.5px] text-dim">{s.unit}</div>
          </Panel>
        ))}
      </div>

      {!notifications.supported && (
        <Panel className="mb-3 rounded border border-line/70 bg-white/[0.015] px-3 py-2 text-[10.5px] text-dim">
          当前浏览器不支持桌面通知，页面内预警不受影响。{notifications.error || ''}
        </Panel>
      )}
      {notifications.error && notifications.supported && (
        <Panel className="mb-3 rounded border border-amber/30 bg-amber/[0.05] px-3 py-2 text-[10.5px] text-amber">{notifications.error}</Panel>
      )}
      {notifications.enabled && (
        <Panel className="mb-3 rounded border border-signal/25 bg-signal/[0.04] px-3 py-2 text-[10.5px] text-muted">
          桌面通知已开启：仅当本页打开时，新出现的「严重」预警会发送系统通知；权限或浏览器不支持时自动降级为页面内提醒。
        </Panel>
      )}

      {staleCount > 0 && (
        <Panel className="mb-3 flex flex-wrap items-center gap-2 border-amber/30 bg-amber/[0.05] px-3 py-2">
          <Bell className="h-4 w-4 text-amber" />
          <span className="text-[11px] text-amber">
            数据已更新（v{ALERT_DATA_VERSION}）：旧版本已读 {staleRead} 条 / 忽略 {staleIgnored} 条不再匹配当前告警 id，相关提醒已重新激活。
          </span>
          <span className="ml-auto font-mono text-[9.5px] text-dim">旧记录保留在 radar:alerts:v1，不自动删除</span>
        </Panel>
      )}

      {!profile && (
        <Panel className="mb-3 flex flex-wrap items-center gap-2 border-cyan/25 bg-cyan/[0.04] px-3 py-2">
          <Target className="h-4 w-4 text-cyan" />
          <span className="text-[11px] text-muted">设置个人画像后，将解锁「高匹配未行动」预警，并按 fit 给机会排序。</span>
          <Link to="/profile" className="ml-auto inline-flex h-6 items-center gap-1 rounded border border-cyan/40 bg-cyan/10 px-2 text-[10.5px] text-cyan">
            去设置画像 <ArrowUpRight className="h-3 w-3" />
          </Link>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="space-y-2.5 xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented options={FILTERS} value={filter} onChange={setFilter} />
            <span className="font-mono text-[10px] text-dim">
              当前显示 {visible.length} 条 · 规则 {dayjs().format('YYYY-MM-DD HH:mm')} 计算
            </span>
          </div>
          {!visible.length ? (
            <EmptyState
              icon={<Bell className="h-5 w-5" />}
              title={filter === 'ignored' ? '暂无被忽略的预警' : filter === 'unread' ? '没有未读预警' : '当前没有触发中的预警'}
              hint={filter === 'unread' ? '可以做一次主动扫描，或到实验台/数据源检查状态。' : '规则阈值见右侧说明；已读/忽略均保存在本机。'}
            />
          ) : (
            visible.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                ignored={center.state.ignored.includes(alert.id)}
                read={center.state.read.includes(alert.id)}
                onRead={() => center.markRead(alert.id)}
                onIgnore={() => center.ignore(alert.id)}
                onUnignore={() => center.unignore(alert.id)}
              />
            ))
          )}
        </div>

        <div className="space-y-3 xl:col-span-4">
          <SectionCard eyebrow="RULES" title="预警规则与阈值" right={<Bell className="h-4 w-4 text-dim" />}>
            <div className="space-y-2 text-[10.5px] leading-relaxed text-muted">
              <div className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                <span><b className="text-ink">窗口关闭</b>：机会 <span className="font-mono text-dim">window.months_left ≤ {ALERT_RULES.WINDOW_CLOSING_MONTHS}</span>；≤1 个月或关闭标「严重」。</span>
              </div>
              <div className="flex items-start gap-2">
                <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
                <span><b className="text-ink">实验超期</b>：开始超过 <span className="font-mono text-dim">{ALERT_RULES.EXPERIMENT_OVERDUE_DAYS} 天</span>仍未结案；超过 <span className="font-mono text-dim">{ALERT_RULES.EXPERIMENT_CRITICAL_DAYS} 天</span>标「严重」。</span>
              </div>
              <div className="flex items-start gap-2">
                <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                <span><b className="text-ink">采集源失败</b>：source-health 中 <span className="font-mono text-dim">ok=false</span>；展示 mode / latency / error 原因。</span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
                <span><b className="text-ink">未核验证据</b>：<span className="font-mono text-dim">verified=false</span> 且等级 ∈ {ALERT_RULES.UNVERIFIED_GRADES.join(' / ')}。</span>
              </div>
              <div className="flex items-start gap-2">
                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" />
                <span><b className="text-ink">高匹配未行动</b>：画像 <span className="font-mono text-dim">fit ≥ {ALERT_RULES.HIGH_MATCH_FIT}</span>、无硬约束且尚未加入实验；最多 {ALERT_RULES.HIGH_MATCH_LIMIT} 条。</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                <span><b className="text-ink">数据过期</b>：<span className="font-mono text-dim">rankings.meta.as_of</span> 距今 &gt;7 天为高、3–7 天为中；数据更新后自动恢复。</span>
              </div>
            </div>
            <div className="mt-2 rounded border border-line/60 bg-black/15 px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
              预警是「注意力管理」而非交易信号：只用于提醒你检查，不构成投资建议或收益承诺。
            </div>
          </SectionCard>

          <SectionCard eyebrow="SECTIONS" title="相关页面">
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { to: '/lab', label: '实验台', desc: '处理超期实验', icon: FlaskConical },
                { to: '/sources', label: '数据源矩阵', desc: '处理采集失败', icon: Database },
                { to: '/profile', label: '个人画像', desc: '调整推荐边界', icon: UserRound },
                { to: '/rankings?mode=recommend', label: '为你推荐', desc: '高匹配机会', icon: Target },
              ].map((x) => (
                <Link key={x.to} to={x.to} className="rounded border border-line/70 px-2 py-1.5 transition-colors hover:border-line-strong">
                  <div className="flex items-center gap-1.5 text-[11px] text-ink"><x.icon className="h-3 w-3 text-muted" /> {x.label}</div>
                  <div className="mt-0.5 text-[9.5px] text-dim">{x.desc}</div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <div className="flex items-center justify-between rounded border border-line/70 bg-panel/50 px-3 py-2 font-mono text-[9.5px] text-dim">
            <span>本地计算 · 无联网</span>
            <span>已读 {center.state.read.length} · 忽略 {center.ignoredCount}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
