/**
 * v1.6.0 截图：详情/精选详情/榜单/方法论/扫描室 zh+en + 1024。
 * 候选详情 ID 自动取 candidate-rankings 周榜第 1 名，避免数据换 id。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(path.join(appRoot, 'screenshots', 'final-v1.6.0'))
fs.mkdirSync(outDir, { recursive: true })
const rankingFile = path.resolve(appRoot, '..', 'data', 'candidate-rankings.json')
const ranking = JSON.parse(fs.readFileSync(rankingFile, 'utf8'))
const topCandidate = ranking.windows?.week?.items?.[0]?.candidate_id || 'cand-c6387b9ec2fc'
const curated = 'opp-pet-memorial-glass-001'
const base = pathToFileURL(path.join(appRoot, 'dist', 'index.html')).href
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = 9180 + Math.floor(Math.random() * 80)
const profile = path.join(os.tmpdir(), `radar-shoot160-${Date.now()}`)
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
const nav = async (hash, wait = 5200) => {
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
    clip = { x: 0, y: 0, width: Math.ceil(size?.width || 1600), height: Math.min(Math.ceil(size?.height || 1200), 16000), scale: 1 }
  }
  const res = await withTimeout(send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!fullPage, ...(clip ? { clip } : {}) }), 40000, name)
  const data = res.result?.data
  if (!data) throw new Error(`screenshot failed: ${name}`)
  fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'))
  return { name, bytes: Buffer.from(data, 'base64').length }
}

const results = []
const PAGES_FULL = [
  [`#/candidates/${topCandidate}`, 'candidate-detail'],
  [`#/opportunities/${curated}`, 'curated-detail'],
  ['#/method', 'method'],
]
const PAGES_VIEW = [
  ['#/rankings', 'rankings'],
  ['#/scanner', 'scanner'],
]
for (const lang of ['zh', 'en']) {
  await setViewport(1600, 1200)
  await nav('#/', 3000)
  await ev(`localStorage.setItem('radar:lang:v1', ${JSON.stringify(lang)}); true`)
  for (const [route, name] of PAGES_FULL) {
    await nav(route, 5600)
    await scrollAll()
    results.push({ ...(await shot(`${name}-${lang}.png`, true)), lang })
  }
  for (const [route, name] of PAGES_VIEW) {
    await nav(route, 5200)
    await ev('window.scrollTo(0,0)')
    await sleep(400)
    results.push({ ...(await shot(`${name}-${lang}.png`)), lang })
  }
}

await setViewport(1024, 1200)
for (const [route, name, full] of [
  [`#/candidates/${topCandidate}`, 'candidate-detail', true],
  [`#/opportunities/${curated}`, 'curated-detail', true],
  ['#/rankings', 'rankings', false],
  ['#/method', 'method', true],
  ['#/scanner', 'scanner', false],
]) {
  await nav(route, 5400)
  await scrollAll()
  results.push({ ...(await shot(`${name}-1024.png`, full)), viewport: 1024 })
}

fs.writeFileSync(path.join(outDir, 'shots.json'), JSON.stringify({ topCandidate, curated, base, results, consoleErrors: logs }, null, 2))
console.log(JSON.stringify({ topCandidate, count: results.length, consoleErrors: logs.slice(0, 8) }, null, 2))
ws.close()
proc.kill()
process.exit(0)
