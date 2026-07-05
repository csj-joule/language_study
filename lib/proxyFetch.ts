import { ProxyAgent, fetch as undiciFetch } from 'undici'

// Vercel 등 클라우드/데이터센터 IP에서는 유튜브가 자막 스크래핑 요청을 차단하는 경우가 많다.
// YOUTUBE_PROXY_URL 환경변수(예: http://user:pass@host:port)가 설정되어 있으면
// 해당 프록시를 거쳐 유튜브에 요청을 보내 이 차단을 우회한다.
// 설정되어 있지 않으면 (예: 로컬 개발 환경) 평소처럼 일반 fetch를 사용한다.

let cachedAgent: ProxyAgent | null = null
let cachedProxyUrl: string | null = null

function getDispatcher(): ProxyAgent | null {
  const proxyUrl = process.env.YOUTUBE_PROXY_URL
  if (!proxyUrl) return null
  if (cachedAgent && cachedProxyUrl === proxyUrl) return cachedAgent
  cachedAgent = new ProxyAgent(proxyUrl)
  cachedProxyUrl = proxyUrl
  return cachedAgent
}

export const youtubeFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const dispatcher = getDispatcher()
  if (!dispatcher) {
    return fetch(input as string, init)
  }
  return undiciFetch(input as string, {
    ...(init as Record<string, unknown>),
    dispatcher,
  }) as unknown as Promise<Response>
}) as typeof fetch
