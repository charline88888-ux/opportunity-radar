// qa/cdp-check.mjs —— 红队页面运行时检查（Chrome DevTools Protocol，Node ≥22 内置 fetch/WebSocket）
// 用法：node qa/cdp-check.mjs <debugPort> <url>
// 输出 JSON：视口/滚动宽度（检测 1024 溢出）、标题、正文长度、免责声明可见性、canvas 图表尺寸、控制台错误。
const [port, url] = process.argv.slice(2)
if (!port || !url) {
  console.error('usage: node qa/cdp-check.mjs <debugPort> <url>')
  process.exit(2)
}

async function getTarget() {
  for (let i = 0; i < 50; i++) {
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
const consoleErrors = []

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(msg.params?.exceptionDetails?.text || 'exception')
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
    consoleErrors.push((msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
  }
})

const send = (method, params = {}) =>
  new Promise((resolve) => {
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
await new Promise((r) => setTimeout(r, 3500))

const expression = `(() => {
  const de = document.documentElement
  const canvases = [...document.querySelectorAll('canvas')]
  const text = document.body.innerText || ''
  const vw = window.innerWidth
  const overflows = []
  for (const el of document.querySelectorAll('main *')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && r.right > vw + 1) {
      // 忽略自身可滚动容器内部的元素（chips 等横向滚动属于允许）
      let p = el.parentElement, scrollable = false
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX
        if (ox === 'auto' || ox === 'scroll') { scrollable = true; break }
        p = p.parentElement
      }
      if (!scrollable) overflows.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 80),
        right: Math.round(r.right),
        width: Math.round(r.width),
      })
    }
  }
  overflows.sort((a, b) => b.right - a.right)
  return {
    url: location.href,
    title: document.title,
    h1: (document.querySelector('h1')?.innerText || '').slice(0, 60),
    innerWidth: vw,
    docScrollWidth: de.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    horizontalOverflow: de.scrollWidth > vw + 1,
    clippedElements: overflows.length,
    clippedSamples: overflows.slice(0, 5),
    overflowX: getComputedStyle(de).overflowX,
    textLength: text.length,
    hasDisclaimer: text.includes('不构成投资建议') || text.includes('免责声明'),
    hasVerified: text.includes('未核验') || text.includes('已核验') || text.includes('研究假设'),
    hasVersion: text.includes('v0.1.0') || text.includes('0.1.0'),
    canvasCount: canvases.length,
    zeroSizeCanvas: canvases.filter((c) => c.width === 0 || c.height === 0).length,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    rootChildren: document.getElementById('root')?.children.length ?? -1,
    notFound: text.includes('页面不存在'),
  }
})()`

const result = await send('Runtime.evaluate', { expression, returnByValue: true })
await new Promise((r) => setTimeout(r, 500))
console.log(JSON.stringify({ ...result.result?.result?.value, consoleErrors }, null, 2))
ws.close()
process.exit(0)
