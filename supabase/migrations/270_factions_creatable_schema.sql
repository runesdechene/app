-- 270_factions_creatable_schema.sql
-- WHY : PIVOT 24/06 (option A). On rend les factions CRÉABLES / GÉRABLES par les joueurs
-- (user-facing : « Compagnie » ; mécanique : faction). On réutilise le moteur Faction déjà
-- câblé (Coupe via _user_coupe_score / _faction_member_scores, chat Dortoir channel=factionId,
-- couleurs carte via places.faction_id, titres). Le score / chat / couleur restent pilotés par
-- users.faction_id (= faction ACTIVE) ; faction_members ne gère que l'appartenance (≤2) + le switch.
--
-- ⚠️ ADDITIF UNIQUEMENT → sûr pour le live. Le retrait des 4 héritages imposés + reset
-- users.faction_id vit dans 271_factions_retire_heritages.sql (BREAKING, release coordonnée).

-- ============================================================
-- 1. Colonnes factions : propriété + retrait logique
-- ============================================================
ALTER TABLE public.factions
  ADD COLUMN IF NOT EXISTS created_by text REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retired   boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. Réglages (coût de fondation = 200 🪙, max appartenance = 2)
--    Insert gardé (pas de dépendance à une contrainte unique sur key)
-- ============================================================
INSERT INTO public.app_settings(key, value)
  SELECT 'faction_founding_cost', '200'
  WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'faction_founding_cost');
INSERT INTO public.app_settings(key, value)
  SELECT 'faction_max_count', '2'
  WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'faction_max_count');

-- ============================================================
-- 3. Table de jonction : appartenance (≤2), bannière active = users.faction_id
-- ============================================================
CREATE TABLE IF NOT EXISTS public.faction_members (
  faction_id varchar      NOT NULL REFERENCES public.factions(id) ON DELETE CASCADE,
  user_id    text         NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  joined_at  timestamptz  NOT NULL DEFAULT now(),
  is_founder boolean      NOT NULL DEFAULT false,
  PRIMARY KEY (faction_id, user_id)
);
CREATE INDEX IF NOT EXISTS faction_members_user_idx ON public.faction_members(user_id);

ALTER TABLE public.faction_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS faction_members_read ON public.faction_members;
CREATE POLICY faction_members_read ON public.faction_members FOR SELECT USING (true);
-- Écriture : uniquement via RPC SECURITY DEFINER (pas de GRANT INSERT/UPDATE/DELETE).
GRANT SELECT ON public.faction_members TO authenticated, anon, service_role;

-- ============================================================
-- 4. RPC — création / appartenance / identité
--    Forme des erreurs/retours copiée de create_company (déjà en prod).
-- ============================================================

