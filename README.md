# GCSE Home Study Companion

A web app where a student self-studies eight GCSE subjects to a grade 9 target, with step-by-step visual lessons, three-level worksheets, exam technique, and recap quizzes. Parents and tutors follow progress through linked accounts.

## Documents

| File | What it is |
|---|---|
| [docs/prd.md](docs/prd.md) | Product requirements document, Draft 4 (2 September 2026). Scope, users, content and progress models, motivation design, non-functional requirements, delivery phases, technical approach, open decisions. |
| [docs/prd.html](docs/prd.html) | The same PRD as a formatted page. Open in a browser. |
| [docs/stories.md](docs/stories.md) | The full user story backlog: 44 stories across 9 epics with MoSCoW priorities and acceptance criteria. |
| [docs/plan.md](docs/plan.md) | Delivery plan for Phase 1: gating decisions, ten workstreams, seven milestones, content track, data model outline, risks, five build approaches, first two weeks. |
| [docs/plan.html](docs/plan.html) | The same plan as a formatted page. Open in a browser. |
| [docs/tech-spec.md](docs/tech-spec.md) | Technical specification: hosting, environments, build, deployment pipeline, scheduled jobs, backup, security, cost. |
| [docs/tech-spec.html](docs/tech-spec.html) | The same specification as a formatted page. Open in a browser. |
| [docs/content-order.md](docs/content-order.md) | Authoring queue: which topics are written first, following the pilot student's school order. |

## Decisions so far

- Target grade 9 in every subject.
- Exam boards: Maths Edexcel 1MA1 with AQA Level 2 Further Maths, Biology Edexcel 1BI0, Physics AQA 8463, Chemistry AQA 8462, Computer Science AQA 8525, Business Edexcel 1BS0, French Edexcel 1FR1. Music board still open.
- Users: students, parents, and tutors. Parents own the family; tutors are linked per child by parent invite.
- Fully interactive on phone, tablet, and desktop, installable as a progressive web app.
- Stack: React with TypeScript on Vite, Cloudflare Pages, Supabase (London) with row-level security, Cloudflare R2 for media, Resend for email, GitHub Actions for scheduled jobs. Single repository with pnpm workspaces. Content lives in Postgres, not in git.

## Still to decide

See the last section of the PRD. The two that block content work are the Music exam board and who writes and illustrates the content.

## Repository layout

```
apps/web         React + TypeScript student, parent and tutor app (placeholder screens and menu)
apps/admin       Content authoring and review tool (placeholder screens)
packages/shared  Subjects, topic statuses, thresholds, story IDs; Zod content schema to follow
supabase/        Migrations, policies, seed sample content (empty until a project exists)
docs/            Requirements, plan, tech spec, and decisions
```

## Running it

Node 22 or later. pnpm is pinned in `package.json`; enable it once with corepack, which ships with Node:

```
corepack enable
pnpm install
pnpm dev          # student, parent and tutor app on http://localhost:8000
pnpm dev:admin    # authoring tool on http://localhost:8001
pnpm typecheck
pnpm build
```

Every screen is a placeholder that names the stories from docs/stories.md it will deliver and the blocks it will contain. The menu, routes, and subject theming are real; nothing talks to a database yet.
