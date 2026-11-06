# CSCA Prep

Free practice for the **CSCA Mathematics and Physics papers**, in English:
**343 original questions** (170 Mathematics, 173 Physics), timed mock exams
built to the real paper blueprint, a spaced-repetition mistake bank, and a
progress dashboard. No accounts, no backend, no tracking — progress lives in the
visitor's browser.

**89% of the bank is machine-verified**: every quantitative answer is recomputed
from the numbers in the question and cross-checked against the marked option
before it can ship.

> Independent study resource. Not affiliated with, endorsed by, or connected to
> CSCA, the China Scholarship Council, or any university. Every question is
> original work written for this site, not past-paper material.

---

## Run it

Requires **Node 22.18 or newer** (the content scripts run TypeScript directly,
with no build step).

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

`npm run dev` and `npm run build` both run `build:data` first, which turns
`content/` into the static JSON under `public/data/` that the app fetches.

## Build and deploy

```bash
npm run build
```

The site is a fully static export: `next build` writes plain HTML, CSS and JSON
to `out/`. There is no server, no database and no runtime environment needed.

**Vercel** — import the repository and deploy. The defaults work; no
configuration required.

**Anything else** — serve `out/` from any static host: Netlify, Cloudflare
Pages, GitHub Pages, S3, nginx.

### Environment variables

All optional, all build-time, all public.

| Variable | Effect |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical and Open Graph URLs, and the `sitemap.xml` entries. Set this for a real deployment. |
| `NEXT_PUBLIC_REPO_URL` | "Report a problem with this question" opens a prefilled GitHub issue. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Fallback for the same link, as a prefilled `mailto:`. |

With neither `REPO_URL` nor `CONTACT_EMAIL` set, the report link is hidden
rather than rendered dead.

---

## What is in here

```
app/            routes: /, /practice, /mock, /review, /progress, /about, 404
components/     UI, including the KaTeX renderer and the question view
lib/            schema, scoring, spaced repetition, storage, originality, progress
content/        the source of truth — syllabus, calibration profile, questions
scripts/        content pipeline: validate, verify, originality, add, publish
tests/          unit tests for scoring, the scheduler, validation, originality
docs/           the authoring guide
reference/      YOUR past papers and notes — gitignored, input only, never shipped
```

### The content layer

- **`content/syllabus.json`** — the topic taxonomy. Four Mathematics modules and
  five Physics modules, each broken into topics and subtopics, each carrying a
  `verified` flag and the sources behind it.
- **`content/calibration.json`** — the profile the bank is built to: 48 questions
  in 60 minutes for 100 points, the official 40/30/30 easy/medium/complex split,
  a **paper blueprint** that says how one mock is assembled, and separate,
  flatter **bank targets** that say how many questions to author per subtopic.
- **`content/questions/{math,physics}/<topic>.json`** — the questions.

The app never reads `content/` at runtime. `scripts/build-public-data.ts`
publishes it to `public/data/` as a small manifest plus one chunk per topic, so
the browser downloads a few kilobytes up front and the rest only as needed. The
`verification` block is stripped on the way out — it would hand the reader the
answer.

---

## Adding questions

The full field-by-field guide is **[docs/authoring-questions.md](docs/authoring-questions.md)**.
`content/questions/math/M1.json` and `content/questions/physics/P11.json` are the
reference implementations. The short version:

1. Write a draft file — a JSON array of question objects. Omit `id`,
   `syllabusRef`, `figure`, `verified` and `original`; they are filled in for you.
2. Dry run, then commit:

```bash
npm run add:questions -- drafts/new-trig.json --dry-run
npm run add:questions -- drafts/new-trig.json
```

Ids are assigned so numbering stays contiguous per subtopic. A draft that fails
schema, answer verification or originality is **rejected with the reason and
never written**.

To check a file you edited by hand:

```bash
npm run check:batch -- content/questions/math/M5.json
```

### The three gates

Every question passes all three before it ships.

