import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import {
  ArrowUpRight,
  Download,
  FileJson,
  FileText,
  FlaskConical,
  Lightbulb,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Chart } from '@/components/charts/Chart'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, EmptyState, Panel, ProgressBar, SectionCard } from '@/components/ui'
import {
  BRIER_MIN_SAMPLES,
  CALIBRATION_BUCKETS,
  CALIBRATION_MIN_SAMPLES,
  buildCalibration,
  calibrationToJson,
  calibrationToMarkdown,
  type CalibrationSample,
} from '@/lib/calibration'
import { calibrationExperimentsExport, useExperiments } from '@/lib/experiments'
import { useProfile } from '@/lib/profile'
import { useRecLog } from '@/lib/rec_log'
import { useI18n } from '@/lib/i18n'
import { downloadText } from '@/lib/exports'
import { cn, fmtCnyRange, fmtInt, fmtPct, fmtScore } from '@/lib/utils'

const OUTCOME_COLORS: Record<string, string> = {
  positive: '#3ddc97',
  negative: '#ff5d5d',
  inconclusive: '#8b93a7',
}
const OUTCOME_LABELS: Record<string, string> = {
  positive: '正向',
  negative: '负向',
  inconclusive: '不明确',
}

function OutcomePill({ outcome }: { outcome: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9.5px]"
      style={{ color: OUTCOME_COLORS[outcome], borderColor: `${OUTCOME_COLORS[outcome]}55`, background: `${OUTCOME_COLORS[outcome]}10` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: OUTCOME_COLORS[outcome] }} />
      {OUTCOME_LABELS[outcome] || outcome}
    </span>
  )
}

