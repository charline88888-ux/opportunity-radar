/**
 * sync-data.mjs —— 构建前把 ../data/*.json 同步到 src/data/ 并做契约自检
 *
 * 用法：
 *   node scripts/sync-data.mjs              # strict 模式：7 个文件必须全部为真实数据，否则退出 1
 *   node scripts/sync-data.mjs --allow-mock # 开发模式：缺失文件用 mock 占位（页面显示「演示数据」）
 *
 * 原则：
 * 1. 最终交付构建只引用 ../data 真实产出；mock 仅供开发占位，不会进入 strict 构建；
 * 2. 不修改 ../data；
 * 3. 打印机会数 / 榜单条数 / 校验结果，strict 校验失败退出码 1。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateMockData } from './mock-seed.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
const realDir = path.resolve(appRoot, '..', 'data')
const outDir = path.join(appRoot, 'src', 'data')
const mockDir = path.join(appRoot, 'src', 'mock')
const args = process.argv.slice(2)
const allowMock = args.includes('--allow-mock') || args.includes('--dev')
const strict = !allowMock

const FILES = [
  'taxonomy.json',
  'opportunities.json',
  'rankings.json',
  'stats.json',
  'sources.json',
  'playbooks.json',
  'calendar.json',
]

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function pickList(raw, keys) {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    for (const k of keys) if (Array.isArray(raw[k])) return raw[k]
    if (Array.isArray(raw.data)) return raw.data
  }
  return []
}

function round1(n) {
  return Math.round(n * 10) / 10
}

function collectStats(obj, file) {
  if (!obj) return null
  if (file === 'opportunities.json') return pickList(obj, ['opportunities', 'items']).length
  if (file === 'sources.json' && Array.isArray(obj.categories)) {
    return obj.categories.reduce((a, c) => a + (Array.isArray(c?.sources) ? c.sources.length : 0), 0)
  }
  if (file === 'playbooks.json') return pickList(obj, ['playbooks', 'items']).length
  if (file === 'calendar.json') return pickList(obj, ['events', 'items']).length
  return null
}

const metaOf = (obj) => (obj && typeof obj.meta === 'object' ? obj.meta : {})

/* ============================ 1. 同步 ============================ */

fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(mockDir, { recursive: true })

const mock = generateMockData()
for (const file of FILES) {
  fs.writeFileSync(path.join(mockDir, file), JSON.stringify(mock[file], null, 2) + '\n')
}

const bundled = {}
const filesMeta = {}
const mockFiles = []
const missingReal = []
const report = []
const realMeta = {}

for (const file of FILES) {
  const realPath = path.join(realDir, file)
  let obj = null
  if (fs.existsSync(realPath)) obj = readJsonSafe(realPath)
  if (obj) {
    bundled[file] = obj
    filesMeta[file] = 'real'
    realMeta[file] = obj?.meta || {}
    report.push(`  ✓ real  ${file}`)
  } else {
    missingReal.push(file)
    bundled[file] = mock[file]
    filesMeta[file] = 'mock'
    mockFiles.push(file)
    report.push(
      `  ${strict ? '✗' : '~'} ${strict ? 'MISS' : 'mock'}  ${file}${
        fs.existsSync(realPath) ? '（真实文件不是合法 JSON）' : '（真实文件尚未产出）'
      }`,
    )
  }
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(bundled[file], null, 2) + '\n')
}

/* ---- 1.1 v0.2.0 可选数据：history 快照 / source-health（缺失不阻塞 strict 构建） ---- */

