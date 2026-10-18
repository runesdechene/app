-- WHY: Mod « pouls » de Claude Code (conception 2026-10-18) : un panneau qui affiche les six chiffres
--      du pouls du Hub (nouveaux, réactivés, actifs, lieux, visites, énigmes), lus par une edge function
--      sous la clé service_role. Or ces chiffres ne sortent que de hub_ouverture, dont la première ligne
--      refuse quiconque n'est pas admin — et service_role n'a pas d'auth.uid(). On sort donc le calcul
--      en deux fonctions internes, fermées à tous les comptes :
--      _hub_bornes(periode) : les bornes d'une période (début, et début/fin de la période d'avant) ;
--      _hub_pouls_periode(periode) : le pouls (six clés, dont actifs) et l'avant (cinq clés, ou null
--      pour 'toujours'), ouverte au seul service_role.
--      hub_ouverture les appelle au lieu de calculer elle-même : même signature, même sortie, même
--      garde _is_admin() en première ligne, attente et sante inchangées. Rien n'est ouvert à
--      authenticated.
-- SCHEMA CHECKED : NON. Le corps de hub_ouverture est repris de la 521 (dernière migration à la
--   définir ; les 522 à 527 ne la touchent pas), PAS comparé à pg_get_functiondef. À faire avant
--   d'appliquer : SELECT pg_get_functiondef('public.hub_ouverture(text)'::regprocedure); — s'il
--   diffère de la 521, le live prime et cette migration se corrige. Colonne lue en plus : users(last_login_at),
--   déjà lue par la 521 ; _hub_pouls(timestamptz, timestamptz), _is_admin(), _refus() inchangées.

-- 1. Les bornes d'une période (calcul repris mot pour mot de hub_ouverture, mig 521)
CREATE OR REPLACE FUNCTION public._hub_bornes(p_periode text)
 RETURNS TABLE(debut timestamptz, avant_debut timestamptz, avant_fin timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_local timestamp := now() AT TIME ZONE 'Europe/Paris';
  v_unite text;
  v_recul interval;
BEGIN
  IF p_periode IS NULL OR p_periode NOT IN ('jour', 'semaine', 'mois', 'toujours') THEN
    PERFORM _refus('Période inconnue', 'periode');
  END IF;

  IF p_periode = 'toujours' THEN
    debut := '-infinity';
  ELSE
    v_unite := CASE p_periode WHEN 'jour' THEN 'day' WHEN 'semaine' THEN 'week' ELSE 'month' END;
    v_recul := CASE p_periode WHEN 'jour' THEN interval '1 day' WHEN 'semaine' THEN interval '7 days' ELSE interval '1 month' END;
    debut := date_trunc(v_unite, v_local) AT TIME ZONE 'Europe/Paris';
    avant_debut := date_trunc(v_unite, v_local - v_recul) AT TIME ZONE 'Europe/Paris';
    avant_fin := (v_local - v_recul) AT TIME ZONE 'Europe/Paris';
  END IF;
  RETURN NEXT;
END;
$function$;

-- 2. Le pouls d'une période et celui de la période d'avant (null pour 'toujours')
CREATE OR REPLACE FUNCTION public._hub_pouls_periode(p_periode text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'pouls', _hub_pouls(b.debut, now())
      || jsonb_build_object('actifs', (SELECT count(*) FROM users WHERE last_login_at >= b.debut)),
    'avant', CASE WHEN b.avant_debut IS NOT NULL THEN _hub_pouls(b.avant_debut, b.avant_fin) END
  )
  FROM _hub_bornes(p_periode) b;
$function$;

-- 3. L'ouverture du Hub : mêmes sorties ; les bornes et le pouls viennent des deux fonctions ci-dessus
--    (corps = mig 521, seuls changent le calcul des bornes et les clés 'pouls' et 'avant')
CREATE OR REPLACE FUNCTION public.hub_ouverture(p_periode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_debut timestamptz;
  v_pouls jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;

  SELECT debut INTO v_debut FROM _hub_bornes(p_periode);
  v_pouls := _hub_pouls_periode(p_periode);

  RETURN jsonb_build_object(
    'pouls', v_pouls -> 'pouls',
    'avant', v_pouls -> 'avant',
    'attente', jsonb_build_object(
      'photos', (SELECT count(*) FROM hub_photo_submissions WHERE status = 'pending'),
      'photos_depuis', (SELECT min(created_at) FROM hub_photo_submissions WHERE status = 'pending'),
      'lieux', (SELECT count(*) FROM places
                 WHERE masked = false AND verified_at IS NULL AND created_at >= '2026-10-07 00:00:00+02'::timestamptz),
      'signalements_lieu', (SELECT count(*) FROM signalements_lieu WHERE traite_le IS NULL),
      'signalements_enigme', (SELECT count(*) FROM signalements_enigme WHERE traite_le IS NULL),
      'achats', (SELECT count(*) FROM purchase_log WHERE status = 'no_match')
    ),
    'sante', jsonb_build_object(
      'derniere_commande', (SELECT max(created_at) FROM purchase_log WHERE shopify_order_id IS NOT NULL),
      'notifications', (SELECT count(*) FROM notifications WHERE created_at >= v_debut),
      'notifications_lues', (SELECT count(*) FROM notifications WHERE created_at >= v_debut AND read)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._hub_bornes(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._hub_pouls_periode(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._hub_pouls_periode(text) TO service_role;
REVOKE ALL ON FUNCTION public.hub_ouverture(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_ouverture(text) TO authenticated;
