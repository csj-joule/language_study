import { NextRequest, NextResponse } from 'next/server'
import { toFuriganaTokens } from '@/lib/furigana'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const texts: unknown = body?.texts

  if (!Array.isArray(texts) || texts.some((t) => typeof t !== 'string')) {
    return NextResponse.json({ error: 'texts: string[] 형식이 필요합니다' }, { status: 400 })
  }

  try {
    const results = await Promise.all((texts as string[]).map((t) => toFuriganaTokens(t)))
    return NextResponse.json({ results })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: '후리가나 생성 중 오류가 발생했습니다' }, { status: 500 })
  }
}
