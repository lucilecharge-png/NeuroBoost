-- Table de métadonnées de synchro : une ligne par utilisateur.
create table if not exists public.sync_meta (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  version    bigint not null default 0,
  device_id  text   not null default '',
  updated_at timestamptz not null default now()
);

alter table public.sync_meta enable row level security;

-- Chaque utilisateur ne lit/écrit que sa propre ligne.
create policy "sync_meta_select_own" on public.sync_meta
  for select using (auth.uid() = user_id);
create policy "sync_meta_upsert_own" on public.sync_meta
  for insert with check (auth.uid() = user_id);
create policy "sync_meta_update_own" on public.sync_meta
  for update using (auth.uid() = user_id);
