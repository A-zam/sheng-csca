'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadTopic,
  topicNames,
  type Manifest,
  type ManifestQuestion,
  type PublicQuestion,
} from '@/lib/data';
import { useAppState } from '@/lib/useAppState';
import { buildQueue } from './PracticeClient';
import { Boundary } from './Boundary';
import { QuestionView } from './QuestionView';
import { Button, EmptyState, Kbd, LoadingCard, Meter } from './ui';
import Link from 'next/link';
import { LINK } from './styles';

export interface PracticeSessionProps {
  pool: ManifestQuestion[];
  seed: number;
  manifest: Manifest;
  ready: boolean;
  answered: string[] | undefined;
  avoidRepeats: boolean;
  onRestart: () => void;
}

/**
 * One run through a filtered set of questions.
 *
 * Mounted with a key derived from the filters, so a filter change replaces the
 * component outright rather than resetting five pieces of state by hand. The
 * queue is therefore built once, in a lazy initialiser, and never has to be
 * rebuilt in an effect.
 */
export function PracticeSession({
  pool,
  seed,
  manifest,
  ready,
  answered,
  avoidRepeats,
  onRestart,
}: PracticeSessionProps) {
  const { recordAttempt } = useAppState();

  // Built once, in a lazy initialiser. `buildQueue` is deterministic given the
  // seed, so this is a pure computation, and the already-answered set is
  // snapshotted at mount — recomputing it as the user answers would reshuffle
  // the queue underneath them.
  const [queue] = useState(() => buildQueue(pool, seed, new Set(answered ?? []), avoidRepeats));

  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ answered: 0, correct: 0 });
  const shownAt = useRef(0);

  const row = queue[cursor];

  // Stamp when the question appeared, and warm the next topic chunk so moving
  // on is instant on a slow connection. Both are side effects on a ref and a
  // cache, not React state, so they belong in an effect.
  useEffect(() => {
    shownAt.current = Date.now();
    const upcoming = queue[cursor + 1];
    if (upcoming) void loadTopic(upcoming.s, upcoming.t).catch(() => undefined);
  }, [cursor, queue]);

  const names = useMemo(() => (row ? topicNames(manifest, row.s) : {}), [manifest, row]);

  const onSelect = useCallback(
    (question: PublicQuestion, index: number) => {
      if (revealed || !row) return;
      const correct = index === question.correctIndex;
      setSelected(index);
      setRevealed(true);
      setStats((s) => ({
        answered: s.answered + 1,
        correct: s.correct + (correct ? 1 : 0),
      }));
      recordAttempt({
        questionId: question.id,
        subject: row.s,
        topic: row.t,
        subtopic: row.st,
        difficulty: row.d,
        correct,
        chosenIndex: index,
        elapsedMs: shownAt.current === 0 ? 0 : Date.now() - shownAt.current,
        at: Date.now(),
        mode: 'practice',
      });
    },
    [recordAttempt, revealed, row],
  );

  const next = useCallback(() => {
    setSelected(null);
    setRevealed(false);
    setCursor((c) => c + 1);
  }, []);

  if (!ready) return <LoadingCard lines={4} />;

  if (queue.length === 0) {
    return (
      <EmptyState title="No questions match those filters">
        Try a different topic, or set the difficulty back to “Any difficulty”.
      </EmptyState>
    );
  }

  if (!row) {
    return (
      <EmptyState
        title="That is the whole set"
        action={<Button onClick={onRestart}>Go round again</Button>}
      >
        You answered {stats.answered} question{stats.answered === 1 ? '' : 's'} and got{' '}
        {stats.correct} right. Anything you missed is waiting in the{' '}
        <Link href="/review" className={LINK}>
          mistake bank
        </Link>
        .
      </EmptyState>
    );
  }

  return (
    <>
      {stats.answered > 0 ? (
        <div className="mb-4 flex items-center gap-4">
          <p className="shrink-0 text-[14px] text-[var(--ink-soft)]">
            This session:{' '}
            <span className="font-semibold text-[var(--ink)] tabular-nums">
              {stats.correct} of {stats.answered}
            </span>{' '}
            right
          </p>
          <Meter
            className="max-w-xs"
            value={stats.correct}
            max={stats.answered}
            tone={stats.correct / stats.answered >= 0.7 ? 'good' : 'warn'}
          />
        </div>
      ) : null}

      <Boundary
        fallback={<LoadingCard lines={4} />}
        message="That question could not be loaded. Reloading the page usually fixes it."
      >
        <LoadedQuestion
          key={row.id}
          row={row}
          position={{ index: cursor + 1, total: queue.length }}
          topicName={names[row.t]}
          selected={selected}
          revealed={revealed}
          onSelect={onSelect}
          onNext={next}
          nextLabel={cursor + 1 >= queue.length ? 'Finish' : 'Next question'}
        />
      </Boundary>

      {!revealed ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button tone="ghost" onClick={next}>
            Skip this one
          </Button>
          <p className="text-[14px] text-[var(--ink-soft)]">
            Press <Kbd>1</Kbd> to <Kbd>4</Kbd> to answer
          </p>
        </div>
      ) : null}
    </>
  );
}

function LoadedQuestion({
  row,
  position,
  topicName,
  selected,
  revealed,
  onSelect,
  onNext,
  nextLabel,
}: {
  row: ManifestQuestion;
  position: { index: number; total: number };
  topicName: string | undefined;
  selected: number | null;
  revealed: boolean;
  onSelect: (question: PublicQuestion, index: number) => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const questions = use(loadTopic(row.s, row.t));
  const question = questions.find((q) => q.id === row.id);

  if (!question) {
    return (
      <EmptyState title="That question is no longer in the bank">
        It was probably removed or renumbered. Move on to the next one.
      </EmptyState>
    );
  }

  return (
    <QuestionView
      question={question}
      selected={selected}
      onSelect={(index) => onSelect(question, index)}
      revealed={revealed}
      onNext={onNext}
      nextLabel={nextLabel}
      position={position}
      topicName={topicName}
    />
  );
}
