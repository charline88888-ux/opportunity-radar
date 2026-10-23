/**
 * v1.5.0 截图脚本（开发自查用，不参与构建）
 * 用法：node scripts/shoot-v15.mjs [outDir]
 * 输出：app/screenshots/final-v1.5/*.png + shots.json（含 console error）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(process.argv[2] || path.join(appRoot, 'screenshots', 'final-v1.5'))
fs.mkdirSync(outDir, { recursive: true })
const base = pathToFileURL(path.join(appRoot, 'dist', 'index.html')).href
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = 9450 + Math.floor(Math.random() * 300)
const profile = path.join(os.tmpdir(), `radar-shoot-${Date.now()}`)
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
const nav = async (hash, wait = 3600) => {
  await send('Page.navigate', { url: `${base}${hash}` })
  await sleep(wait)
}
const setViewport = async (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
const setLang = async (lang) => {
  await nav('#/')
  await ev(`localStorage.setItem('radar:lang:v1', ${JSON.stringify(lang)}); true`)
  await send('Page.reload', { ignoreCache: true })
  await sleep(3200)
}
const scrollAll = async () => {
  await ev(`(async()=>{ const h=document.documentElement.scrollHeight; const step=Math.max(600, innerHeight*0.8); for(let y=0;y<h;y+=step){ window.scrollTo(0,y); await new Promise(r=>setTimeout(r,90)); } window.scrollTo(0,0); await new Promise(r=>setTimeout(r,400)); return h })()`)
}
const shot = async (name, fullPage = false) => {
  let clip
  if (fullPage) {
    const metrics = await send('Page.getLayoutMetrics')
    const size = metrics.result?.cssContentSize || metrics.result?.contentSize
    const height = Math.min(Math.ceil(size?.height || 1200), 14000)
    const width = Math.ceil(size?.width || 1600)
    clip = { x: 0, y: 0, width, height, scale: 1 }
  }
  const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!fullPage, ...(clip ? { clip } : {}) })
  const data = res.result?.data
  if (!data) throw new Error(`screenshot failed: ${name}`)
  fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'))
  return Buffer.from(data, 'base64').length
}

const candidate = 'cand-5c555f56997d'
const curated = 'opp-pet-memorial-glass-001'
const results = []

// zh / en 详情（全页）
for (const [lang, suffix] of [['zh', 'zh'], ['en', 'en']]) {
  await setLang(lang)
  for (const [route, name] of [
    [`#/candidates/${candidate}`, `candidate-detail-${suffix}.png`],
    [`#/opportunities/${curated}`, `curated-detail-${suffix}.png`],
  ]) {
    await setViewport(1600, 1200)
    await nav(route, 5200)
    await scrollAll()
    const bytes = await shot(name, true)
    results.push({ name, bytes, route, lang })
  }
}

// 榜单 zh / en（1600*1200 视口）
for (const [lang, suffix] of [['zh', 'zh'], ['en', 'en']]) {
  await setLang(lang)
  await setViewport(1600, 1200)
  await nav('#/rankings', 4800)
  await ev(`window.scrollTo(0,0)`)
  await sleep(600)
  const bytes = await shot(`rankings-${suffix}.png`)
  results.push({ name: `rankings-${suffix}.png`, bytes })
}

// 方法论（全页）
await setLang('zh')
await setViewport(1600, 1200)
await nav('#/method', 5200)
await scrollAll()
results.push({ name: 'method-zh.png', bytes: await shot('method-zh.png', true) })

// 1024 详情 + 榜单 + 精选详情
await setViewport(1024, 1200)
await nav(`#/candidates/${candidate}`, 5200)
await scrollAll()
results.push({ name: 'detail-1024.png', bytes: await shot('detail-1024.png', true) })
await nav('#/rankings', 4800)
await ev(`window.scrollTo(0,0)`)
await sleep(600)
results.push({ name: 'rankings-1024.png', bytes: await shot('rankings-1024.png') })
await nav(`#/opportunities/${curated}`, 5000)
await scrollAll()
results.push({ name: 'curated-detail-1024.png', bytes: await shot('curated-detail-1024.png', true) })

// 1440 榜单
await setViewport(1440, 1100)
await nav('#/rankings', 4800)
await ev(`window.scrollTo(0,0)`)
await sleep(600)
results.push({ name: 'rankings-1440.png', bytes: await shot('rankings-1440.png') })

fs.writeFileSync(path.join(outDir, 'shots.json'), JSON.stringify({ base, results, consoleErrors: logs }, null, 2))
console.log(JSON.stringify({ results, consoleErrors: logs.slice(0, 10) }, null, 2))
ws.close()
proc.kill()
process.exit(0)
