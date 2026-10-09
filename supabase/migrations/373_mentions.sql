-- 373 — Mentionner un Explorateur dans le Registre (@Nom)
--
-- WHY : Uriel, 28/09 : « qu'on puisse mentionner un compte avec @ ». Le message reste du texte
--   simple (« @Gautier de Bilskimir, tu as vu ? ») — la V1 lit la même table chat_messages et
--   l'affiche tel quel. Les mentions vivent à côté, avec l'identifiant de chacun.
--   1. chercher_explorateurs(p_debut) : les Explorateurs dont le nom commence par ce qu'on tape
--      après « @ » (six au plus), pour la petite liste de choix.
--   2. chat_mentions : qui est mentionné dans quel message. Personne n'y touche directement.
--   3. ecrire_au_registre(p_canal, p_texte, p_mentions) : écrit le message, puis retient les
--      mentions — seulement les comptes qui existent ET dont « @Nom » figure dans le texte.
--      L'ancienne version à deux paramètres (371, même jour, seule la V2 l'appelle) est retirée.
--   4. registre(...) rend, pour chaque message, ses mentions (id, nom) et si j'y suis mentionné.
--   La notification au mentionné attend la cloche de la V2 (la V1 ne connaît pas ce type).
--   Définitions de 371, copiées entières ; seules changent les mentions.
--
-- SCHEMA CHECKED (28/09/2026) : chat_messages(id bigint, channel, user_id, user_name, content,
--   created_at) ; users(id varchar, display_name, first_name, avatar_url, is_active) ;
--   user_public_name(text, text, text).

CREATE OR REPLACE FUNCTION public.chercher_explorateurs(p_debut text, p_limite int DEFAULT 6)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object('id', x.id, 'nom', x.nom, 'avatar', x.avatar) ORDER BY x.nom), '[]'::json)
  FROM (
    SELECT u.id, user_public_name(u.id, u.display_name, u.first_name) AS nom, u.avatar_url AS avatar
    FROM users u
    WHERE u.is_active IS NOT FALSE
      AND u.id <> (auth.uid())::text
      AND user_public_name(u.id, u.display_name, u.first_name) ILIKE replace(replace(btrim(p_debut), '%', ''), '_', '') || '%'
    ORDER BY char_length(user_public_name(u.id, u.display_name, u.first_name))
    LIMIT least(greatest(p_limite, 1), 10)
  ) x
  WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.chercher_explorateurs(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chercher_explorateurs(text, int) TO authenticated;

CREATE TABLE IF NOT EXISTS public.chat_mentions (
  message_id bigint NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_mentions_user ON public.chat_mentions (user_id);
ALTER TABLE public.chat_mentions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_mentions FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.ecrire_au_registre(text, text);

CREATE OR REPLACE FUNCTION public.ecrire_au_registre(p_canal text, p_texte text, p_mentions text[] DEFAULT '{}')
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

  -- Les mentions : un compte qui existe, dont « @Nom » est bien dans le texte, pas soi-même.
  INSERT INTO chat_mentions (message_id, user_id)
  SELECT DISTINCT v_id, u.id
  FROM unnest(COALESCE(p_mentions, '{}')) AS m(id)
  JOIN users u ON u.id = m.id
  WHERE u.id <> v_moi
    AND position('@' || user_public_name(u.id, u.display_name, u.first_name) IN v_texte) > 0;

  RETURN json_build_object('id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.ecrire_au_registre(text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ecrire_au_registre(text, text, text[]) TO authenticated;

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
      'moi', m.user_id = (auth.uid())::text,
      'mentions', COALESCE((
        SELECT json_agg(json_build_object('id', v.id, 'nom', user_public_name(v.id, v.display_name, v.first_name)))
        FROM chat_mentions cm JOIN users v ON v.id = cm.user_id
        WHERE cm.message_id = m.id), '[]'::json),
      'mentionneMoi', EXISTS (SELECT 1 FROM chat_mentions cm WHERE cm.message_id = m.id AND cm.user_id = (auth.uid())::text))
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
