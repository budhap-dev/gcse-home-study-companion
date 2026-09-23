# GCSE Home Study Companion

A web app where a student self-studies eight GCSE subjects to a grade 9 target, with step-by-step visual lessons, three-level worksheets, exam technique, and recap quizzes. Progress is saved on the device and, with the optional family sign-in, follows the student between devices.

## Documents

| File | What it is |
|---|---|
| [docs/prd.md](docs/prd.md) | Product requirements document, Draft 4 (2 September 2026). Scope, users, content and progress models, motivation design, non-functional requirements, delivery phases, technical approach, open decisions. |
| [docs/prd.html](docs/prd.html) | The same PRD as a formatted page. Open in a browser. |
| [docs/stories.md](docs/stories.md) | The full user story backlog: 44 stories across 9 epics with MoSCoW priorities and acceptance criteria. |
| [docs/backlog.md](docs/backlog.md) | **What is left to do, with checkboxes:** subject review passes, pack-wide quality fixes, specification gaps, and every story's missing parts, checked against the code. Tick items in the PR that finishes them. |
| [docs/plan.md](docs/plan.md) | Delivery plan for Phase 1: gating decisions, ten workstreams, seven milestones, content track, data model outline, risks, five build approaches, first two weeks. |
| [docs/plan.html](docs/plan.html) | The same plan as a formatted page. Open in a browser. |
| [docs/tech-spec.md](docs/tech-spec.md) | Technical specification: hosting, environments, build, deployment pipeline, scheduled jobs, backup, security, cost. |
| [docs/tech-spec.html](docs/tech-spec.html) | The same specification as a formatted page. Open in a browser. |
| [docs/content-order.md](docs/content-order.md) | Authoring queue: which topics are written first, following the pilot student's school order. |
| [docs/curriculum/](docs/curriculum/README.md) | One document per subject: the school's Year 9 to 11 teaching order, assessments, and the mapping onto the app's units. |

## Decisions so far

