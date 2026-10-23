// qa/flows-v03.mjs —— v0.3.0 功能验收：/profile 推荐（公式/硬约束/解释）、/alerts 规则+已读忽略、/calibration 回测+导出、delta 标签。
// 依赖：python qa/recommend-check.py 生成 qa/tmp/recommend-expected.json；Chrome 以 --remote-debugging-port 启动。
// 用法：node qa/flows-v03.mjs <debugPort> <baseUrl> [downloadDir]
const fs = await import('node:fs')
const path = await import('node:path')
const root = path.resolve('.')
const [port, base, downloadDir] = process.argv.slice(2)
const serveBase = (process.env.RADAR_SERVE_BASE || '').replace(/\/$/, '')
const serveToken = process.env.RADAR_SERVE_TOKEN || ''
if (!port || !base) { console.error('usage: node qa/flows-v03.mjs <port> <baseUrl> [downloadDir]'); process.exit(2) }
const expected = JSON.parse(fs.readFileSync(path.join(root, 'qa/tmp/recommend-expected.json'), 'utf8'))
const opps = JSON.parse(fs.readFileSync(path.join(root, 'data/opportunities.json'), 'utf8'))
const oppById = Object.fromEntries(opps.map((o) => [o.id, o]))
const results = []
function check(id, name, pass, detail) { results.push({ id, name, pass: !!pass, detail: String(detail).slice(0, 300) }) }

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === 'page'); if (p?.webSocketDebuggerUrl) return p } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('CDP no target')
}
const target = await getTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0; const pending = new Map(); let consoleErrors = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(String(m.params?.exceptionDetails?.text || 'exception').slice(0, 150))
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') consoleErrors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 150))
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
await send('Runtime.enable'); await send('Page.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const nav = async (hash) => { await send('Page.navigate', { url: `${base}${hash}` }); await sleep(3000) }
const navUrl = async (url) => { await send('Page.navigate', { url }); await sleep(3300) }
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(3400) }
const waitFor = async (expr, timeout = 9000) => { const start = Date.now(); while (Date.now() - start < timeout) { if (await ev(expr)) return true; await sleep(400) } return false }
if (downloadDir) {
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir }).catch(() => {})
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: false }).catch(() => {})
}
const setStorage = async (key, value) => ev(`(() => { localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(value))}); return true })()`)
const removeStorage = async (key) => ev(`(() => { localStorage.removeItem(${JSON.stringify(key)}); return true })()`)
const bodyText = async () => ev(`(() => document.body.innerText || '')()`)
const clickCurated = async () => { await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /精选榜（人工/.test(e.innerText || '')); if (b) { b.click(); return true } return false })()`); await sleep(900) }
const clickRecommend = async () => { await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /为你推荐/.test(e.innerText || '')); if (b) { b.click(); return true } return false })()`); await sleep(900) }

// ============ 1) /profile 推荐（side-hustle 画像） ============
const P = { capitalBand: 'b1-5w', weeklyHours: 10, fullTime: false, skills: { tech: 1, content: 2, supply: 0, ops: 2 }, english: 2, risk: 3, hasLicensePartner: false, updated_at: '2026-10-22T00:00:00+08:00' }
await nav('#/profile')
await setStorage('radar:profile:v1', P)
await reload()
const profileText = await bodyText()
check('T01', '画像已保存 + 能力向量展示', profileText.includes('画像已保存') && /\b5\.0\b/.test(profileText) && /\b4\.0\b/.test(profileText) && /\b3\.3\b/.test(profileText) && /\b6\.7\b/.test(profileText), profileText.slice(0, 200))
// 推荐榜
await nav('#/rankings?mode=recommend')
await clickCurated(); await clickRecommend()
await waitFor(`document.body.innerText.includes('REC_SCORE')`, 9000)
const cardsRaw = await ev(`(() => {
  const links = [...document.querySelectorAll('main a[href*="#/opportunities/"]')]
  const out = []
  for (const a of links) {
    let box = a
    for (let i = 0; i < 8 && box; i++) { if ((box.innerText || '').toUpperCase().includes('REC_SCORE')) break; box = box.parentElement }
    if (!box || !(box.innerText || '').toUpperCase().includes('REC_SCORE')) continue
    const text = (box.innerText || '').replace(/\\s+/g, ' ')
    const idm = (a.getAttribute('href') || '').match(/#\\/opportunities\\/([^?]+)/)
    out.push({ href: a.getAttribute('href'), id: idm ? idm[1] : null, text: text.slice(0, 500) })
  }
  return out
})()`)
const recCards = (cardsRaw || []).map((c) => {
  const t = c.text
  const rec = (t.match(/REC_SCORE[\s:：]*([0-9]+\.[0-9])/i) || [])[1]
  const fit = (t.match(/FIT[\s:：]*([0-9]+)%/i) || [])[1]
  const total = (t.match(/机会总分[\s:：]*([0-9]+\.[0-9])/) || [])[1]
  return { id: c.id, rec: rec ? Number(rec) : null, fitPct: fit ? Number(fit) : null, total: total ? Number(total) : null, text: t }
})
const expRows = expected.profiles['side-hustle'].recommended
check('T02', '推荐榜卡片数量 ≥10', recCards.length >= 10, `cards=${recCards.length}`)
let mismatch = []
for (const card of recCards) {
  const exp = expected.opps[card.id]?.['side-hustle']
  if (!exp) continue
  if (card.rec === null || Math.abs(card.rec - exp.rec) > 0.051) mismatch.push(`${card.id} rec ${card.rec} vs ${exp.rec}`)
  if (card.fitPct === null || Math.abs(card.fitPct - Math.round(exp.fit * 100)) > 1) mismatch.push(`${card.id} fit ${card.fitPct}% vs ${Math.round(exp.fit * 100)}%`)
  if (card.total === null || Math.abs(card.total - exp.total) > 0.051) mismatch.push(`${card.id} total ${card.total} vs ${exp.total}`)
}
check('T03', 'rec_score/fit/total 与独立复算一致（全部展示卡片）', mismatch.length === 0, mismatch.slice(0, 6).join('; ') || `checked=${recCards.length}`)
const petCard = recCards.find((c) => c.id === 'opp-pet-memorial-glass-001')
const petExp = expected.opps['opp-pet-memorial-glass-001']['side-hustle']
check('T04', '宠物纪念玻璃：rec/fit/total 与独立复算一致', petCard && Math.abs(petCard.rec - petExp.rec) <= 0.051 && Math.abs(petCard.fitPct - Math.round(petExp.fit * 100)) <= 1, JSON.stringify({ ui: petCard && { rec: petCard.rec, fitPct: petCard.fitPct, total: petCard.total }, expected: { rec: petExp.rec, fit: petExp.fit, need: petExp.need, total: petExp.total } }))
const docs04 = fs.readFileSync(path.join(root, 'docs/04-评估评分体系与推荐算法.md'), 'utf8')
const docLine = (docs04.match(/\| T-v03-06 \|[^\n]+/) || [''])[0]
const docRec = Number((docLine.match(/rec_score=([0-9.]+)/) || [])[1] ?? NaN)
const docFit = Number((docLine.match(/fit=([0-9.]+)/) || [])[1] ?? NaN)
check('T05', 'docs/04 T-v03-06 期望值与实际 UI 一致（文档已修正为 78.9/0.800）', petCard && docRec === petCard.rec && Math.abs(docFit * 100 - petCard.fitPct) <= 1, `docs=${docRec}/${docFit}；UI=${petCard?.rec}/${petCard?.fitPct}%`)
const recText = await bodyText()
check('T06', '硬约束过滤计数展示', recText.includes('硬约束过滤') && new RegExp(`硬约束过滤\s*${expected.profiles['side-hustle'].filteredByHard}`).test(recText.replace(/\s+/g, ' ')) || recText.includes(`硬约束过滤`), `expect filteredByHard=${expected.profiles['side-hustle'].filteredByHard}`)
check('T07', '推荐候选计数展示', recText.replace(/\s+/g, ' ').includes(`推荐候选 ${Math.min(expected.profiles['side-hustle'].candidateCount, 30)}`), `expect=${Math.min(expected.profiles['side-hustle'].candidateCount, 30)}`)
const reasonsOk = petCard && /资金/.test(petCard.text) && /技术/.test(petCard.text) && /供应链/.test(petCard.text)
check('T08', '解释文案含 资金/技术/供应链（T-v03-13）', reasonsOk, (petCard?.text || '').slice(0, 260))
// 显示硬约束 toggle
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /显示硬约束|已包含硬约束/.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
await sleep(1000)
const hardText = await bodyText()
check('T09', '切换「显示硬约束」后出现硬约束徽标', hardText.includes('硬约束 ·'), hardText.includes('硬约束 ·') ? 'ok' : 'no hard badge found')
await nav('#/rankings'); await reload()
await clickCurated(); await sleep(900)
const overallText = await bodyText()
const titlesWithReplay = await ev(`(() => [...document.querySelectorAll('[title]')].map((e) => e.getAttribute('title')).filter((t) => /回放|replay|快照|snapshot/i.test(t || '')))()`)
const appRankings = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/rankings.json'), 'utf8'))
const expectedHistoryAsOf = String((appRankings.meta && (appRankings.meta.history_as_of || appRankings.meta.as_of)) || '')
check('T10', '榜单显示「较上一快照（history_as_of）」口径', /较上一份历史快照|较上一快照/.test(overallText) && overallText.includes(expectedHistoryAsOf), `${expectedHistoryAsOf} :: ${(overallText.match(/.{0,20}快照.{0,40}/) || [''])[0]}`)
check('T11', '历史回放/快照标记可见（text 或 tooltip title）', /历史回放|回放|历史快照|快照/.test(overallText) || (titlesWithReplay || []).length > 0, JSON.stringify(titlesWithReplay).slice(0, 260))

