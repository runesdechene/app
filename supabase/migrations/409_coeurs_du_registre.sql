-- WHY: réagir aux messages du Registre, « très demandé » (Uriel, 01/10/2026) : pour commencer,
--      des cœurs à volonté, comme sur « Sur les chemins ». Un message devient une chose qu'on
--      salue : même table (saluts, évenement 'message:<id>'), même RPC saluer (inchangée) — on ne
--      se salue pas soi-même, le premier cœur de quelqu'un prévient l'auteur, pas les suivants.
--   1. _auteur_du_chemin (copiée de sa définition live, identique à la 406) : l'auteur d'un message.
--   2. registre (copiée de sa définition live) : chaque message rend ses cœurs et si j'en ai donné.
--   Rien ne change pour la V1 (chat_messages n'est pas touchée).
-- SCHEMA CHECKED (01/10/2026, information_schema et définitions live) : chat_messages(id bigint,
--      channel varchar, user_id varchar) ; saluts(evenement text, user_id varchar, destinataire
--      varchar, nombre) ; saluer(text) lit _auteur_du_chemin.

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
    -- 409 : un message du Registre (général ou bugs). Le CASE garde le cast : un identifiant qui
    -- n'est pas un nombre ne trouve personne, sans erreur.
    WHEN 'message' THEN (
      SELECT c.user_id FROM chat_messages c
      WHERE c.id = CASE WHEN split_part(p_evenement, ':', 2) ~ '^[0-9]{1,18}$'
                        THEN split_part(p_evenement, ':', 2)::bigint END
        AND c.channel IN ('general', 'bugs'))

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
      -- 409 : les cœurs du message (saluts 'message:<id>'), et si j'en ai donné.
      'saluts', (SELECT COALESCE(sum(s.nombre), 0) FROM saluts s WHERE s.evenement = 'message:' || m.id),
      'salue', EXISTS (SELECT 1 FROM saluts s WHERE s.evenement = 'message:' || m.id AND s.user_id = (auth.uid())::text))
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
