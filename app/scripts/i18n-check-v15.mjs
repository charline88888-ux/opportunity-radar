// qa/i18n-check.mjs —— v0.4.0 红队 i18n 双语验收（字典静态检查 + zh/en 12 路由运行时 + 切换不刷新/持久化）
// 用法：node qa/i18n-check.mjs <debugPort> <baseUrl> [dictPath] [downloadDir]
// 输出 JSON（含 results/summary），并保存到 app/screenshots/final-v1.5/i18n-check.json
import fs from 'node:fs'
import path from 'node:path'

const [port, base, dictArg] = process.argv.slice(2)
if (!port || !base) { console.error('usage: node qa/i18n-check.mjs <port> <baseUrl> [dictPath]'); process.exit(2) }
const root = path.resolve('.')
const dictPath = dictArg || path.join(root, 'app/src/lib/i18n-dict.ts')
const results = []
const check = (id, name, pass, detail = '') => results.push({ id, name, pass: !!pass, detail: String(detail).slice(0, 500) })

// ---------- 1) 字典静态检查 ----------
const src = fs.readFileSync(dictPath, 'utf8')
const entries = [...src.matchAll(/^\s*'((?:[^'\\]|\\.)+)'\s*:\s*'((?:[^'\\]|\\.)+)'\s*,/gm)]
const keys = entries.map((m) => m[1])
const dup = keys.filter((k, i) => keys.indexOf(k) !== i)
const emptyVals = entries.filter((m) => !m[2].trim())
const sameZhEn = entries.filter((m) => m[1] === m[2])
check('I01', 'i18n 字典条目数 ≥300', entries.length >= 300, `entries=${entries.length}`)
check('I02', '字典 key 无重复', dup.length === 0, dup.slice(0, 5).join('; '))
check('I03', '字典 value 无空值', emptyVals.length === 0, emptyVals.slice(0, 5).map((m) => m[1]).join('; '))
check('I04', '字典 value 与中文 key 不雷同（允许专有名词少量）', sameZhEn.length <= 30, `same=${sameZhEn.length}`)

// ---------- 2) 运行时 ----------
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
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
await send('Runtime.enable'); await send('Page.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const nav = async (hash) => { await send('Page.navigate', { url: `${base}${hash}` }); await sleep(3200) }
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(3200) }
const setLang = async (lang) => {
  await ev(`(() => { localStorage.setItem('radar:lang:v1', ${JSON.stringify(lang)}); return true })()`)
  await reload()
}

// 允许保留中文的数据字符串（机会/分类/来源/剧本/日历内容）
const allowed = new Set()
for (const f of ['data/opportunities.json', 'data/taxonomy.json', 'data/sources.json', 'data/playbooks.json', 'data/calendar.json', 'data/candidates.json', 'data/candidate-rankings.json']) {
  const walk = (obj) => {
    if (typeof obj === 'string') { if (obj.trim()) allowed.add(obj); return }
    if (Array.isArray(obj)) { obj.forEach(walk); return }
    if (obj && typeof obj === 'object') Object.values(obj).forEach(walk)
  }
  walk(JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')))
}
const allowedList = [...allowed]
const cjkRuns = (text) => [...text.matchAll(/[\u4e00-\u9fff][\u4e00-\u9fff，。、；：！？（）·]{1,40}/g)].map((m) => m[0].trim()).filter((s) => /[\u4e00-\u9fff]/.test(s))
const norm = (s) => String(s).replace(/[\s，。、；：！？:;,./·\-–—()（）%¥￥“”"'【】\[\]]+/g, '')
const allowedNorm = allowedList.map(norm).filter((s) => s.length >= 2)
const isDataText = (run) => {
  const n = norm(run)
  if (n.length < 2) return true
  return allowedNorm.some((a) => a.includes(n)) || allowedNorm.some((a) => n.includes(a) && a.length >= 4)
}
const EN_NAV = ['COMMAND', 'RANKINGS', 'SCANNER', 'METHOD', 'SOURCES', 'CALENDAR', 'ABOUT']
const routes = ['#/', '#/rankings', '#/candidates/cand-5c555f56997d', '#/opportunities/opp-pet-memorial-glass-001', '#/scanner', '#/method', '#/sources', '#/calendar', '#/about']

async function probe(route, lang) {
  await nav(route)
  await sleep(800)
  const info = await ev(`(() => ({
    lang: document.documentElement.lang, title: document.title,
    hash: location.hash, text: (document.body.innerText || '').slice(0, 20000),
    textLen: (document.body.innerText || '').length,
    banner: (document.body.innerText || '').includes('Chinese-only'),
    bodyCJK: (document.body.innerText || '').match(/[\\u4e00-\\u9fff]/g)?.length || 0,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    docScrollWidth: document.documentElement.scrollWidth, innerWidth,
  }))()`)
  const runs = cjkRuns(info.text)
  const unexplained = runs.filter((r) => !isDataText(r))
  return { route, lang, ...info, runs: runs.length, unexplained }
}

// 2a) zh 默认（清空 lang）
await nav('#/')
await ev(`(() => { localStorage.removeItem('radar:lang:v1'); return true })()`)
await reload()
const zhHome = await probe('#/', 'zh')
check('I05', 'zh 为默认语言（无 localStorage 时）', String(zhHome.lang).startsWith('zh') && /指挥台/.test(zhHome.text), `lang=${zhHome.lang}`)
check('I06', 'zh 首页标题/语言属性正确', zhHome.title.includes('机会雷达') && String(zhHome.lang).startsWith('zh'), zhHome.title)

// 2b) EN 全路由（12）
await setLang('en')
const enPages = []
for (const r of routes) enPages.push(await probe(r, 'en'))
const enHome = enPages[0]
check('I07', 'EN：html lang=en 且 document.title 翻译为英文', enHome.lang === 'en' && !/[\u4e00-\u9fff]/.test(enHome.title), `lang=${enHome.lang} title=${enHome.title}`)
check('I08', 'EN：导航全部翻译（≥6/7 英文导航标签）', EN_NAV.filter((x) => enHome.text.includes(x)).length >= 6, `found=${EN_NAV.filter((x) => enHome.text.includes(x)).join(',')}`)
check('I09', 'EN：显示「内容仅中文」提示条', enHome.banner, enHome.banner ? 'banner=✓' : 'missing')
const uiCJK = enPages.map((p) => ({ route: p.route, unexplained: p.unexplained }))
const uiCJKCount = uiCJK.reduce((a, x) => a + x.unexplained.length, 0)
const uiCJKPages = uiCJK.filter((x) => x.unexplained.length > 0)
check('I10', 'EN：无「非数据」中文 UI 文案（按数据白名单过滤）', uiCJKCount === 0, `unexplained=${uiCJKCount} pages=${JSON.stringify(uiCJKPages.map((x) => ({ route: x.route, samples: x.unexplained.slice(0, 4) }))).slice(0, 420)}`)
const zhDataPages = enPages.filter((p) => p.bodyCJK > 0).length
check('I11', 'EN：数据内容保持中文（有中文数据页面）', zhDataPages >= 3, `pages_with_CJK=${zhDataPages}/9`)

// 2c) 切换不刷新、路由保持、持久化
await nav('#/rankings')
const beforeNav = await ev(`performance.getEntriesByType('navigation').length`)
const beforeHash = await ev(`location.hash`)
const clickInfo = await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'EN')
  if (!b) return { clicked: false }
  b.click(); return { clicked: true }
})()`)
await sleep(1400)
const afterSwitch = await ev(`(() => ({ lang: document.documentElement.lang, hash: location.hash, nav: performance.getEntriesByType('navigation').length, enNav: (document.body.innerText || '').includes('Rankings') }))()`)
check('I12', 'EN 切换：点击 EN 即时生效且不刷新（导航计数不变/路由保持）', clickInfo.clicked && afterSwitch.lang === 'en' && afterSwitch.hash === beforeHash && afterSwitch.nav === beforeNav, JSON.stringify({ beforeNav, beforeHash, clickInfo, afterSwitch }))
await reload()
const persisted = await ev(`(() => ({ lang: document.documentElement.lang, saved: localStorage.getItem('radar:lang:v1') }))()`)
check('I13', 'EN 切换：localStorage 持久化且刷新后保持', persisted.saved === 'en' && persisted.lang === 'en', JSON.stringify(persisted))
// 切回中文
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '中文'); if (b) b.click(); return !!b })()`)
await sleep(1200)
const backZh = await ev(`(() => ({ lang: document.documentElement.lang, hasZh: (document.body.innerText || '').includes('商机榜'), text: (document.body.innerText || '').slice(0, 500) }))()`)
check('I14', '切回中文即时生效', String(backZh.lang).startsWith('zh') && (backZh.hasZh || /商机榜/.test((backZh.text || ''))), JSON.stringify(backZh))
const enOverflow = enPages.filter((p) => p.horizontalOverflow)
check('I16', 'EN 9 路由无横向溢出', enOverflow.length === 0, `overflow=${enOverflow.map((p) => p.route).join(',') || 'none'}`)
check('I15', 'EN 全路由无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join('; ') || '0')

const summary = { pass: results.filter((r) => r.pass).length, fail: results.filter((r) => !r.pass).length, total: results.length, enUnexplainedCJK: uiCJKCount }
fs.mkdirSync(path.join(root, 'app/screenshots/final-v1.5'), { recursive: true })
fs.writeFileSync(path.join(root, 'app/screenshots/final-v1.5/i18n-check.json'), JSON.stringify({ results, summary, enPages: enPages.map((p) => ({ route: p.route, textLen: p.textLen, bodyCJK: p.bodyCJK, runs: p.runs, unexplained: p.unexplained.length, samples: p.unexplained.slice(0, 12), horizontalOverflow: p.horizontalOverflow })) }, null, 2))
console.log(JSON.stringify({ results, summary }, null, 2))
ws.close()
process.exit(0)
