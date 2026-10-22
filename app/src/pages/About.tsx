import { Link } from 'react-router-dom'
import {
  BookOpen,
  Boxes,
  CheckCircle2,
  Database,
  ExternalLink,
  FileCode2,
  FlaskConical,
  GitBranch,
  Github,
  Globe2,
  HardDrive,
  History,
  Info,
  Keyboard,
  Layers3,
  PackageCheck,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Panel, SectionCard } from '@/components/ui'
import {
  allSources,
  appVersion,
  calendarEvents,
  dataAsOf,
  dataMeta,
  historyBasisReplayLabel,
  historyMeta,
  isMockData,
  onlineUrl,
  opportunities,
  playbooks,
  rankingsDeltaBasis,
  rankingsHistoryAsOf,
  rankingsHistoryReplayAsOf,
  rankingsHistoryReconstructed,
  rankingsTieBreaker,
  repoUrl,
  sourceHealth,
  sources,
  taxonomy,
} from '@/lib/data'
import { cn } from '@/lib/utils'

const DOCS = [
  ['00', '总览 · 执行摘要与路线图', '项目目标、北极星指标与阶段路线'],
  ['01', '业务蓝图与商业模式', '价值主张、竞品、商业模式与 90 天计划'],
  ['02', '平台与数据源全矩阵', '12 大类 ≥60 平台的可访问性与合规'],
  ['03', '扫描方法论 · 人性需求逆向工程', '信号 → 需求 → 供给缺口的方法链'],
  ['04', '评估评分体系与推荐算法', '10 维锚点、权重、衰减与回测'],
  ['05', '商业驱动七问框架', '七问必答结构与模板'],
  ['06', '产品形态与交付设计', '页面结构、交互与信息架构'],
  ['07', '技术架构与扫描流水线', '前端构建、数据契约与 Python 流水线'],
  ['08', '运营与增长手册', '日/周/月/年运营 SOP 与验证实验'],
  ['09', '风险合规与红队清单', '合规红线、红色风险与发布 checklist'],
  ['10', '版本与发布管理', '版本冻结、回滚与 releases 规则'],
  ['11', '补充清单 · 40 件事', '容易踩的坑与放大器'],
  ['12', '数据契约与字段字典', '唯一数据接口标准（data-v0.3.1，含 history 回放 / source-health v2 / 采集源兼容）'],
]

const STACK = [
  ['框架', 'React 18 + TypeScript + Vite'],
  ['样式', 'Tailwind CSS v4（@tailwindcss/vite）'],
  ['组件', 'Radix UI primitives 自建 shadcn 风格组件'],
  ['图表', 'ECharts 5 + echarts-for-react（自定义深色主题）'],
  ['路由', 'react-router-dom · HashRouter（file:// 可用）'],
  ['动效', 'framer-motion'],
  ['图标', 'lucide-react'],
  ['日期', 'dayjs'],
  ['工具', 'clsx + tailwind-merge'],
  ['数据', '构建期同步 ../data/*.json → src/data/，无运行时请求'],
  ['离线', 'vite-plugin-singlefile 单文件 dist（file:// 双击可用）'],
  ['实验', 'localStorage 实验记录 + Blob 报告/机会卡导出'],
  ['推荐', '7 维画像 × 机会需求向量 → fit / rec_score / MMR'],
  ['预警', '本地规则引擎 + localStorage 已读/忽略'],
  ['校准', 'Brier 概率校准 + 成功率 / 分桶 / 样本导出'],
  ['过滤', '画像资金档位硬约束 + 严格 CNY 上限开关'],
]

const ROADMAP = [
  { version: 'v0.4.0', title: '扫描自动化（规划）', items: ['--fetch 信号人工审核工作流', '机会订阅与提醒', '评分回测与校准增强', '本地代理接入公开 API'] },
  { version: 'v0.5.0', title: '协作与多语言（规划）', items: ['多语言数据源适配', '团队共享只读快照', '移动端完整适配', '插件化数据源'] },
  { version: 'v1.0.0', title: '稳定契约与生态', items: ['数据契约 1.0 冻结', '发布流程自动化', '历史趋势与回测数据库', '公开数据源适配器市场'] },
]

