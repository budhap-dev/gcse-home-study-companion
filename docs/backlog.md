# GCSE Home Study Companion · Backlog

The single list of what is left to do. Tick an item (`[x]`) in the PR that finishes it and
add the PR number; add new work here as it is found, not in a separate note. Story IDs
(`LRN-2`, `PAR-4`) refer to [stories.md](stories.md), where the acceptance criteria live;
[plan.md](plan.md) holds the delivery plan these came from.

Last reviewed: 24 September 2026.

## Order of work

Agreed with the owner on 23 September 2026:
1. Finish all the content, one subject at a time, each subject complete before the next
   starts.
2. Then testing and validation.
3. Then product features.

## 1. Content, subject by subject

Computer Science, Business, Physics, Chemistry and Music have no known content gaps.

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
- [ ] Year 9 bridging units: five rows unwritten (microbes, immune system, nervous system,
  genetic code, classification and evolution). Owner decided on 23 September 2026: write them.

### French (Edexcel 1FR1)
- [ ] `why` block (why it matters, and real-world examples) for all 50 topics

### Music (Edexcel 1MU0)
- [x] `why` block for all 19 topics (PR #261): 56 examples, 50 with a picture

### Further Maths (AQA Level 2 Certificate 8365)
Board confirmed 18 September 2026. The teaching order is derived in
[curriculum/further-maths.md](curriculum/further-maths.md). 3 of 22 rows are written.

- [ ] Surds and exact calculation
- [ ] The product rule for counting
- [ ] Expanding, and the binomial expansion
- [ ] Factorising at Further Maths level
- [ ] Completing the square and quadratic equations
- [ ] Quadratic inequalities and index equations
- [ ] The factor theorem and cubics
- [ ] Sequences and limiting values
- [ ] Gradients, distance and points on a line
- [x] Differentiation and the gradient function
- [x] Tangents, normals, and increasing and decreasing functions
- [x] Maxima, minima and optimisation
- [ ] Functions: domain, range, composite and inverse
- [ ] Algebraic fractions at Further Maths level
- [ ] Rearranging formulae and algebraic proof
- [ ] Simultaneous equations, including three unknowns
- [ ] Circles and the tangent at a point
- [ ] Matrix multiplication and the identity
- [ ] Transformations of the unit square
- [ ] Trigonometry and Pythagoras in 2D and 3D
- [ ] Trigonometric graphs, identities and equations
- [ ] Geometrical proof
- [ ] `why` blocks
- [ ] Exam technique guide (LRN-5); the page says "not been written yet"

### English (AQA 8700 Language and AQA 8702 Literature, confirmed 23 September 2026)
- [ ] Find the school's curriculum overview and the set texts
- [ ] Plan and write every topic, with `why` blocks and an exam technique guide

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
- [ ] French
- [ ] Music
- [ ] Further Maths
- [ ] English
- [ ] A second pass over any subject that gained topics after its review

**Pack-wide quality**
- [x] **Diagrams fit a phone: flowcharts, line graphs, logic circuits, Huffman trees and
  byte tables** (PR #255). Scrolling at 390: 47, 96, 9, 1 and 131 dropped to 0, 0, 0, 0 and 23.
- [ ] **Diagrams fit a phone: the rest.** 124 diagrams still scroll sideways at 390 on
  lesson and why pages. The largest groups are tables with long words (23), Chemistry
  displayed formulae (16), circuit diagrams (13), French verb tables (10), then ray, curve,
  reaction-profile, lens, lattice and electric-field diagrams. Measure with a before-and-after
  run of every page at 390 against `main`.
  Motion graphs now take the card's width, as line graphs do, and no longer scroll.
- [ ] **The correct option is too often the longest.** In 1757 of 3841 multiple-choice
  questions (46%) the right answer is the only longest option, so "pick the longest" nearly
  doubles a guesser's score. Rebalance the options, and add a collection test with a
  per-topic cap, as `answers.test.ts` does for answer positions.
- [ ] Chemistry: 15 diagrams scroll at desktop width. Recheck after the diagrams PR.
- [ ] **Components too wide for a phone:** `venn-diagram` (440), `cuboid` (380) and
  `triangle-pair`. The new Maths topics use all three.
- [ ] **LineGraph options:** a joined line through points for time series (today it is a
  polygon traced out and back), and `axes: false` for pictures of shapes (today the axes
  are hidden with out-of-range ticks).
- [ ] **Stacked (composite) bar charts:** no component draws them, so S2 teaches them in
  words only.
- [ ] **Walk false positive:** a multiple-choice check whose options are pure LaTeX is
  reported "not marked Correct", because the walk's text match cannot find the option.

## 3. Product features

Checked story by story against the code on 23 September 2026. Of the 46 stories, 10 are
done: LRN-2, LRN-8, WKS-2, WKS-3, QZ-2, PRG-2, PAR-4, MOT-1, MOT-3 and MOT-5. The rest are
listed below. Each box is the missing part of a story, not the whole story.

### Bugs: the app claims something it does not do
- [ ] **WKS-7:** the scratch canvas says "Working is saved with your answer", but strokes
  are kept only in `sessionStorage`. They never reach the attempt record or sync. Either
  save them with the attempt or change the wording.
- [ ] **PRG-1:** topic status never decays. The PRD's six-week rule (`decayAfterWeeks`) only
  drives the recap suggestion in `recommend.ts`, so a topic stays Secure forever.

### Partly built
- [ ] **QZ-1:** a missed quiz question should link to the lesson step that teaches it, not the
  start of the lesson.
- [ ] **WKS-1:** open the Advanced worksheet by default for a Secure topic. Today only Home's
  recommendation points there.
- [ ] **LRN-1:** show on each topic-map row which of lesson, worksheets and quiz are done
  (today only a status icon).
- [ ] **LRN-5:** write the Further Maths exam technique guide; the page says "not been
  written yet".
- [ ] **LRN-7:** build the drag-order, drag-match and labelling interactives. They are in the
  schema but have no component.
- [ ] **WKS-7:** make the scratch canvas resizable.
- [ ] **PAR-1:** compare with the previous week (minutes, topics, quizzes, per-subject status
  change), and add a suggested task beside each weak topic.
- [ ] **PAR-2:** give the parent the child's own year and term topic map, read-only.
- [ ] **PAR-5:** split the 8-week trend by subject and add average score per week. Today it is
  study time only, all subjects together.
- [ ] **TUT-3:** show the student who set a task, and the score once it is done.
- [ ] **MOT-2:** add a "finished a unit" badge, show badges in the parent summary, and give
  badges per-subject artwork.
- [ ] **MOT-4:** celebrate each topic reaching Mastered and each unit finished, with a card the
  student can keep or share.
- [ ] **FAM-3:** let a student see which parents are linked to them. An expiring invite link
  is not needed while sign-in is by Google allow-list.
- [ ] **FAM-4:** decide what happens to a removed member's progress (the story asks for 90 days'
  retention and a warning email).

### Not started
- [ ] **LRN-4:** exam dates per subject. Once set, LRN-3's "soonest exam first" ordering follows.
- [ ] **LRN-6:** target grade per subject. There is a database column only.
- [ ] **QZ-3:** spaced recap quiz of 5–10 questions across subjects, started with one tap.
- [ ] **QZ-4:** wrong-answer bank. The per-question results are already stored.
- [ ] **WKS-4:** mixed-topic worksheet.
- [ ] **WKS-6:** grade 9 problem set per unit.
- [ ] **WKS-5:** timed paper mode.
- [ ] **PAR-3:** weekly email digest.
- [ ] **ADM-4:** report a mistake in content.

### Deferred by the 8 September scope change
Not planned unless the scope changes again:
- **Tutors:** TUT-1, TUT-2, TUT-4.
- **Authoring UI:** ADM-1, 2, 3, 5, 6 and 7. Content is authored as JSON and reviewed in PRs,
  and the publish rules are enforced by `validate.ts`.
- **Password and Apple sign-in, usernames and per-child board choice:** the parts of FAM-1,
  FAM-2 and FAM-5 that Google sign-in replaced.
