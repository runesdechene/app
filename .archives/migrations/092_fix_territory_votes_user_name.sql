-- ============================================
-- MIGRATION 092 : Fix u.name → first_name dans get_territory_votes
-- ============================================
-- Migration 089 utilisait u.name dans la sous-requete voters,
-- mais la table users n'a pas de colonne 'name'. Les colonnes
-- sont first_name et display_name. La fonction crashait a l'execution,
-- renvoyant null → votePower restait a 0 → UI "Rejoignez la faction...".
-- ============================================

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

  -- Faction du territoire (depuis n'importe quel lieu du blob)
  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  LIMIT 1;

  -- Eligibilite : meme faction = 1 vote de base, sinon 0
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

  -- Liste des propositions avec score net, vote du joueur, et liste des votants
  SELECT json_agg(row_data ORDER BY net_score DESC, created_at ASC) INTO v_proposals
  FROM (
    SELECT
      json_build_object(
        'id',         p.id,
        'name',       p.name,
        'proposedBy', p.proposed_by,
        'netScore',   COALESCE(SUM(v.value), 0),
        'myVote',     MAX(CASE WHEN v.voter_id = p_user_id THEN v.value ELSE NULL END),
        'voters',     COALESCE(
          (SELECT json_agg(json_build_object(
              'name', COALESCE(u.display_name, u.first_name, 'Inconnu'),
              'value', v2.value
            ) ORDER BY ABS(v2.value) DESC)
           FROM territory_name_votes v2
           JOIN users u ON u.id = v2.voter_id
           WHERE v2.proposal_id = p.id),
          '[]'::json
        )
      ) AS row_data,
      COALESCE(SUM(v.value), 0) AS net_score,
      p.created_at
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  -- Votes utilises = SUM(ABS(value))
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
