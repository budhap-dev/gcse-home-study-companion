-- Mistakes reported by the family, and errors caught on their devices.
--
-- content_reports: a student or parent taps "Report a mistake" on a question or lesson
-- step and says what looks wrong. The row names the item exactly (topic, kind, id), so
-- it can be found and fixed; parents review the list and mark each one.
--
-- client_errors: an error the app hit on someone's device, reported automatically. It
-- holds no identity at all, no user id and no email: what broke, where, and in which
-- version is enough to fix it, and a crash log is no place for a child's details.
--
-- topic_id carries no foreign key, as in assignments: the live app serves content bundled
-- into the build, so public.topics may be empty in production.

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_email text not null default lower(coalesce(auth.jwt() ->> 'email', ''))
    check (reporter_email = lower(reporter_email)),
  subject_id text not null check (subject_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  topic_id text not null check (topic_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  item_kind text not null check (item_kind in ('question', 'step')),
  item_id text not null check (length(item_id) between 1 and 40),
  -- Where it was seen: a quiz, a worksheet level or the lesson, for context.
  seen_in text not null check (seen_in in ('lesson', 'quiz', 'worksheet')),
  note text not null check (length(btrim(note)) between 1 and 1000),
  app_version text not null check (length(app_version) <= 40),
  status text not null default 'open' check (status in ('open', 'fixed', 'not-a-fault')),
  created_at timestamptz not null default now()
);

create index if not exists content_reports_open on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;

-- Anyone on the family list may report, as themselves only.
create policy "family members report mistakes" on public.content_reports
  for insert to authenticated
  with check (public.is_allowed() and reporter_email = lower(coalesce(auth.jwt() ->> 'email', '')) and status = 'open');

-- A reporter sees their own reports; a parent sees and resolves all of them.
create policy "reporters read their own reports" on public.content_reports
  for select to authenticated
  using (public.is_allowed() and reporter_email = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "parents read every report" on public.content_reports
  for select to authenticated
  using (public.my_role() = 'parent');
create policy "parents resolve reports" on public.content_reports
  for update to authenticated
  using (public.my_role() = 'parent')
  with check (public.my_role() = 'parent');

grant select, insert, update on public.content_reports to authenticated;
-- Only the status may change after a report is made; the rest is what was reported.
revoke update on public.content_reports from authenticated;
grant update (status) on public.content_reports to authenticated;

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  message text not null check (length(message) between 1 and 500),
  stack text check (stack is null or length(stack) <= 4000),
  page text not null check (length(page) <= 300),
  app_version text not null check (length(app_version) <= 40),
  user_agent text check (user_agent is null or length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists client_errors_recent on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

-- Any signed-in family member's device may report; nobody but a parent reads them back.
create policy "family devices report errors" on public.client_errors
  for insert to authenticated
  with check (public.is_allowed());
create policy "parents read errors" on public.client_errors
  for select to authenticated
  using (public.my_role() = 'parent');

grant select, insert on public.client_errors to authenticated;
