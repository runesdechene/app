-- ============================================
-- MIGRATION 113 : Titre produit sur les ecrans pub
-- ============================================

ALTER TABLE ad_screens ADD COLUMN IF NOT EXISTS title TEXT;

-- Mettre a jour la RPC pour retourner le titre
CREATE OR REPLACE FUNCTION public.get_random_ad()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_screen JSON;
  v_tip JSON;
BEGIN
  SELECT json_build_object('id', id, 'imageUrl', image_url, 'productUrl', product_url, 'title', title)
  INTO v_screen
  FROM ad_screens
  WHERE active = true
  ORDER BY random()
  LIMIT 1;

  SELECT json_build_object('id', id, 'title', title, 'subtitle', subtitle, 'tag', tag)
  INTO v_tip
  FROM ad_tips
  WHERE active = true
  ORDER BY random()
  LIMIT 1;

  IF v_screen IS NULL OR v_tip IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object('screen', v_screen, 'tip', v_tip);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_ad() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_random_ad() TO anon;
