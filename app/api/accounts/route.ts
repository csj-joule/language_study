import { NextRequest, NextResponse } from 'next/server'
import {
  createAdminUser,
  deleteAdminUser,
  isAccountDbEnabled,
  listAdminUsers,
} from '@/lib/accountDb'

// node:crypto의 scrypt로 비밀번호를 해싱하므로 Node 런타임이 필요하다.
export const runtime = 'nodejs'

export async function GET() {
  if (!isAccountDbEnabled()) {
    return NextResponse.json({
      accounts: [],
      warning:
        'DATABASE_URL이 설정되어 있지 않아 계정을 DB로 관리할 수 없습니다. 환경변수(ADMIN_USERNAME/ADMIN_PASSWORD)로 동작 중입니다.',
    })
  }
  const accounts = await listAdminUsers()
  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  if (!isAccountDbEnabled()) {
    return NextResponse.json(
      { error: 'DATABASE_URL이 설정되어 있지 않아 계정을 추가할 수 없습니다' },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => null)
  const username = body?.username
  const password = body?.password

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.trim().length === 0 ||
    password.length < 4
  ) {
    return NextResponse.json(
      { error: '아이디와 4자 이상의 비밀번호를 입력해주세요' },
      { status: 400 }
    )
  }

  try {
    await createAdminUser(username.trim(), password)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '계정 추가에 실패했습니다'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAccountDbEnabled()) {
    return NextResponse.json(
      { error: 'DATABASE_URL이 설정되어 있지 않아 계정을 삭제할 수 없습니다' },
      { status: 400 }
    )
  }

  const idParam = req.nextUrl.searchParams.get('id')
  const id = idParam ? Number(idParam) : NaN
  if (!idParam || Number.isNaN(id)) {
    return NextResponse.json({ error: 'id 파라미터가 필요합니다' }, { status: 400 })
  }

  try {
    await deleteAdminUser(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '계정 삭제에 실패했습니다'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
