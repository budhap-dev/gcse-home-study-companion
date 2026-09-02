# GCSE Home Study Companion

A web app where a student self-studies eight GCSE subjects to a grade 9 target, with step-by-step visual lessons, three-level worksheets, exam technique, and recap quizzes. Parents and tutors follow progress through linked accounts.

## Documents

| File | What it is |
|---|---|
| [docs/prd.md](docs/prd.md) | Product requirements document, Draft 4 (2 September 2026). Scope, users, content and progress models, motivation design, non-functional requirements, delivery phases, technical approach, open decisions. |
| [docs/prd.html](docs/prd.html) | The same PRD as a formatted page. Open in a browser. |
| [docs/stories.md](docs/stories.md) | The full user story backlog: 44 stories across 9 epics with MoSCoW priorities and acceptance criteria. |

## Decisions so far

- Target grade 9 in every subject.
- Exam boards: Maths Edexcel 1MA1 with AQA Level 2 Further Maths, Biology Edexcel 1BI0, Physics AQA 8463, Chemistry AQA 8462, Computer Science AQA 8525, Business Edexcel 1BS0, French Edexcel 1FR1. Music board still open.
- Users: students, parents, and tutors. Parents own the family; tutors are linked per child by parent invite.
- Fully interactive on phone, tablet, and desktop, installable as a progressive web app.
- Stack: React with TypeScript on Vite, Cloudflare Pages, Supabase (London) with row-level security, Cloudflare R2 for media, Resend for email, GitHub Actions for scheduled jobs. Single repository with pnpm workspaces. Content lives in Postgres, not in git.

## Still to decide

See the last section of the PRD. The two that block content work are the Music exam board and who writes and illustrates the content.

## Repository layout (planned)

```
apps/web         React + TypeScript student, parent and tutor app
apps/admin       Content authoring and review tool
packages/shared  Types, content schema, validation
supabase/        Migrations, policies, seed sample content
docs/            Requirements and decisions (this folder)
```
