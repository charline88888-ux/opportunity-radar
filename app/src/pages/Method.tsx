import { useMemo } from 'react'
import { ArrowUpRight, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Panel } from '@/components/ui'
import { Chart } from '@/components/charts/Chart'
import { paybackCurveOption, unitEconomicsOption } from '@/components/charts/econ-options'
import { buildCandidateAssessment } from '@/lib/assessment'
import { candidates } from '@/lib/candidates'
import { recompute } from '@/lib/economics'
import { useI18n } from '@/lib/i18n'
import { fmtCnyRange, fmtPct } from '@/lib/utils'

const DIMENSIONS = [
  { zh: '信号强度', en: 'Signal strength', sourceZh: '公开讨论量、来源数量、证据等级', sourceEn: 'Public discussion volume, source count, evidence tier', ruleZh: '多来源独立出现、有具体数字/实体/时间', ruleEn: 'Independent sources with concrete numbers, entities and dates', missZh: '把营销稿/单一搬运当成趋势', missEn: 'Mistaking a press release or single repost for a trend' },
  { zh: '信息差窗口', en: 'Information gap', sourceZh: '区域/监管/价格/平台规则差异', sourceEn: 'Regional, regulatory, pricing or platform-rule differences', ruleZh: '同一需求在两地存在可获得性/价格/合规差', ruleEn: 'Same need has availability, price or compliance differences across markets', missZh: '把普通新鲜感当结构性机会', missEn: 'Treating novelty as a structural opportunity' },
  { zh: '个人可执行性', en: 'Feasibility', sourceZh: '启动资金、技能、供应链、交付链路', sourceEn: 'Capital, skills, supply chain, delivery path', ruleZh: '个人/小团队 0–90 天能跑通最小闭环', ruleEn: 'A person or small team can run the minimal loop in 0–90 days', missZh: '低估合规、售后与跨境物流', missEn: 'Underestimating compliance, after-sales and cross-border logistics' },
  { zh: '回报空间', en: 'Economics', sourceZh: '客单价、单量、毛利、固定成本、回本', sourceEn: 'AOV, volume, margin, fixed cost, payback', ruleZh: '月毛利覆盖关键成本，理论回本 ≤ 12 个月', ruleEn: 'Monthly gross profit covers key costs; theoretical payback ≤ 12 months', missZh: '只看收入不看退货/平台费/固定成本', missEn: 'Looking at revenue without returns, platform fees or fixed cost' },
  { zh: '时机窗口', en: 'Timing', sourceZh: '首次出现时间、催化剂、同类供给数量', sourceEn: 'First-seen date, catalysts, number of competing suppliers', ruleZh: '需求刚出现/规则刚变化，供给尚未拥挤', ruleEn: 'Demand or rules just changed and supply is not crowded', missZh: '把已经拥挤的赛道当早期', missEn: 'Mistaking a crowded category for an early window' },
  { zh: '竞争与壁垒', en: 'Competition', sourceZh: '直接/间接竞品、替代方案、平台在售', sourceEn: 'Direct/indirect competitors, alternatives, live listings', ruleZh: '存在可切入的差异化空位，而非正面价格战', ruleEn: 'A defensible differentiation gap exists, not a head-on price war', missZh: '把“没人做”误判为没需求', missEn: 'Treating “nobody does it” as no demand' },
  { zh: '风险可控性', en: 'Risk', sourceZh: '监管、合规、现金流、交付与售后', sourceEn: 'Regulation, compliance, cash flow, delivery and after-sales', ruleZh: '主要风险可被合同/流程/保险/小步投入控制', ruleEn: 'Key risks can be controlled by contracts, process, insurance or staged spend', missZh: '忽略跨境税务、知识产权与退货', missEn: 'Ignoring cross-border tax, IP and returns' },
  { zh: '人群适配度', en: 'Fit', sourceZh: '个人技能、资源、语言、时间与偏好', sourceEn: 'Skills, resources, languages, time and preferences', ruleZh: '与执行者现有能力/资源形成组合优势', ruleEn: 'Combines with the operator’s existing skills/resources', missZh: '只看机会大小不看自己能不能做', missEn: 'Judging only market size, not personal execution' },
  { zh: '证据可信度', en: 'Evidence', sourceZh: '来源等级、证据数量、独立性', sourceEn: 'Source tier, evidence count, independence', ruleZh: '至少 2 个独立来源，含一手/平台在售证据', ruleEn: 'At least two independent sources, including first-party or live marketplace evidence', missZh: '把转载当独立来源', missEn: 'Counting reposts as independent sources' },
  { zh: '杠杆放大', en: 'Leverage', sourceZh: '内容、供应链、渠道、数据能否复用', sourceEn: 'Reusable content, supply chain, channels or data', ruleZh: '一次投入可在多市场/多渠道复用', ruleEn: 'One investment can be reused across markets/channels', missZh: '把一次性定制当可规模化产品', missEn: 'Treating one-off custom work as scalable product' },
]

