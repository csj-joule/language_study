import { NextRequest, NextResponse } from 'next/server'
import { hasTranslationApiKey, translateToKorean } from '@/lib/translate'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const texts: unknown = body?.texts

  if (!Array.isArray(texts) || texts.some((t) => typeof t !== 'string')) {
    return NextResponse.json({ error: 'texts: string[] 형식이 필요합니다' }, { status: 400 })
  }

  if (!hasTranslationApiKey()) {
    return NextResponse.json({
      translations: (texts as string[]).map(() => ''),
      warning: 'NAVER_CLIENT_ID/NAVER_CLIENT_SECRET이 설정되어 있지 않아 번역을 건너뛰었습니다.',
    })
  }

  const translations = await translateToKorean(texts as string[])
  return NextResponse.json({ translations })
}
