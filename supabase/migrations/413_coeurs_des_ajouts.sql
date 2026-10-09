-- WHY: les cœurs d'un ajout dans « Sur les chemins » sont ceux de la fiche du lieu (Uriel, 05/10/2026 :
--      « ce sont les likes de la fiche de lieu qui doivent primer ») : aimer depuis le fil remplit
--      la fiche, et la ligne montre le compteur de la fiche.
--   1. Les saluts déjà donnés aux lignes d'ajout sont versés dans coeurs_lieu (une fois).
--   2. saluer (copiée de sa définition live, la 386) : un ajout passe par aimer_lieu.
--   3. sur_les_chemins (copiée de sa définition live, la 411) : un ajout montre les cœurs de la fiche.
-- SCHEMA CHECKED (05/10/2026) : saluts(evenement, user_id, nombre, created_at) ;
--      coeurs_lieu(place_id, user_id, nombre, premier_le, dernier_le) ; places(id, author_id) ;
--      aimer_lieu(text) → json {total, miens}.

-- Les cœurs déjà donnés aux lignes d'ajout rejoignent ceux de la fiche (une fois) : si quelqu'un en
-- avait mis 3 sur la ligne et 5 sur la fiche, il en a 8 sur la fiche. Les lignes de saluts restent
-- en base, simplement plus lues. Jamais de cœurs à soi-même (la fiche le refuse aussi).
INSERT INTO public.coeurs_lieu (place_id, user_id, nombre, premier_le, dernier_le)
SELECT p.id, s.user_id, s.nombre, s.created_at, s.created_at
FROM public.saluts s
JOIN public.places p ON p.id = split_part(s.evenement, ':', 2)
WHERE s.evenement LIKE 'ajout:%' AND s.user_id IS DISTINCT FROM p.author_id
ON CONFLICT (place_id, user_id) DO UPDATE
  SET nombre = coeurs_lieu.nombre + EXCLUDED.nombre,
      premier_le = least(coeurs_lieu.premier_le, EXCLUDED.premier_le),
      dernier_le = greatest(coeurs_lieu.dernier_le, EXCLUDED.dernier_le);

CREATE OR REPLACE FUNCTION public.saluer(p_evenement text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur varchar;
  v_nombre int;
  v_nom text;
  v_coeurs json;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  -- 413 : saluer un ajout, c'est envoyer un cœur au lieu — ceux de sa fiche, qui font foi
  -- (aimer_lieu : même refus pour son propre lieu, même notification à ceux qui l'ont fait).
  IF split_part(p_evenement, ':', 1) = 'ajout' THEN
    v_coeurs := public.aimer_lieu(split_part(p_evenement, ':', 2));
    RETURN json_build_object('saluts', v_coeurs->'total', 'salue', true);
  END IF;

  v_auteur := public._auteur_du_chemin(p_evenement);
  IF v_auteur IS NULL THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_auteur = v_moi THEN
    RAISE EXCEPTION 'On ne se salue pas soi-même' USING ERRCODE = '22023';
  END IF;

  INSERT INTO saluts (evenement, user_id, destinataire) VALUES (p_evenement, v_moi, v_auteur)
  ON CONFLICT (evenement, user_id) DO UPDATE SET nombre = saluts.nombre + 1
  RETURNING nombre INTO v_nombre;

  -- Le premier salut de quelqu'un prévient qui est salué ; les suivants, non.
  IF v_nombre = 1 THEN
    BEGIN
      SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
      PERFORM notify(v_auteur, 'salut', jsonb_build_object(
        'actorId', v_moi, 'actorName', v_nom, 'evenement', p_evenement,
        'placeId', CASE WHEN split_part(p_evenement, ':', 1) IN ('visite', 'ajout')
                        THEN split_part(p_evenement, ':', 2) END));
    EXCEPTION WHEN others THEN
      RAISE WARNING 'saluer : notification en échec (%)', SQLERRM;
    END;
  END IF;

  RETURN json_build_object(
    'saluts', (SELECT COALESCE(sum(nombre), 0) FROM saluts WHERE evenement = p_evenement),
    'salue', true);
END;
$function$;

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
    -- 411 : les arrivées reviennent (un moment de bienvenue) ; les connexions restent retirées.
    (SELECT 'arrivee:' || u.id, 'arrivee', u.created_at, u.id, NULL
     FROM users u ORDER BY u.created_at DESC LIMIT 100)
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
      -- 413 : un ajout porte les cœurs de la fiche du lieu ; les autres lignes, leurs saluts.
      'saluts', CASE WHEN r.type = 'ajout'
        THEN (SELECT COALESCE(sum(c.nombre), 0) FROM coeurs_lieu c WHERE c.place_id = r.lieu)
        ELSE (SELECT COALESCE(sum(s.nombre), 0) FROM saluts s WHERE s.evenement = r.id) END,
      'salue', CASE WHEN r.type = 'ajout'
        THEN EXISTS (SELECT 1 FROM coeurs_lieu c WHERE c.place_id = r.lieu AND c.user_id = moi.id)
        ELSE EXISTS (SELECT 1 FROM saluts s WHERE s.evenement = r.id AND s.user_id = moi.id) END)
    ORDER BY r.quand DESC), '[]'::json)
  FROM retenus r
  CROSS JOIN moi
  JOIN users u ON u.id = r.qui
  LEFT JOIN places p ON p.id = r.lieu;
$function$;
