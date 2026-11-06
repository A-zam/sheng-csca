import { Bubble } from './ui';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * A full 48-row answer card, the sheet every CSCA paper is answered on. On the
 * home page it pencils itself in once, row by row, which is the only motion on
 * the site that nobody asked for. With reduced motion it simply appears filled.
 *
 * The "answers" are a fixed pattern, not real ones; nothing here is a key.
 */
export function AnswerCard({ subject = 'Mathematics' }: { subject?: string }) {
  const rows = Array.from({ length: 48 }, (_, i) => ({
    n: i + 1,
    // A spread that looks like a real paper: no long runs of one letter.
    choice: (i * 7 + Math.floor(i / 3)) % 4,
  }));

  return (
    <figure className="rounded-[3px] border border-[var(--pen)]/45 bg-[var(--sheet)] p-4 sm:p-5">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--pen)]/35 pb-3">
        <span className="font-serif text-[18px] font-semibold text-[var(--pen)]">
          {subject} answer card
        </span>
        <span className="text-[13px] text-[var(--ink-soft)]">48 questions in 60 minutes</span>
      </figcaption>

      <ol className="grid grid-flow-col grid-cols-2 grid-rows-[repeat(12,auto)] gap-x-4 gap-y-[7px] sm:grid-cols-4 sm:grid-rows-[repeat(12,auto)]">
        {rows.map((row) => (
          <li
            key={row.n}
            className={row.n > 24 ? 'hidden items-center gap-1 sm:flex' : 'flex items-center gap-1'}
          >
            <span className="w-5 shrink-0 text-right text-[11px] font-semibold text-[var(--pen)] tabular-nums">
              {row.n}
            </span>
            {LETTERS.map((letter, index) => (
              <Bubble
                key={letter}
                letter={letter}
                size="sm"
                state={index === row.choice ? 'filled' : 'empty'}
                className={index === row.choice ? 'bubble-fill' : undefined}
                style={
                  index === row.choice ? { animationDelay: `${400 + row.n * 42}ms` } : undefined
                }
              />
            ))}
          </li>
        ))}
      </ol>
    </figure>
  );
}
