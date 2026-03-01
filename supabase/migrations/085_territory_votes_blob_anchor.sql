-- ============================================
-- MIGRATION 085 : Fix votes territoire — chercher par blob, pas par anchor
-- ============================================
-- Quand un blob fusionne, l'anchorPlaceId change. Les anciennes propositions
-- liees a l'ancien anchor ne sont plus trouvees.
-- On cherche maintenant les propositions dont anchor_place_id est dans le blob.
-- On migre aussi les anciennes propositions vers l'anchor actuel.
-- ============================================


-- ============================================
-- get_territory_votes : cherche dans tout le blob + migre l'anchor
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


-- ============================================
-- propose_territory_name : migre l'anchor avant d'inserer
-- ============================================

CREATE OR REPLACE FUNCTION public.propose_territory_name(
  p_user_id         TEXT,
  p_anchor_place_id TEXT,
  p_name            TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trimmed    TEXT := trim(p_name);
  v_power      INT;
  v_count      INT;
  v_insults    TEXT[] := ARRAY[
    'connard','merde','putain','salope','encule','enculé',
    'con','pute','bite','couille','nique','ntm','fdp','pd',
    'batard','bâtard','salaud','conne','petasse','pétasse',
    'bordel','chiasse','chier','branleur','branleuse','bouffon',
    'abruti','debile','débile','gogol','mongol','trisomique',
    'nazi','hitler','negre','nègre','bougnoule','arabe de merde',
    'sale juif','youpin','bamboula','macaque'
  ];
  v_word       TEXT;
BEGIN
  -- Validation longueur
  IF length(v_trimmed) < 3 OR length(v_trimmed) > 50 THEN
    RETURN json_build_object('error', 'invalid_length');
  END IF;

  -- Blocklist
  FOREACH v_word IN ARRAY v_insults LOOP
    IF lower(v_trimmed) LIKE '%' || v_word || '%' THEN
      RETURN json_build_object('error', 'inappropriate');
    END IF;
  END LOOP;

  -- Eligibilite
  SELECT COUNT(*) INTO v_power
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  IF v_power < 1 THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers l'anchor actuel
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Rate limit : max 3 propositions par joueur par territoire
  SELECT COUNT(*) INTO v_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

  IF v_count >= 3 THEN
    RETURN json_build_object('error', 'max_proposals');
  END IF;

  INSERT INTO territory_name_proposals (anchor_place_id, proposed_by, name)
  VALUES (p_anchor_place_id, p_user_id, v_trimmed);

  RETURN json_build_object('ok', true);
END;
$$;


-- ============================================
-- vote_territory_name : migre l'anchor avant de voter
-- ============================================

CREATE OR REPLACE FUNCTION public.vote_territory_name(
  p_user_id         TEXT,
  p_proposal_id     UUID,
  p_value           SMALLINT,
  p_blob_place_ids  TEXT[],
  p_anchor_place_id TEXT
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_power       INT;
  v_winning     TEXT;
  v_tied        BOOLEAN;
  v_net         INT;
BEGIN
  -- Eligibilite
  SELECT COUNT(*) INTO v_power
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  IF v_power < 1 THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Migrer les anciennes propositions vers l'anchor actuel
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  -- Upsert ou suppression du vote
  IF p_value = 0 THEN
    DELETE FROM territory_name_votes
    WHERE proposal_id = p_proposal_id AND voter_id = p_user_id;
  ELSE
    INSERT INTO territory_name_votes (proposal_id, voter_id, value)
    VALUES (p_proposal_id, p_user_id, p_value)
    ON CONFLICT (proposal_id, voter_id) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  -- Recalculer le gagnant
  WITH scores AS (
    SELECT p.name, COALESCE(SUM(v.value), 0) AS net_score
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    WHERE p.anchor_place_id = p_anchor_place_id
    GROUP BY p.id, p.name
    ORDER BY net_score DESC
  ),
  top_score AS (SELECT MAX(net_score) AS mx FROM scores),
  winners AS (SELECT name FROM scores, top_score WHERE net_score = mx)
  SELECT
    CASE WHEN (SELECT COUNT(*) FROM winners) > 1 THEN NULL
         ELSE (SELECT name FROM winners LIMIT 1) END,
    (SELECT COUNT(*) FROM winners) > 1
  INTO v_winning, v_tied;

  -- Score net de la proposition votee
  SELECT COALESCE(SUM(value), 0) INTO v_net
  FROM territory_name_votes WHERE proposal_id = p_proposal_id;

  RETURN json_build_object(
    'ok',          true,
    'winningName', v_winning,
    'isTie',       v_tied,
    'proposalNet', v_net
  );
END;
$$;


-- ============================================
-- get_winning_territory_names : inchange (pas de blob dispo ici)
-- La migration des anchors par get_territory_votes suffit
-- ============================================
