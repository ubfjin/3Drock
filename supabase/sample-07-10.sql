-- Run in Supabase SQL Editor after samples 07–10 are deployed.
-- Source filenames remain teacher-only; students see sample numbers.
do $$
begin
  if exists (
    select 1 from public.models
    where (sample_no = 7 and asset_url is distinct from '/models/sample-07.glb')
       or (sample_no = 8 and asset_url is distinct from '/models/sample-08.glb')
       or (sample_no = 9 and asset_url is distinct from '/models/sample-09.glb')
       or (sample_no = 10 and asset_url is distinct from '/models/sample-10.glb')
  ) then
    raise exception 'A sample number from 07 to 10 already points to a different model';
  end if;

  insert into public.models (sample_no, order_index, active, asset_url, credit_public)
  values (7, 7, true, '/models/sample-07.glb', ''),
         (8, 8, true, '/models/sample-08.glb', ''),
         (9, 9, true, '/models/sample-09.glb', ''),
         (10, 10, true, '/models/sample-10.glb', '')
  on conflict (sample_no) do nothing;

  insert into public.model_details (model_id, private_title)
  select id, '시료 07 · amy-g_web1m'
  from public.models where sample_no = 7
  on conflict (model_id) do nothing;

  insert into public.model_details (model_id, private_title)
  select id, '시료 08 · amy-s_web1m'
  from public.models where sample_no = 8
  on conflict (model_id) do nothing;

  insert into public.model_details (model_id, private_title)
  select id, '시료 09 · saguache-r_web1m'
  from public.models where sample_no = 9
  on conflict (model_id) do nothing;

  insert into public.model_details (model_id, private_title)
  select id, '시료 10 · amy_l-web1m'
  from public.models where sample_no = 10
  on conflict (model_id) do nothing;
end $$;
