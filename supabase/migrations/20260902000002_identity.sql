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
