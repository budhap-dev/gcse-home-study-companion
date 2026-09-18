-- A parent sees their child's name and progress, and cannot change either.
-- Run with `supabase test db`.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f5', 'dad@test.local'),
  ('00000000-0000-0000-0000-0000000000f6', 'teen@test.local');
insert into public.allowed_emails (email, role) values ('dad@test.local', 'parent'), ('teen@test.local', 'student');

create or replace function test_login3(uid uuid, mail text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);
end $$;

-- The student writes their own row, name included. Nobody has to type it: the app takes
-- it from the Google profile the student signed in with.
select test_login3('00000000-0000-0000-0000-0000000000f6', 'teen@test.local');
select lives_ok(
  $$ insert into public.user_progress (user_id, email, state, display_name)
     values ('00000000-0000-0000-0000-0000000000f6', 'teen@test.local', '{"attempts":[]}', 'Alex Kaur') $$,
  'a student writes their own display name');

-- The parent reads it, and reads the progress beside it.
select test_login3('00000000-0000-0000-0000-0000000000f5', 'dad@test.local');
select is(public.my_role(), 'parent', 'the parent account has the parent role');
select ok(public.is_family_student('teen@test.local'), 'the student is recognised as a family student');
select ok(not public.is_family_student('dad@test.local'), 'a parent is not a family student');
select is((select display_name from public.user_progress where email = 'teen@test.local'), 'Alex Kaur',
  'a parent reads the student''s display name');

-- Read only. The parent policy is a select policy, so a write finds no row to change and
-- changes nothing; that is what stops a parent quietly undoing work the student did.
select is((select count(*) from public.user_progress where email = 'teen@test.local'), 1::bigint,
  'the parent can see exactly the one student row');
update public.user_progress set display_name = 'Meddled' where email = 'teen@test.local';
select is((select display_name from public.user_progress where email = 'teen@test.local'), 'Alex Kaur',
  'a parent cannot change the student''s name');

-- And a parent's own name is their own business: no student can read it.
select test_login3('00000000-0000-0000-0000-0000000000f6', 'teen@test.local');
select is((select count(*) from public.user_progress where email = 'dad@test.local'), 0::bigint,
  'a student sees no other account''s row');

select * from finish();
rollback;
