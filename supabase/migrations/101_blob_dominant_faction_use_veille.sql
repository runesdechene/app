-- 101_blob_dominant_faction_use_veille.sql
-- WHY : la mig 100 utilisait `places.faction_id` comme source de la "faction
--       dominante" du blob. Ce champ est en réalité l'HÉRITAGE CULTUREL du lieu
--       (son type, settée à la création) — il n'a rien à voir avec qui contrôle
--       le lieu en V0.7.
--
--       La vraie source V0.7 est `place_veille.faction_id` : la faction de
--       l'expédition qui veille actuellement le lieu. Si un lieu est vacant
--       (pas de veille) ou neutre (is_neutral=true), il n'entre pas dans le
--       calcul de la faction dominante.
--
-- Aucun changement à `_user_blob_influence` (mig 100) — la sémantique
-- "Couronnes de défense investies par l'user" reste correcte.

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

  -- V0.7 : la faction qui contrôle le territoire = la faction la plus
  -- représentée parmi les VEILLEURS actifs (place_veille) du blob.
  -- Les lieux vacants ou neutres n'entrent pas dans le calcul.
  SELECT pv.faction_id INTO v_faction
  FROM place_veille pv
  WHERE pv.place_id = ANY(p_blob_place_ids)
    AND pv.faction_id IS NOT NULL
    AND pv.is_neutral = false
  GROUP BY pv.faction_id
  ORDER BY COUNT(*) DESC, pv.faction_id ASC
  LIMIT 1;

  RETURN v_faction;
END;
$$;

GRANT EXECUTE ON FUNCTION public._blob_dominant_faction(text[]) TO anon, authenticated, service_role;
