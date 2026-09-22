# GCSE Home Study Companion · User stories

Source: PRD Draft 3, 2 September 2026. Priorities use MoSCoW (Must = release one, Should = soon after, Could = backlog). IDs are stable for import into Jira or Linear.
Total: 46 stories · Must 22 · Should 21 · Could 3


## Epic A · Accounts and family

### FAM-1 · Parent creates a family

**Priority:** Must

As a parent, I want to create an account and a family so that I can add my children.

**Acceptance criteria**

- Sign up with email and password, or Google or Apple sign-in.
- Creating the account creates a family with the parent as owner.
- Email is verified before any child profile can be created.

### FAM-2 · Parent adds a student

**Priority:** Must

As a parent, I want to add my child with their own login so that they can study independently.

**Acceptance criteria**

- Parent enters child's first name, year group, and a username. No child email is required.
- Parent sets an initial password; the child is prompted to change it on first sign-in.
- Parent selects the child's subjects and, where known, the exam board per subject.
- A family can hold up to five students.

### FAM-3 · Second parent joins by invite

**Priority:** Should

As a parent, I want to invite another parent or guardian so that they can also follow progress.

**Acceptance criteria**

- Owner generates an invite link that expires after seven days.
- Invited parent gets the same read access to every student in the family.
- Students can see the list of parents linked to them.

### FAM-4 · Remove a family member

**Priority:** Should

As the family owner, I want to remove a parent or student so that access reflects my household.

**Acceptance criteria**

- Removal takes effect immediately on the next request.
- Removed student's data is retained for 90 days and then deleted, with an email warning at 30 days.

### FAM-5 · Student changes their own settings

**Priority:** Could

As a student, I want to change my password and display name without asking my parent.

## Epic B · Learning path

### LRN-1 · Browse a subject by unit and topic

**Priority:** Must

As a student, I want to see every topic in a subject with its status so that I know what is covered and what is not.

**Acceptance criteria**

- Topics are grouped by unit in specification order.
- Each topic shows its status colour and which of lesson, worksheets, and quiz are done.
- Board-specific topics are shown or hidden according to the student's chosen board.

### LRN-2 · Work through a stepped lesson

**Priority:** Must

As a student, I want to go through a lesson one step at a time so that each idea is checked before the next.

**Acceptance criteria**

- Steps are shown one at a time with a progress indicator.
- A check question must be answered before continuing, but a wrong answer shows the explanation and still allows progress.
- Position is saved so the student can resume mid-lesson on another device.
- Maths notation, images, code, and audio render correctly on mobile.

### LRN-3 · Always have a next step

**Priority:** Must

As a student, I want the app to suggest what to do next so that I do not waste time choosing.

**Acceptance criteria**

- Home screen shows one recommended task with the reason (for example, "Quiz on Moles: last scored 55%").
- Recommendation prefers, in order: unfinished lesson, topic due for recap, weakest topic in the subject with the soonest exam, then a Secure topic to push to Grade 9 ready via its Advanced worksheet.
- Student can skip the suggestion and pick their own.

### LRN-4 · Set exam dates

**Priority:** Should

As a student or parent, I want to enter exam dates so that recommendations and the parent summary are time-aware.

### LRN-5 · Read the subject exam technique guide

**Priority:** Must

As a student, I want a guide to the papers, timing, and command words for each subject so that I know how the exam works before I practise for it. The guide includes a section on what a grade 9 answer looks like for each question type.

### LRN-7 · Interactive lesson steps

**Priority:** Must

As a student, I want lesson steps I can manipulate, such as dragging a graph, adjusting a variable, or building an equation, so that I understand the idea by doing it rather than reading it.

**Acceptance criteria**

- The authoring tool supports a set of interactive step types: slider-driven graph or diagram, drag-and-drop ordering and matching, equation entry with a maths keypad, labelling, and code trace.
- Every interactive step works with touch on a phone and tablet, and with mouse and keyboard.
- Every interactive step has a non-interactive fallback so screen readers and older devices still get the content.

### LRN-6 · Target grade per subject

**Priority:** Must

As a student or parent, I want a target grade per subject, defaulting to 9, so that the thresholds, recommendations, and parent summary are measured against it.

