'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  loadManifest,
  loadTopic,
  topicNames,
  type Manifest,
  type ManifestQuestion,
  type PublicQuestion,
} from '@/lib/data';
import { describeInterval, dueQueue, isLearned, nextDueAt, type ReviewCard } from '@/lib/srs';
import { useAppState } from '@/lib/useAppState';
import { useNow } from '@/lib/useNow';
import { Boundary } from './Boundary';
import { QuestionView } from './QuestionView';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Figures,
  LoadingCard,
  Meter,
  Notice,
  PageHeading,
  SectionHeading,
} from './ui';
import { LINK } from './styles';

export function ReviewClient() {
  return (
    <>
      {/* Outside the boundary, so the heading is in the exported HTML. */}
      <PageHeading
        title="Review"
        lead="Every question you get wrong lands here. It comes back tomorrow, then at widening intervals for as long as you keep getting it right."
      />
      <Boundary
        fallback={<LoadingCard lines={4} />}
        message="The question bank could not be loaded. Reloading the page usually fixes it."
      >
        <ReviewInner />
      </Boundary>
    </>
  );
}

function ReviewInner() {
  const manifest = use(loadManifest());
  const { state, ready, recordAttempt } = useAppState();
  // A minute is ample: this only decides which cards have come due.
  const now = useNow(60_000);

  const [running, setRunning] = useState(false);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState({ answered: 0, correct: 0 });
  const shownAt = useRef(0);

  const cards = useMemo(() => Object.values(state?.cards ?? {}), [state?.cards]);
  const due = useMemo(() => dueQueue(cards, now), [cards, now]);
  const learned = cards.filter(isLearned);
  const pending = cards.filter((c) => !isLearned(c));

  const rowFor = useCallback(
    (id: string) => manifest.questions.find((q) => q.id === id),
    [manifest],
  );

  const currentId = queueIds[cursor];
  const currentRow = currentId ? rowFor(currentId) : undefined;

  // Stamp when each question appeared, for the speed half of the SM-2 grade.
  useEffect(() => {
    shownAt.current = Date.now();
  }, [currentId]);

  const startSession = () => {
    setQueueIds(due.map((c) => c.questionId));
    setCursor(0);
    setSelected(null);
    setRevealed(false);
    setDone({ answered: 0, correct: 0 });
    setRunning(true);
  };

  const onSelect = (question: PublicQuestion, index: number) => {
    if (revealed) return;
    const row = rowFor(question.id);
    if (!row) return;
    const correct = index === question.correctIndex;
    setSelected(index);
    setRevealed(true);
    setDone((d) => ({
      answered: d.answered + 1,
      correct: d.correct + (correct ? 1 : 0),
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
      mode: 'review',
    });
  };

  const advance = () => {
    setSelected(null);
    setRevealed(false);
    setCursor((c) => c + 1);
  };

  if (!ready) return <LoadingCard lines={4} />;

  if (running) {
    const finished = cursor >= queueIds.length;
    return (
      <>
        <div className="mb-5 flex justify-end">
          <Button tone="secondary" onClick={() => setRunning(false)}>
            Stop for now
          </Button>
        </div>
        {finished ? (
          <EmptyState
            title="Review done for now"
            action={<Button onClick={() => setRunning(false)}>Back to the bank</Button>}
          >
            {done.correct} of {done.answered} right. Anything you missed comes back tomorrow;
            anything you got right moves further out.
          </EmptyState>
        ) : !currentRow ? (
          <EmptyState
            title="That question is no longer in the bank"
            action={<Button onClick={advance}>Skip it</Button>}
          >
            It was removed or renumbered since you last saw it.
          </EmptyState>
        ) : (
          <Boundary
            fallback={<LoadingCard lines={4} />}
            message="That question could not be loaded. Reloading the page usually fixes it."
          >
            <ReviewQuestion
              key={currentRow.id}
              row={currentRow}
              manifest={manifest}
              selected={selected}
              revealed={revealed}
              onSelect={onSelect}
              onNext={advance}
              nextLabel={cursor + 1 >= queueIds.length ? 'Finish review' : 'Next'}
              position={{ index: cursor + 1, total: queueIds.length }}
            />
          </Boundary>
        )}
      </>
    );
  }

  const next = nextDueAt(cards);

  return (
    <>
      {cards.length === 0 ? (
        <EmptyState
          title="Nothing to review yet"
          action={<ButtonLink href="/practice">Start practising</ButtonLink>}
        >
          Questions arrive here the first time you answer one wrongly. Get a few wrong and this page
          starts doing its job.
        </EmptyState>
      ) : (
        <>
          <Figures
            items={[
              { label: 'Due now', value: due.length },
              { label: 'Still learning', value: pending.length },
              {
                label: 'Retired',
                value: learned.length,
                note: 'Not due again for 60+ days',
              },
            ]}
          />

          <div className="mt-6">
            {due.length > 0 ? (
              <Button onClick={startSession}>
                Review {due.length} question{due.length === 1 ? '' : 's'}
              </Button>
            ) : (
              <Notice>
                <p>
                  Nothing is due right now.{' '}
                  {next
                    ? `The next question comes back ${describeInterval(Math.ceil((next - now) / 86_400_000))}.`
                    : ''}{' '}
                  <Link href="/practice" className={LINK}>
                    Practise something new
                  </Link>{' '}
                  in the meantime.
                </p>
              </Notice>
            )}
          </div>

          <BankList cards={cards} manifest={manifest} now={now} />
        </>
      )}
    </>
  );
}

function ReviewQuestion({
  row,
  manifest,
  selected,
  revealed,
  onSelect,
  onNext,
  nextLabel,
  position,
}: {
  row: ManifestQuestion;
  manifest: Manifest;
  selected: number | null;
  revealed: boolean;
  onSelect: (question: PublicQuestion, index: number) => void;
  onNext: () => void;
  nextLabel: string;
  position: { index: number; total: number };
}) {
  const questions = use(loadTopic(row.s, row.t));
  const question = questions.find((q) => q.id === row.id);

  if (!question) {
    return (
      <EmptyState
        title="That question is no longer in the bank"
        action={<Button onClick={onNext}>Skip it</Button>}
      >
        It was removed or renumbered since you last saw it.
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
      topicName={topicNames(manifest, row.s)[question.topic]}
    />
  );
}

function BankList({
  cards,
  manifest,
  now,
}: {
  cards: ReviewCard[];
  manifest: Manifest;
  now: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...cards].sort((a, b) => a.dueAt - b.dueAt);
  const visible = showAll ? sorted : sorted.slice(0, 12);
  const names = {
    ...topicNames(manifest, 'math'),
    ...topicNames(manifest, 'physics'),
  };

  return (
    <Card className="mt-8">
      <SectionHeading>Every question in the bank</SectionHeading>
      <ul className="mt-4 divide-y divide-[var(--line)]">
        {visible.map((card) => {
          const row = manifest.questions.find((q) => q.id === card.questionId);
          const days = Math.ceil((card.dueAt - now) / 86_400_000);
          return (
            <li
              key={card.questionId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
            >
              <span className="min-w-0 flex-1 text-[15px] text-[var(--ink)]">
                {row ? (names[row.t] ?? row.t) : card.questionId}
              </span>
              {card.lapses > 0 ? (
                <Badge tone="bad">
                  {card.lapses} miss{card.lapses === 1 ? '' : 'es'}
                </Badge>
              ) : null}
              <span className="shrink-0 text-[14px] text-[var(--ink-soft)]">
                {isLearned(card)
                  ? 'Retired'
                  : card.dueAt <= now
                    ? 'Due now'
                    : `Due ${describeInterval(days)}`}
              </span>
              <div className="w-full">
                <Meter
                  value={Math.min(card.intervalDays, 60)}
                  max={60}
                  tone={card.lapses > 1 ? 'bad' : card.intervalDays >= 6 ? 'good' : 'warn'}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {sorted.length > 12 ? (
        <Button tone="ghost" className="mt-2 px-0" onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show fewer' : `Show all ${sorted.length}`}
        </Button>
      ) : null}
    </Card>
  );
}
