-- 467 — Le fil de l'écran « Notifications » ne montre que ce qui part vraiment
--
-- WHY : vu dans le Hub le 08/10/2026 : le fil des 50 dernières était noyé sous les anciennes
--   « énigme du jour » silencieuses (des milliers par jour jusqu'à la mig 464). Le Hub passe la liste
--   des sortes qui partent (lue dans send-push, `p_fil`) ; sans elle, le fil reste celui de toutes.
--   p_fil a une valeur par défaut : le Hub en ligne, qui n'envoie que p_types, continue de marcher.
--   Définition de la 466 copiée entière ; seuls changent le paramètre et le filtre du fil.

DROP FUNCTION IF EXISTS public.notifications_du_hub(text[]);

CREATE OR REPLACE FUNCTION public.notifications_du_hub(p_types text[], p_fil text[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'abonnes', (SELECT count(DISTINCT user_id) FROM push_subscriptions),
    'cloche', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM unnest(p_types) t WHERE _notification_v2(t)),
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
      FROM (SELECT * FROM notifications
            WHERE p_fil IS NULL OR type = ANY (p_fil)
            ORDER BY created_at DESC LIMIT 50) n
      LEFT JOIN users u ON u.id = n.recipient_id
      LEFT JOIN places p ON p.id = n.data->>'placeId')
  );
END $$;

REVOKE ALL ON FUNCTION public.notifications_du_hub(text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notifications_du_hub(text[], text[]) TO authenticated;