const BRIEF_SECTIONS = [
  { zh: '经济性驾驶舱', en: 'Economics cockpit', descZh: '启动资金 9 类拆项（min/max + 依据）、单位经济、收入结构、回本曲线、月收入利润、单量敏感性；滑杆可实时重算。', descEn: 'Nine capital items (min/max + basis), unit economics, revenue mix, payback curve, monthly revenue/profit and order sensitivity; sliders recompute live.' },
  { zh: '核心判断', en: 'Core thesis', descZh: '结论先行：机会逻辑、市场缺口、失效边界与主要风险。', descEn: 'Conclusion first: logic, market gap, falsification boundary and key risks.' },
  { zh: '10 维判断', en: '10 dimensions', descZh: '雷达看结构，逐维给出分数、判断理由与本条使用的数据。', descEn: 'Radar shows structure; each dimension lists score, rationale and data used.' },
  { zh: '商业画布', en: 'Business canvas', descZh: '9 格：客户是谁、卖什么、怎么触达、靠什么交付、钱怎么进怎么出。', descEn: 'Nine blocks: who the customer is, what is sold, how it is reached, what delivers it and how money flows.' },
  { zh: '竞争与跨市场', en: 'Competition & cross-market', descZh: '直接/间接竞品、替代方案、差异化、护城河，以及迁移市场与本地化成本。', descEn: 'Direct/indirect competitors, substitutes, differentiation, moat, plus target markets and localization cost.' },
  { zh: '时机与执行', en: 'Timing & execution', descZh: '窗口阶段、催化剂、进入门槛、0–30/30–90/90+ 天执行动作与首笔收入路径。', descEn: 'Window stage, catalysts, entry barriers, 0–30/30–90/90+ day actions and first-revenue path.' },
  { zh: '来源与证据', en: 'Sources & evidence', descZh: '每条结论可回溯公开来源；自动发现候选未做人工核验，使用前复核。', descEn: 'Every conclusion traces to a public source; auto candidates are not manually verified—verify before acting.' },
]

