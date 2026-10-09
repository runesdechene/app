-- 353 — Préférences de la V2 et titres portés (deux au plus)
--
-- WHY : zone Compte. Deux nouveaux interrupteurs (montrer son département, montrer ses envies),
-- une lecture de ses propres préférences (les nouvelles colonnes ne sont pas accordées à
-- `authenticated`, mig 337 §4), une écriture par liste blanche de clés. Titres portés : la V2 en
-- autorise deux, choisis parmi ses titres généraux débloqués. Aucune de ces fonctions ne prend
-- d'identifiant : elles lisent auth.uid() (règle de l'audit du 27/09/2026).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS show_departement boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_envies boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_my_preferences()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'email', u.email_address,
    'brouillerPistes', u.brouiller_pistes,
    'pushImportant', u.push_important_enabled,
    'pushRecap', u.push_recap_enabled,
    'showDepartement', u.show_departement,
    'showEnvies', u.show_envies,
    'titleGender', u.title_gender
  )
  FROM public.users u
  WHERE u.id = (auth.uid())::text;
$$;
REVOKE ALL ON FUNCTION public.get_my_preferences() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_preferences() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_preference(p_cle text, p_valeur boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF p_valeur IS NULL THEN
    RAISE EXCEPTION 'Valeur manquante' USING ERRCODE = '22004';
  END IF;
  CASE p_cle
    WHEN 'show_departement'       THEN UPDATE users SET show_departement = p_valeur       WHERE id = (auth.uid())::text;
    WHEN 'show_envies'            THEN UPDATE users SET show_envies = p_valeur            WHERE id = (auth.uid())::text;
    WHEN 'push_important_enabled' THEN UPDATE users SET push_important_enabled = p_valeur WHERE id = (auth.uid())::text;
    WHEN 'push_recap_enabled'     THEN UPDATE users SET push_recap_enabled = p_valeur     WHERE id = (auth.uid())::text;
    ELSE RAISE EXCEPTION 'Préférence inconnue : %', p_cle USING ERRCODE = '22023';
  END CASE;
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_preference(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_preference(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_displayed_titles(p_title_ids integer[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids integer[] := COALESCE(p_title_ids, '{}');
  v_debloques integer[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF cardinality(v_ids) > 2 THEN
    RAISE EXCEPTION 'Deux titres au plus' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg((t->>'id')::int), '{}') INTO v_debloques
    FROM json_array_elements(public.get_user_titles((auth.uid())::text) -> 'unlockedGeneralTitles') t;
  IF NOT (v_ids <@ v_debloques) THEN
    RAISE EXCEPTION 'Titre non débloqué' USING ERRCODE = '42501';
  END IF;
  UPDATE users SET displayed_title_ids_v3 = v_ids WHERE id = (auth.uid())::text;
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_displayed_titles(integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_displayed_titles(integer[]) TO authenticated;
