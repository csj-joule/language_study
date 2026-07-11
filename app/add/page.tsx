"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerVideoFromUrl, type PipelineProgress } from "@/lib/pipeline";

const STAGE_LABEL: Record<PipelineProgress["stage"], string> = {
  transcript: "자막/번역 가져오는 중... (이미 등록된 적 있는 영상이면 바로 완료됩니다)",
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
      <h1 className="text-2xl font-bold tracking-tight">영상 추가</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={loading}
          className="rounded-xl border border-neutral-200 px-3 py-2.5 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-neutral-100"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none"
        >
          {loading ? "처리 중..." : "가져오기"}
        </button>
      </form>

      {progress && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-sm">
          <p>{STAGE_LABEL[progress.stage]}</p>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <p className="text-xs text-neutral-500">
        일본어 자막(수동 또는 자동생성)이 있는 유튜브 영상만 등록할 수 있습니다. 영상 길이가
        길수록 처리 시간이 오래 걸릴 수 있습니다.
      </p>
    </div>
  );
}
