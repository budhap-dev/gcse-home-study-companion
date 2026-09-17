**Product requirements · Draft 4**

# GCSE Home Study Companion

A web app where a student self-studies eight GCSE subjects to Higher tier and beyond, with step-by-step lessons, graded worksheets, exam technique, and recap quizzes, all pitched at a grade 9 target, while their parent, and optionally a tutor, follows progress from a linked account.

- Author: Drafted with Claude for Vipin
- Date: 2 September 2026
- Status: Draft for review

**Audience**Product owner, future dev team

## 1. Summary

Parents of GCSE students want to support revision at home without becoming the teacher. The app is interactive and works fully on phone, tablet, and desktop, so a student can complete a lesson on the bus and a worksheet on a tablet with a stylus. Existing tools are either exam-board revision sites aimed at the student alone, or school-facing platforms a family cannot buy. This product sits in the gap: a student works through a structured path from first principles to Higher-tier and extension-level worksheets, and the parent sees a truthful picture of what has been covered, what is secure, and where help is needed.

The product succeeds when a parent can answer three questions in under a minute: *What did my child work on this week? Which topics are weak? What should they do next?* And when a student can open the app and always be given a sensible next step without deciding it themselves.

### Goals

- Cover the full Higher-tier specification for eight subjects, with Maths extended to the Further Maths level.
- Pitch everything at grade 9. Lessons go to the depth a grade 9 answer needs, the top worksheet level is built from grade 9 discriminator questions, and progress reports "grade 9 ready" per topic rather than just "done".
- Every topic has the same four things: a stepped lesson, worksheets at three levels, an exam technique note, and a recap quiz with full answers and mark schemes.
- Progress is per topic and per skill, not just "lessons viewed", and is visible to both student and parent.
- A parent can link to one or more children and each child can have more than one parent. A tutor can be linked to a student with the parent's consent and sees the same progress.
- Lessons are colourful, visual, and example-led. Every step carries a diagram, image, or worked example, and a student who is 14 should want to come back tomorrow.

### Non-goals for the first release

- Live tutoring, chat, or marking by humans.
- Foundation-tier content. Higher tier is the target; Foundation may be added later as a subset.
- School or classroom accounts. Individual tutors are in scope; institutions are not.

## 2. Assumptions and open questions

These are working assumptions so the design can proceed. Each is tagged so it is easy to find and overturn.

| Area | Working assumption | Status |
|---|---|---|
| Exam boards | Confirmed: Maths Edexcel (1MA1), Further Maths AQA Level 2 (8365), Biology Edexcel (1BI0), Physics AQA (8463), Chemistry AQA (8462), Computer Science AQA (8525), Business Edexcel (1BS0), French Edexcel (1FR1, the specification first examined in 2026). Content is written to the named specification, in its topic order and using its command words, equation sheets, and pseudocode conventions. Music is still open and is drafted board-neutral with board notes until decided. | Confirmed (Music open) |
| "Advanced" and "Further" Maths | "Advanced" means the top end of GCSE Higher (grade 8 and 9 material). "Further" means AQA Level 2 Certificate in Further Mathematics, which is the common bridge to A-level and is taken alongside Edexcel GCSE Maths by many schools. | Assumed |
| Sciences | Separate sciences (Triple Award), Higher tier. Combined Science is a subset and can be derived later. | Assumed |
| Content authoring | Content is written by a small editorial team, with AI-assisted drafting and mandatory human review before publishing. The app needs an authoring workflow, not just a content dump. | Open |
| Pricing | Family subscription with a free trial. Pricing does not affect the first release beyond needing a paywall boundary. | Open |
| Target grade | Grade 9 in every subject. The Core worksheet level exists only to secure prerequisites quickly; the weight of content and questions sits at Higher and Advanced. Students can lower the target per subject, but the default is 9. | Confirmed |
| Age of students | Students are 14 to 16. Under UK GDPR a child under 13 cannot consent to data processing, so the parent creates the child's account and is the account owner in all cases. | Assumed |
| Platform | One responsive, installable web app used fully on phone, tablet, and desktop. Every activity, including worksheets, can be completed on-screen with touch; tablets get a scratch canvas for written working. Printing to A4 remains available for those who prefer paper. | Confirmed |
| Marking | Quizzes auto-mark. Worksheets are self-marked by the student against a worked solution, and the student records their own score. There is no free-text AI marking in release one. | Assumed |

## 3. Users, the family model, and tutors

#### Student

Year 10 or 11, revising at home in 30 to 60 minute sessions, often on a laptop with a phone nearby. Wants to be told what to do next and to see evidence of getting better.

- Needs a single "next step" on every screen.
- Wants instant answers and worked solutions, not just a score.
- Is discouraged by long lists of red.

