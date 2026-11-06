/**
 * npm run check:originality
 *
 * Builds a hashed shingle index from reference/ in memory, then tests every
 * published stem and solution against it. Nothing derived from the corpus is
 * written outside reference/ (which is gitignored), so no build output can
 * carry source text.
 *
 * Flagged items get rewritten. They never ship.
 */
import { loadCalibration, loadQuestions, loadReferenceTexts } from './lib/load.ts';
import { buildReferenceIndex, checkOriginality } from '../lib/originality.ts';

const calibration = loadCalibration();
const shingleSize = (calibration.originalityPolicy as { shingleSize: number }).shingleSize;

const { questions, origin, failures } = loadQuestions();
if (failures.length > 0) {
  console.error('Some question files do not parse. Run `npm run validate:content` first.');
  process.exit(1);
}

const { texts, sources, missingTool } = loadReferenceTexts();

if (texts.length === 0) {
  if (missingTool) {
    console.error(
      'reference/ holds PDFs but `pdftotext` is not on PATH, so they cannot be read.\n' +
        'Install poppler-utils (or drop pre-extracted .txt files into reference/) and run this again.\n' +
        'Refusing to report "zero flags" against an index that was never built.',
    );
    process.exit(1);
  }
  console.log(
    'reference/ is empty or absent, so there is nothing to check against.\n' +
      'This is expected on a clone: the corpus is input only and is never committed.',
  );
  console.log(`Checked 0 of ${questions.length} question(s). Nothing to flag.`);
  process.exit(0);
}

const index = buildReferenceIndex(texts, shingleSize);
console.log(
  `Indexed ${index.sourceCount} reference document(s), ` +
    `${index.wordCount.toLocaleString('en')} normalised words, ` +
    `${index.hashes.size.toLocaleString('en')} distinct ${shingleSize}-word runs.`,
);
if (missingTool) {
  console.error('\nAt least one reference PDF could not be extracted (pdftotext unavailable).');
  process.exit(1);
}

const flagged: Array<{ id: string; file: string; detail: string }> = [];

for (const question of questions) {
  // Stem and solution are both published surfaces, so both get checked.
  for (const [field, text] of [
    ['stem', question.stem],
    ['solution', question.solution],
  ] as const) {
    const report = checkOriginality(question.id, text, index);
    for (const flag of report.flags) {
      flagged.push({
        id: `${question.id} (${field})`,
        file: origin.get(question.id) ?? '?',
        detail: `${flag.rule}: ${flag.detail}`,
      });
    }
  }
}

console.log(`Checked ${questions.length} question(s) against the corpus.`);

if (flagged.length > 0) {
  console.error(`\n${flagged.length} originality flag(s):`);
  for (const item of flagged) {
    console.error(`  x ${item.id}  (${item.file})`);
    console.error(`      ${item.detail}`);
  }
  console.error(
    '\nRewrite each flagged item. Change the scenario and the wording, not just the numbers.',
  );
  process.exit(1);
}

console.log(`Sources indexed: ${sources.length}. Zero flags.`);
