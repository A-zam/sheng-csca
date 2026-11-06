'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { PublicQuestion } from '@/lib/data';
import { RichText } from './RichText';
import { Bubble, Button, cx, type BubbleState } from './ui';
import { reportLink } from '@/lib/site';

export const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export interface QuestionViewProps {
  question: PublicQuestion;
  /** Index the user has chosen, or null. */
  selected: number | null;
  onSelect: (index: number) => void;
  /** Show the mark, the worked solution and the distractor notes. */
  revealed: boolean;
  onNext?: () => void;
  nextLabel?: string;
  /** 1-based position within the current run. */
  position?: { index: number; total: number };
  topicName?: string;
  flagged?: boolean;
  onToggleFlag?: () => void;
  /** Turn off the keyboard shortcuts when another control owns the keyboard. */
  keyboard?: boolean;
}

export function QuestionView({
  question,
  selected,
  onSelect,
  revealed,
  onNext,
  nextLabel = 'Next question',
  position,
  topicName,
  flagged,
  onToggleFlag,
  keyboard = true,
}: QuestionViewProps) {
  const nextRef = useRef<HTMLButtonElement | null>(null);

  // 1-4 picks an option, Enter moves on. Ignored while the user is typing in a
  // field, so the shortcuts never fight a real input.
  useEffect(() => {
    if (!keyboard) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }

      if (event.key >= '1' && event.key <= '4') {
        const index = Number(event.key) - 1;
        if (revealed) return;
        event.preventDefault();
        onSelect(index);
        return;
      }
      if (event.key === 'Enter' && onNext) {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keyboard, onNext, onSelect, revealed]);

  // Once the answer is shown, put focus on the button that moves on, so Enter
  // and Tab both do the obvious thing.
  useEffect(() => {
    if (revealed) nextRef.current?.focus();
  }, [revealed, question.id]);

  const correct = revealed && selected === question.correctIndex;
  const href = typeof window === 'undefined' ? '' : window.location.href;
  const report = useMemo(() => reportLink(question.id, href), [question.id, href]);

  return (
    <article className="relative overflow-hidden rounded-[3px] border border-[var(--line)] bg-[var(--sheet)]">
      {/* The red margin rule of exercise paper; the question number sits in the margin. */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-[3.25rem] w-px bg-[var(--pen)]/45 sm:left-[4.5rem]"
      />

      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)]">
        <div className="pt-5 pr-2 text-right sm:pt-7 sm:pr-4">
          {position ? (
            <p className="font-serif leading-none text-[var(--pen)] tabular-nums">
              <span className="sr-only">Question </span>
              <span className="block text-[26px] font-semibold sm:text-[32px]">
                {position.index}
              </span>
              <span className="mt-1 block text-[12px] text-[var(--ink-soft)] sm:text-[13px]">
                <span className="sr-only">of </span>
                <span aria-hidden="true">/</span>
                {position.total}
              </span>
            </p>
          ) : null}
        </div>

        <div className="min-w-0 px-4 pt-5 pb-5 sm:px-7 sm:pt-7 sm:pb-7">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-[var(--ink-soft)]">
            {topicName ? (
              <span className="font-semibold text-[var(--ink)]">{topicName}</span>
            ) : null}
            <span>{DIFFICULTY_LABELS[question.difficulty] ?? `Level ${question.difficulty}`}</span>
            {onToggleFlag ? (
              <button
                type="button"
                onClick={onToggleFlag}
                aria-pressed={flagged ?? false}
                className={cx(
                  'ml-auto min-h-9 rounded-[3px] px-2.5 text-[14px] font-semibold transition-colors',
                  flagged
                    ? 'bg-[var(--highlight)] text-[var(--ink)]'
                    : 'text-[var(--ink-soft)] hover:bg-[var(--paper-sunk)] hover:text-[var(--ink)]',
                )}
              >
                {flagged ? 'Flagged to come back to' : 'Flag to come back to'}
              </button>
            ) : null}
          </div>

          <RichText className="font-serif text-[18px] leading-[1.65] text-[var(--ink)] sm:text-[19px]">
            {question.stem}
          </RichText>

          {question.figure ? <Figure svg={question.figure} /> : null}

          <ul className="mt-6 space-y-2" role="radiogroup" aria-label="Answer options">
            {question.options.map((option, index) => (
              <li key={index}>
                <OptionButton
                  label={OPTION_LABELS[index] ?? String(index + 1)}
                  option={option}
                  chosen={selected === index}
                  isCorrect={index === question.correctIndex}
                  revealed={revealed}
                  onClick={() => onSelect(index)}
                />
              </li>
            ))}
          </ul>

          {revealed ? (
            <div className="mt-7 border-t border-dashed border-[var(--line)] pt-6">
              <p
                role="status"
                className={cx(
                  'font-serif text-[21px] font-semibold',
                  correct ? 'text-[var(--good)]' : 'text-[var(--bad)]',
                )}
              >
                {correct
                  ? 'Correct.'
                  : selected === null
                    ? `Not answered. The answer is ${OPTION_LABELS[question.correctIndex]}.`
                    : `Not quite. The answer is ${OPTION_LABELS[question.correctIndex]}.`}
              </p>

              {!correct && selected !== null && question.distractorRationale[selected] ? (
                <div className="mt-4 border-l-[3px] border-[var(--bad)] bg-[var(--bad-soft)] px-4 py-3">
                  <p className="text-[14px] font-semibold text-[var(--bad)]">
                    Why {OPTION_LABELS[selected]} is wrong
                  </p>
                  <RichText className="mt-1 text-[15px] leading-relaxed text-[var(--ink)]">
                    {question.distractorRationale[selected] as string}
                  </RichText>
                </div>
              ) : null}

              <div className="mt-6">
                <h3 className="font-serif text-[18px] font-semibold text-[var(--ink)]">
                  Worked solution
                </h3>
                <RichText className="mt-2 max-w-[68ch] font-serif text-[17px] leading-[1.7] text-[var(--ink)]">
                  {question.solution}
                </RichText>
              </div>

              <details className="mt-6 text-[15px]">
                <summary className="cursor-pointer font-semibold text-[var(--brand)] marker:text-[var(--ink-soft)] hover:text-[var(--ink)]">
                  What each wrong option would mean
                </summary>
                <ul className="mt-3 space-y-3">
                  {question.options.map((_, index) =>
                    index === question.correctIndex ? null : (
                      <li key={index} className="flex items-start gap-3">
                        <Bubble letter={OPTION_LABELS[index] ?? ''} size="sm" className="mt-1" />
                        <RichText inline className="min-w-0 leading-relaxed text-[var(--ink-soft)]">
                          {question.distractorRationale[index] as string}
                        </RichText>
                      </li>
                    ),
                  )}
                </ul>
              </details>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                {onNext ? (
                  <Button ref={nextRef} onClick={onNext}>
                    {nextLabel}
                    <kbd className="rounded-[3px] border border-current/40 px-1.5 font-sans text-[12px] font-semibold opacity-80">
                      Enter
                    </kbd>
                  </Button>
                ) : null}
                {report ? (
                  <a
                    href={report}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-[var(--ink-soft)] underline underline-offset-2 hover:text-[var(--ink)]"
                  >
                    Report a problem with this question
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Recall',
  2: 'Single step',
  3: 'Standard',
  4: 'Multi-step',
  5: 'Challenging',
};

function OptionButton({
  label,
  option,
  chosen,
  isCorrect,
  revealed,
  onClick,
}: {
  label: string;
  option: string;
  chosen: boolean;
  isCorrect: boolean;
  revealed: boolean;
  onClick: () => void;
}) {
  const showAsCorrect = revealed && isCorrect;
  const showAsWrong = revealed && chosen && !isCorrect;
  const bubble: BubbleState = showAsCorrect
    ? 'correct'
    : showAsWrong
      ? 'wrong'
      : chosen
        ? 'filled'
        : 'empty';

  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      disabled={revealed}
      onClick={onClick}
      className={cx(
        'flex w-full items-start gap-4 rounded-[4px] border px-3 py-3 text-left transition-colors sm:px-4',
        'disabled:cursor-default',
        showAsCorrect
          ? 'border-[var(--good)] bg-[var(--good-soft)]'
          : showAsWrong
            ? 'border-[var(--bad)] bg-[var(--bad-soft)]'
            : chosen
              ? 'border-[var(--graphite)] bg-[var(--paper-sunk)]'
              : 'border-transparent enabled:hover:border-[var(--line)] enabled:hover:bg-[var(--paper)]',
      )}
    >
      <Bubble letter={label} state={bubble} className="mt-px" />
      <span className="sr-only">Option {label}:</span>
      <span className="min-w-0 flex-1 pt-0.5">
        <RichText inline className="block overflow-x-auto font-serif text-[18px] leading-relaxed">
          {option}
        </RichText>
        {showAsCorrect ? (
          <span className="mt-1 block font-sans text-[13px] font-semibold text-[var(--good)]">
            {chosen ? 'Your answer, correct' : 'Correct answer'}
          </span>
        ) : showAsWrong ? (
          <span className="mt-1 block font-sans text-[13px] font-semibold text-[var(--bad)]">
            Your answer
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * Question figures are inline SVG authored in this repository. `<script>` is
 * stripped anyway so that a future contributor cannot make one executable by
 * accident — validate-content would reject it, but defence in depth is cheap.
 */
function Figure({ svg }: { svg: string }) {
  const safe = useMemo(
    () => svg.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*"[^"]*"/gi, ''),
    [svg],
  );
  return (
    <div
      className="question-figure my-4 overflow-x-auto"
      role="img"
      aria-label="Diagram for this question"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