#### Parent

Wants to help but may not know the subject. Checks in weekly, sometimes daily near exams. Does not want to nag from ignorance.

- Needs a weekly summary they can read in one minute.
- Wants to know which topics are weak and what a good next task would be.
- May have two or more children on the platform.

#### Tutor

A private tutor with a handful of GCSE students across different families. Sees each student for an hour a week and wants to know what they did in between, set work for the gap, and walk in already knowing the weak topics.

- Needs one dashboard across all their students.
- Wants to assign a specific worksheet or quiz for the week.
- Must not see children they have not been linked to.

#### Younger sibling in Year 9

Starting GCSE content early. Less self-directed, more responsive to points, badges, and visible progress. The engagement design in section 7 is written with this student in mind.

- Needs sessions that feel short and finished.
- Responds to colour, characters, and immediate feedback.

### The family relationship

Accounts belong to a **family**. A family has one or more parents and one or more students. A parent creates the family, adds a student profile, and the student signs in with their own credentials. A second parent joins through an invite code. Every relationship is explicit and visible to the student, so a child always knows who can see their progress.

- A parent can see all progress for every student in their family, but cannot answer quizzes or edit results on the student's behalf.
- A student sees their own progress only.
- A student can belong to one family. A parent can belong to one family. Separated households are handled by inviting the second parent, not by a second family.
- Removing a parent or student from a family revokes their access immediately but keeps the student's history intact.

### Tutors

A tutor has their own account type and is linked to individual students, not to families. The link is created by the parent, who sends the tutor an invite for a named child, so a tutor never sees a child without a parent's explicit consent. A tutor can be linked to many students across many families and sees them all on one dashboard.

- A tutor sees the linked student's topic map, attempts, and weekly summary, exactly as the parent does.
- A tutor can assign a task (a lesson, worksheet, or quiz) with a due date. It appears on the student's home screen, and the parent can see that it was assigned.
- A tutor cannot answer or edit attempts on the student's behalf, and cannot see the student's other tutors.
- Either the parent or the tutor can end the link at any time.

## 4. Subject scope

Eight subjects at Higher tier. The table gives the top-level structure the content will follow and the extra levels each subject needs. Paper structure is listed because exam technique and quizzes are organised around it.

**Two further subjects are in scope but deferred.** Added 17 September 2026, after the original eight were agreed:

| Subject | Board | Status |
|---|---|---|
| Further Maths | AQA Level 2 Certificate (8365), to confirm | Deferred. Already named in the board list above and covered as a level within Mathematics; needs its own subject and curriculum overview. |
| English | Open | Deferred. Whether this is English Language, English Literature or both is not yet decided, and no board is chosen. |

Both start only once the eight subjects above have their Years 9, 10 and 11 rows written. Before either is drafted, confirm the qualification and board, and fetch a school curriculum overview as was done for the other subjects.

| Subject | Board | Levels covered | Content spine | Subject-specific needs |
|---|---|---|---|---|
| Mathematics | Edexcel 1MA1 / AQA L2 Further | Higher, Advanced (grades 8 to 9), Further Maths (Level 2) | Number · Algebra · Ratio, proportion and rates of change · Geometry and measures · Probability · Statistics · Further: number and algebra, coordinate geometry, calculus, matrices, geometry and trigonometry | Three papers: Paper 1 non-calculator, Papers 2 and 3 calculator, 80 marks each. Rendered maths notation. Method and accuracy marks (M, A, B) in the Edexcel style. |
| Business | Edexcel 1BS0 | Untiered | Theme 1, Investigating small business: enterprise and entrepreneurship · spotting a business opportunity · putting a business idea into practice · making the business effective · external influences. Theme 2, Building a business: growing the business · making marketing decisions · making operational decisions · making financial decisions · making human resource decisions | Two papers, 90 marks each, one per theme. Case-study and data-response questions. Calculations: break-even, cash flow, profit margins, ARR. Six, nine and twelve-mark evaluate and justify questions marked by level. |
| Computer Science | AQA 8525 | Untiered | Fundamentals of algorithms · Programming · Data representation · Computer systems · Networks · Cyber security · Relational databases and SQL · Ethical, legal and environmental impacts | Two papers, 90 marks each: Paper 1 computational thinking and programming, Paper 2 written assessment. Code shown in AQA pseudocode, with Python and C# variants. Trace tables. Binary, hex, and two's complement. SQL questions. In-browser code runner (later phase). |
| Physics | AQA 8463 | Higher, Triple | Energy · Electricity · Particle model of matter · Atomic structure · Forces · Waves · Magnetism and electromagnetism · Space physics | Two papers, 100 marks each: Paper 1 topics 1 to 4, Paper 2 topics 5 to 8. AQA equation sheet and the equations to memorise. Ten required practicals. Units and significant figures in marking. |
| Chemistry | AQA 8462 | Higher, Triple | Atomic structure and the periodic table · Bonding, structure and properties · Quantitative chemistry · Chemical changes · Energy changes · Rate and extent of change · Organic chemistry · Chemical analysis · Chemistry of the atmosphere · Using resources | Two papers, 100 marks each: Paper 1 topics 1 to 5, Paper 2 topics 6 to 10. AQA periodic table. Mole and titration calculations. Eight required practicals. |
| Biology | Edexcel 1BI0 | Higher, Triple | Key concepts · Cells and control · Genetics · Natural selection and genetic modification · Health, disease and medicine · Plant structures · Animal coordination and homeostasis · Exchange and transport · Ecosystems and material cycles | Two papers, 100 marks each: Paper 1 topics 1 to 5, Paper 2 topics 1 and 6 to 9. Eight core practicals. Diagram labelling. Six-mark extended responses marked by level. |
| Music | Open | Untiered | Musical elements · Set works or areas of study · Listening and appraising · Composition · Performance | Audio excerpts for listening questions. Score extracts. Composition and performance are coursework, so the app covers the written listening paper only. |
| French | Edexcel 1FR1 | Higher tier | Thematic contexts: my personal world · lifestyle and wellbeing · my neighbourhood · media and technology · studying and my future · travel and tourism, across listening, speaking, reading, writing | Four papers, 25% each. Listening includes dictation; reading includes translation into English; writing includes translation into French. Vocabulary is drawn from the published Edexcel defined vocabulary list, so the app teaches that list. Audio for listening. Grammar reference. Speaking practice is guided self-recording only. |