- 8 September 2026: the admin app is removed; content is authored as files in this repository and reviewed through pull requests. The first release is a single public web app with every subject's topics and no logins of any kind. Progress is saved in the browser. Google sign-in comes later, only to sync progress. Student, parent, and tutor accounts move to a later phase.
- Target grade 9 in every subject.
- Exam boards: Maths Edexcel 1MA1 with AQA Level 2 Further Maths, Biology Edexcel 1BI0, Physics AQA 8463, Chemistry AQA 8462, Computer Science AQA 8525, Business Edexcel 1BS0, Music Edexcel 1MU0 and French Edexcel 1FR1 (both confirmed on 11 September 2026, closing the PRD's open board decisions).
- Users: students, parents, and tutors. Parents own the family; tutors are linked per child by parent invite.
- Fully interactive on phone, tablet, and desktop, installable as a progressive web app.
- Stack: React with TypeScript on Vite, hosted on Vercel (switched from Cloudflare Pages on 8 September 2026), Supabase (London) with row-level security for the later progress sync, GitHub Actions for CI. Single repository with pnpm workspaces. Content is JSON in `supabase/seed`, reviewed through pull requests and bundled into the app at build time; the database holds only synced progress.

## Still to decide

See the last section of the PRD. The Music board was settled on 11 September 2026. Every exam board is now settled. What remains open is who writes and illustrates the content long term.

## Repository layout

```
apps/web         React + TypeScript web app: subjects, lessons, quizzes, worksheets, search, glossary, progress
packages/shared  Subjects, topic statuses, thresholds, story IDs; Zod content schema to follow
supabase/        Migrations and policies; seed/content topics and seed/glossary terms
docs/            Requirements, plan, tech spec, and decisions
```

## Running it

Node 22 or later. pnpm is pinned in `package.json`; enable it once with corepack, which ships with Node:

```
corepack enable
pnpm install
pnpm dev          # the app on http://localhost:8000
pnpm typecheck
pnpm build
```

The app is deployed by Vercel from `main` at https://gcse-home-study-companion.vercel.app. Every screen reads real content bundled from `supabase/seed/content` and `supabase/seed/guides`: subjects, topic maps, topic pages, step-by-step lessons with checks, three worksheets per topic with a scratch canvas and self-marked method marks, sampled quizzes, flashcards, and the exam technique guides. Progress, XP, badges and streaks are stored in the browser, and sync to Supabase once a family account signs in.

## Search and glossary

Two ways in, both bundled with the app and working offline:

- **Search** (`/search`, or the box in the sidebar, or `/` from anywhere) covers every
  topic, every lesson step, every exam technique note and every question bank, plus the
  glossary. Results are per section, so a hit lands on the step that teaches the idea
  rather than the top of the topic. Matching allows for the endings school vocabulary
  takes, so *congruency* finds *Congruent triangles* and *breakeven* finds *break-even*.
- **Glossary** (`/glossary`) is an A to Z of every term, filterable by subject, each with
  a definition, a worked example, the topic that teaches it and related terms. A topic
  page lists its own key terms, and every term deep-links as `?term=<subject>-<slug>`.

The search index is derived from the content already in the bundle, so neither feature
adds a download. See [supabase/seed/glossary/README.md](supabase/seed/glossary/README.md)
for how terms are authored.

## Versioning

The app version is the `version` field in `apps/web/package.json`, shown in the menu footer with the short commit hash. The number follows semantic versioning and must move with every release:

- **Patch** (0.2.0 → 0.2.1): fixes to content or code with no new topics or features.
- **Minor** (0.2.0 → 0.3.0): a new subject block (for example a half-term of Chemistry), a new feature, or a new diagram or interactive kind.
- **Major** (0.x → 1.0.0, then 2.0.0): a milestone the family will notice. 1.0.0 is planned for when every subject has its Autumn 1 content and the app is in daily use; the next major is Google sign-in with progress sync.

Bump the version in the same PR as the change, so the footer always says which release is deployed.


## Family sign-in (Google)

Sign-in is optional and switched on by two environment variables. Without them the app runs exactly as before: no accounts, progress on the device.

With them, the app shows a Google sign-in screen, and only Google accounts listed in the `allowed_emails` table of your Supabase project can get in. The list lives only in the database, never in this repository. Each allowed account gets one `user_progress` row, so progress follows the student between devices; row-level security means the restriction holds even if someone bypasses the screen.

Set-up, once:

1. **Supabase project.** Create a free project at supabase.com. In Project Settings → Data API note the project URL (`https://<project-ref>.supabase.co`) and the publishable key (`sb_publishable_…`, the newer form of the anon key; both are safe in a browser).
2. **Google OAuth client.** In Google Cloud Console create a project, configure the OAuth consent screen (External; add the family's Gmail addresses as test users, or publish), then Credentials → Create credentials → OAuth client ID → Web application. Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. Copy the client ID and secret.
3. **Enable Google in Supabase.** Authentication → Providers → Google: paste the client ID and secret. Authentication → URL configuration: Site URL `https://gcse-home-study-companion.vercel.app`; Redirect URLs: that URL, plus `http://localhost:8000` for local use.
4. **Apply the migrations.** `supabase link --project-ref <ref>` then `supabase db push`, or paste `supabase/migrations/*.sql` into the SQL editor in order.
5. **Allow the family's accounts.** In the SQL editor: `insert into public.allowed_emails (email, note) values ('student@gmail.com', 'student'), ('parent@gmail.com', 'parent');` Emails must be lower case.
6. **Keys.** In Vercel → Project → Settings → Environment Variables add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key goes in the second), then redeploy. Locally, copy `apps/web/.env.example` to `apps/web/.env.local` and fill it in.

Each row has a role, `parent` or `student` (default). Make yourself a parent once with `update public.allowed_emails set role = 'parent' where email = 'you@gmail.com';`. After that, parents add and remove family accounts from Settings → Family in the app; a removed account is signed out on its next visit.