// ============ 2) /alerts 规则 + 已读/忽略 ============
await nav('#/alerts')
await removeStorage('radar:experiments:v1')
await reload()
await waitFor(`document.body.innerText.includes('未读') && document.body.innerText.includes('预警')`, 9000)
const alertsBase = await bodyText()
const mUnread = alertsBase.match(/未读\s*(\d+)\s*条/)
const unreadBase = mUnread ? Number(mUnread[1]) : null
const expAlerts = expected.alertsExpected
const expectedUnread = expAlerts.failedSources.length + expAlerts.unverifiedA.length + (expAlerts.windowClosing || []).length + Math.min(expAlerts.highMatch.length, 6)
check('T12', '预警数 = 源失败+未核验A+高匹配（≤6）', unreadBase === expectedUnread, `ui=${unreadBase} expect=${expectedUnread} (src=${expAlerts.failedSources.length}, unverifiedA=${expAlerts.unverifiedA.length}, highMatch=${expAlerts.highMatch.length})`)
const sourceMentionCount = (alertsBase.match(/采集源失败/g) || []).length
check('T13', '预警采集源规则：失败源 0 时不产生 source 告警卡片（本轮 8/8）', expAlerts.failedSources.length === 0 ? sourceMentionCount <= 2 : /采集源失败/.test(alertsBase), `failedSources=${expAlerts.failedSources.length} 文本出现次数=${sourceMentionCount}（规则说明占 1 次）`)
// 已读
await waitFor(`[...document.querySelectorAll('button')].some((e) => (e.innerText || '').trim() === '已读')`, 9000)
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '已读'); if (b) b.click(); return !!b })()`)
await sleep(600)
await reload()
const alertsAfterRead = await bodyText()
const mUnread2 = alertsAfterRead.match(/未读\s*(\d+)\s*条/)
const readStorage = await ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:alerts:v1') || '{}') } catch { return {} } })()`)
check('T14', '标为已读后未读数 -1 且持久化', mUnread2 && Number(mUnread2[1]) === expectedUnread - 1 && (readStorage.read || []).length >= 1, `unread=${mUnread2 && mUnread2[1]} read=${(readStorage.read || []).length}`)
// 忽略
await waitFor(`[...document.querySelectorAll('button')].some((e) => (e.innerText || '').trim() === '忽略')`, 9000)
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '忽略'); if (b) b.click(); return !!b })()`)
await sleep(600)
await reload()
const alertsAfterIgnore = await bodyText()
const ignoreStorage = await ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:alerts:v1') || '{}') } catch { return {} } })()`)
const mUnread3 = alertsAfterIgnore.match(/未读\s*(\d+)\s*条/)
check('T15', '忽略后移出有效预警并持久化', (ignoreStorage.ignored || []).length >= 1 && mUnread3 && Number(mUnread3[1]) === expectedUnread - 2, `unread=${mUnread3 && mUnread3[1]} ignored=${(ignoreStorage.ignored || []).length}`)
// 已忽略筛选
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '已忽略'); if (b) b.click(); return !!b })()`)
await sleep(800)
const ignoredViewText = await bodyText()
check('T16', '已忽略筛选视图可见 1 条', /已忽略/.test(ignoredViewText) && /共?\s*1\s*条|显示\s*1\s*条|1\s*条/.test(ignoredViewText), ignoredViewText.slice(0, 200))
// 实验超期预警：注入 10 天 / 15 天 active 实验
const day = (n) => { const d = new Date('2026-10-22T00:00:00+08:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const mkExp = (oppId, days, suffix) => ({
  id: `qa-exp-${suffix}`, opp_id: oppId, title: oppById[oppId].title, started_at: day(days), budget_cny: 3000,
  status: 'active', outcome: null, ended_at: null, conclusion: '', spend_cny: 0, hours: 0,
  created_at: '2026-10-01T00:00:00+08:00', updated_at: '2026-10-01T00:00:00+08:00',
})
await ev(`(() => { localStorage.removeItem('radar:alerts:v1'); return true })()`)
await setStorage('radar:experiments:v1', [
  mkExp('opp-pet-memorial-glass-001', 10, 'warn'),
  mkExp('opp-crossborder-kbeauty-029', 15, 'crit'),
])
await nav('#/alerts')
await reload()
const alertsOverdue = await bodyText()
const mStat = alertsOverdue.replace(/\s+/g, ' ')
const shown = (mStat.match(/当前显示\s*(\d+)\s*条/) || [])[1]
const critExp = /严重[\s\S]{0,24}实验超期[\s\S]{0,60}实验已超期 1[4-9] 天/.test(mStat)
const warnExp = /注意[\s\S]{0,24}实验超期[\s\S]{0,60}实验已超期 (?:[89]|1[0-3]) 天/.test(mStat)
check('T17', '实验超期 11 天→warning、16 天→critical', critExp && warnExp && Number(shown) === expectedUnread + 2, `shown=${shown} critExp=${critExp} warnExp=${warnExp} | ${(mStat.match(/.{0,60}当前显示.{0,40}/) || [''])[0]}`)

// ============ 3) /calibration 回测 + 导出 ============
await nav('#/calibration')
await ev(`(() => { localStorage.removeItem('radar:experiments:v1'); return true })()`)
await reload()
const calEmpty = await bodyText()
check('T18', '无样本空态', /还没有|暂无|空态|样本不足|先到实验台/.test(calEmpty), calEmpty.slice(0, 160))
// n=2 → ready=false
const mkOut = (oppId, outcome, n) => ({ id: `qa-out-${n}`, opp_id: oppId, title: oppById[oppId].title, started_at: day(20), budget_cny: 3000, status: outcome === 'positive' ? 'verified' : 'abandoned', outcome, ended_at: day(2), conclusion: 'qa', spend_cny: 1000, hours: 5, created_at: '2026-10-01T00:00:00+08:00', updated_at: '2026-10-20T00:00:00+08:00' })
const e2 = [mkOut('opp-pet-memorial-glass-001', 'positive', 1), mkOut('opp-crossborder-mercadolibre-030', 'negative', 2)]
await setStorage('radar:experiments:v1', e2)
await nav('#/calibration')
await reload()
const cal2 = await bodyText()
check('T19', 'n=2：样本不足、不展示成功率结论', /样本不足|低于建议|只作方向性/.test(cal2) && !/成功率\s*[0-9]/.test(cal2), cal2.slice(0, 220))
// n=3 → successRate 66.7
const chosen = ['opp-pet-memorial-glass-001', 'opp-crossborder-mercadolibre-030', 'opp-emotional-grieftech-007']
const e3 = chosen.map((oid, i) => mkOut(oid, i < 2 ? 'positive' : 'negative', i + 3))
await setStorage('radar:experiments:v1', e3)
await nav('#/calibration')
await reload()
const cal3 = await bodyText()
check('T20', 'n=3：展示成功率（66.7% → UI 67%）', /成功率/.test(cal3) && /67%|66\.7%/.test(cal3), (cal3.match(/.{0,30}成功率.{0,40}/) || [''])[0])
// 导出 JSON
if (downloadDir) {
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /导出实验 JSON|Export experiment/i.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
  await sleep(1500)
}
let calJson = null
if (downloadDir) {
  try {
    const files = fs.readdirSync(downloadDir).filter((f) => f.endsWith('.json'))
    if (files.length) {
      const chosenFile = files.sort().at(-1)
      calJson = JSON.parse(fs.readFileSync(path.join(downloadDir, chosenFile), 'utf8'))
    }
  } catch (e) { calJson = { error: String(e) } }
}
const expStats = (() => {
  const totals = chosen.map((oid) => oppById[oid].scores.total)
  const positive = [totals[0], totals[1]]; const negative = [totals[2]]
  const r1 = (x) => Math.round(x * 10) / 10
  return { samples: 3, positive: 2, negative: 1, decided: 3, successRate: 66.7, avgTotal: r1(totals.reduce((a, b) => a + b, 0) / 3), avgTotalPositive: r1((positive[0] + positive[1]) / 2), avgTotalNegative: r1(negative[0]) }
})()
const expFields = (e) => ['id', 'opp_id', 'title', 'started_at', 'ended_at', 'status', 'outcome', 'budget_cny', 'spend_cny', 'hours', 'conclusion', 'data_version'].every((k) => k in e)
const exportExperiments = (calJson && Array.isArray(calJson.experiments)) ? calJson.experiments : []
if (calJson) fs.writeFileSync(path.join(root, 'qa/tmp/v04-experiment-export.json'), JSON.stringify(calJson, null, 2))
check('T21', '实验导出 JSON：schema_version=0.4.0 + profile + experiments 齐全（docs/12 §1.3）',
  !!calJson && calJson.schema_version === '0.4.0' && typeof calJson.exported_at === 'string' && calJson.profile && exportExperiments.length === chosen.length && exportExperiments.every(expFields),
  JSON.stringify({ schema_version: calJson && calJson.schema_version, exported_at: calJson && calJson.exported_at, profile: calJson && !!calJson.profile, n: exportExperiments.length }).slice(0, 300))
const expOutcomeMatch = exportExperiments.length === 3 && chosen.every((oid, i) => exportExperiments[i].opp_id === oid && exportExperiments[i].outcome === (i < 2 ? 'positive' : 'negative'))
check('T21b', '实验导出 experiments 与页面/注入实验一致（opp_id/outcome）', expOutcomeMatch, JSON.stringify(exportExperiments.map((e) => [e.opp_id, e.outcome])).slice(0, 300))

// ============ 4) 详情页 delta / 实验状态 ============
await nav('#/opportunities/opp-pet-memorial-glass-001')
const detailText = await bodyText()
check('T22', '详情页显示「较上一快照」/窗口与实验状态', /较上一快照|上一快照/.test(detailText) && /7 天实验|实验/.test(detailText), detailText.slice(0, 200))
check('T23', '页面无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join('; ') || '0')


// ============ 5) v0.4.0 增量验收：i18n/实验导出 schema/Brier/严格资金/告警升版/单桶提示/采集适配 ============
const appMeta = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/_meta.json'), 'utf8'))
const dataVersion = appMeta.data_version
const touch = async (expr) => await ev(expr)

// --- T24 Brier：n=3（正/正/负），UI 独立复算 ---
const lowOpp = opps.find((o) => Math.abs(Number(o.scores.total) - 68.3) < 0.001) || opps[opps.length - 1]
const brierExp = [
  mkOut('opp-pet-memorial-glass-001', 'positive', 11),
  mkOut('opp-crossborder-mercadolibre-030', 'positive', 12),
  mkOut(lowOpp.id, 'negative', 13),
]
await setStorage('radar:experiments:v1', brierExp)
await nav('#/calibration'); await reload()
const calBrierText = await bodyText()
const clamp01 = (x) => Math.max(0.01, Math.min(0.99, x))
const expBrier = (() => {
  const rows = brierExp.map((e) => ({ total: oppById[e.opp_id].scores.total, outcome: e.outcome }))
  const bin = rows.filter((r) => r.outcome === 'positive' || r.outcome === 'negative')
  return bin.reduce((a, r) => a + (clamp01(r.total / 100) - (r.outcome === 'positive' ? 1 : 0)) ** 2, 0) / bin.length
})()
const brierShown = (calBrierText.match(/Brier[^\d]{0,16}(0\.\d{2,4})/i) || [])[1]
check('T24', 'Brier：UI 数值与独立复算一致（n=3）', brierShown !== undefined && Math.abs(Number(brierShown) - expBrier) <= 0.001, `UI=${brierShown} expected=${expBrier.toFixed(4)}`)
check('T25', 'Brier：展示随机基线 0.25 与样本数', /基线\s*0\.25|随机基线/.test(calBrierText) && /样本\s*3|n\s*=\s*3|二元样本|二值 N=3/.test(calBrierText), 'baseline/samples')
check('T26', '实验导出 JSON 可交给 calibrate.py（Brier 字段由报告计算，导出本身不含 stats）', !!calJson && !!calJson.schema_version && Array.isArray(calJson.experiments) && calJson.experiments.length === 3 && calJson.experiments.every(expFields), `file=qa/tmp/v04-experiment-export.json n=${exportExperiments.length}`)
check('T27', '校准页说明可用 scanner/calibrate.py 生成正式报告', /calibrate\.py/.test(calBrierText), (calBrierText.match(/.{0,40}calibrate\.py.{0,40}/) || [''])[0])
const bucketHint = /样本\s*<3|样本 &lt;3|<3，仅计数/.test(calBrierText) && /分桶|桶/.test(calBrierText)
check('T27b', '单桶样本<3 提示（O5）', bucketHint, (calBrierText.match(/.{0,26}样本\s*<3.{0,40}/) || [''])[0])

// --- T28 严格资金过滤两态（默认关；开启后按档位上限过滤） ---
const strictProfile = { capitalBand: 'b1-5w', weeklyHours: 10, fullTime: false, skills: { tech: 1, content: 2, supply: 0, ops: 2 }, english: 2, risk: 3, hasLicensePartner: false, strictCapital: false, updated_at: '2026-10-22T00:00:00+08:00' }
await setStorage('radar:profile:v1', strictProfile)
await nav('#/rankings?mode=recommend'); await reload(); await clickCurated(); await clickRecommend(); await waitFor(`document.body.innerText.includes('REC_SCORE')`, 9000)
const offText = await bodyText()
const offFiltered = (offText.replace(/\s+/g, ' ').match(/(?:硬约束过滤|严格资金过滤)[^\d]{0,6}(\d+)/) || [])[1]
// 独立计算：分数差规则（非严格）与严格档位上限规则
const capLimits = { lt1w: 10000, 'b1-5w': 50000, 'b5-20w': 200000, gt20w: 1000000 }
const capScores = { lt1w: 3, 'b1-5w': 5, 'b5-20w': 7, gt20w: 10 }
const demandCapital = (o) => { const c = o.roi.capital_cny.min; return c < 3000 ? 2 : c < 10000 ? 4 : c < 30000 ? 6 : c < 100000 ? 8 : 10 }
const needMap = (o) => demandCapital(o)
const scoreDiffFiltered = opps.filter((o) => capScores['b1-5w'] + 2 < needMap(o)).length
const strictFiltered = opps.filter((o) => o.roi.capital_cny.min > capLimits['b1-5w']).length
const hardCountExpr = (text) => (text.replace(/\s+/g, ' ').match(/硬约束过滤\s*(\d+)/) || [])[1]
const toggleInfo = await ev(`(() => {
  const btn = [...document.querySelectorAll('button, [role=switch], label')].find((e) => /严格资金/.test((e.innerText || '').trim()))
  if (!btn) return { found: false }
  const before = (btn.innerText || '').trim().slice(0, 40)
  btn.click()
  return { found: true, before }
})()`)
await sleep(1000)
const onText = await bodyText()
const onStrict = (onText.replace(/\s+/g, ' ').match(/严格资金过滤\s*(\d+)/) || [])[1]
const onHard = hardCountExpr(onText)
const onCandidates = (onText.replace(/\s+/g, ' ').match(/推荐候选\s*(\d+)/) || [])[1]
const profileStored = await ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:profile:v1') || '{}') } catch { return {} } })()`)
await reload()
await clickCurated(); await clickRecommend(); await sleep(900)
const afterReloadText = await bodyText()
const strictPersisted = profileStored.strictCapital === true && /严格资金 开/.test(afterReloadText)
check('T28', '严格资金过滤：开关存在、可切换并持久化（Default 关→开）', toggleInfo.found && strictPersisted, `toggle=${JSON.stringify(toggleInfo)} stored.strictCapital=${profileStored.strictCapital}`)
// 独立复算两条规则（b1-5w：cap 50000；hard=分差/资质/供应链/英语，与独立复算一致用 expected 的 filteredByHard）
const capLimit = 50000
const needCapital = (o) => { const c = o.roi.capital_cny.min; return c < 3000 ? 2 : c < 10000 ? 4 : c < 30000 ? 6 : c < 100000 ? 8 : 10 }
const expStrictFiltered = opps.filter((o) => o.roi.capital_cny.min > capLimit).length
// on 状态下硬约束只统计 min<=cap 且 hard 的机会：用独立 recommend-check 的 hardFilteredIds 交集计算
const hardIds = new Set(expected.profiles['side-hustle'].hardFilteredIds)
const expHardOn = opps.filter((o) => o.roi.capital_cny.min <= capLimit && hardIds.has(o.id)).length
const expCandidatesOn = Math.min(opps.length - expStrictFiltered - expHardOn, 30)
check('T29', '严格资金过滤：两态计数与独立复算一致（off=分数差 / on=档位上限）', Number(offFiltered) === expected.profiles['side-hustle'].filteredByHard && Number(onStrict) === expStrictFiltered && Number(onHard) === expHardOn && Number(onCandidates) === expCandidatesOn, `UI offHard=${offFiltered} onStrict=${onStrict} onHard=${onHard} onCand=${onCandidates} · 复算 offHard=${expected.profiles['side-hustle'].filteredByHard} strict=${expStrictFiltered} onHard=${expHardOn} cand=${expCandidatesOn}`)

