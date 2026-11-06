'use client';

import { useAppState } from '@/lib/useAppState';
import { useNow } from '@/lib/useNow';
import { dueQueue } from '@/lib/srs';
import { ButtonLink, Notice } from './ui';

/**
 * Only appears when there is something to come back to: a mock exam left
 * running, or review cards that have come due. Silent otherwise, so a first
 * visit is not cluttered with empty state.
 */
export function ResumeBanner() {
  const { state, ready } = useAppState();
  // A minute is plenty: this only decides which banner to show, not a countdown.
  const now = useNow(60_000);

  if (!ready || !state) return null;

  const mock = state.activeMock;
  const due = dueQueue(Object.values(state.cards), now);

  if (mock && mock.endsAt > now) {
    const answered = Object.values(mock.answers).filter((a) => a !== null).length;
    const minutesLeft = Math.max(0, Math.round((mock.endsAt - now) / 60000));
    return (
      <Notice
        tone="warn"
        className="mt-10"
        action={
          <ButtonLink href="/mock" tone="secondary">
            Resume the exam
          </ButtonLink>
        }
      >
        <p>
          You have a {mock.subject === 'math' ? 'Mathematics' : 'Physics'} mock exam in progress:{' '}
          <strong className="font-semibold">
            {answered} of {mock.questionIds.length}
          </strong>{' '}
          answered, about {minutesLeft} minute{minutesLeft === 1 ? '' : 's'} left.
        </p>
      </Notice>
    );
  }

  if (due.length > 0) {
    return (
      <Notice
        className="mt-10"
        action={
          <ButtonLink href="/review" tone="secondary">
            Review now
          </ButtonLink>
        }
      >
        <p>
          <strong className="font-semibold tabular-nums">{due.length}</strong>{' '}
          {due.length === 1 ? 'question is' : 'questions are'} due for review.
        </p>
      </Notice>
    );
  }

  return null;
}
