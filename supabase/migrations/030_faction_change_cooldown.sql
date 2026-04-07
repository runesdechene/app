-- 030_faction_change_cooldown.sql
-- Changement de faction : plus de taxe en gloire, cooldown de 30 jours à la place.

-- 1. Ajouter la colonne de tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS faction_changed_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Réécrire set_user_faction
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

GRANT EXECUTE ON FUNCTION public.set_user_faction TO authenticated;

-- 3. Ajouter le setting par défaut
INSERT INTO app_settings (key, value) VALUES ('faction_change_cooldown_days', '30')
ON CONFLICT (key) DO NOTHING;
