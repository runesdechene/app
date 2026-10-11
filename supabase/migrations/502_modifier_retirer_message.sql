-- WHY: modifier ou retirer son propre message, dans les canaux et dans les Murmures (Uriel, 11/10).
--      Tranché : on modifie pendant 15 minutes, et ça se voit (« modifié ») ; on retire quand on
--      veut, et une ligne « Message retiré » reste à sa place — une réponse juste en dessous ne
--      pend pas sans sa question. Un Murmure retiré disparaît aussi chez l'autre.
--   1. modifie_le et retire_le sur chat_messages et murmures. Retirer efface vraiment le texte
--      (NULL), les cœurs et les mentions du message ; un murmure retiré ne compte plus en non-lu.
--   2. modifier_message / retirer_message (canaux), modifier_murmure / retirer_murmure : son
--      message seulement, vérifié ici. Modifier ne renotifie personne (les mentions restent).
--   3. registre, conversation, mes_murmures rendent « modifie » et « retire » ; aimer_message
--      refuse un message retiré ; registre_non_lus ne le compte plus.
--   Le temps réel transmet déjà les UPDATE des deux tables (publication supabase_realtime).
-- SCHEMA CHECKED (11/10/2026, live) : chat_messages(id bigint, channel, user_id, content NOT NULL
--   CHECK 1-500, created_at) ; murmures(id, de, a, texte NOT NULL CHECK 1-1000, cree_le, lu_le) ;
--   chat_mentions(message_id, user_id) ; saluts(evenement 'message:<id>', user_id) ; aucun
--   déclencheur sur les deux tables ; registre, conversation, mes_murmures, aimer_message,
--   registre_non_lus (corps live repris entiers) ; _refus(text, text) (mig 421).

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS modifie_le timestamptz,
  ADD COLUMN IF NOT EXISTS retire_le timestamptz,
  ALTER COLUMN content DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS chat_messages_content_check,
  ADD CONSTRAINT chat_messages_content_check CHECK (
    (retire_le IS NULL AND char_length(content) BETWEEN 1 AND 500)
    OR (retire_le IS NOT NULL AND content IS NULL));

ALTER TABLE public.murmures
  ADD COLUMN IF NOT EXISTS modifie_le timestamptz,
  ADD COLUMN IF NOT EXISTS retire_le timestamptz,
  ALTER COLUMN texte DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS murmures_texte_check,
  ADD CONSTRAINT murmures_texte_check CHECK (
    (retire_le IS NULL AND char_length(texte) BETWEEN 1 AND 1000)
    OR (retire_le IS NOT NULL AND texte IS NULL));

