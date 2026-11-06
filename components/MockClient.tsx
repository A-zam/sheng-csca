'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Subject } from '@/lib/schema';
import {
  loadManifest,
  loadQuestions,
  subjectOf,
  topicNames,
  strandOfTopic,
  type Manifest,
  type PublicQuestion,
} from '@/lib/data';
import { buildMockPaper, scoreExam, type AnswerRecord } from '@/lib/scoring';
import { useAppState } from '@/lib/useAppState';
import { useNow } from '@/lib/useNow';
import type { ActiveMock, MockResult } from '@/lib/storage';
import { Boundary } from './Boundary';
import { QuestionView } from './QuestionView';
import {
  Badge,
  Bubble,
  Button,
  Card,
  cx,
  Field,
  Figures,
  LoadingCard,
  Meter,
  PageHeading,
  SectionHeading,
  Select,
} from './ui';
import { LINK } from './styles';
import { OPTION_LABELS } from './QuestionView';

export function MockClient() {
  return (
    <>
      {/* Outside the boundary, so the heading is in the exported HTML. */}
      <PageHeading
        title="Mock exam"
        lead="A full paper under exam conditions: the real question count, the real time limit, and no feedback until you submit."
      />
      <Boundary
        fallback={<LoadingCard lines={4} />}
        message="The question bank could not be loaded. Reloading the page usually fixes it."
      >
        <MockInner />
      </Boundary>
    </>
  );
}

/**
 * Which screen to show is derived from stored state rather than from a `phase`
 * variable kept in sync by effects: an exam in progress means the runner, a
 * stored result id means the score report, neither means the setup screen.
 * A reload therefore lands the user exactly where they were.
 */
