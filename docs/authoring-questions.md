# Authoring questions

Everything in `content/questions/` follows this guide. A wrong answer key is
worse than a missing question, so the bar is: **every item is original, exactly
one option is defensibly correct, and a machine can check the key.**

Read `content/questions/math/M1.json` alongside this. It is the reference
implementation.

---

## 1. Where a question lives

One file per topic:

```
content/questions/math/M1.json      topic M1, subject math
content/questions/physics/P7.json   topic P7, subject physics
```

The file is:

```json
{
  "schemaVersion": 1,
  "subject": "math",
  "topic": "M1",
  "questions": [ ... ]
}
```

Topic and subtopic ids come from `content/syllabus.json`. How many questions each
subtopic needs comes from `content/calibration.json` → `bankTargets`.

Ids are `"<subject>-<subtopic>-<NNN>"`, numbered from `001` within each
subtopic: `math-M1.2-004`, `physics-P7.1-001`.

---

## 2. The fields

| Field | Notes |
|---|---|
| `id` | `math-M5.3-007`. Unique across the whole bank. |
| `subject` | `"math"` or `"physics"`. Matches the file. |
| `topic` | `"M5"`. Matches the file. |
| `subtopic` | `"M5.3"`. Must exist in `syllabus.json` under that topic. |
| `syllabusRef` | `"<strand id> / <strand name> / <topic name> / <subtopic name>"`. |
| `difficulty` | `1`–`5`. See §3. |
| `stem` | The question. LaTeX in `$...$`. |
| `options` | Exactly four strings, in display order A–D. |
| `correctIndex` | `0`–`3`. |
| `solution` | A worked explanation, not an assertion. See §5. |
| `distractorRationale` | Exactly four strings, parallel to `options`. The one at `correctIndex` says why it is right; the other three each name the specific mistake that produces them. |
| `figure` | Inline `<svg>` string, or `null`. See §7. |
| `verified` | `true` when the topic is `verified: true` in the syllabus. |
| `original` | Always `true`. Anything else fails validation. |
| `verification` | How the key is machine-checked. See §4. |

---

## 3. Difficulty

The real exam runs 40% easy, 30% medium, 30% complex. On the 1–5 scale:

| Level | Band | What it looks like |
|---|---|---|
| 1 | easy | One definition or one direct reading. No intermediate step. |
| 2 | easy | Substitute the given values into one formula. |
| 3 | medium | Two steps, or one step plus a rearrangement or unit conversion. |
| 4 | complex | Three or more steps, or combining two different results. |
| 5 | complex | Non-obvious setup, a case split, or a general (symbolic) answer. |

Aim for roughly **15% / 25% / 30% / 20% / 10%** across levels 1–5 in each topic
file. In a 14-question file that is about 2 / 4 / 4 / 3 / 1.

Every question must be answerable in about **75 seconds without a calculator**.
Choose numbers that divide cleanly.

---

## 4. `verification` — the answer key is checked by code

Three kinds. Prefer the first two: they catch a mis-keyed answer, whereas
`conceptual` only records why you believe the key.

### `numeric`

For an answer that is a single number.

```json
"verification": {
  "kind": "numeric",
  "expression": "0.2 * 5 * 10",
  "expected": 10,
  "tolerance": 1e-9,
  "unit": "N"
}
```

`expression` recomputes the answer **from the numbers in the stem**, using plain
JavaScript with `Math.*` available. The checker then:

1. evaluates `expression` and compares it to `expected`;
2. parses the number back out of the LaTeX of `options[correctIndex]` and
   compares that too;
3. confirms no *other* option carries the same value.

Write the expression as the derivation, not as the answer. `0.2 * 5 * 10` is
useful; `10` is not — it would pass even if the physics were wrong.

`unit` is checked against the keyed option's text. Include it whenever the
options carry units.

The option parser understands `\dfrac`, `\frac`, `\sqrt`, `\pi`, `^`,
`\times 10^{-3}`, `^\circ`, and `\mathrm{...}` units. If an option genuinely
cannot be parsed — a ratio like `3 : 2` — set `optionValue` to the number and
`optionValueNote` to the reason. Prefer rewriting the option.

### `symbolic`

For an answer that is an expression, an interval, or a set. Every option is
sampled as a function and exactly one must match the reference.

```json
"verification": {
  "kind": "symbolic",
  "vars": ["n"],
  "domain": [[1, 30]],
  "integerVars": ["n"],
  "reference": "3 * n - 1",
  "optionForms": ["3 * n - 1", "3 * n + 1", "3 * n", "n * n - 1"],
  "extraSamples": [],
  "tolerance": 1e-9,
  "samples": 40
}
```

For **intervals and sets**, encode each option as an indicator returning `1` or
`0`:

```json
"reference": "(x >= -1 && x < 4) ? 1 : 0",
"optionForms": [
  "(x >= -1 && x < 4) ? 1 : 0",
  "(x > -1 && x <= 4) ? 1 : 0",
  "(x >= -1 && x <= 4) ? 1 : 0",
  "(x < 4) ? 1 : 0"
],
"extraSamples": [{ "x": -1 }, { "x": 4 }]
```

