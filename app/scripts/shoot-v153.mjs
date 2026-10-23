/**
 * v1.5.3 截图（图表口径修正）：页面级 + 5 个修复区域 zh/en/1024。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(path.join(appRoot, 'screenshots', 'final-v1.5.3'))
fs.mkdirSync(outDir, { recursive: true })
const base = pathToFileURL(path.join(appRoot, 'dist', 'index.html')).href
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = 9080 + Math.floor(Math.random() * 80)
const profile = path.join(os.tmpdir(), `radar-shoot153-${Date.now()}`)
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
const logs = []
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') logs.push((msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 260))
  if (msg.method === 'Runtime.exceptionThrown') logs.push(String(msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || '').slice(0, 260))
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
const nav = async (hash, wait = 5400) => {
  navSeq += 1
  await withTimeout(send('Page.navigate', { url: `${base}?r=${navSeq}${hash}` }), 30000, hash)
  await sleep(wait)
}
const setViewport = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
const scrollAll = async () => {
  await ev(`(async()=>{ const h=document.documentElement.scrollHeight; const step=Math.max(700, innerHeight*0.85); for(let y=0;y<h;y+=step){ window.scrollTo(0,y); await new Promise(r=>setTimeout(r,60)); } window.scrollTo(0,0); await new Promise(r=>setTimeout(r,200)); return h })()`)
}
const shot = async (name, fullPage = false) => {
  let clip
  if (fullPage) {
    const metrics = await send('Page.getLayoutMetrics')
    const size = metrics.result?.cssContentSize || metrics.result?.contentSize
    clip = { x: 0, y: 0, width: Math.ceil(size?.width || 1600), height: Math.min(Math.ceil(size?.height || 1200), 15000), scale: 1 }
  }
  const res = await withTimeout(send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!fullPage, ...(clip ? { clip } : {}) }), 40000, name)
  const data = res.result?.data
  if (!data) throw new Error(`screenshot failed: ${name}`)
  fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'))
  return { name, bytes: Buffer.from(data, 'base64').length }
}
const waitFor = async (matcher) => {
  for (let i = 0; i < 22; i += 1) {
    const ok = await ev(`(() => [...document.querySelectorAll('section, div, h2, h3')].some((e) => { const t = (e.textContent || '').trim(); return t.startsWith(${JSON.stringify(matcher)}) && t.length < 150 }))()`)
    if (ok) return true
    await sleep(400)
  }
  return false
}
const shotRegion = async (name, matcher) => {
  const rect = await ev(`(() => {
    const nodes = [...document.querySelectorAll('section, div, h2, h3')]
    const head = nodes.find((e) => { const t = (e.textContent || '').trim(); return t.startsWith(${JSON.stringify(matcher)}) && t.length < 150 })
    const box = head ? head.closest('.panel') || head.parentElement : null
    if (!box) return null
    box.scrollIntoView({ block: 'center' })
    const r = box.getBoundingClientRect()
    return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }
  })()`)
  if (!rect) throw new Error(`region not found: ${matcher}`)
  await sleep(500)
  const res = await withTimeout(send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 } }), 40000, name)
  const data = res.result?.data
  if (!data) throw new Error(`region screenshot failed: ${name}`)
  fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'))
  return { name, width: Math.round(rect.width), height: Math.round(rect.height), bytes: Buffer.from(data, 'base64').length }
}

const candidate = 'cand-5c555f56997d'
const results = []

// 页面级：详情 zh/en 全页、榜单 zh、方法论 zh 全页、扫描室 zh
for (const lang of ['zh', 'en']) {
  await setViewport(1600, 1200)
  await nav('#/', 3200)
  await ev(`localStorage.setItem('radar:lang:v1', ${JSON.stringify(lang)}); true`)
  await nav(`#/candidates/${candidate}`, 5600)
  await scrollAll()
  results.push({ ...(await shot(`candidate-detail-${lang}.png`, true)), lang })
  await nav('#/method', 5200)
  await scrollAll()
  results.push({ ...(await shot(`method-${lang}.png`, true)), lang })
  await nav('#/rankings', 5000)
  await ev('window.scrollTo(0,0)')
  await sleep(400)
  results.push({ ...(await shot(`rankings-${lang}.png`)), lang })
}

// 5 个修复区域：zh/en 1600 + zh 1024
const REGIONS = [
  { key: 'fix1-capital', route: `#/candidates/${candidate}`, zh: '启动资金明细', en: 'Startup capital breakdown' },
  { key: 'fix2-unit-waterfall', route: `#/candidates/${candidate}`, zh: '单位经济 · 客单价', en: 'Unit economics · AOV' },
  { key: 'fix3-sensitivity', route: `#/candidates/${candidate}`, zh: '敏感性 · 单量', en: 'Sensitivity · orders' },
  { key: 'fix4-donut', route: `#/candidates/${candidate}`, zh: '收入结构 · 理论月收入', en: 'Revenue mix · theoretical monthly revenue' },
  { key: 'fix5-method-example', route: '#/method', zh: '单位经济（示例）', en: 'Unit economics' },
]
for (const [lang, suffix, width] of [['zh', 'zh', 1600], ['en', 'en', 1600], ['zh', '1024', 1024]]) {
  await setViewport(width, 1200)
  await nav('#/', 3200)
  await ev(`localStorage.setItem('radar:lang:v1', ${JSON.stringify(lang)}); true`)
  for (const region of REGIONS) {
    await nav(region.route, 5200)
    const matcher = region[lang]
    if (!(await waitFor(matcher))) throw new Error(`missing ${matcher} @${region.route}`)
    const info = await shotRegion(`${region.key}-${suffix}.png`, matcher)
    results.push({ ...info, lang, viewport: width })
  }
}

fs.writeFileSync(path.join(outDir, 'shots.json'), JSON.stringify({ base, results, consoleErrors: logs }, null, 2))
console.log(JSON.stringify({ count: results.length, consoleErrors: logs.slice(0, 8) }, null, 2))
ws.close()
proc.kill()
process.exit(0)
