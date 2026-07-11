import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, verifySessionToken } from '@/lib/auth'

// /api/logout도 공개 경로로 둔다. 세션이 이미 만료/무효한 상태에서 로그아웃을
// 누르면 이 라우트가 아니라 미들웨어가 먼저 가로채 /login으로 리다이렉트하게
// 되는데, 그 리다이렉트도 기본 상태코드(307)라 POST가 그대로 유지되어 같은
// 문제(프로덕션에서 404)로 이어질 수 있다. 로그아웃은 세션 유효 여부와 상관없이
// 항상 쿠키를 지우고 303으로 응답해야 하므로 인증 검사 자체를 건너뛴다.
const PUBLIC_PATHS = ['/login', '/api/login', '/api/logout']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const isValid = await verifySessionToken(token)

  if (!isValid) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
