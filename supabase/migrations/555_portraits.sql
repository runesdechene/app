-- WHY: Missives, lot 3, tâche 1 : savoir qui lit les Missives.
--      1. portraits : les réponses au questionnaire « Dis-nous qui tu es », une ligne par personne, remplacée à
--         chaque envoi. Les réponses hors liste sont refusées ici, pas seulement par la page.
--      2. questionnaire_repondre : seule porte d'écriture, appelée par la fonction Netlify (lien signé vérifié).
--      3. hub_qui_sont_ils : la répartition des réponses (tous, prospects, porteurs), les attentes, les
--         anniversaires du mois. hub_ses_missives : ce que la fiche d'un compte montre de ses Missives.
-- SCHEMA CHECKED (23/10/2026, live) : _liste_membres(text) (539) ; ambassadeurs(user_id, role) ;
--   suite_inscriptions, suites (548) ; missive_envois(missive_id, user_id, statut, envoye_le) ;
--   users(first_name, accord_nouvelles, accord_nouvelles_le, accord_nouvelles_porte) ; aucune table portraits.

CREATE TABLE public.portraits (
  user_id     varchar PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  epoques     text[] NOT NULL DEFAULT '{}' CHECK (cardinality(epoques) <= 2
                AND epoques <@ ARRAY['grece', 'rome', 'celtes', 'scandinavie', 'moyen_age', 'nature', 'autre']),
  decouverte  text[] NOT NULL DEFAULT '{}'
                CHECK (decouverte <@ ARRAY['stand', 'instagram', 'tiktok', 'ami', 'flyer', 'recherche', 'autrement']),
  amene       text[] NOT NULL DEFAULT '{}'
                CHECK (amene <@ ARRAY['histoire', 'lieux', 'cadeau', 'communaute', 'curiosite']),
  plait       text[] NOT NULL DEFAULT '{}'
                CHECK (plait <@ ARRAY['illustrations', 'histoires', 'qualite', 'ethique', 'carte', 'communaute']),
  attente     text CHECK (char_length(attente) <= 1000),
  departement text CHECK (char_length(departement) <= 60),
  anniv_jour  smallint,
  anniv_mois  smallint,
  repondu_le  timestamptz NOT NULL DEFAULT now(),
  -- Le jour et le mois vont ensemble, et forment une date d'une année bissextile (le 29/02 existe).
  CHECK ((anniv_jour IS NULL) = (anniv_mois IS NULL)),
  CHECK (anniv_jour IS NULL OR make_date(2024, anniv_mois, anniv_jour) IS NOT NULL)
);

ALTER TABLE public.portraits ENABLE ROW LEVEL SECURITY;
CREATE POLICY portraits_equipe ON public.portraits FOR SELECT TO authenticated USING ((SELECT _is_admin()));
REVOKE ALL ON public.portraits FROM anon;

-- p : { epoques, decouverte, amene, plait, attente, departement, anniv_jour, anniv_mois }.
CREATE FUNCTION public.questionnaire_repondre(p_user varchar, p jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO portraits (user_id, epoques, decouverte, amene, plait, attente, departement, anniv_jour, anniv_mois)
  VALUES (
    p_user,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'epoques', '[]'))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'decouverte', '[]'))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'amene', '[]'))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p->'plait', '[]'))),
    NULLIF(btrim(p->>'attente'), ''),
    NULLIF(btrim(p->>'departement'), ''),
    (p->>'anniv_jour')::smallint,
    (p->>'anniv_mois')::smallint
  )
  ON CONFLICT (user_id) DO UPDATE SET
    epoques = EXCLUDED.epoques, decouverte = EXCLUDED.decouverte, amene = EXCLUDED.amene, plait = EXCLUDED.plait,
    attente = EXCLUDED.attente, departement = EXCLUDED.departement,
    anniv_jour = EXCLUDED.anniv_jour, anniv_mois = EXCLUDED.anniv_mois, repondu_le = now();
$function$;

CREATE FUNCTION public.hub_qui_sont_ils(p_segment text DEFAULT 'tous')
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

  WITH qui AS (
    SELECT p.*, u.first_name
      FROM portraits p
      JOIN _liste_membres(p_segment) m ON m.user_id = p.user_id
      JOIN users u ON u.id = p.user_id
  ),
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
          FROM qui WHERE anniv_mois = extract(month FROM now() AT TIME ZONE 'Europe/Paris')), '[]'::jsonb)
  ) INTO v_resultat;

  RETURN v_resultat;
END;
$function$;

CREATE FUNCTION public.hub_ses_missives(p_user varchar)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;

  SELECT jsonb_build_object(
    'accord', u.accord_nouvelles,
    'accord_le', u.accord_nouvelles_le,
    'porte', u.accord_nouvelles_porte,
    'listes', ARRAY(SELECT l FROM unnest(ARRAY['prospects', 'porteurs', 'meilleurs', 'ambassadeurs']) l
                     WHERE EXISTS (SELECT 1 FROM _liste_membres(l) m WHERE m.user_id = u.id)),
    'ambassadeur', (SELECT role FROM ambassadeurs WHERE user_id = u.id),
    'portrait', (SELECT to_jsonb(p) - 'user_id' FROM portraits p WHERE p.user_id = u.id),
    'suite', (SELECT jsonb_build_object('cle', s.cle, 'nom', s.nom, 'jour_fait', i.jour_fait,
                                        'prochaine_le', i.prochaine_le, 'arretee_le', i.arretee_le)
                FROM suite_inscriptions i JOIN suites s ON s.cle = i.suite
               WHERE i.user_id = u.id ORDER BY i.inscrit_le DESC LIMIT 1),
    'derniers_envois', COALESCE((SELECT jsonb_agg(e) FROM (
        SELECT jsonb_build_object('objet', mi.objet, 'statut', me.statut, 'le', me.envoye_le) AS e
          FROM missive_envois me JOIN missives mi ON mi.id = me.missive_id
         WHERE me.user_id = u.id AND me.envoye_le IS NOT NULL
         ORDER BY me.envoye_le DESC LIMIT 5) t), '[]'::jsonb)
  ) INTO v_resultat
  FROM users u WHERE u.id = p_user;

  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.questionnaire_repondre(varchar, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.questionnaire_repondre(varchar, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.hub_qui_sont_ils(text), public.hub_ses_missives(varchar) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_qui_sont_ils(text), public.hub_ses_missives(varchar) TO authenticated;
