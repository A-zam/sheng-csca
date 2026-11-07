import { describe, expect, it } from 'vitest';
import { FALLBACK_HINT, hintFor, sentences } from '../lib/hints.ts';

const question = {
  options: ['$\{5\} \in T$', '$5 \subseteq T$', '$\{5\} \subseteq T$', '$7 \in T$'],
  correctIndex: 2,
  distractorRationale: [
    'Uses $\in$ where $\subseteq$ is needed. The correct statement is $\{5\} \subseteq T$.',
    'A single element cannot be a subset unless it is written inside braces.',
    null,
    'Here $f(x) = 0.5 \cdot x$. Then $\{5\} \subseteq T$ follows.',
  ],
};

describe('sentences', () => {
  it('does not split inside maths or at a decimal point', () => {
    expect(sentences('Took $v = 2.5$. Then stopped. Done')).toEqual([
      'Took $v = 2.5$.',
      'Then stopped.',
      'Done',
    ]);
  });
});

describe('hintFor', () => {
  it('keeps the named mistake and drops a sentence that announces the answer', () => {
    expect(hintFor(question, 0)).toBe('Uses $\in$ where $\subseteq$ is needed.');
  });

  it('passes a rationale that gives nothing away through unchanged', () => {
    expect(hintFor(question, 1)).toBe(question.distractorRationale[1]);
  });

  it('drops a sentence that contains the correct option itself', () => {
    expect(hintFor(question, 3)).toBe('Here $f(x) = 0.5 \cdot x$.');
  });

  it('falls back to a general hint when there is no rationale', () => {
    expect(hintFor(question, 2)).toBe(FALLBACK_HINT);
  });
});
