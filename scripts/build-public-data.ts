/**
 * Runs before `next dev` and `next build`.
 *
 * Turns content/ into static JSON under public/data/, split so the browser
 * downloads only what it needs:
 *
 *   public/data/manifest.json          syllabus + one small record per question
 *   public/data/q/<subject>/<topic>.json   the full questions for one topic
 *
 * The manifest is enough to filter, to build a mock paper, and to draw the
 * dashboard. Question text, options and solutions arrive a topic at a time.
 * That keeps first paint small on a slow connection, which is most of the
 * audience.
 *
 * Nothing derived from reference/ is written here — only original content.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, loadCalibration, loadQuestions, loadSyllabus } from './lib/load.ts';
import { SUBJECT_IDS, type Question, type Subject } from '../lib/schema.ts';

const PUBLIC_DATA = join(REPO_ROOT, 'public', 'data');

const syllabus = loadSyllabus();
const calibration = loadCalibration();
const { questions, failures } = loadQuestions();

if (failures.length > 0) {
  console.error('Cannot build public data: some question files do not parse.');
  for (const failure of failures) console.error(`  x ${failure.file}: ${failure.message}`);
  process.exit(1);
}

/** One row per question. Everything the app needs before opening a question. */
export interface ManifestQuestion {
  id: string;
  s: Subject;
  t: string;
  st: string;
  d: number;
}

const manifest = {
  builtAt: new Date().toISOString(),
  subjects: syllabus.subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    shortName: subject.shortName,
    questionCount: subject.questionCount,
    timeLimitMinutes: subject.timeLimitMinutes,
    totalPoints: subject.totalPoints,
    strands: subject.strands.map((strand) => ({
      id: strand.id,
      name: strand.name,
      topics: strand.topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        subtopics: topic.subtopics.map((s) => ({ id: s.id, name: s.name })),
      })),
    })),
  })),
  paperBlueprint: calibration.paperBlueprint,
  difficultyLabels: {
    '1': 'Recall',
    '2': 'Single step',
    '3': 'Standard',
    '4': 'Multi-step',
    '5': 'Challenging',
  },
  questions: questions
    .map<ManifestQuestion>((q) => ({
      id: q.id,
      s: q.subject,
      t: q.topic,
      st: q.subtopic,
      d: q.difficulty,
    }))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })),
};

rmSync(PUBLIC_DATA, { recursive: true, force: true });
mkdirSync(join(PUBLIC_DATA, 'q'), { recursive: true });

writeFileSync(join(PUBLIC_DATA, 'manifest.json'), JSON.stringify(manifest), 'utf8');

const byTopic = new Map<string, Question[]>();
for (const question of questions) {
  const key = `${question.subject}/${question.topic}`;
  byTopic.set(key, [...(byTopic.get(key) ?? []), question]);
}

for (const subject of SUBJECT_IDS) {
  mkdirSync(join(PUBLIC_DATA, 'q', subject), { recursive: true });
}

let bytes = 0;
for (const [key, items] of byTopic) {
  const [subject, topic] = key.split('/') as [string, string];
  items.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  // The verification block is a build-time artefact. It never ships: it would
  // hand the reader the answer, and it is dead weight over the wire.
  const shipped = items.map(({ verification, ...rest }) => {
    void verification;
    return rest;
  });
  const path = join(PUBLIC_DATA, 'q', subject, `${topic}.json`);
  const json = JSON.stringify(shipped);
  writeFileSync(path, json, 'utf8');
  bytes += json.length;
}

const manifestBytes = JSON.stringify(manifest).length;
console.log(
  `public/data: manifest ${kb(manifestBytes)} + ${byTopic.size} topic chunk(s) ${kb(bytes)} ` +
    `(${questions.length} questions, average chunk ${kb(bytes / Math.max(1, byTopic.size))})`,
);

function kb(n: number): string {
  return `${(n / 1024).toFixed(1)} kB`;
}
