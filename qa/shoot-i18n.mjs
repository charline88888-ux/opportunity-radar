// qa/shoot-i18n.mjs —— v0.4.0 双语截图（zh/en × 6 关键页面），CDP 设置 localStorage 后截图
// 用法：node qa/shoot-i18n.mjs <debugPort> <baseUrl> <outDir>
import fs from 'node:fs'
import path from 'node:path'

const [port, base, outDir] = process.argv.slice(2)
if (!port || !base || !outDir) { console.error('usage: node qa/shoot-i18n.mjs <port> <baseUrl> <outDir>'); process.exit(2) }
fs.mkdirSync(outDir, { recursive: true })
const pages = [
  ['dashboard', '#/'],
  ['rankings', '#/rankings'],
  ['profile', '#/profile'],
  ['alerts', '#/alerts'],
  ['calibration', '#/calibration'],
  ['yearbook', '#/yearbook'],
  ['data', '#/data'],
  ['control', '#/control'],
  ['about', '#/about'],
]

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
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
await send('Runtime.enable'); await send('Page.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

for (const lang of ['zh', 'en']) {
  for (const [name, hash] of pages) {
    await send('Page.navigate', { url: `${base}${hash}` })
    await sleep(2600)
    await ev(`(() => { localStorage.setItem('radar:lang:v1', ${JSON.stringify(lang)}); return true })()`)
    await send('Page.reload', { ignoreCache: true })
    await sleep(3200)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const file = path.join(outDir, `${lang}-${name}.png`)
    fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'))
    const meta = await ev(`(() => ({ lang: document.documentElement.lang, title: document.title, len: document.body.innerText.length }))()`)
    console.log(`${lang}-${name}: ${fs.statSync(file).size}B lang=${meta.lang} title=${meta.title}`)
  }
}
ws.close()
process.exit(0)
