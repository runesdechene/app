-- WHY: Uriel, 09/10 — le choix du calendrier revient (spec 2026-10-09-choix-du-calendrier-design.md).
--   1. users.calendrier : chretien (défaut), moderne, rome, constantinople. Il suit le joueur d'un
--      appareil à l'autre (la V1 le gardait dans le navigateur).
--   2. set_calendrier : set_my_preference ne prend que des booléens ; même forme que set_title_gender.
--   3. get_my_preferences renvoie calendrier. Réécrite à partir de sa définition live (relevée le 09/10).

ALTER TABLE public.users
  ADD COLUMN calendrier text NOT NULL DEFAULT 'chretien'
  CONSTRAINT users_calendrier_check CHECK (calendrier IN ('chretien', 'moderne', 'rome', 'constantinople'));

CREATE OR REPLACE FUNCTION public.set_calendrier(p_calendrier text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('error', 'unauthorized'); END IF;
  IF p_calendrier NOT IN ('chretien', 'moderne', 'rome', 'constantinople') THEN
    RETURN json_build_object('error', 'bad_calendrier');
  END IF;
  UPDATE public.users SET calendrier = p_calendrier WHERE id = auth.uid()::text;
  RETURN json_build_object('success', true, 'calendrier', p_calendrier);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_calendrier(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_calendrier(text) TO authenticated;

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
    'titleGender', u.title_gender,
    'calendrier', u.calendrier
  )
  FROM public.users u
  WHERE u.id = (auth.uid())::text;
$function$;
