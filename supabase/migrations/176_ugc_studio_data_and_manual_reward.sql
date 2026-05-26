-- 176_ugc_studio_data_and_manual_reward.sql
-- WHY : Brique 1bis-A. Recompense MANUELLE a la validation (remplace le montant fixe mig 175),
-- curation + produit + taille PAR PHOTO, et departement/quete/reward_crowns sur l'envoi.

-- ===== Schema : par photo =====
ALTER TABLE public.hub_submission_images
  ADD COLUMN IF NOT EXISTS size         text,            -- taille saisie ; 'none' = aucun produit porte ; NULL = non renseigne
  ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS product_worn text;            -- produit tague au hub, par photo
ALTER TABLE public.hub_submission_images DROP CONSTRAINT IF EXISTS hub_submission_images_status_check;
ALTER TABLE public.hub_submission_images
  ADD CONSTRAINT hub_submission_images_status_check CHECK (status IN ('pending','approved','archived'));

-- ===== Schema : par envoi =====
ALTER TABLE public.hub_photo_submissions
  ADD COLUMN IF NOT EXISTS departement   text,
  ADD COLUMN IF NOT EXISTS quest_ref     text,
  ADD COLUMN IF NOT EXISTS reward_crowns int;
ALTER TABLE public.hub_review_submissions
  ADD COLUMN IF NOT EXISTS reward_crowns int;

-- ===== RPC : moderation photos, montant MANUEL (drop ancienne signature puis recree) =====
DROP FUNCTION IF EXISTS public.moderate_submission(uuid, text);
CREATE OR REPLACE FUNCTION public.moderate_submission(p_submission_id uuid, p_status text, p_crowns int DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  text;
  v_rewarded timestamptz;
  v_amount   int;
BEGIN
  UPDATE hub_photo_submissions SET status = p_status, moderated_at = NOW()
  WHERE id = p_submission_id RETURNING user_id, rewarded_at INTO v_user_id, v_rewarded;

  IF p_status = 'approved' AND v_rewarded IS NULL AND v_user_id IS NOT NULL THEN
    v_amount := GREATEST(0, COALESCE(p_crowns, 0));
    IF v_amount > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_user_id, LEAST(500, v_amount), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + v_amount), updated_at = now();
    END IF;
    UPDATE users SET contributions_count = contributions_count + 1 WHERE id = v_user_id;
    UPDATE hub_photo_submissions SET rewarded_at = now(), reward_crowns = v_amount WHERE id = p_submission_id;
    INSERT INTO notifications (recipient_id, type, data)
    VALUES (v_user_id, 'contribution_approved',
            jsonb_build_object('kind','photo','submission_id',p_submission_id,'crowns',v_amount));
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.moderate_submission(uuid, text, int) TO anon, authenticated, service_role;

-- ===== RPC : moderation avis, montant MANUEL =====
DROP FUNCTION IF EXISTS public.moderate_review(uuid, text, text);
CREATE OR REPLACE FUNCTION public.moderate_review(p_review_id uuid, p_status text, p_rejection_reason text DEFAULT NULL, p_crowns int DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  text;
  v_rewarded timestamptz;
  v_amount   int;
BEGIN
  UPDATE hub_review_submissions SET status = p_status, moderated_at = NOW(), rejection_reason = p_rejection_reason
  WHERE id = p_review_id RETURNING user_id, rewarded_at INTO v_user_id, v_rewarded;

  IF p_status = 'approved' AND v_rewarded IS NULL AND v_user_id IS NOT NULL THEN
    v_amount := GREATEST(0, COALESCE(p_crowns, 0));
    IF v_amount > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_user_id, LEAST(500, v_amount), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + v_amount), updated_at = now();
    END IF;
    UPDATE users SET contributions_count = contributions_count + 1 WHERE id = v_user_id;
    UPDATE hub_review_submissions SET rewarded_at = now(), reward_crowns = v_amount WHERE id = p_review_id;
    INSERT INTO notifications (recipient_id, type, data)
    VALUES (v_user_id, 'contribution_approved',
            jsonb_build_object('kind','review','submission_id',p_review_id,'crowns',v_amount));
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.moderate_review(uuid, text, text, int) TO anon, authenticated, service_role;

-- ===== RPC : curation par photo (statut affichage) =====
CREATE OR REPLACE FUNCTION public.set_submission_image_status(p_image_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF p_status NOT IN ('pending','approved','archived') THEN
    RAISE EXCEPTION 'invalid status %', p_status;
  END IF;
  UPDATE hub_submission_images SET status = p_status WHERE id = p_image_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_submission_image_status(uuid, text) TO anon, authenticated, service_role;

-- ===== RPC : produit porte par photo (tague au hub) =====
CREATE OR REPLACE FUNCTION public.set_submission_image_product(p_image_id uuid, p_product text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE hub_submission_images SET product_worn = NULLIF(btrim(p_product), '') WHERE id = p_image_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_submission_image_product(uuid, text) TO anon, authenticated, service_role;