**Scale**

At roughly 25 to 40 topics per subject, each with a lesson, three worksheets, an exam technique note, and a quiz of 10 to 20 questions, the full catalogue is in the region of 250 topics and 4,000 to 6,000 questions. Content production is the critical path of the whole project and should start before the app does.

## 5. Content model

Every subject follows the same tree so the app, the progress model, and the authoring tools can be built once.

```
Subject (Physics)
└─ Unit (Forces)
   └─ Topic (Newton's second law)         ← progress is tracked here
      ├─ Lesson                            ordered steps; each step has one idea,
      │   ├─ Step 1: Explain                     an example, and a check question
      │   ├─ Step 2: Worked example
      │   ├─ Step 3: Your turn (checked)
      │   └─ Step n: Summary
      ├─ Worksheet · Core                  prerequisites only; short, done once
      ├─ Worksheet · Higher                grade 6 to 8 exam-style questions
      ├─ Worksheet · Advanced              grade 9: multi-step, unfamiliar contexts,
      │                                          proof, explain and evaluate questions
      ├─ Exam technique                    command words, mark allocation, timing,
      │                                          examiner-reported errors, and what
      │                                          separates a grade 9 answer from a grade 7
      └─ Quiz                              10 to 20 auto-marked questions
```

### Questions

A question is the atomic unit and is shared between worksheets and quizzes. Every question carries:

- The question text, with rendered maths, images, audio, or code as required.
- The marks available and the type: multiple choice, numeric with tolerance, short text, ordering, labelling, or extended response.
- The answer, a full worked solution, and the mark scheme in the same style as the board (method marks, accuracy marks, quality of written communication where relevant).
- Tags: topic, grade band (4 to 5, 6 to 7, 8 to 9), skill (for example "rearranging formulae"), calculator or non-calculator, and exam board notes.
- At least 40% of every topic's question bank is tagged grade 8 to 9. Grade 9 questions are written to the discriminator patterns boards actually use: combining two or more topics in one question, unfamiliar contexts, "show that" and proof, and evaluation with a justified conclusion.

Extended response questions cannot be auto-marked. In a quiz they show the mark scheme and ask the student to self-assess against it. That self-assessed score is stored and flagged as self-marked so the parent view can tell the difference.

### Lessons

Lessons are example-led and visual. Every step opens with a concrete example, a diagram, an image, or a short animation before any definition, and the visual is the thing that carries the idea, not decoration beside the text. Each subject has its own colour and illustration style so that switching from Chemistry to French feels like changing rooms. Text per step is kept short enough that the diagram is what the student remembers.

Lessons teach to the depth a grade 9 answer needs, not the minimum to pass. Each lesson ends with a "grade 9 step": the extension idea, common trap, or link to another topic that examiners use to separate the top grade.

Lessons are steps, not pages. A step is short enough to fit on a phone screen without scrolling more than once, ends with a check question where the concept allows it, and is locked to a linear order the first time through. On revisits, all steps are open.

### Exam technique

