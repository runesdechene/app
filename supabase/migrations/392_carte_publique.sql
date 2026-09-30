-- 392 — La carte des visiteurs, aux positions floutées
--
-- WHY : Uriel, 30/09/2026 — l'aperçu d'un lieu s'ouvre par-dessus la carte, et le visiteur sans
-- compte peut s'y promener, choisir d'autres lieux, toujours devant la même invitation. Choix
-- tranché : la carte montre tous les lieux publics, mais chaque position est **déplacée de
-- quelques kilomètres** (jusqu'à ~3 km). L'endroit exact reste ce que le compte ouvre ; qui aspire
-- la carte sans compte n'emporte que des à-peu-près.
-- Le décalage est tiré du md5 de l'identifiant : toujours le même pour un lieu (le lieu ne saute
-- pas d'une visite à l'autre, et redemander ne permet pas de moyenner). Même forme que
-- `carte_lieux` (363), pour que la carte dessine l'une ou l'autre : tout est « inconnu », sans
-- revendication (jamais de personne).
--
-- SCHEMA CHECKED (30/09/2026) : places(id, title, latitude, longitude, nature, masked, private) ;
--   place_tags(place_id, tag_id, is_primary) ; tags(id, icon, color) (définition live de
--   carte_lieux, mig 363).

-- Un nombre entre -1 et 1, fixe pour un texte donné.
CREATE OR REPLACE FUNCTION public._hasard_fixe(p_texte text)
 RETURNS float8
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT ('x' || substr(md5(p_texte), 1, 8))::bit(32)::int / 2147483648.0;
$function$;
REVOKE ALL ON FUNCTION public._hasard_fixe(text) FROM PUBLIC, anon, authenticated;

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
    'revendication', NULL
  )), '[]'::json)
  FROM places p
  LEFT JOIN place_tags pt ON pt.place_id = p.id AND pt.is_primary
  LEFT JOIN tags t ON t.id = pt.tag_id
  WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
    AND p.masked IS NOT TRUE AND p.private IS NOT TRUE;
$function$;
REVOKE ALL ON FUNCTION public.carte_publique() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.carte_publique() TO anon, authenticated;
