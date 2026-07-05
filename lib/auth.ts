// 세션 쿠키 서명에 Web Crypto API를 사용한다 (Edge/Node 런타임 양쪽에서 모두 동작).
export const COOKIE_NAME = 'session'
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30일

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

/** 아이디/비밀번호가 환경변수에 설정된 값과 일치하는지 확인 */
export function checkCredentials(username: string, password: string): boolean {
  const validUsername = process.env.ADMIN_USERNAME ?? ''
  const validPassword = process.env.ADMIN_PASSWORD ?? ''
  if (!validUsername || !validPassword) return false
  return (
    timingSafeEqual(username, validUsername) &&
    timingSafeEqual(password, validPassword)
  )
}

/** 로그인 성공 시 발급하는 서명된 세션 토큰 (발급시각.서명) */
export async function createSessionToken(): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD ?? ''
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

  const secret = process.env.ADMIN_PASSWORD ?? ''
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
