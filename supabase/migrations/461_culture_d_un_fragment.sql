-- 461 — Le Hub relie un Fragment à une culture
--
-- WHY : Uriel, 08/10/2026 : l'éclat d'un Fragment sur la carte prend la couleur de sa culture
--   (mig 460) ; la culture se choisit dans le Hub (écran « Fragments (Shopify) »), parmi celles des
--   énigmes. Jeanne de Flandre n'en avait pas.
--   Le Hub en ligne appelle encore enregistrer_fragment à cinq paramètres : on ajoute la version à
--   six (avec p_theme) à côté, sans toucher l'ancienne ; elle part après le déploiement du Hub
--   (docs/v2/purge-back.md). Corps copié de la définition live du 08/10 ; seuls s'ajoutent
--   p_theme, sa vérification et la colonne theme.
--
-- SCHEMA CHECKED (08/10/2026, live) : title_fragments.theme text ; enigma_themes(id text).

CREATE OR REPLACE FUNCTION public.enregistrer_fragment(p_id integer, p_origine_lat double precision, p_origine_lng double precision, p_origine_nom text, p_visible boolean, p_theme text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  IF (p_origine_lat IS NULL) <> (p_origine_lng IS NULL) THEN
    RAISE EXCEPTION 'Une origine a une latitude et une longitude, ou aucune';
  END IF;
  IF nullif(p_theme, '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM enigma_themes WHERE id = p_theme) THEN
    RAISE EXCEPTION 'Culture inconnue : %', p_theme;
  END IF;
  UPDATE title_fragments SET
    origine_lat = p_origine_lat,
    origine_lng = p_origine_lng,
    origine_nom = nullif(btrim(p_origine_nom), ''),
    visible = p_visible,
    theme = nullif(p_theme, '')
  WHERE id = p_id;
END $function$;

REVOKE ALL ON FUNCTION public.enregistrer_fragment(integer, double precision, double precision, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_fragment(integer, double precision, double precision, text, boolean, text) TO authenticated;
