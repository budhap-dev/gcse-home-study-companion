-- Family sign-in policies, run with `supabase test db`.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'allowed@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'stranger@test.local');
insert into public.allowed_emails (email, note) values ('allowed@test.local', 'test');

create or replace function test_login(uid uuid, mail text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);
end $$;

-- Allowed account
select test_login('00000000-0000-0000-0000-0000000000f1', 'allowed@test.local');
select ok(public.is_allowed(), 'an allow-listed account is allowed');
select lives_ok($$ insert into public.user_progress (user_id, email, state) values ('00000000-0000-0000-0000-0000000000f1', 'allowed@test.local', '{"attempts":[]}') $$, 'allowed account can create its progress row');
select is((select count(*) from public.user_progress), 1::bigint, 'allowed account sees its own row');
select lives_ok($$ update public.user_progress set state = '{"attempts":[1]}' where user_id = '00000000-0000-0000-0000-0000000000f1' $$, 'allowed account can update its row');
select throws_ok($$ insert into public.user_progress (user_id, email, state) values ('00000000-0000-0000-0000-0000000000f2', 'stranger@test.local', '{}') $$, '42501', null, 'allowed account cannot write another user''s row');

-- Account not on the list
select test_login('00000000-0000-0000-0000-0000000000f2', 'stranger@test.local');
select ok(not public.is_allowed(), 'an account not on the list is refused');
select is((select count(*) from public.user_progress), 0::bigint, 'stranger sees no progress rows');
select throws_ok($$ insert into public.user_progress (user_id, email, state) values ('00000000-0000-0000-0000-0000000000f2', 'stranger@test.local', '{}') $$, '42501', null, 'stranger cannot create a progress row');

select * from finish();
rollback;
