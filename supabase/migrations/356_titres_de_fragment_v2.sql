-- 356 — Les titres de fragment se portent aussi en V2
--
-- WHY : décisions d'Uriel (27/09) — en V2 on porte TROIS titres au plus, « généraux ou liés
-- à nos fragments », et toucher un titre explique d'où il vient. Posséder un Fragment débloque ses mots (`fragment_words`), rangés par la V1
-- dans `displayed_title_ids_v3` avec un identifiant NÉGATIF (-fragment_words.id), comme le fait
-- `get_all_player_titles`. Une seule source, `_titres_portables`, dit ce qu'un Explorateur peut
-- porter ; la lecture du formulaire et l'écriture s'y fient toutes les deux. Le profil public
-- renvoie l'origine de chaque titre : le Fragment (nom, image, date d'obtention) ou la condition
-- de jeu (`titles.condition`, que le front met en phrase).
-- Titres de Compagnie : ne se portent plus en V2 (décision du même jour).
-- `set_my_displayed_titles` part de la 353, `get_profil_explorateur` de la 355 (live), copiées
-- entières ; seuls les passages sur les titres changent.

-- Généraux débloqués, puis mots des Fragments possédés (fragments visibles ; tous pour un
-- admin, comme en V1).
CREATE OR REPLACE FUNCTION public._titres_portables(p_user_id text)
RETURNS TABLE(id integer, nom text, fragment text, image_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (t->>'id')::int, t->>'name', NULL::text, NULL::text
    FROM json_array_elements(public.get_user_titles(p_user_id) -> 'unlockedGeneralTitles') t
  UNION ALL
  SELECT -fw.id, fw.word::text, tf.name::text, COALESCE(tf.image_url, tf.icon_url)
    FROM public.fragment_words fw
    JOIN public.title_fragments tf ON tf.id = fw.fragment_id
   WHERE EXISTS (SELECT 1 FROM public.user_fragments uf
                  WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id)
     AND (tf.visible OR EXISTS (SELECT 1 FROM public.users u
                                 WHERE u.id = p_user_id AND u.role = 'admin'));
$$;
REVOKE ALL ON FUNCTION public._titres_portables(text) FROM PUBLIC, anon, authenticated;

-- Ce que l'Explorateur connecté peut porter, pour « Modifier mon profil ».
CREATE OR REPLACE FUNCTION public.get_my_wearable_titles()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object('id', p.id, 'nom', p.nom, 'fragment', p.fragment, 'imageUrl', p.image_url)
                           ORDER BY p.fragment NULLS FIRST, p.nom), '[]'::json)
    FROM public._titres_portables((auth.uid())::text) p
   WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_my_wearable_titles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_wearable_titles() TO authenticated;

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
  SELECT COALESCE(array_agg(p.id), '{}') INTO v_debloques
    FROM public._titres_portables((auth.uid())::text) p;
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
        SELECT json_agg(json_build_object(
                 'id', g.id, 'nom', g.nom, 'condition', g.condition,
                 'fragment', CASE WHEN g.fragment IS NULL THEN NULL
                                  ELSE json_build_object('nom', g.fragment, 'imageUrl', g.image_url,
                                                         'depuis', g.depuis) END
               ) ORDER BY g.ord)
          FROM (SELECT x.tid AS id, COALESCE(t.name, fw.word)::text AS nom, x.ord,
                       t.condition, tf.name::text AS fragment,
                       COALESCE(tf.image_url, tf.icon_url) AS image_url,
                       (SELECT min(uf.unlocked_at) FROM public.user_fragments uf
                         WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id) AS depuis
                  FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                  LEFT JOIN public.titles t ON t.id = x.tid AND t.type = 'general'
                  LEFT JOIN public.fragment_words fw ON fw.id = -x.tid
                  LEFT JOIN public.title_fragments tf ON tf.id = fw.fragment_id
                 WHERE COALESCE(t.name, fw.word) IS NOT NULL
                 ORDER BY x.ord
                 LIMIT 3) g), '[]'::json),
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
