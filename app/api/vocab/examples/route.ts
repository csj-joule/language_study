import { NextRequest, NextResponse } from 'next/server'
import { generateExampleSentences, hasGeminiApiKey } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  if (!hasGeminiApiKey()) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY가 설정되어 있지 않아 예문을 생성할 수 없습니다' },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => null)
  const surface = body?.surface
  if (typeof surface !== 'string' || !surface.trim()) {
    return NextResponse.json({ error: 'surface가 필요합니다' }, { status: 400 })
  }

  try {
    const examples = await generateExampleSentences({
      surface,
      reading: typeof body?.reading === 'string' ? body.reading : undefined,
      meaningKo: typeof body?.meaningKo === 'string' ? body.meaningKo : undefined,
    })
    return NextResponse.json({ examples })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : '예문 생성에 실패했습니다'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
