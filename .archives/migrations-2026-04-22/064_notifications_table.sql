-- 064_notifications_table.sql
-- Notifications persistantes : table, RLS, helpers

-- Table
CREATE TABLE notifications (
  id           SERIAL PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES users(id),
  type         TEXT NOT NULL,
  data         JSONB NOT NULL DEFAULT '{}',
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications (recipient_id, created_at DESC);

-- RLS : joueur ne voit/modifie que ses propres notifs
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (recipient_id = auth.uid()::TEXT);
CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (recipient_id = auth.uid()::TEXT);

-- Helper : inserer une notif + purger au-dela de 50
CREATE OR REPLACE FUNCTION notify(p_recipient TEXT, p_type TEXT, p_data JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ne pas notifier soi-meme
  IF p_recipient IS NULL THEN RETURN; END IF;

  INSERT INTO notifications (recipient_id, type, data)
  VALUES (p_recipient, p_type, p_data);

  DELETE FROM notifications WHERE id IN (
    SELECT id FROM notifications WHERE recipient_id = p_recipient
    ORDER BY created_at DESC OFFSET 50
  );
END;
$$;

-- Helper : trouver le gardien d'un lieu (auteur du carnet top 1 par votes_up)
CREATE OR REPLACE FUNCTION get_place_guardian(p_place_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_guardian TEXT;
BEGIN
  SELECT user_id INTO v_guardian
  FROM place_contributions
  WHERE place_id = p_place_id AND type = 'carnet'
  ORDER BY votes_up DESC, created_at ASC
  LIMIT 1;
  RETURN v_guardian;
END;
$$;

-- Helper : upsert exploration notif (groupement journalier)
CREATE OR REPLACE FUNCTION notify_exploration(p_recipient TEXT, p_place_id TEXT, p_visitor_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id INT;
  v_current_count INT;
BEGIN
  IF p_recipient IS NULL THEN RETURN; END IF;

  -- Chercher une notif exploration non lue pour ce lieu aujourd'hui
  SELECT id, COALESCE((data->>'visitorsToday')::INT, 1)
  INTO v_existing_id, v_current_count
  FROM notifications
  WHERE recipient_id = p_recipient
    AND type = 'exploration'
    AND (data->>'placeId') = p_place_id
    AND read = FALSE
    AND created_at::DATE = CURRENT_DATE
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Upsert : incrementer le compteur
    UPDATE notifications
    SET data = data || jsonb_build_object(
      'visitorsToday', v_current_count + 1,
      'lastVisitorName', p_visitor_name
    ),
    created_at = NOW()
    WHERE id = v_existing_id;
  ELSE
    PERFORM notify(p_recipient, 'exploration', jsonb_build_object(
      'placeId', p_place_id,
      'visitorsToday', 1,
      'lastVisitorName', p_visitor_name
    ));
  END IF;
END;
$$;