const HISTORY = [
  {
    version: 'v0.3.1',
    date: '2026-10-22',
    tag: '当前版本',
    items: [
      '回测校准新增 Brier 分数（docs/04 §12.9.5）：p=clamp(total/100,.01,.99)、inconclusive 排除、二值样本 ≥3 展示并与基线 0.25 对比，导出 JSON/MD 含 Brier',
      '画像新增「严格资金过滤」开关（默认关）：开启后按资金档位上限过滤 roi.capital_cny.min，推荐页显示被过滤数量与原因；关闭沿用分数差硬约束',
      '告警 id 加入数据版本/采集时间指纹：数据升版后旧已读/忽略自动失效并重新提醒，旧记录保留在 localStorage',
      '采集展示兼容 source-health 源 id/url/name 变化：/sources 按 id → URL → 名称匹配，/alerts 不受新 id 影响；strict 构建不再因未匹配源失败',
      '校准页 Brier 卡片/建议/单桶 <3 提示完善；版本升 v0.3.1，导出 schema 同步 @0.3.1',
    ],
  },
  {
    version: 'v0.3.0',
    date: '2026-10-22',
    tag: '上一版本',
    items: [
      '新增 /profile 个人画像：3 步向导 + 5 预设 + localStorage，7 维能力向量',
      '推荐引擎 lib/recommend.ts：需求向量 + 硬约束 + fit + rec_score=0.6×total+0.4×fit×100 + MMR + 双解释',
      '排行榜新增「为你推荐」模式；指挥台显示画像摘要、推荐 Top3 与预警数',
      '新增 /alerts 预警中心：窗口关闭 / 实验超期 / 采集源失败 / 未核验证据 / 高匹配未行动',
      '新增 /calibration 回测校准：实验 outcome 与预测等级 join，成功率 / 花费 / 分桶 / 校准建议 / 导出',
      '数据接入 v0.3：source-health v2（mode/latency/error/cached）、历史回放快照与真实 delta（较上一快照）',
    ],
  },
  {
    version: 'v0.2.0',
    date: '2026-10-22',
    tag: '历史版本',
    items: [
      '新增 /lab 实验台：localStorage 实验 CRUD、统计、复盘周期、JSON/Markdown 导出',
      '详情页实验状态卡 + Markdown 机会卡复制与下载 + 本周报告导出',
      '榜单页/详情页浏览器端报告导出（Markdown + 自包含可打印 HTML）',
      '接入 data-v0.2.0：rankings.meta.delta_basis/history_as_of、history 快照、source-health',
      'P2 修复：1024 卡片栅格、Dashboard「新上榜」口径文案、榜单 delta 口径标签',
    ],
  },
  {
    version: 'v0.1.0',
    date: '2026-10-22',
    tag: '更早版本',
    items: [
      '8 个路由：指挥台 / 排行榜 / 机会详情 / 扫描室 / 方法论 / 数据源 / 日历 / 关于',
      '数据契约 data-v0.1.0：taxonomy / opportunities / rankings / stats / sources / playbooks / calendar',
      '构建期 strict 校验：机会数、榜单配额、七问、10 维公式、枚举与数量',
      '深色「终端 + 编辑部」设计系统、ECharts 深色主题、权重可调演示',
      'base "./" + HashRouter + 单文件构建，dist/index.html 可 file:// 双击离线打开',
    ],
  },
  { version: 'v0.0.9-dev', date: '2026-10-21', tag: '内部迭代', items: ['页面骨架与图表主题', '数据接入层与降级策略', '权重实时重算组件'] },
  { version: 'v0.0.1', date: '2026-10-20', tag: '项目启动', items: ['数据契约冻结', '页面信息架构确定', '工程脚手架与构建链路'] },
]

