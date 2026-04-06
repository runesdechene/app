-- ============================================
-- MIGRATION 088 : Votes territoire — faction + stacking
-- ============================================
-- Changements :
-- 1. Tout membre de la faction peut voter (1 vote de base), plus +1 par lieu revendique.
--    Avant : seuls les joueurs ayant revendique des lieux pouvaient voter (vote power = claimed count).
-- 2. On peut empiler plusieurs votes sur une seule proposition (value peut etre > 1 ou < -1).
--    Avant : value etait contraint a 1 ou -1.
-- 3. usedVotes = SUM(ABS(value)) au lieu de COUNT(*).
-- ============================================


-- ============================================
-- 1. Relacher la contrainte value IN (1, -1) → value != 0
-- ============================================

ALTER TABLE territory_name_votes DROP CONSTRAINT IF EXISTS territory_name_votes_value_check;
ALTER TABLE territory_name_votes ADD CONSTRAINT territory_name_votes_value_check CHECK (value != 0);


-- ============================================
-- 2. get_territory_votes — eligibilite par faction + usedVotes par somme
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
    -- Lieux revendiques dans le blob
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

  -- Votes utilises = SUM(ABS(value)) au lieu de COUNT(*)
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


-- ============================================
-- 3. propose_territory_name — eligibilite par faction
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
  v_user_faction TEXT;
  v_territory_faction TEXT;
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

  -- Eligibilite par faction
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  LIMIT 1;

  IF v_user_faction IS NULL OR v_user_faction != v_territory_faction THEN
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
-- 4. vote_territory_name — stacking + validation
-- ============================================

CREATE OR REPLACE FUNCTION public.vote_territory_name(
  p_user_id         TEXT,
  p_proposal_id     UUID,
  p_value           SMALLINT,       -- valeur totale souhaitee (>0, <0, ou 0 pour annuler)
  p_blob_place_ids  TEXT[],
  p_anchor_place_id TEXT
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_faction    TEXT;
  v_territory_faction TEXT;
  v_claimed_count   INT;
  v_vote_power      INT;
  v_total_used      INT;
  v_winning         TEXT;
  v_tied            BOOLEAN;
  v_net             INT;
BEGIN
  -- Eligibilite par faction
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

  SELECT faction_id INTO v_territory_faction
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND faction_id IS NOT NULL
  LIMIT 1;

  IF v_user_faction IS NULL OR v_user_faction != v_territory_faction THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Vote power = 1 (base faction) + lieux revendiques
  SELECT COUNT(*) INTO v_claimed_count
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  v_vote_power := 1 + v_claimed_count;

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

  -- Valider que le total utilise ne depasse pas le vote power
  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_total_used
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  IF v_total_used > v_vote_power THEN
    -- Rollback : remettre l'ancien vote ou supprimer
    -- On supprime le vote qu'on vient de mettre pour revenir a l'etat precedent
    DELETE FROM territory_name_votes
    WHERE proposal_id = p_proposal_id AND voter_id = p_user_id;

    RETURN json_build_object('error', 'not_enough_votes', 'votePower', v_vote_power, 'usedVotes', v_total_used - ABS(p_value));
  END IF;

  -- Recalculer le gagnant pour ce territoire
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
