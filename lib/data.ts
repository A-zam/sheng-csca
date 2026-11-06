'use client';

import type { Question, Subject } from './schema.ts';

/** What actually ships to the browser: a question minus its verification block. */
export type PublicQuestion = Omit<Question, 'verification'>;

export interface ManifestQuestion {
  id: string;
  s: Subject;
  t: string;
  st: string;
  d: number;
}

export interface ManifestSubtopic {
  id: string;
  name: string;
}
export interface ManifestTopic {
  id: string;
  name: string;
  subtopics: ManifestSubtopic[];
}
export interface ManifestStrand {
  id: string;
  name: string;
  topics: ManifestTopic[];
}
export interface ManifestSubject {
  id: Subject;
  name: string;
  shortName: string;
  questionCount: number;
  timeLimitMinutes: number;
  totalPoints: number;
  strands: ManifestStrand[];
}

export interface StrandBlueprint {
  total: number;
  easy: number;
  medium: number;
  complex: number;
}

export interface Manifest {
  builtAt: string;
  subjects: ManifestSubject[];
  paperBlueprint: {
    bandLevels: { easy: number[]; medium: number[]; complex: number[] };
    math: { total: number; byStrand: Record<string, StrandBlueprint> };
    physics: { total: number; byStrand: Record<string, StrandBlueprint> };
  };
  difficultyLabels: Record<string, string>;
  questions: ManifestQuestion[];
}

const BASE = '/data';

let manifestPromise: Promise<Manifest> | null = null;
const topicCache = new Map<string, Promise<PublicQuestion[]>>();

export function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(`${BASE}/manifest.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`manifest: HTTP ${response.status}`);
        return response.json() as Promise<Manifest>;
      })
      .catch((error) => {
        // Let the next attempt retry rather than caching the failure forever.
        manifestPromise = null;
        throw error;
      });
  }
  return manifestPromise;
}

export function loadTopic(subject: Subject, topic: string): Promise<PublicQuestion[]> {
  const key = `${subject}/${topic}`;
  let pending = topicCache.get(key);
  if (!pending) {
    pending = fetch(`${BASE}/q/${subject}/${topic}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`${key}: HTTP ${response.status}`);
        return response.json() as Promise<PublicQuestion[]>;
      })
      .catch((error) => {
        topicCache.delete(key);
        throw error;
      });
    topicCache.set(key, pending);
  }
  return pending;
}

const questionSetCache = new Map<string, Promise<PublicQuestion[]>>();

/**
 * Fetch whole topics in parallel, then pick out the ids asked for.
 *
 * Cached by the exact id list, because components pass the result to `use()`
 * during render: a fresh promise on every call would suspend the component on
 * every re-render, and the mock exam re-renders once a second for its clock.
 */
export function loadQuestions(rows: ManifestQuestion[]): Promise<PublicQuestion[]> {
  const key = rows.map((row) => row.id).join(',');
  let pending = questionSetCache.get(key);
  if (!pending) {
    pending = fetchQuestions(rows).catch((error: unknown) => {
      questionSetCache.delete(key);
      throw error;
    });
    questionSetCache.set(key, pending);
  }
  return pending;
}

async function fetchQuestions(rows: ManifestQuestion[]): Promise<PublicQuestion[]> {
  const topics = new Map<string, Subject>();
  for (const row of rows) topics.set(`${row.s}/${row.t}`, row.s);

  const chunks = await Promise.all(
    [...topics.keys()].map((key) => {
      const [subject, topic] = key.split('/') as [Subject, string];
      return loadTopic(subject, topic);
    }),
  );

  const byId = new Map<string, PublicQuestion>();
  for (const chunk of chunks) {
    for (const question of chunk) byId.set(question.id, question);
  }

  const out: PublicQuestion[] = [];
  for (const row of rows) {
    const question = byId.get(row.id);
    if (question) out.push(question);
  }
  return out;
}

/* --------------------------------------------------------------- selectors */

export function subjectOf(manifest: Manifest, id: Subject): ManifestSubject | undefined {
  return manifest.subjects.find((s) => s.id === id);
}

export function topicNames(manifest: Manifest, subject: Subject): Record<string, string> {
  const out: Record<string, string> = {};
  for (const strand of subjectOf(manifest, subject)?.strands ?? []) {
    for (const topic of strand.topics) out[topic.id] = topic.name;
  }
  return out;
}

export function subtopicNames(manifest: Manifest, subject: Subject): Record<string, string> {
  const out: Record<string, string> = {};
  for (const strand of subjectOf(manifest, subject)?.strands ?? []) {
    for (const topic of strand.topics) {
      for (const subtopic of topic.subtopics) out[subtopic.id] = subtopic.name;
    }
  }
  return out;
}

/** topicId -> strandId, for every subject at once. */
export function strandOfTopic(manifest: Manifest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const subject of manifest.subjects) {
    for (const strand of subject.strands) {
      for (const topic of strand.topics) out[topic.id] = strand.id;
    }
  }
  return out;
}

/** How many questions the bank actually holds per topic, from the manifest. */
export function bankCounts(manifest: Manifest, subject: Subject): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of manifest.questions) {
    if (row.s !== subject) continue;
    out[row.t] = (out[row.t] ?? 0) + 1;
  }
  return out;
}