-- Fonder une Compagnie (= créer une faction) — coûte 200 🪙
CREATE OR REPLACE FUNCTION public.create_faction(
  p_user_id text, p_name text, p_color text, p_description text, p_image_url text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_cost int; v_balance int; v_max int; v_count int;
  v_name text; v_id text; v_order int; v_try int := 0;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  v_name := btrim(coalesce(p_name,''));
  IF v_name = ''            THEN RETURN json_build_object('error','name_required');  END IF;
  IF length(v_name) > 40    THEN RETURN json_build_object('error','name_too_long');  END IF;
  IF EXISTS (SELECT 1 FROM factions WHERE lower(title) = lower(v_name) AND retired = false)
                            THEN RETURN json_build_object('error','name_taken');     END IF;

  v_max := COALESCE((SELECT value::int FROM app_settings WHERE key = 'faction_max_count'), 2);
  SELECT count(*) INTO v_count FROM faction_members WHERE user_id = p_user_id;
  IF v_count >= v_max THEN RETURN json_build_object('error','too_many'); END IF;

  v_cost := COALESCE((SELECT value::int FROM app_settings WHERE key = 'faction_founding_cost'), 200);
  SELECT balance INTO v_balance FROM user_crowns WHERE user_id = p_user_id FOR UPDATE;
  IF COALESCE(v_balance,0) < v_cost THEN
    RETURN json_build_object('error','insufficient_crowns','cost',v_cost,'balance',COALESCE(v_balance,0));
  END IF;

  -- slug unique
  LOOP
    v_id := 'f-' || substr(md5(v_name || clock_timestamp()::text || v_try::text), 1, 12);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM factions WHERE id = v_id);
    v_try := v_try + 1;
  END LOOP;

  UPDATE user_crowns SET balance = balance - v_cost, updated_at = now() WHERE user_id = p_user_id;
  SELECT COALESCE(max("order"),0) + 1 INTO v_order FROM factions;

  INSERT INTO factions (id, title, color, description, image_url, "order", created_by, retired,
                        created_at, updated_at,
                        bonus_energy, bonus_conquest, bonus_construction, bonus_regen,
                        bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction)
    VALUES (v_id, v_name,
            COALESCE(NULLIF(btrim(p_color),''), '#C19A6B'),
            NULLIF(btrim(p_description),''),
            NULLIF(btrim(p_image_url),''),
            v_order, p_user_id, false, now(), now(),
            0,0,0,0,0,0,0);

  INSERT INTO faction_members (faction_id, user_id, is_founder) VALUES (v_id, p_user_id, true);
  UPDATE users SET faction_id = v_id WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'factionId', v_id, 'cost', v_cost);
END;$$;

