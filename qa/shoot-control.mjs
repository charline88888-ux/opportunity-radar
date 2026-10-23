// qa/shoot-control.mjs —— v0.7 控制台截图（file:// 未启动态 + 真实 serve.py 已连接态，zh/en）
// 用法：node qa/shoot-control.mjs <debugPort> <fileBase> <serveBase> <outDir>
import fs from 'node:fs'
import path from 'node:path'

const [port, fileBase, serveBase, outDir] = process.argv.slice(2)
if (!port || !fileBase || !serveBase || !outDir) {
  console.error('usage: node qa/shoot-control.mjs <port> <fileBase> <serveBase> <outDir>')
  process.exit(2)
}
fs.mkdirSync(outDir, { recursive: true })
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
const nav = async (url) => { await send('Page.navigate', { url }); await sleep(3300) }
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(3300) }
const setLang = async (lang) => ev(`(() => { localStorage.setItem('radar:lang:v1', ${JSON.stringify(lang)}); return true })()`)
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, 'base64'))
  const text = await ev(`(() => (document.body.innerText || '').slice(0, 600))()`)
  console.log(name, Buffer.from(r.result.data, 'base64').length, '|', (text.match(/.{0,16}(未启动|已连接|offline|connected).{0,40}/i) || [''])[0])
}

// file:// 未启动态
await setLang('zh'); await nav(`${fileBase}#/control`); await reload(); await sleep(800)
await shot('control-offline-zh.png')
await setLang('en'); await reload(); await sleep(800)
await shot('control-offline-en.png')
// serve.py 已连接态
await setLang('zh'); await nav(`${serveBase}/#/control`); await sleep(800)
await shot('control-connected-zh.png')
await setLang('en'); await reload(); await sleep(1200)
await shot('control-connected-en.png')
await setLang('zh')
ws.close()
process.exit(0)
