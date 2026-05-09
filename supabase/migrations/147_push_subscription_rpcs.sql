-- 147_push_subscription_rpcs.sql
-- WHY : pattern RdC = écritures via RPC SECURITY DEFINER, pas direct upsert
-- côté client (RLS-bypass propre). Les ids RdC sont varchar et `auth.uid()`
-- est en uuid : on dérive user_id depuis auth.uid() côté serveur, sans laisser
-- le client le passer (évite usurpation).
--
-- Un user 'shopify-*' (pas d'auth.uid()) ne peut pas register de push sub.
-- C'est OK pour V1 — seuls les users authentifiés Supabase ont des notifs push.

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text;
  v_id      integer;
BEGIN
  v_user_id := (auth.uid())::text;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF p_endpoint IS NULL OR p_p256dh IS NULL OR p_auth IS NULL THEN
    RETURN jsonb_build_object('error', 'missing_keys');
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, last_seen_at)
  VALUES (v_user_id, p_endpoint, p_p256dh, p_auth, p_user_agent, now())
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id      = EXCLUDED.user_id,
        p256dh       = EXCLUDED.p256dh,
        auth         = EXCLUDED.auth,
        user_agent   = EXCLUDED.user_agent,
        last_seen_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.unregister_push_subscription(p_endpoint text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text;
  v_count   integer;
BEGIN
  v_user_id := (auth.uid())::text;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  DELETE FROM public.push_subscriptions
   WHERE endpoint = p_endpoint
     AND user_id  = v_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'deleted', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unregister_push_subscription(text) TO authenticated;
