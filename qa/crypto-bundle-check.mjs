// qa/crypto-bundle-check.mjs —— v0.5.1 个人数据包口令加密四态验收
// 明文导出 / 加密导出（PBKDF2-SHA256 210000 + AES-256-GCM）/ 独立解密 / 正确口令导入恢复 /
// 错误口令 / 损坏密文 / 旧版本 / 明文包兼容 / 口令不落盘 / 无 console error
// 用法：node qa/crypto-bundle-check.mjs <debugPort> <baseUrl> <downloadDir>
import fs from 'node:fs'
import path from 'node:path'
import { webcrypto as crypto } from 'node:crypto'

const [port, base, downloadDir] = process.argv.slice(2)
if (!port || !base || !downloadDir) { console.error('usage: node qa/crypto-bundle-check.mjs <port> <baseUrl> <downloadDir>'); process.exit(2) }
const root = path.resolve('.')
fs.mkdirSync(downloadDir, { recursive: true })
const PASSWORD = 'Qa-Test-Pass-123'
const WRONG = 'Qa-Wrong-Pass-999'
const results = []
const check = (id, name, pass, detail = '') => results.push({ id, name, pass: !!pass, detail: String(detail).slice(0, 500) })

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const p = l.find((t) => t.type === 'page')
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
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(String(m.params?.exceptionDetails?.text || 'exception').slice(0, 120))
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') consoleErrors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 120))
  if (m.method === 'Page.javascriptDialogOpening') ws.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true } }))
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
ws.addEventListener('close', () => { for (const r of pending.values()) { try { r({}) } catch {} } pending.clear() })
await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const nav = async (hash) => { await send('Page.navigate', { url: `${base}${hash}` }); await sleep(3400) }
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(3400) }
await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir }).catch(() => {})
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: false }).catch(() => {})

const storageDump = async () => ev(`(() => { const o = {}; for (const k of Object.keys(localStorage)) { if (!k.startsWith('radar:')) continue; try { o[k] = JSON.parse(localStorage.getItem(k)) } catch { o[k] = localStorage.getItem(k) } } return o })()`)
const latestFile = (re) => {
  const files = fs.readdirSync(downloadDir).filter((f) => re.test(f))
  if (!files.length) return null
  return path.join(downloadDir, files.map((x) => ({ x, t: fs.statSync(path.join(downloadDir, x)).mtimeMs })).sort((a, b) => b.t - a.t)[0].x)
}
const setFileInput = async (filePath) => {
  const doc = await send('DOM.getDocument', { depth: -1 })
  const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' })
  if (!q.result?.nodeId) return false
  const r = await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [filePath] })
  return !r.error
}
const fillPasswords = async (value) => ev(`(() => {
  const els = [...document.querySelectorAll('input[type=password]')]
  for (const el of els) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  return els.length
})()`)
const clickText = async (re) => ev(`(() => { const b = [...document.querySelectorAll('button, [role=button], label')].find((e) => ${re.toString()}.test((e.innerText || e.textContent || '').trim())); if (!b) return { clicked: false }; const t = (b.innerText || '').trim().slice(0, 40); b.click(); return { clicked: true, label: t } })()`)
const clickButton = async (re) => ev(`(() => { const b = [...document.querySelectorAll('button, [role=button]')].find((e) => ${re.toString()}.test((e.innerText || '').trim())); if (!b) return { clicked: false }; const t = (b.innerText || '').trim().slice(0, 40); b.click(); return { clicked: true, label: t } })()`)

