/**
 * v1.5.1 截图脚本（开发自查用，不参与构建）
 * 输出：app/screenshots/final-v1.5.1/*.png + shots.json
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(process.argv[2] || path.join(appRoot, 'screenshots', 'final-v1.5.1'))
fs.mkdirSync(outDir, { recursive: true })
const base = pathToFileURL(path.join(appRoot, 'dist', 'index.html')).href
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = 9740 + Math.floor(Math.random() * 150)
const profile = path.join(os.tmpdir(), `radar-shoot151-${Date.now()}`)
fs.mkdirSync(profile, { recursive: true })

const proc = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--force-device-scale-factor=1',
    '--window-size=1600,1200',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const withTimeout = (promise, ms, label) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout: ${label}`)), ms))])

async function getTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page
    } catch {
      /* retry */
    }
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
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') logs.push((msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300))
  if (msg.method === 'Runtime.exceptionThrown') logs.push(String(msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || '').slice(0, 300))
})
const send = (method, params = {}) => new Promise((resolve) => {
  const msgId = ++id
  pending.set(msgId, resolve)
  ws.send(JSON.stringify({ id: msgId, method, params }))
})
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve)
  ws.addEventListener('error', reject)
})
await send('Runtime.enable')
await send('Page.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const nav = async (hash, wait = 4600) => {
  await withTimeout(send('Page.navigate', { url: `${base}${hash}` }), 30000, `nav ${hash}`)
  await sleep(wait)
}
const setViewport = async (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
const setLang = async (lang) => {
  await nav('#/', 3000)
  await ev(`localStorage.setItem('radar:lang:v1', ${JSON.stringify(lang)}); true`)
  await send('Page.reload', { ignoreCache: true })
  await sleep(3000)
}
const scrollAll = async () => {
  await ev(`(async()=>{ const h=document.documentElement.scrollHeight; const step=Math.max(600, innerHeight*0.8); for(let y=0;y<h;y+=step){ window.scrollTo(0,y); await new Promise(r=>setTimeout(r,70)); } window.scrollTo(0,0); await new Promise(r=>setTimeout(r,250)); return h })()`)
}
const shot = async (name, fullPage = false) => {
  let clip
  if (fullPage) {
    const metrics = await send('Page.getLayoutMetrics')
    const size = metrics.result?.cssContentSize || metrics.result?.contentSize
    clip = { x: 0, y: 0, width: Math.ceil(size?.width || 1600), height: Math.min(Math.ceil(size?.height || 1200), 15000), scale: 1 }
  }
  const res = await withTimeout(
    send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!fullPage, ...(clip ? { clip } : {}) }),
    40000,
    name,
  )
  const data = res.result?.data
  if (!data) throw new Error(`screenshot failed: ${name}`)
  fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'))
  return Buffer.from(data, 'base64').length
}
const shotRegion = async (name, matcher) => {
  const rect = await ev(`(() => {
    const nodes = [...document.querySelectorAll('section, div')]
    const head = nodes.find((e) => e.childElementCount > 0 && (e.textContent || '').trim().startsWith(${JSON.stringify(matcher)}))
    const box = head ? head.closest('.panel') || head.parentElement : null
    if (!box) return null
    box.scrollIntoView({ block: 'center' })
    const r = box.getBoundingClientRect()
    return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }
  })()`)
  if (!rect) throw new Error(`region not found: ${matcher}`)
  await sleep(600)
  const res = await withTimeout(
    send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 1 } }),
    40000,
    name,
  )
  const data = res.result?.data
  if (!data) throw new Error(`region screenshot failed: ${name}`)
  fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'))
  return Buffer.from(data, 'base64').length
}

const candidate = 'cand-5c555f56997d'
const curated = 'opp-pet-memorial-glass-001'
const results = []
const record = async (name, full = false) => {
  const bytes = await shot(name, full)
  results.push({ name, bytes })
}

// 1600 zh/en：详情、精选详情、榜单、方法论、扫描室
for (const lang of ['zh', 'en']) {
  await setLang(lang)
  await setViewport(1600, 1200)
  await nav(`#/candidates/${candidate}`, 5200)
  await scrollAll()
  await record(`candidate-detail-${lang}.png`, true)
  await nav(`#/opportunities/${curated}`, 5200)
  await scrollAll()
  await record(`curated-detail-${lang}.png`, true)
  await nav('#/rankings', 4800)
  await ev('window.scrollTo(0,0)')
  await sleep(400)
  await record(`rankings-${lang}.png`)
  await nav('#/method', 5000)
  await scrollAll()
  await record(`method-${lang}.png`, true)
  await nav('#/scanner', 6200)
  await ev('window.scrollTo(0,0)')
  await sleep(400)
  await record(`scanner-${lang}.png`)
}

// 1440：详情/榜单/方法论/扫描室 首屏
await setLang('zh')
await setViewport(1440, 1100)
for (const [route, name] of [
  [`#/candidates/${candidate}`, 'candidate-detail-1440.png'],
  ['#/rankings', 'rankings-1440.png'],
  ['#/method', 'method-1440.png'],
  ['#/scanner', 'scanner-1440.png'],
]) {
  await nav(route, 5000)
  await ev('window.scrollTo(0,0)')
  await sleep(400)
  await record(name)
}

// 1024：详情/榜单/方法论/扫描室
await setViewport(1024, 1200)
for (const [route, name, full] of [
  [`#/candidates/${candidate}`, 'detail-1024.png', true],
  ['#/rankings', 'rankings-1024.png', false],
  ['#/method', 'method-1024.png', true],
  ['#/scanner', 'scanner-1024.png', true],
]) {
  await nav(route, 5200)
  await scrollAll()
  await record(name, full)
}

// 4 个修复区域特写：zh/en 1600 + zh 1024
const REGIONS = [
  { key: 'fix1-capital', route: `#/candidates/${candidate}`, matcher: '启动资金明细' },
  { key: 'fix2-execution', route: `#/candidates/${candidate}`, matcher: '执行方案' },
  { key: 'fix3-unit-econ', route: '#/method', matcher: '单位经济（示例）' },
  { key: 'fix4-sankey', route: '#/scanner', matcher: '信息差类型桑基图' },
]
for (const [lang, suffix, width] of [['zh', 'zh', 1600], ['en', 'en', 1600], ['zh', '1024', 1024]]) {
  await setLang(lang)
  await setViewport(width, 1200)
  for (const region of REGIONS) {
    await nav(region.route, 4800)
    const name = `${region.key}-${suffix}.png`
    const bytes = await shotRegion(name, region.matcher)
    results.push({ name, lang, width, bytes })
  }
}

fs.writeFileSync(path.join(outDir, 'shots.json'), JSON.stringify({ base, results, consoleErrors: logs }, null, 2))
console.log(JSON.stringify({ count: results.length, consoleErrors: logs.slice(0, 10) }, null, 2))
ws.close()
proc.kill()
process.exit(0)
