-- WHY: enrichir un lieu (spec 2026-10-05-v2-enrichir-un-lieu-design) : trois rubriques pratiques
--      (accès, quand y aller, bon à savoir) et la case « bivouac toléré », versionnées comme le récit.
--      modifier_lieu reste la seule à écrire ; elle tient à jour places et place_contributions (V1, SEO).
--      La V1 ne peut plus écrire le récit ni les rubriques (Uriel, 05/10 : V1 en lecture seule).
-- SCHEMA CHECKED (05/10/2026) : versions_lieu(id, place_id, auteur, cree_le, nom, natures, epoque, annee,
--      recit, note) ; places(text, accessibility, best_season, bivouac, updated_at) ;
--      place_contributions(place_id, user_id, type, content, created_at, updated_at), une ligne par
--      lieu et par type ; définitions live (pg_get_functiondef) de modifier_lieu, revenir_a_version,
--      lieu_a_modifier, edit_place_description, contribute_to_place (7 paramètres).
-- DROP vérifiés (pg_proc.prosrc, 05/10) : _etat_du_lieu(text) et modifier_lieu ne sont appelées que
--      par modifier_lieu, lieu_a_modifier et revenir_a_version, recréées ici.

ALTER TABLE public.places
  ADD COLUMN acces text, ADD COLUMN quand text, ADD COLUMN bon_a_savoir text,
  ADD COLUMN bivouac_tolere boolean NOT NULL DEFAULT false;
ALTER TABLE public.versions_lieu
  ADD COLUMN acces text, ADD COLUMN quand text, ADD COLUMN bon_a_savoir text,
  ADD COLUMN bivouac_tolere boolean NOT NULL DEFAULT false;

