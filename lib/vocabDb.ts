import { neon } from '@neondatabase/serverless'
import type { VocabEntry } from './types'

// 단어장은 여러 기기가 공유해서 봐야 하는 데이터라 (다른 캐시/계정 관리와 동일하게)
// Neon Postgres에 저장한다. DATABASE_URL이 없으면 이 기능 전체가 비활성화되고,
// API 라우트가 명확한 에러/경고를 응답해서 화면에서 안내할 수 있게 한다.

export function isVocabDbEnabled(): boolean {
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
        CREATE TABLE IF NOT EXISTS vocab_entries (
          id TEXT PRIMARY KEY,
          surface TEXT NOT NULL,
          reading TEXT,
          pos TEXT,
          base_form TEXT,
          meaning_ko TEXT,
          youtube_id TEXT,
          video_title TEXT,
          segment_text TEXT,
          segment_start_sec DOUBLE PRECISION,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
    })()
  }
  await schemaReady
}

type VocabRow = {
  id: string
  surface: string
  reading: string | null
  pos: string | null
  base_form: string | null
  meaning_ko: string | null
  youtube_id: string | null
  video_title: string | null
  segment_text: string | null
  segment_start_sec: number | null
  created_at: string
}

function toEntry(r: VocabRow): VocabEntry {
  return {
    id: r.id,
    surface: r.surface,
    reading: r.reading ?? undefined,
    pos: r.pos ?? undefined,
    baseForm: r.base_form ?? undefined,
    meaningKo: r.meaning_ko ?? undefined,
    youtubeId: r.youtube_id ?? undefined,
    videoTitle: r.video_title ?? undefined,
    segmentText: r.segment_text ?? undefined,
    segmentStartSec: r.segment_start_sec ?? undefined,
    createdAt: r.created_at,
  }
}

export async function listVocabEntries(): Promise<VocabEntry[]> {
  const sql = getSql()
  if (!sql) return []
  await ensureSchema()

  const rows = await sql`
    SELECT id, surface, reading, pos, base_form, meaning_ko, youtube_id,
           video_title, segment_text, segment_start_sec, created_at
    FROM vocab_entries
    ORDER BY created_at DESC
  `
  return (rows as VocabRow[]).map(toEntry)
}

export async function addVocabEntry(
  entry: Omit<VocabEntry, 'createdAt'>
): Promise<VocabEntry> {
  const sql = getSql()
  if (!sql) throw new Error('DATABASE_URL이 설정되어 있지 않습니다')
  await ensureSchema()

  const rows = await sql`
    INSERT INTO vocab_entries
      (id, surface, reading, pos, base_form, meaning_ko, youtube_id, video_title, segment_text, segment_start_sec)
    VALUES (
      ${entry.id}, ${entry.surface}, ${entry.reading ?? null}, ${entry.pos ?? null},
      ${entry.baseForm ?? null}, ${entry.meaningKo ?? null}, ${entry.youtubeId ?? null},
      ${entry.videoTitle ?? null}, ${entry.segmentText ?? null}, ${entry.segmentStartSec ?? null}
    )
    RETURNING id, surface, reading, pos, base_form, meaning_ko, youtube_id,
              video_title, segment_text, segment_start_sec, created_at
  `
  return toEntry(rows[0] as VocabRow)
}

export async function deleteVocabEntry(id: string): Promise<void> {
  const sql = getSql()
  if (!sql) throw new Error('DATABASE_URL이 설정되어 있지 않습니다')
  await ensureSchema()
  await sql`DELETE FROM vocab_entries WHERE id = ${id}`
}
