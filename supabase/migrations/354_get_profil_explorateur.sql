-- 354 — Le profil public d'un Explorateur, en une lecture
--
-- WHY : zone Compte. Une seule fonction renvoie exactement ce qu'un profil public a le droit de
-- montrer — jamais d'e-mail ni de position. Les trois listes arrivent déjà exclusives
-- (Ajoutés > Visités > Envie d'y aller) ; les envies ne sont montrées qu'à soi ou si l'Explorateur
-- les montre ; les lieux masqués ou privés ne sont jamais montrés à un autre. Lecture seule :
-- p_user_id est ici le profil CONSULTÉ, pas une identité revendiquée.

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
        SELECT json_agg(json_build_object('id', t.id, 'nom', t.name) ORDER BY x.ord)
          FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
          JOIN public.titles t ON t.id = x.tid AND t.faction_id IS NULL
         WHERE x.ord <= 2), '[]'::json),
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