Two layers. A subject-level guide covering paper structure, timing, command words, and how the assessment objectives are weighted. Then a short topic-level note covering the mistakes examiners actually report for that topic. Both are content, authored like anything else.

## 6. Progress model

Progress is measured per topic and is derived, not self-declared. A topic's status is calculated from the most recent evidence, so it can go down as well as up.

| Signal | What is recorded | Feeds |
|---|---|---|
| Lesson step completed | Step, timestamp, check-question result | Coverage |
| Quiz attempt | Every answer, marks, time taken, attempt number | Mastery, weak skills |
| Worksheet attempt | Level, self-recorded score out of total, timestamp | Mastery (weighted lower than quizzes) |
| Session | Start, end, subjects touched | Activity, streak, weekly summary |

#### Topic status

- Not secure: no attempt, or last quiz under 50%
- Developing: last quiz 50 to 79%, or lesson done with no quiz
- Secure: last quiz 80% or more and the Higher worksheet scored 70% or more
- Grade 9 ready: last quiz 90% or more, including the grade 8 to 9 questions, and the Advanced worksheet scored 75% or more

Because the target is grade 9, Secure is not the finish line. The app treats a Secure topic as unfinished and keeps recommending its Advanced worksheet until it is Grade 9 ready. Thresholds are configurable per subject. Grade 9 ready decays to Secure, and Secure to Developing, if a topic has not been revisited for six weeks, which is the mechanism that drives spaced recap.

#### What each user sees

- **Student:** a per-subject map of topics coloured by status, a count of topics Grade 9 ready out of the total, a "next up" recommendation, recent quiz results with the questions they got wrong, and their streak.
- **Parent:** a weekly summary per child (time, topics touched, quizzes taken, average score), a per-subject "distance from grade 9" line showing how many topics are Grade 9 ready, Secure, or below, the same topic map in read-only form, the weakest five topics per subject with a suggested task, and a trend over the last eight weeks.

## 7. Motivation and engagement

The app has to compete with a phone for a teenager's attention. Engagement is designed in from the start, but it is tied to real learning: rewards come from evidence of progress, never from time on screen.

| Mechanic | How it works | Why it is safe |
|---|---|---|
| Points | Earned per completed lesson step, quiz question, and worksheet question, weighted by grade band so a grade 9 question is worth more. | Points come only from attempts, so they track effort and difficulty, not time. |
| Levels per subject | Points accumulate into subject levels with a visible bar. Level names are drawn from the subject (Physics uses SI prefixes, French uses CEFR-style stages, Music uses dynamics). | Cosmetic, per subject, and never compared between siblings. |
| Badges | Awarded for finishing a unit, taking a topic to Grade 9 ready, a clean-sweep quiz, a first Advanced worksheet, and returning to a decayed topic. | Each badge names a learning event a parent would recognise. |
| Streaks and weekly goal | A study streak counts days with at least one completed activity. The student sets a weekly minutes goal with the parent; the home screen shows the ring filling. | Streaks freeze on days the student marks as off, so a holiday does not punish them. |
| Celebrations | A short animation and a shareable card when a topic goes Grade 9 ready or a unit is finished. The parent gets the same moment in their summary. | Reduced-motion setting turns animations into a static card. |
| Session shape | Every activity is sized to finish in 5 to 15 minutes and ends on a clear "done" screen with the next suggestion. | Short, finished sessions are what younger students need to come back. |
| Choice | The student can always choose between the recommended task and two alternatives, including a "quick quiz" option. | Autonomy is a stronger motivator than any reward. |

**Not included on purpose:** leaderboards across families, penalties for missed days, rewards for logging in without working, and any purchasable boosts. Comparison is available only within a family, and only if the parent turns it on.

## 8. Epics and user stories

Priorities use MoSCoW. Must is release one. Should is expected shortly after. Could is backlog. Story IDs are stable so they survive an export to Jira or Linear.

### Epic A · Accounts and family

#### FAM-1 · Parent creates a family (Must)

As a parent, I want to create an account and a family so that I can add my children.

*Acceptance criteria*

- Sign up with email and password, or Google or Apple sign-in.
- Creating the account creates a family with the parent as owner.
- Email is verified before any child profile can be created.

#### FAM-2 · Parent adds a student (Must)

As a parent, I want to add my child with their own login so that they can study independently.

*Acceptance criteria*

- Parent enters child's first name, year group, and a username. No child email is required.
- Parent sets an initial password; the child is prompted to change it on first sign-in.
- Parent selects the child's subjects and, where known, the exam board per subject.
- A family can hold up to five students.

#### FAM-3 · Second parent joins by invite (Should)

As a parent, I want to invite another parent or guardian so that they can also follow progress.

