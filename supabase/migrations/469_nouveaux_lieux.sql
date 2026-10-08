-- 469 — Les nouveaux lieux rayonnent sur la carte, et la V2 note les fiches ouvertes
--
-- WHY : Uriel, 08/10/2026 (Figma 523:722, « A en couleur, avec C en plus ») : un lieu ajouté depuis
--   moins de 14 jours rayonne d'une onde à la couleur de sa nature, pour chacun, tant qu'il n'a pas
--   ouvert sa fiche. La V2 ne notait plus les fiches ouvertes : `places_viewed` n'est plus écrite depuis
--   la bascule (dernière ligne le 07/10, par la V1) — d'où aussi l'arrêt des paliers de vues
--   (`milestone_vues`, déclenchés sur cette table). `lieu_vu` les note à nouveau, une ligne par ouverture
--   comme la V1 (les paliers comptent les vues).
--   carte_lieux et carte_publique : définitions live du 08/10 copiées entières ; seule s'ajoute la clé
--   'nouveau' (pour un visiteur : ajouté depuis moins de 14 jours).
--
-- SCHEMA CHECKED (08/10/2026, live) : places_viewed(id varchar sans défaut, created_at, updated_at,
--   user_id varchar, place_id varchar), déclencheur trg_milestone_vues ; places(created_at, author_id).

CREATE OR REPLACE FUNCTION public.lieu_vu(p_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_moi text := (auth.uid())::text;
BEGIN
  IF v_moi IS NULL THEN RETURN; END IF; -- un visiteur ne laisse pas de trace
  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_id) THEN RETURN; END IF;
  INSERT INTO places_viewed (id, created_at, updated_at, user_id, place_id)
  VALUES (gen_random_uuid()::text, now(), now(), v_moi, p_id);
END $$;

REVOKE ALL ON FUNCTION public.lieu_vu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lieu_vu(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.carte_lieux()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT COALESCE(json_agg(json_build_object(
    'id', p.id,
    'nom', p.title,
    'lat', p.latitude,
    'lng', p.longitude,
    'nature', p.nature,
    'icone', t.icon,
    'couleur', t.color,
    -- Pour les filtres (396) : toutes ses natures, son époque, et si je l'ai ajouté.
    'natures', COALESCE((SELECT json_agg(x.tag_id) FROM place_tags x WHERE x.place_id = p.id), '[]'::json),
    'epoque', p.era_id,
    'ajoute', p.author_id = moi.id,
    -- 469 : ajouté depuis moins de 14 jours par un autre, et pas encore ouvert par moi.
    'nouveau', CASE WHEN p.created_at > now() - interval '14 days' AND p.author_id IS DISTINCT FROM moi.id
      THEN NOT EXISTS (SELECT 1 FROM places_viewed w WHERE w.place_id = p.id AND w.user_id = moi.id)
      ELSE false END,
    'etat', CASE
      WHEN EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = p.id AND e.user_id = moi.id) THEN 'visite'
      WHEN p.author_id = moi.id
        OR EXISTS (SELECT 1 FROM places_discovered d WHERE d.place_id = p.id AND d.user_id = moi.id) THEN 'connu'
      ELSE 'inconnu' END,
    -- Le nom sur la pilule : celui de l'expédition, sinon celui du dernier qui l'a revendiqué.
    'revendication', (
      SELECT json_build_object(
        'nom', COALESCE(NULLIF(x.title, ''), NULLIF(u.display_name, ''), NULLIF(u.first_name, ''), 'Explorateur'),
        'moi', v.veilleur_user_id = moi.id
          OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = moi.id))
      FROM place_veille v
      LEFT JOIN expeditions x ON x.id = v.expedition_id
      LEFT JOIN users u ON u.id = v.veilleur_user_id
      WHERE v.place_id = p.id AND p.nature = 'lieu')
  )), '[]'::json)
  FROM places p
  CROSS JOIN moi
  LEFT JOIN place_tags pt ON pt.place_id = p.id AND pt.is_primary
  LEFT JOIN tags t ON t.id = pt.tag_id
  WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
    AND ((p.masked IS NOT TRUE AND p.private IS NOT TRUE) OR p.author_id = moi.id);
$function$;

CREATE OR REPLACE FUNCTION public.carte_publique()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
    'id', p.id,
    'nom', p.title,
    -- 0,027° de latitude ≈ 3 km ; en longitude, 0,038° ≈ 3 km vers 45° de latitude.
    'lat', round((p.latitude + 0.027 * _hasard_fixe(p.id || ':lat'))::numeric, 4),
    'lng', round((p.longitude + 0.038 * _hasard_fixe(p.id || ':lng'))::numeric, 4),
    'nature', p.nature,
    'icone', t.icon,
    'couleur', t.color,
    'etat', 'inconnu',
    'nouveau', p.created_at > now() - interval '14 days', -- 469
    'revendication', NULL
  )), '[]'::json)
  FROM places p
  LEFT JOIN place_tags pt ON pt.place_id = p.id AND pt.is_primary
  LEFT JOIN tags t ON t.id = pt.tag_id
  WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
    AND p.masked IS NOT TRUE AND p.private IS NOT TRUE;
$function$;
