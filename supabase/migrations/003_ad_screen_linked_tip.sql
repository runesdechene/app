-- MIGRATION 003 : Liaison image ↔ texte sur les pubs
-- ====================================================================
-- Permet de verrouiller un tip à un screen pour qu'ils s'affichent
-- toujours ensemble. Si linked_tip_id est NULL, le tip est aléatoire.
-- ====================================================================

-- 1) Ajouter la colonne
ALTER TABLE ad_screens
ADD COLUMN linked_tip_id INT REFERENCES ad_tips(id) ON DELETE SET NULL;

-- 2) Recréer get_random_ad avec la logique de liaison
CREATE OR REPLACE FUNCTION public.get_random_ad()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_screen RECORD;
  v_screen_json JSON;
  v_tip_json JSON;
BEGIN
  -- Piocher un screen actif au hasard
  SELECT id, image_url, product_url, title, linked_tip_id
  INTO v_screen
  FROM ad_screens
  WHERE active = true
  ORDER BY random()
  LIMIT 1;

  IF v_screen IS NULL THEN
    RETURN NULL;
  END IF;

  v_screen_json := json_build_object(
    'id', v_screen.id,
    'imageUrl', v_screen.image_url,
    'productUrl', v_screen.product_url,
    'title', v_screen.title
  );

  -- Si le screen a un tip lié, l'utiliser
  IF v_screen.linked_tip_id IS NOT NULL THEN
    SELECT json_build_object('id', id, 'title', title, 'subtitle', subtitle, 'tag', tag)
    INTO v_tip_json
    FROM ad_tips
    WHERE id = v_screen.linked_tip_id AND active = true;
  END IF;

  -- Sinon (ou si le tip lié est inactif), piocher un tip libre
  IF v_tip_json IS NULL THEN
    SELECT json_build_object('id', id, 'title', title, 'subtitle', subtitle, 'tag', tag)
    INTO v_tip_json
    FROM ad_tips
    WHERE active = true
      AND id NOT IN (
        SELECT linked_tip_id FROM ad_screens
        WHERE linked_tip_id IS NOT NULL AND active = true
      )
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- Dernier recours : n'importe quel tip actif (si tous sont liés)
  IF v_tip_json IS NULL THEN
    SELECT json_build_object('id', id, 'title', title, 'subtitle', subtitle, 'tag', tag)
    INTO v_tip_json
    FROM ad_tips
    WHERE active = true
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_tip_json IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object('screen', v_screen_json, 'tip', v_tip_json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_ad() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_random_ad() TO anon;
