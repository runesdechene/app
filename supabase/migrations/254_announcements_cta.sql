-- 254_announcements_cta.sql
-- WHY : Bouton CTA en fin d'annonce (spec 2026-06-15). Deux colonnes nullables
-- portées par la table `announcements` (mig 219). Les RPCs de lecture
-- (get_announcement_by_slug, list_announcements_admin) renvoient la ligne
-- entière -> elles exposent automatiquement cta_url/cta_label. Seule
-- update_announcement doit gagner deux params pour les écrire.
-- Base : def LIVE de update_announcement (identique à mig 219, vérifié 2026-06-15
-- via pg_get_functiondef) + delta CTA uniquement.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS cta_url   text,
  ADD COLUMN IF NOT EXISTS cta_label text;

-- L'ancienne signature 7-args doit disparaître pour éviter une surcharge ambiguë.
DROP FUNCTION IF EXISTS public.update_announcement(uuid,text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.update_announcement(
  p_id            uuid,
  p_title         text,
  p_body          text,
  p_cover_image   text,
  p_push_text     text,
  p_insta_caption text,
  p_type          text,
  p_cta_url       text,
  p_cta_label     text
)
RETURNS public.announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.announcements;
  v_url text;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;

  -- Validation légère de l'URL : http(s) uniquement, sinon NULL (pas de
  -- bouton cassé / pas de javascript:).
  v_url := nullif(btrim(coalesce(p_cta_url, '')), '');
  IF v_url IS NOT NULL AND v_url !~* '^https?://' THEN
    v_url := NULL;
  END IF;

  UPDATE public.announcements SET
    title         = coalesce(p_title, title),
    body          = coalesce(p_body, body),
    cover_image   = p_cover_image,
    push_text     = p_push_text,
    insta_caption = p_insta_caption,
    type          = CASE WHEN p_type IN ('produit','app','marque') THEN p_type ELSE type END,
    cta_url       = v_url,
    cta_label     = nullif(btrim(coalesce(p_cta_label, '')), '')
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.update_announcement(uuid,text,text,text,text,text,text,text,text) TO authenticated;
