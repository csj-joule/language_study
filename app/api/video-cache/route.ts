import { NextRequest, NextResponse } from 'next/server'
import { buildSegments, extractYoutubeId, fetchVideoMeta } from '@/lib/youtube'
import { fetchTranscriptViaSupadata } from '@/lib/supadata'
import { toFuriganaTokens } from '@/lib/furigana'
import {
  deleteCachedVideo,
  getCachedVideo,
  listCachedVideos,
  saveCachedVideo,
  type CachedSegment,
} from '@/lib/cacheDb'

// Vercel Hobby 플랜은 maxDuration을 아무리 크게 잡아도 실제로는 60초에서
// 함수가 강제 종료된다. 자막이 긴 영상(수백~수천 구간)은 문장별 번역(Papago)
// 호출만으로 이 시간을 넘기기 쉬워서, 여기서는 번역을 절대 기다리지 않고
// 자막/후리가나까지만 처리해 즉시 반환한다. 번역은 학습 화면 진입 후
// 클라이언트가 이미 갖고 있는 "빈 번역 자동 채우기" 로직이 40개씩 나눠서
// 처리하며 서버 캐시에도 점진적으로 채워 넣는다.
export const maxDuration = 60

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

    // 번역(Papago)은 문장 수만큼 네트워크 호출이 필요해 영상이 길면 시간이 오래
    // 걸린다. 여기서는 로컬 연산인 후리가나만 기다리고, 번역은 비워둔 채 반환해서
    // 등록 자체가 서버리스 함수 시간 제한에 걸리지 않게 한다.
    const furiganaResults = await Promise.all(texts.map((t) => toFuriganaTokens(t)))

    const segments: CachedSegment[] = rawSegments.map((s, i) => ({
      order: i,
      startSec: s.startSec,
      endSec: s.endSec,
      textJa: s.textJa,
      textKo: '',
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