export default function Method() {
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const sample = useMemo(() => {
    const candidate = candidates.find((c) => c.candidate_id === 'cand-5c555f56997d') || candidates[0]
    return candidate ? buildCandidateAssessment(candidate) : null
  }, [])
  const calc = useMemo(() => {
    if (!sample) return null
    const model = sample.economics
    return recompute(model, {
      aov: model.base.aov,
      orders: model.base.orders,
      marginPct: model.base.marginPct,
      fixedCost: model.base.fixedCost,
    })
  }, [sample])

  return (
    <div>
      <PageHeader
        index="04"
        kicker={L('METHOD · 方法论', 'METHOD')}
        title={L('商机评估方法：10 维判断 + 图表化投资回报测算', 'Opportunity evaluation: 10 dimensions + chart-driven investment & return model')}
        description={L('商机不是“看起来新”，而是需求、信息差、可行性、经济性、时机、竞争、风险、匹配、证据、杠杆同时成立。自动候选与精选机会使用同一套评估详情：结论先行、经济性图表化、口径可复算。', 'An opportunity is not merely something new: demand, gap, feasibility, economics, timing, competition, risk, fit, evidence and leverage must hold together. Auto candidates and curated opportunities share one assessment: conclusion first, charted economics and reproducible formulas.')}
        actions={<Badge tone="cyan">{L('10 维评分 · 理论测算口径', '10 dimensions · theoretical model')}</Badge>}
      />

      <Panel className="mb-4 p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="mono-label">{L('01 · 10 维怎么判断', '01 · How the 10 dimensions are judged')}</div>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-ink">{L('每个维度看什么数据、判断标准与常见误判', 'Data, criteria and common misjudgments per dimension')}</h2>
          </div>
          <div className="text-[12.5px] text-dim">{L('权重合计 100% · 总分 = Σ(维度分 × 权重) × 10', 'Weights sum to 100% · total = Σ(score × weight) × 10')}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line/60 text-[12px] text-dim">
                <th className="py-2 pr-3 font-normal">{L('维度', 'Dimension')}</th>
                <th className="py-2 pr-3 font-normal">{L('数据来源', 'Data source')}</th>
                <th className="py-2 pr-3 font-normal">{L('判断标准', 'Criteria')}</th>
                <th className="py-2 font-normal">{L('常见误判', 'Common misjudgment')}</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSIONS.map((d) => (
                <tr key={d.en} className="border-b border-line/30 align-top">
                  <td className="w-[110px] py-2.5 pr-3 text-[13.5px] text-ink">{L(d.zh, d.en)}</td>
                  <td className="py-2.5 pr-3 text-[13px] leading-[1.65] text-muted">{L(d.sourceZh, d.sourceEn)}</td>
                  <td className="py-2.5 pr-3 text-[13px] leading-[1.65] text-muted">{L(d.ruleZh, d.ruleEn)}</td>
                  <td className="py-2.5 text-[13px] leading-[1.65] text-amber/85">{L(d.missZh, d.missEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[12px] text-dim">{L('等级：S ≥85 · A 75–84.9 · B 65–74.9 · C 55–64.9 · D <55；商机榜按总分降序。', 'Grades: S ≥85 · A 75–84.9 · B 65–74.9 · C 55–64.9 · D <55; the board sorts by total score.')}</div>
      </Panel>

      <Panel className="mb-4 p-5">
        <div className="mono-label">{L('02 · 评估说明书结构', '02 · Structure of the assessment brief')}</div>
        <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-ink">{L('详情页 7 个板块，自动候选与精选机会一致', 'Seven blocks, identical for auto and curated')}</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {BRIEF_SECTIONS.map((s, i) => (
            <div key={s.en} className="rounded-lg border border-line/60 bg-panel-2/25 p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-signal">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[15px] font-semibold text-ink">{L(s.zh, s.en)}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.7] text-muted">{L(s.descZh, s.descEn)}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mb-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="mono-label">{L('03 · 投资与回报怎么算', '03 · How investment & return are modelled')}</div>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-ink">{L('真实字段为锚，公式可复算；理论测算，非实盘验证', 'Real fields as anchors, reproducible formulas; theoretical, not live-tested')}</h2>
          </div>
          <Badge tone="amber">{L('理论测算 · 非实盘验证', 'Theoretical · not live-tested')}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <div className="rounded-lg border border-line/60 bg-panel-2/25 p-4 text-[13px] leading-[1.9] text-muted">
              <div className="mb-1 text-[13.5px] font-medium text-ink">{L('核心公式', 'Core formulas')}</div>
              <div>
                {L('单品毛利', 'Unit gross profit')} = {L('客单价', 'AOV')} − {L('单位成本', 'unit cost')}
              </div>
              <div>
                {L('月收入', 'Monthly revenue')} = {L('客单价', 'AOV')} × {L('月单量', 'monthly orders')}
              </div>
              <div>
                {L('月净利', 'Monthly net profit')} = {L('月收入', 'revenue')} × {L('毛利率', 'margin')} − {L('月固定成本', 'fixed cost')}
              </div>
              <div>
                {L('理论回本', 'Theoretical payback')} = {L('启动资金', 'startup capital')} ÷ {L('月净利', 'monthly net profit')}
              </div>
              <div>
                {L('盈亏平衡单量', 'Break-even orders')} = {L('月固定成本', 'fixed cost')} ÷ ({L('客单价', 'AOV')} × {L('毛利率', 'margin')})
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-amber/25 bg-amber/[0.05] px-4 py-3 text-[12.5px] leading-[1.75] text-amber">
              <ShieldAlert className="mr-1.5 inline h-4 w-4" />
              {L('启动资金拆分为 9 类：注册/合规、首批库存/样品、平台/渠道、物流仓储、工具/软件、市场推广、人力、流动资金、预备金；金额为理论 min–max 与依据，合计与 ROI 启动资金一致。','Startup capital is split into nine items: registration/compliance, first inventory/samples, platform/channels, logistics, tools/software, marketing, labor, working capital and contingency; amounts are theoretical min–max with basis, totalling ROI startup capital.')}
            </div>
            <a href="#/rankings" className="mt-3 inline-flex items-center gap-1 text-[13px] text-signal hover:underline">
              {L('去商机榜看真实卡片与详情', 'Open the board to see live cards and details')} <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          {sample && calc ? (
            <div className="xl:col-span-8">
              <div className="rounded-lg border border-line/60 bg-panel-2/20 p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-dim">
                  <span>
                    {L('示例', 'Example')}：{sample.title}
                  </span>
                  <span>
                    {L('启动资金', 'Capital')} {fmtCnyRange(sample.economics.investment.total.min, sample.economics.investment.total.max)} · {L('毛利率', 'margin')} {fmtPct(sample.economics.base.marginPct * 100, 1)} · {L('回本目标', 'payback target')} {sample.economics.paybackTarget ?? '—'} {L('个月', 'mo')}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[12px] text-muted">{L('单位经济（示例）', 'Unit economics (example)')}</div>
                    <Chart option={unitEconomicsOption(sample.economics, calc, lang)} height={270} />
                  </div>
                  <div>
                    <div className="mb-1 text-[12px] text-muted">{L('回本曲线（示例）', 'Payback curve (example)')}</div>
                    <Chart option={paybackCurveOption(sample.economics, calc, false, lang)} height={270} />
                  </div>
                </div>
              </div>
              <div className="mt-2 rounded-lg border border-line/60 bg-panel-2/25 px-4 py-3 text-[12px] leading-[1.7] text-dim">
                {L('数据字段：roi / investment_breakdown / unit_economics / profit_model。字段之间冲突时以手工整理的 ROI 为锚做透明校准；任何估算都标为理论测算，并在详情页展示数据锚点与公式。', 'Data fields: roi / investment_breakdown / unit_economics / profit_model. When fields conflict, the hand-curated ROI is used as an anchor with transparent calibration; every estimate is labelled theoretical and shows anchors and formulas in the detail.')}
              </div>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel className="mb-4 p-5">
        <div className="mono-label">{L('04 · 商机分析（v1.7.0）', '04 · Opportunity analysis (v1.7.0)')}</div>
        <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-ink">{L('单轴强机会与因果链：补充判断，不是门禁', 'Single-axis signal and causal chain: extra judgment, not a gate')}</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            {
              zh: '论点 + 主导驱动 + 因果链：把「事实 → 变化 → 受影响主体 → 缺口 → 切入点」逐段写清，方便复核。',
              en: 'Thesis, dominant drivers and causal chain: fact → change → affected parties → gap → entry point, step by step for review.',
            },
            {
              zh: '商业结构 5 项 + 强项/弱项/未知 + 证伪条件：弱项只做标注，用于行动前检查，不参与候选过滤/排序。',
              en: 'Five commercial-structure items, strengths/weaknesses/unknowns and falsifiers: weaknesses are annotated for pre-action checks, never filtering or ranking candidates.',
            },
            {
              zh: '分析评分（analysis_score）与 10 维评分并列展示，便于对照；主导型机会以「单一主导驱动强」标注。',
              en: 'Analysis score is shown next to the 10-dimension score for comparison; single-axis opportunities are marked when one dominant driver is strong.',
            },
          ].map((item) => (
            <div key={item.en} className="rounded-lg border border-line/60 bg-panel-2/25 px-4 py-3 text-[13px] leading-[1.75] text-muted">
              {L(item.zh, item.en)}
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-amber/30 bg-amber/[0.06] px-4 py-2.5 text-[12.5px] leading-[1.75] text-amber">
          {L('分析 ≠ 门禁：弱项只标注，不参与过滤/排序；分析为理论判断，不构成收入承诺。精选机会无分析字段时，详情页不显示该区块。', 'Analysis ≠ gate: weaknesses are annotated only and never filter or rank; analysis is theoretical and not a revenue promise. Curated opportunities without analysis fields simply hide this block.')}
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="mono-label mb-2">{L('边界', 'Boundary')}</div>
        <div className="text-[13px] leading-[1.8] text-muted">
          {L('所有内容均为公开信息自动生成与系统评估，不构成投资建议；经济数据为理论测算，非实盘验证；商机最终是否适合你，由你按自身资源、风险与真实市场成交判断。', 'All content is auto-generated and system-assessed from public information; it is not investment advice. Economic figures are theoretical, not live-tested. Whether an opportunity suits you is your call based on your resources, risk and real market transactions.')}
        </div>
      </Panel>
    </div>
  )
}
