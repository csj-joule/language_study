import { NextRequest, NextResponse } from 'next/server'
import { analyzeTokens } from '@/lib/furigana'
import { translateToKorean } from '@/lib/translate'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const text: unknown = body?.text

  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text가 필요합니다' }, { status: 400 })
  }

  try {
    const [tokens, translations] = await Promise.all([
      analyzeTokens(text),
      translateToKorean([text]),
    ])
    return NextResponse.json({ tokens, translation: translations[0] ?? '' })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: '분석 중 오류가 발생했습니다' }, { status: 500 })
  }
}
