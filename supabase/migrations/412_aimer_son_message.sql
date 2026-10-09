-- WHY: le cœur est sur chaque message, les siens compris (Uriel, 05/10/2026 : « même si personne
--      ne devrait se liker, ça peut arriver »). aimer_message accepte son propre message, sans
--      jamais se notifier soi-même.
--   aimer_message (copiée de sa définition live, la 410) : le refus « On n'aime pas son propre
--   message » retiré ; la notification seulement vers un autre que soi.
-- SCHEMA CHECKED (05/10/2026, définition live = 410) : saluts(evenement, user_id, destinataire),
--      notifications(recipient_id, type, data), chat_messages(id, channel, user_id).

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
  IF NOT p_aime THEN
    DELETE FROM saluts WHERE evenement = v_evenement AND user_id = v_moi;
    RETURN;
  END IF;

  INSERT INTO saluts (evenement, user_id, destinataire) VALUES (v_evenement, v_moi, v_auteur)
  ON CONFLICT (evenement, user_id) DO NOTHING;

  -- 412 : son propre message s'aime aussi, mais on ne se prévient pas soi-même.
  IF v_auteur <> v_moi AND NOT EXISTS (SELECT 1 FROM notifications n
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
