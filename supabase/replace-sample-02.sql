-- Run in the Supabase SQL Editor after deploying the replacement sample-02-v2.glb.
-- Clear any previous R2 original so students cannot see the old specimen after preview loading.
do $$
begin
  if not exists (select 1 from public.models where sample_no = 2) then
    raise exception 'Sample 02 does not exist';
  end if;

  update public.models
  set asset_url = '/models/sample-02-v2.glb', credit_public = ''
  where sample_no = 2;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'models' and column_name = 'original_asset_url'
  ) then
    execute 'update public.models set original_asset_url = null where sample_no = 2';
  end if;

  insert into public.model_details (model_id, private_title, source_url)
  select id, '시료 02 · black_schist_spain', null
  from public.models where sample_no = 2
  on conflict (model_id) do update
  set private_title = excluded.private_title, source_url = null;
end $$;
