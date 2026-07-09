"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import {
  YoutubePlayer,
  type YoutubePlayerHandle,
} from "@/components/player/YoutubePlayer";
import { SegmentCard } from "@/components/segment/SegmentCard";
import type { AnalyzedToken } from "@/lib/furigana";
import { rebuildSegments, type PipelineProgress } from "@/lib/pipeline";
import type { VocabEntry } from "@/lib/types";

const RATES = [0.5, 0.75, 1, 1.25, 1.5];
const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-neutral-200 disabled:hover:text-neutral-600";
const REBUILD_STAGE_LABEL: Record<PipelineProgress["stage"], string> = {
  transcript: "자막/번역 다시 가져오는 중...",
  saving: "저장 중...",
  done: "완료!",
};

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <rect x="4" y="5" width="2.2" height="14" />
      <path d="M20 5.5v13L8.5 12 20 5.5z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <rect x="17.8" y="5" width="2.2" height="14" />
      <path d="M4 5.5v13L15.5 12 4 5.5z" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 9 8 9" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M6 4.5v15L20 12 6 4.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <rect x="5.5" y="4.5" width="4.5" height="15" />
      <rect x="14" y="4.5" width="4.5" height="15" />
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export default function VideoPage() {
  const params = useParams<{ id: string }>();
  const videoId = params.id;
  const searchParams = useSearchParams();
  const initialSeekSec = searchParams.get("t");

  const video = useLiveQuery(() => db.videos.get(videoId), [videoId]);
  const segments = useLiveQuery(
    () => db.segments.where("videoId").equals(videoId).sortBy("order"),
    [videoId]
  );
  const bookmarks = useLiveQuery(
    () => db.bookmarks.where("videoId").equals(videoId).toArray(),
    [videoId]
  );
  // 단어장은 여러 기기가 공유하는 서버(Neon Postgres)에 저장되므로 IndexedDB가
  // 아니라 /api/vocab을 통해 불러오고, 추가/삭제 후 로컬 상태를 직접 갱신한다.
  const [vocabEntries, setVocabEntries] = useState<VocabEntry[] | null>(null);
  useEffect(() => {
    fetch("/api/vocab")
      .then((res) => res.json())
      .then((data) => setVocabEntries(data.entries ?? []))
      .catch((err) => console.error("단어장 불러오기 실패:", err));
  }, []);

  const playerRef = useRef<YoutubePlayerHandle>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const appliedInitialSeekRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [loopIndex, setLoopIndex] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const [globalBlindJa, setGlobalBlindJa] = useState(false);
  const [globalBlindKo, setGlobalBlindKo] = useState(false);
  const [revealed, setRevealed] = useState<
    Record<string, { ja?: boolean; ko?: boolean }>
  >({});
  const [autoTranslating, setAutoTranslating] = useState(false);
  const autoTranslateStartedRef = useRef(false);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    tokens: AnalyzedToken[];
    translation: string;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState<PipelineProgress | null>(
    null
  );

  const timeBasedIndex = useMemo(() => {
    if (!segments || segments.length === 0) return -1;
    let idx = 0;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].startSec <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [segments, currentTime]);

  // 구간반복 중에는 재생 시간에 따라 currentIndex가 다음 구간으로 자동으로
  // 넘어가지 않도록 반복 대상 구간(loopIndex)에 고정한다.
  const currentIndex = loop && loopIndex !== null ? loopIndex : timeBasedIndex;

  // 버튼 클릭 등 이벤트 핸들러가 항상 최신 값을 참조하도록 커밋 직후마다 동기화한다.
  // (클릭이 연달아 빠르게 발생하면 아직 리렌더링 전인 이전 클로저의 currentIndex/loop 값을
  // 참조해 반복 대상이 엉뚱한 구간으로 바뀌는 문제가 있어 ref로 최신값을 보장한다)
  const latestRef = useRef({ currentIndex, loop });
  useEffect(() => {
    latestRef.current = { currentIndex, loop };
  });

  // 구간반복: 반복 대상 구간의 끝을 넘어가면 그 구간의 시작 지점으로 되돌리고
  // 재생을 명시적으로 다시 시작한다. seekTo만 호출하면 내부적으로 일시정지된
  // 상태로 멈춰 두 번째 반복부터 진행되지 않는 경우가 있어 playVideo()로 보정한다.
  useEffect(() => {
    if (!loop || loopIndex === null || !segments) return;
    const seg = segments[loopIndex];
    if (!seg) return;
    if (currentTime >= seg.endSec) {
      playerRef.current?.seekTo(seg.startSec, true);
      playerRef.current?.playVideo();
    }
  }, [currentTime, loop, loopIndex, segments]);

  // 전체 목록에서도 현재 구간이 화면 밖에 있으면 살짝 보이도록 스크롤 (상단 고정 카드와는 별개)
  useEffect(() => {
    if (currentIndex < 0 || !segments) return;
    const seg = segments[currentIndex];
    itemRefs.current[seg.id]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [currentIndex, segments]);

  // 번역이 비어있는 구간이 있으면 자동으로 번역을 채운다 (버튼 없이 백그라운드로 1회만 실행)
  useEffect(() => {
    if (!segments || !video?.youtubeId || autoTranslateStartedRef.current) return;
    const missing = segments.filter((s) => !s.textKo);
    if (missing.length === 0) return;
    autoTranslateStartedRef.current = true;

    (async () => {
      setAutoTranslating(true);
      const CHUNK_SIZE = 40;
      const cacheUpdates: { order: number; textKo: string }[] = [];
      try {
        for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
          const chunk = missing.slice(i, i + CHUNK_SIZE);
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: chunk.map((s) => s.textJa) }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "번역 요청 실패");

          const translations: string[] = data.translations ?? [];
          await Promise.all(
            chunk.map((seg, idx) => {
              const textKo = translations[idx];
              if (!textKo) return Promise.resolve();
              cacheUpdates.push({ order: seg.order, textKo });
              return db.segments.update(seg.id, { textKo });
            })
          );
        }

        // 서버 캐시에도 반영해서, 다른 기기에서 같은 영상을 열 때 이미 번역된 상태로 받도록 한다.
        if (cacheUpdates.length > 0) {
          fetch("/api/video-cache/translations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ youtubeId: video.youtubeId, updates: cacheUpdates }),
          }).catch((err) => console.error("캐시 번역 동기화 실패:", err));
        }
      } catch (err) {
        console.error("자동 번역 실패:", err);
      } finally {
        setAutoTranslating(false);
      }
    })();
  }, [segments, video?.youtubeId]);

  // setState 호출뿐이라 의존성이 없다. useCallback으로 참조를 고정하지 않으면
  // 재생 중 100ms마다 바뀌는 currentTime 때문에 이 컴포넌트가 계속 리렌더링되고,
  // 그때마다 이 함수도 새로 만들어져 SegmentCard로 내려가는 onAnalyzeSelection이
  // 계속 바뀐다 — 그 결과 모바일 선택 감지용 selectionchange effect가 재생 중엔
  // 400ms 디바운스가 끝나기도 전에 계속 해제·재등록되어 사실상 동작하지 않았다.
  const handleAnalyzeSelection = useCallback(async (text: string) => {
    setAnalysisText(text);
    setAnalysisResult(null);
    setAnalysisExpanded(true);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석 요청 실패");
      setAnalysisResult({ tokens: data.tokens ?? [], translation: data.translation ?? "" });
    } catch (err) {
      console.error("분석 실패:", err);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  if (!video || !segments) {
    return <p className="text-neutral-500">불러오는 중...</p>;
  }

  const bookmarkedSegmentIds = new Set(
    (bookmarks ?? []).map((b) => b.segmentId)
  );
  const currentSegment = currentIndex >= 0 ? segments[currentIndex] : null;

  // 단어(품사 있음)와 문구(품사 없음)를 같은 테이블에 저장하므로, surface+baseForm
  // 조합을 키로 삼아 이미 저장된 항목인지 구분한다.
  const wordVocabKey = (surface: string, baseForm?: string) =>
    `${surface}::${baseForm ?? ""}`;
  const savedWordEntries = (vocabEntries ?? []).filter((v) => v.pos);
  const savedPhraseEntries = (vocabEntries ?? []).filter((v) => !v.pos);
  const savedWordKeys = new Set(
    savedWordEntries.map((v) => wordVocabKey(v.surface, v.baseForm))
  );
  const isPhraseSaved = analysisText
    ? savedPhraseEntries.some((v) => v.surface === analysisText)
    : false;

  async function addVocabEntry(entry: Omit<VocabEntry, "id" | "createdAt">) {
    const id = uuidv4();
    const res = await fetch("/api/vocab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...entry }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("단어장 저장 실패:", data.error);
      alert(data.error ?? "단어장 저장에 실패했습니다");
      return;
    }
    setVocabEntries((prev) => [data.entry, ...(prev ?? [])]);
  }

  async function removeVocabEntry(id: string) {
    const res = await fetch(`/api/vocab?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      console.error("단어장 삭제 실패:", data?.error);
      alert(data?.error ?? "단어장 삭제에 실패했습니다");
      return;
    }
    setVocabEntries((prev) => (prev ?? []).filter((v) => v.id !== id));
  }

  async function toggleVocabWord(token: AnalyzedToken) {
    const key = wordVocabKey(token.surface, token.baseForm);
    const existing = savedWordEntries.find(
      (v) => wordVocabKey(v.surface, v.baseForm) === key
    );
    if (existing) {
      await removeVocabEntry(existing.id);
    } else {
      await addVocabEntry({
        surface: token.surface,
        reading: token.reading,
        pos: token.pos,
        baseForm: token.baseForm,
        meaningKo: token.meaningKo,
        youtubeId: video!.youtubeId,
        videoTitle: video!.title,
        segmentText: currentSegment?.textJa,
        segmentStartSec: currentSegment?.startSec,
      });
    }
  }

  async function toggleVocabPhrase() {
    if (!analysisText) return;
    const existing = savedPhraseEntries.find((v) => v.surface === analysisText);
    if (existing) {
      await removeVocabEntry(existing.id);
    } else {
      await addVocabEntry({
        surface: analysisText,
        meaningKo: analysisResult?.translation,
        youtubeId: video!.youtubeId,
        videoTitle: video!.title,
        segmentText: currentSegment?.textJa,
        segmentStartSec: currentSegment?.startSec,
      });
    }
  }

  function goTo(index: number, autoplay = true) {
    const seg = segments![index];
    if (!seg) return;
    playerRef.current?.seekTo(seg.startSec, true);
    if (autoplay) playerRef.current?.playVideo();
    if (latestRef.current.loop) setLoopIndex(index);
  }

  function handleRateChange(r: number) {
    setRate(r);
    playerRef.current?.setPlaybackRate(r);
  }

  async function toggleBookmark(segmentId: string) {
    const existing = (bookmarks ?? []).find((b) => b.segmentId === segmentId);
    if (existing) {
      await db.bookmarks.delete(existing.id);
    } else {
      await db.bookmarks.add({
        id: uuidv4(),
        videoId,
        segmentId,
        createdAt: new Date().toISOString(),
      });
    }
  }

  function toggleReveal(segmentId: string, lang: "ja" | "ko") {
    setRevealed((prev) => ({
      ...prev,
      [segmentId]: { ...prev[segmentId], [lang]: !prev[segmentId]?.[lang] },
    }));
  }

  async function handleRebuildSegments() {
    const bookmarkCount = (bookmarks ?? []).length;
    const message =
      bookmarkCount > 0
        ? `구간을 새 기준(긴 문장 최대 2개 분할)으로 다시 나눕니다. 이 영상에 저장된 북마크 ${bookmarkCount}개가 함께 삭제됩니다. 계속하시겠습니까?`
        : "구간을 새 기준(긴 문장 최대 2개 분할)으로 다시 나눕니다. 계속하시겠습니까?";
    if (!window.confirm(message)) return;

    setRebuilding(true);
    setRebuildProgress(null);
    try {
      await rebuildSegments({ id: video!.id, youtubeId: video!.youtubeId }, setRebuildProgress);
      // 새 구간에 대해 자동 번역이 다시 실행되도록 가드를 초기화
      autoTranslateStartedRef.current = false;
    } catch (err) {
      console.error("구간 재구성 실패:", err);
      alert(err instanceof Error ? err.message : "구간을 다시 나누는 중 오류가 발생했습니다");
    } finally {
      setRebuilding(false);
      setRebuildProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 영상 + 컨트롤 + 현재 구간을 화면 상단에 고정 (아래 전체 목록과는 그림자로 구분) */}
      <div className="sticky top-14 z-20 -mx-4 flex flex-col gap-3 border-b border-neutral-200/70 bg-white/85 px-4 pb-3 pt-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
        <div className="flex items-center justify-between gap-2">
          <h1
            className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight"
            title={video.title}
          >
            {video.title}
          </h1>
          <button
            data-testid="btn-rebuild-segments"
            onClick={handleRebuildSegments}
            disabled={rebuilding}
            className="shrink-0 text-xs text-neutral-500 hover:text-indigo-600 hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {rebuilding
              ? rebuildProgress
                ? REBUILD_STAGE_LABEL[rebuildProgress.stage]
                : "구간 재구성 중..."
              : "구간 다시 나누기"}
          </button>
        </div>

        <YoutubePlayer
          ref={playerRef}
          youtubeId={video.youtubeId}
          onTimeUpdate={setCurrentTime}
          onPlayStateChange={setIsPlaying}
          onReady={() => {
            if (!appliedInitialSeekRef.current && initialSeekSec) {
              appliedInitialSeekRef.current = true;
              const sec = parseFloat(initialSeekSec);
              if (!Number.isNaN(sec)) {
                playerRef.current?.seekTo(sec, true);
                playerRef.current?.playVideo();
              }
            }
          }}
        />

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200/70 bg-white p-3 shadow-sm">
          <button
            data-testid="btn-prev"
            aria-label="이전 구간"
            title="이전 구간"
            className={iconBtn}
            onClick={() => goTo(Math.max(0, latestRef.current.currentIndex - 1))}
          >
            <PrevIcon />
          </button>
          <button
            data-testid="btn-replay"
            aria-label="다시 재생"
            title="다시 재생"
            className={iconBtn}
            onClick={() => goTo(latestRef.current.currentIndex)}
          >
            <ReplayIcon />
          </button>
          <button
            data-testid="btn-next"
            aria-label="다음 구간"
            title="다음 구간"
            className={iconBtn}
            onClick={() =>
              goTo(Math.min(segments.length - 1, latestRef.current.currentIndex + 1))
            }
          >
            <NextIcon />
          </button>
          <button
            data-testid="btn-loop"
            aria-label={`구간반복 ${loop ? "ON" : "OFF"}`}
            title={`구간반복 ${loop ? "ON" : "OFF"}`}
            aria-pressed={loop}
            className={`${iconBtn} ${loop ? "border-indigo-600 bg-indigo-600 text-white hover:border-indigo-600 hover:bg-indigo-600 hover:text-white" : ""}`}
            onClick={() =>
              setLoop((v) => {
                const next = !v;
                setLoopIndex(next ? latestRef.current.currentIndex : null);
                return next;
              })
            }
          >
            <LoopIcon />
          </button>
          <button
            data-testid="btn-play-pause"
            aria-label={isPlaying ? "일시정지" : "재생"}
            title={isPlaying ? "일시정지" : "재생"}
            className={iconBtn}
            onClick={() =>
              isPlaying
                ? playerRef.current?.pauseVideo()
                : playerRef.current?.playVideo()
            }
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <select
            data-testid="select-rate"
            value={rate}
            onChange={(e) => handleRateChange(Number(e.target.value))}
            className="rounded-xl border border-neutral-200 px-2 py-1.5 text-sm text-neutral-600 outline-none transition-colors hover:border-indigo-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 text-sm text-neutral-700">
          <label className="flex items-center gap-1.5">
            <input
              data-testid="checkbox-blind-ja"
              type="checkbox"
              checked={globalBlindJa}
              onChange={(e) => setGlobalBlindJa(e.target.checked)}
            />
            일본어 블라인드
          </label>
          <label className="flex items-center gap-1.5">
            <input
              data-testid="checkbox-blind-ko"
              type="checkbox"
              checked={globalBlindKo}
              onChange={(e) => setGlobalBlindKo(e.target.checked)}
            />
            한국어 블라인드
          </label>
        </div>

        {currentSegment && (
          <SegmentCard
            segment={currentSegment}
            isCurrent
            emphasized
            isBookmarked={bookmarkedSegmentIds.has(currentSegment.id)}
            jaHidden={globalBlindJa && !revealed[currentSegment.id]?.ja}
            koHidden={globalBlindKo && !revealed[currentSegment.id]?.ko}
            onSelect={() => goTo(latestRef.current.currentIndex)}
            onRevealJa={() => toggleReveal(currentSegment.id, "ja")}
            onRevealKo={() => toggleReveal(currentSegment.id, "ko")}
            onToggleBookmark={() => toggleBookmark(currentSegment.id)}
            onAnalyzeSelection={handleAnalyzeSelection}
            testId="current-segment"
          />
        )}

        {analysisText && (
          <div className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
            <button
              data-testid="btn-toggle-analysis"
              onClick={() => setAnalysisExpanded((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                <span className="text-neutral-400">
                  {analysisExpanded ? "▾" : "▸"}
                </span>
                <span className="truncate">📖 {analysisText}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  data-testid="btn-save-phrase-vocab"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVocabPhrase();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleVocabPhrase();
                    }
                  }}
                  aria-label={
                    isPhraseSaved ? "단어장에서 제거" : "이 문구를 단어장에 저장"
                  }
                  title={isPhraseSaved ? "단어장에서 제거" : "이 문구를 단어장에 저장"}
                  className={`text-lg leading-none transition-transform hover:scale-110 ${
                    isPhraseSaved ? "text-amber-500" : "text-neutral-300 hover:text-neutral-500"
                  }`}
                >
                  {isPhraseSaved ? "★" : "☆"}
                </span>
                <span
                  data-testid="btn-close-analysis"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnalysisText(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setAnalysisText(null);
                    }
                  }}
                  aria-label="분석 닫기"
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  ✕
                </span>
              </span>
            </button>

            {analysisExpanded && (
              <div className="border-t px-3 pb-3 pt-2">
                {analyzing ? (
                  <p className="text-sm text-neutral-500">분석 중...</p>
                ) : analysisResult ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-neutral-700">
                      {analysisResult.translation || "(번역 없음)"}
                    </p>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-neutral-500">
                          <th className="w-8 pb-1 font-medium">
                            <span className="sr-only">단어장 저장</span>
                          </th>
                          <th className="pr-3 pb-1 font-medium">단어</th>
                          <th className="pr-3 pb-1 font-medium">읽기</th>
                          <th className="pr-3 pb-1 font-medium">품사</th>
                          <th className="pb-1 font-medium">번역</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.tokens.map((t, i) => (
                          <tr key={i} className="border-t border-neutral-100 hover:bg-indigo-50/40">
                            <td className="py-1">
                              <input
                                type="checkbox"
                                data-testid={`checkbox-vocab-word-${i}`}
                                aria-label={`${t.surface} 단어장에 저장`}
                                checked={savedWordKeys.has(
                                  wordVocabKey(t.surface, t.baseForm)
                                )}
                                onChange={() => toggleVocabWord(t)}
                              />
                            </td>
                            <td className="py-1 pr-3">{t.surface}</td>
                            <td className="py-1 pr-3 text-neutral-500">
                              {t.reading ?? "-"}
                            </td>
                            <td className="py-1 pr-3 text-neutral-500">{t.pos}</td>
                            <td className="py-1 text-neutral-500">
                              {t.meaningKo || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-500">전체 스크립트</h2>
        {autoTranslating && (
          <span className="text-xs text-neutral-400">번역 채우는 중...</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {segments.map((seg, i) => {
          const isCurrent = i === currentIndex;
          const isBookmarked = bookmarkedSegmentIds.has(seg.id);
          const jaHidden = globalBlindJa && !revealed[seg.id]?.ja;
          const koHidden = globalBlindKo && !revealed[seg.id]?.ko;

          return (
            <SegmentCard
              key={seg.id}
              segment={seg}
              isCurrent={isCurrent}
              isBookmarked={isBookmarked}
              jaHidden={jaHidden}
              koHidden={koHidden}
              onSelect={() => goTo(i, true)}
              onRevealJa={() => toggleReveal(seg.id, "ja")}
              onRevealKo={() => toggleReveal(seg.id, "ko")}
              onToggleBookmark={() => toggleBookmark(seg.id)}
              onAnalyzeSelection={handleAnalyzeSelection}
              testId={`segment-${i}`}
              innerRef={(el) => {
                itemRefs.current[seg.id] = el;
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
