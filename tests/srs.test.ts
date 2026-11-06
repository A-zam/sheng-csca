import { describe, expect, it } from 'vitest';
import {
  createCard,
  describeInterval,
  dueQueue,
  gradeFromAttempt,
  isDue,
  isLearned,
  nextDueAt,
  reviewCard,
  DEFAULT_EASE,
  GRADUATION_DAYS,
  MIN_EASE,
  MS_PER_DAY,
} from '../lib/srs.ts';

const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);

describe('gradeFromAttempt', () => {
  it('grades a fast correct answer highest', () => {
    expect(gradeFromAttempt(true, 20_000)).toBe(5);
  });

  it('grades a correct answer inside the time budget as solid', () => {
    expect(gradeFromAttempt(true, 60_000)).toBe(4);
  });

  it('grades a slow correct answer as reconstructed, not recalled', () => {
    expect(gradeFromAttempt(true, 200_000)).toBe(3);
  });

  it('grades every wrong answer below the lapse threshold', () => {
    expect(gradeFromAttempt(false, 5_000)).toBeLessThan(3);
    expect(gradeFromAttempt(false, 200_000)).toBeLessThan(3);
  });

  it('separates a wrong guess from a wrong attempt that took thought', () => {
    expect(gradeFromAttempt(false, 5_000)).toBe(1);
    expect(gradeFromAttempt(false, 60_000)).toBe(2);
  });
});

describe('reviewCard', () => {
  it('schedules the first success one day out', () => {
    const card = reviewCard(createCard('q1', NOW), 5, NOW);
    expect(card.repetitions).toBe(1);
    expect(card.intervalDays).toBe(1);
    expect(card.dueAt).toBe(NOW + MS_PER_DAY);
  });

  it('schedules the second success six days out', () => {
    let card = createCard('q1', NOW);
    card = reviewCard(card, 5, NOW);
    card = reviewCard(card, 5, NOW + MS_PER_DAY);
    expect(card.repetitions).toBe(2);
    expect(card.intervalDays).toBe(6);
  });

  it('multiplies by ease from the third success on', () => {
    let card = createCard('q1', NOW);
    card = reviewCard(card, 4, NOW);
    card = reviewCard(card, 4, NOW);
    const easeAfterTwo = card.ease;
    card = reviewCard(card, 4, NOW);
    expect(card.intervalDays).toBe(Math.round(6 * easeAfterTwo));
    expect(card.intervalDays).toBeGreaterThan(6);
  });

  it('resets the interval and counts a lapse on a wrong answer', () => {
    let card = createCard('q1', NOW);
    card = reviewCard(card, 5, NOW);
    card = reviewCard(card, 5, NOW);
    card = reviewCard(card, 5, NOW);
    expect(card.intervalDays).toBeGreaterThan(6);

    card = reviewCard(card, 2, NOW);
    expect(card.repetitions).toBe(0);
    expect(card.intervalDays).toBe(1);
    expect(card.lapses).toBe(1);
    expect(card.dueAt).toBe(NOW + MS_PER_DAY);
  });

  it('raises ease on easy recalls and lowers it on hard ones', () => {
    const easy = reviewCard(createCard('q1', NOW), 5, NOW);
    const hard = reviewCard(createCard('q2', NOW), 3, NOW);
    expect(easy.ease).toBeGreaterThan(DEFAULT_EASE);
    expect(hard.ease).toBeLessThan(DEFAULT_EASE);
  });

  it('never lets ease fall below the floor, however many lapses', () => {
    let card = createCard('q1', NOW);
    for (let i = 0; i < 40; i += 1) card = reviewCard(card, 0, NOW);
    expect(card.ease).toBe(MIN_EASE);
    expect(card.intervalDays).toBe(1);
  });

  it('clamps out-of-range grades instead of producing nonsense', () => {
    const high = reviewCard(createCard('q1', NOW), 99, NOW);
    const low = reviewCard(createCard('q2', NOW), -5, NOW);
    expect(high.intervalDays).toBe(1);
    expect(low.intervalDays).toBe(1);
    expect(low.lapses).toBe(1);
    expect(Number.isFinite(high.ease)).toBe(true);
  });

  it('counts every review, right or wrong', () => {
    let card = createCard('q1', NOW);
    card = reviewCard(card, 5, NOW);
    card = reviewCard(card, 1, NOW);
    expect(card.reviews).toBe(2);
  });
});

describe('due scheduling', () => {
  it('holds a card back until its due date', () => {
    const card = reviewCard(createCard('q1', NOW), 5, NOW);
    expect(isDue(card, NOW)).toBe(false);
    expect(isDue(card, NOW + MS_PER_DAY)).toBe(true);
  });

  it('treats a brand new card as due immediately', () => {
    expect(isDue(createCard('q1', NOW), NOW)).toBe(true);
  });

  it('retires a card once its interval passes the horizon', () => {
    let card = createCard('q1', NOW);
    let clock = NOW;
    for (let i = 0; i < 12 && !isLearned(card); i += 1) {
      card = reviewCard(card, 5, clock);
      clock = card.dueAt;
    }
    expect(card.intervalDays).toBeGreaterThanOrEqual(GRADUATION_DAYS);
    expect(isLearned(card)).toBe(true);
    expect(isDue(card, clock + MS_PER_DAY * 365)).toBe(false);
  });

  it('puts the most-lapsed cards at the front of the queue', () => {
    const fresh = createCard('fresh', NOW - MS_PER_DAY);
    let stubborn = createCard('stubborn', NOW - MS_PER_DAY);
    stubborn = reviewCard(stubborn, 1, NOW - 3 * MS_PER_DAY);
    stubborn = reviewCard(stubborn, 1, NOW - 2 * MS_PER_DAY);

    const queue = dueQueue([fresh, stubborn], NOW + MS_PER_DAY * 5);
    expect(queue[0]?.questionId).toBe('stubborn');
  });

  it('leaves learned cards out of the queue', () => {
    let card = createCard('q1', NOW);
    let clock = NOW;
    for (let i = 0; i < 12 && !isLearned(card); i += 1) {
      card = reviewCard(card, 5, clock);
      clock = card.dueAt;
    }
    expect(dueQueue([card], clock + MS_PER_DAY * 999)).toEqual([]);
  });

  it('reports the next due time, or null when nothing is pending', () => {
    const a = reviewCard(createCard('a', NOW), 5, NOW);
    const b = reviewCard(createCard('b', NOW), 4, NOW);
    b.dueAt = NOW + 10 * MS_PER_DAY;
    expect(nextDueAt([a, b])).toBe(a.dueAt);
    expect(nextDueAt([])).toBeNull();
  });
});

describe('describeInterval', () => {
  it('reads as plain English', () => {
    expect(describeInterval(0)).toBe('now');
    expect(describeInterval(1)).toBe('tomorrow');
    expect(describeInterval(6)).toBe('in 6 days');
    expect(describeInterval(30)).toBe('in about a month');
    expect(describeInterval(90)).toBe('in about 3 months');
  });
});
