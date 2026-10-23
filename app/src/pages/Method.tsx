import { PageHeader } from '@/components/PageHeader'
import { Badge, Panel } from '@/components/ui'
import { useI18n } from '@/lib/i18n'

const DIMENSIONS = [
  { zh: '信号强度', en: 'Signal strength', descZh: '公开讨论与需求的密度', descEn: 'Density of public discussion and demand' },
  { zh: '信息差', en: 'Information gap', descZh: '认知、地域、监管或价格差', descEn: 'Awareness, geography, regulation or price gap' },
  { zh: '可行性', en: 'Feasibility', descZh: '个人能否在有限资源下启动', descEn: 'Can an individual start with limited resources' },
  { zh: '经济性', en: 'Economics', descZh: '客单、毛利与回本结构', descEn: 'Ticket size, margin and payback structure' },
  { zh: '时机', en: 'Timing', descZh: '窗口是否正在打开或关闭', descEn: 'Is the window opening or closing' },
  { zh: '竞争', en: 'Competition', descZh: '供给密度与替代方案', descEn: 'Supply density and alternatives' },
  { zh: '风险', en: 'Risk', descZh: '合规、交付与现金流风险', descEn: 'Compliance, delivery and cash-flow risk' },
  { zh: '匹配度', en: 'Fit', descZh: '与个人能力、资源与审美的匹配', descEn: 'Match with personal skills, resources and taste' },
  { zh: '证据', en: 'Evidence', descZh: '来源数量、质量与独立性', descEn: 'Number, quality and independence of sources' },
  { zh: '杠杆', en: 'Leverage', descZh: '内容、供应链或渠道的放大效应', descEn: 'Amplification via content, supply chain or channels' },
]

const QUESTIONS = [
  { zh: '流量入口', en: 'Traffic', descZh: '客户从哪里第一次看到你', descEn: 'Where customers first find you' },
  { zh: '赚钱方式', en: 'Money', descZh: '卖什么、客单多少、毛利多少', descEn: 'What you sell, ticket size and margin' },
  { zh: '交付模型', en: 'Delivery', descZh: '如何稳定交付与售后', descEn: 'How delivery and after-sales work' },
  { zh: '投入回报', en: 'ROI', descZh: '启动成本、回本周期与月收入', descEn: 'Startup cost, payback and monthly revenue' },
  { zh: '目标人群', en: 'Audience', descZh: '最早愿意付钱的 100 个人', descEn: 'The first 100 people willing to pay' },
  { zh: '驱动因子', en: 'Drivers', descZh: '信息、跨境、供应链或人口结构', descEn: 'Information, cross-border, supply chain or demographics' },
  { zh: '壁垒与风险', en: 'Moat & risks', descZh: '为什么是你、为什么现在', descEn: 'Why you and why now' },
]

export default function Method() {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)

  return (
    <div>
      <PageHeader
        index="04"
        kicker={L('METHOD · 方法论', 'METHOD')}
        title={L('评分与商机判断', 'Scoring and opportunity judgment')}
        description={L('商机榜只做一件事：把公开信号转成可读的商机线索，用 10 个维度评分，再用七问把机会讲清楚。评分用于排序，不构成收益承诺。', 'The board does one thing: turn public signals into readable opportunity leads, score them on 10 dimensions, and explain each lead with seven questions. Scores rank leads; they are not a revenue promise.')}
        actions={<Badge tone="cyan">{L('10 维评分 · 七问结构化', '10 dimensions · seven questions')}</Badge>}
      />

      <Panel className="mb-3 p-3">
        <div className="mono-label mb-2">{L('10 维评分', '10 scoring dimensions')}</div>
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-5">
          {DIMENSIONS.map((d) => (
            <div key={d.en} className="rounded border border-line/60 px-2 py-1.5 text-[10px]">
              <div className="text-ink">{L(d.zh, d.en)}</div>
              <div className="mt-0.5 text-[9px] leading-relaxed text-dim">{L(d.descZh, d.descEn)}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[9.5px] text-dim">{L('评分等级：S ≥85 · A 75–84.9 · B 65–74.9 · C 55–64.9 · D <55；商机榜按总分降序展示。', 'Grades: S ≥85 · A 75–84.9 · B 65–74.9 · C 55–64.9 · D <55; the board sorts by total score.')}</div>
      </Panel>

      <Panel className="mb-3 p-3">
        <div className="mono-label mb-2">{L('七问自动草稿', 'Seven questions (auto draft)')}</div>
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
          {QUESTIONS.map((q, i) => (
            <div key={q.en} className="rounded border border-line/60 px-2 py-1.5 text-[10px]">
              <div className="text-muted">{String(i + 1).padStart(2, '0')} · {L(q.zh, q.en)}</div>
              <div className="mt-0.5 text-[9px] leading-relaxed text-dim">{L(q.descZh, q.descEn)}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[9.5px] leading-relaxed text-dim">{L('每个候选详情页都会给出七问草稿与来源证据；线索是否值得做，由你自己按资源与风险判断。', 'Every candidate detail page includes the seven-question draft and source evidence; whether a lead is worth pursuing is your call based on resources and risk.')}</div>
      </Panel>

      <Panel className="p-3">
        <div className="mono-label mb-1">{L('边界', 'Boundary')}</div>
        <div className="text-[9.5px] leading-relaxed text-dim">
          {L('本工具只做公开信号扫描、商机评估与入榜，不提供收益保证，也不对因使用信息造成的损失负责。', 'This tool only scans public signals, evaluates opportunities and ranks them; it offers no revenue guarantee and is not liable for losses from using the information.')}
        </div>
      </Panel>
    </div>
  )
}
