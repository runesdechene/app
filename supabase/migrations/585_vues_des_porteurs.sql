-- WHY: tout Porteur (au moins un Fragment visible) apprend des vues au scanner, plus seulement les
-- admins (Uriel, 05/11 : « on a besoin que les membres enregistrent un maximum de photos »). Une seule
-- règle, peut_apprendre_vue(), lue par ajouter_vue et par l'appli pour montrer la feuille. Retirer une
-- vue et remplacer les empreintes des illustrations restent aux admins : ils gardent la main pour
-- nettoyer. ajouter_vue part de sa définition live (identique à la 474) ; seul le contrôle change.
-- SCHEMA CHECKED (2026-11-05) : aucune colonne nouvelle ; scan_empreintes inchangée (def live) ;
--   _est_porteur(text) et _is_admin() existent (migs 420, live).

CREATE OR REPLACE FUNCTION public.peut_apprendre_vue()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT auth.uid() IS NOT NULL AND (_is_admin() OR _est_porteur(auth.uid()::text));
$function$;
REVOKE ALL ON FUNCTION public.peut_apprendre_vue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peut_apprendre_vue() TO authenticated;

CREATE OR REPLACE FUNCTION public.ajouter_vue(p_fragment integer, p_vecteur jsonb, p_modele text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id bigint;
BEGIN
  IF NOT peut_apprendre_vue() THEN RAISE EXCEPTION 'Réservé aux Porteurs' USING ERRCODE = '42501'; END IF;
  INSERT INTO scan_empreintes (fragment_id, source, vecteur, modele, ajoutee_par)
  VALUES (p_fragment, 'vue', _vecteur_du_scan(p_vecteur), p_modele, auth.uid()::text)
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;
