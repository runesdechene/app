-- 344 — Accès à la V2, compte par compte
--
-- WHY : la V2 (apps/web-v2) est servie sous /v2/ à côté de la V1. Pendant sa construction,
-- seuls les admins, puis une poignée de comptes cochés dans le Hub, doivent pouvoir l'ouvrir.
-- Ce verrou règle l'AFFICHAGE, pas la sécurité : la V2 passe par les mêmes RLS que la V1.
--
-- `authenticated` n'a que des droits SELECT par colonne sur users (mig 337, §4) : la nouvelle
-- colonne ne lui est pas accordée, et c'est voulu — on la lit via has_v2_access().

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS v2_access boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.v2_access IS
  'Autorise ce compte à ouvrir la V2 (/v2/) pendant sa construction. Les admins y ont accès d''office.';

-- 1. La V2 demande : « l'appelant peut-il entrer ? »
CREATE OR REPLACE FUNCTION public.has_v2_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
     WHERE users.id::text = (auth.uid())::text
       AND (users.role::text = 'admin' OR users.v2_access)
  );
$$;

REVOKE ALL ON FUNCTION public.has_v2_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_v2_access() TO authenticated;

-- 2. Le Hub coche ou décoche un compte. Admin seulement.
CREATE OR REPLACE FUNCTION public.set_v2_access(p_user_id text, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public._is_admin() THEN
    RAISE EXCEPTION 'set_v2_access : réservé aux admins' USING ERRCODE = '42501';
  END IF;

  UPDATE public.users
     SET v2_access = p_enabled,
         updated_at = now()
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'set_v2_access : compte % introuvable', p_user_id USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_v2_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_v2_access(text, boolean) TO authenticated;

-- 3. users_admin est un SELECT * figé à sa création (mig 337) : sans le rejouer, le Hub ne
--    verrait pas v2_access. Définition live relevée le 27/09/2026 (identique à la mig 337) ;
--    la colonne s'ajoute en fin de liste, ce que CREATE OR REPLACE VIEW autorise.
CREATE OR REPLACE VIEW public.users_admin AS
  SELECT *
    FROM public.users
   WHERE public._is_staff()
      OR (SELECT auth.role()) = 'service_role';

ALTER VIEW public.users_admin SET (security_invoker = off);
REVOKE ALL ON public.users_admin FROM anon;
GRANT SELECT ON public.users_admin TO authenticated, service_role;
