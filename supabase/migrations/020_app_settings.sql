-- ============================================================
-- 020 : Table app_settings + bucket app-assets
-- ============================================================

-- Table clé/valeur pour les paramètres globaux de l'app
create table if not exists public.app_settings (
  key   text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- RLS : lecture publique, écriture authentifiée
alter table public.app_settings enable row level security;

create policy "app_settings_read"
  on public.app_settings for select
  to anon, authenticated
  using (true);

create policy "app_settings_write"
  on public.app_settings for all
  to authenticated
  using (true)
  with check (true);

-- Valeur par défaut : icône des lieux non découverts (vide = pas d'icône custom)
insert into public.app_settings (key, value)
values ('unknown_place_icon', '')
on conflict (key) do nothing;

-- Bucket storage pour les assets globaux (icônes, images de config)
insert into storage.buckets (id, name, public)
values ('app-assets', 'app-assets', true)
on conflict (id) do nothing;

-- Policies storage : lecture publique, upload/delete authentifié
create policy "app_assets_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'app-assets');

create policy "app_assets_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'app-assets');

create policy "app_assets_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'app-assets');
