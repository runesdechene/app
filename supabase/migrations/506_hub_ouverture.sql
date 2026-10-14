-- WHY: Hub V2, l'ouverture (spec 2026-10-14-hub-v2-design §7-9, définitions validées par Uriel
--      le 14/10) : le pouls d'une période et de la période d'avant, ce qui attend, la santé, en
--      une lecture réservée aux admins.
--      « Aujourd'hui » (p_jours = 1) part de minuit à Paris ; sinon, les N derniers jours.
--      « Actifs » n'a pas de période d'avant : last_login_at ne garde que la dernière connexion.
--      « Réactivé » : charte_signee_le, posée une seule fois à la première entrée dans la V2,
--      plus d'un jour après la création du compte.
--      « Lieux à modérer » : ajoutés depuis la bascule (07/10/2026) et jamais vérifiés.
-- SCHEMA CHECKED (14/10/2026, information_schema live) : users(created_at, charte_signee_le,
--   last_login_at) ; places(created_at, verified_at) ; places_discovered(method, discovered_at) ;
--   enigma_responses(correct, responded_at) ; hub_photo_submissions(status, created_at) ;
--   signalements_lieu(traite_le) ; signalements_enigme(traite_le) ; purchase_log(status,
--   created_at) ; notifications(read, created_at) ; _is_admin(), _refus().

CREATE OR REPLACE FUNCTION public._hub_pouls(p_debut timestamptz, p_fin timestamptz)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'nouveaux', (SELECT count(*) FROM users WHERE created_at >= p_debut AND created_at < p_fin),
    'reactives', (SELECT count(*) FROM users
                   WHERE charte_signee_le >= p_debut AND charte_signee_le < p_fin
                     AND charte_signee_le > created_at + interval '1 day'),
    'lieux', (SELECT count(*) FROM places WHERE created_at >= p_debut AND created_at < p_fin),
    'visites', (SELECT count(*) FROM places_discovered
                 WHERE method = 'gps' AND discovered_at >= p_debut AND discovered_at < p_fin),
    'enigmes', (SELECT count(*) FROM enigma_responses
                 WHERE correct AND responded_at >= p_debut AND responded_at < p_fin)
  );
$function$;

REVOKE ALL ON FUNCTION public._hub_pouls(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hub_ouverture(p_jours integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fin timestamptz := now();
  v_debut timestamptz;
  v_avant timestamptz;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_jours NOT IN (1, 7, 30, 90) THEN PERFORM _refus('Période inconnue', 'periode'); END IF;

  v_debut := CASE WHEN p_jours = 1
    THEN date_trunc('day', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris'
    ELSE now() - make_interval(days => p_jours) END;
  v_avant := v_debut - (v_fin - v_debut);

  RETURN jsonb_build_object(
    'pouls', _hub_pouls(v_debut, v_fin)
      || jsonb_build_object('actifs', (SELECT count(*) FROM users WHERE last_login_at >= v_debut)),
    'avant', _hub_pouls(v_avant, v_debut),
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

REVOKE ALL ON FUNCTION public.hub_ouverture(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_ouverture(integer) TO authenticated;
