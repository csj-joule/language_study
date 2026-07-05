"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export default function Home() {
  const videos = useLiveQuery(() =>
    db.videos.orderBy("createdAt").reverse().toArray()
  );

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
            className="flex gap-3 rounded-lg border bg-white p-3 hover:border-neutral-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="h-16 w-28 flex-shrink-0 rounded object-cover"
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{video.title}</p>
              <p className="truncate text-sm text-neutral-500">
                {video.channelTitle}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
