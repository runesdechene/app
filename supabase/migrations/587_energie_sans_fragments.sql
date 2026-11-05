-- WHY: le point d'énergie par Fragment ne fait acheter personne (Uriel, 05/11 : écrit seulement au
-- fond de la feuille de l'énergie, et un +1 ne vend pas un t-shirt). La jauge = la base + les deux
-- bonus d'accord, annoncés là où on les accepte. Part de la définition live (mig 586).
-- Une jauge au-dessus du nouveau maximum n'est pas rabotée : elle se vide en jouant, et ne se
-- recharge qu'en dessous (get_user_energy).
CREATE OR REPLACE FUNCTION public._energie_max(p_user text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public._reglage('default_max_energy', 10)::int
       + CASE WHEN EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = p_user)
              THEN public._reglage('bonus_energie_notifications', 1)::int ELSE 0 END
       + CASE WHEN (SELECT accord_nouvelles FROM users WHERE id = p_user)
              THEN public._reglage('bonus_energie_nouvelles', 2)::int ELSE 0 END;
$function$;
