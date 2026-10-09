-- WHY: la relecture des Compagnies V2 (05/10/2026) — cinq trous, une migration.
--   1. N'importe quel compte connecté pouvait réécrire une Compagnie en direct (policy « Auth manage
--      factions », FOR ALL, héritée de la V1) : rendre publique une Compagnie privée puis la rejoindre,
--      renommer ses rôles, la retirer. Seuls les admins (la page Factions du Hub) écrivent désormais ;
--      tout le reste passe par les fonctions des migs 421-423.
--   2. Une mention dans le canal d'une Compagnie envoyait l'extrait du message à un non-membre.
--   3. On ne pouvait pas aimer un message de Compagnie (« Introuvable », échec muet côté front).
--   4. Lu ne passait jamais au-delà d'un message de Compagnie : la pastille ne s'éteignait pas.
--   5. Un compte supprimé (ou un membre retiré autrement que par « Quitter ») ne passait pas la main :
--      une Compagnie restait sans Chef, ou sans membre et jamais retirée (spec : l'officier le plus
--      ancien reprend).
-- SCHEMA CHECKED (05/10/2026) : pg_policies et droits de factions / faction_members lus en prod ;
--      définitions live de ecrire_au_registre (422), aimer_message (412), marquer_registre_lu (394).
-- DROP vérifié à la main : la policy « Auth manage factions » (USING auth.role() = 'authenticated', FOR
--      ALL). La V1 ne fait que lire `factions` (explore-web : trois select) ; le Hub l'écrit depuis la
--      page Factions, réservée aux admins (App.tsx) — d'où la policy admin qui la remplace.

-- 1. Seuls les admins écrivent une Compagnie en direct.
DROP POLICY "Auth manage factions" ON public.factions;
CREATE POLICY "Admins manage factions" ON public.factions FOR ALL TO authenticated
  USING (public._is_admin()) WITH CHECK (public._is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.factions FROM anon;

-- 2. Dans le canal d'une Compagnie, on ne mentionne que ses membres.
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
  -- 422 : une Compagnie dont je suis membre est un canal aussi.
  IF p_canal NOT IN ('general', 'bugs') AND public._role_compagnie(p_canal, v_moi) IS NULL THEN
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
  -- 424 : dans le canal d'une Compagnie, un membre seulement (l'extrait part dans sa cloche).
  INSERT INTO chat_mentions (message_id, user_id)
  SELECT DISTINCT v_id, u.id
  FROM unnest(COALESCE(p_mentions, '{}')) AS m(id)
  JOIN users u ON u.id = m.id
  WHERE u.id <> v_moi
    AND position('@' || user_public_name(u.id, u.display_name, u.first_name) IN v_texte) > 0
    AND (p_canal IN ('general', 'bugs') OR public._role_compagnie(p_canal, u.id) IS NOT NULL);

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

-- 3. Un message de ma Compagnie s'aime comme un autre.
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
  -- 424 : les canaux des Compagnies dont je suis membre aussi.
  SELECT c.user_id INTO v_auteur FROM chat_messages c
  WHERE c.id = p_message
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

-- 4. Lu jusqu'au dernier message que je peux lire, celui de mes Compagnies compris.
CREATE OR REPLACE FUNCTION public.marquer_registre_lu()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO registre_lu (user_id, lu_jusqua, maj)
  SELECT (auth.uid())::text,
         COALESCE((SELECT max(id) FROM chat_messages
                   WHERE channel IN ('general', 'bugs')
                      OR channel IN (SELECT m.faction_id FROM faction_members m
                                     WHERE m.user_id = (auth.uid())::text)), 0),
         now()
  WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE SET lu_jusqua = EXCLUDED.lu_jusqua, maj = now();
$function$;

-- 5. Tout départ passe la main : « Quitter », un retrait, un compte supprimé (ON DELETE CASCADE).
--    `_succession` ne fait rien quand la Compagnie a encore son Chef.
CREATE FUNCTION public._trg_succession() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
BEGIN
  PERFORM _succession(OLD.faction_id);
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public._trg_succession() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER faction_members_succession AFTER DELETE ON public.faction_members
  FOR EACH ROW EXECUTE FUNCTION public._trg_succession();
