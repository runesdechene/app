-- 183_community_quests.sql
-- Défi communautaire : objectif collectif à compteur PARTAGÉ global (cycle ~7j).
-- À l'atteinte de la cible, TOUS les contributeurs (>=1) sont récompensés (idempotent).
-- Auto-track via trigger AFTER INSERT ON places (filtré par place_type optionnel).

CREATE TABLE IF NOT EXISTS public.community_quests (
  id            text PRIMARY KEY,
  wording       text NOT NULL,
  icon          text NOT NULL DEFAULT '🏰',
  tracker_kind  text NOT NULL,
  place_type_filter text,
  target        integer NOT NULL CHECK (target > 0),
  current_count integer NOT NULL DEFAULT 0,
  starts_at     timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz,
  reward_xp       integer NOT NULL DEFAULT 0,
  reward_couronnes integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','active','reached','closed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_quest_contributions (
  quest_id    text NOT NULL REFERENCES public.community_quests(id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  count       integer NOT NULL DEFAULT 0,
  rewarded_at timestamptz,
  PRIMARY KEY (quest_id, user_id)
);

GRANT SELECT ON public.community_quests TO authenticated;
GRANT SELECT ON public.community_quest_contributions TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_community_quest(
  p_user_id text, p_tracker_kind text, p_place_type text, p_amount integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_q RECORD;
  v_contrib RECORD;
BEGIN
  IF p_user_id IS NULL OR p_amount <= 0 THEN RETURN; END IF;

  FOR v_q IN
    SELECT * FROM public.community_quests
     WHERE status = 'active'
       AND tracker_kind = p_tracker_kind
       AND (place_type_filter IS NULL OR place_type_filter = p_place_type)
       AND (ends_at IS NULL OR ends_at > now())
  LOOP
    INSERT INTO public.community_quest_contributions (quest_id, user_id, count)
      VALUES (v_q.id, p_user_id, p_amount)
      ON CONFLICT (quest_id, user_id)
      DO UPDATE SET count = public.community_quest_contributions.count + EXCLUDED.count;

    UPDATE public.community_quests
       SET current_count = current_count + p_amount
       WHERE id = v_q.id
       RETURNING * INTO v_q;

    IF v_q.current_count >= v_q.target AND v_q.status = 'active' THEN
      UPDATE public.community_quests SET status = 'reached' WHERE id = v_q.id;

      FOR v_contrib IN
        SELECT * FROM public.community_quest_contributions
         WHERE quest_id = v_q.id AND rewarded_at IS NULL
      LOOP
        IF v_q.reward_couronnes > 0 THEN
          INSERT INTO public.user_crowns (user_id, balance, updated_at)
            VALUES (v_contrib.user_id, LEAST(500, v_q.reward_couronnes), now())
            ON CONFLICT (user_id) DO UPDATE SET
              balance = LEAST(500, public.user_crowns.balance + v_q.reward_couronnes),
              updated_at = now();
        END IF;
        IF v_q.reward_xp > 0 THEN
          UPDATE public.users SET xp_total = xp_total + v_q.reward_xp
            WHERE id = v_contrib.user_id;
        END IF;
        UPDATE public.community_quest_contributions
           SET rewarded_at = now()
           WHERE quest_id = v_q.id AND user_id = v_contrib.user_id;
      END LOOP;
    END IF;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public._trg_community_quest_place_added()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.author_id IS NOT NULL THEN
    PERFORM public.increment_community_quest(NEW.author_id, 'place_added', NEW.place_type_id, 1);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_community_quest_place_added ON public.places;
CREATE TRIGGER trg_community_quest_place_added
  AFTER INSERT ON public.places
  FOR EACH ROW EXECUTE FUNCTION public._trg_community_quest_place_added();

CREATE OR REPLACE FUNCTION public.get_active_community_quest(p_user_id text)
  RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE WHEN q.id IS NULL THEN NULL ELSE json_build_object(
    'id', q.id, 'wording', q.wording, 'icon', q.icon,
    'target', q.target, 'current', q.current_count,
    'endsAt', q.ends_at,
    'reward', json_build_object('crowns', q.reward_couronnes, 'xp', q.reward_xp),
    'myContribution', COALESCE(c.count, 0)
  ) END
  FROM (SELECT * FROM public.community_quests WHERE status = 'active'
        ORDER BY starts_at DESC LIMIT 1) q
  LEFT JOIN public.community_quest_contributions c
    ON c.quest_id = q.id AND c.user_id = p_user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_active_community_quest(text) TO authenticated, service_role;
