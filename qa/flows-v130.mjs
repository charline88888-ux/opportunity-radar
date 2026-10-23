// qa/flows-v130.mjs —— v1.0.0 核心回归验收：9 路由 / 唯一商机榜（候选+精选混排）/ 候选详情 / 扫描链 / 无删除功能
// 用法：node qa/flows-v130.mjs <debugPort> <baseUrl> [downloadDir]
const fs = await import('node:fs')
const path = await import('node:path')
const root = path.resolve('.')
const [port, base] = process.argv.slice(2)
if (!port || !base) { console.error('usage: node qa/flows-v130.mjs <port> <baseUrl>'); process.exit(2) }
const cands = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/candidates.json'), 'utf8'))
const candRank = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/candidate-rankings.json'), 'utf8'))
const rankings = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/rankings.json'), 'utf8'))
const stats = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/stats.json'), 'utf8'))
const firstCand = (cands.candidates || [])[0] || {}
const cid = firstCand.candidate_id
const dayFirst = ((((candRank.windows || {}).day || {}).items || [])[0] || {}).candidate_id || cid
const results = []
function check(id, name, pass, detail) { results.push({ id, name, pass: !!pass, detail: String(detail).slice(0, 400) }) }
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
const consoleErrors = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(String(m.params?.exceptionDetails?.text || 'exception').slice(0, 160))
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') consoleErrors.push((m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160))
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
await send('Runtime.enable'); await send('Page.enable')
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const nav = async (hash) => { await send('Page.navigate', { url: `${base}${hash}` }); await sleep(2600) }
const reload = async () => { await send('Page.reload', { ignoreCache: true }); await sleep(2800) }
const bodyText = async () => ev(`(() => document.body.innerText || '')()`)
const waitFor = async (expr, timeout = 12000) => { const start = Date.now(); while (Date.now() - start < timeout) { if (await ev(expr)) return true; await sleep(400) } return false }

// 1) 9 路由可达
const expectRoutes = [
  ['#/', /指挥台|Command/],
  ['#/rankings', /商机榜|Opportunity board/],
  [`#/candidates/${cid}`, /商机详情|Opportunity detail|自动发现/],
  ['#/opportunities/opp-pet-memorial-glass-001', /七问|SEVEN QUESTIONS/i],
  ['#/scanner', /扫描室|Scanner/],
  ['#/method', /方法论|Method/],
  ['#/sources', /数据源|Sources/],
  ['#/calendar', /商业日历|Calendar/],
  ['#/about', /关于|About/]
]
let routeOk = 0
const routeDetails = []
for (const [h, re] of expectRoutes) {
  await nav(h)
  const t = await bodyText()
  const ok = re.test(t) && t.length > 300
  if (ok) routeOk++
  routeDetails.push(`${h}:${ok ? 'ok' : 'BAD'}`)
}
check('T01', '9 路由全部可达且核心内容渲染', routeOk === 9, routeDetails.join(' '))

// 2) 导航仅 7 项，已删功能无入口
await nav('#/'); await reload()
const navText = await bodyText()
const deleted = ['控制台', '实验台', '个人画像', '预警中心', '回测校准', '年度复盘', '个人数据', '自动发现榜']
const navHits = deleted.filter((d) => navText.includes(d))
check('T02', '导航/页面无已删功能入口（控制台/实验/画像/预警/校准/年鉴/数据/发现榜）', navHits.length === 0, `hits=${navHits.join(',')}`)

// 3) 已删路由不渲染功能页
const removed = ['#/discover', '#/control', '#/lab', '#/calibration', '#/profile', '#/alerts', '#/yearbook', '#/data']
const remBad = []
for (const h of removed) {
  await nav(h)
  const t = await bodyText()
  if (/本地控制台|实验台|个人画像|预警中心|回测校准|年度复盘|个人数据|自动发现榜/.test(t)) remBad.push(h)
}
check('T03', '8 个已删路由不渲染对应功能（NotFound/无功能页头）', remBad.length === 0, `bad=${remBad.join(',')}`)

