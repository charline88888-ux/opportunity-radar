import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { round1 } from './utils'

/** v0.3.0 个人画像（只存本机 localStorage，不上传） */
export type CapitalBand = 'lt1w' | 'b1-5w' | 'b5-20w' | 'gt20w'

export interface ProfileSkills {
  tech: number
  content: number
  supply: number
  ops: number
}

export interface Profile {
  capitalBand: CapitalBand
  weeklyHours: number
  skills: ProfileSkills
  english: number
  risk: number
  fullTime: boolean
  hasLicensePartner: boolean
  /** v0.3.1：推荐时是否按资金档位上限做严格 CNY 过滤（默认关闭，沿用分数差硬约束） */
  strictCapital: boolean
  updated_at: string
}

export const PROFILE_STORAGE_KEY = 'radar:profile:v1'

export const CAPITAL_BANDS: Array<{ id: CapitalBand; label: string; hint: string; score: number; cap: number }> = [
  { id: 'lt1w', label: '< 1 万', hint: '可损失预算 < 1 万元', score: 3, cap: 10_000 },
  { id: 'b1-5w', label: '1–5 万', hint: '可损失预算 1–5 万元', score: 5, cap: 50_000 },
  { id: 'b5-20w', label: '5–20 万', hint: '可损失预算 5–20 万元', score: 7, cap: 200_000 },
  { id: 'gt20w', label: '20 万+', hint: '可损失预算 20 万元以上', score: 10, cap: 1_000_000 },
]

export const SKILL_META: Array<{ key: keyof ProfileSkills; label: string; hint: string }> = [
  { key: 'tech', label: '技术', hint: '开发、自动化、AI 工具、数据' },
  { key: 'content', label: '内容', hint: '写作、视频、设计、社群表达' },
  { key: 'supply', label: '供应链', hint: '找货、打样、履约、质检' },
  { key: 'ops', label: '运营', hint: '投放、增长、客服、项目管理' },
]

export const CAPABILITY_LABELS: Record<keyof CapabilityVector, string> = {
  capital: '资金',
  time: '时间',
  tech: '技术',
  content: '内容',
  supply: '供应链',
  english: '英语',
  risk: '风险承受',
}

export interface CapabilityVector {
  capital: number
  time: number
  tech: number
  content: number
  supply: number
  english: number
  risk: number
}

export const DEFAULT_PROFILE: Profile = {
  capitalBand: 'b1-5w',
  weeklyHours: 10,
  skills: { tech: 1, content: 2, supply: 1, ops: 1 },
  english: 2,
  risk: 3,
  fullTime: false,
  hasLicensePartner: false,
  strictCapital: false,
  updated_at: '',
}

export interface ProfilePreset {
  id: string
  name: string
  desc: string
  profile: Omit<Profile, 'updated_at'>
}

export const PROFILE_PRESETS: ProfilePreset[] = [
  {
    id: 'side-hustle',
    name: '兼职上班族',
    desc: '有稳定工作，每周 10 小时，偏信息差/内容/数字服务',
    profile: {
      capitalBand: 'b1-5w', weeklyHours: 10,
      skills: { tech: 1, content: 2, supply: 0, ops: 2 },
      english: 2, risk: 3, fullTime: false, hasLicensePartner: false, strictCapital: false,
    },
  },
  {
    id: 'fulltime-founder',
    name: '全职创业者',
    desc: '全职投入，可承受 5–20 万，偏跨境 DTC / B2B 服务',
    profile: {
      capitalBand: 'b5-20w', weeklyHours: 40,
      skills: { tech: 2, content: 2, supply: 2, ops: 2 },
      english: 3, risk: 4, fullTime: true, hasLicensePartner: true, strictCapital: false,
    },
  },
  {
    id: 'factory-owner',
    name: '工厂 / 供应链主',
    desc: '有工厂关系与履约能力，偏跨境分销 / B2B / 代工转品牌',
    profile: {
      capitalBand: 'b5-20w', weeklyHours: 35,
      skills: { tech: 1, content: 0, supply: 3, ops: 2 },
      english: 1, risk: 3, fullTime: false, hasLicensePartner: false, strictCapital: false,
    },
  },
  {
    id: 'content-creator',
    name: '内容创作者',
    desc: '内容与表达强、资金少，偏内容出海 / IP / 社群',
    profile: {
      capitalBand: 'lt1w', weeklyHours: 20,
      skills: { tech: 1, content: 3, supply: 0, ops: 2 },
      english: 2, risk: 2, fullTime: false, hasLicensePartner: false, strictCapital: false,
    },
  },
  {
    id: 'investor',
    name: '投资人 / 副业组合',
    desc: '有资金但时间少，偏订阅 / SaaS / 可托管资产',
    profile: {
      capitalBand: 'gt20w', weeklyHours: 8,
      skills: { tech: 2, content: 1, supply: 1, ops: 2 },
      english: 3, risk: 4, fullTime: false, hasLicensePartner: true, strictCapital: false,
    },
  },
]

