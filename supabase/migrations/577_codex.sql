-- 577 — Les données du Codex : numéro de Porteur, édition, mot de l'artiste, collections
--
-- WHY : Uriel, 02/11/2026 — le Codex (spec docs/superpowers/specs/2026-11-02-codex-design.md).
--   · Le numéro de Porteur est figé : posé une fois quand un Fragment est relié à un compte, jamais
--     recalculé (un remboursement ou un compte supprimé ne décale personne). Les liens existants
--     sont numérotés dans l'ordre où ils ont été faits.
--   · Le contenu d'un motif vient de Shopify par la synchro : on y ajoute la photo de l'artiste, son
--     mot et la marque d'édition (vides tant que Shopify ne les porte pas : l'appli masque le bloc).
--   · La couleur, l'icône et le titre d'une collection (fragments.heritage) ne s'affichent que dans
--     l'appli : ils vivent ici, réglés au Hub.
--   recit_du_fragment et synchroniser_fragments repartent de leur définition live du 02/11 ; seules
--   changent les nouvelles clés.
--
-- SCHEMA CHECKED (02/11/2026, live) : user_fragments(user_id varchar, fragment_id int, unlocked_at
--   timestamptz NULL, source varchar) sans trigger, 541 lignes ; title_fragments (mig 457) ;
--   users(id varchar, role varchar).

-- Le contenu d'un motif lu dans Shopify ----------------------------------------------------------

ALTER TABLE public.title_fragments
  ADD COLUMN IF NOT EXISTS artiste_photo_url text,
  ADD COLUMN IF NOT EXISTS mot_artiste text,
  ADD COLUMN IF NOT EXISTS edition text,
  ADD COLUMN IF NOT EXISTS edition_precision text;

ALTER TABLE public.title_fragments DROP CONSTRAINT IF EXISTS title_fragments_edition_check;
ALTER TABLE public.title_fragments
  ADD CONSTRAINT title_fragments_edition_check CHECK (edition IN ('limitee', 'retire', 'exclusif'));

-- Le numéro de Porteur, figé ----------------------------------------------------------------------

ALTER TABLE public.user_fragments ADD COLUMN IF NOT EXISTS numero integer;

UPDATE public.user_fragments uf SET numero = n.rang
FROM (
  SELECT user_id, fragment_id,
         row_number() OVER (PARTITION BY fragment_id ORDER BY unlocked_at NULLS LAST, user_id) AS rang
  FROM public.user_fragments
) n
WHERE uf.user_id = n.user_id AND uf.fragment_id = n.fragment_id AND uf.numero IS NULL;

ALTER TABLE public.user_fragments ALTER COLUMN numero SET NOT NULL;
ALTER TABLE public.user_fragments DROP CONSTRAINT IF EXISTS user_fragments_numero_unique;
ALTER TABLE public.user_fragments
  ADD CONSTRAINT user_fragments_numero_unique UNIQUE (fragment_id, numero);

-- Le verrou sur le motif sérialise deux liens simultanés : jamais deux fois le même numéro.
CREATE OR REPLACE FUNCTION public._numeroter_porteur()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  PERFORM 1 FROM title_fragments WHERE id = NEW.fragment_id FOR UPDATE;
  SELECT coalesce(max(numero), 0) + 1 INTO NEW.numero
  FROM user_fragments WHERE fragment_id = NEW.fragment_id;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public._numeroter_porteur() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS numeroter_porteur ON public.user_fragments;
CREATE TRIGGER numeroter_porteur BEFORE INSERT ON public.user_fragments
  FOR EACH ROW EXECUTE FUNCTION public._numeroter_porteur();

-- Les collections du Codex ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.codex_collections (
  heritage text PRIMARY KEY,
  couleur text,
  icone_url text,
  titre text
);
ALTER TABLE public.codex_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tout le monde lit les collections du Codex" ON public.codex_collections;
CREATE POLICY "Tout le monde lit les collections du Codex" ON public.codex_collections
  FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.hub_ecrire_collection(
  p_heritage text, p_couleur text, p_icone_url text, p_titre text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  INSERT INTO codex_collections (heritage, couleur, icone_url, titre)
  VALUES (p_heritage, nullif(p_couleur, ''), nullif(p_icone_url, ''), nullif(p_titre, ''))
  ON CONFLICT (heritage) DO UPDATE SET
    couleur = EXCLUDED.couleur, icone_url = EXCLUDED.icone_url, titre = EXCLUDED.titre;
END $$;
REVOKE ALL ON FUNCTION public.hub_ecrire_collection(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_ecrire_collection(text, text, text, text) TO authenticated;

-- La synchro lit les nouveaux champs (live du 02/11 + 4 clés) -----------------------------------

CREATE OR REPLACE FUNCTION public.synchroniser_fragments(p_illustrations jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ill jsonb;
  v_n integer;
  v_total integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  FOR v_ill IN SELECT * FROM jsonb_array_elements(p_illustrations) LOOP
    UPDATE title_fragments f SET
      shopify_handle = v_ill->>'handle',
      shopify_collection = v_ill->>'collection',
      name = coalesce(nullif(v_ill->>'nom', ''), f.name),
      resume = v_ill->>'resume',
      histoire = v_ill->>'histoire',
      illustration_url = v_ill->>'illustration_url',
      illustration_sombre_url = v_ill->>'illustration_sombre_url',
      fond_url = v_ill->>'fond_url',
      audio_url = v_ill->>'audio_url',
      artiste = v_ill->>'artiste',
      narrateur = v_ill->>'narrateur',
      heritage = v_ill->>'heritage',
      artiste_photo_url = nullif(v_ill->>'artiste_photo_url', ''),
      mot_artiste = nullif(v_ill->>'mot_artiste', ''),
      edition = nullif(v_ill->>'edition', ''),
      edition_precision = nullif(v_ill->>'edition_precision', ''),
      synchronise_le = now()
    WHERE f.shopify_handle = v_ill->>'handle'
       OR (f.shopify_handle IS NULL AND v_ill->>'collection' <> ''
           AND lower(f.link_url) LIKE '%/collections/' || lower(v_ill->>'collection'));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;
  END LOOP;
  RETURN v_total;
END $function$;

-- Le récit rend l'artiste, son mot et l'édition (live du 02/11 + 5 clés) ------------------------

CREATE OR REPLACE FUNCTION public.recit_du_fragment(p_id integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    'boutique', f.link_url,
    'artiste', nullif(f.artiste, ''),
    'artistePhoto', f.artiste_photo_url,
    'motArtiste', f.mot_artiste,
    'edition', f.edition,
    'editionPrecision', f.edition_precision
  )
  FROM title_fragments f
  WHERE f.id = p_id AND f.visible;
$function$;
