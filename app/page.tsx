"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export default function Home() {
  const videos = useLiveQuery(() =>
    db.videos.orderBy("createdAt").reverse().toArray()
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function handleDelete(e: React.MouseEvent, videoId: string, title: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`"${title}"을(를) 내 목록에서 삭제할까요?\n(자막/북마크가 함께 삭제됩니다. 서버에 캐시된 자막은 유지되어 다시 추가하면 즉시 불러올 수 있습니다.)`)) {
      return;
    }
    await db.transaction("rw", db.videos, db.segments, db.bookmarks, async () => {
      await db.bookmarks.where("videoId").equals(videoId).delete();
      await db.segments.where("videoId").equals(videoId).delete();
      await db.videos.delete(videoId);
    });
  }

  function startEdit(e: React.MouseEvent | React.KeyboardEvent, video: { id: string; title: string }) {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(video.id);
    setEditValue(video.title);
  }

  async function commitEdit(videoId: string) {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (trimmed) {
      await db.videos.update(videoId, { title: trimmed });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">내 영상</h1>
        <Link
          href="/add"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          + 영상 추가
        </Link>
      </div>

      {videos === undefined && (
        <p className="text-neutral-500">불러오는 중...</p>
      )}

      {videos?.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-neutral-500">
          <p>아직 등록된 영상이 없습니다.</p>
          <p className="mt-1 text-sm">
            일본어 자막이 있는 유튜브 영상 URL을 추가해보세요.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {videos?.map((video) => (
          <Link
            key={video.id}
            href={`/videos/${video.id}`}
            className="group relative flex gap-3 rounded-lg border bg-white p-3 hover:border-neutral-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="h-16 w-28 flex-shrink-0 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              {editingId === video.id ? (
                <input
                  data-testid={`video-title-input-${video.id}`}
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEdit(video.id);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingId(null);
                    }
                  }}
                  onBlur={() => commitEdit(video.id)}
                  className="w-full rounded border px-1.5 py-0.5 pr-6 text-sm font-medium"
                />
              ) : (
                <p className="truncate pr-12 font-medium">{video.title}</p>
              )}
              <p className="truncate text-sm text-neutral-500">
                {video.channelTitle}
              </p>
            </div>
            <div className="absolute right-2 top-2 flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => startEdit(e, video)}
                aria-label="제목 수정"
                title="제목 수정"
                className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <EditIcon />
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(e, video.id, video.title)}
                aria-label="영상 삭제"
                title="내 목록에서 삭제"
                className="rounded-full p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
