/**
 * Splitting authored question text into plain runs and LaTeX runs.
 *
 * Kept out of the React component so it can be unit tested: a tokenizer bug
 * shows up as maths that silently renders as literal `$x^2$`, which is exactly
 * the kind of thing that is easy to miss by eye across 300+ questions.
 */

export type TextToken =
  { kind: 'text'; value: string } | { kind: 'math'; value: string; display: boolean };

/**
 * `$$...$$` is display maths, `$...$` is inline, `\$` is a literal dollar sign.
 * An unbalanced `$` is left as text rather than swallowing the rest of the
 * string — a rendering glitch in one spot beats a blank question.
 */
export function tokenize(input: string): TextToken[] {
  const tokens: TextToken[] = [];
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (buffer) {
      tokens.push({ kind: 'text', value: buffer });
      buffer = '';
    }
  };

  while (i < input.length) {
    const char = input[i] as string;

    if (char === '\\' && input[i + 1] === '$') {
      buffer += '$';
      i += 2;
      continue;
    }

    if (char === '$') {
      const display = input[i + 1] === '$';
      const fence = display ? '$$' : '$';
      const start = i + fence.length;
      const end = findClose(input, start, fence);
      if (end === -1) {
        buffer += char;
        i += 1;
        continue;
      }
      flush();
      tokens.push({ kind: 'math', value: input.slice(start, end), display });
      i = end + fence.length;
      continue;
    }

    buffer += char;
    i += 1;
  }

  flush();
  return tokens;
}

function findClose(input: string, from: number, fence: string): number {
  for (let i = from; i < input.length; i += 1) {
    if (input[i] === '\\') {
      i += 1;
      continue;
    }
    if (input.startsWith(fence, i)) return i;
  }
  return -1;
}

/** Blank lines separate paragraphs. */
export function paragraphs(input: string): string[] {
  return input.split(/\n{2,}/);
}

/** The text with all maths removed, for aria-labels and plain-text contexts. */
export function stripMath(input: string): string {
  return tokenize(input)
    .map((token) => (token.kind === 'text' ? token.value : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
