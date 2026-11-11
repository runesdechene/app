-- WHY: la fiche produit de la boutique affiche les avis de son vêtement (maquette « Boutique — Avis »,
-- validée le 11/11), à la place de Judge.me. Le type Shopify d'un produit est le nom de son modèle
-- (« Le Confort », « L'Ancestral »…) : une table le relie au vêtement, et un modèle qui en remplace un
-- autre (Crafter → Breezer) garde les avis en ajoutant sa ligne. Les débardeurs n'ont pas de vêtement.
-- SCHEMA CHECKED (2026-11-11) : hub_photo_submissions (id, submitter_name, submitter_email, message, status,
--   created_at, rating_products, rating_experience, garment_type) ; hub_submission_images (submission_id,
--   image_url, sort_order, created_at, show_in_review) ; user_fragments.user_id ; users (id, email_address,
--   supprime_le) — information_schema et hub_contributions (588).

CREATE TABLE public.vetements_shopify (
  type_shopify text PRIMARY KEY,
  vetement text NOT NULL CHECK (vetement IN ('tshirt', 'sweatshirt', 'veste_zip'))
);
ALTER TABLE public.vetements_shopify ENABLE ROW LEVEL SECURITY;

INSERT INTO public.vetements_shopify (type_shopify, vetement) VALUES
  ('Le Confort', 'tshirt'), ('L''Ancestral', 'tshirt'),
  ('Le Moelleux', 'sweatshirt'), ('L''Éternel', 'sweatshirt'),
  ('Le Zippé', 'veste_zip');

-- Les avis publiés du vêtement d'un type Shopify : la note moyenne, le nombre, et les 30 plus récents
-- (prénom et initiale, jamais l'e-mail ; « verifie » : l'e-mail a un compte qui porte un Fragment ;
-- les photos cochées « Avis » dans le Hub, avec leur vignette). Rien pour un type sans vêtement.
CREATE OR REPLACE FUNCTION public.avis_du_vetement(p_type_shopify text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vetement text;
BEGIN
  SELECT vetement INTO v_vetement FROM vetements_shopify WHERE type_shopify = btrim(p_type_shopify);
  IF v_vetement IS NULL THEN RETURN NULL; END IF;

  RETURN (
    WITH publies AS (
      SELECT s.*, COALESCE(s.rating_products, s.rating_experience) AS note
        FROM hub_photo_submissions s
       WHERE s.status = 'approved' AND s.garment_type = v_vetement
         AND (s.rating_products IS NOT NULL OR s.rating_experience IS NOT NULL OR NULLIF(btrim(s.message), '') IS NOT NULL)
    )
    SELECT jsonb_build_object(
      'vetement', v_vetement,
      'note', (SELECT round(avg(note), 1) FROM publies),
      'nombre', (SELECT count(*) FROM publies),
      'avis', COALESCE((
        SELECT jsonb_agg(a ORDER BY a->>'quand' DESC)
          FROM (
            SELECT jsonb_build_object(
                     'texte', NULLIF(btrim(p.message), ''),
                     'note', p.note,
                     'nom', CASE WHEN btrim(p.submitter_name) ~ ' '
                                 THEN initcap(split_part(btrim(p.submitter_name), ' ', 1)) || ' '
                                      || upper(left(regexp_replace(btrim(p.submitter_name), '^.* ', ''), 1)) || '.'
                                 ELSE initcap(btrim(p.submitter_name)) END,
                     'quand', p.created_at,
                     'verifie', EXISTS (SELECT 1 FROM user_fragments uf JOIN users u ON u.id = uf.user_id
                                         WHERE lower(u.email_address) = lower(p.submitter_email)
                                           AND u.supprime_le IS NULL),
                     'photos', COALESCE((
                       SELECT jsonb_agg(jsonb_build_object(
                                'url', i.image_url,
                                'vignette', regexp_replace(i.image_url, '\.(webp|jpe?g|png)$', '_thumb.webp', 'i'))
                                ORDER BY i.sort_order, i.created_at)
                         FROM hub_submission_images i
                        WHERE i.submission_id = p.id AND i.show_in_review), '[]'::jsonb)
                   ) AS a
              FROM publies p
             ORDER BY p.created_at DESC
             LIMIT 30
          ) t
      ), '[]'::jsonb)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.avis_du_vetement(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avis_du_vetement(text) TO anon, authenticated;