**Acceptance criteria**

- Default is 9 for every subject. It can be lowered per subject to 7 or 8; the parent is notified if the student lowers it.
- The Grade 9 ready status and its thresholds are relabelled and rescaled if a lower target is set.
- Changing the target does not alter stored attempts.

### LRN-8 · Read a topic's cheat sheet

**Priority:** Should

As a student, I want one page per topic with the memory hooks, the formulae, the key points, the tactics and the examiner traps, so that I can revise a topic in a few minutes the night before a test without walking the whole lesson again.

**Acceptance criteria**

- The sheet is built from what the topic already holds (its `remember` tips, its equation cards, its summary step, its other tips and its exam technique note), so it needs no separate authoring and cannot drift from the lesson.
- The memory hooks come first; every section is omitted when it is empty, and every topic in the pack has a non-empty sheet.
- It prints on A4 with the app's chrome and colour stripped, and no card is split across a page.
- It is reached from a tile on the topic page beside Flashcards, and links on to the flashcards and the quiz.

## Epic C · Worksheets

### WKS-1 · Open a worksheet at a chosen level

**Priority:** Must

As a student, I want to choose Core, Higher, or Advanced for a topic so that I practise at the right difficulty.

**Acceptance criteria**

- Each level shows the number of questions, total marks, and suggested time.
- Advanced is available regardless of status; the app recommends but never blocks.
- Once a topic is Secure, the Advanced worksheet is the default level opened for it.

### WKS-2 · Print a worksheet and its answers

**Priority:** Should

As a student, I want to print the worksheet on A4 with the answers on a separate sheet so that I can work on paper when I prefer to.

**Acceptance criteria**

- Print layout has working space under each question proportional to its marks.
- Answers and mark scheme print as a separate document.
- Maths notation and diagrams print at full resolution.

### WKS-3 · Self-mark and record a score

**Priority:** Must

As a student, I want to reveal the worked solution per question and record my marks so that my worksheet work counts towards progress.

**Acceptance criteria**

- Solutions are hidden until the student reveals them, one question at a time.
- Questions with a typed final answer are auto-marked; for extended responses the student enters marks per question, capped at the marks available.
- Self-marked scores are stored and shown as such to the parent, separately from auto-marked ones.

### WKS-7 · Work a worksheet on-screen with a scratch canvas

**Priority:** Must

As a student on a tablet, I want to write my working with a stylus or finger next to each question and enter my final answer on-screen so that I do not need paper.

**Acceptance criteria**

- Each question has a resizable canvas for handwritten working that is saved with the attempt.
- Final answers are typed or picked using the same input types as quizzes, so numeric and multiple-choice worksheet questions can be auto-marked; only extended responses are self-marked.
- The student can flip between worksheet, canvas, and worked solution without losing their work.
- On a phone, the canvas is available but the layout stacks vertically; on desktop, the canvas sits beside the question.

### WKS-4 · Mixed-topic worksheet

**Priority:** Should

As a student, I want a worksheet built from several topics in a unit so that I practise choosing the method, not just applying it.

### WKS-6 · Grade 9 problem set per unit

**Priority:** Should

As a student, I want a set built only from grade 8 to 9 questions across a whole unit so that I rehearse the hardest questions the way they appear on the paper, mixed and unsignposted.

**Acceptance criteria**

- Draws only questions tagged grade 8 to 9 and prefers those that span two or more topics.
- Unlocked as a recommendation once every topic in the unit is at least Secure, but never blocked.
- Results feed the Grade 9 ready status of each topic involved.

### WKS-5 · Timed paper mode

**Priority:** Could

As a student, I want a full-length paper assembled from the question bank with a timer so that I can rehearse exam conditions.

## Epic D · Quizzes

### QZ-1 · Take an auto-marked topic quiz

**Priority:** Must

As a student, I want to take a quiz on a topic and get marked instantly so that I know if I have understood it.

**Acceptance criteria**

- Question types: multiple choice, numeric with tolerance and units, short text with accepted variants, ordering, labelling.
- Each question is marked on submit with the correct answer and a worked solution.
- A summary shows score, time, and the questions missed, each linking back to the relevant lesson step.
- Every attempt is stored; retaking draws a different sample from the bank where the bank is large enough.

