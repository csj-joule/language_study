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
  function handleJaMouseUp() {
    if (jaHidden) {
      onRevealJa();
      return;
    }
    const selected = window.getSelection()?.toString().trim();
    if (selected && onAnalyzeSelection) {
      onAnalyzeSelection(selected);
    } else {
      onSelect();
    }
  }
  return (
    <div
      ref={innerRef}
      data-testid={testId}
      style={style}
      className={`rounded-lg border p-3 transition-colors ${
        emphasized
          ? "border-2 border-blue-500 bg-white shadow-md"
          : isCurrent
            ? "border-neutral-900 bg-neutral-100"
            : "bg-white"
      }`}
    >
      {emphasized && (
        <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-blue-600">
          <span>▶</span> 지금 재생 중
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <div
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
            <span className="select-none rounded bg-neutral-300 px-2 py-1 text-neutral-300">
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
          className="shrink-0 text-xl leading-none"
        >
          {isBookmarked ? "★" : "☆"}
        </button>
      </div>
      <button
        data-testid={testId ? `${testId}-ko` : undefined}
        onClick={() => koHidden && onRevealKo()}
        className="mt-1 block w-full text-left text-sm text-neutral-600"
      >
        {koHidden ? (
          <span className="select-none rounded bg-neutral-200 px-2 py-1 text-neutral-200">
            ████████
          </span>
        ) : (
          segment.textKo || "(번역 없음)"
        )}
      </button>
    </div>
  );
}
