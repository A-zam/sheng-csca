/**
 * Originality checking.
 *
 * The reference corpus is input only: it is gitignored and never copied into the
 * repository. This module turns it into an in-memory index of *hashed* word
 * shingles, then tests every generated item against that index.
 *
 * Numbers are normalised to a placeholder before shingling, so "an object of
 * mass 5 kg is placed on a horizontal surface" and the same sentence with 3 kg
 * collide. That is deliberate: swapping the quantities is exactly the light
 * paraphrase the check exists to catch.
 */

/**
 * Generic page furniture that appears on every page of a source PDF.
 *
 * Watermarks naming a particular publisher or channel are not listed here, so
 * this public file does not say which materials the corpus holds. They live in
 * reference/.corpus-markers.json, inside the gitignored corpus, and are added
 * at run time by registerFurniture() when the corpus is loaded.
 */
const FURNITURE = new Set([
  'edu',
  'com',
  'math',
  'tech',
  'ltd',
  'co',
  'csca',
  'practice',
  'tests',
  'test',
  'exam',
  'page',
  'candidate',
  'name',
  'date',
  'subject',
  'instructions',
  'click',
  'text',
  'go',
  'created',
  'this',
  'was',
  'by',
  'you',
  'can',
]);

/** Add corpus-specific watermark words to the furniture that is ignored. */
export function registerFurniture(words: readonly string[]): void {
  for (const word of words) FURNITURE.add(word.toLowerCase());
}

export const NUMBER_TOKEN = '#';

/**
 * Reduce text to a comparable word stream:
 * strip LaTeX, fold numbers to `#`, drop page furniture and one-letter noise.
 */
export function normaliseWords(input: string): string[] {
  let text = input.toLowerCase();

  // LaTeX: drop control sequences but keep the words inside their arguments.
  text = text.replace(/\\(begin|end)\{[^}]*\}/g, ' ');
  text = text.replace(/\\[a-z]+\s*/gi, ' ');
  text = text.replace(/[{}$^_&~%]/g, ' ');

  // Fold every numeric literal, including 1.5, 1,200 and 10^{-3} remnants.
  text = text.replace(/\d[\d.,]*/g, ` ${NUMBER_TOKEN} `);

  const words = text
    .split(/[^a-z#]+/)
    .filter((w) => w.length > 0)
    .filter((w) => w === NUMBER_TOKEN || w.length > 1)
    .filter((w) => !FURNITURE.has(w));

  return words;
}

/**
 * Contiguous n-word windows, skipping any window that is mostly numbers.
 *
 * Because numbers are folded to `#`, a window sitting inside a roster like
 * $\{1,2,3,4,5,6,7,8\}$ becomes eight identical placeholders, and would collide
 * with every other list of eight numbers ever printed. Those windows carry no
 * evidence of copying, so a window has to be at least half real words to count.
 */
export function shingles(words: string[], size: number): string[] {
  if (words.length < size) return [];
  const minRealWords = Math.ceil(size / 2);
  const out: string[] = [];
  for (let i = 0; i + size <= words.length; i += 1) {
    const window = words.slice(i, i + size);
    const real = window.reduce((n, w) => (w === NUMBER_TOKEN ? n : n + 1), 0);
    if (real < minRealWords) continue;
    out.push(window.join(' '));
  }
  return out;
}

/** Small non-cryptographic hash. The index stores hashes, never source text. */
export function hashShingle(shingle: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < shingle.length; i += 1) {
    h ^= shingle.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface ReferenceIndex {
  shingleSize: number;
  /** Hashed shingles of every reference item. */
  hashes: Set<number>;
  /** Ordered numeric tuples seen in reference items, as "3|4|5" keys. */
  numericTuples: Map<string, number>;
  /** Word-frequency profile, used for the similarity half of the numeric rule. */
  documents: Array<Set<string>>;
  sourceCount: number;
  wordCount: number;
}

export function buildReferenceIndex(texts: string[], shingleSize: number): ReferenceIndex {
  const hashes = new Set<number>();
  const numericTuples = new Map<string, number>();
  const documents: Array<Set<string>> = [];
  let wordCount = 0;

  for (const text of texts) {
    const words = normaliseWords(text);
    wordCount += words.length;
    for (const s of shingles(words, shingleSize)) hashes.add(hashShingle(s));
    documents.push(new Set(words.filter((w) => w !== NUMBER_TOKEN)));

    for (const tuple of numericTuplesOf(text)) {
      numericTuples.set(tuple, (numericTuples.get(tuple) ?? 0) + 1);
    }
  }

  return {
    shingleSize,
    hashes,
    numericTuples,
    documents,
    sourceCount: texts.length,
    wordCount,
  };
}

/** Every ordered run of 3+ numbers appearing in a text, as a "|"-joined key. */
export function numericTuplesOf(text: string): string[] {
  const numbers = (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
  const out: string[] = [];
  for (let size = 3; size <= 5; size += 1) {
    for (let i = 0; i + size <= numbers.length; i += 1) {
      out.push(numbers.slice(i, i + size).join('|'));
    }
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of small) if (large.has(item)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export interface OriginalityFlag {
  rule: 'shingle' | 'numeric';
  detail: string;
}

export interface OriginalityReport {
  id: string;
  flags: OriginalityFlag[];
}

export const SIMILARITY_THRESHOLD = 0.45;

/**
 * Test one candidate text against the reference index.
 *
 * Rule 1 (shingle): any run of `shingleSize` normalised words that also occurs
 *   in a reference item.
 * Rule 2 (numeric): reusing a reference item's ordered numeric run of 3+ values
 *   while the surrounding wording is also more than 45% similar to some
 *   reference document.
 */
export function checkOriginality(
  id: string,
  text: string,
  index: ReferenceIndex,
): OriginalityReport {
  const flags: OriginalityFlag[] = [];
  const words = normaliseWords(text);

  const collided: string[] = [];
  for (const s of shingles(words, index.shingleSize)) {
    if (index.hashes.has(hashShingle(s))) collided.push(s);
  }
  if (collided.length > 0) {
    flags.push({
      rule: 'shingle',
      detail:
        `shares ${collided.length} run(s) of ${index.shingleSize}+ words with the reference corpus; ` +
        `first: "${collided[0]}"`,
    });
  }

  const tuples = numericTuplesOf(text).filter((t) => index.numericTuples.has(t));
  if (tuples.length > 0) {
    const candidateWords = new Set(words.filter((w) => w !== NUMBER_TOKEN));
    let best = 0;
    for (const doc of index.documents) best = Math.max(best, jaccard(candidateWords, doc));
    if (best > SIMILARITY_THRESHOLD) {
      flags.push({
        rule: 'numeric',
        detail:
          `reuses the numeric run [${(tuples[0] as string).split('|').join(', ')}] from a reference item ` +
          `with ${(best * 100).toFixed(0)}% wording overlap`,
      });
    }
  }

  return { id, flags };
}
