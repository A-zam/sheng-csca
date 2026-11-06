/**
 * npm run check:leak
 *
 * Proves the acceptance criterion that the reference corpus reaches no build
 * output. Three independent checks:
 *
 *   1. No corpus file is copied into out/, .next/ or public/.
 *   2. No distinctive phrase from the corpus appears in any shipped file.
 *   3. The verification blocks — which hold the answer derivations — are
 *      stripped from the published question data.
 *
 * Checking filenames alone is not enough: Next.js ships its own files called
 * `server-reference-manifest.json`, which match a naive search for "reference"
 * and would make this pass or fail for the wrong reason.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { CORPUS_DIRS, REPO_ROOT, loadCorpusMarkers } from './lib/load.ts';

const OUTPUT_DIRS = ['out', '.next', 'public'].map((d) => join(REPO_ROOT, d));

/**
 * Watermark and boilerplate that appears throughout the supplied papers. Any
 * of these turning up in a build output means source text was copied through.
 * The generic ones are listed here; those naming a publisher or channel come
 * from reference/.corpus-markers.json, so this public file names no source.
 */
const CORPUS_PHRASES = ['Candidate No', 'PRACTICE PAPER -', ...loadCorpusMarkers().phrases];

const TEXT_EXTENSIONS = new Set([
  '.html',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.txt',
  '.css',
  '.map',
  '.rsc',
  '.meta',
  '',
]);

const problems: string[] = [];

function walk(dir: string, onFile: (path: string) => void) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, onFile);
    else onFile(path);
  }
}

/* 1 — no corpus file copied anywhere near a build output --------------------- */

const corpusNames = new Set<string>();
for (const dir of CORPUS_DIRS) {
  if (!existsSync(dir)) continue;
  walk(dir, (path) => {
    const name = path.split(/[\\/]/).pop();
    if (name) corpusNames.add(name.toLowerCase());
  });
}

let scanned = 0;
let searched = 0;

for (const dir of OUTPUT_DIRS) {
  if (!existsSync(dir)) continue;
  walk(dir, (path) => {
    scanned += 1;
    const name = (path.split(/[\\/]/).pop() ?? '').toLowerCase();
    if (corpusNames.has(name)) {
      problems.push(`corpus file copied into a build output: ${relative(REPO_ROOT, path)}`);
    }
    if (extname(path).toLowerCase() === '.pdf') {
      problems.push(`a PDF reached a build output: ${relative(REPO_ROOT, path)}`);
    }

    /* 2 — no corpus text inside any shipped file ----------------------------- */
    if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase())) return;
    let body: string;
    try {
      body = readFileSync(path, 'utf8');
    } catch {
      return;
    }
    searched += 1;
    for (const phrase of CORPUS_PHRASES) {
      if (body.includes(phrase)) {
        problems.push(`corpus phrase "${phrase}" found in ${relative(REPO_ROOT, path)}`);
      }
    }
  });
}

/* 3 — the answer derivations must not ship ---------------------------------- */

const publicData = join(REPO_ROOT, 'public', 'data');
if (existsSync(publicData)) {
  walk(publicData, (path) => {
    if (extname(path) !== '.json') return;
    const body = readFileSync(path, 'utf8');
    if (body.includes('"verification"')) {
      problems.push(
        `published data still carries a verification block: ${relative(REPO_ROOT, path)}`,
      );
    }
  });
}

console.log(
  `Scanned ${scanned} build file(s), searched ${searched} of them for corpus text, ` +
    `against ${corpusNames.size} known corpus filename(s).`,
);

if (problems.length > 0) {
  console.error(`\n${problems.length} leak(s):`);
  for (const p of problems) console.error(`  x ${p}`);
  process.exit(1);
}

console.log('No reference material reaches out/, .next/ or public/.');
