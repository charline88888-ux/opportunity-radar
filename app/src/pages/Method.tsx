import { PageHeader } from '@/components/PageHeader'
import { Badge, Panel } from '@/components/ui'
import { useI18n } from '@/lib/i18n'

const DIMENSIONS = [
  { zh: '信号强度', en: 'Signal strength', sourceZh: '公开讨论量、来源数量、证据等级', sourceEn: 'Public discussion volume, source count, evidence tier', ruleZh: '多来源独立出现、有具体数字/实体/时间', ruleEn: 'Independent sources with concrete numbers, entities and dates', missZh: '把营销稿/单一搬运当成趋势', missEn: 'Mistaking a press release or single repost for a trend' },
  { zh: '信息差', en: 'Information gap', sourceZh: '区域/监管/价格/平台规则差异', sourceEn: 'Regional, regulatory, pricing or platform-rule differences', ruleZh: '同一需求在两地存在可获得性/价格/合规差', ruleEn: 'Same need has availability, price or compliance differences across markets', missZh: '把普通新鲜感当结构性机会', missEn: 'Treating novelty as a structural opportunity' },
  { zh: '可行性', en: 'Feasibility', sourceZh: '启动资金、技能、供应链、交付链路', sourceEn: 'Capital, skills, supply chain, delivery path', ruleZh: '个人/小团队 0–90 天能跑通最小闭环', ruleEn: 'A person or small team can run the minimal loop in 0–90 days', missZh: '低估合规、售后与跨境物流', missEn: 'Underestimating compliance, after-sales and cross-border logistics' },
  { zh: '经济性', en: 'Economics', sourceZh: '客单、毛利、获客成本、回本周期', sourceEn: 'Ticket size, margin, acquisition cost, payback', ruleZh: '毛利覆盖获客与交付成本，回本 ≤ 6 个月', ruleEn: 'Margin covers acquisition and delivery, payback ≤ 6 months', missZh: '只看收入不看退货/平台费', missEn: 'Looking at revenue without returns or platform fees' },
  { zh: '时机', en: 'Timing', sourceZh: '首次出现时间、催化剂、同类供给数量', sourceEn: 'First-seen date, catalysts, number of competing suppliers', ruleZh: '需求刚出现/规则刚变化，供给尚未拥挤', ruleEn: 'Demand or rules just changed and supply is not crowded', missZh: '把已经拥挤的赛道当早期', missEn: 'Mistaking a crowded category for an early window' },
  { zh: '竞争', en: 'Competition', sourceZh: '直接/间接竞品、替代方案、平台在售', sourceEn: 'Direct/indirect competitors, alternatives, live listings', ruleZh: '存在可切入的差异化空位，而非正面价格战', ruleEn: 'A defensible differentiation gap exists, not a head-on price war', missZh: '把“没人做”误判为没需求', missEn: 'Treating “nobody does it” as no demand' },
  { zh: '风险', en: 'Risk', sourceZh: '监管、合规、现金流、交付与售后', sourceEn: 'Regulation, compliance, cash flow, delivery and after-sales', ruleZh: '主要风险可被合同/流程/保险/小步投入控制', ruleEn: 'Key risks can be controlled by contracts, process, insurance or staged spend', missZh: '忽略跨境税务、知识产权与退货', missEn: 'Ignoring cross-border tax, IP and returns' },
  { zh: '匹配度', en: 'Fit', sourceZh: '个人技能、资源、语言、时间与偏好', sourceEn: 'Skills, resources, languages, time and preferences', ruleZh: '与执行者现有能力/资源形成组合优势', ruleEn: 'Combines with the operator’s existing skills/resources', missZh: '只看机会大小不看自己能不能做', missEn: 'Judging only market size, not personal execution' },
  { zh: '证据', en: 'Evidence', sourceZh: '来源等级、证据数量、独立性', sourceEn: 'Source tier, evidence count, independence', ruleZh: '至少 2 个独立来源，含一手/平台在售证据', ruleEn: 'At least two independent sources, including first-party or live marketplace evidence', missZh: '把转载当独立来源', missEn: 'Counting reposts as independent sources' },
  { zh: '杠杆', en: 'Leverage', sourceZh: '内容、供应链、渠道、数据能否复用', sourceEn: 'Reusable content, supply chain, channels or data', ruleZh: '一次投入可在多市场/多渠道复用', ruleEn: 'One investment can be reused across markets/channels', missZh: '把一次性定制当可规模化产品', missEn: 'Treating one-off custom work as scalable product' },
]

