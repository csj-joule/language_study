"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerVideoFromUrl, type PipelineProgress } from "@/lib/pipeline";

const STAGE_LABEL: Record<PipelineProgress["stage"], string> = {
  transcript: "자막 가져오는 중...",
  furigana: "후리가나 생성 중...",
  translate: "한국어 번역 중...",
  saving: "저장 중...",
  done: "완료!",
};

export default function AddVideoPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const videoId = await registerVideoFromUrl(url.trim(), setProgress);
      router.push(`/videos/${videoId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <h1 className="text-xl font-semibold">영상 추가</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={loading}
          className="rounded-md border px-3 py-2 disabled:bg-neutral-100"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {loading ? "처리 중..." : "가져오기"}
        </button>
      </form>

      {progress && (
        <div className="rounded-md border bg-white p-4 text-sm">
          <p>{STAGE_LABEL[progress.stage]}</p>
          {progress.total !== undefined && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full bg-neutral-900 transition-all"
                style={{
                  width: `${Math.round(((progress.current ?? 0) / progress.total) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <p className="text-xs text-neutral-500">
        일본어 자막(수동 또는 자동생성)이 있는 유튜브 영상만 등록할 수 있습니다. 영상 길이가
        길수록 처리 시간이 오래 걸릴 수 있습니다.
      </p>
    </div>
  );
}