-- Rejoindre une Compagnie
CREATE OR REPLACE FUNCTION public.join_faction(p_user_id text, p_faction_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_max int; v_count int; v_active text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM factions WHERE id = p_faction_id AND retired = false) THEN
    RETURN json_build_object('error','not_found'); END IF;
  IF EXISTS (SELECT 1 FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error','already_member'); END IF;
  v_max := COALESCE((SELECT value::int FROM app_settings WHERE key = 'faction_max_count'), 2);
  SELECT count(*) INTO v_count FROM faction_members WHERE user_id = p_user_id;
  IF v_count >= v_max THEN RETURN json_build_object('error','too_many'); END IF;

  INSERT INTO faction_members (faction_id, user_id) VALUES (p_faction_id, p_user_id);
  SELECT faction_id INTO v_active FROM users WHERE id = p_user_id;
  IF v_active IS NULL THEN
    UPDATE users SET faction_id = p_faction_id WHERE id = p_user_id;
    v_active := p_faction_id;
  END IF;
  RETURN json_build_object('success', true, 'activeFactionId', v_active);
END;$$;

-- Quitter une Compagnie (extinction logique à 0 membre)
CREATE OR REPLACE FUNCTION public.leave_faction(p_user_id text, p_faction_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_active text; v_other text; v_remaining int; v_extinguished boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error','not_member'); END IF;

  DELETE FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_user_id;

  SELECT faction_id INTO v_active FROM users WHERE id = p_user_id;
  IF v_active = p_faction_id THEN
    SELECT faction_id INTO v_other FROM faction_members WHERE user_id = p_user_id ORDER BY joined_at LIMIT 1;
    UPDATE users SET faction_id = v_other WHERE id = p_user_id;  -- v_other peut être NULL
  END IF;

  SELECT count(*) INTO v_remaining FROM faction_members WHERE faction_id = p_faction_id;
  IF v_remaining = 0 THEN
    UPDATE factions SET retired = true, updated_at = now() WHERE id = p_faction_id;
    v_extinguished := true;
  END IF;

  RETURN json_build_object('success', true, 'extinguished', v_extinguished);
END;$$;

-- Changer la bannière active (NULL = aucune)
CREATE OR REPLACE FUNCTION public.set_active_faction(p_user_id text, p_faction_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF p_faction_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error','not_member'); END IF;
  UPDATE users SET faction_id = p_faction_id WHERE id = p_user_id;
  RETURN json_build_object('success', true, 'activeFactionId', p_faction_id);
END;$$;

-- Helper interne : le Chef = membre avec la plus haute Coupe (saison active), détrônable.
CREATE OR REPLACE FUNCTION public._faction_chef(p_faction_id text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_chef text;
BEGIN
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  SELECT m.user_id INTO v_chef
  FROM faction_members m
  WHERE m.faction_id = p_faction_id
  ORDER BY public._user_coupe_score(m.user_id, v_from, v_to) DESC, m.joined_at ASC
  LIMIT 1;
  RETURN v_chef;
END;$$;

-- Éditer l'identité (réservé au Chef)
CREATE OR REPLACE FUNCTION public.update_faction_identity(
  p_user_id text, p_faction_id text, p_name text, p_color text, p_description text, p_image_url text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF public._faction_chef(p_faction_id) IS DISTINCT FROM p_user_id THEN RETURN json_build_object('error','not_chef'); END IF;
  v_name := btrim(coalesce(p_name,''));
  IF v_name = ''         THEN RETURN json_build_object('error','name_required'); END IF;
  IF length(v_name) > 40 THEN RETURN json_build_object('error','name_too_long'); END IF;
  IF EXISTS (SELECT 1 FROM factions WHERE lower(title) = lower(v_name) AND id <> p_faction_id AND retired = false) THEN
    RETURN json_build_object('error','name_taken'); END IF;
  UPDATE factions SET
    title = v_name,
    color = COALESCE(NULLIF(btrim(p_color),''), color),
    description = NULLIF(btrim(p_description),''),
    image_url = NULLIF(btrim(p_image_url),''),
    updated_at = now()
  WHERE id = p_faction_id;
  RETURN json_build_object('success', true);
END;$$;

-- Exclure un membre (réservé au Chef)
CREATE OR REPLACE FUNCTION public.remove_faction_member(
  p_user_id text, p_faction_id text, p_target_user_id text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF p_target_user_id = p_user_id THEN RETURN json_build_object('error','cannot_remove_self'); END IF;
  IF public._faction_chef(p_faction_id) IS DISTINCT FROM p_user_id THEN RETURN json_build_object('error','not_chef'); END IF;
  IF NOT EXISTS (SELECT 1 FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_target_user_id) THEN
    RETURN json_build_object('error','not_member'); END IF;

  DELETE FROM faction_members WHERE faction_id = p_faction_id AND user_id = p_target_user_id;
  UPDATE users SET faction_id = (
    SELECT faction_id FROM faction_members WHERE user_id = p_target_user_id ORDER BY joined_at LIMIT 1
  ) WHERE id = p_target_user_id AND faction_id = p_faction_id;
  RETURN json_build_object('success', true);
END;$$;

-- ============================================================
-- 5. RPC — lecture
-- ============================================================

-- Mes Compagnies (appartenances ≤2) + bannière active
CREATE OR REPLACE FUNCTION public.get_my_factions(p_user_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_active text; v_rows json;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('activeFactionId', NULL, 'factions', '[]'::json);
  END IF;
  SELECT faction_id INTO v_active FROM users WHERE id = p_user_id;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t."joinedAt"), '[]'::json) INTO v_rows
  FROM (
    SELECT f.id, f.title AS name, f.color, f.image_url AS "imageUrl", f.description,
           (f.created_by IS NULL) AS "isOfficial",
           (SELECT count(*) FROM faction_members mm WHERE mm.faction_id = f.id) AS "memberCount",
           (f.id = v_active) AS "isActive",
           m.is_founder AS "isFounder",
           m.joined_at AS "joinedAt"
    FROM faction_members m
    JOIN factions f ON f.id = m.faction_id
    WHERE m.user_id = p_user_id AND f.retired = false
  ) t;

  RETURN json_build_object('activeFactionId', v_active, 'factions', v_rows);
END;$$;

-- Détail d'une Compagnie (Hall) : identité + roster classé par Coupe (rang 1 = Chef)
CREATE OR REPLACE FUNCTION public.get_faction_detail(p_faction_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_members json; v_total int; v_f public.factions%ROWTYPE;
BEGIN
  SELECT * INTO v_f FROM factions WHERE id = p_faction_id;
  IF v_f.id IS NULL THEN RETURN json_build_object('error','not_found'); END IF;

  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;

  SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r."coupe" DESC, r."joinedAt" ASC), '[]'::json)
  INTO v_members
  FROM (
    SELECT m.user_id AS "userId",
           COALESCE(u.display_name, u.first_name, 'Veilleur') AS name,
           u.avatar_url AS "avatarUrl",
           m.joined_at AS "joinedAt",
           m.is_founder AS "isFounder",
           public._user_coupe_score(m.user_id, v_from, v_to) AS coupe
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id
  ) r;

  -- Score de la Compagnie = Coupe des membres ACTIFS (anti double-comptage des ≤2 appartenances)
  SELECT COALESCE(sum(public._user_coupe_score(u.id, v_from, v_to)), 0)::int INTO v_total
  FROM users u WHERE u.faction_id = p_faction_id;

  RETURN json_build_object(
    'id', v_f.id, 'name', v_f.title, 'color', v_f.color, 'imageUrl', v_f.image_url,
    'description', v_f.description,
    'createdBy', v_f.created_by,
    'isOfficial', (v_f.created_by IS NULL),
    'memberCount', (SELECT count(*) FROM faction_members WHERE faction_id = p_faction_id),
    'totalCoupe', v_total,
    'members', v_members
  );
END;$$;

-- Scoreboard : Compagnies non retirées classées par Coupe (saison active)
CREATE OR REPLACE FUNCTION public.list_factions(p_search text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rows json; v_from timestamptz; v_to timestamptz;
BEGIN
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT f.id, f.title AS name, f.color, f.image_url AS "imageUrl", f.description,
           (f.created_by IS NULL) AS "isOfficial",
           (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id) AS "memberCount",
           COALESCE((SELECT sum(public._user_coupe_score(u.id, v_from, v_to))
                     FROM users u WHERE u.faction_id = f.id), 0)::int AS "score"
    FROM factions f
    WHERE f.retired = false AND (p_search IS NULL OR f.title ILIKE '%' || p_search || '%')
    ORDER BY "score" DESC, "memberCount" DESC, f."order" ASC
    LIMIT 100
  ) t;
  RETURN v_rows;
END;$$;

-- Choix de Compagnie (rejoindre) : exclut les retirées (no-op tant que 271 non appliquée)
CREATE OR REPLACE FUNCTION public.get_factions_for_choice()
RETURNS TABLE(id text, title text, color text, pattern text, description text, image_url text,
              bonus_energy integer, bonus_regen_energy integer, member_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    f.id::text, f.title, f.color, f.pattern, f.description, f.image_url,
    COALESCE(f.bonus_energy, 0), COALESCE(f.bonus_regen_energy, 0),
    COUNT(u.id)::bigint AS member_count
  FROM public.factions f
  LEFT JOIN public.users u ON u.faction_id::text = f.id::text
  WHERE f.retired = false
  GROUP BY f.id, f.title, f.color, f.pattern, f.description, f.image_url,
           f.bonus_energy, f.bonus_regen_energy, f."order"
  ORDER BY member_count ASC, f."order" ASC;
$$;

-- ============================================================
-- 6. GRANTs
-- ============================================================
GRANT EXECUTE ON FUNCTION public.create_faction(text,text,text,text,text)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_faction(text,text)                               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_faction(text,text)                              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_active_faction(text,text)                         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_faction_identity(text,text,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_faction_member(text,text,text)                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._faction_chef(text)                                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_factions(text)                                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_faction_detail(text)                              TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_factions(text)                                   TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_factions_for_choice()                             TO authenticated, anon, service_role;
