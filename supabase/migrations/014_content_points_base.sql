-- 014_content_points_base.sql
--
-- Fix régression introduite par 013 + bug latent du baseline (30 avril 2026, Uriel + XO).
--
-- Bug observé : après la migration 013, plus aucun territoire n'avait de faction
-- dominante calculable (`_blob_dominant_faction` retournait NULL pour Arles et co)
-- => votePower = 0 pour TOUS les territoires => personne ne peut voter, même
-- ceux qui sont de la "bonne faction".
--
-- Cause :
--   1. `recalc_place_content_points` (depuis le baseline) reset content_points à
--      0 puis ne le repopule QUE pour les contributions ayant `votes_up > 0`.
--   2. Avant 005, l'ancienne version de `create_place` (v3/v4 baseline) faisait
--      un INSERT direct content_points = 10 ou 20 dans `place_influence`. Cet
--      "héritage" alimentait les territoires sans dépendre des votes.
--   3. Migration 005 a remplacé create_place par une version qui appelle recalc
--      à la place de l'INSERT direct, mais n'a PAS rejoué recalc sur les lieux
--      existants — l'héritage de v3/v4 est resté en base.
--   4. Mon backfill section 7.3 de 013 (`PERFORM recalc_place_content_points`
--      sur tous les lieux) a wipé cet héritage. Tous les lieux dont les carnets
--      n'ont pas de votes_up se sont retrouvés à content_points = 0.
--
-- Correctif : changer la logique de recalc pour donner des points de BASE par
-- contribution carnet (indépendamment des votes), avec les bonus de rang
-- conservés en sus quand des votes existent. Cohérent SPEC V0.5 :
--   * Carnet créé      → +10 base (validé : ajouter une page de carnet = +10 influence)
--   * Carnet avec photo → +10 supplémentaires (en pratique systématique : on ne
--     peut pas créer un lieu sans photo)
--   * Bonus rang       → +10 (rang 1), +5 (rang 2), +2 (rang 3) si votes_up > 0
--
-- Re-exécution recalc sur tous les lieux pour restaurer.

CREATE OR REPLACE FUNCTION public.recalc_place_content_points(p_place_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_rank INT := 0;
  v_pts INT;
  v_faction_totals JSONB := '{}'::JSONB;
  v_user_faction_totals JSONB := '{}'::JSONB;
  v_user_faction_key TEXT;
  v_current INT;
  v_user_id TEXT;
  v_faction_id TEXT;
  v_has_images BOOLEAN;
  v_base_pts INT;
BEGIN
  -- Reset agrégats et granulaire pour ce lieu
  UPDATE place_influence      SET content_points = 0 WHERE place_id = p_place_id;
  UPDATE user_place_influence SET content_points = 0 WHERE place_id = p_place_id;

  -- Étape 1 : points de base par contribution carnet (TOUS, indépendant des votes)
  FOR r IN
    SELECT pc.user_id, pc.faction_id, pc.images
    FROM place_contributions pc
    WHERE pc.place_id = p_place_id
      AND pc.type = 'carnet'
      AND pc.faction_id IS NOT NULL
  LOOP
    v_has_images := (jsonb_typeof(r.images) = 'array' AND jsonb_array_length(r.images) > 0);
    v_base_pts := 10 + CASE WHEN v_has_images THEN 10 ELSE 0 END;

    -- Total par faction
    v_current := COALESCE((v_faction_totals->>r.faction_id)::INT, 0);
    v_faction_totals := jsonb_set(v_faction_totals, ARRAY[r.faction_id], to_jsonb(v_current + v_base_pts));

    -- Total par (user, faction)
    v_user_faction_key := r.user_id || '|' || r.faction_id;
    v_current := COALESCE((v_user_faction_totals->>v_user_faction_key)::INT, 0);
    v_user_faction_totals := jsonb_set(v_user_faction_totals, ARRAY[v_user_faction_key], to_jsonb(v_current + v_base_pts));
  END LOOP;

  -- Étape 2 : bonus de rang pour les contributions avec votes_up > 0
  v_rank := 0;
  FOR r IN
    SELECT pc.user_id, pc.faction_id, (pc.votes_up - pc.votes_down) AS net_votes
    FROM place_contributions pc
    WHERE pc.place_id = p_place_id
      AND pc.type = 'carnet'
      AND pc.faction_id IS NOT NULL
      AND pc.votes_up > 0
    ORDER BY (pc.votes_up - pc.votes_down) DESC, pc.created_at ASC
  LOOP
    v_rank := v_rank + 1;
    v_pts := CASE
      WHEN v_rank = 1 THEN 10
      WHEN v_rank = 2 THEN 5
      WHEN v_rank = 3 THEN 2
      ELSE 0
    END;

    IF v_pts = 0 THEN
      CONTINUE;
    END IF;

    -- Bonus par faction
    v_current := COALESCE((v_faction_totals->>r.faction_id)::INT, 0);
    v_faction_totals := jsonb_set(v_faction_totals, ARRAY[r.faction_id], to_jsonb(v_current + v_pts));

    -- Bonus par (user, faction)
    v_user_faction_key := r.user_id || '|' || r.faction_id;
    v_current := COALESCE((v_user_faction_totals->>v_user_faction_key)::INT, 0);
    v_user_faction_totals := jsonb_set(v_user_faction_totals, ARRAY[v_user_faction_key], to_jsonb(v_current + v_pts));
  END LOOP;

  -- Insert agrégats par faction
  FOR r IN SELECT key AS faction_id, value::INT AS pts FROM jsonb_each_text(v_faction_totals)
  LOOP
    INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
    VALUES (p_place_id, r.faction_id, r.pts, NOW())
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET content_points = r.pts, updated_at = NOW();
  END LOOP;

  -- Insert granulaire user × faction
  FOR r IN SELECT key AS user_faction_key, value::INT AS pts FROM jsonb_each_text(v_user_faction_totals)
  LOOP
    v_user_id := split_part(r.user_faction_key, '|', 1);
    v_faction_id := split_part(r.user_faction_key, '|', 2);

    INSERT INTO user_place_influence (user_id, place_id, faction_id, content_points, updated_at)
    VALUES (v_user_id, p_place_id, v_faction_id, r.pts, NOW())
    ON CONFLICT (user_id, place_id, faction_id)
    DO UPDATE SET content_points = r.pts, updated_at = NOW();
  END LOOP;
END;
$$;

-- Re-exécution sur tous les lieux pour restaurer les content_points wipés par 013
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.places WHERE place_type_id = 'lieu' LOOP
    PERFORM public.recalc_place_content_points(rec.id);
  END LOOP;
END;
$$;
