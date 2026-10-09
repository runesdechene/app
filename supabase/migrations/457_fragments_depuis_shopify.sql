-- 457 — Les Fragments aspirés depuis Shopify, et leur origine sur la carte
--
-- WHY : décision du 08/10/2026 (vault, Explore/_État.md « Fragments »). Shopify (métaobjet
--   `illustrations`) reste la source du contenu d'un Fragment ; le Hub l'aspire dans
--   title_fragments, champs en lecture seule, et n'ajoute que ce que Shopify n'a pas : le point
--   d'origine sur la carte (calque Fragments d'Explore, puis mini-carte de la boutique).
--   Une ligne de title_fragments = un Fragment : les métaobjets sans ligne (anciens motifs) sont
--   ignorés par la synchro et listés dans le Hub, pour le tri.
--   Données : Ambassadeur n'est pas un Fragment (aucun Porteur, aucun produit relié, aucune
--   énigme ni signe — vérifié le 08/10) → retiré avec ses deux titres ; sa trace d'attribution
--   manuelle (purchase_log 485, sans clé étrangère) reste comme historique. Jeanne de Flandre
--   (8 Porteurs) redevient visible : elle était masquée faute d'image, la synchro la lui donne.
--
-- SCHEMA CHECKED (08/10/2026, live) : title_fragments(id int, name varchar not null,
--   link_url text « https://runesdechene.com/collections/<handle> », visible bool, …) ; RLS :
--   lecture pour tous, écriture service_role seulement → écriture par RPC réservées aux admins.
--   Clés étrangères vers title_fragments : fragment_words, user_fragments, fragment_tag_affinities,
--   fragment_ability_uses, enigmas, users.signe_fragment_id.

ALTER TABLE public.title_fragments
  ADD COLUMN IF NOT EXISTS shopify_handle text UNIQUE,      -- system.handle du métaobjet illustrations (la clé, .claude/rules/supabase.md)
  ADD COLUMN IF NOT EXISTS shopify_collection text,         -- handle de la collection Shopify
  ADD COLUMN IF NOT EXISTS resume text,
  ADD COLUMN IF NOT EXISTS histoire text,                   -- valeur brute de son_histoire
  ADD COLUMN IF NOT EXISTS illustration_url text,           -- image_pour_fond_clair
  ADD COLUMN IF NOT EXISTS illustration_sombre_url text,    -- image_pour_fond_sombre
  ADD COLUMN IF NOT EXISTS fond_url text,                   -- image_fond_de_fragment
  ADD COLUMN IF NOT EXISTS audio_url text,                  -- fragment_audio
  ADD COLUMN IF NOT EXISTS artiste text,
  ADD COLUMN IF NOT EXISTS narrateur text,
  ADD COLUMN IF NOT EXISTS heritage text,                   -- collection d'héritage
  ADD COLUMN IF NOT EXISTS synchronise_le timestamptz,
  ADD COLUMN IF NOT EXISTS origine_lat double precision,    -- posée dans le Hub
  ADD COLUMN IF NOT EXISTS origine_lng double precision,
  ADD COLUMN IF NOT EXISTS origine_nom text;

DELETE FROM public.fragment_words WHERE fragment_id = 10;
DELETE FROM public.title_fragments WHERE id = 10 AND name = 'Ambassadeur';
UPDATE public.title_fragments SET visible = true WHERE id = 14 AND name = 'Jeanne de Flandre';

-- La synchro : le Hub lit les métaobjets par son proxy Shopify et les envoie ici, un objet par
-- métaobjet. Appariement par handle s'il est déjà connu, sinon par la collection du lien. Renvoie
-- le nombre de Fragments mis à jour.
CREATE OR REPLACE FUNCTION public.synchroniser_fragments(p_illustrations jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
      synchronise_le = now()
    WHERE f.shopify_handle = v_ill->>'handle'
       OR (f.shopify_handle IS NULL AND v_ill->>'collection' <> ''
           AND lower(f.link_url) LIKE '%/collections/' || lower(v_ill->>'collection'));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;
  END LOOP;
  RETURN v_total;
END $$;

-- Un motif Shopify devient un Fragment : la ligne naît avec son nom et le lien de sa collection,
-- la synchro suivante la remplit.
CREATE OR REPLACE FUNCTION public.ajouter_fragment(p_nom text, p_collection text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_id integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p_collection), '') = '' THEN
    RAISE EXCEPTION 'Ce motif n''a pas de collection Shopify';
  END IF;
  INSERT INTO title_fragments (name, link_url, visible)
  VALUES (p_nom, 'https://runesdechene.com/collections/' || btrim(p_collection), true)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Ce que le Hub règle lui-même : l'origine et la visibilité. Le contenu vient de Shopify.
CREATE OR REPLACE FUNCTION public.enregistrer_fragment(
  p_id integer, p_origine_lat double precision, p_origine_lng double precision,
  p_origine_nom text, p_visible boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  IF (p_origine_lat IS NULL) <> (p_origine_lng IS NULL) THEN
    RAISE EXCEPTION 'Une origine a une latitude et une longitude, ou aucune';
  END IF;
  UPDATE title_fragments SET
    origine_lat = p_origine_lat,
    origine_lng = p_origine_lng,
    origine_nom = nullif(btrim(p_origine_nom), ''),
    visible = p_visible
  WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.synchroniser_fragments(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ajouter_fragment(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enregistrer_fragment(integer, double precision, double precision, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.synchroniser_fragments(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ajouter_fragment(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enregistrer_fragment(integer, double precision, double precision, text, boolean) TO authenticated;
