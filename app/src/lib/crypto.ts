/**
 * v0.5.1 个人数据包可选口令加密。
 * PBKDF2-SHA256(210000) + AES-GCM-256；随机 16B salt / 12B iv。
 * 口令仅用于本次内存计算，不落盘、不上传；忘记口令无法恢复。
 */
export const ENCRYPTED_SCHEMA_VERSION = '0.5.1'
export const PBKDF2_ITERATIONS = 210_000
export const SALT_BYTES = 16
export const IV_BYTES = 12

export interface EncryptedEnvelope {
  schema_version: string
  encrypted: true
  algo: 'AES-GCM'
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt_b64: string
  iv_b64: string
  ciphertext_b64: string
  exported_at: string
}

const enc = new TextEncoder()
const dec = new TextDecoder()

function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

function requireCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前浏览器不支持 Web Crypto（需要 secure context），无法加密/解密数据包')
  }
  return globalThis.crypto
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const crypto = requireCrypto()
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptDataBundleJson(json: string, password: string): Promise<EncryptedEnvelope> {
  if (password.length < 8) throw new Error('口令至少 8 个字符')
  const crypto = requireCrypto()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(json))
  return {
    schema_version: ENCRYPTED_SCHEMA_VERSION,
    encrypted: true,
    algo: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt_b64: bytesToB64(salt),
    iv_b64: bytesToB64(iv),
    ciphertext_b64: bytesToB64(new Uint8Array(ciphertext)),
    exported_at: new Date().toISOString(),
  }
}

export function isEncryptedEnvelope(raw: unknown): raw is Record<string, unknown> {
  return !!raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as Record<string, unknown>).encrypted === true
}

export async function decryptDataBundleJson(envelope: Record<string, unknown>, password: string): Promise<string> {
  if (envelope.schema_version !== ENCRYPTED_SCHEMA_VERSION) {
    throw new Error(`加密数据包版本不兼容（需要 ${ENCRYPTED_SCHEMA_VERSION}，实际 ${String(envelope.schema_version || '缺失')}）`)
  }
  if (envelope.algo !== 'AES-GCM' || envelope.kdf !== 'PBKDF2-SHA256') {
    throw new Error('不支持的加密算法 / KDF')
  }
  if (Number(envelope.iterations) !== PBKDF2_ITERATIONS) {
    throw new Error(`PBKDF2 iterations 不匹配（需要 ${PBKDF2_ITERATIONS}）`)
  }
  if (typeof envelope.salt_b64 !== 'string' || typeof envelope.iv_b64 !== 'string' || typeof envelope.ciphertext_b64 !== 'string') {
    throw new Error('加密数据包字段缺失或损坏')
  }
  if (password.length < 8) throw new Error('口令至少 8 个字符')
  try {
    const salt = b64ToBytes(envelope.salt_b64)
    const iv = b64ToBytes(envelope.iv_b64)
    const ciphertext = b64ToBytes(envelope.ciphertext_b64)
    if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || !ciphertext.length) throw new Error('加密数据包字段长度异常')
    const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
    const plain = await requireCrypto().subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return dec.decode(plain)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('字段') || message.includes('长度')) throw e
    throw new Error('口令错误或密文损坏，无法解密')
  }
}

export function encryptedEnvelopeJson(envelope: EncryptedEnvelope): string {
  return JSON.stringify(envelope, null, 2)
}