// ---------- seed ----------
await nav('#/')
await ev(`(() => {
  const P = { capitalBand: 'b1-5w', weeklyHours: 10, fullTime: false, skills: { tech: 1, content: 2, supply: 0, ops: 2 }, english: 2, risk: 3, hasLicensePartner: false, strictCapital: false, updated_at: '2026-10-22T00:00:00+08:00' }
  const E = [
    { id: 'qa-cr-exp-a', opp_id: 'opp-pet-memorial-glass-001', title: 'QA A', started_at: '2026-10-10', budget_cny: 3000, status: 'verified', outcome: 'positive', ended_at: '2026-10-18', conclusion: 'qa', spend_cny: 1000, hours: 5, created_at: '2026-10-10T00:00:00+08:00', updated_at: '2026-10-18T00:00:00+08:00' },
    { id: 'qa-cr-exp-b', opp_id: 'opp-crossborder-mercadolibre-030', title: 'QA B', started_at: '2026-10-12', budget_cny: 5000, status: 'active', outcome: null, ended_at: null, conclusion: '', spend_cny: 0, hours: 0, created_at: '2026-10-12T00:00:00+08:00', updated_at: '2026-10-12T00:00:00+08:00' },
  ]
  const R = [
    { id: 'cr-r1', opp_id: 'opp-pet-memorial-glass-001', event: 'impression', rec_score: 78.9, fit: 0.8, at: '2026-10-22T10:00:00+08:00' },
    { id: 'cr-r2', opp_id: 'opp-pet-memorial-glass-001', event: 'view', rec_score: 78.9, fit: 0.8, at: '2026-10-22T10:01:00+08:00' },
    { id: 'cr-r3', opp_id: 'opp-pet-memorial-glass-001', event: 'experiment', rec_score: 78.9, fit: 0.8, at: '2026-10-22T10:02:00+08:00' },
  ]
  localStorage.setItem('radar:profile:v1', JSON.stringify(P))
  localStorage.setItem('radar:experiments:v1', JSON.stringify(E))
  localStorage.setItem('radar:alerts:v1', JSON.stringify({ read: ['unverified:x:0.5.1'], ignored: ['window:y:0.5.1'] }))
  localStorage.setItem('radar:rec_log:v1', JSON.stringify(R))
  return true
})()`)
await reload()
await nav('#/data'); await sleep(900)

// ---------- 1) 明文导出（schema 0.5.1） ----------
try { for (const f of fs.readdirSync(downloadDir)) if (/bundle|data.*\.json/i.test(f)) fs.unlinkSync(path.join(downloadDir, f)) } catch {}
const plainClick = await clickButton(/导出数据包|Export bundle/)
await sleep(1600)
const plainPath = latestFile(/bundle?.*\.json$|data.*\.json$/i)
const plain = plainPath ? JSON.parse(fs.readFileSync(plainPath, 'utf8')) : null
check('C01', '明文数据包导出：schema_version=0.5.1 + 明文六字段', !!plain && plain.schema_version === '0.5.1' && !plain.encrypted && plain.profile && Array.isArray(plain.experiments) && Array.isArray(plain.rec_log), JSON.stringify({ schema: plain?.schema_version, encrypted: plain?.encrypted, exp: plain?.experiments?.length }).slice(0, 220))

// ---------- 2) 加密导出 ----------
// 打开加密开关并填口令 + 二次确认
const toggle = await ev(`(() => {
  const label = [...document.querySelectorAll('label, button')].find((e) => /加密导出|口令加密|加密数据包/.test((e.innerText || '').trim()))
  if (label) { const cb = label.querySelector('input[type=checkbox]'); if (cb && !cb.checked) { cb.click(); return { found: true, via: 'label', toggled: true } } if (!cb) { label.click(); return { found: true, via: 'label', toggled: true } } return { found: true, via: 'label', toggled: false } }
  const cb = [...document.querySelectorAll('input[type=checkbox]')].reduce((a, e) => e.parentElement?.innerText?.includes('加密') ? e : a, null)
  if (cb) { cb.click(); return { found: true, via: 'checkbox', toggled: true } }
  return { found: false }
})()`)
await sleep(500)
const filled = await fillPasswords(PASSWORD)
await sleep(300)
const encClick = await clickButton(/导出数据包|Export bundle/)
await sleep(1600)
const encPath = latestFile(/bundle?.*\.json$|data.*\.json$/i)
const enc = encPath ? JSON.parse(fs.readFileSync(encPath, 'utf8')) : null
const saltBytes = enc?.salt_b64 ? Buffer.from(enc.salt_b64, 'base64').length : 0
const ivBytes = enc?.iv_b64 ? Buffer.from(enc.iv_b64, 'base64').length : 0
check('C02', '加密导出：外层字段合法（schema 0.5.1/encrypted/algo/kdf/iterations/salt 16B/iv 12B）',
  toggle.found && filled >= 1 && encClick.clicked && !!enc && enc.schema_version === '0.5.1' && enc.encrypted === true && enc.algo === 'AES-GCM' && enc.kdf === 'PBKDF2-SHA256' && Number(enc.iterations) === 210000 && saltBytes === 16 && ivBytes === 12 && typeof enc.ciphertext_b64 === 'string' && enc.ciphertext_b64.length > 20 && typeof enc.exported_at === 'string',
  JSON.stringify({ toggle, filled, click: encClick, schema: enc?.schema_version, enc: enc?.encrypted, saltBytes, ivBytes }).slice(0, 350))
