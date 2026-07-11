"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export default function VocabPage() {
  const entries = useLiveQuery(() =>
    db.vocab.orderBy("createdAt").reverse().toArray()
  );

  async function handleDelete(id: string) {
    await db.vocab.delete(id);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">단어장</h1>
      <p className="-mt-2 text-sm text-neutral-500">
        일본어 텍스트를 블록으로 지정해 분석한 뒤 저장한 문장/단어 목록입니다.
      </p>

      {entries?.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-neutral-500">
          아직 저장한 단어가 없습니다. 재생 화면에서 일본어를 블록으로 지정해
          분석한 뒤 &quot;단어장에 저장&quot;을 눌러보세요.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {entries?.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start justify-between gap-3 rounded-lg border bg-white p-3"
          >
            <div className="min-w-0">
              <p className="font-medium">{entry.textJa}</p>
              <p className="mt-1 text-sm text-neutral-600">
                {entry.textKo || "(번역 없음)"}
              </p>
              {entry.videoTitle && (
                <p className="mt-1 truncate text-xs text-neutral-400">
                  {entry.videoTitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleDelete(entry.id)}
              aria-label="단어장에서 삭제"
              className="shrink-0 rounded-md border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