-- ─── Les canaux ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.modifier_message(p_message bigint, p_texte text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_texte text := btrim(p_texte);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF v_texte IS NULL OR char_length(v_texte) NOT BETWEEN 1 AND 500 THEN
    PERFORM _refus('Message vide ou trop long', 'texte');
  END IF;
  UPDATE chat_messages SET content = v_texte, modifie_le = now()
   WHERE id = p_message AND user_id = (auth.uid())::text AND retire_le IS NULL
     AND created_at > now() - interval '15 minutes';
  IF NOT FOUND THEN
    PERFORM _refus('Ce message ne se modifie plus', 'delai');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.retirer_message(p_message bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  UPDATE chat_messages SET content = NULL, retire_le = now()
   WHERE id = p_message AND user_id = (auth.uid())::text AND retire_le IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM saluts WHERE evenement = 'message:' || p_message;
  DELETE FROM chat_mentions WHERE message_id = p_message;
END;
$function$;

REVOKE ALL ON FUNCTION public.modifier_message(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_message(bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION public.retirer_message(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirer_message(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.registre(p_canaux text[] DEFAULT ARRAY['general'::text, 'bugs'::text], p_limite integer DEFAULT 80)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', m.id,
      'canal', m.channel,
      -- 422 : le nom et la couleur d'un canal de Compagnie.
      'canalNom', (SELECT f.title FROM factions f WHERE f.id = m.channel),
      'canalCouleur', (SELECT f.color FROM factions f WHERE f.id = m.channel),
      'texte', m.content,
      'quand', m.created_at,
      -- 502 : modifié (dans ses 15 minutes), ou retiré (le texte est alors NULL).
      'modifie', m.modifie_le IS NOT NULL,
      'retire', m.retire_le IS NOT NULL,
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
    WHERE c.channel = ANY (p_canaux)
      -- 422 : les canaux de mes Compagnies aussi.
      AND (c.channel IN ('general', 'bugs') OR c.channel = ANY (COALESCE((SELECT array_agg(m.faction_id::text) FROM faction_members m JOIN factions f ON f.id = m.faction_id WHERE m.user_id = (auth.uid())::text AND NOT f.retired), '{}')))
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT least(greatest(p_limite, 1), 200)
  ) m
  JOIN users u ON u.id = m.user_id
  WHERE auth.uid() IS NOT NULL;
$function$;

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
  -- 424 : les canaux des Compagnies dont je suis membre aussi. 502 : un message retiré ne s'aime plus.
  SELECT c.user_id INTO v_auteur FROM chat_messages c
  WHERE c.id = p_message AND c.retire_le IS NULL
    AND (c.channel IN ('general', 'bugs') OR public._role_compagnie(c.channel, v_moi) IS NOT NULL);
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

CREATE OR REPLACE FUNCTION public.registre_non_lus()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (
    SELECT (auth.uid())::text AS id,
           (SELECT r.lu_jusqua FROM registre_lu r WHERE r.user_id = (auth.uid())::text) AS lu
  )
  SELECT json_build_object(
    'messages', (
      SELECT count(*)::int FROM (
        SELECT 1 FROM chat_messages m, moi
        WHERE moi.lu IS NOT NULL AND m.id > moi.lu AND m.retire_le IS NULL
          AND (m.channel IN ('general', 'bugs') OR public._role_compagnie(m.channel, moi.id) IS NOT NULL)
          AND m.user_id IS DISTINCT FROM moi.id
        LIMIT 100) x),
    'mentions', (
      SELECT count(*)::int
      FROM chat_mentions cm JOIN chat_messages m ON m.id = cm.message_id, moi
      WHERE cm.user_id = moi.id AND m.id > COALESCE(moi.lu, 0)))
  FROM moi
  WHERE moi.id IS NOT NULL;
$function$;

-- ─── Les Murmures ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.modifier_murmure(p_murmure bigint, p_texte text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_texte text := btrim(p_texte);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF v_texte IS NULL OR char_length(v_texte) NOT BETWEEN 1 AND 1000 THEN
    PERFORM _refus('Murmure vide ou trop long', 'texte');
  END IF;
  UPDATE murmures SET texte = v_texte, modifie_le = now()
   WHERE id = p_murmure AND de = (auth.uid())::text AND retire_le IS NULL
     AND cree_le > now() - interval '15 minutes';
  IF NOT FOUND THEN
    PERFORM _refus('Ce murmure ne se modifie plus', 'delai');
  END IF;
END;
$function$;

-- Retiré, il ne compte plus en non-lu chez l'autre : lu_le se pose s'il ne l'était pas.
CREATE OR REPLACE FUNCTION public.retirer_murmure(p_murmure bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  UPDATE murmures SET texte = NULL, retire_le = now(), lu_le = COALESCE(lu_le, now())
   WHERE id = p_murmure AND de = (auth.uid())::text AND retire_le IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.modifier_murmure(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_murmure(bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION public.retirer_murmure(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirer_murmure(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.conversation(p_avec text, p_limite integer DEFAULT 100)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', m.id, 'texte', m.texte, 'quand', m.cree_le,
      'deMoi', m.de = (auth.uid())::text, 'luLe', m.lu_le,
      'modifie', m.modifie_le IS NOT NULL, 'retire', m.retire_le IS NOT NULL)
    ORDER BY m.cree_le, m.id), '[]'::json)
  FROM (
    SELECT * FROM murmures
    WHERE (de = (auth.uid())::text AND a = p_avec) OR (de = p_avec AND a = (auth.uid())::text)
    ORDER BY cree_le DESC, id DESC
    LIMIT least(greatest(p_limite, 1), 300)
  ) m;
$function$;

-- 502 : le dernier mot d'un fil peut être un murmure retiré (texte NULL, « retire »).
CREATE OR REPLACE FUNCTION public.mes_murmures()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  echanges AS (
    SELECT m.*, CASE WHEN m.de = moi.id THEN m.a ELSE m.de END AS avec
    FROM murmures m CROSS JOIN moi
    WHERE m.de = moi.id OR m.a = moi.id
  ),
  derniers AS (
    SELECT DISTINCT ON (avec) * FROM echanges ORDER BY avec, cree_le DESC, id DESC
  )
  SELECT COALESCE(json_agg(json_build_object(
      'avec', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url),
      'dernier', json_build_object('texte', d.texte, 'quand', d.cree_le, 'deMoi', d.de = moi.id, 'retire', d.retire_le IS NOT NULL),
      'nonLus', (SELECT count(*) FROM echanges e WHERE e.avec = d.avec AND e.a = moi.id AND e.lu_le IS NULL))
    ORDER BY d.cree_le DESC), '[]'::json)
  FROM derniers d CROSS JOIN moi JOIN users u ON u.id = d.avec;
$function$;
