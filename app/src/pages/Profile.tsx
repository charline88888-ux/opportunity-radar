import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EChartsOption } from 'echarts'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  Wand2,
} from 'lucide-react'
import { Chart } from '@/components/charts/Chart'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, EmptyState, Panel, ProgressBar, SectionCard, Slider } from '@/components/ui'
import {
  CAPABILITY_LABELS,
  CAPITAL_BANDS,
  DEFAULT_PROFILE,
  PROFILE_PRESETS,
  SKILL_META,
  profileSummaryRows,
  profileToCapability,
  useProfile,
  type CapabilityVector,
  type CapitalBand,
  type Profile,
} from '@/lib/profile'
import { downloadText, safeFileName } from '@/lib/exports'
import { cn, fmtScore } from '@/lib/utils'

const STEPS = [
  { title: '资金与时间', desc: '决定哪些机会现实可做' },
  { title: '技能与语言', desc: '决定能否自己交付' },
  { title: '风险与资质', desc: '决定硬约束与推荐边界' },
]

const ABILITY_KEYS: Array<keyof CapabilityVector> = ['capital', 'time', 'tech', 'content', 'supply', 'english', 'risk']

function ProfileRadar({ capability }: { capability: CapabilityVector }) {
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: 'item' },
      radar: {
        center: ['50%', '50%'],
        radius: '64%',
        splitNumber: 5,
        indicator: ABILITY_KEYS.map((k) => ({ name: CAPABILITY_LABELS[k], max: 10 })),
        axisName: { fontSize: 12 },
      },
      series: [
        {
          type: 'radar',
          symbolSize: 3.5,
          data: [
            {
              name: '能力向量',
              value: ABILITY_KEYS.map((k) => capability[k]),
              lineStyle: { color: '#3ddc97', width: 1.8 },
              itemStyle: { color: '#3ddc97' },
              areaStyle: { color: 'rgba(61,220,151,.18)' },
            },
          ],
        },
      ],
    }),
    [capability],
  )
  return <Chart option={option} height={250} />
}

function ToggleRow({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded border px-2.5 py-2 text-left transition-colors',
        checked ? 'border-signal/40 bg-signal/[0.06]' : 'border-line/70 hover:border-line-strong',
      )}
    >
      <span>
        <span className="block text-[11.5px] text-ink">{label}</span>
        {hint && <span className="block text-[9.5px] text-dim">{hint}</span>}
      </span>
      <span className={cn('flex h-4 w-7 items-center rounded-full border px-0.5 transition-colors', checked ? 'justify-end border-signal/50 bg-signal/20' : 'justify-start border-line bg-panel-2')}>
        <span className={cn('h-2.5 w-2.5 rounded-full', checked ? 'bg-signal' : 'bg-dim')} />
      </span>
    </button>
  )
}

