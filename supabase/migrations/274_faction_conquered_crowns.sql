-- 274_faction_conquered_crowns.sql
-- WHY : tracer les Couronnes de conquête (investies sur des lieux sous la bannière
-- de la Compagnie), distinctes du `crowns_invested` du fondateur (avantage Chef).
-- get_faction_detail expose `totalCrowns` = somme (investies + conquises) des membres.
-- ADDITIF / sûr. (L'alimentation de crowns_conquered = mig 276, conquête à l'or.)

ALTER TABLE public.faction_members
  ADD COLUMN IF NOT EXISTS crowns_conquered int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_faction_detail(p_faction_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_members json; v_total int; v_f public.factions%ROWTYPE;
BEGIN
  SELECT * INTO v_f FROM factions WHERE id = p_faction_id;
  IF v_f.id IS NULL THEN RETURN json_build_object('error','not_found'); END IF;

  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;

  SELECT COALESCE(json_agg(row_to_json(r) ORDER BY (r."coupe" + r."crownsInvested") DESC, r."joinedAt" ASC), '[]'::json)
  INTO v_members
  FROM (
    SELECT m.user_id AS "userId",
           COALESCE(u.display_name, u.first_name, 'Veilleur') AS name,
           u.avatar_url AS "avatarUrl",
           m.joined_at AS "joinedAt",
           m.is_founder AS "isFounder",
           m.crowns_invested AS "crownsInvested",
           public._user_coupe_score(m.user_id, v_from, v_to) AS coupe
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id
  ) r;

  SELECT COALESCE(sum(public._user_coupe_score(u.id, v_from, v_to)), 0)::int INTO v_total
  FROM users u WHERE u.faction_id = p_faction_id;

  RETURN json_build_object(
    'id', v_f.id, 'name', v_f.title, 'color', v_f.color, 'imageUrl', v_f.image_url,
    'description', v_f.description,
    'createdBy', v_f.created_by,
    'isOfficial', (v_f.created_by IS NULL),
    'memberCount', (SELECT count(*) FROM faction_members WHERE faction_id = p_faction_id),
    'totalCoupe', v_total,
    'totalCrowns', (SELECT COALESCE(sum(crowns_invested + crowns_conquered), 0)
                    FROM faction_members WHERE faction_id = p_faction_id),
    'members', v_members
  );
END;$$;
