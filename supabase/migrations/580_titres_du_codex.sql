-- 580 — Les titres du Codex : porter un Fragment, porter toute une collection
--
-- WHY : Uriel, 02/11/2026 — spec docs/superpowers/specs/2026-11-02-codex-design.md.
--   · Porter un Fragment donne son titre (« Fils de Sparte ») ; porter tous les Fragments visibles
--     d'une collection donne le sien (« Gardien du Pacte »). Ce sont des titres comme les autres
--     (table titles, type général) : ils se calculent dans get_user_titles, se portent par
--     set_my_displayed_titles. Deux conditions nouvelles : {stat: fragment, id} et
--     {stat: collection, heritage}. Une collection sans Fragment visible ne se gagne pas.
--   · Le nom du titre d'une collection vit dans titles, plus dans codex_collections.titre (une
--     seule source) : la colonne de la 577, vide (0 ligne, vérifié le 02/11), ne sert plus et
--     entre au registre de purge (aucun DROP ici).
--   · get_user_titles repart de sa définition live du 02/11 (unlocks compris) ; mon_codex et
--     mon_fragment de leurs définitions des 578 et 579.
--
-- SCHEMA CHECKED (02/11/2026, live) : titles(id int, name varchar, type varchar, order int,
--   icon varchar, unlocks text[], condition jsonb, description text, name_f varchar) ;
--   users(title_gender, displayed_title_ids_v3 int[]) ; _nom_titre(titles, text) ;
--   codex_collections : 0 ligne.

-- Les deux conditions dans get_user_titles (live du 02/11 + 2 conditions) -----------------------

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_genre text;
  v_faction_id TEXT;
  v_xp_total INT;
  v_level INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_places_visited INT;
  v_places_added INT;
  v_places_enriched INT;
  v_carnets INT;
  v_plantages INT;
  v_enigma_score INT;
  v_mecenat_total INT;
  v_mecenat_top1_count INT;
  v_general JSON;
  v_faction2 JSON;
  v_general_arr JSON[] := '{}';
  v_player_rank INT;
  v_player_coupe_score INT;
  v_season_start timestamptz;
  v_season_end   timestamptz;
