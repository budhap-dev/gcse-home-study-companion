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
