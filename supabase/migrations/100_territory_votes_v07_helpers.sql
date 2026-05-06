-- 100_territory_votes_v07_helpers.sql
-- WHY : la mig 077 a droppé les tables V0.5 (place_influence, user_place_influence)
--       sans réécrire les 2 helpers `_blob_dominant_faction` et `_user_blob_influence`
--       (définis mig 013). Résultat : les 3 RPCs publiques `get_territory_votes`,
--       `propose_territory_name`, `vote_territory_name` plantent à l'exécution
--       (relation does not exist), ce qui se manifeste côté UI par votePower=0
--       systématique → impossible de nommer un territoire ni de proposer.
--
--       Réparation ciblée : redéfinir les 2 helpers avec une sémantique V0.7
--       (place_court_action) sans toucher aux 3 RPCs publiques (mig 013) qui
--       les appellent — leur signature et leur retour sont conservés.
--
-- SÉMANTIQUE V0.7 :
--   _blob_dominant_faction(blob)
--     = faction la plus représentée parmi les places.faction_id du blob.
--       Source stable (faction d'origine du lieu, settée à la création).
--       Aligne avec le concept "héritage du territoire" : qui contrôle le blob
--       par la faction d'origine de ses lieux.
--
--   _user_blob_influence(user, blob, faction)
--     = somme des Couronnes investies en MÉCÉNAT POSITIF (side='defense') par
--       l'user sur les lieux du blob. La faction passée n'est plus utilisée
--       (signature conservée pour compat avec les appels existants).
--       Aligne avec V0.7 : tu investis dans le territoire, tu gagnes du poids
--       dans son nommage. Threshold app_settings.territory_vote_per_influence
--       (default 10) → 10 Couronnes = +1 vote bonus.

BEGIN;

-- ============================================================
-- 1. _blob_dominant_faction — V0.7 (places.faction_id dominante)
-- ============================================================

CREATE OR REPLACE FUNCTION public._blob_dominant_faction(p_blob_place_ids text[])
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_faction TEXT;
BEGIN
  IF p_blob_place_ids IS NULL OR array_length(p_blob_place_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT faction_id INTO v_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  GROUP BY faction_id
  ORDER BY COUNT(*) DESC, faction_id ASC
  LIMIT 1;

  RETURN v_faction;
END;
$$;

GRANT EXECUTE ON FUNCTION public._blob_dominant_faction(text[]) TO anon, authenticated, service_role;

-- ============================================================
-- 2. _user_blob_influence — V0.7 (Couronnes de mécénat positif)
-- ============================================================

CREATE OR REPLACE FUNCTION public._user_blob_influence(
  p_user_id        text,
  p_blob_place_ids text[],
  p_faction_id     text
) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_total INT;
BEGIN
  IF p_user_id IS NULL OR p_blob_place_ids IS NULL OR array_length(p_blob_place_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(pca.amount), 0)
  INTO v_total
  FROM place_court_action pca
  WHERE pca.user_id = p_user_id
    AND pca.place_id = ANY(p_blob_place_ids)
    AND pca.side = 'defense';

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public._user_blob_influence(text, text[], text) TO anon, authenticated, service_role;

COMMIT;
