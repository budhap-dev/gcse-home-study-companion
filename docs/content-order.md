# Content authoring order

Content is authored just ahead of what the pilot student meets in class. This is the queue. Source: the school's curriculum overviews for Years 9 to 11, one document per subject in [curriculum/](curriculum/README.md). Maths and Physics are queued here; the other subjects follow their curriculum documents when their phase starts.

## What is written, by school year

Every topic carries a `year` field, taken from the school's curriculum overview for that subject in [curriculum/](curriculum/README.md). The app groups a subject's topics by year, so Year 9 work the student has already been taught stays visible as recap: the milestones and synoptic tests keep re-testing it.

| Subject | Year 9 (recap) | Year 10 (current) | Year 11 |
|---|---|---|---|
| Mathematics | — | 24: Choices and outcomes · Circle theorems · Combined events and tree diagrams · Congruent triangles · Constructing triangles · Equations of straight lines · Exact trigonometric values · Expanding and factorising quadratics · Histograms · Identities and rearranging formulae · Iteration · Laws of indices · Linear, quadratic and geometric sequences · Parallel and perpendicular lines · Powers and roots · Ratio and proportion · Sample space diagrams · Scale drawings and bearings · Sets and set notation · Similarity and linear scale factors · Sine rule, cosine rule and area of a triangle · Solving quadratic equations · Surds · Venn diagrams | — |
| Physics | 5: Describing motion: speed, velocity and acceleration · Forces and motion: Newton's laws · Forces, weight and resultant forces · Kinetic and gravitational potential energy · Stopping distances | 4: Hooke's law and elasticity · Moments, levers and gears · Momentum · Pressure in fluids | — |
| Chemistry | — | 6: Covalent bonding: molecules, polymers and giant structures · Diamond, graphite, graphene, fullerenes and nanoparticles · Electrolysis of aqueous solutions · Electrolysis of molten compounds · Ionic bonding and ionic compounds · Metallic bonding and alloys | — |
| Biology | — | 8: Antibiotics, new medicines and monoclonal antibodies · Non-communicable disease and lifestyle · Pathogens and how disease spreads · Photosynthesis and limiting factors · Plant adaptations, defences and hormones · The immune system and immunisation · The leaf, root hair cells, xylem and phloem · Transpiration and translocation | — |
| Computer Science | 2: Data types and operators · Selection, iteration and tracing | 8: Arrays and records · Bubble sort · Data compression: Huffman coding and run length encoding · Merge sort · Robust and secure programming: validation, authentication and testing · String handling, conversions, and files for your project · Subroutines: procedures and functions · Working out what an algorithm does by tracing it | — |
| Business | 3: Enterprise and entrepreneurship · Putting a business idea into practice · Spotting a business opportunity | 3: Growing the business · Making the business effective · Understanding external influences | — |
| French | — | 10: Booking and reviewing accommodation · Festivals and traditions · Good mental health · Holiday activities · Holidays and accommodation · Holidays in three tenses · Illness and accidents · Improving your life, with the simple future · Lifestyle changes · My ideal holiday, with the conditional | — |
| Music | — | 4: Afro Celt Sound System: Release · Bach: Brandenburg Concerto No. 5, third movement · Killer Queen · Star Wars main title | — |

Counts are topics drafted, not the whole syllabus: a year with no entry is simply not written yet.

The **whole** syllabus, written or not, lives in `packages/shared/src/syllabus.ts`, built from the curriculum overviews and from this queue. The subject page renders all of it, so a topic still to be written shows as *Coming soon* rather than being absent. A test asserts that every written topic appears there exactly once, so nothing can become invisible. Pure revision and coursework blocks are left out, because there is no topic to write for them.

## Mathematics, Edexcel 1MA1 Higher

