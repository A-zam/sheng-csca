'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  clearState,
  emptyState,
  readState,
  writeState,
  STORAGE_KEY,
  type ActiveMock,
  type AppState,
  type Attempt,
  type MockResult,
  type Settings,
} from './storage.ts';
import { createCard, gradeFromAttempt, isLearned, reviewCard } from './srs.ts';

/**
 * localStorage is an external store, so it is read through
 * `useSyncExternalStore` rather than through an effect.
 *
 * That buys three things over the effect-plus-setState version: the server and
 * the first client render agree without a hydration mismatch, every component
 * reading the store re-renders together, and a change made in another tab
 * arrives through the `storage` event instead of going unnoticed.
 */

/** Frozen so the server snapshot is referentially stable across renders. */
const SERVER_SNAPSHOT: AppState = Object.freeze(emptyState());

/**
 * Read once at module load, not lazily inside getSnapshot.
 *
 * getSnapshot runs during render, and writing to module scope there is a side
 * effect React is entitled to run twice or discard. Module evaluation happens
 * before any render, and readState() already returns the empty state on the
 * server, so this is safe in both environments.
 */
let cache: AppState = readState();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    cache = readState();
    notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): AppState {
  // The reference only changes when the data does; returning a fresh object on
  // every call would make React loop.
  return cache;
}

function getServerSnapshot(): AppState {
  return SERVER_SNAPSHOT;
}

/** Whether we are past hydration, so the UI knows the snapshot is the real one. */
function subscribeHydration(): () => void {
  return () => undefined;
}

let persistedOk = true;

export function useAppState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );

  const update = useCallback((change: (current: AppState) => AppState) => {
    const next = change(getSnapshot());
    cache = next;
    persistedOk = writeState(next);
    notify();
  }, []);

  /**
   * Log one answer, and advance its spaced-repetition card.
   *
   * A wrong answer creates the card if it does not exist yet; a right answer
   * pushes an existing card further out. Questions answered correctly first
   * time never enter the review queue at all.
   */
  const recordAttempt = useCallback(
    (attempt: Attempt) => {
      update((current) => {
        const cards = { ...current.cards };
        const existing = cards[attempt.questionId];

        if (!attempt.correct && !existing) {
          cards[attempt.questionId] = reviewCard(
            createCard(attempt.questionId, attempt.at),
            gradeFromAttempt(false, attempt.elapsedMs),
            attempt.at,
          );
        } else if (existing) {
          cards[attempt.questionId] = reviewCard(
            existing,
            gradeFromAttempt(attempt.correct, attempt.elapsedMs),
            attempt.at,
          );
        }

        return { ...current, attempts: [...current.attempts, attempt], cards };
      });
    },
    [update],
  );

  const setSettings = useCallback(
    (change: Partial<Settings>) => {
      update((current) => ({
        ...current,
        settings: { ...current.settings, ...change },
      }));
    },
    [update],
  );

  const setActiveMock = useCallback(
    (mock: ActiveMock | null) => update((current) => ({ ...current, activeMock: mock })),
    [update],
  );

  /**
   * Finish a paper. The result id is stored rather than held in component
   * state, so the score report survives a reload and the mock screen can
   * derive which view to show without an effect.
   */
  const addMockResult = useCallback(
    (result: MockResult) =>
      update((current) => ({
        ...current,
        mockResults: [...current.mockResults, result],
        activeMock: null,
        lastResultId: result.id,
      })),
    [update],
  );

  /** Leave the score report and go back to the setup screen. */
  const dismissResult = useCallback(
    () => update((current) => ({ ...current, lastResultId: null })),
    [update],
  );

  const reset = useCallback(() => {
    clearState();
    cache = emptyState();
    persistedOk = true;
    notify();
  }, []);

  return {
    state: ready ? state : null,
    ready,
    /** False when the browser refused to save — private mode, or quota full. */
    persisted: persistedOk,
    update,
    recordAttempt,
    setSettings,
    setActiveMock,
    addMockResult,
    dismissResult,
    reset,
  };
}

/** Ids currently in the mistake bank, soonest due first. */
export function mistakeBankIds(state: AppState): string[] {
  return Object.values(state.cards)
    .filter((card) => !isLearned(card))
    .sort((a, b) => a.dueAt - b.dueAt)
    .map((card) => card.questionId);
}

/** Ids the user has already answered, for the "don't repeat" practice setting. */
export function answeredIds(state: AppState): Set<string> {
  return new Set(state.attempts.map((a) => a.questionId));
}
