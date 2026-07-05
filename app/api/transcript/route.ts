import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'
import { buildSegments, extractYoutubeId, fetchVideoMeta } from '@/lib/youtube'

export async function GET(req: NextRequest) {
  const videoParam = req.nextUrl.searchParams.get('video')
  if (!videoParam) {
    return NextResponse.json({ error: 'video 파라미터가 필요합니다' }, { status: 400 })
  }

  const videoId = extractYoutubeId(videoParam)
  if (!videoId) {
    return NextResponse.json({ error: '유효한 유튜브 URL/ID가 아닙니다' }, { status: 400 })
  }

  try {
    const [meta, transcript] = await Promise.all([
      fetchVideoMeta(videoId),
      YoutubeTranscript.fetchTranscript(videoId, { lang: 'ja' }),
    ])

    const cues = transcript.map((t) => ({
      text: t.text,
      offsetSec: t.offset / 1000,
      durationSec: t.duration / 1000,
    }))

    const segments = buildSegments(cues)

    if (segments.length === 0) {
      return NextResponse.json(
        { error: '자막에서 문장을 추출하지 못했습니다.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ videoId, meta, segments })
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