*Acceptance criteria*

- Owner generates an invite link that expires after seven days.
- Invited parent gets the same read access to every student in the family.
- Students can see the list of parents linked to them.

#### FAM-4 · Remove a family member (Should)

As the family owner, I want to remove a parent or student so that access reflects my household.

*Acceptance criteria*

- Removal takes effect immediately on the next request.
- Removed student's data is retained for 90 days and then deleted, with an email warning at 30 days.

#### FAM-5 · Student changes their own settings (Could)

As a student, I want to change my password and display name without asking my parent.

### Epic B · Learning path

#### LRN-1 · Browse a subject by unit and topic (Must)

As a student, I want to see every topic in a subject with its status so that I know what is covered and what is not.

*Acceptance criteria*

- Topics are grouped by unit in specification order.
- Each topic shows its status colour and which of lesson, worksheets, and quiz are done.
- Board-specific topics are shown or hidden according to the student's chosen board.

#### LRN-2 · Work through a stepped lesson (Must)

As a student, I want to go through a lesson one step at a time so that each idea is checked before the next.

*Acceptance criteria*

- Steps are shown one at a time with a progress indicator.
- A check question must be answered before continuing, but a wrong answer shows the explanation and still allows progress.
- Position is saved so the student can resume mid-lesson on another device.
- Maths notation, images, code, and audio render correctly on mobile.

#### LRN-3 · Always have a next step (Must)

As a student, I want the app to suggest what to do next so that I do not waste time choosing.

*Acceptance criteria*

- Home screen shows one recommended task with the reason (for example, "Quiz on Moles: last scored 55%").
- Recommendation prefers, in order: unfinished lesson, topic due for recap, weakest topic in the subject with the soonest exam, then a Secure topic to push to Grade 9 ready via its Advanced worksheet.
- Student can skip the suggestion and pick their own.

#### LRN-4 · Set exam dates (Should)

As a student or parent, I want to enter exam dates so that recommendations and the parent summary are time-aware.

#### LRN-5 · Read the subject exam technique guide (Must)

As a student, I want a guide to the papers, timing, and command words for each subject so that I know how the exam works before I practise for it. The guide includes a section on what a grade 9 answer looks like for each question type.

#### LRN-7 · Interactive lesson steps (Must)

As a student, I want lesson steps I can manipulate, such as dragging a graph, adjusting a variable, or building an equation, so that I understand the idea by doing it rather than reading it.

*Acceptance criteria*

- The authoring tool supports a set of interactive step types: slider-driven graph or diagram, drag-and-drop ordering and matching, equation entry with a maths keypad, labelling, and code trace.
- Every interactive step works with touch on a phone and tablet, and with mouse and keyboard.
- Every interactive step has a non-interactive fallback so screen readers and older devices still get the content.

#### LRN-6 · Target grade per subject (Must)

As a student or parent, I want a target grade per subject, defaulting to 9, so that the thresholds, recommendations, and parent summary are measured against it.

*Acceptance criteria*

- Default is 9 for every subject. It can be lowered per subject to 7 or 8; the parent is notified if the student lowers it.
- The Grade 9 ready status and its thresholds are relabelled and rescaled if a lower target is set.
- Changing the target does not alter stored attempts.

### Epic C · Worksheets

#### WKS-1 · Open a worksheet at a chosen level (Must)

As a student, I want to choose Core, Higher, or Advanced for a topic so that I practise at the right difficulty.

*Acceptance criteria*

- Each level shows the number of questions, total marks, and suggested time.
- Advanced is available regardless of status; the app recommends but never blocks.
- Once a topic is Secure, the Advanced worksheet is the default level opened for it.

#### WKS-2 · Print a worksheet and its answers (Should)

As a student, I want to print the worksheet on A4 with the answers on a separate sheet so that I can work on paper when I prefer to.

*Acceptance criteria*

- Print layout has working space under each question proportional to its marks.
- Answers and mark scheme print as a separate document.
- Maths notation and diagrams print at full resolution.

#### WKS-3 · Self-mark and record a score (Must)

As a student, I want to reveal the worked solution per question and record my marks so that my worksheet work counts towards progress.

*Acceptance criteria*

- Solutions are hidden until the student reveals them, one question at a time.
- Questions with a typed final answer are auto-marked; for extended responses the student enters marks per question, capped at the marks available.
- Self-marked scores are stored and shown as such to the parent, separately from auto-marked ones.

#### WKS-7 · Work a worksheet on-screen with a scratch canvas (Must)

As a student on a tablet, I want to write my working with a stylus or finger next to each question and enter my final answer on-screen so that I do not need paper.

*Acceptance criteria*

