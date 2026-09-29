-- WHY: les Notifications de la V2 (maquette Figma « Notifications (tiroir) — proposition 30/09 ») :
--      ce qui touche tes lieux et toi. La table `notifications` (V1) garde tout ; la V2 n'en lit que
--      les sortes qui ont encore un sens — cœurs, récits, photos, commentaires, positions
--      corrigées, visites et paliers, plus deux nouvelles — et laisse de côté les rappels
--      quotidiens (énigme du jour, « presque le niveau suivant » : 750 000 lignes à eux deux) et ce
--      que la V2 abandonne (mécénat, Couronnes, expéditions).
--   1. _notification_v2(type) : la liste de ces sortes, en un seul endroit.
--   2. mes_notifications() : les 50 dernières, avec qui (nom et visage d'aujourd'hui) et le lieu.
--   3. notifications_non_lues() : le nombre sur la cloche.
--   4. marquer_notifications_lues() : à l'ouverture du tiroir (sans p_user_id : auth.uid()).
--   5. ecrire_au_registre : une @mention prévient la personne mentionnée (« mention »).
--   6. saluer : le premier salut d'une personne prévient qui est salué (« salut ») ; les suivants,
--      non — une armée de cœurs ne devient pas une armée de notifications.
--      Les deux envois sont à l'abri : s'ils échouent, le message ou le salut part quand même.
-- SCHEMA CHECKED (30/09/2026, information_schema et définitions live) : notifications(id serial,
--      recipient_id text, type text, data jsonb, read boolean, created_at) — data porte actorId,
--      actorName, placeId (toutes les sortes retenues), viewCount / explorerCount / likeCount /
--      visitorsToday ; users(id, display_name, first_name, avatar_url) ; places(id, title) ;
--      notify(text, text, jsonb) ; user_public_name(text, text, text) ;
--      ecrire_au_registre(text, text, text[]) et saluer(text) copiées de leur définition live ;
--      _auteur_du_chemin(text) ; chat_mentions(message_id, user_id) ; saluts(evenement, user_id,
--      destinataire, nombre).

CREATE OR REPLACE FUNCTION public._notification_v2(p_type text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_type = ANY (ARRAY[
    'like_contribution', 'like_carnet', 'new_carnet', 'description_edited', 'new_photo',
    'new_comment', 'comment_reply', 'place_position_edited', 'exploration',
    'milestone_vues', 'milestone_exploration', 'milestone_likes', 'mention', 'salut']);
$function$;

CREATE OR REPLACE FUNCTION public.mes_notifications()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', n.id,
      'type', n.type,
      'quand', n.created_at,
      'lu', n.read,
      'qui', CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object(
               'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
               'avatar', u.avatar_url) END,
      'lieu', CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('id', p.id, 'nom', p.title) END,
      'nombre', COALESCE(n.data->>'viewCount', n.data->>'explorerCount', n.data->>'likeCount',
                         n.data->>'visitorsToday')::int,
      'extrait', n.data->>'extrait',
      'evenement', NULLIF(split_part(COALESCE(n.data->>'evenement', ''), ':', 1), ''))
    ORDER BY n.created_at DESC), '[]'::json)
  FROM (SELECT * FROM notifications
        WHERE recipient_id = (auth.uid())::text AND public._notification_v2(type)
        ORDER BY created_at DESC LIMIT 50) n
  LEFT JOIN users u ON u.id = n.data->>'actorId'
  LEFT JOIN places p ON p.id = n.data->>'placeId';
$function$;

REVOKE ALL ON FUNCTION public.mes_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_notifications() TO authenticated;

CREATE OR REPLACE FUNCTION public.notifications_non_lues()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::int FROM notifications
  WHERE recipient_id = (auth.uid())::text AND NOT read AND public._notification_v2(type);
$function$;

REVOKE ALL ON FUNCTION public.notifications_non_lues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notifications_non_lues() TO authenticated;

