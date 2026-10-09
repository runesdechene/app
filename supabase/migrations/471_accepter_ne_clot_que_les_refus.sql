-- WHY: accepter une réponse dans le Hub (470) clôturait aussi, sans qu'on les lise, les signalements
--      des joueurs qui avaient déjà juste — par exemple « la date de l'explication est fausse ».
--      Désormais, accepter ne clôt en plus que les refus (« Ma réponse aurait dû être acceptée ») que la
--      variante qu'on vient d'ajouter rend justes. L'énigme est verrouillée le temps du traitement : deux
--      admins qui acceptent « Eudes » et « eudes » au même instant n'ajoutent qu'une variante.
--      Réécrite à partir de la définition live (identique à la 470).

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

  -- Accepter : la réponse du joueur devient une variante, sauf si elle passe déjà.
  IF p_accepter AND e.format = 'free'
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
