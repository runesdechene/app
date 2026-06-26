-- 315_grade_promotion_herald.sql
-- WHY : « héraut de montée » — quand un membre monte en grade, un message est posté dans le chat de
-- sa Compagnie (auteur « Le Héraut »). Tous les grades SAUF le catch-all (Membre). Anti-spam : snapshot
-- quotidien (pg_cron), on annonce uniquement une AMÉLIORATION vs le dernier relevé (descentes silencieuses),
-- donc au plus 1 annonce/membre/jour ; re-monter après une descente ré-annonce (décision Uriel 26/06).
-- Backend pur (le message s'affiche dans le ChatPanel existant). ADDITIF.

ALTER TABLE public.faction_members ADD COLUMN IF NOT EXISTS last_heralded_grade int;

CREATE OR REPLACE FUNCTION public.herald_grade_promotions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v_label text;
BEGIN
  FOR r IN
    SELECT m.user_id, m.faction_id, m.last_heralded_grade AS prev,
           public._member_grade_rank(m.user_id, m.faction_id) AS cur,
           COALESCE(u.display_name, u.first_name, 'Quelqu''un') AS name,
           COALESCE(u.title_gender, 'm') AS gender,
           f.color AS color
    FROM faction_members m
    JOIN users u ON u.id = m.user_id
    JOIN factions f ON f.id = m.faction_id
    WHERE f.retired = false AND u.faction_id = m.faction_id   -- membres principaux uniquement
  LOOP
    IF r.cur IS NULL THEN CONTINUE; END IF;
    -- amélioration (rang plus petit) ET on avait déjà un relevé → annonce. cur < prev exclut
    -- mécaniquement le catch-all (qui est le plus grand rang). Descente/égalité = silence.
    IF r.prev IS NOT NULL AND r.cur < r.prev THEN
      v_label := public._grade_label(r.faction_id, r.cur, r.gender);
      -- message posté DANS le chat de la Compagnie → le nom de la Compagnie est implicite.
      INSERT INTO public.chat_messages (channel, user_id, user_name, faction_id, faction_color, content)
      VALUES (r.faction_id, r.user_id, 'Le Héraut', r.faction_id, r.color,
        '⚔️ ' || r.name || ' est désormais ' || v_label || ' !');
    END IF;
    UPDATE public.faction_members SET last_heralded_grade = r.cur
    WHERE user_id = r.user_id AND faction_id = r.faction_id;
  END LOOP;
END;$$;

-- Baseline immédiate : on initialise le relevé sans rien annoncer (sinon le 1er run croirait à des montées).
UPDATE public.faction_members m
SET last_heralded_grade = public._member_grade_rank(m.user_id, m.faction_id)
FROM users u JOIN factions f ON f.id = u.faction_id
WHERE u.id = m.user_id AND u.faction_id = m.faction_id AND f.retired = false
  AND m.last_heralded_grade IS NULL;

-- Cron quotidien 18h UTC (idempotent : re-schedule sous le même nom).
SELECT cron.schedule('herald-grade-promotions', '0 18 * * *', $$SELECT public.herald_grade_promotions()$$);
