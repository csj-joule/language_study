export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.slice(1)
      return id.length === 11 ? id : null
    }
    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v')
      if (v) return v
      const shortsMatch = url.pathname.match(/\/shorts\/([\w-]{11})/)
      if (shortsMatch) return shortsMatch[1]
      const embedMatch = url.pathname.match(/\/embed\/([\w-]{11})/)
      if (embedMatch) return embedMatch[1]
    }
  } catch {
    return null
  }
  return null
}

export type VideoMeta = {
  title: string
  channelTitle: string
  thumbnailUrl: string
}

export async function fetchVideoMeta(videoId: string): Promise<VideoMeta> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`
  const res = await fetch(oembedUrl)
  if (!res.ok) throw new Error('영상 정보를 가져오지 못했습니다')
  const data = await res.json()
  return {
    title: data.title,
    channelTitle: data.author_name,
    thumbnailUrl: data.thumbnail_url,
  }
}

export type TranscriptCue = {
  text: string
  offsetSec: number
  durationSec: number
}

export type RawSegment = {
  textJa: string
  startSec: number
  endSec: number
}

const SENTENCE_END = /[。！？…]/
const SECONDARY_SPLIT = /[、,]/g

// 문장부호가 드물어 한 문장이 지나치게 길어질 때 적용할 기준
const MAX_SEGMENT_CHARS = 45
const MAX_SEGMENT_SEC = 12

const MAX_SPLIT_DEPTH = 8

/**
 * 문장 하나가 너무 길면(글자 수 또는 재생 시간 초과) 중간에 가까운 쉼표를 찾아 나눈다.
 * 적당한 쉼표가 없으면 글자 수 중간 지점에서 나눈다. 나눈 조각이 여전히 기준을
 * 넘으면 (자동 자막은 문장부호가 거의 없어 한 덩어리가 1000자를 넘기도 함) 기준
 * 이하가 될 때까지 재귀적으로 계속 나눈다. 정확한 단어 단위 타임스탬프는 없으므로,
 * 분할 지점의 시간은 원래 구간의 시작~끝 시간을 글자 위치 비율로 선형 보간해 추정한다.
 */
function splitIfTooLong(seg: RawSegment, depth = 0): RawSegment[] {
  const isTooLong =
    seg.textJa.length > MAX_SEGMENT_CHARS ||
    seg.endSec - seg.startSec > MAX_SEGMENT_SEC

  if (!isTooLong || seg.textJa.length < 2 || depth >= MAX_SPLIT_DEPTH) return [seg]

  const mid = Math.floor(seg.textJa.length / 2)
  let commaIndex = -1
  let bestDistance = Infinity
  let match: RegExpExecArray | null
  SECONDARY_SPLIT.lastIndex = 0
  while ((match = SECONDARY_SPLIT.exec(seg.textJa)) !== null) {
    const distance = Math.abs(match.index - mid)
    if (distance < bestDistance) {
      bestDistance = distance
      commaIndex = match.index + 1
    }
  }

  // 쉼표 위치를 우선 시도하고, 그 위치가 문장 끝/시작에 너무 가까워 조각이 비면
  // 글자 수 중간 지점으로 대체한다.
  const candidates = commaIndex === -1 ? [mid] : [commaIndex, mid]
  let splitIndex: number | null = null
  for (const candidate of candidates) {
    if (candidate > 0 && candidate < seg.textJa.length) {
      splitIndex = candidate
      break
    }
  }
  if (splitIndex === null) return [seg]

  const firstText = seg.textJa.slice(0, splitIndex).trim()
  const secondText = seg.textJa.slice(splitIndex).trim()
  if (!firstText || !secondText) return [seg]

  const ratio = splitIndex / seg.textJa.length
  const splitTime = seg.startSec + (seg.endSec - seg.startSec) * ratio

  const first: RawSegment = { textJa: firstText, startSec: seg.startSec, endSec: splitTime }
  const second: RawSegment = { textJa: secondText, startSec: splitTime, endSec: seg.endSec }

  // 나눈 조각도 여전히 기준을 넘으면 계속 재귀적으로 나눈다
  return [...splitIfTooLong(first, depth + 1), ...splitIfTooLong(second, depth + 1)]
}

/**
 * 자막 큐를 문장 단위 구간으로 병합한다.
 * 구두점이 전혀 없는 자동 생성 자막의 경우 큐 단위를 그대로 구간으로 사용한다.
 */
export function buildSegments(cues: TranscriptCue[]): RawSegment[] {
  if (cues.length === 0) return []

  const hasPunctuation = cues.some((c) => SENTENCE_END.test(c.text))
  if (!hasPunctuation) {
    return cues
      .map((c) => ({
        textJa: c.text.trim(),
        startSec: c.offsetSec,
        endSec: c.offsetSec + c.durationSec,
      }))
      .filter((s) => s.textJa.length > 0)
      .flatMap((s) => splitIfTooLong(s))
  }

  // 유튜브 자동 자막은 한 큐 안에 "문장 끝 + 다음 문장 시작"이 함께 들어있는 경우가 많아
  // 큐 단위가 아니라 문자 단위로 문장부호 위치를 찾아 정확히 그 지점에서 구간을 나눈다.
  const segments: RawSegment[] = []
  let buffer = ''
  let bufferStart: number | null = null
  let bufferEnd = 0

  for (const cue of cues) {
    if (bufferStart === null) bufferStart = cue.offsetSec
    bufferEnd = cue.offsetSec + cue.durationSec

    let rest = cue.text
    while (true) {
      const match = rest.match(SENTENCE_END)
      if (!match || match.index === undefined) {
        buffer += rest
        break
      }
      const cutIndex = match.index + 1
      buffer += rest.slice(0, cutIndex)
      const text = buffer.trim()
      if (text.length > 0 && bufferStart !== null) {
        segments.push({ textJa: text, startSec: bufferStart, endSec: bufferEnd })
      }
      buffer = ''
      rest = rest.slice(cutIndex)
      bufferStart = rest.length > 0 ? cue.offsetSec : null
    }
  }

  if (buffer.trim().length > 0 && bufferStart !== null) {
    segments.push({ textJa: buffer.trim(), startSec: bufferStart, endSec: bufferEnd })
  }

  return segments.flatMap((s) => splitIfTooLong(s))
}
