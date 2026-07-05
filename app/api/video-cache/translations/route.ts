import { NextRequest, NextResponse } from 'next/server'
import { updateCachedTranslations } from '@/lib/cacheDb'

/**
 * 영상 재생 화면에서 뒤늦게 채워진 번역(자동 번역 채우기)을 서버 캐시에도
 * 반영해서, 다음에 다른 기기에서 같은 영상을 열었을 때도 이미 번역된 상태로
 * 바로 받아볼 수 있도록 한다. DATABASE_URL이 없으면 조용히 아무 일도 하지 않는다.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const youtubeId: unknown = body?.youtubeId
  const updates: unknown = body?.updates

  if (
    typeof youtubeId !== 'string' ||
    !Array.isArray(updates) ||
    updates.some(
      (u) =>
        typeof u !== 'object' ||
        u === null ||
        typeof u.order !== 'number' ||
        typeof u.textKo !== 'string'
    )
  ) {
    return NextResponse.json(
      { error: 'youtubeId: string, updates: {order:number, textKo:string}[] 형식이 필요합니다' },
      { status: 400 }
    )
  }

  try {
    await updateCachedTranslations(
      youtubeId,
      updates as { order: number; textKo: string }[]
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    // 캐시 동기화 실패는 사용자 경험에 치명적이지 않으므로 경고만 남긴다.
    return NextResponse.json({ ok: false, warning: '캐시 동기화에 실패했습니다' })
  }
}
