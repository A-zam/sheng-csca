/**
 * Expression evaluation for the answer verifier.
 *
 * Two jobs:
 *   1. Run a short JS expression that recomputes a question's answer.
 *   2. Turn the LaTeX of an option back into a number, so the recomputed answer
 *      can be cross-checked against the option the item actually keys.
 *
 * Both run only over content in this repository, from a CLI script and from the
 * test suite. Nothing here is reachable from the web app or from user input.
 */

export class EvaluationError extends Error {
  // A plain field, not a parameter property: Node runs these files with
  // strip-only TypeScript, which does not support parameter properties.
  readonly source: string;

  constructor(message: string, source: string) {
    super(`${message}  [in: ${source}]`);
    this.name = 'EvaluationError';
    this.source = source;
  }
}

const BANNED =
  /\b(require|import|process|globalThis|eval|Function|fetch|constructor|__proto__|prototype)\b/;

/**
 * Evaluate a JS expression with the given variables in scope.
 * `Math` is the only global available; anything else is a reference error.
 */
export function evaluateExpression(expression: string, vars: Record<string, number> = {}): number {
  if (BANNED.test(expression)) {
    throw new EvaluationError('expression uses a banned identifier', expression);
  }
  const names = Object.keys(vars);
  const values = names.map((n) => vars[n] as number);
  let result: unknown;
  try {
    const fn = new Function('Math', ...names, `"use strict"; return (${expression});`);
    result = fn(Math, ...values);
  } catch (error) {
    throw new EvaluationError(`threw while evaluating: ${(error as Error).message}`, expression);
  }
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new EvaluationError(
      `did not produce a finite number (got ${String(result)})`,
      expression,
    );
  }
  return result;
}

/* ------------------------------------------------------- LaTeX to a number */

/** Units and decoration that carry no numeric value. */
const UNIT_WORDS = [
  'm/s\\^2',
  'm/s2',
  'm/s',
  'km/h',
  'rad/s',
  'N\\s*·\\s*s',
  'N\\s*\\\\cdot\\s*s',
  'kg\\s*·\\s*m/s',
  'J/s',
  'kW\\s*·\\s*h',
  'V/m',
  'N/C',
  'N/m',
  'N\\s*m',
  'Wb',
  'Hz',
  'mm',
  'cm',
  'km',
  'm',
  's',
  'kg',
  'g',
  'N',
  'J',
  'W',
  'V',
  'A',
  'C',
  'T',
  'K',
  'Pa',
  'eV',
  'MeV',
  'ohm',
  'nm',
  'mA',
  'kJ',
  'kW',
  'mol',
];

