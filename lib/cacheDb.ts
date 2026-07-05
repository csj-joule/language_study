import { neon } from '@neondatabase/serverless'
import type { FuriganaToken } from './types'

// Neon(Postgres)을 여러 기기가 공유하는 서버 캐시로 사용한다.
// DATABASE_URL이 없으면(예: 로컬에서 아직 설정 전) 모든 함수가 조용히 캐시 없음으로
// 동작해서, 이 캐시 계층이 없어도 기존처럼 정상적으로 앱이 동작한다.

export type CachedSegment = {
  order: number
  startSec: number
  endSec: number
  textJa: string
  textKo: string
  furigana: FuriganaToken[]
}

export type CachedVideoMeta = {
  title: string
  channelTitle: string
  thumbnailUrl: string
}

export type CachedVideoSummary = CachedVideoMeta & {
  youtubeId: string
  createdAt: string
  segmentCount: number
}

export function isCacheEnabled(): boolean {
  return !!process.env.DATABASE_URL
}

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) return null
  return neon(url)
}

let schemaReady: Promise<void> | null = null

async function ensureSchema(): Promise<void> {
  const sql = getSql()
  if (!sql) return
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cached_videos (
          youtube_id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          channel_title TEXT NOT NULL,
          thumbnail_url TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      await sql`
        CREATE TABLE IF NOT EXISTS cached_segments (
          id SERIAL PRIMARY KEY,
          youtube_id TEXT NOT NULL REFERENCES cached_videos(youtube_id) ON DELETE CASCADE,
          seg_order INTEGER NOT NULL,
          start_sec DOUBLE PRECISION NOT NULL,
          end_sec DOUBLE PRECISION NOT NULL,
          text_ja TEXT NOT NULL,
          text_ko TEXT NOT NULL DEFAULT '',
          furigana JSONB NOT NULL
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS cached_segments_youtube_id_idx
        ON cached_segments (youtube_id)
      `
    })()
  }
  await schemaReady
}

export async function getCachedVideo(
  youtubeId: string
): Promise<{ meta: CachedVideoMeta; segments: CachedSegment[] } | null> {
  const sql = getSql()
  if (!sql) return null
  await ensureSchema()

  const videos = await sql`
    SELECT title, channel_title, thumbnail_url
    FROM cached_videos WHERE youtube_id = ${youtubeId}
  `
  if (videos.length === 0) return null

  const segments = await sql`
    SELECT seg_order, start_sec, end_sec, text_ja, text_ko, furigana
    FROM cached_segments WHERE youtube_id = ${youtubeId}
    ORDER BY seg_order ASC
  `

  const v = videos[0] as {
    title: string
    channel_title: string
    thumbnail_url: string
  }

  return {
    meta: {
      title: v.title,
      channelTitle: v.channel_title,
      thumbnailUrl: v.thumbnail_url,
    },
    segments: (
      segments as {
        seg_order: number
        start_sec: number
        end_sec: number
        text_ja: string
        text_ko: string
        furigana: FuriganaToken[]
      }[]
    ).map((s) => ({
      order: s.seg_order,
      startSec: Number(s.start_sec),
      endSec: Number(s.end_sec),
      textJa: s.text_ja,
      textKo: s.text_ko,
      furigana: s.furigana,
    })),
  }
}

export async function saveCachedVideo(
  youtubeId: string,
  meta: CachedVideoMeta,
  segments: CachedSegment[]
): Promise<void> {
  const sql = getSql()
  if (!sql) return
  await ensureSchema()

  await sql`
    INSERT INTO cached_videos (youtube_id, title, channel_title, thumbnail_url)
    VALUES (${youtubeId}, ${meta.title}, ${meta.channelTitle}, ${meta.thumbnailUrl})
    ON CONFLICT (youtube_id) DO UPDATE SET
      title = EXCLUDED.title,
      channel_title = EXCLUDED.channel_title,
      thumbnail_url = EXCLUDED.thumbnail_url
  `

  // 재등록/재생성 대응: 기존 구간을 지우고 새로 채운다.
  await sql`DELETE FROM cached_segments WHERE youtube_id = ${youtubeId}`

  if (segments.length === 0) return

  // 구간이 수천 개일 수 있어 한 건씩 INSERT하지 않고, unnest로 한 번에 삽입한다.
  const orders = segments.map((s) => s.order)
  const startSecs = segments.map((s) => s.startSec)
  const endSecs = segments.map((s) => s.endSec)
  const textJas = segments.map((s) => s.textJa)
  const textKos = segments.map((s) => s.textKo)
  const furiganas = segments.map((s) => JSON.stringify(s.furigana))

  await sql`
    INSERT INTO cached_segments
      (youtube_id, seg_order, start_sec, end_sec, text_ja, text_ko, furigana)
    SELECT ${youtubeId}, * FROM unnest(
      ${orders}::int[],
      ${startSecs}::float8[],
      ${endSecs}::float8[],
      ${textJas}::text[],
      ${textKos}::text[],
      ${furiganas}::jsonb[]
    )
  `
}

export async function updateCachedTranslations(
  youtubeId: string,
  updates: { order: number; textKo: string }[]
): Promise<void> {
  const sql = getSql()
  if (!sql || updates.length === 0) return
  await ensureSchema()

  const orders = updates.map((u) => u.order)
  const textKos = updates.map((u) => u.textKo)

  await sql`
    UPDATE cached_segments AS cs
    SET text_ko = data.text_ko
    FROM (
      SELECT * FROM unnest(${orders}::int[], ${textKos}::text[]) AS t(seg_order, text_ko)
    ) AS data(seg_order, text_ko)
    WHERE cs.youtube_id = ${youtubeId} AND cs.seg_order = data.seg_order
  `
}

export async function listCachedVideos(): Promise<CachedVideoSummary[]> {
  const sql = getSql()
  if (!sql) return []
  await ensureSchema()

  const rows = await sql`
    SELECT v.youtube_id, v.title, v.channel_title, v.thumbnail_url, v.created_at,
           COUNT(s.id)::int AS segment_count
    FROM cached_videos v
    LEFT JOIN cached_segments s ON s.youtube_id = v.youtube_id
    GROUP BY v.youtube_id, v.title, v.channel_title, v.thumbnail_url, v.created_at
    ORDER BY v.created_at DESC
  `

  return (
    rows as {
      youtube_id: string
      title: string
      channel_title: string
      thumbnail_url: string
      created_at: string
      segment_count: number
    }[]
  ).map((r) => ({
    youtubeId: r.youtube_id,
    title: r.title,
    channelTitle: r.channel_title,
    thumbnailUrl: r.thumbnail_url,
    createdAt: r.created_at,
    segmentCount: r.segment_count,
  }))
}

export async function deleteCachedVideo(youtubeId: string): Promise<void> {
  const sql = getSql()
  if (!sql) return
  await ensureSchema()
  // cached_segments는 ON DELETE CASCADE로 함께 삭제된다.
  await sql`DELETE FROM cached_videos WHERE youtube_id = ${youtubeId}`
}