export default function ProfilePage() {
  const { profile, hasProfile, save, clear, preset, capability } = useProfile()
  const [editing, setEditing] = useState(!hasProfile)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Profile>(profile || DEFAULT_PROFILE)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm(profile)
      // 画像从外部写入（例如首次加载完成/跨页同步）时，退出「未设置画像」的自动编辑态
      if (!hasProfile) setEditing(true)
      else if (form.updated_at === '') setEditing(false)
    }
  }, [profile?.updated_at])

  useEffect(() => {
    if (!hasProfile) setEditing(true)
  }, [hasProfile])

  const formCapability = useMemo(() => profileToCapability(form), [form])

  const startEdit = () => {
    setForm(profile || DEFAULT_PROFILE)
    setStep(0)
    setEditing(true)
    setJustSaved(false)
  }

  const saveForm = () => {
    save(form)
    setEditing(false)
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 2600)
  }

  const exportProfile = () => {
    if (!profile && !editing) return
    const data = {
      schema: 'opportunity-radar/profile@0.4.0',
      exported_at: new Date().toISOString(),
      profile: profile || form,
      capability: capability || formCapability,
      note: '画像仅保存在本机 localStorage；导出文件可自行备份，勿上传个人数据。',
    }
    downloadText(`${safeFileName('radar-profile')}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
  }

  const summary = profileSummaryRows(editing ? form : profile || form)
  const activeCapability = editing ? formCapability : capability || formCapability

  return (
    <div>
      <PageHeader
        index="09"
        kicker="PROFILE · 个人画像"
        title="个人画像 · 能力向量与匹配基础"
        description="用 3 步建立你的 7 维能力向量（资金 / 时间 / 技术 / 内容 / 供应链 / 英语 / 风险），作为「为你推荐」、预警中心与行动匹配的输入。画像只保存在本机 localStorage，不上传。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={hasProfile ? 'signal' : 'amber'}>{hasProfile ? `画像已保存${profile?.updated_at ? ` · ${profile.updated_at.slice(0, 10)}` : ''}` : '尚未设置画像'}</Badge>
            <Button size="sm" variant="outline" onClick={exportProfile} disabled={!hasProfile && !editing}>
              <Download className="h-3.5 w-3.5" /> 导出 JSON
            </Button>
            {hasProfile ? (
              <>
                <Button size="sm" variant="primary" onClick={startEdit}><Wand2 className="h-3.5 w-3.5" /> 编辑画像</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger/80 hover:bg-danger/10 hover:text-danger"
                  onClick={() => {
                    if (window.confirm('清除本机画像？这会同时影响「为你推荐」和画像相关预警，且不可恢复。')) {
                      clear()
                      setForm(DEFAULT_PROFILE)
                      setEditing(true)
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> 清除
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-7">
          {!editing && profile ? (
            <SectionCard
              eyebrow="PROFILE SUMMARY"
              title="画像摘要"
              right={<Badge tone="signal"><Check className="h-3 w-3" /> 已保存本机</Badge>}
            >
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {summary.map((row) => (
                  <div key={row.label} className="rounded border border-line/70 bg-white/[0.015] px-2.5 py-2">
                    <div className="mono-label">{row.label}</div>
                    <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{row.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ABILITY_KEYS.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    {CAPABILITY_LABELS[k]} <span className="text-signal">{activeCapability[k].toFixed(1)}</span>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/70 pt-2">
                <Link to="/rankings?mode=recommend" className="inline-flex h-7 items-center gap-1 rounded border border-signal/40 bg-signal/10 px-2.5 text-[11.5px] text-signal hover:bg-signal/20">
                  <Target className="h-3 w-3" /> 查看为你推荐
                </Link>
                <span className="text-[10px] text-dim">推荐分 = 0.6 × 总分 + 0.4 × fit × 100；硬约束机会默认不进入推荐。</span>
                {justSaved && <Badge tone="signal">画像已更新</Badge>}
              </div>
            </SectionCard>
          ) : (
            <>
              <SectionCard
                eyebrow={`STEP ${step + 1} / 3`}
                title={STEPS[step].title}
                subtitle={STEPS[step].desc}
                right={
                  <div className="flex items-center gap-1">
                    {STEPS.map((s, i) => (
                      <button
                        key={s.title}
                        onClick={() => setStep(i)}
                        className={cn('h-1.5 w-8 rounded-full transition-colors', i === step ? 'bg-signal' : i < step ? 'bg-signal/40' : 'bg-line')}
                        title={s.title}
                      />
                    ))}
                  </div>
                }
              >
                {step === 0 && (
                  <div className="space-y-3">
                    <div>
                      <div className="mono-label mb-1.5">资金档位（可承受损失）</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {CAPITAL_BANDS.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => setForm((f) => ({ ...f, capitalBand: b.id as CapitalBand }))}
                            className={cn(
                              'rounded border px-2.5 py-2 text-left transition-colors',
                              form.capitalBand === b.id ? 'border-signal/45 bg-signal/10 text-signal' : 'border-line text-muted hover:border-line-strong',
                            )}
                          >
                            <div className="num text-[14px] font-semibold">{b.label}</div>
                            <div className="mt-0.5 text-[9.5px] leading-snug text-dim">{b.hint}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="mono-label">每周可投入时间</span>
                        <span className="num text-[12px] text-signal">{form.fullTime ? '全职' : `${form.weeklyHours} 小时 / 周`}</span>
                      </div>
                      <Slider value={form.weeklyHours} min={0} max={60} step={1} onValueChange={(v) => setForm((f) => ({ ...f, weeklyHours: v }))} label="每周可投入小时" />
                      <div className="mt-1 flex justify-between font-mono text-[9px] text-dim"><span>0h</span><span>20h</span><span>40h</span><span>60h</span></div>
                    </div>
                    <ToggleRow label="是否可全职投入" hint="全职会显著提升可执行性评分（time=10）" checked={form.fullTime} onChange={(v) => setForm((f) => ({ ...f, fullTime: v }))} />
                    <ToggleRow
                      label="严格资金过滤（推荐）"
                      hint={`开启后过滤启动资金 > 档位上限（¥${(CAPITAL_BANDS.find((b) => b.id === form.capitalBand)?.cap ?? 10000).toLocaleString('zh-CN')}）的机会；关闭沿用分数差硬约束`}
                      checked={form.strictCapital}
                      onChange={(v) => setForm((f) => ({ ...f, strictCapital: v }))}
                    />
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-2.5">
                    {SKILL_META.map((s) => (
                      <div key={s.key}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted">{s.label} <span className="text-[9.5px] text-dim">· {s.hint}</span></span>
                          <span className="num text-[11px] text-signal">{form.skills[s.key]} / 3</span>
                        </div>
                        <Slider
                          value={form.skills[s.key]}
                          min={0}
                          max={3}
                          step={1}
                          label={`${s.label}技能`}
                          onValueChange={(v) => setForm((f) => ({ ...f, skills: { ...f.skills, [s.key]: v } }))}
                        />
                      </div>
                    ))}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted">英语能力</span>
                        <span className="num text-[11px] text-signal">{form.english} / 3</span>
                      </div>
                      <Slider value={form.english} min={0} max={3} step={1} label="英语能力" onValueChange={(v) => setForm((f) => ({ ...f, english: v }))} />
                      <div className="mt-1 flex justify-between font-mono text-[9px] text-dim"><span>只能中文</span><span>可读可写</span><span>商务流利</span></div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="mono-label">风险偏好</span>
                        <span className="num text-[12px] text-signal">{form.risk} / 5</span>
                      </div>
                      <Slider value={form.risk} min={1} max={5} step={1} label="风险偏好" onValueChange={(v) => setForm((f) => ({ ...f, risk: v }))} />
                      <div className="mt-1 flex justify-between font-mono text-[9px] text-dim"><span>保守（&lt;5 千损失）</span><span>平衡</span><span>激进（可承受大额损失）</span></div>
                    </div>
                    <ToggleRow label="有持牌/资质合作方" hint="影响「需资质」硬约束；没有合作方时资质类机会默认不推荐" checked={form.hasLicensePartner} onChange={(v) => setForm((f) => ({ ...f, hasLicensePartner: v }))} />
                    <div className="rounded border border-line/70 bg-white/[0.015] px-2.5 py-2">
                      <div className="mono-label">能力向量预览（保存后用于推荐与预警）</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {ABILITY_KEYS.map((k) => (
                          <span key={k} className="rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                            {CAPABILITY_LABELS[k]} <span className="text-signal">{formCapability[k].toFixed(1)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded border border-amber/25 bg-amber/[0.05] px-2.5 py-2 text-[10px] leading-relaxed text-amber">
                      画像仅在本机浏览器生效；推荐结果只是注意力排序，不构成推荐买入或收益承诺。可随时清除。
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3">
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                      <ArrowLeft className="h-3.5 w-3.5" /> 上一步
                    </Button>
                    {step < 2 ? (
                      <Button size="sm" variant="outline" onClick={() => setStep((s) => Math.min(2, s + 1))}>
                        下一步 <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="primary" onClick={saveForm}>
                        <Save className="h-3.5 w-3.5" /> 保存画像
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasProfile && <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>取消编辑</Button>}
                    <Button size="sm" variant="outline" onClick={() => { setForm(DEFAULT_PROFILE); setStep(0) }}>
                      <RotateCcw className="h-3.5 w-3.5" /> 重置表单
                    </Button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard eyebrow="PRESETS" title="冷启动：5 个预设画像" subtitle="一键套用后在向导中微调；适合先看推荐效果再精修">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {PROFILE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setForm({ ...p.profile, updated_at: '' })
                        setJustSaved(false)
                      }}
                      className="rounded border border-line/70 bg-white/[0.015] p-2.5 text-left transition-colors hover:border-signal/35"
                    >
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-amber" />
                        <span className="text-[11.5px] text-ink">{p.name}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] leading-relaxed text-dim">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </SectionCard>
            </>
          )}
        </div>

        <div className="space-y-3 xl:col-span-5">
          <SectionCard eyebrow="CAPABILITY VECTOR" title="7 维能力向量" right={<UserRound className="h-4 w-4 text-dim" />}>
            <ProfileRadar capability={activeCapability} />
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {ABILITY_KEYS.map((k) => (
                <div key={k} className="flex items-center justify-between rounded border border-line/60 px-2 py-1 text-[10px]">
                  <span className="text-dim">{CAPABILITY_LABELS[k]}</span>
                  <span className="num text-muted">{activeCapability[k].toFixed(1)}<span className="text-[8px] text-dim"> /10</span></span>
                </div>
              ))}
            </div>
          </SectionCard>

          {hasProfile && profile ? (
            <SectionCard eyebrow="SUMMARY" title="画像摘要">
              <div className="space-y-1.5">
                {summary.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3 border-b border-line/40 pb-1 text-[10.5px]">
                    <span className="shrink-0 text-dim">{row.label}</span>
                    <span className="text-right text-muted">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 rounded border border-line/60 bg-black/15 px-2 py-1.5 font-mono text-[9px] text-dim">
                fit = Σ权重 × min(10, 10×能力/需求) / Σ权重；rec_score = 0.6×total + 0.4×fit×100。
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Link to="/rankings?mode=recommend" className="text-[10.5px] text-signal hover:underline">去排行榜看推荐 →</Link>
                <span className="font-mono text-[9px] text-dim">本地画像</span>
              </div>
            </SectionCard>
          ) : (
            <EmptyState
              icon={<UserRound className="h-5 w-5" />}
              title="尚未设置画像"
              hint="设置画像后，排行榜会出现「为你推荐」，Dashboard 显示推荐 Top3，预警中心会提示高匹配未行动机会。"
            />
          )}

          <SectionCard eyebrow="HOW IT WORKS" title="画像如何影响结果">
            <div className="space-y-1.5 text-[10.5px] leading-relaxed text-muted">
              <p><span className="text-cyan">硬约束</span>：资金不足 / 需资质 / 需供应链 / 英语弱的机会默认不进入推荐，并解释原因。</p>
              <p><span className="text-cyan">fit</span>：7 维能力与机会需求向量的加权匹配（0–1），按机会字段推导需求，不由用户手填。</p>
              <p><span className="text-cyan">rec_score</span>：0.6×机会总分 + 0.4×fit×100，再用 MMR 做行业/区域/信息差多样性。</p>
              <p><span className="text-cyan">预警</span>：fit ≥0.75 且未加入实验的机会会进入「高匹配未行动」提醒。</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
