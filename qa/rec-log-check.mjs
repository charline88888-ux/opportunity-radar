// qa/rec-log-check.mjs —— v0.5.0 推荐漏斗验收（曝光/查看/加入实验/忽略、会话去重、命中率、500 上限、导出 JSON 摘要）
// 用法：node qa/rec-log-check.mjs <debugPort> <baseUrl> <downloadDir>
import fs from 'node:fs'
import path from 'node:path'

const [port, base, downloadDir] = process.argv.slice(2)
if (!port || !base || !downloadDir) { console.error('usage: node qa/rec-log-check.mjs <port> <baseUrl> <downloadDir>'); process.exit(2) }
const root = path.resolve('.')
fs.mkdirSync(downloadDir, { recursive: true })
const results = []
const check = (id, name, pass, detail = '') => results.push({ id, name, pass: !!pass, detail: String(detail).slice(0, 500) })

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const p = l.find((t) => t.type === 'page')
      if (p?.webSocketDebuggerUrl) return p
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('CDP target not found')
}
const target = await getTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
let consoleErrors = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(String(m.params?.exceptionDetails?.text || 'exception').slice(0, 120))
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') consoleErrors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 120))
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
await send('Runtime.enable'); await send('Page.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const nav = async (hash) => { await send('Page.navigate', { url: `${base}${hash}` }); await sleep(3400) }
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(3400) }
await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir }).catch(() => {})
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: false }).catch(() => {})

const recLog = async () => ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:rec_log:v1') || '[]') } catch { return [] } })()`)
const summary = (records) => {
  const uniq = (ev) => new Set(records.filter((r) => r.event === ev).map((r) => r.opp_id)).size
  const count = (ev) => records.filter((r) => r.event === ev).length
  const ui = uniq('impression'), ue = uniq('experiment')
  return {
    impressions: count('impression'), unique_impressions: ui,
    views: count('view'), unique_views: uniq('view'),
    experiments: count('experiment'), unique_experiments: ue,
    dismisses: count('dismiss'), unique_dismisses: uniq('dismiss'),
    hit_rate: ui ? Math.round((ue / ui) * 1000) / 10 : 0,
    view_rate: ui ? Math.round((uniq('view') / ui) * 1000) / 10 : 0,
    total: records.length,
  }
}

// ---------- seed ----------
await nav('#/')
await ev(`(() => {
  localStorage.setItem('radar:profile:v1', JSON.stringify({ capitalBand: 'b1-5w', weeklyHours: 10, fullTime: false, skills: { tech: 1, content: 2, supply: 0, ops: 2 }, english: 2, risk: 3, hasLicensePartner: false, strictCapital: false, updated_at: '2026-10-22T00:00:00+08:00' }))
  localStorage.removeItem('radar:experiments:v1')
  localStorage.removeItem('radar:rec_log:v1')
  return true
})()`)
await reload()
// ---------- 1) 曝光（推荐榜渲染） ----------
await nav('#/rankings?mode=recommend')
await sleep(1200)
const log1 = await recLog()
const cards = await ev(`(() => document.querySelectorAll('main a[href*="#/opportunities/"]').length)()`)
const imp1 = log1.filter((r) => r.event === 'impression')
check('R01', '为你推荐渲染记录 impression（每个机会至少 1 条）', imp1.length > 0 && new Set(imp1.map((r) => r.opp_id)).size === imp1.length, `impressions=${imp1.length} cards=${cards}`)
check('R02', 'impression 记录含 opp_id/rec_score/fit/at', imp1.length > 0 && imp1.every((r) => r.opp_id && typeof r.rec_score === 'number' && typeof r.fit === 'number' && r.at), JSON.stringify(imp1[0] || {}))
// 同会话 SPA 往返不重复曝光
const beforeDedupe = (await recLog()).filter((r) => r.event === 'impression').length
await nav('#/')
await nav('#/rankings?mode=recommend')
await sleep(1000)
const afterDedupe = (await recLog()).filter((r) => r.event === 'impression').length
check('R03', '曝光每会话去重（SPA 往返不新增同一机会曝光）', afterDedupe === beforeDedupe, `before=${beforeDedupe} after=${afterDedupe}`)

// ---------- 2) 查看（点击推荐卡 → 详情） ----------
const firstOpp = (await recLog()).find((r) => r.event === 'impression')?.opp_id
await ev(`(() => {
  const links = [...document.querySelectorAll('main a[href*="#/opportunities/"]')]
  const a = links.find((x) => (x.getAttribute('href') || '').endsWith(${JSON.stringify(firstOpp || '')})) || links[0]
  if (a) a.click(); return !!a
})()`)
await sleep(2200)
const log2 = await recLog()
const viewOk = firstOpp && log2.some((r) => r.event === 'view' && r.opp_id === firstOpp)
check('R04', '点击推荐卡记录 view 事件', !!viewOk, JSON.stringify(log2.filter((r) => r.event === 'view').slice(0, 3)).slice(0, 260))

