-- WHY: Missives, lot 3, tâche 7 : l'anniversaire se demande aussi à la création du compte (stand, appli), facultatif.
--      1. hub_poser_anniversaire (l'équipe, au stand, après la création du compte) et donner_anniversaire (le compte
--         connecté, pour l'appli) passent par _poser_anniversaire, qui n'écrit que le jour et le mois : les réponses au questionnaire, s'il y en a, restent.
--      2. Un portrait qui n'a que l'anniversaire n'a pas répondu au questionnaire : repondu_le devient NULL tant
--         que personne n'a répondu, et « Qui sont-ils ? » ne compte que ceux qui ont répondu (les anniversaires du
--         mois, eux, les prennent tous).
--      Définitions live du 24/10 (mig 555, appliquée hier) recopiées entières ; seul le delta change.
-- SCHEMA CHECKED (24/10/2026, live) : portraits(repondu_le timestamptz NOT NULL DEFAULT now()) ;
--   questionnaire_repondre(varchar, jsonb) et hub_qui_sont_ils(text) de la 555.

ALTER TABLE public.portraits ALTER COLUMN repondu_le DROP NOT NULL, ALTER COLUMN repondu_le DROP DEFAULT;

CREATE FUNCTION public._poser_anniversaire(p_user varchar, p_jour smallint, p_mois smallint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO portraits (user_id, anniv_jour, anniv_mois) VALUES (p_user, p_jour, p_mois)
  ON CONFLICT (user_id) DO UPDATE SET anniv_jour = EXCLUDED.anniv_jour, anniv_mois = EXCLUDED.anniv_mois;
$function$;

CREATE FUNCTION public.hub_poser_anniversaire(p_user varchar, p_jour smallint, p_mois smallint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  PERFORM _poser_anniversaire(p_user, p_jour, p_mois);
END;
$function$;

CREATE FUNCTION public.donner_anniversaire(p_jour smallint, p_mois smallint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN PERFORM _refus('Connecte-toi d’abord', 'session'); END IF;
  PERFORM _poser_anniversaire(auth.uid()::text, p_jour, p_mois);
END;
$function$;

CREATE OR REPLACE FUNCTION public.questionnaire_repondre(p_user varchar, p jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO portraits (user_id, epoques, decouverte, amene, plait, attente, departement, anniv_jour, anniv_mois, repondu_le)
  VALUES (
    p_user,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'epoques', '[]'))),
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
    epoques = EXCLUDED.epoques, decouverte = EXCLUDED.decouverte, amene = EXCLUDED.amene, plait = EXCLUDED.plait,
    attente = EXCLUDED.attente, departement = EXCLUDED.departement,
    anniv_jour = EXCLUDED.anniv_jour, anniv_mois = EXCLUDED.anniv_mois, repondu_le = now();
$function$;

CREATE OR REPLACE FUNCTION public.hub_qui_sont_ils(p_segment text DEFAULT 'tous')
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

REVOKE ALL ON FUNCTION public._poser_anniversaire(varchar, smallint, smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hub_poser_anniversaire(varchar, smallint, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_poser_anniversaire(varchar, smallint, smallint) TO authenticated;
REVOKE ALL ON FUNCTION public.donner_anniversaire(smallint, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donner_anniversaire(smallint, smallint) TO authenticated;
