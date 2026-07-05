import { NextRequest, NextResponse } from 'next/server'
import { buildSegments, extractYoutubeId, fetchVideoMeta } from '@/lib/youtube'
import { fetchTranscriptViaSupadata } from '@/lib/supadata'
import { toFuriganaTokens } from '@/lib/furigana'
import { hasTranslationApiKey, translateToKorean } from '@/lib/translate'
import {
  deleteCachedVideo,
  getCachedVideo,
  listCachedVideos,
  saveCachedVideo,
  type CachedSegment,
} from '@/lib/cacheDb'

// 자막이 매우 긴 영상(수천 구간)까지 한 번에 처리할 수 있도록 타임아웃을 넉넉히 잡는다.
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const videoParam = req.nextUrl.searchParams.get('video')
  const force = req.nextUrl.searchParams.get('force') === '1'

  // video 파라미터 없이 호출하면 서버에 캐시된 전체 영상 목록을 반환한다 (히스토리 관리 화면용).
  if (!videoParam) {
    const videos = await listCachedVideos()
    return NextResponse.json({ videos })
  }

  const videoId = extractYoutubeId(videoParam)
  if (!videoId) {
    return NextResponse.json({ error: '유효한 유튜브 URL/ID가 아닙니다' }, { status: 400 })
  }

  try {
    if (!force) {
      const cached = await getCachedVideo(videoId)
      if (cached) {
        return NextResponse.json({
          videoId,
          meta: cached.meta,
          segments: cached.segments,
          cached: true,
        })
      }
    }

    const [meta, cues] = await Promise.all([
      fetchVideoMeta(videoId),
      fetchTranscriptViaSupadata(videoId, 'ja'),
    ])

    const rawSegments = buildSegments(cues)
    if (rawSegments.length === 0) {
      return NextResponse.json(
        { error: '자막에서 문장을 추출하지 못했습니다.' },
        { status: 422 }
      )
    }

    const texts = rawSegments.map((s) => s.textJa)

    const [furiganaResults, translations] = await Promise.all([
      Promise.all(texts.map((t) => toFuriganaTokens(t))),
      hasTranslationApiKey()
        ? translateToKorean(texts)
        : Promise.resolve(texts.map(() => '')),
    ])

    const segments: CachedSegment[] = rawSegments.map((s, i) => ({
      order: i,
      startSec: s.startSec,
      endSec: s.endSec,
      textJa: s.textJa,
      textKo: translations[i] ?? '',
      furigana: furiganaResults[i] ?? [{ surface: s.textJa }],
    }))

    await saveCachedVideo(videoId, meta, segments)

    return NextResponse.json({ videoId, meta, segments, cached: false })
  } catch (err) {
    console.error(err)
    const message =
      err instanceof Error ? err.message : '자막을 가져오는 중 오류가 발생했습니다.'
    return NextResponse.json(
      { error: `일본어 자막을 가져오지 못했습니다: ${message}` },
      { status: 502 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('video')
  if (!videoId) {
    return NextResponse.json({ error: 'video 파라미터가 필요합니다' }, { status: 400 })
  }
  await deleteCachedVideo(videoId)
  return NextResponse.json({ ok: true })
}
