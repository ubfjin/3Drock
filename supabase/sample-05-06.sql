-- Run once in Supabase SQL Editor after the two lightweight GLBs are deployed.
-- Source filenames remain teacher-only; students see sample numbers.
do $$
begin
  if exists (
    select 1 from public.models
    where (sample_no = 5 and asset_url is distinct from '/models/sample-05.glb')
       or (sample_no = 6 and asset_url is distinct from '/models/sample-06.glb')
  ) then
    raise exception 'Sample 05 or 06 already points to a different model';
  end if;

  insert into public.models (sample_no, order_index, active, asset_url, credit_public)
  values (5, 5, true, '/models/sample-05.glb', ''),
         (6, 6, true, '/models/sample-06.glb', '')
  on conflict (sample_no) do nothing;

  insert into public.model_details (model_id, private_title)
  select id, '시료 05 · amy_g_261023_Web 1000k_261024_0139'
  from public.models where sample_no = 5
  on conflict (model_id) do nothing;

  insert into public.model_details (model_id, private_title)
  select id, '시료 06 · pyo-sampel_b-web'
  from public.models where sample_no = 6
  on conflict (model_id) do nothing;
end $$;
