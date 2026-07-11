import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, MAX_AGE_SECONDS, createSessionToken } from '@/lib/auth'
import { checkCredentials } from '@/lib/credentials'

// accountDb.ts가 password 해싱에 node:crypto의 scrypt를 사용하므로 Node 런타임이 필요하다.
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const username = body?.username
  const password = body?.password

  if (typeof username !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요' }, { status: 400 })
  }

  if (!(await checkCredentials(username, password))) {
    return NextResponse.json(
      { error: '아이디 또는 비밀번호가 올바르지 않습니다' },
      { status: 401 }
    )
  }

  let token: string
  try {
    token = await createSessionToken()
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : '로그인 세션 발급에 실패했습니다'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
  return res
}
