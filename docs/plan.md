# GCSE Home Study Companion · Delivery plan

Source: PRD Draft 4 and the story backlog, both dated 2 September 2026. This plan turns those two documents into an ordered build. It covers Phase 1 (Maths and Physics, all 21 Must stories) in detail and sketches how Phases 2 to 4 follow. Date: 2 September 2026. Status: draft for review.

## 1. Where things stand

The repository holds requirements only: no code, no schema, no content. The PRD fixes the stack, the content model, the progress rules, and the phase cuts. The backlog gives stable story IDs and acceptance criteria. What is missing is the order of work, the vertical slices to build first, the content pipeline, and the decisions that gate each of those.

Three facts shape everything below.

- **Content is the critical path.** Phase 1 needs roughly 50 to 80 topics and 1,000 to 1,600 questions before a family can use it properly. Writing starts as soon as the content schema is stable, not when the app is finished.
- **The rules live in the database.** Topic status, decay, and recommendations are Postgres functions so the student app, the parent view, and the email digest never disagree.
- **Build one thin slice end to end first.** A parent signs up, adds a student, the student finishes one lesson and one quiz, the topic changes colour, and the parent sees it. Every later milestone widens that slice.

## 2. Decisions that gate the plan

These are the PRD section 13 items, with a working default so work is not blocked. Each default is overturned by one line in this document.

| # | Decision | Blocks | Working default until decided |
|---|---|---|---|
| 1 | Who writes and reviews content | Content track start, size of the admin tool in Phase 1 | Decided 2 September 2026: the authoring tool drafts every topic with AI (ADM-6) and the owner reviews and corrects. The review state on each version is Phase 1; the two-person approval flow (ADM-3) stays in Phase 2. |
| 7 | Is the first family your own | Which units to author first | Decided 2 September 2026: yes, with a Year 10 student starting GCSE this term. Author the Year 10 autumn units first (Maths Number and Algebra, Physics Energy and Electricity), then fill the rest of the specification. |
| 3 | Grade 9 question sourcing | Advanced worksheets and the Grade 9 ready status | Write from past-paper patterns, tagged by discriminator type. Commission a specialist only if the pilot shows the bank is weak. |
| 5 | Illustration and diagrams | Lesson authoring rate | Shared SVG component library for graphs, circuits, and geometry, plus commissioned artwork for subject theming only. |
| 4 | "Further" Maths definition | Phase 2 only | AQA Level 2 (8365) as written. |
| 2 | Music exam board | Phase 3 only | No action in Phase 1. |
| 6 | Pricing and trial | Paywall boundary before public launch | Ship the pilot without a paywall. Add a subscription flag on the family record so the boundary exists in the data model from day one. |

## 3. Workstreams

Each workstream lists the stories it delivers, the pieces it produces, and the design calls that need making inside it. Workstreams run in parallel where the milestones in section 4 allow.

### A. Repository and platform

Stories: none directly. Everything depends on it.

- pnpm workspace with `apps/web`, `apps/admin`, `packages/shared`, `supabase/`, matching the README layout.
- Supabase project in London, local development via the Supabase CLI, migrations in git.
- Cloudflare Pages for the web app and admin tool, preview deployment per pull request.
- Cloudflare R2 bucket for media, with uploads only through a signed function.
- GitHub Actions: type check, Vitest, Playwright on the critical flows; cron jobs for the daily Supabase keep-alive ping and the weekly database dump to R2.
- Resend account and a single transactional template for verification and password reset.

### B. Content schema and sample pack

Stories: ADM-1 (validation rules), ADM-2 (question tags).

- Zod schemas in `packages/shared` for subject, unit, topic, lesson step, question, worksheet, quiz, and exam technique note. The same schemas validate authoring input, the importer, and the API responses.
- Postgres tables for content, with a versioned topic record. Publishing creates a new immutable version. Attempts reference the version they were taken against.
- The publish checks from ADM-1 as a single validation function: all parts present, every question has answer, solution, and marks, a grade 9 step exists, at least 40% of questions tagged grade 8 to 9, no text-only step.
- A sample content pack in the repository: two complete topics, one Maths and one Physics, used by local development, tests, and the walking skeleton.
- A JSON importer that loads a topic pack into the database. This is the first authoring path and later becomes ADM-5.

