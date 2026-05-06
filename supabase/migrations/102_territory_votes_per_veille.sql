-- 102_territory_votes_per_veille.sql
-- WHY : simplifier la mécanique de vote sur le nommage de territoire.
--       Avant (mig 100) : +1 vote par tranche de 10 Couronnes investies en mécénat positif.
--       Après           : +1 vote par lieu du blob où l'user est veilleur direct
--                         (membre de l'expédition qui veille).
--
--       Cohérent avec la philosophie V0.7 : "la marche prime sur l'or" — le vrai
--       droit de nommer un territoire vient de l'avoir foulé en personne et d'y
--       veiller, pas de l'avoir financé.
--
-- Pour conserver la signature de `_user_blob_influence` (3 args) appelée par
-- `get_territory_votes`, `propose_territory_name` et `vote_territory_name`
-- (mig 013), on redéfinit la fonction pour retourner directement le compte
-- de lieux veillés. Le seuil app_settings.territory_vote_per_influence est
-- mis à 1 pour que la formule `1 + (count / threshold)` donne `1 + count`.

BEGIN;

-- ============================================================
-- 1. _user_blob_influence — compte de lieux veillés du blob
-- ============================================================

CREATE OR REPLACE FUNCTION public._user_blob_influence(
  p_user_id        text,
  p_blob_place_ids text[],
  p_faction_id     text
) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  IF p_user_id IS NULL OR p_blob_place_ids IS NULL OR array_length(p_blob_place_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- V0.7 : nombre de lieux du blob où l'user est veilleur direct
  -- (membre de l'expédition qui veille). Les lieux neutres ne comptent pas
  -- (cohérent avec _blob_dominant_faction mig 101).
  SELECT COUNT(DISTINCT pv.place_id)
  INTO v_count
  FROM place_veille pv
  JOIN expedition_members em ON em.expedition_id = pv.expedition_id
  WHERE pv.place_id = ANY(p_blob_place_ids)
    AND em.user_id = p_user_id
    AND pv.is_neutral = false;

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public._user_blob_influence(text, text[], text) TO anon, authenticated, service_role;

-- ============================================================
-- 2. Seuil app_settings = 1 (1 vote bonus par lieu veillé)
-- ============================================================

INSERT INTO app_settings (key, value)
VALUES ('territory_vote_per_influence', '1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

COMMIT;
