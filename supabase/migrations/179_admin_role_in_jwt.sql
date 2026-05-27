-- 179_admin_role_in_jwt.sql
-- Auth admin via JWT : propage public.users.role -> auth.users.raw_app_meta_data.user_role
-- (app_metadata, inclus automatiquement dans le JWT). public.users.role reste la source de verite.

-- Fonction de sync (SECURITY DEFINER : doit ecrire dans auth.users)
create or replace function public.sync_user_role_to_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
     set raw_app_meta_data =
           coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', NEW.role)
   where id::text = NEW.id;
  return NEW;
end;
$$;

-- Trigger : a la creation et a chaque changement de role
drop trigger if exists trg_sync_user_role_to_app_metadata on public.users;
create trigger trg_sync_user_role_to_app_metadata
  after insert or update of role on public.users
  for each row execute function public.sync_user_role_to_app_metadata();

-- Backfill : poser le claim pour les admins existants (id aligne sur auth.users)
update auth.users au
   set raw_app_meta_data =
         coalesce(au.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', pu.role)
  from public.users pu
 where pu.id = au.id::text
   and pu.role = 'admin';