const SECTIONS = [
  { zh: '商业画布', en: 'Business canvas', descZh: '9 格必须回答客户是谁、卖什么、怎么触达、靠什么资源交付、钱怎么进怎么出。', descEn: 'Nine blocks answer who the customer is, what is sold, how it is reached, what resources deliver it, and how money flows.' },
  { zh: '竞争与差异', en: 'Competition & differentiation', descZh: '分别列直接/间接竞品与替代方案，再说明差异化、护城河与定位；避免只写“竞争激烈”。', descEn: 'List direct/indirect competitors and alternatives, then state differentiation, moat and positioning; avoid merely saying “competition is fierce”.' },
  { zh: '跨市场机会', en: 'Cross-market opportunity', descZh: '说明可迁移市场、套利类型、迁移原因、本地化需求与定价权。', descEn: 'State target markets, arbitrage type, why it transfers, localization needs and pricing power.' },
  { zh: '时机与窗口', en: 'Timing & window', descZh: '给出为什么是现在、催化剂、窗口阶段、预计月数、紧迫性与窗口风险。', descEn: 'Explain why now, catalysts, window stage, expected months, urgency and window risk.' },
  { zh: '条件与门槛', en: 'Conditions & barriers', descZh: '启动资金、技能、资质、供应链、伙伴、团队、启动时间与进入门槛。', descEn: 'Startup capital, skills, licenses, supply chain, partners, team, launch time and entry barriers.' },
  { zh: '利润模型', en: 'Profit model', descZh: '收入项与定价/毛利、成本项、单位经济、回本周期、规模化杠杆。', descEn: 'Revenue items with pricing/margin, cost items, unit economics, payback and scaling leverage.' },
  { zh: '执行方案', en: 'Execution plan', descZh: '0–30 天、30–90 天、里程碑与首笔收入路径，写成可执行动作而不是口号。', descEn: 'Days 0–30, days 30–90, milestones and first-revenue path as executable actions, not slogans.' },
]

export default function Method() {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)

  return (
    <div>
      <PageHeader
        index="04"
        kicker={L('METHOD · 方法论', 'METHOD')}
        title={L('商机评估方法：10 维判断 + 说明书结构', 'Opportunity evaluation: 10 dimensions + brief structure')}
        description={L('商机不是“看起来新”，而是需求、信息差、可行性、经济性、时机、竞争、风险、匹配、证据、杠杆同时成立。候选详情按这份标准逐项写清楚。', 'An opportunity is not merely something new. It requires demand, gap, feasibility, economics, timing, competition, risk, fit, evidence and leverage to hold together. Candidate details explain each item against this standard.')}
        actions={<Badge tone="cyan">{L('10 维评分 · 可解释判断', '10 dimensions · explainable judgment')}</Badge>}
      />

      <Panel className="mb-3 p-3">
        <div className="mono-label mb-2">{L('10 维怎么判断', 'How the 10 dimensions are judged')}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[9.5px]">
            <thead className="text-dim">
              <tr className="border-b border-line/60">
                <th className="py-1.5 pr-2 font-normal">{L('维度', 'Dimension')}</th>
                <th className="py-1.5 pr-2 font-normal">{L('数据来源', 'Data source')}</th>
                <th className="py-1.5 pr-2 font-normal">{L('判断标准', 'Criteria')}</th>
                <th className="py-1.5 font-normal">{L('常见误判', 'Common misjudgment')}</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSIONS.map((d) => (
                <tr key={d.en} className="border-b border-line/30 align-top">
                  <td className="py-1.5 pr-2 text-muted">{L(d.zh, d.en)}</td>
                  <td className="py-1.5 pr-2 leading-relaxed text-dim">{L(d.sourceZh, d.sourceEn)}</td>
                  <td className="py-1.5 pr-2 leading-relaxed text-dim">{L(d.ruleZh, d.ruleEn)}</td>
                  <td className="py-1.5 leading-relaxed text-amber/80">{L(d.missZh, d.missEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[9px] text-dim">{L('评分等级：S ≥85 · A 75–84.9 · B 65–74.9 · C 55–64.9 · D <55；商机榜按总分降序。', 'Grades: S ≥85 · A 75–84.9 · B 65–74.9 · C 55–64.9 · D <55; the board sorts by total score.')}</div>
      </Panel>

      <Panel className="mb-3 p-3">
        <div className="mono-label mb-2">{L('商机评估说明书的结构', 'Structure of the evaluation brief')}</div>
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map((s) => (
            <div key={s.en} className="rounded border border-line/60 px-2 py-1.5 text-[10px]">
              <div className="text-ink">{L(s.zh, s.en)}</div>
              <div className="mt-0.5 text-[9px] leading-relaxed text-dim">{L(s.descZh, s.descEn)}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-3">
        <div className="mono-label mb-1">{L('边界', 'Boundary')}</div>
        <div className="text-[9.5px] leading-relaxed text-dim">
          {L('所有内容均为公开信息自动生成与评估，不构成投资建议；商机最终是否适合你，由你按自身资源与风险判断。', 'All content is auto-generated and evaluated from public information; it is not investment advice. Whether an opportunity suits you is your call based on your resources and risk.')}
        </div>
      </Panel>
    </div>
  )
}
