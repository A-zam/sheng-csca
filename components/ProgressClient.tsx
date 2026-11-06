'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Subject } from '@/lib/schema';
import { loadManifest, subjectOf, topicNames } from '@/lib/data';
import {
  attemptsByDay,
  currentStreak,
  estimateReadiness,
  overallAccuracy,
  topicProgress,
  untouchedTopics,
  weakestTopics,
} from '@/lib/progress';
import { useAppState } from '@/lib/useAppState';
import { useNow } from '@/lib/useNow';
import { Boundary } from './Boundary';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  Figures,
  LoadingCard,
  Meter,
  PageHeading,
  SectionHeading,
  Select,
  cx,
} from './ui';
import { LINK } from './styles';

export function ProgressClient() {
  return (
    <>
      {/* Outside the boundary, so the heading is in the exported HTML. */}
      <PageHeading
        title="Progress"
        lead="Accuracy by topic, how much you have done over the last month, and an estimate against a target score you set."
      />
      <Boundary
        fallback={<LoadingCard lines={4} />}
        message="The question bank could not be loaded. Reloading the page usually fixes it."
      >
        <ProgressInner />
      </Boundary>
    </>
  );
}

function ProgressInner() {
  const manifest = use(loadManifest());
  const { state, ready, setSettings, reset } = useAppState();
  const [subject, setSubject] = useState<Subject>('math');
  const [confirmReset, setConfirmReset] = useState(false);
  // Hourly is plenty for a day streak and a 30-day activity chart.
  const now = useNow(3_600_000);

  const attempts = useMemo(() => state?.attempts ?? [], [state?.attempts]);

  // Weight each topic by how much of the real paper it occupies, so "weakest"
  // means "costing you the most marks", not merely "lowest percentage".
  const paperWeights = useMemo(() => {
    const blueprint = manifest.paperBlueprint[subject];
    const out: Record<string, number> = {};
    for (const s of subjectOf(manifest, subject)?.strands ?? []) {
      const strandTotal = blueprint.byStrand[s.id]?.total ?? 0;
      const perTopic = s.topics.length === 0 ? 0 : strandTotal / s.topics.length;
      for (const topic of s.topics) out[topic.id] = perTopic;
    }
    return out;
  }, [manifest, subject]);

  const names = useMemo(() => topicNames(manifest, subject), [manifest, subject]);

  const progress = useMemo(
    () => topicProgress(attempts, subject, names, paperWeights),
    [attempts, subject, names, paperWeights],
  );

  const subjectInfo = subjectOf(manifest, subject);
  const target = state?.settings.targetScore[subject] ?? 80;
  const readiness = estimateReadiness(progress, target, subjectInfo?.totalPoints ?? 100);
  const subjectAttempts = attempts.filter((a) => a.subject === subject);
  const days = attemptsByDay(subjectAttempts, 30, now);
  const maxDay = Math.max(1, ...days.map((d) => d.attempted));
  const weak = weakestTopics(progress);
  const untouched = untouchedTopics(progress);

  if (!ready) return <LoadingCard lines={4} />;

  if (attempts.length === 0) {
    return (
      <>
        <EmptyState
          title="Nothing to show yet"
          action={<ButtonLink href="/practice">Answer your first question</ButtonLink>}
        >
          Once you have answered a few questions, this page shows your accuracy by topic, how much
          you have done over the last month, and an estimate of where you stand against a target
          score you set.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <div className="mb-8 w-48">
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

      {subjectAttempts.length === 0 ? (
        <EmptyState
          title={`No ${subjectInfo?.name ?? subject} attempts yet`}
          action={
            <ButtonLink href={{ pathname: '/practice', query: { subject } }}>
              Practise {subjectInfo?.shortName ?? subject}
            </ButtonLink>
          }
        >
          You have worked on the other subject. Answer a few questions here and this page fills in.
        </EmptyState>
      ) : (
        <>
          <Figures
            items={[
              { label: 'Questions answered', value: subjectAttempts.length },
              {
                label: 'Answered correctly',
                value: `${(overallAccuracy(attempts, subject) * 100).toFixed(0)}%`,
              },
              { label: 'Days in a row', value: currentStreak(attempts, now) },
            ]}
          />

          {/* Readiness ---------------------------------------------------- */}
          <Card className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <SectionHeading>Readiness estimate</SectionHeading>
                <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">
                  Your accuracy in each topic, weighted by how much of the real paper that topic
                  takes up. It is an estimate from your own practice, not a prediction of your exam
                  result.
                </p>
              </div>
              <div className="w-40">
                <Field label="Target score">
                  <Select
                    value={String(target)}
                    onChange={(e) =>
                      setSettings({
                        targetScore: {
                          ...(state?.settings.targetScore ?? {
                            math: 80,
                            physics: 80,
                          }),
                          [subject]: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[50, 60, 70, 80, 90, 95].map((v) => (
                      <option key={v} value={v}>
                        {v} / {readiness.scaleMax}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div>
                <p className="font-serif text-[60px] leading-none font-semibold text-[var(--ink)] tabular-nums">
                  {readiness.projected}
                  <span className="text-[24px] text-[var(--ink-soft)]">
                    {' '}
                    / {readiness.scaleMax}
                  </span>
                </p>
                <Badge
                  tone={
                    readiness.confidence === 'high'
                      ? 'good'
                      : readiness.confidence === 'medium'
                        ? 'warn'
                        : 'neutral'
                  }
                  className="mt-1"
                >
                  {readiness.confidence} confidence
                </Badge>
              </div>
              <div className="min-w-[12rem] flex-1">
                <Meter
                  value={readiness.projected}
                  max={readiness.scaleMax}
                  tone={readiness.onTrack ? 'good' : 'warn'}
                />
                <p className="mt-3 text-[15px] text-[var(--ink-soft)]">
                  {readiness.onTrack
                    ? `On track for ${target}.`
                    : `About ${readiness.gap} point${readiness.gap === 1 ? '' : 's'} short of ${target}.`}{' '}
                  Based on {readiness.sampleSize} answer
                  {readiness.sampleSize === 1 ? '' : 's'} covering{' '}
                  {(readiness.coverage * 100).toFixed(0)}% of the paper by weight.
                </p>
                {readiness.confidence === 'low' ? (
                  <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
                    Treat this loosely until you have answered more, across more topics.
                  </p>
                ) : null}
              </div>
            </div>
          </Card>

          {/* Weakest ------------------------------------------------------ */}
          {weak.length > 0 ? (
            <Card className="mt-6">
              <SectionHeading>Worth your time next</SectionHeading>
              <p className="mt-2 max-w-[60ch] text-[15px] text-[var(--ink-soft)]">
                Ranked by how many marks a fix is worth: a weak topic that fills a lot of the paper
                beats a weak topic that barely appears.
              </p>
              <ul className="mt-5 space-y-4">
                {weak.map((t) => (
                  <li key={t.topicId}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-[16px] text-[var(--ink)]">{t.name}</span>
                      <span className="flex items-center gap-3 text-[14px] text-[var(--ink-soft)]">
                        <span className="tabular-nums">
                          {t.correct}/{t.attempted}
                        </span>
                        {!t.confident ? <Badge>few attempts</Badge> : null}
                        <Link
                          href={{
                            pathname: '/practice',
                            query: { subject, topic: t.topicId },
                          }}
                          className={LINK}
                        >
                          Practise this
                        </Link>
                      </span>
                    </div>
                    <Meter
                      className="mt-1"
                      value={t.accuracy}
                      tone={t.accuracy >= 0.7 ? 'good' : t.accuracy >= 0.4 ? 'warn' : 'bad'}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Activity ----------------------------------------------------- */}
          <Card className="mt-6">
            <SectionHeading>The last 30 days</SectionHeading>
            <div className="mt-4 flex h-24 items-end gap-[3px]" aria-hidden="true">
              {days.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col justify-end">
                  <div
                    className="w-full rounded-sm bg-[var(--brand)]"
                    style={{
                      height: `${Math.max(2, (day.attempted / maxDay) * 96)}px`,
                    }}
                    title={`${day.date}: ${day.attempted} answered, ${day.correct} correct`}
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
              {days.reduce((n, d) => n + d.attempted, 0)} questions in the last 30 days. Tallest bar
              is {maxDay} in a day.
            </p>
          </Card>

          {/* Every topic --------------------------------------------------- */}
          <Card className="mt-6">
            <SectionHeading>Accuracy by topic</SectionHeading>
            <ul className="mt-5 space-y-3.5">
              {progress.map((t) => (
                <li key={t.topicId}>
                  <div className="flex items-baseline justify-between gap-3 text-[15px]">
                    <span
                      className={cx(
                        t.attempted === 0 ? 'text-[var(--ink-soft)]' : 'text-[var(--ink)]',
                      )}
                    >
                      {t.name}
                    </span>
                    <span className="shrink-0 text-[var(--ink-soft)] tabular-nums">
                      {t.attempted === 0 ? 'not started' : `${t.correct}/${t.attempted}`}
                    </span>
                  </div>
                  <Meter
                    className="mt-1"
                    value={t.attempted === 0 ? 0 : t.accuracy}
                    tone={t.accuracy >= 0.7 ? 'good' : t.accuracy >= 0.4 ? 'warn' : 'bad'}
                  />
                </li>
              ))}
            </ul>
            {untouched.length > 0 ? (
              <p className="mt-6 max-w-[68ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">
                <strong className="font-medium text-[var(--ink)]">
                  {untouched.length} topic{untouched.length === 1 ? '' : 's'} untouched.
                </strong>{' '}
                The biggest is{' '}
                <Link
                  href={{
                    pathname: '/practice',
                    query: { subject, topic: untouched[0]?.topicId ?? '' },
                  }}
                  className={LINK}
                >
                  {untouched[0]?.name}
                </Link>
                . Your readiness estimate assumes you would do about as well there as everywhere
                else, which is a guess until you try.
              </p>
            ) : null}
          </Card>
        </>
      )}

      {/* Data ----------------------------------------------------------- */}
      <section className="mt-10 border-t border-[var(--line)] pt-6">
        <SectionHeading>Your data</SectionHeading>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-soft)]">
          {attempts.length} answers and {Object.keys(state?.cards ?? {}).length} review cards,
          stored in this browser only. Nothing has been sent anywhere.
        </p>
        <div className="mt-4">
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[15px] text-[var(--ink)]">
                Erase all progress on this device? This cannot be undone.
              </span>
              <Button
                tone="danger"
                onClick={() => {
                  reset();
                  setConfirmReset(false);
                }}
              >
                Erase everything
              </Button>
              <Button tone="secondary" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button tone="secondary" onClick={() => setConfirmReset(true)}>
              Reset my progress
            </Button>
          )}
        </div>
      </section>
    </>
  );
}
