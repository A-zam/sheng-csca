import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CalibrationSchema,
  QuestionFileSchema,
  SyllabusSchema,
  SUBJECT_IDS,
  type Calibration,
  type Question,
  type Subject,
  type Syllabus,
} from '../../lib/schema.ts';
import { registerFurniture } from '../../lib/originality.ts';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT_DIR = join(REPO_ROOT, 'content');
export const QUESTIONS_DIR = join(CONTENT_DIR, 'questions');
export const REFERENCE_DIR = join(REPO_ROOT, 'reference');

/**
 * Every directory treated as input-only corpus for the originality check.
 *
 * All of these are gitignored. Anything dropped into one of them is read for
 * comparison and never copied, quoted or shipped.
 */
export const CORPUS_DIRS = [
  REFERENCE_DIR,
  join(REPO_ROOT, 'Study Pack - Math'),
  join(REPO_ROOT, 'Study Pack - Physics'),
];

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadSyllabus(): Syllabus {
  return SyllabusSchema.parse(readJson(join(CONTENT_DIR, 'syllabus.json')));
}

export function loadCalibration(): Calibration {
  return CalibrationSchema.parse(readJson(join(CONTENT_DIR, 'calibration.json')));
}

export interface LoadedQuestions {
  questions: Question[];
  /** Which file each question came from, for error messages. */
  origin: Map<string, string>;
  files: string[];
  /** Files that failed schema validation, with the reason. */
  failures: Array<{ file: string; message: string }>;
}

export function loadQuestions(): LoadedQuestions {
  const questions: Question[] = [];
  const origin = new Map<string, string>();
  const files: string[] = [];
  const failures: Array<{ file: string; message: string }> = [];

  if (!existsSync(QUESTIONS_DIR)) return { questions, origin, files, failures };

  for (const subject of SUBJECT_IDS) {
    const dir = join(QUESTIONS_DIR, subject);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith('.json')) continue;
      const path = join(dir, name);
      const rel = relative(REPO_ROOT, path).replace(/\\/g, '/');
      files.push(rel);
      const parsed = QuestionFileSchema.safeParse(readJson(path));
      if (!parsed.success) {
        failures.push({ file: rel, message: formatZodError(parsed.error) });
        continue;
      }
      if (parsed.data.subject !== subject) {
        failures.push({
          file: rel,
          message: `file declares subject "${parsed.data.subject}" but lives in questions/${subject}/`,
        });
        continue;
      }
      for (const question of parsed.data.questions) {
        questions.push(question);
        origin.set(question.id, rel);
      }
    }
  }

  return { questions, origin, files, failures };
}

export function formatZodError(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

/* ------------------------------------------------------------ syllabus index */

export interface SyllabusIndex {
  subjects: Map<
    Subject,
    { name: string; questionCount: number; timeLimitMinutes: number; totalPoints: number }
  >;
  topics: Map<string, { subject: Subject; name: string; strandId: string; strandName: string }>;
  subtopics: Map<string, { subject: Subject; topicId: string; name: string }>;
}

export function indexSyllabus(syllabus: Syllabus): SyllabusIndex {
  const index: SyllabusIndex = {
    subjects: new Map(),
    topics: new Map(),
    subtopics: new Map(),
  };
  for (const subject of syllabus.subjects) {
    index.subjects.set(subject.id, {
      name: subject.name,
      questionCount: subject.questionCount,
      timeLimitMinutes: subject.timeLimitMinutes,
      totalPoints: subject.totalPoints,
    });
    for (const strand of subject.strands) {
      for (const topic of strand.topics) {
        index.topics.set(topic.id, {
          subject: subject.id,
          name: topic.name,
          strandId: strand.id,
          strandName: strand.name,
        });
        for (const subtopic of topic.subtopics) {
          index.subtopics.set(subtopic.id, {
            subject: subject.id,
            topicId: topic.id,
            name: subtopic.name,
          });
        }
      }
    }
  }
  return index;
}

/* ------------------------------------------------------------ reference text */

/**
 * Watermarks particular to the supplied corpus: words to ignore when comparing
 * text, and phrases that must never reach a build. Kept in a file inside the
 * gitignored reference/ directory so the public repo names no source. Missing
 * on a fresh clone, which simply means there is nothing extra to ignore.
 */
export function loadCorpusMarkers(): { furniture: string[]; phrases: string[] } {
  const path = join(REFERENCE_DIR, '.corpus-markers.json');
  if (!existsSync(path)) return { furniture: [], phrases: [] };
  const raw = readJson(path) as { furniture?: unknown; phrases?: unknown };
  const strings = (value: unknown) =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  return { furniture: strings(raw.furniture), phrases: strings(raw.phrases) };
}

/**
 * Extract plain text from every PDF in reference/, caching to
 * reference/.extracted/ (which is inside the gitignored directory, so nothing
 * derived from the corpus can reach a commit or a build output).
 */
export function loadReferenceTexts(): { texts: string[]; sources: string[]; missingTool: boolean } {
  const texts: string[] = [];
  const sources: string[] = [];
  const pdfs: string[] = [];
  registerFurniture(loadCorpusMarkers().furniture);

  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.toLowerCase().endsWith('.pdf')) pdfs.push(path);
      else if (name.toLowerCase().endsWith('.txt')) {
        texts.push(readFileSync(path, 'utf8'));
        sources.push(relative(REPO_ROOT, path).replace(/\\/g, '/'));
      }
    }
  };

  for (const root of CORPUS_DIRS) {
    if (existsSync(root)) walk(root);
  }

  let missingTool = false;
  const cacheDir = join(REFERENCE_DIR, '.extracted');
  for (const pdf of pdfs) {
    // Cache key includes the whole path, so two papers with the same file name
    // in different corpus directories do not overwrite each other.
    const key = `${relative(REPO_ROOT, pdf).replace(/[^A-Za-z0-9._-]/g, '_')}.txt`;
    const cached = join(cacheDir, key);
    if (existsSync(cached)) {
      texts.push(readFileSync(cached, 'utf8'));
      sources.push(relative(REPO_ROOT, pdf).replace(/\\/g, '/'));
      continue;
    }
    const extracted = extractPdf(pdf, cached);
    if (extracted === null) {
      missingTool = true;
      continue;
    }
    texts.push(extracted);
    sources.push(relative(REPO_ROOT, pdf).replace(/\\/g, '/'));
  }

  return { texts, sources, missingTool };
}

function extractPdf(pdf: string, cachePath: string): string | null {
  const probe = spawnSync('pdftotext', ['-v'], { encoding: 'utf8' });
  if (probe.error) return null;
  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    // pdftotext cannot open a path holding non-ASCII characters on Windows, and
    // some corpus folders are named in Chinese. Stage such files under an
    // ASCII-only temporary name first.
    let source = pdf;
    let staged: string | null = null;
    if (/[^ -~]/.test(pdf)) {
      staged = `${cachePath}.src.pdf`;
      copyFileSync(pdf, staged);
      source = staged;
    }
    execFileSync('pdftotext', ['-layout', source, cachePath], { stdio: 'ignore' });
    if (staged) rmSync(staged, { force: true });
    return readFileSync(cachePath, 'utf8');
  } catch {
    return null;
  }
}
