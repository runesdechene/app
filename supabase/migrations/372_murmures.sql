-- 372 — Les Murmures : les messages privés d'Explore V2
--
-- WHY : spec V2 §10 : « le registre est public, les murmures sont privés » ; une vraie boîte de
--   réception, à part du Registre. Rien n'existait en base (audit du 28/09) : ni table, ni
--   fonction de message d'un Explorateur à un autre.
--   1. La table murmures : de qui, à qui, le texte, quand, lu quand. Règles d'accès : chacun ne
--      lit que les siens (c'est aussi ce que le temps réel de Supabase respecte) ; personne
--      n'écrit, ne modifie ni n'efface directement — tout passe par les fonctions.
--   2. murmurer(p_a, p_texte) : écrire à quelqu'un (pas à soi-même), 1 à 1000 signes.
--   3. mes_murmures() : la boîte de réception — une ligne par correspondant, le dernier mot et
--      le nombre de non-lus.
--   4. conversation(p_avec) : les messages échangés avec quelqu'un, du plus ancien au plus récent.
--   5. lire_murmures(p_avec) : marquer lus les messages reçus de lui.
--   Ils ne s'effacent pas au bout de 14 jours (contrairement au Registre).
--
-- SCHEMA CHECKED (28/09/2026) : users(id varchar, display_name, first_name, avatar_url) ;
--   user_public_name(text, text, text).

CREATE TABLE IF NOT EXISTS public.murmures (
  id bigserial PRIMARY KEY,
  de varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  a varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  texte text NOT NULL CHECK (char_length(texte) BETWEEN 1 AND 1000),
  cree_le timestamptz NOT NULL DEFAULT now(),
  lu_le timestamptz,
  CHECK (de <> a)
);
CREATE INDEX IF NOT EXISTS murmures_a ON public.murmures (a, cree_le DESC);
CREATE INDEX IF NOT EXISTS murmures_de ON public.murmures (de, cree_le DESC);

ALTER TABLE public.murmures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.murmures FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.murmures TO authenticated;
DROP POLICY IF EXISTS murmures_lire_les_miens ON public.murmures;
CREATE POLICY murmures_lire_les_miens ON public.murmures
  FOR SELECT TO authenticated
  USING (de = (auth.uid())::text OR a = (auth.uid())::text);

-- Le temps réel : un murmure reçu arrive sans recharger.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'murmures') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.murmures;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.murmurer(p_a text, p_texte text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moi text := (auth.uid())::text;
  v_texte text := btrim(p_texte);
  v_id bigint;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF p_a = v_moi THEN
    RAISE EXCEPTION 'On ne se murmure pas à soi-même' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_a) THEN
    RAISE EXCEPTION 'Explorateur introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_texte IS NULL OR char_length(v_texte) = 0 OR char_length(v_texte) > 1000 THEN
    RAISE EXCEPTION 'Murmure vide ou trop long' USING ERRCODE = '22023';
  END IF;
  INSERT INTO murmures (de, a, texte) VALUES (v_moi, p_a, v_texte) RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.murmurer(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.murmurer(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mes_murmures()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      'dernier', json_build_object('texte', d.texte, 'quand', d.cree_le, 'deMoi', d.de = moi.id),
      'nonLus', (SELECT count(*) FROM echanges e WHERE e.avec = d.avec AND e.a = moi.id AND e.lu_le IS NULL))
    ORDER BY d.cree_le DESC), '[]'::json)
  FROM derniers d CROSS JOIN moi JOIN users u ON u.id = d.avec;
$$;
REVOKE ALL ON FUNCTION public.mes_murmures() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_murmures() TO authenticated;

CREATE OR REPLACE FUNCTION public.conversation(p_avec text, p_limite int DEFAULT 100)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object(
      'id', m.id, 'texte', m.texte, 'quand', m.cree_le,
      'deMoi', m.de = (auth.uid())::text, 'luLe', m.lu_le)
    ORDER BY m.cree_le, m.id), '[]'::json)
  FROM (
    SELECT * FROM murmures
    WHERE (de = (auth.uid())::text AND a = p_avec) OR (de = p_avec AND a = (auth.uid())::text)
    ORDER BY cree_le DESC, id DESC
    LIMIT least(greatest(p_limite, 1), 300)
  ) m;
$$;
REVOKE ALL ON FUNCTION public.conversation(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation(text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.lire_murmures(p_avec text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nombre int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  UPDATE murmures SET lu_le = now()
  WHERE a = (auth.uid())::text AND de = p_avec AND lu_le IS NULL;
  GET DIAGNOSTICS v_nombre = ROW_COUNT;
  RETURN v_nombre;
END;
$$;
REVOKE ALL ON FUNCTION public.lire_murmures(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lire_murmures(text) TO authenticated;
