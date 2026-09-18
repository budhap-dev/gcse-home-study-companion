-- Row-level security and status rules, run with `supabase test db`.
-- Fixtures: family A (parent PA, student SA), family B (parent PB, student SB), editor E.

begin;
select plan(26);

-- Users straight into auth.users; the test role is allowed to.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pa@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'sa@students.test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'pb@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'sb@students.test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'editor@test.local');

insert into public.editors (user_id, name) values ('00000000-0000-0000-0000-0000000000e1', 'Editor');

insert into public.families (id, name) values
  ('00000000-0000-0000-0000-00000000fa01', 'Family A'),
  ('00000000-0000-0000-0000-00000000fb01', 'Family B');
insert into public.family_members (family_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000fa01', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000fb01', '00000000-0000-0000-0000-0000000000b1', 'owner');
insert into public.students (id, family_id, user_id, first_name, year_group, username) values
  ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-00000000fa01', '00000000-0000-0000-0000-0000000000a2', 'Ana', 10, 'ana10'),
  ('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-00000000fb01', '00000000-0000-0000-0000-0000000000b2', 'Ben', 11, 'ben11');

-- A published and an unpublished version of the seeded sample topic.
insert into public.topic_versions (id, topic_id, version, content, drafted_by, reviewed_by, published_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'laws-of-indices', 1, '{"title":"v1"}', '{"kind":"person","name":"Editor"}', null, now()),
  ('00000000-0000-0000-0000-0000000000c2', 'laws-of-indices', 2, '{"title":"v2 draft"}', '{"kind":"model","model":"claude-opus-5","promptVersion":"1"}', null, null);

-- Student A completes a quiz.
insert into public.attempts (id, student_id, topic_id, topic_version_id, kind, marks_scored, marks_available, marked_how, completed_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000005a1', 'laws-of-indices', '00000000-0000-0000-0000-0000000000c1', 'quiz', 9, 10, 'auto', now());

create or replace function test_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

-- Parent A
select test_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from public.students), 1::bigint, 'parent A sees exactly one student');
select is((select first_name from public.students), 'Ana', 'and it is their own child');
select is((select count(*) from public.attempts), 1::bigint, 'parent A sees their child''s attempt');
select is((select count(*) from public.topic_versions), 1::bigint, 'parent A sees only the published version');
select is((select count(*) from public.families), 1::bigint, 'parent A sees one family');
select throws_ok(
  $$ insert into public.students (family_id, first_name, year_group, username) values ('00000000-0000-0000-0000-00000000fb01', 'Intruder', 10, 'intruder') $$,
  '42501', null, 'parent A cannot add a student to family B');

-- Parent B
select test_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*) from public.students), 1::bigint, 'parent B sees exactly one student');
select is((select first_name from public.students), 'Ben', 'and it is their own child');
select is((select count(*) from public.attempts), 0::bigint, 'parent B sees none of family A''s attempts');
select is((select count(*) from public.topic_status), 0::bigint, 'parent B sees none of family A''s status');

-- Student A
select test_as('00000000-0000-0000-0000-0000000000a2');
select is(public.auth_student_id(), '00000000-0000-0000-0000-0000000005a1'::uuid, 'student A resolves to their own row');
select is((select count(*) from public.attempts), 1::bigint, 'student A sees their own attempt');
select is((select count(*) from public.families), 0::bigint, 'student A does not see family rows');
select throws_ok(
  $$ insert into public.attempts (id, student_id, topic_id, topic_version_id, kind) values ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000005b1', 'laws-of-indices', '00000000-0000-0000-0000-0000000000c1', 'quiz') $$,
  '42501', null, 'student A cannot write an attempt for student B');
select throws_ok(
  $$ insert into public.topic_status (student_id, topic_id, status) values ('00000000-0000-0000-0000-0000000005a1', 'laws-of-indices', 'grade-9-ready') $$,
  '42501', null, 'nobody writes topic_status directly');

-- Status rules, computed by the trigger on the quiz insert above.
reset role;
select is((select status from public.topic_status where student_id = '00000000-0000-0000-0000-0000000005a1' and topic_id = 'laws-of-indices'),
  'developing', 'a 90% quiz with no Higher worksheet is Developing, not Secure');