const historyDir = path.join(realDir, 'history')
const historyMeta = {
  available: false,
  count: 0,
  latest_date: null,
  history_as_of: null,
  snapshots: [],
  note: '可选未提供：delta 回退相邻窗口口径',
}
if (fs.existsSync(historyDir)) {
  const historyFiles = fs
    .readdirSync(historyDir)
    .filter((f) => /^rankings-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
  for (const file of historyFiles) {
    const obj = readJsonSafe(path.join(historyDir, file))
    if (!obj || typeof obj !== 'object') continue
    const m = metaOf(obj)
    const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/)
    const date = dateMatch ? dateMatch[1] : m.as_of || ''
    const windows = obj.windows && typeof obj.windows === 'object' ? obj.windows : {}
    historyMeta.snapshots.push({
      file,
      date,
      data_version: m.data_version || '',
      as_of: m.as_of || date,
      snapshot_at: m.snapshot_at || null,
      reconstructed: m.reconstructed === true,
      replay_as_of: m.replay_as_of || null,
      delta_basis: m.delta_basis || null,
      window_counts: Object.fromEntries(
        ['day', 'week', 'month', 'year'].map((k) => [k, Array.isArray(windows[k]?.items) ? windows[k].items.length : 0]),
      ),
    })
  }
  if (historyMeta.snapshots.length) {
    const latest = historyMeta.snapshots[historyMeta.snapshots.length - 1]
    historyMeta.available = true
    historyMeta.count = historyMeta.snapshots.length
    historyMeta.latest_date = latest.date
    // 优先使用 rankings.meta.history_as_of（扫描器权威），否则用倒数第二份快照
    historyMeta.history_as_of =
      typeof metaOf(bundled['rankings.json'] || {}).history_as_of === 'string' &&
      metaOf(bundled['rankings.json'] || {}).history_as_of
        ? metaOf(bundled['rankings.json'] || {}).history_as_of
        : historyMeta.snapshots.length >= 2
          ? historyMeta.snapshots[historyMeta.snapshots.length - 2].date
          : null
    historyMeta.note = 'ok'
    const replayCount = historyMeta.snapshots.filter((s) => s.reconstructed).length
    report.push(
      `  ✓ real  history/（可选，${historyMeta.count} 份快照，最新 ${latest.date}${
        replayCount ? `，回放 ${replayCount} 份` : ''
      }）`,
    )
  } else {
    report.push('  ~ 可选  history/ 存在但无合法快照（前端降级）')
  }
} else {
  report.push('  ~ 可选  history/ 未提供（前端降级为相邻窗口口径）')
}
fs.writeFileSync(path.join(outDir, '_history.json'), JSON.stringify(historyMeta, null, 2) + '\n')

const sourceHealthPath = path.join(realDir, 'source-health.json')
const sourceHealth = {
  available: false,
  mode: null,
  checked_at: null,
  total: 0,
  ok_count: 0,
  fail_count: 0,
  sources: [],
  note: '可选未提供',
}
const rawSourceHealth = fs.existsSync(sourceHealthPath) ? readJsonSafe(sourceHealthPath) : null
if (rawSourceHealth) {
  const list = Array.isArray(rawSourceHealth)
    ? rawSourceHealth
    : Array.isArray(rawSourceHealth.sources)
      ? rawSourceHealth.sources
      : Array.isArray(rawSourceHealth.items)
        ? rawSourceHealth.items
        : []
  sourceHealth.available = true
  sourceHealth.mode =
    rawSourceHealth.meta?.mode || list.find((x) => x && x.mode)?.mode || null
  sourceHealth.checked_at =
    rawSourceHealth.checked_at || rawSourceHealth.meta?.checked_at || list.find((x) => x && x.checked_at)?.checked_at || null
  sourceHealth.sources = list
  sourceHealth.total = list.length
  sourceHealth.ok_count = list.filter((x) => x && x.ok === true).length
  sourceHealth.fail_count = list.filter((x) => !(x && x.ok === true)).length
  if (rawSourceHealth.meta) sourceHealth.meta = rawSourceHealth.meta
  report.push(`  ✓ real  source-health.json（可选，${sourceHealth.total} 源）`)
} else {
  report.push('  ~ 可选  source-health.json 未提供（前端隐藏采集健康）')
}
fs.writeFileSync(path.join(outDir, 'source-health.json'), JSON.stringify(sourceHealth, null, 2) + '\n')

/* ---- v0.9.0 可选：自动发现候选与发现榜（缺失时保留开发占位，不阻塞 strict） ---- */
for (const candidateFile of ['candidates.json', 'candidate-rankings.json']) {
  const realCandidatePath = path.join(realDir, candidateFile)
  const candidateObj = fs.existsSync(realCandidatePath) ? readJsonSafe(realCandidatePath) : null
  if (candidateObj) {
    fs.writeFileSync(path.join(outDir, candidateFile), JSON.stringify(candidateObj, null, 2) + '\n')
    const count = candidateFile === 'candidates.json'
      ? pickList(candidateObj, ['candidates']).length
      : Object.values(candidateObj?.windows || {}).reduce((sum, w) => sum + (Array.isArray(w?.items) ? w.items.length : 0), 0)
    report.push(`  ✓ real  ${candidateFile}（候选/榜单 ${count}）`)
  } else {
    report.push(`  ~ 可选  ${candidateFile} 未提供（保留开发占位）`)
  }
}


