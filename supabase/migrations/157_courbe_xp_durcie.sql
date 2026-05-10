-- 157_courbe_xp_durcie.sql
-- WHY : la courbe XP de mig 035 (cap niv 50 = 6248 xp) était trop douce —
-- Nolroc a atteint niv 30 en 1.5 mois (689 discover + 41 lieux ajoutés),
-- alors que la promesse était "1 an minimum pour un joueur très actif".
-- Aussi : les triggers XP utilisaient des constantes hardcodées (place +20,
-- plant +10, carnet +5) qui ne correspondaient pas aux valeurs de
-- public.app_settings (glory.add_place = 7, glory.plant_flag = 2,
-- glory.carnet = 3) → 2 sources de vérité divergentes.
--
-- Cette mig :
-- 1. Durcit la courbe à partir du niv 7 (niv 1-6 inchangés pour rétention
--    nouveau joueur). Formule : xp(L) = 123 + 833 * (1.10^(L-6) - 1).
--    Niv 30 = 7494 xp (au lieu de 1926). Cap niv 50 = 55092 xp.
-- 2. Aligne les triggers _trg_xp_* avec app_settings (source de vérité
--    unique). Tout futur ajustement se fait via UPDATE app_settings.
--
-- Pas de backfill xp_total nécessaire : le niveau est calculé à la volée
-- via _level_from_xp(xp_total). Tous les users existants voient leur niveau
-- recalculé automatiquement à la prochaine lecture (Nolroc niv 30 → niv 18,
-- etc.). Les XP brutes (effort accumulé) sont préservées.

BEGIN;

-- ============================================================
-- 1. Nouvelle courbe XP
-- ============================================================

CREATE OR REPLACE FUNCTION public._xp_for_level(p_level integer)
RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_level <= 1 THEN 0
    WHEN p_level = 2  THEN 5
    WHEN p_level = 3  THEN 13
    WHEN p_level = 4  THEN 48
    WHEN p_level = 5  THEN 85
    WHEN p_level = 6  THEN 123
    WHEN p_level >= 50 THEN 55092
    ELSE (123 + 833 * (POWER(1.10, p_level - 6) - 1))::int
  END;
$$;

CREATE OR REPLACE FUNCTION public._level_from_xp(p_xp integer)
RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_xp IS NULL OR p_xp < 5   THEN 1
    WHEN p_xp < 13                  THEN 2
    WHEN p_xp < 48                  THEN 3
    WHEN p_xp < 85                  THEN 4
    WHEN p_xp < 123                 THEN 5
    -- Pour L >= 6 : L = 6 + floor(ln(1 + (xp-123)/833) / ln(1.10))
    -- Note : niv 6 = 123 xp (entrée du palier), niv 7 = 206 xp
    ELSE LEAST(50, 6 + FLOOR(LN(1 + (p_xp - 123)::numeric / 833) / LN(1.10))::int)
  END;
$$;

-- ============================================================
-- 2. Triggers alignés sur app_settings
-- ============================================================
-- Pattern : SELECT value::int depuis app_settings, fallback constante en dur
-- si la key est absente (pour ne pas casser les triggers en cas de delete
-- accidentel).

CREATE OR REPLACE FUNCTION public._trg_xp_place_insert()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_delta integer;
BEGIN
  IF NEW.author_id IS NULL OR NEW.created_at < public._xp_epoch() THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(value::int, 7) INTO v_delta
  FROM public.app_settings WHERE key = 'glory.add_place';
  v_delta := COALESCE(v_delta, 7);
  UPDATE public.users SET xp_total = xp_total + v_delta WHERE id = NEW.author_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_xp_discovered_insert()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_delta integer;
BEGIN
  IF NEW.discovered_at < public._xp_epoch() THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(value::int, 1) INTO v_delta
  FROM public.app_settings WHERE key = 'glory.discover_remote';
  v_delta := COALESCE(v_delta, 1);
  UPDATE public.users SET xp_total = xp_total + v_delta WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_xp_explorer_insert()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_delta integer;
BEGIN
  IF COALESCE(NEW.visited_at, now()) < public._xp_epoch() THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(value::int, 3) INTO v_delta
  FROM public.app_settings WHERE key = 'glory.visit_gps';
  v_delta := COALESCE(v_delta, 3);
  UPDATE public.users SET xp_total = xp_total + v_delta WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_xp_plantage_insert()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_delta integer;
BEGIN
  IF COALESCE(NEW.planted_at, now()) < public._xp_epoch() THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(value::int, 2) INTO v_delta
  FROM public.app_settings WHERE key = 'glory.plant_flag';
  v_delta := COALESCE(v_delta, 2);
  UPDATE public.users SET xp_total = xp_total + v_delta WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_xp_contribution_insert()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_delta       integer := 0;
  v_carnet_xp   integer;
  v_photo_xp    integer;
  v_photo_count integer;
BEGIN
  IF NEW.created_at < public._xp_epoch() THEN
    RETURN NEW;
  END IF;
  IF NEW.type = 'carnet' THEN
    SELECT COALESCE(value::int, 3) INTO v_carnet_xp
    FROM public.app_settings WHERE key = 'glory.carnet';
    v_delta := COALESCE(v_carnet_xp, 3);
  ELSIF NEW.type = 'photo' THEN
    SELECT COALESCE(value::int, 1) INTO v_photo_xp
    FROM public.app_settings WHERE key = 'glory.photo';
    v_photo_xp := COALESCE(v_photo_xp, 1);
    v_photo_count := COALESCE(jsonb_array_length(NEW.images), 0)
                   + CASE WHEN (NEW.images IS NULL OR jsonb_array_length(NEW.images) = 0)
                           AND NEW.image_url IS NOT NULL AND NEW.image_url != ''
                          THEN 1 ELSE 0 END;
    v_delta := v_photo_xp * v_photo_count;
  END IF;
  IF v_delta > 0 THEN
    UPDATE public.users SET xp_total = xp_total + v_delta WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
