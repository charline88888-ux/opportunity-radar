/**
 * v1.5.0 经济性图表（ECharts option 构造器）
 * 所有图表均为真实数据驱动；颜色与 radar-dark 主题一致。
 */
import type { EChartsOption } from 'echarts'
import type { AssessmentDimension } from '@/lib/assessment'
import type { EconCalc, EconomicsModel } from '@/lib/economics'
import { unitEconomicsDisplay } from '@/lib/economics'
import { fmtCny, fmtCnyFull, fmtInt, fmtPct } from '@/lib/utils'
import type { Lang } from '@/lib/i18n'

const C = {
  signal: '#3ddc97',
  cyan: '#4cc9f0',
  amber: '#ffb547',
  danger: '#ff5d5d',
  violet: '#a78bfa',
  pink: '#f472b6',
  muted: '#8b93a7',
  dim: '#5a6273',
  line: '#2b3342',
  ink: '#e6e9f0',
}

const PALETTE = [C.cyan, C.signal, C.amber, C.violet, C.pink, '#60a5fa', '#84cc16', '#2dd4bf', '#f87171']

const L = (lang: Lang, zh: string, en: string) => (lang === 'en' ? en : zh)

const axisMoney = (lang: Lang) => ({
  type: 'value' as const,
  axisLabel: {
    color: C.dim,
    fontSize: 12,
    formatter: (v: number) => `¥${fmtCny(v)}`,
  },
  splitLine: { lineStyle: { color: 'rgba(35,41,54,.75)', type: 'dashed' as const } },
  axisLine: { show: false },
  axisTick: { show: false },
})

function tooltipBase() {
  return {
    backgroundColor: '#171b24',
    borderColor: '#2b3342',
    borderWidth: 1,
    padding: [8, 10] as [number, number],
    textStyle: { color: C.ink, fontSize: 12 },
    extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,.45);border-radius:6px;',
  }
}

/* ------------------------------------------------------------------ */
/* 1) 启动资金拆项：每项的 min–max 浮动区间（横向）                       */
/* ------------------------------------------------------------------ */