/* ============================ 2. 契约自检 ============================ */

const checks = []
const add = (level, name, detail) => checks.push({ level, name, detail })

const taxonomy = bundled['taxonomy.json'] || {}
const opportunities = pickList(bundled['opportunities.json'], ['opportunities', 'items'])
const rankings = bundled['rankings.json'] || {}
const sources = bundled['sources.json'] || {}
const playbooks = pickList(bundled['playbooks.json'], ['playbooks', 'items'])
const calendar = pickList(bundled['calendar.json'], ['events', 'items'])
const stats = bundled['stats.json'] || {}
const asOf =
  metaOf(rankings).as_of || metaOf(stats).as_of || metaOf(taxonomy).as_of || metaOf(sources).as_of || '2026-10-22'

const taxonomyCounts = {
  industries: Array.isArray(taxonomy.industries) ? taxonomy.industries.length : 0,
  human_needs: Array.isArray(taxonomy.human_needs) ? taxonomy.human_needs.length : 0,
  gap_types: Array.isArray(taxonomy.gap_types) ? taxonomy.gap_types.length : 0,
  regions: Array.isArray(taxonomy.regions) ? taxonomy.regions.length : 0,
  score_dimensions: Array.isArray(taxonomy.score_dimensions) ? taxonomy.score_dimensions.length : 0,
  grades: Array.isArray(taxonomy.grades) ? taxonomy.grades.length : 0,
}
const taxonomyOk =
  taxonomyCounts.industries === 14 &&
  taxonomyCounts.human_needs === 12 &&
  taxonomyCounts.gap_types === 12 &&
  taxonomyCounts.regions === 11 &&
  taxonomyCounts.score_dimensions === 10 &&
  taxonomyCounts.grades === 5
add(
  taxonomyOk ? 'PASS' : 'FAIL',
  'taxonomy',
  `行业 ${taxonomyCounts.industries}/14 · 需求 ${taxonomyCounts.human_needs}/12 · 信息差 ${taxonomyCounts.gap_types}/12 · 区域 ${taxonomyCounts.regions}/11 · 评分维 ${taxonomyCounts.score_dimensions}/10`,
)

const industryIds = new Set((taxonomy.industries || []).map((x) => x.id))
const regionIds = new Set((taxonomy.regions || []).map((x) => x.id))
const gapIds = new Set((taxonomy.gap_types || []).map((x) => x.id))
const dims = Array.isArray(taxonomy.score_dimensions) ? taxonomy.score_dimensions : []
const weightSum = dims.reduce((a, d) => a + (Number(d.weight) || 0), 0)
add(
  Math.abs(weightSum - 1) < 0.001 ? 'PASS' : 'FAIL',
  'weights',
  `10 维权重合计 ${weightSum.toFixed(3)}（应 = 1.000）`,
)

const oppIssues = []
const dimIds = dims.map((d) => d.id)
const banned = ['稳赚', '保证收益', '躺赚', '内幕', '100% 成功']
const seenIds = new Set()
const seenSlugs = new Set()
let sevenQOk = 0
let evidenceOk = 0
let formulaOk = 0
let sevenQTotal = 0
let evidenceTotal = 0
let formulaTotal = 0

