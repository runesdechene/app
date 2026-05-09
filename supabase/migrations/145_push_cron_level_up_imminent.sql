-- 145_push_cron_level_up_imminent.sql
-- WHY : push quotidien 17h UTC (~18h-19h CET) pour les users à 1-5 XP du
-- prochain niveau, qui ne sont pas actifs depuis 24h. Système Niveaux V0.7
-- (xp_total + _xp_for_level helpers, cf. mig 040 et 047).
-- Garde-fous : 1×/7j max, niveau actuel < 50.

SELECT cron.unschedule('level_up_imminent_check')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'level_up_imminent_check');

SELECT cron.schedule(
  'level_up_imminent_check',
  '0 17 * * *',
  $$
    INSERT INTO public.notifications (recipient_id, type, data)
    SELECT u.id, 'level_up_imminent',
           jsonb_build_object(
             'xp_diff',    lv.next_xp - COALESCE(u.xp_total, 0),
             'next_level', lv.cur_level + 1
           )
      FROM public.users u
      CROSS JOIN LATERAL (
        SELECT public._level_from_xp(COALESCE(u.xp_total, 0)) AS cur_level,
               public._xp_for_level(public._level_from_xp(COALESCE(u.xp_total, 0)) + 1) AS next_xp
      ) lv
     WHERE u.push_recap_enabled = true
       AND u.is_active = true
       AND lv.cur_level < 50
       AND (lv.next_xp - COALESCE(u.xp_total, 0)) BETWEEN 1 AND 5
       AND (u.last_login_at IS NULL OR u.last_login_at < now() - interval '24 hours')
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
          WHERE n.recipient_id = u.id
            AND n.type = 'level_up_imminent'
            AND n.created_at > now() - interval '7 days'
       );
  $$
);
