# Database

Supabase project: Postgres with row-level security as the only access model. See docs/tech-spec.md sections 4.3 and 5.3.

| Folder | What it holds |
|---|---|
| `migrations/` | Timestamped SQL, applied in order. Fix a bad migration with the next one, never by editing. |
| `seed.sql` | Development seed: subjects, units, thresholds, and topic rows for the sample pack. |
| `seed/content/` | The sample content pack, loaded into `topic_versions` by the importer. |
| `tests/database/` | pgTAP tests for policies and status rules, run with `supabase test db`. |

## Running locally

Needs Docker Desktop. Then from the repository root:

```
pnpm exec supabase start      # local Postgres, auth, and API on http://127.0.0.1:54321
pnpm exec supabase db reset   # reapply migrations and seed
pnpm exec supabase test db    # pgTAP
pnpm exec supabase stop
```

CI runs the same three commands on every pull request, so the database can be developed without Docker on the laptop.
