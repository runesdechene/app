-- 337 — Les emails ne sont plus lisibles que par le staff
--
-- WHY : suite de la mig 336. `anon` ne pouvait plus aspirer users.email_address,
-- mais le role `authenticated` — c'est-a-dire N'IMPORTE QUEL compte joueur
-- connecte, 4904 comptes — gardait le SELECT complet et pouvait sortir le
-- fichier d'adresses entier via /rest/v1/users?select=email_address.
-- Le balayage de toutes les colonnes « email » du schema a par ailleurs montre
-- deux autres fuites :
--   * purchase_log : sa seule policy (« Service role can manage purchase_log »)
--     a ete creee sans clause TO -> elle s'applique a PUBLIC. `anon` lisait donc
--     les adresses de tous les acheteurs. Verifie en prod le 6 aout 2026.
--   * hub_photo_submissions : la policy « Approved submissions are public »
--     exposait submitter_email a `anon` sur toute soumission approuvee.
--
-- On ne pouvait pas simplement couper `authenticated` : le back-office (hub)
-- tourne avec ce meme role et a besoin des emails. D'ou la vue `users_admin`,
-- gardee par `_is_staff()`, que le hub utilise en lecture a la place de `users`.
--
-- QUOI :
--   1. `_is_staff()` — admin ou moderateur, SECURITY DEFINER.
--   2. `get_my_user_row()` — l'app identifie le joueur au demarrage sans avoir
--      besoin de lire email_address (elle filtrait sur cette colonne).
--   3. vue `users_admin` — lecture complete, staff uniquement (+ service_role).
--   4. `authenticated` perd email_address et password sur `users`.
--   5. purchase_log : policy PUBLIC remplacee par service_role + staff.
--   6. photos communautaires : policies moderateur passees par `_is_staff()`
--      (elles lisaient `users` en direct et cassaient depuis la mig 336), et les
--      colonnes email retirees a anon/authenticated.
--   7. flyer_signup_log.email retire a anon/authenticated.
--
-- ⚠ DENY BY DEFAULT : depuis cette migration, `users` n'est plus GRANTee au
-- niveau table a anon/authenticated mais colonne par colonne. Toute NOUVELLE
-- colonne de `users` devra etre explicitement GRANTee (voir docs/db/gotchas.md).

-- ---------------------------------------------------------------------------
-- 1. Qui est staff ?
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER volontaire : appele depuis des policies RLS evaluees par
-- `anon`, qui n'a plus le droit de lire `users` (mig 336). Sans ca la policy
-- ne renvoie pas « faux », elle plante avec « permission denied for table users ».

CREATE OR REPLACE FUNCTION public._is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
     WHERE users.id::text = (auth.uid())::text
       AND users.role::text IN ('admin', 'moderator')
  );
$$;

COMMENT ON FUNCTION public._is_staff() IS
  'true si le caller est admin ou moderateur. A utiliser dans les policies plutot
   qu''un EXISTS inline sur users, que `anon` n''a plus le droit de lire (mig 337).';

-- ---------------------------------------------------------------------------
-- 2. Identification du joueur au demarrage, sans lire son email
-- ---------------------------------------------------------------------------
-- usePlayer.ts faisait `.eq('email_address', user.email)` : filtrer sur une
-- colonne exige le SELECT dessus, ce qui interdisait de la retirer.
-- L'ordre uid -> email reproduit exactement l'ancien comportement, y compris
-- le cas des comptes hérités de Firebase dont l'id en base n'est pas l'auth.uid
-- (le front compare l'id retourne a son auth.uid et declenche la migration).

CREATE OR REPLACE FUNCTION public.get_my_user_row()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid   text := (auth.uid())::text;
  v_email text := auth.email();
  v_row   public.users%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row FROM public.users WHERE id = v_uid LIMIT 1;

  IF v_row.id IS NULL AND v_email IS NOT NULL THEN
    SELECT * INTO v_row
      FROM public.users
     WHERE LOWER(email_address) = LOWER(v_email)
     LIMIT 1;
  END IF;

  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id',                    v_row.id,
    'faction_id',            v_row.faction_id,
    'first_name',            v_row.first_name,
    'avatar_url',            v_row.avatar_url,
    'tutorial_completed_at', v_row.tutorial_completed_at,
    'brouiller_pistes',      v_row.brouiller_pistes,
    'title_gender',          v_row.title_gender
  );
END;
$$;

