-- WHY: une mise à jour de l'app peut porter une image (une capture de ce qui change) et le numéro de
--      version qu'elle accompagne (« Pythéas 1.2.4 ») ; Uriel, 07/10. Les deux sont facultatifs.
--   1. mises_a_jour : colonnes `image` (adresse publique, seau `announcement-covers`) et `version`.
--   2. publier_mise_a_jour : deux paramètres facultatifs de plus. Changer la liste des paramètres
--      impose de supprimer l'ancienne signature (sinon deux versions coexistent) ; le Hub en ligne,
--      qui n'envoie que titre et texte, tombe sur la nouvelle grâce aux valeurs par défaut.
--   3. mises_a_jour_publiees : renvoie `image` et `version` (clés ajoutées, rien de retiré).
-- BASE: les deux fonctions ne sont définies que par la migration 397 (aucune autre migration ne
--       les recrée) ; copiées entières, seul le delta ci-dessus change.
-- SCHEMA CHECKED (2026-10-07) : mises_a_jour(id, titre, texte, publiee_le, par) — migration 397.

ALTER TABLE public.mises_a_jour
  ADD COLUMN image text CHECK (image IS NULL OR image ~ '^https://'),
  ADD COLUMN version text CHECK (version IS NULL OR char_length(btrim(version)) BETWEEN 1 AND 30);

DROP FUNCTION public.publier_mise_a_jour(text, text);

CREATE FUNCTION public.publier_mise_a_jour(p_titre text, p_texte text,
                                           p_image text DEFAULT NULL, p_version text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint;
BEGIN
  IF NOT public._is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  INSERT INTO mises_a_jour (titre, texte, image, version, par)
  VALUES (btrim(p_titre), btrim(p_texte), NULLIF(btrim(p_image), ''), NULLIF(btrim(p_version), ''),
          (auth.uid())::text)
  RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.publier_mise_a_jour(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publier_mise_a_jour(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mises_a_jour_publiees()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object(
      'id', id, 'titre', titre, 'texte', texte, 'quand', publiee_le,
      'image', image, 'version', version)
    ORDER BY publiee_le DESC), '[]'::json)
  FROM mises_a_jour;
$function$;