### QZ-2 · Self-assess an extended response

**Priority:** Must

As a student, I want to write a six-mark answer and mark it against the scheme so that longer questions still count.

**Acceptance criteria**

- Text area with a suggested time.
- On submit, the mark scheme and a model answer are shown and the student selects a mark per criterion.
- The result is stored as self-marked.

### QZ-3 · Spaced recap quiz

**Priority:** Should

As a student, I want a short daily recap drawn from topics I have not seen recently so that secure topics stay secure.

**Acceptance criteria**

- Five to ten questions across subjects, prioritised by time since last attempt and lowest last score.
- Available from the home screen in one tap.

### QZ-4 · Wrong-answer bank

**Priority:** Should

As a student, I want to retry everything I have got wrong in the last month so that I close gaps deliberately.

## Epic E · Student progress

### PRG-1 · Topic map with status

**Priority:** Must

As a student, I want to see my subjects as a map of coloured topics so that I can see gaps at a glance.

**Acceptance criteria**

- Status is computed by the rules in section 6 and updated on every attempt.
- Tapping a topic shows the evidence behind its status.

### PRG-2 · Recent activity and streak

**Priority:** Should

As a student, I want to see what I did this week and my study streak so that I feel momentum.

## Epic F · Parent progress

### PAR-1 · Weekly summary per child

**Priority:** Must

As a parent, I want a one-screen weekly summary for each child so that I can check in without digging.

**Acceptance criteria**

- Shows minutes studied, topics touched, quizzes taken and average score, all compared to the previous week.
- Shows per subject how many topics are Grade 9 ready, Secure, and below, and the change since last week.
- Lists the five weakest topics across subjects with a suggested next task for each.
- Distinguishes auto-marked from self-marked scores.

### PAR-2 · Read-only view of the child's topic map

**Priority:** Must

As a parent, I want to see the same topic map my child sees so that we are looking at the same picture when we talk.

### PAR-3 · Weekly email digest

**Priority:** Should

As a parent, I want the weekly summary emailed to me so that I see it without logging in.

**Acceptance criteria**

- Sent on a day the parent chooses.
- One email covers all children.
- Can be turned off.

### PAR-4 · Suggest a task to my child

**Priority:** Should

As a parent, I want to assign a task that appears on my child's home screen so that I can nudge without nagging. Shares the mechanism in TUT-3.

### PAR-5 · Eight-week trend

**Priority:** Should

As a parent, I want to see time and average score over the last eight weeks per subject so that I can see whether things are improving.

## Epic G · Tutors

### TUT-1 · Parent links a tutor to a child

**Priority:** Should

As a parent, I want to invite my child's tutor to see their progress so that lessons build on what was done at home.

**Acceptance criteria**

- Parent sends an invite for one named child; the tutor accepts with a tutor account.
- The child sees the tutor listed alongside their parents.
- Parent or tutor can end the link; access ends immediately.

### TUT-2 · Tutor dashboard across students

**Priority:** Should

As a tutor, I want one screen showing every linked student with their weakest topics and last activity so that I can prepare a session in a minute.

**Acceptance criteria**

- Lists students with subject, days since last activity, weekly minutes, and the three weakest topics.
- Opens into the same read-only topic map and attempt history the parent sees.

### TUT-3 · Assign a task with a due date

**Priority:** Should

As a tutor or parent, I want to assign a lesson, worksheet, or quiz with a due date so that the student knows exactly what to do before we next meet.

**Acceptance criteria**

- Assigned tasks show at the top of the student's home screen with who set them and when they are due.
- The assigner sees done, overdue, or not started, and the score once done.
- Parents can see tasks set by tutors; tutors cannot see tasks set by other tutors.

### TUT-4 · Tutor notes on a student

**Priority:** Could

As a tutor, I want to keep private notes per student so that my session prep lives with their progress.

## Epic H · Motivation

### MOT-1 · Points and subject levels

**Priority:** Must

As a student, I want to earn points for every question and step I complete and see my level rise in each subject so that effort is visible immediately.

