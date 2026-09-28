-- 370 — L'onboarding d'Explore V2
--
-- WHY : les écrans d'entrée (maquettes Figma 94:107 à 95:107) : l'accueil compte les lieux et
--   les Explorateurs, la Charte se signe (au pouce maintenu), on se nomme, puis « Bienvenue,
--   Explorateur n° 4751 ».
--   1. users.charte_signee_le + signer_charte() : la Charte signée une fois, la date gardée.
--   2. nommer_explorateur(p_nom) : le seul nom, sans toucher au reste du profil
--      (update_my_profile réécrit tout ; ici, rien d'autre ne doit changer).
--   3. mon_entree() : ce que les derniers écrans montrent — le nom, le numéro d'Explorateur (le
--      rang de l'inscription), le nombre de Fragments, la Charte déjà signée ou non.
--   Les deux chiffres de l'accueil viennent de get_landing_stats (déjà ouvert à tous).
--
-- SCHEMA CHECKED (28/09/2026) : users(id varchar, display_name text, first_name varchar,
--   created_at) ; user_fragments(user_id varchar, fragment_id int).

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS charte_signee_le timestamptz;

CREATE OR REPLACE FUNCTION public.signer_charte()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  UPDATE users SET charte_signee_le = COALESCE(charte_signee_le, now())
  WHERE id = (auth.uid())::text;
END;
$$;
REVOKE ALL ON FUNCTION public.signer_charte() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signer_charte() TO authenticated;

CREATE OR REPLACE FUNCTION public.nommer_explorateur(p_nom text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nom text := NULLIF(btrim(p_nom), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF v_nom IS NULL OR char_length(v_nom) > 40 THEN
    RAISE EXCEPTION 'Nom invalide' USING ERRCODE = '22023';
  END IF;
  -- first_name reste la source de vérité de fait (règle supabase.md) : on écrit les deux.
  UPDATE users SET display_name = v_nom, first_name = v_nom WHERE id = (auth.uid())::text;
  RETURN v_nom;
END;
$$;
REVOKE ALL ON FUNCTION public.nommer_explorateur(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nommer_explorateur(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mon_entree()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'nom', NULLIF(COALESCE(NULLIF(u.display_name, ''), u.first_name), ''),
    'numero', (SELECT count(*) FROM users v WHERE v.created_at <= u.created_at),
    'fragments', (SELECT count(*) FROM user_fragments f WHERE f.user_id = u.id),
    'charteSignee', u.charte_signee_le IS NOT NULL)
  FROM users u
  WHERE u.id = (auth.uid())::text;
$$;
REVOKE ALL ON FUNCTION public.mon_entree() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mon_entree() TO authenticated;
