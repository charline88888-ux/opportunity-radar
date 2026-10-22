// qa/frontend-qa-v03.mjs —— v0.3.0 前端红队检查（12 路由 + /profile 推荐 + /alerts + /calibration + delta 标签 + 1024）
// 用法：node qa/frontend-qa-v03.mjs <debugPort> <baseUrl> <width> <height> [downloadDir]
const [port, base, width, height, downloadDir] = process.argv.slice(2)
if (!port || !base) { console.error('usage: node qa/frontend-qa-v03.mjs <port> <baseUrl> <w> <h> [downloadDir]'); process.exit(2) }
const vw = Number(width || 1600), vh = Number(height || 1000)
const routes = [
  '#/', '#/rankings', '#/opportunities/opp-pet-memorial-glass-001', '#/scanner', '#/method',
  '#/sources', '#/calendar', '#/lab', '#/profile', '#/alerts', '#/calibration', '#/about',
]

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const p = list.find((t) => t.type === 'page')
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
let consoleErrors = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(String(m.params?.exceptionDetails?.text || 'exception').slice(0, 150))
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') consoleErrors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 150))
})
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })) })
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
      if (!scrollable) over.push({ tag: el.tagName.toLowerCase(), right: Math.round(r.right) })
    }
  }
  return {
    route: location.hash, h1: (document.querySelector('h1')?.innerText || '').slice(0, 50),
    innerWidth, docScrollWidth: de.scrollWidth, horizontalOverflow: de.scrollWidth > innerWidth + 1,
    clippedElements: over.length, textLength: text.length,
    hasDisclaimer: text.includes('非投资建议') || text.includes('不构成投资建议'),
    hasVersion3: text.includes('v0.3.0') || text.includes('0.3.0'),
    hasDeltaHistory: text.includes('较上一快照') || text.includes('上一份快照') || text.includes('历史回放'),
    hasLab: /实验/.test(text),
    canvasCount: canvases.length, zeroSizeCanvas: canvases.filter((c) => c.width === 0 || c.height === 0).length,
    notFound: text.includes('页面不存在'),
  }
})()`

const results = []
for (const route of routes) {
  consoleErrors = []
  await send('Page.navigate', { url: `${base}${route}` })
  await sleep(3200)
  results.push({ route, ...(await ev(probe)), consoleErrors })
}

// ---------- /profile 画像 + 推荐重排 ----------
const profile = { steps: [] }
await send('Page.navigate', { url: `${base}#/profile` })
await sleep(3000)
profile.beforeTextLength = await ev(`(() => (document.body.innerText || '').length)()`)
await ev(`(() => { for (const k of Object.keys(localStorage)) if (/profile|画像|recommend/i.test(k)) localStorage.removeItem(k); return Object.keys(localStorage) })()`)
// 填表：给所有 input/select 赋合理值（保留已有值优先）
profile.fill = await ev(`(() => {
  const els = [...document.querySelectorAll('input, select, textarea')]
  const applied = []
  for (const el of els) {
    if (el.type === 'checkbox' || el.type === 'radio') { el.checked = true; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); applied.push(el.name || el.id || el.type); continue }
    const tag = el.tagName.toLowerCase()
    if (tag === 'select') {
      if (el.options.length > 1) { el.selectedIndex = Math.min(el.options.length - 1, 2); el.dispatchEvent(new Event('change', { bubbles: true })); applied.push(el.name || el.id || 'select') }
      continue
    }
    if (el.type === 'range' || el.type === 'number') {
      const min = Number(el.min || 0), max = Number(el.max || 100)
      el.value = String(Math.round((min + max) / 2))
    } else if (el.type === 'text' || el.type === 'email' || !el.type) {
      el.value = el.placeholder ? '测试画像' : '12000'
    }
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    applied.push(el.name || el.id || el.type || tag)
  }
  return applied.slice(0, 30)
})()`)
await sleep(500)
profile.saveClick = await ev(`(() => {
  const els = [...document.querySelectorAll('button, a, [role=button]')]
  const b = els.find((e) => /保存|应用|生成推荐|开始推荐|更新画像/.test((e.innerText || '').trim()))
  if (!b) return { clicked: false, buttons: els.map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 30) }
  b.click(); return { clicked: true, label: (b.innerText || '').trim().slice(0, 40) }
})()`)
await sleep(1200)
profile.storage = await ev(`(() => Object.keys(localStorage).map((k) => [k, String(localStorage.getItem(k)).slice(0, 260)]))()`)
profile.afterText = (await ev(`(() => (document.body.innerText || '').slice(0, 800))()`)) || ''

