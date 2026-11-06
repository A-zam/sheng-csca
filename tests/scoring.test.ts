import { describe, expect, it } from 'vitest';
import {
  bandOf,
  buildMockPaper,
  scoreExam,
  seededRandom,
  shuffle,
  strandIndex,
  type AnswerRecord,
} from '../lib/scoring.ts';
import type { Question } from '../lib/schema.ts';

function question(overrides: Partial<Question> & { id: string }): Question {
  return {
    subject: 'math',
    topic: 'M1',
    subtopic: 'M1.1',
    syllabusRef: 'M-A / Sets and Inequalities / Sets and Set Operations / Set notation',
    difficulty: 3,
    stem: 'stem',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    solution: 'x'.repeat(40),
    distractorRationale: ['right', 'wrong one', 'wrong two', 'wrong three'],
    figure: null,
    verified: true,
    original: true,
    verification: { kind: 'conceptual', justification: 'x'.repeat(30) },
    ...overrides,
  };
}

describe('scoreExam', () => {
  const questions = [
    question({ id: 'math-M1.1-001', correctIndex: 0, topic: 'M1', difficulty: 1 }),
    question({ id: 'math-M1.1-002', correctIndex: 2, topic: 'M1', difficulty: 1 }),
    question({
      id: 'math-M2.1-001',
      correctIndex: 1,
      topic: 'M2',
      subtopic: 'M2.1',
      difficulty: 4,
    }),
    question({
      id: 'math-M2.1-002',
      correctIndex: 3,
      topic: 'M2',
      subtopic: 'M2.1',
      difficulty: 4,
    }),
  ];

  it('counts correct answers and leaves blanks unpenalised', () => {
    const answers: AnswerRecord[] = [
      { questionId: 'math-M1.1-001', chosenIndex: 0 },
      { questionId: 'math-M1.1-002', chosenIndex: 1 },
      { questionId: 'math-M2.1-001', chosenIndex: 1 },
      { questionId: 'math-M2.1-002', chosenIndex: null },
    ];
    const score = scoreExam(questions, answers, { subject: 'math', scaleMax: 100 });

    expect(score.correct).toBe(2);
    expect(score.incorrect).toBe(1);
    expect(score.unanswered).toBe(1);
    expect(score.answered).toBe(3);
    expect(score.percent).toBe(50);
    expect(score.scaled).toBe(50);
  });

  it('treats a question with no answer record at all as blank', () => {
    const score = scoreExam(questions, [], { subject: 'math', scaleMax: 100 });
    expect(score.unanswered).toBe(4);
    expect(score.correct).toBe(0);
    expect(score.scaled).toBe(0);
  });

  it('scales to the paper total rather than to a percentage', () => {
    const answers: AnswerRecord[] = questions.map((q) => ({
      questionId: q.id,
      chosenIndex: q.correctIndex,
    }));
    const score = scoreExam(questions, answers, { subject: 'math', scaleMax: 100 });
    expect(score.correct).toBe(4);
    expect(score.scaled).toBe(100);
  });

  it('breaks the score down by topic and by difficulty', () => {
    const answers: AnswerRecord[] = [
      { questionId: 'math-M1.1-001', chosenIndex: 0 },
      { questionId: 'math-M1.1-002', chosenIndex: 2 },
      { questionId: 'math-M2.1-001', chosenIndex: 0 },
      { questionId: 'math-M2.1-002', chosenIndex: 0 },
    ];
    const score = scoreExam(questions, answers, {
      subject: 'math',
      scaleMax: 100,
      topicNames: { M1: 'Sets', M2: 'Inequalities' },
    });

    const m1 = score.byTopic.find((t) => t.key === 'M1');
    const m2 = score.byTopic.find((t) => t.key === 'M2');
    expect(m1).toMatchObject({ label: 'Sets', attempted: 2, correct: 2, accuracy: 1 });
    expect(m2).toMatchObject({ label: 'Inequalities', attempted: 2, correct: 0, accuracy: 0 });

    expect(score.byDifficulty.find((d) => d.key === 'd1')?.correct).toBe(2);
    expect(score.byDifficulty.find((d) => d.key === 'd4')?.label).toBe('Multi-step');
  });

  it('reports an empty paper without dividing by zero', () => {
    const score = scoreExam([], [], { subject: 'physics', scaleMax: 100 });
    expect(score.percent).toBe(0);
    expect(score.scaled).toBe(0);
    expect(score.byTopic).toEqual([]);
  });
});

