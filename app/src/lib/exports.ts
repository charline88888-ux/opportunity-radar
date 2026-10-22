import dayjs from 'dayjs'
import type { Opportunity, WindowKey } from '@/types'
import {
  dataAsOf,
  dataMeta,
  deltaBasisShort,
  gapName,
  historyMeta,
  industryName,
  needName,
  oppById,
  rankings,
  rankingsDeltaBasis,
  rankingsHistoryAsOf,
  regionName,
  sourceHealth,
  stats,
  taxonomy,
} from './data'
import { experimentsToJson, experimentsToMarkdown, type Experiment } from './experiments'
import { EFFORT_LABEL, fmtCnyRange, fmtInt, fmtPct, fmtScore, WINDOW_STATUS_LABEL } from './utils'

const WINDOW_REPORT_LABEL: Record<WindowKey, string> = { day: '日报', week: '周报', month: '月报', year: '年报' }
const WINDOW_CN: Record<WindowKey, string> = { day: '日榜', week: '周榜', month: '月榜', year: '年榜' }

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-').slice(0, 100)
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  downloadBlob(filename, new Blob([text], { type: mime }))
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* ============================ 单条机会 Markdown 卡 ============================ */

export function opportunityCardMarkdown(opp: Opportunity): string {
  const q = opp.seven_questions
  const lines: string[] = [
    `# ${opp.title}`,
    '',
    `> ${opp.one_liner}`,
    '',
    `- 机会 ID：\`${opp.id}\``,
    `- 行业：${industryName(opp.industry_id)} · 信息差：${opp.gap_type_ids.map(gapName).join(' / ')}`,
    `- 区域：${opp.region_ids.map(regionName).join(' / ')} · 信号发源：${opp.origin_country} · 目标市场：${opp.target_countries.join(' / ')}`,
    `- 人性需求：${opp.human_need_ids.map(needName).join(' / ')}`,
    `- 评分：总分 ${fmtScore(opp.scores.total)}（${opp.scores.grade} 级） · rank_score ${fmtScore(opp.rank_score)} · 动量 ×${opp.momentum.toFixed(1)}`,
    `- 窗口：${WINDOW_STATUS_LABEL[opp.window.status] || opp.window.status} · 剩余 ${opp.window.months_left} 个月 · 数据基准日 ${dataAsOf}`,
    `- 数据口径：${deltaBasisShort}${rankingsHistoryAsOf ? `（上期快照 ${rankingsHistoryAsOf}）` : ''}`,
    '',
    '## 商业驱动七问',
    '',
    `**Q1 流量怎么来**：${q.traffic}`,
    '',
    `**Q2 赚什么钱**：${q.money}`,
    '',
    `**Q3 商业模式形态**：${q.model}`,
    '',
    `**Q4 投入回报与周期**：${q.roi}`,
    '',
    `**Q5 适合人群**：${q.audience}`,
    '',
    `**Q6 驱动类型**：${q.drivers.join(' / ')}`,
    '',
    `**Q7 壁垒是什么**：${q.moat}`,
    '',
    '## ROI 与规模',
    '',
    `- 启动资金：${fmtCnyRange(opp.roi.capital_cny.min, opp.roi.capital_cny.max)}`,
    `- 首次收入：${opp.roi.time_to_revenue_months} 个月 · 回本：${opp.roi.payback_months} 个月`,
    `- 月收入：${fmtCnyRange(opp.roi.monthly_revenue_cny.min, opp.roi.monthly_revenue_cny.max)} · 毛利率：${opp.roi.gross_margin_pct}%`,
    `- 投入程度：${EFFORT_LABEL[opp.roi.effort_level] || opp.roi.effort_level} · 团队 ${opp.roi.team_size} 人`,
    '',
    '## 证据链',
    '',
  ]
  if (!opp.signal.evidence.length) lines.push('> 暂无证据，使用前必须补充来源。')
  opp.signal.evidence.forEach((e, i) => {
    lines.push(
      `${i + 1}. **[${e.tier || 'secondary'}] ${e.title}** — ${e.publisher}（${e.date}）`,
      `   - 摘录：${e.quote || '—'}`,
      `   - 链接：${e.url || '—'}`,
    )
  })
  lines.push('', '## 7 天验证动作', '')
  opp.first_steps_7d.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
  lines.push('', '## 证伪条件（何时放弃）', '')
  opp.kill_criteria.forEach((s) => lines.push(`- ${s}`))
  lines.push('', '## 风险与合规', '')
  opp.risks.forEach((s) => lines.push(`- 风险：${s}`))
  lines.push(`- 合规：${opp.compliance_notes}`)
  lines.push('', `## 免责声明`, '', opp.disclaimer, '', `> 导出时间：${dayjs().format('YYYY-MM-DD HH:mm')} · 数据版本 ${dataMeta.data_version || '—'}`)
  return lines.join('\n') + '\n'
}

