-- 279_coupe_member_gated_and_gold_attribution.sql
-- WHY : deux sources de vérité divergeaient. La Coupe (action + or) s'agrégeait sur
-- la BANNIÈRE active (users.faction_id), tandis que membres + couronnes investies
-- s'appuient sur faction_members. Un « straggler » (bannière active sans ligne de
-- membership, vestige reboot) injectait donc des points fantômes (cas Angelofsoul →
-- byzantine 9 au lieu de 5). On rend tout le score MEMBER-GATED : un joueur ne compte
-- pour une Compagnie que s'il en est membre. Et on attribue l'or de chaque membre dans
-- la liste pour que la somme des membres = total Compagnie. ADDITIF (CREATE OR REPLACE).

-- Or-Coupe d'UN membre pour une Compagnie (tranche + cap/jour)
CREATE OR REPLACE FUNCTION public._member_gold_coupe(
  p_user_id text, p_faction_id text, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL
) RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(
    LEAST(
      g.amount / GREATEST(public._barem('coupe.gold_per_tranche', 10), 1),
      public._barem('coupe.gold_daily_cap', 10)
    )
  ), 0)::int
  FROM public.faction_gold_log g
  WHERE g.user_id = p_user_id AND g.faction_id = p_faction_id
    AND (p_from IS NULL OR g.day >= p_from::date)
    AND (p_to   IS NULL OR g.day <= p_to::date);
$$;
GRANT EXECUTE ON FUNCTION public._member_gold_coupe(text,text,timestamptz,timestamptz) TO authenticated, anon, service_role;

-- Or-Coupe d'une Compagnie = somme sur ses MEMBRES seulement (member-gated)
CREATE OR REPLACE FUNCTION public._faction_gold_coupe(
  p_faction_id text, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL
) RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(
    LEAST(
      g.amount / GREATEST(public._barem('coupe.gold_per_tranche', 10), 1),
      public._barem('coupe.gold_daily_cap', 10)
    )
  ), 0)::int
  FROM public.faction_gold_log g
  JOIN public.faction_members fm
    ON fm.user_id = g.user_id AND fm.faction_id = g.faction_id
  WHERE g.faction_id = p_faction_id
    AND (p_from IS NULL OR g.day >= p_from::date)
    AND (p_to   IS NULL OR g.day <= p_to::date);
$$;

-- list_factions : action des MEMBRES (bannière active = cette Compagnie) + or-membres
CREATE OR REPLACE FUNCTION public.list_factions(p_search text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rows json; v_from timestamptz; v_to timestamptz;
BEGIN
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT f.id, f.title AS name, f.color, f.image_url AS "imageUrl", f.description,
           f.tags,
           (f.created_by IS NULL) AS "isOfficial",
           (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id) AS "memberCount",
           (COALESCE((SELECT sum(public._user_coupe_score(u.id, v_from, v_to))
                      FROM users u
                      WHERE u.faction_id = f.id
                        AND EXISTS (SELECT 1 FROM faction_members m2
                                    WHERE m2.user_id = u.id AND m2.faction_id = f.id)), 0)
            + public._faction_gold_coupe(f.id, v_from, v_to))::int AS "score"
    FROM factions f
    WHERE f.retired = false AND (p_search IS NULL OR f.title ILIKE '%' || p_search || '%')
    ORDER BY "score" DESC, "memberCount" DESC, f."order" ASC
    LIMIT 100
  ) t;
  RETURN v_rows;
END;$$;

-- get_faction_detail : coupe par membre = action (si bannière active = cette Compagnie) + or perso ;
-- totalCoupe = somme des membres → tout s'additionne dans la modale.
CREATE OR REPLACE FUNCTION public.get_faction_detail(p_faction_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_members json; v_total int; v_f public.factions%ROWTYPE;
BEGIN
  SELECT * INTO v_f FROM factions WHERE id = p_faction_id;
  IF v_f.id IS NULL THEN RETURN json_build_object('error','not_found'); END IF;

  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;

  WITH mem AS (
    SELECT m.user_id,
           COALESCE(u.display_name, u.first_name, 'Veilleur') AS name,
           u.avatar_url, m.joined_at, m.is_founder, m.crowns_invested,
           ( (CASE WHEN u.faction_id = p_faction_id
                   THEN public._user_coupe_score(m.user_id, v_from, v_to) ELSE 0 END)
             + public._member_gold_coupe(m.user_id, p_faction_id, v_from, v_to) ) AS coupe
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id
  )
  SELECT
    COALESCE(json_agg(json_build_object(
      'userId', user_id, 'name', name, 'avatarUrl', avatar_url,
      'joinedAt', joined_at, 'isFounder', is_founder,
      'crownsInvested', crowns_invested, 'coupe', coupe
    ) ORDER BY (coupe + crowns_invested) DESC, joined_at ASC), '[]'::json),
    COALESCE(sum(coupe), 0)::int
  INTO v_members, v_total
  FROM mem;

  RETURN json_build_object(
    'id', v_f.id, 'name', v_f.title, 'color', v_f.color, 'imageUrl', v_f.image_url,
    'description', v_f.description,
    'tags', to_json(v_f.tags),
    'createdBy', v_f.created_by,
    'isOfficial', (v_f.created_by IS NULL),
    'memberCount', (SELECT count(*) FROM faction_members WHERE faction_id = p_faction_id),
    'totalCoupe', v_total,
    'totalCrowns', (SELECT COALESCE(sum(crowns_invested + crowns_conquered), 0)
                    FROM faction_members WHERE faction_id = p_faction_id),
    'members', v_members
  );
END;$$;
