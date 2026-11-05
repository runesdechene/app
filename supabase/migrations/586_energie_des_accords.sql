-- WHY: l'accord se récompense (Uriel, 05/11) : +1 à la jauge d'énergie tant qu'un téléphone du joueur
-- reçoit les notifications (une adresse dans push_subscriptions), +2 tant que l'accord aux nouvelles
-- tient. Réglables comme la base (app_settings, par _reglage). Écarté : limiter qui refuse, un refus
-- ne doit rien coûter. _energie_max part de sa définition live (mig 399) ; get_user_energy,
-- discover_place et cheat_refill la lisent déjà, rien d'autre ne change.
-- SCHEMA CHECKED (2026-11-05) : users.id varchar, users.accord_nouvelles boolean,
--   push_subscriptions.user_id text, user_fragments.user_id text (live).

CREATE OR REPLACE FUNCTION public._energie_max(p_user text)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public._reglage('default_max_energy', 10)::int
       + (SELECT count(DISTINCT fragment_id)::int FROM user_fragments WHERE user_id = p_user)
       + CASE WHEN EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = p_user)
              THEN public._reglage('bonus_energie_notifications', 1)::int ELSE 0 END
       + CASE WHEN (SELECT accord_nouvelles FROM users WHERE id = p_user)
              THEN public._reglage('bonus_energie_nouvelles', 2)::int ELSE 0 END;
$function$;

-- L'invitation aux notifications ne montre la case des nouvelles qu'à qui ne l'a pas encore cochée.
CREATE OR REPLACE FUNCTION public.mon_accord_nouvelles()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce((SELECT accord_nouvelles FROM users WHERE id = (auth.uid())::text), false);
$function$;
REVOKE ALL ON FUNCTION public.mon_accord_nouvelles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mon_accord_nouvelles() TO authenticated;
