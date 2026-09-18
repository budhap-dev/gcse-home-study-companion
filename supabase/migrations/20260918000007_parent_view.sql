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
