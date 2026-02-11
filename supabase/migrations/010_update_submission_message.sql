-- ============================================
-- FONCTION : Modifier le message d'une soumission photo
-- ============================================

CREATE OR REPLACE FUNCTION public.update_submission_message(
  p_submission_id UUID,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE hub_photo_submissions
  SET message = p_message
  WHERE id = p_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_submission_message TO authenticated;
