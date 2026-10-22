// qa/online-qa.mjs —— v0.2.0 线上（GitHub Pages）与本地冻结/候选 dist 一致性核验
// 用法：node qa/online-qa.mjs <debugPort> <onlineUrl> <localFileUrl>
// 依赖 Chrome headless 已用 --remote-debugging-port 启动（任意初始页面）。
const [port, onlineUrl, localFileUrl] = process.argv.slice(2)
if (!port || !onlineUrl || !localFileUrl) {
  console.error('usage: node qa/online-qa.mjs <port> <onlineUrl> <localFileUrl>')
  process.exit(2)
}

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

const probe = `(() => {
  const text = document.body.innerText || ''
  const num = (label) => { const m = text.match(new RegExp(label + '[^0-9]{0,6}([0-9,]+)')); return m ? Number(m[1].replace(/,/g,'')) : null }
  const cards = [...document.querySelectorAll('main a[href*="#/opportunities/"]')].map((a) => (a.innerText||'').replace(/\\s+/g,' ').trim().slice(0,60))
  return {
    title: document.title,
    href: location.href,
    h1: (document.querySelector('h1')?.innerText || '').slice(0, 60),
    textLength: text.length,
    version: (text.match(/v\\d+\\.\\d+\\.\\d+/) || [null])[0],
    dataVersion: (text.match(/0\\.\\d+\\.\\d+/) || [null])[0],
    totalOpps: num('机会总数'),
    newToday: num('今日新信号'),
    gradeA: num('A 级以上'),
    realData: text.includes('REAL DATA') || text.includes('REAL'),
    hasDisclaimer: text.includes('不构成投资建议') || text.includes('免责声明'),
    hasLab: /实验|LAB/.test(text),
    cards,
    bodyHash: (() => { let h = 0; for (const ch of text) { h = (h * 31 + ch.charCodeAt(0)) | 0 } return h })(),
  }
})()`

async function load(url) {
  consoleErrors = []
  await send('Page.navigate', { url })
  await sleep(4000)
  const state = await ev(probe)
  return { ...state, consoleErrors }
}

const online = await load(onlineUrl)
const local = await load(localFileUrl)
const fields = ['version', 'dataVersion', 'totalOpps', 'newToday', 'gradeA', 'realData', 'hasDisclaimer', 'hasLab', 'h1']
const diff = fields.filter((f) => JSON.stringify(online[f]) !== JSON.stringify(local[f]))
console.log(JSON.stringify({
  onlineUrl, localFileUrl,
  online, local,
  diffFields: diff,
  consistent: diff.length === 0,
  cardOrderConsistent: JSON.stringify((online.cards || []).slice(0, 3)) === JSON.stringify((local.cards || []).slice(0, 3)),
}, null, 2))
ws.close()
process.exit(0)
