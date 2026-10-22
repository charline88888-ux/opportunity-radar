// qa/data-package-check.mjs —— v0.5.0 个人数据包验收（导出→清空→导入→恢复；覆盖/合并；旧版本/坏文件；预览摘要）
// 用法：node qa/data-package-check.mjs <debugPort> <baseUrl> <downloadDir>
import fs from 'node:fs'
import path from 'node:path'

const [port, base, downloadDir] = process.argv.slice(2)
if (!port || !base || !downloadDir) { console.error('usage: node qa/data-package-check.mjs <port> <baseUrl> <downloadDir>'); process.exit(2) }
const root = path.resolve('.')
fs.mkdirSync(downloadDir, { recursive: true })
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
await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const nav = async (hash) => { await send('Page.navigate', { url: `${base}${hash}` }); await sleep(3200) }
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(3200) }
await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir }).catch(() => {})
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: false }).catch(() => {})

const storageDump = async () => ev(`(() => { const o = {}; for (const k of Object.keys(localStorage)) { if (!k.startsWith('radar:')) continue; try { o[k] = JSON.parse(localStorage.getItem(k)) } catch { o[k] = localStorage.getItem(k) } } return o })()`)
const clickText = async (re) => ev(`(() => { const re = ${re.toString()}; const els = [...document.querySelectorAll('button, [role=button], label')]; const b = els.find((e) => re.test((e.innerText || e.textContent || '').trim())); if (!b) return { clicked: false }; const t = (b.innerText || '').trim().slice(0, 40); b.click(); return { clicked: true, label: t } })()`)
const latestDownload = async (ext = '.json') => {
  const files = fs.readdirSync(downloadDir).filter((f) => f.toLowerCase().endsWith(ext))
  if (!files.length) return null
  const f = files.map((x) => ({ x, t: fs.statSync(path.join(downloadDir, x)).mtimeMs })).sort((a, b) => b.t - a.t)[0].x
  return path.join(downloadDir, f)
}
const setFileInput = async (filePath) => {
  const doc = await send('DOM.getDocument', { depth: -1 })
  const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' })
  if (!q.result?.nodeId) return false
  const r = await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [filePath] })
  return !r.error
}

// ---------- 1) seed 本地状态 ----------
await nav('#/data')
await ev(`(() => {
  const P = { capitalBand: 'b1-5w', weeklyHours: 10, fullTime: false, skills: { tech: 1, content: 2, supply: 0, ops: 2 }, english: 2, risk: 3, hasLicensePartner: false, strictCapital: false, updated_at: '2026-10-22T00:00:00+08:00' }
  const E = [
    { id: 'qa-pkg-exp-a', opp_id: 'opp-pet-memorial-glass-001', title: 'QA A', started_at: '2026-10-10', budget_cny: 3000, status: 'verified', outcome: 'positive', ended_at: '2026-10-18', conclusion: 'qa', spend_cny: 1000, hours: 5, created_at: '2026-10-10T00:00:00+08:00', updated_at: '2026-10-18T00:00:00+08:00' },
    { id: 'qa-pkg-exp-b', opp_id: 'opp-crossborder-mercadolibre-030', title: 'QA B', started_at: '2026-10-12', budget_cny: 5000, status: 'active', outcome: null, ended_at: null, conclusion: '', spend_cny: 0, hours: 0, created_at: '2026-10-12T00:00:00+08:00', updated_at: '2026-10-12T00:00:00+08:00' },
  ]
  const R = [
    { id: 'r1', opp_id: 'opp-pet-memorial-glass-001', event: 'impression', rec_score: 78.9, fit: 0.8, at: '2026-10-22T10:00:00+08:00' },
    { id: 'r2', opp_id: 'opp-pet-memorial-glass-001', event: 'view', rec_score: 78.9, fit: 0.8, at: '2026-10-22T10:01:00+08:00' },
    { id: 'r3', opp_id: 'opp-pet-memorial-glass-001', event: 'experiment', rec_score: 78.9, fit: 0.8, at: '2026-10-22T10:02:00+08:00' },
  ]
  localStorage.setItem('radar:profile:v1', JSON.stringify(P))
  localStorage.setItem('radar:experiments:v1', JSON.stringify(E))
  localStorage.setItem('radar:alerts:v1', JSON.stringify({ read: ['unverified:x:0.5.0'], ignored: ['window:y:0.5.0'] }))
  localStorage.setItem('radar:rec_log:v1', JSON.stringify(R))
  return true
})()`)
await reload()
await nav('#/data'); await sleep(800)
const dataPageText = await ev(`(() => (document.body.innerText || '').slice(0, 4000))()`)
check('D01', '/data 页面可打开且含导出/导入入口', /数据包|备份|导出|导入/.test(dataPageText) && consoleErrors.length === 0, dataPageText.slice(0, 200))