- Each question has a resizable canvas for handwritten working that is saved with the attempt.
- Final answers are typed or picked using the same input types as quizzes, so numeric and multiple-choice worksheet questions can be auto-marked; only extended responses are self-marked.
- The student can flip between worksheet, canvas, and worked solution without losing their work.
- On a phone, the canvas is available but the layout stacks vertically; on desktop, the canvas sits beside the question.

#### WKS-4 · Mixed-topic worksheet (Should)

As a student, I want a worksheet built from several topics in a unit so that I practise choosing the method, not just applying it.

#### WKS-6 · Grade 9 problem set per unit (Should)

As a student, I want a set built only from grade 8 to 9 questions across a whole unit so that I rehearse the hardest questions the way they appear on the paper, mixed and unsignposted.

*Acceptance criteria*

- Draws only questions tagged grade 8 to 9 and prefers those that span two or more topics.
- Unlocked as a recommendation once every topic in the unit is at least Secure, but never blocked.
- Results feed the Grade 9 ready status of each topic involved.

#### WKS-5 · Timed paper mode (Could)

As a student, I want a full-length paper assembled from the question bank with a timer so that I can rehearse exam conditions.

### Epic D · Quizzes

#### QZ-1 · Take an auto-marked topic quiz (Must)

As a student, I want to take a quiz on a topic and get marked instantly so that I know if I have understood it.

*Acceptance criteria*

- Question types: multiple choice, numeric with tolerance and units, short text with accepted variants, ordering, labelling.
- Each question is marked on submit with the correct answer and a worked solution.
- A summary shows score, time, and the questions missed, each linking back to the relevant lesson step.
- Every attempt is stored; retaking draws a different sample from the bank where the bank is large enough.

#### QZ-2 · Self-assess an extended response (Must)

As a student, I want to write a six-mark answer and mark it against the scheme so that longer questions still count.

*Acceptance criteria*

- Text area with a suggested time.
- On submit, the mark scheme and a model answer are shown and the student selects a mark per criterion.
- The result is stored as self-marked.

#### QZ-3 · Spaced recap quiz (Should)

As a student, I want a short daily recap drawn from topics I have not seen recently so that secure topics stay secure.

*Acceptance criteria*

- Five to ten questions across subjects, prioritised by time since last attempt and lowest last score.
- Available from the home screen in one tap.

#### QZ-4 · Wrong-answer bank (Should)

As a student, I want to retry everything I have got wrong in the last month so that I close gaps deliberately.

### Epic E · Student progress

#### PRG-1 · Topic map with status (Must)

As a student, I want to see my subjects as a map of coloured topics so that I can see gaps at a glance.

*Acceptance criteria*

- Status is computed by the rules in section 6 and updated on every attempt.
- Tapping a topic shows the evidence behind its status.

#### PRG-2 · Recent activity and streak (Should)

As a student, I want to see what I did this week and my study streak so that I feel momentum.

### Epic F · Parent progress

#### PAR-1 · Weekly summary per child (Must)

As a parent, I want a one-screen weekly summary for each child so that I can check in without digging.

*Acceptance criteria*

- Shows minutes studied, topics touched, quizzes taken and average score, all compared to the previous week.
- Shows per subject how many topics are Grade 9 ready, Secure, and below, and the change since last week.
- Lists the five weakest topics across subjects with a suggested next task for each.
- Distinguishes auto-marked from self-marked scores.

#### PAR-2 · Read-only view of the child's topic map (Must)

As a parent, I want to see the same topic map my child sees so that we are looking at the same picture when we talk.

#### PAR-3 · Weekly email digest (Should)

As a parent, I want the weekly summary emailed to me so that I see it without logging in.

*Acceptance criteria*

- Sent on a day the parent chooses.
- One email covers all children.
- Can be turned off.

#### PAR-4 · Suggest a task to my child (Should)

As a parent, I want to assign a task that appears on my child's home screen so that I can nudge without nagging. Shares the mechanism in TUT-3.

#### PAR-5 · Eight-week trend (Should)

As a parent, I want to see time and average score over the last eight weeks per subject so that I can see whether things are improving.

### Epic G · Tutors

#### TUT-1 · Parent links a tutor to a child (Should)

As a parent, I want to invite my child's tutor to see their progress so that lessons build on what was done at home.

*Acceptance criteria*

- Parent sends an invite for one named child; the tutor accepts with a tutor account.
- The child sees the tutor listed alongside their parents.
- Parent or tutor can end the link; access ends immediately.

#### TUT-2 · Tutor dashboard across students (Should)

As a tutor, I want one screen showing every linked student with their weakest topics and last activity so that I can prepare a session in a minute.

*Acceptance criteria*

- Lists students with subject, days since last activity, weekly minutes, and the three weakest topics.
- Opens into the same read-only topic map and attempt history the parent sees.

