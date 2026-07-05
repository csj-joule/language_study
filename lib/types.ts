export type Video = {
  id: string
  youtubeId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  durationSec: number
  createdAt: string
}

export type FuriganaToken = {
  surface: string
  reading?: string
}

export type Segment = {
  id: string
  videoId: string
  order: number
  startSec: number
  endSec: number
  textJa: string
  furigana: FuriganaToken[]
  textKo: string
}

export type Bookmark = {
  id: string
  videoId: string
  segmentId: string
  memo?: string
  createdAt: string
}

export type Settings = {
  id: string
  defaultPlaybackRate: number
  showFurigana: boolean
  blindJa: boolean
  blindKo: boolean
}
