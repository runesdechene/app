-- WHY: correctifs de la reprise V1 (mig 416), trouvés à la relecture du 05/10 :
--   1. 86 lieux : aucune révision posée à l'ajout, et la première révision venait d'un autre que
--      l'auteur. La 416 en a fait l'origine, créditée à l'auteur. Le texte revient à qui l'a écrit :
--      l'origine (et les versions d'avant sa révision) repasse sans récit, et une version à son nom,
--      à sa date, porte son texte. Une origine sans récit ne crédite plus (fiche_lieu.recitPar).
--   2. Deux récits V1 dépassent 5 000 signes : modifier_lieu les refusait, et donc toute
--      modification de ces lieux. La limite passe à 10 000.
--   3. « La Savoie » avait déjà des versions V2 : la 416 l'a sautée, ses rubriques V1 ne sont pas
--      venues. Elles arrivent en une version, au nom de qui les avait écrites.
-- SCHEMA CHECKED (05/10/2026) : versions_lieu, place_description_revisions, place_contributions ;
--      définitions live de modifier_lieu (414) et fiche_lieu (417).

-- 1.
DO $m$
DECLARE
  c record;
BEGIN
  FOR c IN
    WITH origine AS (
      SELECT DISTINCT ON (v.place_id) v.* FROM versions_lieu v ORDER BY v.place_id, v.cree_le, v.id),
    premiere AS (
      SELECT DISTINCT ON (d.place_id) d.* FROM place_description_revisions d ORDER BY d.place_id, d.created_at)
    SELECT o.id AS origine, o.place_id, f.edited_by AS qui, f.created_at AS quand, f.content AS recit
    FROM origine o JOIN premiere f USING (place_id) JOIN places p ON p.id = o.place_id
    WHERE o.recit = f.content AND f.edited_by IS DISTINCT FROM p.author_id
      AND f.created_at > p.created_at + interval '10 minutes'
  LOOP
    -- Avant sa révision, le lieu n'avait pas de récit.
    UPDATE versions_lieu SET recit = ''
    WHERE place_id = c.place_id AND recit = c.recit AND cree_le < c.quand;
    -- Sa version : l'état juste avant, avec son texte.
    INSERT INTO versions_lieu (place_id, auteur, cree_le, nom, natures, epoque, annee, recit,
                               acces, quand, bon_a_savoir, bivouac_tolere)
    SELECT v.place_id, c.qui, c.quand, v.nom, v.natures, v.epoque, v.annee, c.recit,
           v.acces, v.quand, v.bon_a_savoir, v.bivouac_tolere
    FROM versions_lieu v WHERE v.place_id = c.place_id AND v.cree_le < c.quand
    ORDER BY v.cree_le DESC, v.id DESC LIMIT 1;
  END LOOP;
END $m$;

-- 3.
DO $m$
DECLARE
  l record;
  v_qui text;
  v_quand timestamptz;
BEGIN
  FOR l IN
    SELECT p.* FROM places p
    WHERE EXISTS (SELECT 1 FROM versions_lieu v WHERE v.place_id = p.id)
      AND p.acces IS NULL AND p.quand IS NULL AND p.bon_a_savoir IS NULL
      AND EXISTS (SELECT 1 FROM place_contributions c WHERE c.place_id = p.id
                  AND c.type IN ('accessibility', 'season', 'warning') AND NULLIF(btrim(c.content), '') IS NOT NULL)
  LOOP
    SELECT c.user_id, COALESCE(c.updated_at, c.created_at) INTO v_qui, v_quand
    FROM place_contributions c WHERE c.place_id = l.id AND c.type IN ('accessibility', 'season', 'warning')
    ORDER BY COALESCE(c.updated_at, c.created_at) DESC LIMIT 1;
    UPDATE places SET
      acces = (SELECT NULLIF(btrim(content), '') FROM place_contributions WHERE place_id = l.id AND type = 'accessibility'),
      quand = (SELECT NULLIF(btrim(content), '') FROM place_contributions WHERE place_id = l.id AND type = 'season'),
      bon_a_savoir = (SELECT NULLIF(btrim(content), '') FROM place_contributions WHERE place_id = l.id AND type = 'warning')
    WHERE id = l.id;
    INSERT INTO versions_lieu (place_id, auteur, cree_le, nom, natures, epoque, annee, recit,
                               acces, quand, bon_a_savoir, bivouac_tolere, note)
    SELECT l.id, v_qui, greatest(v_quand, (SELECT max(cree_le) FROM versions_lieu WHERE place_id = l.id) + interval '1 second'),
           e.nom, e.natures, e.epoque, e.annee, e.recit, e.acces, e.quand, e.bon_a_savoir, e.bivouac_tolere,
           'Repris de l’ancienne appli'
    FROM public._etat_du_lieu(l.id) e;
  END LOOP;
END $m$;

-- 2.
CREATE OR REPLACE FUNCTION public.modifier_lieu(p_id text, p_nom text, p_natures text[], p_recit text, p_epoque text DEFAULT NULL::text, p_annee integer DEFAULT NULL::integer, p_note text DEFAULT NULL::text, p_acces text DEFAULT NULL::text, p_quand text DEFAULT NULL::text, p_bon_a_savoir text DEFAULT NULL::text, p_bivouac_tolere boolean DEFAULT NULL::boolean)
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
  -- 418 : 10 000 signes ; des récits V1 dépassaient 5 000 et rendaient leur lieu impossible à modifier.
  IF v_recit IS NULL OR char_length(v_recit) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Un récit, de 1 à 10000 signes' USING ERRCODE = '22023';
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