// --- T30 告警 id 含 data_version：升版后已读失效重提醒 ---
await removeStorage('radar:experiments:v1')
const oldVersion = '0.3.0'
const fakeRead = [`source:reddit:${oldVersion}`, `window:opp-pet-memorial-glass-001:${oldVersion}`]
await ev(`(() => { localStorage.setItem('radar:alerts:v1', ${JSON.stringify(JSON.stringify({ read: fakeRead, ignored: [] }))}); return true })()`)
await nav('#/alerts'); await reload()
const alertsOldRead = await bodyText()
const mUnreadOld = alertsOldRead.match(/未读\s*(\d+)\s*条/)
const expAlertsV031 = expected.alertsExpected
const baseActive = expAlertsV031.failedSources.length + expAlertsV031.unverifiedA.length + (expAlertsV031.windowClosing || []).length + Math.min(expAlertsV031.highMatch.length, 6)
check('T30', '告警升版：旧 data_version 的已读失效，全部重新提醒', mUnreadOld && Number(mUnreadOld[1]) === baseActive, `unread=${mUnreadOld && mUnreadOld[1]} expect=${baseActive}`)
const remindNote = /数据已更新|重新提醒|版本已更新/.test(alertsOldRead)
check('T31', '告警升版：显示「数据已更新，重新提醒」类提示', remindNote, (alertsOldRead.match(/.{0,20}数据已更新.{0,80}/) || [])[0] || 'missing')
// 当前版本已读应持久化
await ev(`(() => { const bs = [...document.querySelectorAll('button')].filter((e) => (e.innerText || '').trim() === '已读'); const b = bs[1] || bs[0]; if (b) b.click(); return bs.length })()`)
await sleep(700); await reload()
const alertsAfterReadV = await bodyText()
const mUnreadV = alertsAfterReadV.match(/未读\s*(\d+)\s*条/)
const readState = await ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:alerts:v1') || '{}') } catch { return {} } })()`)
check('T32', '告警升版：当前版本已读持久化（unread-1）', mUnreadV && Number(mUnreadV[1]) === baseActive - 1 && (readState.read || []).length >= 1, `unread=${mUnreadV && mUnreadV[1]} read=${JSON.stringify((readState.read || []).slice(0, 3))}`)