CREATE OR REPLACE FUNCTION public.marquer_notifications_lues()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nombre int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  UPDATE notifications SET read = true
  WHERE recipient_id = (auth.uid())::text AND NOT read;
  GET DIAGNOSTICS v_nombre = ROW_COUNT;
  RETURN v_nombre;
END;
$function$;

REVOKE ALL ON FUNCTION public.marquer_notifications_lues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marquer_notifications_lues() TO authenticated;

-- 5. Le Registre : copié de la définition live, plus la notification des mentions.
CREATE OR REPLACE FUNCTION public.ecrire_au_registre(p_canal text, p_texte text, p_mentions text[] DEFAULT '{}'::text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_texte text := btrim(p_texte);
  v_nom text;
  v_id bigint;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF p_canal NOT IN ('general', 'bugs') THEN
    RAISE EXCEPTION 'Canal inconnu' USING ERRCODE = '22023';
  END IF;
  IF v_texte IS NULL OR char_length(v_texte) = 0 OR char_length(v_texte) > 500 THEN
    RAISE EXCEPTION 'Message vide ou trop long' USING ERRCODE = '22023';
  END IF;
  SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
  INSERT INTO chat_messages (channel, user_id, user_name, content)
  VALUES (p_canal, v_moi, COALESCE(v_nom, 'Explorateur'), v_texte)
  RETURNING id INTO v_id;

  -- Les mentions : un compte qui existe, dont « @Nom » est bien dans le texte, pas soi-même.
  INSERT INTO chat_mentions (message_id, user_id)
  SELECT DISTINCT v_id, u.id
  FROM unnest(COALESCE(p_mentions, '{}')) AS m(id)
  JOIN users u ON u.id = m.id
  WHERE u.id <> v_moi
    AND position('@' || user_public_name(u.id, u.display_name, u.first_name) IN v_texte) > 0;

  -- Chaque personne mentionnée est prévenue ; un échec ici n'empêche pas le message de partir.
  BEGIN
    PERFORM notify(m.user_id, 'mention', jsonb_build_object(
      'actorId', v_moi, 'actorName', v_nom, 'canal', p_canal, 'messageId', v_id,
      'extrait', left(v_texte, 140)))
    FROM chat_mentions m WHERE m.message_id = v_id;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'ecrire_au_registre : notification des mentions en échec (%)', SQLERRM;
  END;

  RETURN json_build_object('id', v_id);
END;
$function$;

-- 6. Saluer : copié de la définition live, plus la notification du premier salut.
CREATE OR REPLACE FUNCTION public.saluer(p_evenement text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur varchar;
  v_nombre int;
  v_nom text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  v_auteur := public._auteur_du_chemin(p_evenement);
  IF v_auteur IS NULL THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_auteur = v_moi THEN
    RAISE EXCEPTION 'On ne se salue pas soi-même' USING ERRCODE = '22023';
  END IF;

  INSERT INTO saluts (evenement, user_id, destinataire) VALUES (p_evenement, v_moi, v_auteur)
  ON CONFLICT (evenement, user_id) DO UPDATE SET nombre = saluts.nombre + 1
  RETURNING nombre INTO v_nombre;

  -- Le premier salut de quelqu'un prévient qui est salué ; les suivants, non.
  IF v_nombre = 1 THEN
    BEGIN
      SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
      PERFORM notify(v_auteur, 'salut', jsonb_build_object(
        'actorId', v_moi, 'actorName', v_nom, 'evenement', p_evenement,
        'placeId', CASE WHEN split_part(p_evenement, ':', 1) IN ('visite', 'ajout')
                        THEN split_part(p_evenement, ':', 2) END));
    EXCEPTION WHEN others THEN
      RAISE WARNING 'saluer : notification en échec (%)', SQLERRM;
    END;
  END IF;

  RETURN json_build_object(
    'saluts', (SELECT COALESCE(sum(nombre), 0) FROM saluts WHERE evenement = p_evenement),
    'salue', true);
END;
$function$;
