// qa/shoot-freshness.mjs —— v0.6.1 数据新鲜度三态截图（红色/琥珀/正常 + 数据过期预警 + About 更新说明）
// 用法：node qa/shoot-freshness.mjs <debugPort> <baseUrl> <outDir>
import fs from 'node:fs'
import path from 'node:path'

const [port, base, outDir] = process.argv.slice(2)
if (!port || !base || !outDir) { console.error('usage: node qa/shoot-freshness.mjs <port> <baseUrl> <outDir>'); process.exit(2) }
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
const nav = async (hash) => { await send('Page.navigate', { url: `${base}${hash}` }); await sleep(3200) }
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(3200) }
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, 'base64'))
  const texts = await ev(`(() => (document.body.innerText || '').slice(0, 1200))()`)
  console.log(name, 'bytes=', Buffer.from(r.result.data, 'base64').length, '|', (texts.match(/.{0,20}(AGING|STALE|数据已|建议运行每日任务).{0,60}/) || [''])[0])
}
const setOverride = async (daysAgo) => ev(`(() => {
  const d = new Date(); d.setDate(d.getDate() - ${daysAgo});
  const s = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  sessionStorage.setItem('radar:freshness:as_of', s);
  for (const k of Object.keys(sessionStorage)) if (k.startsWith('radar:freshness-dismissed')) sessionStorage.removeItem(k);
  localStorage.setItem('radar:lang:v1', 'zh');
  return s;
})()`)
const clearOverride = async () => ev(`(() => { for (const k of Object.keys(sessionStorage)) if (k.startsWith('radar:freshness')) sessionStorage.removeItem(k); return true })()`)

await nav('#/')
await clearOverride()
await setOverride(5)
await nav('#/'); await reload(); await sleep(600)
await shot('fresh-01-amber-dashboard.png')
await setOverride(13)
await nav('#/'); await reload(); await sleep(600)
await shot('fresh-02-red-dashboard.png')
await nav('#/alerts'); await sleep(1200)
await shot('fresh-03-red-alerts.png')
await nav('#/data'); await sleep(1200)
await shot('fresh-04-data-page.png')
await nav('#/about'); await sleep(1200)
await shot('fresh-05-about-updates.png')
// EN stale banner
await ev(`(() => { localStorage.setItem('radar:lang:v1', 'en'); for (const k of Object.keys(sessionStorage)) if (k.startsWith('radar:freshness-dismissed')) sessionStorage.removeItem(k); return true })()`)
await nav('#/'); await reload(); await sleep(600)
await shot('fresh-06-en-stale.png')
await ev(`(() => { localStorage.setItem('radar:lang:v1', 'zh'); return true })()`)
await clearOverride()
ws.close()
process.exit(0)
