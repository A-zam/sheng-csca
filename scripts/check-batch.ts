/**
 * npm run check:batch -- content/questions/math/M1.json [...more files]
 *
 * Runs the three gates against one file (or a few) instead of the whole bank:
 * schema, answer verification, originality. Use it while a topic is still being
 * written — the bank-wide checks in validate-content.ts only pass once every
 * topic exists, but this one is meaningful from the first question.
 */
import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import {
  REPO_ROOT,
  indexSyllabus,
  loadCalibration,
  loadReferenceTexts,
  loadSyllabus,
  readJson,
  formatZodError,
} from './lib/load.ts';
import { QuestionFileSchema } from '../lib/schema.ts';
import { verifyQuestion } from '../lib/verify.ts';
import { buildReferenceIndex, checkOriginality } from '../lib/originality.ts';

const paths = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (paths.length === 0) {
  console.error('Usage: npm run check:batch -- <file.json> [more.json ...]');
  process.exit(2);
}

const syllabus = loadSyllabus();
const calibration = loadCalibration();
const index = indexSyllabus(syllabus);
const bankTargets = calibration.bankTargets as Record<
  string,
  { bySubtopic: Record<string, number> }
>;
const floor = (calibration.bankTargets as { floorPerSubtopic: number }).floorPerSubtopic;

const errors: string[] = [];
const warnings: string[] = [];
const seenIds = new Set<string>();
let total = 0;
let quantitative = 0;

const allText: Array<{ id: string; field: string; text: string }> = [];

for (const path of paths) {
  if (!existsSync(path)) {
    errors.push(`${path}: no such file`);
    continue;
  }
  const rel = relative(REPO_ROOT, path).replace(/\\/g, '/');
  const parsed = QuestionFileSchema.safeParse(readJson(path));
  if (!parsed.success) {
    errors.push(`${rel}: ${formatZodError(parsed.error)}`);
    continue;
  }

  const file = parsed.data;
  const bySubtopic = new Map<string, number>();

  for (const q of file.questions) {
    total += 1;
    const where = `${rel} [${q.id}]`;

    if (seenIds.has(q.id)) errors.push(`${where}: duplicate id in this batch`);
    seenIds.add(q.id);

    if (q.subject !== file.subject) errors.push(`${where}: subject does not match the file`);
    if (q.topic !== file.topic) errors.push(`${where}: topic does not match the file`);
    if (!q.id.startsWith(`${q.subject}-${q.subtopic}-`)) {
      errors.push(`${where}: id must be "${q.subject}-${q.subtopic}-NNN"`);
    }

    const subtopic = index.subtopics.get(q.subtopic);
    if (!subtopic) errors.push(`${where}: subtopic "${q.subtopic}" is not in the syllabus`);
    else if (subtopic.topicId !== q.topic) {
      errors.push(`${where}: subtopic "${q.subtopic}" sits under ${subtopic.topicId}`);
    }

    bySubtopic.set(q.subtopic, (bySubtopic.get(q.subtopic) ?? 0) + 1);

    const normalised = q.options.map((o) => o.replace(/\s+/g, ' ').trim());
    if (new Set(normalised).size !== 4) errors.push(`${where}: options are not all distinct`);
    for (const option of q.options) {
      if (/^(all|none) of the (above|others)/i.test(option.replace(/[$\\]/g, '').trim())) {
        errors.push(`${where}: "all/none of the above" options are not allowed`);
      }
    }

    for (const [label, text] of [
      ['stem', q.stem],
      ['solution', q.solution],
      ...q.options.map((o, i) => [`option ${'ABCD'[i]}`, o] as [string, string]),
    ] as Array<[string, string]>) {
      if (countUnescaped(text, '$') % 2 !== 0) {
        errors.push(`${where}: ${label} has an unbalanced $ delimiter`);
      }
    }

    if (q.figure !== null) {
      const svg = q.figure.trim();
      if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
        errors.push(`${where}: figure must be a complete inline <svg> element`);
      }
      if (/<image|xlink:href|href\s*=\s*"(?!#)/i.test(svg)) {
        errors.push(`${where}: figure references an external asset`);
      }
      if (!/viewBox=/.test(svg)) errors.push(`${where}: figure needs a viewBox`);
      if (!/currentColor/.test(svg)) {
        warnings.push(`${where}: figure hard-codes colours; use currentColor for dark mode`);
      }
    }

    const result = verifyQuestion(q);
    if (result.quantitative) quantitative += 1;
    if (!result.ok) {
      for (const problem of result.problems) errors.push(`${where}: ${problem}`);
    }

    allText.push({ id: q.id, field: 'stem', text: q.stem });
    allText.push({ id: q.id, field: 'solution', text: q.solution });
  }

  // Subtopic coverage against the bank target for this topic.
  const targets = bankTargets[file.subject]?.bySubtopic ?? {};
  const expected = Object.entries(targets).filter(([id]) => id.split('.')[0] === file.topic);
  for (const [subtopicId, want] of expected) {
    const got = bySubtopic.get(subtopicId) ?? 0;
    if (got < floor) {
      errors.push(`${rel}: subtopic ${subtopicId} has ${got} question(s), the floor is ${floor}`);
    } else if (got !== want) {
      warnings.push(`${rel}: subtopic ${subtopicId} has ${got}, calibration targets ${want}`);
    }
  }
  for (const subtopicId of bySubtopic.keys()) {
    if (!expected.some(([id]) => id === subtopicId)) {
      errors.push(`${rel}: subtopic ${subtopicId} is not a subtopic of topic ${file.topic}`);
    }
  }

  const counts = [0, 1, 2, 3].map((i) => file.questions.filter((q) => q.correctIndex === i).length);
  const most = Math.max(...counts);
  if (file.questions.length >= 8 && most / file.questions.length > 0.45) {
    warnings.push(`${rel}: answer key is lopsided — A/B/C/D used ${counts.join('/')} times`);
  }
}

/* -------------------------------------------------------------- originality */

const { texts, missingTool } = loadReferenceTexts();
if (texts.length > 0 && !missingTool) {
  const shingleSize = (calibration.originalityPolicy as { shingleSize: number }).shingleSize;
  const refIndex = buildReferenceIndex(texts, shingleSize);
  for (const item of allText) {
    for (const flag of checkOriginality(item.id, item.text, refIndex).flags) {
      errors.push(`${item.id} (${item.field}): originality ${flag.rule} — ${flag.detail}`);
    }
  }
} else {
  warnings.push('reference/ could not be indexed, so the originality gate did not run');
}

/* ------------------------------------------------------------------ report */

function countUnescaped(text: string, char: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === char && text[i - 1] !== '\\') count += 1;
  }
  return count;
}

console.log(`${total} question(s) in ${paths.length} file(s); ${quantitative} machine-verified.`);

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}

console.log('\nBatch passes schema, answer verification and originality.');
