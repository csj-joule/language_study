import type { FuriganaToken } from '@/lib/types'

export function FuriganaText({
  tokens,
  showFurigana,
}: {
  tokens: FuriganaToken[]
  showFurigana: boolean
}) {
  return (
    <span className="leading-loose">
      {tokens.map((t, i) =>
        t.reading && showFurigana ? (
          <ruby key={i} className="mx-0.5">
            {t.surface}
            <rt className="select-none text-[0.6em] text-neutral-500">{t.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{t.surface}</span>
        )
      )}
    </span>
  )
}
