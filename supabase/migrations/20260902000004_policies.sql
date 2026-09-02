-- Row-level security is the access model. There is no application server that
-- could bypass it. Rules: a parent reads everything in their family; a student
-- reads and writes only their own activity; editors manage content; published
-- content is readable by every signed-in user; status and points are written
-- only by database functions.

alter table public.subjects enable row level security;
alter table public.units enable row level security;
alter table public.topics enable row level security;
alter table public.topic_versions enable row level security;
alter table public.subject_guides enable row level security;
alter table public.editors enable row level security;
alter table public.subject_thresholds enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.students enable row level security;
alter table public.student_subjects enable row level security;
alter table public.sessions enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.canvases enable row level security;
alter table public.topic_status enable row level security;
alter table public.points_ledger enable row level security;
alter table public.weekly_goals enable row level security;
alter table public.days_off enable row level security;

-- Catalogue: readable by anyone signed in; writable by editors.
create policy "catalogue readable" on public.subjects for select to authenticated using (true);
create policy "catalogue readable" on public.units for select to authenticated using (true);
create policy "catalogue readable" on public.topics for select to authenticated using (true);
create policy "thresholds readable" on public.subject_thresholds for select to authenticated using (true);
create policy "editors manage subjects" on public.subjects for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors manage units" on public.units for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors manage topics" on public.topics for all to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors manage thresholds" on public.subject_thresholds for all to authenticated using (public.is_editor()) with check (public.is_editor());

-- Versions: students see published ones; editors see and write all. Publishing goes through the function.
create policy "published versions readable" on public.topic_versions for select to authenticated using (published_at is not null or public.is_editor());
create policy "editors draft versions" on public.topic_versions for insert to authenticated with check (public.is_editor());
create policy "editors edit drafts" on public.topic_versions for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "published guides readable" on public.subject_guides for select to authenticated using (published_at is not null or public.is_editor());
create policy "editors draft guides" on public.subject_guides for insert to authenticated with check (public.is_editor());
create policy "editors edit guides" on public.subject_guides for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors see editors" on public.editors for select to authenticated using (public.is_editor());

-- Families: members read; owners update; creation goes through create_family().
create policy "members read family" on public.families for select to authenticated using (id in (select public.auth_family_ids()));
create policy "owner updates family" on public.families for update to authenticated using (public.is_family_owner(id)) with check (public.is_family_owner(id));
create policy "members read members" on public.family_members for select to authenticated using (family_id in (select public.auth_family_ids()));
create policy "owner removes members" on public.family_members for delete to authenticated using (public.is_family_owner(family_id) and user_id <> auth.uid());

-- Students: parents manage; the student reads their own row and may update display fields.
create policy "family reads students" on public.students for select to authenticated
  using (family_id in (select public.auth_family_ids()) or user_id = auth.uid());
create policy "parents add students" on public.students for insert to authenticated
  with check (family_id in (select public.auth_family_ids()));
create policy "parents update students" on public.students for update to authenticated
  using (family_id in (select public.auth_family_ids())) with check (family_id in (select public.auth_family_ids()));
create policy "owner removes students" on public.students for delete to authenticated using (public.is_family_owner(family_id));

create policy "family reads subjects taken" on public.student_subjects for select to authenticated
  using (student_id in (select id from public.students where family_id in (select public.auth_family_ids())) or student_id = public.auth_student_id());
create policy "parents set subjects taken" on public.student_subjects for insert to authenticated
  with check (student_id in (select id from public.students where family_id in (select public.auth_family_ids())));
create policy "parents and student update subjects taken" on public.student_subjects for update to authenticated
  using (student_id in (select id from public.students where family_id in (select public.auth_family_ids())) or student_id = public.auth_student_id())
  with check (student_id in (select id from public.students where family_id in (select public.auth_family_ids())) or student_id = public.auth_student_id());
create policy "parents remove subjects taken" on public.student_subjects for delete to authenticated
  using (student_id in (select id from public.students where family_id in (select public.auth_family_ids())));

-- Activity: the student writes their own rows; the family reads them.
create policy "student writes sessions" on public.sessions for insert to authenticated with check (student_id = public.auth_student_id());
create policy "student updates sessions" on public.sessions for update to authenticated using (student_id = public.auth_student_id()) with check (student_id = public.auth_student_id());
create policy "family reads sessions" on public.sessions for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));

create policy "student writes lesson progress" on public.lesson_progress for insert to authenticated with check (student_id = public.auth_student_id());
create policy "student updates lesson progress" on public.lesson_progress for update to authenticated using (student_id = public.auth_student_id()) with check (student_id = public.auth_student_id());
create policy "family reads lesson progress" on public.lesson_progress for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));

create policy "student writes attempts" on public.attempts for insert to authenticated with check (student_id = public.auth_student_id());
create policy "student updates attempts" on public.attempts for update to authenticated using (student_id = public.auth_student_id()) with check (student_id = public.auth_student_id());
create policy "family reads attempts" on public.attempts for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));

create policy "student writes answers" on public.attempt_answers for insert to authenticated
  with check (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()));
create policy "student updates answers" on public.attempt_answers for update to authenticated
  using (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()))
  with check (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()));
create policy "family reads answers" on public.attempt_answers for select to authenticated
  using (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()
         or student_id in (select id from public.students where family_id in (select public.auth_family_ids()))));

create policy "student writes canvases" on public.canvases for insert to authenticated
  with check (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()));
create policy "student updates canvases" on public.canvases for update to authenticated
  using (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()))
  with check (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()));
create policy "family reads canvases" on public.canvases for select to authenticated
  using (attempt_id in (select id from public.attempts where student_id = public.auth_student_id()
         or student_id in (select id from public.students where family_id in (select public.auth_family_ids()))));

-- Derived data: readable by the student and family, written only by functions.
create policy "family reads status" on public.topic_status for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));
create policy "family reads points" on public.points_ledger for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));

-- Goals and days off: the student sets them; the family reads them.
create policy "family reads goals" on public.weekly_goals for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));
create policy "student sets goal" on public.weekly_goals for insert to authenticated with check (student_id = public.auth_student_id());
create policy "student updates goal" on public.weekly_goals for update to authenticated using (student_id = public.auth_student_id()) with check (student_id = public.auth_student_id());
create policy "family reads days off" on public.days_off for select to authenticated
  using (student_id = public.auth_student_id() or student_id in (select id from public.students where family_id in (select public.auth_family_ids())));
create policy "student marks days off" on public.days_off for insert to authenticated with check (student_id = public.auth_student_id());
create policy "student unmarks days off" on public.days_off for delete to authenticated using (student_id = public.auth_student_id());

-- Functions callable by signed-in users. Supabase grants execute to every role by
-- default, so revoke first and grant back only what the app calls. The service role
-- keeps everything, which is how scheduled jobs call apply_decay.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.publish_topic_version(uuid) to authenticated;
grant execute on function public.compute_topic_status(uuid, text) to authenticated;
grant execute on function public.auth_family_ids() to authenticated;
grant execute on function public.auth_student_id() to authenticated;
grant execute on function public.is_editor() to authenticated;
grant execute on function public.is_family_owner(uuid) to authenticated;
-- trigger functions fire on tables these users write to
grant execute on function public.enforce_family_student_cap() to authenticated;
grant execute on function public.forbid_published_edits() to authenticated;
grant execute on function public.recompute_status_from_attempt() to authenticated;
grant execute on function public.recompute_status_from_lesson() to authenticated;
grant execute on function public.touch_updated_at() to authenticated;