/* ============================ 本期报告（Markdown / HTML） ============================ */

export interface PeriodReport {
  period: WindowKey
  title: string
  filenameBase: string
  markdown: string
  html: string
}

export function buildPeriodReport(period: WindowKey): PeriodReport {
  const win = rankings.windows[period]
  const rows = (win?.items || [])
    .map((it) => ({ it, opp: oppById.get(it.opp_id) }))
    .filter((x): x is { it: typeof x.it; opp: Opportunity } => !!x.opp)
  const label = win?.label || WINDOW_CN[period]
  const title = `机会雷达 · ${label} ${WINDOW_REPORT_LABEL[period]}`
  const filenameBase = safeFileName(`report-${period}-${dataAsOf}`)
  const periodCN = WINDOW_CN[period]
  const kpi = stats.kpi
  const basisText =
    rankingsDeltaBasis === 'history'
      ? `较上一份历史快照（${rankingsHistoryAsOf || '—'}）`
      : '相邻窗口口径（历史快照不足 1 天）'
  const generated = dayjs().format('YYYY-MM-DD HH:mm')

  const lines: string[] = [
    `# ${title}`,
    '',
    `- 窗口：${periodCN} · ${label}（key: ${win?.key || '—'}）`,
    `- 数据基准日：${dataAsOf} · 数据版本：${dataMeta.data_version || '—'} · 本报告生成：${generated}`,
    `- delta 口径：${basisText}`,
    `- 数据来源：${dataMeta.source === 'real' ? '真实 data/ 产出' : '开发占位数据'} · 校验：${dataMeta.validation?.failed ? 'FAIL' : 'PASS'}`,
    '',
    '## 本期 KPI',
    '',
    `- 机会总数：${fmtInt(kpi.total_opps)} · 今日新信号：${fmtInt(kpi.new_today)} · A 级以上：${fmtInt(kpi.grade_a_plus)}（${fmtPct(kpi.total_opps ? (kpi.grade_a_plus / kpi.total_opps) * 100 : 0, 1)}）`,
    `- 平均总分：${fmtScore(kpi.avg_total)} · 行业覆盖：${kpi.industries_covered}/14 · 区域覆盖：${kpi.regions_covered}/11 · 开放窗口价值：¥${fmtInt(stats.open_window_value_cny)} / 月`,
    `- 本期上榜：${rows.length} 条 · 历史快照：${historyMeta.count} 份${historyMeta.latest_date ? `（最新 ${historyMeta.latest_date}）` : ''}`,
    '',
    `## ${periodCN}全部条目`,
    '',
    '| 排名 | 变化 | 机会 | 行业 | 总分 | 等级 | rank_score |',
    '|---:|---|---|---|---:|---|---:|',
  ]
  rows.forEach(({ it, opp }) => {
    const change = it.change === 'new' ? 'NEW' : it.change === 'up' ? `▲${it.delta ?? ''}` : it.change === 'down' ? `▼${Math.abs(it.delta ?? 0)}` : '—'
    lines.push(`| ${it.rank} | ${change} | ${opp.title} | ${industryName(opp.industry_id)} | ${fmtScore(it.total)} | ${opp.scores.grade} | ${fmtScore(it.rank_score)} |`)
  })
  lines.push('', '## Top 10 七问摘要与证据', '')
  rows.slice(0, 10).forEach(({ it, opp }) => {
    lines.push(
      `### ${it.rank}. ${opp.title}`,
      '',
      `- 一句话：${opp.one_liner}`,
      `- 行业：${industryName(opp.industry_id)} · 信息差：${opp.gap_type_ids.map(gapName).join(' / ')} · 区域：${opp.region_ids.map(regionName).join(' / ')}`,
      `- ROI：启动 ${fmtCnyRange(opp.roi.capital_cny.min, opp.roi.capital_cny.max)} · 月收入 ${fmtCnyRange(opp.roi.monthly_revenue_cny.min, opp.roi.monthly_revenue_cny.max)} · 毛利 ${opp.roi.gross_margin_pct}% · 回本 ${opp.roi.payback_months} 个月`,
      `- Q1 流量：${opp.seven_questions.traffic}`,
      `- Q2 赚钱：${opp.seven_questions.money}`,
      `- Q3 模式：${opp.seven_questions.model}`,
      `- Q5 人群：${opp.seven_questions.audience}`,
      `- Q7 壁垒：${opp.seven_questions.moat}`,
      `- 证据：${opp.signal.evidence.map((e) => `[${e.title}](${e.url})（${e.publisher}, ${e.date}）`).join('；') || '—'}`,
      `- 7 天动作：${opp.first_steps_7d.join(' / ')}`,
      `- 合规：${opp.compliance_notes}`,
      '',
    )
  })
  lines.push('---', '', '免责声明：本报告为研究假设与公开信息整理，不构成投资建议、法律意见或收入承诺。涉及跨境/金融/医疗/宗教时请自行合规核查。', '')

  const md = lines.join('\n')
  const html = buildReportHtml({ title, period, label, basisText, rows: rows.slice(0, 10), generated })

  return { period, title, filenameBase, markdown: md, html }
}

