-- 066_v07_veteran_welcomed_at.sql
-- WHY: la modale "Une nouvelle ère commence — Vétéran" se ré-affichait à chaque
--      lancement de l'app en prod (Uriel 2026-05-02). La marque "déjà vue"
--      était stockée en localStorage, qui est purgé par le service worker PWA
--      à chaque mise à jour. Solution : persister en DB.
--
-- Colonne veteran_welcomed_at sur users (timestamptz null = pas encore accepté,
-- non-null = accepté à cette date). RPC dismiss_veteran_welcome qui le set à NOW
-- pour le user courant.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS veteran_welcomed_at timestamptz;

CREATE OR REPLACE FUNCTION public.dismiss_veteran_welcome()
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  UPDATE public.users
    SET veteran_welcomed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_user_id;
  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_veteran_welcome() TO authenticated;