const SHORT_INVEST_LABEL: Record<string, { zh: string; en: string }> = {
  compliance: { zh: '合规', en: 'Compliance' },
  registration: { zh: '注册', en: 'Registration' },
  inventory: { zh: '库存/样品', en: 'Inventory' },
  channels: { zh: '平台/渠道', en: 'Channels' },
  platform: { zh: '平台/渠道', en: 'Channels' },
  logistics: { zh: '物流仓储', en: 'Logistics' },
  warehouse: { zh: '物流仓储', en: 'Logistics' },
  tools: { zh: '工具/软件', en: 'Tools' },
  software: { zh: '工具/软件', en: 'Tools' },
  marketing: { zh: '市场推广', en: 'Marketing' },
  labor: { zh: '人力', en: 'Labor' },
  hr: { zh: '人力', en: 'Labor' },
  working_capital: { zh: '流动资金', en: 'Working cap.' },
  reserve: { zh: '预备金', en: 'Reserve' },
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function capitalBreakdownOption(model: EconomicsModel, lang: Lang): EChartsOption {
  const items = [...model.investment.items].sort((a, b) => b.max - a.max)
  const categories = items.map((x) => {
    const short = SHORT_INVEST_LABEL[x.key]
    if (short) return lang === 'en' ? short.en : short.zh
    return lang === 'en' ? x.labelEn : x.labelZh
  })
  return {
    backgroundColor: 'transparent',
    grid: { left: 98, right: 92, top: 10, bottom: 32, containLabel: false },
    tooltip: {
      ...tooltipBase(),
      trigger: 'item',
      formatter: (p: unknown) => {
        const i = Number((p as { dataIndex?: number }).dataIndex ?? 0)
        const item = items[i]
        if (!item) return ''
        return [
          `<div style="font-weight:600;margin-bottom:4px">${lang === 'en' ? item.labelEn : item.labelZh}</div>`,
          `<div>${L(lang, '下限（实色）', 'Low (solid)')}：<b>${fmtCnyFull(item.min)}</b></div>`,
          `<div>${L(lang, '上限（浅色）', 'High (light)')}：<b>${fmtCnyFull(item.max)}</b></div>`,
          `<div style="color:${C.muted};margin-top:3px;max-width:260px;line-height:1.5">${L(lang, '依据', 'Basis')}：${item.basis}</div>`,
        ].join('')
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      axisLine: { show: true, lineStyle: { color: 'rgba(230,233,240,.45)', width: 1.5 } },
      axisTick: { show: true, lineStyle: { color: 'rgba(230,233,240,.35)' } },
      axisLabel: { color: C.dim, fontSize: 12, formatter: (v: number) => fmtCny(v) },
      splitLine: { show: true, lineStyle: { color: 'rgba(35,41,54,.7)', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: C.muted, fontSize: 12, width: 90, overflow: 'break', lineHeight: 15 },
      inverse: true,
    },
    series: [
      {
        name: L(lang, '下限（实色）', 'Low (solid)'),
        type: 'bar',
        stack: 'capital',
        barWidth: 14,
        data: items.map((x, i) => ({
          value: x.min,
          itemStyle: { color: PALETTE[i % PALETTE.length], borderRadius: [3, 0, 0, 3] },
        })),
      },
      {
        name: L(lang, '区间至上限（浅色）', 'Range to high (light)'),
        type: 'bar',
        stack: 'capital',
        barWidth: 14,
        data: items.map((x, i) => ({
          value: Math.max(0, x.max - x.min),
          itemStyle: { color: hexToRgba(PALETTE[i % PALETTE.length], 0.26), borderRadius: [0, 3, 3, 0] },
        })),
        label: {
          show: true,
          position: 'right',
          distance: 6,
          color: C.muted,
          fontSize: 12,
          formatter: (p: unknown) => {
            const i = Number((p as { dataIndex?: number }).dataIndex ?? 0)
            const item = items[i]
            if (!item) return ''
            return `${fmtCny(item.min)}–${fmtCny(item.max)}`
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(230,233,240,.45)', width: 1 },
          label: { show: true, position: 'end', color: C.muted, fontSize: 11, formatter: '0' },
          data: [{ xAxis: 0 }],
        },
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 2) 单位经济瀑布：客单价 → 成本 → 毛利 → 固定成本分摊 → 净贡献          */
/* ------------------------------------------------------------------ */

export function unitEconomicsOption(model: EconomicsModel, calc: EconCalc, lang: Lang): EChartsOption {
  const d = unitEconomicsDisplay(calc)
  const labels = [
    L(lang, '客单价', 'AOV'),
    L(lang, '商品/服务\n成本', 'Cost of\ngoods'),
    L(lang, '单品毛利', 'Unit\ngross'),
    L(lang, '固定成本\n分摊', 'Fixed\ncost'),
    L(lang, '单品净贡献', 'Unit net\ncontribution'),
  ]
  // 真瀑布：0→客单价，客单价→毛利（扣成本），0→毛利，毛利→净贡献（扣固定成本），0→净贡献
  const helper = [0, d.gross, 0, d.net, 0]
  const bars = [d.aov, d.cost, d.gross, d.fixed, d.net]
  const colors = [C.cyan, C.danger, C.signal, C.amber, d.net >= 0 ? C.signal : C.danger]
  const signs = ['+', '−', '=', '−', '=']
  const valueOf = (i: number) => [d.aov, d.cost, d.gross, d.fixed, d.net][i]
  const formulas = [
    `${L(lang, '客单价', 'AOV')} ${fmtCnyFull(d.aov)}`,
    `${fmtCnyFull(d.aov)} − ${fmtCnyFull(d.cost)} = ${fmtCnyFull(d.gross)}`,
    `${fmtCnyFull(d.aov)} − ${fmtCnyFull(d.cost)} = ${fmtCnyFull(d.gross)}`,
    `${fmtCnyFull(d.gross)} − ${fmtCnyFull(d.fixed)} = ${fmtCnyFull(d.net)}`,
    `${fmtCnyFull(d.gross)} − ${fmtCnyFull(d.fixed)} = ${fmtCnyFull(d.net)}`,
  ]
  // 累计连接线：上一步终点 → 下一步起点（虚线），保证瀑布可勾稽
  const connectors = [
    [{ coord: [0, d.aov] }, { coord: [1, d.aov] }],
    [{ coord: [1, d.gross] }, { coord: [2, d.gross] }],
    [{ coord: [2, d.gross] }, { coord: [3, d.gross] }],
    [{ coord: [3, d.net] }, { coord: [4, d.net] }],
  ]
  return {
    backgroundColor: 'transparent',
    grid: { left: 6, right: 14, top: 20, bottom: 40, containLabel: true },
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params : [params]
        const idx = Number((list[0] as { dataIndex?: number })?.dataIndex ?? 0)
        const label = labels[idx] || ''
        return [
          `<div style="font-weight:600;margin-bottom:3px">${label}</div>`,
          `<div style="font-size:13px">${signs[idx]}${fmtCnyFull(Math.abs(valueOf(idx)))}</div>`,
          `<div style="color:${C.muted};margin-top:3px">${formulas[idx]}</div>`,
        ].join('')
      },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { show: true, lineStyle: { color: 'rgba(230,233,240,.4)', width: 1.5 } },
      axisTick: { show: false },
      axisLabel: { color: C.muted, fontSize: 12, interval: 0, lineHeight: 16 },
    },
    yAxis: {
      ...axisMoney(lang),
      axisLine: { show: true, lineStyle: { color: 'rgba(230,233,240,.35)' } },
    },
    series: [
      {
        type: 'bar',
        stack: 'wf',
        silent: true,
        itemStyle: { color: 'transparent' },
        emphasis: { disabled: true },
        data: helper,
      },
      {
        type: 'bar',
        stack: 'wf',
        barMaxWidth: 42,
        data: bars.map((v, i) => ({
          value: v,
          itemStyle: { color: colors[i], borderRadius: i === 4 ? [3, 3, 0, 0] : [3, 3, 0, 0] },
        })),
        label: {
          show: true,
          position: 'top',
          color: C.ink,
          fontSize: 12,
          formatter: (p: unknown) => {
            const idx = Number((p as { dataIndex?: number }).dataIndex ?? 0)
            return `${signs[idx]}${fmtCny(Math.abs(valueOf(idx)))}`
          },
        },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          lineStyle: { color: 'rgba(139,147,167,.55)', type: 'dashed', width: 1 },
          label: { show: false },
          data: connectors as never,
        },
      },
    ],
  }
}
/* 3) 回本曲线：累计净现金流 vs 0                                          */
/* ------------------------------------------------------------------ */

export function paybackCurveOption(model: EconomicsModel, calc: EconCalc, useRamp: boolean, lang: Lang): EChartsOption {
  const points = useRamp ? calc.rampCurve : calc.steadyCurve
  const hit = points.find((p) => p.cumulative >= 0)
  const data = points.map((p) => [p.month, Math.round(p.cumulative)])
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 16, top: 22, bottom: 6, containLabel: true },
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params : [params]
        const idx = Number((list[0] as { dataIndex?: number })?.dataIndex ?? 0)
        const p = points[idx]
        if (!p) return ''
        return [
          `<div style="font-weight:600;margin-bottom:3px">${L(lang, '第', 'Month ')}${p.month}${L(lang, ' 个月', '')}</div>`,
          `<div>${L(lang, '累计现金流', 'Cumulative cash flow')}：<b style="color:${p.cumulative >= 0 ? C.signal : C.danger}">${fmtCnyFull(p.cumulative)}</b></div>`,
          `<div style="color:${C.muted};margin-top:2px">${L(lang, '当月净利', 'Net profit')}：${fmtCnyFull(p.netProfit)}</div>`,
        ].join('')
      },
    },
    xAxis: {
      type: 'value',
      min: 1,
      max: 18,
      interval: 3,
      axisLabel: { color: C.dim, fontSize: 12, formatter: (v: number) => `${v}${L(lang, '月', 'M')}` },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: C.line } },
      axisTick: { show: false },
    },
    yAxis: axisMoney(lang),
    series: [
      {
        type: 'line',
        smooth: 0.25,
        symbol: 'circle',
        symbolSize: 4,
        data,
        lineStyle: { width: 2.5, color: C.signal },
        itemStyle: { color: C.signal },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(61,220,151,.26)' },
              { offset: 1, color: 'rgba(61,220,151,.02)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: C.amber, type: 'dashed', width: 1 },
          label: { position: 'insideStartTop', color: C.amber, fontSize: 12, formatter: L(lang, '回本线', 'Break-even') },
          data: [{ yAxis: 0 }],
        },
        markPoint: hit
          ? {
              symbol: 'pin',
              symbolSize: 36,
              itemStyle: { color: C.amber },
              label: { color: '#10131a', fontSize: 12, fontWeight: 700, formatter: `${Math.round(hit.month)}M` },
              data: [{ name: 'payback', coord: [hit.month, Math.round(hit.cumulative)] }],
            }
          : undefined,
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 4) 月收入 / 毛利 / 净利（含爬坡）                                      */
/* ------------------------------------------------------------------ */

export function monthlyProfitOption(calc: EconCalc, lang: Lang): EChartsOption {
  const months = calc.monthly.map((p) => `${p.month}${L(lang, '月', 'M')}`)
  return {
    backgroundColor: 'transparent',
    grid: { left: 6, right: 12, top: 34, bottom: 4, containLabel: true },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 9,
      itemHeight: 7,
      textStyle: { color: C.muted, fontSize: 12 },
      data: [L(lang, '月收入', 'Revenue'), L(lang, '月毛利', 'Gross profit'), L(lang, '月净利', 'Net profit')],
    },
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: unknown) => fmtCny(Number(v)),
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { color: C.dim, fontSize: 12, interval: Math.max(0, Math.floor(months.length / 8) - 1) },
      axisLine: { lineStyle: { color: C.line } },
      axisTick: { show: false },
    },
    yAxis: axisMoney(lang),
    series: [
      {
        name: L(lang, '月收入', 'Revenue'),
        type: 'bar',
        barMaxWidth: 14,
        data: calc.monthly.map((p) => Math.round(p.revenue)),
        itemStyle: { color: 'rgba(76,201,240,.55)', borderRadius: [2, 2, 0, 0] },
      },
      {
        name: L(lang, '月毛利', 'Gross profit'),
        type: 'bar',
        barMaxWidth: 14,
        data: calc.monthly.map((p) => Math.round(p.grossProfit)),
        itemStyle: { color: 'rgba(61,220,151,.75)', borderRadius: [2, 2, 0, 0] },
      },
      {
        name: L(lang, '月净利', 'Net profit'),
        type: 'line',
        symbol: 'circle',
        symbolSize: 3,
        data: calc.monthly.map((p) => Math.round(p.netProfit)),
        lineStyle: { color: C.amber, width: 2 },
        itemStyle: { color: C.amber },
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 5) 收入结构 donut                                                     */
/* ------------------------------------------------------------------ */

export function revenueStructureOption(model: EconomicsModel, lang: Lang): EChartsOption {
  const streams = model.revenueStreams
  return {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltipBase(),
      trigger: 'item',
      formatter: (p: unknown) => {
        const item = p as { name?: string; percent?: number; dataIndex?: number }
        const stream = streams[item.dataIndex ?? 0]
        const range = stream ? `${fmtCny(stream.amountMin)}–${fmtCny(stream.amountMax)}` : ''
        return `<div style="font-weight:600">${item.name ?? ''}</div><div>${fmtPct(item.percent ?? 0, 1)} · ${L(lang, '理论月收入', 'Theoretical monthly revenue')} ${range}</div>${stream?.basis ? `<div style="color:${C.muted};max-width:240px;line-height:1.5;margin-top:2px">${stream.basis}</div>` : ''}`
      },
    },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['62%', '84%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: false },
        itemStyle: { borderColor: '#12151c', borderWidth: 2 },
        data: streams.map((s, i) => ({
          name: s.name,
          value: Math.max(0.1, s.sharePct),
          itemStyle: { color: PALETTE[i % PALETTE.length] },
        })),
      },
    ],
    graphic: [
      {
        type: 'text',
        left: '50%',
        top: '40%',
        style: {
          text: L(lang, '理论月收入', 'Monthly revenue'),
          fill: C.muted,
          fontSize: 11,
          align: 'center',
          verticalAlign: 'middle',
        },
      },
      {
        type: 'text',
        left: '50%',
        top: '50%',
        style: {
          text: fmtCny(model.base.revenue),
          fill: C.ink,
          fontSize: 18,
          fontWeight: 600,
          align: 'center',
          verticalAlign: 'middle',
        },
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 6) 敏感性：单量 → 月净利                                              */
/* ------------------------------------------------------------------ */

export function sensitivityOption(model: EconomicsModel, calc: EconCalc, lang: Lang): EChartsOption {
  const be = calc.breakevenOrders
  const current = Math.round(calc.orders)
  const baseMax = Math.max(...calc.sensitivity.map((p) => p.orders), current * 1.2)
  const baseMin = Math.min(...calc.sensitivity.map((p) => p.orders), current * 0.8)
  const minOrders = Math.max(0.5, Math.min(baseMin, be > 0 ? be * 0.9 : baseMin))
  const maxOrders = Math.max(baseMax, be > 0 ? be * 1.1 : baseMax, current * 1.05)
  const steps = 9
  const points = Array.from({ length: steps }, (_, i) => {
    const orders = minOrders + ((maxOrders - minOrders) / (steps - 1)) * i
    const revenue = orders * calc.aov
    const grossProfit = revenue * calc.marginPct
    return { orders, revenue, grossProfit, profit: grossProfit - calc.fixedCost, base: Math.abs(orders - current) < (maxOrders - minOrders) / 16 }
  })
  // 强制插入盈亏平衡点，保证折线在 x=盈亏平衡单量 时精确过 y=0
  if (be > 0 && be >= minOrders && be <= maxOrders) {
    points.push({ orders: be, revenue: be * calc.aov, grossProfit: be * calc.aov * calc.marginPct, profit: 0, base: false })
    points.sort((a, b) => a.orders - b.orders)
  }
  const hit = points.find((p) => p.base)
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 20, top: 50, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params : [params]
        const idx = Number((list[0] as { dataIndex?: number })?.dataIndex ?? 0)
        const p = points[idx]
        if (!p) return ''
        return [
          `<div style="font-weight:600;margin-bottom:2px">${L(lang, '月单量', 'Orders / month')} ${fmtInt(p.orders)}</div>`,
          `<div>${L(lang, '月收入', 'Revenue')}：${fmtCny(p.revenue)}</div>`,
          `<div>${L(lang, '月净利', 'Net profit')}：<b style="color:${p.profit >= 0 ? C.signal : C.danger}">${fmtCny(p.profit)}</b></div>`,
          `<div style="color:${C.muted};margin-top:2px">${L(lang, '公式', 'Formula')}：${fmtCny(p.revenue)} × ${fmtPct(calc.marginPct * 100, 0)} − ${fmtCny(calc.fixedCost)}</div>`,
        ].join('')
      },
    },
    xAxis: {
      type: 'value',
      min: Math.floor(minOrders),
      max: Math.ceil(maxOrders),
      axisLabel: { color: C.dim, fontSize: 12, formatter: (v: number) => `${fmtInt(v)}` },
      splitLine: { show: false },
      axisLine: { show: true, lineStyle: { color: 'rgba(230,233,240,.35)' } },
      axisTick: { show: false },
    },
    yAxis: {
      ...axisMoney(lang),
      axisLine: { show: true, lineStyle: { color: 'rgba(230,233,240,.35)' } },
    },
    series: [
      {
        type: 'line',
        smooth: 0.2,
        symbolSize: 5,
        data: points.map((p) => [Number(p.orders.toFixed(2)), Math.round(p.profit)]),
        lineStyle: { width: 2.5, color: C.cyan },
        itemStyle: { color: C.cyan },
        areaStyle: { color: 'rgba(76,201,240,.12)' },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              xAxis: Number(be.toFixed(1)),
              lineStyle: { color: C.amber, type: 'dashed', width: 1.2 },
              label: { rotate: 0, color: C.amber, fontSize: 12, position: 'insideEndTop', distance: 4, formatter: `${L(lang, '盈亏平衡', 'Break-even')} ${Math.round(be)}` },
            },
            {
              xAxis: current,
              lineStyle: { color: C.cyan, type: 'dashed', width: 1.2 },
              label: { rotate: 0, color: C.cyan, fontSize: 12, position: 'insideEndTop', distance: 4, formatter: `${L(lang, '当前', 'Current')} ${current}` },
            },
            {
              yAxis: 0,
              lineStyle: { color: C.amber, type: 'dotted', width: 1 },
              label: { rotate: 0, color: C.amber, fontSize: 11, position: 'insideStartTop', formatter: '0' },
            },
          ],
        },
        markPoint: hit
          ? {
              symbol: 'pin',
              symbolSize: 38,
              itemStyle: { color: C.signal },
              label: { color: '#10131a', fontSize: 12, fontWeight: 700, formatter: L(lang, '基准', 'Base') },
              data: [{ name: 'base', coord: [hit.orders, Math.round(hit.profit)] }],
            }
          : undefined,
      },
      {
        type: 'scatter',
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: C.amber, borderColor: '#10131a', borderWidth: 2 },
        data: be > 0 ? [[Number(be.toFixed(1)), 0]] : [],
        tooltip: { show: false },
      },
    ],
  }
}
/* 7) 10 维雷达                                                          */
/* ------------------------------------------------------------------ */

