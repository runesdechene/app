-- 074_drop_fortification_and_claimed_columns.sql
-- WHY: Sprint Purification (mai 2026) — le système de fortification (V0)
--      n'a plus lieu d'être : valeurs toutes à 0 en prod, mais polluait
--      encore les calculs (rangs, scores, territoires Voronoi pondéré).
--      Idem pour les colonnes claimed_by/claimed_at/claimed_avatar_url —
--      remplacées par le système Veille (V0.7 plantage) comme source de
--      vérité de "qui contrôle un lieu".
--
-- Suite logique de la mig 073 qui a déjà droppé la table place_claims.
-- Une fois cette mig appliquée :
--   - 4 colonnes places.* sont supprimées
--   - L'objet `claim` n'existe plus dans le retour de get_place_by_id
--   - place_influence_score (mort) est supprimée
--   - get_underdog_faction_id calcule l'underdog via COUNT places (plus simple)
--   - preview_action_cost ne gère plus que 'discover' (claim/fortify morts)
--   - handle_new_user / migrate_user_to_auth_id ne migrent plus claimed_by
--
-- Versions courantes des autres RPCs critiques (player_profile, user_titles,
-- territory_votes, vote_territory_name) : déjà nettoyées en mig 044, 067, 068.

-- ============================================================
-- 1. DROP place_influence_score (0 ref code, mort depuis V0.6)
-- ============================================================

DROP FUNCTION IF EXISTS public.place_influence_score(text);

-- ============================================================
-- 2. REDÉFINIR get_place_by_id sans l'objet `claim` ni v_zone_fort
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_place_by_id(p_id text, p_user_id text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_place RECORD;
  v_author RECORD;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_requester JSON;
  v_geocache_count INT;
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place.id IS NULL THEN RETURN NULL; END IF;

  SELECT id, first_name, display_name, avatar_url, faction_id INTO v_author
  FROM users WHERE id = v_place.author_id;

  SELECT COUNT(*) INTO v_geocache_count
  FROM image_media WHERE place_id = p_id AND is_geocache = TRUE;

  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'icon', t.icon,
    'iconUrl', t.icon_url,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'slug', v_place.slug,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'firstName', v_author.first_name,
      'displayName', v_author.display_name,
      'avatarUrl', v_author.avatar_url,
      'factionId', v_author.faction_id
    ),
    'location', json_build_object('lat', v_place.latitude, 'lng', v_place.longitude),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'createdAt', v_place.created_at,
    'requester', v_requester
  );
END;
$$;

-- ============================================================
-- 3. REDÉFINIR get_underdog_faction_id sans claimed_at/fortification
--    Nouvelle logique : underdog = faction avec le moins de lieux.
--    (S'aligne sur le système Veille où "qui contrôle" = qui veille,
--    pas qui a "claim" historiquement.)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_underdog_faction_id() RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_faction_id TEXT;
  v_active_count INT;
BEGIN
  -- Compter les factions actives (au moins 1 lieu rattaché)
  SELECT COUNT(DISTINCT faction_id) INTO v_active_count
  FROM places
  WHERE faction_id IS NOT NULL;

  IF v_active_count < 2 THEN
    RETURN NULL;
  END IF;

  -- Faction avec le moins de lieux = underdog
  SELECT f.id INTO v_faction_id
  FROM factions f
  INNER JOIN places p ON p.faction_id = f.id
  GROUP BY f.id
  ORDER BY COUNT(*) ASC
  LIMIT 1;

  RETURN v_faction_id;
END;
$$;

-- ============================================================
-- 4. REDÉFINIR preview_action_cost sans 'claim'/'fortify' (actions mortes)
--    Conserve uniquement la branche 'discover' (utilisée par create_place
--    SQL et FoggedPlaceView frontend).
-- ============================================================

CREATE OR REPLACE FUNCTION public.preview_action_cost(p_user_id text, p_place_id text, p_action text, p_user_lat numeric DEFAULT NULL::numeric, p_user_lng numeric DEFAULT NULL::numeric) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_tag_reduction NUMERIC := 0;
  v_same_faction_discount BOOLEAN := FALSE;
  v_total NUMERIC;
  v_energy NUMERIC;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC := 0;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_glory_base INT;
  v_glory_cost_pct NUMERIC;
  v_glory_preview INT;
