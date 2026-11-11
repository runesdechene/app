-- WHY: « Guillaume .. » : l'initiale de la 595 prenait le premier signe du dernier mot, même sans lettre.
-- Elle prend maintenant la première lettre du dernier mot ; sans lettre, le prénom seul.
-- SCHEMA CHECKED (2026-11-11) : définition de départ = 595, appliquée le jour même.

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
                     -- « Raphaël Barzyk » → « Raphaël B. » ; sans lettre au dernier mot, le prénom seul.
                     'nom', initcap(split_part(btrim(p.submitter_name), ' ', 1))
                            || CASE WHEN btrim(p.submitter_name) ~ '\s\S*[[:alpha:]]\S*$'
                                    THEN ' ' || upper(substring(regexp_replace(btrim(p.submitter_name), '^.*\s', '') from '[[:alpha:]]')) || '.'
                                    ELSE '' END,
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