| When | Topics, in teaching order | Status |
|---|---|---|
| Autumn 1 | Laws of indices · Powers and roots · Surds · Equations of straight lines · Parallel and perpendicular lines · Constructing triangles · Congruency | All seven drafted. Powers and roots was missed in the first pass and added on 10 September 2026; the school's topic test covers powers, roots and surds together. |
| Autumn 2 | Circle theorems · Expanding and factorising quadratics · Identities and equivalence · Rearranging formulae · Solving quadratic equations | All drafted 12 September 2026 (identities and rearranging as one topic) |
| Spring 1 | Combined events and tree diagrams · Sample space diagrams · Venn diagrams · Choices and outcomes · Sets and set notation · Histograms · Linear, quadratic and geometric sequences · Iteration | **Spring 1 is complete.** All eight drafted 14 September 2026: the five probability and sets topics, then Histograms, Linear, quadratic and geometric sequences, and Iteration. Note that spec point S3 also names **cumulative frequency graphs**, which no topic covers yet; the Histograms topic teaches running totals for the median class but not the graph. |
| Spring 2 | Ratio and proportion · Similarity and linear scale factors · Exact trigonometric values · Sine rule, cosine rule and area of a triangle · Scale drawings and bearings | **Spring 2 is complete.** All five drafted 14 September 2026. This batch also introduces **tips and tricks**: a short set of practical hints per topic, in four kinds (remember it, spot it, quicker way, check it), shown on the topic page. Other subjects are to be backfilled. |
| Summer 1 | Quadratic curves: turning points and intercepts · Inequalities on a number line · Inequality regions · Quadratic inequalities · Area and volume scale factors · Pythagoras in 3D · Trigonometry in 3D | **Summer 1 is complete.** All seven drafted 15 September 2026, written against the Edexcel 1MA1 specification PDF rather than from memory. That mattered: **four of the seven are Higher tier only**. Foundation G20 stops at right-angled triangles in *two-dimensional* figures, so both 3D topics are Higher; and A22 gains *two variables*, *quadratic inequalities* and *set notation* only at Higher, so inequality regions and quadratic inequalities are Higher too. A11 gains *turning points by completing the square* at Higher. Four new diagram components: `inequality-line`, `inequality-region`, `cuboid`, and the `reaction-profile` from the Chemistry batch. |
| Summer 2 | Limits of accuracy and bounds · Surface areas and volumes · Vector arithmetic · Vector geometry · Compound measures · Compound interest, growth and decay · Rate of change and real-life graphs | **Summer 2 is complete, and with it Year 10 Maths.** All seven drafted 15 September 2026 against the Edexcel 1MA1 specification PDF. Three points gain Higher-only wording that the topics teach and flag: **N16** adds *upper and lower bounds*, **G25** adds *use vectors to construct geometric arguments and proofs*, and **R16** adds *general iterative processes*; A15 and G17 are identical in both tiers. Bounds and vectors are each taught once but listed twice in the school's plan (Year 9 Autumn and here), so both syllabus rows link to the same topic. One new diagram component, `vector-figure`, which derives midpoints and ratio points from the two ends rather than taking their positions, so a proof figure cannot contradict the algebra printed beside it. |

School assessments the content should be ready before: topic tests on powers, roots and surds and on coordinate geometry in Autumn 1; circle theorems in Autumn 2; probability, ratio and proportion, trigonometry in Spring; quadratic curves and inequalities, vectors, compound measures in Summer; synoptic tests each term covering everything since Year 9.

## Physics, AQA 8463 Higher, Triple

Source: the school's Year 10 Physics overview, shared 2 September 2026. The school covers Energy in Year 9 and starts Year 10 on Forces, so the specification order is not the teaching order.