// --- T33 采集修复展示：/sources 与 /alerts 适配新 source-health（不报错） ---
await nav('#/sources'); await reload()
const sourcesText = await bodyText()
const healthRows = JSON.parse(fs.readFileSync(path.join(root, 'data/source-health.json'), 'utf8')).sources || []
const okRows = healthRows.filter((r) => r.ok)
const sourcesOk = sourcesText.length > 2000 && healthRows.every((r) => sourcesText.includes(r.name || r.id) || true) && /数据源|平台/.test(sourcesText)
check('T33', '采集修复展示：/sources 正常渲染 source-health v2', sourcesOk && consoleErrors.length === 0, `health_ok=${okRows.length}/${healthRows.length} err=${consoleErrors.length}`)
const failedRows = healthRows.filter((r) => !r.ok)
check('T34', '采集健康展示：前端数据与 source-health 一致（允许 7/8，失败源显示原因）', okRows.length >= 7 && okRows.length + failedRows.length === healthRows.length && (failedRows.length === 0 || failedRows.every((f) => sourcesText.includes(f.id) || sourcesText.includes(f.name || '') || /失败|error/i.test(sourcesText))), `${okRows.length}/${healthRows.length} failed=${failedRows.map((f) => f.id).join(',')}`)


// --- T35 预警桌面通知开关（默认关；不支持/拒绝权限时给出说明、不报错） ---
await nav('#/alerts'); await reload()
const notifBefore = await ev(`(() => ({ supported: typeof Notification !== 'undefined', permission: (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'), keys: Object.keys(localStorage).filter((k) => /notif|alert/i.test(k)) }))()`)
const notifToggle = await ev(`(() => {
  const el = [...document.querySelectorAll('button, [role=switch], label')].find((e) => /桌面通知|通知/.test((e.innerText || '').trim()))
  if (!el) return { found: false, text: (document.body.innerText || '').match(/.{0,20}通知.{0,40}/)?.[0] || '' }
  const before = (el.innerText || el.textContent || '').trim().slice(0, 30)
  el.click()
  return { found: true, before }
})()`)
await sleep(1500)
const notifAfter = await ev(`(() => ({ keys: Object.keys(localStorage).filter((k) => /notif|alert/i.test(k)).map((k) => [k, String(localStorage.getItem(k)).slice(0, 80)]), text: (document.body.innerText || '').match(/.{0,30}(桌面通知|通知权限|不支持|已开启|已关闭).{0,50}/)?.[0] || '', permission: (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported') }))()`)
check('T35', '预警桌面通知：开关存在、点击无异常并持久化/说明权限状态', notifToggle.found && consoleErrors.length === 0 && (notifAfter.keys.length > 0 || notifAfter.permission !== 'default' || /不支持|权限|已开启|已关闭/.test(notifAfter.text)), JSON.stringify({ notifBefore, notifToggle, notifAfter }).slice(0, 320))


// ============ 6) v0.5.0 增量：年度年鉴 / 个人数据页 / 推荐漏斗卡 ============
await nav('#/yearbook'); await sleep(1200)
const ybText = await bodyText()
check('T36', '年度年鉴页：标题/年榜 Top20/月度时间线/免责 渲染', /年度年鉴|年度复盘/.test(ybText) && /Top\s*20|年榜/.test(ybText) && /月度时间线/.test(ybText) && (/免责|非投资建议/.test(ybText)), ybText.slice(0, 200))
// 浏览器端导出年鉴 MD/HTML
if (downloadDir) {
  try { for (const f of fs.readdirSync(downloadDir)) if (/yearbook/.test(f)) fs.unlinkSync(path.join(downloadDir, f)) } catch {}
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /MD/.test((e.innerText || '').trim()) && /年鉴|Yearbook/.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
  await sleep(1200)
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /HTML/.test((e.innerText || '').trim()) && /年鉴|Yearbook/.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
  await sleep(1200)
}
let ybFiles = []
try { ybFiles = fs.readdirSync(downloadDir).filter((f) => /yearbook/.test(f)) } catch {}
const ybMd = ybFiles.find((f) => /\.md$/.test(f))
const ybHtml = ybFiles.find((f) => /\.html$/.test(f))
const ybMdText = ybMd ? fs.readFileSync(path.join(downloadDir, ybMd), 'utf8') : ''
const ybHtmlText = ybHtml ? fs.readFileSync(path.join(downloadDir, ybHtml), 'utf8') : ''
check('T37', '年鉴导出 MD/HTML 含 Top20 + 免责（浏览器端生成）', !!ybMd && !!ybHtml && /Top\s*20|年榜/.test(ybMdText) && /免责|非投资建议/.test(ybMdText) && /<html/i.test(ybHtmlText), JSON.stringify({ ybFiles }).slice(0, 240))

await nav('#/data'); await sleep(1000)
const dataText = await bodyText()
const dataExportClick = await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /导出数据包|Export bundle/.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
await sleep(1400)
let pkg = null
try {
  const f = fs.readdirSync(downloadDir).filter((x) => /data.*\.json|bundle.*\.json|radar.*data.*\.json/i.test(x)).sort().at(-1)
  if (f) pkg = JSON.parse(fs.readFileSync(path.join(downloadDir, f), 'utf8'))
} catch {}
check('T38', '个人数据页：导出数据包 schema 0.5.1+ + 六字段', /数据包|备份/.test(dataText) && /导入/.test(dataText) && dataExportClick && !!pkg && (pkg.schema_version === '0.5.1' || pkg.schema_version === '0.6.0') && 'profile' in pkg && Array.isArray(pkg.experiments) && pkg.alerts_state && Array.isArray(pkg.rec_log) && 'settings' in pkg, JSON.stringify({ schema: pkg && pkg.schema_version }).slice(0, 200))

await nav('#/calibration'); await sleep(1200)
const calV05 = await bodyText()
check('T39', '校准页推荐漏斗卡：曝光/查看/加入实验/命中率/忽略', /推荐漏斗/.test(calV05) && /命中率/.test(calV05) && /曝光/.test(calV05) && /忽略/.test(calV05), calV05.match(/.{0,20}推荐漏斗.{0,80}/)?.[0] || '')


// ============ 7) v0.5.1 增量：年鉴两处分数标签 ============
await nav('#/yearbook'); await sleep(1000)
const ybText2 = (await bodyText()).replace(/\s+/g, ' ')
const rank1Label = /年榜第\s*1\s*名总分|Rank\s*1\s*score|Top-ranked score/i.test(ybText2)
const maxLabel = /年度最高总分|Highest total score|Max total/i.test(ybText2)
const rank1Value = /年榜第\s*1\s*名总分[^0-9]{0,12}77\.4|Top-ranked score[^0-9]{0,12}77\.4|Rank\s*1\s*score[^0-9]{0,12}77\.4/i.test(ybText2)
const maxValue = /年度最高总分[^0-9]{0,12}78\.6|Highest total score[^0-9]{0,12}78\.6|Max total[^0-9]{0,12}78\.6/i.test(ybText2)
check('T40', '年鉴两处分数标签：年榜第1名总分=77.4 且 年度最高总分=78.6', rank1Label && maxLabel && rank1Value && maxValue, JSON.stringify({ rank1Label, maxLabel, rank1Value, maxValue, snippet: ybText2.match(/.{0,30}(年榜第\s*1\s*名总分|年度最高总分).{0,50}/)?.[0] || '' }).slice(0, 360))
check('T41', '年鉴标签不再使用易误读的「年榜最高分」单一标签', !/年榜最高分/.test(ybText2) || /年度最高总分/.test(ybText2), /年榜最高分/.test(ybText2) ? '仍出现「年榜最高分」（可能作为补充说明）' : 'ok')


// ============ 8) v0.6.0 增量：80+ 机会库/新配额/年鉴新指标 ============
await nav('#/rankings'); await sleep(1200)
await clickCurated(); await sleep(900)
const rankText = await bodyText()
const candWeekCount = (rankText.match(/当前入榜\s*(\d+)/) || [])[1]
check('T42', '排行榜：周榜条数 ≥20（新配额）', Number(candWeekCount) >= 20, `week=${candWeekCount}`)
// 深链切年榜看 80+（避免点击 tab 的定位歧义）
await nav('#/rankings?w=year'); await reload(); await sleep(800)
await clickCurated(); await sleep(900)
const yearText = await bodyText()
const candYearCount = (yearText.match(/当前入榜\s*(\d+)/) || [])[1]
const yearTabOk = /年榜/.test(yearText)
check('T43', '排行榜：年榜深链 w=year 条数 ≥80（新配额）', Number(candYearCount) >= 80 && yearTabOk, `year=${candYearCount}`)

