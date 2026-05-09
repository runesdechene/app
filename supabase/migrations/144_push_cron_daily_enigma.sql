-- 144_push_cron_daily_enigma.sql
-- WHY : push midi "ton énigme du jour t'attend" pour les users qui n'ont
-- pas ouvert l'app dans les dernières 18h. Cible 12h30 Europe/Paris (pause
-- repas du midi) toute l'année, robuste DST.
-- Garde-fous : push_important_enabled, is_active, 1×/user/jour max.

SELECT cron.unschedule('daily_enigma_lunch_push')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_enigma_lunch_push');

-- Cron tourne 4× dans la fenêtre UTC 10h-11h30 (couvre 12h-13h30 Paris été+hiver).
-- Le filtre WHERE en time-of-day Europe/Paris cible précisément 12:30 ± 5 min.
-- Le NOT EXISTS garantit 1×/jour/user, donc même si le cron déclenche 4×, l'INSERT
-- effectif n'arrive qu'à la première fenêtre où l'heure de Paris est 12h30.
SELECT cron.schedule(
  'daily_enigma_lunch_push',
  '0,30 10,11 * * *',
  $$
    INSERT INTO public.notifications (recipient_id, type, data)
    SELECT u.id, 'daily_enigma_ready', '{}'::jsonb
      FROM public.users u
     WHERE EXTRACT(HOUR   FROM (now() AT TIME ZONE 'Europe/Paris'))::int = 12
       AND EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Europe/Paris'))::int BETWEEN 25 AND 35
       AND u.push_important_enabled = true
       AND u.is_active = true
       AND (u.last_login_at IS NULL OR u.last_login_at < now() - interval '18 hours')
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
          WHERE n.recipient_id = u.id
            AND n.type = 'daily_enigma_ready'
            AND n.created_at::date
                = (now() AT TIME ZONE 'Europe/Paris')::date
       );
  $$
);
