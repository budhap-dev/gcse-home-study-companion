-- Tasks a parent sets for a child.
--
-- Each row names a topic and one of the app's own activities, so the child taps it and
-- lands straight in the activity. Flashcards are deliberately not assignable: that screen
-- records nothing in a student's progress, so an assigned flashcard set could never be
-- detected as finished, and a task that can never complete is worse than no task.
--
-- Completion is NOT stored here. An assignment is done when the child's own progress
-- shows that activity finished after the assignment was set, which is derived from
-- user_progress. One source of truth for what was actually done, and a student cannot
-- mark work complete without doing it — the same principle as topic status.
--
-- topic_id carries no foreign key to public.topics on purpose. The live app serves
-- content bundled into the build rather than from the catalogue tables, so that table may
-- be empty in production and a key would refuse every insert.

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  student_email text not null check (student_email = lower(student_email)),
  set_by text not null check (set_by = lower(set_by)),
  topic_id text not null check (topic_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null check (kind in ('lesson', 'quiz', 'worksheet')),
  level text check (level in ('core', 'higher', 'advanced')),
  -- A window rather than a single deadline: when to start, and when it must be finished.
  -- Either may be left out. A task with only a due date behaves as before; one with only
  -- a start date is an instruction to begin on that day with no fixed end.
  starts_on date,
  due_on date,
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  -- a worksheet needs a level, and nothing else may carry one
  check ((kind = 'worksheet') = (level is not null)),
  -- a window that ends before it opens is a typo, not a task
  check (starts_on is null or due_on is null or due_on >= starts_on)
);

create index if not exists assignments_by_student on public.assignments (student_email, created_at desc);

alter table public.assignments enable row level security;

-- A parent sets, edits and removes tasks for student accounts on the family list. The
-- with check ties set_by to the signed-in parent, so a row cannot be attributed to
-- somebody else.
create policy "parents manage their children's assignments" on public.assignments
  for all to authenticated
  using (public.my_role() = 'parent' and public.is_family_student(student_email))
  with check (
    public.my_role() = 'parent'
    and public.is_family_student(student_email)
    and set_by = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- A student reads their own and cannot write any of them: work is finished by doing it.
create policy "students read their own assignments" on public.assignments
  for select to authenticated
  using (student_email = lower(coalesce(auth.jwt() ->> 'email', '')) and public.is_allowed());

grant select, insert, update, delete on public.assignments to authenticated;