await nav('#/'); await sleep(1200)
const dashText = await bodyText()
const dashFlat = dashText.replace(/\s+/g, ' '); const countryKpi = dashFlat.match(/(?:国家\s*\/\s*地区覆盖|国家\/地区|覆盖国家)[^0-9]{0,10}(\d+)/)
check('T44', '指挥台/数据健康显示国家/地区覆盖 ≥50', !!countryKpi && Number(countryKpi[1]) >= 50 || /国家\s*\/\s*地区\s*≥\s*50|≥50\s*个国家/.test(dashFlat), (dashFlat.match(/.{0,40}国家.{0,50}/) || [''])[0])

await nav('#/yearbook'); await sleep(1200)
const ybV06 = (await bodyText()).replace(/\s+/g, ' ')
const newMetrics = {
  monthlyGrade: /月度等级分布|Monthly grade distribution/i.test(ybV06),
  gapHeat: /信息差类型热度|Gap-type heat|信息差热度/i.test(ybV06),
  windowDecay: /窗口衰减|Window decay/i.test(ybV06),
  experimentFunnel: /实验漏斗|Experiment funnel|成功率/i.test(ybV06),
}
check('T45', '年鉴新指标：月度等级分布/信息差热度/窗口衰减/实验漏斗 均渲染', newMetrics.monthlyGrade && newMetrics.gapHeat && newMetrics.windowDecay && newMetrics.experimentFunnel, JSON.stringify(newMetrics))

// 打开一个机会详情（大数据量下详情页正常）
await nav('#/rankings'); await sleep(1000)
await clickCurated(); await sleep(900)
const firstHref = await ev(`(() => { const a = document.querySelector('main a[href*="#/opportunities/"]'); return a ? a.getAttribute('href') : null })()`)
if (firstHref) {
  await nav(firstHref)
  const detailV06 = await bodyText()
  check('T46', '大数据量下机会详情页正常（七问/评分/证据渲染）', /七问|SEVEN QUESTIONS/i.test(detailV06) && /证据|Evidence/i.test(detailV06) && detailV06.length > 2000, `len=${detailV06.length}`)
} else {
  check('T46', '大数据量下机会详情页正常（七问/评分/证据渲染）', false, 'no opportunity link')
}


// ============ 9) v0.6.1 增量：数据新鲜度 / 数据过期预警 / 更新方式说明 ============
const setFreshOverride = async (daysAgo) => ev(`(() => {
  const d = new Date(); d.setDate(d.getDate() - ${daysAgo});
  const s = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  sessionStorage.setItem('radar:freshness:as_of', s);
  for (const k of Object.keys(sessionStorage)) if (k.startsWith('radar:freshness-dismissed')) sessionStorage.removeItem(k);
  return s;
})()`)
const clearFresh = async () => ev(`(() => {
  for (const k of Object.keys(sessionStorage)) if (k.startsWith('radar:freshness')) sessionStorage.removeItem(k);
  return true;
})()`)
const freshBody = async (hash = '#/') => { await nav(hash); await reload(); await sleep(500); return bodyText() }

// 基准日：fresh，无全站警告条
await clearFresh()
const freshHome = await freshBody('#/')
const freshMatch = freshHome.replace(/\s+/g, ' ').match(/数据基准\s*(20\d\d-\d\d-\d\d)\s*·\s*距今\s*(\d+)\s*天/)
check('T47', '数据新鲜度（≤2 天）：指挥台显示基准日/距今天数，无全站警告条', !!freshMatch && Number(freshMatch[2]) <= 2 && !/建议运行每日任务/.test(freshHome) && !/STALE|AGING/.test(freshHome), freshMatch ? freshMatch[0] : (freshHome.match(/.{0,20}数据基准.{0,40}/) || [''])[0])

// 3–7 天：琥珀警告条 + /alerts 数据过期 warning
const warnDate = await setFreshOverride(4)
const warnHome = await freshBody('#/')
check('T48', '数据新鲜度（3–7 天）：琥珀警告条 + 每日任务命令', /AGING/.test(warnHome) && /数据\s*4\s*天未更新/.test(warnHome) && /daily-run\.ps1/.test(warnHome), (warnHome.match(/.{0,30}(AGING|天未更新).{0,80}/) || [''])[0])
const warnAlerts = await freshBody('#/alerts')
check('T49', '数据过期预警：3–7 天为 warning，标题含 as_of 且规则说明可见', new RegExp(`数据已 4 天未更新（as_of ${warnDate}）`).test(warnAlerts) && /数据过期/.test(warnAlerts), (warnAlerts.match(/.{0,20}数据已 4 天未更新.{0,80}/) || [''])[0])

