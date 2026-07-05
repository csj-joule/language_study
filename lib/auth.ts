// middleware.ts(Edge 런타임)가 이 파일을 가져오므로, node:crypto 등 Node 전용 모듈을
// 쓰는 코드(accountDb.ts, credentials.ts)는 절대 여기서 import하지 않는다.
// Web Crypto API(crypto.subtle)는 Edge/Node 양쪽에서 모두 동작한다.

export const COOKIE_NAME = 'session'
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30일

function getSigningSecret(): string {
  // 계정 비밀번호는 DB에서 여러 개로 관리될 수 있으므로, 세션 서명 비밀키는
  // 별도의 SESSION_SECRET을 사용한다. 설정 전 호환을 위해 ADMIN_PASSWORD로 폴백한다.
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || ''
}

async function getKey(secret: string) {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/** 로그인 성공 시 발급하는 서명된 세션 토큰 (발급시각.서명) */
export async function createSessionToken(): Promise<string> {
  const secret = getSigningSecret()
  const issuedAt = Date.now().toString()
  const key = await getKey(secret)
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(issuedAt))
  return `${issuedAt}.${toHex(sigBuf)}`
}

/** 세션 토큰의 서명과 만료 여부를 검증 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false
  const [issuedAt, signature] = token.split('.')
  if (!issuedAt || !signature) return false

  const secret = getSigningSecret()
  if (!secret) return false

  const key = await getKey(secret)
  const expectedBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(issuedAt)
  )
  const expectedHex = toHex(expectedBuf)
  if (!timingSafeEqual(expectedHex, signature)) return false

  const issuedMs = Number(issuedAt)
  if (Number.isNaN(issuedMs)) return false
  if (Date.now() - issuedMs > MAX_AGE_SECONDS * 1000) return false

  return true
}