BEGIN
  -- Compteurs joueur (V0.7)
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  -- 531 : les titres disent « sur place » : les souvenirs ne comptent pas.
  SELECT COUNT(DISTINCT place_id) INTO v_places_visited FROM public.place_explorers
   WHERE user_id = p_user_id AND NOT a_distance;
  SELECT COUNT(*) INTO v_places_added FROM places WHERE author_id = p_user_id;
  -- 430 : lieux des autres enrichis, une fois chacun
  SELECT COUNT(DISTINCT v.place_id) INTO v_places_enriched
  FROM public.versions_lieu v JOIN public.places p ON p.id = v.place_id
  WHERE v.auteur = p_user_id AND p.author_id IS DISTINCT FROM p_user_id;
  SELECT COUNT(*) INTO v_carnets FROM public.place_contributions WHERE user_id = p_user_id AND type = 'carnet';
  SELECT COUNT(*) INTO v_plantages FROM public.veille_history WHERE user_id = p_user_id;
  v_enigma_score := public._enigma_score_weighted(p_user_id);

  -- V082 : compteurs Mécénat
  SELECT COALESCE(SUM(amount), 0)::INT INTO v_mecenat_total
  FROM public.place_court_action
  WHERE user_id = p_user_id;

  -- Nombre de lieux où le user est #1 mécène (cumulatif à vie)
  WITH per_place AS (
    SELECT place_id, user_id, SUM(amount) AS total
    FROM public.place_court_action
    GROUP BY place_id, user_id
  ),
  ranked AS (
    SELECT place_id, user_id, total,
           ROW_NUMBER() OVER (PARTITION BY place_id ORDER BY total DESC, user_id) AS rk
    FROM per_place
  )
  SELECT COUNT(*)::INT INTO v_mecenat_top1_count
  FROM ranked WHERE rk = 1 AND user_id = p_user_id;

  -- xp_total + niveau dérivé
  SELECT COALESCE(xp_total, 0), faction_id, COALESCE(displayed_general_title_ids, '{}'), COALESCE(title_gender, 'm')
    INTO v_xp_total, v_faction_id, v_displayed_ids, v_genre
    FROM users WHERE id = p_user_id;
  v_level := public._level_from_xp(v_xp_total);

  -- Évaluation des titres généraux (threshold sur les compteurs étendus)
  -- V082 : ajout 2 nouvelles stats (mecenat_total, mecenat_top1_count)
  FOR v_general IN
    SELECT json_build_object(
      'id', t.id, 'name', public._nom_titre(t, v_genre), 'icon', t.icon, 'unlocks', t.unlocks, 'order', t."order", 'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN t.condition->>'stat' = 'level'              THEN v_level >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'discoveries'        THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_visited'     THEN v_places_visited >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'enigma_score'       THEN v_enigma_score >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'plantages'          THEN v_plantages >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_added'       THEN v_places_added >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'carnets'            THEN v_carnets >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'mecenat_total'      THEN v_mecenat_total >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'mecenat_top1_count' THEN v_mecenat_top1_count >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_enriched'    THEN v_places_enriched >= (t.condition->>'min')::INT
        -- 580 : porter un Fragment, porter toute une collection du Codex (spec 2026-11-02-codex).
        WHEN t.condition->>'stat' = 'fragment' THEN EXISTS (
          SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = (t.condition->>'id')::INT)
        WHEN t.condition->>'stat' = 'collection' THEN EXISTS (
          SELECT 1 FROM title_fragments f WHERE f.visible AND f.heritage = t.condition->>'heritage')
          AND NOT EXISTS (
          SELECT 1 FROM title_fragments f
          WHERE f.visible AND f.heritage = t.condition->>'heritage'
            AND NOT EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = f.id))
        ELSE false
      END
    )
    -- 452 : les titres de connaissance ne sont pas des titres qu'on porte (des gélules du profil).
    FROM titles t WHERE t.type = 'general' AND COALESCE(t.condition->>'stat', '') NOT IN ('connaissance', 'polymathe')
    ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  -- Titre faction (verbatim mig 068)
  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT started_at, COALESCE(ended_at, now())
    INTO v_season_start, v_season_end
    FROM public.coupe_seasons
    ORDER BY (ended_at IS NULL) DESC, started_at DESC
    LIMIT 1;
    IF v_season_start IS NULL THEN
      v_season_start := 'epoch'::timestamptz;
      v_season_end   := now();
    END IF;

    SELECT s.faction_rank, s.coupe_score
    INTO v_player_rank, v_player_coupe_score
    FROM public._faction_member_scores(v_faction_id, v_season_start, v_season_end) s
    WHERE s.user_id = p_user_id;

    IF v_player_coupe_score IS NULL OR v_player_coupe_score <= 0 THEN
      v_faction2 := NULL;
    ELSE
      SELECT json_build_object('id', t.id, 'name', t.name, 'icon', t.icon, 'unlocks', t.unlocks, 'type', 'faction')
      INTO v_faction2
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
        AND t.condition IS NOT NULL AND (t.condition->>'rank') IS NOT NULL
        AND v_player_rank <= (t.condition->>'rank')::INT
      ORDER BY (t.condition->>'rank')::INT ASC
      LIMIT 1;
    END IF;
  END IF;

  -- V082 : ajout mecenat_total et mecenat_top1_count dans stats
  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((SELECT json_agg(elem) FROM unnest(v_general_arr) AS elem WHERE (elem->>'unlocked')::boolean = true), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object(
      'level', v_level,
      'xpTotal', v_xp_total,
      'discoveries', v_discoveries,
      'places_visited', v_places_visited,
      'places_added', v_places_added,
      'carnets', v_carnets,
      'plantages', v_plantages,
      'enigma_score', v_enigma_score,
      'mecenat_total', v_mecenat_total,
      'mecenat_top1_count', v_mecenat_top1_count,
      'places_enriched', v_places_enriched
    )
  );