for (const o of opportunities) {
  if (!o || typeof o !== 'object') continue
  if (seenIds.has(o.id)) oppIssues.push(`重复 id ${o.id}`)
  if (seenSlugs.has(o.slug)) oppIssues.push(`重复 slug ${o.slug}`)
  seenIds.add(o.id)
  seenSlugs.add(o.slug)
  if (o.industry_id && !industryIds.has(o.industry_id)) oppIssues.push(`${o.id} 行业枚举非法 ${o.industry_id}`)
  for (const r of o.region_ids || []) if (!regionIds.has(r)) oppIssues.push(`${o.id} 区域枚举非法 ${r}`)
  for (const g of o.gap_type_ids || []) if (!gapIds.has(g)) oppIssues.push(`${o.id} 信息差枚举非法 ${g}`)

  const q = o.seven_questions || {}
  sevenQTotal += 1
  const qOk =
    ['traffic', 'money', 'model', 'roi', 'audience', 'moat'].every(
      (k) => typeof q[k] === 'string' && q[k].trim().length >= 10 && !/待补充|TODO|TBD/i.test(q[k]),
    ) && Array.isArray(q.drivers) && q.drivers.length > 0
  if (qOk) sevenQOk += 1
  else oppIssues.push(`${o.id} 七问不完整`)

  const ev = Array.isArray(o.signal?.evidence) ? o.signal.evidence : []
  evidenceTotal += 1
  if (ev.length >= 1 && ev.every((e) => typeof e.url === 'string' && e.url.startsWith('http'))) evidenceOk += 1
  else oppIssues.push(`${o.id} 证据缺失或 URL 非法`)
  if (o.evidence_count !== ev.length) oppIssues.push(`${o.id} evidence_count 不一致`)

  formulaTotal += 1
  const d = o.scores?.dimensions || {}
  const hasAllDims = dimIds.length === 10 && dimIds.every((k) => typeof d[k] === 'number')
  if (hasAllDims) {
    const calc = round1(dims.reduce((a, dim) => a + (Number(d[dim.id]) || 0) * Number(dim.weight), 0) * 10)
    const total = Number(o.scores?.total)
    const momentum = Number(o.momentum) || 1
    const calcRank = round1(Math.min(100, total * (1 + 0.12 * (momentum - 1))))
    if (Math.abs(calc - total) <= 0.05 && Math.abs(calcRank - Number(o.rank_score)) <= 0.05) formulaOk += 1
    else oppIssues.push(`${o.id} 总分/rank_score 公式不一致（算得 ${calc} / ${calcRank}，文件 ${total} / ${o.rank_score}）`)
  } else {
    oppIssues.push(`${o.id} 评分维度不足 10 个`)
  }

  const text = JSON.stringify(o)
  for (const w of banned) if (text.includes(w)) oppIssues.push(`${o.id} 含禁用词「${w}」`)
  if (typeof o.verified !== 'boolean') oppIssues.push(`${o.id} verified 非布尔`)
  if (o.disclaimer == null || String(o.disclaimer).trim() === '') oppIssues.push(`${o.id} 缺少 disclaimer`)
  if (typeof o.last_activity === 'string' && o.last_activity > asOf) oppIssues.push(`${o.id} last_activity 晚于 as_of`)
  if (typeof o.first_seen === 'string' && typeof o.last_activity === 'string' && o.first_seen > o.last_activity) {
    oppIssues.push(`${o.id} first_seen 晚于 last_activity`)
  }
}
const industriesCovered = new Set(opportunities.map((o) => o.industry_id)).size
const regionsCovered = new Set(opportunities.flatMap((o) => o.region_ids || [])).size
const oppOk =
  opportunities.length >= 40 &&
  industriesCovered === 14 &&
  regionsCovered >= 10 &&
  oppIssues.length === 0
add(
  oppOk ? 'PASS' : 'FAIL',
  'opportunities',
  `${opportunities.length} 条（≥40）· 行业 ${industriesCovered}/14 · 区域 ${regionsCovered}/11 · 七问完整 ${sevenQOk}/${sevenQTotal} · 证据合规 ${evidenceOk}/${evidenceTotal} · 公式一致 ${formulaOk}/${formulaTotal}${oppIssues.length ? ` · 问题 ${oppIssues.length} 项` : ''}`,
)
if (oppIssues.length) {
  for (const msg of oppIssues.slice(0, 12)) add('FAIL', 'opportunity', msg)
  if (oppIssues.length > 12) add('FAIL', 'opportunity', `……另有 ${oppIssues.length - 12} 项问题`)
}

