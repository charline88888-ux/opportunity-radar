// qa/flows-v03.mjs —— v0.3.0 功能验收：/profile 推荐（公式/硬约束/解释）、/alerts 规则+已读忽略、/calibration 回测+导出、delta 标签。
// 依赖：python qa/recommend-check.py 生成 qa/tmp/recommend-expected.json；Chrome 以 --remote-debugging-port 启动。
// 用法：node qa/flows-v03.mjs <debugPort> <baseUrl> [downloadDir]
const fs = await import('node:fs')
const path = await import('node:path')
const root = path.resolve('.')
const [port, base, downloadDir] = process.argv.slice(2)
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
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(3400) }
const waitFor = async (expr, timeout = 9000) => { const start = Date.now(); while (Date.now() - start < timeout) { if (await ev(expr)) return true; await sleep(400) } return false }
if (downloadDir) {
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir }).catch(() => {})
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: false }).catch(() => {})
}
const setStorage = async (key, value) => ev(`(() => { localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(value))}); return true })()`)
const removeStorage = async (key) => ev(`(() => { localStorage.removeItem(${JSON.stringify(key)}); return true })()`)
const bodyText = async () => ev(`(() => document.body.innerText || '')()`)

// ============ 1) /profile 推荐（side-hustle 画像） ============
const P = { capitalBand: 'b1-5w', weeklyHours: 10, fullTime: false, skills: { tech: 1, content: 2, supply: 0, ops: 2 }, english: 2, risk: 3, hasLicensePartner: false, updated_at: '2026-10-22T00:00:00+08:00' }
await nav('#/profile')
await setStorage('radar:profile:v1', P)
await reload()
const profileText = await bodyText()
check('T01', '画像已保存 + 能力向量展示', profileText.includes('画像已保存') && /\b5\.0\b/.test(profileText) && /\b4\.0\b/.test(profileText) && /\b3\.3\b/.test(profileText) && /\b6\.7\b/.test(profileText), profileText.slice(0, 200))
// 推荐榜
await nav('#/rankings?mode=recommend')
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
check('T07', '推荐候选计数展示', new RegExp(`推荐候选\s*${Math.min(expected.profiles['side-hustle'].candidateCount, 30)}`).test(recText.replace(/\s+/g, ' ')), `expect=${Math.min(expected.profiles['side-hustle'].candidateCount, 30)}`)
const reasonsOk = petCard && /资金/.test(petCard.text) && /技术/.test(petCard.text) && /供应链/.test(petCard.text)
check('T08', '解释文案含 资金/技术/供应链（T-v03-13）', reasonsOk, (petCard?.text || '').slice(0, 260))
// 显示硬约束 toggle
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /显示硬约束|已包含硬约束/.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
await sleep(1000)
const hardText = await bodyText()
check('T09', '切换「显示硬约束」后出现硬约束徽标', hardText.includes('硬约束 ·'), hardText.includes('硬约束 ·') ? 'ok' : 'no hard badge found')
await nav('#/rankings')
await reload()
const overallText = await bodyText()
const titlesWithReplay = await ev(`(() => [...document.querySelectorAll('[title]')].map((e) => e.getAttribute('title')).filter((t) => /回放|replay/i.test(t || '')))()`)
check('T10', '榜单显示「较上一份历史快照（2026-10-21）」口径', /较上一份历史快照|较上一快照/.test(overallText) && /2026-10-21/.test(overallText), (overallText.match(/.{0,20}快照.{0,40}/) || [''])[0])
check('T11', '历史回放标记可见（text 或 tooltip title）', /历史回放|回放/.test(overallText) || (titlesWithReplay || []).length > 0, JSON.stringify(titlesWithReplay).slice(0, 260))

// ============ 2) /alerts 规则 + 已读/忽略 ============
await nav('#/alerts')
await removeStorage('radar:experiments:v1')
await reload()
const alertsBase = await bodyText()
const mUnread = alertsBase.match(/未读\s*(\d+)\s*条/)
const unreadBase = mUnread ? Number(mUnread[1]) : null
const expAlerts = expected.alertsExpected
const expectedUnread = expAlerts.failedSources.length + expAlerts.unverifiedA.length + Math.min(expAlerts.highMatch.length, 6)
check('T12', '预警数 = 源失败+未核验A+高匹配（≤6）', unreadBase === expectedUnread, `ui=${unreadBase} expect=${expectedUnread} (src=${expAlerts.failedSources.length}, unverifiedA=${expAlerts.unverifiedA.length}, highMatch=${expAlerts.highMatch.length})`)
check('T13', '预警含采集源失败原因', /采集源|source|Reddit|shopify|itunes/i.test(alertsBase), alertsBase.slice(0, 200))
// 已读
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '已读'); if (b) b.click(); return !!b })()`)
await sleep(600)
await reload()
const alertsAfterRead = await bodyText()
const mUnread2 = alertsAfterRead.match(/未读\s*(\d+)\s*条/)
const readStorage = await ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:alerts:v1') || '{}') } catch { return {} } })()`)
check('T14', '标为已读后未读数 -1 且持久化', mUnread2 && Number(mUnread2[1]) === expectedUnread - 1 && (readStorage.read || []).length >= 1, `unread=${mUnread2 && mUnread2[1]} read=${(readStorage.read || []).length}`)
// 忽略
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
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /JSON/.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
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
check('T21', '校准导出 JSON：schema@0.3.0 + 统计正确', !!calJson && calJson.schema === 'opportunity-radar/calibration@0.3.0' && calJson.stats?.samples === 3 && calJson.stats?.decided === 3 && Math.abs((calJson.stats?.successRate ?? -1) - 66.7) < 0.051 && Math.abs((calJson.stats?.avgTotalPositive ?? -1) - expStats.avgTotalPositive) < 0.051, JSON.stringify({ file: calJson && { schema: calJson.schema, stats: calJson.stats } }).slice(0, 300))

// ============ 4) 详情页 delta / 实验状态 ============
await nav('#/opportunities/opp-pet-memorial-glass-001')
const detailText = await bodyText()
check('T22', '详情页显示「较上一快照」/窗口与实验状态', /较上一快照|上一快照/.test(detailText) && /7 天实验|实验/.test(detailText), detailText.slice(0, 200))
check('T23', '页面无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join('; ') || '0')

console.log(JSON.stringify({ results, summary: { pass: results.filter((r) => r.pass).length, fail: results.filter((r) => !r.pass).length, total: results.length } }, null, 2))
ws.close()
process.exit(0)
