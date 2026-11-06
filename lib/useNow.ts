'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * The current time, as an external store.
 *
 * Reading `Date.now()` during render is impure, and reading it in an effect and
 * then calling setState causes a cascading render. A ticking clock is exactly
 * the external system `useSyncExternalStore` exists for.
 *
 * The snapshot getter only reads; the timestamp is written in `subscribe`,
 * which React runs after render rather than during it.
 */

/** Captured at module load, before any render, so the getter can stay pure. */
const LOADED_AT = Date.now();

/**
 * @param intervalMs How often to re-render. Use 1000 for a visible countdown,
 *   60000 for "has anything come due?", and something coarser for a day streak.
 */
export function useNow(intervalMs = 60_000): number {
  const box = useRef({ value: 0 });

  const subscribe = useCallback(
    (listener: () => void) => {
      box.current.value = Date.now();
      // Publish the real time now that we are past render.
      listener();
      const id = setInterval(() => {
        box.current.value = Date.now();
        listener();
      }, intervalMs);
      return () => clearInterval(id);
    },
    [intervalMs],
  );

  const getSnapshot = useCallback(() => box.current.value || LOADED_AT, []);

  return useSyncExternalStore(subscribe, getSnapshot, () => LOADED_AT);
}