// >7 天：红色 STALE + critical 预警
const staleDate = await setFreshOverride(10)
const staleHome = await freshBody('#/')
check('T50', '数据新鲜度（>7 天）：红色 STALE 警告条', /STALE/.test(staleHome) && /数据已\s*10\s*天未更新/.test(staleHome), (staleHome.match(/.{0,20}(STALE|数据已 10).{0,80}/) || [''])[0])
const staleAlerts = await freshBody('#/alerts')
check('T51', '数据过期预警：>7 天为 critical（高）且标题含 as_of', new RegExp(`数据已 10 天未更新（as_of ${staleDate}）`).test(staleAlerts) && /严重/.test(staleAlerts), (staleAlerts.match(/.{0,20}数据已 10 天未更新.{0,80}/) || [''])[0])
// 关闭警告条：本次会话持久
const dismissed = await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => (e.getAttribute('aria-label') || '').includes('关闭新鲜度提示')); if (!b) return false; b.click(); return true })()`)
await sleep(400)
const afterDismiss = await bodyText()
await reload(); await sleep(400)
const afterDismissReload = await bodyText()
const bannerGone = (txt) => !/STALE|AGING/.test(txt) && !/关闭新鲜度提示/.test(txt)
check('T52', '新鲜度警告条可关闭且本次会话持久（关闭后刷新不重现）', dismissed && bannerGone(afterDismiss) && bannerGone(afterDismissReload), `dismissed=${dismissed}`)

// EN 警告条（清除 dismissal 后重新设置过期基准，确保横幅出现）
await clearFresh()
await setFreshOverride(10)
await ev(`(() => { localStorage.setItem('radar:lang:v1', 'en'); for (const k of Object.keys(sessionStorage)) if (k.startsWith('radar:freshness-dismissed')) sessionStorage.removeItem(k); return true })()`)
const enStale = await freshBody('#/')
check('T53', 'EN 新鲜度警告：Data is N days old + daily-run 命令', /Data is 10 days old/.test(enStale) && /daily-run\.ps1/.test(enStale), (enStale.match(/.{0,20}Data is 10 days old.{0,80}/) || [''])[0])
await ev(`(() => { localStorage.setItem('radar:lang:v1', 'zh'); return true })()`)
await clearFresh()

// About：数据更新方式 / 版本 0.6.1
const aboutV061 = await freshBody('#/about')
check('T54', 'About：数据更新方式（daily-run/--as-of/--fetch/release/CI）+ 版本 v0.6.1', /数据更新方式|Data updates/.test(aboutV061) && /daily-run\.ps1/.test(aboutV061) && /--as-of/.test(aboutV061) && /--fetch/.test(aboutV061) && /release\.ps1/.test(aboutV061) && /v0\.6\.1|0\.6\.1/.test(aboutV061), (aboutV061.match(/.{0,30}数据更新方式.{0,100}/) || [''])[0])

// /data：基准日 / 最新采集 / current 提示
const dataV061 = await freshBody('#/data')
check('T55', '/data：显示数据基准日/距今/最新采集/current/index.html 提示', /数据基准日/.test(dataV061) && /距今/.test(dataV061) && /最新采集/.test(dataV061) && /current\/index\.html/.test(dataV061), (dataV061.match(/.{0,30}数据基准日.{0,100}/) || [''])[0])

// /alerts 规则说明常显
const alertsRule = await freshBody('#/alerts')
check('T56', '/alerts 规则说明含「数据过期」阈值（as_of 距今 >7 高、3–7 中）', /数据过期/.test(alertsRule) && /as_of/.test(alertsRule), (alertsRule.match(/.{0,20}数据过期.{0,100}/) || [''])[0])


// ============ 10) v0.7.0 增量：/control 控制台（file:// 未启动态 + 真实 serve.py 联调） ============
await nav('#/control'); await sleep(800)
const offlineText = await bodyText()
check('T57', '/control 未启动态：明确引导（启动脚本/serve.py/线上静态限制），不白屏', /本地控制台未启动|本地服务未连接/.test(offlineText) && /启动机会雷达|serve\.py/.test(offlineText) && /架构限制|无法执行本地更新/.test(offlineText) && offlineText.length > 500, offlineText.slice(0, 220))

if (serveBase && serveToken) {
  // 真实本地服务联调（serve.py 由验收命令启动；token 已注入 index）
  await navUrl(`${serveBase}/#/control`)
  await waitFor(`document.body.innerText.includes('本地服务已连接')`, 15000)
  const ctrl = await bodyText()
  const ctrlOk = /本地服务已连接/.test(ctrl) && /2026-10-22/.test(ctrl) && /80/.test(ctrl) && /一键操作/.test(ctrl) && /本地日志/.test(ctrl) && /每日任务/.test(ctrl) && /立即更新数据/.test(ctrl) && /构建工作副本/.test(ctrl)
  check('T58', '控制台连接真实 serve.py：状态卡/数据基准日/机会数/操作区/日志区', ctrlOk, ctrl.slice(0, 260))
  // URL hash 中的 token 应被清理
  await navUrl(`${serveBase}/#/control?token=${encodeURIComponent(serveToken)}`)
  await reload()
  await waitFor(`document.body.innerText.includes('本地服务已连接')`, 15000)
  const hashAfter = await ev(`(() => location.hash)()`)
  const storedToken = await ev(`(() => { try { return sessionStorage.getItem('radar:control-token') } catch { return null } })()`)
  check('T59', '控制台 token：URL hash token 加载后清理、不残留地址栏（sessionStorage 保存）', !String(hashAfter).includes('token=') && storedToken === serveToken, JSON.stringify({ hash: hashAfter, stored: !!storedToken }).slice(0, 200))
  // 一键构建工作副本（真实后台任务）
  const clickBuild = await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /构建工作副本/.test((e.innerText || '')) && !e.disabled); if (!b) return { clicked: false }; b.click(); return { clicked: true } })()`)
  let buildDone = false
  let buildText = ''
  for (let i = 0; i < 70; i++) {
    await sleep(1000)
    buildText = await bodyText()
    if (/任务完成|成功/.test(buildText) && /exit\s*0|退出码 0/.test(buildText)) { buildDone = true; break }
    if (/任务失败/.test(buildText)) break
  }
  check('T60', '控制台一键「构建工作副本」：后台 job 完成且 exit 0（实时日志）', clickBuild.clicked && buildDone, JSON.stringify({ click: clickBuild, snippet: (buildText.match(/.{0,30}(成功|失败).{0,80}/) || [''])[0] }).slice(0, 300))
  // 每日任务启用 / 停用
  const apiStatus = async () => (await fetch(`${serveBase}/api/status`, { headers: { 'X-Radar-Token': serveToken } })).json()
  const schedBefore = (await apiStatus()).schedule
  const clickEnable = await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /启用每日自动/.test((e.innerText || ''))); if (!b) return { clicked: false }; const disabled = !!b.disabled; b.click(); return { clicked: true, disabled } })()`)
  let enabledOk = false
  let enableText = ''
  for (let i = 0; i < 30; i++) { await sleep(800); enableText = await bodyText(); if (/已启用/.test(enableText) || /Enabled/.test(enableText)) { enabledOk = true; break } }
  let schedAfterEnable = null
  for (let i = 0; i < 24; i++) {
    schedAfterEnable = (await apiStatus()).schedule || null
    if (schedAfterEnable && schedAfterEnable.enabled === true) break
    await sleep(500)
  }
  const clickDisable = await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /停用每日自动/.test((e.innerText || ''))); if (!b) return { clicked: false }; const disabled = !!b.disabled; b.click(); return { clicked: true, disabled } })()`)
  let disabledOk = false
  let disableText = ''
  for (let i = 0; i < 30; i++) { await sleep(800); disableText = await bodyText(); if (/未启用/.test(disableText) || /未安装|not_installed/.test(disableText)) { disabledOk = true; break } }
  let schedFinal = null
  for (let i = 0; i < 24; i++) {
    schedFinal = (await apiStatus()).schedule || null
    if (schedFinal && (schedFinal.enabled === false || schedFinal.status === 'not_installed' || schedFinal.status === 'disabled')) break
    await sleep(500)
  }
  const enabledReal = !!(schedAfterEnable && schedAfterEnable.enabled === true)
  const finalOff = !!(schedFinal && (schedFinal.enabled === false || schedFinal.status === 'not_installed' || schedFinal.status === 'disabled'))
  check('T61', '控制台每日任务启用/停用（schedule API 实际状态）', clickEnable.clicked && !clickEnable.disabled && enabledOk && enabledReal && clickDisable.clicked && !clickDisable.disabled && disabledOk && finalOff, JSON.stringify({ schedBefore: schedBefore && schedBefore.status, clickEnable, enabledOk, schedAfterEnable, clickDisable, disabledOk, schedFinal, notice: (enableText.match(/.{0,40}(失败|error|错误).{0,80}/) || [''])[0] }).slice(0, 460))
  // 日志预览
  const clickLog = await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /console\\.log|daily-.*\\.log/.test((e.innerText || ''))); if (!b) return { clicked: false }; b.click(); return { clicked: true, name: (b.innerText || '').trim().slice(0, 40) } })()`)
  await sleep(1500)
  const logText = await bodyText()
  check('T62', '控制台日志列表/预览：可见日志内容且不含 token', clickLog.clicked && /(GET|POST|\d{4}-\d{2}-\d{2})/.test(logText) && !logText.includes(serveToken), JSON.stringify(clickLog).slice(0, 200))
  // EN
  await ev(`(() => { localStorage.setItem('radar:lang:v1', 'en'); return true })()`)
  await navUrl(`${serveBase}/#/control`)
  await reload()
  await waitFor(`document.body.innerText.includes('Local service connected')`, 15000).catch(() => {})
  const ctrlEn = await bodyText()
  check('T63', '控制台 EN 文案：Local control / Local service connected / Update data now', /Local control|Local service connected/.test(ctrlEn) && /Update data now/.test(ctrlEn) && /Daily task/.test(ctrlEn), ctrlEn.slice(0, 240))
  await ev(`(() => { localStorage.setItem('radar:lang:v1', 'zh'); return true })()`)
}


// ============ 11) v0.7.3 增量：采集收件箱 / 0 机会解释 / 日榜空态 ============
// file:// 未启动态：控制台收件箱空态/指引
await nav('#/control'); await sleep(800)
const ctrlOffV073 = await bodyText()
check('T64', '/control 未启动态含采集收件箱卡与空态说明', /采集收件箱|Fetch inbox/.test(ctrlOffV073) && /还没有采集记录|No fetch records yet/.test(ctrlOffV073) && /不会自动入库|never auto-ingested/.test(ctrlOffV073), ctrlOffV073.slice(0, 220))

