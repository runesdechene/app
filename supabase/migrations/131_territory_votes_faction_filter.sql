-- ============================================
-- MIGRATION 131 : Filtrer les votes par faction active
-- ============================================
-- Les votes des joueurs qui ne sont plus de la meme faction que le territoire
-- ne comptent plus dans le score. Les propositions de joueurs d'autres factions
-- sont aussi ignorees.

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Faction du user
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  -- Faction du territoire (la plus representee dans le blob)
  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  GROUP BY faction_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Eligibilite : meme faction = 1 vote de base + lieux claimed, sinon 0
  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    SELECT COUNT(*) INTO v_claimed_count
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

    v_vote_power := 1 + v_claimed_count;
  ELSE
    v_vote_power := 0;
  END IF;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions avec score net (SEULEMENT les votes de la faction du territoire)
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value) FILTER (WHERE u_voter.faction_id = v_territory_faction), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END),
        'isOrphan',   (u_proposer.faction_id IS DISTINCT FROM v_territory_faction),
        'voters',     COALESCE(
          (SELECT json_agg(json_build_object('name', COALESCE(u.first_name, u.email_address), 'value', v2.value) ORDER BY ABS(v2.value) DESC)
           FROM territory_name_votes v2
           JOIN users u ON u.id = v2.voter_id
           WHERE v2.proposal_id = p.id AND u.faction_id = v_territory_faction),
          '[]'::json
        )
      ) AS row_data,
      COALESCE(SUM(v.value) FILTER (WHERE u_voter.faction_id = v_territory_faction), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    LEFT JOIN users u_voter ON u_voter.id = v.voter_id
    JOIN users u_proposer ON u_proposer.id = p.proposed_by
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at, u_proposer.faction_id
  ) sub;

  -- Votes utilises (seulement ceux qui comptent = meme faction)
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',      v_vote_power,
    'usedVotes',      v_used_votes,
    'proposalsCount', v_proposals_count,
    'proposals',      COALESCE(v_proposals, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_territory_votes(TEXT, TEXT, TEXT[]) TO authenticated;

-- Fix propose_territory_name : meme bug, faction determinee par un seul lieu au hasard
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

  -- Faction du joueur
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;

  -- Faction du territoire (la plus representee dans le blob)
  IF array_length(p_blob_place_ids, 1) > 0 THEN
    SELECT faction_id INTO v_place_faction
    FROM places
    WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
    GROUP BY faction_id
    ORDER BY COUNT(*) DESC
    LIMIT 1;
  ELSE
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_anchor_place_id;
  END IF;

  IF v_faction_id IS NULL OR v_faction_id != v_place_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers le nouvel anchor si necessaire
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

GRANT EXECUTE ON FUNCTION public.propose_territory_name(TEXT, TEXT, TEXT, TEXT[]) TO authenticated;
