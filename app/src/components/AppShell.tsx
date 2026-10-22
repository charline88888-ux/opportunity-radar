import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  Command,
  Database,
  FlaskConical,
  Info,
  LayoutDashboard,
  ListOrdered,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { appVersion, dataAsOf, dataMeta, isMockData, opportunities, stats } from '@/lib/data'
import { useExperiments } from '@/lib/experiments'
import { useAlerts } from '@/lib/alerts'
import { Badge, InfoTip } from './ui'

const NAV = [
  { to: '/', id: '01', label: '指挥台', en: 'COMMAND', icon: LayoutDashboard, desc: 'KPI · 今日榜 · 全景信号' },
  { to: '/rankings', id: '02', label: '排行榜', en: 'RANKINGS', icon: ListOrdered, desc: '综合榜 / 为你推荐' },
  { to: '/scanner', id: '03', label: '扫描室', en: 'SCANNER', icon: Radar, desc: '热力矩阵 · 剧本 · 数据源健康' },
  { to: '/method', id: '04', label: '方法论', en: 'METHOD', icon: BookOpenCheck, desc: '评分模型 · 七问 · 文化维度' },
  { to: '/sources', id: '05', label: '数据源矩阵', en: 'SOURCES', icon: Database, desc: '12 大类平台 · 合规等级' },
  { to: '/calendar', id: '06', label: '全球商业日历', en: 'CALENDAR', icon: CalendarDays, desc: '节庆 / 税季 / 开学节点' },
  { to: '/lab', id: '07', label: '实验台', en: 'LAB', icon: FlaskConical, desc: '7 天验证 · 记录与复盘' },
  { to: '/profile', id: '08', label: '个人画像', en: 'PROFILE', icon: UserRound, desc: '7 维能力 · 推荐基础' },
  { to: '/alerts', id: '09', label: '预警中心', en: 'ALERTS', icon: Bell, desc: '窗口 / 实验 / 源 / 匹配' },
  { to: '/calibration', id: '10', label: '回测校准', en: 'CALIBRATION', icon: Target, desc: '预测等级 vs 实验结果' },
  { to: '/about', id: '11', label: '关于', en: 'ABOUT', icon: Info, desc: '版本 · 文档 · 免责声明' },
]

function RadarMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3ddc97" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3ddc97" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18.5" fill="#0d1117" stroke="#232936" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="#1f2531" />
      <circle cx="20" cy="20" r="9" fill="none" stroke="#1f2531" />
      <line x1="20" y1="2" x2="20" y2="38" stroke="#1f2531" />
      <line x1="2" y1="20" x2="38" y2="20" stroke="#1f2531" />
      <g className="radar-sweep" style={{ transformOrigin: '20px 20px' }}>
        <path d="M20 20 L20 5 A15 15 0 0 1 32.5 10.5 Z" fill="url(#sweepGrad)" />
        <line x1="20" y1="20" x2="20" y2="5" stroke="#3ddc97" strokeWidth="1.2" />
      </g>
      <circle cx="26.5" cy="14" r="1.8" fill="#ffb547" />
      <circle cx="14" cy="25" r="1.4" fill="#4cc9f0" />
      <circle cx="23" cy="27" r="1.1" fill="#3ddc97" />
      <circle cx="20" cy="20" r="1.6" fill="#e6e9f0" />
    </svg>
  )
}

