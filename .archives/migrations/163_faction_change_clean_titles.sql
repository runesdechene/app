-- ============================================
-- MIGRATION 163 : Nettoyer les titres au changement d'héritage
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
  v_old_notoriety INT;
  v_new_notoriety INT;
  v_notoriety_lost INT;
BEGIN
  -- Verifier que la faction existe (ou null pour quitter)
  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'Faction not found');
    END IF;
  END IF;

  -- Recuperer l'ancienne faction + notoriete actuelle
  SELECT faction_id, COALESCE(notoriety_points, 0)
  INTO v_old_faction_id, v_old_notoriety
  FROM users WHERE id = p_user_id;

  -- Solidifier : tous les lieux de l'ancienne faction deviennent des decouvertes
  IF v_old_faction_id IS NOT NULL THEN
    INSERT INTO places_discovered (user_id, place_id, method)
    SELECT p_user_id, p.id, 'remote'
    FROM places p
    WHERE p.faction_id = v_old_faction_id
    ON CONFLICT (user_id, place_id) DO NOTHING;
  END IF;

  -- Si CHANGEMENT de faction → diviser notoriete par 2 + nettoyer titres
  IF v_old_faction_id IS NOT NULL
     AND p_faction_id IS NOT NULL
     AND v_old_faction_id != p_faction_id THEN

    v_new_notoriety := FLOOR(v_old_notoriety / 2);
    v_notoriety_lost := v_old_notoriety - v_new_notoriety;

    -- Retirer les titres de l'ancienne faction des titres affichés
    UPDATE users
    SET faction_id = p_faction_id,
        notoriety_points = v_new_notoriety,
        displayed_title_ids_v3 = (
          SELECT COALESCE(array_agg(tid), '{}')
          FROM unnest(displayed_title_ids_v3) AS tid
          WHERE tid < 0  -- Mots de fragments → garder
            OR NOT EXISTS (SELECT 1 FROM titles t WHERE t.id = tid AND t.type = 'faction' AND t.faction_id = v_old_faction_id)
        ),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN json_build_object('success', true, 'notorietyLost', v_notoriety_lost, 'notorietyPoints', v_new_notoriety);
  ELSE
    -- Premier join ou depart → pas de cout
    UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'notorietyLost', 0);
  END IF;
END;
$$;