function buildReportHtml(args: {
  title: string
  period: WindowKey
  label: string
  basisText: string
  rows: Array<{ it: { rank: number; total: number; rank_score: number; change: string; delta: number | null }; opp: Opportunity }>
  generated: string
}): string {
  const { title, label, basisText, rows, generated } = args
  const kpi = stats.kpi
  const tableRows = rows
    .map(
      ({ it, opp }) => `<tr>
  <td class="num">${it.rank}</td>
  <td>${esc(opp.title)}<div class="sub">${esc(opp.one_liner)}</div></td>
  <td>${esc(industryName(opp.industry_id))}</td>
  <td class="num">${fmtScore(it.total)}</td>
  <td class="num">${esc(opp.scores.grade)}</td>
  <td class="num">${fmtScore(it.rank_score)}</td>
  <td>${esc(opp.window.status)} · ${opp.window.months_left}M</td>
</tr>`,
    )
    .join('\n')
  const detailBlocks = rows
    .map(
      ({ it, opp }) => `<section class="card">
  <h3><span class="rank">${it.rank}</span> ${esc(opp.title)} <span class="badge">${esc(opp.scores.grade)} 级</span></h3>
  <p class="lead">${esc(opp.one_liner)}</p>
  <p class="meta">行业 ${esc(industryName(opp.industry_id))} · 信息差 ${esc(opp.gap_type_ids.map(gapName).join(' / '))} · 区域 ${esc(opp.region_ids.map(regionName).join(' / '))} · 窗口 ${esc(WINDOW_STATUS_LABEL[opp.window.status] || opp.window.status)} ${opp.window.months_left}M</p>
  <p><b>ROI：</b>启动 ${esc(fmtCnyRange(opp.roi.capital_cny.min, opp.roi.capital_cny.max))} · 月收入 ${esc(fmtCnyRange(opp.roi.monthly_revenue_cny.min, opp.roi.monthly_revenue_cny.max))} · 毛利 ${opp.roi.gross_margin_pct}% · 回本 ${opp.roi.payback_months} 个月</p>
  <p><b>Q1 流量：</b>${esc(opp.seven_questions.traffic)}</p>
  <p><b>Q2 赚钱：</b>${esc(opp.seven_questions.money)}</p>
  <p><b>Q3 模式：</b>${esc(opp.seven_questions.model)}</p>
  <p><b>Q5 人群：</b>${esc(opp.seven_questions.audience)}</p>
  <p><b>Q7 壁垒：</b>${esc(opp.seven_questions.moat)}</p>
  <p><b>证据：</b>${opp.signal.evidence
    .map((e) => `<a href="${esc(e.url)}" rel="noopener noreferrer">${esc(e.title)}</a>（${esc(e.publisher)}, ${esc(e.date)}）`)
    .join('；') || '—'}</p>
  <p><b>7 天动作：</b>${esc(opp.first_steps_7d.join(' / '))}</p>
  <p><b>合规：</b>${esc(opp.compliance_notes)}</p>
</section>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; background: #f4f5f7; color: #1c2330; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 13px; line-height: 1.65; }
  main { max-width: 920px; margin: 0 auto; background: #fff; border: 1px solid #dfe3ea; border-radius: 8px; padding: 36px 40px; }
  h1 { font-size: 24px; margin: 0 0 6px; }
  h2 { font-size: 16px; margin: 26px 0 10px; border-bottom: 1px solid #e6e9f0; padding-bottom: 6px; }
  h3 { font-size: 14px; margin: 0 0 6px; }
  .subtitle { color: #5a6273; margin-bottom: 18px; }
  .kpi { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 6px; }
  .kpi div { border: 1px solid #e2e6ee; border-radius: 6px; padding: 8px 12px; min-width: 130px; }
  .kpi b { display: block; font-size: 18px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
  th, td { border: 1px solid #e2e6ee; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f7f8fa; font-weight: 600; }
  .num { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  .sub { color: #6b7385; font-size: 11px; }
  .card { border: 1px solid #e2e6ee; border-radius: 6px; padding: 14px 16px; margin: 12px 0; page-break-inside: avoid; }
  .rank { display: inline-block; min-width: 22px; color: #8b93a7; }
  .badge { font-size: 10px; border: 1px solid #c9d2df; border-radius: 3px; padding: 0 4px; color: #3d4b60; vertical-align: middle; }
  .meta { color: #5a6273; font-size: 11.5px; }
  .lead { color: #3d4b60; }
  a { color: #0b63c5; }
  .footer { margin-top: 24px; border-top: 1px solid #e6e9f0; padding-top: 10px; color: #6b7385; font-size: 10.5px; }
  @media print { body { padding: 0; background: #fff; } main { border: 0; border-radius: 0; padding: 0; } }
</style>
</head>
<body>
<main>
  <h1>${esc(title)}</h1>
  <div class="subtitle">数据基准日 ${esc(dataAsOf)} · 数据版本 ${esc(dataMeta.data_version || '—')} · 报告生成 ${esc(generated)} · delta 口径：${esc(basisText)} · 校验 ${dataMeta.validation?.failed ? 'FAIL' : 'PASS'}</div>
  <div class="kpi">
    <div>机会总数<b>${fmtInt(kpi.total_opps)}</b></div>
    <div>今日新信号<b>${fmtInt(kpi.new_today)}</b></div>
    <div>A 级以上<b>${fmtInt(kpi.grade_a_plus)}</b></div>
    <div>平均总分<b>${fmtScore(kpi.avg_total)}</b></div>
    <div>本期上榜<b>${rows.length}</b></div>
  </div>
  <p class="meta">历史快照 ${historyMeta.count} 份${historyMeta.latest_date ? `（最新 ${esc(historyMeta.latest_date)}）` : ''}${sourceHealth.available ? ` · 采集健康 ${sourceHealth.ok_count}/${sourceHealth.total} ok（${esc(sourceHealth.checked_at || '—')}）` : ' · 采集健康数据未提供'}</p>
  <h2>本期榜单 Top ${rows.length}</h2>
  <table><thead><tr><th>排名</th><th>机会</th><th>行业</th><th>总分</th><th>等级</th><th>rank_score</th><th>窗口</th></tr></thead><tbody>
  ${tableRows}
  </tbody></table>
  <h2>七问摘要与证据</h2>
  ${detailBlocks}
  <div class="footer">免责声明：本报告为研究假设与公开信息整理，不构成投资建议、法律意见或收入承诺。涉及跨境 / 金融 / 医疗 / 宗教时请自行合规核查。本报告由前端离线生成，与扫描器生成的 data/reports/ 报告互为补充。</div>
</main>
</body>
</html>`
}

/* ============================ 下载入口 ============================ */

export function downloadOpportunityMarkdown(opp: Opportunity) {
  downloadText(`${safeFileName(`opportunity-${opp.id}`)}.md`, opportunityCardMarkdown(opp), 'text/markdown;charset=utf-8')
}

export function downloadPeriodReport(period: WindowKey, format: 'md' | 'html') {
  const report = buildPeriodReport(period)
  if (format === 'md') downloadText(`${report.filenameBase}.md`, report.markdown, 'text/markdown;charset=utf-8')
  else downloadText(`${report.filenameBase}.html`, report.html, 'text/html;charset=utf-8')
}

export function downloadExperiments(items: Experiment[], format: 'md' | 'json') {
  if (format === 'md') downloadText(`radar-experiments-${dataAsOf}.md`, experimentsToMarkdown(items), 'text/markdown;charset=utf-8')
  else downloadText(`radar-experiments-${dataAsOf}.json`, experimentsToJson(items), 'application/json;charset=utf-8')
}

export function periodReportTitle(period: WindowKey): string {
  return `${WINDOW_CN[period]}${WINDOW_REPORT_LABEL[period]}`
}
