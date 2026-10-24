-- WHY: Uriel, 24/10 : « Un petit mot pour l'équipe ou sur notre mission ? », un champ libre sous
--      « Qu'attends-tu de nous ? ». portraits.mot le garde ; questionnaire_repondre l'écrit ;
--      hub_qui_sont_ils rend les derniers mots comme les attentes.
-- SCHEMA CHECKED (24/10/2026) : questionnaire_repondre et hub_qui_sont_ils = la 560, appliquée et vérifiée
--      en prod le même jour, copiées entières.

ALTER TABLE public.portraits ADD COLUMN mot text CHECK (char_length(mot) <= 1000);

CREATE OR REPLACE FUNCTION public.questionnaire_repondre(p_user character varying, p jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO portraits (user_id, epoques, epoque_autre, decouverte, decouverte_autre, amene, plait, attente, mot, departement, anniv_jour, anniv_mois, repondu_le)
  VALUES (
    p_user,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'epoques', '[]'))),
    -- Le texte libre ne vaut qu'avec la case « Une autre ».
    CASE WHEN p->'epoques' ? 'autre' THEN NULLIF(btrim(p->>'epoque_autre'), '') END,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'decouverte', '[]'))),
    CASE WHEN p->'decouverte' ? 'autrement' THEN NULLIF(btrim(p->>'decouverte_autre'), '') END,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'amene', '[]'))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'plait', '[]'))),
    NULLIF(btrim(p->>'attente'), ''),
    NULLIF(btrim(p->>'mot'), ''),
    NULLIF(btrim(p->>'departement'), ''),
    (p->>'anniv_jour')::smallint,
    (p->>'anniv_mois')::smallint,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    epoques = EXCLUDED.epoques, epoque_autre = EXCLUDED.epoque_autre,
    decouverte = EXCLUDED.decouverte, decouverte_autre = EXCLUDED.decouverte_autre, amene = EXCLUDED.amene, plait = EXCLUDED.plait,
    attente = EXCLUDED.attente, mot = EXCLUDED.mot, departement = EXCLUDED.departement,
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
    -- Ce que les réponses « autre » précisent, par question, le plus cité d'abord.
    'libres', jsonb_build_object(
      'epoques', COALESCE((SELECT jsonb_agg(jsonb_build_object('texte', texte, 'nombre', nombre) ORDER BY nombre DESC, texte)
          FROM (SELECT min(epoque_autre) AS texte, count(*) AS nombre FROM qui WHERE epoque_autre IS NOT NULL
                 GROUP BY lower(btrim(epoque_autre))) e), '[]'::jsonb),
      'decouverte', COALESCE((SELECT jsonb_agg(jsonb_build_object('texte', texte, 'nombre', nombre) ORDER BY nombre DESC, texte)
          FROM (SELECT min(decouverte_autre) AS texte, count(*) AS nombre FROM qui WHERE decouverte_autre IS NOT NULL
                 GROUP BY lower(btrim(decouverte_autre))) d), '[]'::jsonb)),
    'attentes', COALESCE((SELECT jsonb_agg(a) FROM (
        SELECT jsonb_build_object('id', user_id, 'nom', first_name, 'texte', attente, 'le', repondu_le) AS a
          FROM qui WHERE attente IS NOT NULL ORDER BY repondu_le DESC LIMIT 20) t), '[]'::jsonb),
    'mots', COALESCE((SELECT jsonb_agg(a) FROM (
        SELECT jsonb_build_object('id', user_id, 'nom', first_name, 'texte', mot, 'le', repondu_le) AS a
          FROM qui WHERE mot IS NOT NULL ORDER BY repondu_le DESC LIMIT 20) t), '[]'::jsonb),
    'anniversaires_du_mois', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', user_id, 'nom', first_name, 'jour', anniv_jour)
        ORDER BY anniv_jour)
          FROM tous WHERE anniv_mois = extract(month FROM now() AT TIME ZONE 'Europe/Paris')), '[]'::jsonb)
  ) INTO v_resultat;

  RETURN v_resultat;
END;
$function$;
