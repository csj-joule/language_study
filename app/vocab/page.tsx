"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { VocabEntry } from "@/lib/types";

export default function VocabPage() {
  const [entries, setEntries] = useState<VocabEntry[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  // 단어장 자체는 서버(Neon Postgres)에서 불러오지만, "원본으로 이동" 링크는
  // 이 기기에 해당 영상이 이미 로컬로 등록돼 있을 때만 만들 수 있어 로컬 목록도 함께 조회한다.
  const localVideos = useLiveQuery(() => db.videos.toArray());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/vocab");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "단어장을 불러오지 못했습니다");
        setEntries(data.entries ?? []);
        setWarning(data.warning ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
      }
    })();
  }, []);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/vocab?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "삭제에 실패했습니다");
      setEntries((prev) => prev?.filter((e) => e.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
    }
  }

  async function handleToggleCompleted(id: string, completed: boolean) {
    try {
      const res = await fetch(`/api/vocab?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "변경에 실패했습니다");
      setEntries(
        (prev) => prev?.map((e) => (e.id === id ? { ...e, completed } : e)) ?? null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
    }
  }

  const visibleEntries = entries?.filter((e) => showCompleted || !e.completed);
  const completedCount = entries?.filter((e) => e.completed).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">단어장</h1>
        <p className="mt-1 text-sm text-neutral-500">
          학습 화면에서 저장한 단어/문구는 서버에 저장되어 어떤 기기에서 로그인하든
          동일하게 보입니다.
        </p>
      </div>

      {warning && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{warning}</p>
      )}
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {entries === null && !warning && !error && (
        <p className="text-neutral-500">불러오는 중...</p>
      )}

      {entries !== null && entries.length > 0 && (
        <label className="flex w-fit items-center gap-1.5 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          완료한 항목도 보기 ({completedCount}개)
        </label>
      )}

      {entries?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-10 text-center text-neutral-500">
          아직 저장한 단어/문구가 없습니다.
          <br />
          학습 화면에서 문장을 분석한 뒤 단어나 문구를 체크해 저장해보세요.
        </div>
      )}

      {entries && entries.length > 0 && visibleEntries?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-10 text-center text-neutral-500">
          암기를 완료한 항목뿐입니다. 위 체크박스를 눌러 확인해보세요.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {visibleEntries?.map((entry) => {
          const localVideo = entry.youtubeId
            ? localVideos?.find((v) => v.youtubeId === entry.youtubeId)
            : undefined;
          const sourceLabel =
            entry.videoTitle &&
            `${entry.videoTitle}${entry.segmentText ? ` · ${entry.segmentText}` : ""}`;

          return (
            <div
              key={entry.id}
              className={`flex items-start justify-between gap-3 rounded-2xl border border-neutral-200/70 bg-white p-3 shadow-sm transition-opacity ${
                entry.completed ? "opacity-50" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={`text-lg font-medium ${entry.completed ? "line-through" : ""}`}
                  >
                    {entry.surface}
                  </span>
                  {entry.reading && (
                    <span className="text-sm text-neutral-500">
                      ({entry.reading})
                    </span>
                  )}
                  {entry.pos && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                      {entry.pos}
                    </span>
                  )}
                </div>
                {entry.meaningKo && (
                  <p className="mt-0.5 text-sm text-neutral-700">
                    {entry.meaningKo}
                  </p>
                )}
                {sourceLabel &&
                  (localVideo ? (
                    <Link
                      href={`/videos/${localVideo.id}?t=${entry.segmentStartSec ?? 0}`}
                      className="mt-1 block truncate text-xs text-neutral-400 hover:text-neutral-600 hover:underline"
                    >
                      {sourceLabel}
                    </Link>
                  ) : (
                    <p
                      className="mt-1 truncate text-xs text-neutral-400"
                      title="이 기기에는 아직 등록되지 않은 영상입니다"
                    >
                      {sourceLabel}
                    </p>
                  ))}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleCompleted(entry.id, !entry.completed)}
                  aria-pressed={!!entry.completed}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    entry.completed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-neutral-200 text-neutral-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                  }`}
                >
                  {entry.completed ? "완료됨" : "완료"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  aria-label="단어장에서 삭제"
                  title="단어장에서 삭제"
                  className="rounded-full p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