COMMENT ON FUNCTION public.get_my_user_row() IS
  'Ligne users du caller (auth.uid, sinon email du JWT). Sans email_address :
   c''est ce qui permet de retirer cette colonne au role authenticated (mig 337).';

GRANT EXECUTE ON FUNCTION public.get_my_user_row() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Vue staff : le hub lit ici ce qu'il lisait dans `users`
-- ---------------------------------------------------------------------------
-- security_invoker = off (defaut) : la vue s'execute avec les droits de son
-- proprietaire, donc elle voit email_address meme apres le REVOKE du point 4.
-- Le garde-fou est dans le WHERE, pas dans les droits.

DROP VIEW IF EXISTS public.users_admin;

CREATE VIEW public.users_admin AS
  SELECT *
    FROM public.users
   WHERE public._is_staff()
      OR (SELECT auth.role()) = 'service_role';

ALTER VIEW public.users_admin SET (security_invoker = off);

COMMENT ON VIEW public.users_admin IS
  'Miroir de users reserve au staff (hub). Renvoie zero ligne a un joueur
   ordinaire. Les lectures du back-office passent par ici depuis la mig 337.';

GRANT SELECT ON public.users_admin TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. `authenticated` perd l'email et le mot de passe legacy
-- ---------------------------------------------------------------------------
-- Un REVOKE par colonne serait sans effet tant que le SELECT existe au niveau
-- TABLE : on retire le grant table, puis on re-accorde toutes les colonnes
-- sauf les deux sensibles.

DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'users'
     AND column_name NOT IN ('email_address', 'password');

  EXECUTE 'REVOKE SELECT ON public.users FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.users TO authenticated', v_cols);
END $$;

-- ---------------------------------------------------------------------------
-- 5. purchase_log — la policy « service role » s'appliquait a tout le monde
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Service role can manage purchase_log" ON public.purchase_log;

CREATE POLICY "Service role manages purchase_log"
  ON public.purchase_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Staff reads purchase_log"
  ON public.purchase_log FOR SELECT
  TO authenticated
  USING (public._is_staff());

CREATE POLICY "Staff writes purchase_log"
  ON public.purchase_log FOR INSERT
  TO authenticated
  WITH CHECK (public._is_staff());

CREATE POLICY "Staff deletes purchase_log"
  ON public.purchase_log FOR DELETE
  TO authenticated
  USING (public._is_staff());

-- ---------------------------------------------------------------------------
-- 6. Photos communautaires — policies via _is_staff() + colonnes email coupees
-- ---------------------------------------------------------------------------
-- Ces policies faisaient un EXISTS inline sur `users` : evaluees par `anon`,
-- elles renvoient « permission denied » depuis la mig 336 au lieu de zero ligne.

DROP POLICY IF EXISTS "Moderators can view all photos"        ON public.hub_community_photos;
DROP POLICY IF EXISTS "Moderators can update photos"          ON public.hub_community_photos;
DROP POLICY IF EXISTS "Moderators can view all submissions"   ON public.hub_photo_submissions;
DROP POLICY IF EXISTS "Moderators can update submissions"     ON public.hub_photo_submissions;

CREATE POLICY "Staff can view all photos"
  ON public.hub_community_photos FOR SELECT
  USING (public._is_staff());

CREATE POLICY "Staff can update photos"
  ON public.hub_community_photos FOR UPDATE
  USING (public._is_staff());

CREATE POLICY "Staff can view all submissions"
  ON public.hub_photo_submissions FOR SELECT
  USING (public._is_staff());

CREATE POLICY "Staff can update submissions"
  ON public.hub_photo_submissions FOR UPDATE
  USING (public._is_staff());

-- Personne cote front ne lit ces colonnes : le theme Shopify passe par les RPC
-- SECURITY DEFINER, le hub ne fait que compter les soumissions.
DO $$
DECLARE
  v_cols text;
  v_tbl  text;
  v_skip text;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['hub_community_photos', 'hub_photo_submissions', 'flyer_signup_log']
  LOOP
    v_skip := CASE v_tbl
                WHEN 'hub_community_photos'   THEN 'user_email'
                WHEN 'hub_photo_submissions'  THEN 'submitter_email'
                ELSE 'email'
              END;

    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO v_cols
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = v_tbl AND column_name <> v_skip;

    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', v_tbl);
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon, authenticated', v_cols, v_tbl);
  END LOOP;
END $$;
