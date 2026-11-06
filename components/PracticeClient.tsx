'use client';

import { use, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Subject } from '@/lib/schema';
import { loadManifest, subjectOf, type Manifest, type ManifestQuestion } from '@/lib/data';
import { seededRandom, shuffle } from '@/lib/scoring';
import { useAppState } from '@/lib/useAppState';
import { Boundary } from './Boundary';
import { PracticeSession } from './PracticeSession';
import { Card, Field, LoadingCard, Notice, PageHeading, Select } from './ui';

export function PracticeClient() {
  return (
    <>
      {/* Outside the boundary, so the heading is in the exported HTML. */}
      <PageHeading
        title="Practice"
        lead="Pick a subject and a topic, answer, then read the worked solution before you move on."
      />
      <Boundary
        fallback={<LoadingCard lines={4} />}
        message="The question bank could not be loaded. Reloading the page usually fixes it."
      >
        <PracticeInner />
      </Boundary>
    </>
  );
}

function PracticeInner() {
  const manifest = use(loadManifest());
  const params = useSearchParams();
  const { state, ready, persisted } = useAppState();

  // A link like /practice?subject=physics&topic=P7 opens straight into that
  // topic, which is what the dashboard's "practise this" links use. Read once,
  // as the initial value, so later filter changes are not overwritten.
  const [subject, setSubject] = useState<Subject>(() =>
    params.get('subject') === 'physics' ? 'physics' : 'math',
  );
  const [topic, setTopic] = useState<string>(() => params.get('topic') ?? 'all');
  const [difficulty, setDifficulty] = useState<string>('all');

  /**
   * Bumped whenever the filters change, and used as part of the session key.
   * Generated in an event handler rather than during render, so the shuffle
   * stays reproducible for a given session and render stays pure.
   */
  const [seed, setSeed] = useState(1);

  const topics = useMemo(
    () =>
      (subjectOf(manifest, subject)?.strands ?? []).flatMap((strand) =>
        strand.topics.map((t) => ({ id: t.id, name: t.name })),
      ),
    [manifest, subject],
  );

  const matching = useMemo(
    () =>
      manifest.questions.filter(
        (q) =>
          q.s === subject &&
          (topic === 'all' || q.t === topic) &&
          (difficulty === 'all' || String(q.d) === difficulty),
      ),
    [manifest, subject, topic, difficulty],
  );

  const newSession = useCallback(() => setSeed(() => Date.now() & 0x7fffffff), []);

  return (
    <>
      {ready && !persisted ? (
        <Notice tone="warn" className="mb-5">
          <p>
            This browser is not letting the site save anything, so your progress will not be kept.
            That usually means private browsing, or blocked site data. You can still practise.
          </p>
        </Notice>
      ) : null}

      <Card className="mb-6 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Subject">
            <Select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value as Subject);
                setTopic('all');
                newSession();
              }}
            >
              {manifest.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Topic">
            <Select
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                newSession();
              }}
            >
              <option value="all">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Difficulty">
            <Select
              value={difficulty}
              onChange={(e) => {
                setDifficulty(e.target.value);
                newSession();
              }}
            >
              <option value="all">Any difficulty</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={String(d)}>
                  {d} — {manifest.difficultyLabels[String(d)] ?? ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <p className="mt-4 text-[14px] text-[var(--ink-soft)]">
          <span className="font-semibold text-[var(--ink)] tabular-nums">{matching.length}</span>{' '}
          question{matching.length === 1 ? '' : 's'} match these filters.
        </p>
      </Card>

      {/*
        The session is keyed on the filters and the seed, so changing either
        remounts it with a fresh queue. That replaces what would otherwise be an
        effect resetting five pieces of state at once.
      */}
      <PracticeSession
        key={`${subject}|${topic}|${difficulty}|${seed}`}
        pool={matching}
        seed={seed}
        manifest={manifest}
        ready={ready}
        answered={state?.attempts.map((a) => a.questionId)}
        avoidRepeats={state?.settings.avoidRepeats ?? true}
        onRestart={newSession}
      />
    </>
  );
}

/** Order the pool: unseen questions first when asked for, then the rest. */
export function buildQueue(
  pool: ManifestQuestion[],
  seed: number,
  answered: Set<string>,
  avoidRepeats: boolean,
): ManifestQuestion[] {
  const random = seededRandom(seed);
  if (!avoidRepeats) return shuffle([...pool], random);
  const fresh = shuffle(
    pool.filter((q) => !answered.has(q.id)),
    random,
  );
  const repeats = shuffle(
    pool.filter((q) => answered.has(q.id)),
    random,
  );
  return [...fresh, ...repeats];
}

export type { Manifest };
