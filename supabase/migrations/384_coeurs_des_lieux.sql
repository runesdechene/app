-- WHY: Uriel, 30/09 : « aimer le lieu, et ainsi féliciter la personne qui l'a ajouté ou les gens
--      qui y ont contribué » — à volonté, « addictif comme pour les Activités », et voir qui a
--      envoyé des cœurs (avatar et nombre). Même modèle que les saluts (374) : une ligne par
--      personne et par lieu, qui compte ses cœurs ; la table ne grossit pas au rythme des touchers.
--   1. coeurs_lieu : la table. Les 470 « j'aime » de la V1 (description d'un lieu, vote = 1) y
--      entrent comme un premier cœur : aucun lieu ne repart de zéro. La V1 garde sa table.
--   2. aimer_lieu(p_id) : un cœur de plus. On ne s'en envoie pas sur son propre lieu. Au premier
--      cœur d'une personne (pas à chaque toucher), l'auteur et ceux qui ont écrit la description
--      sont prévenus — la notification « like_contribution » que la V1 sait déjà afficher.
--   3. coeurs_du_lieu(p_id) : le total, les miens, et qui (les plus généreux d'abord).
-- SCHEMA CHECKED (30/09/2026, information_schema et définitions live) : places(id varchar,
--      author_id, title) ; users(id, display_name, first_name, avatar_url) ;
--      contribution_votes(contribution_id int, user_id varchar, vote smallint, created_at) ;
--      place_contributions(id int, place_id varchar, type text) ;
--      place_description_revisions(place_id varchar, edited_by varchar) ;
--      notify(p_recipient text, p_type text, p_data jsonb) ; _lieu_visible(p_id text) ;
--      user_public_name(text, text, text).

CREATE TABLE public.coeurs_lieu (
  place_id varchar NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nombre int NOT NULL DEFAULT 1 CHECK (nombre > 0),
  premier_le timestamptz NOT NULL DEFAULT now(),
  dernier_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, user_id)
);
-- Lue et écrite par les seules fonctions ci-dessous.
ALTER TABLE public.coeurs_lieu ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coeurs_lieu FROM PUBLIC, anon, authenticated;

INSERT INTO public.coeurs_lieu (place_id, user_id, nombre, premier_le, dernier_le)
SELECT c.place_id, v.user_id, 1, min(v.created_at), min(v.created_at)
FROM contribution_votes v
JOIN place_contributions c ON c.id = v.contribution_id
JOIN places p ON p.id = c.place_id
JOIN users u ON u.id = v.user_id
WHERE c.type = 'description' AND v.vote = 1 AND v.user_id <> COALESCE(p.author_id, '')
GROUP BY c.place_id, v.user_id
ON CONFLICT DO NOTHING;

-- Un cœur de plus. Rend le total du lieu et les miens.
CREATE OR REPLACE FUNCTION public.aimer_lieu(p_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur text;
  v_titre text;
  v_nombre int;
  v_qui text;
  v_nom text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT author_id, title INTO v_auteur, v_titre FROM places WHERE id = p_id;
  IF v_auteur = v_moi THEN
    RAISE EXCEPTION 'On ne s’envoie pas de cœurs' USING ERRCODE = '22023';
  END IF;

  INSERT INTO coeurs_lieu (place_id, user_id) VALUES (p_id, v_moi)
  ON CONFLICT (place_id, user_id)
    DO UPDATE SET nombre = coeurs_lieu.nombre + 1, dernier_le = now()
  RETURNING nombre INTO v_nombre;

  -- Le premier cœur de quelqu'un prévient ceux qui ont fait le lieu ; les suivants, non.
  IF v_nombre = 1 THEN
    SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
    FOR v_qui IN
      SELECT v_auteur WHERE v_auteur IS NOT NULL
      UNION
      SELECT r.edited_by FROM place_description_revisions r WHERE r.place_id = p_id
    LOOP
      IF v_qui <> v_moi THEN
        PERFORM notify(v_qui, 'like_contribution', jsonb_build_object(
          'actorName', v_nom, 'actorId', v_moi, 'placeTitle', v_titre, 'placeId', p_id,
          'contributionType', 'description'));
      END IF;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'total', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_lieu WHERE place_id = p_id),
    'miens', v_nombre);
END;
$function$;

REVOKE ALL ON FUNCTION public.aimer_lieu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aimer_lieu(text) TO authenticated;

-- Les cœurs d'un lieu : le total, les miens, et qui (les plus généreux d'abord, cent au plus).
CREATE OR REPLACE FUNCTION public.coeurs_du_lieu(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN NOT public._lieu_visible(p_id) THEN NULL ELSE json_build_object(
    'total', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_lieu WHERE place_id = p_id),
    'miens', (SELECT COALESCE(sum(nombre), 0) FROM coeurs_lieu
              WHERE place_id = p_id AND user_id = (auth.uid())::text),
    'gens', (SELECT COALESCE(json_agg(json_build_object(
                'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
                'avatar', u.avatar_url, 'nombre', c.nombre)
              ORDER BY c.nombre DESC, c.dernier_le DESC), '[]'::json)
             FROM (SELECT * FROM coeurs_lieu WHERE place_id = p_id
                   ORDER BY nombre DESC, dernier_le DESC LIMIT 100) c
             JOIN users u ON u.id = c.user_id)
  ) END;
$function$;

REVOKE ALL ON FUNCTION public.coeurs_du_lieu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coeurs_du_lieu(text) TO authenticated;
