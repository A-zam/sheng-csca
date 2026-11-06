'use client';

import type { Subject } from './schema.ts';
import type { ReviewCard } from './srs.ts';

/**
 * Everything the site remembers lives here, in this browser, under one key.
 * No account, no server, no sync. Clearing site data clears all of it.
 */
export const STORAGE_KEY = 'csca-prep:v1';
export const STATE_VERSION = 1;

/** Keeps localStorage well under any browser's quota. */
export const MAX_ATTEMPTS = 4000;

export type PracticeMode = 'practice' | 'mock' | 'review';

export interface Attempt {
  questionId: string;
  subject: Subject;
  topic: string;
  subtopic: string;
  difficulty: number;
  correct: boolean;
  chosenIndex: number | null;
  elapsedMs: number;
  at: number;
  mode: PracticeMode;
}

export interface MockResult {
  id: string;
  subject: Subject;
  at: number;
  correct: number;
  total: number;
  scaled: number;
  scaleMax: number;
  durationMs: number;
  byTopic: Array<{ key: string; attempted: number; correct: number }>;
  /** Kept so the paper can still be reviewed question by question after a reload. */
  questionIds: string[];
  answers: Record<string, number | null>;
}

export interface ActiveMock {
  subject: Subject;
  questionIds: string[];
  answers: Record<string, number | null>;
  flagged: string[];
  startedAt: number;
  /** Milliseconds remaining when the tab was last seen. */
  endsAt: number;
  currentIndex: number;
}

export interface Settings {
  targetScore: Record<Subject, number>;
  theme: 'system' | 'light' | 'dark';
  /** Answered questions are not repeated in practice until the pool runs dry. */
  avoidRepeats: boolean;
}

export interface AppState {
  version: number;
  attempts: Attempt[];
  cards: Record<string, ReviewCard>;
  mockResults: MockResult[];
  activeMock: ActiveMock | null;
  /** The paper whose score report is currently on screen, if any. */
  lastResultId: string | null;
  settings: Settings;
}

export function emptyState(): AppState {
  return {
    version: STATE_VERSION,
    attempts: [],
    cards: {},
    mockResults: [],
    activeMock: null,
    lastResultId: null,
    settings: {
      targetScore: { math: 80, physics: 80 },
      theme: 'system',
      avoidRepeats: true,
    },
  };
}

/** Reading storage throws in some privacy modes, so every access is guarded. */
export function readState(): AppState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return migrate(parsed);
  } catch {
    return emptyState();
  }
}

export function writeState(state: AppState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const trimmed: AppState = {
      ...state,
      attempts: state.attempts.slice(-MAX_ATTEMPTS),
      mockResults: state.mockResults.slice(-200),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
}

export function clearState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Fill in anything a previous version did not store. */
export function migrate(parsed: Partial<AppState>): AppState {
  const base = emptyState();
  return {
    version: STATE_VERSION,
    attempts: Array.isArray(parsed.attempts) ? parsed.attempts : base.attempts,
    cards: isRecord(parsed.cards) ? (parsed.cards as Record<string, ReviewCard>) : base.cards,
    mockResults: Array.isArray(parsed.mockResults) ? parsed.mockResults : base.mockResults,
    activeMock: (parsed.activeMock as ActiveMock | null | undefined) ?? null,
    lastResultId: (parsed.lastResultId as string | null | undefined) ?? null,
    settings: {
      ...base.settings,
      ...(isRecord(parsed.settings) ? (parsed.settings as Partial<Settings>) : {}),
      targetScore: {
        ...base.settings.targetScore,
        ...(isRecord(parsed.settings) && isRecord((parsed.settings as Settings).targetScore)
          ? (parsed.settings as Settings).targetScore
          : {}),
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rough byte size of what is stored, for the privacy page. */
export function storageFootprint(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return (window.localStorage.getItem(STORAGE_KEY) ?? '').length;
  } catch {
    return 0;
  }
}