### C. Accounts and family

Stories: FAM-1, FAM-2.

- Supabase Auth for parents with email plus password, Google, and Apple.
- Student accounts as Supabase users with a generated internal email and a username. Sign-in maps username to that email through a small function. A flag forces a password change on first sign-in.
- Tables: families, family members with role, students, student subjects with board and target grade. Row-level security from the first migration: a parent reads everything in their family, a student reads only their own rows, nobody writes attempts for someone else.
- Family cap of five students enforced in the database.
- Data export and deletion for the family owner. Small in code and required by section 9, so it belongs in Phase 1.

### D. Lessons and exam technique

Stories: LRN-1, LRN-2, LRN-5, LRN-7.

- Subject page grouped by unit in specification order, with status colour and the done state of lesson, worksheets, and quiz.
- Step player: one step per screen, progress indicator, check question gate that explains and then allows progress, position saved per student and topic version so a lesson resumes on another device.
- Renderers: KaTeX for maths, images from R2, audio with transcript, code blocks. Reduced-motion aware.
- Interactive step types for Phase 1: slider-driven graph or diagram, drag-and-drop ordering and matching, labelling, and equation entry with a maths keypad. Code trace waits for Computer Science in Phase 3. Every interactive type has a static fallback that shows the finished state and its explanation.
- Subject exam technique guide and topic technique note, both authored content rendered by the same step renderer.

### E. Questions, quizzes, and worksheets

Stories: QZ-1, QZ-2, WKS-1, WKS-3, WKS-7.

- One question component per type: multiple choice, numeric with tolerance and units, short text with accepted variants, ordering, labelling, extended response. Quizzes and worksheets share these components, which is what makes WKS-7 auto-marking possible.
- Marking functions in `packages/shared` so the client marks instantly and the database can re-mark from stored answers if a question is corrected.
- Answers saved per question as they are given. A refresh or dropped connection loses nothing.
- Quiz sampler that draws a different subset from the bank on retake when the bank is large enough.
- Extended response flow: text area, suggested time, then mark scheme and model answer with a mark per criterion, stored as self-marked.
- Worksheet at three levels with question count, marks, and suggested time. Advanced becomes the default level once a topic is Secure.
- Scratch canvas per question. Strokes stored as compressed vector data, not images, so the free tier holds. Side by side on desktop and tablet, stacked on a phone. Worksheet, canvas, and solution switch without losing state.
- Quiz summary linking each missed question to its lesson step.

### F. Progress, status, and recommendations

Stories: PRG-1, LRN-3, LRN-6, MOT-5.

- Postgres function that computes topic status from the latest quiz and worksheet evidence using the section 6 thresholds, called after every attempt and stored in a per-student per-topic status table.
- Thresholds held in a per-subject configuration table so they are adjustable and so a lower target grade rescales them (LRN-6). A parent notification fires when a student lowers a target.
- Six-week decay as a scheduled job that steps Grade 9 ready down to Secure and Secure down to Developing.
- Recommendation function returning three tasks with reasons in the order from LRN-3: unfinished lesson, topic due for recap, weakest topic in the subject with the soonest exam, Secure topic to push through its Advanced worksheet. Exam dates (LRN-4) are a Should, so the third rule uses subject order until dates exist.
- Topic map with a tap-through evidence panel.

### G. Parent views

Stories: PAR-1, PAR-2.

- Weekly summary view per child computed in SQL by ISO week: minutes, topics touched, quizzes taken, average score, each with the previous week beside it. Per-subject counts of Grade 9 ready, Secure, and below with the change. Five weakest topics with the recommended task for each. Auto-marked and self-marked shown separately.
- Read-only topic map reusing the student component with editing disabled.
- Parent home listing every child in the family.

### H. Motivation

Stories: MOT-1, MOT-3.

- Points ledger written by the same function that records an attempt or a step, weighted by grade band. Never deducted.
- Subject levels from cumulative points with per-subject level names in configuration.
- Weekly goal in minutes set by the student, visible to the parent. Home screen ring driven by session minutes this week.
- Days off and a basic streak count. The full activity feed (PRG-2) waits for Phase 2.
- Session tracking: start, end, subjects touched. This feeds the goal ring, the streak, and the parent summary, so it lands early.

