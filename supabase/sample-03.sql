-- Run once in the Supabase SQL Editor after sample-03.glb has been deployed.
-- The source filename remains teacher-only; students see "시료 03".
do $$
begin
  if exists (
    select 1 from public.models
    where sample_no = 3 and asset_url is distinct from '/models/sample-03.glb'
  ) then
    raise exception 'Sample 03 already points to a different model';
  end if;

  insert into public.models (sample_no, order_index, active, asset_url, credit_public)
  values (3, 3, true, '/models/sample-03.glb', '')
  on conflict (sample_no) do nothing;

  insert into public.model_details (model_id, private_title)
  select id, '시료 03 · web_1m_normal-map'
  from public.models where sample_no = 3
  on conflict (model_id) do nothing;
end $$;
