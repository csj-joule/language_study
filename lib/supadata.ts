export type SupadataCue = {
  text: string
  offsetSec: number
  durationSec: number
}

type SupadataChunk = {
  text: string
  offset: number
  duration: number
  lang?: string
}

type SupadataResponse = {
  content?: SupadataChunk[]
  lang?: string
  availableLangs?: string[]
  error?: string
  message?: string
  details?: string
}

export function hasSupadataApiKey(): boolean {
  return !!process.env.SUPADATA_API_KEY
}

/**
 * Supadata(https://supadata.ai) 자막 전용 API로 유튜브 자막을 가져온다.
 * youtube-transcript 라이브러리가 유튜브 페이지를 직접 스크래핑하는 방식이라
 * Vercel 같은 클라우드 IP에서 유튜브에 차단되는 문제가 있어, 이를 대체한다.
 */
export async function fetchTranscriptViaSupadata(
  videoId: string,
  lang: string
): Promise<SupadataCue[]> {
  const apiKey = process.env.SUPADATA_API_KEY
  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY가 설정되어 있지 않습니다')
  }

  const url = new URL('https://api.supadata.ai/v1/youtube/transcript')
  url.searchParams.set('videoId', videoId)
  url.searchParams.set('lang', lang)

  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey },
  })

  const data = (await res.json().catch(() => null)) as SupadataResponse | null

  if (res.status === 206 || data?.error) {
    throw new Error(data?.message ?? '이 영상에서 자막을 찾을 수 없습니다')
  }

  if (!res.ok) {
    throw new Error(data?.message ?? `자막 API 오류가 발생했습니다 (status ${res.status})`)
  }

  if (!data || !Array.isArray(data.content)) {
    throw new Error('자막 응답 형식이 올바르지 않습니다')
  }

  return data.content.map((c) => ({
    text: c.text,
    offsetSec: c.offset / 1000,
    durationSec: c.duration / 1000,
  }))
}
