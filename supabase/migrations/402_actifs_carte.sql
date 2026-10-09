-- WHY: les Actifs sur la carte de la V2 (spec 2026-10-01-v2-actifs, maquettes Figma 362:182,
--      363:200, 363:303, validées par Uriel le 01/10/2026). On voit les Explorateurs en ligne, et
--      ceux passés dans l'heure — pour le sentiment de vie.
--   1. signaler_presence (copiée de sa définition live) : une présence vit une heure, plus dix
--      minutes. Les compagnons (_presents_autour) gardent leur fenêtre de dix minutes.
--   2. grille_brouillage : l'origine secrète d'une grille de cases d'environ 20 km, tirée une fois,
--      fermée à tous (seules les fonctions de la base la lisent).
--   3. actifs_carte() : les Explorateurs vus depuis moins d'une heure, sauf soi, avec ce que la
--      carte et la carte d'un Explorateur affichent (nom, portrait, niveau, titre, signe). Pistes
--      brouillées : on rend le centre de la case où l'on se trouve — jamais le point. Sans le
--      secret, on ne remonte pas au point ; dans la case, on ne voit pas bouger ; et revenir chaque
--      jour au même endroit redonne la même case, rien de plus (moyenner n'apprend rien). Le centre
--      est à 15 km au plus du point : la zone de 50 km dessinée autour le contient toujours.
--      Le signe : seulement un Fragment possédé et illustré, comme sur le profil (357).
--      (Relecture du 01/10 : un décalage tiré de hashtext(id + date) se recalculait hors de la base.)
-- SCHEMA CHECKED (01/10/2026, information_schema et définition live) : presences(user_id text,
--      latitude double precision, longitude double precision, vu_a timestamptz) ;
--      users(brouiller_pistes boolean, displayed_title_ids_v3 array, signe_fragment_id int,
--      avatar_url, xp_total, display_name, first_name) ; titles(id, name, type) ;
--      title_fragments(id, name varchar, image_url, icon_url, visible) ; user_public_name ;
--      _level_from_xp ; user_fragments(user_id, fragment_id) ; signaler_presence(double precision,
--      double precision) copiée du live.

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

CREATE TABLE public.grille_brouillage (
  seule boolean PRIMARY KEY DEFAULT true CHECK (seule),
  olat double precision NOT NULL,
  olng double precision NOT NULL
);
-- Une case : 0,2° de latitude (22 km) sur 0,3° de longitude (21 km en France).
INSERT INTO public.grille_brouillage (olat, olng) VALUES (random() * 0.2, random() * 0.3);
ALTER TABLE public.grille_brouillage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.grille_brouillage FROM PUBLIC, anon, authenticated;

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
      SELECT p.user_id, p.vu_a, u.brouiller_pistes AS brouille,
             CASE WHEN u.brouiller_pistes
                  THEN floor((p.latitude - g.olat) / 0.2) * 0.2 + g.olat + 0.1
                  ELSE p.latitude END AS lat,
             CASE WHEN u.brouiller_pistes
                  THEN floor((p.longitude - g.olng) / 0.3) * 0.3 + g.olng + 0.15
                  ELSE p.longitude END AS lng
      FROM presences p JOIN users u ON u.id = p.user_id CROSS JOIN grille_brouillage g
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
                FROM title_fragments tf
                WHERE tf.id = u.signe_fragment_id AND tf.visible
                  AND COALESCE(tf.image_url, tf.icon_url) IS NOT NULL
                  AND EXISTS (SELECT 1 FROM user_fragments uf
                              WHERE uf.user_id = u.id AND uf.fragment_id = tf.id)),
      'lat', a.lat,
      'lng', a.lng,
      'brouille', a.brouille,
      'vuA', a.vu_a,
      'enLigne', a.vu_a > now() - interval '10 minutes')
      ORDER BY a.vu_a DESC), '[]'::json)
    FROM a JOIN users u ON u.id = a.user_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.actifs_carte() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actifs_carte() TO authenticated;