const capitalizeValues = new Set<string>(CAPITAL_BANDS.map((x) => x.id))

function clampSkill(v: unknown): number {
  return Math.max(0, Math.min(3, Math.round(Number(v) || 0)))
}

export function normalizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const x = raw as Record<string, unknown>
  if (!capitalizeValues.has(String(x.capitalBand))) return null
  const skillsRaw = (x.skills && typeof x.skills === 'object' ? x.skills : {}) as Record<string, unknown>
  return {
    capitalBand: x.capitalBand as CapitalBand,
    weeklyHours: Math.max(0, Math.min(80, Math.round(Number(x.weeklyHours) || 10))),
    skills: {
      tech: clampSkill(skillsRaw.tech),
      content: clampSkill(skillsRaw.content),
      supply: clampSkill(skillsRaw.supply),
      ops: clampSkill(skillsRaw.ops),
    },
    english: clampSkill(x.english),
    risk: Math.max(1, Math.min(5, Math.round(Number(x.risk) || 3))),
    fullTime: x.fullTime === true,
    hasLicensePartner: x.hasLicensePartner === true,
    strictCapital: x.strictCapital === true,
    updated_at: typeof x.updated_at === 'string' ? x.updated_at : '',
  }
}

function safeLoad(): Profile | null {
  try {
    return normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null'))
  } catch {
    return null
  }
}

function persist(profile: Profile | null) {
  try {
    if (profile) localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
    else localStorage.removeItem(PROFILE_STORAGE_KEY)
  } catch {
    /* file:// 下 localStorage 不可用时降级为内存态 */
  }
}

const listeners = new Set<() => void>()
let cache: Profile | null = safeLoad()

function emit() {
  listeners.forEach((fn) => fn())
}

export function getProfile(): Profile | null {
  return cache
}

export function saveProfile(profile: Omit<Profile, 'updated_at'> | Profile): Profile {
  const next: Profile = { ...profile, updated_at: dayjs().toISOString() } as Profile
  cache = next
  persist(cache)
  emit()
  return next
}

export function clearProfile() {
  cache = null
  persist(null)
  emit()
}

export function applyPreset(preset: ProfilePreset): Profile {
  return saveProfile({ ...preset.profile })
}

export function refreshProfile() {
  cache = safeLoad()
  emit()
}

/** 画像 → 7 维能力向量（0–10） */
export function profileToCapability(profile: Profile): CapabilityVector {
  const capital = CAPITAL_BANDS.find((b) => b.id === profile.capitalBand)?.score ?? 3
  const hours = profile.weeklyHours
  const time = profile.fullTime
    ? 10
    : hours <= 5
      ? 2
      : hours <= 10
        ? 4
        : hours <= 20
          ? 6
          : hours <= 35
            ? 8
            : 9
  const skillScore = (v: number) => round1((v / 3) * 10)
  return {
    capital,
    time,
    tech: skillScore(profile.skills.tech),
    content: skillScore(profile.skills.content),
    supply: skillScore(profile.skills.supply),
    english: skillScore(profile.english),
    risk: round1(((profile.risk - 1) / 4) * 10),
  }
}

export function capitalCap(profile: Profile): number {
  return CAPITAL_BANDS.find((b) => b.id === profile.capitalBand)?.cap ?? 10_000
}

export function profileSummaryRows(profile: Profile): Array<{ label: string; value: string }> {
  const band = CAPITAL_BANDS.find((b) => b.id === profile.capitalBand)
  return [
    { label: '资金档位', value: `${band?.label || '—'}（上限 ¥${(band?.cap ?? 10_000).toLocaleString('zh-CN')}）` },
    { label: '每周投入', value: profile.fullTime ? '全职投入' : `${profile.weeklyHours} 小时` },
    { label: '技能', value: `技术 ${profile.skills.tech}/3 · 内容 ${profile.skills.content}/3 · 供应链 ${profile.skills.supply}/3 · 运营 ${profile.skills.ops}/3` },
    { label: '英语', value: ['只能中文', '借助工具', '可读可写', '商务流利'][profile.english] || '—' },
    { label: '风险偏好', value: `${profile.risk}/5` },
    { label: '资质合作', value: profile.hasLicensePartner ? '有持牌/资质伙伴' : '无' },
    { label: '严格资金过滤', value: profile.strictCapital ? '开启（按档位 CNY 上限）' : '关闭（沿用分数差）' },
  ]
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(getProfile)

  useEffect(() => {
    const listener = () => setProfile(getProfile())
    listeners.add(listener)
    const onStorage = (e: StorageEvent) => {
      if (e.key === PROFILE_STORAGE_KEY) refreshProfile()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return {
    profile,
    hasProfile: !!profile,
    capability: profile ? profileToCapability(profile) : null,
    save: saveProfile,
    clear: clearProfile,
    preset: applyPreset,
  }
}
