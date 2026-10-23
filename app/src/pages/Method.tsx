import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import {
  BookOpenCheck,
  Braces,
  Clock3,
  Globe2,
  Info,
  Layers3,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
  Zap,
} from 'lucide-react'
import { Chart } from '@/components/charts/Chart'
import { PageHeader } from '@/components/PageHeader'
import { Badge, GradeBadge, InfoTip, Panel, ProgressBar, SectionCard, Slider } from '@/components/ui'
import {
  gapHalfLife,
  gapName,
  industryColor,
  industryName,
  opportunities,
  stats,
  taxonomy,
} from '@/lib/data'
import { decayCurve, normalizeWeights, rankByWeights, weightsChanged, defaultWeights } from '@/lib/score'
import {
  cn,
  fmtInt,
  fmtScore,
  gradeColor,
  HOFSTEDE_COUNTRIES,
  HOFSTEDE_DIMENSIONS,
} from '@/lib/utils'

const SEVEN_Q = [
  {
    no: 'Q1',
    title: '流量怎么来',
    structure: '具体渠道 + 内容形式 + 前 100 个客户从哪来',
    where: '平台搜索下拉词、同类内容评论区、竞品投放素材、社群求助帖',
    criteria: '能写出 30 天内可执行的前 3 个获客动作，且成本可估算',
  },
  {
    no: 'Q2',
    title: '赚什么钱',
    structure: '售卖实物 / 服务 / 信息 / 订阅 / 佣金 / 广告，各自占比与客单',
    where: '竞品定价页、平台成交记录、用户访谈、供应链报价',
    criteria: '至少一个收入项有可验证的客单与毛利结构',
  },
  {
    no: 'Q3',
    title: '商业模式形态',
    structure: '一句模式 + 价值链条 + 交付方式',
    where: '同类公司官网/招股书、行业报告、从业者访谈',
    criteria: '能画出一条从供给到交付的最小闭环，不依赖未验证合作',
  },
  {
    no: 'Q4',
    title: '投入回报与周期',
    structure: '启动资金、回本周期、月收入区间、毛利、现金流特征',
    where: '供应商报价、跨境物流报价、同类卖家访谈、平台费率',
    criteria: '给出悲观/中性/乐观三档，并明确盈亏平衡点',
  },
  {
    no: 'Q5',
    title: '适合人群',
    structure: '什么资源/技能/语言/身份的人做最合适，不适合谁',
    where: '从业者背景、招聘JD、社群成员画像、自己能力向量',
    criteria: '能说清「为什么是我」以及「谁做会失败」',
  },
  {
    no: 'Q6',
    title: '驱动类型',
    structure: '资本 / 技术 / 信息 / 跨国 / 政策 / 运营 / 供应链 驱动',
    where: '融资新闻、专利与论文、法规变更、平台规则、供应链价格',
    criteria: '主驱动因子可被验证，并决定窗口衰减速度',
  },
  {
    no: 'Q7',
    title: '壁垒是什么',
    structure: '壁垒类型 + 需要什么前置条件；没有壁垒要如实说「窗口期套利」',
    where: '供应链关系、资质牌照、数据资产、品牌与内容、社群信任',
    criteria: '能列出至少一种可积累的资产；否则明确是短期窗口',
  },
]

const NEURO_COLORS = ['#3ddc97', '#4cc9f0', '#ffb547', '#ff5d5d', '#a78bfa', '#f472b6']

