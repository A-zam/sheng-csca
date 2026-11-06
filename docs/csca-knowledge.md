# CSCA knowledge base

Everything learned about the CSCA exam while building this site, in one place.
Facts and aggregate figures only — no text from the reference corpus is
reproduced here. The machine-readable versions live in `content/syllabus.json`
and `content/calibration.json`; this file is the human-readable reasoning
behind them.

Last consolidated: 2026-11-07.

---

## 1. What the CSCA is

- **China Scholastic Competency Assessment.** The standardised entrance test for
  international undergraduate applicants to Chinese universities, run under the
  China Scholarship Council (CSC).
- **Mandatory from the 2026 intake.** The score report becomes a required
  application document.
- **Computer-based, multiple choice**, four options, exactly one correct.
- **Scores**: released about 7 business days after the sitting, electronically
  via csca.cn. **Valid for 2 years.** Universities verify online by certificate
  number. Admissions officers reportedly prefer the most recent cycle.
- **Test day**: arrive 30 minutes early with the original passport; identity is
  checked by facial recognition with the passport held to the camera.
- **Sittings**: several a year. One source gives Mathematics 15:30–16:30 and Physics
  17:30–18:30 Beijing time for a sitting; treat that as one data point, not a
  fixed timetable.

### The five subjects

| Subject | Questions | Time | Language | Who takes it |
|---|---|---|---|---|
| Mathematics | 48 MCQ | 60 min | English or Chinese | **Everyone** |
| Physics | 48 MCQ | 60 min | English or Chinese | Engineering, CS, physical sciences |
| Chemistry | 48 MCQ | 60 min | English or Chinese | Medicine (MBBS), chem eng, bio sciences |
| Humanities Chinese | 80 MCQ | 90 min | Chinese only | Chinese-taught humanities, arts, law, social science |
| STEM Chinese | 80 MCQ | 90 min | Chinese only | Chinese-taught STEM, engineering, medicine |

Professional Chinese is **not HSK**: it tests academic language (subject
vocabulary, reading, chart interpretation), in a science track and a humanities
track.

### Subject combinations by major (secondary source — always check the university)

| Major | English-taught | Chinese-taught |
|---|---|---|
| STEM (eng, CS, physics, maths) | Math + Physics | Math + Physics + STEM Chinese |
| Medicine / biology | Math + Chemistry (some also Physics) | Math + Chemistry + STEM Chinese |
| Business / social science | Math only | Math + Humanities Chinese |
| Arts / design / film | Math only | Math + Humanities Chinese |

Architecture is sometimes classed as engineering and then needs Physics too.

---

## 2. Scoring

- **100 points per subject.** With 48 questions that is ≈2.083 points each, so
  the published score is scaled, not a raw count. The site scales
  `round(correct / 48 × 100)`.
- **Average time per question: 75 seconds** (1.25 min). Every question on the
  site is written to be solvable in that without a calculator.
- **Negative marking: none stated anywhere, none visible in any paper.**
  Unverified, so the site scores +1 / 0 and tells students to answer
  everything — a guess costs nothing.

---

## 3. Difficulty

- **Official split: 40% easy / 30% medium / 30% complex.** Stated in both
  syllabus-analysis documents, broken down module by module.
- **Practice-paper p-values** (proportion of candidates answering correctly):
  practice material in the reference set labels every item with one of only
  three values, one per band: easy 0.94, medium 0.85, complex 0.65.

- **Site mapping to a 1–5 scale**: 1–2 = easy, 3 = medium, 4–5 = complex.
  Bank target 15 / 25 / 30 / 20 / 10 %.
- **Papers ramp**: roughly items 1–20 easy, 21–40 medium, 41–48 hard. Mock
  exams on the site reproduce that ordering.

---

## 4. Mathematics

### Paper blueprint (one 48-question paper)

| Module | Qs | % | Easy / Medium / Complex |
|---|---|---|---|
| M-1 Sets and Inequalities | 8 | 17% | 4 / 2 / 2 |
| M-2 Functions and Sequences | 16 | 33% | 6 / 5 / 5 |
| M-3 Geometry and Algebra | 14 | 29% | 5 / 5 / 4 |
| M-4 Probability and Statistics | 10 | 21% | 5 / 3 / 2 |
| **Total** | **48** | | **20 / 15 / 13** |