function MockInner() {
  const manifest = use(loadManifest());
  const { state, ready, setActiveMock, addMockResult, dismissResult, recordAttempt } =
    useAppState();
  const now = useNow(1000);

  const [subject, setSubject] = useState<Subject>('math');
  const [busy, setBusy] = useState(false);

  const active = state?.activeMock ?? null;
  const lastResultId = state?.lastResultId ?? null;
  const mockResults = useMemo(() => state?.mockResults ?? [], [state?.mockResults]);
  const result = useMemo(
    () => (lastResultId ? (mockResults.find((r) => r.id === lastResultId) ?? null) : null),
    [lastResultId, mockResults],
  );

  const subjectInfo = subjectOf(manifest, subject);

  const start = useCallback(async () => {
    if (!subjectInfo) return;
    setBusy(true);
    try {
      const pool = manifest.questions.filter((q) => q.s === subject);
      const full = await loadQuestions(pool);
      const paper = buildMockPaper(
        full,
        manifest.paperBlueprint[subject],
        strandOfTopic(manifest),
        manifest.paperBlueprint.bandLevels,
      );

      const startedAt = Date.now();
      setActiveMock({
        subject,
        questionIds: paper.map((q) => q.id),
        answers: Object.fromEntries(paper.map((q) => [q.id, null])),
        flagged: [],
        startedAt,
        endsAt: startedAt + subjectInfo.timeLimitMinutes * 60_000,
        currentIndex: 0,
      });
    } finally {
      setBusy(false);
    }
  }, [manifest, setActiveMock, subject, subjectInfo]);

  if (!ready) return <LoadingCard lines={4} />;

  if (active) {
    return (
      <Boundary fallback={<LoadingCard lines={4} />} message="The paper could not be loaded.">
        <MockRunner
          active={active}
          manifest={manifest}
          now={now}
          onChange={setActiveMock}
          onFinish={addMockResult}
          onLog={recordAttempt}
        />
      </Boundary>
    );
  }

  if (result) {
    return <MockResultView result={result} manifest={manifest} onAgain={dismissResult} />;
  }

  return (
    <>
      {mockResults.length > 0 ? <PastResults results={mockResults} manifest={manifest} /> : null}

      <Card className="mt-6">
        <div className="max-w-xs">
          <Field label="Subject">
            <Select value={subject} onChange={(e) => setSubject(e.target.value as Subject)}>
              {manifest.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {subjectInfo ? (
          <Figures
            className="mt-6"
            items={[
              { label: 'Questions', value: subjectInfo.questionCount },
              { label: 'Minutes', value: subjectInfo.timeLimitMinutes },
              { label: 'Marks available', value: subjectInfo.totalPoints },
            ]}
          />
        ) : null}

        <ul className="mt-6 max-w-[64ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-[var(--ink-soft)] marker:text-[var(--pen)]">
          <li>You can move freely between questions and flag any to come back to.</li>
          <li>
            Nothing is marked until you submit. When the clock runs out the paper submits itself.
          </li>
          <li>
            There is no penalty for a wrong answer, so answer everything — a guess costs nothing.
          </li>
          <li>If you close the tab, the exam is still here when you come back, clock and all.</li>
        </ul>

        <div className="mt-7">
          <Button onClick={start} disabled={busy}>
            {busy ? 'Building your paper…' : 'Start the exam'}
          </Button>
        </div>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ runner */

function MockRunner({
  active,
  manifest,
  now,
  onChange,
  onFinish,
  onLog,
}: {
  active: ActiveMock;
  manifest: Manifest;
  now: number;
  onChange: (mock: ActiveMock) => void;
  onFinish: (result: MockResult) => void;
  onLog: ReturnType<typeof useAppState>['recordAttempt'];
}) {
  const rows = useMemo(
    () =>
      active.questionIds
        .map((id) => manifest.questions.find((q) => q.id === id))
        .filter((q): q is NonNullable<typeof q> => Boolean(q)),
    [active.questionIds, manifest.questions],
  );
  const questions = use(loadQuestions(rows));

  const [confirming, setConfirming] = useState(false);
  const names = useMemo(() => topicNames(manifest, active.subject), [manifest, active.subject]);
  const subjectInfo = subjectOf(manifest, active.subject);

  const submit = useCallback(() => {
    if (!subjectInfo) return;
    const answers: AnswerRecord[] = questions.map((q) => ({
      questionId: q.id,
      chosenIndex: active.answers[q.id] ?? null,
    }));
    const score = scoreExam(questions, answers, {
      subject: active.subject,
      scaleMax: subjectInfo.totalPoints,
      topicNames: names,
    });

    const finishedAt = Date.now();
    const perQuestion = Math.round((finishedAt - active.startedAt) / Math.max(1, questions.length));

    // Log every question, blanks included, so the mistake bank and the
    // dashboard see the whole paper rather than only what was attempted.
    for (const q of questions) {
      const chosen = active.answers[q.id] ?? null;
      onLog({
        questionId: q.id,
        subject: q.subject,
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        correct: chosen === q.correctIndex,
        chosenIndex: chosen,
        elapsedMs: perQuestion,
        at: finishedAt,
        mode: 'mock',
      });
    }

    onFinish({
      id: `mock-${active.startedAt}`,
      subject: active.subject,
      at: finishedAt,
      correct: score.correct,
      total: score.total,
      scaled: score.scaled,
      scaleMax: score.scaleMax,
      durationMs: finishedAt - active.startedAt,
      byTopic: score.byTopic.map((t) => ({
        key: t.key,
        attempted: t.attempted,
        correct: t.correct,
      })),
      questionIds: active.questionIds,
      answers: active.answers,
    });
  }, [active, names, onFinish, onLog, questions, subjectInfo]);

  // Time is up: submit whatever is there, exactly as the real thing would.
  // This writes only to the stored state, never to component state, so it
  // cannot cascade renders.
  const expired = now >= active.endsAt;
  useEffect(() => {
    if (expired) submit();
  }, [expired, submit]);

  const index = Math.min(active.currentIndex, questions.length - 1);
  const question = questions[index];
  const remaining = Math.max(0, active.endsAt - now);
  const answered = Object.values(active.answers).filter((a) => a !== null).length;
  const lowTime = remaining < 5 * 60_000;

  const go = (next: number) =>
    onChange({
      ...active,
      currentIndex: Math.max(0, Math.min(questions.length - 1, next)),
    });

  if (!question) return <LoadingCard />;

  return (
    <>
      <div className="sticky top-[var(--header-h)] z-30 -mx-4 mb-5 border-b border-[var(--line)] bg-[var(--paper)]/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span
              className={cx(
                'font-serif text-[32px] leading-none font-semibold tabular-nums',
                lowTime ? 'text-[var(--pen)]' : 'text-[var(--ink)]',
              )}
              role="timer"
            >
              {formatClock(remaining)}
            </span>
            <span className="text-[14px] text-[var(--ink-soft)]">left</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[14px] text-[var(--ink-soft)] tabular-nums">
              {answered} of {questions.length} answered
            </span>
            <Button tone="secondary" onClick={() => setConfirming(true)}>
              Submit
            </Button>
          </div>
        </div>
        <Meter
          className="mt-2"
          value={answered}
          max={questions.length}
          tone={lowTime ? 'bad' : 'brand'}
        />
      </div>

      {confirming ? (
        <Card className="mb-5 border-[var(--brand)]">
          <p className="text-[16px] text-[var(--ink)]">
            Submit the paper?{' '}
            {answered < questions.length ? (
              <>
                <strong className="font-semibold">
                  {questions.length - answered} question
                  {questions.length - answered === 1 ? ' is' : 's are'} still blank.
                </strong>{' '}
                There is no penalty for guessing, so it is worth filling them in first.
              </>
            ) : (
              'Every question is answered.'
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={submit}>Submit and see my score</Button>
            <Button tone="secondary" onClick={() => setConfirming(false)}>
              Keep working
            </Button>
          </div>
        </Card>
      ) : null}

      <QuestionView
        question={question}
        selected={active.answers[question.id] ?? null}
        onSelect={(choice) =>
          onChange({
            ...active,
            answers: { ...active.answers, [question.id]: choice },
          })
        }
        revealed={false}
        position={{ index: index + 1, total: questions.length }}
        topicName={names[question.topic]}
        flagged={active.flagged.includes(question.id)}
        onToggleFlag={() =>
          onChange({
            ...active,
            flagged: active.flagged.includes(question.id)
              ? active.flagged.filter((id) => id !== question.id)
              : [...active.flagged, question.id],
          })
        }
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button tone="secondary" onClick={() => go(index - 1)} disabled={index === 0}>
          Previous
        </Button>
        <Button
          tone="secondary"
          onClick={() => go(index + 1)}
          disabled={index === questions.length - 1}
        >
          Next
        </Button>
      </div>

      <Card className="mt-6 border-[var(--pen)]/45">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--pen)]/35 pb-3">
          <h2 className="font-serif text-[18px] font-semibold text-[var(--pen)]">Answer card</h2>
          <p className="text-[13px] text-[var(--ink-soft)]">Choose a row to go to that question</p>
        </div>
        <ol className="mt-4 grid grid-flow-col grid-rows-[repeat(24,auto)] gap-x-4 gap-y-1 sm:grid-rows-[repeat(12,auto)]">
          {questions.map((q, i) => {
            const choice = active.answers[q.id];
            const isAnswered = choice !== null && choice !== undefined;
            const isFlagged = active.flagged.includes(q.id);
            const isCurrent = i === index;
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Question ${i + 1}${isAnswered ? `, answered ${OPTION_LABELS[choice] ?? ''}` : ', not answered'}${isFlagged ? ', flagged' : ''}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={cx(
                    'flex w-full items-center gap-1 rounded-[3px] px-1 py-1 transition-colors',
                    isCurrent
                      ? 'outline-2 outline-[var(--brand)]'
                      : isFlagged
                        ? ''
                        : 'hover:bg-[var(--paper)]',
                    isFlagged ? 'bg-[var(--highlight)]/70' : '',
                  )}
                >
                  <span
                    className={cx(
                      'w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums',
                      isCurrent ? 'text-[var(--brand)]' : 'text-[var(--pen)]',
                    )}
                  >
                    {i + 1}
                  </span>
                  {OPTION_LABELS.map((letter, li) => (
                    <Bubble
                      key={letter}
                      letter={letter}
                      size="sm"
                      state={choice === li ? 'filled' : 'empty'}
                    />
                  ))}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-[13px] leading-relaxed text-[var(--ink-soft)]">
          A filled bubble is your answer. Yellow rows are flagged, and the outlined row is the
          question on screen.
        </p>
      </Card>
    </>
  );
}

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ result */

function MockResultView({
  result,
  manifest,
  onAgain,
}: {
  result: MockResult;
  manifest: Manifest;
  onAgain: () => void;
}) {
  const names = useMemo(() => topicNames(manifest, result.subject), [manifest, result.subject]);
  const [reviewing, setReviewing] = useState(false);
  const percent = result.total === 0 ? 0 : (result.correct / result.total) * 100;

  const weakest = [...result.byTopic]
    .filter((t) => t.attempted > 0)
    .sort((a, b) => a.correct / a.attempted - b.correct / b.attempted)
    .slice(0, 3);

  return (
    <>
      <p className="mb-6 text-[16px] text-[var(--ink-soft)]">
        {result.subject === 'math' ? 'Mathematics' : 'Physics'} mock, finished in{' '}
        {Math.round(result.durationMs / 60000)} minutes.
      </p>

      <Card>
        <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
          <div>
            <p className="font-serif text-[72px] leading-none font-semibold text-[var(--ink)] tabular-nums">
              {result.scaled}
              <span className="text-[28px] text-[var(--ink-soft)]"> / {result.scaleMax}</span>
            </p>
            <p className="mt-2 text-[15px] text-[var(--ink-soft)]">Your score</p>
          </div>
          <div>
            <p className="font-serif text-[36px] leading-none font-semibold text-[var(--ink)] tabular-nums">
              {result.correct}
              <span className="text-[20px] text-[var(--ink-soft)]"> / {result.total}</span>
            </p>
            <p className="mt-2 text-[15px] text-[var(--ink-soft)]">Questions right</p>
          </div>
          <div className="min-w-[10rem] flex-1">
            <Meter
              value={percent}
              max={100}
              tone={percent >= 70 ? 'good' : percent >= 50 ? 'warn' : 'bad'}
            />
            <p className="mt-2 text-[14px] text-[var(--ink-soft)] tabular-nums">
              {percent.toFixed(0)}% correct
            </p>
          </div>
        </div>
      </Card>

      {weakest.length > 0 ? (
        <Card className="mt-6">
          <SectionHeading>Where to look first</SectionHeading>
          <ul className="mt-4 space-y-3">
            {weakest.map((t) => (
              <li key={t.key} className="flex flex-wrap items-center gap-3 text-[16px]">
                <span className="text-[var(--ink)]">{names[t.key] ?? t.key}</span>
                <Badge tone={t.correct / t.attempted >= 0.5 ? 'warn' : 'bad'}>
                  {t.correct}/{t.attempted}
                </Badge>
                <Link
                  href={{
                    pathname: '/practice',
                    query: { subject: result.subject, topic: t.key },
                  }}
                  className={cx(LINK, 'text-[14px]')}
                >
                  Practise this topic
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-6">
        <SectionHeading>Every topic on this paper</SectionHeading>
        <ul className="mt-5 space-y-3.5">
          {result.byTopic.map((t) => {
            const accuracy = t.attempted === 0 ? 0 : t.correct / t.attempted;
            return (
              <li key={t.key}>
                <div className="flex items-baseline justify-between gap-3 text-[15px]">
                  <span className="text-[var(--ink)]">{names[t.key] ?? t.key}</span>
                  <span className="shrink-0 text-[var(--ink-soft)] tabular-nums">
                    {t.correct}/{t.attempted}
                  </span>
                </div>
                <Meter
                  className="mt-1"
                  value={accuracy}
                  tone={accuracy >= 0.7 ? 'good' : accuracy >= 0.4 ? 'warn' : 'bad'}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="mt-7 flex flex-wrap gap-3">
        <Button onClick={onAgain}>Sit another paper</Button>
        <Button tone="secondary" onClick={() => setReviewing((r) => !r)}>
          {reviewing ? 'Hide the paper' : 'Go through the paper'}
        </Button>
      </div>

      {reviewing ? (
        <Boundary fallback={<LoadingCard lines={4} />} message="The paper could not be loaded.">
          <PaperReview result={result} manifest={manifest} names={names} />
        </Boundary>
      ) : null}
    </>
  );
}

function PaperReview({
  result,
  manifest,
  names,
}: {
  result: MockResult;
  manifest: Manifest;
  names: Record<string, string>;
}) {
  const rows = useMemo(
    () =>
      result.questionIds
        .map((id) => manifest.questions.find((q) => q.id === id))
        .filter((q): q is NonNullable<typeof q> => Boolean(q)),
    [result.questionIds, manifest.questions],
  );
  const questions: PublicQuestion[] = use(loadQuestions(rows));

  return (
    <div className="mt-6 space-y-4">
      {questions.map((question, i) => (
        <QuestionView
          key={question.id}
          question={question}
          selected={result.answers[question.id] ?? null}
          onSelect={() => undefined}
          revealed
          position={{ index: i + 1, total: questions.length }}
          topicName={names[question.topic]}
          keyboard={false}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ past results */

function PastResults({ results, manifest }: { results: MockResult[]; manifest: Manifest }) {
  const recent = [...results].reverse().slice(0, 5);
  return (
    <Card>
      <SectionHeading>Your recent papers</SectionHeading>
      <ul className="mt-4 divide-y divide-[var(--line)]">
        {recent.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3 text-[15px]"
          >
            <span className="text-[var(--ink)]">
              {subjectOf(manifest, r.subject)?.name ?? r.subject}
            </span>
            <span className="flex items-center gap-3 text-[var(--ink-soft)]">
              <span className="tabular-nums">
                {new Date(r.at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <Badge tone={r.scaled >= 70 ? 'good' : r.scaled >= 50 ? 'warn' : 'bad'}>
                {r.scaled}/{r.scaleMax}
              </Badge>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