CREATE OR REPLACE FUNCTION public.fiche_lieu(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT json_build_object(
    'id', l.id,
    'slug', l.slug, -- la page publique du lieu (/lieu/<slug>), pour le partage
    'nom', l.title,
    'recit', COALESCE(l.text, ''),
    'adresse', NULLIF(btrim(l.address), ''),
    'lat', l.latitude,
    'lng', l.longitude,
    'nature', l.nature,
    'photos', public._photos_du_lieu(l.id),
    'type', (
      SELECT json_build_object('nom', t.title, 'icone', t.icon, 'couleur', t.color)
      FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
      WHERE pt.place_id = l.id AND pt.is_primary LIMIT 1),
    'faits', json_build_object(
      -- « Non concerné » (une source, un spot de van) ne se dit pas : pas d'époque à afficher.
      'epoque', (SELECT e.name FROM eras e WHERE e.id = l.era_id AND e.id <> 'not-applicable'),
      'annee', l.year_exact,
      -- 417 : lues par le front 1.0.39 (encore en ligne) ; toujours null. À retirer après 1.0.40.
      'saison', NULL, 'acces', NULL, 'bivouac', NULL),
    'enrichiPar', NULL,
    -- 415 : les rubriques pratiques et le bivouac (mig 414), écrits en versions comme le récit.
    'rubriques', json_build_object('acces', l.acces, 'quand', l.quand, 'bonASavoir', l.bon_a_savoir),
    'bivouacTolere', l.bivouac_tolere,
    'explorateurs', json_build_object(
      'nombre', (SELECT count(*) FROM place_explorers e WHERE e.place_id = l.id),
      'derniers', COALESCE((
        SELECT json_agg(d.x) FROM (
          SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url) AS x
          FROM place_explorers e JOIN users u ON u.id = e.user_id
          WHERE e.place_id = l.id ORDER BY e.visited_at DESC LIMIT 3) d), '[]'::json)),
    -- La pilule : l'expédition si elle a un nom, sinon le dernier qui l'a revendiqué (comme 363).
    'revendication', (
      SELECT json_build_object(
        'nom', COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name)),
        'moi', v.veilleur_user_id = moi.id
          OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = moi.id),
        'depuis', v.planted_at)
      FROM place_veille v
      LEFT JOIN expeditions x ON x.id = v.expedition_id
      LEFT JOIN users u ON u.id = v.veilleur_user_id
      WHERE v.place_id = l.id AND l.nature = 'lieu'),
    'auteur', (
      SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url)
      FROM users u WHERE u.id = l.author_id),
    'ajouteLe', l.created_at,
    -- Ajouté à distance (sans y être) : noté par le journal depuis le 08/04/2026, V1 comme V2.
    -- Avant, on ne sait pas : rien n'est dit.
    'ajoutADistance', EXISTS (
      SELECT 1 FROM activity_log a
      WHERE a.type = 'new_place' AND a.place_id = l.id AND a.data->>'isGps' = 'false'),
    -- 415 : « Récit partagé de… » — qui a changé le texte du récit, par ordre d'arrivée (l'origine
    -- comprise ; sans version, l'auteur seul).
    'recitPar', COALESCE((
      SELECT json_agg(json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
                                        'avatar', u.avatar_url) ORDER BY a.premiere)
      FROM (
        SELECT w.auteur, min(w.cree_le) AS premiere
        FROM (SELECT v.auteur, v.cree_le, v.recit, lag(v.id) OVER o AS precedente, lag(v.recit) OVER o AS recit_avant
              FROM versions_lieu v WHERE v.place_id = l.id WINDOW o AS (ORDER BY v.cree_le, v.id)) w
        -- 418 : une origine sans récit ne crédite pas (le lieu posé sans texte, décrit par un autre).
        WHERE w.auteur IS NOT NULL
          AND ((w.precedente IS NULL AND w.recit <> '') OR w.recit IS DISTINCT FROM w.recit_avant)
        GROUP BY w.auteur) a
      JOIN users u ON u.id = a.auteur),
      (SELECT json_build_array(json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
                                                 'avatar', u.avatar_url))
       FROM users u WHERE u.id = l.author_id
         AND NOT EXISTS (SELECT 1 FROM versions_lieu v WHERE v.place_id = l.id)),
      '[]'::json),
    'moi', json_build_object(
      'visiteLe', (SELECT e.visited_at FROM place_explorers e WHERE e.place_id = l.id AND e.user_id = moi.id),
      'envie', EXISTS (SELECT 1 FROM place_wishlist w WHERE w.place_id = l.id AND w.user_id = moi.id),
      -- Découvert : ajouté, visité ou découvert à distance (la même règle que carte_lieux, 363).
      'decouvert', l.author_id = moi.id
        OR EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = l.id AND e.user_id = moi.id)
        OR EXISTS (SELECT 1 FROM places_discovered d WHERE d.place_id = l.id AND d.user_id = moi.id)))
  FROM places l CROSS JOIN moi
  WHERE l.id = p_id AND public._lieu_visible(p_id);
$function$;
