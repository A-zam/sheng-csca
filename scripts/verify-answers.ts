/**
 * npm run verify:answers
 *
 * Recomputes every quantitative answer from the numbers in the stem and checks
 * it against the option the item keys. A wrong answer key is worse than a
 * missing question, so this has to pass at 100% before anything ships.
 */
import { loadQuestions } from './lib/load.ts';
import { verifyQuestion } from '../lib/verify.ts';
import { SUBJECT_IDS } from '../lib/schema.ts';

const { questions, origin, failures } = loadQuestions();

if (failures.length > 0) {
  console.error('Some question files do not parse. Run `npm run validate:content` first.');
  for (const failure of failures) console.error(`  x ${failure.file}: ${failure.message}`);
  process.exit(1);
}

let quantitative = 0;
let passed = 0;
const broken: Array<{ id: string; file: string; problems: string[] }> = [];
const noteworthy: Array<{ id: string; notes: string[] }> = [];

for (const question of questions) {
  const result = verifyQuestion(question);
  if (result.quantitative) {
    quantitative += 1;
    if (result.ok) passed += 1;
  }
  if (!result.ok) {
    broken.push({
      id: question.id,
      file: origin.get(question.id) ?? '?',
      problems: result.problems,
    });
  }
  if (result.notes.length > 0) noteworthy.push({ id: question.id, notes: result.notes });
}

for (const subject of SUBJECT_IDS) {
  const items = questions.filter((q) => q.subject === subject);
  if (items.length === 0) continue;
  const counts = { numeric: 0, symbolic: 0, conceptual: 0 };
  for (const q of items) counts[q.verification.kind] += 1;
  console.log(
    `${subject.padEnd(8)} ${String(items.length).padStart(4)} items — ` +
      `${counts.numeric} numeric, ${counts.symbolic} symbolic, ${counts.conceptual} conceptual`,
  );
}

console.log(
  `\n${passed}/${quantitative} quantitative answers independently recomputed and matched.`,
);

if (noteworthy.length > 0) {
  console.log(`\n${noteworthy.length} item(s) skipped the option cross-check:`);
  for (const item of noteworthy) {
    for (const note of item.notes) console.log(`  ~ ${item.id}: ${note}`);
  }
}

if (broken.length > 0) {
  console.error(`\n${broken.length} item(s) failed verification:`);
  for (const item of broken) {
    console.error(`  x ${item.id}  (${item.file})`);
    for (const problem of item.problems) console.error(`      ${problem}`);
  }
  process.exit(1);
}

console.log('Answer verification passed.');
