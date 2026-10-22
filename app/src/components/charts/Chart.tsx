import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { localizeChartOption, useI18n } from '@/lib/i18n'
import './theme'

export function Chart({
  option,
  height = 260,
  className,
  notMerge = true,
  onEvents,
}: {
  option: EChartsOption
  height?: number | string
  className?: string
  notMerge?: boolean
  onEvents?: Record<string, (params: unknown) => void>
}) {
  const { lang } = useI18n()
  const localized = useMemo(() => localizeChartOption(option), [option, lang])
  return (
    <div className={className} style={{ height }}>
      <ReactECharts
        option={localized}
        theme="radar-dark"
        notMerge={notMerge}
        lazyUpdate
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        onEvents={onEvents}
      />
    </div>
  )
}

/** 窄屏/空数据时的降级图位 */
export function ChartFallback({ height = 240, text = '数据不足，暂无法绘制图表' }: { height?: number; text?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded border border-dashed border-line text-[12px] text-dim"
      style={{ height }}
    >
      {text}
    </div>
  )
}
