import type { Subject } from './schema.ts';
import type { Attempt } from './storage.ts';

export interface TopicProgress {
  topicId: string;
  name: string;
  attempted: number;
  correct: number;
  accuracy: number;
  /** Share of the real paper this topic is expected to occupy. */
  weight: number;
  /** How much a fix here would move the score: weight x (1 - accuracy). */
  payoff: number;
  /** Fewer than this many attempts and the accuracy is not worth trusting. */
  confident: boolean;
}

export const CONFIDENCE_THRESHOLD = 5;

export function topicProgress(
  attempts: Attempt[],
  subject: Subject,
  topicNames: Record<string, string>,
  topicWeights: Record<string, number>,
): TopicProgress[] {
  const relevant = attempts.filter((a) => a.subject === subject);
  const totalWeight = Object.values(topicWeights).reduce((sum, w) => sum + w, 0) || 1;

  return Object.keys(topicNames)
    .map((topicId) => {
      const items = relevant.filter((a) => a.topic === topicId);
      const correct = items.filter((a) => a.correct).length;
      const accuracy = items.length === 0 ? 0 : correct / items.length;
      const weight = (topicWeights[topicId] ?? 0) / totalWeight;
      return {
        topicId,
        name: topicNames[topicId] ?? topicId,
        attempted: items.length,
        correct,
        accuracy,
        weight,
        payoff: items.length === 0 ? weight : weight * (1 - accuracy),
        confident: items.length >= CONFIDENCE_THRESHOLD,
      };
    })
    .sort((a, b) => a.topicId.localeCompare(b.topicId, 'en', { numeric: true }));
}

/**
 * The topics worth working on next: high share of the paper, low accuracy.
 * Topics never attempted count as unknown rather than weak, and are listed
 * separately so the advice does not amount to "revise everything".
 */
export function weakestTopics(progress: TopicProgress[], limit = 5): TopicProgress[] {
  return progress
    .filter((t) => t.attempted > 0 && t.accuracy < 0.85)
    .sort((a, b) => b.payoff - a.payoff)
    .slice(0, limit);
}

export function untouchedTopics(progress: TopicProgress[]): TopicProgress[] {
  return progress.filter((t) => t.attempted === 0).sort((a, b) => b.weight - a.weight);
}

export interface DailyPoint {
  /** ISO date, local time. */
  date: string;
  attempted: number;
  correct: number;
}

export function attemptsByDay(attempts: Attempt[], days: number, now: number): DailyPoint[] {
  const out: DailyPoint[] = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(start.getTime() - i * 86_400_000);
    const next = new Date(day.getTime() + 86_400_000);
    const items = attempts.filter((a) => a.at >= day.getTime() && a.at < next.getTime());
    out.push({
      date: toIsoDate(day),
      attempted: items.length,
      correct: items.filter((a) => a.correct).length,
    });
  }
  return out;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface Readiness {
  /** Projected paper score out of scaleMax, weighted by how the paper is built. */
  projected: number;
  scaleMax: number;
  target: number;
  onTrack: boolean;
  /** How much of the paper's weight has been practised at all. */
  coverage: number;
  /** How many attempts sit behind the projection. */
  sampleSize: number;
  confidence: 'low' | 'medium' | 'high';
  /** Gap to the target, in scaled points. Negative means the target is met. */
  gap: number;
}

/**
 * Project a paper score from per-topic accuracy weighted by how much of the
 * paper each topic occupies. Topics never practised are counted at the overall
 * average rather than at zero, and the estimate is labelled low-confidence
 * until enough of the paper has actually been attempted.
 */
export function estimateReadiness(
  progress: TopicProgress[],
  target: number,
  scaleMax: number,
): Readiness {
  const attemptedTopics = progress.filter((t) => t.attempted > 0);
  const sampleSize = progress.reduce((sum, t) => sum + t.attempted, 0);

  if (attemptedTopics.length === 0 || sampleSize === 0) {
    return {
      projected: 0,
      scaleMax,
      target,
      onTrack: false,
      coverage: 0,
      sampleSize: 0,
      confidence: 'low',
      gap: target,
    };
  }

  const overallCorrect = progress.reduce((sum, t) => sum + t.correct, 0);
  const overallAttempted = progress.reduce((sum, t) => sum + t.attempted, 0);
  const fallback = overallCorrect / overallAttempted;

  let weighted = 0;
  let weightSeen = 0;
  for (const topic of progress) {
    const accuracy = topic.attempted > 0 ? topic.accuracy : fallback;
    weighted += topic.weight * accuracy;
    if (topic.attempted > 0) weightSeen += topic.weight;
  }

  const projected = Math.round(weighted * scaleMax);
  const confidence: Readiness['confidence'] =
    sampleSize >= 120 && weightSeen >= 0.8
      ? 'high'
      : sampleSize >= 40 && weightSeen >= 0.5
        ? 'medium'
        : 'low';

  return {
    projected,
    scaleMax,
    target,
    onTrack: projected >= target,
    coverage: weightSeen,
    sampleSize,
    confidence,
    gap: target - projected,
  };
}

export function overallAccuracy(attempts: Attempt[], subject?: Subject): number {
  const items = subject ? attempts.filter((a) => a.subject === subject) : attempts;
  if (items.length === 0) return 0;
  return items.filter((a) => a.correct).length / items.length;
}

/** Consecutive days, ending today, with at least one attempt. */
export function currentStreak(attempts: Attempt[], now: number): number {
  if (attempts.length === 0) return 0;
  const days = new Set(
    attempts.map((a) => {
      const d = new Date(a.at);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }),
  );
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let cursor = today.getTime();
  if (!days.has(cursor)) {
    cursor -= 86_400_000;
    if (!days.has(cursor)) return 0;
  }
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 86_400_000;
  }
  return streak;
}
