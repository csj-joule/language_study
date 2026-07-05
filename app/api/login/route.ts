import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, MAX_AGE_SECONDS, checkCredentials, createSessionToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const username = body?.username
  const password = body?.password

  if (typeof username !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요' }, { status: 400 })
  }

  if (!checkCredentials(username, password)) {
    return NextResponse.json(
      { error: '아이디 또는 비밀번호가 올바르지 않습니다' },
      { status: 401 }
    )
  }

  const token = await createSessionToken()
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
