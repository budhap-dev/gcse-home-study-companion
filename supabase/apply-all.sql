-- Generated: every file in supabase/migrations joined in order, for pasting into the Supabase SQL editor once.
-- Regenerate with: cat supabase/migrations/*.sql > supabase/apply-all.sql (keep this header).

-- Content catalogue: subjects, units, topics, and versioned topic content.
-- Content itself is a JSON document validated against packages/shared/src/content.
-- A published version is immutable; every attempt references the version it used.

create table public.subjects (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  board text not null,
  phase int not null check (phase between 1 and 3),
  colour text not null check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  sort int not null
);

create table public.units (
  subject_id text not null references public.subjects on delete cascade,
  id text not null check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  sort int not null,
  primary key (subject_id, id)
);

create table public.topics (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  subject_id text not null,
  unit_id text not null,
  title text not null,
  sort int not null,
  -- null means every board; otherwise only students on one of these boards see it
  boards text[],
  foreign key (subject_id, unit_id) references public.units (subject_id, id) on delete cascade
);

create index topics_by_unit on public.topics (subject_id, unit_id, sort);

create table public.topic_versions (
  id uuid primary key default gen_random_uuid(),
  topic_id text not null references public.topics on delete cascade,
  version int not null,
  content jsonb not null,
  -- {"kind":"person","name":...} or {"kind":"model","model":...,"promptVersion":...}
  drafted_by jsonb not null check (drafted_by->>'kind' in ('person', 'model')),
  reviewed_by text,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (topic_id, version)
);

create index topic_versions_published on public.topic_versions (topic_id, published_at desc) where published_at is not null;

-- Accounts allowed to author content.
create table public.editors (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  added_at timestamptz not null default now()
);

-- Subject-level exam technique guide, also versioned JSON.
create table public.subject_guides (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects on delete cascade,
  version int not null,
  content jsonb not null,
  drafted_by jsonb not null check (drafted_by->>'kind' in ('person', 'model')),
  reviewed_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (subject_id, version)
);

-- The latest published version of every topic. Students read this, never topic_versions directly.
create view public.published_topics with (security_invoker = true) as
select distinct on (v.topic_id)
  v.topic_id, v.id as version_id, v.version, v.content, v.published_at,
  t.subject_id, t.unit_id, t.title, t.sort, t.boards
from public.topic_versions v
join public.topics t on t.id = v.topic_id
where v.published_at is not null
order by v.topic_id, v.published_at desc;

-- Publishing is the only way a version becomes visible. A model draft needs a human reviewer.
create function public.publish_topic_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.topic_versions;
begin
  if not exists (select 1 from public.editors where user_id = auth.uid()) then
    raise exception 'only editors can publish' using errcode = '42501';
  end if;
  select * into v from public.topic_versions where id = p_version_id for update;
  if not found then
    raise exception 'version not found';
  end if;
  if v.published_at is not null then
    raise exception 'version already published';
  end if;
  if v.drafted_by->>'kind' = 'model' and v.reviewed_by is null then
    raise exception 'an AI-drafted version cannot publish until a person has reviewed it';
  end if;
  update public.topic_versions set published_at = now() where id = p_version_id;
end;
$$;

-- Published versions never change.
create function public.forbid_published_edits()
returns trigger
language plpgsql
as $$
begin
  if old.published_at is not null and (new.content is distinct from old.content or new.published_at is distinct from old.published_at) then
    raise exception 'published versions are immutable; publish a new version instead';
  end if;
  return new;
end;
$$;

create trigger topic_versions_immutable
  before update on public.topic_versions
  for each row execute function public.forbid_published_edits();
-- Families, parents, students, and the subjects each student takes.
-- A parent belongs to one family; a student belongs to one family.
-- Students sign in with a username; their auth user is created by a server function
-- with a generated internal email, and linked here through user_id.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- the paywall boundary exists from day one even though pricing is undecided
  subscription_status text not null default 'trial' check (subscription_status in ('trial', 'active', 'lapsed')),
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('owner', 'parent')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- A parent can belong to one family only.
create unique index family_members_one_family_per_user on public.family_members (user_id);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  user_id uuid unique references auth.users on delete set null,
  first_name text not null check (length(first_name) between 1 and 40),
  year_group int not null check (year_group between 7 and 13),
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  -- set on removal; data is retained for 90 days then deleted by a scheduled job
  removed_at timestamptz
);

create index students_by_family on public.students (family_id);

-- A family holds at most five students (FAM-2).
create function public.enforce_family_student_cap()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.students where family_id = new.family_id and removed_at is null) >= 5 then
    raise exception 'a family can hold up to five students';
  end if;
  return new;
end;
$$;

create trigger students_family_cap
  before insert on public.students
  for each row execute function public.enforce_family_student_cap();

create table public.student_subjects (
  student_id uuid not null references public.students on delete cascade,
  subject_id text not null references public.subjects,
  board text,
  -- default 9; a student may lower it to 7 or 8 and the parent is notified (LRN-6)
  target_grade int not null default 9 check (target_grade between 7 and 9),
  primary key (student_id, subject_id)
);

-- Helpers used by every policy. security definer so they can read membership
-- tables without recursing through the policies on those same tables.

create function public.auth_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.family_members where user_id = auth.uid()
$$;

create function public.auth_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.students where user_id = auth.uid() and removed_at is null
$$;

create function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.editors where user_id = auth.uid())
$$;

create function public.is_family_owner(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = auth.uid() and role = 'owner'
  )
$$;

-- Creating a family and becoming its owner is one step, so no family exists without an owner.
create function public.create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'you already belong to a family';
  end if;
  insert into public.families (name) values (p_name) returning id into fid;
  insert into public.family_members (family_id, user_id, role) values (fid, auth.uid(), 'owner');
  return fid;
end;
$$;
-- What students do (sessions, lesson progress, attempts, answers, canvases) and
-- what it adds up to (topic status, points, goals). Status is computed here,
-- in the database, so every client sees the same rules.

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  subject_ids text[] not null default '{}'
);

create index sessions_by_student on public.sessions (student_id, started_at desc);

create table public.lesson_progress (
  student_id uuid not null references public.students on delete cascade,
  topic_id text not null references public.topics on delete cascade,
  topic_version_id uuid not null references public.topic_versions,
  step_index int not null default 0 check (step_index >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, topic_id)
);

create table public.attempts (
  -- client-generated so offline replays are idempotent
  id uuid primary key,
  student_id uuid not null references public.students on delete cascade,
  topic_id text not null references public.topics on delete cascade,
  topic_version_id uuid not null references public.topic_versions,
  kind text not null check (kind in ('quiz', 'worksheet', 'recap')),
  level text check (level in ('core', 'higher', 'advanced')),
  marks_scored numeric,
  marks_available numeric,
  -- auto: every question auto-marked; self: every question self-marked; mixed: both
  marked_how text check (marked_how in ('auto', 'self', 'mixed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  seconds_taken int,
  check ((kind = 'worksheet') = (level is not null))
);

create index attempts_by_student_topic on public.attempts (student_id, topic_id, completed_at desc);

-- One row per question, written as soon as the student answers, so a refresh loses nothing.
create table public.attempt_answers (
  attempt_id uuid not null references public.attempts on delete cascade,
  question_id text not null,
  grade_band text not null check (grade_band in ('4-5', '6-7', '8-9')),
  answer jsonb,
  marks_scored numeric not null default 0 check (marks_scored >= 0),
  marks_available numeric not null check (marks_available > 0),
  marked_how text not null check (marked_how in ('auto', 'self')),
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id),
  check (marks_scored <= marks_available)
);

-- Handwritten working, stored as vector strokes rather than images.
create table public.canvases (
  attempt_id uuid not null references public.attempts on delete cascade,
  question_id text not null,
  strokes jsonb,
  -- set when strokes have been moved to object storage
  media_key text,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- Thresholds from PRD section 6, configurable per subject.
create table public.subject_thresholds (
  subject_id text primary key references public.subjects on delete cascade,
  developing_quiz_min numeric not null default 50,
  secure_quiz_min numeric not null default 80,
  secure_higher_min numeric not null default 70,
  grade9_quiz_min numeric not null default 90,
  grade9_advanced_min numeric not null default 75,
  decay_weeks int not null default 6
);

create table public.topic_status (
  student_id uuid not null references public.students on delete cascade,
  topic_id text not null references public.topics on delete cascade,
  status text not null check (status in ('not-secure', 'developing', 'secure', 'grade-9-ready')),
  last_quiz_pct numeric,
  last_quiz_grade89_pct numeric,
  last_higher_pct numeric,
  last_advanced_pct numeric,
  lesson_done boolean not null default false,
  last_activity_at timestamptz,
  computed_at timestamptz not null default now(),
  primary key (student_id, topic_id)
);

create table public.points_ledger (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students on delete cascade,
  subject_id text not null references public.subjects,
  points int not null check (points > 0),
  reason text not null,
  ref jsonb,
  created_at timestamptz not null default now()
);

create index points_by_student_subject on public.points_ledger (student_id, subject_id);

create table public.weekly_goals (
  student_id uuid primary key references public.students on delete cascade,
  minutes_per_week int not null check (minutes_per_week between 30 and 2000),
  updated_at timestamptz not null default now()
);

create table public.days_off (
  student_id uuid not null references public.students on delete cascade,
  day date not null,
  primary key (student_id, day)
);

-- Status rules (PRD section 6). Reads the latest completed attempts and upserts topic_status.
create function public.compute_topic_status(p_student_id uuid, p_topic_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.subject_thresholds;
  quiz_pct numeric;
  quiz89_pct numeric;
  higher_pct numeric;
  advanced_pct numeric;
  done boolean;
  last_at timestamptz;
  result text;
begin
  select th.* into t
  from public.topics tp
  join public.subject_thresholds th on th.subject_id = tp.subject_id
  where tp.id = p_topic_id;
  if not found then
    -- defaults when a subject has no threshold row yet
    t.developing_quiz_min := 50; t.secure_quiz_min := 80; t.secure_higher_min := 70;
    t.grade9_quiz_min := 90; t.grade9_advanced_min := 75; t.decay_weeks := 6;
  end if;

  -- latest completed quiz, with its grade 8 to 9 subset
  select
    100 * a.marks_scored / nullif(a.marks_available, 0),
    (select 100 * sum(x.marks_scored) / nullif(sum(x.marks_available), 0)
       from public.attempt_answers x where x.attempt_id = a.id and x.grade_band = '8-9')
  into quiz_pct, quiz89_pct
  from public.attempts a
  where a.student_id = p_student_id and a.topic_id = p_topic_id and a.kind = 'quiz' and a.completed_at is not null
  order by a.completed_at desc limit 1;

  select 100 * a.marks_scored / nullif(a.marks_available, 0) into higher_pct
  from public.attempts a
  where a.student_id = p_student_id and a.topic_id = p_topic_id and a.kind = 'worksheet' and a.level = 'higher' and a.completed_at is not null
  order by a.completed_at desc limit 1;

  select 100 * a.marks_scored / nullif(a.marks_available, 0) into advanced_pct
  from public.attempts a
  where a.student_id = p_student_id and a.topic_id = p_topic_id and a.kind = 'worksheet' and a.level = 'advanced' and a.completed_at is not null
  order by a.completed_at desc limit 1;

  select lp.completed_at is not null into done
  from public.lesson_progress lp where lp.student_id = p_student_id and lp.topic_id = p_topic_id;
  done := coalesce(done, false);

  select greatest(
    (select max(completed_at) from public.attempts where student_id = p_student_id and topic_id = p_topic_id),
    (select updated_at from public.lesson_progress where student_id = p_student_id and topic_id = p_topic_id)
  ) into last_at;

  if quiz_pct is not null and quiz_pct >= t.grade9_quiz_min
     and coalesce(quiz89_pct, quiz_pct) >= t.grade9_quiz_min
     and advanced_pct is not null and advanced_pct >= t.grade9_advanced_min then
    result := 'grade-9-ready';
  elsif quiz_pct is not null and quiz_pct >= t.secure_quiz_min
     and higher_pct is not null and higher_pct >= t.secure_higher_min then
    result := 'secure';
  elsif (quiz_pct is not null and quiz_pct >= t.developing_quiz_min) or (quiz_pct is null and done) then
    result := 'developing';
  else
    result := 'not-secure';
  end if;

  insert into public.topic_status as s
    (student_id, topic_id, status, last_quiz_pct, last_quiz_grade89_pct, last_higher_pct, last_advanced_pct, lesson_done, last_activity_at, computed_at)
  values (p_student_id, p_topic_id, result, quiz_pct, quiz89_pct, higher_pct, advanced_pct, done, last_at, now())
  on conflict (student_id, topic_id) do update set
    status = excluded.status, last_quiz_pct = excluded.last_quiz_pct, last_quiz_grade89_pct = excluded.last_quiz_grade89_pct,
    last_higher_pct = excluded.last_higher_pct, last_advanced_pct = excluded.last_advanced_pct,
    lesson_done = excluded.lesson_done, last_activity_at = excluded.last_activity_at, computed_at = now();

  return result;
end;
$$;

-- Recompute whenever an attempt completes or a lesson finishes.
create function public.recompute_status_from_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is not null then
    perform public.compute_topic_status(new.student_id, new.topic_id);
  end if;
  return new;
end;
$$;

create trigger attempts_recompute_status
  after insert or update of completed_at, marks_scored on public.attempts
  for each row execute function public.recompute_status_from_attempt();

create function public.recompute_status_from_lesson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.compute_topic_status(new.student_id, new.topic_id);
  return new;
end;
$$;

create trigger lesson_progress_recompute_status
  after insert or update on public.lesson_progress
  for each row execute function public.recompute_status_from_lesson();

-- Six-week decay, run nightly by a scheduled job with the service role.
create function public.apply_decay()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with stale as (
    select s.student_id, s.topic_id, s.status
    from public.topic_status s
    join public.topics tp on tp.id = s.topic_id
    left join public.subject_thresholds th on th.subject_id = tp.subject_id
    where s.status in ('secure', 'grade-9-ready')
      and s.last_activity_at < now() - make_interval(weeks => coalesce(th.decay_weeks, 6))
      and s.computed_at < now() - make_interval(weeks => coalesce(th.decay_weeks, 6))
  )
  update public.topic_status s
  set status = case stale.status when 'grade-9-ready' then 'secure' else 'developing' end,
      computed_at = now()
  from stale
  where s.student_id = stale.student_id and s.topic_id = stale.topic_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Keep updated_at honest on lesson progress.
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger lesson_progress_touch before update on public.lesson_progress for each row execute function public.touch_updated_at();
create trigger canvases_touch before update on public.canvases for each row execute function public.touch_updated_at();
-- Row-level security is the access model. There is no application server that
-- could bypass it. Rules: a parent reads everything in their family; a student
-- reads and writes only their own activity; editors manage content; published
-- content is readable by every signed-in user; status and points are written
-- only by database functions.

alter table public.subjects enable row level security;
alter table public.units enable row level security;
alter table public.topics enable row level security;
alter table public.topic_versions enable row level security;
alter table public.subject_guides enable row level security;
alter table public.editors enable row level security;
alter table public.subject_thresholds enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.students enable row level security;
alter table public.student_subjects enable row level security;
alter table public.sessions enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.canvases enable row level security;
alter table public.topic_status enable row level security;
alter table public.points_ledger enable row level security;
alter table public.weekly_goals enable row level security;
alter table public.days_off enable row level security;

-- Catalogue: readable by anyone signed in; writable by editors.
create policy "catalogue readable" on public.subjects for select to authenticated using (true);
create policy "catalogue readable" on public.units for select to authenticated using (true);
create policy "catalogue readable" on public.topics for select to authenticated using (true);
create policy "thresholds readable" on public.subject_thresholds for select to authenticated using (true);
create policy "editors manage subjects" on public.subjects for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors manage units" on public.units for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors manage topics" on public.topics for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors manage thresholds" on public.subject_thresholds for all to authenticated using (public.is_editor()) with check (public.is_editor());

-- Versions: students see published ones; editors see and write all. Publishing goes through the function.
create policy "published versions readable" on public.topic_versions for select to authenticated using (published_at is not null or public.is_editor());
create policy "editors draft versions" on public.topic_versions for insert to authenticated with check (public.is_editor());
create policy "editors edit drafts" on public.topic_versions for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "published guides readable" on public.subject_guides for select to authenticated using (published_at is not null or public.is_editor());
create policy "editors draft guides" on public.subject_guides for insert to authenticated with check (public.is_editor());
create policy "editors edit guides" on public.subject_guides for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors see editors" on public.editors for select to authenticated using (public.is_editor());

-- Families: members read; owners update; creation goes through create_family().
create policy "members read family" on public.families for select to authenticated using (id in (select public.auth_family_ids()));
create policy "owner updates family" on public.families for update to authenticated using (public.is_family_owner(id)) with check (public.is_family_owner(id));
create policy "members read members" on public.family_members for select to authenticated using (family_id in (select public.auth_family_ids()));
create policy "owner removes members" on public.family_members for delete to authenticated using (public.is_family_owner(family_id) and user_id <> auth.uid());

-- Students: parents manage; the student reads their own row and may update display fields.
create policy "family reads students" on public.students for select to authenticated
  using (family_id in (select public.auth_family_ids()) or user_id = auth.uid());
create policy "parents add students" on public.students for insert to authenticated
  with check (family_id in (select public.auth_family_ids()));
create policy "parents update students" on public.students for update to authenticated
  using (family_id in (select public.auth_family_ids())) with check (family_id in (select public.auth_family_ids()));
create policy "owner removes students" on public.students for delete to authenticated using (public.is_family_owner(family_id));

create policy "family reads subjects taken" on public.student_subjects for select to authenticated
  using (student_id in (select id from public.students where family_id in (select public.auth_family_ids())) or student_id = public.auth_student_id());
create policy "parents set subjects taken" on public.student_subjects for insert to authenticated
  with check (student_id in (select id from public.students where family_id in (select public.auth_family_ids())));
create policy "parents and student update subjects taken" on public.student_subjects for update to authenticated
  using (student_id in (select id from public.students where family_id in (select public.auth_family_ids())) or student_id = public.auth_student_id())
  with check (student_id in (select id from public.students where family_id in (select public.auth_family_ids())) or student_id = public.auth_student_id());
create policy "parents remove subjects taken" on public.student_subjects for delete to authenticated
  using (student_id in (select id from public.students where family_id in (select public.auth_family_ids())));

-- Activity: the student writes their own rows; the family reads them.
create policy "student writes sessions" on public.sessions for insert to authenticated with check (student_id = public.auth_student_id());
create policy "student updates sessions" on public.sessions for update to authenticated using (student_id = public.auth_student_id()) with check (student_id = public.auth_student_id());
create policy "family reads sessions" on public.sessions for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));

create policy "student writes lesson progress" on public.lesson_progress for insert to authenticated with check (student_id = public.auth_student_id());
create policy "student updates lesson progress" on public.lesson_progress for update to authenticated using (student_id = public.auth_student_id()) with check (student_id = public.auth_student_id());
create policy "family reads lesson progress" on public.lesson_progress for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));

create policy "student writes attempts" on public.attempts for insert to authenticated with check (student_id = public.auth_student_id());
create policy "student updates attempts" on public.attempts for update to authenticated using (student_id = public.auth_student_id()) with check (student_id = public.auth_student_id());
create policy "family reads attempts" on public.attempts for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));

create policy "student writes answers" on public.attempt_answers for insert to authenticated
  with check (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()));
create policy "student updates answers" on public.attempt_answers for update to authenticated
  using (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()))
  with check (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()));
create policy "family reads answers" on public.attempt_answers for select to authenticated
  using (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()
         or student_id in (select id from public.students where family_id in (select public.auth_family_ids()))));

create policy "student writes canvases" on public.canvases for insert to authenticated
  with check (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()));
create policy "student updates canvases" on public.canvases for update to authenticated
  using (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()))
  with check (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()));
create policy "family reads canvases" on public.canvases for select to authenticated
  using (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()
         or student_id in (select id from public.students where family_id in (select public.auth_family_ids()))));

-- Derived data: readable by the student and family, written only by functions.
create policy "family reads status" on public.topic_status for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));
create policy "family reads points" on public.points_ledger for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));

-- Goals and days off: the student sets them; the family reads them.
create policy "family reads goals" on public.weekly_goals for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));
create policy "student sets goal" on public.weekly_goals for insert to authenticated with check (student_id = public.auth_student_id());
create policy "student updates goal" on public.weekly_goals for update to authenticated using (student_id = public.auth_student_id()) with check (student_id = public.auth_student_id());
create policy "family reads days off" on public.days_off for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));
create policy "student marks days off" on public.days_off for insert to authenticated with check (student_id = public.auth_student_id());
create policy "student unmarks days off" on public.days_off for delete to authenticated using (student_id = public.auth_student_id());

-- Functions callable by signed-in users. Supabase grants execute to every role by
-- default, so revoke first and grant back only what the app calls. The service role
-- keeps everything, which is how scheduled jobs call apply_decay.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.publish_topic_version(uuid) to authenticated;
grant execute on function public.compute_topic_status(uuid, text) to authenticated;
grant execute on function public.auth_family_ids() to authenticated;
grant execute on function public.auth_student_id() to authenticated;
grant execute on function public.is_editor() to authenticated;
grant execute on function public.is_family_owner(uuid) to authenticated;
-- trigger functions fire on tables these users write to
grant execute on function public.enforce_family_student_cap() to authenticated;
grant execute on function public.forbid_published_edits() to authenticated;
grant execute on function public.recompute_status_from_attempt() to authenticated;
grant execute on function public.recompute_status_from_lesson() to authenticated;
grant execute on function public.touch_updated_at() to authenticated;
-- Family sign-in: Google accounts on an allow-list, and one progress row per account.
--
-- The allow-list lives only in the database (never in the repository). is_allowed()
-- answers "is the signed-in account on the list?" for the client and for the policies,
-- so the restriction holds in the database even if the screen is bypassed.

create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  note text,
  added_at timestamptz not null default now()
);
comment on table public.allowed_emails is 'Google account emails allowed to use the app. Add rows in the Supabase dashboard.';
alter table public.allowed_emails enable row level security;
-- No policies: clients cannot read or change the list. Only is_allowed() consults it.

create or replace function public.is_allowed() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.allowed_emails a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_allowed() from public, anon;
grant execute on function public.is_allowed() to authenticated;

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
comment on table public.user_progress is 'The whole progress state of one account, as the app stores it in the browser.';
alter table public.user_progress enable row level security;

create policy "own progress, allowed accounts only" on public.user_progress
  for all to authenticated
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and email = lower(coalesce(auth.jwt() ->> 'email', '')) and public.is_allowed());

grant select, insert, update on public.user_progress to authenticated;
-- Family roles: each allowed account is a parent or a student. Parents manage the list
-- from the app; students can only see their own row.

alter table public.allowed_emails
  add column if not exists role text not null default 'student' check (role in ('parent', 'student'));

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select a.role from public.allowed_emails a
  where a.email = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

create policy "members see their own row" on public.allowed_emails
  for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "parents manage the list" on public.allowed_emails
  for all to authenticated
  using (public.my_role() = 'parent')
  with check (public.my_role() = 'parent' and email = lower(email));

grant select, insert, update, delete on public.allowed_emails to authenticated;
-- Parents can read their children's progress, so a parent can see how the work is going
-- without borrowing the child's device.
--
-- Read only, and deliberately narrow. The existing "own progress" policy is still the
-- only one that permits a write, so a parent can never alter a student's record; and the
-- read reaches student accounts only, not other parents'. Permissive policies on the same
-- command are OR'ed, so a student's own access is unchanged by this.
--
-- is_family_student() is security definer for the same reason is_allowed() is: a policy
-- has to consult the allow-list even though the caller cannot read it.

create or replace function public.is_family_student(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.allowed_emails a
    where a.email = lower(p_email) and a.role = 'student'
  );
$$;
revoke all on function public.is_family_student(text) from public, anon;
grant execute on function public.is_family_student(text) to authenticated;

create policy "parents read their children's progress" on public.user_progress
  for select to authenticated
  using (public.my_role() = 'parent' and public.is_family_student(email));
