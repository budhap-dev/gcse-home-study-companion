-- Family members report mistakes as themselves; parents review them. Device errors carry
-- no identity and only parents read them. Run with `supabase test db`.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'mum@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'kid@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'stranger@test.local');
insert into public.allowed_emails (email, role) values ('mum@test.local', 'parent'), ('kid@test.local', 'student');

create or replace function test_login5(uid uuid, mail text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);
end $$;

-- A student reports a mistake; the reporter is filled in from their own sign-in.
select test_login5('00000000-0000-0000-0000-0000000000a2', 'kid@test.local');
select lives_ok(
  $$ insert into public.content_reports (subject_id, topic_id, item_kind, item_id, seen_in, note, app_version)
     values ('maths', 'quadratic-curves', 'question', 'q4', 'quiz', 'The answer says 5 but the graph shows 6', '10.34.0') $$,
  'a student reports a mistake');
select is((select reporter_email from public.content_reports), 'kid@test.local', 'the reporter is the signed-in student');
select throws_ok(
  $$ insert into public.content_reports (reporter_email, subject_id, topic_id, item_kind, item_id, seen_in, note, app_version)
     values ('mum@test.local', 'maths', 'quadratic-curves', 'q5', 'quiz', 'pretending', '10.34.0') $$,
  '42501', null, 'a report cannot be made in someone else''s name');
select throws_ok(
  $$ insert into public.content_reports (subject_id, topic_id, item_kind, item_id, seen_in, note, app_version)
     values ('maths', 'quadratic-curves', 'question', 'q5', 'quiz', '   ', '10.34.0') $$,
  '23514', null, 'an empty note is refused');
update public.content_reports set status = 'fixed';
select is((select status from public.content_reports), 'open', 'a student cannot mark their report fixed');

-- The device reports an error, and cannot read errors back.
select lives_ok(
  $$ insert into public.client_errors (message, page, app_version) values ('x is undefined', '/subjects/maths', '10.34.0') $$,
  'a family device reports an error');
select is((select count(*) from public.client_errors), 0::bigint, 'a student reads no error logs');

-- The parent reads every report and resolves it, but cannot rewrite what was reported.
select test_login5('00000000-0000-0000-0000-0000000000a1', 'mum@test.local');
update public.content_reports set status = 'fixed';
select is((select status from public.content_reports), 'fixed', 'a parent marks a report fixed');
select throws_ok(
  $$ update public.content_reports set note = 'edited' $$,
  '42501', null, 'a parent cannot change the report''s words');
select is((select count(*) from public.client_errors), 1::bigint, 'a parent reads the error logs');

-- Someone not on the family list can do neither.
select test_login5('00000000-0000-0000-0000-0000000000a3', 'stranger@test.local');
select throws_ok(
  $$ insert into public.content_reports (subject_id, topic_id, item_kind, item_id, seen_in, note, app_version)
     values ('maths', 'quadratic-curves', 'question', 'q4', 'quiz', 'spam', '10.34.0') $$,
  '42501', null, 'an account off the list cannot report');

select * from finish();
rollback;
