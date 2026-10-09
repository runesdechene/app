-- WHY: les saluts de « Sur les chemins » deviennent à volonté (Uriel, 28/09) : chaque toucher
--      ajoute un cœur, on peut en envoyer une armée. Il n'y a plus de salut qu'on retire.
--      On garde une ligne par personne et par activité, qui compte ses cœurs (`nombre`) : la
--      table ne grossit pas au rythme des touchers, et « salue » (j'ai déjà salué) reste lisible.
-- SCHEMA CHECKED: saluts(evenement, user_id, destinataire, created_at, PK (evenement, user_id)),
--      saluer(text) et sur_les_chemins(int) copiées de la définition live du 28/09.

ALTER TABLE public.saluts ADD COLUMN IF NOT EXISTS nombre int NOT NULL DEFAULT 1 CHECK (nombre > 0);

-- Saluer une ligne du fil : un cœur de plus. Rend le nombre de cœurs et si je salue.
CREATE OR REPLACE FUNCTION public.saluer(p_evenement text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur varchar;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  v_auteur := public._auteur_du_chemin(p_evenement);
  IF v_auteur IS NULL THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_auteur = v_moi THEN
    RAISE EXCEPTION 'On ne se salue pas soi-même' USING ERRCODE = '22023';
  END IF;

  INSERT INTO saluts (evenement, user_id, destinataire) VALUES (p_evenement, v_moi, v_auteur)
  ON CONFLICT (evenement, user_id) DO UPDATE SET nombre = saluts.nombre + 1;
  RETURN json_build_object(
    'saluts', (SELECT COALESCE(sum(nombre), 0) FROM saluts WHERE evenement = p_evenement),
    'salue', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.saluer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saluer(text) TO authenticated;

-- Le fil : le compteur additionne les cœurs, plus les personnes.
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
                'id', p.id, 'nom', p.title, 'region', COALESCE(p.departement, p.pays)) END,
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
