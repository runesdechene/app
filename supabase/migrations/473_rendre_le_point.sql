-- WHY: Uriel, 09/10 — quand le Hub accepte une réponse, ceux qui l'avaient signalée récupèrent leur
--      point, et une notification les prévient. Les autres joueurs, non : pas de rétroactivité
--      générale. « Sur les chemins » ne bouge pas.
--   1. _rendre_le_point(joueur, énigme) : sa dernière réponse, refusée mais juste avec les variantes,
--      devient juste — les points de connaissance suivent seuls (_points_connaissance compte les
--      réponses justes) ; +1 XP, sauf avant `_xp_epoch()`, comme le trigger d'insertion ; les titres
--      de connaissance gagnés ; la notification `enigme_acceptee`. Rien pour qui avait déjà percé
--      l'énigme.
--   2. traiter_signalement_enigme l'appelle pour chaque signalement qu'« Accepter » clôt.
--   3. _notification_v2 : la cloche de la V2 montre `enigme_acceptee`.
--   Fonctions réécrites à partir de leur définition live (472, 386 + 464).

CREATE OR REPLACE FUNCTION public._rendre_le_point(p_user text, p_enigme integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e enigmas;
  r enigma_responses;
  v_xp int := 0;
BEGIN
  SELECT * INTO e FROM enigmas WHERE id = p_enigme;
  IF e.format IS DISTINCT FROM 'free' THEN RETURN false; END IF;
  -- Déjà percée une fois : le point est déjà compté.
  IF EXISTS (SELECT 1 FROM enigma_responses WHERE enigma_id = p_enigme AND user_id = p_user AND correct) THEN
    RETURN false;
  END IF;
  SELECT * INTO r FROM enigma_responses
   WHERE enigma_id = p_enigme AND user_id = p_user ORDER BY responded_at DESC LIMIT 1;
  IF NOT FOUND OR NOT public._enigma_juste(r.answer_given, e.answer, e.accepted_answers) THEN
    RETURN false;
  END IF;

  UPDATE enigma_responses SET correct = true WHERE id = r.id;
  IF r.responded_at >= public._xp_epoch() THEN
    UPDATE users SET xp_total = xp_total + 1 WHERE id = p_user;
    v_xp := 1;
  END IF;
  PERFORM public._attribuer_titres_connaissance(p_user, e.theme);
  INSERT INTO notifications (recipient_id, type, data)
  VALUES (p_user, 'enigme_acceptee', jsonb_build_object('extrait', 'n° ' || e.id, 'numero', e.id, 'xp', v_xp));
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public._rendre_le_point(text, integer) FROM PUBLIC, anon, authenticated;

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
  v_joueur text;
  v_rendus int := 0;
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

  -- Clôt celui-ci, et les refus de la même énigme que la variante ajoutée rend justes ; accepter rend
  -- son point à chacun d'eux.
  FOR v_joueur IN
    UPDATE signalements_enigme SET traite_le = now(), traite_par = auth.uid()::text
     WHERE traite_le IS NULL AND enigma_id = e.id
       AND (id = p_id OR (e.accepted_answers IS DISTINCT FROM v_avant
                          AND raison = 'reponse_refusee'
                          AND NOT public._enigma_juste(reponse_donnee, e.answer, v_avant)
                          AND public._enigma_juste(reponse_donnee, e.answer, e.accepted_answers)))
    RETURNING user_id
  LOOP
    IF p_accepter AND public._rendre_le_point(v_joueur, e.id) THEN
      v_rendus := v_rendus + 1;
    END IF;
  END LOOP;
  RETURN json_build_object('ok', true, 'rendus', v_rendus);
END;
$function$;

CREATE OR REPLACE FUNCTION public._notification_v2(p_type text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_type = ANY (ARRAY[
    'like_contribution', 'like_carnet', 'new_carnet', 'description_edited', 'new_photo',
    'new_comment', 'comment_reply', 'place_position_edited', 'exploration',
    'milestone_vues', 'milestone_exploration', 'milestone_likes', 'mention', 'salut',
    'lieu_modifie', 'coeur_mot', 'demande_compagnie', 'demande_acceptee',
    'visite', 'revendication_reprise', 'nouveau_membre', 'enigme_acceptee']);
$function$;
