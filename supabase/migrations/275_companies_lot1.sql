-- 275_companies_lot1.sql
-- WHY : Lot 1 de la refonte identité V1 (SPEC 2 — Les Compagnies). Micro-factions
-- joueur : fonder (coût Couronnes), rejoindre (max 2 par joueur), bannière active
-- (1 à la fois + cooldown), identité (nom/image/couleur/description), chat dédié.
-- + 4 Compagnies officielles (is_official) seedées par les admins (anti cold-start).
-- Additif strict : on ne touche ni aux factions/Classes ni au Dortoir existant.
-- Échelons organiques + pactes de lieu = lots ultérieurs (interim : fondateur-admin).

BEGIN;

-- 1. Entité Compagnie
CREATE TABLE IF NOT EXISTS public.companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  color           text NOT NULL DEFAULT '#C19A6B',
  description     text,
  image_url       text,
  founder_user_id text REFERENCES public.users(id) ON DELETE SET NULL,  -- nullable : NULL pour les officielles
  is_official     boolean NOT NULL DEFAULT false,                       -- §1bis seed admin
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- Nom unique insensible à la casse (sans dépendre de citext)
CREATE UNIQUE INDEX IF NOT EXISTS companies_name_lower_uidx
  ON public.companies (lower(name));

-- 2. Appartenance (table de jointure, multi-appartenance plafonnée)
CREATE TABLE IF NOT EXISTS public.company_members (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);
CREATE INDEX IF NOT EXISTS company_members_user_idx ON public.company_members (user_id);