function stripBalanced(input: string, command: string): string {
  // Removes `\command{...}` including nested braces, keeping nothing.
  let out = input;
  for (;;) {
    const start = out.indexOf(command + '{');
    if (start === -1) return out;
    let depth = 0;
    let i = start + command.length;
    for (; i < out.length; i += 1) {
      if (out[i] === '{') depth += 1;
      else if (out[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (i >= out.length) return out.slice(0, start);
    out = out.slice(0, start) + out.slice(i + 1);
  }
}

/** Find the `{...}` group starting at `open`, returning its body and end index. */
function readGroup(input: string, open: number): { body: string; end: number } | null {
  if (input[open] !== '{') return null;
  let depth = 0;
  for (let i = open; i < input.length; i += 1) {
    if (input[i] === '{') depth += 1;
    else if (input[i] === '}') {
      depth -= 1;
      if (depth === 0) return { body: input.slice(open + 1, i), end: i };
    }
  }
  return null;
}

/** Rewrite `\frac{A}{B}` (and `\dfrac`, `\tfrac`) into `((A)/(B))`, innermost first. */
function rewriteFractions(input: string): string {
  let out = input;
  for (const cmd of ['\\dfrac', '\\tfrac', '\\frac']) {
    for (;;) {
      const at = out.lastIndexOf(cmd);
      if (at === -1) break;
      const num = readGroup(out, at + cmd.length);
      if (!num) throw new Error(`malformed ${cmd}`);
      const den = readGroup(out, num.end + 1);
      if (!den) throw new Error(`malformed ${cmd} denominator`);
      out = `${out.slice(0, at)}((${num.body})/(${den.body}))${out.slice(den.end + 1)}`;
    }
  }
  return out;
}

function rewriteRoots(input: string): string {
  let out = input;
  for (;;) {
    const at = out.lastIndexOf('\\sqrt');
    if (at === -1) break;
    let cursor = at + '\\sqrt'.length;
    let index = '2';
    if (out[cursor] === '[') {
      const close = out.indexOf(']', cursor);
      if (close === -1) throw new Error('malformed \\sqrt index');
      index = out.slice(cursor + 1, close);
      cursor = close + 1;
    }
    const body = readGroup(out, cursor);
    if (!body) throw new Error('malformed \\sqrt');
    out = `${out.slice(0, at)}(Math.pow((${body.body}),1/(${index})))${out.slice(body.end + 1)}`;
  }
  return out;
}

function rewritePowers(input: string): string {
  let out = input;
  for (;;) {
    const at = out.lastIndexOf('^');
    if (at === -1) break;
    // Exponent: either a braced group or a single character.
    let exponent: string;
    let after: number;
    const group = readGroup(out, at + 1);
    if (group) {
      exponent = group.body;
      after = group.end + 1;
    } else {
      exponent = out.slice(at + 1, at + 2);
      after = at + 2;
      if (exponent === '-') {
        exponent = out.slice(at + 1, at + 3);
        after = at + 3;
      }
    }
    // Base: a closing bracket group, or a run of digits/letters/dots.
    let start = at;
    if (out[at - 1] === ')') {
      let depth = 0;
      let i = at - 1;
      for (; i >= 0; i -= 1) {
        if (out[i] === ')') depth += 1;
        else if (out[i] === '(') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      start = i;
    } else {
      let i = at - 1;
      while (i >= 0 && /[0-9a-zA-Z.]/.test(out[i] as string)) i -= 1;
      start = i + 1;
    }
    const base = out.slice(start, at);
    if (base.trim() === '') throw new Error('power with no base');
    out = `${out.slice(0, start)}(Math.pow((${base}),(${exponent})))${out.slice(after)}`;
  }
  return out;
}

/**
 * Turn an option written in LaTeX into the number it denotes.
 * Returns `null` when the option is not a single numeric quantity — a ratio,
 * an interval, an equation, a word. Callers treat that as "not cross-checkable".
 */
export function parseQuantity(latex: string): number | null {
  let s = latex.trim();

  // Reject things that are plainly not one number.
  if (/[=<>]|\\cup|\\infty|\\text\{[^}]*[a-z]{4}/i.test(s)) return null;
  if (/:\s*\d/.test(s)) return null; // ratios like "3 : 2"

  s = s.replace(/\$/g, '');
  s = s.replace(/\\left|\\right/g, '');
  s = s.replace(/\\!|\\,|\\;|\\:|\\quad|\\qquad/g, ' ');
  s = s.replace(/\\ /g, ' ');
  // Degrees, before \mathrm is stripped: authors write both `45^\circ` and the
  // braced `45^{\circ}`, and only handling one silently broke the cross-check.
  s = s.replace(/\^\s*\{\s*\\circ\s*\}/g, '');
  s = s.replace(/\^\s*\\circ/g, '');
  s = stripBalanced(s, '\\mathrm');
  s = stripBalanced(s, '\\text');
  s = stripBalanced(s, '\\operatorname');
  s = s.replace(/\\approx/g, '');
  s = s.replace(/\\pm/g, '');
  s = s.replace(/\\Omega|\\omega/g, '');
  s = s.replace(/\\mu\s*/g, '');
  // A unit split across several \mathrm groups — `\mathrm{kg}\cdot\mathrm{m/s}`
  // — leaves a dangling separator once the groups are gone. Drop separators
  // that no longer sit between two operands.
  s = s.replace(/(^|[^0-9)])\s*\\cdot\s*/g, '$1');
  s = s.replace(/\\cdot\s*$/g, '');

  try {
    s = rewriteFractions(s);
    s = rewriteRoots(s);
  } catch {
    return null;
  }

  s = s.replace(/\\times|\\cdot/g, '*');
  s = s.replace(/\\pi/g, 'Math.PI');
  s = s.replace(/\\e\b/g, 'Math.E');

  // Strip trailing unit text once the structure is gone.
  const unitPattern = new RegExp(`\\s*(${UNIT_WORDS.join('|')})\\s*$`, 'i');
  for (let i = 0; i < 3; i += 1) s = s.replace(unitPattern, '');

  try {
    s = rewritePowers(s);
  } catch {
    return null;
  }

  s = s.replace(/\s+/g, '');
  if (s === '') return null;
  // Implicit multiplication: "2Math.sqrt" style artefacts and "2(" groups.
  s = s.replace(/(\d)\(/g, '$1*(');
  s = s.replace(/(\d)Math\./g, '$1*Math.');
  s = s.replace(/\)\(/g, ')*(');
  s = s.replace(/\)Math\./g, ')*Math.');

  // Anything left that is not arithmetic means we cannot read it as a number.
  if (!/^[-+*/().0-9eE,]*$|^[-+*/().0-9]*(Math\.(PI|E|pow|sqrt)|[-+*/().0-9,])+$/.test(s)) {
    if (/[a-df-zA-DF-Z]/.test(s.replace(/Math\.(PI|E|pow|sqrt)/g, ''))) return null;
  }

  try {
    return evaluateExpression(s);
  } catch {
    return null;
  }
}

/** Does the option text carry this unit? Whitespace and \mathrm are ignored. */
export function optionHasUnit(latex: string, unit: string): boolean {
  const normalise = (v: string) =>
    v
      .replace(/\$/g, '')
      .replace(/\\mathrm|\\text|\\operatorname/g, '')
      .replace(/[{}\\\s]/g, '')
      .replace(/·/g, '.')
      .toLowerCase();
  return normalise(latex).includes(normalise(unit));
}

export function approxEqual(a: number, b: number, tolerance: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= tolerance * scale;
}

/**
 * Purely relative comparison, with no floor at 1.
 *
 * `approxEqual` never tightens below an absolute `tolerance`, which is right
 * when comparing a computed value to its declared one but wrong when comparing
 * two options: at physics scales, $1\times10^{-8}$ and $2\times10^{-8}$ sit far
 * closer than that floor and were being reported as the same value.
 */
export function relativeEqual(a: number, b: number, tolerance: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale === 0) return true;
  return Math.abs(a - b) <= tolerance * scale;
}
