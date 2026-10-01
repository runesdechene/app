-- WHY: les Actifs sur la carte de la V2 (spec 2026-10-01-v2-actifs, maquettes Figma 362:182,
--      363:200, 363:303, validées par Uriel le 01/10/2026). On voit les Explorateurs en ligne, et
--      ceux passés dans l'heure — pour le sentiment de vie.
--   1. signaler_presence (copiée de sa définition live) : une présence vit une heure, plus dix
--      minutes. Les compagnons (_presents_autour) gardent leur fenêtre de dix minutes.
--   2. actifs_carte() : les Explorateurs vus depuis moins d'une heure, sauf soi, avec ce que la
--      carte et la carte d'un Explorateur affichent (nom, portrait, niveau, titre, signe). Pistes
--      brouillées : la position est déplacée de 0 à 40 km dans une direction tirée du jour et de
--      l'Explorateur — stable dans la journée ; la zone de 50 km dessinée autour contient donc la
--      vraie position sans la révéler. La vraie position ne sort jamais de la base.
-- SCHEMA CHECKED (01/10/2026, information_schema et définition live) : presences(user_id text,
--      latitude double precision, longitude double precision, vu_a timestamptz) ;
--      users(brouiller_pistes boolean, displayed_title_ids_v3 array, signe_fragment_id int,
--      avatar_url, xp_total, display_name, first_name) ; titles(id, name, type) ;
--      title_fragments(id, name varchar, image_url, icon_url, visible) ; user_public_name ;
--      _level_from_xp ; signaler_presence(double precision, double precision) copiée du live.

CREATE OR REPLACE FUNCTION public.signaler_presence(p_lat double precision, p_lng double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  INSERT INTO presences (user_id, latitude, longitude, vu_a)
  VALUES ((auth.uid())::text, p_lat, p_lng, now())
  ON CONFLICT (user_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, vu_a = now();
  -- 402 : une heure, pour les Actifs de la carte (les compagnons regardent dix minutes).
  DELETE FROM presences WHERE vu_a < now() - interval '1 hour';
END;
$function$;

CREATE OR REPLACE FUNCTION public.actifs_carte()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH a AS (
      SELECT p.user_id, p.vu_a, p.latitude AS lat, p.longitude AS lng, u.brouiller_pistes AS brouille,
             -- le déplacement du jour : une direction et une distance (0 à 40 km) par Explorateur
             radians((abs(hashtext(p.user_id || current_date::text)) % 360)::double precision) AS angle,
             (abs(hashtext(p.user_id || 'r' || current_date::text)) % 40000) / 1000.0 AS km
      FROM presences p JOIN users u ON u.id = p.user_id
      WHERE p.vu_a > now() - interval '1 hour' AND p.user_id <> v_moi)
    SELECT COALESCE(json_agg(json_build_object(
      'id', u.id,
      'nom', user_public_name(u.id, u.display_name, u.first_name),
      'avatar', u.avatar_url,
      'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
      'titre', (SELECT t.name
                FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                JOIN titles t ON t.id = x.tid AND t.type = 'general'
                ORDER BY x.ord LIMIT 1),
      'signe', (SELECT json_build_object('nom', tf.name, 'imageUrl', COALESCE(tf.image_url, tf.icon_url))
                FROM title_fragments tf WHERE tf.id = u.signe_fragment_id AND tf.visible),
      'lat', CASE WHEN a.brouille THEN a.lat + a.km / 111.0 * cos(a.angle) ELSE a.lat END,
      'lng', CASE WHEN a.brouille THEN a.lng + a.km / (111.0 * cos(radians(a.lat))) * sin(a.angle)
                  ELSE a.lng END,
      'brouille', a.brouille,
      'vuA', a.vu_a,
      'enLigne', a.vu_a > now() - interval '10 minutes')
      ORDER BY a.vu_a DESC), '[]'::json)
    FROM a JOIN users u ON u.id = a.user_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.actifs_carte() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actifs_carte() TO authenticated;