-- 3. Chat de Compagnie
CREATE TABLE IF NOT EXISTS public.company_messages (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name  text NOT NULL,
  content    text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_messages_company_idx
  ON public.company_messages (company_id, created_at);

-- 4. Bannissements courts (porte ouverte + exclusion → cooldown anti re-join)
CREATE TABLE IF NOT EXISTS public.company_bans (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  until      timestamptz NOT NULL,
  PRIMARY KEY (company_id, user_id)
);

-- 5. Bannière active sur users (additif, nullable = bannière perso)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active_company_id uuid
  REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active_banner_switched_at timestamptz;

-- 6. Réglages (app_settings(key, value) — value text, casté ::int à la lecture)
INSERT INTO public.app_settings (key, value) VALUES
  ('company_founding_cost', '150'),
  ('banner_switch_cooldown_hours', '6'),
  ('company_max_count', '2'),
  ('company_ban_hours', '24')
ON CONFLICT (key) DO NOTHING;

-- 7. Plafond d'appartenance au niveau DB (défense en profondeur)
CREATE OR REPLACE FUNCTION public.enforce_company_member_cap()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_max int; v_count int;
BEGIN
  v_max := COALESCE((SELECT value::int FROM public.app_settings WHERE key = 'company_max_count'), 2);
  SELECT count(*) INTO v_count FROM public.company_members WHERE user_id = NEW.user_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'company_member_cap_exceeded';
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_company_member_cap ON public.company_members;
CREATE TRIGGER trg_company_member_cap
  BEFORE INSERT ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_company_member_cap();

-- 8. Realtime sur le chat (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'company_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.company_messages;
  END IF;
END $$;

-- ============================================================================
-- RPCs — cycle de vie
-- ============================================================================

-- Fonder une Compagnie joueur (coût en Couronnes ; devient la bannière active)
CREATE OR REPLACE FUNCTION public.create_company(
  p_user_id text, p_name text, p_color text, p_description text, p_image_url text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_cost int; v_balance int; v_max int; v_count int; v_company_id uuid; v_name text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  v_name := btrim(coalesce(p_name, ''));
  IF v_name = '' THEN RETURN json_build_object('error', 'name_required'); END IF;
  IF length(v_name) > 60 THEN RETURN json_build_object('error', 'name_too_long'); END IF;
  IF EXISTS (SELECT 1 FROM companies WHERE lower(name) = lower(v_name)) THEN
    RETURN json_build_object('error', 'name_taken');
  END IF;

  v_max := COALESCE((SELECT value::int FROM app_settings WHERE key = 'company_max_count'), 2);
  SELECT count(*) INTO v_count FROM company_members WHERE user_id = p_user_id;
  IF v_count >= v_max THEN RETURN json_build_object('error', 'too_many_companies'); END IF;

  v_cost := COALESCE((SELECT value::int FROM app_settings WHERE key = 'company_founding_cost'), 150);
  SELECT balance INTO v_balance FROM user_crowns WHERE user_id = p_user_id FOR UPDATE;
  IF COALESCE(v_balance, 0) < v_cost THEN
    RETURN json_build_object('error', 'insufficient_crowns', 'cost', v_cost, 'balance', COALESCE(v_balance, 0));
  END IF;

  UPDATE user_crowns SET balance = balance - v_cost, updated_at = now() WHERE user_id = p_user_id;

  INSERT INTO companies (name, color, description, image_url, founder_user_id)
    VALUES (v_name, COALESCE(NULLIF(btrim(p_color), ''), '#C19A6B'),
            NULLIF(btrim(p_description), ''), NULLIF(btrim(p_image_url), ''), p_user_id)
    RETURNING id INTO v_company_id;

  INSERT INTO company_members (company_id, user_id) VALUES (v_company_id, p_user_id);

  -- La Compagnie fondée devient la bannière active
  UPDATE users SET active_company_id = v_company_id, active_banner_switched_at = now()
    WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'companyId', v_company_id, 'cost', v_cost);
END;$$;
GRANT EXECUTE ON FUNCTION public.create_company(text, text, text, text, text) TO authenticated;

-- Rejoindre (porte ouverte) — bloqué si déjà 2, déjà membre, ou banni
CREATE OR REPLACE FUNCTION public.join_company(p_user_id text, p_company_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_max int; v_count int;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = p_company_id) THEN
    RETURN json_build_object('error', 'company_not_found');
  END IF;
  IF EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'already_member');
  END IF;
  IF EXISTS (SELECT 1 FROM company_bans WHERE company_id = p_company_id AND user_id = p_user_id AND until > now()) THEN
    RETURN json_build_object('error', 'banned');
  END IF;
  v_max := COALESCE((SELECT value::int FROM app_settings WHERE key = 'company_max_count'), 2);
  SELECT count(*) INTO v_count FROM company_members WHERE user_id = p_user_id;
  IF v_count >= v_max THEN RETURN json_build_object('error', 'too_many_companies'); END IF;

  INSERT INTO company_members (company_id, user_id) VALUES (p_company_id, p_user_id);
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.join_company(text, uuid) TO authenticated;

-- Quitter — extinction à 0 membre SAUF officielles ; reset bannière si active
CREATE OR REPLACE FUNCTION public.leave_company(p_user_id text, p_company_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_remaining int; v_extinguished boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;

  DELETE FROM company_members WHERE company_id = p_company_id AND user_id = p_user_id;

  -- Si c'était la bannière active → retour bannière perso
  UPDATE users SET active_company_id = NULL, active_banner_switched_at = now()
    WHERE id = p_user_id AND active_company_id = p_company_id;

  -- Extinction à 0 membre — SAUF Compagnies officielles (elles persistent, §1bis)
  SELECT count(*) INTO v_remaining FROM company_members WHERE company_id = p_company_id;
  IF v_remaining = 0 AND NOT EXISTS (SELECT 1 FROM companies WHERE id = p_company_id AND is_official) THEN
    DELETE FROM companies WHERE id = p_company_id;  -- cascade messages/bans/members
    v_extinguished := true;
  END IF;

  RETURN json_build_object('success', true, 'extinguished', v_extinguished);
END;$$;
GRANT EXECUTE ON FUNCTION public.leave_company(text, uuid) TO authenticated;

-- Créer une Compagnie officielle (admin, sans coût, is_official=true)
CREATE OR REPLACE FUNCTION public.admin_create_company(
  p_name text, p_color text, p_description text, p_image_url text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_company_id uuid;
BEGIN
  IF NOT public._is_admin() THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;
  v_name := btrim(coalesce(p_name, ''));
  IF v_name = '' THEN RETURN json_build_object('error', 'name_required'); END IF;
  IF EXISTS (SELECT 1 FROM companies WHERE lower(name) = lower(v_name)) THEN
    RETURN json_build_object('error', 'name_taken');
  END IF;
  INSERT INTO companies (name, color, description, image_url, founder_user_id, is_official)
    VALUES (v_name, COALESCE(NULLIF(btrim(p_color), ''), '#C19A6B'),
            NULLIF(btrim(p_description), ''), NULLIF(btrim(p_image_url), ''), NULL, true)
    RETURNING id INTO v_company_id;
  RETURN json_build_object('success', true, 'companyId', v_company_id);
END;$$;
GRANT EXECUTE ON FUNCTION public.admin_create_company(text, text, text, text) TO authenticated;

-- ============================================================================
-- RPCs — bannière, chat, lecture, identité, exclusion
-- ============================================================================

-- Basculer la bannière active (null = bannière perso) — soumis au cooldown
CREATE OR REPLACE FUNCTION public.set_active_banner(p_user_id text, p_company_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cd_hours int; v_last timestamptz; v_next timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF p_company_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;

  v_cd_hours := COALESCE((SELECT value::int FROM app_settings WHERE key = 'banner_switch_cooldown_hours'), 6);
  SELECT active_banner_switched_at INTO v_last FROM users WHERE id = p_user_id;
  IF v_last IS NOT NULL THEN
    v_next := v_last + make_interval(hours => v_cd_hours);
    IF now() < v_next THEN
      RETURN json_build_object('error', 'cooldown',
        'secondsRemaining', ceil(extract(epoch FROM (v_next - now())))::int);
    END IF;
  END IF;

  UPDATE users SET active_company_id = p_company_id, active_banner_switched_at = now()
    WHERE id = p_user_id;
  RETURN json_build_object('success', true, 'activeCompanyId', p_company_id);
END;$$;
GRANT EXECUTE ON FUNCTION public.set_active_banner(text, uuid) TO authenticated;

-- Envoyer un message de Compagnie (membre uniquement)
CREATE OR REPLACE FUNCTION public.send_company_message(p_user_id text, p_company_id uuid, p_content text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_id bigint; v_content text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;
  v_content := btrim(coalesce(p_content, ''));
  IF length(v_content) < 1 OR length(v_content) > 500 THEN
    RETURN json_build_object('error', 'invalid_content');
  END IF;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_name FROM users WHERE id = p_user_id;
  INSERT INTO company_messages (company_id, user_id, user_name, content)
    VALUES (p_company_id, p_user_id, v_name, v_content) RETURNING id INTO v_id;
  RETURN json_build_object('success', true, 'id', v_id);
END;$$;
GRANT EXECUTE ON FUNCTION public.send_company_message(text, uuid, text) TO authenticated;

-- Lecture initiale des messages (le live passe par realtime)
CREATE OR REPLACE FUNCTION public.get_company_messages(p_company_id uuid, p_limit int DEFAULT 50)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid text; v_rows json;
BEGIN
  v_uid := auth.uid()::text;
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = v_uid) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at), '[]'::json) INTO v_rows
  FROM (
    SELECT id, user_id AS "userId", user_name AS "userName", content, created_at AS "createdAt"
    FROM company_messages WHERE company_id = p_company_id
    ORDER BY created_at DESC LIMIT GREATEST(1, LEAST(p_limit, 200))
  ) t;
  RETURN v_rows;
END;$$;
GRANT EXECUTE ON FUNCTION public.get_company_messages(uuid, int) TO authenticated;

-- Annuaire des Compagnies (porte ouverte) — officielles en tête
CREATE OR REPLACE FUNCTION public.list_companies(p_search text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rows json;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT c.id, c.name, c.color, c.image_url AS "imageUrl", c.description, c.is_official AS "isOfficial",
           (SELECT count(*) FROM company_members m WHERE m.company_id = c.id) AS "memberCount"
    FROM companies c
    WHERE p_search IS NULL OR c.name ILIKE '%' || p_search || '%'
    ORDER BY c.is_official DESC, "memberCount" DESC, c.created_at DESC
    LIMIT 100
  ) t;
  RETURN v_rows;
END;$$;
GRANT EXECUTE ON FUNCTION public.list_companies(text) TO authenticated;

-- Détail d'une Compagnie + ses membres
CREATE OR REPLACE FUNCTION public.get_company(p_company_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_company json; v_members json; v_founder text; v_exists boolean;
BEGIN
  SELECT founder_user_id, true INTO v_founder, v_exists FROM companies WHERE id = p_company_id;
  IF NOT COALESCE(v_exists, false) THEN
    RETURN json_build_object('error', 'company_not_found');
  END IF;
  SELECT json_build_object(
    'id', c.id, 'name', c.name, 'color', c.color, 'imageUrl', c.image_url,
    'description', c.description, 'founderUserId', c.founder_user_id, 'isOfficial', c.is_official,
    'memberCount', (SELECT count(*) FROM company_members m WHERE m.company_id = c.id)
  ) INTO v_company FROM companies c WHERE c.id = p_company_id;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.joined_at), '[]'::json) INTO v_members
  FROM (
    SELECT m.user_id AS "userId",
           COALESCE(u.display_name, u.first_name, 'Quelqu''un') AS name,
           m.joined_at AS "joinedAt",
           (m.user_id = v_founder) AS "isFounder"
    FROM company_members m JOIN users u ON u.id = m.user_id
    WHERE m.company_id = p_company_id
  ) t;

  RETURN (v_company::jsonb || jsonb_build_object('members', v_members))::json;
END;$$;
GRANT EXECUTE ON FUNCTION public.get_company(uuid) TO authenticated;

-- Mes 0–2 Compagnies + laquelle est active
CREATE OR REPLACE FUNCTION public.get_my_companies(p_user_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_active uuid; v_rows json;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  SELECT active_company_id INTO v_active FROM users WHERE id = p_user_id;
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.joined_at), '[]'::json) INTO v_rows
  FROM (
    SELECT c.id, c.name, c.color, c.image_url AS "imageUrl", c.is_official AS "isOfficial",
           (SELECT count(*) FROM company_members m2 WHERE m2.company_id = c.id) AS "memberCount",
           (c.id = v_active) AS "isActive",
           (c.founder_user_id = p_user_id) AS "isFounder",
           m.joined_at
    FROM company_members m JOIN companies c ON c.id = m.company_id
    WHERE m.user_id = p_user_id
  ) t;
  RETURN json_build_object('activeCompanyId', v_active, 'companies', v_rows);
