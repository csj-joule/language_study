const MODEL = 'gemini-2.5-flash-lite'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export type ExampleSentence = {
  ja: string
  ko: string
}

export function hasGeminiApiKey(): boolean {
  return !!process.env.GEMINI_API_KEY
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 무료 티어 모델(gemini-2.5-flash-lite)은 수요가 몰리면 503(UNAVAILABLE)을
 * 자주 반환한다. 일시적인 과부하일 뿐이라 짧게 대기 후 재시도한다.
 */
export async function generateExampleSentences(word: {
  surface: string
  reading?: string
  meaningKo?: string
}): Promise<ExampleSentence[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되어 있지 않습니다')
  }

  const wordDesc = [
    word.surface,
    word.reading && `읽기: ${word.reading}`,
    word.meaningKo && `뜻: ${word.meaningKo}`,
  ]
    .filter(Boolean)
    .join(', ')

  const prompt = `일본어 단어 "${wordDesc}"를 사용해서, 실제 일상 회화에서 자주 쓰이는 자연스러운 예문 3개를 만들어줘. 각 예문은 서로 다른 상황/뉘앙스를 보여주고, 일본어 원문과 자연스러운 한국어 번역을 함께 제공해.`

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            ja: { type: 'STRING' },
            ko: { type: 'STRING' },
          },
          required: ['ja', 'ko'],
        },
        minItems: 3,
        maxItems: 3,
      },
    },
  }

  const MAX_ATTEMPTS = 4
  let lastError = ''

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.status === 503 || res.status === 429) {
      const data = await res.json().catch(() => null)
      lastError = data?.error?.message ?? `모델이 일시적으로 응답하지 않습니다 (status ${res.status})`
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1500 * attempt)
        continue
      }
      throw new Error(lastError)
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error?.message ?? `예문 생성 API 오류 (status ${res.status})`)
    }

    const data = await res.json()
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error('예문 생성 응답이 비어 있습니다')
    }

    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) {
      throw new Error('예문 생성 응답 형식이 올바르지 않습니다')
    }
    return parsed
      .filter((e) => typeof e?.ja === 'string' && typeof e?.ko === 'string')
      .slice(0, 3)
  }

  throw new Error(lastError || '예문 생성에 실패했습니다')
}
