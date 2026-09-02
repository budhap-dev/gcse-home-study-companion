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
