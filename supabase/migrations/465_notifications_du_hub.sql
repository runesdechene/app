-- 465 — L'écran « Notifications » du Hub : ce qui part vraiment
--
-- WHY : Uriel, 08/10/2026 : « une page où on peut voir toutes les notifications ». Le Hub montre le
--   catalogue (lu dans le code de send-push, la seule source de ce qui part), les chiffres réels par
--   sorte sur 7 et 30 jours — une sorte à zéro trahit un branchement cassé —, le nombre de
--   téléphones abonnés et le fil des 50 dernières notifications, tous joueurs confondus.
--   Réservé aux admins. Un index sur la date : l'agrégat lisait les 800 000 lignes (800 ms).
--
-- SCHEMA CHECKED (08/10/2026, live) : notifications(id, recipient_id text, type text, data jsonb,
--   read boolean, created_at timestamptz) ; push_subscriptions(user_id text) ; users(id, role,
--   display_name, first_name) ; places(id, title) ; _notification_v2(text) ;
--   user_public_name(text, text, text).

CREATE INDEX IF NOT EXISTS notifications_par_date ON public.notifications (created_at DESC);

CREATE OR REPLACE FUNCTION public.notifications_du_hub()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'abonnes', (SELECT count(DISTINCT user_id) FROM push_subscriptions),
    'sortes', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'type', s.type, 'semaine', s.semaine, 'mois', s.mois, 'derniere', s.derniere,
        'cloche', _notification_v2(s.type)) ORDER BY s.mois DESC), '[]'::jsonb)
      FROM (
        SELECT type,
               count(*) FILTER (WHERE created_at > now() - interval '7 days') AS semaine,
               count(*) AS mois,
               max(created_at) AS derniere
        FROM notifications
        WHERE created_at > now() - interval '30 days'
        GROUP BY type
      ) s),
    'fil', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', n.id, 'type', n.type, 'quand', n.created_at, 'lu', n.read,
        'pour', user_public_name(u.id, u.display_name, u.first_name),
        'qui', n.data->>'actorName',
        'sur', coalesce(p.title, n.data->>'compagnieNom', n.data->>'titre')) ORDER BY n.created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50) n
      LEFT JOIN users u ON u.id = n.recipient_id
      LEFT JOIN places p ON p.id = n.data->>'placeId')
  );
END $$;

REVOKE ALL ON FUNCTION public.notifications_du_hub() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notifications_du_hub() TO authenticated;