| When | Topics, in teaching order | Status |
|---|---|---|
| Autumn 1 | Hooke's law and elastic potential energy · Balancing forces, which the school's overview means as moments, levers and gears | Both drafted |
| Autumn 2 | Momentum, including conservation and $F = \Delta p / \Delta t$ · Pressure in fluids and atmospheric pressure | Both drafted 10 September 2026 |
| Year 9 recap | Describing motion · Resultant forces · Newton's laws · Stopping distances | All four drafted 13 September 2026 |
| Spring 1 | The gas laws and behaviour of gases · Thermal physics: internal energy, specific heat capacity, specific latent heat | **Spring 1 is complete.** Both drafted 14 September 2026: Internal energy, specific heat capacity and latent heat (AQA 4.3.2.1-3), and The behaviour of gases (4.3.3.1-3). The school's two thermal rows are one written topic, so the syllabus lists them as one line. Note that 4.3.3 is **Physics only**, and 4.3.3.3, work done on a gas, is also **Higher tier**; both are taught here and flagged in the lesson. |
| Spring 2 | Electromagnetic waves and light | **Spring 2 is complete.** Both drafted 15 September 2026: The electromagnetic spectrum (AQA 4.6.2.1, 4.6.2.3, 4.6.2.4) and Light: reflection, refraction and colour (4.6.1.3, 4.6.2.2, 4.6.2.6). The light topic is **Physics only** throughout, and its refraction explanation is also **Higher tier**. Introduces the `ray-diagram` component, which computes the refracted angle from the speed ratio so the picture cannot contradict the prose. |
| Summer 1 | Static electricity and electric fields | **Summer 1 is complete.** Drafted 15 September 2026 from the AQA 8463 specification PDF. Both 4.2.5.1 and 4.2.5.2 are labelled **physics only**, so neither is in Combined Science. New `electric-field` component: field-line direction and the force arrows on a pair are derived from the signs given, so a diagram cannot show like charges attracting. |
| Summer 2 | Circuits: current, potential difference, resistance, series and parallel, building circuits | **Summer 2 is complete, and with it Year 10 Physics.** Two topics drafted 15 September 2026: current, potential difference and resistance (4.2.1.1–4), carrying required practicals 3 and 4; and series and parallel circuits (4.2.2). The spec states explicitly that students are **not required to calculate the total resistance of two resistors in parallel**, only to know it is less than the smallest branch and explain why — the lesson says so rather than teaching a formula. New `circuit-diagram` component: given a supply pd and the resistances, it works out the total resistance, the current and the pd across each part, so a diagram can never print readings that break V = IR or the series and parallel rules. |

School assessments the content should be ready before: milestone tests on Hooke's law, balancing forces and moments in Autumn 1; on pressure, gases and light in Autumn 2; a final exam covering Year 9 and Year 10 Physics in the summer. Year 9 material (Energy, including kinetic and gravitational potential energy) reappears in the synoptic tests, so the sample-pack topic stays useful as recap.

The Autumn 2 Milestone re-tests all of Year 9 alongside Hooke's law, moments and momentum, so the Year 9 Forces topics were written as recap on 13 September 2026: Describing motion (4.5.6.1), Forces, weight and resultant forces (4.5.1 and 4.5.2), Newton's laws (4.5.6.2) and Stopping distances (4.5.6.3). They sit after the Year 10 topics in the Forces unit, orders 5 to 8, because the Year 10 work is what the student meets in class now. Three diagrams were added for them: `motion-graph`, `free-body` and `vector-triangle`.

## Chemistry, AQA 8462 Higher, Triple

| When | Topics, in the school's order | Status |
|---|---|---|
| Autumn 1 and 2 | C2 Structures and bonding: ionic bonding · covalent bonding and simple molecules · giant covalent structures and polymers · metallic bonding and alloys · carbon structures and nanoparticles | Ionic, covalent, metallic bonding and carbon structures drafted (C2 complete) |
| Autumn 2 | C4 Chemical changes continued: electrolysis of melts and solutions · half equations | Both drafted 12 September 2026 (Electrolysis of molten compounds · Electrolysis of aqueous solutions, with required practical 3) |
| Spring | C5 Energy changes · C7 Organic chemistry: crude oil, alkanes, cracking | **Four of five drafted 15 September 2026**: Exothermic and endothermic reactions (4.5.1.1, with required practical 4), Reaction profiles and bond energies (4.5.1.2 and 4.5.1.3, the calculation being Higher tier), Crude oil, hydrocarbons and alkanes (4.7.1.1–4.7.1.3) and Cracking and alkenes (4.7.1.4). Cells, batteries and fuel cells (4.5.2, chemistry only) followed on 15 September, completing the term. Its half equations are Higher tier, and the generator checks each one for atoms and charge and then adds the pair to confirm it gives the overall reaction with the electrons cancelling. |
| Summer | C7 continued: alkenes, alcohols, carboxylic acids, esters · polymers and biological molecules | **Summer is complete.** Five topics drafted 15 September 2026 from the AQA 8462 specification PDF: alkenes and their reactions (4.7.2.1–2), alcohols (4.7.2.3), carboxylic acids and esters (4.7.2.4), addition and condensation polymers (4.7.3.1–2), and proteins, carbohydrates and DNA (4.7.3.3–4). **All of 4.7.2 and 4.7.3 is chemistry only**, so none of it appears in Combined Science. Three parts are also **HT only** and are flagged in the lessons: the weak-acid explanation in carboxylic acids, condensation polymerisation, and amino acids. One new diagram component, `displayed-formula`, which fills in the hydrogens by valency rather than taking them from the content, so a drawn structure cannot disagree with the molecular formula beside it — the error students are marked on. |


