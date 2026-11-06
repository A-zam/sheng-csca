'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'csca-prep:theme';
const CHANGED = 'csca-prep:theme-changed';

type Mode = 'light' | 'dark';

/**
 * The theme lives on `<html>`, set before first paint by the script in the root
 * layout. That makes the DOM the source of truth, so it is read as an external
 * store rather than mirrored into React state through an effect.
 *
 * The server snapshot is null, which renders no icon at all — there is no way
 * to know the visitor's theme before hydration, and guessing would flash.
 */
function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGED, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener('storage', listener);
  };
}

function getSnapshot(): Mode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeToggle() {
  const mode = useSyncExternalStore<Mode | null>(subscribe, getSnapshot, () => null);

  const toggle = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the toggle still works for this page view.
    }
    window.dispatchEvent(new Event(CHANGED));
  };

  const label =
    mode === null
      ? 'Switch colour theme'
      : mode === 'dark'
        ? 'Switch to light mode'
        : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper-sunk)] hover:text-[var(--ink)]"
    >
      {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
