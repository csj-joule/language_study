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

// 단어장 항목. 문장 분석 화면에서 선택한 문구 전체(pos 없음) 또는 단어별
// 분해 결과(pos 있음) 둘 다 이 타입 하나로 저장한다. 여러 기기가 공유하는
// 서버(Neon Postgres)에 저장되므로, 기기별로 다르게 생성되는 로컬 videoId/
// segmentId 대신 유튜브 영상 ID와 문장 내용을 그대로 함께 저장해둔다.
export type VocabEntry = {
  id: string
  surface: string
  reading?: string
  pos?: string
  baseForm?: string
  meaningKo?: string
  youtubeId?: string
  videoTitle?: string
  segmentText?: string
  segmentStartSec?: number
  completed?: boolean
  createdAt: string
}

export type Settings = {
  id: string
  defaultPlaybackRate: number
  showFurigana: boolean
  blindJa: boolean
  blindKo: boolean
}
