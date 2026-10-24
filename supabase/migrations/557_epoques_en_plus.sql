-- WHY: Uriel, 24/10 : onze époques de plus dans « Quelle époque t'appelle ? » (de l'Égypte antique à la
--      Première Guerre mondiale), et un champ libre sous « Une autre » pour dire laquelle. « Rome » devient
--      « L'Empire romain » à l'écran, sous la même clé : les réponses déjà données ne bougent pas.
--      1. la liste des époques permises s'élargit (toujours deux au plus) ;
--      2. portraits.epoque_autre : le texte libre, gardé seulement si « autre » est cochée ;
--      3. questionnaire_repondre l'écrit ; hub_qui_sont_ils rend les époques libres, les plus citées d'abord.
-- SCHEMA CHECKED (24/10/2026, live) : contrainte portraits_epoques_check ; questionnaire_repondre et
--      hub_qui_sont_ils copiées entières de pg_get_functiondef (= la 555).

ALTER TABLE public.portraits DROP CONSTRAINT portraits_epoques_check;
ALTER TABLE public.portraits ADD CONSTRAINT portraits_epoques_check CHECK (cardinality(epoques) <= 2
  AND epoques <@ ARRAY['egypte', 'grece', 'rome', 'celtes', 'byzance', 'scandinavie', 'amazigh', 'slave', 'moyen_age',
    'ecosse', 'renaissance', 'explorateurs', 'napoleon', 'belle_epoque', 'jules_verne', 'grande_guerre', 'nature', 'autre']);

ALTER TABLE public.portraits ADD COLUMN epoque_autre text CHECK (char_length(epoque_autre) <= 60);

CREATE OR REPLACE FUNCTION public.questionnaire_repondre(p_user character varying, p jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO portraits (user_id, epoques, epoque_autre, decouverte, amene, plait, attente, departement, anniv_jour, anniv_mois, repondu_le)
  VALUES (
    p_user,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'epoques', '[]'))),
    -- Le texte libre ne vaut qu'avec la case « Une autre ».
    CASE WHEN p->'epoques' ? 'autre' THEN NULLIF(btrim(p->>'epoque_autre'), '') END,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'decouverte', '[]'))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'amene', '[]'))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'plait', '[]'))),
    NULLIF(btrim(p->>'attente'), ''),
    NULLIF(btrim(p->>'departement'), ''),
    (p->>'anniv_jour')::smallint,
    (p->>'anniv_mois')::smallint,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    epoques = EXCLUDED.epoques, epoque_autre = EXCLUDED.epoque_autre,
    decouverte = EXCLUDED.decouverte, amene = EXCLUDED.amene, plait = EXCLUDED.plait,
    attente = EXCLUDED.attente, departement = EXCLUDED.departement,
    anniv_jour = EXCLUDED.anniv_jour, anniv_mois = EXCLUDED.anniv_mois, repondu_le = now();
$function$;

CREATE OR REPLACE FUNCTION public.hub_qui_sont_ils(p_segment text DEFAULT 'tous'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_segment NOT IN ('tous', 'prospects', 'porteurs') THEN PERFORM _refus('Segment inconnu', 'segment'); END IF;

  WITH tous AS (
    SELECT p.*, u.first_name
      FROM portraits p
      JOIN _liste_membres(p_segment) m ON m.user_id = p.user_id
      JOIN users u ON u.id = p.user_id
  ),
  -- Ceux qui ont répondu au questionnaire, pas seulement donné leur anniversaire.
  qui AS (SELECT * FROM tous WHERE repondu_le IS NOT NULL),
  compte AS (
    SELECT question, cle, count(*) AS nombre
      FROM (
        SELECT 'epoques' AS question, unnest(epoques) AS cle FROM qui
        UNION ALL SELECT 'decouverte', unnest(decouverte) FROM qui
        UNION ALL SELECT 'amene', unnest(amene) FROM qui
        UNION ALL SELECT 'plait', unnest(plait) FROM qui
      ) r
     GROUP BY question, cle
  )
  SELECT jsonb_build_object(
    'repondants', (SELECT count(*) FROM qui),
    'reponses', COALESCE((SELECT jsonb_object_agg(question, liste) FROM (
        SELECT question, jsonb_agg(jsonb_build_object('cle', cle, 'nombre', nombre) ORDER BY nombre DESC, cle) AS liste
          FROM compte GROUP BY question) q), '{}'::jsonb),
    'epoques_autres', COALESCE((SELECT jsonb_agg(jsonb_build_object('texte', texte, 'nombre', nombre) ORDER BY nombre DESC, texte)
        FROM (SELECT min(epoque_autre) AS texte, count(*) AS nombre
                FROM qui WHERE epoque_autre IS NOT NULL
               GROUP BY lower(btrim(epoque_autre))) e), '[]'::jsonb),
    'attentes', COALESCE((SELECT jsonb_agg(a) FROM (
        SELECT jsonb_build_object('id', user_id, 'nom', first_name, 'texte', attente, 'le', repondu_le) AS a
          FROM qui WHERE attente IS NOT NULL ORDER BY repondu_le DESC LIMIT 20) t), '[]'::jsonb),
    'anniversaires_du_mois', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', user_id, 'nom', first_name, 'jour', anniv_jour)
        ORDER BY anniv_jour)
          FROM tous WHERE anniv_mois = extract(month FROM now() AT TIME ZONE 'Europe/Paris')), '[]'::jsonb)
  ) INTO v_resultat;

  RETURN v_resultat;
END;
$function$;