DROP FUNCTION public.modifier_lieu(text, text, text[], text, text, integer, text);
DROP FUNCTION public._etat_du_lieu(text);
CREATE FUNCTION public._etat_du_lieu(p_id text)
 RETURNS TABLE (nom text, natures text[], epoque text, annee int, recit text,
                acces text, quand text, bon_a_savoir text, bivouac_tolere boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.title::text,
         COALESCE((SELECT array_agg(t.tag_id::text ORDER BY t.is_primary DESC, t.tag_id)
                   FROM place_tags t WHERE t.place_id = p.id), '{}'),
         p.era_id::text, p.year_exact, COALESCE(p.text, ''),
         p.acces, p.quand, p.bon_a_savoir, p.bivouac_tolere
  FROM places p WHERE p.id = p_id;
$function$;
REVOKE ALL ON FUNCTION public._etat_du_lieu(text) FROM PUBLIC, anon, authenticated;

-- Une rubrique changée rejoint place_contributions (lue par la V1 et les pages SEO) ; vidée, sa ligne part.
CREATE FUNCTION public._rubrique_v1(p_id text, p_qui text, p_type text, p_avant text, p_apres text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_avant IS NOT DISTINCT FROM p_apres THEN
    RETURN;
  END IF;
  IF p_apres IS NULL THEN
    DELETE FROM place_contributions WHERE place_id = p_id AND type = p_type;
    RETURN;
  END IF;
  UPDATE place_contributions SET content = p_apres, user_id = p_qui, updated_at = now()
  WHERE place_id = p_id AND type = p_type;
  IF NOT FOUND THEN
    INSERT INTO place_contributions (place_id, user_id, type, content, created_at, updated_at)
    VALUES (p_id, p_qui, p_type, p_apres, now(), now());
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._rubrique_v1(text, text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.modifier_lieu(p_id text, p_nom text, p_natures text[], p_recit text, p_epoque text DEFAULT NULL::text, p_annee integer DEFAULT NULL::integer, p_note text DEFAULT NULL::text,
  p_acces text DEFAULT NULL::text, p_quand text DEFAULT NULL::text, p_bon_a_savoir text DEFAULT NULL::text,
  p_bivouac_tolere boolean DEFAULT NULL::boolean)
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
  -- 414 : une rubrique absente (NULL, un vieux front) reste telle quelle ; vide ('') = effacée.
  v_acces text;
  v_quand text;
  v_bon text;
  v_bivouac boolean;
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
  v_acces := CASE WHEN p_acces IS NULL THEN v_avant.acces ELSE NULLIF(btrim(p_acces), '') END;
  v_quand := CASE WHEN p_quand IS NULL THEN v_avant.quand ELSE NULLIF(btrim(p_quand), '') END;
  v_bon := CASE WHEN p_bon_a_savoir IS NULL THEN v_avant.bon_a_savoir ELSE NULLIF(btrim(p_bon_a_savoir), '') END;
  v_bivouac := COALESCE(p_bivouac_tolere, v_avant.bivouac_tolere);
  IF greatest(char_length(v_acces), char_length(v_quand), char_length(v_bon)) > 1000 THEN
    RAISE EXCEPTION 'Une rubrique de 1000 signes au plus' USING ERRCODE = '22023';
  END IF;
  IF v_avant.nom = v_nom AND v_avant.natures = p_natures AND v_avant.epoque IS NOT DISTINCT FROM p_epoque
     AND v_avant.annee IS NOT DISTINCT FROM p_annee AND v_avant.recit = v_recit
     AND v_avant.acces IS NOT DISTINCT FROM v_acces AND v_avant.quand IS NOT DISTINCT FROM v_quand
     AND v_avant.bon_a_savoir IS NOT DISTINCT FROM v_bon AND v_avant.bivouac_tolere = v_bivouac THEN
    RAISE EXCEPTION 'Rien n’a changé' USING ERRCODE = 'P0001', HINT = 'rien';
  END IF;

  -- La version d'origine, inscrite à la première modification.
  IF NOT EXISTS (SELECT 1 FROM versions_lieu WHERE place_id = p_id) THEN
    INSERT INTO versions_lieu (place_id, auteur, cree_le, nom, natures, epoque, annee, recit,
                               acces, quand, bon_a_savoir, bivouac_tolere)
    VALUES (p_id, v_auteur, v_cree, v_avant.nom, v_avant.natures, v_avant.epoque, v_avant.annee, v_avant.recit,
            v_avant.acces, v_avant.quand, v_avant.bon_a_savoir, v_avant.bivouac_tolere);
  END IF;

  UPDATE places SET title = v_nom, text = v_recit, era_id = p_epoque, year_exact = p_annee,
    acces = v_acces, quand = v_quand, bon_a_savoir = v_bon, bivouac_tolere = v_bivouac, updated_at = now()
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

  -- 414 : les rubriques aussi restent lisibles par la V1 et les pages SEO (une ligne par lieu et par type).
  PERFORM public._rubrique_v1(p_id, v_moi, 'accessibility', v_avant.acces, v_acces);
  PERFORM public._rubrique_v1(p_id, v_moi, 'season', v_avant.quand, v_quand);
  PERFORM public._rubrique_v1(p_id, v_moi, 'warning', v_avant.bon_a_savoir, v_bon);

  INSERT INTO versions_lieu (place_id, auteur, nom, natures, epoque, annee, recit, note,
                             acces, quand, bon_a_savoir, bivouac_tolere)
  VALUES (p_id, v_moi, v_nom, p_natures, p_epoque, p_annee, v_recit, v_note,
          v_acces, v_quand, v_bon, v_bivouac)
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

REVOKE ALL ON FUNCTION public.modifier_lieu(text, text, text[], text, text, integer, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_lieu(text, text, text[], text, text, integer, text, text, text, text, boolean) TO authenticated;

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
  -- 414 : les rubriques reviennent aussi ('' : une rubrique vide le redevient).
  RETURN public.modifier_lieu(v.place_id, v.nom, v.natures, v.recit, v.epoque, v.annee,
    'Retour à la version du ' || to_char(v.cree_le AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY'),
    COALESCE(v.acces, ''), COALESCE(v.quand, ''), COALESCE(v.bon_a_savoir, ''), v.bivouac_tolere);
END;
$function$;

CREATE OR REPLACE FUNCTION public.lieu_a_modifier(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN NOT public._lieu_visible(p_id) THEN NULL ELSE (
    SELECT json_build_object('nom', e.nom, 'natures', e.natures, 'epoque', e.epoque,
      'annee', e.annee, 'recit', e.recit,
      'acces', e.acces, 'quand', e.quand, 'bonASavoir', e.bon_a_savoir, 'bivouacTolere', e.bivouac_tolere,
      'photos', public._photos_du_lieu(p_id))
    FROM public._etat_du_lieu(p_id) e) END;
$function$;

CREATE OR REPLACE FUNCTION public.edit_place_description(p_user_id text, p_place_id text, p_content text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller  text := public._caller_user_id();
  v_content text := NULLIF(TRIM(p_content), '');
  v_faction text;
  v_place   RECORD;
  v_actor   RECORD;
  v_prev    RECORD;
BEGIN
  -- 414 : la V1 est en lecture seule pour le récit ; on enrichit dans la V2.
  RAISE EXCEPTION 'Enrichis ce lieu dans la nouvelle appli' USING ERRCODE = 'P0001', HINT = 'v2';
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF v_caller IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF v_content IS NULL THEN RETURN json_build_object('error','empty_content'); END IF;

  IF NOT public._can_edit_place_meta(p_place_id, v_caller) THEN
    RETURN json_build_object('error','not_allowed');
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = v_caller;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, created_at, updated_at)
  VALUES (p_place_id, v_caller, v_faction, 'description', v_content, now(), now())
  ON CONFLICT (place_id) WHERE (type = 'description')
  DO UPDATE SET content = EXCLUDED.content, user_id = EXCLUDED.user_id,
               faction_id = EXCLUDED.faction_id, updated_at = now();

  INSERT INTO place_description_revisions (place_id, content, edited_by)
  VALUES (p_place_id, v_content, v_caller);

  SELECT title, latitude, longitude INTO v_place FROM places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name, avatar_url, faction_id
    INTO v_actor FROM users WHERE id = v_caller;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', v_caller, p_place_id, v_actor.faction_id,
    jsonb_build_object('contributionType','description',
      'placeTitle', v_place.title, 'placeLatitude', v_place.latitude, 'placeLongitude', v_place.longitude,
      'actorName', v_actor.name, 'actorAvatarUrl', v_actor.avatar_url));

  FOR v_prev IN
    SELECT DISTINCT edited_by FROM place_description_revisions
    WHERE place_id = p_place_id AND edited_by <> v_caller
  LOOP
    PERFORM notify(v_prev.edited_by, 'description_edited', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', v_caller, 'placeTitle', v_place.title, 'placeId', p_place_id));
  END LOOP;

  RETURN json_build_object('success', true, 'content', v_content);
END;
$function$;

CREATE OR REPLACE FUNCTION public.contribute_to_place(p_user_id text, p_place_id text, p_type text, p_content text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_era_id text DEFAULT NULL::text, p_year_exact integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

BEGIN
  -- 414 : la V1 est en lecture seule pour le récit et les rubriques ; les photos passent toujours.
  IF p_type IN ('description', 'accessibility', 'season', 'warning') THEN
    RAISE EXCEPTION 'Enrichis ce lieu dans la nouvelle appli' USING ERRCODE = 'P0001', HINT = 'v2';
  END IF;

  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN

    RETURN json_build_object('error', 'unauthorized');

  END IF;

  RETURN public._contribute_to_place_internal(p_user_id, p_place_id, p_type, p_content, p_image_url, p_era_id, p_year_exact);

END;

$function$;
