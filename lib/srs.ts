/**
 * Spaced repetition for the mistake bank, SM-2 style.
 *
 * A question enters the bank the first time it is answered wrongly and leaves
 * once it has been answered correctly enough times in a row that its interval
 * grows past the review horizon. Every field lives in localStorage on the
 * device that produced it.
 */

export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;
/** Once the interval passes this, the item is considered learned. */
export const GRADUATION_DAYS = 60;

export interface ReviewCard {
  questionId: string;
  /** Consecutive successful reviews. Reset to 0 on a lapse. */
  repetitions: number;
  /** Days until the next review. */
  intervalDays: number;
  ease: number;
  /** Epoch ms. */
  dueAt: number;
  lastReviewedAt: number | null;
  lapses: number;
  /** Total times seen in review, right or wrong. */
  reviews: number;
}

export function createCard(questionId: string, now: number): ReviewCard {
  return {
    questionId,
    repetitions: 0,
    intervalDays: 0,
    ease: DEFAULT_EASE,
    dueAt: now,
    lastReviewedAt: null,
    lapses: 0,
    reviews: 0,
  };
}

/**
 * Turn one multiple-choice attempt into an SM-2 quality grade (0-5).
 *
 * A wrong answer is a lapse. A correct answer is graded on speed against the
 * exam's own budget of 75 seconds per question: comfortably inside it means the
 * recall was fluent, well over it means it was reconstructed.
 */
export function gradeFromAttempt(correct: boolean, elapsedMs: number, budgetMs = 75_000): number {
  if (!correct) return elapsedMs <= budgetMs * 0.4 ? 1 : 2;
  if (elapsedMs <= budgetMs * 0.5) return 5;
  if (elapsedMs <= budgetMs) return 4;
  return 3;
}

export const MS_PER_DAY = 86_400_000;

/**
 * Advance a card by one review. Grades below 3 count as a lapse: the card goes
 * back to a one-day interval and its ease drops, so hard items come round more
 * often without ever being dropped entirely.
 */
export function reviewCard(card: ReviewCard, quality: number, now: number): ReviewCard {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  const ease = Math.max(MIN_EASE, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  let repetitions: number;
  let intervalDays: number;
  let lapses = card.lapses;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
    lapses += 1;
  } else {
    repetitions = card.repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(card.intervalDays * ease);
    intervalDays = Math.max(1, intervalDays);
  }

  return {
    ...card,
    repetitions,
    intervalDays,
    ease,
    lapses,
    reviews: card.reviews + 1,
    lastReviewedAt: now,
    dueAt: now + intervalDays * MS_PER_DAY,
  };
}

export function isDue(card: ReviewCard, now: number): boolean {
  return !isLearned(card) && card.dueAt <= now;
}

export function isLearned(card: ReviewCard): boolean {
  return card.intervalDays >= GRADUATION_DAYS;
}

/**
 * The review queue: everything due, oldest first, with lapsed cards ahead of
 * fresh ones so the questions that keep going wrong come back first.
 */
export function dueQueue(cards: ReviewCard[], now: number): ReviewCard[] {
  return cards
    .filter((card) => isDue(card, now))
    .sort((a, b) => b.lapses - a.lapses || a.dueAt - b.dueAt);
}

export function nextDueAt(cards: ReviewCard[]): number | null {
  const upcoming = cards.filter((c) => !isLearned(c)).map((c) => c.dueAt);
  return upcoming.length === 0 ? null : Math.min(...upcoming);
}

export function describeInterval(days: number): string {
  if (days <= 0) return 'now';
  if (days === 1) return 'tomorrow';
  if (days < 30) return `in ${days} days`;
  const months = Math.round(days / 30);
  return months === 1 ? 'in about a month' : `in about ${months} months`;
}
