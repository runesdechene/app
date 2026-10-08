-- 466 — L'écran « Notifications » du Hub sait aussi ce que la cloche montre pour une sorte jamais créée
--
-- WHY : la mig 465 ne disait « dans la cloche » que des sortes vues ces 30 jours ; une sorte neuve
--   (`visite`, mig 464) apparaissait hors de la cloche alors qu'elle y est. Le Hub passe la liste de
--   son catalogue (lue dans send-push) ; la fonction rend celles que `_notification_v2` retient.
--   Le Hub qui appelle la version sans paramètre n'est pas encore déployé : on la remplace.
--   Définition de la 465 copiée entière ; seuls changent le paramètre et la clé 'cloche'.

DROP FUNCTION IF EXISTS public.notifications_du_hub();

CREATE OR REPLACE FUNCTION public.notifications_du_hub(p_types text[])
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
      FROM (SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50) n
      LEFT JOIN users u ON u.id = n.recipient_id
      LEFT JOIN places p ON p.id = n.data->>'placeId')
  );
END $$;

REVOKE ALL ON FUNCTION public.notifications_du_hub(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notifications_du_hub(text[]) TO authenticated;