**Schema** (`npm run validate:content`) — Zod validation, unique ids, exactly one
correct index, a non-empty worked solution, four distinct options, a named
rationale for every distractor, inline SVG only for figures, and coverage: at
least 150 questions per subject, at least three per subtopic, and enough in every
strand to fill a mock paper.

**Answers** (`npm run verify:answers`) — every quantitative answer is recomputed
from the numbers in the stem and cross-checked three ways: the derivation must
produce the stated value, the marked option must read back as that same value,
and no other option may share it. Answers that are expressions, intervals or sets
are checked by sampling all four options and confirming exactly one matches.
Conceptual items — definitions, sign conventions — carry a written justification
instead, and are not counted as quantitative.

**Originality** (`npm run check:originality`) — builds a hashed 8-word shingle
index from `reference/` in memory and flags any published stem or solution
sharing a run of eight or more consecutive words with it. Numbers are folded to a
placeholder first, so swapping quantities does not evade the check. A flagged
item is rewritten, never waived.

Run everything at once:

```bash
npm run verify:all
```

Which currently reports:

```
Content validation passed.
math      170 items — 119 numeric, 44 symbolic, 7 conceptual
physics   173 items — 139 numeric, 3 symbolic, 31 conceptual
305/305 quantitative answers independently recomputed and matched.
Indexed 50 reference document(s), 121,263 distinct 8-word runs. Zero flags.
Test Files  5 passed (5)   Tests  109 passed (109)
No reference material reaches out/, .next/ or public/.
```

---

## `reference/` is input only

Put your past papers, notes and scanned PDFs in `reference/`, or in
`Study Pack - Math/` and `Study Pack - Physics/`. All three are scanned. They
are used to derive the topic-frequency and difficulty profile in
`calibration.json`, and as the corpus the originality checker tests against.

Those directories are gitignored and **never** committed, bundled, served, or
copied into `content/`, `public/` or any build output. `npm run check:leak`
proves it three ways: no corpus file is copied into a build output, no
distinctive corpus phrase appears in any shipped file, and the answer
derivations are stripped from the published question data. Nothing derived from it is
written outside that directory: the shingle index is built in memory on each run,
and extracted text is cached inside `reference/.extracted/`.

The originality check needs `pdftotext` (from poppler-utils) to read PDFs. If it
is missing, the check **fails loudly** rather than reporting a false clean bill of
health. Pre-extracted `.txt` files dropped into `reference/` are read directly.

On a fresh clone with no `reference/` directory, the check reports that there is
nothing to compare against and exits successfully — the corpus is deliberately
not part of the repository.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Publish content, then start the dev server |
| `npm run build` | Publish content, then build the static site to `out/` |
| `npm run build:data` | Publish `content/` to `public/data/` |
| `npm run typecheck` | `tsc --noEmit`, strict mode |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run validate:content` | Schema and coverage |
| `npm run verify:answers` | Recompute every quantitative answer |
| `npm run check:originality` | Compare the whole bank against `reference/` |
| `npm run check:batch -- <files>` | The three gates against one file |
| `npm run add:questions -- <draft>` | Add questions through all three gates |
| `npm run check:leak` | Prove no reference material reached `out/`, `.next/` or `public/` |
| `npm run check` | Typecheck, lint, all three content gates, and the tests |
| `npm run verify:all` | `check`, then a production build, then `check:leak` |

---

## Adding a third subject

The schema and routing were built for it. Chemistry, for example:

1. Add `'chemistry'` to `SUBJECT_IDS` in `lib/schema.ts`.
2. Add a subject entry to `content/syllabus.json` with its strands, topics and
   subtopics.
3. Add `paperBlueprint.chemistry` and `bankTargets.chemistry` to
   `content/calibration.json`.
4. Drop topic files into `content/questions/chemistry/`.

No component, route or script changes. Subject pickers, the mock builder and the
dashboard all read the manifest.

---

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript 5 strict ·
Tailwind CSS 4 · KaTeX · Zod · Vitest.

No database, no backend, no authentication, no paid APIs, no analytics, no
cookies, no third-party embeds. Progress is `localStorage` on the visitor's own
device, and the site says so plainly on `/about`.
