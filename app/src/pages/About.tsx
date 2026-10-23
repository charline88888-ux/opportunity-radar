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
        title={L('机会雷达 · 只做每天扫描与商机入榜', 'Opportunity Radar · daily scanning and opportunity ranking only')}
        description={L('公开信号自动整理成商机线索，按日 / 周 / 月 / 年进入商机榜；每个候选都有评分、七问草稿与来源证据，点击即可查看。', 'Public signals become opportunity leads, ranked day/week/month/year on the board; every candidate includes a score, seven-question draft and source evidence.')}
        actions={<Badge tone="signal">v{appVersion}</Badge>}
      />

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <Panel className="p-3">
          <div className="mono-label mb-2">{L('产品边界', 'Scope')}</div>
          <div className="space-y-1.5 text-[10.5px] leading-relaxed text-muted">
            <div>{L('只保留核心页面：指挥台、商机榜、候选详情、精选详情、扫描室、方法论、数据源、商业日历、关于。', 'Only core pages: overview, opportunity board, candidate detail, curated detail, scanner, method, sources, calendar, about.')}</div>
            <div>{L('商机榜是唯一榜单：自动候选全部入榜，精选机会以「精选」标签混排，日/周/月/年四个窗口。', 'The board is the only ranking: all auto candidates are listed, with curated opportunities mixed via a “Curated” tag across day/week/month/year.')}</div>
            <div>{L('商机线索来自公开信号自动生成，不构成投资建议；能否赚钱取决于个人线下执行。', 'Leads are generated automatically from public signals and are not investment advice; commercial success depends on your own execution.')}</div>
          </div>
        </Panel>

        <Panel className="p-3">
          <div className="mono-label mb-2">{L('数据状态', 'Data status')}</div>
          <div className="space-y-1 text-[10.5px] text-muted">
            <div className="flex justify-between"><span>{L('版本', 'Version')}</span><span className="font-mono">{appVersion}</span></div>
            <div className="flex justify-between"><span>{L('数据版本', 'Data version')}</span><span className="font-mono">{dataMeta.data_version || '—'}</span></div>
            <div className="flex justify-between"><span>{L('数据基准日', 'Data as of')}</span><span className="font-mono">{dataAsOf}</span></div>
            <div className="flex justify-between"><span>{L('自动候选', 'Auto candidates')}</span><span className="num">{candidates.length}</span></div>
            <div className="flex justify-between"><span>{L('精选机会', 'Curated opportunities')}</span><span className="num">{opportunities.length}</span></div>
            <div className="flex justify-between"><span>{L('源健康', 'Source health')}</span><span className="num">{sourceHealth.ok_count}/{sourceHealth.total}</span></div>
          </div>
        </Panel>

        <Panel className="p-3 md:col-span-2">
          <div className="mono-label mb-2">{L('免责声明', 'Disclaimer')}</div>
          <div className="text-[10px] leading-relaxed text-dim">
            {L('本工具仅做公开信息扫描、商机评估与榜单展示，不提供收益保证，也不对因使用信息造成的损失负责。任何商机在投入前请自行核实来源、合规与成本。', 'This tool only scans public information, evaluates opportunities and ranks them. It offers no revenue guarantee and is not liable for losses from using the information. Verify sources, compliance and costs before committing.')}
          </div>
        </Panel>
      </div>
    </div>
  )
}
