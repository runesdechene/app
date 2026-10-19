-- WHY: « J'y suis allé » (Uriel, 19/10/2026 ; spec docs/superpowers/specs/2026-10-19-jy-suis-alle-design.md).
--      Un lieu visité avant Explore se déclare à distance : c'est une visite (Lieux visités, passeport,
--      Noble Explorateur, Explorateurs du lieu) qui ne se revendique jamais et ne donne ni XP ni titre
--      « sur place ». Une ligne de place_explorers marquée a_distance ; la visite GPS la remplace et
--      garde la date d'origine (souvenir_le). Le fil regroupe les souvenirs par personne et par jour ;
--      l'auteur du lieu est prévenu dans la cloche (type souvenir, absent de send-push : pas de push).
-- SCHEMA CHECKED (19/10/2026, live) : place_explorers(id, place_id varchar, user_id varchar, visited_at
--   timestamptz), unique (place_id, user_id) (ON CONFLICT de visiter_lieu) ; déclencheurs envie_visitee,
--   trg_xp_explorer_ins, trg_xp_explorer_del. Toutes les fonctions reprises sont copiées de
--   pg_get_functiondef, seul le delta change. schema_migrations s'arrête à 530 : 531 est libre.

ALTER TABLE public.place_explorers
  ADD COLUMN a_distance boolean NOT NULL DEFAULT false,
  ADD COLUMN souvenir_le date,
  ADD COLUMN declare_le timestamptz;

COMMENT ON COLUMN public.place_explorers.a_distance IS 'Vrai tant que la visite n''est qu''un souvenir déclaré à distance (531).';
COMMENT ON COLUMN public.place_explorers.souvenir_le IS 'Le mois déclaré d''un souvenir (le 1er) ; reste après la visite GPS : la date d''origine (531).';
COMMENT ON COLUMN public.place_explorers.declare_le IS 'Quand le souvenir a été déclaré : sa ligne de « Sur les chemins » (531).';

CREATE INDEX place_explorers_a_distance_idx ON public.place_explorers (declare_le DESC) WHERE a_distance;

