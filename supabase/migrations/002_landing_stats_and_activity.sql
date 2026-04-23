-- Landing page (app.runesdechene.com) — RPCs publiques pour la home non auth :
-- 1. get_landing_stats     → compteurs lieux + explorateurs
-- 2. get_landing_activity  → feed anonymisé des dernières découvertes
--
-- WHY (RGPD) : la toast publique sur la landing affiche
--   "Un Compagnon vient de découvrir [Lieu]" sans prénom.
--   Afficher un prénom user sur une page publique non auth demanderait
--   consentement explicite à l'inscription (CGU + checkbox + migration
--   rétroactive pour les users existants), ou intérêt légitime documenté
--   (LIA). Coût administratif > gain narratif. Le lieu seul porte 90%
--   du storytelling. La RPC ne joint donc PAS la table users — juste
--   places_discovered × places. Pour toute future surface publique non
--   auth, garder ce pattern "anonymisé".
--
-- WHY (visibilité) : filtre places.private = false AND masked = false sur
--   les deux RPCs, pour ne pas exposer de lieux privés/masqués sur une
--   page publique.

create or replace function public.get_landing_stats()
returns table (
  total_places bigint,
  total_users bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.places where private = false and masked = false),
    (select count(*) from public.users)
$$;

revoke all on function public.get_landing_stats() from public;
grant execute on function public.get_landing_stats() to anon, authenticated;


create or replace function public.get_landing_activity(limit_count integer default 10)
returns table (
  place_title text,
  discovered_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    p.title::text,
    pd.discovered_at
  from public.places_discovered pd
  inner join public.places p on p.id = pd.place_id
  where p.private = false and p.masked = false
  order by pd.discovered_at desc
  limit greatest(1, least(limit_count, 50))
$$;

revoke all on function public.get_landing_activity(integer) from public;
grant execute on function public.get_landing_activity(integer) to anon, authenticated;