describe('buildMockPaper', () => {
  const STRAND_OF: Record<string, string> = {
    M1: 'M-1',
    M2: 'M-1',
    M3: 'M-2',
    M4: 'M-2',
    M5: 'M-3',
    M6: 'M-3',
    M7: 'M-4',
  };
  const BAND_LEVELS = { easy: [1, 2], medium: [3], complex: [4, 5] };
  const BLUEPRINT = {
    total: 48,
    byStrand: {
      'M-1': { total: 8, easy: 4, medium: 2, complex: 2 },
      'M-2': { total: 16, easy: 6, medium: 5, complex: 5 },
      'M-3': { total: 14, easy: 5, medium: 5, complex: 4 },
      'M-4': { total: 10, easy: 5, medium: 3, complex: 2 },
    },
  };

  const pool: Question[] = [];
  for (const topic of Object.keys(STRAND_OF)) {
    for (let i = 1; i <= 30; i += 1) {
      pool.push(
        question({
          id: `math-${topic}.${(i % 3) + 1}-${String(i).padStart(3, '0')}`,
          topic,
          subtopic: `${topic}.${(i % 3) + 1}`,
          difficulty: ((i - 1) % 5) + 1,
        }),
      );
    }
  }

  const build = (seed: number, p = pool) =>
    buildMockPaper(p, BLUEPRINT, STRAND_OF, BAND_LEVELS, seededRandom(seed));

  it('returns a full paper of distinct questions', () => {
    const paper = build(7);
    expect(paper).toHaveLength(48);
    expect(new Set(paper.map((q) => q.id)).size).toBe(48);
  });

  it('gives every strand exactly the share the blueprint asks for', () => {
    const paper = build(7);
    for (const [strandId, want] of Object.entries(BLUEPRINT.byStrand)) {
      const got = paper.filter((q) => STRAND_OF[q.topic] === strandId).length;
      expect(got, strandId).toBe(want.total);
    }
  });

  it('matches the blueprint difficulty split inside each strand', () => {
    const paper = build(13);
    for (const [strandId, want] of Object.entries(BLUEPRINT.byStrand)) {
      const items = paper.filter((q) => STRAND_OF[q.topic] === strandId);
      const easy = items.filter((q) => q.difficulty <= 2).length;
      const medium = items.filter((q) => q.difficulty === 3).length;
      const complex = items.filter((q) => q.difficulty >= 4).length;
      expect({ easy, medium, complex }, strandId).toEqual({
        easy: want.easy,
        medium: want.medium,
        complex: want.complex,
      });
    }
  });

  it('spreads across subtopics rather than draining one', () => {
    const paper = build(21);
    expect(new Set(paper.map((q) => q.subtopic)).size).toBeGreaterThanOrEqual(12);
  });

  it('never returns more questions than the pool holds', () => {
    expect(build(7, pool.slice(0, 10))).toHaveLength(10);
  });

  it('still fills the paper when one strand is short, rather than returning a stub', () => {
    const thin = pool.filter((q) => STRAND_OF[q.topic] !== 'M-4');
    const paper = build(9, thin);
    expect(paper).toHaveLength(48);
    expect(paper.filter((q) => STRAND_OF[q.topic] === 'M-4')).toHaveLength(0);
  });

  it('ramps from easy to hard the way a real paper does', () => {
    const difficulties = build(3).map((q) => q.difficulty);
    expect(difficulties).toEqual([...difficulties].sort((a, b) => a - b));
  });

  it('is reproducible for a given seed and varies across seeds', () => {
    expect(build(42).map((q) => q.id)).toEqual(build(42).map((q) => q.id));
    expect(build(42).map((q) => q.id)).not.toEqual(build(43).map((q) => q.id));
  });

  it('handles an empty pool', () => {
    expect(build(1, [])).toEqual([]);
  });
});

describe('bandOf', () => {
  const levels = { easy: [1, 2], medium: [3], complex: [4, 5] };
  it('maps each difficulty to its band', () => {
    expect(bandOf(1, levels)).toBe('easy');
    expect(bandOf(2, levels)).toBe('easy');
    expect(bandOf(3, levels)).toBe('medium');
    expect(bandOf(5, levels)).toBe('complex');
  });
});

describe('strandIndex', () => {
  it('maps every topic to the strand that contains it', () => {
    const index = strandIndex([
      { strands: [{ id: 'M-1', topics: [{ id: 'M1' }, { id: 'M2' }] }] },
      { strands: [{ id: 'P-1', topics: [{ id: 'P1' }] }] },
    ]);
    expect(index).toEqual({ M1: 'M-1', M2: 'M-1', P1: 'P-1' });
  });
});

describe('shuffle', () => {
  it('keeps every element exactly once', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffle([...items], seededRandom(5));
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });
});

describe('seededRandom', () => {
  it('stays inside [0, 1)', () => {
    const random = seededRandom(123);
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