// 推荐榜：切「为你推荐」
await send('Page.navigate', { url: `${base}#/rankings` })
await sleep(3200)
profile.recommendClick = await ev(`(() => {
  const els = [...document.querySelectorAll('button, a, [role=button], [role=tab]')]
  const b = els.find((e) => /为你推荐|推荐榜|个性化/.test((e.innerText || '').trim()))
  if (!b) return { clicked: false }
  b.click(); return { clicked: true, label: (b.innerText || '').trim().slice(0, 30) }
})()`)
await sleep(1500)
profile.recCards = await ev(`(() => {
  const cards = [...document.querySelectorAll('main a[href*="#/opportunities/"]')].slice(0, 8)
  return cards.map((a) => (a.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 220))
})()`)
profile.recExplanations = await ev(`(() => {
  const text = document.body.innerText || ''
  const hits = [...text.matchAll(/(为什么推荐|为什么不适合|推荐理由|不推荐)[^\\n]{0,120}/g)].map((m) => m[0])
  return hits.slice(0, 8)
})()`)

// ---------- /alerts ----------
const alerts = {}
await send('Page.navigate', { url: `${base}#/alerts` })
await sleep(3000)
alerts.text = (await ev(`(() => (document.body.innerText || '').slice(0, 1000))()`)) || ''
alerts.count = await ev(`(() => { const t = document.body.innerText || ''; const m = t.match(/(\\d+)\\s*条预警/); return m ? Number(m[1]) : null })()`)
alerts.buttons = await ev(`(() => [...document.querySelectorAll('button')].map((b) => ({ text: (b.innerText || '').trim().slice(0, 32), disabled: b.disabled })).filter((x) => x.text).slice(0, 25))()`)
alerts.ignoreClick = await ev(`(() => {
  const els = [...document.querySelectorAll('button, a, [role=button]')]
  const b = els.find((e) => /忽略|已读|标记/.test((e.innerText || '').trim()))
  if (!b) return { clicked: false }
  b.click(); return { clicked: true, label: (b.innerText || '').trim().slice(0, 30) }
})()`)
await sleep(800)
alerts.storage = await ev(`(() => Object.keys(localStorage).filter((k) => /alert|read|ignore/i.test(k)).map((k) => [k, String(localStorage.getItem(k)).slice(0, 150)]))()`)

// ---------- /lab 结案 outcome → /calibration ----------
const calibration = {}
await send('Page.navigate', { url: `${base}#/opportunities/opp-pet-memorial-glass-001` })
await sleep(3000)
await ev(`(() => { for (const k of Object.keys(localStorage)) if (/experiment|lab/i.test(k)) localStorage.removeItem(k); return true })()`)
await ev(`(() => { const b = [...document.querySelectorAll('button,a,[role=button]')].find((e) => /开始 7 天实验|开始实验|加入实验/.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
await sleep(1000)
await ev(`(() => { const b = [...document.querySelectorAll('button,a,[role=button]')].find((e) => /加入并开始|确认|保存/.test((e.innerText || '').trim())); if (b) b.click(); return !!b })()`)
await sleep(1000)
calibration.labStorage = await ev(`(() => Object.keys(localStorage).map((k) => [k, String(localStorage.getItem(k)).slice(0, 300)]))()`)
// 实验台找结案/结果选项
await send('Page.navigate', { url: `${base}#/lab` })
await sleep(3000)
calibration.closeOutcome = await ev(`(() => {
  const els = [...document.querySelectorAll('button, select, a, [role=button]')]
  const outcomeEls = els.filter((e) => /结案|完成|positive|negative|inconclusive|已验证/.test((e.innerText || '').trim()))
  const out = []
  for (const e of outcomeEls.slice(0, 4)) { const t = (e.innerText || '').trim(); try { e.click() } catch {} out.push(t.slice(0, 40)) }
  return out
})()`)
await sleep(1200)
calibration.afterOutcomeStorage = await ev(`(() => Object.keys(localStorage).map((k) => [k, String(localStorage.getItem(k)).slice(0, 300)]))()`)
await send('Page.navigate', { url: `${base}#/calibration` })
await sleep(3000)
calibration.text = (await ev(`(() => (document.body.innerText || '').slice(0, 1200))()`)) || ''
calibration.hasStats = /成功率|样本|校准|预测/.test(calibration.text)
calibration.exportClicks = await ev(`(() => [...document.querySelectorAll('button,a,[role=button]')].filter((e) => /导出|下载/.test((e.innerText || '').trim())).slice(0, 6).map((e) => { const t = (e.innerText || '').trim().slice(0, 30); e.click(); return t }))()`)
await sleep(1500)

let downloads = []
if (downloadDir) {
  try {
    const fs = await import('node:fs')
    downloads = fs.readdirSync(downloadDir).map((name) => ({ name, size: fs.statSync(`${downloadDir}/${name}`).size }))
  } catch (e) { downloads = [{ error: String(e) }] }
}

console.log(JSON.stringify({ viewport: { width: vw, height: vh }, routes: results, profile, alerts, calibration, downloads }, null, 2))
ws.close()
process.exit(0)