function DataStateBadge() {
  const mockCount = dataMeta.mock_files?.length || 0
  if (!isMockData) {
    return (
      <InfoTip
        content={
          <span>
            数据全部来自 <span className="mono">../data</span> 真实产出，已通过构建前契约自检。
            <br />
            data_version {dataMeta.data_version} · as_of {dataAsOf}
          </span>
        }
      >
        <span className="inline-flex cursor-help items-center gap-1.5 rounded border border-signal/30 bg-signal/8 px-1.5 py-0.5 font-mono text-[10px] text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          REAL DATA
        </span>
      </InfoTip>
    )
  }
  return (
    <InfoTip
      content={
        <span>
          当前为开发占位数据（{mockCount ? `${mockCount} 个文件` : '部分文件'}未就绪），仅用于页面预览；
          正式构建必须使用 ../data 真实数据并通过 strict 校验。
        </span>
      }
    >
      <span className="inline-flex cursor-help items-center gap-1.5 rounded border border-amber/30 bg-amber/8 px-1.5 py-0.5 font-mono text-[10px] text-amber">
        <span className="h-1.5 w-1.5 rounded-full bg-amber" />
        DEMO DATA
      </span>
    </InfoTip>
  )
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return opportunities
      .filter((o) =>
        [o.title, o.one_liner, o.origin_country, ...(o.target_countries || []), ...(o.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .sort((a, b) => b.rank_score - a.rank_score)
      .slice(0, 6)
  }, [query])

  const go = (id: string) => {
    navigate(`/opportunities/${id}`)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-[380px]">
      <div className="flex h-8 items-center gap-2 rounded-md border border-line bg-panel/80 px-2.5 transition-colors focus-within:border-signal/50">
        <Search className="h-3.5 w-3.5 shrink-0 text-dim" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) go(results[0].id)
          }}
          placeholder="搜索机会 / 国家 / 标签…"
          className="w-full bg-transparent text-[12px] outline-none placeholder:text-dim"
          aria-label="搜索机会"
        />
        <span className="kbd hidden sm:inline-flex">⌘K</span>
      </div>
      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-9 z-50 overflow-hidden rounded-md border border-line bg-panel-3 shadow-2xl">
          <div className="mono-label border-b border-line px-3 py-1.5">
            {results.length ? `${results.length} 条匹配 · ↵ 打开第一条` : '没有匹配的机会'}
          </div>
          {results.map((o) => (
            <button
              key={o.id}
              onClick={() => go(o.id)}
              className="flex w-full items-start gap-2 border-b border-line/50 px-3 py-2 text-left last:border-0 hover:bg-white/[0.04]"
            >
              <span className="mt-0.5 font-mono text-[10px] text-dim">{o.scores.grade}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-ink">{o.title}</span>
                <span className="block truncate text-[10.5px] text-dim">{o.origin_country} · {o.one_liner}</span>
              </span>
              <span className="num text-[10.5px] text-muted">{o.scores.total.toFixed(1)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Sidebar() {
  const location = useLocation()
  const { items: experiments } = useExperiments()
  const activeExperiments = experiments.filter((x) => x.status === 'active').length
  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to) || (to === '/rankings' && location.pathname.startsWith('/opportunities'))

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col border-r border-line bg-[#0c0f14] lg:flex">
      <Link to="/" className="block border-b border-line/80 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <RadarMark />
          <div className="min-w-0">
            <div className="font-mono text-[9px] tracking-[0.22em] text-signal">OPPORTUNITY RADAR</div>
            <div className="mt-0.5 text-[13px] font-semibold tracking-wide text-ink">机会雷达</div>
            <div className="text-[10px] text-dim">全球商机扫描器 · 本地个人版</div>
          </div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="mono-label mb-2 px-2">NAVIGATION / 工作台</div>
        <div className="space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = isActive(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'group relative flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors',
                  active ? 'bg-signal/[0.07] text-ink' : 'text-muted hover:bg-white/[0.03] hover:text-ink',
                )}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-signal" />}
                <span className="mt-0.5 font-mono text-[9.5px] leading-4 text-dim group-hover:text-dim">{item.id}</span>
                <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', active ? 'text-signal' : 'text-dim group-hover:text-muted')} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-1">
                    <span className="text-[12.5px] leading-4">{item.label}</span>
                    <span className="flex items-center gap-1">
                      {item.to === '/lab' && activeExperiments > 0 && (
                        <span
                          className={cn(
                            'inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 font-mono text-[8.5px] leading-none',
                            activeExperiments > 1 ? 'bg-amber/20 text-amber' : 'bg-cyan/15 text-cyan',
                          )}
                          title={`进行中实验 ${activeExperiments} / 1`}
                        >
                          {activeExperiments}
                        </span>
                      )}
                      <span className="font-mono text-[8.5px] tracking-[0.1em] text-dim opacity-70">{item.en}</span>
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] leading-3.5 text-dim">{item.desc}</span>
                </span>
              </NavLink>
            )
          })}
        </div>

        <div className="mt-5 rounded-md border border-line/80 bg-panel/50 p-2.5">
          <div className="mono-label mb-1.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber" /> DATA STATUS
          </div>
          <div className="flex items-center justify-between gap-2">
            <DataStateBadge />
            <span className="font-mono text-[9.5px] text-dim">v{appVersion}</span>
          </div>
          <div className="mt-2 space-y-1 font-mono text-[9.5px] text-dim">
            <div className="flex justify-between"><span>as_of</span><span className="text-muted">{dataAsOf}</span></div>
            <div className="flex justify-between"><span>opportunities</span><span className="text-muted">{stats.kpi.total_opps}</span></div>
            <div className="flex justify-between"><span>data_version</span><span className="text-muted">{dataMeta.data_version || '—'}</span></div>
          </div>
        </div>
      </nav>

      <div className="border-t border-line/80 px-4 py-3">
        <div className="flex items-center gap-1.5 text-[10px] text-dim">
          <ShieldCheck className="h-3.5 w-3.5 text-signal/70" />
          <span>本地优先 · 无运行时联网</span>
        </div>
        <div className="mt-1 text-[9.5px] leading-relaxed text-dim/80">
          数据与页面均在本地；双击 dist/index.html 即可离线使用。
        </div>
      </div>
    </aside>
  )
}

