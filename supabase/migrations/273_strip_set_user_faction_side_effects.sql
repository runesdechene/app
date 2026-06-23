-- 273 : get_factions_for_choice sans tri d'équilibrage (underdog)
--
-- set_user_faction : AUCUN effet de bord bonus/underdog dans la définition prod (vérifié) —
--   donc NON redéfinie ici. On ne re-applique pas une fonction à cooldown complexe sans raison
--   (risque de copie imparfaite, zéro bénéfice). Les bonus sont neutralisés à la source par mig 272.
--
-- get_factions_for_choice : retrait du tri par effectif qui promouvait l'underdog
--   (baseline : ORDER BY member_count ASC, f."order" ASC) → ORDER BY f."order" ASC (ordre stable).
--   Corps identique au baseline pour le reste. Les colonnes bonus_energy/bonus_regen_energy
--   restent dans le retour mais valent 0 (neutralisées par mig 272) ; l'affichage bonus côté
--   front part au renommage (Task 9).

CREATE OR REPLACE FUNCTION public.get_factions_for_choice()
 RETURNS TABLE(id text, title text, color text, pattern text, description text, image_url text, bonus_energy integer, bonus_regen_energy integer, member_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    f.id::text,
    f.title,
    f.color,
    f.pattern,
    f.description,
    f.image_url,
    COALESCE(f.bonus_energy, 0),
    COALESCE(f.bonus_regen_energy, 0),
    COUNT(u.id)::bigint AS member_count
  FROM public.factions f
  LEFT JOIN public.users u ON u.faction_id::text = f.id::text
  GROUP BY f.id, f.title, f.color, f.pattern, f.description, f.image_url,
           f.bonus_energy, f.bonus_regen_energy, f."order"
  ORDER BY f."order" ASC;
$function$;