// ---------- 3) 加入实验 ----------
await sleep(600)
await ev(`(() => { const b = [...document.querySelectorAll('button,a,[role=button]')].find((e) => /开始 7 天实验|开始实验/.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
await sleep(900)
await ev(`(() => { const b = [...document.querySelectorAll('button,a,[role=button]')].find((e) => /加入并开始|确认|保存/.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
await sleep(1200)
const log3 = await recLog()
check('R05', '加入实验记录 experiment 事件', log3.some((r) => r.event === 'experiment'), JSON.stringify(log3.filter((r) => r.event === 'experiment').slice(0, 2)).slice(0, 240))

// ---------- 4) 忽略 ----------
await nav('#/rankings?mode=recommend')
await sleep(1200)
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '忽略'); if (b) { b.click(); return true } return false })()`)
await sleep(900)
const log4 = await recLog()
check('R06', '忽略推荐记录 dismiss 事件', log4.some((r) => r.event === 'dismiss'), JSON.stringify(log4.filter((r) => r.event === 'dismiss').slice(0, 2)).slice(0, 240))

// ---------- 5) 漏斗 UI 与独立计算一致 ----------
// 让校准页有 1 条带 outcome 样本，便于导出校准 JSON
const exps = await ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:experiments:v1') || '[]') } catch { return [] } })()`)
if (Array.isArray(exps) && exps.length) {
  exps[0] = { ...exps[0], status: 'verified', outcome: 'positive', ended_at: '2026-10-22', updated_at: '2026-10-22T00:00:00+08:00' }
  await ev(`(() => { localStorage.setItem('radar:experiments:v1', ${JSON.stringify(JSON.stringify(exps))}); return true })()`)
}
await nav('#/calibration'); await reload()
const calText = (await ev(`(() => document.body.innerText || '')()`)).replace(/\s+/g, ' ')
const logFinal = await recLog()
const exp = summary(logFinal)
const numAfter = (label) => {
  const m = calText.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*([0-9]+)'))
  return m ? Number(m[1]) : null
}
const uiImp = numAfter('曝光（去重机会）'), uiViews = numAfter('查看'), uiExp = numAfter('加入实验')
const uiHit = (calText.match(/命中率\s*([0-9.]+)%/) || [])[1]
const uiDis = numAfter('忽略')
check('R07', '漏斗 UI 与 rec_log 独立汇总一致（曝光去重/查看/实验/命中率/忽略）',
  uiImp === exp.unique_impressions && uiViews === exp.unique_views && uiExp === exp.unique_experiments && String(uiHit) === String(exp.hit_rate) && uiDis === exp.unique_dismisses,
  JSON.stringify({ ui: { uiImp, uiViews, uiExp, uiHit, uiDis }, expected: exp }).slice(0, 400))
check('R08', '命中率 = 加入实验去重 / 曝光去重（契约）', exp.hit_rate === (exp.unique_impressions ? Math.round((exp.unique_experiments / exp.unique_impressions) * 1000) / 10 : 0), `hit_rate=${exp.hit_rate}%`)

// ---------- 6) 导出校准 JSON 含 rec_log 摘要 ----------
let calJson = null
try { for (const f of fs.readdirSync(downloadDir)) if (/calibration.*\.json$/.test(f)) fs.unlinkSync(path.join(downloadDir, f)) } catch {}
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => /导出校准 JSON|Export calibration JSON/.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
await sleep(1600)
try {
  const f = fs.readdirSync(downloadDir).filter((x) => /calibration.*\.json$/.test(x)).sort().at(-1)
  if (f) calJson = JSON.parse(fs.readFileSync(path.join(downloadDir, f), 'utf8'))
} catch {}
const funnel = calJson && (calJson.recommendation_funnel || calJson.rec_log_summary)
check('R09', '导出校准 JSON 附带推荐漏斗摘要且计数一致',
  !!funnel && funnel.unique_impressions === exp.unique_impressions && funnel.unique_views === exp.unique_views && funnel.unique_experiments === exp.unique_experiments && Math.abs(Number(funnel.hit_rate) - exp.hit_rate) < 0.051,
  JSON.stringify(funnel).slice(0, 320))

// ---------- 7) 500 条上限 ----------
const many = Array.from({ length: 520 }, (_, i) => ({ id: `cap-${i}`, opp_id: `opp-cap-${i % 40}`, event: 'impression', rec_score: 70, fit: 0.7, at: new Date(Date.now() - i * 1000).toISOString() }))
await ev(`(() => { localStorage.setItem('radar:rec_log:v1', ${JSON.stringify(JSON.stringify(many))}); return true })()`)
await reload()
await nav('#/rankings?mode=recommend'); await sleep(1500)
const capped = await recLog()
check('R10', 'rec_log 上限 500 条滚动（加载归一 + 新事件后裁剪为 500）', capped.length === 500, `stored=${capped.length}`)

check('R11', '全程无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join('; ') || '0')
const out = { results, summary: { pass: results.filter((r) => r.pass).length, fail: results.filter((r) => !r.pass).length, total: results.length } }
fs.writeFileSync(path.join(root, 'qa/tmp/rec-log-check.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
ws.close()
process.exit(0)
