-- ============================================
-- MIGRATION 080 : Vote de Noms de Territoires
-- ============================================
-- Remplace le systeme "top contributeur nomme" par un vote democratique.
-- Tout joueur ayant >= 1 lieu revendique dans un blob peut proposer un nom
-- et voter. Pouvoir de vote = nombre de lieux revendiques dans le blob.
-- ============================================


-- ============================================
-- 1. DROP ANCIEN SYSTEME
-- ============================================

DROP TABLE IF EXISTS territory_names CASCADE;
DROP FUNCTION IF EXISTS public.name_territory;


-- ============================================
-- 2. NOUVELLES TABLES
-- ============================================

CREATE TABLE territory_name_proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_place_id VARCHAR(255) NOT NULL,
  proposed_by     VARCHAR(255) NOT NULL REFERENCES users(id),
  name            VARCHAR(50)  NOT NULL CHECK (length(trim(name)) >= 3),
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (anchor_place_id, proposed_by, name)
);

CREATE INDEX idx_proposals_anchor ON territory_name_proposals(anchor_place_id);

CREATE TABLE territory_name_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID         NOT NULL REFERENCES territory_name_proposals(id) ON DELETE CASCADE,
  voter_id    VARCHAR(255) NOT NULL REFERENCES users(id),
  value       SMALLINT     NOT NULL CHECK (value IN (1, -1)),
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (proposal_id, voter_id)
);

CREATE INDEX idx_votes_proposal ON territory_name_votes(proposal_id);


-- ============================================
-- 3. RLS
-- ============================================

ALTER TABLE territory_name_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_name_votes ENABLE ROW LEVEL SECURITY;

-- Proposals: lecture publique, insertion par le proposeur
CREATE POLICY "proposals_select" ON territory_name_proposals FOR SELECT USING (true);
CREATE POLICY "proposals_insert" ON territory_name_proposals FOR INSERT WITH CHECK (proposed_by = auth.uid()::text);

-- Votes: lecture publique, insert/update/delete par le voteur
CREATE POLICY "votes_select" ON territory_name_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON territory_name_votes FOR INSERT WITH CHECK (voter_id = auth.uid()::text);
CREATE POLICY "votes_update" ON territory_name_votes FOR UPDATE USING (voter_id = auth.uid()::text);
CREATE POLICY "votes_delete" ON territory_name_votes FOR DELETE USING (voter_id = auth.uid()::text);


-- ============================================
-- 4. RPC: get_winning_territory_names()
-- ============================================
-- Retourne le nom gagnant par territoire (NULL si ex-aequo ou aucune proposition)

CREATE OR REPLACE FUNCTION public.get_winning_territory_names()
RETURNS TABLE(anchor_place_id TEXT, winning_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH scores AS (
    SELECT
      p.anchor_place_id,
      p.name,
      COALESCE(SUM(v.value), 0) AS net_score
    FROM territory_name_proposals p
    LEFT JOIN territory_name_votes v ON v.proposal_id = p.id
    GROUP BY p.anchor_place_id, p.id, p.name
  ),
  ranked AS (
    SELECT
      anchor_place_id,
      name,
      net_score,
      RANK() OVER (PARTITION BY anchor_place_id ORDER BY net_score DESC) AS rnk
    FROM scores
  ),
  top_ranked AS (
    SELECT
      anchor_place_id,
      name,
      COUNT(*) OVER (PARTITION BY anchor_place_id) AS tied_count
    FROM ranked
    WHERE rnk = 1
  )
  SELECT
    anchor_place_id,
    CASE WHEN tied_count > 1 THEN NULL ELSE name END AS winning_name
  FROM top_ranked
  GROUP BY anchor_place_id, tied_count, name;
$$;


-- ============================================
-- 5. RPC: get_territory_votes(p_anchor, p_user, p_blob_ids)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id TEXT,
  p_user_id         TEXT,
  p_blob_place_ids  TEXT[]
)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_vote_power      INT;
  v_proposals       JSON;
  v_used_votes      INT;
  v_proposals_count INT;
BEGIN
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

  -- Votes utilises = nombre de lignes de vote du joueur pour ce territoire
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
-- 6. RPC: propose_territory_name(...)
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

  -- Blocklist (insensible a la casse)
  FOREACH v_word IN ARRAY v_insults LOOP
    IF lower(v_trimmed) LIKE '%' || v_word || '%' THEN
      RETURN json_build_object('error', 'inappropriate');
    END IF;
  END LOOP;

  -- Eligibilite : au moins 1 lieu revendique dans le blob
  SELECT COUNT(*) INTO v_power
  FROM places
  WHERE id = ANY(p_blob_place_ids) AND claimed_by = p_user_id;

  IF v_power < 1 THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

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
-- 7. RPC: vote_territory_name(...)
-- ============================================

CREATE OR REPLACE FUNCTION public.vote_territory_name(
  p_user_id         TEXT,
  p_proposal_id     UUID,
  p_value           SMALLINT,       -- 1, -1, ou 0 pour annuler
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

  -- Upsert ou suppression du vote
  IF p_value = 0 THEN
    DELETE FROM territory_name_votes
    WHERE proposal_id = p_proposal_id AND voter_id = p_user_id;
  ELSE
    INSERT INTO territory_name_votes (proposal_id, voter_id, value)
    VALUES (p_proposal_id, p_user_id, p_value)
    ON CONFLICT (proposal_id, voter_id) DO UPDATE SET value = EXCLUDED.value;
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