export function scoreRadarOption(dims: AssessmentDimension[], lang: Lang): EChartsOption {
  return {
    backgroundColor: 'transparent',
    radar: {
      indicator: dims.map((d) => ({ name: lang === 'en' ? d.labelEn : d.labelZh, max: 10 })),
      radius: '64%',
      center: ['50%', '54%'],
      axisName: { color: C.muted, fontSize: 12 },
      splitLine: { lineStyle: { color: C.line } },
      splitArea: { areaStyle: { color: ['rgba(61,220,151,0.02)', 'rgba(76,201,240,0.03)'] } },
      axisLine: { lineStyle: { color: C.line } },
    },
    tooltip: { ...tooltipBase(), trigger: 'item' },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: dims.map((d) => d.score),
            name: L(lang, '10 维评分', '10 dimensions'),
            areaStyle: { color: 'rgba(61,220,151,0.16)' },
            lineStyle: { color: C.signal, width: 2 },
            itemStyle: { color: C.signal },
          },
        ],
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 8) 卡片迷你图                                                         */
/* ------------------------------------------------------------------ */

export function cardPaybackOption(model: EconomicsModel, lang: Lang): EChartsOption {
  const points = model.steadyCurve
  const hit = points.find((p) => p.cumulative >= 0)
  return {
    animation: false,
    backgroundColor: 'transparent',
    grid: { left: 2, right: 10, top: 22, bottom: 4 },
    xAxis: { type: 'value', show: false, min: 1, max: 12 },
    yAxis: { type: 'value', show: false, min: -model.base.capital * 0.25, max: Math.max(1, model.base.capital * 0.55) },
    series: [
      {
        type: 'line',
        silent: true,
        smooth: 0.28,
        symbol: 'none',
        data: points.map((p) => [p.month, Math.round(p.cumulative)]),
        lineStyle: { width: 2.2, color: C.signal },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(61,220,151,.30)' },
              { offset: 1, color: 'rgba(61,220,151,.02)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(255,181,71,.5)', type: 'dashed', width: 1 },
          label: { show: false },
          data: [{ yAxis: 0 }],
        },
        markPoint: hit
          ? {
              symbol: 'circle',
              symbolSize: 9,
              itemStyle: { color: C.amber, borderColor: '#10131a', borderWidth: 2 },
              label: { show: true, position: 'top', distance: 3, color: C.amber, fontSize: 12, fontWeight: 600, formatter: `${Math.round(hit.month)}M` },
              data: [{ name: 'payback', coord: [hit.month, 0] }],
            }
          : undefined,
      },
    ],
  }
  void lang
}

