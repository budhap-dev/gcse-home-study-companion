# GCSE Home Study Companion · Improvement stories

Source: the improvement scope review of 27 September 2026, written after development closed
with content and testing complete ([backlog](backlog.md)). None of this is scheduled; it is the
list to choose from if development reopens.

**Effort** is a rough size for one developer working with Claude: **S** 2 to 4 days, **M** 1 to
2 weeks, **L** 3 to 5 weeks. **Priority** follows the impact against effort review: **Now**
(quick wins), **Next** (big bets and their groundwork), **Later** (fill-ins and low-impact
work). Where a story finishes one in [stories.md](stories.md), it says which. IDs are new and
stable; none reuses an existing prefix.

Summary: see [the table at the end](#summary).


## Epic 1 · Topics

### TOP-1 · Prerequisite map

**Effort:** M · **Priority:** Next

As a student, I want each topic to say what it builds on so that I know what to revise when a
topic goes badly.

**Acceptance criteria**

- Every topic lists zero or more prerequisite topics, in any subject.
- A quiz under 50% suggests the weakest prerequisite as well as a retry.
- A test fails if a prerequisite names a topic that does not exist, or the links form a loop.

### TOP-2 · Progress on the topic map

**Effort:** S · **Priority:** Now · **Finishes:** LRN-1 · **Status:** done (27 September 2026)

As a student, I want each topic-map row to show which parts I have done so that I can see what
is left at a glance.

**Acceptance criteria**

- Each row shows lesson, Core, Higher, Advanced and quiz as done or not done.
- The row still fits a 390-pixel screen without scrolling sideways.

### TOP-3 · Unit tests

**Effort:** M · **Priority:** Next

As a student, I want an end-of-unit test that mixes every topic in the unit so that I practise
the way the exam asks.

**Acceptance criteria**

- A unit test draws two to four questions from each topic in the unit.
- It is auto-marked like a quiz and each topic's result feeds that topic's status.

### TOP-4 · Specification coverage view

**Effort:** S · **Priority:** Later

As a parent, I want to see every specification point and the topic that teaches it so that I
can trust nothing is missing.

**Acceptance criteria**

- One page per subject lists every specification point with links to the topics that teach it.
- A point taught nowhere is shown as a gap, and a test fails on any gap.

### TOP-5 · French listening audio

**Effort:** M · **Priority:** Later

As a student, I want to hear French listening passages so that I can practise a quarter of the
exam the app does not cover today.

**Acceptance criteria**

- Listening questions play recorded or high-quality synthetic French audio.
- Audio can be replayed and slowed, and a transcript appears after answering.

### TOP-6 · Music set-work listening

**Effort:** M · **Priority:** Later

As a student, I want to hear the set works beside their analysis so that I can link what I read
to what I hear.

**Acceptance criteria**

- Each set-work topic links to a licensed recording.
- No audio is bundled with the app.

### TOP-7 · Search by skill

**Effort:** S · **Priority:** Later

As a student, I want to search for a skill such as "completing the square" so that I find it
wherever it is taught.

**Acceptance criteria**

- Search matches question skills and lesson headings as well as topic titles, across subjects.


## Epic 2 · Worksheets

### WKP-1 · Redo my mistakes

**Effort:** S · **Priority:** Now · **Finishes:** QZ-4 · **Status:** done (27 September 2026)

As a student, I want a worksheet of the questions I got wrong so that I practise exactly what I
missed.

**Acceptance criteria**

- Built from stored per-question results, across topics, newest mistakes first, up to 15
  questions.
- A question answered right twice in a row leaves the list.

### WKP-2 · New questions each attempt

**Effort:** L · **Priority:** Next · **Depends on:** GEN-1

As a student, I want a different set of questions when I retry a worksheet so that I practise
rather than remember.

**Acceptance criteria**

- Where a generator exists for a skill, each attempt draws fresh generated questions.
- Written questions are still used where no generator exists.

### WKP-3 · Mixed-topic worksheet

**Effort:** M · **Priority:** Next · **Finishes:** WKS-4

As a student, I want a worksheet that mixes topics from a unit so that I must decide which
method a question needs.

**Acceptance criteria**

- The student picks a unit and a level; questions come from at least three topics.
- Results feed each question's own topic.

### WKP-4 · Timed paper mode

**Effort:** M · **Priority:** Later · **Finishes:** WKS-5

As a student, I want to sit a worksheet against the clock so that I learn the exam's pace.

**Acceptance criteria**

- A countdown of about a minute per mark; no hints or solutions until time is up or the paper
  is submitted.
- The result shows the mark and the time spent on each question.

### WKP-5 · Grade 9 problem sets

**Effort:** M · **Priority:** Later · **Finishes:** WKS-6

As a student aiming at the top grades, I want unfamiliar multi-step problems per unit so that I
am ready for the hardest questions.

**Acceptance criteria**

- Each Maths and Science unit has a set of 6 to 10 problems at grade 8 to 9.
- Each problem has a full worked solution and a mark scheme.

### WKP-6 · Right level by default

**Effort:** S · **Priority:** Now · **Finishes:** WKS-1 · **Status:** done (27 September 2026)

As a student, I want the worksheet page to open at the level that suits me so that I do not
repeat work that is too easy.

**Acceptance criteria**

- Core is suggested for a topic not yet started, Higher for Developing, Advanced from Secure up,
  the same choice Home's recommendation makes; the other levels stay one tap away.

### WKP-7 · Keep the working

**Effort:** M · **Priority:** Later · **Finishes:** WKS-7

As a parent, I want to see how my child reached an answer so that I can help where the method
went wrong.

**Acceptance criteria**

- Scratch-pad strokes, or a photo of paper working, are saved with the attempt.
- The parent can open the working from the attempt in their view.

### WKP-8 · Model answers for extended questions

**Effort:** M · **Priority:** Next

As a student, I want to see a full-mark answer before I self-mark so that my self-marking is
honest.

**Acceptance criteria**

- Every extended question shows a model answer and its mark scheme beside the student's answer.


## Epic 3 · Generated questions (Maths and Science)

### GEN-1 · Question generator framework

**Effort:** L · **Priority:** Next

As a content author, I want questions built from templates with ranges so that every attempt
can be fresh and still correct.

**Acceptance criteria**

- A generator picks values within stated ranges, builds the prompt, the answer, the solution
  and any diagram props from the same numbers.
- The seed is stored with each attempt, so any question can be rebuilt exactly.
- Generated questions use the existing question schema and marker.

### GEN-2 · Independent check for every generator

**Effort:** M · **Priority:** Next · **Depends on:** GEN-1

As the owner, I want every generator tested against a second method so that wrong answers never
reach a student.

**Acceptance criteria**

- Each generator ships with a solver that works the answer another way.
- A test runs at least 1,000 seeds per generator and fails on a disagreement, a non-terminating
  decimal where a clean answer is promised, or a value outside realistic limits.

### GEN-3 · Distractors from named mistakes

**Effort:** M · **Priority:** Next · **Depends on:** GEN-1

As a student, I want wrong options that reflect real mistakes so that choosing one teaches me
something.

**Acceptance criteria**

- Each multiple-choice generator lists named mistakes (sign slip, diameter for radius) and
  builds one option from each.
- No distractor equals the answer, and no two options are equal.
- Picking a distractor records the named mistake (see TRK-4).

### GEN-4 · Maths generators

**Effort:** L · **Priority:** Next · **Depends on:** GEN-1, GEN-2

As a student, I want fresh Maths calculation questions so that I can practise a skill until it
sticks.

**Acceptance criteria**

- Generators cover arithmetic, fractions, percentages, ratio, linear and quadratic equations,
  factorising, sequences, angles, area and volume, trigonometry and probability.
- Together they can replace at least half of the 439 written numeric Maths questions.

### GEN-5 · Physics and Chemistry generators

**Effort:** L · **Priority:** Next · **Depends on:** GEN-1, GEN-2

As a student, I want fresh calculation questions in Physics and Chemistry so that I master the
equations and the unit conversions.

**Acceptance criteria**

- Physics: every equation on the AQA equation sheet, with rearranging, prefixes and significant
  figures.
- Chemistry: relative formula mass, moles, concentration, percentage yield, bond energies and
  rates from graphs.

### GEN-6 · Biology and Further Maths generators

**Effort:** M · **Priority:** Later · **Depends on:** GEN-1, GEN-2

As a student, I want the calculation parts of Biology and Further Maths generated too.

**Acceptance criteria**

- Biology: magnification, percentage change, Punnett squares and ratios, mean rates.
- Further Maths: matrices, differentiation, the factor theorem, coordinate geometry.

### GEN-7 · More typed answers in Maths and Science

**Effort:** M · **Priority:** Next

As a student, I want to type calculation answers rather than pick them so that I cannot guess.

**Acceptance criteria**

- Multiple-choice calculation questions in Maths and Science are converted to numeric or typed
  algebra where the answer can be typed.
- Maths multiple choice falls from 42% of its questions to under 25%.

### GEN-8 · Refresh written questions in batches

**Effort:** M · **Priority:** Later

As the owner, I want explanation questions regenerated against the mark scheme and checked so
that written content keeps improving.

**Acceptance criteria**

- A batch is regenerated by the model, passes every automated content check, and a person reads
  a sample of at least 10% before release.

### GEN-9 · Calibrate difficulty from answers

**Effort:** S · **Priority:** Later · **Depends on:** TRK-1

As the owner, I want question grade bands corrected by real results so that grade 8 to 9 means
hard.

**Acceptance criteria**

- A report lists questions whose correct rate disagrees with their band (for example over 85%
  right in the 8 to 9 band), for review.


## Epic 4 · UX

### UXI-1 · Today plan

**Effort:** M · **Priority:** Now · **Status:** done (27 September 2026)

As a student, I want Home to show three things to do today so that I start straight away.

**Acceptance criteria**

- Home shows a recap that is due, the next lesson and any task a parent set, each one tap away.
- The plan changes as items are done.

### UXI-2 · Resume where I left off

**Effort:** S · **Priority:** Now · **Status:** done (27 September 2026)

As a student, I want to reopen a lesson or worksheet where I stopped so that I do not lose work.

**Acceptance criteria**

- The step or question and any typed answers are restored on the same device, after the tab or
  the installed app is closed: an unfinished quiz, worksheet or redo session for a week, a
  finished one for an hour. The Topic page says Resume and where it got to.

### UXI-3 · Feedback that explains

**Effort:** M · **Priority:** Next · **Depends on:** GEN-3

As a student, I want a wrong answer to tell me what went wrong so that I learn from it.

**Acceptance criteria**

- Choosing a distractor shows the named mistake behind it in one sentence, before the solution.

### UXI-4 · Missed question links to its lesson step

**Effort:** S · **Priority:** Now · **Finishes:** QZ-1 · **Status:** done (27 September 2026)

As a student, I want a missed quiz question to take me to the step that teaches it.

**Acceptance criteria**

- A missed question links to the step whose check practises the same skill, or else to the
  step its words most clearly match; failing both, to the lesson's start.
- A test holds the word match to at least 80% agreement with the skill match.

### UXI-5 · Works offline

**Effort:** M · **Priority:** Next

As a student, I want to study without a signal so that a train journey is revision time.

**Acceptance criteria**

- A service worker caches the app and the content of subjects opened before.
- Work done offline is saved and synced when the connection returns.

### UXI-6 · Study reminders

**Effort:** M · **Priority:** Later

As a student, I want a reminder at a time I choose so that studying becomes a habit.

**Acceptance criteria**

- Optional web push notification at a chosen time, on chosen days; off by default.

### UXI-7 · Glossary in place

**Effort:** S · **Priority:** Later

As a student, I want to tap a key term in a lesson and see its meaning without leaving the page.

**Acceptance criteria**

- Terms in the glossary are tappable inside lesson text and open a short definition card.

### UXI-8 · Drag interactives

**Effort:** L · **Priority:** Later · **Finishes:** LRN-7

As a student, I want drag-order, drag-match and labelling activities so that lessons are more
hands-on.

**Acceptance criteria**

- The three interactives in the content schema have components that work by touch and keyboard.

### UXI-9 · Reading support

**Effort:** S · **Priority:** Later

As a student with reading difficulties, I want larger text, an easier font and read-aloud so
that lessons are accessible.

**Acceptance criteria**

- A text-size setting, a dyslexia-friendly font option, and read-aloud on every lesson step.
  Today only vocabulary lists read aloud.

### UXI-10 · First-run setup

**Effort:** S · **Priority:** Next · **Pairs with:** ACC-1 · **Status:** done (27 September 2026)

As a new student, I want to pick my year, subjects and exam dates first so that the app starts
relevant.

**Acceptance criteria**

- First sign-in asks for year, subjects and exam dates, all changeable later in Settings.


## Epic 5 · Motivation

### MTV-1 · Exam countdown with readiness

**Effort:** M · **Priority:** Next · **Finishes:** LRN-4

As a student, I want to see days to each exam and how ready I am so that my progress feels real.

**Acceptance criteria**

- Per subject: days to the exam and the share of topics at Secure or better.

### MTV-2 · Working-at grade

**Effort:** M · **Priority:** Next · **Finishes:** LRN-6

As a student, I want an honest estimate of my grade per subject beside my target so that I know
where I stand.

**Acceptance criteria**

- Shown as a range (for example 5 to 6), from topic statuses and grade-band scores, with a
  sentence on how it is worked out.

### MTV-3 · Celebrate milestones

**Effort:** S · **Priority:** Next · **Finishes:** MOT-4 · **Status:** done (27 September 2026)

As a student, I want a celebration when a topic reaches Mastered or I finish a unit.

**Acceptance criteria**

- A card the student can keep or share, using the existing celebration components.

### MTV-4 · Unit and subject badges

**Effort:** S · **Priority:** Later · **Finishes:** MOT-2

As a student, I want badges for finishing units, with artwork per subject, that my parent can
also see.

**Acceptance criteria**

- A badge per unit finished, per-subject artwork, and badges listed in the parent summary.

### MTV-5 · Streak freeze

**Effort:** S · **Priority:** Later

As a student, I want one missed day a week not to break my streak so that a streak rewards
habit, not perfection.

**Acceptance criteria**

- One day a week may be missed without resetting the streak; the app says when it was used.

### MTV-6 · Parent-set rewards

**Effort:** M · **Priority:** Later · **Depends on:** ACC-1

As a parent, I want to attach a reward to a goal so that my child has something to work toward.

**Acceptance criteria**

- A parent sets a goal (a unit Secure by a date) and a reward in words; both see progress.

### MTV-7 · Student-chosen goals

**Effort:** S · **Priority:** Later

As a student, I want to set my week's goal in topics or quizzes, not only minutes.

**Acceptance criteria**

- The weekly goal can be minutes, topics moved up, or quizzes taken.

### MTV-8 · Family board

**Effort:** S · **Priority:** Later · **Depends on:** ACC-1

As a student with siblings, I want to see our weekly XP side by side, if my parent allows it.

**Acceptance criteria**

- Off by default; a parent switches it on for the family and can switch it off.


## Epic 6 · Parent and child accounts

### ACC-1 · Families replace the allow-list

**Effort:** L · **Priority:** Next · **Finishes:** FAM-1

As any parent, I want to sign up and create a family so that my children can use the app.

**Acceptance criteria**

- Sign-up with Google, Apple or email creates a family with the parent as owner.
- Database rules scope every read and write to the family; the allow-list is retired.

### ACC-2 · Invite a child or a second parent

**Effort:** M · **Priority:** Next · **Finishes:** FAM-3

As a parent, I want to invite a child aged 13 or over, or another parent, by link.

**Acceptance criteria**

- An invite link or code expires after seven days and joins the family in the right role.
- A student can see which parents are linked to them.

### ACC-3 · Managed logins for under-13s

**Effort:** M · **Priority:** Next · **Finishes:** FAM-2

As a parent of a child under 13, I want to create their login myself so that they need no email.

**Acceptance criteria**

- The parent sets a username and first password; parental consent is recorded.
- Child accounts use high-privacy defaults, as the ICO Children's Code expects.

### ACC-4 · Plans and payment

**Effort:** M · **Priority:** Next · **Depends on:** ACC-1, OPS-5

As the owner, I want families to pay after a free trial so that the app pays for itself.

**Acceptance criteria**

- A free trial, then a monthly or yearly plan per family, through Stripe Checkout and its
  webhooks.
- Access follows the family's plan; a lapsed plan keeps progress readable but not new work.

### ACC-5 · Exam board per child

**Effort:** L · **Priority:** Next

As a parent at a school with different boards, I want the app to match my child's boards.

**Acceptance criteria**

- Sign-up shows which board each subject covers today (Maths Pearson, Physics and Chemistry
  AQA, Biology Edexcel, and so on).
- Either content is added for more boards, or a subject on an uncovered board is marked clearly
  as a different board.

### ACC-6 · Leaving and deletion

**Effort:** S · **Priority:** Next · **Finishes:** FAM-4

As a parent, I want a removed child's data handled safely.

**Acceptance criteria**

- Progress is kept 90 days with a warning email, can be exported, then is deleted.

### ACC-7 · Several children

**Effort:** S · **Priority:** Next · **Depends on:** ACC-1

As a parent of several children, I want to switch between them in one view.

**Acceptance criteria**

- A child switcher on every parent screen; tasks are set per child.


## Epic 7 · Tracking

### TRK-1 · Event log in the database

**Effort:** L · **Priority:** Next

As the owner, I want every answer, lesson step and study session stored as a row so that two
devices never overwrite each other and reports are queries.

**Acceptance criteria**

- Events are written as rows; the single JSON record per account is migrated and retired.
- Two devices used on the same day both keep their work.

### TRK-2 · Mastery per skill

**Effort:** M · **Priority:** Next · **Depends on:** TRK-1

As a student, I want to see which skills inside a topic are weak so that I practise the right
thing.

**Acceptance criteria**

- Each skill is scored from recent answers, newer answers counting more.
- A topic page lists its weakest skills.

### TRK-3 · Spaced review

**Effort:** M · **Priority:** Next · **Finishes:** QZ-3 · **Depends on:** TRK-2

As a student, I want a short daily recap of what is due so that I do not forget old topics.

**Acceptance criteria**

- Skills are scheduled at growing intervals; a one-tap recap of 5 to 10 questions draws from
  what is due, across subjects.

### TRK-4 · Mistake patterns

**Effort:** M · **Priority:** Later · **Depends on:** GEN-3

As a parent, I want to see which mistakes my child repeats so that I can help with the cause.

**Acceptance criteria**

- The parent view lists the three most frequent named mistakes of the last four weeks.

### TRK-5 · Week on week

**Effort:** S · **Priority:** Now · **Finishes:** PAR-1 · **Status:** done (27 September 2026)

As a parent, I want this week compared with last so that I can see the trend.

**Acceptance criteria**

- Per subject: minutes, topics moved, average score, against the previous week.
- A suggested task beside each weak topic.

### TRK-6 · Weekly email to parents

**Effort:** M · **Priority:** Later · **Finishes:** PAR-3 · **Depends on:** ACC-1

As a parent, I want a short weekly summary by email so that I stay informed without logging in.

**Acceptance criteria**

- Sent on Sunday: time, wins and one thing to help with; parents can switch it off.

### TRK-7 · Honest study time

**Effort:** S · **Priority:** Now · **Status:** done (27 September 2026)

As a parent, I want study time to count only active time so that an open tab is not studying.

**Acceptance criteria**

- A minute counts only if there was input in the last three minutes; before this, any minute a
  learning screen was visible counted. Three, not one: an Advanced question is often worked on
  paper for several minutes without touching the phone.

### TRK-8 · Export

**Effort:** S · **Priority:** Later

As a parent, I want a CSV of attempts and scores to share with a tutor or school.

**Acceptance criteria**

- One file per child: date, subject, topic, kind, marks scored and available.


## Epic 8 · Theming

### THM-1 · Follow the device

**Effort:** S · **Priority:** Later

As a student, I want the app to switch light or dark with my phone.

**Acceptance criteria**

- An Auto theme follows the device's setting; the chosen themes stay available.

### THM-2 · Diagrams in dark mode

**Effort:** M · **Priority:** Later

As a student using a dark theme, I want diagrams drawn on a dark ground, not on white cards.

**Acceptance criteria**

- Diagram colours come from theme tokens; white alone is hard-coded 47 times today.
- Every diagram test and the label checks pass in both a light and a dark theme.

### THM-3 · Contrast check per theme

**Effort:** S · **Priority:** Later

As the owner, I want every theme tested for readable contrast.

**Acceptance criteria**

- A test measures text, subject and status colours against each theme's background and fails
  below WCAG AA (4.5 to 1).

### THM-4 · Colour-blind safe status

**Effort:** S · **Priority:** Later

As a colour-blind student, I want status and right or wrong shown by more than colour.

**Acceptance criteria**

- Every status colour has an icon or word; chart palettes are checked for red-green colour
  blindness.

### THM-5 · Calm and playful sets

**Effort:** S · **Priority:** Later

As a parent, I want themes grouped by age so that the suggested look suits my child.

**Acceptance criteria**

- Themes are grouped as calm or playful, and sign-up suggests one from the child's year.

### THM-6 · Reduced motion

**Effort:** S · **Priority:** Later

As a student sensitive to motion, I want animations off when my device asks for that.

**Acceptance criteria**

- Confetti and page animations follow the reduced-motion setting everywhere.

### THM-7 · Design tokens in one place

**Effort:** M · **Priority:** Later

As a developer, I want type, spacing and radii as shared tokens so that themes and components
cannot drift.

**Acceptance criteria**

- The app and the diagrams read the same named tokens; no component sets its own type scale.


## Epic 9 · Operations and quality

### OPS-1 · Load content per subject

**Effort:** M · **Priority:** Next · **Status:** done (27 September 2026)

As a student on mobile data, I want the app to download only what I open.

**Acceptance criteria**

- Content is split per subject and topic and loaded on demand. Today the app is one 18.5 MB
  JavaScript file (4.7 MB compressed).
- The first load is under 1 MB compressed: 677 KB of script and 18 KB of styles, from 4.7 MB. On
  a throttled phone (1.6 Mbps, 150 ms, CPU slowed 4×) Home took 4.7 s instead of 25.2 s.

### OPS-2 · Browser checks in CI

**Effort:** M · **Priority:** Now · **Status:** done (27 September 2026)

As the owner, I want the browser checks to run on every PR so that a regression cannot merge.

**Acceptance criteria**

- CI walks every page at 390 and 1280 wide for sideways scrolling and lines through labels,
  and answers every lesson check with its own answer. Today these run only by hand.

### OPS-3 · Report a mistake

**Effort:** S · **Priority:** Now · **Finishes:** ADM-4 · **Status:** done (27 September 2026)

As a student or parent, I want to report a mistake in a question or lesson step.

**Acceptance criteria**

- A button on every question and step sends its id, the family's note and the app version.
- Reports are listed for the owner to review.

### OPS-4 · Crash reporting

**Effort:** S · **Priority:** Now · **Status:** done (27 September 2026)

As the owner, I want errors on real devices reported so that a broken page does not go unseen.

**Acceptance criteria**

- Errors are collected with the page and app version and no personal data.

### OPS-5 · Pilot before payments

**Effort:** S · **Priority:** Now

As the owner, I want 5 to 10 families to use the app free for a term before building payment.

**Acceptance criteria**

- Weekly active students and topics reaching Secure are measured and reviewed at the end of the
  term.

### OPS-6 · Termly content review

**Effort:** S · **Priority:** Later · **Depends on:** OPS-3

As the owner, I want the most-missed and most-reported questions reviewed each term.

**Acceptance criteria**

- Each term, the 50 questions most often wrong, reported or claimed as right are reviewed and
  fixed where the fault is the content or the marker.

### OPS-7 · Privacy and terms

**Effort:** S · **Priority:** Next

As a parent, I want to know how my child's data is used before I sign up.

**Acceptance criteria**

- A privacy notice, terms and a data-processing record are published before the first family
  outside the owner's own signs up.

## Summary

71 stories in 9 epics. Working days assume S = 2 to 4, M = 5 to 10, L = 15 to 25, for one
developer working with Claude; they add up effort only and ignore overlap between stories.

| Epic | Stories | S | M | L | Now | Next | Later | Days (low to high) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Topics | 7 | 3 | 4 | 0 | 1 | 2 | 4 | 26 to 52 |
| Worksheets | 8 | 2 | 5 | 1 | 2 | 3 | 3 | 44 to 83 |
| Generated questions (Maths and Science) | 9 | 1 | 5 | 3 | 0 | 6 | 3 | 72 to 129 |
| UX | 10 | 5 | 4 | 1 | 3 | 3 | 4 | 45 to 85 |
| Motivation | 8 | 5 | 3 | 0 | 0 | 3 | 5 | 25 to 50 |
| Parent and child accounts | 7 | 2 | 3 | 2 | 0 | 7 | 0 | 49 to 88 |
| Tracking | 8 | 3 | 4 | 1 | 2 | 3 | 3 | 41 to 77 |
| Theming | 7 | 5 | 2 | 0 | 0 | 0 | 7 | 20 to 40 |
| Operations and quality | 7 | 5 | 2 | 0 | 4 | 2 | 1 | 20 to 40 |
| **All** | **71** | **31** | **32** | **8** | **12** | **29** | **30** | **342 to 644** |

The 12 **Now** stories come to 30 to 60 working days: TOP-2 Progress on the topic map, WKP-1 Redo my mistakes, WKP-6 Right level by default, UXI-1 Today plan, UXI-2 Resume where I left off, UXI-4 Missed question links to its lesson step, TRK-5 Week on week, TRK-7 Honest study time, OPS-2 Browser checks in CI, OPS-3 Report a mistake, OPS-4 Crash reporting, OPS-5 Pilot before payments.
