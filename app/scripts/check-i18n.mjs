/**
 * v0.4.0 i18n 覆盖率自查（静态）
 * 用法：node scripts/check-i18n.mjs [--json]
 *
 * 统计：
 * - 字典条目 / 重复 key / 空值
 * - src 下中文 UI 字面量数量与字典精确覆盖率（排除 src/data、mock、i18n 自身）
 * - 未覆盖样例（供人工补字典；长句/模板可能由 DOM 翻译层或英文分支处理）
 * 说明：本脚本是静态辅助；最终以红队 qa/i18n-check.mjs 的 12 路由 zh/en 运行时检查为准。
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const dictPath = path.join(root, 'src/lib/i18n-dict.ts')
const src = fs.readFileSync(dictPath, 'utf8')
const entries = [...src.matchAll(/^\s*'((?:[^'\\]|\\.)+)'\s*:\s*'((?:[^'\\]|\\.)+)'\s*,/gm)].map((m) => ({
  key: m[1].replace(/\\'/g, "'"),
  value: m[2].replace(/\\'/g, "'"),
}))
const keys = entries.map((e) => e.key)
const duplicates = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))]
const empty = entries.filter((e) => !e.value.trim())
const keySet = new Set(keys)
const normalize = (s) => s.replace(/\s+/g, ' ').trim()

function walkFiles(dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (name === 'data' || name === 'mock') continue
      out.push(...walkFiles(p))
    } else if (/\.(ts|tsx)$/.test(name) && name !== 'i18n-dict.ts') {
      out.push(p)
    }
  }
  return out
}

const chinese = /[\u4e00-\u9fff]/
const literals = new Map()
for (const file of walkFiles(path.join(root, 'src'))) {
  const text = fs.readFileSync(file, 'utf8')
  const rel = path.relative(root, file).replace(/\\/g, '/')
  // 抓取引号字符串 + JSX 文本中的中文；模板插值会拆成片段，仅供覆盖率参考
  const re = /'([^'\\\n]*(?:\\.[^'\\\n]*)*)'|"([^"\\\n]*(?:\\.[^"\\\n]*)*)"|>\s*([^<>{}\n]*[\u4e00-\u9fff][^<>{}\n]*)\s*</g
  let m
  while ((m = re.exec(text))) {
    const raw = m[1] ?? m[2] ?? m[3]
    if (!raw || !chinese.test(raw)) continue
    const key = normalize(raw)
    if (!key) continue
    literals.set(key, (literals.get(key) || 0) + 1)
    void rel
  }
}

const all = [...literals.keys()]
const covered = all.filter((k) => keySet.has(k))
const missing = all.filter((k) => !keySet.has(k))
const pct = all.length ? ((covered.length / all.length) * 100).toFixed(1) : '100.0'

const report = {
  dictPath: path.relative(root, dictPath).replace(/\\/g, '/'),
  dictEntries: entries.length,
  duplicateKeys: duplicates,
  emptyValues: empty.map((e) => e.key),
  sourceChineseLiterals: all.length,
  exactCovered: covered.length,
  exactCoveragePct: Number(pct),
  uncoveredSamples: missing.slice(0, 25),
}
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`[i18n] dict entries: ${report.dictEntries}`)
  console.log(`[i18n] duplicate keys: ${duplicates.length}${duplicates.length ? ` (${duplicates.slice(0, 5).join(', ')})` : ''}`)
  console.log(`[i18n] empty values: ${empty.length}`)
  console.log(`[i18n] source Chinese literals: ${all.length} · exact dictionary coverage: ${covered.length} (${pct}%)`)
  if (missing.length) {
    console.log(`[i18n] uncovered samples (${missing.length}):`)
    for (const s of missing.slice(0, 15)) console.log(`  - ${s.slice(0, 90)}`)
  }
  console.log('[i18n] 运行时 12 路由 zh/en 验收请用红队 qa/i18n-check.mjs（DOM 翻译层/英文分支会覆盖部分长句）。')
}
