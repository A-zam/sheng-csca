/**
 * npm run validate:content
 *
 * Schema validity, unique IDs, exactly one correct index, non-empty solution on
 * every question, plus the structural rules the bank has to hold to: IDs match
 * their subject and subtopic, subtopics exist in the syllabus, no duplicated
 * options, no figure that isn't inline SVG, and coverage against calibration.
 */
import { loadCalibration, loadQuestions, loadSyllabus, indexSyllabus } from './lib/load.ts';
import { SUBJECT_IDS, type Subject } from '../lib/schema.ts';

const errors: string[] = [];
const warnings: string[] = [];

const fail = (message: string) => errors.push(message);
const warn = (message: string) => warnings.push(message);

const syllabus = loadSyllabus();
const calibration = loadCalibration();
const index = indexSyllabus(syllabus);
const { questions, origin, files, failures } = loadQuestions();

for (const failure of failures) {
  fail(`${failure.file}: ${failure.message}`);
}

/* ------------------------------------------------------------- per question */

const seenIds = new Set<string>();
const seenStems = new Map<string, string>();

for (const q of questions) {
  const where = `${origin.get(q.id) ?? '?'} [${q.id}]`;

  if (seenIds.has(q.id)) fail(`${where}: duplicate question id`);
  seenIds.add(q.id);

  if (!q.id.startsWith(`${q.subject}-${q.subtopic}-`)) {
    fail(`${where}: id must be "${q.subject}-${q.subtopic}-NNN"`);
  }

  const subtopic = index.subtopics.get(q.subtopic);
  if (!subtopic) {
    fail(`${where}: subtopic "${q.subtopic}" is not in the syllabus`);
  } else {
    if (subtopic.subject !== q.subject) {
      fail(`${where}: subtopic "${q.subtopic}" belongs to ${subtopic.subject}, not ${q.subject}`);
    }
    if (subtopic.topicId !== q.topic) {
      fail(
        `${where}: subtopic "${q.subtopic}" sits under topic ${subtopic.topicId}, not ${q.topic}`,
      );
    }
  }

  const topic = index.topics.get(q.topic);
  if (!topic) fail(`${where}: topic "${q.topic}" is not in the syllabus`);
  else if (!q.syllabusRef.includes(topic.name)) {
    warn(`${where}: syllabusRef does not name its topic ("${topic.name}")`);
  }

  if (q.correctIndex < 0 || q.correctIndex > 3) {
    fail(`${where}: correctIndex ${q.correctIndex} is out of range`);
  }

  const normalisedOptions = q.options.map((o) => o.replace(/\s+/g, ' ').trim());
  const uniqueOptions = new Set(normalisedOptions);
  if (uniqueOptions.size !== 4) fail(`${where}: options are not all distinct`);

  for (const option of q.options) {
    if (/^(all|none) of the (above|others)/i.test(option.replace(/[$\\]/g, '').trim())) {
      fail(`${where}: "all/none of the above" options are not allowed`);
    }
  }

  if (q.solution.trim().length < 30)
    fail(`${where}: solution is too short to be a worked explanation`);
  if (q.distractorRationale.some((r) => r.trim().length < 10)) {
    fail(`${where}: every distractorRationale entry must explain the specific mistake`);
  }

  if (q.figure !== null) {
    const svg = q.figure.trim();
    if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
      fail(`${where}: figure must be a complete inline <svg> element`);
    }
    if (/<image|xlink:href|href\s*=\s*"(?!#)/i.test(svg)) {
      fail(`${where}: figure references an external asset`);
    }
    if (!/viewBox=/.test(svg)) fail(`${where}: figure needs a viewBox so it scales on phones`);
    if (!/currentColor/.test(svg)) {
      warn(`${where}: figure hard-codes colours; use currentColor so it works in dark mode`);
    }
  }

  if (!q.original) fail(`${where}: original must be true — nothing derivative ships`);

  // Near-duplicate stems inside the bank itself.
  //
  // Digits and operators are kept, not just letters. A maths stem is often
  // almost all symbols — "Solve $(x-2)(x+5)<0$." reduces to three letters —
  // so a letters-only key would collide for every quadratic in the bank.
  const stemKey = q.stem
    .toLowerCase()
    .replace(/\\[a-z]+/g, ' ') // LaTeX control words carry no distinguishing content
    .replace(/[^a-z0-9+\-*/^=<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  const previous = seenStems.get(stemKey);
  if (previous) fail(`${where}: stem is a near-duplicate of ${previous}`);
  seenStems.set(stemKey, q.id);

  const balanced = countUnescaped(q.stem, '$') % 2 === 0;
  if (!balanced) fail(`${where}: stem has an unbalanced $ delimiter`);
  for (const [i, option] of q.options.entries()) {
    if (countUnescaped(option, '$') % 2 !== 0) {
      fail(`${where}: option ${'ABCD'[i]} has an unbalanced $ delimiter`);
    }
  }
  if (countUnescaped(q.solution, '$') % 2 !== 0) {
    fail(`${where}: solution has an unbalanced $ delimiter`);
  }
}

/* --------------------------------------------------------------- aggregates */

const bySubject = new Map<Subject, typeof questions>();
for (const subject of SUBJECT_IDS) {
  bySubject.set(
    subject,
    questions.filter((q) => q.subject === subject),
  );
}

for (const [subject, items] of bySubject) {
  const label = index.subjects.get(subject)?.name ?? subject;
  if (items.length < 150) {
    fail(`${label}: ${items.length} questions — the bank needs at least 150`);
  }

  // Every syllabus topic needs at least three questions.
  for (const [topicId, topic] of index.topics) {
    if (topic.subject !== subject) continue;
    const count = items.filter((q) => q.topic === topicId).length;
    if (count < 3)
      fail(`${label}: topic ${topicId} (${topic.name}) has only ${count} question(s), needs 3`);
  }

  const floor = (calibration.bankTargets as { floorPerSubtopic: number }).floorPerSubtopic;
  for (const [subtopicId, subtopic] of index.subtopics) {
    if (subtopic.subject !== subject) continue;
    const count = items.filter((q) => q.subtopic === subtopicId).length;
    if (count === 0) fail(`${label}: subtopic ${subtopicId} (${subtopic.name}) has no questions`);
    else if (count < floor) {
      fail(`${label}: subtopic ${subtopicId} has ${count} question(s), the floor is ${floor}`);
    }
  }

  // Every strand must be able to fill its slice of a mock paper.
  const blueprint = (calibration.paperBlueprint as Record<string, unknown>)[subject] as {
    byStrand: Record<string, { total: number }>;
  };
  const strandOfTopic = new Map<string, string>();
  for (const [topicId, topic] of index.topics) strandOfTopic.set(topicId, topic.strandId);
  for (const [strandId, want] of Object.entries(blueprint.byStrand)) {
    const have = items.filter((q) => strandOfTopic.get(q.topic) === strandId).length;
    if (have < want.total) {
      fail(
        `${label}: strand ${strandId} has ${have} question(s) but a mock paper needs ${want.total}`,
      );
    }
  }

  // Difficulty spread against calibration.
  const target = calibration.difficulty.targetDistribution as Record<string, number>;
  const tolerance = calibration.difficulty.tolerance as number;
  for (const level of ['1', '2', '3', '4', '5']) {
    const share = items.filter((q) => String(q.difficulty) === level).length / items.length;
    const want = target[level] ?? 0;
    if (Math.abs(share - want) > tolerance) {
      warn(
        `${label}: difficulty ${level} is ${(share * 100).toFixed(1)}% of the bank, ` +
          `calibration targets ${(want * 100).toFixed(0)}% (±${(tolerance * 100).toFixed(0)})`,
      );
    }
  }

  // Answer-key balance: no letter should dominate.
  for (let i = 0; i < 4; i += 1) {
    const share = items.filter((q) => q.correctIndex === i).length / items.length;
    if (share < 0.15 || share > 0.35) {
      warn(`${label}: option ${'ABCD'[i]} is the answer ${(share * 100).toFixed(1)}% of the time`);
    }
  }

  const conceptual = items.filter((q) => q.verification.kind === 'conceptual').length;
  if (conceptual / items.length > 0.4) {
    warn(
      `${label}: ${((conceptual / items.length) * 100).toFixed(0)}% of items are conceptual-only`,
    );
  }
}

/* ------------------------------------------------------------------- report */

function countUnescaped(text: string, char: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === char && text[i - 1] !== '\\') count += 1;
  }
  return count;
}

console.log(`Read ${files.length} question file(s), ${questions.length} question(s).`);
for (const subject of SUBJECT_IDS) {
  const items = bySubject.get(subject) ?? [];
  const name = index.subjects.get(subject)?.name ?? subject;
  const topics = new Set(items.map((q) => q.topic)).size;
  const subtopics = new Set(items.map((q) => q.subtopic)).size;
  console.log(
    `  ${name.padEnd(12)} ${String(items.length).padStart(4)} questions, ${topics} topics, ${subtopics} subtopics`,
  );
}

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}

console.log('\nContent validation passed.');