END;$$;
GRANT EXECUTE ON FUNCTION public.get_my_companies(text) TO authenticated;

-- Éditer l'identité — INTERIM Lot 1 : fondateur (joueur) OU admin (officielle).
-- Remplacé au Lot 2 par le pouvoir d'échelon Capitaine.
CREATE OR REPLACE FUNCTION public.update_company_identity(
  p_user_id text, p_company_id uuid, p_name text, p_color text, p_description text, p_image_url text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF NOT (public._is_admin()
          OR EXISTS (SELECT 1 FROM companies WHERE id = p_company_id AND founder_user_id = p_user_id)) THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;
  v_name := btrim(coalesce(p_name, ''));
  IF v_name = '' THEN RETURN json_build_object('error', 'name_required'); END IF;
  IF length(v_name) > 60 THEN RETURN json_build_object('error', 'name_too_long'); END IF;
  IF EXISTS (SELECT 1 FROM companies WHERE lower(name) = lower(v_name) AND id <> p_company_id) THEN
    RETURN json_build_object('error', 'name_taken');
  END IF;
  UPDATE companies SET
    name = v_name,
    color = COALESCE(NULLIF(btrim(p_color), ''), color),
    description = NULLIF(btrim(p_description), ''),
    image_url = NULLIF(btrim(p_image_url), '')
  WHERE id = p_company_id;
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.update_company_identity(text, uuid, text, text, text, text) TO authenticated;

-- Exclure un membre — INTERIM Lot 1 : fondateur OU admin ; pose un ban court
CREATE OR REPLACE FUNCTION public.remove_company_member(p_user_id text, p_company_id uuid, p_target_user_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ban_hours int;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF NOT (public._is_admin()
          OR EXISTS (SELECT 1 FROM companies WHERE id = p_company_id AND founder_user_id = p_user_id)) THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;
  IF p_target_user_id = p_user_id THEN
    RETURN json_build_object('error', 'cannot_remove_self');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = p_target_user_id) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;

  v_ban_hours := COALESCE((SELECT value::int FROM app_settings WHERE key = 'company_ban_hours'), 24);
  DELETE FROM company_members WHERE company_id = p_company_id AND user_id = p_target_user_id;
  INSERT INTO company_bans (company_id, user_id, until)
    VALUES (p_company_id, p_target_user_id, now() + make_interval(hours => v_ban_hours))
    ON CONFLICT (company_id, user_id) DO UPDATE SET until = EXCLUDED.until;
  -- Si la Compagnie était la bannière active du viré → bannière perso
  UPDATE users SET active_company_id = NULL, active_banner_switched_at = now()
    WHERE id = p_target_user_id AND active_company_id = p_company_id;
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.remove_company_member(text, uuid, text) TO authenticated;

COMMIT;
