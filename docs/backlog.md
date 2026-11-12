# GCSE Home Study Companion · Backlog

The single list of what is left to do. Tick an item (`[x]`) in the PR that finishes it and
add the PR number; add new work here as it is found, not in a separate note. Story IDs
(`LRN-2`, `PAR-4`) refer to [stories.md](stories.md), where the acceptance criteria live;
[plan.md](plan.md) holds the delivery plan these came from.

Last reviewed: 12 November 2026.

**Development closed on 27 September 2026**, at the owner's request, with content (1) and
testing and validation (2) complete. The product features in section 3 are **not planned**:
they stay listed as a record of what the stories asked for, not as work in progress.
The improvement scope review of the same day, written as 71 stories with effort estimates, is in
[improvement-stories.md](improvement-stories.md). Section 12 reopens six of them on the owner's
word of 11 November 2026: offline, exam readiness and spaced review.

## Order of work

Agreed with the owner on 23 September 2026:
1. Finish all the content, one subject at a time, each subject complete before the next
   starts.
2. Then testing and validation.
3. Then product features. Not started: development closed after step 2 (27 September 2026).

## 1. Content, subject by subject

Computer Science, Business, Physics, Chemistry, Biology and Music have no known content gaps.

### Maths (Pearson 1MA1)
All 97 specification codes were checked against the pack on 23 September 2026.
Ten topics were written for everything that was taught nowhere (PR #256):

- [x] N4: factors, multiples and primes
- [x] N1, N2: calculating with fractions and negative numbers
- [x] R3–R6, N11: ratio notation, simplifying and sharing
- [x] N13, N14, R1, G14: converting units and estimating
- [x] G4: properties of triangles and quadrilaterals
- [x] S4 (ungrouped data): averages and range
- [x] S2: charts and diagrams for data (pie, bar, dual bar, pictogram, vertical line, time series)
- [x] S1, S5: sampling and populations
- [x] P2, P3, P5: relative frequency and expected outcomes
- [x] G12, G13: 3D shapes, plans and elevations

Codes declared where they were already taught: R2, G19 and R15. A2 (substitution) and A8
(coordinates) are used throughout the pack and have no topic of their own.

### Physics (AQA 8463)
- [x] Required practicals 2, 9 and 10 (PR #260): thermal insulation in Energy transfers, the ray box and
  block in Light, the Leslie cube in Infrared radiation, each with AQA's own method and data
- [x] Required practical 8: the "waves in a solid" half
- [x] Nuclide notation and balanced nuclear equations
- [x] Heating and cooling curve (4.3.2.3)
- [x] Field pattern round a current-carrying wire and a solenoid (4.7.2.1) (PR #260); `magnet-field`
  gained `wire` and `solenoid` kinds whose direction comes from the grip rule
- [x] Alternator against dynamo: slip rings, commutator, pd–time graphs (PR #260); new
  `generator-output` diagram

### Chemistry (AQA 8462)
- [x] Haber process: how conditions change rate and yield, with graphs (4.10.4.1, HT)
- [x] 4.1.1.1: symbols and naming compounds, only partly taught

### Biology (Edexcel 1BI0)
- [x] Year 9 bridging units: five topics written (PR #262): microbes and microscopy; how the
  body fights infection; senses, nerves and reaction time; the genetic code; classification,
  adaptation and evolution. Owner decided on 23 September 2026: write them. Each sits first in
  the Edexcel unit it leads into. Biology is complete, 38 of 38 rows.

### French (Edexcel 1FR1)
- [x] `why` block (why it matters, and real-world examples) for all 50 topics (PR #263):
  150 examples, every one with a picture; grammar topics take a `verb-table`, the rest
  short tables, four-boxes and a `size-compare` where the lesson prints a figure.
- [x] **Grammar the specification lists but no topic teaches**, found in the review pass against
  Appendix 2 of the Pearson specification (Issue 2, pages 154–169): negatives beyond *ne … pas*
  (*ne … personne* on both tiers; *ne … plus, ne … que, ni … ni, pas encore, personne ne, rien ne*
  at Higher), relative *que* and *où*, *avant de*, *après avoir*, *venir de* and *être en train de*
  (Higher), and the word-building rules the Reading paper applies (pages 168–169). Three Year 11
  topics, and the school's Year 11 Autumn revision rows linked to the Year 10 topics (PR #276).

### Music (Edexcel 1MU0)
- [x] `why` block for all 19 topics (PR #261): 56 examples, 50 with a picture

### Further Maths (AQA Level 2 Certificate 8365)
Board confirmed 18 September 2026. The teaching order is derived in
[curriculum/further-maths.md](curriculum/further-maths.md). All 22 rows are written, with `why` blocks on every topic and the exam technique guide (PRs #264, #265 and #266; version 9.0.0, 24 September 2026).

- [x] Surds and exact calculation
- [x] The product rule for counting
- [x] Expanding, and the binomial expansion
- [x] Factorising at Further Maths level
- [x] Completing the square and quadratic equations
- [x] Quadratic inequalities and index equations
- [x] The factor theorem and cubics
- [x] Sequences and limiting values
- [x] Gradients, distance and points on a line
- [x] Differentiation and the gradient function
- [x] Tangents, normals, and increasing and decreasing functions
- [x] Maxima, minima and optimisation
- [x] Functions: domain, range, composite and inverse
- [x] Algebraic fractions at Further Maths level
- [x] Rearranging formulae and algebraic proof
- [x] Simultaneous equations, including three unknowns
- [x] Circles and the tangent at a point
- [x] Matrix multiplication and the identity
- [x] Transformations of the unit square
- [x] Trigonometry and Pythagoras in 2D and 3D
- [x] Trigonometric graphs, identities and equations
- [x] Geometrical proof
- [x] `why` blocks
- [x] Exam technique guide (LRN-5); the page says "not been written yet"

### English (AQA 8700 Language and AQA 8702 Literature, confirmed 23 September 2026)
The school's overviews and set texts were found on 25 September 2026 and the plan is in
[curriculum/english.md](curriculum/english.md): two app subjects, 35 topics, written in the
school's order. The subjects, units and syllabus rows were declared in PR #267 (version 9.1.0); the first
unit, An Inspector Calls, and the Literature exam guide followed in PR #268 (version 9.2.0); the six
Language Paper 1 topics, the Year 10 Autumn 2 rows, in PR #269 (version 9.3.0); the seven Paper 2 and
Speaking and Listening topics, which complete English Language, in PR #270 (9.4.0); then Macbeth (PR #271,
9.5.0), Jekyll and Hyde (PR #272, 9.6.0), Power and Conflict (PR #273, 9.7.0) and unseen poetry (PR #274),
which completes English Literature and takes the app to version 10.0.0. Every English row in Years 9 to 11
now links to a written topic.

- [x] Find the school's curriculum overview and the set texts (25 September 2026)
- [x] Declare the two subjects, their units and every syllabus row, shown as coming soon (PR #267)

**English Language (13 topics)**
- [x] Paper 1 Questions 1 and 2: finding information and analysing language (PR #269, 25 September 2026)
- [x] Paper 1 Question 3: how the writer structures the text (PR #269)
- [x] Paper 1 Question 4: evaluating a statement (PR #269)
- [x] Descriptive writing (PR #269)
- [x] Narrative writing (PR #269)
- [x] Technical accuracy: sentences, punctuation and spelling (PR #269)
- [x] Paper 2 Questions 1 and 2: true statements and the summary (PR #270, 25 September 2026)
- [x] Paper 2 Question 3: language in non-fiction (PR #270)
- [x] Paper 2 Question 4: comparing viewpoints and perspectives (PR #270)
- [x] Reading 19th-century non-fiction (PR #270)
- [x] Paper 2 Question 5: arguing a point of view (PR #270)
- [x] Letters, speeches and articles (PR #270)
- [x] Speaking and Listening: the spoken language endorsement (PR #270)
- [x] Exam technique guide for 8700 (PR #268)

**English Literature (22 topics)**
- [x] Answering an extract question (through Romeo and Juliet) (PR #271, 25 September 2026)
- [x] An Inspector Calls: plot and structure · the Birlings and Gerald · the Inspector and Eva Smith · themes · context and the essay question (PR #268, 25 September 2026)
- [x] Macbeth: plot and structure · Macbeth and Lady Macbeth · Banquo, Macduff, Duncan and the witches · themes · context and the extract question (PR #271)
- [x] Jekyll and Hyde: plot and structure · Jekyll, Hyde, Utterson and Lanyon · themes · context and the extract question (PR #272, 25 September 2026)
- [x] Power and Conflict: the cluster and the comparison question · the power of humans · the power of nature · the reality of war · memory, identity and loss (PR #273, 25 September 2026)
- [x] Unseen poetry: analysing one poem · comparing two poems (PR #274, 25 September 2026)
- [x] Exam technique guide for 8702 (PR #268)
- [x] `why` blocks on every topic (written with each topic)

## 2. Testing and validation (after the content)

**Subject review pass.** For each subject:
- verify the content against the board's specification;
- check the worksheets and quizzes, and add questions where they are thin;
- check every screen at phone (390) and desktop (1280) width;
- add memory aids.

One PR per subject.

- [x] Business (22 Sept)
- [x] Physics (PRs #240–#242)
- [x] Maths (PRs #244, #245)
- [x] Chemistry (PRs #248, #249)
- [x] Biology (PR #250; tables #251)
- [x] Computer Science (PR #253; four-box #252)
- [x] French (PR #275; marker fix for commas, partial accents and a closing ?)
- [x] Music (PR #277; four-level grid test for the 12-mark question)
- [x] Further Maths (PR #278)
- [x] English (PR #279)
- [x] Second pass, Maths: the ten topics for untaught specification content (commit 2c90687).
  Four fixes in ten topics; the pass also made the Venn diagram, cuboid and triangle pair fit a phone.
- [x] Second pass, Biology: the five Year 9 bridging topics (#262). Fifteen fixes, most of them
  a reflex rule stated too absolutely (blinking and coughing go through the brain stem), and
  grouped continuous data now drawn with touching bars.
- [x] Second pass, Physics: the additions in #258 and #260 (seven topics). Every heating-curve
  time, nuclear equation, field direction and handbook figure matched; fixes were quiz pools that
  left out the new questions, over-long correct options, and RP10's scope.
- [x] Second pass, Chemistry: the additions in #257 (naming compounds, Haber yield graphs). Every
  formula, charge, equation and plotted yield matched; fixes were over-long correct options and two
  sentences the step was missing. French's three grammar topics (#276) had their own reviewer
  before merge, so the second pass is complete.

**Pack-wide quality**
- [x] **Diagrams fit a phone: flowcharts, line graphs, logic circuits, Huffman trees and
  byte tables** (PR #255). Scrolling at 390: 47, 96, 9, 1 and 131 dropped to 0, 0, 0, 0 and 23.
- [x] **Diagrams fit a phone: the rest.** A census of all 3327 lesson and why pages at 390
  on 26 September 2026 found 217 diagrams scrolling sideways; after #295 to #304 none does,
  and nothing scrolls at 1280 either. Each component was refitted to about 296 units and
  every changed figure read in the browser at phone width, because the first attempt, which
  only checked widths, made labels collide. The fixes that recur: every label drawn after
  every line on a white halo; labels outside branches and triangles rather than on them; a
  label offset by its own size; axis labels thinned to fit; table words broken at
  syllable-like points. Code blocks still scroll by design. The census and contact-sheet
  scripts are in the session scratchpad (`ph/census.mjs`, `ph/figshots.mjs`).
- [x] **The correct option is too often the longest.** Rebalanced subject by subject on
  26 September 2026 (#285 to #292): the share where the right answer is the only longest
  option fell from 36% to 24% of 4898 multiple-choice items, about chance for four options.
  About 560 distractors were lengthened with wrong content, each read in its question.
  `option-lengths.test.ts` holds every topic to 35% and the pack to 30%.
- [x] Chemistry: 15 diagrams scrolled at desktop width. None does after the phone refits
  (census at 1280, 26 September 2026).
- [x] **Components too wide for a phone:** `venn-diagram` (440 → 296), `cuboid` (380 → 284) and
  `triangle-pair`, which now stacks its pair in a box narrower than 520. A walk of the 20 Maths
  topics that use them against `main` removed 42 scrolling diagrams and added none.
- [x] **Labels crossed by lines, geometry:** `cuboid`, `triangle-construction`, `triangle-pair`
  and `circle-theorem` place every label clear of what they draw (`labelPlace.ts`), and
  `labels-clear.test.tsx` renders every content prop set of the four and fails on a line through
  a label. The walk at 390 and 1280 finds none in them (27 September 2026). The stacked
  `triangle-pair` also fits a tall triangle in its half instead of running into the other.
- [x] **Labels crossed by lines, line graphs:** every `line-graph` label (line and curve names,
  shape names, point labels, free text, the axis letters) now takes its own spot if nothing drawn
  runs through it and the nearest clear one if something does, and all of them are drawn last on
  a halo. Counting haloed labels, named labels crossed at 390 fell from 61 to 12 across 125 pages;
  the 12 are crowded figures with no clear spot (two nested circles, three overlapping ones, a
  stock level's sawtooth). `labels-clear.test.tsx` holds the static count at 6 (62 on `main`).
- [x] **Labels crossed by lines, the rest:** `motion-graph` labels (markers, series, gradient
  legs, shading, free text) are placed by the same `settler` as `line-graph` and drawn last on a
  halo; an ion's charge in `dot-and-cross` sits outside its bracket's corner; a `logic-circuit`
  gate name goes under its gate when a wire runs above it; a `lens-diagram` F takes the first
  spot around its focus clear of the rays; `inequality-region` tick numbers have a halo and the
  region's name moves off a boundary; the `four-box` centre circle is sized for bold type.
  `labels-clear.test.tsx` covers all of them (27 September 2026).
- [x] **LineGraph options:** a joined line through points was already `polygons` with
  `open: true` (15 figures, none traced out and back). `axes: false` now draws a shape with no
  axes, grid or scale; the 9 shape pictures that hid their axes with 100-unit tick steps use
  it, which also removes the stray x and y they still printed.
- [x] **Stacked (composite) bar charts:** `bar-chart` takes `style: 'stacked'` with a second
  series. S2's bar-chart step shows the travel survey as a composite chart beside the dual one.
- [x] **Multi-mark typed answers are marked all or nothing.** All 301 short-text questions
  worth 2 or more marks were read on 26 September 2026: one paid full marks for half an
  answer ("a metal hydroxide and hydrogen" for sodium and water). Typed questions now take a
  `partial` list of part-answers with their marks, so half an answer scores 1 of 2 on a quiz,
  a lesson check or a worksheet instead of 2 or 0. Four questions use it so far.
- [x] **Algebraic answers are matched as text.** The marker now accepts the same algebra in
  another order: the terms of a sum, the factors of a product, the sides of an equation, and
  an inequality written either way round (x ⩾ 3 and 3 ⩽ x). Nothing is expanded or collected,
  so a factorised answer still differs from an expanded one. Text that is not plainly algebra
  (formulae, pseudo-code, words, 1/2x) keeps the text match. 242 hand-listed orders are now
  redundant but harmless. The same PR stopped √(a/π) and √a/π normalising to one answer.
- [x] **Walk false positive:** option buttons carry `data-option`, their index in the content,
  so a browser check clicks the right answer to an option written only in maths. Every lesson
  check in the pack (2,275) answered with its own answer is marked Correct (27 September 2026).

## 4. Suggestions of 6 October 2026

Asked for by the owner ("anything you can suggest to improve the app contentwise and
designwise?") after the daily goal of 25 minutes replaced 180 a week. Built from screenshots of
the app at 390 and 1536 wide and a count of the content pack. The owner said to do the three
picked first and list the rest here.

**First, in this order:**
- [x] **Focus view** (design 7): on a lesson, quiz, worksheet, flashcards or mistakes screen
  below laptop width, the top band and the menu dock slide away while the student scrolls
  down and return on scrolling up. They took about a third of a phone screen mid-lesson.
- [x] **Daily mixed recap** (content 3, QZ-3, TRK-3, WKP-3): five questions a day drawn
  across topics already studied, weakest and longest-unseen first, started from Home.
- [x] **French listening and dictation** (content 1, TOP-5): questions that play French
  through the browser's own voice, a sentence to type (the 1FR1 dictation) and a short
  passage to answer in English. Listening is a quarter of the French grade; until now only
  9 of 967 French questions involved listening at all.

**Then, approved 7 October 2026, one PR each in this order:**
- [x] **Next up mixes subjects** (design 6): the two alternatives to the recommendation come
  from two other subjects, the best-ranked task of each, so the three cards on Home are
  three subjects. All three were Maths on 6 October 2026.
- [x] **Subject map opens on the student's year and names its squares** (design 9): the
  year filter starts on the student's year where the subject teaches in it, and from tablet
  width each square sits in a tile with its topic's name beside it.
- [x] **Shorter topic intro on a phone** (design 8): below laptop width the banner shows
  the first sentence or two of "why it matters" (whole sentences up to 200 characters) and
  "Read more", so the way into the lesson and the lesson's steps are on the first screen.
- [x] **Phone Home puts Today first** (design 5): below laptop width the first card of the
  plan sits in the banner with its reason and time, and the four counters are one small
  line; the Today list starts at the second card. A new or lapsed student read four large
  zeros before anything to do, and the plan began under the fold.
- [x] **Parent view leftovers** (design 10): PAR-2, the child's map read-only (each subject
  row on the dashboard carries the child's squares as on Home, and the subject's detail has
  the map by unit, named tiles, opened on the child's year) and PAR-5, the last eight weeks
  per subject with the average mark each week (a table on the dashboard, bars on the
  subject's detail). The suggested task beside a weak topic was already built.
- [x] **Business and Biology depth** (content 2): about 5 questions per specification point,
  against about 10 in Maths and 12 in Computer Science. More calculation and 6/9/12-mark
  questions per sub-point. **Business done 7 October 2026 (#369, v10.75.0)**: 12 new
  questions per topic (201 → 321), a third of them at 8-9, each topic gaining a 6, 9 and
  12-marker and three calculations; two examiner reviews applied. The topics were **not**
  split in two: progress is keyed by topic id and the pilot student already has Business
  attempts, so a split would have orphaned them. Biology (34 topics, 10 each) follows per
  year group: **Year 9 done 7 October 2026 (#370, v10.76.0)**, 13 topics, 130 questions,
  two examiner reviews applied (constants and formulae moved into prompts, overlapping
  hand-span and memory-lymphocyte items re-aimed). **Year 10 done 8 October 2026 (#371,
  v10.77.0)**, 18 topics, 180 questions, four examiner reviews applied (every valid route
  and example credited, criteria held to the question asked, overlapping items re-aimed
  at lysozyme, chlorophyll, the pill and heat made by exercise). **Year 11 done 8 October
  2026 (#372, v10.78.0)**, 7 topics, 70 questions, two examiner reviews applied (any valid
  evidence credited in the Darwin and Wallace 6-marker, one worked slip corrected). The
  deeper questions pushed the share placed on a lesson step below its 60% floor, since
  their prompts set a scene first, so `teachingStep` gained a skill-only fallback at a
  two-thirds lead, back above the floor; its additions agree with the skill rule 83% of the
  time.
- [x] **Music listening** (content 4): a link to a recording of each set work, no timings.
  The owner asked for it on 8 October 2026 ("finish all"). **Done (#373, v10.79.0)**: each set
  work names the recording on Pearson's set works information sheet and searches for it on
  YouTube and Spotify, from the topic page and the your-turn step that says to play it. Still
  no bundled audio and no durations.

## 5. Generated questions and worksheets (8 October 2026)

Approved by the owner on 8 October 2026 after a working example (new numbers on each retry,
printable and shareable sheets). Stories GEN-1 to GEN-4, WKP-2 and WKS-4 in
[improvement-stories.md](improvement-stories.md). One PR each, in this order; each box is
ticked in the PR that finishes it. Generators run in the browser: no server, no AI, no cost
per use.

- [x] **1. Generator framework and checks** (GEN-1, GEN-2, GEN-3). **Done 8 October 2026
  (#374, v10.80.0).** A seed builds a complete question in the existing format (prompt,
  answer, worked solution, mark scheme), standing in for a named written question and keeping
  its id, marks and grade. Every generator is checked a second way on 1,000 seeds per question
  it replaces; multiple-choice wrong options come from named mistakes. Nine generators stand in
  for 16 written questions in four topics: percentages, fractions of amounts, sharing in a
  ratio, right-angled trigonometry, compound interest and reverse percentages. Not yet shown to
  the student: item 2 does that.
- [x] **2. New numbers on each worksheet retry** (WKP-2). **Done 8 October 2026 (#375,
  v10.81.0).** The first attempt at a worksheet is the written sheet; every attempt after it
  draws the questions that have a generator fresh from the attempt's seed, which is saved with
  the attempt (and with an unfinished sheet), so a past attempt is rebuilt exactly. The start
  screen says how many questions get new numbers, each one carries a "New numbers" chip, a
  wrong option a generator built names the slip, the parent's breakdown rebuilds the questions
  the student saw, and a mistake report carries the generator and seed.
- [x] **3. Print and share generated sheets.** **Done 8 October 2026 (#376, v10.82.0).** A
  generated sheet has a six-character code (no 0, o, 1, i or l, so it reads off paper), which
  is its seed. The print page and its separate answer sheet are built from the code and print
  it at the top and foot, so the answers that go with a sheet are never in doubt. "Print one
  with new numbers" on a worksheet's start screen and "New numbers" on the print page draw a
  fresh code; "Share this sheet" (phone share sheet, else clipboard, else the link shown)
  sends a link that opens the same numbers, on screen or printed. A finished retry offers to
  print or share itself. Opening a link to a different sheet while one is unfinished warns
  first and replaces it only on Start. Also fixed here: where one generator fills several
  slots on a sheet, each slot now asks something different (sin, cos and tan once each), as
  the written sheet did; independent draws had given one sheet tan twice and no cos.
- [x] **4. Number generators.** **Done 8 October 2026 (#377, v10.83.0).** 51 generators for 96
  more written questions in ten topics: fractions and negatives, laws of indices, powers and
  roots, standard form, bounds, units, direct and inverse proportion, ratio and proportion,
  factors and multiples, compound measures. Generators now cover 112 written questions in 14
  topics. Each slot keeps its written task (upper or lower bound, find y or find x), so a sheet
  keeps its spread. Typed answers that are not one number (a fraction in its simplest form, a
  number in standard form) are now supported. Two release-check rules added: no number printed
  in e-notation (one solution had printed 1e-8), and no tolerance wider than 2% of the answer
  (the written compound-measures 0.5 would have accepted 2.6 for 3 m/s). Also fixed: the
  written standard-form q2 said the point moves right for 2.4 × 10⁻³ → 0.0024.
- [x] **5. Algebra generators.** **Done 8 October 2026 (#378, v10.84.0).** 62 generators for 158
  more written questions in 17 topics: expanding and factorising, simplifying, solving
  quadratics, surds, algebraic fractions, quadratic inequalities and curves, substituting,
  rearranging and identities, straight lines, parallel and perpendicular lines, the circle,
  sequences, simultaneous equations, inequalities, functions, iteration. Generators now cover
  270 written questions in 31 topics (173 of the 454 numeric ones, 38%). Every accepted
  factorisation, root list, rearrangement and line is checked against the prompt by expanding
  or substituting back. Show-that questions are self-marked extended answers, so they stay
  written. **Marker fix, for written questions too:** correct maths answers in another form
  were marked wrong: 3 > x > 2 for 2 < x < 3, "x = 2, x = -4" or "-4 and 2" for "-4, 2",
  x = ±3, and "x = (-3+√29)/2" with its letter. Equations' solutions now compare as a set,
  chains are turned one way, and numbers compare by value only where no form is asked for,
  so 26/48 for "simplest form" and √24 for "simplify" stay wrong. Also fixed: iteration q14's
  tolerance was half its answer (0.005 on −0.01).
- [x] **6. Geometry and measures generators.** **Done 8 October 2026 (#379, v10.85.0).** 51
  generators for 131 more written questions in 19 topics: angles and polygons, quadrilaterals,
  circle theorems, bearings and scales, Pythagoras in 2D and 3D, trigonometry in 3D, the sine
  and cosine rules and area, exact values, trigonometric graphs, arcs and sectors, surface area
  and volume, plans and elevations, scale factors, similarity, congruency, transformations,
  constructions, vectors. Generators now cover 401 written questions in 50 topics: 284 of the
  454 numeric ones (63%), past GEN-4's half. Every angle and length is checked by drawing the
  figure on coordinates and measuring it; bearings are tested on both sides of 180 and near 0
  and 360. The six typed geometry questions with a diagram stay written, since a diagram shows
  the written numbers; two-triangle problems with new diagrams are left for later. Written
  content fixed: properties-of-angles q17's scheme named the wrong angle fact; bearings q18
  called the two bearings co-interior (070 + 250 is 320); pythagoras-in-2d q5 and arc-length q6
  printed 1 d.p. for a 2 d.p. answer; sine rule q12 rounded −0.21875 to −0.2187;
  trigonometry-in-3d q5 and q11 did not say which edge was the height; surface-areas q5 stored
  376.99 for a 1 d.p. answer.
- [x] **7. Probability and statistics generators.** **Done 8 October 2026 (#380, v10.86.0).** 40
  generators for 129 more written questions in 14 topics: choices and outcomes, sample spaces,
  combined events and tree diagrams, relative frequency, frequency trees, Venn diagrams, sets,
  averages, charts, sampling, scatter graphs, histograms, box plots, grouped and cumulative
  frequency. Generators now cover 530 written questions in 64 topics: 398 of the 454 numeric
  Maths questions (88%) and 529 of the 631 typed ones (84%); GEN-4 asked for half. Every
  probability is recomputed by enumerating the sample space or tree, every Venn and set answer
  from explicit member lists, every average from the expanded raw data. A release-check rule
  added: no "1 times". Written content fixed: 83 thousands separators inside maths printed as
  "10, 000" in Maths, Physics and Business (now 10\,000, held by maths-thousands.test.ts, which
  also found a Business solution printing "2\,000\,000" as text); frequency-trees q5 and
  grouped q8 referred to a tree or graph the question does not show; three answers accepting a
  decimal had a mark scheme naming only the fraction.
- [x] **8. Make a worksheet** (WKS-4). **Done 8 October 2026 (#381, v10.87.0).** "Make a
  worksheet" on every subject page: choose topics from any unit (at least three, so the topic
  no longer gives the method away), a level, 5 to 20 questions and 1 to 4 versions to print.
  The sheet's link holds every choice and a sheet code, which picks the questions (topics take
  turns, never the same topic twice running) and their new numbers, so a link always opens,
  prints and marks the same sheet. On screen it runs like the daily recap: one question at a
  time, the topic named only once it is answered, recorded as a review per topic with the
  code, so results feed each question's own topic and the parent's breakdown rebuilds what
  was asked; it never moves a topic's status. Print gives each version its own page, code and
  answer sheet. Works in every subject; Maths questions get new numbers. **Fixed the same day
  (#382, v10.87.1)** after the owner could not find a button: with fewer than three topics ticked
  the buttons were hidden. They now always show, greyed with the reason until the sheet is ready,
  pinned to the foot of the screen while the topic list scrolls.

**Validated 8 October 2026 (#384, v10.87.3).** Every one of the 530 generated slots was read
by a reviewer, three versions each, against the written question, with the maths redone;
every typed answer form was pushed through the real maths field and marked; non-calculator
slots were checked for numbers a student can work by hand; and nothing in a generator reads
the clock, the locale or `Math.random`, so a sheet code rebuilds the same sheet on any device.
No generated answer was wrong. Found and fixed, as classes where possible: the marker rejected
a rearranged formula in another right form, (8n+1)/(3−n) for (−8n−1)/(n−3) and −(ac+c)/(1−a)
for c(a+1)/(a−1), and the "m =" in front counted on some forms and not others, so a fraction
now matches with its top and bottom both negated or the minus outside, and the subject letter
is optional where the prompt names it (written questions gain this too); "solve … in surd
form" or "as a fraction" now counts as asking for a form, so a decimal is not taken; a money
answer read "3481.6 £" and is now £3481.60, a percentage 80% not "80 %", and an answer asked
"to 2 decimal places" shows 8.60 not 8.6, on screen, on the answer sheet and in the parent's
breakdown; √(v/4) also takes √v/2. Contexts drawn out of scale: a 63 m gate, a 50 m tent, a
ladder at 20°, a crate the size of a building, people older than 100, javelin throws of 2 m, a
sledge at 6 m/s², two samples of one town at 86% and 20%, a prediction for the number of
throws already made. Wording: "1 are cracked", "0 play none", "a 8", "x = 1, giving x = 1",
"(−6 + √10)", "add 0 to the x coordinate", a sentence about the negative part when both parts
were negative, a line printed twice in a mark scheme or a solution, and pounds in the thousands
now printed £28 200 as the written content does.

## 6. Physics generators (8 October 2026)

Asked for by the owner on 8 October 2026 ("do physics now"), after the Maths generators were
validated. Story GEN-5 (Physics half). Physics has 191 numeric questions in 28 topics; 13 of them
ask about a diagram and stay written, since generators draw none. Each PR follows the Maths
method: generators per topic file under `generators/physics/`, the release check on 1,000 seeds
per slot, structural tests on the printed working, a review of every slot's samples before it
ships. Physics conventions the generators keep: g = 9.8 N/kg, standard form as
$3.0 \times 10^{8}$, "to 2 significant figures", the written question's unit on the answer box.

- [x] **1. Physics framework, energy and the particle model.** Helpers for significant figures
  (rounding, printing with the trailing zero, a tolerance of half a unit in the last figure,
  never over 2%), standard form and prefixes; a release-check rule that a generated question
  keeps the written one's unit. Generators for kinetic and gravitational potential energy,
  energy transfers and dissipation, power and efficiency, density, thermal physics (specific
  heat capacity and latent heat), behaviour of gases. Shipped 9 October 2026 (v10.88.0): 30
  generators covering all 42 numeric slots in the six topics, each with structural tests on
  the printed working; `show()` now clears residue at twelve significant figures first, since
  a six-figure product like 750 × 9.8 × 47 kept its binary tail under the old ten decimal places.
- [x] **2. Forces A.** Describing motion (speed, acceleration, the SUVAT equation), Newton's laws,
  resultant forces and work done, stopping distances and reaction time. Shipped 9 October 2026
  (v10.89.0): 32 generators covering the 34 numeric slots without a diagram in the four topics (the
  eight graph and free-body-diagram questions stay written); the helpers every Physics file
  shares moved into `generators/physics/build.ts`.
- [x] **3. Forces B.** Hooke's law and elastic energy, moments, levers and gears, momentum and
  collisions, pressure in fluids and upthrust. Shipped 9 October 2026 (v10.90.0): 35 generators
  covering the 42 numeric slots without a diagram in the four topics (the five
  questions drawn round a diagram stay written); collisions are drawn only where they can happen,
  and vehicle crashes keep at most 70% of the kinetic energy.
- [x] **4. Electricity, waves, magnetism, atoms and space.** Charge, current, resistance, power
  and energy in circuits, series and parallel rules, mains and transformers; the wave equation,
  lenses, sound and echoes, the electromagnetic spectrum; the motor effect, half-life, red shift.
  Shipped 9 October 2026 (v10.91.0): 50 generators covering 56 numeric slots in 14 topics; the
  four that ask for a recalled fact (mains 230 V, the earth wire at 0 V, eight planets, 1998)
  stay written. Each answer is drawn first and the givens fitted to it, so no easy value
  dominates a context; every context gives at least ten answers.

With item 4, generators cover 174 of the 191 numeric Physics questions; the other 17 ask about a
diagram or a recalled fact.

## 7. Chemistry generators (9 October 2026)

Asked for by the owner on 9 October 2026 ("now chemistry"), after Physics. Story GEN-5
(Chemistry half). Chemistry has 103 numeric questions in 25 topics, none drawn round a diagram.
The Physics method carries over: generators per topic file under `generators/chemistry/`, the
release check on 1,000 seeds per slot (the rule that a generated question keeps the written
unit now covers Chemistry too), structural tests on the printed working, and a review of every
slot's samples before it ships. Relative atomic masses come from the AQA periodic table insert
as `elements.ts` holds it, and every Mr is computed from its formula
(`generators/chemistry/build.ts`), never typed.

- [x] **1. Chemistry framework, formulae and amounts.** The Ar table, formula reader, Mr working
  in the written style; generators for formulae and relative formula mass, conservation of mass
  and moles, reacting masses and limiting reactants, yield and atom economy (37 slots). Shipped
  9 October 2026 (v10.92.0): 33 generators cover all 37 slots. Every equation is checked for
  balance when its file loads; one name table (`chemistry/compounds.ts`) names each formula
  once; which reactant runs out is drawn evenly, so "fewer moles runs out" pays half the time.
- [x] **2. Solutions, gases and acids.** Concentrations and titrations, gas volumes, potable
  and waste water, strong and weak acids, carboxylic acids (31 slots). Shipped 9 October 2026
  (v10.93.0): 29 generators cover 29 slots; the two that ask for a recalled fact (1000 cm³ in a
  dm³, the molar volume) stay written. Titration moles are exact at three figures, so a student
  who rounds as the written method does lands on the answer; a fuel-rich mixture is never shown
  burning completely. A calculated answer the prompt gives no precision for now accepts its
  three-figure rounding (10.3 g for 10.32 g) in these topics and in item 1's; sums and Mr values
  stay exact.
- [x] **3. The rest of the specification.** Energy changes and bond energies, rates,
  equilibria and the Haber process, atoms and bonding, nanoparticles, materials, extraction
  and corrosion, the atmosphere, life-cycle assessment, chromatography, alcohols (35 slots).
  Shipped 9 October 2026 (v10.94.0): 23 generators cover 24 slots. Eleven stay written: recalled
  facts (Haber conditions, 24 carat, oxygen in the air, nm in a metre, shared pairs in O₂) and
  questions on one fixed equation (balancing an alcohol's combustion, counting molecules), which
  cannot reach 100 distinct prompts. Bond energies are the lesson's where it gives them and the
  values AQA papers print elsewhere; isotope abundances are IUPAC's.

With item 3, generators cover 90 of the 103 numeric Chemistry questions.

## 8. Biology generators (9 October 2026)

Asked for by the owner on 9 October 2026 ("biology"), after Chemistry. Story GEN-6 (Biology
half). Biology has 164 numeric questions in 36 topics; 2 ask about a diagram and stay written.
The Physics and Chemistry method carries over: generators per topic file under
`generators/biology/`, the release check on 1,000 seeds per slot (the keep-the-written-unit rule
now covers Biology too), structural tests on the printed working, and a review of every slot's
samples before it ships. The subject-free helpers in `generators/physics/build.ts` and
`generators/chemistry/build.ts` are shared; a calculated answer the prompt gives no precision
for accepts its three-figure rounding (`threeFigures`).

- [x] **1. Cells, microscopy and transport.** Magnification and scale, microbes and doubling,
  cells and mitosis, diffusion and osmosis, exchange surfaces and Fick's law, leaf and root
  tissues, transpiration (41 slots). Shipped 9 October 2026 (v10.95.0): 40 generators cover all
  41 slots. Cell sizes, lens powers and all 51 chromosome numbers are real; the two-sperm
  question uses mammals only (birds are polyspermic); a potometer table changes 1.5 to 3.5 times
  across its factor, each row inside its own condition's range.
- [x] **2. Enzymes, energy and ecology.** Enzyme rates, food tests and calorimetry,
  photosynthesis and the inverse square law, respiration, ecosystems and sampling, material
  cycles and decay, plant hormones (32 slots). Shipped 9 October 2026 (v10.96.0): 30 generators
  cover 31 slots; the mass of 25 cm³ of water stays written. Quadrat estimates are exact and
  have three figures at most, as the written ones do; energy lost between trophic levels is
  framed as not stored in the consumer, not as never reaching it. The written peanut packet
  value was 2100 kJ per 100 g, below any real peanut, and is now 2520 (answer 25%). Shared
  draw helpers moved to `generators/biology/build.ts`.
- [x] **3. The human body and health.** Blood glucose and BMI, the heart and cardiac output,
  hormones, nerves and reaction time, the eye, thermoregulation and the kidneys, the menstrual
  cycle, lifestyle disease, pathogens, immunity and antibiotics (47 slots). Shipped 9 October
  2026 (v10.97.0): 43 generators cover 45 slots; the two ruler-drop questions read off a diagram
  stay written. Clear-zone areas accept the π = 3.14 answer the written mark scheme accepts;
  contraception figures are the NHS's typical-use rates; resting cardiac output stays within
  4000–7000 cm³/min; R0 values are each disease's own.
- [x] **4. Genetics and evolution.** DNA and protein synthesis, genetic crosses and pedigrees,
  genetic disorders, meiosis, variation and natural selection, fossils and classification,
  selective breeding (44 slots). Shipped 11 October 2026 (v10.98.0): 30 generators cover 34
  slots; ten stay written: six recall a fact or give the same answer every time (23 pairs, 3
  bases, 4 daughter cells, the chance of a girl, when Ardi lived, five kingdoms) and four have
  too few real versions (a blood group unlike both parents', a hybrid's chromosome number, and
  the two questions on the three fossils Edexcel names). Every family table has at most half its
  children unlike their parents; sex-linked and ABO crosses are drawn evenly over the crosses,
  not the answers; the dominant disorder is Huntington's disease, as in the written bank; shaded
  leaves are always longer than sunny ones; and the bacterial doubling slot states the number of
  doublings, as the written one does. The eight Biology generator headers had cited AQA 8461;
  Biology is Edexcel 1BI0, and they now cite its topic numbers.

With item 4, generators cover 151 of the 164 numeric Biology questions; the other 13 read a
diagram, recall a fact or have too few real versions to vary.

## 9. Further Maths generators (11–12 October 2026, complete)

Planned on 11 October 2026 at the owner's request ("plan these"), together with sections 10 and
11, after Biology. **Each of these subjects starts only when the owner says so**, after reviewing
the one before; the proposed order is Further Maths, then Business, then Computer Science. Story
GEN-6 (Further Maths half). Further Maths (AQA 8365) has 127 numeric questions in 22 topics, none
drawn round a diagram. Its answer box is the Maths one (MathLive), so the Maths method applies:
generators per topic file under `generators/further-maths/`, KaTeX in prompts, the Maths marker
with `sameMathsAnswer` where a slot asks for an exact form, non-calculator slots drawn so the
numbers work by hand, the release check on 1,000 seeds per slot, structural tests on the printed
working, and a review of every slot's samples before it ships. Slots that ask a fact to recall
(the value of sin 30°), a count the structure fixes (how many real solutions), or that cannot
reach 100 distinct prompts stay written.

- [x] **1. Algebra A (Year 10).** Binomial expansion coefficients from Pascal's triangle, the
  difference of two squares by hand, completing the square (the minimum value, the b and c of
  a(x + b)² + c, a solution to 2 decimal places, the first time a projectile reaches a height),
  fractional and negative indices and index equations, the factor theorem (f(a), a coefficient
  from a known factor, deciding whether a factor), sequences and limiting values (which term has
  a value, the limit of a rational nth term, the difference of two terms). 26 slots in 6 topics.
  Shipped 11 October 2026 (v10.99.0): 20 generators for 25 slots in `generators/further-maths/`
  (expansion, completing, indices, factor, sequences), with shared helpers in `build.ts`. The
  count of real solutions (factor theorem q14) stays written. Two reviewers found one wrong
  method line (a missing (−1)ʳ) and eighteen coincidences and skews, all fixed with tests: an
  answer equal to a printed term or coefficient, a constant of 3 that lets a slip pay, the
  middle of a Pascal row where the wrong end gives the same number, roots beyond recall.
- [x] **2. Number, calculus and Year 10 coordinate geometry.** Surds (a√b forms, expanding a
  square, equating rational and surd parts), the product rule for counting (meals, codes with
  and without repeats, arrangements of words with repeated letters, committees, odd and even
  numbers with no repeated digit, numbers not starting with 0 or a named digit), differentiation
  (the gradient at a point, the second derivative), tangents and normals (a horizontal tangent,
  a given gradient), maxima and minima and optimisation (a stationary point, the greatest area or
  least surface area of a stated model), gradients, distances, perpendicular gradients, y = mx + c
  and the area of a triangle from its vertices. 31 slots in 6 topics.
  Shipped 11 October 2026 (v10.100.0): 14 generators for all 31 slots (`surds`, `counting`,
  `calculus`, `lines`). Two reviewers found thirteen skews and slips, all fixed with tests: the
  written prompt itself in 23% of counting q11's builds, a surd side where the printed coefficient
  also gives the answer, gardens 0.3 m wide, open-topped boxes that gave away the next question on
  the same sheet, four calculations taking 59% of a triangle-area slot, square roots of 676 and 841
  by hand. The release check now refuses any prompt in more than a tenth of a slot's builds, and
  the written prompt in more than a twentieth; four Maths generators that broke it were fixed.
- [x] **3. Algebra B and circles (Year 11).** Functions (evaluating, a composite with an unknown
  constant, an exponential curve through two points, f(x) = f⁻¹(x)), a fractional equation, the
  value of a proved expression, simultaneous equations in two and three unknowns (including a
  tangent line to a parabola, three prices from three bills, a product with a difference), and
  circles (radius and centre, the tangent gradient at a point, the radius from a diameter's ends,
  where a line meets a circle, the c of a tangent line, the length of a tangent from a point, the
  triangle a tangent cuts off). 22 slots in 5 topics.
  Shipped 12 October 2026 (v10.101.0): 10 generators for all 22 slots (`functions`,
  `simultaneous`, `circles`; the fractional equation and the proof sit in `functions`). Two
  reviewers found fifteen skews and slips, all fixed with tests: a fixed point of ±1 that let a
  student who read f⁻¹ as 1/f score, an exponential shape whose answer was always 2, elimination
  past the written arithmetic (37x = 111) and mirrored pairs that add to 9(x + y), child tickets
  dearer than adult ones, a check line that turned a subtraction into an addition by dropping
  negative denominators, the other root paying when y was asked, tangents printed with every
  coefficient negative, and a radius equal to a centre coordinate.
- [x] **4. Trigonometry and geometrical proof (Year 11).** Pythagoras in 2D and 3D (a cuboid
  diagonal, the angle a diagonal makes with the base, the angle between a sloping face or edge
  and the base of a pyramid), the sine and cosine rules and the area formula (to 2 decimal
  places, and the exact cos A = 3/5 cases), trigonometric equations in 0° to 360° (exact values,
  a calculator solution, a sin x = b cos x, the sum of the solutions of sin²x = ¼, counting the
  solutions of a quadratic in sin x), circle theorems by number (angle at the centre, cyclic
  quadrilateral, angle in a semicircle, alternate segment, two tangents), polygon angles, a
  trapezium, a cone's volume, a cylinder's radius from its surface area. 32 slots in 3 topics.
  Shipped 12 October 2026 (v10.102.0): 10 generators for 29 of the 32 slots (`pythagoras`,
  `trig-equations`, `geometry`). Three stay written: the value of sin 30° (recall), the sum of the
  solutions of sin²x = k (always 720°), and a count of solutions. Three reviewers found sixteen
  slips and skews, all fixed with tests: "a octagon", a 10-24-26 triangle the day before the
  next question asks whether 10, 24, 26 is a triple, a pyramid as tall as it is wide in 8% of
  builds, rounded intermediates that change a 2 d.p. answer (now named in the solution), a grade
  4-5 sine equation that was mostly negative values and rearrangements, q11 and q14 sharing one
  equation on a sheet, squat traffic cones. Class fixes: the marker now reads an exact surd
  (33√3, √259) where the mark scheme allows one, and the release check refuses "a" before a
  vowel sound and "an" before a consonant, which found "a orange" and "a eighth" in two Maths
  generators.
- [x] **5. Matrices and transformations (Year 11).** Scalar multiples and products of 2 × 2
  matrices and column vectors, an entry of BA or A², unknown entries from a product, solving
  Mx = v, C² = kI, the order of a rotation matrix, an entry of Pⁿ for a shear, images under
  rotation and reflection, the area scale factor, the matrix of two reflections combined, the
  order of a reflection. 16 slots in 2 topics.
  Shipped 12 October 2026 (v10.103.0): 6 generators for 15 of the 16 slots (`matrices`,
  `transformations`). The order of a reflection stays written: it is always 2. Two reviewers found
  ten slips and skews, all fixed with tests: dividing the product by the known matrix entry by
  entry (the sheet's own distractor) gave the unknown in 11% of builds, simultaneous equations
  from a matrix scaled both sides into the 90s where the written scales one into the 20s, a
  combined transformation whose working printed the answer to a later question on the sheet,
  plain enlargements only 38% of a grade 4-5 area slot, and letters A and S reused on the sheet
  where the written questions define their own A and S.

  **Further Maths complete, 12 October 2026: 60 generators cover 122 of its 127 numeric
  questions.** The five left written ask a recalled value, a count, or an answer the structure
  fixes.

## 10. Business generators (12 October 2026, complete)

Business (Edexcel 1BS0) has 69 numeric questions in 10 topics, every one a calculation from the
specification's quantitative skills (Appendix 2) and formulae (Appendix 3, not given in the
exam). They use the plain number box. Money stays in pounds in the written topic's own thousands
style (£24 000 in Theme 1 topics, £600,000 in Theme 2 ones); percentages are rounded as the
written slot rounds; a negative cash flow is printed as the written one is. Framework in
`generators/business/build.ts`: money and percentage printing, a break-even draw that makes the
output whole, and every formula checked a second way (profit from revenue minus total costs and
from contribution; average rate of return as average yearly profit ÷ cost × 100; margin of
safety; market share; percentage change; gross and net profit margins). Realism rules for the
brief: price above variable cost; sales near break-even where a margin of safety is asked;
interest rates 2 to 12%; exchange rates near real ones (£1 = $1.20 to $1.60, €1.05 to €1.40);
tax rates in the UK's own range; staff and leavers consistent.

- [x] **1. Theme 1, Investigating small business.** Value added, profit from value added and
  fixed costs, percentage change in profit and sales, what a founder gave up in salary (1.1);
  survey percentages, market share and its change, percentage points, scaling a survey to a town
  (1.2); revenue, total costs, profit, break-even and the new break-even after a price change,
  margin of safety, net cash flow, opening and closing balances over one and two months, total
  interest as a percentage (1.3); a franchise royalty, break-even in a business plan, comparing
  two units (1.4); exchange-rate conversions and changes, refunds under consumer law,
  interest-rate and tax-rate changes (1.5). 35 slots in 5 topics.
  Shipped 12 October 2026 (v10.104.0): 35 generators for all 35 slots (`enterprise`,
  `opportunity`, `practice`, `effective`, `external`), on a shared `business/build.ts` that prints
  money in each written question's own thousands style (£26 000 or £24,000, by question, not by
  theme) and holds the formulae. Three reviewers found twenty-one slips, all fixed with tests: a
  homeware shop selling 1,410 kettles a month, a caterer keeping 56% of its takings, an
  exchange-rate slot whose exact cost was £25, £50, £250 or £500 in half its builds, a 10% share
  where market ÷ sales pays, a rounded percentage change equal to a percentage-points answer, a
  price rise that doubled the contribution so the fall in break-even paid. The release check now
  keeps Business's units and reads £3,500,000 and −£500 in a solution; the written 1.5 q11 now
  says "to the nearest penny".
- [x] **2. Theme 2, Building a business.** Retained profit, a flotation, a tariff, percentage
  growth, a funding shortfall, loan interest as a percentage, an overseas market share, the
  founders' share after a share issue (2.1); mark-up to a selling price and to a profit,
  percentage increase after an extension strategy, two-segment revenue, the revenue fall after a
  price cut (2.2); productivity per worker and its percentage increase, buffer stock, reorder
  level, delivery size, the unit cost of two production lines (2.3); gross profit and margin, net
  profit and margin, average rate of return from a total and from yearly profits, percentage
  change in net profit, net margin from a full set of figures (2.4); staff turnover and its
  change in percentage points, managers from a span of control, pay with commission, the saving
  from cutting leavers (2.5). 34 slots in 5 topics.
  Shipped 12 October 2026 (v10.105.0): 33 generators for all 34 slots (`growing`, `marketing`,
  `operations`, `finance`, `people`). Three reviewers found twenty slips and skews, all fixed with
  tests: "cut the leavers to 24" read as "cut by 24" paying in 32% of builds, a flotation whose
  shares totalled exactly 20,000,000 in 39%, a car salesperson earning £11,500 a month, a delivery
  van costing £30,000 in 58% of its builds, revenue a round £100,000 in two thirds of the margin
  slots, a bottling plant whose answer was 5p in 28%. Four written mark schemes stated a figure
  from an earlier draft ("A1 15%" under answers of 20, 28, 12.5 and 10); they are fixed, and a
  content test now holds every numeric question's answer line to its answer. The marker reads
  "38 T-shirts".

  **Business complete, 12 October 2026: 68 generators cover all 69 of its numeric questions.**

## 11. Computer Science generators (12 October 2026, complete)

Computer Science (AQA 8525) has 95 numeric questions in 21 topics. Seven stay written: six ask a
fact to recall (8 bits in a byte, 1000 bytes in a kilobyte, 128 ASCII characters, 32 between the
cases, two exits from a decision, eight rows for three inputs) and one reads a Huffman tree
diagram. Conventions from the specification: decimal prefixes (1 kB = 1000 B), the 8-bit range
0 to 255, logical shifts only, 7-bit ASCII, image size = W × H × D bits, sound size = rate ×
resolution × seconds; AQA pseudo-code for every fragment (`←`, `DIV`, `MOD`, `FOR i ← 1 TO n`,
`WHILE`/`ENDWHILE`, `REPEAT`/`UNTIL`, `SUBROUTINE`/`RETURN`, `LEN`, `SUBSTRING(i, j, s)`,
`POSITION`, no string indexing, indexes from 0, the midpoint as (low + high) DIV 2). A trace
question's answer is computed by running the fragment in a small interpreter of that pseudo-code
subset (the second route), the solution prints the trace table, and the code is drawn so a loop
runs two to eight times and the trace fits on a phone.

- [x] **1. Data representation.** Binary, hexadecimal and decimal conversions both ways; shifts
  left and right and the multiply or divide they are; ASCII code arithmetic (one code from
  another, bits for a word); image and sound file sizes in bits, bytes and kilobytes; files that
  fit on a drive and copy times with decimal prefixes; clock cycles per second; run-length pairs,
  Huffman bit counts from given codes and frequencies, ASCII totals and the bits saved. 32 slots
  in 7 topics (storage units and binary, binary arithmetic, ASCII and Unicode, images and sound,
  data compression, the CPU, secondary storage).
  Shipped 12 October 2026 (v10.106.0): 19 generators for 27 slots (`storage`, `arithmetic`,
  `systems`, `ascii`, `media`, `compression`) on a shared `computer-science/build.ts` (binary and
  hex printing, counts grouped as the pack prints them, decimal prefixes); five stay written (four
  facts to recall and the drawn Huffman tree). Huffman codes come from a real Huffman tree of the
  word's own letter counts, checked optimal against a brute-force search. Three reviewers found
  twenty-three slips, all fixed with tests: a flat 2-bit code paying in 37% of Huffman builds, the
  higher sheet's cheese sum asked again in 20%, "tic tac toe" counted with one space, sound files of
  34 million bits on a paper sat without a calculator, a copy rate of 125 MB/s in 43% of external
  disks, unquoted capitals ("Given that I has the code 73"), a 9-bit console. Seven written
  questions changed because a wrong route paid or a sheet gave an answer away (binary arithmetic
  q7 and q14; images q4, q6 and q13; compression q12); the release check now holds "an 8-bit" and
  "a 7-bit", which found "a 8% price rise", "a 11-sided base" and "a 8.1 m platform" in Maths and
  Physics.
- [x] **2. Algorithms.** Linear and binary search counts for a value present or absent in a
  sorted list, the worst case of binary search on n items; bubble sort comparisons in a pass and
  in total, swaps on a short list, n from a total; merge sort rounds and merge comparisons; the
  output of a described algorithm (a maximum, a total, repeated subtraction, loop counts, an
  off-by-one on the last index, a vowel count); a mean of marks and simple flow-chart traces.
  26 slots in 6 topics.
  Shipped 12 October 2026 (v10.107.0): 13 generators for 25 slots (`search`, `sorts`, `purpose`,
  `flowcharts`, `problems`), each answer reached a second way by running the algorithm (a search
  with a step counter, bubble sort counting comparisons and swaps, a merge counting comparisons,
  the described loop executed); the decision symbol's two exits stay written. Each algorithm is
  the lesson's own: bubble sort with the swapped flag and shorter passes, binary search with the
  midpoint (low + high) DIV 2 from 0, a merge counting only the fronts. Two reviewers found twelve
  slips, all fixed with tests: "the first item bigger than a[0]" paying in two thirds of largest-item
  builds, counting y and a repeated vowel once together paying in 65% of vowel counts, "the loop's
  last i" paying in 81% of overrun questions, a binary search on 400 000 000 items, a bubble sort
  whose early stop decided 73% of answers without being named, merges a merge sort never makes.
  Three written questions changed: the largest-item list (6, 9, 2, 11, 8, so the first bigger item
  is not the answer), the bubble-sort swaps (4, 3, 1, 2: five swaps over three passes, where three
  swaps in three passes let the passes pay), and binary search on a million (2¹⁹ < 1 000 000 < 2²⁰,
  without "to the nearest whole number").

- [x] **3. Programming traces.** MOD and DIV arithmetic, FOR, WHILE and REPEAT loops with counts
  and totals, nested loops, subroutines with return values and scope, array and 2D array sums and
  counts, string length, position and substring loops, password-attempt loops; truth-table rows;
  SQL result counts from a drawn student-and-club table. 37 slots in 8 topics.
  Shipped 12 October 2026 (v10.108.0): 20 generators for 36 slots (`operators`, `loops`,
  `subroutines`, `arrays`, `strings`, `robust`, `sql`); the truth-table row count stays written.
  Every printed program is run by `computer-science/pseudo.ts`, a small interpreter of the AQA
  pseudo-code the pack prints, and the answer is taken from the run: the second route. It refuses
  string indexing, RETURN outside a subroutine, an unset variable, an index past the end and a
  runaway loop, so code that would not run cannot ship, and its own tests run every written trace
  question to its answer. SQL counts come from an evaluator over the printed tables. Three
  reviewers found twenty-three slips, all fixed with tests: DIV and MOD swapped paying in 74% of one
  slot (the written forms added the two, which commutes), "the figure in the first line" paying in
  half the scope questions, a fee three times the cash withdrawn, a password list ending at the
  accepted value so counting the failures paid, "< read as ≤" paying in 36%, one string shape whose
  answer was always 2. Six written questions changed: operators q8 and q11 (a difference, so the
  swap no longer pays), selection q11 (40, > 17, − 7; the old one copied the lesson's own practice
  program), arrays q17 (one row, as the whole-grid loop was q21's answer on the same sheet) and
  robust q18 (a value typed after the accepted one). **Computer Science complete: 52 generators
  cover 88 of its 95 numeric questions; seven stay written.**

French, Music and English are not planned: their 30, 19 and 21 numeric questions are dates, bar
numbers, counts from a set text and listening figures, which recall a fact or read a text and
have nothing to vary.

## 12. Offline, exam readiness and spaced review (11 November 2026)

Approved 11 November 2026. Asked "what are the areas to upgrade and enrich this app?", the owner
picked going offline, working-at and target grade with timed papers, and skill-level spaced
review, checked that all three cost nothing to run, then said "include exam readiness", which
adds unit tests and grade 9 problem sets. Nothing here needs a paid service: the work runs in the
browser on the progress already stored, and the account copy stays the one JSON row it is today.
One PR per box, ticked in the PR that finishes it.

- [x] **1. Works offline and installs (UXI-5).** A service worker built with the app keeps its
  code on the device after the first visit, keeps every topic opened, and can save a whole subject
  for a journey. Signed in with no signal, the app opens on the last allow-list answer instead of
  the sign-in page, and the progress written offline goes up when the signal returns. An Install
  button where the browser offers one, and the Add to Home Screen steps on an iPhone. Shipped in
  v10.111.0: `sw-worker.js`, built into `/sw.js` by `swPlugin.ts` with the build's file lists;
  Settings, "Use without a signal". Checked in Chrome with the server stopped, since Playwright's
  offline switch does not reach a service worker's own requests: an opened topic and its quiz
  open, a saved subject's topics open, an unsaved topic says so, and a build that renames a saved
  topic's file replaces it on the device.
- [x] **2. Target and working-at grade (MTV-2, LRN-6).** The student sets a target grade per
  subject. The working-at grade is a range (for example 5 to 6) from recent answers by grade band,
  with a sentence saying how it is worked out and which topics it rests on; with too few answers
  it says how many more it needs rather than guess. Shown on the subject page, on Progress and
  on the parent's Family page. Shipped in v10.112.0 (`progress/grade.ts`): the newest answer to
  each question in the last 12 weeks, at least 20 of them; a band with under five answers is read
  from the band above it; 8 to 9 needs 70% of grade 8–9 marks and 80% of 6–7, down to 3 to 4. The
  target is kept per subject with the time it was set, so two devices keep the later choice.
- [x] **3. Exam-style papers and unit tests (TOP-3).** One paper screen for every timed or untimed
  sitting: move between questions freely, no marks or solutions until it is handed in, then the
  mark, each question's solution and the time spent on it. A unit test draws two to four questions
  from each topic in a unit. It is recorded per topic like a mixed worksheet: it counts as a visit
  (so it stops a topic fading), sends wrong answers to Redo my mistakes, and shows on the parent's
  page, but it does not replace a topic's quiz in the status rule. That differs from the story,
  which asked it to feed status: two to four questions are too few to overrule a full quiz.
  Shipped in v10.113.0: `components/paper/PaperSession.tsx`, `content/paper.ts`, and a Unit test
  button under each unit card on the map, covering the topics the card shows (so the year tabs
  choose a Year 10 test or the whole unit). Two to four questions a topic, one each past twelve
  topics; every card in the pack makes a test of 4 to 30 questions, easier bands first.
- [x] **4. Timed worksheets (WKP-4, WKS-5).** Any topic worksheet can be sat as a timed paper, at
  the subject's own exam pace (its written papers' minutes over their marks, from the exam guide:
  about 1.1 minutes a mark in Maths, 1.25 in Computer Science). Extended answers are written during
  the paper and marked against the criteria after it. Shipped in v10.114.0: a "Timed" button on
  each worksheet's start screen opens `worksheet/:level/timed`; it records as that worksheet, so
  it moves the topic's status as the untimed sheet does, with the time allowed and used. Method
  marks for a wrong typed answer are given on the paper's result screen, by the worksheet's rule
  (one short of the whole), for unit tests too.
- [x] **5. Grade 9 problem sets (WKP-5, WKS-6).** For each unit card, eight grade 8 to 9 problems
  from the reviewed questions, spread across the card's topics, leaning to the ones worth most
  marks and running from fewest marks to most; a new mix on each press. Every unit card in the
  pack, in each year and for all years, has enough for a full set. Full worked solutions and mark
  schemes after hand-in; timed or not. Shipped in v10.115.0: a "Grade 9 set" button beside each
  unit test, `grade9Items` in `content/paper.ts`, recorded per topic as a review.
- [x] **6. Skill mastery and spaced review (TRK-2, TRK-3).** Each question answered gets its next
  review date at growing intervals (1, 3, 7, 16, 35, 80 days; a wrong answer starts it again). The
  daily recap asks what is due first, across subjects, then tops up by topic need as today. Home
  says how many are due; each topic page lists its weakest skills, newer answers counting more.
  Worked out from the attempts already stored, so the event log (TRK-1) is not needed first.
  Shipped in v10.116.0 (`progress/spaced.ts`): right twice on one day counts as one recall, part
  marks drop a box, and the most overdue for its gap come first; the recap grows from five to ten
  when more are due and tops up by need when fewer are. A skill is listed as weak below 70% of its
  marks, with answers halving in weight every 14 days, and links to the lesson step that checks it.

## 13. Harder questions for Maths and the sciences (12 November 2026)

Asked 12 November 2026: "I want some more questions and answers - may even more complex -
especially sciences and maths - can you plan for that". Approved the same day in the order
Maths, Physics, Chemistry, Biology, with Further Maths left out of this round (box 11 waits),
and with a label on every practice set saying how hard it is.

**Where the bank stands.** Maths has 1,345 questions over 72 topics, Physics 653 over 34,
Chemistry 854 over 47, Biology 1,129 over 38 and Further Maths 397 over 22. The generators
already give new numbers on every retry for most numeric questions, so a retry is not a repeat.
What the bank lacks is the shape of a real paper question:

- **Almost everything is one short question.** 54% of Maths questions and 80% of Chemistry
  questions are worth 1 mark. Only 10% of Maths, 10% of Chemistry and 15% of Physics questions
  are worth 4 marks or more, and Chemistry has just 26 three-mark questions.
- **There are no multi-part questions.** A paper question gives a context, a table or a graph,
  then asks (a), (b), (c), each part building on the one before. The schema has no way to do
  that, so the few that try it put "(a)" and "(b)" inside one prompt with one answer box.
- **Few questions show data.** 23 Maths, 16 Physics, 2 Biology and no Chemistry questions carry
  a graph or diagram, though reading data is a large share of every science paper.
- **Required practicals are thin.** Only 40 Physics, 22 Chemistry and 44 Biology questions
  mention a practical at all. The boards examine method, variables, errors and data from each one.
- **Grade 8–9 is mostly multiple choice.** 44% of each bank is labelled 8–9, but many of those
  are one-mark options. A grade 9 question is usually a 4–6 mark problem in an unfamiliar context.

**What is added.** About 1,000 new questions, written and checked one subject at a time:

| Subject | Topics | New per topic | About | Kinds |
|---|---|---|---|---|
| Maths (Edexcel 1MA1) | 72 | 4 | 290 | 2 multi-part, 2 problem-solving (4–6 marks) |
| Physics (AQA 8463) | 34 | 6 | 200 | multi-part with data, calculation chains, required practicals |
| Chemistry (AQA 8462) | 47 | 6 | 280 | multi-step moles, data, 6-mark explain, required practicals |
| Biology (Edexcel 1BI0) | 38 | 5 | 190 | data and graphs, maths skills, core practicals, 6-mark |
| Further Maths (AQA 8365) | 22 | 4 | 90 | multi-part 6–8 mark problems, proof |

Every new question follows the content rules already held by tests and memory: it stands
alone without the lesson, its figures are checked by a script before it is written, any claim
about the specification traces to the board's PDF, accepted answers are checked against the
prompt, and its examples cannot make a false rule look true. The numeric parts get generators
with a second-method check, so a retry draws new numbers as the rest of the bank does. Each
subject is read by reviewer agents before it ships, and walked in the browser at phone and
laptop width. New questions join the topic's question list, its Advanced worksheet, unit tests,
grade 9 sets and spaced review; ids and progress for existing questions do not change.

Nothing here needs a paid service: the questions are bundled with the app as the rest are.
One PR per box, ticked in the PR that finishes it. Stop and report after each subject.

- [x] **1. Multi-part questions.** A new question type: a shared stem with an optional table,
  graph or diagram, then two to five parts, each one an existing type (numeric, short text,
  multiple choice, ordering or a self-marked extended answer). The question's marks are the
  sum of its parts. Each part is marked on its own when it is answered, so a slip in (a) does
  not cost (b), and an extended part is self-marked by its criteria as today. Works on the
  topic page, on worksheets (printed with the stem once and space per part), on the paper
  screen, in unit tests and grade 9 sets, and in spaced review. Content validation checks that
  the marks add up, part letters run in order and the stem holds every figure a part needs.
  Ships with one example per subject below, so the type is proved before the bulk is written.
  Shipped in v10.117.0. A part is an ordinary question with a `context`; the topic's `contexts`
  hold each stem once, and parsing attaches it to its parts with their letter, so marking,
  progress, spaced review and the mistakes list needed no change. `QuestionPrompt` prints the
  stem above "Part (b) of 3" on every screen; a printed sheet numbers the parts 3(a), 3(b) under
  one stem. Unit tests and mixed sheets keep drawn parts together; a grade 9 set asks the whole
  question and counts it as one problem. A multi-part question counts once, at its top part,
  towards a topic's 40% grade 8–9 share, and its earlier parts may sit on the Advanced sheet.
  Generators: the parts of one stem build from one seed and may rewrite the stem, and the
  release check holds every part to the same stem. Examples: Maths quadratic garden, Physics
  roller coaster, Chemistry titration table, Biology osmosis table; the osmosis one has a
  generator (`osmosis-results-table`), the other three get theirs in their subject's box. Every
  practice set now says how hard it is: Core grades 4–5, Higher 6–7, Advanced 8–9 (hardest),
  quiz all grades, unit test grades 4–9, grade 9 set hardest.
- [x] **2. Maths: number, ratio, probability and statistics.** 29 topics. In two PRs. Number (10 topics, 78 questions: two multi-part questions and two longer problems per
  topic, on each Advanced sheet) in v10.118.0. Writing them found a marker fault older than
  them: brackets round a bottom of several factors were dropped, so y = −1/(2x) + 3, a curve,
  was marked right for the line y = −½x + 3 on five questions, and 3/(2√2) for 3√2/2. A bracket
  after a / or before a ^ that holds more than one factor now stays. The new questions are
  written, not generated; whether to add generators for them is the owner's call after Maths.
  Ratio (6 topics, 46 questions), Probability (6, 50) and Statistics (7, 56) in v10.119.0: 230
  questions over the box in all. Data for statistics comes in tables, as many exam questions
  give it. A fraction answer is now always asked for as a fraction or also takes its exact
  decimal: six older questions marked 0.5 wrong for "the exact value of sin 30°" and 0.7 wrong
  for a probability of 7/10. A question can now name the lesson step that teaches it (`step`),
  which a missed question links to: the new problems set scenes, and only 46 of 240 were
  linked by their words, so every new Maths question names its step.
- [x] **3. Maths: algebra.** 23 topics, including graphs and sequences. 178 questions in
  v10.120.0, each naming the lesson step it rests on. The repeat check now reads a part with
  its stem, since "Solve the inequality." under two different inequalities is two questions.
- [x] **4. Maths: geometry and measures.** 20 topics. 149 questions in v10.122.0, each figure
  described in words and coordinates. Maths is complete: about 557 new questions over 72 topics.
- [ ] **5. Physics: energy, the particle model and forces.** 15 topics.
- [ ] **6. Physics: electricity, waves, magnetism, atoms and space.** 19 topics. Every AQA
  required practical has at least one multi-part question by the end of this box.
- [ ] **7. Chemistry: atoms, bonding, quantities and chemical changes.** 22 topics. Most of
  the multi-step mole and concentration problems sit here.
- [ ] **8. Chemistry: energy, rates, organic, analysis, atmosphere and resources.** 25 topics.
  Every AQA required practical has at least one multi-part question by the end of this box.
- [ ] **9. Biology: key concepts, cells and control, genetics and natural selection.** 19 topics.
- [ ] **10. Biology: health, plants, animal coordination, exchange and ecosystems.** 19 topics.
  Every Edexcel core practical has at least one multi-part question by the end of this box.
- [ ] **11. Further Maths.** Multi-part problems in the style of the 8365 papers' longer
  questions, including proof and show that.
- [ ] **12. Challenge problems across topics.** Ten to twenty problems per subject for Maths and
  the three sciences that need two or more units at once (for example forces with energy, or
  algebra with geometry), as a "Challenge" set on the subject page beside the grade 9 sets.

## 3. Product features (not planned)

Checked story by story against the code on 23 September 2026. Of the 46 stories, 10 are
done: LRN-2, LRN-8, WKS-2, WKS-3, QZ-2, PRG-2, PAR-4, MOT-1, MOT-3 and MOT-5. The rest are
listed below. Each box is the missing part of a story, not the whole story.

### Bugs: the app claims something it does not do
- [x] **WKS-7:** the scratch canvas said "Working is saved with your answer", but strokes
  are kept only in the tab's session storage and never reach the attempt record. The note
  now says the working stays while the worksheet is open and is not saved with the score.
- [x] **PRG-1:** topic status never decayed. The app now applies the PRD's six-week rule
  when it reads a status, as `apply_decay()` does in the database: Mastered falls to Secure
  and Secure to Developing, one step per six weeks untouched, never below Developing. Any
  attempt or lesson step counts as a revisit. A decayed topic is offered a recap quiz, and
  its page says why the status fell.

### Partly built
- [x] **QZ-1:** a missed quiz question should link to the lesson step that teaches it, not the
  start of the lesson.
- [x] **WKS-1:** open the Advanced worksheet by default for a Secure topic. Today only Home's
  recommendation points there.
- [x] **LRN-1:** show on each topic-map row which of lesson, worksheets and quiz are done
  (today only a status icon).
- [x] **LRN-5:** the Further Maths exam technique guide (PR #266; checked in the review pass).
- [ ] **LRN-7:** build the drag-order, drag-match and labelling interactives. They are in the
  schema but have no component.
- [ ] **WKS-7:** make the scratch canvas resizable.
- [x] **PAR-1:** compare with the previous week (minutes, topics, quizzes, per-subject status
  change), and add a suggested task beside each weak topic.
- [x] **PAR-2:** give the parent the child's own year and term topic map, read-only (7 October 2026).
- [x] **PAR-5:** split the 8-week trend by subject and add average score per week (7 October 2026).
- [ ] **TUT-3:** show the student who set a task, and the score once it is done.
- [ ] **MOT-2:** add a "finished a unit" badge, show badges in the parent summary, and give
  badges per-subject artwork.
- [x] **MOT-4:** celebrate each topic reaching Mastered and each unit finished, with a card the
  student can keep or share.
- [ ] **FAM-3:** let a student see which parents are linked to them. An expiring invite link
  is not needed while sign-in is by Google allow-list.
- [ ] **FAM-4:** decide what happens to a removed member's progress (the story asks for 90 days'
  retention and a warning email).

### Not started
- [x] ~~**LRN-4:** exam dates per subject.~~ Dropped 28 September 2026. School exams follow the
  topics taught, so the dates are not known ahead, and a countdown to a guessed date would
  mislead. The field and the Home countdown were taken out; LRN-3 keeps subject order.
- [x] **LRN-6:** target grade per subject, with the working-at grade beside it (section 12, item 2).
- [x] **QZ-3:** spaced recap quiz of 5–10 questions across subjects, started with one tap.
  The daily recap (`/recap`, on Home's Today plan), 6 October 2026.
- [x] **QZ-4:** wrong-answer bank. Redo my mistakes (`/mistakes`, and a card on Home) asks up to 15
  questions got wrong, newest first; two right in a row clears one (WKP-1).
- [x] **WKS-4:** mixed-topic worksheet. Make a worksheet (#381), section 5 item 8.
- [x] **WKS-6:** grade 9 problem set per unit (section 12, item 5).
- [x] **WKS-5:** timed paper mode (section 12, item 4).
- [ ] **PAR-3:** weekly email digest.
- [x] **ADM-4:** report a mistake in content. A link under every lesson step and question sends
  a note to `content_reports`; parents review it on the Family page's Reports tab (OPS-3).

### Deferred by the 8 September scope change
Not planned unless the scope changes again:
- **Tutors:** TUT-1, TUT-2, TUT-4.
- **Authoring UI:** ADM-1, 2, 3, 5, 6 and 7. Content is authored as JSON and reviewed in PRs,
  and the publish rules are enforced by `validate.ts`.
- **Password and Apple sign-in, usernames and per-child board choice:** the parts of FAM-1,
  FAM-2 and FAM-5 that Google sign-in replaced.