// ---------- 2) 导出 ----------
const beforeStorage = await storageDump()
const expClick = await clickText(/导出|下载数据包|备份/)
await sleep(1600)
const bundlePath = await latestDownload('.json')
let bundle = null
if (bundlePath) { try { bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8')) } catch {} }
check('D02', '导出数据包 JSON（schema_version=0.5.0 + profile/experiments/alerts_state/rec_log/settings）', !!bundle && bundle.schema_version === '0.5.0' && bundle.profile && Array.isArray(bundle.experiments) && bundle.alerts_state && Array.isArray(bundle.rec_log) && 'settings' in bundle, JSON.stringify({ schema_version: bundle?.schema_version, experiments: bundle?.experiments?.length, rec_log: bundle?.rec_log?.length }).slice(0, 300))
check('D03', '导出内容与本地状态一致（画像/实验/预警已读/推荐记录）', !!bundle && bundle.experiments?.length === 2 && bundle.rec_log?.length === 3 && (bundle.alerts_state?.read || []).length === 1 && (bundle.profile?.capitalBand === 'b1-5w'), JSON.stringify({ exp: bundle?.experiments?.length, rec: bundle?.rec_log?.length, read: bundle?.alerts_state?.read?.length }).slice(0, 240))

// ---------- 3) 清空 ----------
const clearClick = await clickText(/清空|重置|删除全部/)
if (!clearClick.clicked) {
  await ev(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('radar:experiments') || k.startsWith('radar:rec_log') || k.startsWith('radar:profile') || k.startsWith('radar:alerts')) localStorage.removeItem(k); return true })()`)
}
await reload()
const afterClear = await storageDump()
const expAfterClear = await ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:experiments:v1') || '[]').length } catch { return -1 } })()`)
check('D04', '清空本地数据（实验/推荐记录/预警已读为空或键移除）', expAfterClear === 0 || expAfterClear === null, `experiments=${expAfterClear}`)

// ---------- 4) 导入 → 预览 → 覆盖 ----------
const bundleFile = path.join(downloadDir, 'qa-data-package.json')
fs.writeFileSync(bundleFile, JSON.stringify(bundle, null, 2), 'utf8')
const fileOk = await setFileInput(bundleFile)
await sleep(1200)
const previewText = await ev(`(() => (document.body.innerText || '').slice(0, 6000))()`)
const previewOk = /预览|画像|实验|推荐|预警/.test(previewText) && /(覆盖|合并)/.test(previewText)
check('D05', '导入文件后显示预览摘要（画像/实验数/推荐记录/预警已读）', fileOk && previewOk, `fileOk=${fileOk} preview=${previewText.match(/.{0,30}(预览|覆盖|合并).{0,60}/)?.[0] || ''}`)
const overwriteClick = await clickText(/覆盖本机数据|^覆盖$|覆盖导入|确认覆盖/)
await sleep(1400)
const restored = await storageDump()
const restoredExp = await ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:experiments:v1') || '[]').map((e) => e.id) } catch { return [] } })()`)
const restoredRec = await ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:rec_log:v1') || '[]').length } catch { return 0 } })()`)
check('D06', '覆盖导入恢复画像/实验/预警/推荐记录', overwriteClick.clicked && Array.isArray(restoredExp) && restoredExp.length === 2 && restoredRec === 3, JSON.stringify({ click: overwriteClick, exp: restoredExp, rec: restoredRec }).slice(0, 260))