export default function Method() {
  const [weights, setWeights] = useState<Record<string, number>>(defaultWeights())
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['cn', 'us', 'de', 'jp', 'sa', 'br'])
  const normalized = useMemo(() => normalizeWeights(weights), [weights])
  const ranked = useMemo(() => rankByWeights(weights), [weights])
  const baseRanked = useMemo(() => rankByWeights(defaultWeights()), [])
  const baseRankMap = useMemo(() => new Map(baseRanked.map((r) => [r.opp.id, r.rank])), [baseRanked])
  const top10 = ranked.slice(0, 10)
  const changed = weightsChanged(weights)

  const top10Option = useMemo<EChartsOption>(() => ({
    grid: { left: 4, right: 40, top: 6, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: any) => {
        const row = top10[p[0].dataIndex]
        if (!row) return ''
        return `<b>#${row.rank} ${row.opp.title}</b><br/>自定义总分：<b>${fmtScore(row.total)}</b><br/>行业：${industryName(row.opp.industry_id)}`
      },
    },
    xAxis: { type: 'value', min: 40, max: 100, axisLabel: { fontSize: 9 } },
    yAxis: {
      type: 'category',
      inverse: true,
      data: top10.map((r) => r.opp.title.length > 16 ? `${r.opp.title.slice(0, 16)}…` : r.opp.title),
      axisLabel: { fontSize: 9.5, color: '#8b93a7', width: 150, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        data: top10.map((r) => ({
          value: r.total,
          itemStyle: { color: gradeColor(r.grade), opacity: 0.82, borderRadius: [0, 2, 2, 0] },
        })),
        barMaxWidth: 13,
        label: { show: true, position: 'right', color: '#8b93a7', fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, formatter: (p: any) => fmtScore(p.value) },
      },
    ],
  }), [top10])

  const neuroOption = useMemo<EChartsOption>(() => {
    const needs = taxonomy.human_needs
    const neuros = taxonomy.neuro_drivers
    const counts = new Map<string, number>()
    needs.forEach((n) => {
      (n.neuro_drivers || []).forEach((nd) => counts.set(`${n.id}|${nd}`, (counts.get(`${n.id}|${nd}`) || 0) + 2))
    })
    for (const o of opportunities) {
      for (const need of o.human_need_ids) {
        for (const nd of o.neuro_drivers) {
          const k = `${need}|${nd}`
          counts.set(k, (counts.get(k) || 0) + 1)
        }
      }
    }
    const cells: Array<[number, number, number]> = []
    let max = 1
    neuros.forEach((nd, ni) => {
      needs.forEach((need, needI) => {
        const v = counts.get(`${need.id}|${nd.id}`) || 0
        max = Math.max(max, v)
        cells.push([needI, ni, v])
      })
    })
    return {
      grid: { left: 6, right: 8, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        formatter: (p: any) => {
          const need = needs[p.value[0]]
          const nd = neuros[p.value[1]]
          return `<b>${nd?.name || ''} × ${need?.name || ''}</b><br/>亲和度：<b>${p.value[2]}</b><br/><span style="color:#8b93a7">${nd?.theme || ''}<br/>触发器：${(nd?.triggers || []).join('、')}</span>`
        },
      },
      xAxis: { type: 'category', data: needs.map((n) => n.name), axisLabel: { fontSize: 9, interval: 0, rotate: 30 } },
      yAxis: { type: 'category', data: neuros.map((n) => `${n.name}`), axisLabel: { fontSize: 9.5 } },
      visualMap: { show: false, min: 0, max, inRange: { color: ['#131821', '#1d4f41', '#2b9c76', '#3ddc97'] } },
      series: [
        {
          type: 'heatmap',
          data: cells,
          label: { show: true, fontSize: 9, color: '#c8cfdb', formatter: (p: any) => (p.value[2] ? p.value[2] : '') },
          itemStyle: { borderColor: '#0a0c10', borderWidth: 1 },
        },
      ],
    }
  }, [])

  const decayOption = useMemo<EChartsOption>(() => ({
    grid: { left: 4, right: 10, top: 30, bottom: 4, containLabel: true },
    legend: { top: 0, right: 0, textStyle: { fontSize: 9.5 } },
    tooltip: { trigger: 'axis', formatter: (p: any) => `第 ${p[0].axisValue} 个月<br/>${p.map((x: any) => `${x.marker}${x.seriesName}：<b>${x.value}%</b>`).join('<br/>')}` },
    xAxis: { type: 'category', data: decayCurve(36, 36).map((d) => d.month), axisLabel: { fontSize: 9, interval: 5 } },
    yAxis: { type: 'value', max: 100, axisLabel: { fontSize: 9, formatter: '{value}%' } },
    series: [
      { name: '平台规则差 6M', type: 'line', symbol: 'none', smooth: true, data: decayCurve(6, 36).map((d) => d.value), lineStyle: { color: '#ff5d5d', width: 1.5 } },
      { name: '情绪差 18M', type: 'line', symbol: 'none', smooth: true, data: decayCurve(18, 36).map((d) => d.value), lineStyle: { color: '#ffb547', width: 1.5 } },
      {
        name: '文化差 36M', type: 'line', symbol: 'none', smooth: true, data: decayCurve(36, 36).map((d) => d.value),
        lineStyle: { color: '#3ddc97', width: 1.7 },
        areaStyle: { color: 'rgba(61,220,151,.06)' },
        markLine: { silent: true, symbol: 'none', label: { fontSize: 9, color: '#8b93a7', formatter: '半衰期 50%' }, lineStyle: { color: '#39424f', type: 'dashed' }, data: [{ yAxis: 50 }] },
      },
    ],
  }), [])

  const hofstedeOption = useMemo<EChartsOption>(() => {
    const selected = HOFSTEDE_COUNTRIES.filter((c) => selectedCountries.includes(c.id))
    return {
      color: ['#3ddc97', '#4cc9f0', '#ffb547', '#ff5d5d', '#a78bfa', '#f472b6', '#84cc16', '#60a5fa'],
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { fontSize: 9.5 } },
      radar: {
        center: ['50%', '44%'],
        radius: '54%',
        splitNumber: 5,
        indicator: HOFSTEDE_DIMENSIONS.map((d) => ({ name: d, max: 100 })),
        axisName: { fontSize: 9.5 },
      },
      series: [
        {
          type: 'radar',
          symbolSize: 2.5,
          data: selected.map((c) => ({
            name: c.name,
            value: c.values,
            lineStyle: { width: 1.3 },
            areaStyle: { opacity: 0.04 },
          })),
        },
      ],
    }
  }, [selectedCountries])

  const maxHalfLife = Math.max(...taxonomy.gap_types.map((g) => gapHalfLife(g.id)), 1)

  return (
    <div>
      <PageHeader
        index="05"
        kicker="METHOD · 方法论"
        title="方法论 · 评分模型与商业驱动框架"
        description="10 维评分权重可拖动实时重排 Top10；七问框架、6 神经递质 × 12 需求矩阵、12 类信息差、Hofstede 文化维度与窗口衰减模型，共同构成扫描的判断标准。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="amber"><SlidersHorizontal className="h-3 w-3" /> 交互演示</Badge>
            <Badge tone="neutral">公式与 docs/12 §4.5 一致</Badge>
          </div>
        }
      />

      <SectionCard
        eyebrow="SCORING LAB"
        title="评分模型实验室 · 权重滑杆实时重排 Top10"
        subtitle="拖动 10 个维度权重：归一化后按 total = round(Σ(维度分 × 权重) × 10, 1) 重算全部机会，并实时刷新 Top10 榜单与柱状图（演示，不写回 data/）。"
        right={
          <div className="flex items-center gap-2">
            {changed ? <Badge tone="amber"><Sparkles className="h-3 w-3" /> 自定义权重</Badge> : <Badge tone="signal">契约权重</Badge>}
            <button onClick={() => setWeights(defaultWeights())} className="inline-flex h-6 items-center gap-1 rounded border border-line px-2 text-[10.5px] text-muted hover:border-line-strong hover:text-ink">
              <RotateCcw className="h-3 w-3" /> 重置
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-dim">
              <span>维度 / 默认权重</span>
              <span>当前占比</span>
            </div>
            <div className="space-y-[7px]">
              {taxonomy.score_dimensions.map((d) => (
                <div key={d.id} className="grid grid-cols-[108px_1fr_42px] items-center gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[10.5px] text-muted">{d.name}</span>
                      <InfoTip content={<span><b>{d.name}</b><br/>{d.desc}<br/>默认权重 {(d.weight * 100).toFixed(0)}%</span>}>
                        <Info className="h-2.5 w-2.5 shrink-0 cursor-help text-dim" />
                      </InfoTip>
                    </div>
                    <div className="num text-[9px] text-dim">默认 {(d.weight * 100).toFixed(0)}%</div>
                  </div>
                  <Slider
                    value={weights[d.id] ?? d.weight}
                    min={0}
                    max={0.3}
                    step={0.005}
                    label={d.name}
                    onValueChange={(v) => setWeights((prev) => ({ ...prev, [d.id]: v }))}
                  />
                  <span className="num text-right text-[10.5px] text-muted">{((normalized[d.id] || 0) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded border border-line/70 bg-black/20 p-2 font-mono text-[9.5px] leading-relaxed text-dim">
              <div>total = round(Σ(dimension_i × weight_i) × 10, 1)</div>
              <div>rank_score = min(100, total × (1 + 0.12 × (momentum − 1)))</div>
              <div className="mt-1 text-muted">等级：S≥85 · A≥75 · B≥65 · C≥55 · D&lt;55 不入榜</div>
            </div>
          </div>
          <div className="lg:col-span-7">
            <Chart option={top10Option} height={300} />
            <div className="mt-2 overflow-hidden rounded border border-line/70">
              <table className="table-dense">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>机会</th>
                    <th className="w-28">行业</th>
                    <th className="w-16 text-right">自定义分</th>
                    <th className="w-20 text-right">较默认</th>
                  </tr>
                </thead>
                <tbody>
                  {top10.map((r) => {
                    const baseRank = baseRankMap.get(r.opp.id) || r.rank
                    const diff = baseRank - r.rank
                    return (
                      <tr key={r.opp.id}>
                        <td><span className={cn('num text-[12px]', r.rank <= 3 ? 'text-amber' : 'text-muted')}>{String(r.rank).padStart(2, '0')}</span></td>
                        <td>
                          <Link to={`/opportunities/${r.opp.id}`} className="block max-w-[300px] truncate text-[11px] text-ink hover:text-signal">
                            {r.opp.title}
                          </Link>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                            <span className="h-1.5 w-1.5 rounded-sm" style={{ background: industryColor(r.opp.industry_id) }} />
                            {industryName(r.opp.industry_id)}
                          </span>
                        </td>
                        <td className="num text-right text-[11.5px]" style={{ color: gradeColor(r.grade) }}>{fmtScore(r.total)}</td>
                        <td className="text-right">
                          {diff > 0 ? <span className="font-mono text-[10px] text-signal">▲ {diff}</span> : diff < 0 ? <span className="font-mono text-[10px] text-danger">▼ {Math.abs(diff)}</span> : <span className="font-mono text-[10px] text-dim">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-1 font-mono text-[9px] text-dim">「较默认」= 默认契约权重下的排名 − 当前排名；正数为上升。</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        className="mt-3"
        eyebrow="SEVEN QUESTIONS"
        title="商业驱动七问框架"
        subtitle="每一问都必须有可执行、可验证的答案；禁止「待补充」「看情况」。"
        right={<BookOpenCheck className="h-4 w-4 text-dim" />}
      >
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {SEVEN_Q.map((q) => (
            <Panel key={q.no} className="flex flex-col p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-signal">{q.no}</span>
                <span className="text-[12px] font-medium text-ink">{q.title}</span>
              </div>
              <div className="mt-1.5 space-y-1.5">
                <div>
                  <div className="mono-label !text-[8.5px]">必答结构</div>
                  <div className="text-[10.5px] leading-relaxed text-muted">{q.structure}</div>
                </div>
                <div>
                  <div className="mono-label !text-[8.5px]">信息从哪查</div>
                  <div className="text-[10px] leading-relaxed text-dim">{q.where}</div>
                </div>
                <div>
                  <div className="mono-label !text-[8.5px]">判断标准</div>
                  <div className="text-[10px] leading-relaxed text-signal/80">{q.criteria}</div>
                </div>
              </div>
            </Panel>
          ))}
          <Panel className="flex flex-col justify-between border-signal/30 bg-signal/[0.04] p-2.5">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-signal">
                <Target className="h-3.5 w-3.5" /> 使用方式
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
                机会详情页逐条展示七问答案；任何一问含糊，就降级为「观察」，不进入 7 天验证。七问与 10 维评分互为校验：七问答不清的机会，评分通常也上不去。
              </p>
            </div>
            <Link to="/rankings" className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-signal hover:underline">去榜单随机抽一条演练 →</Link>
          </Panel>
        </div>
      </SectionCard>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <SectionCard
          className="xl:col-span-7"
          eyebrow="NEURO × NEED"
          title="6 神经递质 × 12 人性需求矩阵"
          subtitle="数字 = 机会库中该组合的命中数 + 分类学预设亲和度；用于判断「为什么用户会买」"
          right={<Zap className="h-4 w-4 text-dim" />}
        >
          <Chart option={neuroOption} height={268} />
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-3">
            {taxonomy.neuro_drivers.map((n, i) => (
              <div key={n.id} className="flex items-start gap-1.5 text-[9.5px] leading-snug text-dim">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: NEURO_COLORS[i % NEURO_COLORS.length] }} />
                <span><span className="text-muted">{n.name}</span>：{n.theme}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          className="xl:col-span-5"
          eyebrow="WINDOW DECAY"
          title="窗口衰减曲线"
          subtitle="按半衰期指数衰减：价值(t) = 0.5^(t / 半衰期) × 100%"
          right={<TrendingDown className="h-4 w-4 text-dim" />}
        >
          <Chart option={decayOption} height={252} />
          <div className="mt-1.5 max-h-[112px] overflow-auto rounded border border-line/60">
            <table className="table-dense">
              <thead><tr><th>信息差类型</th><th className="w-20 text-right">半衰期</th><th className="w-28">衰减</th></tr></thead>
              <tbody>
                {taxonomy.gap_types.map((g) => (
                  <tr key={g.id}>
                    <td className="text-[10px] text-muted">{g.name}</td>
                    <td className="num text-right text-[10px] text-dim">{gapHalfLife(g.id)}M</td>
                    <td><ProgressBar value={gapHalfLife(g.id)} max={maxHalfLife} tone="amber" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        className="mt-3"
        eyebrow="12 GAP TYPES"
        title="12 类信息差类型"
        subtitle="机会的本质是「有人还不知道」；半衰期越短，越要快验证、快退出"
        right={<Layers3 className="h-4 w-4 text-dim" />}
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {taxonomy.gap_types.map((g) => {
            const count = stats.by_gap_type?.find((b) => b.id === g.id)?.count || 0
            return (
              <Panel key={g.id} className="panel-hover p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-ink">{g.name}</span>
                  <Badge tone={gapHalfLife(g.id) <= 9 ? 'danger' : gapHalfLife(g.id) <= 18 ? 'amber' : 'signal'}>
                    <Clock3 className="h-2.5 w-2.5" /> {gapHalfLife(g.id)}M
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 min-h-[28px] text-[10.5px] leading-relaxed text-dim">{g.desc}</p>
                <div className="mt-1.5 flex items-center justify-between font-mono text-[9.5px] text-dim">
                  <span>关联机会 <span className="text-muted">{count}</span></span>
                  <span>{g.id}</span>
                </div>
                <ProgressBar value={gapHalfLife(g.id)} max={maxHalfLife} className="mt-1" tone={gapHalfLife(g.id) <= 9 ? 'amber' : 'signal'} />
              </Panel>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        className="mt-3"
        eyebrow="HOFSTEDE"
        title="Hofstede 六维文化维度对比"
        subtitle="内置 8 国 × 6 维参考值（权力距离 / 个人主义 / 男性气质 / 不确定性规避 / 长期导向 / 放纵程度）；点击国家切换对比"
        right={<Globe2 className="h-4 w-4 text-dim" />}
      >
        <div className="mb-2 flex flex-wrap gap-1.5">
          {HOFSTEDE_COUNTRIES.map((c) => {
            const active = selectedCountries.includes(c.id)
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCountries((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                className={cn(
                  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                  active ? 'border-cyan/45 bg-cyan/10 text-cyan' : 'border-line text-dim hover:text-muted',
                )}
              >
                <span className="text-[8.5px] opacity-70">{c.flag}</span>
                {c.name}
              </button>
            )
          })}
          <button onClick={() => setSelectedCountries(['cn', 'us', 'de', 'jp', 'sa', 'br', 'in', 'ng'])} className="ml-auto inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] text-dim hover:text-muted">
            <RotateCcw className="h-2.5 w-2.5" /> 全选
          </button>        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Chart option={hofstedeOption} height={330} />
          </div>
          <div className="lg:col-span-5">
            <div className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-dim">COUNTRY SCORES / 参考值</div>
            <div className="overflow-x-auto rounded border border-line/70">
              <table className="table-dense min-w-[420px]">
                <thead>
                  <tr>
                    <th>国家</th>
                    {HOFSTEDE_DIMENSIONS.map((d) => <th key={d} className="text-right">{d.slice(0, 2)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {HOFSTEDE_COUNTRIES.map((c) => (
                    <tr key={c.id} className={cn(!selectedCountries.includes(c.id) && 'opacity-40')}>
                      <td className="text-[10.5px] text-muted">{c.name} <span className="font-mono text-[8.5px] text-dim">{c.flag}</span></td>
                      {c.values.map((v, i) => (
                        <td key={i} className="num text-right text-[10.5px] text-muted">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 rounded border border-line/60 bg-white/[0.015] px-2 py-1.5 text-[10px] leading-relaxed text-dim">
              <Info className="mr-1 inline h-3 w-3 text-cyan" />
              文化维度只作假设起点，不能机械套用。真实跨文化机会必须找本地人审校，尤其是宗教、家庭结构与支付习惯。
            </div>
            <div className="mt-2 flex items-center justify-between rounded border border-line/60 bg-black/20 px-2 py-1.5 text-[10px] text-dim">
              <span><Braces className="mr-1 inline h-3 w-3" /> 机会库中跨文化区域覆盖</span>
              <span className="num text-muted">{new Set(opportunities.flatMap((o) => o.region_ids)).size} / {taxonomy.regions.length}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Panel className="flex items-center gap-2 p-3">
          <Scale className="h-5 w-5 text-signal" />
          <div>
            <div className="mono-label">SCORE DIMENSIONS</div>
            <div className="text-[12px] text-muted">{taxonomy.score_dimensions.length} 个维度 · 权重合计 100%</div>
          </div>
        </Panel>
        <Panel className="flex items-center gap-2 p-3">
          <Layers3 className="h-5 w-5 text-cyan" />
          <div>
            <div className="mono-label">GAP TYPES</div>
            <div className="text-[12px] text-muted">{taxonomy.gap_types.length} 类信息差 · 半衰期 {Math.min(...taxonomy.gap_types.map((g) => gapHalfLife(g.id)))}–{maxHalfLife} 个月</div>
          </div>
        </Panel>
        <Panel className="flex items-center gap-2 p-3">
          <Sparkles className="h-5 w-5 text-amber" />
          <div>
            <div className="mono-label">GRADES</div>
            <div className="flex items-center gap-1.5 text-[12px] text-muted">{taxonomy.grades.map((g) => <GradeBadge key={g.id} grade={g.id} />)}</div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
