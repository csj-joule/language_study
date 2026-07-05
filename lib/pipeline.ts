import { v4 as uuidv4 } from 'uuid'
import { db } from './db'
import type { FuriganaToken, Segment, Video } from './types'

export type PipelineStage = 'transcript' | 'saving' | 'done'

export type PipelineProgress = {
  stage: PipelineStage
}

type CachedSegmentResponse = {
  order: number
  startSec: number
  endSec: number
  textJa: string
  textKo: string
  furigana: FuriganaToken[]
}

type VideoCacheResponse = {
  videoId: string
  meta: { title: string; channelTitle: string; thumbnailUrl: string }
  segments: CachedSegmentResponse[]
  cached: boolean
}

async function fetchVideoCache(video: string, force: boolean): Promise<VideoCacheResponse> {
  const params = new URLSearchParams({ video })
  if (force) params.set('force', '1')
  const res = await fetch(`/api/video-cache?${params.toString()}`)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error ?? '자막을 가져오지 못했습니다')
  }
  return data as VideoCacheResponse
}

/**
 * 유튜브 영상을 등록한다. 서버(Neon Postgres)에 이미 캐시된 영상이면 자막/후리가나/
 * 번역을 다시 가져오지 않고 캐시에서 바로 받아오고, 처음 등록하는 영상이면 새로
 * 가져와 서버 캐시에도 저장해서 다음에는(다른 기기에서도) 즉시 재사용할 수 있게 한다.
 */
export async function registerVideoFromUrl(
  url: string,
  onProgress?: (p: PipelineProgress) => void
): Promise<string> {
  onProgress?.({ stage: 'transcript' })

  const { videoId, meta, segments: cachedSegments } = await fetchVideoCache(url, false)

  onProgress?.({ stage: 'saving' })

  const videoRecord: Video = {
    id: uuidv4(),
    youtubeId: videoId,
    title: meta.title,
    channelTitle: meta.channelTitle,
    thumbnailUrl: meta.thumbnailUrl,
    durationSec:
      cachedSegments.length > 0 ? cachedSegments[cachedSegments.length - 1].endSec : 0,
    createdAt: new Date().toISOString(),
  }

  const segmentRecords: Segment[] = cachedSegments.map((s) => ({
    id: uuidv4(),
    videoId: videoRecord.id,
    order: s.order,
    startSec: s.startSec,
    endSec: s.endSec,
    textJa: s.textJa,
    furigana: s.furigana,
    textKo: s.textKo,
  }))

  await db.transaction('rw', db.videos, db.segments, async () => {
    await db.videos.add(videoRecord)
    await db.segments.bulkAdd(segmentRecords)
  })

  onProgress?.({ stage: 'done' })
  return videoRecord.id
}

/**
 * 이미 등록된 영상의 자막을 다시 가져와 최신 구간 분리 로직으로 구간을 재생성한다.
 * 서버 캐시가 오래된(수정 전 로직으로 만들어진) 상태일 수 있으므로 캐시를 무시하고
 * 강제로 새로 가져오며, 새로 가져온 결과로 서버 캐시도 함께 갱신한다.
 * 기존 구간을 전부 지우고 새로 만들기 때문에 구간 ID가 바뀌어, 그 구간을 참조하던
 * 북마크도 함께 삭제한다.
 */
export async function rebuildSegments(
  video: { id: string; youtubeId: string },
  onProgress?: (p: PipelineProgress) => void
): Promise<void> {
  onProgress?.({ stage: 'transcript' })

  const { segments: cachedSegments } = await fetchVideoCache(video.youtubeId, true)

  onProgress?.({ stage: 'saving' })

  const segmentRecords: Segment[] = cachedSegments.map((s) => ({
    id: uuidv4(),
    videoId: video.id,
    order: s.order,
    startSec: s.startSec,
    endSec: s.endSec,
    textJa: s.textJa,
    furigana: s.furigana,
    textKo: s.textKo,
  }))

  await db.transaction('rw', db.segments, db.bookmarks, async () => {
    await db.bookmarks.where('videoId').equals(video.id).delete()
    await db.segments.where('videoId').equals(video.id).delete()
    await db.segments.bulkAdd(segmentRecords)
  })

  onProgress?.({ stage: 'done' })
}
