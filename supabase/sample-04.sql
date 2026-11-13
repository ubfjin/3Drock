-- Run once in the Supabase SQL Editor after sample-04.glb has been deployed.
-- Students see only "시료 04"; the source filename is teacher-only.
do $$
begin
  if exists (
    select 1 from public.models
    where sample_no = 4 and asset_url is distinct from '/models/sample-04.glb'
  ) then
    raise exception 'Sample 04 already points to a different model';
  end if;

  insert into public.models (sample_no, order_index, active, asset_url, credit_public)
  values (4, 4, true, '/models/sample-04.glb', '')
  on conflict (sample_no) do nothing;

  insert into public.model_details (model_id, private_title)
  select id, '시료 04 · pyo-sample_g_web1M'
  from public.models where sample_no = 4
  on conflict (model_id) do nothing;
end $$;
