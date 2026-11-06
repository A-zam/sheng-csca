import { describe, expect, it } from 'vitest';
import {
  buildReferenceIndex,
  checkOriginality,
  hashShingle,
  jaccard,
  normaliseWords,
  numericTuplesOf,
  registerFurniture,
  shingles,
  NUMBER_TOKEN,
} from '../lib/originality.ts';

const REFERENCE = [
  'An object of mass 5 kg is placed on a horizontal surface. The coefficient of friction is 0.2. ' +
    'A horizontal force F = 8 N is used to pull the object. The magnitude of the frictional force is ( ). ' +
    'Take g = 10 m/s2.',
  'A spring has a spring constant k = 50 N/m and an original length of 10 cm. If it is stretched to 14 cm, ' +
    'the magnitude of the pulling force is ( ).',
  'If the eccentricity of the hyperbola is e = 2, then a = ( ).',
];

const index = buildReferenceIndex(REFERENCE, 8);

describe('normaliseWords', () => {
  it('folds every number to a single placeholder', () => {
    const words = normaliseWords('a mass of 5 kg and 12.5 N and 1,200 J');
    expect(words.filter((w) => w === NUMBER_TOKEN)).toHaveLength(3);
    expect(words).not.toContain('5');
  });

  it('strips LaTeX commands but keeps the words inside them', () => {
    expect(normaliseWords('$\\frac{a}{b}$ velocity \\mathrm{m/s}')).toContain('velocity');
    expect(normaliseWords('\\frac{a}{b}').join(' ')).not.toContain('frac');
  });

  it('drops the watermark and page furniture that appears on every source page', () => {
    registerFurniture(['examplepress']);
    const words = normaliseWords('ExamplePress.com Practice Tests page 3 acceleration');
    expect(words).toContain('acceleration');
    expect(words).not.toContain('examplepress');
    expect(words).not.toContain('page');
  });

  it('is case insensitive', () => {
    expect(normaliseWords('Momentum')).toEqual(normaliseWords('MOMENTUM'));
  });
});

describe('shingles', () => {
  it('produces every contiguous window of the requested size', () => {
    expect(shingles(['a', 'b', 'c', 'd'], 2)).toEqual(['a b', 'b c', 'c d']);
  });

  it('produces nothing when the text is shorter than the window', () => {
    expect(shingles(['a', 'b'], 8)).toEqual([]);
  });

  it('skips windows that are mostly folded numbers', () => {
    const roster = Array(12).fill(NUMBER_TOKEN) as string[];
    expect(shingles(roster, 8)).toEqual([]);
  });

  it('keeps a window once half its tokens are real words', () => {
    const words = [
      'mass',
      NUMBER_TOKEN,
      'kg',
      NUMBER_TOKEN,
      'force',
      NUMBER_TOKEN,
      'newton',
      'acts',
    ];
    expect(shingles(words, 8)).toHaveLength(1);
  });
});

describe('numeric rosters', () => {
  it('does not flag a question just for listing the same numbers as a source', () => {
    const index2 = buildReferenceIndex(
      ['The universal set is U = {1, 2, 3, 4, 5, 6, 7, 8} and A = {2, 4, 6, 8}.'],
      8,
    );
    const report = checkOriginality(
      'roster',
      'Let S be the set {1, 2, 3, 4, 5, 6, 7, 8}. How many subsets of S have exactly three elements?',
      index2,
    );
    expect(report.flags).toEqual([]);
  });
});

describe('hashShingle', () => {
  it('is stable and distinguishes different text', () => {
    expect(hashShingle('a b c')).toBe(hashShingle('a b c'));
    expect(hashShingle('a b c')).not.toBe(hashShingle('a b d'));
  });
});

describe('checkOriginality — the shingle rule', () => {
  it('flags a sentence lifted verbatim from the corpus', () => {
    const report = checkOriginality(
      'q1',
      'An object of mass 5 kg is placed on a horizontal surface. The coefficient of friction is 0.2.',
      index,
    );
    expect(report.flags.some((f) => f.rule === 'shingle')).toBe(true);
  });

  it('still flags it when only the numbers were swapped', () => {
    const report = checkOriginality(
      'q2',
      'An object of mass 3 kg is placed on a horizontal surface. The coefficient of friction is 0.4.',
      index,
    );
    expect(report.flags.some((f) => f.rule === 'shingle')).toBe(true);
  });

  it('passes a question that tests the same skill in a different scenario', () => {
    const report = checkOriginality(
      'q3',
      'A crate weighing 40 N rests on a loading ramp. Sliding friction between crate and ramp has ' +
        'coefficient 0.25. Find the friction force while a 6 N push acts along the ramp.',
      index,
    );
    expect(report.flags).toEqual([]);
  });

  it('passes short text that cannot fill a window', () => {
    expect(checkOriginality('q4', 'Find the slope.', index).flags).toEqual([]);
  });

  it('names the run it found, so the item can be rewritten precisely', () => {
    const report = checkOriginality(
      'q5',
      'An object of mass 9 kg is placed on a horizontal surface today.',
      index,
    );
    const flag = report.flags.find((f) => f.rule === 'shingle');
    expect(flag?.detail).toContain('object of mass');
  });
});

describe('checkOriginality — the numeric rule', () => {
  it('finds ordered runs of three or more numbers', () => {
    expect(numericTuplesOf('5 kg, 0.2, 8 N')).toContain('5|0.2|8');
  });

  it('ignores a numeric collision when the wording is unrelated', () => {
    const report = checkOriginality(
      'q6',
      'A sequence begins 5, 0.2, 8 and continues by the same rule. Give the fourth term.',
      index,
    );
    expect(report.flags.some((f) => f.rule === 'numeric')).toBe(false);
  });

  it('does not fire on a numeric run the corpus never used', () => {
    const report = checkOriginality(
      'q7',
      'A trolley of mass 7 kg accelerates at 1.4 m/s2 under a 17 N push on a rough bench.',
      index,
    );
    expect(report.flags.some((f) => f.rule === 'numeric')).toBe(false);
  });
});

describe('buildReferenceIndex', () => {
  it('stores hashes rather than the source text', () => {
    for (const hash of index.hashes) expect(typeof hash).toBe('number');
    expect(JSON.stringify([...index.hashes])).not.toContain('friction');
  });

  it('counts what it indexed', () => {
    expect(index.sourceCount).toBe(REFERENCE.length);
    expect(index.wordCount).toBeGreaterThan(50);
    expect(index.documents).toHaveLength(REFERENCE.length);
  });

  it('reports nothing to check against for an empty corpus', () => {
    const empty = buildReferenceIndex([], 8);
    expect(
      checkOriginality('q', 'anything at all goes here, no matter how long', empty).flags,
    ).toEqual([]);
  });
});

describe('jaccard', () => {
  it('is 1 for identical sets and 0 when nothing is shared', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
  });

  it('is 0 when either side is empty', () => {
    expect(jaccard(new Set(), new Set(['a']))).toBe(0);
  });
});
