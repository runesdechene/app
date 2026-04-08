-- 068_notif_milestone_vues.sql
-- Trigger on places_viewed INSERT to check milestone_vues (10, 50, 100, 500)

CREATE OR REPLACE FUNCTION check_milestone_vues()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_view_count INT;
  v_author_id TEXT;
  v_guardian_id TEXT;
  v_carnet_author RECORD;
  v_notif_data JSONB;
BEGIN
  -- Count total views for this place
  SELECT COUNT(*) INTO v_view_count
  FROM places_viewed WHERE place_id = NEW.place_id;

  -- Only fire on milestone thresholds
  IF v_view_count NOT IN (10, 50, 100, 500) THEN
    RETURN NEW;
  END IF;

  v_notif_data := jsonb_build_object('placeId', NEW.place_id, 'viewCount', v_view_count);

  -- Decouvreur
  SELECT author_id INTO v_author_id FROM places WHERE id = NEW.place_id;
  IF v_author_id IS NOT NULL THEN
    PERFORM notify(v_author_id, 'milestone_vues', v_notif_data);
  END IF;

  -- Gardien
  v_guardian_id := get_place_guardian(NEW.place_id);
  IF v_guardian_id IS NOT NULL AND v_guardian_id != COALESCE(v_author_id, '') THEN
    PERFORM notify(v_guardian_id, 'milestone_vues', v_notif_data);
  END IF;

  -- Auteurs de recits (sauf decouvreur et gardien deja notifies)
  FOR v_carnet_author IN
    SELECT DISTINCT user_id FROM place_contributions
    WHERE place_id = NEW.place_id AND type = 'carnet'
      AND user_id != COALESCE(v_author_id, '')
      AND user_id != COALESCE(v_guardian_id, '')
  LOOP
    PERFORM notify(v_carnet_author.user_id, 'milestone_vues', v_notif_data);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_milestone_vues ON places_viewed;
CREATE TRIGGER trg_milestone_vues
  AFTER INSERT ON places_viewed
  FOR EACH ROW
  EXECUTE FUNCTION check_milestone_vues();
