-- Run once in Supabase SQL Editor after schema.sql. All times are stored as UTC;
-- the dashboard presents and accepts the teacher's local (Korea) time.
begin;

create table if not exists public.class_settings (
  singleton boolean primary key default true check (singleton),
  due_at timestamptz,
  max_score integer not null default 3 check (max_score between 1 and 100),
  grades_released boolean not null default false
);
insert into public.class_settings (singleton) values (true) on conflict do nothing;
alter table public.class_settings enable row level security;
revoke all on public.class_settings from anon, authenticated;
grant select, update on public.class_settings to authenticated;
create policy "settings authenticated read" on public.class_settings for select to authenticated using (true);
create policy "settings teacher update" on public.class_settings for update to authenticated
using (public.is_teacher()) with check (public.is_teacher());

create table if not exists public.grades (
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id uuid not null references public.models(id) on delete cascade,
  score integer not null check (score >= 0),
  feedback text not null default '',
  graded_at timestamptz not null default now(),
  primary key (user_id, model_id)
);
alter table public.grades enable row level security;
revoke all on public.grades from anon, authenticated;
grant select on public.grades to authenticated;
create policy "grades teacher or released own read" on public.grades for select to authenticated
using (public.is_teacher() or (user_id = (select auth.uid()) and
  exists (select 1 from public.class_settings where singleton and grades_released)));

create or replace function public.save_grade(student_id uuid, sample_id uuid, points integer, note text)
returns void language plpgsql security definer set search_path = public
as $$
declare allowed integer;
begin
  if not public.is_teacher() then raise exception 'Teacher access required'; end if;
  select max_score into allowed from public.class_settings where singleton;
  if points is null or points < 0 or points > allowed then raise exception 'Score is outside the allowed range'; end if;
  if not exists (select 1 from public.responses where user_id = student_id and model_id = sample_id and submitted_at is not null)
    then raise exception 'A submitted report is required'; end if;
  insert into public.grades (user_id, model_id, score, feedback, graded_at)
  values (student_id, sample_id, points, coalesce(note, ''), now())
  on conflict (user_id, model_id) do update set
    score = excluded.score, feedback = excluded.feedback, graded_at = excluded.graded_at;
end;
$$;
revoke all on function public.save_grade(uuid, uuid, integer, text) from public, anon;
grant execute on function public.save_grade(uuid, uuid, integer, text) to authenticated;

drop policy if exists "responses insert own" on public.responses;
create policy "responses insert own" on public.responses for insert to authenticated
with check (user_id = (select auth.uid())
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false
  and exists (select 1 from public.class_settings where singleton and (due_at is null or now() < due_at)));
drop policy if exists "responses update own" on public.responses;
create policy "responses update own" on public.responses for update to authenticated
using (user_id = (select auth.uid())
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false
  and exists (select 1 from public.class_settings where singleton and (due_at is null or now() < due_at)))
with check (user_id = (select auth.uid())
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false
  and exists (select 1 from public.class_settings where singleton and (due_at is null or now() < due_at)));

create or replace function public.submit_all_responses()
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  expected_count integer;
  ready_count integer;
  submitted_time timestamptz := now();
begin
  if actor is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is true then raise exception 'Student login required'; end if;
  if not exists (select 1 from public.class_settings where singleton and (due_at is null or submitted_time < due_at))
    then raise exception 'The submission deadline has passed'; end if;
  select count(*) into expected_count from public.models where active;
  if expected_count = 0 then raise exception 'No active models'; end if;
  select count(*) into ready_count
  from public.responses r join public.models m on m.id = r.model_id
  where r.user_id = actor and m.active
    and length(trim(coalesce(r.draft_answers ->> '1', ''))) > 0
    and length(trim(coalesce(r.draft_answers ->> '2', ''))) > 0
    and length(trim(coalesce(r.draft_answers ->> '3', ''))) > 0;
  if ready_count <> expected_count then raise exception 'Complete all three answers for every model'; end if;
  update public.responses r set
    submitted_answers = r.draft_answers,
    submitted_at = submitted_time,
    submission_count = r.submission_count + 1,
    updated_at = submitted_time
  from public.models m
  where r.user_id = actor and r.model_id = m.id and m.active;
  return submitted_time;
end;
$$;

commit;
