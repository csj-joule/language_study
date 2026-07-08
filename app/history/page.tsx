"use client";

import { useEffect, useState } from "react";

type CachedVideoSummary = {
  youtubeId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  createdAt: string;
  segmentCount: number;
};

export default function HistoryPage() {
  const [videos, setVideos] = useState<CachedVideoSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const res = await fetch("/api/video-cache");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "목록을 가져오지 못했습니다");
        setVideos(data.videos ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
      }
    })();
  }, []);

  async function handleDelete(youtubeId: string, title: string) {
    if (
      !window.confirm(
        `"${title}" 캐시를 삭제할까요?\n삭제 후 이 영상을 다시 추가하면 자막/후리가나/번역을 처음부터 다시 가져옵니다.`
      )
    ) {
      return;
    }
    setDeletingId(youtubeId);
    try {
      const res = await fetch(`/api/video-cache?video=${encodeURIComponent(youtubeId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "삭제에 실패했습니다");
      }
      setVideos((prev) => prev?.filter((v) => v.youtubeId !== youtubeId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">서버 캐시 히스토리</h1>
        <p className="mt-1 text-sm text-neutral-500">
          한 번 자막/번역을 가져온 영상은 여기 서버에 저장되어, 어떤 기기에서 다시
          추가하더라도 API를 다시 호출하지 않고 즉시 불러옵니다.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {videos === null && !error && (
        <p className="text-neutral-500">불러오는 중...</p>
      )}

      {videos?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-10 text-center text-neutral-500">
          <p>서버에 캐시된 영상이 없습니다.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {videos?.map((video) => (
          <div
            key={video.youtubeId}
            className="flex items-center gap-3 rounded-2xl border border-neutral-200/70 bg-white p-3 shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="h-14 w-24 flex-shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{video.title}</p>
              <p className="truncate text-sm text-neutral-500">
                {video.channelTitle} · 구간 {video.segmentCount}개 ·{" "}
                {new Date(video.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(video.youtubeId, video.title)}
              disabled={deletingId === video.youtubeId}
              className="flex-shrink-0 rounded-xl border border-neutral-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
            >
              {deletingId === video.youtubeId ? "삭제 중..." : "삭제"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
