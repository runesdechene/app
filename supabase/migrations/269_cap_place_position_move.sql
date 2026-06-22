-- 269_cap_place_position_move.sql
-- WHY : anti-triche sur la correction de position (mig 214).
--       La 214 déplaçait un lieu SANS plafond de distance — exploitable pour
--       traîner un lieu loin de son vrai spot (revendiquer/garder à distance).
--       On plafonne désormais le déplacement à 500 m du SPOT D'ORIGINE du lieu,
--       pas de la position courante : sinon des petits sauts répétés font dériver
--       le lieu à l'infini. L'origine = la 1re position connue
--       (plus vieux place_position_history.old_*), sinon la position actuelle si
--       le lieu n'a jamais été déplacé. Aucun changement de schéma, backfill auto.
--       Autorité serveur (le front ne fait qu'afficher l'erreur).
-- Décision Uriel 2026-06-22.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_place_position(
  p_user_id   text,
  p_place_id  text,
  p_latitude  real,
  p_longitude real,
  p_address   text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_author_id   text;
  v_old_lat     real;
  v_old_lng     real;
  v_old_address text;
  v_place_title text;
  v_is_eligible boolean;
  v_veilleur_id text;
  v_editor_name text;
  v_distance_km numeric;
  v_orig_lat    real;
  v_orig_lng    real;
  v_drift_km    numeric;
BEGIN
  -- Identité non spoofable : p_user_id doit correspondre au caller authentifié.
  -- Convention de l'app (cf. plant_flag mig 017, invest_crowns mig 021). Crucial
  -- ici : le modèle anti-abus repose sur la transparence (trace + notif), donc
  -- l'acteur tracé DOIT être authentique.
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT author_id, latitude, longitude, address, title
    INTO v_author_id, v_old_lat, v_old_lng, v_old_address, v_place_title
    FROM public.places WHERE id = p_place_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  -- Éligibilité serveur : auteur OU visiteur présent dans place_explorers.
  v_is_eligible := (v_author_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.place_explorers
               WHERE place_id = p_place_id AND user_id = p_user_id);
  IF NOT v_is_eligible THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Plafond anti-triche : la nouvelle position doit rester ≤ 500 m du spot
  -- d'origine. Origine = plus vieille position tracée (avant le 1er déplacement),
  -- sinon position actuelle si le lieu n'a jamais bougé.
  SELECT old_latitude, old_longitude INTO v_orig_lat, v_orig_lng
    FROM public.place_position_history
   WHERE place_id = p_place_id
   ORDER BY created_at ASC
   LIMIT 1;
  IF NOT FOUND THEN
    v_orig_lat := v_old_lat;
    v_orig_lng := v_old_lng;
  END IF;

  v_drift_km := public.haversine_km(
    v_orig_lat::numeric, v_orig_lng::numeric,
    p_latitude::numeric, p_longitude::numeric);
  IF v_drift_km > 0.5 THEN
    RETURN json_build_object(
      'error', 'too_far',
      'maxMeters', 500,
      'driftMeters', ROUND(v_drift_km * 1000));
  END IF;

  -- Trace (ancien + nouveau).
  INSERT INTO public.place_position_history
    (place_id, user_id, old_latitude, old_longitude,
     new_latitude, new_longitude, old_address, new_address)
  VALUES
    (p_place_id, p_user_id, v_old_lat, v_old_lng,
     p_latitude, p_longitude, v_old_address, p_address);

  -- Mise à jour immédiate, pour tous les joueurs.
  UPDATE public.places
     SET latitude = p_latitude, longitude = p_longitude,
         address = p_address, updated_at = NOW()
   WHERE id = p_place_id;

  -- Notifications : auteur + veilleur actuel, en excluant l'éditeur.
  -- Le veilleur = détenteur d'étendard V0.7 (place_veille.veilleur_user_id),
  -- pas le top contributeur de carnet. NULL si le lieu est vacant.
  SELECT pv.veilleur_user_id INTO v_veilleur_id
    FROM public.place_veille pv WHERE pv.place_id = p_place_id;
  -- haversine_km a la signature (numeric,...) ; les colonnes/vars sont real → cast.
  v_distance_km := public.haversine_km(
    v_old_lat::numeric, v_old_lng::numeric, p_latitude::numeric, p_longitude::numeric);
  SELECT first_name INTO v_editor_name FROM public.users WHERE id = p_user_id;

  IF v_author_id IS NOT NULL AND v_author_id <> p_user_id THEN
    PERFORM public.notify(v_author_id, 'place_position_edited', jsonb_build_object(
      'actorName', v_editor_name, 'actorId', p_user_id,
      'placeId', p_place_id, 'placeTitle', v_place_title,
      'distanceKm', ROUND(v_distance_km, 2)));
  END IF;

  IF v_veilleur_id IS NOT NULL
     AND v_veilleur_id <> p_user_id
     AND v_veilleur_id <> COALESCE(v_author_id, '') THEN
    PERFORM public.notify(v_veilleur_id, 'place_position_edited', jsonb_build_object(
      'actorName', v_editor_name, 'actorId', p_user_id,
      'placeId', p_place_id, 'placeTitle', v_place_title,
      'distanceKm', ROUND(v_distance_km, 2)));
  END IF;

  -- Trace globale.
  INSERT INTO public.activity_log (type, actor_id, place_id, data)
  VALUES ('place_position_edited', p_user_id, p_place_id, jsonb_build_object(
    'distanceKm', ROUND(v_distance_km, 2), 'editorName', v_editor_name));

  RETURN json_build_object('success', true,
    'latitude', p_latitude, 'longitude', p_longitude, 'address', p_address);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_place_position(text, text, real, real, text)
  TO authenticated, service_role;

COMMIT;
