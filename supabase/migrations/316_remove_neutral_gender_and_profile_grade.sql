-- 316_remove_neutral_gender_and_profile_grade.sql
-- WHY : (1) suppression définitive du genre neutre des titres (jamais utilisé/utilisable) — title_gender
-- limité à 'm'/'f', set_title_gender rejette 'n'. (2) libellé de grade pour le profil joueur via une
-- petite RPC dédiée (évite de réécrire le géant get_player_profile). ADDITIF.

-- ── (1) genre = masculin/féminin uniquement ──
UPDATE public.users SET title_gender = 'm' WHERE title_gender NOT IN ('m','f');
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_title_gender_check;
ALTER TABLE public.users ADD CONSTRAINT users_title_gender_check CHECK (title_gender IN ('m','f'));

CREATE OR REPLACE FUNCTION public.set_title_gender(p_gender text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF p_gender NOT IN ('m','f') THEN RETURN json_build_object('error','bad_gender'); END IF;
  UPDATE public.users SET title_gender = p_gender WHERE id = auth.uid()::text;
  RETURN json_build_object('success', true, 'titleGender', p_gender);
END;$$;

-- ── (2) libellé de grade d'un membre dans sa Compagnie principale (pour le profil) ──
-- NULL si le joueur n'a pas de Compagnie. Accordé à son genre.
CREATE OR REPLACE FUNCTION public.get_member_grade_label(p_user_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public._grade_label(u.faction_id, public._member_grade_rank(p_user_id, u.faction_id), COALESCE(u.title_gender,'m'))
  FROM public.users u WHERE u.id = p_user_id AND u.faction_id IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.get_member_grade_label(text) TO authenticated, service_role, anon;
