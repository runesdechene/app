-- 356 — Trois titres de jeu, leur origine ; le signe d'un Porteur
--
-- WHY : décisions d'Uriel (27/09, brainstorm « titres »).
--   · Les titres sont des HAUTS FAITS, gagnés en jouant, pour tout le monde : trois au plus
--     (au lieu de deux), et le profil renvoie leur condition (`titles.condition`) pour que
--     toucher un titre explique comment il a été obtenu. Titres de Compagnie et mots de
--     fragment ne se portent pas en V2.
--   · Un Porteur place son profil « sous le signe » d'un de ses Fragments : l'illustration
--     veille en filigrane derrière l'en-tête. `users.signe_fragment_id` le retient ;
--     `set_my_signe` le choisit (un Fragment qu'on possède, ou NULL pour aucun).
-- `set_my_displayed_titles` part de la 353, `get_profil_explorateur` de la 355 (live), copiées
-- entières ; seuls la limite, les titres et le signe changent.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signe_fragment_id integer REFERENCES public.title_fragments(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_my_signe(p_fragment_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF p_fragment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_fragments WHERE user_id = (auth.uid())::text AND fragment_id = p_fragment_id
  ) THEN
    RAISE EXCEPTION 'Fragment non possédé' USING ERRCODE = '42501';
  END IF;
  UPDATE users SET signe_fragment_id = p_fragment_id WHERE id = (auth.uid())::text;
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_signe(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_signe(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_displayed_titles(p_title_ids integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids integer[] := COALESCE(p_title_ids, '{}');
  v_debloques integer[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF cardinality(v_ids) > 3 THEN
    RAISE EXCEPTION 'Trois titres au plus' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg((t->>'id')::int), '{}') INTO v_debloques
    FROM json_array_elements(public.get_user_titles((auth.uid())::text) -> 'unlockedGeneralTitles') t;
  IF NOT (v_ids <@ v_debloques) THEN
    RAISE EXCEPTION 'Titre non débloqué' USING ERRCODE = '42501';
  END IF;
  UPDATE users SET displayed_title_ids_v3 = v_ids WHERE id = (auth.uid())::text;
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_displayed_titles(integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_displayed_titles(integer[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profil_explorateur(p_user_id text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  u public.users%ROWTYPE;
  v_moi boolean;
  v_attache json;
BEGIN
  SELECT * INTO u FROM public.users WHERE id = p_user_id AND is_active IS NOT FALSE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_moi := COALESCE((auth.uid())::text = p_user_id, false);

  -- « Noble représentant … » : le département (ou le pays) le plus visité.
  IF u.show_departement OR v_moi THEN
    SELECT to_json(CASE WHEN p.departement IS NOT NULL
                        THEN 'Noble représentant ' || (SELECT d.de_nom FROM public.geo_departements d WHERE d.nom = p.departement)
                        ELSE 'Noble représentant · ' || p.pays END)
      INTO v_attache
      FROM public.place_explorers e JOIN public.places p ON p.id = e.place_id
     WHERE e.user_id = p_user_id AND COALESCE(p.departement, p.pays) IS NOT NULL
       AND (v_moi OR (p.masked IS NOT TRUE AND p.private IS NOT TRUE))
     GROUP BY p.departement, p.pays
     ORDER BY count(*) DESC, max(e.visited_at) DESC
     LIMIT 1;
  END IF;

  RETURN (
    WITH lieux_montrables AS (
      SELECT id, title, images, author_id FROM public.places
       WHERE v_moi OR (masked IS NOT TRUE AND private IS NOT TRUE)
    ),
    ajoutes AS (
      SELECT l.id, l.title, l.images FROM lieux_montrables l WHERE l.author_id = p_user_id
    ),
    visites AS (
      SELECT DISTINCT ON (l.id) l.id, l.title, l.images, e.visited_at FROM public.place_explorers e
        JOIN lieux_montrables l ON l.id = e.place_id
       WHERE e.user_id = p_user_id AND l.id NOT IN (SELECT id FROM ajoutes)
       ORDER BY l.id, e.visited_at DESC
    ),
    envies AS (
      SELECT l.id, l.title, l.images, w.created_at FROM public.place_wishlist w
        JOIN lieux_montrables l ON l.id = w.place_id
       WHERE w.user_id = p_user_id
         AND l.id NOT IN (SELECT id FROM ajoutes) AND l.id NOT IN (SELECT id FROM visites)
    )
    SELECT json_build_object(
      'id', u.id,
      'nom', COALESCE(NULLIF(u.display_name, ''), NULLIF(u.first_name, ''), 'Explorateur'),
      'avatarUrl', u.avatar_url,
      'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
      'titres', COALESCE((
        SELECT json_agg(json_build_object('id', g.id, 'nom', g.name, 'condition', g.condition) ORDER BY g.ord)
          FROM (SELECT t.id, t.name, t.condition, x.ord
                  FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                  JOIN public.titles t ON t.id = x.tid AND t.type = 'general'
                 ORDER BY x.ord
                 LIMIT 3) g), '[]'::json),
      'signe', (
        SELECT json_build_object('id', tf.id, 'nom', tf.name, 'imageUrl', COALESCE(tf.image_url, tf.icon_url))
          FROM public.title_fragments tf
         WHERE tf.id = u.signe_fragment_id
           AND EXISTS (SELECT 1 FROM public.user_fragments f
                        WHERE f.user_id = p_user_id AND f.fragment_id = tf.id)),
      'bio', NULLIF(u.bio, ''),
      'instagram', NULLIF(u.instagram, ''),
      'inscritLe', u.created_at,
      'porteurVerifie', EXISTS (SELECT 1 FROM public.user_fragments f WHERE f.user_id = p_user_id),
      'role', CASE WHEN u.role IN ('admin', 'moderator') THEN u.role END,
      'attache', v_attache,
      'fragments', COALESCE((
        SELECT json_agg(json_build_object('id', tf.id, 'nom', tf.name, 'imageUrl', COALESCE(tf.image_url, tf.icon_url)) ORDER BY f.unlocked_at)
          FROM public.user_fragments f JOIN public.title_fragments tf ON tf.id = f.fragment_id
         WHERE f.user_id = p_user_id), '[]'::json),
      'ajoutes', COALESCE((SELECT json_agg(json_build_object('id', id, 'nom', title, 'imageUrl', images -> 0 ->> 'url')) FROM ajoutes), '[]'::json),
      'visites', COALESCE((SELECT json_agg(json_build_object('id', id, 'nom', title, 'imageUrl', images -> 0 ->> 'url') ORDER BY visited_at DESC) FROM visites), '[]'::json),
      'envies', CASE WHEN u.show_envies OR v_moi THEN
                  COALESCE((SELECT json_agg(json_build_object('id', id, 'nom', title, 'imageUrl', images -> 0 ->> 'url') ORDER BY created_at DESC) FROM envies), '[]'::json)
                END,
      'estMoi', v_moi
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_profil_explorateur(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profil_explorateur(text) TO authenticated;
