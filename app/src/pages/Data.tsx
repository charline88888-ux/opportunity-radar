import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Database, Download, FileJson, HardDrive, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, EmptyState, Panel, SectionCard } from '@/components/ui'
import { downloadText } from '@/lib/exports'
import { dataMeta, sourceHealth } from '@/lib/data'
import { freshness } from '@/lib/freshness'
import { useI18n } from '@/lib/i18n'
import {
  decryptDataBundleJson,
  encryptedEnvelopeJson,
  encryptDataBundleJson,
  isEncryptedEnvelope,
} from '@/lib/crypto'
import {
  applyDataBundle,
  buildDataBundle,
  dataBundleJson,
  validateDataBundle,
  type BundleApplyMode,
  type DataBundle,
  type BundlePreview,
} from '@/lib/local-data'

type L = (zh: string, en: string) => string

export default function DataPage() {
  const { lang, setLang } = useI18n()
  const L: L = (zh, en) => (lang === 'en' ? en : zh)
  const fileRef = useRef<HTMLInputElement>(null)
  const [imported, setImported] = useState<DataBundle | null>(null)
  const [preview, setPreview] = useState<BundlePreview | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState('')
  const [fileName, setFileName] = useState('')
  const [encryptEnabled, setEncryptEnabled] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [encryptedEnvelope, setEncryptedEnvelope] = useState<Record<string, unknown> | null>(null)
  const [importPassword, setImportPassword] = useState('')
  const [working, setWorking] = useState(false)
  const current = useMemo(() => buildDataBundle(), [])
  const fresh = freshness()

  const exportBundle = async () => {
    setErrors([])
    setSuccess('')
    const bundle = buildDataBundle()
    try {
      if (encryptEnabled) {
        if (password.length < 8) {
          setErrors([L('口令至少 8 个字符', 'Password must be at least 8 characters')])
          return
        }
        if (password !== confirmPassword) {
          setErrors([L('两次输入的口令不一致', 'Passwords do not match')])
          return
        }
        setWorking(true)
        const envelope = await encryptDataBundleJson(dataBundleJson(bundle), password)
        downloadText(`radar-data-bundle-${bundle.exported_at.slice(0, 10)}.encrypted.json`, encryptedEnvelopeJson(envelope), 'application/json;charset=utf-8')
        setSuccess(L('已导出加密数据包；口令不会保存，忘记无法恢复。', 'Encrypted bundle exported; the password is not stored and cannot be recovered.'))
        setPassword('')
        setConfirmPassword('')
      } else {
        downloadText(`radar-data-bundle-${bundle.exported_at.slice(0, 10)}.json`, dataBundleJson(bundle), 'application/json;charset=utf-8')
        setSuccess(L('已导出明文数据包（schema 0.5.1）', 'Plain bundle exported (schema 0.5.1)'))
      }
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)])
    } finally {
      setWorking(false)
    }
  }

  const onFile = async (file: File | undefined) => {
    setErrors([])
    setSuccess('')
    setPreview(null)
    setImported(null)
    setEncryptedEnvelope(null)
    setImportPassword('')
    if (!file) return
    setFileName(file.name)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (isEncryptedEnvelope(parsed)) {
        if (parsed.schema_version !== '0.5.1') {
          setErrors([L('加密数据包版本不兼容：仅支持 0.5.1，请使用新版导出。', 'Incompatible encrypted bundle: only 0.5.1 is supported; export again with the current version.')])
          return
        }
        setEncryptedEnvelope(parsed)
        return
      }
      if (parsed?.schema_version !== '0.5.1') {
        setErrors([L(`旧版或不兼容的数据包（schema ${String(parsed?.schema_version || '缺失')}）；仅支持明文 0.5.1。`, `Old or incompatible bundle (schema ${String(parsed?.schema_version || 'missing')}); only plain 0.5.1 is supported.`)])
        return
      }
      const result = validateDataBundle(parsed)
      if (!result.ok || !result.bundle || !result.preview) {
        setErrors(result.errors.length ? result.errors : [L('数据包不合法', 'Invalid data bundle')])
        return
      }
      setImported(result.bundle)
      setPreview(result.preview)
    } catch {
      setErrors([L('无法解析 JSON 文件，请确认是 /data 导出的数据包', 'Cannot parse the JSON file; make sure it is a bundle exported from /data')])
    }
  }

  const decryptImport = async () => {
    if (!encryptedEnvelope) return
    setErrors([])
    try {
      setWorking(true)
      const plain = await decryptDataBundleJson(encryptedEnvelope, importPassword)
      const parsed = JSON.parse(plain)
      const result = validateDataBundle(parsed)
      if (!result.ok || !result.bundle || !result.preview) {
        setErrors(result.errors.length ? result.errors : [L('解密后的数据包不合法', 'Decrypted bundle is invalid')])
        return
      }
      setImported(result.bundle)
      setPreview(result.preview)
      setEncryptedEnvelope(null)
      setImportPassword('')
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)])
    } finally {
      setWorking(false)
    }
  }

  const apply = (mode: BundleApplyMode) => {
    if (!imported) return
    try {
      applyDataBundle(imported, mode)
      setLang(imported.settings.language)
      const done = mode === 'replace' ? L('已覆盖本机数据', 'Local data replaced') : L('已合并到本机数据', 'Merged into local data')
      setSuccess(`${done} · ${L('画像', 'profile')}: ${imported.profile ? '✓' : '—'} · ${L('实验', 'experiments')}: ${imported.experiments.length} · rec_log: ${imported.rec_log.length}`)
      setPreview(null)
      setImported(null)
      setFileName('')
    } catch {
      setErrors([L('应用数据包失败，请刷新后重试', 'Failed to apply the bundle; refresh and retry')])
    }
  }

  const localSummary = current ? {
    profile: !!current.profile,
    experiments: current.experiments.length,
    alertsRead: current.alerts_state.read.length,
    recLog: current.rec_log.length,
    language: current.settings.language,
  } : null

  return (
    <div>
      <PageHeader
        index="12"
        kicker={L('DATA · 个人数据', 'DATA')}
        title={L('个人数据与备份 · 本地数据包', 'Personal data & backup · Local data bundle')}
        description={L('把画像、实验、预警已读/忽略、推荐记录与设置打包成一个 JSON，下载保存或导入迁移到其他设备。数据处理完全在本机浏览器，不上传、不联网。', 'Bundle profile, experiments, alert read/ignored state, recommendation log, and settings into one JSON for download or migration. Everything runs in this browser; nothing is uploaded.')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal"><ShieldCheck className="h-3 w-3" /> {L('纯本地', 'Local-only')}</Badge>
            <Button size="sm" variant="primary" onClick={exportBundle}><Download className="h-3.5 w-3.5" /> {L('导出数据包', 'Export bundle')}</Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> {L('导入数据包', 'Import bundle')}</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
        }
      />

      {success && <Panel className="mb-3 border-signal/30 bg-signal/[0.05] px-3 py-2 text-[11px] text-signal">{success}</Panel>}
      {errors.length > 0 && (
        <Panel className="mb-3 border-danger/35 bg-danger/[0.05] px-3 py-2 text-[11px] text-danger">
          <div className="font-semibold">{L('导入校验失败', 'Import validation failed')}</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </Panel>
      )}

      <Panel className="mb-3 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-ink">
          <input type="checkbox" checked={encryptEnabled} onChange={(e) => setEncryptEnabled(e.target.checked)} className="accent-signal" />
          {L('加密导出（可选口令）', 'Encrypted export (optional password)')}
          <span className="font-mono text-[9px] text-dim">AES-GCM-256 · PBKDF2-SHA256 · 210,000</span>
        </label>
        {encryptEnabled && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mono-label">{L('口令（≥8 字符）', 'Password (≥8 chars)')}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="h-7 w-full rounded border border-line bg-panel-2 px-2 text-[11.5px] text-ink outline-none focus:border-signal/50" />
            </label>
            <label className="block">
              <span className="mono-label">{L('再次输入口令', 'Confirm password')}</span>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" className="h-7 w-full rounded border border-line bg-panel-2 px-2 text-[11.5px] text-ink outline-none focus:border-signal/50" />
            </label>
            <div className="sm:col-span-2 rounded border border-amber/25 bg-amber/[0.05] px-2 py-1.5 text-[9.5px] leading-relaxed text-amber">
              {L('口令不落盘、不上传；忘记口令将无法恢复数据包。加密外层 schema 0.5.1，明文导入仍兼容。', 'The password is never stored or uploaded; if forgotten, the bundle cannot be recovered. Encrypted outer schema 0.5.1; plain bundles remain importable.')}
            </div>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <SectionCard className="xl:col-span-4" eyebrow="LOCAL STORAGE" title={L('本机数据摘要', 'Local data summary')} right={<HardDrive className="h-4 w-4 text-dim" />}>
          <div className="space-y-1.5 text-[10.5px]">
            <div className="flex items-center justify-between border-b border-line/50 pb-1"><span className="text-dim">{L('画像', 'Profile')}</span><span className="text-muted">{localSummary?.profile ? L('已设置', 'Set') : L('未设置', 'Not set')}</span></div>
            <div className="flex items-center justify-between border-b border-line/50 pb-1"><span className="text-dim">{L('实验记录', 'Experiments')}</span><span className="num text-muted">{localSummary?.experiments ?? 0}</span></div>
            <div className="flex items-center justify-between border-b border-line/50 pb-1"><span className="text-dim">{L('预警已读', 'Alerts read')}</span><span className="num text-muted">{localSummary?.alertsRead ?? 0}</span></div>
            <div className="flex items-center justify-between border-b border-line/50 pb-1"><span className="text-dim">{L('推荐记录', 'Rec log')}</span><span className="num text-muted">{localSummary?.recLog ?? 0} / 500</span></div>
            <div className="flex items-center justify-between"><span className="text-dim">{L('语言', 'Language')}</span><span className="text-muted">{localSummary?.language === 'en' ? 'EN' : L('中文', 'Chinese')}</span></div>
          </div>
          <div className="mt-3 rounded border border-line/60 bg-black/15 px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
            {L('数据只保存在当前浏览器 localStorage；清缓存或换浏览器会丢失，建议定期导出备份。', 'Data stays in this browser’s localStorage; clearing storage or switching browsers loses it—export a backup regularly.')}
          </div>
          <div className="mt-2 rounded border border-line/60 bg-black/15 px-2 py-1.5 text-[9.5px] leading-relaxed text-dim">
            <div>{L('数据基准日', 'Data as-of')}: <span className="font-mono text-muted">{fresh.asOf}</span> · {L('距今', 'age')} <span className="font-mono text-muted">{fresh.days}</span> {L('天', 'days')}</div>
            <div>{L('最新采集', 'Latest collection')}: <span className="font-mono text-muted">{sourceHealth.checked_at || dataMeta.synced_at || '—'}</span></div>
            <div className="mt-1">{L('每日任务会把最新构建放到 current/index.html（由 scripts/daily-run.ps1 生成）；本页不直接读取后端报告。', 'The daily task publishes the latest build to current/index.html (generated by scripts/daily-run.ps1); this page never reads backend reports directly.')}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link to="/profile" className="text-[10px] text-signal hover:underline">{L('画像 →', 'Profile →')}</Link>
            <Link to="/lab" className="text-[10px] text-signal hover:underline">{L('实验台 →', 'Lab →')}</Link>
            <Link to="/calibration" className="text-[10px] text-signal hover:underline">{L('校准 →', 'Calibration →')}</Link>
          </div>
        </SectionCard>

        <SectionCard className="xl:col-span-8" eyebrow="BUNDLE PREVIEW" title={L('导入预览', 'Import preview')} subtitle={L('选择数据包文件后先校验并预览，再决定覆盖或合并', 'Validate and preview a bundle before choosing replace or merge')} right={<RefreshCw className="h-4 w-4 text-dim" />}>
          {encryptedEnvelope && !preview ? (
            <div className="rounded border border-cyan/30 bg-cyan/[0.04] p-3">
              <div className="flex items-center gap-2 text-[11px] text-cyan">
                <ShieldCheck className="h-4 w-4" />
                {L('检测到加密数据包', 'Encrypted bundle detected')}
                <span className="font-mono text-[9px] text-dim">{String(encryptedEnvelope.kdf)} · {String(encryptedEnvelope.iterations)}</span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">
                {L('输入导出时设置的口令以解密并预览。口令只在内存中使用，不保存、不上传；忘记口令无法恢复。', 'Enter the password used when exporting to decrypt and preview. The password is used in memory only, never stored or uploaded; if forgotten it cannot be recovered.')}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder={L('输入口令（≥8 字符）', 'Password (≥8 chars)')}
                  className="h-7 min-w-[220px] flex-1 rounded border border-line bg-panel-2 px-2 text-[11.5px] text-ink outline-none focus:border-signal/50"
                />
                <Button size="sm" variant="primary" onClick={() => void decryptImport()} disabled={working || importPassword.length < 8}>
                  {working ? L('解密中…', 'Decrypting…') : L('解密并预览', 'Decrypt & preview')}
                </Button>
              </div>
              <div className="mt-1 font-mono text-[9px] text-dim">{L('文件', 'File')}: {fileName}</div>
            </div>
          ) : !preview ? (
            <EmptyState
              icon={<FileJson className="h-5 w-5" />}
              title={fileName ? L(`已选择 ${fileName}，但还未通过校验`, `${fileName} selected, not validated yet`) : L('还没有导入数据包', 'No bundle imported yet')}
              hint={L('点击右上角「导入数据包」选择 JSON；校验通过后会显示画像/实验/预警/推荐记录摘要。', 'Click “Import bundle” to choose a JSON file; after validation you will see profile/experiments/alerts/rec_log summaries.')}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  { label: L('schema', 'schema'), value: preview.schema_version },
                  { label: L('画像', 'Profile'), value: preview.profile ? '✓' : '—' },
                  { label: L('实验', 'Experiments'), value: preview.experiments },
                  { label: L('推荐记录', 'Rec log'), value: preview.recLog },
                  { label: L('预警已读', 'Alerts read'), value: preview.alertsRead },
                  { label: L('预警忽略', 'Alerts ignored'), value: preview.alertsIgnored },
                  { label: L('语言', 'Language'), value: preview.language === 'en' ? 'EN' : L('中文', 'Chinese') },
                  { label: L('通知', 'Notifications'), value: preview.notifications ? L('开', 'On') : L('关', 'Off') },
                ].map((x) => (
                  <div key={x.label} className="rounded border border-line/70 px-2 py-1.5">
                    <div className="mono-label">{x.label}</div>
                    <div className="num text-[13px] text-muted">{x.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 font-mono text-[9.5px] text-dim">{L('导出时间', 'Exported')}: {preview.exported_at} · {L('文件', 'File')}: {fileName}</div>
              {preview.warnings.length > 0 && (
                <div className="mt-2 rounded border border-amber/25 bg-amber/[0.05] px-2 py-1.5 text-[10px] text-amber">
                  {preview.warnings.map((w) => <div key={w}>{w}</div>)}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" onClick={() => apply('replace')}><Database className="h-3.5 w-3.5" /> {L('覆盖本机数据', 'Replace local data')}</Button>
                <Button size="sm" variant="outline" onClick={() => apply('merge')}><RefreshCw className="h-3.5 w-3.5" /> {L('合并（按 id 取较新）', 'Merge (newer by id)')}</Button>
                <span className="text-[10px] text-dim">{L('画像取较新；实验/推荐记录按 id 去重；预警已读/忽略取并集；设置以数据包为准。', 'Profile keeps newer; experiments/rec_log dedupe by id; alert read/ignored union; settings use the bundle.')}</span>
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard className="xl:col-span-12" eyebrow="SCHEMA" title={L('数据包结构（schema 0.5.1）', 'Bundle schema (0.5.1)')} right={<Badge tone="muted">JSON</Badge>}>
          <pre className="overflow-x-auto rounded border border-line/60 bg-black/25 p-3 font-mono text-[9.5px] leading-relaxed text-dim">{`{
  "schema_version": "0.5.1",
  "exported_at": "ISO-8601",
  "profile": { "capitalBand": "...", "skills": {...}, "strictCapital": false },
  "experiments": [{ "id": "...", "opp_id": "...", "outcome": "positive|negative|inconclusive|null", "updated_at": "..." }],
  "alerts_state": { "read": ["alert id"], "ignored": ["alert id"] },
  "rec_log": [{ "id": "...", "opp_id": "...", "event": "impression|view|experiment|dismiss", "rec_score": 0, "fit": 0, "at": "..." }],
  "settings": { "language": "zh|en", "notifications": { "enabled": false, "seen": [] } }
}

// optional encrypted outer envelope:
{
  "schema_version": "0.5.1", "encrypted": true,
  "algo": "AES-GCM", "kdf": "PBKDF2-SHA256", "iterations": 210000,
  "salt_b64": "...", "iv_b64": "...", "ciphertext_b64": "...",
  "exported_at": "ISO-8601"
}`}</pre>
          <div className="mt-2 text-[10px] leading-relaxed text-dim">
            {L('导入时要求 schema_version=0.5.1；明文与加密包都自动识别。校验 profile 可为 null、experiments/rec_log 为数组、alerts_state/settings 为对象。旧版数据包会明确提示且不应用；数据包不包含任何网络上传字段。', 'Import requires schema_version=0.5.1; plain and encrypted bundles are auto-detected. Profile may be null; experiments/rec_log must be arrays; alerts_state/settings objects. Older bundles are rejected with a clear message; no network fields are included.')}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
