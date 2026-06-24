-- 277_faction_gold_conquest.sql
-- WHY : conquête à l'or (Task 5). Quand un joueur investit des Couronnes sur un
-- lieu (invest_crowns → INSERT place_court_action), l'or crédite SA Compagnie
-- active : (1) total « Couronnes investies » (faction_members.crowns_conquered),
-- (2) Coupe par tranche (1 Coupe / N🪙, plafonné/jour/membre).
-- On passe par un TRIGGER sur place_court_action pour ne pas réécrire le gros
-- invest_crowns. ADDITIF / sûr.

-- Réglages (tranche + cap journalier en Coupe/membre)
INSERT INTO public.app_settings(key, value)
  SELECT 'coupe.gold_per_tranche', '10'
  WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'coupe.gold_per_tranche');
INSERT INTO public.app_settings(key, value)
  SELECT 'coupe.gold_daily_cap', '10'
  WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'coupe.gold_daily_cap');

-- Journal daté de l'or investi par membre/Compagnie/jour (pour le cap journalier + la saison)
CREATE TABLE IF NOT EXISTS public.faction_gold_log (
  user_id    text    NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  faction_id varchar NOT NULL REFERENCES public.factions(id) ON DELETE CASCADE,
  day        date    NOT NULL DEFAULT current_date,
  amount     int     NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, faction_id, day)
);
CREATE INDEX IF NOT EXISTS faction_gold_log_faction_day_idx ON public.faction_gold_log(faction_id, day);

-- Trigger : à chaque action de Cour (invest_crowns), créditer la Compagnie active de l'investisseur.
CREATE OR REPLACE FUNCTION public._company_crowns_on_court_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_fac text;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN RETURN NEW; END IF;
  SELECT faction_id INTO v_fac FROM public.users WHERE id = NEW.user_id;
  IF v_fac IS NOT NULL THEN
    UPDATE public.faction_members
    SET crowns_conquered = crowns_conquered + NEW.amount
    WHERE user_id = NEW.user_id AND faction_id = v_fac;

    INSERT INTO public.faction_gold_log (user_id, faction_id, day, amount)
    VALUES (NEW.user_id, v_fac, current_date, NEW.amount)
    ON CONFLICT (user_id, faction_id, day)
      DO UPDATE SET amount = faction_gold_log.amount + EXCLUDED.amount;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS court_action_company_crowns ON public.place_court_action;
CREATE TRIGGER court_action_company_crowns
  AFTER INSERT ON public.place_court_action
  FOR EACH ROW EXECUTE FUNCTION public._company_crowns_on_court_action();

-- Coupe issue de l'or pour une Compagnie sur une fenêtre (tranche + cap/jour/membre)
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
  WHERE g.faction_id = p_faction_id
    AND (p_from IS NULL OR g.day >= p_from::date)
    AND (p_to   IS NULL OR g.day <= p_to::date);
$$;
GRANT EXECUTE ON FUNCTION public._faction_gold_coupe(text,timestamptz,timestamptz) TO authenticated, anon, service_role;

-- list_factions : score = Coupe membres + Coupe-or
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
                      FROM users u WHERE u.faction_id = f.id), 0)
            + public._faction_gold_coupe(f.id, v_from, v_to))::int AS "score"
    FROM factions f
    WHERE f.retired = false AND (p_search IS NULL OR f.title ILIKE '%' || p_search || '%')
    ORDER BY "score" DESC, "memberCount" DESC, f."order" ASC
    LIMIT 100
  ) t;
  RETURN v_rows;
END;$$;

-- get_faction_detail : totalCoupe inclut la Coupe-or
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
  v_total := v_total + public._faction_gold_coupe(p_faction_id, v_from, v_to);

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
