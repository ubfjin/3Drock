-- Run in the Supabase SQL Editor to enable observation without signing in.
-- Only active sample numbers and lightweight model locations are exposed.
create or replace function public.public_observation_models()
returns table (sample_no integer, asset_url text, storage_path text, order_index integer)
language sql
security definer
set search_path = ''
as $$
  select m.sample_no, m.asset_url, m.storage_path, m.order_index
  from public.models as m
  where m.active = true
  order by m.order_index, m.sample_no;
$$;

revoke all on function public.public_observation_models() from public;
grant execute on function public.public_observation_models() to anon, authenticated;
