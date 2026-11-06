import { z } from 'zod';

/**
 * The content schema. Everything in content/ is validated against this before it
 * can be loaded, at build time and again by `npm run validate:content`.
 *
 * Adding a third subject (Chemistry, say) means adding one entry to SUBJECT_IDS
 * and dropping a content/questions/<id>/ directory in. Nothing else changes.
 */
export const SUBJECT_IDS = ['math', 'physics'] as const;
export const SubjectId = z.enum(SUBJECT_IDS);

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} must not be empty`);

/* ------------------------------------------------------------------ syllabus */

export const SubtopicSchema = z.object({
  id: z.string().regex(/^[A-Z]+\d+\.\d+$/, 'subtopic id looks like "M5.3"'),
  name: nonEmpty('subtopic name'),
  verified: z.boolean(),
  note: z.string().optional(),
});

export const TopicSchema = z.object({
  id: z.string().regex(/^[A-Z]+\d+$/, 'topic id looks like "M5"'),
  name: nonEmpty('topic name'),
  verified: z.boolean(),
  note: z.string().optional(),
  subtopics: z.array(SubtopicSchema).min(1),
});

export const StrandSchema = z.object({
  id: nonEmpty('strand id'),
  name: nonEmpty('strand name'),
  officialWording: z.string().optional(),
  verified: z.boolean(),
  note: z.string().optional(),
  topics: z.array(TopicSchema).min(1),
});

export const SubjectSchema = z.object({
  id: SubjectId,
  name: nonEmpty('subject name'),
  shortName: nonEmpty('subject shortName'),
  questionCount: z.number().int().positive(),
  timeLimitMinutes: z.number().int().positive(),
  totalPoints: z.number().positive(),
  verified: z.boolean(),
  strands: z.array(StrandSchema).min(1),
});

export const SyllabusSchema = z.object({
  schemaVersion: z.literal(1),
  generatedFor: z.string(),
  disclaimer: z.string(),
  sources: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        publisher: z.string(),
        url: z.string().url().optional(),
        retrieved: z.string().optional(),
        kind: z.enum(['primary', 'secondary', 'corpus']),
        note: z.string().optional(),
      }),
    )
    .min(1),
  primarySourceUnavailable: z
    .object({
      attempted: z.array(z.string()),
      reason: z.string(),
      consequence: z.string(),
    })
    .optional(),
  subjects: z.array(SubjectSchema).min(1),
});

/* --------------------------------------------------------------- calibration */

export const StrandBlueprintSchema = z.object({
  total: z.number().int().positive(),
  easy: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  complex: z.number().int().nonnegative(),
});

export const SubjectBlueprintSchema = z.looseObject({
  total: z.number().int().positive(),
  byStrand: z.record(z.string(), StrandBlueprintSchema),
  byBand: z.object({
    easy: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    complex: z.number().int().nonnegative(),
  }),
});

export const BankTargetSchema = z.looseObject({
  totalTarget: z.number().int().positive(),
  byStrand: z.record(z.string(), z.number().int().nonnegative()),
  byTopic: z.record(z.string(), z.number().int().nonnegative()),
  bySubtopic: z.record(z.string(), z.number().int().nonnegative()),
  highFrequencyTopics: z.array(z.string()),
});

export const CalibrationSchema = z.looseObject({
  schemaVersion: z.literal(1),
  paperFormat: z.looseObject({
    questionsPerPaper: z.number().int().positive(),
    timeLimitMinutes: z.number().int().positive(),
    totalPoints: z.number().positive(),
    optionsPerQuestion: z.literal(4),
    optionLabels: z.array(z.string()).length(4),
    negativeMarking: z.boolean(),
    secondsPerQuestion: z.number().positive(),
  }),
  difficulty: z.looseObject({
    targetDistribution: z.record(z.string(), z.number()),
    targetCountsPerSubject: z.record(z.string(), z.number().int().nonnegative()),
    tolerance: z.number().positive(),
  }),
  paperBlueprint: z.looseObject({
    bandLevels: z.object({
      easy: z.array(z.number().int()),
      medium: z.array(z.number().int()),
      complex: z.array(z.number().int()),
    }),
    math: SubjectBlueprintSchema,
    physics: SubjectBlueprintSchema,
  }),
  bankTargets: z.looseObject({
    floorPerSubtopic: z.number().int().min(1),
    math: BankTargetSchema,
    physics: BankTargetSchema,
  }),
  originalityPolicy: z.looseObject({
    shingleSize: z.number().int().min(4),
  }),
});

/* ----------------------------------------------------------------- questions */

/**
 * How an item's answer key is checked by executable code.
 *
 * `numeric`   — recompute the answer from the stem's data and cross-check it
 *               against the number parsed out of the keyed option.
 * `symbolic`  — sample every option as a function of its variables and confirm
 *               exactly one matches the reference expression: the keyed one.
 * `conceptual`— no computation is possible (definitions, sign conventions,
 *               "which statement is wrong"). Not counted as quantitative.
 */
export const VerificationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('numeric'),
    /** JS expression recomputing the answer from first principles. Math.* only. */
    expression: nonEmpty('verification.expression'),
    /** The value the expression must produce. */
    expected: z.number().finite(),
    tolerance: z.number().positive().default(1e-9),
    /** Unit as it appears in the option, e.g. "m/s". Checked against the option text. */
    unit: z.string().optional(),
    /**
     * Escape hatch for options whose value cannot be parsed out of the LaTeX
     * (a ratio like "3 : 2", say). Supplying it skips the option cross-check,
     * so `optionValueNote` must say why.
     */
    optionValue: z.number().finite().optional(),
    optionValueNote: z.string().optional(),
  }),
  z.object({
    kind: z.literal('symbolic'),
    vars: z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)).min(1),
    /** Inclusive sampling range per variable, in the same order as `vars`. */
    domain: z.array(z.tuple([z.number(), z.number()])).min(1),
    integerVars: z.array(z.string()).default([]),
    /** JS expression for the correct answer, in terms of `vars`. */
    reference: nonEmpty('verification.reference'),
    /** JS expression for each option, in the same order as `options`. */
    optionForms: z.array(z.string()).length(4),
    tolerance: z.number().positive().default(1e-9),
    samples: z.number().int().min(8).default(40),
    /**
     * Points that are always tested, on top of the random ones. Needed wherever
     * two options differ only at a boundary — an open interval against a closed
     * one, say — which random sampling of a continuum will never hit.
     */
    extraSamples: z.array(z.record(z.string(), z.number())).default([]),
  }),
  z.object({
    kind: z.literal('conceptual'),
    justification: z.string().trim().min(20, 'conceptual items must justify the key in a sentence'),
  }),
]);

export const QuestionSchema = z.object({
  /** e.g. "math-M5.3-004". Unique across the whole bank. */
  id: z.string().regex(/^(math|physics)-[A-Z]+\d+\.\d+-\d{3}$/, 'id looks like "math-M5.3-004"'),
  subject: SubjectId,
  topic: z.string().regex(/^[A-Z]+\d+$/),
  subtopic: z.string().regex(/^[A-Z]+\d+\.\d+$/),
  /** Human-readable path: "M-B / Functions / Trigonometry / Sum, difference…". */
  syllabusRef: nonEmpty('syllabusRef'),
  difficulty: z.number().int().min(1).max(5),
  stem: nonEmpty('stem'),
  options: z.array(nonEmpty('option')).length(4),
  correctIndex: z.number().int().min(0).max(3),
  solution: z.string().trim().min(30, 'solution must actually work the problem'),
  /** One entry per option, same order. The entry at correctIndex says why it is right. */
  distractorRationale: z.array(nonEmpty('distractorRationale entry')).length(4),
  /** Inline SVG markup, or null. Never a path to an image file. */
  figure: z.string().nullable(),
  verified: z.boolean(),
  original: z.boolean(),
  verification: VerificationSchema,
});

export const QuestionFileSchema = z.object({
  schemaVersion: z.literal(1),
  subject: SubjectId,
  topic: z.string().regex(/^[A-Z]+\d+$/),
  questions: z.array(QuestionSchema).min(1),
});

export type Subject = z.infer<typeof SubjectId>;
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionFile = z.infer<typeof QuestionFileSchema>;
export type Verification = z.infer<typeof VerificationSchema>;
export type Syllabus = z.infer<typeof SyllabusSchema>;
export type SyllabusSubject = z.infer<typeof SubjectSchema>;
export type SyllabusStrand = z.infer<typeof StrandSchema>;
export type SyllabusTopic = z.infer<typeof TopicSchema>;
export type SyllabusSubtopic = z.infer<typeof SubtopicSchema>;
export type Calibration = z.infer<typeof CalibrationSchema>;
export type SubjectBlueprint = z.infer<typeof SubjectBlueprintSchema>;
export type StrandBlueprint = z.infer<typeof StrandBlueprintSchema>;
export type BankTarget = z.infer<typeof BankTargetSchema>;
export type DifficultyBand = 'easy' | 'medium' | 'complex';
