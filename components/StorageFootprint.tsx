'use client';

import { useAppState } from '@/lib/useAppState';

/** Shows the visitor exactly how much this site has stored on their device. */
export function StorageFootprint() {
  const { state, ready } = useAppState();

  if (!ready) return null;

  const bytes = state ? JSON.stringify(state).length : 0;
  const empty = !state || (state.attempts.length === 0 && Object.keys(state.cards).length === 0);

  return (
    <p className="border-l-4 border-[var(--brand)] bg-[var(--brand-soft)] px-4 py-3 text-[15px] text-[var(--ink)]">
      {empty ? (
        <>This site has stored nothing in this browser yet.</>
      ) : (
        <>
          Right now this site is storing about{' '}
          <strong className="font-semibold tabular-nums">{(bytes / 1024).toFixed(1)} kB</strong> in
          this browser. You can erase all of it from the{' '}
          <a href="/progress" className="text-[var(--brand)] underline underline-offset-[3px]">
            progress page
          </a>
          .
        </>
      )}
    </p>
  );
}
