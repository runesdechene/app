-- 103_territory_votes_with_my_veilled.sql
-- WHY : pour permettre au TerritoryPanel d'afficher une pill "+1 voix" sur les
--       lieux que l'user veille (clarté pédagogique : montrer visuellement
--       quels lieux contribuent à son vote power), on étend `get_territory_votes`
--       pour retourner aussi la liste des place_ids du blob où l'user est
--       veilleur direct.
--
-- Verbatim mig 013 (V0.5 → V0.7) avec un seul ajout : v_my_veilled_place_ids
-- + champ `myVeilledPlaceIds` dans le JSON de retour.

CREATE OR REPLACE FUNCTION public.get_territory_votes(
  p_anchor_place_id text,
  p_user_id text,
  p_blob_place_ids text[]
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_faction         TEXT;
  v_territory_faction    TEXT;
  v_personal_inf         INT;
  v_threshold            INT;
  v_vote_power           INT;
  v_proposals            JSON;
  v_used_votes           INT;
  v_proposals_count      INT;
  v_my_veilled_place_ids TEXT[];
BEGIN
  -- Migrer les propositions avec un ancien anchor vers le nouvel anchor
  UPDATE territory_name_proposals
  SET anchor_place_id = p_anchor_place_id
  WHERE anchor_place_id = ANY(p_blob_place_ids)
    AND anchor_place_id != p_anchor_place_id;

  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  v_territory_faction := public._blob_dominant_faction(p_blob_place_ids);

  -- 1. Supprimer les votes de joueurs qui ne sont plus de la faction du territoire
  DELETE FROM territory_name_votes tv
  USING territory_name_proposals tp, users u
  WHERE tv.proposal_id = tp.id
    AND tp.anchor_place_id = p_anchor_place_id
    AND u.id = tv.voter_id
    AND (u.faction_id IS DISTINCT FROM v_territory_faction);

  -- 2. Supprimer les votes sur des propositions orphelines
  DELETE FROM territory_name_votes tv
  USING territory_name_proposals tp, users u_proposer
  WHERE tv.proposal_id = tp.id
    AND tp.anchor_place_id = p_anchor_place_id
    AND u_proposer.id = tp.proposed_by
    AND (u_proposer.faction_id IS DISTINCT FROM v_territory_faction);

  -- 3. Supprimer les propositions orphelines elles-mêmes
  DELETE FROM territory_name_proposals tp
  USING users u_proposer
  WHERE tp.anchor_place_id = p_anchor_place_id
    AND u_proposer.id = tp.proposed_by
    AND (u_proposer.faction_id IS DISTINCT FROM v_territory_faction);

  IF v_user_faction IS NOT NULL AND v_user_faction = v_territory_faction THEN
    v_personal_inf := public._user_blob_influence(p_user_id, p_blob_place_ids, v_territory_faction);
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'territory_vote_per_influence'), 1)
      INTO v_threshold;
    v_vote_power := 1 + (v_personal_inf / GREATEST(v_threshold, 1));
  ELSE
    v_vote_power := 0;
  END IF;

  -- V103 — liste des lieux du blob où l'user est veilleur direct (pour pill UI)
  SELECT COALESCE(array_agg(DISTINCT pv.place_id), '{}')
  INTO v_my_veilled_place_ids
  FROM place_veille pv
  JOIN expedition_members em ON em.expedition_id = pv.expedition_id
  WHERE pv.place_id = ANY(p_blob_place_ids)
    AND em.user_id = p_user_id
    AND pv.is_neutral = false;

  SELECT COUNT(*) INTO v_proposals_count
  FROM territory_name_proposals
  WHERE anchor_place_id = p_anchor_place_id AND proposed_by = p_user_id;

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
          (SELECT json_agg(json_build_object('name', COALESCE(u.first_name, u.email_address), 'value', v2.value) ORDER BY ABS(v2.value) DESC)
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
    JOIN users u_proposer ON u_proposer.id = p.proposed_by
    WHERE p.anchor_place_id = p_anchor_place_id
      AND u_proposer.faction_id = v_territory_faction
    GROUP BY p.id, p.name, p.proposed_by, p.created_at
  ) sub;

  SELECT COALESCE(SUM(ABS(tv.value)), 0) INTO v_used_votes
  FROM territory_name_votes tv
  JOIN territory_name_proposals tp ON tp.id = tv.proposal_id
  WHERE tp.anchor_place_id = p_anchor_place_id AND tv.voter_id = p_user_id;

  RETURN json_build_object(
    'votePower',         v_vote_power,
    'usedVotes',         v_used_votes,
    'proposalsCount',    v_proposals_count,
    'proposals',         COALESCE(v_proposals, '[]'::json),
    'personalInfluence', COALESCE(v_personal_inf, 0),
    'threshold',         COALESCE(v_threshold, 1),
    'myVeilledPlaceIds', COALESCE(v_my_veilled_place_ids, '{}'::text[])
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_territory_votes(text, text, text[]) TO anon, authenticated, service_role;
