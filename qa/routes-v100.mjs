// qa/routes-v100.mjs —— v1.0.0 核心回归：9 路由 zh 渲染/溢出/console + 已删路由 404
// 用法：node qa/routes-v100.mjs <debugPort> <baseUrl> <outFile>
import fs from 'node:fs'

const [port, base, outFile] = process.argv.slice(2)
if (!port || !base) { console.error('usage: node qa/routes-v100.mjs <port> <baseUrl> [outFile]'); process.exit(2) }
const routes = ['#/', '#/rankings', '#/candidates/cand-5c555f56997d', '#/opportunities/opp-pet-memorial-glass-001', '#/scanner', '#/method', '#/sources', '#/calendar', '#/about']
const removed = ['#/discover', '#/control', '#/lab', '#/calibration', '#/profile', '#/alerts', '#/yearbook', '#/data']

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
const consoleErrors = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(String(m.params?.exceptionDetails?.text || 'exception').slice(0, 140))
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
await send('Runtime.enable'); await send('Page.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const nav = async (hash) => { await send('Page.navigate', { url: `${base}${hash}` }); await sleep(2300) }
const setSize = async (width, height) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
}
const rows = []
for (const width of [1600, 1024]) {
  await setSize(width, 1000)
  for (const route of routes) {
    consoleErrors.length = 0
    await nav(route)
    const info = await ev(`(() => {
      const main = document.querySelector('main') || document.body
      const overflow = document.documentElement.scrollWidth > window.innerWidth + 2
      const canvases = [...document.querySelectorAll('canvas')]
      const zero = canvases.filter((c) => !c.width || !c.height).length
      return { text: (main.innerText || '').slice(0, 300), overflow, canvases: canvases.length, zero }
    })()`)
    const row = { width, route, overflow: info.overflow, canvases: info.canvases, zero, consoleErrors: [...consoleErrors], text: info.text }
    rows.push(row)
    console.log(`${width} ${route.padEnd(52)} over=${row.overflow} canvas=${row.canvases} zero=${zero} err=${row.consoleErrors.length} | ${row.text.replace(/\s+/g, ' ').slice(0, 60)}`)
  }
}
// 已删路由：不应渲染对应功能（NotFound/重定向均可，但不得出现该功能页头）
await setSize(1600, 1000)
const notFound = []
for (const route of removed) {
  await nav(route)
  const text = await ev(`(() => (document.querySelector('main') || document.body).innerText || '')()`)
  const bad = /控制台|本地控制台|实验台|个人画像|预警中心|回测校准|年度复盘|个人数据|自动发现榜/.test(text)
  notFound.push({ route, bad, snippet: text.replace(/\s+/g, ' ').slice(0, 100) })
  console.log(`removed ${route.padEnd(20)} bad=${bad} | ${notFound[notFound.length - 1].snippet}`)
}
const out = { generated_at: new Date().toISOString(), rows, removed: notFound }
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 2))
const overflowCount = rows.filter((r) => r.overflow).length
const errCount = rows.reduce((a, r) => a + r.consoleErrors.length, 0)
const removedBad = notFound.filter((r) => r.bad).length
console.log(`SUMMARY routes=${routes.length} widths=2 overflow=${overflowCount} consoleErrors=${errCount} removedBad=${removedBad}`)
ws.close()
process.exit(overflowCount || errCount || removedBad ? 1 : 0)
