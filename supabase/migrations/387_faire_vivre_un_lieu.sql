-- WHY: « faire vivre un lieu » (spec fiche §8 : Modifier ouvert à tous et versionné, l'histoire du
--      lieu, Signaler ; maquettes Figma « Lieu — modifier la fiche », « Lieu — l'histoire de la
--      fiche », « Lieu — signaler », 30/09).
--   1. versions_lieu : chaque enregistrement d'une fiche (nom, natures, époque, année, récit) est
--      une version. Paresseux : la première modification d'un lieu inscrit d'abord sa version
--      d'origine (son auteur, sa date d'ajout) — rien à recopier pour les 3 481 lieux d'avant.
--   2. lieu_a_modifier(p_id) : la fiche telle qu'elle est, pour l'écran « Modifier ».
--      modifier_lieu(...) : ouvert à qui a découvert le lieu (la fiche ne se lit qu'après), à son
--      auteur et au staff. Mêmes règles que l'ajout (381). Le récit continue d'écrire l'historique
--      de la V1 (place_description_revisions, place_contributions) : la V1 reste juste. Qui a fait
--      le lieu est prévenu (« lieu_modifie », ou « description_edited » pour le récit seul).
--      Cinquante modifications par jour au plus.
--   3. histoire_du_lieu(p_id) : les versions, de la plus récente à l'origine, avec ce qui a changé.
--   4. revenir_a_version(p_version) : repose une version — ce qui en crée une nouvelle.
--   5. signalements_lieu + signaler_lieu(...) : cinq raisons et un mot ; un signalement ouvert par
--      personne et par lieu (le refaire le met à jour). Vingt par jour au plus.
--   6. mod_signalements() / mod_traiter_signalement(p_id) : la file du Hub (staff).
--   7. _notification_v2 : « lieu_modifie » rejoint les sortes lues par la V2 (386).
-- SCHEMA CHECKED (30/09/2026, information_schema et définitions live) : places(id varchar,
--      author_id, title varchar, text, era_id, year_exact int, masked, private, updated_at) ;
--      place_tags(place_id, tag_id, is_primary) ; tags(id) ; eras(id) ;
--      places_discovered(user_id, place_id) ; place_description_revisions(place_id, content,
--      edited_by, created_at) ; place_contributions(place_id, user_id, type, content, created_at,
--      updated_at), unique (place_id) where type = 'description' ; users(id, display_name,
--      first_name, avatar_url) ; notify(text, text, jsonb) ; _lieu_visible(text) ; _is_staff() ;
--      user_public_name(text, text, text) ; _notification_v2(text) (386).

CREATE TABLE public.versions_lieu (
  id bigserial PRIMARY KEY,
  place_id varchar NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  auteur varchar REFERENCES public.users(id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  nom text NOT NULL,
  natures text[] NOT NULL,
  epoque text,
  annee int,
  recit text NOT NULL,
  note text
);
CREATE INDEX versions_lieu_place ON public.versions_lieu (place_id, cree_le DESC);
ALTER TABLE public.versions_lieu ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.versions_lieu FROM PUBLIC, anon, authenticated;

CREATE TABLE public.signalements_lieu (
  id bigserial PRIMARY KEY,
  place_id varchar NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  raison text NOT NULL CHECK (raison IN ('n_existe_pas', 'prive_ou_dangereux', 'doublon', 'contenu', 'autre')),
  precision text CHECK (char_length(precision) <= 500),
  cree_le timestamptz NOT NULL DEFAULT now(),
  traite_le timestamptz,
  traite_par varchar REFERENCES public.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX signalements_lieu_ouvert ON public.signalements_lieu (place_id, user_id) WHERE traite_le IS NULL;
ALTER TABLE public.signalements_lieu ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signalements_lieu FROM PUBLIC, anon, authenticated;

-- La fiche telle qu'elle est, pour la version d'origine et pour comparer.
CREATE OR REPLACE FUNCTION public._etat_du_lieu(p_id text)
 RETURNS TABLE (nom text, natures text[], epoque text, annee int, recit text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.title::text,
         COALESCE((SELECT array_agg(t.tag_id::text ORDER BY t.is_primary DESC, t.tag_id)
                   FROM place_tags t WHERE t.place_id = p.id), '{}'),
         p.era_id::text, p.year_exact, COALESCE(p.text, '')
  FROM places p WHERE p.id = p_id;
$function$;
REVOKE ALL ON FUNCTION public._etat_du_lieu(text) FROM PUBLIC, anon, authenticated;

-- La fiche telle qu'elle est, pour l'écran « Modifier » (et sa photo principale).
CREATE OR REPLACE FUNCTION public.lieu_a_modifier(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN NOT public._lieu_visible(p_id) THEN NULL ELSE (
    SELECT json_build_object('nom', e.nom, 'natures', e.natures, 'epoque', e.epoque,
      'annee', e.annee, 'recit', e.recit,
      'photo', (SELECT p.images->0->>'url' FROM places p WHERE p.id = p_id))
    FROM public._etat_du_lieu(p_id) e) END;
$function$;
REVOKE ALL ON FUNCTION public.lieu_a_modifier(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lieu_a_modifier(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.modifier_lieu(
  p_id text,
  p_nom text,
  p_natures text[],
  p_recit text,
  p_epoque text DEFAULT NULL,
  p_annee integer DEFAULT NULL,
  p_note text DEFAULT NULL
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_nom text := btrim(p_nom);
  v_recit text := btrim(p_recit);
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_avant record;
  v_auteur text;
  v_cree timestamptz;
  v_i int;
  v_qui text;
  v_nom_moi text;
  v_version bigint;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT author_id, created_at INTO v_auteur, v_cree FROM places WHERE id = p_id;
  IF v_auteur IS DISTINCT FROM v_moi AND NOT public._is_staff()
     AND NOT EXISTS (SELECT 1 FROM places_discovered WHERE place_id = p_id AND user_id = v_moi) THEN
    RAISE EXCEPTION 'Découvre ce lieu avant de le modifier' USING ERRCODE = 'P0001', HINT = 'decouvrir';
  END IF;
  IF (SELECT count(*) FROM versions_lieu WHERE auteur = v_moi AND cree_le > now() - interval '1 day') >= 50 THEN
    RAISE EXCEPTION 'Cinquante modifications aujourd’hui : reviens demain' USING ERRCODE = 'P0001', HINT = 'limite';
  END IF;
  IF v_nom IS NULL OR char_length(v_nom) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Un nom, de 1 à 120 signes' USING ERRCODE = '22023';
  END IF;
  IF v_recit IS NULL OR char_length(v_recit) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'Un récit, de 1 à 5000 signes' USING ERRCODE = '22023';
  END IF;
  IF coalesce(cardinality(p_natures), 0) NOT BETWEEN 1 AND 3
     OR (SELECT count(DISTINCT n) FROM unnest(p_natures) n) <> cardinality(p_natures)
     OR (SELECT count(*) FROM tags WHERE id = ANY (p_natures)) <> cardinality(p_natures) THEN
    RAISE EXCEPTION 'De une à trois natures, connues' USING ERRCODE = '22023';
  END IF;
  IF p_epoque IS NOT NULL AND NOT EXISTS (SELECT 1 FROM eras WHERE id = p_epoque) THEN
    RAISE EXCEPTION 'Époque inconnue' USING ERRCODE = '22023';
  END IF;
  IF p_annee IS NOT NULL AND p_annee NOT BETWEEN -10000 AND 2100 THEN
    RAISE EXCEPTION 'Année impossible' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(v_note, '')) > 140 THEN
    RAISE EXCEPTION 'Une note de 140 signes au plus' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_avant FROM public._etat_du_lieu(p_id);
  IF v_avant.nom = v_nom AND v_avant.natures = p_natures AND v_avant.epoque IS NOT DISTINCT FROM p_epoque
     AND v_avant.annee IS NOT DISTINCT FROM p_annee AND v_avant.recit = v_recit THEN
    RAISE EXCEPTION 'Rien n’a changé' USING ERRCODE = 'P0001', HINT = 'rien';
  END IF;

  -- La version d'origine, inscrite à la première modification.
  IF NOT EXISTS (SELECT 1 FROM versions_lieu WHERE place_id = p_id) THEN
    INSERT INTO versions_lieu (place_id, auteur, cree_le, nom, natures, epoque, annee, recit)
    VALUES (p_id, v_auteur, v_cree, v_avant.nom, v_avant.natures, v_avant.epoque, v_avant.annee, v_avant.recit);
  END IF;

  UPDATE places SET title = v_nom, text = v_recit, era_id = p_epoque, year_exact = p_annee, updated_at = now()
  WHERE id = p_id;
  IF v_avant.natures <> p_natures THEN
    DELETE FROM place_tags WHERE place_id = p_id;
    FOR v_i IN 1 .. cardinality(p_natures) LOOP
      INSERT INTO place_tags (place_id, tag_id, is_primary) VALUES (p_id, p_natures[v_i], v_i = 1);
    END LOOP;
  END IF;
  -- Le récit : l'historique de la V1 continue d'être écrit.
  IF v_avant.recit <> v_recit THEN
    INSERT INTO place_description_revisions (place_id, content, edited_by, created_at)
    VALUES (p_id, v_recit, v_moi, now());
    UPDATE place_contributions SET content = v_recit, user_id = v_moi, updated_at = now()
    WHERE place_id = p_id AND type = 'description';
    IF NOT FOUND THEN
      INSERT INTO place_contributions (place_id, user_id, type, content, created_at, updated_at)
      VALUES (p_id, v_moi, 'description', v_recit, now(), now());
    END IF;
  END IF;

  INSERT INTO versions_lieu (place_id, auteur, nom, natures, epoque, annee, recit, note)
  VALUES (p_id, v_moi, v_nom, p_natures, p_epoque, p_annee, v_recit, v_note)
  RETURNING id INTO v_version;

  -- Ceux qui ont fait le lieu sont prévenus ; un échec ici n'annule pas la modification.
  BEGIN
    SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom_moi FROM users u WHERE u.id = v_moi;
    FOR v_qui IN
      SELECT v_auteur WHERE v_auteur IS NOT NULL
      UNION
      SELECT r.edited_by FROM place_description_revisions r WHERE r.place_id = p_id
    LOOP
      IF v_qui <> v_moi THEN
        PERFORM notify(v_qui,
          CASE WHEN v_avant.recit <> v_recit AND v_avant.nom = v_nom AND v_avant.natures = p_natures
                    AND v_avant.epoque IS NOT DISTINCT FROM p_epoque AND v_avant.annee IS NOT DISTINCT FROM p_annee
               THEN 'description_edited' ELSE 'lieu_modifie' END,
          jsonb_build_object('actorId', v_moi, 'actorName', v_nom_moi, 'placeId', p_id, 'placeTitle', v_nom));
      END IF;
    END LOOP;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'modifier_lieu : notification en échec (%)', SQLERRM;
  END;

  RETURN json_build_object('version', v_version);
END;
$function$;
REVOKE ALL ON FUNCTION public.modifier_lieu(text, text, text[], text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_lieu(text, text, text[], text, text, integer, text) TO authenticated;

-- Les versions d'un lieu, de la plus récente à l'origine, avec ce qui a changé. Sans version :
-- la fiche telle qu'elle a été posée.
CREATE OR REPLACE FUNCTION public.histoire_du_lieu(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH v AS (
    SELECT id, auteur, cree_le, note, nom, natures, epoque, annee, recit,
           lag(nom) OVER w AS nom_avant, lag(natures) OVER w AS natures_avant,
           lag(epoque) OVER w AS epoque_avant, lag(annee) OVER w AS annee_avant,
           lag(recit) OVER w AS recit_avant, lag(id) OVER w AS precedente
    FROM versions_lieu WHERE place_id = p_id
    WINDOW w AS (ORDER BY cree_le, id)
  ),
  lignes AS (
    SELECT id, auteur, cree_le, note, precedente IS NULL AS origine,
      array_remove(ARRAY[
        CASE WHEN precedente IS NOT NULL AND nom IS DISTINCT FROM nom_avant THEN 'nom' END,
        CASE WHEN precedente IS NOT NULL AND natures IS DISTINCT FROM natures_avant THEN 'natures' END,
        CASE WHEN precedente IS NOT NULL AND (epoque IS DISTINCT FROM epoque_avant OR annee IS DISTINCT FROM annee_avant) THEN 'epoque' END,
        CASE WHEN precedente IS NOT NULL AND recit IS DISTINCT FROM recit_avant THEN 'recit' END], NULL) AS champs
    FROM v
    UNION ALL
    SELECT NULL, p.author_id, p.created_at, NULL, true, '{}'::text[]
    FROM places p WHERE p.id = p_id AND NOT EXISTS (SELECT 1 FROM versions_lieu WHERE place_id = p_id)
  )
  SELECT CASE WHEN NOT public._lieu_visible(p_id) THEN NULL ELSE COALESCE(json_agg(json_build_object(
      'id', l.id,
      'quand', l.cree_le,
      'origine', l.origine,
      'champs', l.champs,
      'note', l.note,
      'qui', CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object(
               'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url) END)
    ORDER BY l.cree_le DESC, l.id DESC NULLS LAST), '[]'::json) END
  FROM lignes l LEFT JOIN users u ON u.id = l.auteur;
$function$;
REVOKE ALL ON FUNCTION public.histoire_du_lieu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.histoire_du_lieu(text) TO authenticated;

-- Reposer une version : les mêmes règles que modifier, et une version de plus.
CREATE OR REPLACE FUNCTION public.revenir_a_version(p_version bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v record;
BEGIN
  SELECT * INTO v FROM versions_lieu WHERE id = p_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version introuvable' USING ERRCODE = 'P0002';
  END IF;
  RETURN public.modifier_lieu(v.place_id, v.nom, v.natures, v.recit, v.epoque, v.annee,
    'Retour à la version du ' || to_char(v.cree_le AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY'));
END;
$function$;
REVOKE ALL ON FUNCTION public.revenir_a_version(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revenir_a_version(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.signaler_lieu(p_id text, p_raison text, p_precision text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_precision text := NULLIF(btrim(COALESCE(p_precision, '')), '');
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_raison NOT IN ('n_existe_pas', 'prive_ou_dangereux', 'doublon', 'contenu', 'autre') THEN
    RAISE EXCEPTION 'Raison inconnue' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(v_precision, '')) > 500 THEN
    RAISE EXCEPTION 'Un mot de 500 signes au plus' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM signalements_lieu WHERE user_id = v_moi AND cree_le > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'Vingt signalements aujourd’hui : reviens demain' USING ERRCODE = 'P0001', HINT = 'limite';
  END IF;

  INSERT INTO signalements_lieu (place_id, user_id, raison, precision)
  VALUES (p_id, v_moi, p_raison, v_precision)
  ON CONFLICT (place_id, user_id) WHERE traite_le IS NULL
    DO UPDATE SET raison = excluded.raison, precision = excluded.precision, cree_le = now();
  RETURN json_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.signaler_lieu(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_lieu(text, text, text) TO authenticated;

-- La file du Hub : les signalements ouverts, du plus récent au plus ancien.
CREATE OR REPLACE FUNCTION public.mod_signalements()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._is_staff() THEN
    RAISE EXCEPTION 'Réservé à l’équipe' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT COALESCE(json_agg(json_build_object(
      'id', s.id, 'raison', s.raison, 'precision', s.precision, 'quand', s.cree_le,
      'lieu', json_build_object('id', p.id, 'nom', p.title, 'masque', p.masked),
      'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name)))
    ORDER BY s.cree_le DESC), '[]'::json)
    FROM signalements_lieu s JOIN places p ON p.id = s.place_id JOIN users u ON u.id = s.user_id
    WHERE s.traite_le IS NULL);
END;
$function$;
REVOKE ALL ON FUNCTION public.mod_signalements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_signalements() TO authenticated;

CREATE OR REPLACE FUNCTION public.mod_traiter_signalement(p_id bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._is_staff() THEN
    RAISE EXCEPTION 'Réservé à l’équipe' USING ERRCODE = '42501';
  END IF;
  UPDATE signalements_lieu SET traite_le = now(), traite_par = (auth.uid())::text
  WHERE id = p_id AND traite_le IS NULL;
  RETURN json_build_object('ok', FOUND);
END;
$function$;
REVOKE ALL ON FUNCTION public.mod_traiter_signalement(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_traiter_signalement(bigint) TO authenticated;

-- « lieu_modifie » rejoint les Notifications de la V2.
CREATE OR REPLACE FUNCTION public._notification_v2(p_type text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_type = ANY (ARRAY[
    'like_contribution', 'like_carnet', 'new_carnet', 'description_edited', 'new_photo',
    'new_comment', 'comment_reply', 'place_position_edited', 'exploration',
    'milestone_vues', 'milestone_exploration', 'milestone_likes', 'mention', 'salut',
    'lieu_modifie']);
$function$;
