import fs from 'node:fs'
const [port, base] = process.argv.slice(2)
async function target(){for(let i=0;i<60;i++){try{const l=await(await fetch(`http://127.0.0.1:${port}/json`)).json();const p=l.find(t=>t.type==='page');if(p)return p}catch{}await new Promise(r=>setTimeout(r,250))}throw new Error('no target')}
const t=await target();const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const pend=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}});const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});await new Promise((r,j)=>{ws.addEventListener('open',r);ws.addEventListener('error',j)});await send('Runtime.enable');await send('Page.enable')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const nav=async(hash)=>{await send('Page.navigate',{url:`${base}${hash}`});await sleep(3200)}
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result?.result?.value
const out={}
await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false})
await nav('#/candidates/cand-5c555f56997d')
out.candidate=await ev(`(()=>{const b=document.body.innerText;const links=[...document.querySelectorAll('a[href^="http"]')].map(a=>a.href);const facts=[...document.querySelectorAll('*')].filter(e=>/关键事实|证据质量|信息价值/.test(e.innerText||'')&&e.children.length===0).map(e=>e.innerText.trim()).slice(0,20);return{hasAnalysis:/02A|商机分析|信息价值/.test(b),hasInfo:/信息价值/.test(b),hasFacts:/关键事实/.test(b),hasInference:/推断/.test(b),hasEvidence:/证据质量/.test(b),extLinks:links.length,uniqueLinks:[...new Set(links)].length,textSnippet:b.slice(0,120),facts}})()`)
await nav('#/opportunities/opp-pet-memorial-glass-001')
out.curated=await ev(`(()=>{const b=document.body.innerText;return{hasAnalysis:/02A|商机分析/.test(b),hasInfo:/信息价值/.test(b),hasFacts:/关键事实/.test(b),hasEvidence:/证据质量/.test(b),hasCore:/核心判断/.test(b),hasEcon:/经济性驾驶舱/.test(b)}})()`)
await send('Emulation.setDeviceMetricsOverride',{width:1024,height:900,deviceScaleFactor:1,mobile:false})
await nav('#/candidates/cand-5c555f56997d')
out.candidate1024=await ev(`(()=>({docScroll:document.documentElement.scrollWidth,docClient:document.documentElement.clientWidth,overflow:document.documentElement.scrollWidth>innerWidth+2,info:/信息价值/.test(document.body.innerText),facts:/关键事实/.test(document.body.innerText),evidence:/证据质量/.test(document.body.innerText)}))()`)
console.log(JSON.stringify(out,null,2));fs.writeFileSync('qa/v180-analysis-audit.json',JSON.stringify(out,null,2));ws.close()
