import { describe, expect, it } from 'vitest';
import { QuestionSchema, SyllabusSchema, CalibrationSchema } from '../lib/schema.ts';
import { verifyQuestion } from '../lib/verify.ts';
import { parseQuantity, evaluateExpression, optionHasUnit, approxEqual } from '../lib/evaluate.ts';
import syllabusJson from '../content/syllabus.json' with { type: 'json' };
import calibrationJson from '../content/calibration.json' with { type: 'json' };

const base = {
  id: 'physics-P2.2-001',
  subject: 'physics' as const,
  topic: 'P2',
  subtopic: 'P2.2',
  syllabusRef: 'P-A / Mechanics / Forces and Newton\u2019s Laws / Friction',
  difficulty: 3,
  stem: 'A crate is dragged along a bench.',
  options: ['$2\\ \\mathrm{N}$', '$4\\ \\mathrm{N}$', '$6\\ \\mathrm{N}$', '$8\\ \\mathrm{N}$'],
  correctIndex: 1,
  solution: 'Friction equals mu times the normal force, so f = 0.2 x 20 = 4 N.',
  distractorRationale: [
    'forgot the coefficient',
    'correct',
    'used weight not normal force',
    'doubled it',
  ],
  figure: null,
  verified: true,
  original: true,
  verification: {
    kind: 'numeric' as const,
    expression: '0.2 * 2 * 10',
    expected: 4,
    tolerance: 1e-9,
    unit: 'N',
  },
};

describe('QuestionSchema', () => {
  it('accepts a well-formed question', () => {
    expect(QuestionSchema.safeParse(base).success).toBe(true);
  });

  it('requires exactly four options', () => {
    expect(QuestionSchema.safeParse({ ...base, options: ['$1$', '$2$', '$3$'] }).success).toBe(
      false,
    );
  });

  it('requires exactly four distractor rationales', () => {
    expect(
      QuestionSchema.safeParse({ ...base, distractorRationale: ['a', 'b', 'c'] }).success,
    ).toBe(false);
  });

  it('keeps correctIndex inside the options array', () => {
    expect(QuestionSchema.safeParse({ ...base, correctIndex: 4 }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...base, correctIndex: -1 }).success).toBe(false);
  });

  it('rejects an empty solution', () => {
    expect(QuestionSchema.safeParse({ ...base, solution: '' }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...base, solution: 'because.' }).success).toBe(false);
  });

  it('rejects an empty stem or an empty option', () => {
    expect(QuestionSchema.safeParse({ ...base, stem: '   ' }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...base, options: ['$1$', '', '$3$', '$4$'] }).success).toBe(
      false,
    );
  });

  it('keeps difficulty on the 1-5 scale', () => {
    expect(QuestionSchema.safeParse({ ...base, difficulty: 0 }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...base, difficulty: 6 }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...base, difficulty: 2.5 }).success).toBe(false);
  });

  it('enforces the id format so ids stay unique and sortable', () => {
    expect(QuestionSchema.safeParse({ ...base, id: 'p2-2-1' }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...base, id: 'physics-P2.2-1' }).success).toBe(false);
  });

  it('requires a verification block', () => {
    const { verification, ...withoutVerification } = base;
    void verification;
    expect(QuestionSchema.safeParse(withoutVerification).success).toBe(false);
  });

  it('requires a conceptual item to justify its key', () => {
    expect(
      QuestionSchema.safeParse({
        ...base,
        verification: { kind: 'conceptual', justification: 'because' },
      }).success,
    ).toBe(false);
  });

  it('accepts a null figure and rejects a missing one', () => {
    expect(QuestionSchema.safeParse({ ...base, figure: null }).success).toBe(true);
    const { figure, ...withoutFigure } = base;
    void figure;
    expect(QuestionSchema.safeParse(withoutFigure).success).toBe(false);
  });
});

