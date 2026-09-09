-- Family roles, run with `supabase test db`.
begin;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f3', 'mum@test.local'),
  ('00000000-0000-0000-0000-0000000000f4', 'kid@test.local');
insert into public.allowed_emails (email, role) values ('mum@test.local', 'parent'), ('kid@test.local', 'student');

create or replace function test_login2(uid uuid, mail text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);
end $$;

select test_login2('00000000-0000-0000-0000-0000000000f3', 'mum@test.local');
select is(public.my_role(), 'parent', 'a parent sees the parent role');
select is((select count(*) from public.allowed_emails), 2::bigint, 'a parent sees the whole list');
select lives_ok($$ insert into public.allowed_emails (email, role) values ('newkid@test.local', 'student') $$, 'a parent can add a student');
select lives_ok($$ delete from public.allowed_emails where email = 'newkid@test.local' $$, 'a parent can remove an account');

select test_login2('00000000-0000-0000-0000-0000000000f4', 'kid@test.local');
select is(public.my_role(), 'student', 'a student sees the student role');
select is((select count(*) from public.allowed_emails), 1::bigint, 'a student sees only their own row');
select throws_ok($$ insert into public.allowed_emails (email, role) values ('friend@test.local', 'student') $$, '42501', null, 'a student cannot add accounts');

select * from finish();
rollback;
