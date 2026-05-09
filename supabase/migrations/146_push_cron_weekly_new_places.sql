-- 146_push_cron_weekly_new_places.sql
-- WHY : push hebdomadaire lundi 8h UTC. Notifie les users push_recap_enabled
-- du nombre de nouveaux lieux ajoutés la semaine passée + sample de 3 noms.
-- Seuil min 3 nouveaux lieux pour éviter pings creux.

SELECT cron.unschedule('weekly_new_places_recap')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly_new_places_recap');

SELECT cron.schedule(
  'weekly_new_places_recap',
  '0 8 * * 1',
  $$
    WITH new_places AS (
      SELECT name FROM public.places
       WHERE created_at >= now() - interval '7 days'
         AND private = false AND masked = false
       ORDER BY created_at DESC
       LIMIT 100
    ),
    sample AS (
      SELECT (SELECT count(*) FROM new_places) AS n,
             (SELECT string_agg(name, ', ')
                FROM (SELECT name FROM new_places LIMIT 3) s) AS sample_names
    )
    INSERT INTO public.notifications (recipient_id, type, data)
    SELECT u.id, 'weekly_new_places_recap',
           jsonb_build_object('count', sample.n, 'sample_names_csv', sample.sample_names)
      FROM public.users u, sample
     WHERE sample.n >= 3
       AND u.push_recap_enabled = true
       AND u.is_active = true;
  $$
);
