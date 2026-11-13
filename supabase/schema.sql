-- Run in the SQL Editor of a dedicated Supabase project.
-- Students use Google OAuth. Teachers use a server-verified access code with an anonymous Auth session.

begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set local search_path = public, extensions;

create table if not exists public.teacher_access (
  singleton boolean primary key default true check (singleton),
  secret_hash text not null
);
create table if not exists public.teacher_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.teacher_sessions where user_id = auth.uid());
$$;

create table if not exists public.teacher_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  attempt_count integer not null default 0
);

create or replace function public.claim_teacher(access_code text)
returns boolean language plpgsql security definer set search_path = public, extensions
as $$
declare
  actor uuid := auth.uid();
  attempts integer;
  hashed text;
begin
  if actor is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is not true then
    raise exception 'Anonymous teacher session required';
  end if;
  insert into public.teacher_attempts (user_id, attempted_at, attempt_count)
  values (actor, now(), 1)
  on conflict (user_id) do update set
    attempted_at = case when public.teacher_attempts.attempted_at < now() - interval '1 hour' then now() else public.teacher_attempts.attempted_at end,
    attempt_count = case when public.teacher_attempts.attempted_at < now() - interval '1 hour' then 1 else public.teacher_attempts.attempt_count + 1 end
  returning attempt_count into attempts;
  if attempts > 5 then raise exception 'Too many attempts'; end if;
  select secret_hash into hashed from public.teacher_access where singleton;
  if hashed is null then raise exception 'Teacher code not configured'; end if;
  if crypt(access_code, hashed) <> hashed then return false; end if;
  insert into public.teacher_sessions (user_id) values (actor) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.claim_teacher(text) from public, anon;
grant execute on function public.claim_teacher(text) to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  student_number text,
  department text,
  created_at timestamptz not null default now()
);

create or replace function public.create_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.create_profile();

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  sample_no integer not null unique,
  storage_path text unique,
  asset_url text,
  original_asset_url text,
  active boolean not null default true,
  order_index integer not null default 0,
  credit_public text not null default '',
  created_at timestamptz not null default now(),
  constraint model_has_asset check (storage_path is not null or asset_url is not null)
);

create table if not exists public.model_details (
  model_id uuid primary key references public.models(id) on delete cascade,
  private_title text not null,
  source_url text,
  notes text
);

insert into public.models (sample_no, asset_url, active, order_index, credit_public) values
  (1, '/models/sample-01.glb', true, 1, 'phaneritic · CC BY 4.0'),
  (2, '/models/sample-02.glb', true, 2, 'rocksandminerals · CC BY 4.0'),
  (3, '/models/sample-03.glb', true, 3, '')
on conflict (sample_no) do nothing;
insert into public.model_details (model_id, private_title)
select id, '예시 시료 01'
from public.models where sample_no = 1
on conflict (model_id) do nothing;
insert into public.model_details (model_id, private_title)
select id, '예시 시료 02'
from public.models where sample_no = 2
on conflict (model_id) do nothing;
insert into public.model_details (model_id, private_title)
select id, '시료 03 · web_1m_normal-map'
from public.models where sample_no = 3
on conflict (model_id) do nothing;

create table if not exists public.questions (
  position integer primary key check (position between 1 and 3),
  prompt text not null check (length(trim(prompt)) > 0),
  updated_at timestamptz not null default now()
);

insert into public.questions (position, prompt) values
  (1, '암석 시료에서 관찰된 특징을 쓰시오.'),
  (2, '암석 관찰 결과를 기반으로 이 암석의 종류를 추정하고, 그렇게 생각한 이유를 쓰시오. (화성암, 퇴적암, 변성암)'),
  (3, '이 암석이 어떻게 관찰된 특징들을 갖게 되었는지 추론하고, 그렇게 생각한 이유를 쓰시오.')
on conflict (position) do nothing;

create table if not exists public.responses (
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id uuid not null references public.models(id) on delete cascade,
  draft_answers jsonb not null default '{}'::jsonb,
  submitted_answers jsonb,
  submitted_at timestamptz,
  submission_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, model_id)
);
create index if not exists responses_model_id_idx on public.responses(model_id);

alter table public.teacher_access enable row level security;
alter table public.teacher_sessions enable row level security;
alter table public.teacher_attempts enable row level security;
alter table public.profiles enable row level security;
alter table public.models enable row level security;
alter table public.model_details enable row level security;
alter table public.questions enable row level security;
alter table public.responses enable row level security;

revoke all on public.teacher_access, public.teacher_sessions, public.teacher_attempts, public.profiles, public.models, public.model_details, public.questions, public.responses from anon, authenticated;
grant select on public.profiles, public.models, public.model_details, public.questions, public.responses to authenticated;
grant update (student_number, department, display_name) on public.profiles to authenticated;
grant insert, update on public.models, public.model_details, public.questions to authenticated;
grant insert (user_id, model_id, draft_answers, updated_at) on public.responses to authenticated;
grant update (draft_answers, updated_at) on public.responses to authenticated;
revoke all on function public.is_teacher() from public, anon;
grant execute on function public.is_teacher() to authenticated;

create policy "profiles read own or teacher" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_teacher());
create policy "students update own profile" on public.profiles for update to authenticated
using (id = (select auth.uid()) and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false)
with check (id = (select auth.uid()) and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false);
create policy "models read active or teacher" on public.models for select to authenticated
using ((active and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false) or public.is_teacher());
create policy "models teacher insert" on public.models for insert to authenticated
with check (public.is_teacher());
create policy "models teacher update" on public.models for update to authenticated
using (public.is_teacher()) with check (public.is_teacher());
create policy "details teacher read" on public.model_details for select to authenticated
using (public.is_teacher());
create policy "details teacher insert" on public.model_details for insert to authenticated
with check (public.is_teacher());
create policy "details teacher update" on public.model_details for update to authenticated
using (public.is_teacher()) with check (public.is_teacher());
create policy "questions read" on public.questions for select to authenticated
using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false or public.is_teacher());
create policy "questions teacher insert" on public.questions for insert to authenticated
with check (public.is_teacher());
create policy "questions teacher update" on public.questions for update to authenticated
using (public.is_teacher()) with check (public.is_teacher());
create policy "responses read own or teacher" on public.responses for select to authenticated
using ((user_id = (select auth.uid()) and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false) or public.is_teacher());
create policy "responses insert own" on public.responses for insert to authenticated
with check (user_id = (select auth.uid()) and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false);
create policy "responses update own" on public.responses for update to authenticated
using (user_id = (select auth.uid()) and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false)
with check (user_id = (select auth.uid()) and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false);

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
revoke all on function public.submit_all_responses() from public, anon;
grant execute on function public.submit_all_responses() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rock-models', 'rock-models', true, 209715200, array['model/gltf-binary', 'application/octet-stream'])
on conflict (id) do nothing;
create policy "teachers upload rock models" on storage.objects for insert to authenticated
with check (bucket_id = 'rock-models' and public.is_teacher());
create policy "teachers update rock models" on storage.objects for update to authenticated
using (bucket_id = 'rock-models' and public.is_teacher())
with check (bucket_id = 'rock-models' and public.is_teacher());

commit;
