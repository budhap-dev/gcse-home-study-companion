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