BEGIN
  SELECT energy_points, faction_id INTO v_energy, v_user_faction FROM users WHERE id = p_user_id;

  SELECT latitude, longitude, faction_id
  INTO v_place_lat, v_place_lng, v_place_faction
  FROM places WHERE id = p_place_id;

  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  v_tag_reduction := get_faction_tag_reduction(p_user_id, p_place_id);

  v_total := (v_base_cost * v_dist_mult) * (1 - v_tag_reduction / 100);

  IF p_action = 'discover' AND v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
    v_total := v_total * 0.5;
    v_same_faction_discount := TRUE;
  END IF;

  v_total := GREATEST(0.5, ROUND(v_total * 2) / 2.0);

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'glory_discover'), 5) INTO v_glory_base;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'glory_cost_bonus_pct'), 10) INTO v_glory_cost_pct;
  v_glory_preview := GREATEST(1, ROUND(v_glory_base + v_total * v_glory_cost_pct / 100));

  RETURN json_build_object(
    'cost', v_total,
    'energy', v_energy,
    'canAfford', v_energy >= v_total,
    'gloryPreview', v_glory_preview,
    'detail', json_build_object(
      'baseCost', v_base_cost,
      'distanceKm', ROUND(v_distance_km::NUMERIC, 1),
      'distanceMult', v_dist_mult,
      'tagReduction', v_tag_reduction,
      'sameFaction', v_same_faction_discount
    )
  );
END;
$$;

-- DROP l'ancienne signature (avec p_fortify_level) qui devient une overload morte
DROP FUNCTION IF EXISTS public.preview_action_cost(text, text, text, numeric, numeric, integer);

-- ============================================================
-- 5. REDÉFINIR handle_new_user sans UPDATE places SET claimed_by
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_existing RECORD;
  v_err TEXT;
  v_max_e NUMERIC(4,1);