export default function About() {
  const checks = dataMeta.validation?.checks || []
  const passCount = checks.filter((c) => c.level === 'PASS').length
  const failCount = checks.filter((c) => c.level === 'FAIL').length

  return (
    <div>
      <PageHeader
        index="11"
        kicker="ABOUT · 关于"
        title="关于机会雷达"
        description="本地优先的个人商机研究工具：用「人性需求信号 + 文化差异信号」发现全世界的赚钱信息差，按日 / 周 / 月 / 年榜单交付，并为每个机会强制回答商业驱动七问。v0.3.1 在画像推荐与实验校准上补齐 Brier、严格资金过滤与告警升版重提醒。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal"><PackageCheck className="h-3 w-3" /> v{appVersion}</Badge>
            <Badge tone={isMockData ? 'amber' : 'signal'}>{isMockData ? 'DEMO DATA' : 'REAL DATA'}</Badge>
            <a href={repoUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-7 items-center gap-1 rounded border border-line bg-panel-2 px-2.5 text-[11.5px] text-muted transition-colors hover:border-line-strong hover:text-ink">
              <Github className="h-3 w-3" /> 源码仓库
            </a>
            <a href={onlineUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-7 items-center gap-1 rounded border border-signal/35 bg-signal/10 px-2.5 text-[11.5px] text-signal transition-colors hover:bg-signal/20">
              <Globe2 className="h-3 w-3" /> 线上版（随版本更新）
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <SectionCard className="xl:col-span-7" eyebrow="VERSION" title="版本与构建信息">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { label: '应用版本', value: `v${appVersion}`, hint: '本地离线构建' },
              { label: '数据版本', value: dataMeta.data_version || '—', hint: 'docs/12 契约' },
              { label: '数据基准日', value: dataAsOf, hint: 'Asia/Shanghai' },
              { label: '数据状态', value: isMockData ? 'DEMO' : 'REAL', hint: isMockData ? '含开发占位' : '已通过 strict' },
            ].map((x) => (
              <Panel key={x.label} className="p-2.5">
                <div className="mono-label">{x.label}</div>
                <div className={cn('num mt-1 text-[15px] font-semibold', x.label === '数据状态' ? (isMockData ? 'text-amber' : 'text-signal') : 'text-ink')}>{x.value}</div>
                <div className="mt-0.5 text-[9.5px] text-dim">{x.hint}</div>
              </Panel>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
            {[
              { label: '机会', value: opportunities.length },
              { label: '数据源', value: allSources.length },
              { label: '扫描剧本', value: playbooks.length },
              { label: '日历节点', value: calendarEvents.length },
              { label: '历史快照', value: historyMeta.available ? `${historyMeta.count}${historyMeta.snapshots.some((s) => s.reconstructed) ? `（回放 ${historyMeta.snapshots.filter((s) => s.reconstructed).length}）` : ''}` : '未提供' },
              { label: '采集健康', value: sourceHealth.available ? `${sourceHealth.ok_count}/${sourceHealth.total} ok` : '未提供' },
            ].map((x) => (
              <div key={x.label} className="flex items-baseline justify-between rounded border border-line/70 px-2.5 py-1.5">
                <span className="text-[10.5px] text-dim">{x.label}</span>
                <span className="num text-[13px] text-muted">{x.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a href={repoUrl} target="_blank" rel="noreferrer noopener" className="group flex items-center gap-2 rounded border border-line/70 bg-white/[0.01] px-2.5 py-2 transition-colors hover:border-line-strong">
              <Github className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0">
                <span className="block text-[11px] text-ink">GitHub 源码仓库</span>
                <span className="block truncate font-mono text-[9px] text-dim">charline88888-ux/opportunity-radar</span>
              </span>
              <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-dim group-hover:text-cyan" />
            </a>
            <a href={onlineUrl} target="_blank" rel="noreferrer noopener" className="group flex items-center gap-2 rounded border border-signal/25 bg-signal/[0.03] px-2.5 py-2 transition-colors hover:border-signal/50">
              <Globe2 className="h-4 w-4 shrink-0 text-signal" />
              <span className="min-w-0">
                <span className="block text-[11px] text-ink">GitHub Pages 线上版（随版本更新）</span>
                <span className="block truncate font-mono text-[9px] text-dim">charline88888-ux.github.io/opportunity-radar</span>
              </span>
              <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-dim group-hover:text-signal" />
            </a>
          </div>
          <div className="mt-2 rounded border border-signal/20 bg-signal/[0.03] px-2.5 py-2">
            <div className="mono-label text-signal">v0.3.1 本轮变更</div>
            <div className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
              Brier 概率校准（基线 0.25 / 二值 N / 导出）· 严格资金过滤开关（档位 CNY 上限，持久化到画像）· 告警 id 含数据版本指纹（升版重提醒）· source-health 源 id/url/name 兼容 · 单桶 &lt;3 提示与导出 schema @0.3.1。
            </div>
          </div>
          <div className="mt-3 rounded border border-line/70 bg-black/20 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-dim">
            <div>sync: node app/scripts/sync-data.mjs --strict</div>
            <div>build: cd app &amp;&amp; pnpm install &amp;&amp; pnpm build</div>
            <div>out: app/dist/index.html（双击即可离线打开）</div>
          </div>
          <div className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-dim">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-cyan" />
            本应用没有后端、没有 CDN、运行时无任何网络请求；所有数据在构建时打包进 dist，可直接拷贝给他人离线使用。
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-5" eyebrow="DATA PIPELINE" title="数据链路与 strict 校验">
          <div className="space-y-1.5">
            {[
              ['data/*.json', '7 个核心 JSON 必须为真实数据（strict）'],
              ['data/history/rankings-*.json', '可选：真实快照 + 历史回放（reconstructed）→ delta_basis'],
              ['data/source-health.json', '可选：v2 采集健康（mode / error / latency / cached）'],
              ['scripts/sync-data.mjs', '同步 + 契约自检；可选缺失不阻塞 strict'],
              ['src/data/*.json', '前端唯一 import 目录（构建期生成）'],
              ['app/dist/index.html', '单文件离线产物，HashRouter + base ./'],
            ].map(([a, b], i) => (
              <div key={a} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-line font-mono text-[8px] text-dim">{i + 1}</span>
                <div>
                  <div className="font-mono text-[10.5px] text-muted">{a}</div>
                  <div className="text-[10px] text-dim">{b}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1 rounded border border-line/70 bg-white/[0.015] px-2 py-1.5 text-[10px] sm:grid-cols-4">
            <div className="flex items-center gap-1">
              <History className="h-3 w-3 text-cyan" />
              <span className="text-dim">快照</span>
              <span className="num text-muted">{historyMeta.count}</span>
            </div>
            <div className="flex items-center gap-1">
              <History className="h-3 w-3 text-amber" />
              <span className="text-dim">回放</span>
              <span className="num text-muted">{historyMeta.snapshots.filter((s) => s.reconstructed).length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3 text-signal" />
              <span className="text-dim">采集</span>
              <span className="text-muted">{sourceHealth.available ? `${sourceHealth.ok_count}/${sourceHealth.total} ok · ${sourceHealth.mode || '—'}` : '可选未提供'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3 text-amber" />
              <span className="text-dim">口径</span>
              <span className="text-muted">{rankingsDeltaBasis === 'history' ? `较上一快照（${rankingsHistoryAsOf || '—'}）` : '相邻窗口'}</span>
            </div>
          </div>
          {historyBasisReplayLabel && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[9px] text-dim">
              <Badge tone="amber">{historyBasisReplayLabel}</Badge>
              <span>上一份快照为历史回放（replay_as_of {rankingsHistoryReplayAsOf || '—'}），仅用于补足 delta 演示与历史对照。</span>
            </div>
          )}
          {rankingsDeltaBasis === 'history' && rankingsHistoryAsOf && (
            <div className="mt-1 font-mono text-[9px] text-dim">history_as_of = {rankingsHistoryAsOf} · tie_breaker = {rankingsTieBreaker || 'rank_score → momentum → evidence_count → last_activity → opp_id'}</div>
          )}
          {historyMeta.snapshots.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {historyMeta.snapshots.map((s) => (
                <span key={s.file} className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px]', s.reconstructed ? 'border-amber/30 text-amber' : 'border-line/70 text-dim')} title={s.file}>
                  {s.date}
                  {s.reconstructed ? ' · 回放' : ' · 实采'}
                  {s.delta_basis ? ` · ${s.delta_basis}` : ''}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 border-t border-line/70 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="mono-label">LAST BUILD VERIFY</span>
              <Badge tone={failCount ? 'danger' : 'signal'}>
                {failCount ? `${failCount} FAIL` : `${passCount} PASS`}
              </Badge>
            </div>
            <div className="max-h-[140px] space-y-0.5 overflow-auto">
              {checks.map((c, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[9.5px] leading-snug">
                  {c.level === 'PASS' ? <CheckCircle2 className="mt-0.5 h-2.5 w-2.5 shrink-0 text-signal" /> : <XCircle className="mt-0.5 h-2.5 w-2.5 shrink-0 text-danger" />}
                  <span className="shrink-0 font-mono text-dim">{c.name}</span>
                  <span className="min-w-0 flex-1 text-muted">{c.detail}</span>
                </div>
              ))}
              {!checks.length && <div className="text-[10px] text-dim">本次构建未记录校验结果（使用缓存或手动构建）。</div>}
            </div>
          </div>
          {isMockData && (
            <div className="mt-2 flex items-start gap-1.5 rounded border border-amber/30 bg-amber/[0.06] px-2 py-1.5 text-[10px] leading-relaxed text-amber">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
              当前含开发占位数据（{dataMeta.mock_files?.length || 0} 个文件）；正式发布版必须全部来自 ../data 并通过 strict 校验。
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <SectionCard className="xl:col-span-7" eyebrow="DOCUMENTS" title="文档索引" subtitle="源码仓库 docs/ 下：战略、方法论、数据、技术与发布共 13 份文档">
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {DOCS.map(([no, name, desc]) => (
              <div key={no} className={cn('rounded border px-2 py-1.5', no === '12' ? 'border-signal/35 bg-signal/[0.04]' : 'border-line/70 bg-white/[0.01]')}>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[9.5px] text-signal">{no}</span>
                  <span className="truncate text-[11px] text-ink">{name}</span>
                  {no === '12' && <Badge tone="signal">唯一契约</Badge>}
                </div>
                <div className="mt-0.5 line-clamp-1 text-[9.5px] text-dim">{desc}</div>
                <div className="mt-0.5 font-mono text-[8.5px] text-dim/70">docs/{no}-*.md</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-3 xl:col-span-5">
          <SectionCard eyebrow="STACK" title="技术栈">
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {STACK.map(([k, v]) => (
                <div key={k} className="flex items-start gap-2 border-b border-line/40 py-0.5 text-[10.5px]">
                  <span className="w-8 shrink-0 text-dim">{k}</span>
                  <span className="text-muted">{v}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="SHORTCUTS" title="使用提示">
            <div className="space-y-1.5 text-[10.5px] text-muted">
              <div className="flex items-center justify-between"><span>全局搜索机会</span><span className="kbd">⌘K / Ctrl+K</span></div>
              <div className="flex items-center justify-between"><span>搜索框内打开第一条</span><span className="kbd">Enter</span></div>
              <div className="flex items-center justify-between"><span>关闭搜索 / 弹层</span><span className="kbd">Esc</span></div>
              <div className="flex items-center justify-between"><span>离线打开</span><span className="font-mono text-[9.5px] text-dim">双击 dist/index.html</span></div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-dim">
              <Keyboard className="h-3 w-3" /> 所有页面支持键盘焦点可见与 Hover 高亮。
            </div>
          </SectionCard>

          <SectionCard eyebrow="SOURCE HEALTH" title="最近在线采集状态" right={<Database className="h-4 w-4 text-dim" />}>
            {sourceHealth.available ? (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[10.5px]">
                  <Badge tone={sourceHealth.fail_count ? 'amber' : 'signal'}>成功 {sourceHealth.ok_count}/{sourceHealth.total}</Badge>
                  <Badge tone="cyan">mode {sourceHealth.mode || '—'}</Badge>
                  <span className="font-mono text-[9.5px] text-dim">{sourceHealth.checked_at || '—'}</span>
                  <span className="ml-auto text-[9.5px] text-dim">来源 data/source-health.json（v2 可选）</span>
                </div>
                <div className="max-h-[260px] space-y-1 overflow-auto">
                  {sourceHealth.sources.map((s) => (
                    <div key={s.id} className="rounded border border-line/70 px-2 py-1 text-[10px]">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.ok ? 'bg-signal' : 'bg-danger')} />
                        <span className="min-w-0 flex-1 truncate text-muted">{s.name || s.id}</span>
                        <span className="rounded border border-line/60 px-1 py-0.5 font-mono text-[8.5px] text-dim">{s.mode || '—'}</span>
                        <span className="font-mono text-[9px] text-dim">{s.http_status ?? '—'}</span>
                        <span className="font-mono text-[9px] text-dim">{s.latency_ms != null ? `${s.latency_ms}ms` : '—'}</span>
                        <span className="font-mono text-[9px] text-dim">{s.items != null ? `${s.items} items` : ''}</span>
                        {s.cached && <span className="font-mono text-[8.5px] text-cyan">cached</span>}
                        <Badge tone={s.ok ? 'signal' : 'danger'}>{s.ok ? 'OK' : 'FAIL'}</Badge>
                      </div>
                      {!s.ok && (
                        <div className="mt-0.5 pl-3.5 font-mono text-[9px] leading-relaxed text-danger/90" title={String(s.error || '')}>
                          error：{String(s.error || '未返回可用内容')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-1 text-[9.5px] leading-relaxed text-dim">
                  <span className="font-mono text-muted">pipeline.py --fetch</span> 会限速抓取公开 RSS 并写入 scanner/outbox 供人工复核；不自动进入机会库。失败源必须给出可复核的 error 原因。
                </div>
              </>
            ) : (
              <div className="text-[10.5px] leading-relaxed text-dim">
                暂无 source-health 数据（可选）。运行 <span className="font-mono text-muted">python scanner/pipeline.py --fetch</span> 后生成；缺失不影响页面与构建。
              </div>
            )}
          </SectionCard>

          <SectionCard eyebrow="REPORTS" title="报告与导出">
            <div className="space-y-1.5 text-[10.5px] leading-relaxed text-muted">
              <p><span className="text-cyan">前端导出：</span>榜单页 / 详情页可导出当前窗口 Markdown 与自包含 HTML（浏览器 Blob 生成，无需联网）；详情页还可复制/下载单条机会卡 Markdown。</p>
              <p><span className="text-cyan">后端报告：</span>扫描器 <span className="font-mono text-dim">scanner/report.py</span> 会在 <span className="font-mono text-dim">data/reports/</span> 生成四窗口报告，内容与本页导出同构，适合归档与分发。</p>
              <p>实验记录仅保存在本机 localStorage（<span className="font-mono text-dim">/lab</span> 可导出 JSON 备份），不会写入 data/，也不会上传。</p>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard className="mt-3" eyebrow="ROADMAP" title="路线图" subtitle="规划项，不代表承诺；版本冻结后旧版本只读">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {ROADMAP.map((r) => (
            <Panel key={r.version} className="p-2.5">
              <div className="flex items-center gap-2">
                <span className="num text-[14px] font-semibold text-signal">{r.version}</span>
                <span className="text-[11.5px] text-ink">{r.title}</span>
                <Badge tone="muted" className="ml-auto">规划</Badge>
              </div>
              <ul className="mt-1.5 space-y-1">
                {r.items.map((x) => (
                  <li key={x} className="flex items-start gap-1.5 text-[10.5px] text-muted">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-dim" />
                    {x}
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="mt-3" eyebrow="CHANGELOG" title="版本历史" right={<GitBranch className="h-4 w-4 text-dim" />}>
        <div className="space-y-3">
          {HISTORY.map((h) => (
            <div key={h.version} className="flex gap-3">
              <div className="w-24 shrink-0">
                <div className="num text-[12px] text-ink">{h.version}</div>
                <div className="font-mono text-[9px] text-dim">{h.date}</div>
              </div>
              <div className="min-w-0 flex-1 border-l border-line pl-3">
                <Badge tone={h.tag === '当前版本' ? 'signal' : 'muted'}>{h.tag}</Badge>
                <ul className="mt-1 space-y-0.5">
                  {h.items.map((x) => (
                    <li key={x} className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal/70" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="mt-3" eyebrow="DISCLAIMER" title="免责声明与数据伦理" right={<ShieldCheck className="h-4 w-4 text-amber" />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5 text-[10.5px] leading-relaxed text-muted">
            <p>本项目是「个人商机研究工具」，所有机会卡片是研究假设与公开信息整理，<span className="text-amber">不构成投资建议、法律意见或收入承诺</span>。</p>
            <p>涉及跨境、金融、医疗、法律、宗教、内容版权时，请自行做合规核查并咨询持牌专业人士；标注 <span className="font-mono text-dim">verified:false</span> 的条目未经二次核验，使用前必须复核原始来源。</p>
            <p>只收集公开信息；不抓取个人信息、不绕过登录/付费墙、不违反平台 ToS。<span className="font-mono text-danger">compliance:red</span> 的源只允许人工浏览。</p>
          </div>
          <div className="space-y-1.5 text-[10.5px] leading-relaxed text-muted">
            <p>任何机会在使用前都要用「7 天验证动作」做最小验证；本工具不提供收益保证，也不对因使用信息造成的损失负责。</p>
            <p>数据是「假设池」而非常识：榜单与评分只用于排序注意力，不是推荐买入或投入的结论。</p>
            <p className="rounded border border-line/70 bg-black/20 px-2 py-1.5 font-mono text-[9.5px] text-dim">
              若发现数据或证据链接失效，请在 data/CHANGELOG.md 记录并重新运行扫描流水线校验。
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/70 pt-2">
          <Badge tone="signal"><CheckCircle2 className="h-3 w-3" /> 本地优先</Badge>
          <Badge tone="cyan"><HardDrive className="h-3 w-3" /> 无后端 / 无 CDN</Badge>
          <Badge tone="neutral"><BookOpen className="h-3 w-3" /> docs/12 唯一数据契约</Badge>
          <Badge tone="amber" className="border-amber/35 bg-amber/10 text-amber"><Boxes className="h-3 w-3" /> {taxonomy.industries.length} 行业 / {taxonomy.regions.length} 区域</Badge>
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[9.5px] text-dim">
            <FileCode2 className="h-3 w-3" /> built locally · {sources.categories.length} source categories
          </span>
        </div>
      </SectionCard>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px] text-dim">
        <Link to="/" className="rounded border border-line px-2 py-1 text-muted hover:text-ink">返回指挥台</Link>
        <Link to="/rankings" className="rounded border border-line px-2 py-1 text-muted hover:text-ink">查看排行榜</Link>
        <span className="ml-auto flex items-center gap-1"><Layers3 className="h-3 w-3" /> 机会雷达 Opportunity Radar · 本地个人版 · v{appVersion}</span>
      </div>
    </div>
  )
}