### Scope, from the module headings and the formula sheet

- **Sets and logic**: set operations, complement, De Morgan, necessary and
  sufficient conditions.
- **Inequalities**: properties, AM–GM, absolute-value, quadratic, rational.
- **Functions**: three essential elements (domain, range, rule), monotonicity,
  parity, periodicity, inverse functions, graph transformations;
  linear, quadratic, power, exponential, logarithmic.
- **Trigonometry** — *not named in the module heading, but the formula sheet
  gives it a full section and every real paper is dense with it*: definitions,
  same-angle identities, reduction formulae, sum/difference, double and half
  angle, graphs and period, **solving triangles (sine rule, cosine rule, area)**.
- **Sequences**: arithmetic and geometric, general term, sums, recurrences,
  recovering a_n from S_n.
- **Limits and derivatives**: definition, basic formulae, rules, tangent lines,
  monotonicity and extrema.
- **Analytic geometry**: lines (forms, parallel, perpendicular, distance),
  circles, ellipse, hyperbola, parabola.
- **Plane geometry**: triangles, circles, polygons, area, perimeter.
- **Vectors**: operations, dot product, angle, magnitude.
- **Complex numbers** — *in real papers and one syllabus reproduction, absent
  from the module heading and formula sheet*. Kept at low weight, marked
  `verified: false`.
- **Counting**: permutations, combinations.
- **Probability**: classical, mutually exclusive, complementary, independent,
  conditional, total probability, Bayes.
- **Statistics and distributions**: mean, median, mode, variance, standard
  deviation, frequency histograms, linear regression, binomial,
  hypergeometric, normal, expectation and variance formulae.

**Out of scope** (no source, absent from the corpus): integration, matrices and
determinants, polar coordinates, induction proofs, hypothesis testing,
three-dimensional solid geometry. *One syllabus analysis names "linear algebra:
systems of linear equations, matrices, determinants" under Module 3, but no
real paper and no formula sheet supports it — left out deliberately.*

### Style

- **Stems are terse.** Median 79 characters, quartiles 56–102. Often pure
  symbols: a trig value or a log to evaluate is a complete question.
- **Highest-frequency areas in real papers**: trigonometry, sequences, lines and
  circles, conics, function properties, sets and inequalities.
- **Notation**: intervals with round/square brackets; sets in builder notation;
  common ratio written **q**, not r; angles in degrees for trig values, radians
  with π for periods.

---

## 5. Physics

### Paper blueprint

| Module | Qs | % | Easy / Medium / Complex |
|---|---|---|---|
| P-1 Mechanics | 14 | 29% | 6 / 4 / 4 |
| P-2 Electromagnetism | 12 | 25% | 5 / 4 / 3 |
| P-3 Thermodynamics | 6 | 13% | 3 / 2 / 1 |
| P-4 Optics | 8 | 17% | 3 / 3 / 2 |
| P-5 Modern Physics | 8 | 17% | 3 / 3 / 2 |
| **Total** | **48** | | **20 / 16 / 12** |

*Corrects an early estimate that put Modern Physics at 8% and Optics at 7%.
Mechanics and Electromagnetism are the "twin pillars" — over half the paper.*

### Scope (preparation guide chapters and formula sheet)

- **Kinematics**: displacement, velocity, acceleration, uniformly accelerated
  motion, free fall, method of successive differences.
- **Forces and Newton's laws**: weight, Hooke's law, friction, resultant and
  resolution, equilibrium, inclines.
- **Work, energy, power**: work, power, kinetic and potential energy (incl.
  elastic), work–energy theorem, conservation.
- **Momentum**: impulse, impulse–momentum theorem, conservation, collisions.
- **Curvilinear motion and gravitation**: projectile components, v = ωr,
  centripetal acceleration and force, belt/axle-linked points, universal
  gravitation, satellites.
- **Vibrations and waves**: SHM, wave speed, frequency, wavelength, sound.
- **Electrostatics**: charge and its conservation, Coulomb's law, field
  strength and field lines, potential difference, work by the field,
  capacitors (*corpus only, `verified: false`*).
