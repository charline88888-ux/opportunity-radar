// qa/audit-ui-v140.mjs —— v1.4.0 红队 UI/UX 独立审计（v1.3.0 当前基线）
// 用法：node qa/audit-ui-v140.mjs <debugPort> <fileBase> <outJson> <shotDir>
import fs from 'node:fs'
import path from 'node:path'

const [port, base, outJson, shotDir] = process.argv.slice(2)
if (!port || !base) { console.error('usage: node qa/audit-ui-v140.mjs <port> <fileBase> [outJson] [shotDir]'); process.exit(2) }
fs.mkdirSync(shotDir || 'qa/screenshots/v140-audit', { recursive: true })
const outDir = shotDir || 'qa/screenshots/v140-audit'
async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === 'page'); if (p?.webSocketDebuggerUrl) return p } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('CDP target not found')
}
const target = await getTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
await send('Runtime.enable'); await send('Page.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const setSize = async (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
const nav = async (hash) => { await send('Page.navigate', { url: `${base}${hash}` }); await sleep(3500) }
const shot = async (name) => {
  try {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    fs.writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, 'base64'))
    return Buffer.from(r.result.data, 'base64').length
  } catch { return 0 }
}
const cid = 'cand-5c555f56997d'
const measure = async () => ev(`(() => {
  const txt = (el) => (el.innerText || '').trim().replace(/\\s+/g, ' ')
  const els = [...document.querySelectorAll('p,span,div,td,th,button,a,strong,li')].filter((e) => txt(e).length > 0 && e.offsetParent !== null)
  const hist = {}; const small = []
  for (const e of els) {
    const fs = parseFloat(getComputedStyle(e).fontSize) || 0
    const key = String(Math.round(fs * 10) / 10)
    hist[key] = (hist[key] || 0) + 1
    if (fs < 12) small.push({ fs: key, text: txt(e).slice(0, 40) })
  }
  const fontSizes = Object.values(hist)
  const body = document.body.innerText || ''
  const tokens = ['6–12 个月','55%','2-20 万','¥2-20 万','Malaysia','牌照','手续费','清算','资金归集','垂直 AI SaaS','供应链 + 本地化','6 个月','18 个月']
  const tokenCounts = Object.fromEntries(tokens.map((t) => [t, body.split(t).length - 1]))
  const sticky = [...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).position === 'sticky').map((e) => ({ h: e.getBoundingClientRect().height, sh: e.scrollHeight, top: getComputedStyle(e).top, text: txt(e).slice(0, 50) }))
  const anchorLinks = document.querySelectorAll('a[href^="#"], [data-anchor]').length
  const backTop = [...document.querySelectorAll('button,a')].some((e) => /返回顶部|top/i.test(e.innerText || ''))
  return {
    scrollHeight: document.documentElement.scrollHeight,
    viewport: innerHeight,
    overflow: document.documentElement.scrollWidth > innerWidth + 2,
    minFont: Math.min(...Object.keys(hist).map(Number)),
    fontHist: hist,
    smallCount: small.length,
    smallSamples: small.slice(0, 8),
    tokenCounts,
    sticky,
    stickyMax: sticky.length ? Math.max(...sticky.map((s) => s.sh)) : 0,
    anchorLinks,
    backTop,
    textLen: body.length,
  }
})()`)
const report = {}
for (const w of [1440, 1600, 1024]) {
  await setSize(w, 900)
  await nav(`#/candidates/${cid}`)
  report[`candidate-${w}`] = await measure()
  report[`candidate-${w}`].shot = await shot(`candidate-${w}.png`)
  await nav('#/rankings')
  report[`rankings-${w}`] = await measure()
  if (w === 1600) report[`rankings-${w}`].shot = await shot(`rankings-${w}.png`)
}
if (outJson) fs.writeFileSync(outJson, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2).slice(0, 12000))
ws.close()