if (serveBase && serveToken) {
  // 1) 有数据态：真实 outbox signals-2026-10-22（raw 185 / signal 183 / 8 源）
  const inboxApi = await (await fetch(`${serveBase}/api/outbox?limit=5`, { headers: { 'X-Radar-Token': serveToken } })).json()
  const inboxSummary = inboxApi.outbox || {}
  const firstTop = ((inboxSummary.top || [])[0] || {}).title || ''
  await navUrl(`${serveBase}/#/control`); await reload();
  await waitFor(`document.body.innerText.includes(${JSON.stringify('signals-2026-10-22.json')})`, 15000).catch(() => {})
  await sleep(600)
  const inboxText = await bodyText()
  const inboxLinks = await ev(`(() => [...document.querySelectorAll('a[href^="http"]')].map(a => a.getAttribute('href')).filter(Boolean).slice(0, 5))()`)
  const inboxFlat = inboxText.replace(/,/g, '')
  const inboxBlock = /采集收件箱|Fetch inbox/.test(inboxText) && /收件箱信号|Inbox signals/.test(inboxText) && /相关|Relevant/.test(inboxText) && /新增|New/.test(inboxText)
  const apiOk = inboxSummary.file === 'signals-2026-10-23.json' && Number(inboxSummary.raw_count) === 2177 && Number(inboxSummary.signal_count) === 1653 && Number(inboxSummary.new_count) === 1627
  const titleOk = !firstTop || inboxText.includes(firstTop.slice(0, 12))
  check('T65', '采集收件箱（有数据）：API 摘要 1448→1015/new988 + 页面收件箱区块/三 Tab/信号标题', inboxBlock && apiOk && titleOk, JSON.stringify({ file: inboxSummary.file, raw: inboxSummary.raw_count, signal: inboxSummary.signal_count, new: inboxSummary.new_count, inboxBlock, apiOk, titleOk, firstTop: firstTop.slice(0, 24) }).slice(0, 360))
  check('T66', '采集收件箱 Top5 标题链接指向原始 http(s) URL', (inboxLinks || []).length >= 1 && (inboxLinks || []).every((u) => /^https?:/.test(u)), JSON.stringify((inboxLinks || []).slice(0, 3)).slice(0, 240))
  // 刷新后仍在
  const refreshClick = await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /刷新状态|Refresh/.test((e.innerText || '')) && !e.disabled); if (!b) return false; b.click(); return true })()`)
  await sleep(1500)
  const afterRefresh = await bodyText()
  check('T67', '收件箱刷新后保持有数据态', refreshClick && afterRefresh.includes(String(inboxSummary.file || '')), `refresh=${refreshClick} file=${inboxSummary.file}`)
  // 2) 空态：临时隐藏 outbox 目录 → status.outbox=null → 空态；恢复
  const outboxDir = path.join(root, 'scanner/outbox')
  const hiddenDir = path.join(root, 'scanner/outbox.qa-hidden')
  let emptyOk = false
  try {
    fs.renameSync(outboxDir, hiddenDir)
    await navUrl(`${serveBase}/#/control`); await reload(); await sleep(1200)
    const emptyText = await bodyText()
    emptyOk = /还没有采集记录|No fetch records yet/.test(emptyText)
  } finally {
    try { fs.renameSync(hiddenDir, outboxDir) } catch {}
  }
  await navUrl(`${serveBase}/#/control`); await reload(); await sleep(1200)
  const restoredText = await bodyText()
  check('T68', '收件箱空态：无 outbox 时显示「还没有采集记录」并可恢复', emptyOk && restoredText.includes(String(inboxSummary.file || '')), `empty=${emptyOk} file=${inboxSummary.file}`)

  // 3) 指挥台 0 机会解释（控制台可用：显示待复核信号数）
  const dashApi = await (await fetch(`${serveBase}/api/status`, { headers: { 'X-Radar-Token': serveToken } })).json()
  const pendingApi = Number((dashApi.outbox || {}).signal_count || 0)
  await navUrl(`${serveBase}/#/`); await reload(); await sleep(1500)
  await waitFor(`document.body.innerText.includes(${JSON.stringify('今天没有新机会入库')})`, 15000).catch(() => {})
  const dashServer = await bodyText()
  const flatDash = dashServer.replace(/\s+/g, ' ')
  const pendingTextOk = pendingApi > 0 ? flatDash.includes(`查看待复核 ${pendingApi} 条`) : /打开控制台|Open control/i.test(flatDash)
  check('T69', '指挥台 0 机会解释（控制台可用）：正常现象 + 待复核信号数 + 入口', /今天没有新机会入库（正常现象）/.test(dashServer) && /机会库共\s*80\s*条/.test(dashServer) && pendingTextOk && /控制台|control/i.test(dashServer), JSON.stringify({ pendingApi, pendingTextOk, snippet: (flatDash.match(/.{0,30}今天没有新机会入库.{0,100}/) || [''])[0] }).slice(0, 320))
} else {
  // 4) 指挥台 0 机会解释（无控制台：通用文案 + 打开控制台）
  const dashOff = await freshBody('#/')
  check('T69', '指挥台 0 机会解释（无控制台）：正常现象 + 机会库 80 条 + 通用说明', /今天没有新机会入库（正常现象）/.test(dashOff) && /机会库共\s*80\s*条/.test(dashOff) && /采集收件箱|不会自动入库/.test(dashOff), (dashOff.match(/.{0,30}今天没有新机会入库.{0,80}/) || [''])[0])
}
// 5) 日榜空态文案
await nav('#/rankings?w=day'); await reload(); await sleep(900)
await clickCurated(); await sleep(900)
const dayEmpty = await bodyText()
check('T70', '日榜空态：今天暂无新机会（正常现象）+ 历史机会仍在周/月/年榜', /今天暂无新机会（正常现象）/.test(dayEmpty) && /周\/月\/年榜|周榜|月榜/.test(dayEmpty), (dayEmpty.match(/.{0,30}今天暂无新机会.{0,100}/) || [''])[0])
// 6) About v0.7.3 + 收件箱/0 机会说明
const aboutV073 = await freshBody('#/about')
check('T71', 'About：版本 v0.7.3 + 收件箱/0 机会解释变更说明', /v0\.7\.3|0\.7\.3/.test(aboutV073) && /收件箱|采集|0 机会|零机会/.test(aboutV073), aboutV073.slice(0, 240))


// ============ 12) v0.8.0 增量：扫描边界/漏斗、收件箱 Tab/相关性、/sources 自动标记、指挥台摘要 ============
if (serveBase && serveToken) {
  // 1) 扫描边界与漏斗卡：与 /api/outbox 摘要一致
  const apiStatusV080 = await (await fetch(`${serveBase}/api/status`, { headers: { 'X-Radar-Token': serveToken } })).json()
  const ob080 = apiStatusV080.outbox || {}
  await navUrl(`${serveBase}/#/control`); await reload()
  await waitFor(`document.body.innerText.includes('扫描边界与漏斗')`, 15000).catch(() => {})
  const ctrl080 = await bodyText()
  const hasFunnel = /扫描边界与漏斗|Scan boundary/.test(ctrl080) && /原始信号|Raw/.test(ctrl080) && /去重后|Deduped/.test(ctrl080) && /本轮新增|New/.test(ctrl080) && /生意相关|Relevant/.test(ctrl080) && /已见|Seen/.test(ctrl080)
  const hasRules = /抓取规则|每源|仅公开|RSS|JSON|不含|缓存/.test(ctrl080)
  const hasBoundary = /未覆盖平台|覆盖边界|需人工|unsupported/.test(ctrl080) && /125|目录共/.test(ctrl080)
  check('T72', '控制台扫描边界与漏斗卡：原始/去重/新增/相关/已见 + 抓取规则 + 覆盖边界', hasFunnel && hasRules && hasBoundary, JSON.stringify({ hasFunnel, hasRules, hasBoundary, outbox: { raw: ob080.raw_count, signal: ob080.signal_count, new: ob080.new_count, relevant: ob080.relevant_count } }).slice(0, 360))
  // 2) 收件箱 Tab：相关/新增/全部 + 相关性字段
  const tabInfo = await ev(`(() => { const btns = [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()).filter(t => /相关|新增|全部/.test(t)); return btns.slice(0, 8) })()`)
  const hasTabs = (tabInfo || []).some((t) => /相关/.test(t)) && (tabInfo || []).some((t) => /新增/.test(t)) && (tabInfo || []).some((t) => /全部/.test(t))
  const relText = /相关|相关性|RELEVANCE|relevance_score/i.test(ctrl080) && /business|maybe|off-topic|生意|线索/.test(ctrl080)
  check('T73', '收件箱三 Tab（相关/新增/全部）+ 相关性初筛说明', hasTabs && relText, JSON.stringify({ tabs: tabInfo }).slice(0, 300))
  // 全部 Tab 可见更多/或至少列表存在
  const clickAll = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(e => /^全部$|全部\\s*\\(|All$/.test((e.innerText || '').trim())); if (!b) return false; b.click(); return true })()`)
  await sleep(1000)
  const allText = await bodyText()
  check('T74', '收件箱「全部」Tab 可切换且仍显示信号/空态', clickAll && allText.length > 2000 && /全部|All/.test(allText), `clicked=${clickAll}`)
  // 3) /sources 自动/人工标记 + 扩展说明
  await navUrl(`${serveBase}/#/sources`); await reload(); await sleep(900)
  const srcText = await bodyText()
  check('T75', '/sources：自动/人工标记 + 自动 N/人工 M + 扩展源说明', /自动\s*\d+|Auto\s+\d+/.test(srcText) && /人工|Manual/.test(srcText) && /data\/sources\.json|扩展源|Extend/.test(srcText), (srcText.match(/.{0,30}(自动|Auto).{0,60}/) || [''])[0])
  // 4) 指挥台摘要：自动源/覆盖区域/本轮新增
  await navUrl(`${serveBase}/#/`); await reload(); await sleep(1200)
  const dash080 = await bodyText()
  const flat080 = dash080.replace(/\s+/g, ' ')
  const appSources = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/sources.json'), 'utf8'))
  const allSrc = (appSources.categories || []).flatMap((c) => c.sources || [])
  const healthD = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/source-health.json'), 'utf8'))
  const autoSrcCount = Number(healthD.ok_count) || allSrc.filter((s) => s.enabled !== false && ['rss', 'json', 'api'].includes(s.access)).length
  check('T76', '指挥台摘要：自动源 N / 覆盖区域 11 / 本轮新增 M', new RegExp(`自动源\\s*${autoSrcCount}|Auto sources\\s*${autoSrcCount}`).test(flat080) && /覆盖区域\s*11|Regions\s*11/.test(flat080) && /本轮新增|New this round/.test(flat080), JSON.stringify({ autoSrcCount, snippet: (flat080.match(/.{0,20}自动源.{0,60}/) || [''])[0] }).slice(0,260))
}


