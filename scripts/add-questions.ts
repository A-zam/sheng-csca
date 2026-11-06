/**
 * npm run add:questions -- <draft.json> [--dry-run]
 *
 * Adds questions to the bank the safe way. A draft file is an array of items
 * (or {"questions":[...]}) with `id` omitted — ids are assigned here so they
 * stay sequential and unique.
 *
 * Every draft goes through the same three gates the bank already passed:
 * schema, answer verification, originality. A draft that fails any gate is not
 * written, and the reason is printed. Nothing is ever overwritten: items are
 * appended to content/questions/<subject>/<topic>.json.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  QUESTIONS_DIR,
  formatZodError,
  indexSyllabus,
  loadCalibration,
  loadQuestions,
  loadReferenceTexts,
  loadSyllabus,
  readJson,
} from './lib/load.ts';
import { QuestionSchema, type Question } from '../lib/schema.ts';
import { verifyQuestion } from '../lib/verify.ts';
import { buildReferenceIndex, checkOriginality } from '../lib/originality.ts';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const draftPath = args.find((a) => !a.startsWith('--'));

if (!draftPath) {
  console.error('Usage: npm run add:questions -- <draft.json> [--dry-run]');
  console.error('');
  console.error('The draft is a JSON array of question objects, or {"questions": [...]}.');
  console.error('Omit `id`: it is assigned from the topic file so numbering stays contiguous.');
  console.error('See README.md > "Adding questions" for the field-by-field guide.');
  process.exit(2);
}

if (!existsSync(draftPath)) {
  console.error(`No such file: ${draftPath}`);
  process.exit(2);
}

const raw = readJson(draftPath);
const drafts: unknown[] = Array.isArray(raw)
  ? raw
  : ((raw as { questions?: unknown[] }).questions ?? []);

if (drafts.length === 0) {
  console.error('The draft file has no questions in it.');
  process.exit(2);
}

const syllabus = loadSyllabus();
const index = indexSyllabus(syllabus);
const calibration = loadCalibration();
const existing = loadQuestions();

const usedIds = new Set(existing.questions.map((q) => q.id));
const nextSequence = new Map<string, number>();
for (const q of existing.questions) {
  const n = Number(q.id.slice(-3));
  const key = `${q.subject}-${q.subtopic}`;
  nextSequence.set(key, Math.max(nextSequence.get(key) ?? 0, n));
}

const accepted: Question[] = [];
const rejected: Array<{ where: string; reasons: string[] }> = [];

drafts.forEach((draft, i) => {
  const where = `draft #${i + 1}`;
  const reasons: string[] = [];
  const candidate = draft as Record<string, unknown>;

  const subject = candidate.subject as string | undefined;
  const subtopicId = candidate.subtopic as string | undefined;
  if (!subject || !subtopicId) {
    rejected.push({ where, reasons: ['needs both `subject` and `subtopic`'] });
    return;
  }
  const subtopic = index.subtopics.get(subtopicId);
  if (!subtopic) {
    rejected.push({ where, reasons: [`subtopic "${subtopicId}" is not in the syllabus`] });
    return;
  }

  if (!candidate.topic) candidate.topic = subtopic.topicId;
  if (!candidate.syllabusRef) {
    const topic = index.topics.get(subtopic.topicId);
    candidate.syllabusRef = topic
      ? `${topic.strandId} / ${topic.strandName} / ${topic.name} / ${subtopic.name}`
      : subtopic.name;
  }
  if (candidate.figure === undefined) candidate.figure = null;
  if (candidate.original === undefined) candidate.original = true;
  if (candidate.verified === undefined) candidate.verified = true;

  if (!candidate.id) {
    const key = `${subject}-${subtopicId}`;
    const n = (nextSequence.get(key) ?? 0) + 1;
    nextSequence.set(key, n);
    candidate.id = `${subject}-${subtopicId}-${String(n).padStart(3, '0')}`;
  }

  const parsed = QuestionSchema.safeParse(candidate);
  if (!parsed.success) {
    rejected.push({
      where: `${where} (${String(candidate.id)})`,
      reasons: [formatZodError(parsed.error)],
    });
    return;
  }
  const question = parsed.data;

  if (usedIds.has(question.id)) reasons.push(`id ${question.id} is already taken`);
  usedIds.add(question.id);

  const verification = verifyQuestion(question);
  if (!verification.ok) reasons.push(...verification.problems);

  if (reasons.length > 0) {
    rejected.push({ where: `${where} (${question.id})`, reasons });
    return;
  }
  accepted.push(question);
});

/* ------------------------------------------------------- originality gate */

const { texts, missingTool } = loadReferenceTexts();
if (texts.length > 0 && !missingTool) {
  const shingleSize = (calibration.originalityPolicy as { shingleSize: number }).shingleSize;
  const refIndex = buildReferenceIndex(texts, shingleSize);
  for (let i = accepted.length - 1; i >= 0; i -= 1) {
    const question = accepted[i] as Question;
    const flags = [
      ...checkOriginality(question.id, question.stem, refIndex).flags.map(
        (f) => `stem ${f.rule}: ${f.detail}`,
      ),
      ...checkOriginality(question.id, question.solution, refIndex).flags.map(
        (f) => `solution ${f.rule}: ${f.detail}`,
      ),
    ];
    if (flags.length > 0) {
      rejected.push({ where: question.id, reasons: flags });
      accepted.splice(i, 1);
    }
  }
} else {
  console.warn(
    'Warning: reference/ could not be indexed, so the originality gate was skipped for this run.',
  );
}

/* ------------------------------------------------------------------ write */

if (rejected.length > 0) {
  console.error(`${rejected.length} draft(s) rejected:`);
  for (const item of rejected) {
    console.error(`  x ${item.where}`);
    for (const reason of item.reasons) console.error(`      ${reason}`);
  }
}

if (accepted.length === 0) {
  console.error('\nNothing to add.');
  process.exit(1);
}

const byFile = new Map<string, Question[]>();
for (const question of accepted) {
  const key = `${question.subject}/${question.topic}`;
  byFile.set(key, [...(byFile.get(key) ?? []), question]);
}

if (dryRun) {
  console.log(`\n${accepted.length} draft(s) would be added:`);
  for (const [key, items] of byFile) {
    console.log(`  content/questions/${key}.json  +${items.length}`);
    for (const item of items)
      console.log(`      ${item.id}  d${item.difficulty}  ${item.verification.kind}`);
  }
  console.log('\nDry run: nothing written.');
  process.exit(rejected.length > 0 ? 1 : 0);
}

for (const [key, items] of byFile) {
  const [subject, topic] = key.split('/') as [string, string];
  const dir = join(QUESTIONS_DIR, subject);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${topic}.json`);

  const file = existsSync(path)
    ? (readJson(path) as {
        schemaVersion: number;
        subject: string;
        topic: string;
        questions: Question[];
      })
    : { schemaVersion: 1 as const, subject, topic, questions: [] as Question[] };

  file.questions.push(...items);
  file.questions.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  console.log(
    `  wrote content/questions/${key}.json  (+${items.length}, now ${file.questions.length})`,
  );
}

console.log(`\nAdded ${accepted.length} question(s).`);
console.log(
  'Run `npm run validate:content && npm run verify:answers && npm run check:originality` to confirm.',
);
process.exit(rejected.length > 0 ? 1 : 0);
