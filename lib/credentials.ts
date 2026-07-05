// 이 파일은 node:crypto를 쓰는 accountDb.ts를 가져오므로, Node 런타임에서만
// import해야 한다 (Edge 런타임인 middleware.ts는 lib/auth.ts만 가져오고 이 파일은
// 가져오지 않는다 — accountDb.ts는 middleware가 지원하지 않는 node:crypto를 쓴다).
import { isAccountDbEnabled, verifyAdminCredentials } from './accountDb'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/** 아이디/비밀번호가 유효한지 확인한다. DATABASE_URL이 설정되어 있으면 DB의
 * admin_users 테이블로, 아니면 ADMIN_USERNAME/ADMIN_PASSWORD 환경변수로 확인한다. */
export async function checkCredentials(
  username: string,
  password: string
): Promise<boolean> {
  if (isAccountDbEnabled()) {
    return verifyAdminCredentials(username, password)
  }

  const validUsername = process.env.ADMIN_USERNAME ?? ''
  const validPassword = process.env.ADMIN_PASSWORD ?? ''
  if (!validUsername || !validPassword) return false
  return (
    timingSafeEqual(username, validUsername) &&
    timingSafeEqual(password, validPassword)
  )
}