**Acceptance criteria**

- Points are awarded on completion of a step or question, weighted by grade band.
- Each subject has a level bar with subject-themed level names.
- Points are never deducted.

### MOT-2 · Badges for learning events

**Priority:** Should

As a student, I want badges for finishing units, reaching Grade 9 ready, and clean-sweep quizzes so that milestones feel like achievements.

**Acceptance criteria**

- Badge set defined per subject with artwork in that subject's style.
- Badges appear on the student's profile and in the parent's weekly summary.

### MOT-3 · Weekly goal ring

**Priority:** Must

As a student, I want to set a weekly study goal and watch a ring fill so that I can see how close I am.

**Acceptance criteria**

- Goal is minutes per week, set by the student and visible to the parent.
- Ring is on the home screen and updates live.
- Days marked as off do not break the streak.

### MOT-4 · Celebrate a milestone

**Priority:** Should

As a student, I want a celebration when a topic becomes Grade 9 ready or a unit is finished so that the big moments feel big.

**Acceptance criteria**

- Short animation with a card the student can save or share to the family.
- Respects reduced-motion settings.

### MOT-5 · Choose from three tasks

**Priority:** Must

As a student, I want to pick from the recommended task and two alternatives so that I have a say in what I do next.

## Epic I · Content authoring and admin

### ADM-1 · Author a topic with all five parts

**Priority:** Must

As an editor, I want to create a topic with its lesson steps, three worksheets, exam technique note, and quiz in one place so that no topic ships incomplete.

**Acceptance criteria**

- Topic cannot be published until all five parts exist and every question has an answer, solution, and marks.
- Topic cannot be published unless the lesson has a grade 9 step and at least 40% of its questions are tagged grade 8 to 9.
- Every lesson step must contain at least one visual element: diagram, image, animation, interactive, or worked example block. The editor warns on any text-only step.
- Supports maths (LaTeX), images, audio, and code blocks.
- Content is versioned; publishing a new version does not alter stored attempts.

### ADM-2 · Question bank with tags

**Priority:** Must

As an editor, I want a searchable question bank so that questions can be reused across worksheets, quizzes, and recap.

### ADM-3 · Review before publish

**Priority:** Should

As an editor, I want a second person to approve content before it goes live so that errors do not reach students.

### ADM-4 · Report a mistake in content

**Priority:** Should

As a student or parent, I want to flag a question or answer I think is wrong so that it gets fixed.

**Acceptance criteria**

- One tap from any question, with an optional comment.
- Reports queue for an editor with a link to the exact content version.

### ADM-5 · Bulk import questions

**Priority:** Should

As an editor, I want to import questions from a spreadsheet or JSON so that drafted content can be loaded in batches.

### ADM-6 · Draft a topic with AI

**Priority:** Must

As an editor, I want to give a topic title, specification points, and grade band and have the tool draft all five parts so that I spend my time reviewing and correcting rather than writing from blank.

**Acceptance criteria**

- Input is the subject, unit, topic title, the specification points it covers, and any notes on emphasis or common misconceptions.
- Output is a complete draft topic that passes the schema: lesson steps with a visual on every step and a grade 9 step, three worksheets, an exam technique note, and a quiz, with every question carrying an answer, worked solution, marks, and tags.
- The draft is saved as an unpublished version marked as AI-drafted, with the model and prompt version recorded. It can never be published without a human marking it reviewed.
- The editor can regenerate any single part or question without losing edits to the others.
- Drafting streams progress so the editor sees parts arriving rather than waiting on a blank screen.

### ADM-7 · Generate questions into the bank

**Priority:** Should

As an editor, I want to ask for a batch of questions for a topic, skill, and grade band so that the bank grows where it is thin.

**Acceptance criteria**

- Input is topic, skill tag, grade band, question type, count, and optionally an example question to match in style.
- Generated questions land in the bank as unreviewed and are excluded from worksheets, quizzes, and recap until reviewed.
- Grade 8 to 9 requests must use at least one discriminator pattern: combining topics, unfamiliar context, show that or proof, or evaluation with a justified conclusion.
- Batches can run through the Batch API overnight for whole units.
