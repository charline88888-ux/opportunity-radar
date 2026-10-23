/**
 * v1.5.0 经济性图表（ECharts option 构造器）
 * 所有图表均为真实数据驱动；颜色与 radar-dark 主题一致。
 */
import type { EChartsOption } from 'echarts'
import type { AssessmentDimension } from '@/lib/assessment'
import type { EconCalc, EconomicsModel } from '@/lib/economics'
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
    fontSize: 10.5,
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

export function capitalBreakdownOption(model: EconomicsModel, lang: Lang): EChartsOption {
  const items = [...model.investment.items].sort((a, b) => b.max - a.max)
  const categories = items.map((x) => {
    const short = SHORT_INVEST_LABEL[x.key]
    if (short) return lang === 'en' ? short.en : short.zh
    return lang === 'en' ? x.labelEn : x.labelZh
  })
  return {
    backgroundColor: 'transparent',
    grid: { left: 4, right: 10, top: 8, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltipBase(),
      trigger: 'item',
      formatter: (p: unknown) => {
        const i = Number((p as { dataIndex?: number }).dataIndex ?? 0)
        const item = items[i]
        if (!item) return ''
        return [
          `<div style="font-weight:600;margin-bottom:4px">${lang === 'en' ? item.labelEn : item.labelZh}</div>`,
          `<div>${L(lang, '投入区间', 'Range')}：<b>${fmtCnyFull(item.min)} – ${fmtCnyFull(item.max)}</b></div>`,
          `<div style="color:${C.muted};margin-top:3px;max-width:260px;line-height:1.5">${L(lang, '依据', 'Basis')}：${item.basis}</div>`,
        ].join('')
      },
    },
    xAxis: axisMoney(lang),
    yAxis: {
      type: 'category',
      data: categories,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: C.muted, fontSize: 11, width: 72, overflow: 'truncate' },
      inverse: true,
    },
    series: [
      {
        name: L(lang, '下限', 'Low'),
        type: 'bar',
        stack: 'range',
        silent: true,
        itemStyle: { color: 'transparent' },
        emphasis: { disabled: true },
        data: items.map((x) => x.min),
        barWidth: 12,
      },
      {
        name: L(lang, '区间', 'Range'),
        type: 'bar',
        stack: 'range',
        barWidth: 13,
        data: items.map((x, i) => ({
          value: Math.max(1, x.max - x.min),
          itemStyle: { color: PALETTE[i % PALETTE.length], borderRadius: [0, 3, 3, 0] },
        })),
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 2) 单位经济瀑布：客单价 → 成本 → 毛利 → 固定成本分摊 → 净贡献          */
/* ------------------------------------------------------------------ */

export function unitEconomicsOption(model: EconomicsModel, calc: EconCalc, lang: Lang): EChartsOption {
  const aov = calc.aov
  const unitCost = calc.unitCost
  const unitGross = calc.unitGrossProfit
  const fixedShare = calc.unitFixedCost
  const netUnit = calc.unitNetProfit
  const labels = [
    L(lang, '客单价', 'Avg. order value'),
    L(lang, '商品/服务成本', 'Cost of goods'),
    L(lang, '单品毛利', 'Unit gross profit'),
    L(lang, '固定成本分摊', 'Fixed cost / unit'),
    L(lang, '单品净贡献', 'Unit net contribution'),
  ]
  const ranges = [aov, unitCost, unitGross, fixedShare, netUnit]
  const helper: number[] = []
  const bars: number[] = []
  let running = 0
  for (let i = 0; i < ranges.length; i += 1) {
    const v = ranges[i]
    if (i === 0) {
      helper.push(0)
      bars.push(v)
      running = v
    } else if (i === 1 || i === 3) {
      helper.push(running - v)
      bars.push(v)
      running -= v
    } else if (i === 2) {
      helper.push(0)
      bars.push(unitGross)
      running = unitGross
    } else {
      helper.push(netUnit >= 0 ? 0 : Math.abs(netUnit))
      bars.push(Math.abs(netUnit))
      running = netUnit
    }
  }
  const colors = [C.cyan, C.danger, C.signal, C.amber, netUnit >= 0 ? C.signal : C.danger]
  return {
    backgroundColor: 'transparent',
    grid: { left: 4, right: 12, top: 12, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params : [params]
        const idx = Number((list[0] as { dataIndex?: number })?.dataIndex ?? 0)
        const label = labels[idx] || ''
        const valuesList = [aov, unitCost, unitGross, fixedShare, netUnit]
        const v = valuesList[idx]
        const sign = (idx === 1 || idx === 3) && v > 0 ? '-' : idx === 4 && netUnit < 0 ? '-' : ''
        return `<div style="font-weight:600;margin-bottom:3px">${label}</div><div style="font-size:13px">${sign}${fmtCnyFull(Math.abs(v))}</div>`
      },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: C.line } },
      axisTick: { show: false },
      axisLabel: { color: C.muted, fontSize: 11, interval: 0, lineHeight: 16 },
    },
    yAxis: axisMoney(lang),
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
          itemStyle: { color: colors[i], borderRadius: [3, 3, 0, 0] },
        })),
        label: {
          show: true,
          position: 'top',
          color: C.ink,
          fontSize: 11,
          formatter: (p: unknown) => {
            const idx = Number((p as { dataIndex?: number }).dataIndex ?? 0)
            const v = [aov, unitCost, unitGross, fixedShare, netUnit][idx]
            const sign = (idx === 1 || idx === 3) ? '-' : idx === 4 && v < 0 ? '-' : ''
            return `${sign}${fmtCny(Math.abs(v))}`
          },
        },
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
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
      axisLabel: { color: C.dim, fontSize: 10.5, formatter: (v: number) => `${v}${L(lang, '月', 'M')}` },
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
          label: { position: 'insideStartTop', color: C.amber, fontSize: 10.5, formatter: L(lang, '回本线', 'Break-even') },
          data: [{ yAxis: 0 }],
        },
        markPoint: hit
          ? {
              symbol: 'pin',
              symbolSize: 36,
              itemStyle: { color: C.amber },
              label: { color: '#10131a', fontSize: 10, fontWeight: 700, formatter: `${Math.round(hit.month)}M` },
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
      textStyle: { color: C.muted, fontSize: 10.5 },
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
      axisLabel: { color: C.dim, fontSize: 10, interval: Math.max(0, Math.floor(months.length / 8) - 1) },
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
    legend: {
      orient: 'vertical',
      right: 4,
      top: 'center',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: C.muted, fontSize: 11 },
      formatter: (name: string) => (name.length > 14 ? `${name.slice(0, 14)}…` : name),
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['34%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
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
        left: '24%',
        top: '40%',
        style: {
          text: L(lang, '理论月收入', 'Monthly revenue'),
          fill: C.muted,
          fontSize: 11,
          align: 'center',
        },
      },
      {
        type: 'text',
        left: '24%',
        top: '48%',
        style: {
          text: fmtCny(model.base.revenue),
          fill: C.ink,
          fontSize: 19,
          fontWeight: 600,
          align: 'center',
        },
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 6) 敏感性：单量 → 月净利                                              */
/* ------------------------------------------------------------------ */

export function sensitivityOption(model: EconomicsModel, calc: EconCalc, lang: Lang): EChartsOption {
  const points = calc.sensitivity
  const hit = points.find((p) => p.base)
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 18, top: 26, bottom: 6, containLabel: true },
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
        ].join('')
      },
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: C.dim, fontSize: 10, formatter: (v: number) => `${fmtInt(v)}` },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: C.line } },
      axisTick: { show: false },
    },
    yAxis: axisMoney(lang),
    series: [
      {
        type: 'line',
        smooth: 0.2,
        symbolSize: 5,
        data: points.map((p) => [p.orders, Math.round(p.profit)]),
        lineStyle: { width: 2.5, color: C.cyan },
        itemStyle: { color: C.cyan },
        areaStyle: { color: 'rgba(76,201,240,.12)' },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: C.amber, type: 'dashed', width: 1 },
          label: { color: C.amber, fontSize: 10, formatter: L(lang, '盈亏平衡', 'Break-even') },
          data: [{ yAxis: 0 }],
        },
        markPoint: hit
          ? {
              symbol: 'pin',
              symbolSize: 38,
              itemStyle: { color: C.signal },
              label: { color: '#10131a', fontSize: 9.5, fontWeight: 700, formatter: L(lang, '基准', 'Base') },
              data: [{ name: 'base', coord: [hit.orders, Math.round(hit.profit)] }],
            }
          : undefined,
      },
      {
        type: 'scatter',
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color: C.amber },
        data: calc.breakevenOrders > 0 ? [[Number(calc.breakevenOrders.toFixed(1)), 0]] : [],
        tooltip: { show: false },
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 7) 10 维雷达                                                          */
/* ------------------------------------------------------------------ */

export function scoreRadarOption(dims: AssessmentDimension[], lang: Lang): EChartsOption {
  return {
    backgroundColor: 'transparent',
    radar: {
      indicator: dims.map((d) => ({ name: lang === 'en' ? d.labelEn : d.labelZh, max: 10 })),
      radius: '64%',
      center: ['50%', '54%'],
      axisName: { color: C.muted, fontSize: 11 },
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
    grid: { left: 2, right: 8, top: 16, bottom: 4 },
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
              label: { show: true, position: 'top', distance: 3, color: C.amber, fontSize: 10, fontWeight: 600, formatter: `${Math.round(hit.month)}M` },
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
    xAxis: { type: 'value', show: false, max: model.investment.total.max * 1.02 },
    yAxis: { type: 'category', show: false, data: ['capital'] },
    series: [
      {
        type: 'bar',
        stack: 'cap',
        barWidth: 14,
        data: items.map((x, i) => ({
          value: x.max,
          itemStyle: {
            color: PALETTE[i % PALETTE.length],
            borderRadius: i === 0 ? [3, 0, 0, 3] : i === items.length - 1 ? [0, 3, 3, 0] : 0,
          },
        })),
        label: { show: false },
      },
    ],
  }
}
