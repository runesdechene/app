-- 459 — Le récit d'un Fragment, pour tous
--
-- WHY : toucher un Fragment sur la carte ouvre son récit (maquette Figma 99:145, décision du
--   08/10/2026) : son nom, sa collection d'héritage, son illustration, sa voix off et son histoire,
--   tirés de Shopify par la synchro du Hub (mig 457). Ouvert aux visiteurs : rien ici n'est réservé
--   aux Porteurs (les énigmes du Fragment, plus tard, le seront).
--
-- SCHEMA CHECKED (08/10/2026, mig 457) : title_fragments(id int, name varchar, visible bool,
--   link_url text, resume text, histoire text, illustration_url text, audio_url text,
--   narrateur text, heritage text, origine_nom text) ; lecture publique.

CREATE OR REPLACE FUNCTION public.recit_du_fragment(p_id integer)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'id', f.id,
    'nom', f.name,
    'heritage', f.heritage,
    'illustration', f.illustration_url,
    'resume', f.resume,
    'histoire', f.histoire,
    'audio', f.audio_url,
    'narrateur', f.narrateur,
    'origine', f.origine_nom,
    'boutique', f.link_url
  )
  FROM title_fragments f
  WHERE f.id = p_id AND f.visible;
$$;

GRANT EXECUTE ON FUNCTION public.recit_du_fragment(integer) TO anon, authenticated;