## Biology (Edexcel 1BI0)

School order for Year 10: Unit 6 Plant structures first, then Unit 5 Health and disease, Unit 7 Animal coordination, Unit 9 Ecosystems, Unit 2 Cells and control. Units 1 and 8 were taught in Year 9.

| Half term | Topics | Status |
|---|---|---|
| Autumn 1 | Unit 6: photosynthesis and limiting factors · the leaf, root hair cells, xylem and phloem · transpiration and translocation · plant adaptations, defences and hormones (Biology only) | All four drafted |
| Autumn 1 and 2 | Unit 5: pathogens and how disease spreads · the immune system and immunisation · antibiotics, new medicines and monoclonal antibodies · non-communicable disease and lifestyle | All four drafted |


## Computer Science (AQA 8525)

School order for Year 10: programming (subroutines, arrays, records, files, strings, robust programming) in Autumn; sorting, tracing and compression in Spring; Boolean logic, circuits and software in Summer. Year 9 covered algorithms, basic programming and data representation.

| Half term | Topics | Status |
|---|---|---|
| Autumn 1 | Programming: subroutines · arrays and records · strings and files · robust and secure programming | All four drafted; each links to the family's Learn C# practice site |
| Autumn 2 | Recap of Year 9 programming: data types, selection, iteration; more practice tracing | Both drafted 13 September 2026 (Data types and operators · Selection, iteration and tracing). **Computer Science Autumn is complete.** |
| Spring | Sorting: bubble and merge · determining the purpose of an algorithm by tracing · compression | All four drafted 14 September 2026 (Bubble sort · Merge sort · Working out what an algorithm does by tracing it · Data compression). **Computer Science Spring is complete.** |

## Business (Edexcel 1BS0)

Started 10 September 2026 with the owner's approval. School order for Year 10: 1.4 and 1.5 in the Autumn, with a Milestone on 1.1 to 1.5 (multiple choice plus a case study with a 12 marker); 2.1 in the Spring; 2.2 in the Summer. 1.1 to 1.3 were taught in Year 9 and the Milestone re-tests them, so they follow as recap. Each Edexcel spec section is one app topic, so Theme 1 is five topics and Theme 2 is five.

| Half term | Topics | Status |
|---|---|---|
| Autumn 1 and 2 | 1.4 Making the business effective: ownership and liability, franchising, location, the marketing mix, business plans · 1.5 Understanding external influences: stakeholders, technology, legislation, the economy | Both drafted 10 September 2026 |
| Autumn 2 recap | 1.3 Putting a business idea into practice, including the calculations · 1.1 Enterprise and entrepreneurship · 1.2 Spotting a business opportunity | All three drafted 10 September 2026. **Theme 1 is complete**, so every section the Autumn Milestone on 1.1 to 1.5 tests is now covered. |
| Spring | 2.1 Growing the business | Drafted 14 September 2026, written from the Edexcel specification Issue 2 (July 2022). Covers 2.1.1 to 2.1.4 in one topic. |
| Summer | 2.2 Making marketing decisions | Drafted 15 September 2026, covering 2.2.1 to 2.2.5 in one topic, from the Edexcel specification. Writing it found the `levels()` helper and the generator's own assertion both still demanding **four** levels for a 12 marker, after the six written topics had been corrected to Edexcel's three. Both are fixed, and `edexcel-levels.test.ts` now enforces three levels with the 1-4, 5-8, 9-12 bands. **Business Theme 2 Year 10 is complete.** |

The grade 9 discriminators in Business are the 9 and 12 mark justify and evaluate questions and the calculations in 1.3 and 2.4, so each topic's Advanced worksheet is built from those.

## French (Edexcel 1FR1, confirmed 11 September 2026)

Started 10 September 2026. The school's overview does not name a board; the owner confirmed Edexcel 1FR1 on 11 September 2026. School order for Year 10 term 1 and 2: good mental health, illness and accidents with the perfect tense of reflexive verbs, the simple future, lifestyle changes, then holidays, festivals and accommodation.