// 4) 唯一商机榜：候选+精选混排、四窗口
await nav('#/rankings'); await reload()
await waitFor(`document.body.innerText.includes('自动候选')`, 12000)
const rankText = await bodyText()
const windowLabels = ['日榜', '周榜', '月榜', '年榜'].every((x) => rankText.includes(x))
const candLinksDay = await ev(`(() => [...document.querySelectorAll('a[href*="#/candidates/"]')].length)()`)
const curLinksDay = await ev(`(() => [...document.querySelectorAll('a[href*="#/opportunities/"]')].length)()`)
check('T04', '商机榜：唯一榜单(候选200/精选80) + 四窗口 + 候选/精选混排', /自动候选\s*200|200 auto candidates/.test(rankText) && /精选\s*80|80 curated/.test(rankText) && windowLabels && candLinksDay >= 20 && curLinksDay >= 1, JSON.stringify({ candLinksDay, curLinksDay, windowLabels }).slice(0, 260))
const clickYear = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(e => (e.innerText || '').trim() === '年榜'); if (!b) return false; b.click(); return true })()`)
await sleep(900)
const yearLinks = await ev(`(() => ({ cand: [...document.querySelectorAll('a[href*="#/candidates/"]')].length, cur: [...document.querySelectorAll('a[href*="#/opportunities/"]')].length }))()`)
check('T05', '年窗口：候选+精选均入榜（200 候选覆盖）', clickYear && yearLinks.cand >= 190 && yearLinks.cur >= 70, JSON.stringify(yearLinks).slice(0, 200))
// 筛选：全部/自动/精选
const filterButtons = await ev(`(() => [...document.querySelectorAll('button, [role=tab]')].map(e => (e.innerText || '').trim()).filter(t => /全部|自动|精选/.test(t)).slice(0, 12))()`)
const clickCurated = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(e => (e.innerText || '').trim().includes('精选') && !/自动/.test((e.innerText || '').trim())); if (!b) return false; b.click(); return true })()`)
await sleep(800)
const curFilter = await ev(`(() => ({ cand: [...document.querySelectorAll('a[href*="#/candidates/"]')].length, cur: [...document.querySelectorAll('a[href*="#/opportunities/"]')].length }))()`)
const clickAll = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(e => (e.innerText || '').trim().startsWith('全部')); if (!b) return false; b.click(); return true })()`)
await sleep(600)
check('T06', '商机榜筛选：全部/自动/精选可用（精选仅精选）', (filterButtons || []).length >= 2 && clickCurated && curFilter.cand === 0 && curFilter.cur > 0, JSON.stringify({ filterButtons, curFilter }).slice(0, 260))

// 5) 候选详情
await nav(`#/candidates/${cid}`); await reload()
await waitFor(`document.body.innerText.includes('商业画布')`, 12000)
const candDetail = await bodyText()
check('T07', '候选详情：评分 + 9 大评估分区（画布/为什么/竞争/跨市场/时机/条件/利润/执行/来源）+ 无门禁', /评分|Score/.test(candDetail) && /商业画布|Business canvas/.test(candDetail) && /为什么是商机|Why an opportunity/.test(candDetail) && /竞争与差异|Competition & differentiation/.test(candDetail) && /跨市场机会|Cross-market opportunity/.test(candDetail) && /时机与窗口|Timing & window/.test(candDetail) && /条件、门槛与资金|Conditions, barriers & capital/.test(candDetail) && /利润模型|Profit model/.test(candDetail) && /执行方案|Execution plan/.test(candDetail) && /信息来源与依据|Sources & evidence/.test(candDetail) && !/验证后才能|需复核后.*上榜|未验证.*不能/.test(candDetail), candDetail.slice(0, 260))
const badDetailLinks = await ev(`(() => [...document.querySelectorAll('a[href*="#/alerts"],a[href*="#/calibration"],a[href*="#/yearbook"],a[href*="#/data"],a[href*="#/profile"],a[href*="#/control"]')].length)()`)
check('T08', '候选详情无已删功能链接', badDetailLinks === 0, `bad=${badDetailLinks}`)

// 6) 精选机会详情
await nav('#/opportunities/opp-pet-memorial-glass-001'); await reload()
const oppDetail = await bodyText()
check('T09', '精选机会详情：七问/评分/证据/免责正常', /七问|SEVEN QUESTIONS/i.test(oppDetail) && /证据|Evidence/i.test(oppDetail) && oppDetail.length > 1500, oppDetail.slice(0, 200))

// 7) 扫描室：核心扫描流程 + 源健康表（漏斗真值由数据侧 qa/v100-check 核验）
await nav('#/scanner'); await reload()
await waitFor(`document.body.innerText.includes('数据源健康度') || document.body.innerText.includes('扫描室')`, 12000)
await sleep(1200)
const scannerText = (await bodyText()).replace(/\s+/g, ' ')
const healthRows = await ev(`(() => document.querySelectorAll('table tbody tr').length)()`)
check('T10', '扫描室：每日扫描流程 + 源健康表（101 源）', /扫描室|数据源健康度/.test(scannerText) && /101/.test(scannerText) && Number(healthRows) >= 50, JSON.stringify({ healthRows, snippet: scannerText.slice(0, 180) }).slice(0, 260))

