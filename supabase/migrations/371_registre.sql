-- 371 — Le Registre : le chat public d'Explore V2
--
-- WHY : l'onglet Messages (spec V2 §10, maquette Figma 45:278) : « un chat de MMO, pas une
--   messagerie ». Deux canaux publics, ceux de la V1 : le canal général ('general') et « Bugs &
--   suggestions » ('bugs'), dans la table chat_messages qu'on garde (la V1 y écrit encore).
--   1. registre(p_canaux) : les derniers messages des canaux cochés, du plus ancien au plus
--      récent, avec le nom et le portrait LUS dans users — pas la colonne user_name, que la V1
--      laisse écrire par le client (n'importe qui pouvait signer du nom d'un autre).
--   2. ecrire_au_registre(p_canal, p_texte) : écrire, le nom posé par la base. 1 à 500 signes.
--   Les canaux de Compagnie ne passent pas par ici (en sommeil en V2).
--
-- SCHEMA CHECKED (28/09/2026) : chat_messages(id bigint, channel varchar, user_id varchar,
--   user_name varchar NOT NULL, faction_id, faction_color, faction_pattern, content text,
--   created_at) ; RLS active, lecture 'general'/'bugs' réservée aux comptes connectés ;
--   users(id, display_name, first_name, avatar_url) ; user_public_name(text, text, text).

CREATE OR REPLACE FUNCTION public.registre(p_canaux text[] DEFAULT ARRAY['general', 'bugs'], p_limite int DEFAULT 80)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object(
      'id', m.id,
      'canal', m.channel,
      'texte', m.content,
      'quand', m.created_at,
      'auteur', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url),
      'moi', m.user_id = (auth.uid())::text)
    ORDER BY m.created_at, m.id), '[]'::json)
  FROM (
    SELECT * FROM chat_messages c
    WHERE c.channel = ANY (p_canaux) AND c.channel IN ('general', 'bugs')
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT least(greatest(p_limite, 1), 200)
  ) m
  JOIN users u ON u.id = m.user_id
  WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.registre(text[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registre(text[], int) TO authenticated;

CREATE OR REPLACE FUNCTION public.ecrire_au_registre(p_canal text, p_texte text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  RETURN json_build_object('id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.ecrire_au_registre(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ecrire_au_registre(text, text) TO authenticated;
