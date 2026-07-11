import Dexie, { type EntityTable } from 'dexie'
import type { Bookmark, Segment, Settings, Video } from './types'

class ShadowingDB extends Dexie {
  videos!: EntityTable<Video, 'id'>
  segments!: EntityTable<Segment, 'id'>
  bookmarks!: EntityTable<Bookmark, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('shadowing-db')
    this.version(1).stores({
      videos: 'id, youtubeId, createdAt',
      segments: 'id, videoId, order',
      bookmarks: 'id, videoId, segmentId, createdAt',
      settings: 'id',
    })
  }
}

export const db = new ShadowingDB()

export const DEFAULT_SETTINGS: Settings = {
  id: 'default',
  defaultPlaybackRate: 1,
  showFurigana: true,
  blindJa: false,
  blindKo: false,
}

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get('default')
  if (existing) return existing
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}