describe('the shipped content files', () => {
  it('has a valid syllabus', () => {
    const result = SyllabusSchema.safeParse(syllabusJson);
    expect(result.success, JSON.stringify(result.error?.issues?.slice(0, 5))).toBe(true);
  });

  it('has a valid calibration profile', () => {
    const result = CalibrationSchema.safeParse(calibrationJson);
    expect(result.success, JSON.stringify(result.error?.issues?.slice(0, 5))).toBe(true);
  });

  it('gives every subtopic id a unique, well-formed value', () => {
    const parsed = SyllabusSchema.parse(syllabusJson);
    const ids = new Set<string>();
    for (const subject of parsed.subjects) {
      for (const strand of subject.strands) {
        for (const topic of strand.topics) {
          for (const subtopic of topic.subtopics) {
            expect(subtopic.id.startsWith(`${topic.id}.`)).toBe(true);
            expect(ids.has(subtopic.id)).toBe(false);
            ids.add(subtopic.id);
          }
        }
      }
    }
  });

  it('targets a difficulty distribution that sums to 1', () => {
    const parsed = CalibrationSchema.parse(calibrationJson);
    const total = Object.values(parsed.difficulty.targetDistribution).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('gives every syllabus subtopic a bank target at or above the floor', () => {
    const syllabus = SyllabusSchema.parse(syllabusJson);
    const calibration = CalibrationSchema.parse(calibrationJson);
    const floor = calibration.bankTargets.floorPerSubtopic;
    for (const subject of syllabus.subjects) {
      const targets = calibration.bankTargets[subject.id].bySubtopic;
      for (const strand of subject.strands) {
        for (const topic of strand.topics) {
          for (const subtopic of topic.subtopics) {
            expect(targets[subtopic.id] ?? 0, subtopic.id).toBeGreaterThanOrEqual(floor);
          }
        }
      }
    }
  });

  it('has bank targets that add up: subtopic to topic to strand to total', () => {
    const syllabus = SyllabusSchema.parse(syllabusJson);
    const calibration = CalibrationSchema.parse(calibrationJson);
    for (const subject of syllabus.subjects) {
      const { byTopic, bySubtopic, byStrand, totalTarget } = calibration.bankTargets[subject.id];
      let grand = 0;
      for (const strand of subject.strands) {
        let strandSum = 0;
        for (const topic of strand.topics) {
          const sum = topic.subtopics.reduce((t, s) => t + (bySubtopic[s.id] ?? 0), 0);
          expect(sum, `${subject.id} ${topic.id}`).toBe(byTopic[topic.id]);
          strandSum += sum;
        }
        expect(strandSum, `${subject.id} ${strand.id}`).toBe(byStrand[strand.id]);
        grand += strandSum;
      }
      expect(grand).toBe(totalTarget);
      expect(totalTarget).toBeGreaterThanOrEqual(150);
    }
  });

  it('has a paper blueprint that adds up to a full 48-question paper', () => {
    const calibration = CalibrationSchema.parse(calibrationJson);
    for (const subject of ['math', 'physics'] as const) {
      const bp = calibration.paperBlueprint[subject];
      let total = 0;
      const bands = { easy: 0, medium: 0, complex: 0 };
      for (const strand of Object.values(bp.byStrand)) {
        expect(strand.easy + strand.medium + strand.complex).toBe(strand.total);
        total += strand.total;
        bands.easy += strand.easy;
        bands.medium += strand.medium;
        bands.complex += strand.complex;
      }
      expect(total).toBe(bp.total);
      expect(total).toBe(48);
      expect(bands).toEqual(bp.byBand);
    }
  });

  it('maps every difficulty level to exactly one band', () => {
    const calibration = CalibrationSchema.parse(calibrationJson);
    const { easy, medium, complex } = calibration.paperBlueprint.bandLevels;
    expect([...easy, ...medium, ...complex].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the bank big enough to build a mock paper from every strand', () => {
    const syllabus = SyllabusSchema.parse(syllabusJson);
    const calibration = CalibrationSchema.parse(calibrationJson);
    for (const subject of syllabus.subjects) {
      const bp = calibration.paperBlueprint[subject.id];
      const bank = calibration.bankTargets[subject.id];
      for (const [strandId, want] of Object.entries(bp.byStrand)) {
        expect(bank.byStrand[strandId] ?? 0, `${subject.id} ${strandId}`).toBeGreaterThanOrEqual(
          want.total,
        );
      }
    }
  });
});

describe('evaluateExpression', () => {
  it('evaluates arithmetic and Math functions', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14);
    expect(evaluateExpression('Math.sqrt(16)')).toBe(4);
  });

  it('substitutes variables', () => {
    expect(evaluateExpression('n * n', { n: 5 })).toBe(25);
  });

  it('refuses banned identifiers', () => {
    expect(() => evaluateExpression('process.exit(1)')).toThrow(/banned/);
    expect(() => evaluateExpression('require("fs")')).toThrow(/banned/);
  });

  it('refuses anything that is not a finite number', () => {
    expect(() => evaluateExpression('1/0')).toThrow(/finite/);
    expect(() => evaluateExpression('"hello"')).toThrow(/finite/);
  });

  it('reports the expression when it throws', () => {
    expect(() => evaluateExpression('nope + 1')).toThrow(/nope \+ 1/);
  });
});

describe('parseQuantity', () => {
  it('reads plain numbers and units', () => {
    expect(parseQuantity('$4\\ \\mathrm{N}$')).toBe(4);
    expect(parseQuantity('$12.5\\ \\mathrm{m/s}$')).toBe(12.5);
    expect(parseQuantity('$-3$')).toBe(-3);
  });

  it('reads fractions, including nested ones', () => {
    expect(parseQuantity('$\\dfrac{3}{2}$')).toBe(1.5);
    expect(parseQuantity('$\\frac{1}{\\frac{1}{4}}$')).toBe(4);
  });

  it('reads roots', () => {
    expect(parseQuantity('$\\sqrt{16}$')).toBe(4);
    expect(parseQuantity('$\\dfrac{2\\sqrt{5}}{5}$')).toBeCloseTo(0.894427, 5);
  });

  it('reads scientific notation', () => {
    expect(parseQuantity('$1.8\\times 10^{5}\\ \\mathrm{N/C}$')).toBeCloseTo(180000, 6);
    expect(parseQuantity('$5\\times 10^{-6}\\ \\mathrm{C}$')).toBeCloseTo(5e-6, 12);
  });

  it('reads powers and pi', () => {
    expect(parseQuantity('$2^{3}$')).toBe(8);
    expect(parseQuantity('$\\dfrac{\\pi}{2}$')).toBeCloseTo(Math.PI / 2, 12);
  });

  it('returns null for things that are not a single number', () => {
    expect(parseQuantity('$3 : 2$')).toBeNull();
    expect(parseQuantity('$(-\\infty, 3]$')).toBeNull();
    expect(parseQuantity('$y = 2x + 1$')).toBeNull();
    expect(parseQuantity('$\\text{Total internal reflection}$')).toBeNull();
  });

  it('ignores the degree sign', () => {
    expect(parseQuantity('$45^\\circ$')).toBe(45);
  });
});

describe('optionHasUnit', () => {
  it('sees through LaTeX spacing and \\mathrm', () => {
    expect(optionHasUnit('$12\\ \\mathrm{m/s}$', 'm/s')).toBe(true);
    expect(optionHasUnit('$12\\ \\mathrm{m/s}$', 'N')).toBe(false);
  });
});

describe('approxEqual', () => {
  it('scales tolerance with magnitude', () => {
    // At 1e6 a 1e-9 relative tolerance is 1e-3 absolute.
    expect(approxEqual(1e6, 1e6 + 0.01, 1e-9)).toBe(false);
    expect(approxEqual(1e6, 1e6 + 0.0001, 1e-9)).toBe(true);
    expect(approxEqual(0.1 + 0.2, 0.3, 1e-9)).toBe(true);
    // Below 1 the tolerance stops shrinking, so tiny values stay comparable.
    expect(approxEqual(1e-9, 2e-9, 1e-9)).toBe(true);
  });
});

describe('verifyQuestion', () => {
  it('passes a numeric item whose key matches the recomputed answer', () => {
    const result = verifyQuestion(QuestionSchema.parse(base));
    expect(result.ok).toBe(true);
    expect(result.quantitative).toBe(true);
  });

  it('catches a mis-keyed answer', () => {
    const result = verifyQuestion(QuestionSchema.parse({ ...base, correctIndex: 2 }));
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/reads as 6, but the answer is 4/);
  });

  it('catches an expression that disagrees with its stated result', () => {
    const result = verifyQuestion(
      QuestionSchema.parse({
        ...base,
        verification: { ...base.verification, expression: '0.2 * 2 * 9.8' },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/expression produced/);
  });

  it('catches two options sharing the answer value', () => {
    const result = verifyQuestion(
      QuestionSchema.parse({
        ...base,
        options: [
          '$4\\ \\mathrm{N}$',
          '$4.0\\ \\mathrm{N}$',
          '$6\\ \\mathrm{N}$',
          '$8\\ \\mathrm{N}$',
        ],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/two options are correct/);
  });

  it('catches a missing unit on the keyed option', () => {
    const result = verifyQuestion(
      QuestionSchema.parse({
        ...base,
        options: ['$2\\ \\mathrm{N}$', '$4$', '$6\\ \\mathrm{N}$', '$8\\ \\mathrm{N}$'],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/missing the unit/);
  });

  it('verifies a symbolic item by sampling every option', () => {
    const symbolic = QuestionSchema.parse({
      ...base,
      id: 'math-M6.3-001',
      subject: 'math',
      topic: 'M6',
      subtopic: 'M6.3',
      syllabusRef: 'M-B / Functions / Sequences / General terms',
      options: ['$2n$', '$2n-1$', '$2n+1$', '$n^2$'],
      correctIndex: 1,
      verification: {
        kind: 'symbolic',
        vars: ['n'],
        domain: [[1, 30]],
        integerVars: ['n'],
        reference: '2*n - 1',
        optionForms: ['2*n', '2*n - 1', '2*n + 1', 'n*n'],
        tolerance: 1e-9,
        samples: 40,
      },
    });
    expect(verifyQuestion(symbolic).ok).toBe(true);
  });

  it('catches a mis-keyed symbolic item', () => {
    const symbolic = QuestionSchema.parse({
      ...base,
      id: 'math-M6.3-002',
      subject: 'math',
      topic: 'M6',
      subtopic: 'M6.3',
      syllabusRef: 'M-B / Functions / Sequences / General terms',
      options: ['$2n$', '$2n-1$', '$2n+1$', '$n^2$'],
      correctIndex: 0,
      verification: {
        kind: 'symbolic',
        vars: ['n'],
        domain: [[1, 30]],
        integerVars: ['n'],
        reference: '2*n - 1',
        optionForms: ['2*n', '2*n - 1', '2*n + 1', 'n*n'],
        tolerance: 1e-9,
        samples: 40,
      },
    });
    const result = verifyQuestion(symbolic);
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/does not match the reference/);
  });

  it('lets a conceptual item through without pretending to compute anything', () => {
    const conceptual = verifyQuestion(
      QuestionSchema.parse({
        ...base,
        options: ['$\\text{a}$', '$\\text{b}$', '$\\text{c}$', '$\\text{d}$'],
        verification: {
          kind: 'conceptual',
          justification:
            'Force is defined as an interaction, so it always has both an agent and a receiver.',
        },
      }),
    );
    expect(conceptual.ok).toBe(true);
    expect(conceptual.quantitative).toBe(false);
  });
});