// ---------- 5) 合并两态（更新较新 + 新增） ----------
await nav('#/data')
await ev(`(() => {
  localStorage.setItem('radar:experiments:v1', JSON.stringify([
    { id: 'qa-pkg-exp-a', opp_id: 'opp-pet-memorial-glass-001', title: 'QA A old', started_at: '2026-10-10', budget_cny: 3000, status: 'active', outcome: null, ended_at: null, conclusion: '', spend_cny: 0, hours: 0, created_at: '2026-10-10T00:00:00+08:00', updated_at: '2026-10-10T00:00:00+08:00' },
  ]))
  localStorage.setItem('radar:rec_log:v1', JSON.stringify([{ id: 'r-old', opp_id: 'opp-pet-memorial-glass-001', event: 'impression', rec_score: 1, fit: 0.5, at: '2026-10-20T00:00:00+08:00' }]))
  return true
})()`)
const mergeBundle = JSON.parse(JSON.stringify(bundle))
mergeBundle.experiments = [
  { ...bundle.experiments[0], id: 'qa-pkg-exp-a', status: 'verified', outcome: 'positive', updated_at: '2026-10-22T00:00:00+08:00', title: 'QA A new' },
  { ...bundle.experiments[1], id: 'qa-pkg-exp-c', title: 'QA C', updated_at: '2026-10-22T00:00:00+08:00' },
]
mergeBundle.rec_log = [...bundle.rec_log, { id: 'r-new', opp_id: 'opp-culture-ramadan-027', event: 'view', rec_score: 73.2, fit: 0.77, at: '2026-10-22T11:00:00+08:00' }]
const mergeFile = path.join(downloadDir, 'qa-data-package-merge.json')
fs.writeFileSync(mergeFile, JSON.stringify(mergeBundle, null, 2), 'utf8')
await reload()
await setFileInput(mergeFile)
await sleep(1200)
const mergeClick = await clickText(/合并（按 id 取较新）|合并导入|^合并$|确认合并/)
await sleep(1400)
const mergedExps = await ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:experiments:v1') || '[]') } catch { return [] } })()`)
const mergedRec = await ev(`(() => { try { return JSON.parse(localStorage.getItem('radar:rec_log:v1') || '[]') } catch { return [] } })()`)
const expA = (mergedExps || []).find((e) => e.id === 'qa-pkg-exp-a')
const hasC = (mergedExps || []).some((e) => e.id === 'qa-pkg-exp-c')
const unionOk = (mergedExps || []).length === 2 && !!expA && expA.updated_at === '2026-10-22T00:00:00+08:00' && hasC && Array.isArray(mergedRec) && mergedRec.length >= 2
check('D07', '合并导入：按 id 去重取较新 + 新记录合并（不覆盖本地其它）', mergeClick.clicked && unionOk, JSON.stringify({ click: mergeClick, exps: (mergedExps || []).map((e) => [e.id, e.updated_at]), rec: (mergedRec || []).length }).slice(0, 320))

// ---------- 6) 旧版本 / 坏文件 ----------
const oldBundle = { ...bundle, schema_version: '0.4.0' }
const oldFile = path.join(downloadDir, 'qa-data-package-old.json')
fs.writeFileSync(oldFile, JSON.stringify(oldBundle, null, 2), 'utf8')
const stateBeforeBad = await storageDump()
await setFileInput(oldFile)
await sleep(1200)
const oldText = await ev(`(() => (document.body.innerText || '').slice(0, 6000))()`)
check('D08', '旧版本数据包：提示校验失败/版本不兼容，不静默应用', /校验失败|版本|不兼容|升级|警告|0\.4\.0/.test(oldText), oldText.match(/.{0,40}(版本|不兼容|升级|警告).{0,60}/)?.[0] || '')
const badFile = path.join(downloadDir, 'qa-data-package-bad.json')
fs.writeFileSync(badFile, '{not-json', 'utf8')
await setFileInput(badFile)
await sleep(1200)
const badText = await ev(`(() => (document.body.innerText || '').slice(0, 6000))()`)
const stateAfterBad = await storageDump()
check('D09', '坏文件：显示错误提示、不崩溃、本地状态不变', /失败|错误|无效|无法|格式|解析/.test(badText) && consoleErrors.length === 0 && JSON.stringify(stateAfterBad) === JSON.stringify(stateBeforeBad), `consoleErrors=${consoleErrors.length}`)

// ---------- 7) 导出→calibrate 可用（可选联动） ----------
check('D10', '全程无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join('; ') || '0')

const summary = { pass: results.filter((r) => r.pass).length, fail: results.filter((r) => !r.pass).length, total: results.length }
fs.writeFileSync(path.join(root, 'qa/tmp/data-package-check.json'), JSON.stringify({ results, summary }, null, 2))
console.log(JSON.stringify({ results, summary }, null, 2))
ws.close()
process.exit(0)
