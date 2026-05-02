-- 065_v07_factions_for_choice_balanced.sql
-- WHY: dans la modale "Choisissez votre Héritage", l'ordre était fixé par
--      `factions.order` (alphabétique / historique) → la même faction (Vieille
--      Garde du Bosphore d'après mémoire) apparaissait toujours en premier,
--      biais d'inscription massif sur elle.
--
-- Décision Uriel 2026-05-02 : trier par nombre de membres ASC pour pousser
-- les nouveaux vers les factions sous-peuplées. Les plus faibles sont
-- présentées en premier, les plus fortes à la fin. Auto-équilibrage progressif.
--
-- RPC stable retournée à la modale, lecture pour anon (utilisé pre-auth).

CREATE OR REPLACE FUNCTION public.get_factions_for_choice()
RETURNS TABLE(
  id           text,
  title        text,
  color        text,
  pattern      text,
  description  text,
  image_url    text,
  bonus_energy integer,
  bonus_regen_energy integer,
  member_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    f.id::text,
    f.title,
    f.color,
    f.pattern,
    f.description,
    f.image_url,
    COALESCE(f.bonus_energy, 0),
    COALESCE(f.bonus_regen_energy, 0),
    COUNT(u.id)::bigint AS member_count
  FROM public.factions f
  LEFT JOIN public.users u ON u.faction_id::text = f.id::text
  GROUP BY f.id, f.title, f.color, f.pattern, f.description, f.image_url,
           f.bonus_energy, f.bonus_regen_energy, f."order"
  ORDER BY member_count ASC, f."order" ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_factions_for_choice() TO authenticated, anon;
