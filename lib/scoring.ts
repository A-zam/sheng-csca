import type { Subject } from './schema.ts';

/**
 * The fields scoring and paper-building actually read.
 *
 * Both the full `Question` and the trimmed `PublicQuestion` that ships to the
 * browser satisfy this, so the same code runs in the scripts and in the app
 * without the verification block having to exist client-side.
 */
export interface ScorableQuestion {
  id: string;
  subject: Subject;
  topic: string;
  subtopic: string;
  difficulty: number;
  correctIndex: number;
}

export interface AnswerRecord {
  questionId: string;
  /** null means the question was left blank. */
  chosenIndex: number | null;
  /** Milliseconds spent on this question. */
  elapsedMs?: number;
}

export interface ScoredAnswer extends AnswerRecord {
  correctIndex: number;
  correct: boolean;
  answered: boolean;
  topic: string;
  subtopic: string;
  difficulty: number;
}

export interface GroupResult {
  key: string;
  label: string;
  attempted: number;
  correct: number;
  accuracy: number;
}

export interface ExamScore {
  subject: Subject;
  total: number;
  answered: number;
  unanswered: number;
  correct: number;
  incorrect: number;
  percent: number;
  /** Scaled to the paper's own scale, e.g. 100 points for a 48-question CSCA paper. */
  scaled: number;
  scaleMax: number;
  byTopic: GroupResult[];
  byDifficulty: GroupResult[];
  answers: ScoredAnswer[];
}

export interface ScoreOptions {
  subject: Subject;
  scaleMax: number;
  topicNames?: Record<string, string>;
}

/**
 * Score a completed paper.
 *
 * One mark per correct answer, zero for wrong or blank. No source consulted
 * states a penalty for guessing and no reference paper shows one, so the app
 * does not apply one, and tells the user to answer everything.
 */
export function scoreExam(
  questions: ScorableQuestion[],
  answers: AnswerRecord[],
  options: ScoreOptions,
): ExamScore {
  const byId = new Map(answers.map((a) => [a.questionId, a]));

  const scored: ScoredAnswer[] = questions.map((question) => {
    const answer = byId.get(question.id);
    const chosenIndex = answer?.chosenIndex ?? null;
    return {
      questionId: question.id,
      chosenIndex,
      elapsedMs: answer?.elapsedMs,
      correctIndex: question.correctIndex,
      correct: chosenIndex === question.correctIndex,
      answered: chosenIndex !== null,
      topic: question.topic,
      subtopic: question.subtopic,
      difficulty: question.difficulty,
    };
  });

  const total = scored.length;
  const correct = scored.filter((a) => a.correct).length;
  const answered = scored.filter((a) => a.answered).length;
  const percent = total === 0 ? 0 : (correct / total) * 100;

  return {
    subject: options.subject,
    total,
    answered,
    unanswered: total - answered,
    correct,
    incorrect: answered - correct,
    percent,
    scaled: total === 0 ? 0 : Math.round((correct / total) * options.scaleMax),
    scaleMax: options.scaleMax,
    byTopic: group(scored, (a) => a.topic, options.topicNames),
    byDifficulty: group(scored, (a) => `d${a.difficulty}`, DIFFICULTY_LABELS),
    answers: scored,
  };
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  d1: 'Recall',
  d2: 'Single step',
  d3: 'Standard',
  d4: 'Multi-step',
  d5: 'Challenging',
};

function group(
  answers: ScoredAnswer[],
  keyOf: (a: ScoredAnswer) => string,
  labels?: Record<string, string>,
): GroupResult[] {
  const buckets = new Map<string, { attempted: number; correct: number }>();
  for (const answer of answers) {
    const key = keyOf(answer);
    const bucket = buckets.get(key) ?? { attempted: 0, correct: 0 };
    bucket.attempted += 1;
    if (answer.correct) bucket.correct += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: labels?.[key] ?? key,
      attempted: bucket.attempted,
      correct: bucket.correct,
      accuracy: bucket.attempted === 0 ? 0 : bucket.correct / bucket.attempted,
    }))
    .sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }));
}

export interface BlueprintInput {
  total: number;
  byStrand: Record<string, { total: number; easy: number; medium: number; complex: number }>;
}

export interface BandLevels {
  easy: number[];
  medium: number[];
  complex: number[];
}

export const BANDS = ['easy', 'medium', 'complex'] as const;
export type Band = (typeof BANDS)[number];

