-- Run once in the Supabase SQL Editor before registering R2 URLs in the teacher dashboard.
alter table public.models add column if not exists original_asset_url text;