-- Déclarer un souvenir : un lieu découvert, jamais visité, un mois passé.
CREATE FUNCTION public.declarer_souvenir(p_id text, p_annee integer, p_mois integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_le date;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_id AND author_id = v_moi)
     AND NOT EXISTS (SELECT 1 FROM places_discovered WHERE place_id = p_id AND user_id = v_moi) THEN
    RAISE EXCEPTION 'Découvre ce lieu d''abord' USING ERRCODE = 'P0001', HINT = 'decouvrir';
  END IF;
  IF p_mois IS NULL OR p_annee IS NULL OR p_mois NOT BETWEEN 1 AND 12 OR p_annee < 1900 THEN
    RAISE EXCEPTION 'Date invalide' USING ERRCODE = '22023';
  END IF;
  v_le := make_date(p_annee, p_mois, 1);
  IF v_le > date_trunc('month', now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'Date à venir' USING ERRCODE = '22023', HINT = 'futur';
  END IF;

  INSERT INTO place_explorers (place_id, user_id, visited_at, a_distance, souvenir_le, declare_le)
  VALUES (p_id, v_moi, (v_le + time '12:00') AT TIME ZONE 'Europe/Paris', true, v_le, now())
  ON CONFLICT (place_id, user_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Déjà visité' USING ERRCODE = 'P0001', HINT = 'deja';
  END IF;

  -- L'auteur du lieu l'apprend dans la cloche (jamais par push : send-push ne connaît pas ce type).
  BEGIN
    PERFORM notify(p.author_id, 'souvenir', jsonb_build_object(
      'actorId', v_moi,
      'actorName', (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_moi),
      'placeId', p_id,
      'placeTitle', p.title,
      'souvenirLe', to_char(v_le, 'YYYY-MM-DD')))
    FROM places p WHERE p.id = p_id AND p.author_id IS DISTINCT FROM v_moi;
  EXCEPTION WHEN others THEN RAISE WARNING 'declarer_souvenir : notification en échec (%)', SQLERRM;
  END;

  RETURN json_build_object('souvenirLe', to_char(v_le, 'YYYY-MM-DD'));
END;
$function$;

REVOKE ALL ON FUNCTION public.declarer_souvenir(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.declarer_souvenir(text, integer, integer) TO authenticated;

-- L'XP d'une visite vient quand un souvenir devient une visite GPS (l'insert ne la donne pas).
CREATE FUNCTION public._trg_xp_souvenir_visite()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE v_delta integer;
BEGIN
  SELECT COALESCE(value::int, 3) INTO v_delta FROM public.app_settings WHERE key = 'glory.visit_gps';
  v_delta := COALESCE(v_delta, 3);
  UPDATE public.users SET xp_total = xp_total + v_delta WHERE id = NEW.user_id;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_xp_souvenir_visite AFTER UPDATE OF a_distance ON public.place_explorers
  FOR EACH ROW WHEN (OLD.a_distance AND NOT NEW.a_distance)
  EXECUTE FUNCTION public._trg_xp_souvenir_visite();

CREATE OR REPLACE FUNCTION public._trg_xp_explorer_insert()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE v_delta integer;
BEGIN
  IF NEW.a_distance THEN RETURN NEW; END IF; -- 531 : un souvenir ne donne pas d'XP
  IF COALESCE(NEW.visited_at, now()) < public._xp_epoch() THEN RETURN NEW; END IF;
  SELECT COALESCE(value::int, 3) INTO v_delta FROM public.app_settings WHERE key = 'glory.visit_gps';
  v_delta := COALESCE(v_delta, 3);
  UPDATE public.users SET xp_total = xp_total + v_delta WHERE id = NEW.user_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._trg_xp_explorer_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.a_distance THEN RETURN OLD; END IF; -- 531 : un souvenir n'en avait pas donné
  IF COALESCE(OLD.visited_at, now()) >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = GREATEST(0, xp_total - 3) WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.visiter_lieu(p_id text, p_lat double precision, p_lng double precision)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_lieu record;
  v_premiere boolean; -- 464
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT id, latitude, longitude INTO v_lieu FROM places WHERE id = p_id AND public._lieu_visible(p_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF public._distance_m(p_lat, p_lng, v_lieu.latitude, v_lieu.longitude) > 200 THEN
    RAISE EXCEPTION 'Trop loin' USING ERRCODE = 'P0001';
  END IF;
  v_premiere := NOT EXISTS (SELECT 1 FROM place_explorers WHERE place_id = p_id AND user_id = v_moi
                             AND NOT a_distance); -- 464 ; 531 : un souvenir n'est pas une visite
  INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (p_id, v_moi, now())
  ON CONFLICT (place_id, user_id) DO UPDATE SET visited_at = now(), a_distance = false; -- 531
  INSERT INTO places_discovered (user_id, place_id, method, discovered_at) VALUES (v_moi, p_id, 'gps', now())
  ON CONFLICT (user_id, place_id) DO UPDATE SET method = 'gps';
  PERFORM public.signaler_presence(p_lat, p_lng);
  -- 464 : l'auteur du lieu apprend qu'on est venu (pas pour une revisite, pas pour soi).
  IF v_premiere THEN
    BEGIN
      PERFORM notify(p.author_id, 'visite', jsonb_build_object(
        'actorId', v_moi,
        'actorName', (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_moi),
        'placeId', p_id,
        'placeTitle', p.title))
      FROM places p WHERE p.id = p_id AND p.author_id IS DISTINCT FROM v_moi;
    EXCEPTION WHEN others THEN RAISE WARNING 'visiter_lieu : notification en échec (%)', SQLERRM;
    END;
  END IF;
  RETURN json_build_object('visiteLe', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.visiter_depuis_pin(p_pin uuid, p_lieu text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_pin place_drafts%ROWTYPE;
  v_lieu record;
  v_visite boolean;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_pin FROM place_drafts WHERE id = p_pin AND user_id = v_moi AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pin introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT id, latitude, longitude INTO v_lieu FROM places
  WHERE id = p_lieu AND nature = 'lieu' AND public._lieu_visible(p_lieu);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF public._distance_m(v_pin.latitude, v_pin.longitude, v_lieu.latitude, v_lieu.longitude) > 200 THEN
    RAISE EXCEPTION 'Trop loin de ton pin' USING ERRCODE = 'P0001', HINT = 'loin';
  END IF;
  v_visite := public._pin_frais(v_pin.created_at);
  IF v_visite THEN
    -- La visite la plus récente fait foi (comme visiter_lieu, 365).
    INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (p_lieu, v_moi, v_pin.created_at)
    ON CONFLICT (place_id, user_id) DO UPDATE
      SET visited_at = GREATEST(place_explorers.visited_at, EXCLUDED.visited_at),
          a_distance = false; -- 531 : un souvenir devient une visite
    INSERT INTO places_discovered (user_id, place_id, method, discovered_at) VALUES (v_moi, p_lieu, 'gps', now())
    ON CONFLICT (user_id, place_id) DO UPDATE SET method = 'gps';
  END IF;
  UPDATE place_drafts SET status = 'published', published_place_id = p_lieu, published_at = now()
  WHERE id = p_pin;
  RETURN json_build_object('visite', v_visite);
END;
$function$;

CREATE OR REPLACE FUNCTION public.revendiquer_lieu(p_id text, p_compagnons text[], p_nom text, p_pour_compagnie text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_valides text[];
  v_nom text := NULLIF(btrim(p_nom), '');
  v_pour text := NULLIF(btrim(COALESCE(p_pour_compagnie, '')), '');
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_id AND nature = 'lieu' AND public._lieu_visible(p_id)) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM place_explorers
    WHERE place_id = p_id AND user_id = v_moi AND visited_at > now() - interval '30 minutes'
      AND NOT a_distance) THEN -- 531 : jamais sur un souvenir
    RAISE EXCEPTION 'Visite trop ancienne' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public._presents_autour(p_id) a WHERE a.user_id = v_moi) THEN
    RAISE EXCEPTION 'Pas sur place' USING ERRCODE = 'P0001';
  END IF;

  -- Seuls comptent les compagnons présents maintenant : les autres sont ignorés.
  SELECT COALESCE(array_agg(a.user_id), '{}') INTO v_valides
  FROM public._presents_autour(p_id) a
  WHERE a.user_id = ANY (COALESCE(p_compagnons, '{}')) AND a.user_id <> v_moi;
  IF cardinality(v_valides) > 0 AND v_nom IS NULL THEN
    RAISE EXCEPTION 'Nom d''expédition manquant' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_valides) = 0 THEN
    v_nom := NULL; -- seul : la pilule porte son nom
  END IF;

  -- 422 : « pour » une Compagnie dont je suis membre seulement.
  IF v_pour IS NOT NULL AND public._role_compagnie(v_pour, v_moi) IS NULL THEN
    RAISE EXCEPTION 'Pas membre de cette Compagnie' USING ERRCODE = 'P0001', HINT = 'role';
  END IF;

  RETURN public._revendiquer(p_id, v_moi, v_valides, v_nom, v_pour);
END;
$function$;

CREATE OR REPLACE FUNCTION public.compagnons_possibles(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
      'avatar', u.avatar_url, 'distance', greatest(50, round(a.distance / 50) * 50)) ORDER BY a.distance), '[]'::json)
  FROM public._presents_autour(p_id) a JOIN users u ON u.id = a.user_id
  WHERE a.user_id <> (auth.uid())::text
    AND public._lieu_visible(p_id)
    AND EXISTS (SELECT 1 FROM public._presents_autour(p_id) m WHERE m.user_id = (auth.uid())::text)
    -- Seul qui a vraiment visité le lieu (visite GPS de moins de 30 min) voit qui est autour.
    AND EXISTS (SELECT 1 FROM place_explorers e
                WHERE e.place_id = p_id AND e.user_id = (auth.uid())::text
                  AND e.visited_at > now() - interval '30 minutes' AND NOT e.a_distance); -- 531
$function$;

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

CREATE OR REPLACE FUNCTION public.activite_publique(p_limite integer DEFAULT 8)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object('sorte', x.sorte, 'quand', x.quand,
                                             'lieu', json_build_object('id', x.id, 'nom', x.title))
                           ORDER BY x.quand DESC), '[]'::json)
  FROM (
    SELECT a.sorte, a.quand, p.id, p.title
    FROM (
      (SELECT 'decouverte' AS sorte, place_id, discovered_at AS quand FROM places_discovered
       WHERE method = 'remote' ORDER BY discovered_at DESC LIMIT 20)
      UNION ALL
      (SELECT 'visite', place_id, visited_at FROM place_explorers WHERE NOT a_distance -- 531
       ORDER BY visited_at DESC LIMIT 20)
      UNION ALL
      (SELECT 'ajout', id, created_at FROM places ORDER BY created_at DESC LIMIT 20)
    ) a
    JOIN places p ON p.id = a.place_id AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
    WHERE a.quand IS NOT NULL
    ORDER BY a.quand DESC
    LIMIT least(greatest(COALESCE(p_limite, 8), 1), 20)
  ) x;
