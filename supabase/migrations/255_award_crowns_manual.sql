-- 255_award_crowns_manual.sql
-- WHY : Récompense MANUELLE admin (spec 2026-06-15). Crédite des Couronnes à un
-- joueur depuis le hub avec un motif, SANS plafond (un don admin est volontaire,
-- contrairement aux récompenses auto plafonnées à 500). Insère une notif
-- 'crowns_awarded' (montant + motif) qui déclenche l'email Resend via le trigger
-- email_on_notification existant (mig 175) et s'affiche in-app. Canal distinct
-- des récompenses UGC : ne touche ni contributions_count ni la Gloire.

CREATE OR REPLACE FUNCTION public.award_crowns_manual(
  p_user_id text,
  p_amount  int,
  p_reason  text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reason  text;
  v_balance int;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF coalesce(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;

  v_reason := btrim(coalesce(p_reason, ''));
  IF v_reason = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Crédit SANS plafond (pas de LEAST(500, ...)).
  INSERT INTO public.user_crowns (user_id, balance, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id) DO UPDATE SET
    balance = public.user_crowns.balance + p_amount,
    updated_at = now()
  RETURNING balance INTO v_balance;

  INSERT INTO public.notifications (recipient_id, type, data)
  VALUES (p_user_id, 'crowns_awarded',
          jsonb_build_object('crowns', p_amount, 'reason', v_reason));

  RETURN jsonb_build_object('balance', v_balance);
END; $$;
GRANT EXECUTE ON FUNCTION public.award_crowns_manual(text, int, text) TO authenticated;