END;
$function$;

-- Le titre d'une collection, lu dans titles (définition de la 578) --------------------------------

CREATE OR REPLACE FUNCTION public.mon_codex()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
  v_resultat jsonb;
  v_genre text;
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connecte-toi pour ouvrir ton Codex', 'auth'); END IF;
  SELECT COALESCE(title_gender, 'm') INTO v_genre FROM users WHERE id = v_moi;

  WITH etats AS (
    SELECT f.id, f.name, f.illustration_url, f.heritage, f.edition, f.edition_precision,
           f.created_at > now() - interval '60 days' AS nouveau,
           uf.numero,
           coalesce(s.scans, 0) AS scans,
           CASE WHEN uf.user_id IS NOT NULL THEN 'porte'
                WHEN s.scans IS NOT NULL THEN 'scanne'
                ELSE 'inconnu' END AS etat
    FROM title_fragments f
    LEFT JOIN user_fragments uf ON uf.fragment_id = f.id AND uf.user_id = v_moi
    LEFT JOIN _mes_scans(v_moi) s ON s.fragment_id = f.id
    WHERE f.visible
  ),
  collections AS (
    SELECT e.heritage,
           count(*) FILTER (WHERE e.etat = 'porte') AS portes,
           count(*) AS total,
           jsonb_agg(jsonb_build_object(
             'id', e.id, 'nom', e.name, 'illustration', e.illustration_url, 'etat', e.etat,
             'scans', e.scans, 'numero', e.numero, 'nouveau', e.nouveau,
             'edition', e.edition, 'editionPrecision', e.edition_precision
           ) ORDER BY e.name) AS fragments
    FROM etats e
    GROUP BY e.heritage
  )
  SELECT jsonb_build_object(
    'totaux', (SELECT jsonb_build_object(
                 'portes', count(*) FILTER (WHERE etat = 'porte'),
                 'scannes', count(*) FILTER (WHERE etat = 'scanne'),
                 'inconnus', count(*) FILTER (WHERE etat = 'inconnu'),
                 'total', count(*)) FROM etats),
    'collections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'heritage', c.heritage, 'couleur', cc.couleur, 'icone', cc.icone_url,
               'titre', (SELECT _nom_titre(t, v_genre) FROM titles t
                         WHERE t.condition->>'stat' = 'collection' AND t.condition->>'heritage' = c.heritage
                         LIMIT 1),
               'portes', c.portes, 'total', c.total, 'fragments', c.fragments
             ) ORDER BY c.heritage NULLS LAST)
      FROM collections c LEFT JOIN codex_collections cc ON cc.heritage = c.heritage), '[]'::jsonb)
  ) INTO v_resultat;

  RETURN v_resultat;
END $$;

-- Le titre du Fragment et les titres portés (définition de la 579) -------------------------------