### I. Authoring tool

Stories: ADM-1, ADM-2, ADM-6, ADM-7.

- AI drafting is the primary way a topic starts. The editor gives the title, specification points, and grade band; a server function asks the model for all five parts as structured output validated against the content schema, and saves the result as an unpublished version marked AI-drafted. The publish rules from ADM-1 run on the draft immediately so the editor sees what needs fixing.
- Every content version records who drafted it (model and prompt version, or a person) and who reviewed it. Publish is refused on an AI-drafted version with no reviewer.
- Question batch generation into the bank (ADM-7) reuses the same function with a smaller schema; generated questions are unreviewed until an editor accepts them.
- Separate Vite app in `apps/admin`, same Supabase project, editor role checked by RLS.
- Topic editor with all parts on one screen, live validation against the ADM-1 rules, and a preview using the real step and question components.
- Question bank with search and tag filters; questions attached to worksheets and quizzes by reference.
- Media upload to R2 through a signed function.
- Publish action that creates a version. Unpublish is not supported; a fix is a new version.

### J. Hardening

Stories: section 9 non-functional requirements.

- PWA manifest and service worker: app shell precached, opened lessons and quizzes cached for offline, queued attempt writes replayed when online.
- Accessibility pass against WCAG 2.2 AA: keyboard operation of every interactive step and question type, screen-reader text for maths, transcripts for audio, dyslexia-friendly font toggle, 44px targets, contrast on every subject palette.
- Performance budget: step and question under one second on a mid-range phone on 4G, checked in CI with Lighthouse.
- Playwright flows: sign in, add student, lesson step, quiz attempt, worksheet self-mark, parent summary.

## 4. Milestones

Durations assume one to two developers working full time alongside a content author. Milestones overlap; the content track in section 5 runs throughout.

### M0 · Decisions and scaffold (weeks 1 to 2)

Workstreams A and B.

- Settle decisions 1 and 7 from section 2. The others take their defaults.
- Repository scaffold, Supabase project, Cloudflare Pages, CI running on an empty app.
- Content schema v1 with the sample pack and importer.
- Authoring guide: one page describing a topic pack so writing can start.

Done when the sample pack imports cleanly and a preview deployment exists for every pull request.

### M1 · Walking skeleton (weeks 3 to 5)

Workstreams C, D, E (quiz only), F (status only), G (map only).

- Parent signs up and adds a student with subjects.
- Student opens the sample Physics topic, completes the stepped lesson with check questions, takes the quiz, and sees the topic status change.
- Parent sees the read-only topic map.
- RLS policies tested with a second family that must see nothing.

Done when the flow runs on a phone against the deployed app.

### M2 · Content pipeline (weeks 4 to 7)

Workstream I, running alongside M1.

- Drafting function with the content schema as its output format, then the topic editor, question bank, media upload, and publish with validation.
- The author moves from JSON packs to drafting in the editor. The importer stays for batches.
- First five real topics per subject drafted, reviewed, and published through the tool. Time the review per topic; that number sets the content track.

Done when a topic can go from blank to published without a developer.

### M3 · Full learning loop (weeks 6 to 10)

Workstreams D, E, F complete.

- Three-level worksheets, self-marking, scratch canvas, extended responses.
- Four interactive step types with fallbacks.
- Exam technique guide and topic notes.
- Recommendation with three choices, target grade per subject, decay job.

Done when every Must story in Epics B, C, D, and E passes its acceptance criteria on phone, tablet, and desktop.

### M4 · Parent and motivation (weeks 10 to 12)

Workstreams G and H complete.

- Weekly summary with week-on-week comparison and weakest five.
- Points, levels, goal ring, days off.
- Session tracking wired through everything.

Done when a parent can answer the three questions from PRD section 1 from one screen.

### M5 · Hardening (weeks 12 to 14)

Workstream J.

- Offline, accessibility, performance, end-to-end tests, backups verified by a restore.
- Data export and deletion.

Done when the Playwright suite is green in CI and a Lighthouse run on a throttled phone meets the budget.

### M6 · Pilot (four weeks)

- One real family uses the app with the content available.
- Weekly check: can the parent answer the three questions unaided, and can they say how many topics per subject are Grade 9 ready.
- Content reports collected by hand (ADM-4 is Phase 2); fixes shipped as new content versions.

