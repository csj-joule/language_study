import { useEffect, useRef } from "react";
import type { Segment } from "@/lib/types";
import { FuriganaText } from "./FuriganaText";

type Props = {
  segment: Segment;
  isCurrent: boolean;
  isBookmarked: boolean;
  jaHidden: boolean;
  koHidden: boolean;
  onSelect: () => void;
  onRevealJa: () => void;
  onRevealKo: () => void;
  onToggleBookmark: () => void;
  onAnalyzeSelection?: (text: string) => void;
  testId?: string;
  innerRef?: (el: HTMLDivElement | null) => void;
  emphasized?: boolean;
  style?: React.CSSProperties;
};

export function SegmentCard({
  segment,
  isCurrent,
  isBookmarked,
  jaHidden,
  koHidden,
  onSelect,
  onRevealJa,
  onRevealKo,
  onToggleBookmark,
  onAnalyzeSelection,
  testId,
  innerRef,
  emphasized = false,
  style,
}: Props) {
  const jaRef = useRef<HTMLDivElement | null>(null);
  const lastAnalyzedRef = useRef("");

  // 부모(영상 재생 화면)는 재생 중 100ms마다 리렌더링되면서 onAnalyzeSelection도
  // 매번 새로 만들어질 수 있다. ref로 최신 값만 따로 들고 있으면, 아래
  // selectionchange effect가 그 재생성 빈도와 무관하게 안정적으로 유지된다.
  const onAnalyzeSelectionRef = useRef(onAnalyzeSelection);
  useEffect(() => {
    onAnalyzeSelectionRef.current = onAnalyzeSelection;
  });

  function analyzeIfNew(text: string) {
    if (!text || text === lastAnalyzedRef.current) return;
    lastAnalyzedRef.current = text;
    onAnalyzeSelectionRef.current?.(text);
  }

  function handleJaMouseUp() {
    if (jaHidden) {
      onRevealJa();
      return;
    }
    const selected = window.getSelection()?.toString().trim();
    if (selected && onAnalyzeSelection) {
      analyzeIfNew(selected);
    } else {
      onSelect();
    }
  }

  // 모바일에서는 롱프레스로 블록을 지정한 뒤 선택 핸들을 드래그해서 범위를
  // 넓히는데, 이 마지막 조정은 native 선택 UI가 처리해서 대상 엘리먼트에
  // mouseup이 다시 발생하지 않는다. 그래서 selectionchange를 함께 감지해
  // 선택이 이 카드 안에서 끝났을 때도 분석이 트리거되도록 보완한다.
  useEffect(() => {
    if (jaHidden || !onAnalyzeSelectionRef.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function handleSelectionChange() {
      // 선택이 해제되면 즉시 초기화해서, 같은 단어를 다시 선택했을 때도 재분석되게 한다.
      if (window.getSelection()?.isCollapsed) {
        lastAnalyzedRef.current = "";
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const anchorNode = sel.anchorNode;
        if (!anchorNode || !jaRef.current?.contains(anchorNode)) return;
        analyzeIfNew(sel.toString().trim());
      }, 400);
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (timer) clearTimeout(timer);
    };
  }, [jaHidden]);

  return (
    <div
      ref={innerRef}
      data-testid={testId}
      style={style}
      className={`rounded-2xl border p-3 transition-all ${
        emphasized
          ? "border-indigo-300 bg-indigo-50/40 shadow-md shadow-indigo-600/5"
          : isCurrent
            ? "border-indigo-200 bg-indigo-50/60"
            : "border-neutral-200/70 bg-white hover:border-indigo-200"
      }`}
    >
      {emphasized && (
        <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-indigo-600">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
          </span>
          지금 재생 중
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <div
          ref={jaRef}
          data-testid={testId ? `${testId}-ja` : undefined}
          role="button"
          tabIndex={0}
          onMouseUp={handleJaMouseUp}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (jaHidden) onRevealJa();
              else onSelect();
            }
          }}
          className={`flex-1 cursor-pointer text-left ${emphasized ? "text-xl" : "text-lg"}`}
        >
          {jaHidden ? (
            <span className="select-none rounded-md bg-neutral-300 px-2 py-1 text-neutral-300">
              ████████████
            </span>
          ) : (
            <FuriganaText tokens={segment.furigana} showFurigana />
          )}
        </div>
        <button
          data-testid={testId ? `${testId}-bookmark` : undefined}
          onClick={onToggleBookmark}
          aria-label="북마크"
          className={`shrink-0 text-xl leading-none transition-transform hover:scale-110 ${
            isBookmarked ? "text-amber-500" : "text-neutral-300"
          }`}
        >
          {isBookmarked ? "★" : "☆"}
        </button>
      </div>
      <button
        data-testid={testId ? `${testId}-ko` : undefined}
        onClick={() => koHidden && onRevealKo()}
        className="mt-1 block w-full text-left text-sm text-neutral-500"
      >
        {koHidden ? (
          <span className="select-none rounded-md bg-neutral-200 px-2 py-1 text-neutral-200">
            ████████
          </span>
        ) : (
          segment.textKo || "(번역 없음)"
        )}
      </button>
    </div>
  );
}