| Half term | Topics | Status |
|---|---|---|
| Autumn 1 | Good mental health · Illness and accidents, with the perfect tense of reflexive verbs · What you will do to improve your life, with the simple future · Lifestyle changes | All four drafted by 11 September 2026. **Autumn 1 is complete.** |
| Autumn 2 | Combining imperfect, present and simple future · Holidays and accommodation · Ideal holiday · Holiday activities · Festivals · Reviewing and booking accommodation | All six drafted 12 September 2026 (Holidays in three tenses · Holidays and accommodation · My ideal holiday, with the conditional · Holiday activities · Festivals and traditions · Booking and reviewing accommodation). **French Autumn is complete.** |
| Spring | Environment: infographics, geography and climate, problems, the passive voice, collective and daily actions · New technologies · Understanding adverts | All six drafted 15 September 2026: The passive voice, Geography and climate, Environmental problems, Taking action for the environment, New technologies, Understanding adverts. The school's eight rows become six topics: infographics are taught inside the geography topic, and the daily and collective action rows are one topic because the French is the same. **French Spring is complete.** The French generator now shares the finish() the other subjects use; each script previously wrote its JSON **before** running its checks, so a topic that failed one was still left on disk. |
| Summer | Town or village · Directions · Shopping for clothes · Role plays · Ideal home · Visiting a town or city · Exam skills | |

**The exam-technique guide** was written on 11 September 2026, once the board was confirmed, from Pearson's own published sample papers, teacher guides and exam timetable. The specification PDF itself cannot be read here, and search summaries of Pearson's PDFs were seen to mix papers up — attaching Writing's 1 hour 20 minutes to Reading and Speaking — so the guide uses only figures that two sources agree on, or that cannot belong to another paper, such as the dictation in Listening. The Writing paper's exact question list is deliberately left out, because Pearson has amended that paper since it was published; the guide points to the current sample paper instead.

Authoring notes for French, which differs from the other subjects:
- Vocabulary is a `vocab-list` interactive: it speaks each word with the browser's French voice and keeps the English hidden until asked for.
- Conjugations use the `verb-table` diagram, which draws the stem and the ending apart because that split is the lesson.
- Accepted answers carry the accented spelling **first**, then an unaccented twin, so a UK keyboard does not block a correct answer while the feedback still shows the right spelling. Every solution states the accented form.

## Music (Edexcel 1MU0, confirmed 11 September 2026)

The school confirmed Edexcel on 11 September 2026, closing the PRD's last open decision and matching the eight set works already listed in `docs/curriculum/music.md`.

**The app covers Component 3 (Appraising) only.** Performing and Composing are 30% each and are coursework, recorded and marked by the school; there is nothing to revise there. Appraising is the written exam: 1 h 45, 80 marks, 40% of the GCSE, with Section A worth 68 marks (six set works plus a dictation) and Section B worth 12 (one comparison against an unfamiliar piece from the same area of study).

Units are Edexcel's four areas of study, plus musical elements first, because every set work is described through them.

| Half term | Set works | Status |
|---|---|---|
| Autumn 1 and 2 | Killer Queen (vocal music) · Star Wars main title (stage and screen) | Both drafted 11 September 2026. **Music Autumn is complete.** |
| Spring | Bach, Brandenburg Concerto No. 5 third movement (instrumental 1700–1820) · Afro Celt Sound System, Release (fusions) | Both drafted 14 September 2026, written from Pearson's set-work support guides |
| Summer | Esperanza Spalding, Samba Em Preludio (fusions) · Defying Gravity from Wicked (stage and screen) | |
| Year 11 | Beethoven, Pathétique first movement (instrumental 1700–1820) · Purcell, Music for a While (vocal music) | |

**Audio is deliberately not bundled.** The set works are copyrighted, so the app ships no recordings and no links that could rot; the student plays the named recording on whatever service the family uses.

**Timings are not printed.** They could not be checked against a recording, and recordings differ. Every set work gives its structure as an ordered table, and its your-turn step gives the student a blank map to fill in while listening — better revision anyway, because making the map is the listening. Killer Queen first carried timings written from memory; on 11 September 2026 the owner chose to replace them with the blank map. The `music-timeline` diagram stays available for timings someone has checked by ear.