$function$;

CREATE OR REPLACE FUNCTION public._notification_v2(p_type text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_type = ANY (ARRAY[
    'like_contribution', 'like_carnet', 'new_carnet', 'description_edited', 'new_photo',
    'new_comment', 'comment_reply', 'place_position_edited', 'exploration',
    'milestone_vues', 'milestone_exploration', 'milestone_likes', 'mention', 'salut',
    'lieu_modifie', 'coeur_mot', 'demande_compagnie', 'demande_acceptee',
    'visite', 'revendication_reprise', 'nouveau_membre', 'enigme_acceptee',
    'mot_mise_a_jour', 'reponse_mise_a_jour', 'coeur_mot_mise_a_jour', 'coeur_mise_a_jour',
    'souvenir']); -- 531
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
        'depuis', v.planted_at,
        -- 422 : « pour Le Lys de Fer ».
        'pourCompagnie', (SELECT json_build_object('id', f.id, 'nom', f.title, 'couleur', f.color)
                          FROM factions f WHERE f.id = v.pour_compagnie AND NOT f.retired))
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
      -- 531 : un souvenir (« J'y suis allé ») et son mois ; le genre accorde « allé / allée ».
      'aDistance', COALESCE((SELECT e.a_distance FROM place_explorers e WHERE e.place_id = l.id AND e.user_id = moi.id), false),
      'souvenirLe', (SELECT to_char(e.souvenir_le, 'YYYY-MM-DD') FROM place_explorers e
                     WHERE e.place_id = l.id AND e.user_id = moi.id),
      'genre', (SELECT CASE WHEN u.title_gender = 'f' THEN 'f' ELSE 'm' END FROM users u WHERE u.id = moi.id),
      'envie', EXISTS (SELECT 1 FROM place_wishlist w WHERE w.place_id = l.id AND w.user_id = moi.id),
      -- Découvert : ajouté, visité ou découvert à distance (la même règle que carte_lieux, 363).
      'decouvert', l.author_id = moi.id
        OR EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = l.id AND e.user_id = moi.id)
        OR EXISTS (SELECT 1 FROM places_discovered d WHERE d.place_id = l.id AND d.user_id = moi.id)))
  FROM places l CROSS JOIN moi
  WHERE l.id = p_id AND public._lieu_visible(p_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_passeport(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_active IS NOT FALSE) THEN
    RETURN NULL;
  END IF;
  v_moi := COALESCE((auth.uid())::text = p_user_id, false);

  RETURN (
    WITH premieres AS (
      -- 531 : un souvenir prend son mois, et le garde après la visite GPS (la date d'origine).
      SELECT e.place_id,
             min(CASE WHEN e.souvenir_le IS NOT NULL THEN (e.souvenir_le + time '12:00') AT TIME ZONE 'Europe/Paris'
                      ELSE e.visited_at END) AS premiere,
             bool_or(e.a_distance) AS a_distance
        FROM public.place_explorers e JOIN public.places p ON p.id = e.place_id
       WHERE e.user_id = p_user_id
         AND (v_moi OR (p.masked IS NOT TRUE AND p.private IS NOT TRUE))
       GROUP BY e.place_id
    )
    SELECT json_build_object(
      'auJour', v_moi,
      'natures', COALESCE((
        SELECT json_agg(json_build_object('id', t.id, 'nom', t.title, 'icone', t.icon, 'couleur', t.color)
                        ORDER BY t."order", t.title)
          FROM public.tags t), '[]'::json),
      'tampons', COALESCE((
        SELECT json_agg(json_build_object(
                 'id', p.id,
                 'nom', p.title,
                 'imageUrl', p.images -> 0 ->> 'url',
                 'nature', (SELECT pt.tag_id FROM public.place_tags pt
                             WHERE pt.place_id = p.id AND pt.is_primary LIMIT 1),
                 'departement', p.departement,
                 'pays', p.pays,
                 'quand', to_char(
                   CASE WHEN v_moi THEN (pr.premiere AT TIME ZONE 'Europe/Paris')
                        ELSE date_trunc('month', pr.premiere AT TIME ZONE 'Europe/Paris') END,
                   'YYYY-MM-DD'),
                 'aDistance', pr.a_distance) -- 531
               ORDER BY pr.premiere DESC)
          FROM premieres pr JOIN public.places p ON p.id = pr.place_id), '[]'::json)
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.explorateurs_du_lieu(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
      'avatar', u.avatar_url,
      -- 531 : un souvenir dit son mois ; une visite qui l'a remplacé garde la date d'origine.
      'visiteLe', CASE WHEN e.souvenir_le IS NOT NULL THEN (e.souvenir_le + time '12:00') AT TIME ZONE 'Europe/Paris'
                       ELSE e.visited_at END,
      'aDistance', e.a_distance) ORDER BY e.visited_at DESC), '[]'::json)
  FROM place_explorers e JOIN users u ON u.id = e.user_id
  WHERE e.place_id = p_id AND public._lieu_visible(p_id);
$function$;

CREATE OR REPLACE FUNCTION public._auteur_du_chemin(p_evenement text)
 RETURNS character varying
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$



  SELECT CASE split_part(p_evenement, ':', 1)



    WHEN 'visite' THEN (



      SELECT e.user_id FROM place_explorers e JOIN places p ON p.id = e.place_id



      WHERE e.place_id = split_part(p_evenement, ':', 2) AND e.user_id = split_part(p_evenement, ':', 3)



        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)



    WHEN 'ajout' THEN (



      SELECT p.author_id FROM places p



      WHERE p.id = split_part(p_evenement, ':', 2) AND p.masked IS NOT TRUE AND p.private IS NOT TRUE)



    WHEN 'arrivee' THEN (SELECT u.id FROM users u WHERE u.id = split_part(p_evenement, ':', 2))

    WHEN 'connexion' THEN (SELECT u.id FROM users u WHERE u.id = split_part(p_evenement, ':', 2))

    WHEN 'revendication' THEN COALESCE((

      SELECT h.user_id FROM veille_history h JOIN places p ON p.id = h.place_id

      WHERE h.place_id = split_part(p_evenement, ':', 2) AND h.user_id = split_part(p_evenement, ':', 3)

        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1), (

      -- 438 : ou dans le registre de la V2.

      SELECT r.user_id FROM revendications r JOIN places p ON p.id = r.place_id

      WHERE r.place_id = split_part(p_evenement, ':', 2) AND r.user_id = split_part(p_evenement, ':', 3)

        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1))

    -- 415 : enrichi ou modifié, l'auteur d'une version (versions_lieu, où la mig 416 a versé la V1).

    WHEN 'enrichi' THEN (

      SELECT v.auteur FROM versions_lieu v JOIN places p ON p.id = v.place_id

      WHERE v.place_id = split_part(p_evenement, ':', 2) AND v.auteur = split_part(p_evenement, ':', 3)

        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)

    WHEN 'modifie' THEN (

      SELECT v.auteur FROM versions_lieu v JOIN places p ON p.id = v.place_id

      WHERE v.place_id = split_part(p_evenement, ':', 2) AND v.auteur = split_part(p_evenement, ':', 3)

        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)

    -- 425 : fonder ou rejoindre une Compagnie publique, tant qu'on en est.

    WHEN 'fondation' THEN (

      SELECT m.user_id FROM faction_members m JOIN factions f ON f.id = m.faction_id

      WHERE m.faction_id = split_part(p_evenement, ':', 2) AND m.user_id = split_part(p_evenement, ':', 3)

        AND m.is_founder AND NOT f.retired AND NOT f.privee)

    WHEN 'adhesion' THEN (

      SELECT m.user_id FROM faction_members m JOIN factions f ON f.id = m.faction_id

      WHERE m.faction_id = split_part(p_evenement, ':', 2) AND m.user_id = split_part(p_evenement, ':', 3)

        AND NOT f.retired AND NOT f.privee)

    -- 531 : ce qu'on a déclaré ce jour-là (une ligne regroupée de « Sur les chemins »).
    WHEN 'souvenir' THEN (
      SELECT e.user_id FROM place_explorers e
      WHERE e.user_id = split_part(p_evenement, ':', 2) AND e.a_distance
        AND e.declare_le::date::text = split_part(p_evenement, ':', 3)
      LIMIT 1)
    -- 410 : un message ne se salue plus à volonté (aimer_message, un cœur par personne).
    -- 481 : une énigme percée ce jour-là, dans cette culture (la ligne de « Sur les chemins », 449-451).
    WHEN 'enigme' THEN (
      SELECT r.user_id FROM enigma_responses r JOIN enigmas e ON e.id = r.enigma_id
      JOIN enigma_themes t ON t.id = e.theme
      WHERE r.user_id = split_part(p_evenement, ':', 2) AND e.theme = split_part(p_evenement, ':', 3)
        AND r.correct AND t.active AND r.responded_at::date::text = split_part(p_evenement, ':', 4)
      LIMIT 1)



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
            e.user_id AS qui, e.place_id AS lieu, NULL::text AS compagnie, NULL::text AS culture
     FROM place_explorers e JOIN places p ON p.id = e.place_id
     WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE AND NOT e.a_distance -- 531
     ORDER BY e.visited_at DESC LIMIT 200)
    UNION ALL
    -- 531 : « J'y suis allé », regroupé par personne et par jour de déclaration.
    (SELECT 'souvenir:' || e.user_id || ':' || e.declare_le::date, 'souvenir', e.declare_le,
            e.user_id, e.place_id, NULL, NULL
     FROM place_explorers e JOIN places p ON p.id = e.place_id
     WHERE e.a_distance AND e.declare_le IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY e.declare_le DESC LIMIT 200)
    UNION ALL
    (SELECT 'ajout:' || p.id, 'ajout', p.created_at, p.author_id, p.id, NULL, NULL
     FROM places p
     WHERE p.author_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY p.created_at DESC LIMIT 200)
    UNION ALL
    -- 411 : les arrivées reviennent (un moment de bienvenue) ; les connexions restent retirées.
    (SELECT 'arrivee:' || u.id, 'arrivee', u.created_at, u.id, NULL, NULL, NULL
     FROM users u ORDER BY u.created_at DESC LIMIT 100)
    UNION ALL
    -- 406 : les revendications (V1 et V2 écrivent veille_history).
    (SELECT 'revendication:' || h.place_id || ':' || h.user_id || ':'
              || floor(extract(epoch FROM h.planted_at))::bigint,
            'revendication', h.planted_at, h.user_id, h.place_id, NULL, NULL
     FROM veille_history h JOIN places p ON p.id = h.place_id
     WHERE h.user_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY h.planted_at DESC LIMIT 200)
    UNION ALL
    -- 438 : celles de la V2 (registre `revendications`), avec la Compagnie pour laquelle on revendique
    -- (son nom est public, même privée).
    (SELECT 'revendication:' || r.place_id || ':' || r.user_id || ':'
              || floor(extract(epoch FROM r.cree_le))::bigint,
            'revendication', r.cree_le, r.user_id, r.place_id, r.pour_compagnie, NULL
     FROM revendications r JOIN places p ON p.id = r.place_id
     WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY r.cree_le DESC LIMIT 200)
    UNION ALL
    -- 415 : chaque version sauf l'origine (Uriel, 05/10 : « quand on enrichit / modifie un lieu ») ;
    -- « enrichi » si le récit ou une rubrique a changé, « modifié » sinon.
    (SELECT w.genre || ':' || w.place_id || ':' || w.auteur || ':' || floor(extract(epoch FROM w.cree_le))::bigint,
            w.genre, w.cree_le, w.auteur, w.place_id, NULL, NULL
     FROM (
       SELECT v.place_id, v.auteur, v.cree_le, lag(v.id) OVER o AS precedente,
              CASE WHEN v.recit IS DISTINCT FROM lag(v.recit) OVER o
                     OR v.acces IS DISTINCT FROM lag(v.acces) OVER o
                     OR v.quand IS DISTINCT FROM lag(v.quand) OVER o
                     OR v.bon_a_savoir IS DISTINCT FROM lag(v.bon_a_savoir) OVER o
                   THEN 'enrichi' ELSE 'modifie' END AS genre
       FROM versions_lieu v WINDOW o AS (PARTITION BY v.place_id ORDER BY v.cree_le, v.id)) w
     JOIN places p ON p.id = w.place_id
     WHERE w.precedente IS NOT NULL AND w.auteur IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY w.cree_le DESC LIMIT 200)
    UNION ALL
    -- 425 : fonder une Compagnie, la rejoindre — les publiques seulement (le fil est lu de tous).
    (SELECT 'fondation:' || f.id || ':' || m.user_id, 'fondation', f.created_at, m.user_id, NULL, f.id, NULL
     FROM factions f JOIN faction_members m ON m.faction_id = f.id AND m.is_founder
     WHERE NOT f.retired AND NOT f.privee
     ORDER BY f.created_at DESC LIMIT 50)
    UNION ALL
    (SELECT 'adhesion:' || f.id || ':' || m.user_id, 'adhesion', m.joined_at, m.user_id, NULL, f.id, NULL
     FROM faction_members m JOIN factions f ON f.id = m.faction_id
     WHERE NOT f.retired AND NOT f.privee AND m.is_founder IS NOT TRUE
     ORDER BY m.joined_at DESC LIMIT 200)
    UNION ALL
    -- 449 : une énigme percée (réponse juste), avec sa culture — jamais la question ni la réponse
    -- (pas de spoiler, .claude/rules/produit.md). Une ligne par personne et par jour : son id est
    -- celui du jour, pour que les saluts tiennent quand une autre énigme s'y ajoute.
    (SELECT 'enigme:' || r.user_id || ':' || e.theme || ':' || r.responded_at::date, 'enigme', r.responded_at, r.user_id,
            NULL, NULL, e.theme
     FROM enigma_responses r JOIN enigmas e ON e.id = r.enigma_id JOIN enigma_themes t ON t.id = e.theme
     WHERE r.correct AND t.active AND r.responded_at IS NOT NULL
     ORDER BY r.responded_at DESC LIMIT 200)
  ),
  -- Une ligne au plus par personne, par type et par jour : la plus récente.
  -- 449 : et combien ce jour-là (« a percé 3 énigmes »).
  une_par_jour AS (
    -- 504 : sauf les ajouts — chaque lieu ajouté a sa ligne (et ses cœurs).
    SELECT DISTINCT ON (type, qui, culture, quand::date, CASE WHEN type = 'ajout' THEN lieu END) *,
           count(*) OVER (PARTITION BY type, qui, culture, quand::date,
                                       CASE WHEN type = 'ajout' THEN lieu END) AS nombre
    FROM evenements
    ORDER BY type, qui, culture, quand::date, CASE WHEN type = 'ajout' THEN lieu END, quand DESC
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
      'compagnie', CASE WHEN f.id IS NULL THEN NULL
        ELSE json_build_object('id', f.id, 'nom', f.title, 'couleur', f.color) END, -- 425
      'culture', CASE WHEN c.id IS NULL THEN NULL
        ELSE json_build_object('id', c.id, 'nom', c.label, 'couleur', c.color, 'icone', c.icon) END, -- 449
      'nombre', r.nombre, -- 449
      -- 531 : les photos de ce qu'on a déclaré ce jour-là (quatre au plus).
      'photos', CASE WHEN r.type = 'souvenir' THEN COALESCE((
        SELECT json_agg(s.url) FROM (
          SELECT p2.images -> 0 ->> 'url' AS url
          FROM place_explorers e2 JOIN places p2 ON p2.id = e2.place_id
          WHERE e2.user_id = r.qui AND e2.a_distance AND e2.declare_le::date = r.quand::date
            AND p2.masked IS NOT TRUE AND p2.private IS NOT TRUE AND p2.images -> 0 ->> 'url' IS NOT NULL
          ORDER BY e2.declare_le DESC LIMIT 4) s), '[]'::json) END,
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
  LEFT JOIN places p ON p.id = r.lieu
  LEFT JOIN factions f ON f.id = r.compagnie AND NOT f.retired
  LEFT JOIN enigma_themes c ON c.id = r.culture;
$function$;
