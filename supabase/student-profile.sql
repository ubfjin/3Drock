-- Run once in the Supabase SQL Editor for this RockLab project.
begin;

alter table public.profiles
  add column if not exists student_number text,
  add column if not exists department text;

grant update (student_number, department, display_name)
  on public.profiles to authenticated;

drop policy if exists "students update own profile" on public.profiles;
create policy "students update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false)
  with check (id = (select auth.uid()) and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false);

commit;
