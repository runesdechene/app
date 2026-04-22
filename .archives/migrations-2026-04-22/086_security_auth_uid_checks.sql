-- ============================================
-- MIGRATION 086 : Security — auth.uid() checks + policy restrictions
-- ============================================
-- Phase 4 audit pré-lancement (2026-04-15).
--
-- Corrige 4 findings CRITIQUES de l'audit sécurité :
--
-- C3 set_user_faction : accepte p_user_id non validé → user X peut
--    changer la faction de user Y (escalation trivial)
-- C4 update_my_profile : idem, usurpation de profil (bio, instagram, nom)
-- C5 app_settings : policy USING (true) → tout user authenticated peut
--    modifier les settings de gameplay (influence_max, enigma_rewards, etc.)
-- C6 users.instagram : policy UPDATE USING (true) ouverte à anon + auth →
--    vandalisme trivial (n'importe qui injecte un lien dans le profil de n'importe qui)
--
-- Bonus (cleanup) :
-- - Drop 2 overloads morts de update_my_profile (pas appelés par le frontend)
-- - Drop claim_place (V0.5 : système Influence a remplacé Claim, 0 appel frontend,
--   déjà absent de prod via query pg_proc 2026-04-15, safe redundant drop)
-- ============================================

BEGIN;

-- ============================================
-- 1. Cleanup : overloads morts de update_my_profile
-- ============================================
-- Les 3-arg et 4-arg ne sont plus appelés (frontend utilise le 6-arg uniquement).
DROP FUNCTION IF EXISTS public.update_my_profile(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_my_profile(TEXT, TEXT, TEXT, TEXT);

-- ============================================
-- 2. Cleanup : claim_place (mort V0.5)
-- ============================================
-- Redondant (déjà absent prod) mais idempotent pour tracer l'intention.
DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC);

-- ============================================
-- 3. C3 — set_user_faction : garde auth.uid()
-- ============================================
CREATE OR REPLACE FUNCTION public.set_user_faction(
  p_user_id TEXT,
  p_faction_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_faction_id TEXT;
  v_last_change TIMESTAMPTZ;
  v_cooldown_days INT;
  v_days_remaining INT;
BEGIN
  -- GARDE SÉCURITÉ : un user ne peut changer QUE sa propre faction
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Vérifier que la faction existe (ou null pour quitter)
  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'faction_not_found');
    END IF;
  END IF;

  -- Récupérer l'ancienne faction + date du dernier changement
  SELECT faction_id, faction_changed_at
  INTO v_old_faction_id, v_last_change
  FROM users WHERE id = p_user_id;

  -- Cooldown configurable (défaut 30 jours)
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'faction_change_cooldown_days'), 30)
  INTO v_cooldown_days;

  -- Si CHANGEMENT de faction (avait une, passe à une autre)
  IF v_old_faction_id IS NOT NULL
     AND p_faction_id IS NOT NULL
     AND v_old_faction_id != p_faction_id THEN

    -- Vérifier le cooldown
    IF v_last_change IS NOT NULL AND (NOW() - v_last_change) < (v_cooldown_days || ' days')::INTERVAL THEN
      v_days_remaining := v_cooldown_days - EXTRACT(DAY FROM (NOW() - v_last_change))::INT;
      RETURN json_build_object('error', 'cooldown', 'daysRemaining', GREATEST(1, v_days_remaining));
    END IF;

    -- Solidifier : tous les lieux de l'ancienne faction deviennent des découvertes
    INSERT INTO places_discovered (user_id, place_id, method)
    SELECT p_user_id, p.id, 'remote'
    FROM places p
    WHERE p.faction_id = v_old_faction_id
    ON CONFLICT (user_id, place_id) DO NOTHING;

    -- Retirer les titres de l'ancienne faction des titres affichés
    UPDATE users
    SET faction_id = p_faction_id,
        faction_changed_at = NOW(),
        displayed_title_ids_v3 = (
          SELECT COALESCE(array_agg(tid), '{}')
          FROM unnest(displayed_title_ids_v3) AS tid
          WHERE tid < 0  -- Mots de fragments → garder
            OR NOT EXISTS (SELECT 1 FROM titles t WHERE t.id = tid AND t.type = 'faction' AND t.faction_id = v_old_faction_id)
        ),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN json_build_object('success', true);
  ELSE
    -- Premier join ou départ → pas de cooldown
    UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;
    RETURN json_build_object('success', true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_faction(TEXT, TEXT) TO authenticated;

-- ============================================
-- 4. C4 — update_my_profile : garde auth.uid() sur la version 6-arg
-- ============================================
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_user_id TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_instagram TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_game_mode TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_name TEXT;
BEGIN
  -- GARDE SÉCURITÉ : un user ne peut modifier QUE son propre profil
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT first_name INTO v_old_name FROM users WHERE id = p_user_id;

  UPDATE users
  SET first_name  = COALESCE(p_first_name, first_name),
      bio         = COALESCE(p_bio, bio),
      instagram   = COALESCE(p_instagram, instagram),
      avatar_url  = COALESCE(p_avatar_url, avatar_url),
      game_mode   = COALESCE(p_game_mode, game_mode),
      updated_at  = NOW()
  WHERE id = p_user_id;

  -- Premier onboarding : notifier les autres joueurs avec le vrai nom
  IF v_old_name IS NULL AND p_first_name IS NOT NULL THEN
    INSERT INTO activity_log (type, actor_id, data)
    VALUES (
      'new_user',
      p_user_id,
      jsonb_build_object('actorName', p_first_name)
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================
-- 5. C5 — app_settings : write restreint aux admins
-- ============================================
-- Lecture reste publique (gameplay settings lus par tous).
-- Écriture réservée aux users avec role = 'admin'.
DROP POLICY IF EXISTS "app_settings_write" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_admin_write" ON public.app_settings;

CREATE POLICY "app_settings_admin_write"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::text AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::text AND role = 'admin'
  ));

-- ============================================
-- 6. C6 — users.instagram : drop policy publique
-- ============================================
-- La modification du profil passe maintenant exclusivement par update_my_profile
-- (qui vérifie auth.uid()). Pas besoin d'une policy UPDATE ouverte sur users.
DROP POLICY IF EXISTS "Public can update user instagram" ON public.users;

COMMIT;

-- ============================================
-- SMOKE TEST post-apply (à lancer manuellement par Uriel)
-- ============================================
-- 1. Login comme user A, tenter set_user_faction avec p_user_id = <id de user B>
--    → doit retourner {"error": "unauthorized"}
-- 2. Login comme user A, tenter update_my_profile avec p_user_id = <id de user B>
--    → doit retourner {"error": "unauthorized"}
-- 3. Login comme user NON-admin, tenter INSERT/UPDATE sur app_settings
--    → doit échouer (policy violation)
-- 4. Vérifier que l'app fonctionne normalement pour un user sur son propre profil :
--    - Onboarding (OnboardingModal.tsx) → doit passer
--    - Édition profil (PlayerProfileModal.tsx) → doit passer
--    - Changement faction (FactionModal.tsx) → doit passer si cooldown OK