- **DC circuits**: Ohm's law, series/parallel, power, emf and internal
  resistance, motor heating loss.
- **Magnetism**: flux density, flux, force on a conductor (BIL), Lorentz force,
  radius of a charged particle's path.
- **Induction**: Faraday's law, Lenz's law, motional emf.
- **Thermodynamics**: kinetic theory, Brownian motion, intermolecular forces,
  gas laws and the ideal-gas equation (Celsius → kelvin is the classic trap),
  first law ΔU = Q − W.
- **Geometrical optics**: reflection, refraction, refractive index, critical
  angle and total internal reflection, **thin lenses and magnification** (on the
  formula sheet).
- **Physical optics**: interference, diffraction.
- **Modern physics**: photon energy, photoelectric equation and work function,
  Bohr model and spectral lines, nuclear reactions and decay, mass defect,
  binding energy, E = mc².

**Out of scope**: Doppler, standing waves/resonance, transformers and AC,
torque, buoyancy, calorimetry, relativity beyond E = mc².

### Constants and conventions

- **g = 10 m/s².** Every paper and both formula sheets say so — not 9.8.
  Written into every stem where it matters.
- Stated in the stem when used: k = 9.0×10⁹, h = 6.63×10⁻³⁴,
  c = 3.0×10⁸, e = 1.6×10⁻¹⁹, G = 6.67×10⁻¹¹, sound in air 340 m/s.
- SI units throughout; answers at 1–3 significant figures.

### Style

- **Stems set up a short scenario, then ask for one quantity.** Median 163
  characters, quartiles 130–197.
- Single papers can be lopsided: one in the reference set ran about 67%
  mechanics, far above the blueprint. The blueprint, not any one paper, sets
  the mock exam's mix.
- Recurring archetypes: Hooke's law with two loadings, static vs sliding
  friction, range of a resultant, average velocity on a curved path, charge
  sharing between identical spheres, field at the midpoint of a pair, Faraday
  with N turns, motor heat loss, constant-volume gas law.

---

## 6. Sources, and how reliable they are

**No first-party CSCA document was machine-readable.**

| Source | Status |
|---|---|
| csca.cn (official) | Empty shell |
| cucas.cn syllabus PDF | Anti-bot payload instead of the PDF |
| csca.app | HTTP 429 |
| crosslineedu.com | HTTP 403 |
| China Admissions *Guide to the CSCA Exam* (web PDF) | Readable; reproduces the official 2025 syllabus headings |
| CUCAS, Mandarin Zone, SICAS, Edurizon | Readable; corroborate format and strands |

A topic is `verified: true` only where two independent sources agree **and** it
appears in the corpus.

### The reference set (private, input only, gitignored)

- A private set of past-paper-style material: practice and mock papers,
  preparation guides, formula sheets and syllabus analyses. It is used only to
  derive the topic-frequency, difficulty and style profile in
  `content/calibration.json`, and to run the originality check.
- It lives in `reference/` (and the other corpus folders listed in
  `scripts/lib/load.ts`), all gitignored, and is never committed, bundled,
  served or quoted.
- Watermarks particular to it are listed in `reference/.corpus-markers.json`,
  inside the same gitignored folder, so no public file names a source.
- **Extraction quirk**: `pdftotext` cannot open paths with non-ASCII characters
  on Windows, so such files are staged under ASCII temp names.

---

## 7. What students most need (the reasons the site is built as it is)

- **Speed.** 75 seconds a question. Arithmetic is chosen to be clean.
- **The classic traps**, written into the distractors on purpose: Celsius instead
  of kelvin, forgetting to square r in Coulomb's law, 9.8 vs 10, mass vs weight,
  static vs sliding friction, open vs closed interval endpoints, the reverse
  direction of an implication, the ½ in kinetic energy, eV vs J.
- **Exam format practice.** Mocks follow the blueprint exactly, by module and by
  difficulty band, and ramp easy → hard.
- **Language.** Most candidates are non-native English speakers: short
  sentences, no idioms, no culture-specific scenarios.