check('C03', '加密包不包含明文 profile/experiments/rec_log 字段', !!enc && !('profile' in enc) && !('experiments' in enc) && !('rec_log' in enc), Object.keys(enc || {}).join(','))

// ---------- 3) 独立 WebCrypto 解密 ----------
let decrypted = null
try {
  const alg = { name: 'PBKDF2' }
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(PASSWORD), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: Buffer.from(enc.salt_b64, 'base64'), iterations: Number(enc.iterations), hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
  const raw = Buffer.from(enc.ciphertext_b64, 'base64')
  const tag = raw.subarray(raw.length - 16)
  const ct = raw.subarray(0, raw.length - 16)
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(enc.iv_b64, 'base64'), tagLength: 128 }, key, Buffer.concat([ct, tag]))
  decrypted = JSON.parse(Buffer.from(plainBuf).toString('utf8'))
} catch (e) {
  decrypted = { error: String(e) }
}
check('C04', '红队独立 PBKDF2+AES-GCM 解密成功且内容=导出前本地状态', !!decrypted && !decrypted.error && decrypted.profile?.capitalBand === 'b1-5w' && decrypted.experiments?.length === 2 && decrypted.rec_log?.length === 3, JSON.stringify({ error: decrypted?.error, exp: decrypted?.experiments?.length, rec: decrypted?.rec_log?.length }).slice(0, 300))

// ---------- 4) 清空 → 正确口令导入恢复 ----------
const clearState = async () => {
  await ev(`(() => { for (const k of ['radar:profile:v1','radar:experiments:v1','radar:alerts:v1','radar:rec_log:v1']) localStorage.removeItem(k); return true })()`)
  await reload()
}
await clearState()
await nav('#/data'); await sleep(800)
await setFileInput(encPath)
await sleep(1200)
await fillPasswords(PASSWORD)
await sleep(300)
const decryptClick = await clickButton(/解密|解密并预览|校验并预览|验证口令/)
await sleep(1200)
const previewText = await ev(`(() => (document.body.innerText || '').slice(0, 6000))()`)
const applyClick = await clickButton(/覆盖本机数据|Replace local data/)
await sleep(1400)
const restored = await storageDump()
check('C05', '正确口令：解密→预览→覆盖导入恢复（2 实验/3 推荐记录/画像/预警）',
  decryptClick.clicked && /预览|覆盖|合并/.test(previewText) && applyClick.clicked && restored['radar:experiments:v1']?.length === 2 && restored['radar:rec_log:v1']?.length === 3 && restored['radar:profile:v1']?.capitalBand === 'b1-5w',
  JSON.stringify({ decrypt: decryptClick, apply: applyClick, exp: restored['radar:experiments:v1']?.length, rec: restored['radar:rec_log:v1']?.length }).slice(0, 300))