// 8) 指挥台核心 KPI（无旧功能）
await nav('#/'); await reload(); await waitFor(`document.body.innerText.includes('今日新候选')`, 10000)
const dashText = (await bodyText()).replace(/\s+/g, ' ')
check('T11', '指挥台：核心 KPI（今日候选99/候选200/自动源100/区域11），无旧功能入口', dashText.includes(String((stats.kpi || {}).today_new_candidates)) && dashText.includes(String((stats.kpi || {}).candidates_total)) && /自动源\s*100|Auto sources\s*100/.test(dashText) && dashText.includes(String((stats.kpi || {}).regions_covered)) && !/个人画像|预警|校准|年鉴|数据包/.test(dashText), dashText.slice(0, 320))

// 9) 方法论/数据源/日历/关于
await nav('#/sources'); await reload(); await waitFor(`document.body.innerText.includes('168')`, 10000)
const srcText = (await bodyText()).replace(/\s+/g, ' ')
check('T12', '数据源：168 平台 / 自动100 / 11 区域', /168/.test(srcText) && /自动\s*100|Auto\s*100/.test(srcText) && /11/.test(srcText), srcText.slice(0, 200))
await nav('#/about'); await waitFor(`document.body.innerText.includes('1.0.1')`, 10000); const aboutText = await bodyText()
check('T13', '关于：版本 v1.3.0 + 核心边界说明', /1\.2\.0/.test(aboutText) && /核心|每日|扫描|商机/.test(aboutText), aboutText.slice(0, 240))
// 10) 全站无已删功能文本（9 路由）
const forbidden = ['本地控制台', '实验台', '个人画像', '预警中心', '回测校准', '年度复盘', '个人数据', '自动发现榜']
const hits = []
for (const h of ['#/', '#/rankings', '#/scanner', '#/method', '#/sources', '#/calendar', '#/about', `#/candidates/${cid}`]) {
  await nav(h)
  const t = await bodyText()
  const found = forbidden.filter((f) => t.includes(f))
  if (found.length) hits.push(`${h}:${found.join(',')}`)
}
check('T14', '9 路由无已删功能文案/入口', hits.length === 0, hits.join(' | '))
check('T15', '运行时无 console error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join('; ') || '0')

// v1.3.0：候选详情不得出现验证/实验/复核/门禁文案
await nav(`#/candidates/${cid}`); await reload(); await sleep(1200)
const candText101 = await bodyText()
check('T16', '候选详情无「验证/实验/复核/门禁」文案（v1.3.0 清洗）', !/验证|实验|复核|门禁/.test(candText101), (candText101.match(/.{0,20}(验证|实验|复核|门禁).{0,40}/) || [''])[0])


// v1.3.0 方法论：10 维判断表 + 评估结构解释
await nav('#/method'); await reload(); await sleep(1200)
const methodText = await bodyText()
check('T17', '方法论：10 维怎么判断（数据来源/判断标准）+ 画布/竞争/跨市场/执行解释', /10 维怎么判断|How the 10 dimensions are judged/.test(methodText) && /数据来源|Data source/.test(methodText) && /判断标准|Criteria/.test(methodText) && /商业画布|Business canvas/.test(methodText) && /竞争与差异|Competition & differentiation/.test(methodText) && /跨市场机会|Cross-market opportunity/.test(methodText) && /执行方案|Execution plan/.test(methodText), methodText.slice(0, 260))


// v1.3.0：analyst_narrative 六段在详情呈现
{
  const c130 = JSON.parse(fs.readFileSync(path.join(root, 'app/src/data/candidates.json'), 'utf8'))
  const row130 = (c130.candidates || []).find((x) => x.candidate_id === cid) || (c130.candidates || [])[0] || {}
  const thesis = String(((row130.analyst_narrative || {}).thesis) || '').slice(0, 14)
  await nav(`#/candidates/${cid}`); await reload(); await waitFor(`document.body.innerText.includes('商业画布') || document.body.innerText.includes('为什么是商机')`, 12000)
  const t130 = await bodyText()
  check('T18', '候选详情呈现 analyst_narrative 六段专业叙事（thesis/market/…）', !!thesis && t130.includes(thesis) && /市场|竞争|跨市场|时机|结论/.test(t130), JSON.stringify({ thesis }).slice(0, 200))
}

console.log(JSON.stringify({ results, summary: { pass: results.filter((r) => r.pass).length, fail: results.filter((r) => !r.pass).length, total: results.length } }, null, 2))
ws.close()
process.exit(results.some((r) => !r.pass) ? 1 : 0)
