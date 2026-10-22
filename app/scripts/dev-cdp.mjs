/**
 * 调试脚本：用 CDP 捕获控制台错误 / 未捕获异常（仅开发自查用，不参与前端构建）
 * 用法：node scripts/dev-cdp.mjs "<url>" [waitMs] ["可选 JS 表达式，可用来点按钮/读 DOM"]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const url = process.argv[2] || 'http://127.0.0.1:8877/#/'
const waitMs = Number(process.argv[3] || 9000)
const evalExpr = process.argv[4] || ''
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = 9333 + Math.floor(Math.random() * 200)
const profile = path.join(os.tmpdir(), `radar-cdp-${Date.now()}`)
const windowSize = process.env.CDP_WINDOW || '1600,1200'
fs.mkdirSync(profile, { recursive: true })

const proc = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=' + windowSize,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    url,
  ],
  { stdio: 'ignore', detached: false },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getTargets() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (res.ok) return await res.json()
    } catch {
      /* retry */
    }
    await sleep(250)
  }
  throw new Error('Chrome CDP 未就绪')
}

const targets = await getTargets()
const page = targets.find((t) => t.type === 'page' && t.url.includes('#')) || targets.find((t) => t.type === 'page')
if (!page) throw new Error('找不到页面 target')

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const msgId = ++id
    pending.set(msgId, resolve)
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })

const logs = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result)
    pending.delete(msg.id)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ')
    logs.push({ kind: 'console', level: msg.params.type, text })
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    logs.push({ kind: 'exception', text: d.exception?.description || d.text, url: d.url, line: d.lineNumber })
  }
  if (msg.method === 'Log.entryAdded') {
    const e = msg.params.entry
    logs.push({ kind: `log-${e.level}`, text: e.text, url: e.url })
  }
}

await new Promise((resolve) => (ws.onopen = resolve))
await send('Runtime.enable')
await send('Log.enable')
await send('Page.enable')
if (process.env.CDP_MOBILE) {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await sleep(500)
}
await sleep(waitMs)

if (process.env.CDP_SCREENSHOT) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (shot?.data) {
    fs.writeFileSync(process.env.CDP_SCREENSHOT, Buffer.from(shot.data, 'base64'))
    console.log('SCREENSHOT: ' + process.env.CDP_SCREENSHOT)
  }
}

if (evalExpr) {
  const res = await send('Runtime.evaluate', { expression: evalExpr, awaitPromise: true, returnByValue: true })
  const value = res?.result?.value
  console.log('EVAL_RESULT: ' + (typeof value === 'string' ? value : JSON.stringify(value)))
  await sleep(5000)
}

const errors = logs.filter((l) => l.kind === 'exception' || l.level === 'error' || l.kind === 'log-error')
console.log(`target: ${page.url}`)
console.log(`logs: ${logs.length} (errors: ${errors.length})`)
for (const l of logs.slice(0, 40)) {
  console.log(`[${l.kind}${l.level ? '/' + l.level : ''}] ${String(l.text).slice(0, 500)}`)
}

ws.close()
proc.kill()
process.exit(0)
