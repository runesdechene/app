-- WHY: un seul cœur par message, et l'on voit qui a aimé (Uriel, 02/10/2026 : « peut-être plus
--      fort », « et faut qu'on puisse déliker »). Revient sur la 409 (cœurs à volonté) pour les
--      messages seulement : « Sur les chemins » garde les siens à volonté.
--   1. _auteur_du_chemin (copiée de sa définition live, la 409) : sans la branche 'message' —
--      saluer() ne prend plus les messages.
--   2. registre (copiée de sa définition live, la 409) : 'coeurs' (qui a aimé) et 'aime'.
--   3. aimer_message(bigint, boolean) : allumer ou éteindre son cœur ; la notification une fois.
--   4. Les cœurs de la 409 ramenés à un.
-- SCHEMA CHECKED (02/10/2026, information_schema et définitions live) : saluts(evenement, user_id,
--      destinataire, created_at, nombre) ; notifications(recipient_id text, type text, data jsonb) ;
--      notify(text, text, jsonb) comme l'appelle saluer() ; chat_messages(id bigint, channel,
--      user_id).

CREATE OR REPLACE FUNCTION public._auteur_du_chemin(p_evenement text)
 RETURNS character varying
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT CASE split_part(p_evenement, ':', 1)

    WHEN 'visite' THEN (

      SELECT e.user_id FROM place_explorers e JOIN places p ON p.id = e.place_id

      WHERE e.place_id = split_part(p_evenement, ':', 2) AND e.user_id = split_part(p_evenement, ':', 3)

        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)

    WHEN 'ajout' THEN (

      SELECT p.author_id FROM places p

      WHERE p.id = split_part(p_evenement, ':', 2) AND p.masked IS NOT TRUE AND p.private IS NOT TRUE)

    WHEN 'arrivee' THEN (SELECT u.id FROM users u WHERE u.id = split_part(p_evenement, ':', 2))
    WHEN 'connexion' THEN (SELECT u.id FROM users u WHERE u.id = split_part(p_evenement, ':', 2))
    WHEN 'revendication' THEN (
      SELECT h.user_id FROM veille_history h JOIN places p ON p.id = h.place_id
      WHERE h.place_id = split_part(p_evenement, ':', 2) AND h.user_id = split_part(p_evenement, ':', 3)
        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)
    WHEN 'enrichi' THEN (
      SELECT d.edited_by FROM place_description_revisions d JOIN places p ON p.id = d.place_id
      WHERE d.place_id = split_part(p_evenement, ':', 2) AND d.edited_by = split_part(p_evenement, ':', 3)
        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)
    -- 410 : un message ne se salue plus à volonté (aimer_message, un cœur par personne).

  END;

$function$;

CREATE OR REPLACE FUNCTION public.registre(p_canaux text[] DEFAULT ARRAY['general'::text, 'bugs'::text], p_limite integer DEFAULT 80)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', m.id,
      'canal', m.channel,
      'texte', m.content,
      'quand', m.created_at,
      'auteur', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url),
      'moi', m.user_id = (auth.uid())::text,
      'mentions', COALESCE((
        SELECT json_agg(json_build_object('id', v.id, 'nom', user_public_name(v.id, v.display_name, v.first_name)))
        FROM chat_mentions cm JOIN users v ON v.id = cm.user_id
        WHERE cm.message_id = m.id), '[]'::json),
      'mentionneMoi', EXISTS (SELECT 1 FROM chat_mentions cm WHERE cm.message_id = m.id AND cm.user_id = (auth.uid())::text),
      -- 410 : qui a aimé le message (un cœur par personne, du premier au dernier), et si j'en suis.
      'coeurs', COALESCE((
        SELECT json_agg(json_build_object('id', v.id, 'nom', user_public_name(v.id, v.display_name, v.first_name), 'avatar', v.avatar_url)
                        ORDER BY s.created_at)
        FROM saluts s JOIN users v ON v.id = s.user_id
        WHERE s.evenement = 'message:' || m.id), '[]'::json),
      'aime', EXISTS (SELECT 1 FROM saluts s WHERE s.evenement = 'message:' || m.id AND s.user_id = (auth.uid())::text))
    ORDER BY m.created_at, m.id), '[]'::json)
  FROM (
    SELECT * FROM chat_messages c
    WHERE c.channel = ANY (p_canaux) AND c.channel IN ('general', 'bugs')
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT least(greatest(p_limite, 1), 200)
  ) m
  JOIN users u ON u.id = m.user_id
  WHERE auth.uid() IS NOT NULL;
$function$;

-- Aimer un message, ou ne plus l'aimer : un cœur par personne. On ne s'aime pas soi-même. Le
-- premier cœur de quelqu'un prévient l'auteur ; le retirer puis le remettre ne le prévient pas une
-- seconde fois.
CREATE OR REPLACE FUNCTION public.aimer_message(p_message bigint, p_aime boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_evenement text := 'message:' || p_message;
  v_auteur varchar;
  v_nom text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT c.user_id INTO v_auteur FROM chat_messages c
  WHERE c.id = p_message AND c.channel IN ('general', 'bugs');
  IF v_auteur IS NULL THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_auteur = v_moi THEN
    RAISE EXCEPTION 'On n''aime pas son propre message' USING ERRCODE = '22023';
  END IF;

  IF NOT p_aime THEN
    DELETE FROM saluts WHERE evenement = v_evenement AND user_id = v_moi;
    RETURN;
  END IF;

  INSERT INTO saluts (evenement, user_id, destinataire) VALUES (v_evenement, v_moi, v_auteur)
  ON CONFLICT (evenement, user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM notifications n
                 WHERE n.recipient_id = v_auteur AND n.type = 'salut'
                   AND n.data->>'evenement' = v_evenement AND n.data->>'actorId' = v_moi) THEN
    BEGIN
      SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
      PERFORM notify(v_auteur, 'salut', jsonb_build_object(
        'actorId', v_moi, 'actorName', v_nom, 'evenement', v_evenement));
    EXCEPTION WHEN others THEN
      RAISE WARNING 'aimer_message : notification en échec (%)', SQLERRM;
    END;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.aimer_message(bigint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aimer_message(bigint, boolean) TO authenticated;

-- Les cœurs déjà donnés à volonté (409) comptent pour un.
UPDATE public.saluts SET nombre = 1 WHERE evenement LIKE 'message:%' AND nombre <> 1;
