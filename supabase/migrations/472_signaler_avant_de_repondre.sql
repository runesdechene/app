-- WHY: Uriel, 09/10 — on peut signaler une énigme dès sa question, avant d'y répondre (« si notre énoncé
--      est faux »), puis y répondre quand même ; et proposer la bonne réponse.
--   1. signalements_enigme : reponse_donnee devient facultative (pas encore répondu) ; reponse_proposee,
--      ce que le joueur croit juste. « Accepter » ne s'en sert jamais : une réponse attendue fausse se
--      réécrit dans le Hub, elle ne gagne pas une variante.
--   2. signaler_enigme prend la proposition (4e argument, facultatif : l'appel à trois arguments de la
--      V2 en ligne marche toujours). Sans réponse, « Ma réponse aurait dû être acceptée » reste refusé.
--   3. signalements_enigme_du_hub renvoie la proposition.
--   4. traiter_signalement_enigme n'accepte rien d'un signalement sans réponse.
--   Fonctions réécrites à partir de leur définition live (470 et 471).

ALTER TABLE public.signalements_enigme ALTER COLUMN reponse_donnee DROP NOT NULL;
ALTER TABLE public.signalements_enigme
  ADD COLUMN reponse_proposee text CHECK (char_length(reponse_proposee) <= 200);

-- La signature change : l'ancienne, à trois arguments, ferait doublon avec la nouvelle.
DROP FUNCTION public.signaler_enigme(integer, text, text);

CREATE FUNCTION public.signaler_enigme(p_enigme integer, p_raison text, p_precision text DEFAULT NULL,
                                       p_proposition text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_precision text := NULLIF(btrim(COALESCE(p_precision, '')), '');
  v_proposition text := NULLIF(btrim(COALESCE(p_proposition, '')), '');
  v_reponse text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF p_raison NOT IN ('reponse_refusee', 'erreur', 'autre') THEN
    RAISE EXCEPTION 'Raison inconnue' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(v_precision, '')) > 500 OR char_length(coalesce(v_proposition, '')) > 200 THEN
    RAISE EXCEPTION 'Un mot de 500 signes au plus, une proposition de 200' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM enigmas WHERE id = p_enigme) THEN
    RAISE EXCEPTION 'Énigme introuvable' USING ERRCODE = 'P0002';
  END IF;
  -- Sa dernière réponse, s'il a déjà répondu : la base la relève, le joueur ne la déclare pas.
  SELECT answer_given INTO v_reponse FROM enigma_responses
   WHERE enigma_id = p_enigme AND user_id = v_moi ORDER BY responded_at DESC LIMIT 1;
  IF v_reponse IS NULL AND p_raison = 'reponse_refusee' THEN
    RAISE EXCEPTION 'Réponds d’abord à cette énigme' USING ERRCODE = 'P0002';
  END IF;
  IF (SELECT count(*) FROM signalements_enigme WHERE user_id = v_moi AND cree_le > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'Vingt signalements aujourd’hui : reviens demain' USING ERRCODE = 'P0001', HINT = 'limite';
  END IF;

  INSERT INTO signalements_enigme (enigma_id, user_id, raison, precision, reponse_donnee, reponse_proposee)
  VALUES (p_enigme, v_moi, p_raison, v_precision, v_reponse, v_proposition)
  ON CONFLICT (enigma_id, user_id) WHERE traite_le IS NULL
    DO UPDATE SET raison = excluded.raison, precision = excluded.precision,
                  reponse_donnee = excluded.reponse_donnee, reponse_proposee = excluded.reponse_proposee,
                  cree_le = now();
  RETURN json_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.signaler_enigme(integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_enigme(integer, text, text, text) TO authenticated;

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
      'reponseDonnee', s.reponse_donnee, 'reponseProposee', s.reponse_proposee, 'quand', s.cree_le,
      'enigme', json_build_object('numero', e.id, 'question', e.question, 'reponse', e.answer,
                                  'variantes', to_json(e.accepted_answers), 'format', e.format),
      'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name)))
    ORDER BY s.cree_le DESC), '[]'::json)
    FROM signalements_enigme s JOIN enigmas e ON e.id = s.enigma_id JOIN users u ON u.id = s.user_id
    WHERE s.traite_le IS NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.traiter_signalement_enigme(p_id bigint, p_accepter boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s signalements_enigme;
  e enigmas;
  v_avant text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM signalements_enigme WHERE id = p_id AND traite_le IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO e FROM enigmas WHERE id = s.enigma_id FOR UPDATE;
  v_avant := e.accepted_answers;

  -- Accepter : la réponse du joueur devient une variante, sauf si elle passe déjà — et seulement
  -- s'il a répondu (sa proposition, elle, n'est jamais acceptée telle quelle).
  IF p_accepter AND e.format = 'free' AND s.reponse_donnee IS NOT NULL
     AND NOT public._enigma_juste(s.reponse_donnee, e.answer, e.accepted_answers) THEN
    UPDATE enigmas SET accepted_answers = accepted_answers || btrim(s.reponse_donnee)
     WHERE id = e.id RETURNING * INTO e;
  END IF;

  -- Clôt celui-ci, et les refus de la même énigme que la variante ajoutée rend justes.
  UPDATE signalements_enigme SET traite_le = now(), traite_par = auth.uid()::text
   WHERE traite_le IS NULL AND enigma_id = e.id
     AND (id = p_id OR (e.accepted_answers IS DISTINCT FROM v_avant
                        AND raison = 'reponse_refusee'
                        AND NOT public._enigma_juste(reponse_donnee, e.answer, v_avant)
                        AND public._enigma_juste(reponse_donnee, e.answer, e.accepted_answers)));
  RETURN json_build_object('ok', true);
END;
$function$;