Done when the PRD Phase 1 exit test passes. Phase 2 starts with the Should stories in the order the pilot family asks for them.

## 5. Content track

The content track starts in M0 and never stops. Its shape for Phase 1:

| Item | Maths (Higher and Advanced) | Physics | Notes |
|---|---|---|---|
| Topics | 30 to 40 | 25 to 35 | Specification order, board-specific topics tagged |
| Questions | 600 to 900 | 500 to 700 | At least 40% grade 8 to 9 per topic |
| Lesson steps | 8 to 15 per topic | 8 to 15 per topic | Each step carries a visual; each lesson ends with a grade 9 step |
| Exam technique | 1 subject guide plus 1 note per topic | Same | Includes what a grade 9 answer looks like per question type |

Order of authoring: the units the pilot student is on this term, then the units with the soonest exam paper, then the rest. Author complete topics rather than all lessons first, so the pilot always has something usable.

Rate check: with AI drafting, the author-day is spent reviewing rather than writing. Assume two to three reviewed topics per author-day, so the two subjects take five to seven author-weeks. Grade 9 questions and diagrams are where review time goes. If one person is both reviewer and developer, the pilot should still start with the current-term units only and grow during M6.

## 6. Data model outline

Tables grouped by concern. Names are indicative.

- **Identity.** `families`, `family_members` (profile, role, joined), `students` (family, first name, year group, username, must change password), `student_subjects` (board, target grade), `tutor_links` (Phase 2).
- **Content.** `subjects`, `units`, `topics`, `topic_versions` (lesson steps, technique note, published at), `questions`, `question_versions`, `worksheets` (topic version, level, ordered questions), `quizzes` (topic version, question pool, sample size). Subject configuration holds thresholds, level names, palette.
- **Activity.** `sessions`, `lesson_progress` (student, topic version, step, check results), `attempts` (student, kind, level, content version, total marks, marked how), `attempt_answers` (one row per question, saved on answer), `canvases` (attempt answer, stroke data or R2 key).
- **Progress.** `topic_status` (student, topic, status, computed at, evidence), `points_ledger`, `weekly_goals`, `days_off`.
- **Admin.** `editors`, `content_reports` (Phase 2), `review_requests` (Phase 2).

Functions: `record_attempt`, `compute_topic_status`, `apply_decay`, `next_tasks`, `weekly_summary`, `publish_topic_version`, `validate_topic`.

## 7. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Content volume outruns authoring capacity | Pilot starts with too little to use | Author current-term units first; make the importer good enough that AI-drafted packs load in batches; keep the ADM-1 checks strict so nothing incomplete ships |
| Five interactive step types are each a small product | M3 slips | Ship four, with code trace deferred to Phase 3; build each on the same drag, slider, and keypad primitives; static fallback first, interaction second |
| Canvas data grows past the free tier | Storage or cost surprise | Vector strokes with simplification, size cap per canvas, oldest canvases moved to R2 |
| Username login on Supabase Auth is unusual | Sign-in bugs for children | One small function owns the mapping; covered by a Playwright test from M1 |
| Status rules drift between client and database | Student and parent see different colours | Rules live only in Postgres; the client reads `topic_status` and never recomputes |
| Free-tier Supabase pauses after seven days idle | App down for the pilot | Daily keep-alive cron from M0; budget the Pro upgrade before M6 |
| Offline write replay creates duplicate attempts | Corrupt progress | Client-generated attempt IDs; inserts are idempotent |
| Illustration becomes the slowest part of every lesson | Lessons ship text-only and fail ADM-1 | SVG component library for the common diagrams in Maths and Physics before content starts in earnest; the drafting prompt asks for diagrams as instances of those components, not free-form images |
| AI drafts contain errors that read as confident | Wrong answers reach students | No publish without a human reviewer on the version; schema and publish rules run on every draft; every question carries a worked solution the reviewer checks; ADM-4 reports link to the exact version |

## 8. Document fixes noted while reading

Small inconsistencies between the PRD and the backlog. None change the plan, but they should be tidied so the backlog can be imported cleanly.