export default function Calibration() {
  const { items } = useExperiments()
  const { profile } = useProfile()
  const { summary: recSummary } = useRecLog()
  const { lang } = useI18n()
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const data = useMemo(() => buildCalibration(items), [items])
  const s = data.stats

  const gradeOption = useMemo<EChartsOption>(() => ({
    grid: { left: 6, right: 8, top: 30, bottom: 4, containLabel: true },
    legend: { top: 0, right: 0, textStyle: { fontSize: 9.5 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: data.byGrade.map((x) => `${x.grade} 级`) },
    yAxis: { type: 'value', name: '实验数', minInterval: 1, nameTextStyle: { fontSize: 8.5, color: '#5a6273' } },
    series: [
      { name: '正向', type: 'bar', stack: 'o', barMaxWidth: 34, itemStyle: { color: OUTCOME_COLORS.positive }, data: data.byGrade.map((x) => x.positive) },
      { name: '负向', type: 'bar', stack: 'o', itemStyle: { color: OUTCOME_COLORS.negative }, data: data.byGrade.map((x) => x.negative) },
      { name: '不明确', type: 'bar', stack: 'o', itemStyle: { color: OUTCOME_COLORS.inconclusive, borderRadius: [2, 2, 0, 0] }, data: data.byGrade.map((x) => x.inconclusive) },
    ],
  }), [data.byGrade])

  const scatterOption = useMemo<EChartsOption>(() => ({
    grid: { left: 6, right: 12, top: 30, bottom: 6, containLabel: true },
    legend: { top: 0, right: 0, textStyle: { fontSize: 9.5 } },
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const sample = data.samples[Number(p.value?.[2])]
        if (!sample) return ''
        return `<b>${sample.experiment.title}</b><br/>预测总分：${sample.total}（${sample.grade} 级）<br/>花费：¥${sample.spend} · 耗时：${sample.hours}h<br/>结果：<b>${OUTCOME_LABELS[sample.outcome]}</b>`
      },
    },
    xAxis: { type: 'value', name: '预测总分', min: 40, max: 100, nameTextStyle: { fontSize: 8.5, color: '#5a6273' } },
    yAxis: { type: 'value', name: '实际花费 CNY', nameTextStyle: { fontSize: 8.5, color: '#5a6273' } },
    series: (['positive', 'negative', 'inconclusive'] as const).map((outcome) => ({
      name: OUTCOME_LABELS[outcome],
      type: 'scatter',
      symbolSize: (_val: any, params: any) => {
        const sample = data.samples[Number(params.value?.[2])]
        return sample ? Math.max(7, Math.min(18, 7 + sample.hours * 0.8)) : 8
      },
      itemStyle: { color: OUTCOME_COLORS[outcome], opacity: 0.82 },
      data: data.samples
        .map((sample, index) => ({ sample, index }))
        .filter((x) => x.sample.outcome === outcome)
        .map((x) => [x.sample.total, x.sample.spend, x.index]),
    })),
  }), [data.samples])

  const bucketSuccess = useMemo(
    () => data.byBucket.map((b) => ({ ...b, successRate: b.positive + b.negative ? (b.positive / (b.positive + b.negative)) * 100 : 0 })),
    [data.byBucket],
  )

  const exportReport = () => {
    downloadText('radar-calibration.md', calibrationToMarkdown(data), 'text/markdown;charset=utf-8')
  }
  const exportExperiments = () => {
    downloadText('radar-experiments-calibration.json', calibrationExperimentsExport(items, profile), 'application/json;charset=utf-8')
  }
  const exportCalibrationJson = () => {
    downloadText('radar-calibration.json', calibrationToJson(data, recSummary), 'application/json;charset=utf-8')
  }

  return (
    <div>
      <PageHeader
        index="10"
        kicker="CALIBRATION · 回测校准"
        title="回测校准 · 预测等级 vs 真实结果"
        description="把 /lab 里带 outcome 的结案实验与机会预测（等级 / 总分）做 join，检查评分是否「说得准」。样本 <3 时只做方向性提示，不据此调整权重。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={data.ready ? 'signal' : 'amber'}><Target className="h-3 w-3" /> 样本 {s.samples} 条{!data.ready ? ` / 建议 ≥${CALIBRATION_MIN_SAMPLES}` : ''}</Badge>
            <Button size="sm" variant="outline" onClick={exportReport} disabled={!s.samples}><FileText className="h-3.5 w-3.5" /> {L('导出校准 MD', 'Export calibration MD')}</Button>
            <Button size="sm" variant="outline" onClick={exportCalibrationJson} disabled={!s.samples}><FileJson className="h-3.5 w-3.5" /> {L('导出校准 JSON', 'Export calibration JSON')}</Button>
            <Button size="sm" variant="outline" onClick={exportExperiments} disabled={!items.length}><FileJson className="h-3.5 w-3.5" /> {L('导出实验 JSON', 'Export experiments JSON')}</Button>
            <span className="hidden max-w-[180px] font-mono text-[9px] leading-tight text-dim xl:inline">→ python scanner/calibrate.py --experiments &lt;file&gt;</span>
            <Link to="/lab" className="inline-flex h-7 items-center gap-1 rounded border border-signal/35 bg-signal/10 px-2.5 text-[11.5px] text-signal hover:bg-signal/20">
              <FlaskConical className="h-3 w-3" /> 去实验台
            </Link>
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: '带结果样本', value: fmtInt(s.samples), unit: `正向 ${s.positive} / 负向 ${s.negative} / 不明确 ${s.inconclusive}`, color: '#4cc9f0' },
          { label: '成功率', value: data.ready && s.decided ? fmtPct(s.successRate, 1) : '—', unit: data.ready ? '正向 / 已决策（不含不明确）' : '样本 <3，不展示成功率结论', color: '#3ddc97' },
          { label: 'Brier 分数', value: s.brier != null ? s.brier.toFixed(3) : '样本不足', unit: s.brier != null ? `基线 ${s.brierBaseline} · 二值 N=${s.brierN}` : `二值 N=${s.brierN} / 建议 ≥${BRIER_MIN_SAMPLES}`, color: s.brier == null ? '#8b93a7' : s.brier < 0.15 ? '#3ddc97' : s.brier <= s.brierBaseline ? '#ffd166' : '#ff5d5d' },
          { label: '平均总分', value: fmtScore(s.avgTotal), unit: `成功 ${s.avgTotalPositive ?? '—'} · 失败 ${s.avgTotalNegative ?? '—'}`, color: '#ffd166' },
          { label: '平均花费', value: `¥${fmtInt(s.avgSpend)}`, unit: `累计 ¥${fmtInt(s.totalSpend)}`, color: '#e6e9f0' },
          { label: '平均耗时', value: fmtInt(s.avgHours), unit: `累计 ${fmtInt(s.totalHours)} 小时`, color: '#8b93a7' },
        ].map((x) => (
          <Panel key={x.label} className="px-3 py-2">
            <div className="mono-label">{x.label}</div>
            <div className="num mt-0.5 text-[19px] font-semibold leading-none" style={{ color: x.color }}>{x.value}</div>
            <div className="mt-0.5 text-[9.5px] text-dim">{x.unit}</div>
          </Panel>
        ))}
      </div>

      <Panel className="mb-3 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-cyan" />
            <span className="text-[12px] font-semibold text-ink">{L('推荐漏斗', 'Recommendation funnel')}</span>
            <span className="font-mono text-[9px] text-dim">from /rankings?mode=recommend · rec_log localStorage</span>
          </div>
          <span className="font-mono text-[9px] text-dim">{L('上限 500 条 · 本地记录', '500-record cap · local log')}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {[
            { label: L('曝光（去重机会）', 'Impressions (unique)'), value: recSummary.unique_impressions, unit: L(`记录 ${recSummary.impressions} 次`, `${recSummary.impressions} events`), color: '#4cc9f0' },
            { label: L('查看', 'Views'), value: recSummary.unique_views, unit: L(`${recSummary.view_rate}% 曝光→查看`, `${recSummary.view_rate}% view rate`), color: '#cdd6e5' },
            { label: L('加入实验', 'Experiments'), value: recSummary.unique_experiments, unit: L(`${recSummary.experiments} 次实验事件`, `${recSummary.experiments} events`), color: '#3ddc97' },
            { label: L('命中率', 'Hit rate'), value: `${recSummary.hit_rate}%`, unit: L('实验 / 曝光去重', 'experiments / unique impressions'), color: '#ffd166' },
            { label: L('忽略', 'Dismissed'), value: recSummary.unique_dismisses, unit: L(`${recSummary.dismisses} 次忽略`, `${recSummary.dismisses} events`), color: '#8b93a7' },
          ].map((x) => (
            <div key={x.label} className="rounded border border-line/70 px-2.5 py-1.5">
              <div className="mono-label">{x.label}</div>
              <div className="num text-[17px] font-semibold" style={{ color: x.color }}>{x.value}</div>
              <div className="text-[9px] text-dim">{x.unit}</div>
            </div>
          ))}
        </div>
        {recSummary.unique_impressions === 0 && (
          <div className="mt-2 text-[10px] text-dim">{L('还没有推荐行为记录：在「为你推荐」浏览/查看/忽略，或从详情加入实验后会自动累计；仅保存在本机。', 'No recommendation activity yet: browse/view/ignore in “For you”, or add an experiment from a detail page; it accumulates locally only.')}</div>
        )}
      </Panel>

      <Panel className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-line/70 bg-white/[0.015] px-3 py-2 text-[10px] text-dim">
        <span className="font-semibold text-muted">{L('后端校准报告', 'Backend calibration report')}</span>
        <span className="font-mono">python scanner/calibrate.py --experiments &lt;{L('导出实验 JSON', 'exported experiments JSON')}&gt;</span>
        <span>→ <span className="font-mono">data/reports/calibration-&lt;date&gt;.html / .md</span></span>
        <span>{L('浏览器不直接读取 data/reports；生成后自行打开文件。', 'The browser never reads data/reports directly; open the generated file yourself.')}</span>
      </Panel>

      {!data.ready && (
        <Panel className="mb-3 flex flex-col gap-2 border-amber/30 bg-amber/[0.05] p-3 md:flex-row md:items-center">
          <FlaskConical className="h-5 w-5 shrink-0 text-amber" />
          <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-amber">
            {s.samples === 0
              ? '还没有带 outcome 的结案实验。回测校准需要「预测 → 真实结果」配对：先到实验台把进行中的实验结案，并标记正向 / 负向 / 不明确。'
              : `当前只有 ${s.samples} 个带 outcome 的样本，低于建议的 ${CALIBRATION_MIN_SAMPLES} 个；下方统计只作方向性提示，不据此调整评分权重。`}
          </div>
          <Link to="/lab" className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-amber/40 bg-amber/10 px-2.5 text-[11px] text-amber hover:bg-amber/20">
            去实验台结案 <ArrowUpRight className="h-3 w-3" />
          </Link>
        </Panel>
      )}

      {data.ready ? (
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <SectionCard className="xl:col-span-6" eyebrow="GRADE × OUTCOME" title="预测等级 × 实际结果" subtitle="堆叠柱：每个预测等级的实验分别落在正向/负向/不明确" right={<Target className="h-4 w-4 text-dim" />}>
          {data.samples.length ? <Chart option={gradeOption} height={260} /> : <EmptyState title="暂无实验数据" hint="完成实验并在实验台标记 outcome 后显示。" />}
        </SectionCard>
        <SectionCard className="xl:col-span-6" eyebrow="SCORE vs SPEND" title="评分 × 花费散点" subtitle="点大小 = 耗时；颜色 = 结果。用于观察「高分高花费」是否真的更容易成功" right={<TrendingUp className="h-4 w-4 text-dim" />}>
          {data.samples.length ? <Chart option={scatterOption} height={260} /> : <EmptyState title="暂无实验数据" hint="样本会显示在总分 × 花费坐标系中。" />}
        </SectionCard>

        <SectionCard className="xl:col-span-7" eyebrow="SCORE BUCKETS" title="评分分桶 × 结果" subtitle="按预测总分分桶统计成功率，识别评分在哪些区间失效" right={<TrendingDown className="h-4 w-4 text-dim" />}>
          <div className="space-y-2">
            {bucketSuccess.map((b) => (
              <div key={b.bucket}>
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-muted">{b.bucket} 分</span>
                  <span className="font-mono text-dim">{b.positive + b.negative ? `${fmtPct(b.successRate, 0)} 成功率` : '—'} · {b.total} 个样本</span>
                  {b.total > 0 && b.total < CALIBRATION_MIN_SAMPLES && <span className="text-amber">· 样本 &lt;{CALIBRATION_MIN_SAMPLES}，仅计数</span>}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <ProgressBar value={b.total ? (b.total / Math.max(1, s.samples)) * 100 : 0} max={100} tone="cyan" className="w-16" />
                  <div className="flex flex-1 gap-1">
                    {b.positive > 0 && <span className="h-2 rounded-sm bg-signal" style={{ flex: b.positive }} title={`正向 ${b.positive}`} />}
                    {b.negative > 0 && <span className="h-2 rounded-sm bg-danger" style={{ flex: b.negative }} title={`负向 ${b.negative}`} />}
                    {b.inconclusive > 0 && <span className="h-2 rounded-sm bg-dim" style={{ flex: b.inconclusive }} title={`不明确 ${b.inconclusive}`} />}
                    {b.total === 0 && <span className="h-2 flex-1 rounded-sm bg-line/50" />}
                  </div>
                  <span className="num w-16 text-right text-[9.5px] text-dim">
                    {b.positive} / {b.negative} / {b.inconclusive}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded border border-line/60 bg-black/15 px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
            成功样本平均总分 {s.avgTotalPositive ?? '—'} vs 失败样本 {s.avgTotalNegative ?? '—'}；若成功平均分反而更低，说明当前评分需要校准。
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-5" eyebrow="ADVICE" title="校准建议" right={<Lightbulb className="h-4 w-4 text-amber" />}>
          <div className={cn('mb-2 rounded border px-2.5 py-2', s.brier == null ? 'border-line/60 bg-black/15' : s.brier < 0.15 ? 'border-signal/30 bg-signal/[0.05]' : s.brier <= s.brierBaseline ? 'border-amber/30 bg-amber/[0.05]' : 'border-danger/30 bg-danger/[0.05]')}>
            <div className="flex items-center justify-between gap-2">
              <span className="mono-label">BRIER · 概率校准</span>
              <span className="num text-[15px] font-semibold" style={{ color: s.brier == null ? '#8b93a7' : s.brier < 0.15 ? '#3ddc97' : s.brier <= s.brierBaseline ? '#ffd166' : '#ff5d5d' }}>
                {s.brier != null ? s.brier.toFixed(4) : '样本不足'}
              </span>
            </div>
            <div className="mt-0.5 font-mono text-[9px] leading-relaxed text-dim">
              {s.brier != null
                ? `N=${s.brierN} · 基线 ${s.brierBaseline} · Δ ${s.brierDelta! >= 0 ? '+' : ''}${s.brierDelta!.toFixed(4)} · ${s.brierInterpretation}`
                : `二值样本 N=${s.brierN}，需要 ≥${BRIER_MIN_SAMPLES} 个 positive/negative 才计算；inconclusive 不计入。`}
            </div>
            <div className="mt-1 font-mono text-[8.5px] leading-relaxed text-dim">
              p = clamp(total/100, 0.01, 0.99)；o = positive?1 : negative?0；Brier = mean((p−o)²)，越低越好。
            </div>
          </div>
          <div className="space-y-2">
            {data.suggestions.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 rounded border border-line/70 bg-white/[0.015] px-2.5 py-2 text-[10.5px] leading-relaxed text-muted">
                <span className="mt-0.5 font-mono text-[9px] text-amber">S{i + 1}</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[9px] leading-relaxed text-dim">
            校准只调整「我们对评分的信心」，不自动改 opportunities.json；样本 &lt;10 时不建议调整 10 维权重。Brier 基线 0.25 为随机二分类基准。
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-12" eyebrow="SAMPLES" title="实验样本明细" subtitle="按结案日期倒序；点击机会跳到详情，点击实验台可继续记录" right={<Badge tone="muted">{data.samples.length} 条</Badge>} bodyClassName="p-0">
          {data.samples.length ? (
            <div className="overflow-x-auto">
              <table className="table-dense min-w-[900px]">
                <thead>
                  <tr>
                    <th>机会</th>
                    <th className="w-16">等级</th>
                    <th className="w-16 text-right">总分</th>
                    <th className="w-24">结果</th>
                    <th className="w-24 text-right">花费</th>
                    <th className="w-16 text-right">耗时</th>
                    <th className="w-24">结案日期</th>
                    <th>结论</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.samples]
                    .sort((a, b) => b.ended_at.localeCompare(a.ended_at))
                    .map((sample: CalibrationSample) => (
                      <tr key={sample.experiment.id}>
                        <td>
                          <Link to={`/opportunities/${sample.experiment.opp_id}`} className="block max-w-[300px] truncate text-[11.5px] text-ink hover:text-signal">
                            {sample.experiment.title}
                          </Link>
                        </td>
                        <td className="num text-[11px] text-muted">{sample.grade}</td>
                        <td className="num text-right text-[11px] text-muted">{fmtScore(sample.total)}</td>
                        <td><OutcomePill outcome={sample.outcome} /></td>
                        <td className="num text-right text-[10.5px] text-dim">{fmtCnyRange(sample.spend, sample.spend)}</td>
                        <td className="num text-right text-[10.5px] text-dim">{sample.hours}h</td>
                        <td className="font-mono text-[10px] text-dim">{sample.ended_at}</td>
                        <td className="max-w-[320px] truncate text-[10px] text-dim" title={sample.experiment.conclusion}>{sample.experiment.conclusion || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                title="暂无样本"
                hint="在实验台把实验结案并选择 outcome（正向/负向/不明确）后，这里会自动生成样本与统计。"
              />
            </div>
          )}
        </SectionCard>
      </div>
      ) : (
        <SectionCard eyebrow="NOT ENOUGH SAMPLES" title="样本不足，暂不展示成功率图表">
          <EmptyState
            icon={<FlaskConical className="h-5 w-5" />}
            title={`当前 ${s.samples} 个带 outcome 的样本（建议 ≥${CALIBRATION_MIN_SAMPLES}）`}
            hint="样本少于 3 时只展示计数与均分，不展示成功率 / 校准图表，避免小样本误导。请先到实验台把进行中的实验结案并标记正向 / 负向 / 不明确。"
          />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Link to="/lab" className="inline-flex h-8 items-center gap-1.5 rounded border border-signal/40 bg-signal/10 px-3 text-[12px] text-signal">
              <FlaskConical className="h-3.5 w-3.5" /> 去实验台结案
            </Link>
            <span className="text-[10px] text-dim">机会评分与实验记录都只在本机处理；样本积累到 3 条后自动解锁统计。</span>
          </div>
        </SectionCard>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-dim">
        <Download className="h-3 w-3" /> 报告可导出 MD 备份；「导出实验 JSON」采用 docs/12 §1.3 schema，可运行 `python scanner/calibrate.py --experiments 文件` 生成正式校准报告。
        <span className="ml-auto font-mono">样本 {s.samples} · 建议 ≥{CALIBRATION_MIN_SAMPLES} · 现有分桶 {CALIBRATION_BUCKETS.length} 档 · Brier 基线 0.25（二值 N≥{BRIER_MIN_SAMPLES} 展示）</span>
      </div>
    </div>
  )
}
