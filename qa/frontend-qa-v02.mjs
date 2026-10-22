// qa/frontend-qa-v02.mjs —— v0.2.0 前端红队检查（9 路由 + /lab 实验台 CRUD/导出 + delta_basis 文案 + 1024/1600 CDP）
// 用法：node qa/frontend-qa-v02.mjs <debugPort> <baseUrl> <width> <height> [downloadDir]
const [port, base, width, height, downloadDir] = process.argv.slice(2)
if (!port || !base) {
  console.error('usage: node qa/frontend-qa-v02.mjs <port> <baseUrl> <width> <height> [downloadDir]')
  process.exit(2)
}
const vw = Number(width || 1600)
const vh = Number(height || 1000)
const routes = ['#/', '#/rankings', '#/opportunities/opp-pet-memorial-glass-001', '#/opportunities/opp-gaming-arabic-l10n-043', '#/lab', '#/scanner', '#/method', '#/sources', '#/calendar', '#/about']

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('CDP target not found')
}
const target = await getTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
let consoleErrors = []
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(String(msg.params?.exceptionDetails?.text || 'exception').slice(0, 160))
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') consoleErrors.push((msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160))
})
const send = (method, params = {}) => new Promise((resolve) => { const msgId = ++id; pending.set(msgId, resolve); ws.send(JSON.stringify({ id: msgId, method, params })) })
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
await send('Runtime.enable'); await send('Page.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (downloadDir) {
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir }).catch(() => {})
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: false }).catch(() => {})
}

const probe = `(() => {
  const de = document.documentElement
  const canvases = [...document.querySelectorAll('canvas')]
  const text = document.body.innerText || ''
  const over = []
  for (const el of document.querySelectorAll('main *')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && r.right > innerWidth + 1) {
      let p = el.parentElement, scrollable = false
      while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') { scrollable = true; break } p = p.parentElement }
      if (!scrollable) over.push({ tag: el.tagName.toLowerCase(), cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60), right: Math.round(r.right) })
    }
  }
  return {
    h1: (document.querySelector('h1')?.innerText || '').slice(0, 50),
    route: location.hash,
    innerWidth, docScrollWidth: de.scrollWidth,
    horizontalOverflow: de.scrollWidth > innerWidth + 1,
    clippedElements: over.length, clippedSamples: over.slice(0, 3),
    textLength: text.length,
    hasDisclaimer: text.includes('不构成投资建议') || text.includes('免责声明'),
    hasVersion2: text.includes('v0.2.0') || text.includes('0.2.0'),
    hasDeltaLabel: text.includes('相邻窗口') || text.includes('上一快照') || text.includes('口径'),
    hasLabText: text.includes('实验') || text.includes('LAB'),
    canvasCount: canvases.length,
    zeroSizeCanvas: canvases.filter((c) => c.width === 0 || c.height === 0).length,
    notFound: text.includes('页面不存在'),
  }
})()`

const results = []
for (const route of routes) {
  consoleErrors = []
  await send('Page.navigate', { url: `${base}${route}` })
  await sleep(3200)
  const state = await ev(probe)
  results.push({ route, ...state, consoleErrors })
}

// ---------- /lab 实验台流程（localStorage + 导出） ----------
const lab = { steps: [] }
await send('Page.navigate', { url: `${base}#/opportunities/opp-pet-memorial-glass-001` })
await sleep(3000)
// 清空旧实验，保证可复现
await ev(`(() => { for (const k of Object.keys(localStorage)) if (/experiment|lab|exp/i.test(k)) localStorage.removeItem(k); return Object.keys(localStorage); })()`)
await sleep(300)
const beforeKeys = await ev(`(() => Object.keys(localStorage))()`)
lab.storageBefore = beforeKeys
// 找“开始/加入实验”类按钮并点击
const clickResult = await ev(`(() => {
  const els = [...document.querySelectorAll('button, a, [role="button"]')]
  const b = els.find((e) => /开始.*实验|加入.*实验|实验.*开始|标记.*实验|开始 7 天/.test((e.innerText || '').trim()))
  if (!b) return { clicked: false, candidates: els.map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 40) }
  b.click(); return { clicked: true, label: (b.innerText || '').trim().slice(0, 40) }
})()`)
lab.addClick = clickResult
await sleep(1000)
// 若打开“加入实验”面板，点击「加入并开始」提交
lab.confirmClick = await ev(`(() => {
  const els = [...document.querySelectorAll('button, a, [role="button"]')]
  const b = els.find((e) => /加入并开始|确认加入|确认|开始实验|保存/.test((e.innerText || '').trim()))
  if (!b) return null
  b.click(); return (b.innerText || '').trim().slice(0, 40)
})()`)
await sleep(900)
lab.storageAfterAdd = await ev(`(() => Object.keys(localStorage).map((k) => [k, String(localStorage.getItem(k)).slice(0, 400)]))()`)
// 进入 /lab 查看
await send('Page.navigate', { url: `${base}#/lab` })
await sleep(3000)
lab.labText = (await ev(`(() => (document.body.innerText || '').slice(0, 1200))()`)) || ''
lab.labHasExperiment = /进行中|已完成|已验证|已放弃|实验/.test(lab.labText)
// 尝试导出 Markdown/JSON（点击包含“导出”的按钮）
const exportClicks = await ev(`(() => {
  const out = []
  const els = [...document.querySelectorAll('button, a, [role="button"]')]
  for (const e of els) {
    const t = (e.innerText || '').trim()
    if (/导出|下载/.test(t)) { e.click(); out.push(t.slice(0, 40)) }
  }
  return out
})()`)
lab.exportClicks = exportClicks
await sleep(1500)
// 详情页 Markdown 导出
await send('Page.navigate', { url: `${base}#/opportunities/opp-pet-memorial-glass-001` })
await sleep(3000)
lab.detailExportClicks = await ev(`(() => {
  const out = []
  const els = [...document.querySelectorAll('button, a, [role="button"]')]
  for (const e of els) { const t = (e.innerText || '').trim(); if (/下载机会卡|机会卡 \\.md|导出本周报告|报告 \\.html/.test(t)) { e.click(); out.push(t.replace(/\\n/g, ' / ').slice(0, 60)) } }
  return out
})()`)
await sleep(1800)

// delta_basis 文案
await send('Page.navigate', { url: `${base}#/rankings` })
await sleep(3000)
lab.deltaLabel = await ev(`(() => { const t = document.body.innerText || ''; const m = t.match(/(相邻窗口|上一快照|口径[^\\n]{0,40})/); return m ? m[0] : null })()`)

let downloads = []
if (downloadDir) {
  try {
    const fs = await import('node:fs')
    downloads = fs.readdirSync(downloadDir).map((name) => {
      const p = `${downloadDir}/${name}`
      const size = fs.statSync(p).size
      let head = ''
      try { head = fs.readFileSync(p, 'utf8').slice(0, 400) } catch {}
      return { name, size, head }
    })
  } catch (e) { downloads = [{ error: String(e) }] }
}

console.log(JSON.stringify({ viewport: { width: vw, height: vh }, routes: results, lab, downloads }, null, 2))
ws.close()
process.exit(0)