const windows = rankings.windows || {}
// v0.7.1：完整配额只在基准发布日强制；其他 as_of（每日运行）只校验结构，允许空榜
const BENCHMARK_AS_OF = '2026-10-22'
const isBenchmark = asOf === BENCHMARK_AS_OF
const windowQuota = isBenchmark ? { day: 6, week: 12, month: 20, year: 40 } : { day: 0, week: 0, month: 0, year: 0 }
const rankingIssues = []
for (const [key, quota] of Object.entries(windowQuota)) {
  const w = windows[key] || {}
  const items = Array.isArray(w.items) ? w.items : []
  if (items.length < quota) rankingIssues.push(`${key} 窗口 ${items.length} 条 < 配额 ${quota}`)
  const ranks = items.map((x) => x.rank)
  const contiguous = ranks.every((r, i) => r === i + 1)
  if (items.length && !contiguous) rankingIssues.push(`${key} 窗口 rank 不连续`)
  for (const it of items) if (!seenIds.has(it.opp_id)) rankingIssues.push(`${key} 窗口引用了不存在的 ${it.opp_id}`)
}
add(
  rankingIssues.length === 0 ? 'PASS' : 'FAIL',
  'rankings',
  `day ${(windows.day?.items || []).length} / week ${(windows.week?.items || []).length} / month ${(windows.month?.items || []).length} / year ${(windows.year?.items || []).length}（${isBenchmark ? '基准日配额 6/12/20/40' : '非基准日仅结构校验、允许空榜'}）`,
)

const rankingsMeta = metaOf(rankings)
const deltaBasis = rankingsMeta.delta_basis || 'adjacent-window'
add(
  ['history', 'adjacent-window'].includes(deltaBasis) ? 'PASS' : 'FAIL',
  'rankings-meta',
  `delta_basis=${deltaBasis} · history_as_of=${rankingsMeta.history_as_of ?? 'null'} · tie_breaker=${
    rankingsMeta.tie_breaker ? '已声明' : '兼容缺省'
  }`,
)

const sourceCategories = Array.isArray(sources.categories) ? sources.categories : []
const sourceCount = sourceCategories.reduce((a, c) => a + (Array.isArray(c.sources) ? c.sources.length : 0), 0)
add(
  sourceCount >= 60 && sourceCategories.length === 12 ? 'PASS' : 'FAIL',
  'sources',
  `${sourceCount} 个平台 / ${sourceCategories.length} 大类（≥60 / 12）`,
)

add(playbooks.length >= 12 ? 'PASS' : 'FAIL', 'playbooks', `${playbooks.length} 个剧本（≥12）`)
add(calendar.length >= 24 ? 'PASS' : 'FAIL', 'calendar', `${calendar.length} 个日历节点（≥24）`)

const kpi = stats.kpi || {}
add(
  Number(kpi.total_opps) === opportunities.length ? 'PASS' : 'FAIL',
  'stats',
  `kpi.total_opps=${kpi.total_opps ?? '—'}（实际 ${opportunities.length}）· new_today=${kpi.new_today ?? '—'} · A+ ${kpi.grade_a_plus ?? '—'}`,
)

/* ---- v0.2.0 可选数据校验（缺失不阻塞；存在但非法则 FAIL） ---- */
const historyIssues = []
for (const s of historyMeta.snapshots) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) historyIssues.push(`${s.file} 快照日期非法`)
  if (!s.snapshot_at) historyIssues.push(`${s.file} 缺少 meta.snapshot_at`)
  if (s.date > asOf) historyIssues.push(`${s.file} 快照日期晚于 as_of`)
  if (s.reconstructed && !s.replay_as_of) historyIssues.push(`${s.file} 回放快照缺少 meta.replay_as_of`)
}
add(
  historyMeta.available ? (historyIssues.length ? 'FAIL' : 'PASS') : 'PASS',
  'history',
  historyMeta.available
    ? `${historyMeta.count} 份快照（回放 ${
        historyMeta.snapshots.filter((s) => s.reconstructed).length
      }）· 最新 ${historyMeta.latest_date} · 上期 ${historyMeta.history_as_of}${
        historyIssues.length ? ` · 问题 ${historyIssues.length} 项` : ''
      }`
    : '可选未提供：delta 回退相邻窗口口径（不阻塞构建）',
)
for (const msg of historyIssues.slice(0, 5)) add('FAIL', 'history', msg)

