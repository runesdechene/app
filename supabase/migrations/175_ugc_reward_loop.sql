-- 175_ugc_reward_loop.sql
-- WHY : Brique 1 du modèle UGC "Le Mouvement" (spec 2026-05-26-ugc-mouvement-model-design).
-- Récompense la contribution validée : Couronnes (cap 500) + compteur Contributions,
-- crédités À LA VALIDATION et de façon IDEMPOTENTE (rewarded_at). Bonus de bienvenue
-- unique à la création de compte. Notif contribution_approved → push (existant) + email.
-- Gloire volontairement EXCLUE (anti-triche, mig 024). Montants pilotés par app_settings.

-- ============================================================
-- SCHÉMA
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS contributions_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.hub_photo_submissions
  ADD COLUMN IF NOT EXISTS rewarded_at timestamptz;
ALTER TABLE public.hub_review_submissions
  ADD COLUMN IF NOT EXISTS rewarded_at timestamptz;

-- ============================================================
-- CONFIG (montants tunables + secrets email ; PLACEHOLDER = renseignés post-deploy)
-- Montants validés Uriel (2026-05-26) : 20 bienvenue / 10 par contribution / 30 première.
-- ============================================================
INSERT INTO public.app_settings (key, value) VALUES
  ('ugc_welcome_crowns',          '20'),
  ('ugc_reward_crowns',           '10'),
  ('ugc_first_contribution_crowns','30'),
  ('email_from',                  'Runes de Chêne <communaute@runesdechene.com>'),
  ('email_trigger_secret',        'PLACEHOLDER_set_after_deploy'),
  ('edge_function_send_email_url','PLACEHOLDER_set_after_deploy'),
  ('resend_api_key',              'PLACEHOLDER_set_in_dashboard')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- RPC : bonus de bienvenue (copie baseline + crédit unique)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_user_from_submission(p_id character varying, p_email text, p_first_name text, p_instagram text, p_location_name text DEFAULT NULL, p_location_zip text DEFAULT NULL)
RETURNS character varying
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_welcome int;
BEGIN
  INSERT INTO users (id, email_address, first_name, instagram, location_name, location_zip, role, is_active, rank, biography)
  VALUES (p_id, p_email, p_first_name, p_instagram, p_location_name, p_location_zip, 'user', true, 0, '');

  SELECT COALESCE(value::int, 0) INTO v_welcome FROM app_settings WHERE key = 'ugc_welcome_crowns';
  IF v_welcome > 0 THEN
    INSERT INTO public.user_crowns (user_id, balance, updated_at)
    VALUES (p_id, LEAST(500, v_welcome), now())
    ON CONFLICT (user_id) DO UPDATE SET
      balance = LEAST(500, public.user_crowns.balance + v_welcome),
      updated_at = now();
  END IF;

  RETURN p_id;
END;
$$;

-- ============================================================
-- RPC : modération photos (copie baseline + récompense idempotente à l'approbation)
-- ============================================================
CREATE OR REPLACE FUNCTION public.moderate_submission(p_submission_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  text;
  v_rewarded timestamptz;
  v_reward   int;
  v_count    int;
BEGIN
  UPDATE hub_photo_submissions
  SET status = p_status, moderated_at = NOW()
  WHERE id = p_submission_id
  RETURNING user_id, rewarded_at INTO v_user_id, v_rewarded;

  IF p_status = 'approved' AND v_rewarded IS NULL AND v_user_id IS NOT NULL THEN
    SELECT COALESCE(value::int, 0) INTO v_reward FROM app_settings WHERE key = 'ugc_reward_crowns';

    -- Bonus "première contribution" : pour TOUT compte (neuf ou client existant) dont c'est
    -- la 1re contribution validée (contributions_count encore à 0 avant l'incrément ci-dessous).
    SELECT contributions_count INTO v_count FROM users WHERE id = v_user_id;
    IF COALESCE(v_count, 0) = 0 THEN
      v_reward := v_reward + COALESCE((SELECT value::int FROM app_settings WHERE key = 'ugc_first_contribution_crowns'), 0);
    END IF;

    IF v_reward > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_user_id, LEAST(500, v_reward), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + v_reward),
        updated_at = now();
    END IF;
    UPDATE users SET contributions_count = contributions_count + 1 WHERE id = v_user_id;
    UPDATE hub_photo_submissions SET rewarded_at = now() WHERE id = p_submission_id;
    INSERT INTO notifications (recipient_id, type, data)
    VALUES (v_user_id, 'contribution_approved',
            jsonb_build_object('kind','photo','submission_id',p_submission_id,'crowns',v_reward));
  END IF;
END;
$$;

-- ============================================================
-- RPC : modération avis (copie baseline + même récompense idempotente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.moderate_review(p_review_id uuid, p_status text, p_rejection_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  text;
  v_rewarded timestamptz;
  v_reward   int;
  v_count    int;
BEGIN
  UPDATE hub_review_submissions
  SET status = p_status, moderated_at = NOW(), rejection_reason = p_rejection_reason
  WHERE id = p_review_id
  RETURNING user_id, rewarded_at INTO v_user_id, v_rewarded;

  IF p_status = 'approved' AND v_rewarded IS NULL AND v_user_id IS NOT NULL THEN
    SELECT COALESCE(value::int, 0) INTO v_reward FROM app_settings WHERE key = 'ugc_reward_crowns';

    -- Bonus "première contribution" : pour TOUT compte (neuf ou client existant) dont c'est
    -- la 1re contribution validée (contributions_count encore à 0 avant l'incrément ci-dessous).
    SELECT contributions_count INTO v_count FROM users WHERE id = v_user_id;
    IF COALESCE(v_count, 0) = 0 THEN
      v_reward := v_reward + COALESCE((SELECT value::int FROM app_settings WHERE key = 'ugc_first_contribution_crowns'), 0);
    END IF;

    IF v_reward > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_user_id, LEAST(500, v_reward), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + v_reward),
        updated_at = now();
    END IF;
    UPDATE users SET contributions_count = contributions_count + 1 WHERE id = v_user_id;
    UPDATE hub_review_submissions SET rewarded_at = now() WHERE id = p_review_id;
    INSERT INTO notifications (recipient_id, type, data)
    VALUES (v_user_id, 'contribution_approved',
            jsonb_build_object('kind','review','submission_id',p_review_id,'crowns',v_reward));
  END IF;
END;
$$;

-- ============================================================
-- RPC publique : config récompense (lue par les formulaires pour afficher les vrais montants)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_ugc_reward_config()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'welcome_crowns', COALESCE((SELECT value::int FROM app_settings WHERE key = 'ugc_welcome_crowns'), 0),
    'reward_crowns',  COALESCE((SELECT value::int FROM app_settings WHERE key = 'ugc_reward_crowns'), 0)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_ugc_reward_config() TO anon, authenticated, service_role;

-- ============================================================
-- TRIGGER EMAIL (miroir du trigger push mig 142, canal indépendant)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_email_on_notification()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT value INTO v_url    FROM public.app_settings WHERE key = 'edge_function_send_email_url';
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'email_trigger_secret';

  IF v_url IS NULL OR v_secret IS NULL OR v_url LIKE 'PLACEHOLDER%' OR v_secret LIKE 'PLACEHOLDER%' THEN
    RAISE WARNING 'email trigger: config missing or placeholder, skipping email for notification %', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json','X-Email-Secret',v_secret),
    body    := jsonb_build_object('notification_id',NEW.id,'recipient_id',NEW.recipient_id,'type',NEW.type,'data',NEW.data)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_on_notification ON public.notifications;
CREATE TRIGGER email_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_email_on_notification();
