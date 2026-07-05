import { v4 as uuidv4 } from 'uuid'
import { db } from './db'
import type { FuriganaToken, Segment, Video } from './types'

export type PipelineStage = 'transcript' | 'furigana' | 'translate' | 'saving' | 'done'

export type PipelineProgress = {
  stage: PipelineStage
  current?: number
  total?: number
}

type RawSegment = { textJa: string; startSec: number; endSec: number }
type TranscriptResponse = {
  videoId: string
  meta: { title: string; channelTitle: string; thumbnailUrl: string }
  segments: RawSegment[]
}

const CHUNK_SIZE = 40

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `요청 실패: ${url}`)
  return data as T
}

export async function registerVideoFromUrl(
  url: string,
  onProgress?: (p: PipelineProgress) => void
): Promise<string> {
  onProgress?.({ stage: 'transcript' })

  const transcriptRes = await fetch(`/api/transcript?video=${encodeURIComponent(url)}`)
  const transcriptData = await transcriptRes.json()
  if (!transcriptRes.ok) {
    throw new Error(transcriptData.error ?? '자막을 가져오지 못했습니다')
  }
  const { videoId, meta, segments: rawSegments } = transcriptData as TranscriptResponse

  const texts = rawSegments.map((s) => s.textJa)

  const furiganaChunks = chunk(texts, CHUNK_SIZE)
  const furiganaResults: FuriganaToken[][] = []
  for (let i = 0; i < furiganaChunks.length; i++) {
    onProgress?.({ stage: 'furigana', current: i + 1, total: furiganaChunks.length })
    const data = await postJson<{ results: FuriganaToken[][] }>('/api/furigana', {
      texts: furiganaChunks[i],
    })
    furiganaResults.push(...data.results)
  }

  const translateChunks = chunk(texts, CHUNK_SIZE)
  const translations: string[] = []
  for (let i = 0; i < translateChunks.length; i++) {
    onProgress?.({ stage: 'translate', current: i + 1, total: translateChunks.length })
    const data = await postJson<{ translations: string[] }>('/api/translate', {
      texts: translateChunks[i],
    })
    translations.push(...data.translations)
  }

  onProgress?.({ stage: 'saving' })

  const videoRecord: Video = {
    id: uuidv4(),
    youtubeId: videoId,
    title: meta.title,
    channelTitle: meta.channelTitle,
    thumbnailUrl: meta.thumbnailUrl,
    durationSec: rawSegments.length > 0 ? rawSegments[rawSegments.length - 1].endSec : 0,
    createdAt: new Date().toISOString(),
  }

  const segmentRecords: Segment[] = rawSegments.map((s, i) => ({
    id: uuidv4(),
    videoId: videoRecord.id,
    order: i,
    startSec: s.startSec,
    endSec: s.endSec,
    textJa: s.textJa,
    furigana: furiganaResults[i] ?? [{ surface: s.textJa }],
    textKo: translations[i] ?? '',
  }))

  await db.transaction('rw', db.videos, db.segments, async () => {
    await db.videos.add(videoRecord)
    await db.segments.bulkAdd(segmentRecords)
  })

  onProgress?.({ stage: 'done' })
  return videoRecord.id
}

/**
 * 이미 등록된 영상의 자막을 다시 가져와 최신 구간 분리 로직(긴 문장 최대 2개 분할 등)으로
 * 구간을 재생성한다. 기존 구간을 전부 지우고 새로 만들기 때문에 구간 ID가 바뀌어,
 * 그 구간을 참조하던 북마크도 함께 삭제한다. 번역은 다시 비워두고 화면의 자동 번역
 * 채우기 기능이 새 구간에 대해 다시 채우도록 한다.
 */
export async function rebuildSegments(
  video: { id: string; youtubeId: string },
  onProgress?: (p: PipelineProgress) => void
): Promise<void> {
  onProgress?.({ stage: 'transcript' })

  const transcriptRes = await fetch(
    `/api/transcript?video=${encodeURIComponent(video.youtubeId)}`
  )
  const transcriptData = await transcriptRes.json()
  if (!transcriptRes.ok) {
    throw new Error(transcriptData.error ?? '자막을 가져오지 못했습니다')
  }
  const { segments: rawSegments } = transcriptData as TranscriptResponse

  const texts = rawSegments.map((s) => s.textJa)

  const furiganaChunks = chunk(texts, CHUNK_SIZE)
  const furiganaResults: FuriganaToken[][] = []
  for (let i = 0; i < furiganaChunks.length; i++) {
    onProgress?.({ stage: 'furigana', current: i + 1, total: furiganaChunks.length })
    const data = await postJson<{ results: FuriganaToken[][] }>('/api/furigana', {
      texts: furiganaChunks[i],
    })
    furiganaResults.push(...data.results)
  }

  onProgress?.({ stage: 'saving' })

  const segmentRecords: Segment[] = rawSegments.map((s, i) => ({
    id: uuidv4(),
    videoId: video.id,
    order: i,
    startSec: s.startSec,
    endSec: s.endSec,
    textJa: s.textJa,
    furigana: furiganaResults[i] ?? [{ surface: s.textJa }],
    textKo: '',
  }))

  await db.transaction('rw', db.segments, db.bookmarks, async () => {
    await db.bookmarks.where('videoId').equals(video.id).delete()
    await db.segments.where('videoId').equals(video.id).delete()
    await db.segments.bulkAdd(segmentRecords)
  })

  onProgress?.({ stage: 'done' })
}
