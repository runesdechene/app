-- WHY: corriger une mise à jour déjà publiée sans la supprimer ni rallumer la cloche de chacun
--      (Uriel, 07/10 : le passeport a changé de place après l'annonce). Sa date de publication ne
--      bouge pas : elle n'est pas relue comme nouvelle.
-- BASE: même garde et mêmes nettoyages que `publier_mise_a_jour` (migration 436).
-- SCHEMA CHECKED (2026-10-07) : mises_a_jour(id, titre, texte, image, version, publiee_le, par) —
--   migrations 397 et 436.

CREATE FUNCTION public.modifier_mise_a_jour(p_id bigint, p_titre text, p_texte text,
                                            p_image text DEFAULT NULL, p_version text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  UPDATE mises_a_jour
     SET titre = btrim(p_titre), texte = btrim(p_texte),
         image = NULLIF(btrim(p_image), ''), version = NULLIF(btrim(p_version), '')
   WHERE id = p_id;
  RETURN json_build_object('ok', FOUND);
END;
$function$;

REVOKE ALL ON FUNCTION public.modifier_mise_a_jour(bigint, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modifier_mise_a_jour(bigint, text, text, text, text) TO authenticated;