- The backlog header cites PRD Draft 3; the PRD is Draft 4.
- PRD goals say every topic has "the same four things"; ADM-1 requires five parts. Align the wording.
- PRD Phase 4 lists "parent-pinned tasks" as a Could, but PAR-4 is a Should in Phase 2.
- The progress model table records worksheets as self-recorded only; WKS-7 adds auto-marked worksheet questions, so worksheet attempts carry both kinds.
- MOT-3 refers to streaks, which are defined in PRG-2 (Should). Phase 1 needs at least the streak counter and days off.
- LRN-7 is listed before LRN-6 in both documents. Harmless, but it looks like a numbering slip.

## 9. Five ways to approach the build

Five architectural approaches that fit this PRD, ranked. The milestones in section 4 combine the first, third, and fifth. The others are kept because a different team shape or a changed decision in section 2 could make one of them the better lead.

### 1. Walking skeleton first (recommended lead)

Build the thinnest complete path through every layer before widening any of it: sign up, add a student, one lesson, one quiz, one status change, one parent view. Every later milestone widens the slice rather than adding a new layer.

- **Why it fits.** The product's success test is a loop between student and parent, and the loop is only proven when both ends are connected. It also surfaces the risky integrations (child login, row-level security, status function) in week three instead of week twelve.
- **Risk.** Early screens look thin, and it is tempting to polish before widening.
- **Choose it when** one or two developers are building and the first user is a known family.

### 2. Content pipeline first

Build the content schema, validation, importer, and authoring tool before any student screen, and start writing immediately. Consider a hosted headless CMS in place of `apps/admin` if the editorial team is external.

- **Why it fits.** Content is the stated critical path and the largest cost. Fifty to eighty topics do not appear in a sprint. An early, strict pipeline means the app launches with something to teach.
- **Risk.** Authoring in the dark. Without the step and question renderers, authors cannot see what a step looks like on a phone, and the schema changes once they can. A headless CMS also makes the ADM-1 publish rules harder to enforce.
- **Choose it when** decision 1 lands on an external editorial team and their start date is fixed.

### 3. Postgres as the rules engine

Every rule that has to agree across student, parent, tutor, and email lives in the database: topic status, decay, recommendations, weekly summary, points. Clients read views and call functions. Row-level security is the only access model.

- **Why it fits.** The PRD says it in section 12. It also makes the free-tier stack sufficient, because there is no separate API server to host, and it removes the whole class of "student and parent see different colours" bugs.
- **Risk.** SQL functions are harder to unit test than TypeScript. Mitigate with pgTAP tests in the migrations folder and a small TypeScript mirror of the status rules used only by tests.
- **Choose it** always, as a companion to whichever approach leads.

### 4. Component library first

Build the step renderer, the six question types, the four interactive step types, and the canvas as a standalone library with Storybook and the sample pack, then compose screens from it.

- **Why it fits.** Quizzes, worksheets, lessons, the admin preview, and print all use the same components. Touch, keyboard, screen reader, and reduced motion are cheaper to get right once, in isolation, than five times across screens.
- **Risk.** A library without screens invites over-generalising. Time goes into props nobody uses.
- **Choose it when** a front-end specialist joins and can run in parallel with the skeleton.

### 5. Published content as static bundles, attempts as local-first writes

On publish, each topic version is compiled to an immutable JSON bundle with a content hash and served from Cloudflare R2 or Pages. The service worker caches bundles, so opened lessons and quizzes work offline. Attempts and answers are written to a local store first and synced to Postgres with client-generated IDs.

- **Why it fits.** It meets the one-second load budget and the offline requirement directly, keeps the database small on the free tier, and gives the exact-version reference every attempt needs for free, because the bundle hash is the version.
- **Risk.** Two storage paths and a sync layer to test. Idempotent inserts and conflict rules are required from day one.
- **Choose it** for the content read path from M3 onwards, once the schema has stopped moving. Do not start with it.

## 10. First two weeks

1. Confirm decisions 1 and 7 in section 2, or accept the defaults.
2. Scaffold the workspace, Supabase project, Cloudflare Pages, and CI.
3. Write the content schema in `packages/shared` and the first migration.
4. Build the sample pack: one Maths topic and one Physics topic, complete with all parts.
5. Write the importer and the one-page authoring guide.
6. Start authoring the pilot student's current-term units.