**`extraSamples` is not optional when two options differ only at a boundary.**
Random sampling of a continuum never lands exactly on `-1` or `4`, so without
those points an open interval and a closed one look identical and the checker
reports two correct options. List every endpoint.

`reference` must be derived independently, not copied from the keyed option —
otherwise a mis-keyed item passes.

### `conceptual`

Only where no computation exists: definitions, sign conventions, "which
statement is wrong", necessary-and-sufficient classification.

```json
"verification": {
  "kind": "conceptual",
  "justification": "Force is defined as an interaction between two objects, so it always has both an agent and a receiver. Option C denies the receiver and is therefore the false statement."
}
```

At least 20 characters, and it must actually argue the key. Keep conceptual
items under about a third of a topic file.

---

## 5. Writing the question

**Stem.** Maths stems are terse — a median of 79 characters in the real papers.
Physics stems set up a short scenario then ask for one quantity — a median of
163 characters. Short sentences. No idioms. No culture-specific scenarios. The
reader is a non-native English speaker under time pressure.

**Options.** All four are the same kind of object: all numbers with the same
unit, or all intervals, or all equations. Never "all of the above" or "none of
the above".

**Balance the answer key.** Sorting numeric options into ascending order feels
tidy, but it parks the correct answer at B or C nearly every time, and a
test-wise candidate will notice. Spread `correctIndex` roughly evenly over
0–3 within each file; `check-batch` fails a file where one letter takes more
than 45% of the answers. Reordering options is free — they are interchangeable
by construction — so write the question first, then place the key. When you move
an option, **move its `distractorRationale` entry with it**: the two arrays are
parallel and a mismatch silently produces nonsense feedback.

**Solution.** Work the problem. Show the step that the distractors get wrong.
Use `**Step 1 — …**` headings once there is more than one step, `$$…$$` for
display maths, and a blank line between paragraphs. Do not write "clearly" or
"obviously".

**Distractor rationale.** Each wrong option must be reachable by one *named*
mistake:

> "Included $3$, treating $-3 < x$ as if it were $-3 \le x$."

Not "this is wrong". If you cannot name the mistake, the distractor is arbitrary
and the question needs a better one. Common named mistakes: sign slip, forgot to
convert °C to K, used weight instead of mass, swapped the two directions of an
implication, off-by-one on an interval endpoint, used $2^n$ where $n^2$ was
needed, forgot the factor of $\tfrac12$, dropped a unit prefix.

---

## 6. Physics conventions

- SI units, written `12.5\ \mathrm{m/s}`.
- **`g = 10\ \mathrm{m/s^2}`**, stated in the stem of every question where it
  matters. This matches the reference corpus and the exam.
- State any other constant you rely on, in the stem:
  `k = 9.0 \times 10^{9}`, `h = 6.63 \times 10^{-34}`,
  `c = 3.0 \times 10^{8}`, `e = 1.6 \times 10^{-19}`,
  `G = 6.67 \times 10^{-11}`, speed of sound `340\ \mathrm{m/s}`.
- Answers land on 1–3 significant figures.

## 7. Figures

`figure` is either `null` or one complete inline `<svg>` element. Never a path
to an image file — there is no image pipeline and a missing file is a broken
question.

- Must have a `viewBox` so it scales on a phone.
- Use `stroke="currentColor"` and `fill="currentColor"` so it works in dark
  mode. A hard-coded colour is a warning.
- No `<image>`, no `xlink:href`, no external `href`.
- Keep it small: a labelled incline, a circuit, a pair of charges. Text inside
  the SVG should be plain, not LaTeX.

Most questions need no figure. Add one only when the words alone are ambiguous.

---

## 8. Originality — the hard rule

The corpus in `reference/` and the Study Pack directories is **input only**. It
is gitignored and never quoted anywhere.

> Every published question is original work modelled on the corpus profile —
> never a reproduction, translation, or light paraphrase of a source item.
> Change the scenario, the quantities, and the wording. Same skill tested,
> different question.

`scripts/check-originality.ts` flags:

- any run of **8 or more consecutive words** shared with a source item, with
  numbers folded to a placeholder first — so swapping 5 kg for 7 kg does not
  evade it;
- reuse of a source item's ordered run of 3+ numbers when the wording around it
  is also more than 45% similar.

A flag is not a formality. Rewrite the item: change what the scenario is
*about*, not just its nouns. If a source asks about a block on a horizontal
surface, write about a crate on a loading ramp, and change what is being asked
for as well as the numbers.

---

## 9. Checking your work

```bash
npm run check:batch -- content/questions/math/M5.json
```

Runs schema, answer verification and originality against that file alone, and
reports subtopic counts against the calibration targets. It must print
**"Batch passes schema, answer verification and originality"** with zero errors.

Once every topic exists, the bank-wide gates apply:

```bash
npm run validate:content
npm run verify:answers
npm run check:originality
npm run test
```

## 10. Adding questions later

Write a draft file — an array of question objects with `id`, `topic`,
`syllabusRef`, `figure`, `verified` and `original` omitted — then:

```bash
npm run add:questions -- drafts/new-trig.json --dry-run
npm run add:questions -- drafts/new-trig.json
```

Ids are assigned so numbering stays contiguous. Drafts that fail schema,
verification or originality are rejected with the reason and never written.
