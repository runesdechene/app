-- WHY: Hub V2, les périodes du pouls (décision d'Uriel du 14/10/2026) : de vrais chiffres
--      calendaires — Aujourd'hui, Cette semaine (depuis lundi), Ce mois-ci, Depuis toujours —
--      à l'heure de Paris, au lieu de jours glissants. L'écart compare avec la même portion de la
--      période d'avant, arrêtée au même moment (hier à la même heure, lundi précédent à la même
--      heure, le mois précédent au même jour et à la même heure ; Postgres borne le 31 au dernier
--      jour d'un mois court). « Depuis toujours » n'a pas de période d'avant : avant = null.
--      hub_ouverture(integer) disparaît, remplacée par hub_ouverture(text) : aucun appelant hors
--      apps/hub-v2 (vérifié à la main le 14/10 : dépôt, thème Shopify, pg_proc).
--      « Actifs » n'a pas d'écart ; depuis toujours, ce sont les comptes dont last_login_at est
--      non nul. _hub_pouls est inchangée et reste fermée.
-- SCHEMA CHECKED (14/10/2026, live) : définition de hub_ouverture(integer) lue par
--   pg_get_functiondef (attente et santé recopiées à l'identique) ; users(last_login_at),
--   notifications(read, created_at) ; _hub_pouls(timestamptz, timestamptz) ; _is_admin(), _refus().

DROP FUNCTION public.hub_ouverture(integer);

CREATE OR REPLACE FUNCTION public.hub_ouverture(p_periode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fin timestamptz := now();
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
    v_avant_fin := CASE p_periode
      WHEN 'jour' THEN v_fin - interval '1 day'
      WHEN 'semaine' THEN v_fin - interval '7 days'
      ELSE v_fin - interval '1 month' END;
    v_debut := date_trunc(CASE p_periode WHEN 'jour' THEN 'day' WHEN 'semaine' THEN 'week' ELSE 'month' END,
                          v_fin AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris';
    v_avant_debut := date_trunc(CASE p_periode WHEN 'jour' THEN 'day' WHEN 'semaine' THEN 'week' ELSE 'month' END,
                                v_avant_fin AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris';
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
