/**
 * v1.8.0 截图：详情分析区 zh/en/1024、榜单主导型徽标 zh/en/1024、方法论、精选回归。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(path.join(appRoot, 'screenshots', 'final-v1.8.0'))
fs.mkdirSync(outDir, { recursive: true })
const ranking = JSON.parse(fs.readFileSync(path.resolve(appRoot, '..', 'data', 'candidate-rankings.json'), 'utf8'))
const candidatesData = JSON.parse(fs.readFileSync(path.resolve(appRoot, '..', 'data', 'candidates.json'), 'utf8'))
const withAnalysis = new Set(candidatesData.candidates.filter((c) => c.analysis).map((c) => c.candidate_id))
const weekIds = (ranking.windows?.week?.items || []).map((x) => x.candidate_id)
const topCandidate = weekIds.find((id) => withAnalysis.has(id)) || candidatesData.candidates.find((c) => c.analysis)?.candidate_id || 'cand-ea70f74fdd9e'
const curated = 'opp-pet-memorial-glass-001'
const base = pathToFileURL(path.join(appRoot, 'dist', 'index.html')).href
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = 9280 + Math.floor(Math.random() * 80)
const profile = path.join(os.tmpdir(), `radar-shoot180-${Date.now()}`)
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
    clip = { x: 0, y: 0, width: Math.ceil(size?.width || 1600), height: Math.min(Math.ceil(size?.height || 1200), 17000), scale: 1 }
  }
  const res = await withTimeout(send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!fullPage, ...(clip ? { clip } : {}) }), 45000, name)
  const data = res.result?.data
  if (!data) throw new Error(`screenshot failed: ${name}`)
  fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'))
  return { name, bytes: Buffer.from(data, 'base64').length }
}
const waitForText = async (text) => {
  for (let i = 0; i < 20; i += 1) {
    if (await ev(`(document.body.innerText||'').includes(${JSON.stringify(text)})`)) return true
    await sleep(400)
  }
  return false
}
const shotElement = async (name, finder) => {
  const rect = await ev(finder)
  if (!rect) throw new Error(`element not found: ${name}`)
  await sleep(500)
  const res = await withTimeout(send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 } }), 45000, name)
  const data = res.result?.data
  if (!data) throw new Error(`screenshot failed: ${name}`)
  fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'))
  return { name, width: Math.round(rect.width), height: Math.round(rect.height), bytes: Buffer.from(data, 'base64').length }
}
const analysisFinder = (heading) => `(() => {
  const h = [...document.querySelectorAll('h2')].find((e) => (e.textContent || '').trim().startsWith(${JSON.stringify(heading)}))
  const box = h ? h.closest('section') : null
  if (!box) return null
  box.scrollIntoView({ block: 'start' })
  const r = box.getBoundingClientRect()
  return { x: r.left + scrollX, y: r.top + scrollY - 26, width: r.width, height: Math.min(r.height + 26, 6000) }
})()`
const badgeFinder = (label) => `(() => {
  const el = [...document.querySelectorAll('span')].find((e) => (e.textContent || '').trim() === ${JSON.stringify(label)})
  const card = el ? el.closest('article') : null
  if (!card) return null
  card.scrollIntoView({ block: 'center' })
  const r = card.getBoundingClientRect()
  return { x: r.left + scrollX - 8, y: r.top + scrollY - 8, width: r.width + 16, height: r.height + 16 }
})()`

const results = []
// 1600 zh/en：详情分析区 + 榜单徽标 + 方法论 + 精选回归
for (const lang of ['zh', 'en']) {
  await setViewport(1600, 1200)
  await nav('#/', 3000)
  await ev(`localStorage.setItem('radar:lang:v1', ${JSON.stringify(lang)}); true`)
  await nav(`#/candidates/${topCandidate}`, 5800)
  await waitForText(lang === 'zh' ? '商机分析' : 'Opportunity analysis')
  results.push({ ...(await shotElement(`analysis-${lang}.png`, analysisFinder(lang === 'zh' ? '商机分析' : 'Opportunity analysis'))), lang })
  await nav('#/rankings', 5200)
  await waitForText(lang === 'zh' ? '主导型机会' : 'Single-axis')
  results.push({ ...(await shot(`rankings-${lang}.png`)), lang })
  results.push({ ...(await shotElement(`rankings-badge-${lang}.png`, badgeFinder(lang === 'zh' ? '主导型机会' : 'Single-axis'))), lang })
  await nav(`#/opportunities/${curated}`, 5200)
  const curatedHasAnalysis = await ev(`(document.body.innerText||'').includes(${JSON.stringify(lang === 'zh' ? '商机分析' : 'Opportunity analysis')})`)
  results.push({ ...(await shot(`curated-detail-${lang}.png`, true)), lang, curatedHasAnalysis })
  await nav('#/method', 5200)
  await scrollAll()
  results.push({ ...(await shot(`method-${lang}.png`, true)), lang })
}

// 1024：详情分析区 + 榜单徽标 + 详情全页
await setViewport(1024, 1200)
await nav('#/', 3000)
await ev(`localStorage.setItem('radar:lang:v1','zh'); true`)
await nav(`#/candidates/${topCandidate}`, 5600)
await waitForText('商机分析')
results.push({ ...(await shotElement('analysis-1024.png', analysisFinder('商机分析'))), viewport: 1024 })
await nav('#/candidates/' + topCandidate, 5000)
await scrollAll()
results.push({ ...(await shot('candidate-detail-1024.png', true)), viewport: 1024 })
await nav('#/rankings', 5200)
await waitForText('主导型机会')
results.push({ ...(await shot('rankings-1024.png')), viewport: 1024 })
await nav('#/rankings', 4800)
results.push({ ...(await shotElement('rankings-badge-1024.png', badgeFinder('主导型机会'))), viewport: 1024 })

fs.writeFileSync(path.join(outDir, 'shots.json'), JSON.stringify({ topCandidate, curated, base, results, consoleErrors: logs }, null, 2))
console.log(JSON.stringify({ topCandidate, count: results.length, consoleErrors: logs.slice(0, 8), results }, null, 2))
ws.close()
proc.kill()
process.exit(0)
