import { PageHeader } from '@/components/PageHeader'
import { Badge, Panel } from '@/components/ui'
import { appVersion, dataAsOf, dataMeta, opportunities, sourceHealth } from '@/lib/data'
import { candidates } from '@/lib/candidates'
import { useI18n } from '@/lib/i18n'

export default function About() {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)

  return (
    <div>
      <PageHeader
        index="07"
        kicker={L('ABOUT · 关于', 'ABOUT')}
        title={L('机会雷达 · 每天扫描、系统评估、商机入榜', 'Opportunity Radar · scan daily, assess systematically, rank opportunities')}
        description={L('公开信号自动整理成商机线索，按日 / 周 / 月 / 年进入商机榜。自动候选与精选机会使用同一套图表化评估详情：结论先行、投资与回本可复算。', 'Public signals become opportunity leads, ranked day/week/month/year. Auto candidates and curated opportunities share one chart-driven assessment: conclusion first, reproducible investment and payback.')}
        actions={<Badge tone="signal">v{appVersion}</Badge>}
      />

      <Panel className="mb-3 p-4">
        <div className="mono-label mb-2">{L('v1.5.0 更新', 'v1.5.0 changes')}</div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {[
            {
              zh: '统一评估详情：自动候选与精选机会共用同一套详情与图表，精选不再使用旧版页面。',
              en: 'Unified assessment: auto candidates and curated opportunities share the same detail and charts; curated no longer uses the old page.',
            },
            {
              zh: '经济性驾驶舱：启动资金 9 类拆项（min/max + 依据）、单位经济、收入结构、回本曲线、月收入利润、单量敏感性，滑杆可实时重算。',
              en: 'Economics cockpit: nine capital items (min/max + basis), unit economics, revenue mix, payback curve, monthly revenue/profit and order sensitivity, with live sliders.',
            },
            {
              zh: '商机卡 v2：卡片内嵌回本曲线/资金结构迷你图，标签可一键筛选，鼠标悬停显示理论月净利与理论单量。',
              en: 'Card v2: embedded payback/capital mini charts, one-click tag filters, and hover details for theoretical net profit and orders.',
            },
            {
              zh: '方法论同步：新增投资/单位经济/回本/敏感性公式与理论测算口径；所有经济数字标注「理论测算，非实盘验证」。',
              en: 'Method updated: investment / unit economics / payback / sensitivity formulas and theoretical-model basis; all economic figures marked “theoretical, not live-tested”.',
            },
          ].map((item) => (
            <div key={item.en} className="rounded border border-line/60 bg-panel-2/30 px-3 py-2 text-[13px] leading-[1.7] text-muted">
              {L(item.zh, item.en)}
            </div>
          ))}
        </div>
        <div className="mt-2 rounded border border-cyan/25 bg-cyan/[0.05] px-3 py-2 text-[13px] leading-[1.7] text-cyan/90">
          {L('v1.5.3 PATCH：图表口径修正——资金拆项全部从 0 对齐（实色下限/浅色上限/0 基线）、单位经济真瀑布严格勾稽（100−60=40，40−19=21）、敏感性新增盈亏平衡/当前竖线、收入结构中心文字加大内径不再遮挡；里程碑字段中文标签同步保留。', 'v1.5.3 PATCH: chart baselines fixed — capital bars aligned at 0 (solid low / light high / 0 axis), unit-economics waterfall reconciles exactly (100−60=40, 40−19=21), sensitivity adds break-even/current vertical lines, and the revenue-mix centre label no longer overlaps the ring; milestone labels kept.')}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Panel className="p-4">
          <div className="mono-label mb-2">{L('产品边界', 'Scope')}</div>
          <div className="space-y-1.5 text-[13px] leading-[1.75] text-muted">
            <div>{L('只保留核心页面：指挥台、商机榜、候选详情、精选详情、扫描室、方法论、数据源、商业日历、关于。', 'Only core pages: overview, opportunity board, candidate detail, curated detail, scanner, method, sources, calendar, about.')}</div>
            <div>{L('商机榜是唯一榜单：自动候选全部入榜，精选机会以「精选」标签混排，日/周/月/年四个窗口。', 'The board is the only ranking: all auto candidates are listed, with curated opportunities mixed via a “Curated” tag across day/week/month/year.')}</div>
            <div>{L('商机线索来自公开信号自动生成，不构成投资建议；能否赚钱取决于个人线下执行。', 'Leads are generated automatically from public signals and are not investment advice; commercial success depends on your own execution.')}</div>
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="mono-label mb-2">{L('数据状态', 'Data status')}</div>
          <div className="space-y-1.5 text-[13px] text-muted">
            <div className="flex justify-between"><span>{L('版本', 'Version')}</span><span className="font-mono">{appVersion}</span></div>
            <div className="flex justify-between"><span>{L('数据版本', 'Data version')}</span><span className="font-mono">{dataMeta.data_version || '—'}</span></div>
            <div className="flex justify-between"><span>{L('数据基准日', 'Data as of')}</span><span className="font-mono">{dataAsOf}</span></div>
            <div className="flex justify-between"><span>{L('自动候选', 'Auto candidates')}</span><span className="num">{candidates.length}</span></div>
            <div className="flex justify-between"><span>{L('精选机会', 'Curated opportunities')}</span><span className="num">{opportunities.length}</span></div>
            <div className="flex justify-between"><span>{L('经济字段', 'Economics fields')}</span><span className="font-mono">{L('全量覆盖', 'full coverage')}</span></div>
            <div className="flex justify-between"><span>{L('源健康', 'Source health')}</span><span className="num">{sourceHealth.ok_count}/{sourceHealth.total}</span></div>
          </div>
        </Panel>

        <Panel className="p-4 md:col-span-2">
          <div className="mono-label mb-2">{L('免责声明', 'Disclaimer')}</div>
          <div className="text-[13px] leading-[1.8] text-dim">
            {L('本工具仅做公开信息扫描、商机评估与榜单展示，不提供收益保证，也不对因使用信息造成的损失负责。经济数据为理论测算、非实盘验证；任何商机在投入前请自行核实来源、合规与成本。', 'This tool only scans public information, evaluates opportunities and ranks them. It offers no revenue guarantee and is not liable for losses from using the information. Economic figures are theoretical and not live-tested; verify sources, compliance and costs before committing.')}
          </div>
        </Panel>
      </div>
    </div>
  )
}
