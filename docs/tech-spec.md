# GCSE Home Study Companion · Technical specification

Hosting, build, and deployment. Source: PRD Draft 4 section 12 and the delivery plan. Date: 2 September 2026. Status: draft for review.

This document says where each part of the system runs, how it is built, and how a change gets from a pull request to a family's phone. It does not repeat the product requirements or the data model; those are in the PRD and the plan.

## 1. System overview

> **8 September 2026.** The admin app described below was removed. Content is authored as files in the repository and reviewed through pull requests; the AI drafting service is deferred with it. The database remains as the future progress sync layer. Sections mentioning `apps/admin`, the admin Pages project, or the drafting function describe the deferred design.

Five hosted services and one repository. Nothing runs on a server the team maintains.

| Part | Runs on | Holds |
|---|---|---|
| Student, parent, and tutor app | Cloudflare Pages, `apps/web` | Static build of a React progressive web app |
| Authoring tool | Cloudflare Pages, `apps/admin` | Static build, separate project and hostname |
| Secret-holding endpoints | Cloudflare Pages Functions, inside each app | Signed R2 uploads, email sending, username sign-in |
| Database, auth, rules | Supabase, London | Postgres with row-level security, Auth, Postgres functions |
| Media | Cloudflare R2 | Diagrams, images, audio, published content bundles, backups |
| Email | Resend | Verification, password reset, invites, weekly digest |
| Scheduled jobs | GitHub Actions cron | Keep-alive, decay, digest trigger, backup |

Request path for a student: browser loads the app shell from Pages, signs in against Supabase Auth, reads content and progress from Postgres over the Supabase client with the anon key and row-level security, and fetches media from R2 through a custom hostname. Nothing secret reaches the browser.

## 2. Repository and tooling

One repository with pnpm workspaces.

```
apps/web            React + TypeScript + Vite, the PWA
apps/admin          React + TypeScript + Vite, the authoring tool
packages/shared     Zod schemas, marking functions, types generated from the database
supabase/           config.toml, migrations/, functions/, tests/, seed/
.github/workflows/  ci.yml, deploy.yml, jobs.yml
docs/               Requirements, plan, this document
```

- **Runtime versions.** Node current LTS pinned in `.nvmrc` and the `packageManager` field; pnpm pinned the same way so CI and laptops match.
- **Language and lint.** TypeScript strict. ESLint with the React and TypeScript presets. Prettier for formatting. Both run in CI and as a pre-commit hook through the repository's own script, not a global install.
- **Frontend libraries.** React, React Router, TanStack Query, Tailwind with a per-subject theme file, KaTeX, Zod. The shared package is consumed from source through the workspace; Vite resolves it, so there is no separate build step for it.
- **Tests.** Vitest for the shared package and component logic. pgTAP for database functions and row-level security policies. Playwright for the critical flows: sign in, add student, lesson step, quiz attempt, worksheet self-mark, parent summary.
- **Database types.** `supabase gen types typescript` writes `packages/shared/src/database.types.ts`. CI regenerates it and fails if the checked-in file is stale.

## 3. Environments

| Environment | Frontend | Database | Purpose |
|---|---|---|---|
| Local | `vite dev` on the laptop | Supabase CLI in Docker, seeded with the sample pack | Development and pgTAP |
| Preview | Cloudflare Pages preview per pull request | Staging Supabase project | Review a change on a real phone before merge |
| Staging | Cloudflare Pages branch `main` | Staging Supabase project | Where migrations land first; used by the content author |
| Production | Cloudflare Pages production deployment | Production Supabase project | Real families |

Two Supabase projects, staging and production, both within the free allowance. The staging project holds real content because the author works there; it is copied forward to production at each content release rather than the other way round. Both projects receive the daily keep-alive ping.

Local development needs Docker for the Supabase CLI. A developer without Docker can point `vite dev` at the staging project with the staging anon key; this is the documented fallback, not the default.

