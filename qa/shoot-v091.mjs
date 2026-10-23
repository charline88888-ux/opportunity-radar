// qa/shoot-v091.mjs —— v0.9.1 发现榜/候选详情/双轨/指挥台入口截图（zh/en + 1024）
// 用法：node qa/shoot-v09.mjs <debugPort> <fileBase> <outDir>
import fs from 'node:fs'
import path from 'node:path'

const [port, fileBase, outDir] = process.argv.slice(2)
if (!port || !fileBase || !outDir) {
  console.error('usage: node qa/shoot-v09.mjs <port> <fileBase> <outDir>')
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
const nav = async (url) => { await send('Page.navigate', { url }); await sleep(3200) }
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(3200) }
const setLang = async (lang) => ev(`(() => { localStorage.setItem('radar:lang:v1', ${JSON.stringify(lang)}); return true })()`)
const click = async (label) => ev(`(() => { const b = [...document.querySelectorAll('button')].find(e => (e.innerText || '').trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true })()`)
const clickRe = async (re) => ev(`(() => { const b = [...document.querySelectorAll('button')].find(e => ${re}.test(e.innerText || '')); if (!b) return false; b.click(); return true })()`)
const screenshot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, 'base64'))
  const text = await ev(`(() => (document.body.innerText || '').slice(0, 240))()`)
  console.log(name, Buffer.from(r.result.data, 'base64').length, '|', (text.match(/.{0,20}(自动发现|Discover|发现榜).{0,40}/i) || [''])[0])
}

// zh：发现榜四窗口
await setLang('zh'); await nav(`${fileBase}#/discover`); await reload(); await sleep(600)
await screenshot('discover-day-zh.png')
for (const [label, name] of [['周榜', 'discover-week-zh.png'], ['月榜', 'discover-month-zh.png'], ['年榜', 'discover-year-zh.png']]) {
  await click(label); await sleep(800); await screenshot(name)
}
await click('日榜'); await sleep(600)
// 候选详情
await clickRe('/自动发现 · 未验证/'); await sleep(1000)
await screenshot('candidate-detail-zh.png')
await clickRe('/精选榜（人工|发现榜（自动/'); await sleep(400)
await ev(`(() => { const b = document.querySelector('button[aria-label="关闭详情"], button[aria-label="Close details"]'); if (b) b.click(); return true })()`)
await sleep(400)
// 双轨排行榜
await nav(`${fileBase}#/rankings`); await reload(); await sleep(800)
await screenshot('rankings-discover-zh.png')
await clickRe('/精选榜（人工/'); await sleep(900)
await screenshot('rankings-curated-zh.png')
await clickRe('/发现榜（自动/'); await sleep(600)
// 指挥台发现入口
await nav(`${fileBase}#/`); await reload(); await sleep(900)
await screenshot('dashboard-discover-entry-zh.png')
// EN 发现榜 + 详情
await setLang('en'); await nav(`${fileBase}#/discover`); await reload(); await sleep(600)
await screenshot('discover-day-en.png')
await clickRe('/Auto-discovered · unverified/'); await sleep(1000)
await screenshot('candidate-detail-en.png')
// 1024 发现榜
await ev(`(() => { window.location.hash = '#/discover'; return true })()`); await sleep(800)
await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 1000, deviceScaleFactor: 1, mobile: false })
await reload(); await sleep(800)
await screenshot('discover-1024-en.png')
await send('Emulation.clearDeviceMetricsOverride')
// v0.9.1：源页与控制台边界/候选 gap 详情
await setLang('zh'); await nav(`${fileBase}#/sources`); await reload(); await sleep(800)
await screenshot('sources-160-zh.png')
await setLang('en'); await reload(); await sleep(800)
await screenshot('sources-160-en.png')
await setLang('zh'); await nav(`${fileBase}#/control`); await reload(); await sleep(800)
await screenshot('control-160-zh.png')
await setLang('zh')
ws.close()
process.exit(0)
