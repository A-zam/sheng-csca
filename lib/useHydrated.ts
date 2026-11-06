'use client';

import { useSyncExternalStore } from 'react';

const noop = () => () => undefined;

/**
 * False during server rendering and on the very first client render, true
 * afterwards.
 *
 * Anything that reads `localStorage` or fetches `/data/...` needs this: the
 * static export prerenders these pages at build time, where there is no
 * browser and no base URL to resolve a relative fetch against.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
