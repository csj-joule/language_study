const PAPAGO_ENDPOINT = "https://papago.apigw.ntruss.com/nmt/v1/translation";
const CONCURRENCY = 5;

export function hasTranslationApiKey(): boolean {
  return !!process.env.NAVER_CLIENT_ID && !!process.env.NAVER_CLIENT_SECRET;
}

async function translateOne(text: string): Promise<string> {
  const params = new URLSearchParams();
  params.append("source", "ja");
  params.append("target", "ko");
  params.append("text", text);

  const res = await fetch(PAPAGO_ENDPOINT, {
    method: "POST",
    headers: {
      "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_CLIENT_ID!,
      "X-NCP-APIGW-API-KEY": process.env.NAVER_CLIENT_SECRET!,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Papago 오류 ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.message.result.translatedText as string;
}

export async function translateToKorean(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  if (!hasTranslationApiKey()) return texts.map(() => "");

  const results: string[] = new Array(texts.length).fill("");
  let cursor = 0;

  async function worker() {
    while (cursor < texts.length) {
      const index = cursor++;
      try {
        results[index] = await translateOne(texts[index]);
      } catch (err) {
        console.error("Papago 번역 실패:", err);
        results[index] = "";
      }
    }
  }

  // Papago는 문장 하나씩만 번역하는 API라 배치 대신 제한된 동시 요청 수로 병렬 처리한다
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, texts.length) }, worker)
  );

  return results;
}
