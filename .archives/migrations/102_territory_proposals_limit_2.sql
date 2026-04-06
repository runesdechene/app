-- Reduce max proposals per player per territory from 3 to 2
-- Also allow players to delete their own proposals

CREATE OR REPLACE FUNCTION public.propose_territory_name(
  p_user_id TEXT,
  p_anchor_place_id TEXT,
  p_name TEXT,
  p_blob_place_ids TEXT[] DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_trimmed TEXT;
  v_faction_id TEXT;
  v_place_faction TEXT;
BEGIN
  v_trimmed := trim(p_name);

  IF length(v_trimmed) < 3 OR length(v_trimmed) > 50 THEN
    RETURN json_build_object('error', 'invalid_length');
  END IF;

  -- Vérifier que le joueur appartient à la faction du territoire
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  SELECT faction_id INTO v_place_faction FROM places WHERE id = p_anchor_place_id;

  IF v_faction_id IS NULL OR v_faction_id != v_place_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers le nouvel anchor si nécessaire
  IF array_length(p_blob_place_ids, 1) > 0 THEN
    UPDATE territory_name_proposals
    SET anchor_place_id = p_anchor_place_id
    WHERE anchor_place_id = ANY(p_blob_place_ids)
      AND anchor_place_id != p_anchor_place_id;
  END IF;

  -- Rate limit : max 2 propositions par joueur par territoire
  SELECT COUNT(*) INTO v_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  IF v_count >= 2 THEN
    RETURN json_build_object('error', 'max_proposals');
  END IF;

  INSERT INTO territory_name_proposals (anchor_place_id, proposed_by, name)
  VALUES (p_anchor_place_id, p_user_id, v_trimmed);

  RETURN json_build_object('ok', true);
END;
$$;

-- Allow players to delete their own proposals
CREATE POLICY "proposals_delete" ON territory_name_proposals
  FOR DELETE USING (proposed_by = auth.uid()::text);
