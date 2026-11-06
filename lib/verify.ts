import type { Question } from './schema.ts';
import {
  approxEqual,
  evaluateExpression,
  optionHasUnit,
  parseQuantity,
  relativeEqual,
} from './evaluate.ts';

/**
 * How far a printed option may sit from the exact answer and still count as
 * the same number. Options are routinely rounded — 1.33 for 4/3 — so this has
 * to be loose, but it is relative, so it does not smear together two genuinely
 * different values that happen to be small.
 */
const OPTION_TOLERANCE = 5e-3;

export interface VerificationResult {
  id: string;
  kind: Question['verification']['kind'];
  /** A quantitative item is one whose answer a machine can recompute. */
  quantitative: boolean;
  ok: boolean;
  problems: string[];
  /** Notes that do not fail the run but are worth printing. */
  notes: string[];
}

/**
 * Recompute a question's answer and cross-check it three ways:
 *   1. the declared `expression` produces the declared `expected` value;
 *   2. the keyed option, read back out of its LaTeX, is that same value;
 *   3. no *other* option is that same value (which would make the item ambiguous).
 *
 * A typo in the answer key fails check 2. A duplicated option fails check 3.
 */
export function verifyQuestion(question: Question): VerificationResult {
  const problems: string[] = [];
  const notes: string[] = [];
  const v = question.verification;

  if (v.kind === 'conceptual') {
    return {
      id: question.id,
      kind: 'conceptual',
      quantitative: false,
      ok: true,
      problems,
      notes,
    };
  }

  if (v.kind === 'numeric') {
    let computed: number | null = null;
    try {
      computed = evaluateExpression(v.expression);
    } catch (error) {
      problems.push(`expression failed: ${(error as Error).message}`);
    }

    if (computed !== null && !approxEqual(computed, v.expected, v.tolerance)) {
      problems.push(`expression produced ${computed} but "expected" says ${v.expected}`);
    }

    const keyed = question.options[question.correctIndex];
    if (keyed === undefined) {
      problems.push(`correctIndex ${question.correctIndex} has no option`);
    } else if (v.optionValue !== undefined) {
      if (!v.optionValueNote) {
        problems.push('optionValue override supplied without optionValueNote');
      }
      if (!approxEqual(v.optionValue, v.expected, v.tolerance)) {
        problems.push(`optionValue ${v.optionValue} does not match expected ${v.expected}`);
      }
      notes.push(`option cross-check skipped: ${v.optionValueNote ?? 'no reason given'}`);
    } else {
      const parsed = parseQuantity(keyed);
      if (parsed === null) {
        problems.push(
          `could not read a number out of the keyed option ${labelFor(question.correctIndex)} (${keyed}). ` +
            'Rewrite the option, or set verification.optionValue with a note saying why.',
        );
      } else if (!relativeEqual(parsed, v.expected, Math.max(v.tolerance, OPTION_TOLERANCE))) {
        problems.push(
          `keyed option ${labelFor(question.correctIndex)} reads as ${parsed}, but the answer is ${v.expected}`,
        );
      }

      if (v.unit && !optionHasUnit(keyed, v.unit)) {
        problems.push(`keyed option is missing the unit "${v.unit}"`);
      }
    }

    // No other option may share the answer's value.
    question.options.forEach((option, index) => {
      if (index === question.correctIndex) return;
      const parsed = parseQuantity(option);
      if (
        parsed !== null &&
        relativeEqual(parsed, v.expected, Math.max(v.tolerance, OPTION_TOLERANCE))
      ) {
        problems.push(
          `option ${labelFor(index)} has the same value as the answer — two options are correct`,
        );
      }
    });

    return {
      id: question.id,
      kind: 'numeric',
      quantitative: true,
      ok: problems.length === 0,
      problems,
      notes,
    };
  }

  // symbolic
  const samples = [...v.extraSamples, ...buildSamples(v.vars, v.domain, v.integerVars, v.samples)];
  const matches: boolean[] = [true, true, true, true];

  for (const sample of samples) {
    let reference: number;
    try {
      reference = evaluateExpression(v.reference, sample);
    } catch (error) {
      problems.push(`reference expression failed: ${(error as Error).message}`);
      break;
    }
    v.optionForms.forEach((form, index) => {
      if (!matches[index]) return;
      let value: number;
      try {
        value = evaluateExpression(form, sample);
      } catch {
        matches[index] = false;
        return;
      }
      if (!approxEqual(value, reference, v.tolerance)) matches[index] = false;
    });
  }

  if (problems.length === 0) {
    if (!matches[question.correctIndex]) {
      problems.push(
        `keyed option ${labelFor(question.correctIndex)} does not match the reference expression`,
      );
    }
    matches.forEach((matched, index) => {
      if (matched && index !== question.correctIndex) {
        problems.push(
          `option ${labelFor(index)} also matches the reference expression — two options are correct`,
        );
      }
    });
  }

  return {
    id: question.id,
    kind: 'symbolic',
    quantitative: true,
    ok: problems.length === 0,
    problems,
    notes,
  };
}

export function labelFor(index: number): string {
  return ['A', 'B', 'C', 'D'][index] ?? `#${index}`;
}

/** Deterministic sample points, so a failing run reproduces exactly. */
function buildSamples(
  vars: string[],
  domain: Array<[number, number]>,
  integerVars: string[],
  count: number,
): Array<Record<string, number>> {
  const samples: Array<Record<string, number>> = [];
  let seed = 20260907;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < count; i += 1) {
    const point: Record<string, number> = {};
    vars.forEach((name, index) => {
      const range = domain[index] ?? domain[0] ?? [1, 10];
      const [low, high] = range;
      const raw = low + next() * (high - low);
      point[name] = integerVars.includes(name) ? Math.round(raw) : raw;
    });
    samples.push(point);
  }
  return samples;
}