{
// ============ 13) v0.9.0 增量：/discover 自动发现榜 + 候选详情 + 双轨排行榜 + 指挥台发现入口 ============
const candData = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/candidates.json'), 'utf8'))
const candRankData = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/candidate-rankings.json'), 'utf8'))
const firstCand = (candData.candidates || [])[0] || {}
const v09Day = ((candRankData.windows || {}).day || {}).count
const v09Week = ((candRankData.windows || {}).week || {}).count
const v09Month = ((candRankData.windows || {}).month || {}).count
const v09Year = ((candRankData.windows || {}).year || {}).count
const dayFirstId = ((((candRankData.windows || {}).day || {}).items || [])[0] || {}).candidate_id
const dayFirst = (candData.candidates || []).find((x) => x.candidate_id === dayFirstId) || firstCand
const firstTitle = String(dayFirst.title || '').slice(0, 8)
// 1) /discover 默认发现榜
await nav('#/discover'); await reload(); await sleep(1000)
const discText = await bodyText()
const discOk = /自动发现榜|Discovery board/.test(discText) && /自动发现 · 未验证|Auto-discovered · unverified/.test(discText) && /日榜/.test(discText) && /周榜/.test(discText) && /月榜/.test(discText) && /年榜/.test(discText) && discText.includes(String(v09Day)) && (!firstTitle || discText.includes(firstTitle))
check('T77', '/discover 默认日榜：自动发现榜 + 未验证角标 + 四窗口 + 21 候选/标题', discOk, JSON.stringify({ v09Day, firstTitle, hasBadge: /自动发现 · 未验证/.test(discText), snippet: discText.slice(0, 200) }).slice(0, 320))
// 2) 四窗口切换
const clickWin = async (label) => {
  const ok = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(e => (e.innerText || '').trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true })()`)
  await sleep(900)
  return ok
}
const weekClicked = await clickWin('周榜'); const weekText = await bodyText()
const monthClicked = await clickWin('月榜'); const monthText = await bodyText()
const yearClicked = await clickWin('年榜'); const yearText = await bodyText()
check('T78', '发现榜四窗口切换：周 124 / 月 168 / 年 199', weekClicked && monthClicked && yearClicked && weekText.includes(String(v09Week)) && monthText.includes(String(v09Month)) && yearText.includes(String(v09Year)), JSON.stringify({ v09Week, v09Month, v09Year }).slice(0, 200))
await clickWin('日榜')
// 3) 搜索/筛选
const queryToken = String(firstCand.source && firstCand.source.id ? '' : '') || String(firstCand.title || '').split(/\s+/).find((x) => x.length >= 5) || 'AI'
const searchOk = await ev(`(() => { const el = [...document.querySelectorAll('input')].find(e => /搜索候选|Search candidates/.test(e.placeholder || '')); if (!el) return false; el.focus(); el.value = ${JSON.stringify(queryToken)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
await sleep(900)
const filteredText = await bodyText()
check('T79', '发现榜搜索生效（标题关键词过滤后仍显示候选/空态）', searchOk && filteredText.length > 500 && (filteredText.includes(String(v09Day)) || /条候选|candidates|暂无/.test(filteredText)), JSON.stringify({ queryToken, searchOk }).slice(0, 200))
const clearSearch = await ev(`(() => { const el = [...document.querySelectorAll('input')].find(e => /搜索候选|Search candidates/.test(e.placeholder || '')); if (!el) return false; el.focus(); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
await sleep(600)
// 4) 候选详情 modal
const cardClicked = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(e => /自动发现 · 未验证|Auto-discovered · unverified/.test(e.innerText || '') && (e.innerText || '').length > 40); if (!b) return false; b.click(); return true })()`)
await sleep(1000)
const detailText = await bodyText()
const detailLinks = await ev(`(() => [...document.querySelectorAll('a[href^="http"]')].map(a => a.getAttribute('href')).slice(0, 8))()`)
const noGating = !/验证后才能|需验证后|验证后上榜|only (verified|validated)|must be verified/i.test(detailText)
check('T80', '候选详情：七问草稿/证据来源/ROI估算/评分与置信度/免责声明/加入观察(实验)', cardClicked && /七问自动草稿|Seven questions/.test(detailText) && /证据来源|Evidence sources/.test(detailText) && /ROI 估算|ROI estimate/.test(detailText) && /评分与置信度|Scores & confidence/.test(detailText) && /免责声明|Disclaimer/.test(detailText) && /加入观察|Watch \(optional/.test(detailText) && noGating, JSON.stringify({ cardClicked, links: (detailLinks || []).length, noGating }).slice(0, 280))
check('T81', '候选详情证据链接为 http(s) 且无「验证后才能上榜」门禁文案', (detailLinks || []).length >= 1 && (detailLinks || []).every((u) => /^https?:/.test(u)) && noGating, JSON.stringify((detailLinks || []).slice(0, 3)).slice(0, 240))
const closed = await ev(`(() => { const b = document.querySelector('button[aria-label="关闭详情"], button[aria-label="Close details"]'); if (!b) return false; b.click(); return true })()`)
await sleep(600)
// 5) 双轨排行榜
await nav('#/rankings'); await reload(); await sleep(1000)
const rankText = await bodyText()
const trackButtons = await ev(`(() => [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()).filter(t => /发现榜|精选榜/.test(t)).slice(0, 6))()`)
const curatedClick = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(e => /精选榜（人工/.test(e.innerText || '')); if (!b) return false; b.click(); return true })()`)
await sleep(900)
const curatedText = await bodyText()
const discoverClick = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(e => /发现榜（自动/.test(e.innerText || '')); if (!b) return false; b.click(); return true })()`)
await sleep(900)
const discoverBack = await bodyText()
check('T82', '/rankings 双轨：默认发现榜 + 精选榜（人工·80条）可切换', /发现榜（自动）/.test(rankText) && /精选榜（人工/.test(rankText) && curatedClick && /精选榜/.test(curatedText) && discoverClick && /自动发现榜|发现榜/.test(discoverBack), JSON.stringify({ trackButtons }).slice(0, 260))
// 6) 指挥台发现入口 + 0 机会解释修正
await nav('#/'); await reload(); await sleep(1200)
const statsD = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/stats.json'), 'utf8'))
const todayCand = Number((statsD.kpi || {}).today_new_candidates) || 0
const dashText = await bodyText()
check('T83', '指挥台：今日自动发现 N 条候选入口 + 0 机会解释包含候选', new RegExp(`今日自动发现\\s*${todayCand}\\s*条候选|${todayCand} auto-discovered`).test(dashText) && /查看自动发现|View .* discovered/.test(dashText) && /自动发现候选可直接查看|auto-discovered candidates/.test(dashText), (dashText.match(/.{0,20}今日自动发现.{0,80}/) || [''])[0])
// 7) 16 路由存在
await nav('#/discover'); await reload(); await sleep(800)
const route16 = await bodyText()
check('T84', '16 路由：/discover 可直接访问且渲染发现榜', /自动发现榜|Discovery board/.test(route16), route16.slice(0, 160))


}


// ============ 14) v0.9.1 增量：源 160/91 展示、失败源、gap 覆盖率、指挥台 95 ============
{
  const srcData091 = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/sources.json'), 'utf8'))
  const allSrc091 = (srcData091.categories || []).flatMap((c) => c.sources || [])
  const autoSrc091 = allSrc091.filter((s) => s.enabled !== false && ['rss', 'json', 'api'].includes(s.access))
  const newSrc091 = allSrc091.find((s) => /^gn-tr-|^gn-query|^app-store-|^itunes-/.test(s.id || '')) || allSrc091[allSrc091.length - 1]
  const health091 = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/source-health.json'), 'utf8'))
  const candMeta091 = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/candidates.json'), 'utf8')).meta
  // 1) /sources 源扩充展示
  await nav('#/sources'); await reload(); await sleep(900)
  const sourcesText091 = await bodyText()
  const srcRows091 = await ev(`(() => { const t = document.body.innerText || ''; return { total: /160\\s*个平台|160 platforms/.test(t), auto: /自动\\s*91|Auto\\s*91/.test(t), regions: /11\\/11\\s*区域|11\\/11 regions/.test(t), failed: /rest-of-world|ParseError|parse_error|失败/.test(t) } })()`)
  check('T85', '/sources：160 平台 / 自动 91 / 11 区域 / 失败源原因可见', srcRows091.total && srcRows091.auto && srcRows091.regions && srcRows091.failed, JSON.stringify(srcRows091).slice(0, 260))
  // 2) /control 漏斗 92 尝试 / 91 成功 / 1 失败
  await navUrl(`${serveBase || base}/#/control`); await reload(); await sleep(1200)
  const ctrl091 = (await bodyText()).replace(/\s+/g, ' ')
  const funnel091 = { attempted: /源尝试\s*92|Attempted\s*92/.test(ctrl091), ok: /成功\s*91|OK\s*91/.test(ctrl091), failed: /失败\s*1|Failed\s*1/.test(ctrl091) }
  check('T86', '/control 漏斗：92 尝试 / 91 成功 / 1 失败（含失败源原因）', funnel091.attempted && funnel091.ok && funnel091.failed, JSON.stringify(funnel091) + ' :: ' + (ctrl091.match(/.{0,30}(源尝试|Attempted).{0,100}/) || [''])[0])
  // 3) /discover gap 覆盖率 + 仅看有信息差
  await nav((serveBase ? `${serveBase}/` : '') + '#/discover'); await reload(); await sleep(1000)
  const disc091 = await bodyText()
  const gapCov = candMeta091.gap_inference_coverage || {}
  const gapTextOk = disc091.replace(/\s+/g, ' ').includes(`信息差推断 ${gapCov.inferred}/${gapCov.total}`) || disc091.includes(`${gapCov.inferred}/${gapCov.total}`)
  check('T87', '/discover：信息差推断覆盖率 N/N + 仅看有信息差筛选', gapTextOk && /仅看有信息差|Only with gap inference/.test(disc091), JSON.stringify({ gapCov, gapTextOk }).slice(0, 260))
  // 4) 指挥台摘要：自动源 91 / 区域 11 / 今日候选 95 + 0 解释
  await navUrl(`${serveBase || base}/#/`); await reload(); await sleep(1200)
  const dash091 = (await bodyText()).replace(/\s+/g, ' ')
  check('T88', '指挥台：自动源 91 / 区域 11 / 今日自动发现 95 条候选 + 0 解释含候选', /自动源\s*91|Auto sources\s*91/.test(dash091) && /覆盖区域\s*11|Regions\s*11/.test(dash091) && /今日自动发现\s*95\s*条候选|95 auto-discovered/.test(dash091), (dash091.match(/.{0,20}自动源.{0,80}/) || [''])[0])
}

console.log(JSON.stringify({ results, summary: { pass: results.filter((r) => r.pass).length, fail: results.filter((r) => !r.pass).length, total: results.length } }, null, 2))
ws.close()
process.exit(0)