CREATE OR REPLACE FUNCTION public.mon_fragment(p_id integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
  v_numero integer;
  v_scans integer;
  v_genre text;
  v_portes integer[];
BEGIN
  IF v_moi IS NULL THEN PERFORM _refus('Connecte-toi pour ouvrir ton Codex', 'auth'); END IF;
  IF NOT EXISTS (SELECT 1 FROM title_fragments WHERE id = p_id AND visible) THEN RETURN NULL; END IF;

  SELECT numero INTO v_numero FROM user_fragments WHERE user_id = v_moi AND fragment_id = p_id;
  SELECT scans INTO v_scans FROM _mes_scans(v_moi) WHERE fragment_id = p_id;
  SELECT COALESCE(title_gender, 'm'), COALESCE(displayed_title_ids_v3, '{}') INTO v_genre, v_portes
  FROM users WHERE id = v_moi;

  RETURN jsonb_build_object(
    'etat', CASE WHEN v_numero IS NOT NULL THEN 'porte'
                 WHEN v_scans IS NOT NULL THEN 'scanne' ELSE 'inconnu' END,
    'scans', coalesce(v_scans, 0),
    'numero', v_numero,
    'porteurs', (SELECT count(*) FROM user_fragments WHERE fragment_id = p_id),
    'signe', EXISTS (SELECT 1 FROM users WHERE id = v_moi AND signe_fragment_id = p_id),
    'titre', (SELECT jsonb_build_object('id', t.id, 'nom', _nom_titre(t, v_genre)) FROM titles t
              WHERE t.condition->>'stat' = 'fragment' AND (t.condition->>'id')::int = p_id LIMIT 1),
    'titresPortes', to_jsonb(v_portes),
    'anecdotes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('texte', a.texte, 'rarete', a.rarete) ORDER BY t.quand DESC)
      FROM anecdotes_trouvees t JOIN anecdotes a ON a.id = t.anecdote_id
      WHERE t.user_id = v_moi AND a.fragment_id = p_id AND a.visible), '[]'::jsonb),
    'restantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_id AND a.visible
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id)),
    'raresRestantes', (SELECT count(*) FROM anecdotes a WHERE a.fragment_id = p_id AND a.visible AND a.rarete = 'rare'
                    AND NOT EXISTS (SELECT 1 FROM anecdotes_trouvees t WHERE t.user_id = v_moi AND t.anecdote_id = a.id))
  );
END $$;

-- Le Hub : les collections et le titre d'un Fragment ---------------------------------------------

-- codex_collections.titre ne sert plus (le nom vit dans titles) : vide, elle part au registre de purge
-- (docs/v2/purge-back.md), à retirer à la main.

-- Écrire (ou renommer) le titre d'une condition du Codex ; un nom vide le laisse tel quel.
CREATE OR REPLACE FUNCTION public._ecrire_titre_du_codex(p_condition jsonb, p_nom text)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF nullif(btrim(p_nom), '') IS NULL THEN RETURN; END IF;
  UPDATE titles SET name = btrim(p_nom) WHERE condition = p_condition;
  IF NOT FOUND THEN
    INSERT INTO titles (name, type, "order", unlocks, condition)
    VALUES (btrim(p_nom), 'general', 900, '{}', p_condition);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public._ecrire_titre_du_codex(jsonb, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hub_ecrire_collection(
  p_heritage text, p_couleur text, p_icone_url text, p_titre text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  INSERT INTO codex_collections (heritage, couleur, icone_url)
  VALUES (p_heritage, nullif(p_couleur, ''), nullif(p_icone_url, ''))
  ON CONFLICT (heritage) DO UPDATE SET couleur = EXCLUDED.couleur, icone_url = EXCLUDED.icone_url;
  PERFORM _ecrire_titre_du_codex(jsonb_build_object('stat', 'collection', 'heritage', p_heritage), p_titre);
END $$;

CREATE OR REPLACE FUNCTION public.hub_collections()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'heritage', h.heritage, 'couleur', cc.couleur, 'icone_url', cc.icone_url,
      'titre', (SELECT t.name FROM titles t WHERE t.condition->>'stat' = 'collection'
                  AND t.condition->>'heritage' = h.heritage LIMIT 1)))
    FROM (SELECT DISTINCT heritage FROM title_fragments WHERE nullif(heritage, '') IS NOT NULL) h
    LEFT JOIN codex_collections cc ON cc.heritage = h.heritage), '[]'::jsonb);
END $$;
REVOKE EXECUTE ON FUNCTION public.hub_collections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_collections() TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_titre_fragment(p_fragment integer)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN (SELECT name FROM titles WHERE condition = jsonb_build_object('stat', 'fragment', 'id', p_fragment) LIMIT 1);
END $$;
REVOKE EXECUTE ON FUNCTION public.hub_titre_fragment(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_titre_fragment(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_ecrire_titre_fragment(p_fragment integer, p_nom text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  PERFORM _ecrire_titre_du_codex(jsonb_build_object('stat', 'fragment', 'id', p_fragment), p_nom);
END $$;
REVOKE EXECUTE ON FUNCTION public.hub_ecrire_titre_fragment(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_ecrire_titre_fragment(integer, text) TO authenticated;
