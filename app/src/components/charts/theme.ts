import * as echarts from 'echarts'

const FONT =
  'Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
const MONO = '"JetBrains Mono", "Cascadia Mono", Consolas, monospace'

/** 统一深色图表主题：无外网字体，颜色与设计系统一致 */
const theme = {
  color: ['#3ddc97', '#4cc9f0', '#ffb547', '#ff5d5d', '#a78bfa', '#f472b6', '#84cc16', '#60a5fa', '#fbbf24', '#2dd4bf'],
  backgroundColor: 'transparent',
  textStyle: { color: '#8b93a7', fontFamily: FONT, fontSize: 12 },
  title: {
    textStyle: { color: '#e6e9f0', fontSize: 13, fontWeight: 600, fontFamily: FONT },
    subtextStyle: { color: '#8b93a7', fontSize: 12 },
  },
  legend: {
    textStyle: { color: '#8b93a7', fontSize: 12, fontFamily: FONT },
    itemWidth: 10,
    itemHeight: 8,
    itemGap: 12,
    icon: 'roundRect',
  },
  tooltip: {
    backgroundColor: '#171b24',
    borderColor: '#2b3342',
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: '#e6e9f0', fontSize: 12, fontFamily: FONT },
    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,.45); border-radius: 6px;',
    axisPointer: {
      lineStyle: { color: '#39424f', width: 1 },
      crossStyle: { color: '#39424f' },
      shadowStyle: { color: 'rgba(35,41,54,.35)' },
      label: { backgroundColor: '#232936', color: '#e6e9f0', fontFamily: MONO, fontSize: 12 },
    },
  },
  grid: { left: 6, right: 10, top: 28, bottom: 6, containLabel: true },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#2b3342' } },
    axisTick: { show: false },
    axisLabel: { color: '#8b93a7', fontSize: 12, fontFamily: FONT },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#5a6273', fontSize: 12, fontFamily: MONO },
    splitLine: { lineStyle: { color: 'rgba(35,41,54,.75)', type: 'dashed' } },
  },
  line: {
    symbol: 'circle',
    symbolSize: 5,
    smooth: 0.28,
    lineStyle: { width: 2 },
    emphasis: { focus: 'series' },
  },
  bar: { barMaxWidth: 18, itemStyle: { borderRadius: [2, 2, 0, 0] } },
  pie: {
    itemStyle: { borderColor: '#12151c', borderWidth: 1 },
    label: { color: '#8b93a7', fontSize: 12 },
    labelLine: { lineStyle: { color: '#39424f' } },
  },
  radar: {
    axisLine: { lineStyle: { color: 'rgba(57,66,79,.75)' } },
    splitLine: { lineStyle: { color: 'rgba(57,66,79,.65)' } },
    splitArea: { areaStyle: { color: ['rgba(23,27,36,.35)', 'rgba(18,21,28,.35)'] } },
    axisName: { color: '#8b93a7', fontSize: 12, fontFamily: FONT },
    symbol: 'circle',
  },
  treemap: {
    breadcrumb: { show: false },
    itemStyle: { borderColor: '#0a0c10', borderWidth: 2, gapWidth: 2 },
  },
  heatmap: {
    itemStyle: { borderColor: 'rgba(10,12,16,.8)', borderWidth: 1 },
  },
  sankey: {
    label: { color: '#e6e9f0', fontSize: 12, fontFamily: FONT },
    itemStyle: { borderWidth: 0 },
    lineStyle: { color: 'gradient', opacity: 0.22, curveness: 0.5 },
  },
}

echarts.registerTheme('radar-dark', theme)

export { echarts, theme as chartTheme, FONT as CHART_FONT, MONO as CHART_MONO }