const sourceHealthIssues = []
let unmatchedSourceHealth = 0
if (sourceHealth.available) {
  const knownSourceIds = new Set(
    sourceCategories.flatMap((c) => (Array.isArray(c.sources) ? c.sources.map((s) => s.id) : [])),
  )
  const normUrl = (u) => String(u || '').trim().replace(/\/+$/, '').toLowerCase()
  const knownUrls = new Set(
    sourceCategories.flatMap((c) => (Array.isArray(c.sources) ? c.sources.map((s) => normUrl(s.url)) : [])),
  )
  const knownNames = new Set(
    sourceCategories.flatMap((c) => (Array.isArray(c.sources) ? c.sources.map((s) => s.name) : [])),
  )
  const rawShMeta = rawSourceHealth?.meta && typeof rawSourceHealth.meta === 'object' ? rawSourceHealth.meta : {}
  const hasV2 = String(rawShMeta.data_version || '') >= '0.3.0' || sourceHealth.sources.some((s) => s && 'mode' in s)
  if (sourceHealth.mode && !['online-fetch', 'cache', 'offline'].includes(sourceHealth.mode)) {
    sourceHealthIssues.push(`meta.mode 非法：${sourceHealth.mode}`)
  }
  for (const s of sourceHealth.sources) {
    if (!s || typeof s !== 'object') {
      sourceHealthIssues.push('source-health 条目非法')
      continue
    }
    // v0.3.1：采集源 id/url/name 可能变化；未匹配 sources.json 只提示，不阻塞 strict 构建
    const matched = knownSourceIds.has(s.id) || knownUrls.has(normUrl(s.url)) || knownNames.has(s.name)
    if (!matched) unmatchedSourceHealth += 1
    if (typeof s.ok !== 'boolean') sourceHealthIssues.push(`${s.id} ok 非布尔`)
    if (s.checked_at && !/^\d{4}-\d{2}-\d{2}/.test(s.checked_at)) sourceHealthIssues.push(`${s.id} checked_at 非法`)
    if (s.latency_ms != null && !(Number(s.latency_ms) >= 0)) sourceHealthIssues.push(`${s.id} latency_ms 非法`)
    if (hasV2) {
      if (!['online-fetch', 'cache', 'offline'].includes(s.mode)) sourceHealthIssues.push(`${s.id} mode 非法`)
      if (typeof s.cached !== 'boolean') sourceHealthIssues.push(`${s.id} cached 非布尔`)
      if (!Number.isInteger(s.latency_ms) || s.latency_ms < 0) sourceHealthIssues.push(`${s.id} latency_ms 非整数≥0`)
      if (s.http_status != null && !Number.isInteger(s.http_status)) sourceHealthIssues.push(`${s.id} http_status 非整数`)
      if (s.ok === false && !(typeof s.error === 'string' && s.error.trim())) {
        sourceHealthIssues.push(`${s.id} 失败源缺少非空 error 原因`)
      }
      if (s.items != null && (!Number.isInteger(s.items) || s.items < 0)) sourceHealthIssues.push(`${s.id} items 非整数≥0`)
    }
  }
}
add(
  sourceHealth.available ? (sourceHealthIssues.length ? 'FAIL' : 'PASS') : 'PASS',
  'source-health',
  sourceHealth.available
    ? `${sourceHealth.total} 源 · 成功 ${sourceHealth.ok_count} / 失败 ${sourceHealth.fail_count} · mode ${
        sourceHealth.mode || '—'
      } · 检查于 ${sourceHealth.checked_at || '—'}${
        unmatchedSourceHealth ? ` · 未匹配矩阵 ${unmatchedSourceHealth}` : ''
      }${sourceHealthIssues.length ? ` · 问题 ${sourceHealthIssues.length} 项` : ''}`
    : '可选未提供：前端隐藏采集健康（不阻塞构建）',
)
for (const msg of sourceHealthIssues.slice(0, 5)) add('FAIL', 'source-health', msg)

if (strict && mockFiles.length) {
  add('FAIL', 'data-source', `${mockFiles.length} 个文件仍为 mock：${mockFiles.join(', ')}；strict 构建必须全部为真实数据`)
}

/* ============================ 3. 写文件 & 输出 ============================ */

