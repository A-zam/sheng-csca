/**
 * Hints for a wrong choice, built from that option's distractor rationale.
 *
 * A rationale names the mistake behind a wrong option, which is exactly the
 * nudge a student needs. Some also go on to state the right answer ("the
 * correct statement is ..."), which would end the search the hint is meant to
 * help with. Those sentences are dropped. If nothing survives, a general hint
 * is used instead.
 */

export interface HintSource {
  options: readonly string[];
  correctIndex: number;
  distractorRationale: readonly (string | null | undefined)[];
}

export const FALLBACK_HINT =
  'Go back to the question and check each step again, using exactly the numbers and conditions it gives.';

/** Words that announce the right answer outright. */
const GIVES_IT_AWAY =
  /\b(correct|right)\s+(answer|statement|option|value|choice|result)\b|\bthe answer is\b|\bwhich is the answer\b|\bgives the answer\b/i;

/**
 * Split prose into sentences without breaking LaTeX or decimals: a sentence
 * ends at `.`, `!` or `?` followed by a space, outside `$...$`.
 */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let current = '';
  let inMath = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    current += ch;
    if (ch === '$') inMath = !inMath;
    if (!inMath && (ch === '.' || ch === '!' || ch === '?') && /\s/.test(text[i + 1] ?? ' ')) {
      if (current.trim()) out.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Compare option text loosely: no dollar signs, braces or spacing. */
function squash(text: string): string {
  return text.replace(/[\s${}]/g, '').toLowerCase();
}

export function hintFor(question: HintSource, chosen: number): string {
  const rationale = question.distractorRationale[chosen];
  if (!rationale) return FALLBACK_HINT;

  const answer = squash(question.options[question.correctIndex] ?? '');
  const kept = sentences(rationale).filter((sentence) => {
    if (GIVES_IT_AWAY.test(sentence)) return false;
    // A short answer such as "$3$" would match by accident inside other text.
    if (answer.length >= 3 && squash(sentence).includes(answer)) return false;
    return true;
  });

  return kept.length > 0 ? kept.join(' ') : FALLBACK_HINT;
}
