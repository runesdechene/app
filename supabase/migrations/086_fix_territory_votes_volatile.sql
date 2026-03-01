-- ============================================
-- MIGRATION 086 : Fix get_territory_votes — retirer STABLE pour permettre UPDATE
-- ============================================
-- La 085 marquait get_territory_votes comme STABLE mais elle fait un UPDATE.
-- PostgreSQL interdit les ecritures dans les fonctions STABLE.
-- On re-declare sans STABLE (= VOLATILE par defaut).
-- ============================================

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
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

  -- Pouvoir de vote = lieux revendiques dans le blob
  SELECT COUNT(*) INTO v_vote_power
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  -- Nombre de propositions du joueur pour ce territoire
  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  -- Liste des propositions avec score net et vote du joueur
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END)
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  -- Votes utilises
  SELECT COUNT(*) INTO v_used_votes
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
