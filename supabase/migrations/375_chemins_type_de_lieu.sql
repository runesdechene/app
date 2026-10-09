-- WHY: dans « Sur les chemins », une ligne « a ajouté » porte l'icône du type de lieu, dans sa
--      couleur, au lieu de l'épingle (Uriel, 29/09). Le fil rend donc le type du lieu : son
--      icône et sa couleur, celles du badge de la fiche (mig 366).
-- SCHEMA CHECKED: tags(id, title, color varchar, icon varchar) ; place_tags(place_id, tag_id,
--      is_primary) — information_schema, 29/09. sur_les_chemins(int) copiée de la définition
--      live (celle de la mig 374, appliquée le 28/09) ; seul l'objet « lieu » gagne « type ».

CREATE OR REPLACE FUNCTION public.sur_les_chemins(p_limite integer DEFAULT 20)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  evenements AS (
    (SELECT 'visite:' || e.place_id || ':' || e.user_id AS id, 'visite' AS type, e.visited_at AS quand,
            e.user_id AS qui, e.place_id AS lieu
     FROM place_explorers e JOIN places p ON p.id = e.place_id
     WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY e.visited_at DESC LIMIT 200)
    UNION ALL
    (SELECT 'ajout:' || p.id, 'ajout', p.created_at, p.author_id, p.id
     FROM places p
     WHERE p.author_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY p.created_at DESC LIMIT 200)
    UNION ALL
    (SELECT 'arrivee:' || u.id, 'arrivee', u.created_at, u.id, NULL
     FROM users u ORDER BY u.created_at DESC LIMIT 100)
  ),
  -- Une ligne au plus par personne, par type et par jour : la plus récente.
  une_par_jour AS (
    SELECT DISTINCT ON (type, qui, quand::date) *
    FROM evenements ORDER BY type, qui, quand::date, quand DESC
  ),
  retenus AS (
    SELECT * FROM une_par_jour ORDER BY quand DESC LIMIT least(greatest(p_limite, 1), 50)
  )
  SELECT COALESCE(json_agg(json_build_object(
      'id', r.id,
      'type', r.type,
      'quand', r.quand,
      'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url),
      'lieu', CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object(
                'id', p.id, 'nom', p.title, 'region', COALESCE(p.departement, p.pays),
                'type', (SELECT json_build_object('icone', t.icon, 'couleur', t.color)
                         FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
                         WHERE pt.place_id = p.id AND pt.is_primary AND t.icon IS NOT NULL
                         LIMIT 1)) END,
      'moi', r.qui = moi.id, -- ma propre ligne : on ne se salue pas soi-même
      'saluts', (SELECT COALESCE(sum(s.nombre), 0) FROM saluts s WHERE s.evenement = r.id),
      'salue', EXISTS (SELECT 1 FROM saluts s WHERE s.evenement = r.id AND s.user_id = moi.id))
    ORDER BY r.quand DESC), '[]'::json)
  FROM retenus r
  CROSS JOIN moi
  JOIN users u ON u.id = r.qui
  LEFT JOIN places p ON p.id = r.lieu;
$function$;

REVOKE ALL ON FUNCTION public.sur_les_chemins(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sur_les_chemins(integer) TO authenticated;
