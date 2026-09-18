-- People have names. Until now a parent looking at the Family screen saw whatever was
-- typed in the optional note when the account was added, and otherwise the part of the
-- email before the @ — so the screen read "abhigyan.pandit1" where it meant a person.
--
-- Two sources, and they do different jobs:
--
--   user_progress.display_name  the signed-in account's own Google profile name, written
--                               by the app on every sync. Nobody has to type it, and it
--                               follows the account rather than the allow-list.
--   allowed_emails.note         an optional name a parent sets by hand. It wins, because
--                               a family that calls him Abhi should not be overruled by
--                               what Google has on file.
--
-- No new policy is needed for either. A student already owns their user_progress row and
-- so may write display_name on it; parents already read those rows through the policy in
-- 20260918000007_parent_view.sql, and already manage allowed_emails.

alter table public.user_progress
  add column if not exists display_name text;

comment on column public.user_progress.display_name is
  'Display name from the account''s own sign-in profile, written by the app. A parent''s hand-typed name in allowed_emails.note takes precedence over it.';

comment on column public.allowed_emails.note is
  'What this person is called, shown to parents on the Family screen. Optional; the app falls back to the account''s own profile name, then to the email.';