// ---------- 5) 错误口令 ----------
await clearState()
await nav('#/data'); await sleep(800)
await setFileInput(encPath)
await sleep(1000)
await fillPasswords(WRONG)
const wrongClick = await clickButton(/解密|解密并预览|校验并预览|验证口令/)
await sleep(1400)
const wrongText = await ev(`(() => (document.body.innerText || '').slice(0, 6000))()`)
const wrongState = await storageDump()
check('C06', '错误口令：明确提示且不应用（本地状态不变）', wrongClick.clicked && /口令|密码|解密失败|不正确|wrong/i.test(wrongText) && (wrongState['radar:experiments:v1']?.length ?? 0) === 0, wrongText.match(/.{0,40}(口令|密码|解密失败|不正确).{0,60}/)?.[0] || '')

// ---------- 6) 损坏密文 ----------
const broken = { ...enc }
const rawBytes = Buffer.from(enc.ciphertext_b64, 'base64')
rawBytes[Math.floor(rawBytes.length / 2)] ^= 0xff
broken.ciphertext_b64 = rawBytes.toString('base64')
const brokenFile = path.join(downloadDir, 'qa-bundle-broken.json')
fs.writeFileSync(brokenFile, JSON.stringify(broken), 'utf8')
await setFileInput(brokenFile)
await sleep(1000)
await fillPasswords(PASSWORD)
const brokenClick = await clickButton(/解密|解密并预览|校验并预览|验证口令/)
await sleep(1400)
const brokenText = await ev(`(() => (document.body.innerText || '').slice(0, 6000))()`)
const brokenState = await storageDump()
check('C07', '损坏密文：明确提示且不应用（状态不变、不崩溃）', brokenClick.clicked && /损坏|解密失败|无法|校验失败|corrupt|invalid/i.test(brokenText) && (brokenState['radar:experiments:v1']?.length ?? 0) === 0 && consoleErrors.length === 0, brokenText.match(/.{0,40}(损坏|解密失败|无法|校验失败).{0,60}/)?.[0] || '')

// ---------- 7) 明文包兼容导入 ----------
await clearState()
await nav('#/data'); await sleep(800)
await setFileInput(plainPath)
await sleep(1200)
const plainPreview = await ev(`(() => (document.body.innerText || '').slice(0, 6000))()`)
const plainApply = await clickButton(/覆盖本机数据|Replace local data/)
await sleep(1200)
const plainState = await storageDump()
check('C08', '旧明文包（0.5.1, encrypted=false）兼容导入', /预览|覆盖|合并/.test(plainPreview) && plainApply.clicked && plainState['radar:experiments:v1']?.length === 2, JSON.stringify({ exp: plainState['radar:experiments:v1']?.length }).slice(0, 200))

// ---------- 8) 旧版本（0.5.0）拒绝 ----------
const old = { ...plain, schema_version: '0.5.0' }
const oldFile = path.join(downloadDir, 'qa-bundle-old.json')
fs.writeFileSync(oldFile, JSON.stringify(old), 'utf8')
const stateBeforeOld = await storageDump()
await setFileInput(oldFile)
await sleep(1200)
const oldText = await ev(`(() => (document.body.innerText || '').slice(0, 6000))()`)
const stateAfterOld = await storageDump()
check('C09', '旧版本 0.5.0：明确提示/不应用', /版本|schema|0\\.5\\.1|不兼容|校验失败/.test(oldText) && JSON.stringify(stateAfterOld) === JSON.stringify(stateBeforeOld), oldText.match(/.{0,50}(版本|schema|不兼容|校验失败).{0,60}/)?.[0] || '')

// ---------- 9) 口令不落盘 ----------
const all = await ev(`(() => { const out = []; for (const k of Object.keys(localStorage)) out.push(k + '=' + String(localStorage.getItem(k))); return out.join('\\n') })()`)
check('C10', '口令不落盘（localStorage 无明文口令）', !String(all).includes(PASSWORD) && !String(all).includes(WRONG), String(all).length + ' chars')
check('C11', '全程无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join('; ') || '0')

const out = { results, summary: { pass: results.filter((r) => r.pass).length, fail: results.filter((r) => !r.pass).length, total: results.length } }
fs.writeFileSync(path.join(root, 'qa/tmp/crypto-bundle-check.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
ws.close()
process.exit(0)
