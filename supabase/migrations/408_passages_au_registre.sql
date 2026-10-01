-- WHY: les gens qui passent vont au Registre (Uriel, 01/10/2026 : « c'est peut-être là que ça
--      avait sa place, plutôt que dans Sur les chemins »). Sur les chemins raconte les lieux ;
--      l'arrivée et la connexion disent « quelqu'un entre », et la bienvenue s'y écrit sur place.
--   1. sur_les_chemins (copiée de sa définition live) : sans les arrivées ni les connexions.
--   2. passages_au_registre() : les arrivées et les connexions, pour le canal général du Registre
--      (la V2 les mêle aux messages ; rien n'est écrit dans chat_messages, que la V1 lit aussi).
--   _auteur_du_chemin garde ses branches arrivee/connexion : des saluts déjà donnés y renvoient.
-- SCHEMA CHECKED (01/10/2026, information_schema et définitions live) : users(id text, created_at,
--      last_login_at, display_name, first_name, avatar_url) ; user_public_name(text, text, text) ;
--      sur_les_chemins(int) copiée du live (identique à la 406).

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
    -- 408 : les arrivées et les connexions sont parties au Registre (passages_au_registre).
    UNION ALL
    -- 406 : les revendications (V1 et V2 écrivent veille_history).
    (SELECT 'revendication:' || h.place_id || ':' || h.user_id || ':'
              || floor(extract(epoch FROM h.planted_at))::bigint,
            'revendication', h.planted_at, h.user_id, h.place_id
     FROM veille_history h JOIN places p ON p.id = h.place_id
     WHERE h.user_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY h.planted_at DESC LIMIT 200)
    UNION ALL
    -- 406 : le récit enrichi (V1 et V2 écrivent place_description_revisions), sauf le récit de
    -- départ, posé par l'auteur à l'ajout.
    (SELECT 'enrichi:' || d.place_id || ':' || d.edited_by || ':'
              || floor(extract(epoch FROM d.created_at))::bigint,
            'enrichi', d.created_at, d.edited_by, d.place_id
     FROM place_description_revisions d JOIN places p ON p.id = d.place_id
     WHERE d.edited_by IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
       AND NOT (d.edited_by = p.author_id AND d.created_at < p.created_at + interval '10 minutes')
     ORDER BY d.created_at DESC LIMIT 200)
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

-- Les gens qui passent, pour le canal général du Registre : qui a rejoint EXPLORE, et la dernière
-- connexion de chacun (une ligne par personne, la nouvelle chasse l'ancienne ; ni la mienne, ni
-- celle de qui vient de s'inscrire — sa ligne « a rejoint » suffit). Rien n'est écrit dans
-- chat_messages : la V1 n'en voit rien.
CREATE OR REPLACE FUNCTION public.passages_au_registre()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  passages AS (
    (SELECT 'arrivee:' || u.id AS id, 'arrivee' AS type, u.created_at AS quand, u.id AS qui
     FROM users u ORDER BY u.created_at DESC LIMIT 100)
    UNION ALL
    (SELECT 'connexion:' || u.id, 'connexion', u.last_login_at, u.id
     FROM users u CROSS JOIN moi
     WHERE u.last_login_at IS NOT NULL AND u.last_login_at > u.created_at + interval '10 minutes'
       AND u.id IS DISTINCT FROM moi.id
     ORDER BY u.last_login_at DESC LIMIT 100)
  )
  SELECT COALESCE(json_agg(json_build_object(
      'id', p.id,
      'type', p.type,
      'quand', p.quand,
      'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url),
      'moi', p.qui = moi.id)
    ORDER BY p.quand), '[]'::json)
  FROM passages p
  CROSS JOIN moi
  JOIN users u ON u.id = p.qui
  WHERE moi.id IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.passages_au_registre() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.passages_au_registre() TO authenticated;
