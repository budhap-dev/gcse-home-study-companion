# GCSE Home Study Companion · Backlog

The single list of what is left to do. Tick an item (`[x]`) in the PR that finishes it and
add the PR number; add new work here as it is found, not in a separate note. Story IDs
(`LRN-2`, `PAR-4`) refer to [stories.md](stories.md), where the acceptance criteria live;
[plan.md](plan.md) holds the delivery plan these came from.

Last reviewed: 27 September 2026.

**Development closed on 27 September 2026**, at the owner's request, with content (1) and
testing and validation (2) complete. The product features in section 3 are **not planned**:
they stay listed as a record of what the stories asked for, not as work in progress.
The improvement scope review of the same day, written as 71 stories with effort estimates, is in
[improvement-stories.md](improvement-stories.md).

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
- [ ] **LRN-6:** target grade per subject. There is a database column only.
- [x] **QZ-3:** spaced recap quiz of 5–10 questions across subjects, started with one tap.
  The daily recap (`/recap`, on Home's Today plan), 6 October 2026.
- [x] **QZ-4:** wrong-answer bank. Redo my mistakes (`/mistakes`, and a card on Home) asks up to 15
  questions got wrong, newest first; two right in a row clears one (WKP-1).
- [ ] **WKS-4:** mixed-topic worksheet.
- [ ] **WKS-6:** grade 9 problem set per unit.
- [ ] **WKS-5:** timed paper mode.
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