const pickMeta = (...candidates) => {
  for (const c of candidates) if (c && typeof c === 'object' && Object.keys(c).length) return c
  return {}
}
const sourceMeta = pickMeta(metaOf(rankings), metaOf(stats), metaOf(taxonomy))
const meta = {
  source: mockFiles.length === 0 ? 'real' : mockFiles.length === FILES.length ? 'mock' : 'mixed',
  files: filesMeta,
  mock_files: mockFiles,
  // 构建可复现：不使用构建时刻，优先采用数据侧确定性时间戳
  synced_at:
    (sourceHealth.meta && typeof sourceHealth.meta === 'object' && sourceHealth.meta.generated_at) ||
    `${asOf}T00:00:00+08:00`,
  data_version: sourceMeta.data_version || metaOf(taxonomy).data_version || 'unknown',
  as_of: asOf,
  delta_basis: deltaBasis,
  history_as_of: rankingsMeta.history_as_of ?? historyMeta.history_as_of ?? null,
  counts: {
    opportunities: opportunities.length,
    rankings: Object.fromEntries(Object.entries(windowQuota).map(([k]) => [k, (windows[k]?.items || []).length])),
    sources: sourceCount,
    playbooks: playbooks.length,
    calendar: calendar.length,
    history_snapshots: historyMeta.count,
    history_replay_snapshots: historyMeta.snapshots.filter((s) => s.reconstructed).length,
    source_health_available: sourceHealth.available,
    source_health_ok: sourceHealth.ok_count,
    source_health_total: sourceHealth.total,
    source_health_failed: sourceHealth.fail_count,
    source_health_mode: sourceHealth.mode || null,
  },
  optional: {
    history: {
      available: historyMeta.available,
      count: historyMeta.count,
      latest_date: historyMeta.latest_date,
      history_as_of: historyMeta.history_as_of,
      snapshots: historyMeta.snapshots,
    },
    source_health: {
      available: sourceHealth.available,
      mode: sourceHealth.mode || null,
      checked_at: sourceHealth.checked_at,
      total: sourceHealth.total,
      ok: sourceHealth.ok_count,
      failed: sourceHealth.fail_count,
      failed_ids: sourceHealth.sources.filter((s) => s && s.ok === false).map((s) => s.id),
    },
  },
  validation: {
    passed: checks.filter((c) => c.level === 'PASS').length,
    failed: checks.filter((c) => c.level === 'FAIL').length,
    checks,
  },
  notes: mockFiles.length
    ? '部分数据为契约占位（mock），仅开发预览可用；正式构建需真实数据通过 strict 校验。'
    : '全部核心数据来自 ../data 真实产出并通过契约自检；history / source-health 为 v0.3 可选增强，缺失不影响构建。',
}
fs.writeFileSync(path.join(outDir, '_meta.json'), JSON.stringify(meta, null, 2) + '\n')

console.log('[sync-data] app/src/data 已更新')
console.log(report.join('\n'))
console.log('')
console.log('[verify] 契约自检')
for (const c of checks) {
  if (c.level === 'FAIL' && c.name === 'opportunity') console.log(`  FAIL  ${c.detail}`)
  else if (c.name !== 'opportunity') console.log(`  ${c.level === 'PASS' ? 'PASS' : 'FAIL'}  ${c.name.padEnd(14)} ${c.detail}`)
}
const fails = checks.filter((c) => c.level === 'FAIL')
console.log('')
console.log(
  `[verify] 机会数 ${opportunities.length} · 榜单 day ${(windows.day?.items || []).length} / week ${(windows.week?.items || []).length} / month ${(windows.month?.items || []).length} / year ${(windows.year?.items || []).length} · 数据源 ${sourceCount} · 剧本 ${playbooks.length} · 日历 ${calendar.length} · 历史快照 ${historyMeta.count}（回放 ${
    historyMeta.snapshots.filter((s) => s.reconstructed).length
  }）· 采集健康 ${sourceHealth.available ? `${sourceHealth.ok_count}/${sourceHealth.total} ok · ${sourceHealth.mode || '—'}` : '未提供'}`,
)
console.log(`[verify] 结果：${fails.length ? `FAIL（${fails.length} 项）` : 'PASS'} · 数据来源=${meta.source} · 数据版本=${meta.data_version} · as_of=${asOf} · delta_basis=${deltaBasis}`)

if (strict && fails.length) {
  console.error('[sync-data] strict 模式校验失败，终止构建。请先让 ../data 满足 docs/12 契约。')
  process.exit(1)
}
if (!strict && missingReal.length) {
  console.log(`[sync-data] 开发模式：${missingReal.length} 个文件使用 mock 占位，页面会显示「演示数据」标记。`)
}
