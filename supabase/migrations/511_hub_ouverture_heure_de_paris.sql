-- WHY: correctif de la 510 : ses bornes de la période d'avant étaient calculées sur l'instant UTC
--      (la session est en UTC), puis tronquées à l'heure de Paris. Autour de minuit à Paris le
--      1er du mois, la fenêtre d'avant tombait sur le mauvais mois (01/10 00:30 Paris -> début
--      au 1er août au lieu du 1er septembre), et d'une heure à côté lors du changement d'heure
--      pour « jour ». Tout le calcul se fait maintenant en heure locale de Paris, puis se
--      reconvertit en instant. Seules les bornes changent ; le reste est la définition live.
-- SCHEMA CHECKED (14/10/2026, live) : définition de hub_ouverture(text) lue par pg_get_functiondef
--   (migration 510, identique au fichier) ; _hub_pouls, _is_admin(), _refus() inchangées.

CREATE OR REPLACE FUNCTION public.hub_ouverture(p_periode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fin timestamptz := now();
  v_local timestamp := now() AT TIME ZONE 'Europe/Paris';
  v_unite text;
  v_recul interval;
  v_debut timestamptz;
  v_avant_debut timestamptz;
  v_avant_fin timestamptz;
  v_avant jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_periode IS NULL OR p_periode NOT IN ('jour', 'semaine', 'mois', 'toujours') THEN
    PERFORM _refus('Période inconnue', 'periode');
  END IF;

  IF p_periode = 'toujours' THEN
    v_debut := '-infinity';
  ELSE
    v_unite := CASE p_periode WHEN 'jour' THEN 'day' WHEN 'semaine' THEN 'week' ELSE 'month' END;
    v_recul := CASE p_periode WHEN 'jour' THEN interval '1 day' WHEN 'semaine' THEN interval '7 days' ELSE interval '1 month' END;
    v_debut := date_trunc(v_unite, v_local) AT TIME ZONE 'Europe/Paris';
    v_avant_debut := date_trunc(v_unite, v_local - v_recul) AT TIME ZONE 'Europe/Paris';
    v_avant_fin := (v_local - v_recul) AT TIME ZONE 'Europe/Paris';
    v_avant := _hub_pouls(v_avant_debut, v_avant_fin);
  END IF;

  RETURN jsonb_build_object(
    'pouls', _hub_pouls(v_debut, v_fin)
      || jsonb_build_object('actifs', (SELECT count(*) FROM users WHERE last_login_at >= v_debut)),
    'avant', v_avant,
    'attente', jsonb_build_object(
      'photos', (SELECT count(*) FROM hub_photo_submissions WHERE status = 'pending'),
      'photos_depuis', (SELECT min(created_at) FROM hub_photo_submissions WHERE status = 'pending'),
      'lieux', (SELECT count(*) FROM places
                 WHERE verified_at IS NULL AND created_at >= '2026-10-07'::timestamptz),
      'signalements_lieu', (SELECT count(*) FROM signalements_lieu WHERE traite_le IS NULL),
      'signalements_enigme', (SELECT count(*) FROM signalements_enigme WHERE traite_le IS NULL),
      'achats', (SELECT count(*) FROM purchase_log WHERE status IN ('pending', 'no_match'))
    ),
    'sante', jsonb_build_object(
      'derniere_commande', (SELECT max(created_at) FROM purchase_log),
      'notifications', (SELECT count(*) FROM notifications WHERE created_at >= v_debut),
      'notifications_lues', (SELECT count(*) FROM notifications WHERE created_at >= v_debut AND read)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_ouverture(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_ouverture(text) TO authenticated;
