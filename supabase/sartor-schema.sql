-- ============================================================
-- SARTOR — wardrobe manager schema
-- Run this once in the Supabase SQL editor of the project that
-- hosts Sartor. Tables are prefixed sartor_ so they can coexist
-- with other apps in the same project. Everything is locked to
-- the signed-in user via RLS.
-- ============================================================

create table if not exists public.sartor_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  category text not null check (category in ('top','bottom','shoes','layer','accessory')),
  subcategory text not null default '',
  colors jsonb not null default '[]',
  primary_color text not null default '',
  seasons text[] not null default '{}',
  occasions text[] not null default '{}',
  fabric text not null default '',
  laundry_status text not null default 'clean' check (laundry_status in ('clean','dirty','washing')),
  photo_path text not null,
  cutout_path text,
  notes text not null default '',
  times_worn int not null default 0,
  last_worn date,
  created_at timestamptz not null default now()
);

create table if not exists public.sartor_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  occasion text not null default '',
  item_ids uuid[] not null default '{}',
  score numeric,
  source text not null default 'manual' check (source in ('manual','suggested')),
  created_at timestamptz not null default now()
);

create table if not exists public.sartor_wear_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  worn_on date not null default current_date,
  outfit_id uuid references public.sartor_outfits(id) on delete set null,
  item_ids uuid[] not null default '{}',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sartor_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_ids uuid[] not null default '{}',
  features jsonb not null default '{}',
  liked boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sartor_inspo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  colors jsonb not null default '[]',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sartor_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  color_season text,
  undertone text,
  depth text,
  contrast text,
  custom_occasions text[] not null default '{}',
  pref_weights jsonb not null default '{}',
  selfie_path text,
  updated_at timestamptz not null default now()
);

-- ---------- Wear logging ----------
-- Records a wear and bumps each item's counters in one round trip, so the
-- log and the per-item totals can never drift apart.
create or replace function public.sartor_log_wear(
  p_item_ids uuid[],
  p_outfit_id uuid default null,
  p_worn_on date default current_date,
  p_note text default ''
) returns void
language plpgsql
security invoker
as $fn$
begin
  insert into public.sartor_wear_logs (user_id, worn_on, outfit_id, item_ids, note)
  values (auth.uid(), p_worn_on, p_outfit_id, p_item_ids, p_note);

  update public.sartor_items
     set times_worn = times_worn + 1,
         last_worn  = greatest(coalesce(last_worn, p_worn_on), p_worn_on)
   where user_id = auth.uid()
     and id = any(p_item_ids);
end;
$fn$;

-- ---------- Row Level Security ----------
alter table public.sartor_items enable row level security;
alter table public.sartor_outfits enable row level security;
alter table public.sartor_wear_logs enable row level security;
alter table public.sartor_ratings enable row level security;
alter table public.sartor_inspo enable row level security;
alter table public.sartor_profile enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sartor_items','sartor_outfits','sartor_wear_logs','sartor_ratings','sartor_inspo','sartor_profile']
  loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------- Storage: private bucket for wardrobe images ----------
insert into storage.buckets (id, name, public)
values ('sartor', 'sartor', false)
on conflict (id) do nothing;

drop policy if exists "sartor own files select" on storage.objects;
drop policy if exists "sartor own files insert" on storage.objects;
drop policy if exists "sartor own files update" on storage.objects;
drop policy if exists "sartor own files delete" on storage.objects;

create policy "sartor own files select" on storage.objects for select to authenticated
  using (bucket_id = 'sartor' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sartor own files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'sartor' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sartor own files update" on storage.objects for update to authenticated
  using (bucket_id = 'sartor' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sartor own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'sartor' and (storage.foldername(name))[1] = auth.uid()::text);