#### TUT-3 · Assign a task with a due date (Should)

As a tutor or parent, I want to assign a lesson, worksheet, or quiz with a due date so that the student knows exactly what to do before we next meet.

*Acceptance criteria*

- Assigned tasks show at the top of the student's home screen with who set them and when they are due.
- The assigner sees done, overdue, or not started, and the score once done.
- Parents can see tasks set by tutors; tutors cannot see tasks set by other tutors.

#### TUT-4 · Tutor notes on a student (Could)

As a tutor, I want to keep private notes per student so that my session prep lives with their progress.

### Epic H · Motivation

#### MOT-1 · Points and subject levels (Must)

As a student, I want to earn points for every question and step I complete and see my level rise in each subject so that effort is visible immediately.

*Acceptance criteria*

- Points are awarded on completion of a step or question, weighted by grade band.
- Each subject has a level bar with subject-themed level names.
- Points are never deducted.

#### MOT-2 · Badges for learning events (Should)

As a student, I want badges for finishing units, reaching Grade 9 ready, and clean-sweep quizzes so that milestones feel like achievements.

*Acceptance criteria*

- Badge set defined per subject with artwork in that subject's style.
- Badges appear on the student's profile and in the parent's weekly summary.

#### MOT-3 · Weekly goal ring (Must)

As a student, I want to set a weekly study goal and watch a ring fill so that I can see how close I am.

*Acceptance criteria*

- Goal is minutes per week, set by the student and visible to the parent.
- Ring is on the home screen and updates live.
- Days marked as off do not break the streak.

#### MOT-4 · Celebrate a milestone (Should)

As a student, I want a celebration when a topic becomes Grade 9 ready or a unit is finished so that the big moments feel big.

*Acceptance criteria*

- Short animation with a card the student can save or share to the family.
- Respects reduced-motion settings.

#### MOT-5 · Choose from three tasks (Must)

As a student, I want to pick from the recommended task and two alternatives so that I have a say in what I do next.

### Epic I · Content authoring and admin

#### ADM-1 · Author a topic with all five parts (Must)

As an editor, I want to create a topic with its lesson steps, three worksheets, exam technique note, and quiz in one place so that no topic ships incomplete.

*Acceptance criteria*

- Topic cannot be published until all five parts exist and every question has an answer, solution, and marks.
- Topic cannot be published unless the lesson has a grade 9 step and at least 40% of its questions are tagged grade 8 to 9.
- Every lesson step must contain at least one visual element: diagram, image, animation, interactive, or worked example block. The editor warns on any text-only step.
- Supports maths (LaTeX), images, audio, and code blocks.
- Content is versioned; publishing a new version does not alter stored attempts.

#### ADM-2 · Question bank with tags (Must)

As an editor, I want a searchable question bank so that questions can be reused across worksheets, quizzes, and recap.

#### ADM-3 · Review before publish (Should)

As an editor, I want a second person to approve content before it goes live so that errors do not reach students.

#### ADM-4 · Report a mistake in content (Should)

As a student or parent, I want to flag a question or answer I think is wrong so that it gets fixed.

*Acceptance criteria*

- One tap from any question, with an optional comment.
- Reports queue for an editor with a link to the exact content version.

#### ADM-5 · Bulk import questions (Should)

As an editor, I want to import questions from a spreadsheet or JSON so that drafted content can be loaded in batches.

## 9. Non-functional requirements
- **Child data.** The parent is the data controller's contact for every student. No child email, no third-party tracking on student screens, no advertising. Data export and deletion available to the family owner.
- **Accessibility.** WCAG 2.2 AA. Keyboard operable throughout, screen-reader labels on maths notation, captions or transcripts for every audio clip, dyslexia-friendly font toggle.
- **Devices.** Full functionality on a 360px phone through to desktop, with tablet as the primary device for worksheets. Touch targets at least 44px, no hover-only interactions, and layouts that work in both portrait and landscape. Installable as a progressive web app with lessons and quizzes cached for offline use once opened.
- **Visual design.** Colourful and illustrated, with a distinct palette and illustration style per subject, but legible: body text meets contrast requirements on every coloured surface, and colour is never the only carrier of meaning. Diagrams are authored as vector images so they scale to any screen and print cleanly.
- **Interactivity.** Lessons and questions are worked, not read. Drag-and-drop, sliders, graph plotting, equation entry, diagram labelling, and audio controls all work with touch, mouse, and keyboard.
- **Performance.** Lesson steps and quiz questions load in under one second on a mid-range phone on 4G. Maths rendering happens client-side and is cached.
- **Reliability.** A quiz in progress survives a page refresh or a dropped connection. Answers are saved per question, not per quiz.
- **Content integrity.** Every stored attempt references the exact content version it was taken against.

