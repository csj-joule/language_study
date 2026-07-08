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
    const [tokens, translation] = await Promise.all([
      analyzeTokens(text),
      translateToKorean([text]).then((r) => r[0] ?? ''),
    ])

    // 단어 설명(읽기/품사/한국어 번역)에 쓸 단어별 번역도 함께 가져온다.
    // 사전형이 있으면 사전형(기본형) 기준으로 번역해야 뜻이 더 정확하다.
    const wordMeanings = await translateToKorean(
      tokens.map((t) => t.baseForm ?? t.surface)
    )
    const tokensWithMeaning = tokens.map((t, i) => ({
      ...t,
      meaningKo: wordMeanings[i] || undefined,
    }))

    return NextResponse.json({ tokens: tokensWithMeaning, translation })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: '분석 중 오류가 발생했습니다' }, { status: 500 })
  }
}