### Environment variables

| Name | Where set | Public |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Pages build settings per environment | Yes, baked into the bundle |
| `VITE_MEDIA_BASE_URL` | Pages build settings | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Actions secrets, Pages Functions bindings | Never |
| `RESEND_API_KEY` | Pages Functions bindings, Supabase function secrets | Never |
| `ANTHROPIC_API_KEY` | Pages Functions bindings for the admin app, GitHub Actions secrets for batch jobs | Never |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Pages Functions bindings, GitHub Actions secrets | Never |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | GitHub Actions secrets | Never |

The anon key is safe to expose because every table is behind row-level security. The service role key bypasses it and is therefore never in a browser bundle, a Pages build variable, or a `.env` file committed to git. A `.env.example` lists the public names with empty values.

## 4. Hosting

### 4.1 Cloudflare Pages

Two Pages projects connected to the GitHub repository.

- `apps/web` builds with `pnpm --filter web build`, root directory set to the repository root so the workspace resolves, output `apps/web/dist`.
- `apps/admin` builds the same way from `apps/admin`.
- Production branch is `main`. Every other branch and pull request gets a preview URL.
- Custom hostnames: `app.[YOUR DOMAIN]` and `admin.[YOUR DOMAIN]`. Cloudflare manages DNS and TLS.
- Headers set in `apps/web/public/_headers`: a content security policy that allows scripts only from self, connections only to the Supabase project and the media hostname, frames from nowhere; `Strict-Transport-Security`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`. The admin app gets the same set.
- SPA routing through `apps/web/public/_redirects` sending unknown paths to `index.html`.

### 4.2 Pages Functions

A small `functions/` directory inside each app. Each function holds a secret and does one thing.

| Function | App | Purpose |
|---|---|---|
| `POST /api/sign-in` | web | Maps a child username to the generated internal email and forwards to Supabase Auth, so the mapping is not visible in the client |
| `POST /api/media/upload-url` | admin | Checks the caller is an editor, returns a signed R2 PUT URL valid for ten minutes |
| `POST /api/email/send` | web, admin | Sends a template through Resend after checking the caller and the template name |
| `POST /api/draft` | admin | Checks the caller is an editor, calls the model with the content schema as the output format, streams parts back, and saves the result as an unpublished AI-drafted version. Detailed in section 4.7 |

Anything that needs only the caller's own permissions goes straight to Supabase from the browser. Functions are the exception, not the API layer.

### 4.3 Supabase

- One project per environment in the London region.
- **Auth.** Email plus password, Google, Apple for parents and tutors. Email confirmation required. Child accounts are created by a Postgres function called from the parent's session that inserts an auth user with the generated email `<username>@students.[YOUR DOMAIN]` and a `must_change_password` flag on the student row.
- **Database.** All rules that must agree across clients are Postgres functions: `record_attempt`, `compute_topic_status`, `apply_decay`, `next_tasks`, `weekly_summary`, `validate_topic`, `publish_topic_version`. Clients call them through RPC.
- **Row-level security** on every table from the first migration. Policies are tested with pgTAP against three fixtures: a family, a second family, and a tutor linked to one student.
- **Edge Functions.** Only where a database function cannot do the job and a Pages Function would need a Supabase-side trigger: the weekly digest renderer in Phase 2. Everything else is Postgres or Pages Functions.
- **Free tier limits that matter.** 500 MB database, 1 GB file storage (unused; media is on R2), pause after seven days without a request, no automated backups. The keep-alive job and the weekly dump cover the last two.

### 4.4 Cloudflare R2

- One bucket per environment: `study-media-staging`, `study-media-production`. A third, `study-backups`, holds database dumps.
- Media buckets are served through a custom hostname `media.[YOUR DOMAIN]` with public read. Objects are keyed by content hash, so cache headers can be `immutable` with a one-year max age.
- From milestone M3, published topic versions are also written here as JSON bundles keyed by hash, under `content/<topic>/<hash>.json`. The app fetches these instead of reading lesson steps from Postgres.
- Writes only through the signed URL function or GitHub Actions. No R2 credentials in a browser.

### 4.5 Resend

- Verified sending domain `[YOUR DOMAIN]` with SPF and DKIM records in Cloudflare DNS.
- Templates live in the repository under `packages/shared/src/email/` as functions that return HTML, so they are versioned and testable.
- Free allowance is 3,000 emails a month; a family of five with a weekly digest uses about 30.

### 4.6 Domain and DNS

The domain is not chosen yet. Every hostname above uses `[YOUR DOMAIN]` until it is. DNS sits in Cloudflare so Pages, R2 hostnames, and Resend records are managed in one place.

### 4.7 AI drafting service

The authoring tool drafts content with Claude; a human reviews every version before it can publish. The service is one Pages Function inside the admin app, so the API key never leaves the server.

- **SDK and model.** The official TypeScript SDK, `@anthropic-ai/sdk`, calling `claude-opus-5` with adaptive thinking. Thinking is on by default on that model; effort is set to `high` for topic drafts and `medium` for question batches.
- **Output shape.** The request sets the content schema as a structured output format, generated from the same Zod schema in `packages/shared` that validates authored content. The response is therefore already a valid topic or question set, and the ADM-1 publish rules run on it straight away. Anything the model returns that still fails the schema is rejected and retried once with the validation errors in the prompt.
- **Prompt.** A stable system prompt per subject: the specification's topic list and command words, the house style for lesson steps and visuals, the mark scheme conventions of the board, and the grade 9 discriminator patterns. That prefix is cached with prompt caching, so repeated drafts in a session pay for the topic-specific part only. Volatile content, the topic brief, comes last.
- **Streaming.** Topic drafts are long, so the function streams and forwards progress to the editor as each part completes. The editor sees the lesson arrive, then each worksheet, then the quiz.
- **Provenance.** Every content version stores `drafted_by` (model id and prompt version, or a person), `reviewed_by`, and `reviewed_at`. `publish_topic_version` refuses a version whose `drafted_by` is a model and whose `reviewed_by` is null. This is a database rule, not a UI rule.
- **Batch mode.** Whole-unit question generation (ADM-7) runs through the Message Batches API from a GitHub Actions job on manual dispatch, at half the per-token price, and lands questions in the bank as unreviewed.
- **Refusals and errors.** The function checks the stop reason before reading content and surfaces a refusal or a rate limit to the editor as a message rather than an empty draft. Retries are the SDK's defaults.
- **Cost.** A full topic draft is roughly 15,000 input tokens, mostly cached, and 25,000 output tokens. At Opus 5 rates that is under one dollar per topic, so the 50 to 80 topics of Phase 1 cost tens of dollars, with regenerations on top. Batch question generation is cheaper again. The key sits on a workspace with a monthly spend limit set in the Anthropic console.
- **What the model does not do.** It does not mark student work, and it is never called from the student app. Section 11 of the PRD keeps free-text marking out of scope; this service is authoring only.

## 5. Build

### 5.1 Frontend build

- `vite build` per app with content-hashed filenames, so every deploy is cache-safe.
- Route-level code splitting: home, lesson, quiz, worksheet, parent, and settings are separate chunks. KaTeX and its fonts are a chunk loaded on the first lesson or question that needs maths, and are self-hosted, not pulled from a CDN.
- Tailwind purges by the source tree; subject themes are CSS custom properties switched on the subject root element, so one stylesheet serves all subjects.
- Bundle budget checked in CI: the initial chunk for the student app under 200 KB compressed. Lighthouse CI runs against the preview deployment with a throttled mobile profile and fails below the performance budget.

### 5.2 Progressive web app

- `vite-plugin-pwa` generates the manifest and a Workbox service worker.
- Precache: the app shell and route chunks.
- Runtime cache: content bundles and media are cache-first because their names carry a hash; Supabase RPC responses are network-first with a short fallback to the persisted TanStack Query cache in IndexedDB.
- Writes while offline are queued in IndexedDB with client-generated attempt and answer IDs and replayed when the connection returns. Inserts are idempotent on those IDs.
- Update strategy: the new service worker waits, the app shows an "Update available" prompt, and never reloads mid-quiz.

### 5.3 Database build

- Migrations are timestamped SQL files under `supabase/migrations/`, written by hand or captured with `supabase db diff` from a local change.
- Every migration is reversible by a forward migration, not by a down script. A bad migration is fixed by the next one.
- `supabase/seed/` holds the sample content pack and the three test families. `supabase db reset` rebuilds a local database from migrations plus seed in under a minute.
- pgTAP tests under `supabase/tests/` run with `supabase test db`.

## 6. Deployment pipeline

### 6.1 On every pull request

`ci.yml`, about eight minutes.

1. Install with a pnpm cache.
2. Type check all workspaces.
3. Lint and format check.
4. Vitest.
5. Start the Supabase CLI stack in the runner, apply migrations and seed, run pgTAP, regenerate database types and diff against the checked-in file.
6. Cloudflare Pages builds the preview in parallel from its GitHub integration.
7. Playwright runs against the preview URL once Pages reports it ready, using a throwaway family created through the staging project and deleted afterwards.
8. Lighthouse CI against the preview URL.

A pull request cannot merge until all of these pass. Reviews are required for `supabase/migrations/` and `packages/shared/src/marking/`.

### 6.2 On merge to main

`deploy.yml`.

1. Pages deploys `main` as the production build of both apps automatically.
2. A job applies migrations to the staging project with `supabase db push`, then deploys Edge Functions if any changed.
3. A second job, gated by a GitHub environment named `production` that requires one approval, applies the same migrations to the production project.

Frontend and database therefore deploy in the same run, but the production database step waits for a human click. Until Phase 1 ships to a family outside the household, the approval is the owner's; the gate is still there so that the habit exists.

Compatibility rule: a frontend on `main` must work against the previous migration set, because Pages deploys before the production database is approved. Add columns before using them; remove them a release after the last reader is gone.

### 6.3 Content releases

Content is not in git. The author publishes to staging through the admin tool. A content release copies published topic versions from staging to production with a script in `supabase/scripts/promote-content.ts`, run from GitHub Actions on manual dispatch. The script copies only published versions and never touches attempts or families.

### 6.4 Rollback

- **Frontend.** Cloudflare Pages keeps every deployment. Rollback is selecting a previous one in the dashboard, under a minute.
- **Database.** No automatic rollback. Write a forward migration. If data is damaged, restore from the latest weekly dump into a fresh project and promote it, which is the recovery drill in section 8.
- **Content.** Every version is immutable; a bad version is followed by a corrected one. Attempts stay attached to the version they were taken against.

## 7. Scheduled jobs

`jobs.yml`, one workflow with several cron triggers, each calling a Postgres function with the service role key over the Supabase REST endpoint.

| Job | Schedule | What it does |
|---|---|---|
| Keep-alive | Daily 06:00 UTC | One cheap select on each project so neither pauses; a failure fails the workflow and emails the owner, which doubles as uptime monitoring |
| Decay | Daily 02:00 UTC | Calls `apply_decay`; steps statuses down for topics not revisited in six weeks |
| Weekly digest | Sunday 07:00 UTC, Phase 2 | Calls the digest function for every parent who has it on; it renders and sends through Resend |
| Backup | Sunday 03:00 UTC | `pg_dump` of the production project through the Supabase CLI, compressed, uploaded to `study-backups` with the date in the key |
| Backup prune | Sunday 04:00 UTC | Keeps the last twelve weekly dumps |

GitHub Actions cron can drift by several minutes and skips if the repository is inactive for sixty days; a monthly no-op commit from the workflow itself prevents that.

## 8. Backup and recovery

- Weekly logical dump to R2 as above. Recovery point objective is one week on the free tier; upgrading Supabase to Pro brings daily point-in-time backups and drops it to a day.
- Media on R2 is mirrored weekly to a second bucket in the same job, since R2 has no versioning.
- Recovery drill in milestone M5: restore the latest dump into a fresh Supabase project, point a preview deployment at it, sign in as the test family, and confirm attempts and status match. Written up as a runbook in `docs/runbooks/restore.md`.
- The family owner's data export, required by the PRD, is a Postgres function that returns the family's rows as JSON, served through a Pages Function that streams it as a download.

## 9. Security and privacy

- Row-level security is the access model. There is no application server that could bypass it by mistake.
- The service role key lives only in GitHub Actions secrets and Pages Function bindings.
- Content security policy as in section 4.1. No third-party scripts on student screens. Analytics, if any, is Cloudflare Web Analytics, which is cookieless and can be limited to the marketing page.
- Child accounts have no email of their own; the generated address is never displayed or mailed. Password reset for a child goes through the parent.
- Supabase Auth rate limits stay on. The sign-in Pages Function adds its own limit per IP.
- Dependencies are updated by Dependabot weekly; CI must pass for the update to merge.

## 10. Observability

- **Errors.** Sentry free tier in both apps, with the student's user ID as the only identifier, no session replay, and no capture on student screens beyond the error itself.
- **Logs.** Supabase project logs for auth and database, Cloudflare logs for Pages Functions. Both are retained on the free tier for a short window, which is enough for the pilot.
- **Uptime.** The keep-alive job. If it fails twice in a row, the owner has an email.
- **Usage.** A weekly query in the backup workflow prints database size, row counts for attempts, and R2 bucket size into the workflow summary so the free-tier ceilings are visible before they are hit.

## 11. Cost and the first upgrade

| Service | Free allowance used in Phase 1 | First paid step |
|---|---|---|
| Cloudflare Pages | Unlimited bandwidth, 500 builds a month | None expected |
| Cloudflare R2 | 10 GB storage, 10 million reads a month | Pay per GB beyond, cents |
| Supabase | 500 MB, two projects, pauses when idle | Pro at 25 dollars a month for production: no pausing, daily backups, 8 GB |
| Resend | 3,000 emails a month | 20 dollars a month at 50,000 |
| GitHub Actions | 2,000 minutes a month on a private repository | 2,000 minutes covers about 250 CI runs; the repository can be public to remove the cap |
| Sentry | 5,000 errors a month | Team plan when exceeded |
| Anthropic API | Pay as you go; under one dollar per drafted topic | Spend limit on the workspace; nothing to upgrade |

The only planned upgrade before pricing is decided is Supabase Pro for the production project when the pilot starts, so that the pilot family never meets a paused database.

## 12. Runbooks to write

Short, in `docs/runbooks/`, each written when the step is first done for real.

- Set up a laptop: clone, `pnpm install`, `supabase start`, `pnpm dev`.
- Create a new environment: Supabase project, Pages project, R2 bucket, secrets.
- Deploy and approve a production migration.
- Promote a content release.
- Restore from backup.
- Rotate the service role key and R2 keys.
- Rotate the Anthropic API key and update the drafting prompt version.

## 13. Open questions

1. Domain name. Every hostname in this document waits on it.
2. Whether the admin tool needs its own Pages project or can live under `app.[YOUR DOMAIN]/admin` behind the editor role. Separate is cleaner for the content security policy and is the default here.
3. Whether to make the repository public to lift the GitHub Actions minute cap. Nothing secret is in git, so the only cost is visibility.
4. Sentry versus no error tracking in the pilot. The default is to include it, since a pilot with no error visibility wastes the pilot.
