import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { QuestionFileSchema, type Question } from '../lib/schema.ts';
import { tokenize, stripMath } from '../lib/latex-text.ts';

/**
 * Renders every LaTeX fragment in the whole bank through KaTeX.
 *
 * "The maths renders correctly" is not something you can confirm by opening a
 * few pages: one malformed `\frac` in question 240 would show as red source
 * text and nobody would notice. This is the only way to know for all 343.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUESTIONS_DIR = join(REPO_ROOT, 'content', 'questions');

function loadAll(): Question[] {
  const out: Question[] = [];
  for (const subject of readdirSync(QUESTIONS_DIR)) {
    const dir = join(QUESTIONS_DIR, subject);
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const parsed = QuestionFileSchema.parse(JSON.parse(readFileSync(join(dir, name), 'utf8')));
      out.push(...parsed.questions);
    }
  }
  return out;
}

const questions = loadAll();

/** Every LaTeX run in a question, labelled by where it came from. */
function fragmentsOf(q: Question): Array<{ where: string; tex: string; display: boolean }> {
  const surfaces: Array<[string, string]> = [
    ['stem', q.stem],
    ['solution', q.solution],
    ...q.options.map((o, i) => [`option ${'ABCD'[i]}`, o] as [string, string]),
    ...q.distractorRationale.map((r, i) => [`rationale ${'ABCD'[i]}`, r] as [string, string]),
  ];
  return surfaces.flatMap(([where, text]) =>
    tokenize(text)
      .filter((t) => t.kind === 'math')
      .map((t) => ({ where, tex: t.value, display: t.display })),
  );
}

describe('the shipped bank', () => {
  it('has questions to check', () => {
    expect(questions.length).toBeGreaterThanOrEqual(300);
  });

  it('renders every LaTeX fragment without a KaTeX error', () => {
    const failures: string[] = [];
    let fragments = 0;

    for (const q of questions) {
      for (const { where, tex, display } of fragmentsOf(q)) {
        fragments += 1;
        // throwOnError:false is what the app uses, so it would render the
        // source in red rather than crash. Here we want to hear about it.
        try {
          katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: false });
        } catch (error) {
          failures.push(`${q.id} ${where}: ${(error as Error).message} — in "${tex.slice(0, 60)}"`);
        }
      }
    }

    expect(fragments).toBeGreaterThan(1000);
    expect(failures, failures.slice(0, 10).join('\n')).toEqual([]);
  });

  it('leaves no stray dollar sign outside a maths run', () => {
    const offenders: string[] = [];
    for (const q of questions) {
      for (const [where, text] of [
        ['stem', q.stem],
        ['solution', q.solution],
      ] as Array<[string, string]>) {
        // After tokenizing, a `$` surviving in a text run means a delimiter
        // was never closed and the maths would render as literal source.
        const stray = tokenize(text).some((t) => t.kind === 'text' && t.value.includes('$'));
        if (stray) offenders.push(`${q.id} ${where}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('gives every stem something to actually read', () => {
    // Mathematics stems in the real papers are often pure symbols — "sin 120° =
    // ( )" is a whole question — so prose is not required. KaTeX is configured
    // to emit MathML alongside its HTML, so a symbol-only stem is still
    // announced by a screen reader. What must never happen is a stem that is
    // empty of both prose and maths.
    const empty = questions.filter((q) => {
      const prose = stripMath(q.stem).replace(/[^a-z0-9]/gi, '');
      const maths = tokenize(q.stem).filter((t) => t.kind === 'math');
      return prose.length < 3 && maths.length === 0;
    });
    expect(empty.map((q) => q.id)).toEqual([]);
  });

  it('keeps physics stems in prose, where the scenario carries the question', () => {
    // Physics is the other way round: a bare formula with no scenario is not a
    // CSCA physics question, and the corpus median stem is 163 characters.
    const tooTerse = questions
      .filter((q) => q.subject === 'physics')
      .filter((q) => stripMath(q.stem).replace(/[^a-z]/gi, '').length < 40)
      .map((q) => q.id);
    expect(tooTerse).toEqual([]);
  });

  it('uses no LaTeX macro KaTeX cannot handle', () => {
    // \label, \ref and friends parse in LaTeX but silently do nothing here.
    const banned = /\\(label|ref|cite|footnote|includegraphics|newcommand)\b/;
    const offenders = questions
      .filter((q) => banned.test(q.stem) || banned.test(q.solution))
      .map((q) => q.id);
    expect(offenders).toEqual([]);
  });
});
