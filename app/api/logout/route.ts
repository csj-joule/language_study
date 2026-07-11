import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // NextResponse.redirect()의 기본 상태코드(307)는 메서드를 그대로 유지해서,
  // 브라우저가 /login에 GET이 아니라 POST로 다시 요청하게 된다. Next dev
  // 서버는 이를 너그럽게 페이지로 렌더링해주지만, Vercel 프로덕션에서는 페이지
  // 라우트가 POST를 받지 않아 404로 이어진다. 303으로 명시해 항상 GET으로
  // 이어지는 표준 POST-리다이렉트-GET 방식으로 고정한다.
  const res = NextResponse.redirect(new URL('/login', req.url), 303)
  res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return res
}