BEGIN
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.id != NEW.id::TEXT THEN
    BEGIN
      UPDATE public.users SET email_address = '', shopify_customer_id = NULL WHERE id = v_existing.id;

      INSERT INTO public.users (
        id, email_address, first_name, gender, rank, role, bio,
        avatar_url, display_name, instagram, location_name, location_zip,
        faction_id, energy_points, energy_reset_at,
        conquest_points, conquest_reset_at,
        construction_points, construction_reset_at,
        max_energy, max_conquest, max_construction,
        vitalite_points, max_vitalite, vitalite_reset_at,
        notoriety_points, displayed_general_title_ids,
        displayed_title_ids_v3, game_mode,
        shopify_customer_id, account_source,
        is_active, website_url,
        created_at, updated_at
      )
      SELECT
        NEW.id::TEXT,
        v_existing.email_address,
        v_existing.first_name,
        v_existing.gender,
        COALESCE(v_existing.rank, 'guest'),
        v_existing.role,
        v_existing.bio,
        v_existing.avatar_url,
        v_existing.display_name,
        v_existing.instagram,
        v_existing.location_name,
        v_existing.location_zip,
        v_existing.faction_id,
        v_existing.energy_points,
        v_existing.energy_reset_at,
        v_existing.conquest_points,
        v_existing.conquest_reset_at,
        v_existing.construction_points,
        v_existing.construction_reset_at,
        v_existing.max_energy,
        v_existing.max_conquest,
        v_existing.max_construction,
        COALESCE(v_existing.vitalite_points, 5),
        COALESCE(v_existing.max_vitalite, 5),
        COALESCE(v_existing.vitalite_reset_at, NOW()),
        v_existing.notoriety_points,
        v_existing.displayed_general_title_ids,
        v_existing.displayed_title_ids_v3,
        v_existing.game_mode,
        v_existing.shopify_customer_id,
        v_existing.account_source,
        v_existing.is_active,
        v_existing.website_url,
        v_existing.created_at,
        NOW()
      ON CONFLICT (id) DO NOTHING;

      UPDATE places_discovered SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE chat_messages SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_viewed SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_liked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_explored SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_bookmarked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE reviews SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE image_media SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE member_codes SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_photo_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_review_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_photo_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_review_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE places SET author_id = NEW.id::TEXT WHERE author_id = v_existing.id;
      UPDATE activity_log SET actor_id = NEW.id::TEXT WHERE actor_id = v_existing.id;
      UPDATE territory_name_proposals SET proposed_by = NEW.id::TEXT WHERE proposed_by = v_existing.id;
      UPDATE territory_name_votes SET voter_id = NEW.id::TEXT WHERE voter_id = v_existing.id;
      UPDATE user_fragments SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE fragment_ability_uses SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE purchase_log SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;

      DELETE FROM public.users WHERE id = v_existing.id;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE WARNING '[handle_new_user] Migration failed for % (old_id=%, new_id=%): %',
        NEW.email, v_existing.id, NEW.id, v_err;

      INSERT INTO public.users (id, email_address, first_name, gender, rank, role, bio, created_at, updated_at)
      VALUES (
        NEW.id::TEXT,
        '__migrated_' || NEW.id::TEXT,
        COALESCE(v_existing.first_name, 'Aventurier'),
        COALESCE(v_existing.gender, 'unknown'),
        COALESCE(v_existing.rank, 'guest'),
        COALESCE(v_existing.role, 'user'),
        COALESCE(v_existing.bio, ''),
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    END;

  ELSE
    SELECT COALESCE(value::NUMERIC, 5)
    INTO v_max_e
    FROM app_settings
    WHERE key = 'default_max_energy';

    v_max_e := COALESCE(v_max_e, 5.0);

    INSERT INTO public.users (
      id, email_address, first_name, rank, role,
      energy_points, max_energy, account_source,
      created_at, updated_at
    )
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      NEW.raw_user_meta_data->>'first_name',
      'guest',
      'user',
      v_max_e,
      v_max_e,
      'app',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 6. REDÉFINIR migrate_user_to_auth_id sans UPDATE places SET claimed_by
-- ============================================================

CREATE OR REPLACE FUNCTION public.migrate_user_to_auth_id(p_old_id text, p_new_id text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_email TEXT;
  v_err TEXT;
BEGIN
  IF auth.uid()::TEXT != p_new_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT email_address INTO v_email FROM public.users WHERE id = p_old_id;
  IF v_email IS NULL THEN
    RETURN json_build_object('error', 'old_user_not_found');
  END IF;

  DELETE FROM public.users
  WHERE id = p_new_id
    AND (email_address LIKE '__migrated_%' OR email_address = '');

  UPDATE public.users SET email_address = '', shopify_customer_id = NULL WHERE id = p_old_id;

  INSERT INTO public.users (
    id, email_address, first_name, gender, rank, role, bio,
    avatar_url, display_name, instagram, location_name, location_zip,
    faction_id, energy_points, energy_reset_at,
    conquest_points, conquest_reset_at,
    construction_points, construction_reset_at,
    max_energy, max_conquest, max_construction,
    vitalite_points, max_vitalite, vitalite_reset_at,
    notoriety_points, displayed_general_title_ids,
    displayed_title_ids_v3, game_mode,
    shopify_customer_id, account_source,
    is_active, website_url,
    created_at, updated_at
  )
  SELECT
    p_new_id,
    v_email,
    first_name, gender, rank, role, bio,
    avatar_url, display_name, instagram, location_name, location_zip,
    faction_id, energy_points, energy_reset_at,
    conquest_points, conquest_reset_at,
    construction_points, construction_reset_at,
    max_energy, max_conquest, max_construction,
    COALESCE(vitalite_points, 5), COALESCE(max_vitalite, 5), COALESCE(vitalite_reset_at, NOW()),
    notoriety_points, displayed_general_title_ids,
    displayed_title_ids_v3, game_mode,
    shopify_customer_id, account_source,
    is_active, website_url,
    created_at, NOW()
  FROM public.users WHERE id = p_old_id
  ON CONFLICT (id) DO NOTHING;

  UPDATE places_discovered SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE chat_messages SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_viewed SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_liked SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_explored SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_bookmarked SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE reviews SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE image_media SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE member_codes SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_community_photos SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_photo_submissions SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_review_submissions SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_community_photos SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE hub_photo_submissions SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE hub_review_submissions SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE places SET author_id = p_new_id WHERE author_id = p_old_id;
  UPDATE activity_log SET actor_id = p_new_id WHERE actor_id = p_old_id;
  UPDATE territory_name_proposals SET proposed_by = p_new_id WHERE proposed_by = p_old_id;
  UPDATE territory_name_votes SET voter_id = p_new_id WHERE voter_id = p_old_id;
  UPDATE user_fragments SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE fragment_ability_uses SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE purchase_log SET user_id = p_new_id WHERE user_id = p_old_id;

  DELETE FROM public.users WHERE id = p_old_id;

  RETURN json_build_object('success', true, 'migrated_from', p_old_id, 'migrated_to', p_new_id);

EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
  RAISE WARNING '[migrate_user_to_auth_id] Failed: %', v_err;
  RETURN json_build_object('error', v_err);
END;
$$;

-- ============================================================
-- 7. DROP les colonnes legacy + index + contrainte FK
-- ============================================================

ALTER TABLE public.places
  DROP CONSTRAINT IF EXISTS places_claimed_by_fkey;

DROP INDEX IF EXISTS public.idx_places_claimed_by;

ALTER TABLE public.places
  DROP COLUMN IF EXISTS claimed_by,
  DROP COLUMN IF EXISTS claimed_at,
  DROP COLUMN IF EXISTS claimed_avatar_url,
  DROP COLUMN IF EXISTS fortification_level;
