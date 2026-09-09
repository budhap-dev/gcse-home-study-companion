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
