"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export default function BookmarksPage() {
  const bookmarks = useLiveQuery(async () => {
    const list = await db.bookmarks.orderBy("createdAt").reverse().toArray();
    return Promise.all(
      list.map(async (b) => {
        const [video, segment] = await Promise.all([
          db.videos.get(b.videoId),
          db.segments.get(b.segmentId),
        ]);
        return { bookmark: b, video, segment };
      })
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">북마크</h1>

      {bookmarks?.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-neutral-500">
          아직 저장한 북마크가 없습니다.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {bookmarks
          ?.filter((b) => b.video && b.segment)
          .map(({ bookmark, video, segment }) => (
            <Link
              key={bookmark.id}
              href={`/videos/${video!.id}?t=${segment!.startSec}`}
              className="flex gap-3 rounded-lg border bg-white p-3 hover:border-neutral-400"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={video!.thumbnailUrl}
                alt={video!.title}
                className="h-16 w-28 flex-shrink-0 rounded object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm text-neutral-500">
                  {video!.title}
                </p>
                <p className="mt-1 truncate font-medium">{segment!.textJa}</p>
                <p className="truncate text-sm text-neutral-500">
                  {segment!.textKo}
                </p>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}
