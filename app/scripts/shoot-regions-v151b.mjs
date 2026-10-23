/**
 * v1.5.1/1.5.2 修复区域特写：用 query 强制整页加载，避免 hash-only 导航问题。
 * 输出 app/screenshots/final-v1.5.1/fix*-{zh,en,1024}.png
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(appRoot, 'screenshots', 'final-v1.5.1')
fs.mkdirSync(outDir, { recursive: true })
const base = pathToFileURL(path.join(appRoot, 'dist', 'index.html')).href
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = 9920 + Math.floor(Math.random() * 60)
const profile = path.join(os.tmpdir(), `radar-regions2-${Date.now()}`)
fs.mkdirSync(profile, { recursive: true })
const proc = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--hide-scrollbars',
  '--allow-file-access-from-files', '--force-device-scale-factor=1', '--window-size=1600,1200',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${label}`)), ms))])
async function getTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page
    } catch {}
    await sleep(250)
  }
  throw new Error('CDP target not found')
}
const target = await getTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
})
const send = (method, params = {}) => new Promise((resolve) => {
  const msgId = ++id
  pending.set(msgId, resolve)
  ws.send(JSON.stringify({ id: msgId, method, params }))
})
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject) })
await send('Runtime.enable'); await send('Page.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
let navSeq = 0
const nav = async (hash, wait = 5200) => {
  navSeq += 1
  await withTimeout(send('Page.navigate', { url: `${base}?r=${navSeq}${hash}` }), 30000, hash)
  await sleep(wait)
}
const setViewport = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
const setLang = async (lang, width) => {
  await setViewport(width, 1200)
  await nav('#/', 3200)
  await ev(`localStorage.setItem('radar:lang:v1', ${JSON.stringify(lang)}); true`)
}
const waitFor = async (matcher) => {
  for (let i = 0; i < 20; i += 1) {
    const ok = await ev(`(() => [...document.querySelectorAll('section, div, h2, h3')].some((e) => { const t = (e.textContent || '').trim(); return t.startsWith(${JSON.stringify(matcher)}) && t.length < 140 }))()`)
    if (ok) return true
    await sleep(400)
  }
  return false
}
const shotRegion = async (name, matcher) => {
  const rect = await ev(`(() => {
    const nodes = [...document.querySelectorAll('section, div, h2, h3')]
    const head = nodes.find((e) => { const t = (e.textContent || '').trim(); return t.startsWith(${JSON.stringify(matcher)}) && t.length < 140 })
    const box = head ? head.closest('.panel') || head.parentElement : null
    if (!box) return null
    box.scrollIntoView({ block: 'center' })
    const r = box.getBoundingClientRect()
    return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }
  })()`)
  if (!rect) throw new Error(`region not found: ${matcher}`)
  await sleep(500)
  const res = await withTimeout(send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 1 } }), 40000, name)
  const data = res.result?.data
  if (!data) throw new Error(`screenshot failed: ${name}`)
  fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'))
  return { name, width: Math.round(rect.width), height: Math.round(rect.height), bytes: Buffer.from(data, 'base64').length }
}
const candidate = 'cand-5c555f56997d'
const REGIONS = [
  { key: 'fix1-capital', route: `#/candidates/${candidate}`, zh: '启动资金明细', en: 'Startup capital breakdown' },
  { key: 'fix2-execution', route: `#/candidates/${candidate}`, zh: '执行方案', en: 'Execution plan' },
  { key: 'fix3-unit-econ', route: '#/method', zh: '单位经济（示例）', en: 'Unit economics' },
  { key: 'fix4-sankey', route: '#/scanner', zh: '信息差类型桑基图', en: 'Sankey' },
]
const results = []
const MODE = process.argv[2] || 'zh1600'
const COMBOS = MODE === 'en1600' ? [['en', 'en', 1600]] : MODE === 'zh1024' ? [['zh', '1024', 1024]] : [['zh', 'zh', 1600]]
for (const [lang, suffix, width] of COMBOS) {
  await setLang(lang, width)
  for (const region of REGIONS) {
    await nav(region.route)
    console.log('AT', await ev('location.href'), 'LEN', await ev('document.body.innerText.length'))
    if (!(await waitFor(region[lang]))) throw new Error(`missing: ${'
    results.push({ ...(await shotRegion(`{region.key}-{suffix}.png`, region[lang])), lang, viewport: width })
  }
}
fs.writeFileSync(path.join(outDir, 'shots-regions.json'), JSON.stringify({ base, results }, null, 2))
console.log(JSON.stringify({ count: results.length, results }, null, 2))
ws.close()
proc.kill()
process.exit(0)
}{region[lang]}`)
    results.push({ ...(await shotRegion(`{region.key}-{suffix}.png`, region[lang])), lang, viewport: width })
  }
}
fs.writeFileSync(path.join(outDir, 'shots-regions.json'), JSON.stringify({ base, results }, null, 2))
console.log(JSON.stringify({ count: results.length, results }, null, 2))
ws.close()
proc.kill()
process.exit(0)
