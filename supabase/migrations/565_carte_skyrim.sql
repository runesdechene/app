-- WHY: Uriel, 25/10 : les Explorateurs n'aiment pas les lieux « connus » en signes d'encre nus (24/10).
--      Par défaut, ils reviennent dans leur bulle ; le style d'encre devient l'option « Carte Skyrim »
--      des Préférences. Les deux RPC partent de leur définition live (25/10), seul le réglage s'ajoute.
-- SCHEMA CHECKED (25/10/2026) : get_my_preferences et set_my_preference lus avec pg_get_functiondef.

ALTER TABLE public.users ADD COLUMN carte_skyrim boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_my_preferences()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'email', u.email_address,
    'brouillerPistes', u.brouiller_pistes,
    'pushImportant', u.push_important_enabled,
    'pushRecap', u.push_recap_enabled,
    'showDepartement', u.show_departement,
    'showEnvies', u.show_envies,
    'lieuxEnCouleur', u.lieux_en_couleur,
    'carteSkyrim', u.carte_skyrim,
    'titleGender', u.title_gender,
    'calendrier', u.calendrier
  )
  FROM public.users u
  WHERE u.id = (auth.uid())::text;
$function$;

CREATE OR REPLACE FUNCTION public.set_my_preference(p_cle text, p_valeur boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF p_valeur IS NULL THEN
    RAISE EXCEPTION 'Valeur manquante' USING ERRCODE = '22004';
  END IF;
  CASE p_cle
    WHEN 'show_departement'       THEN UPDATE users SET show_departement = p_valeur       WHERE id = (auth.uid())::text;
    WHEN 'show_envies'            THEN UPDATE users SET show_envies = p_valeur            WHERE id = (auth.uid())::text;
    WHEN 'push_important_enabled' THEN UPDATE users SET push_important_enabled = p_valeur WHERE id = (auth.uid())::text;
    WHEN 'push_recap_enabled'     THEN UPDATE users SET push_recap_enabled = p_valeur     WHERE id = (auth.uid())::text;
    WHEN 'lieux_en_couleur'       THEN UPDATE users SET lieux_en_couleur = p_valeur       WHERE id = (auth.uid())::text;
    WHEN 'carte_skyrim'           THEN UPDATE users SET carte_skyrim = p_valeur           WHERE id = (auth.uid())::text;
    ELSE RAISE EXCEPTION 'Préférence inconnue : %', p_cle USING ERRCODE = '22023';
  END CASE;
END;
$function$;