insert into public.attempts (id, student_id, topic_id, topic_version_id, kind, level, marks_scored, marks_available, marked_how, completed_at) values
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000005a1', 'laws-of-indices', '00000000-0000-0000-0000-0000000000c1', 'worksheet', 'higher', 8, 10, 'self', now());
select is((select status from public.topic_status where student_id = '00000000-0000-0000-0000-0000000005a1' and topic_id = 'laws-of-indices'),
  'secure', 'quiz 90% and Higher 80% is Secure');
insert into public.attempts (id, student_id, topic_id, topic_version_id, kind, level, marks_scored, marks_available, marked_how, completed_at) values
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000005a1', 'laws-of-indices', '00000000-0000-0000-0000-0000000000c1', 'worksheet', 'advanced', 8, 10, 'self', now());
select is((select status from public.topic_status where student_id = '00000000-0000-0000-0000-0000000005a1' and topic_id = 'laws-of-indices'),
  'grade-9-ready', 'adding Advanced 80% makes it Grade 9 ready');

-- Publishing rules.
select test_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(
  $$ select public.publish_topic_version('00000000-0000-0000-0000-0000000000c2') $$,
  'an AI-drafted version cannot publish until a person has reviewed it', 'unreviewed AI draft refuses to publish');
reset role;
update public.topic_versions set reviewed_by = 'Editor', reviewed_at = now() where id = '00000000-0000-0000-0000-0000000000c2';
select test_as('00000000-0000-0000-0000-0000000000e1');
select lives_ok(
  $$ select public.publish_topic_version('00000000-0000-0000-0000-0000000000c2') $$,
  'reviewed AI draft publishes');

-- Parents reading their children's progress.
--
-- The sign-in allow-list is one family, with no family column, so "my children" means
-- every student account on the list. These tests pin that down, along with the two
-- limits that matter: a parent reads students only, never another parent, and a parent
-- can read a student's progress but never write it.
reset role;
insert into public.allowed_emails (email, role, note) values
  ('pa@test.local', 'parent', 'Parent A'),
  ('sa@students.test.local', 'student', 'Ana'),
  ('pb@test.local', 'parent', 'Parent B'),
  ('sb@students.test.local', 'student', 'Ben');
insert into public.user_progress (user_id, email, state) values
  ('00000000-0000-0000-0000-0000000000a2', 'sa@students.test.local', '{"goalMinutes": 180}'),
  ('00000000-0000-0000-0000-0000000000b2', 'sb@students.test.local', '{"goalMinutes": 90}'),
  ('00000000-0000-0000-0000-0000000000b1', 'pb@test.local', '{"goalMinutes": 30}');

-- is_allowed() and my_role() read the email claim, which test_as does not set.
create or replace function test_as_account(uid uuid, mail text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);
end $$;

select test_as_account('00000000-0000-0000-0000-0000000000a1', 'pa@test.local');
select is((select count(*) from public.user_progress), 2::bigint, 'a parent sees both student rows and no parent row');
select is((select state ->> 'goalMinutes' from public.user_progress where email = 'sa@students.test.local'), '180', 'and reads the student''s state');
select is((select count(*) from public.user_progress where email = 'pb@test.local'), 0::bigint, 'a parent cannot read another parent''s progress');
select is((select count(*) from public.user_progress where email = 'pa@test.local'), 0::bigint, 'a parent with no row of their own sees none');
-- An update a policy forbids removes no rows rather than raising, so count the effect.
update public.user_progress set state = '{"goalMinutes": 9999}' where email = 'sa@students.test.local';
reset role;
select is((select state ->> 'goalMinutes' from public.user_progress where email = 'sa@students.test.local'), '180', 'a parent cannot write a student''s progress');

select test_as_account('00000000-0000-0000-0000-0000000000a2', 'sa@students.test.local');
select is((select count(*) from public.user_progress), 1::bigint, 'a student sees only their own progress row');

select * from finish();
rollback;
