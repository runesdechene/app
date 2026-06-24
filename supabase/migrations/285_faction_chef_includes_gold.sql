-- 285_faction_chef_includes_gold.sql
-- WHY : le titre de Chef doit suivre la MÊME métrique que le classement affiché du Hall :
-- Coupe (actions gatées bannière active + or de la Compagnie) + couronnes investies.
-- Avant, _faction_chef ignorait l'or → l'affichage (members[0]) et les permissions
-- (édition/exclusion) pouvaient diverger. On aligne (choix Uriel : or inclus).
CREATE OR REPLACE FUNCTION public._faction_chef(p_faction_id text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_chef text;
BEGIN
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  SELECT m.user_id INTO v_chef
  FROM faction_members m JOIN users u ON u.id = m.user_id
  WHERE m.faction_id = p_faction_id
  ORDER BY (
    (CASE WHEN u.faction_id = p_faction_id
          THEN public._user_coupe_score(m.user_id, v_from, v_to) ELSE 0 END)
    + public._member_gold_coupe(m.user_id, p_faction_id, v_from, v_to)
    + m.crowns_invested
  ) DESC, m.joined_at ASC
  LIMIT 1;
  RETURN v_chef;
END;$$;