export function bandOf(difficulty: number, bandLevels: BandLevels): Band {
  for (const band of BANDS) {
    if (bandLevels[band].includes(difficulty)) return band;
  }
  return 'medium';
}

/**
 * Build a mock paper with the same shape as the real thing: the blueprint's
 * question count per strand, its easy/medium/complex split inside each strand,
 * spread across as many subtopics as possible, and the easy-to-hard ramp real
 * papers use.
 *
 * Where the bank cannot fill a bucket, the shortfall is backfilled — first from
 * the same strand at another difficulty, then from anywhere at the right
 * difficulty, then from anywhere at all — so a paper is always full length.
 */
export function buildMockPaper<T extends ScorableQuestion>(
  pool: T[],
  blueprint: BlueprintInput,
  strandOf: Record<string, string>,
  bandLevels: BandLevels,
  random: () => number = Math.random,
): T[] {
  if (pool.length === 0) return [];

  const key = (strand: string, band: Band) => `${strand}|${band}`;
  const buckets = new Map<string, T[]>();
  for (const question of pool) {
    const strand = strandOf[question.topic] ?? '?';
    const band = bandOf(question.difficulty, bandLevels);
    const k = key(strand, band);
    buckets.set(k, [...(buckets.get(k) ?? []), question]);
  }
  // Spread within a bucket across subtopics before repeating one.
  for (const [k, items] of buckets) buckets.set(k, spreadBySubtopic(items, random));

  const picked: T[] = [];
  const used = new Set<string>();

  const take = (candidates: T[], n: number) => {
    let taken = 0;
    for (const question of candidates) {
      if (taken >= n) break;
      if (used.has(question.id)) continue;
      used.add(question.id);
      picked.push(question);
      taken += 1;
    }
    return taken;
  };

  const strands = Object.keys(blueprint.byStrand).sort();

  // Pass 1: exactly what the blueprint asks for.
  for (const strand of strands) {
    const want = blueprint.byStrand[strand];
    if (!want) continue;
    for (const band of BANDS) {
      take(buckets.get(key(strand, band)) ?? [], want[band]);
    }
  }

  // Pass 2: top each strand up to its total from its own other difficulties.
  for (const strand of strands) {
    const want = blueprint.byStrand[strand];
    if (!want) continue;
    const have = picked.filter((q) => (strandOf[q.topic] ?? '?') === strand).length;
    if (have >= want.total) continue;
    const rest = BANDS.flatMap((band) => buckets.get(key(strand, band)) ?? []);
    take(shuffle([...rest], random), want.total - have);
  }

  // Pass 3: fill the paper from anywhere left in the pool.
  if (picked.length < blueprint.total) {
    take(shuffle([...pool], random), blueprint.total - picked.length);
  }

  const wanted = Math.min(blueprint.total, pool.length);
  const paper = picked.slice(0, wanted);

  // Ramp from easy to hard, breaking ties randomly so two sittings differ.
  const jitter = new Map(paper.map((q) => [q.id, random()]));
  return paper.sort(
    (a, b) => a.difficulty - b.difficulty || (jitter.get(a.id) ?? 0) - (jitter.get(b.id) ?? 0),
  );
}

/** Round-robin across subtopics so one subtopic cannot dominate a bucket. */
function spreadBySubtopic<T extends ScorableQuestion>(items: T[], random: () => number): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(item.subtopic, [...(groups.get(item.subtopic) ?? []), item]);
  }
  for (const [, group] of groups) shuffle(group, random);
  const keys = shuffle([...groups.keys()], random);

  const out: T[] = [];
  let more = true;
  let round = 0;
  while (more) {
    more = false;
    for (const k of keys) {
      const group = groups.get(k) as T[];
      const item = group[round];
      if (item) {
        out.push(item);
        more = true;
      }
    }
    round += 1;
  }
  return out;
}

/** topicId -> strandId, read off the syllabus. */
export function strandIndex(
  subjects: Array<{
    strands: Array<{ id: string; topics: Array<{ id: string }> }>;
  }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const subject of subjects) {
    for (const strand of subject.strands) {
      for (const topic of strand.topics) out[topic.id] = strand.id;
    }
  }
  return out;
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = items[i] as T;
    const b = items[j] as T;
    items[i] = b;
    items[j] = a;
  }
  return items;
}

/** Deterministic PRNG, so a seeded mock paper reproduces exactly. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}