function MobileNav() {
  const location = useLocation()
  return (
    <div className="border-b border-line bg-[#0c0f14] lg:hidden">
      <div className="chip-scroll flex items-center gap-1 overflow-x-auto px-3 py-2">
        {NAV.map((item) => {
          const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'shrink-0 rounded border px-2 py-1 font-mono text-[10.5px]',
                active ? 'border-signal/40 bg-signal/10 text-signal' : 'border-line text-muted',
              )}
            >
              {item.id} {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function Topbar() {
  const location = useLocation()
  const crumb = useMemo(() => {
    const p = location.pathname
    if (p.startsWith('/opportunities/')) return ['opportunities', p.split('/')[2] || '']
    const item = NAV.find((n) => (n.to === '/' ? p === '/' : p.startsWith(n.to)))
    return item ? [item.en.toLowerCase(), ''] : ['dashboard', '']
  }, [location.pathname])

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="flex h-[52px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 lg:hidden">
          <RadarMark />
          <span className="text-[13px] font-semibold">机会雷达</span>
        </Link>
        <div className="hidden items-center gap-1.5 font-mono text-[10.5px] text-dim lg:flex">
          <Command className="h-3 w-3 text-signal/70" />
          <span className="text-muted">radar://</span>
          <span className="text-ink">{crumb[0]}</span>
          {crumb[1] && (
            <>
              <span className="text-dim">/</span>
              <span className="max-w-[220px] truncate text-dim">{crumb[1]}</span>
            </>
          )}
          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-signal" />
        </div>
        <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:gap-3">
          <div className="hidden flex-1 justify-end sm:flex">
            <GlobalSearch />
          </div>
          <InfoTip
            content={
              <span>
                数据基准日（Asia/Shanghai）：{dataAsOf}
                <br />
                所有榜单窗口以该日为锚点计算。
              </span>
            }
          >
            <span className="hidden cursor-help whitespace-nowrap rounded border border-line bg-panel/70 px-1.5 py-0.5 font-mono text-[10px] text-muted md:inline-flex">
              AS_OF {dataAsOf}
            </span>
          </InfoTip>
          <DataStateBadge />
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-8 border-t border-line/80 px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-2 text-[10.5px] text-dim sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono tracking-wider text-muted">OPPORTUNITY RADAR · v{appVersion}</span>
          <span>数据基准 {dataAsOf}</span>
          <span className="hidden sm:inline">·</span>
          <span>React + Vite + TS + Tailwind v4 + ECharts · 本地离线构建</span>
        </div>
        <div className="max-w-[640px] text-[10px] leading-relaxed">
          研究假设与公开信息整理，不构成投资建议、法律意见或收入承诺。涉及跨境/金融/医疗/宗教时请自行合规核查。
        </div>
      </div>
    </footer>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="pointer-events-none fixed inset-0 z-0 grid-bg opacity-[0.35]" aria-hidden="true" />
      <Sidebar />
      <div className="relative z-10 flex min-h-screen flex-col lg:pl-[236px]">
        <Topbar />
        <MobileNav />
        <main className="mx-auto w-full max-w-[1560px] flex-1 overflow-x-clip px-4 py-5 sm:px-6 lg:px-8">{children}</main>
        <Footer />
      </div>
    </div>
  )
}
