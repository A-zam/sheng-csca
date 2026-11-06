'use client';

import { Component, Suspense, type ReactNode } from 'react';
import { useHydrated } from '@/lib/useHydrated';
import { ErrorNote, LoadingCard } from './ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  message?: string;
}

interface State {
  failed: boolean;
}

class Catch extends Component<{ children: ReactNode; message?: string }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <ErrorNote>
          {this.props.message ??
            'Something on this page could not be loaded. Reloading usually fixes it.'}
        </ErrorNote>
      );
    }
    return this.props.children;
  }
}

/**
 * Suspense plus an error boundary, and client-only.
 *
 * The children fetch their data from `/data/...`, which cannot be resolved
 * while the page is being prerendered at build time — there is no origin to
 * make the relative URL absolute against. So the fallback is what gets baked
 * into the static HTML, and the real content arrives on hydration.
 *
 * Keep page headings and prose *outside* this boundary so they still appear in
 * the exported HTML for search engines and for readers on a slow connection.
 */
export function Boundary({ children, fallback, message }: Props) {
  const hydrated = useHydrated();
  const placeholder = fallback ?? <LoadingCard lines={4} />;

  if (!hydrated) return <>{placeholder}</>;

  return (
    <Catch message={message}>
      <Suspense fallback={placeholder}>{children}</Suspense>
    </Catch>
  );
}