export function cardCapitalOption(model: EconomicsModel, lang: Lang): EChartsOption {
  const items = model.investment.items
  return {
    animation: false,
    backgroundColor: 'transparent',
    grid: { left: 0, right: 0, top: 8, bottom: 8 },
    tooltip: {
      ...tooltipBase(),
      trigger: 'item',
      formatter: (p: unknown) => {
        const i = Number((p as { dataIndex?: number }).dataIndex ?? 0)
        const item = items[i]
        if (!item) return ''
        return `<div style="font-weight:600">${lang === 'en' ? item.labelEn : item.labelZh}</div><div>${fmtCny(item.min)}–${fmtCny(item.max)}</div>`
      },
    },
    xAxis: { type: 'value', show: false, min: 0, max: model.investment.total.max * 1.02 },
    yAxis: { type: 'category', show: false, data: ['capital'] },
    series: [
      {
        type: 'bar',
        stack: 'cap',
        barWidth: 14,
        data: items.map((x, i) => ({
          value: x.min,
          itemStyle: {
            color: PALETTE[i % PALETTE.length],
            borderRadius: i === 0 ? [3, 0, 0, 3] : 0,
          },
        })),
        label: { show: false },
      },
      {
        type: 'bar',
        stack: 'cap',
        barWidth: 14,
        data: items.map((x, i) => ({
          value: Math.max(0, x.max - x.min),
          itemStyle: {
            color: hexToRgba(PALETTE[i % PALETTE.length], 0.26),
            borderRadius: i === items.length - 1 ? [0, 3, 3, 0] : 0,
          },
        })),
        label: { show: false },
      },
    ],
  }
}
