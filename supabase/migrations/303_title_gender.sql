-- 303_title_gender.sql
-- WHY : accorder les libellés de grade (Seigneur/Dame…) au genre choisi par le joueur.
-- Préférence d'affichage personnelle, réglée au profil, défaut masculin (décision Uriel 25/06).
-- Réutilisable ensuite partout (classes, hauts-faits, toasts). ADDITIF.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS title_gender text NOT NULL DEFAULT 'm'
  CHECK (title_gender IN ('m','f','n'));

CREATE OR REPLACE FUNCTION public.set_title_gender(p_gender text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF p_gender NOT IN ('m','f','n') THEN RETURN json_build_object('error','bad_gender'); END IF;
  UPDATE public.users SET title_gender = p_gender WHERE id = auth.uid()::text;
  RETURN json_build_object('success', true, 'titleGender', p_gender);
END;$$;

GRANT EXECUTE ON FUNCTION public.set_title_gender(text) TO authenticated, service_role;
