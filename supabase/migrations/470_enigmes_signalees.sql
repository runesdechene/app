-- WHY: les joueurs trouvent les énigmes trop strictes (« Eudes » refusé pour « Eudes de Paris »). La
--      tolérance aux fautes (mig 003) ne devine pas une réponse incomplète, et l'élargir ferait passer
--      « Paris ». Donc : des réponses acceptées en plus, choisies par l'équipe, et un signalement du joueur
--      qui arrive dans le Hub (spec 2026-10-08-enigmes-signalees-design.md). Pas rétroactif.
--   1. enigmas.accepted_answers : les variantes.
--   2. _enigma_juste : juste si la réponse correspond à la réponse ou à une variante.
--   3. percer_enigme : définition live du 08/10, seule la ligne v_juste change.
--   4. signalements_enigme + signaler_enigme : calqués sur signalements_lieu (mig 387) ; la réponse du
--      joueur est relevée en base, jamais envoyée par l'appli.
--   5. signalements_enigme_du_hub / traiter_signalement_enigme : la file du Hub (admins).
--   6. Auto-tests : la migration échoue si le moindre cas se comporte mal.

-- 1.
ALTER TABLE public.enigmas ADD COLUMN accepted_answers text[] NOT NULL DEFAULT '{}';

-- 2.
CREATE OR REPLACE FUNCTION public._enigma_juste(p_reponse text, p_answer text, p_variantes text[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM unnest(array_prepend(p_answer, COALESCE(p_variantes, '{}'))) AS a
    WHERE public._enigma_answer_matches(p_reponse, a));
$function$;
REVOKE ALL ON FUNCTION public._enigma_juste(text, text, text[]) FROM PUBLIC, anon, authenticated;

-- 3.
CREATE OR REPLACE FUNCTION public.percer_enigme(p_eveil bigint, p_reponse text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi      text := auth.uid()::text;
  w          enigmes_eveillees := public._eveil_en_attente(p_eveil);
  e          enigmas;
  v_juste    boolean;
  v_genre    text;
  v_xp_avant int;
  v_xp_apres int;
  v_nouveaux text[] := '{}';
  v_prochain json;
  v_niveau   int;
  v_seuil    int;
  v_suivant  int;
BEGIN
  SELECT * INTO e FROM enigmas WHERE id = w.enigma_id;
  v_juste := CASE WHEN e.format = 'free' THEN public._enigma_juste(p_reponse, e.answer, e.accepted_answers)
                  ELSE public._enigma_normalize(p_reponse) = public._enigma_normalize(e.answer) END;
  SELECT COALESCE(xp_total, 0), COALESCE(title_gender, 'm') INTO v_xp_avant, v_genre FROM users WHERE id = v_moi;

  -- Pas de Couronnes (en sommeil dans Explore) : on n'appelle pas _answer_enigma_internal.
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained, eveil_id)
  VALUES (e.id, v_moi, left(p_reponse, 500), v_juste, 0, 0, w.id);

  IF v_juste THEN v_nouveaux := public._attribuer_titres_connaissance(v_moi, e.theme); END IF;
  SELECT COALESCE(xp_total, 0) INTO v_xp_apres FROM users WHERE id = v_moi;
  v_niveau := public._level_from_xp(v_xp_apres);
  v_seuil := public._xp_for_level(v_niveau);
  v_suivant := public._xp_for_level(v_niveau + 1);

  SELECT json_build_object('nom', public._nom_titre(t, v_genre),
                           'seuil', public._seuil_connaissance(e.theme, (t.condition->>'palier')::int))
    INTO v_prochain
    FROM titles t
   WHERE t.condition->>'stat' = 'connaissance' AND t.condition->>'theme' = e.theme
     AND NOT EXISTS (SELECT 1 FROM titres_connaissance c WHERE c.user_id = v_moi AND c.title_id = t.id)
   ORDER BY (t.condition->>'palier')::int LIMIT 1;

  RETURN json_build_object(
    'juste', v_juste,
    'reponse', e.answer,
    'explication', e.explanation,
    'xp', v_xp_apres - v_xp_avant,
    'niveau', v_niveau,
    -- Monter de niveau fait repartir la jauge de zéro (comme decouvrir_lieu, mig 401).
    'avant', CASE WHEN public._level_from_xp(v_xp_avant) < v_niveau THEN 0
                  ELSE round((v_xp_avant - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3) END,
    'apres', round((v_xp_apres - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3),
    'gagnes', CASE WHEN v_juste THEN public._poids_enigme(e.difficulty) ELSE 0 END,
    'points', public._points_connaissance(v_moi, e.theme),
    'total', public._total_connaissance(e.theme),
    'nouveauxTitres', to_json(v_nouveaux),
    'prochain', v_prochain,
    'resteEnAttente', json_array_length(public.enigmes_en_attente()));
END $function$;

-- 4.
CREATE TABLE public.signalements_enigme (
  id bigserial PRIMARY KEY,
  enigma_id integer NOT NULL REFERENCES public.enigmas(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  raison text NOT NULL CHECK (raison IN ('reponse_refusee', 'erreur', 'autre')),
  precision text CHECK (char_length(precision) <= 500),
  reponse_donnee text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  traite_le timestamptz,
  traite_par varchar REFERENCES public.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX signalements_enigme_ouvert ON public.signalements_enigme (enigma_id, user_id) WHERE traite_le IS NULL;
ALTER TABLE public.signalements_enigme ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signalements_enigme FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.signaler_enigme(p_enigme integer, p_raison text, p_precision text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_precision text := NULLIF(btrim(COALESCE(p_precision, '')), '');
  v_reponse text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF p_raison NOT IN ('reponse_refusee', 'erreur', 'autre') THEN
    RAISE EXCEPTION 'Raison inconnue' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(v_precision, '')) > 500 THEN
    RAISE EXCEPTION 'Un mot de 500 signes au plus' USING ERRCODE = '22023';
  END IF;
  -- Sa dernière réponse : on ne signale que ce qu'on a répondu.
  SELECT answer_given INTO v_reponse FROM enigma_responses
   WHERE enigma_id = p_enigme AND user_id = v_moi ORDER BY responded_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réponds d’abord à cette énigme' USING ERRCODE = 'P0002';
  END IF;
  IF (SELECT count(*) FROM signalements_enigme WHERE user_id = v_moi AND cree_le > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'Vingt signalements aujourd’hui : reviens demain' USING ERRCODE = 'P0001', HINT = 'limite';
  END IF;

  INSERT INTO signalements_enigme (enigma_id, user_id, raison, precision, reponse_donnee)
  VALUES (p_enigme, v_moi, p_raison, v_precision, v_reponse)
  ON CONFLICT (enigma_id, user_id) WHERE traite_le IS NULL
    DO UPDATE SET raison = excluded.raison, precision = excluded.precision,
                  reponse_donnee = excluded.reponse_donnee, cree_le = now();
  RETURN json_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.signaler_enigme(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_enigme(integer, text, text) TO authenticated;

-- 5.
CREATE OR REPLACE FUNCTION public.signalements_enigme_du_hub()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT COALESCE(json_agg(json_build_object(
      'id', s.id, 'raison', s.raison, 'precision', s.precision,
      'reponseDonnee', s.reponse_donnee, 'quand', s.cree_le,
      'enigme', json_build_object('numero', e.id, 'question', e.question, 'reponse', e.answer,
                                  'variantes', to_json(e.accepted_answers), 'format', e.format),
      'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name)))
    ORDER BY s.cree_le DESC), '[]'::json)
    FROM signalements_enigme s JOIN enigmas e ON e.id = s.enigma_id JOIN users u ON u.id = s.user_id
    WHERE s.traite_le IS NULL);
END;
$function$;
REVOKE ALL ON FUNCTION public.signalements_enigme_du_hub() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signalements_enigme_du_hub() TO authenticated;

CREATE OR REPLACE FUNCTION public.traiter_signalement_enigme(p_id bigint, p_accepter boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s signalements_enigme;
  e enigmas;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM signalements_enigme WHERE id = p_id AND traite_le IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO e FROM enigmas WHERE id = s.enigma_id;

  -- Accepter : la réponse du joueur devient une variante, sauf si elle passe déjà.
  IF p_accepter AND e.format = 'free'
     AND NOT public._enigma_juste(s.reponse_donnee, e.answer, e.accepted_answers) THEN
    UPDATE enigmas SET accepted_answers = accepted_answers || btrim(s.reponse_donnee)
     WHERE id = e.id RETURNING * INTO e;
  END IF;

  -- Clôt celui-ci, et ceux de la même énigme que la nouvelle variante rend justes.
  UPDATE signalements_enigme SET traite_le = now(), traite_par = auth.uid()::text
   WHERE traite_le IS NULL AND enigma_id = e.id
     AND (id = p_id OR (p_accepter AND e.format = 'free'
                        AND public._enigma_juste(reponse_donnee, e.answer, e.accepted_answers)));
  RETURN json_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.traiter_signalement_enigme(bigint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.traiter_signalement_enigme(bigint, boolean) TO authenticated;

-- 6.
DO $$
BEGIN
  IF NOT public._enigma_juste('eudes', 'Eudes de Paris', ARRAY['Eudes']) THEN
    RAISE EXCEPTION 'auto-test : « eudes » devrait passer avec la variante « Eudes »';
  END IF;
  IF NOT public._enigma_juste('Eudes de pari', 'Eudes de Paris', '{}') THEN
    RAISE EXCEPTION 'auto-test : la tolérance aux fautes sur la réponse principale a disparu';
  END IF;
  IF public._enigma_juste('Paris', 'Eudes de Paris', ARRAY['Eudes']) THEN
    RAISE EXCEPTION 'auto-test : « Paris » ne doit pas passer';
  END IF;
  IF public._enigma_juste('Eudes', 'Eudes de Paris', '{}') THEN
    RAISE EXCEPTION 'auto-test : sans variante, « Eudes » ne doit pas passer';
  END IF;
  IF public._enigma_juste('Eudes', 'Eudes de Paris', NULL) THEN
    RAISE EXCEPTION 'auto-test : variantes NULL';
  END IF;
END $$;