## 10. Delivery phases

Content is the critical path, so the phases are cut by subject coverage, not by feature. Features are complete for the subjects that exist in each phase.

#### Phase 1: Foundation

**Two subjects, all Must stories.** Maths (Higher and Advanced) and Physics. Family accounts, visual stepped lessons, three-level worksheets with on-screen working, auto-marked quizzes, topic map, parent weekly summary, points, levels, and the weekly goal ring.

Exit test: a real family uses it for four weeks, the parent can answer the three questions in section 1 unaided, and the parent can say how many topics per subject are Grade 9 ready.

#### Phase 2: Sciences and Further Maths

Chemistry, Biology, Further Maths. Should stories: second parent, tutor accounts and assigned tasks, spaced recap, wrong-answer bank, badges and celebrations, email digest, trend view, editor review flow.

#### Phase 3: Humanities and languages

Business and Computer Science, then Music and French. These need audio, code, and case-study question types, so they are last on purpose.

#### Phase 4: Depth

Could stories: timed papers, parent-pinned tasks, in-browser code runner, Foundation tier as a subset.

## 11. Out of scope
- Human or AI marking of free-text answers.
- Messaging between parent and child inside the app.
- School, tutor, or classroom accounts and any teacher-facing reporting.
- Coursework components: Music composition and performance, French speaking assessment, Computer Science programming project.
- Native mobile apps. The installable web app is the mobile and tablet experience for release one. Native apps are considered only if a capability the web cannot deliver becomes essential.

## 12. Technical approach

Decided 2 September 2026. The stack is chosen to run on free tiers until the app has paying families, with no rewrite needed when it moves to paid plans.

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React with TypeScript, built with Vite as a single-page progressive web app | React Router for navigation, TanStack Query for data fetching and caching, Tailwind for styling with a per-subject theme, KaTeX for maths rendering, Zod for validating content and form data. |
| Hosting | Cloudflare Pages | Free tier with no bandwidth cap and commercial use allowed. Preview deployment per pull request. |
| Database, auth, access control | Supabase (Postgres) in the London region | Row-level security enforces the family and tutor model in the database. Child accounts use a generated internal email address and a username login. Free tier: 500 MB database, paused after seven days idle, so a daily ping is scheduled. |
| Media | Cloudflare R2 | Diagrams, images, and audio. 10 GB free with no egress charges. Referenced by URL from content records. |
| Server-side logic | Postgres functions and Supabase Edge Functions; Cloudflare Pages Functions where a request needs a secret | Progress status calculation lives in the database so every client sees the same rules. Email sending and any signed R2 uploads go through a function, never the browser. |
| Email | Resend | Weekly parent digest, invites, password resets. 3,000 emails a month free. |
| Scheduled jobs | GitHub Actions cron | Six-week status decay, weekly digest trigger, daily Supabase keep-alive ping, weekly database dump to R2 as the backup. |
| Repository | One repository, pnpm workspaces | Packages: web app, authoring tool, shared types and content schema, database migrations. One CI pipeline with type check, unit tests (Vitest), and end-to-end tests (Playwright) on the critical flows: sign in, lesson step, quiz attempt, parent summary. |
| Content | Lives in Postgres, authored through the admin tool | Content is not stored in git. A small sample content pack is kept in the repository for local development and tests. |

**First paid upgrade when needed:** Supabase Pro at 25 dollars a month, which removes pausing, adds daily backups, and raises the database limit to 8 GB. Nothing else in the stack needs to change.

## 13. Decisions needed

Each of these changes the plan materially. They are listed in the order they block work.

1. **Content authoring.** Who writes the content, and what is the review process? This sets the timeline for every phase and decides how much of Epic I is needed early.
2. **Music exam board.** The only board still to confirm. It matters because the set works and areas of study differ completely between AQA, Edexcel, OCR, and Eduqas.
3. **Grade 9 question sourcing.** Grade 9 discriminator questions are the hardest content to write well. Decide whether to write them from scratch, adapt from past-paper patterns, or commission subject specialists. This mostly affects Maths and the sciences.
4. **"Further" Maths definition.** Confirm AQA Level 2 Further Maths as the target, or specify another qualification.
5. **Illustration and diagrams.** Visual lessons need an illustrator or an illustration system alongside the subject writers. Decide whether diagrams are commissioned, built from a shared component library, or generated and reviewed.
6. **Pricing and trial.** Tutors add a second pricing question: whether tutor accounts are free when linked by a paying family. Only needed to place the paywall boundary before Phase 1 launches.
7. **First family.** Is the first user your own family? If so, Phase 1 subjects should be the ones your children are studying now.