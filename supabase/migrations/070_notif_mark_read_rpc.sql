-- 070_notif_mark_read_rpc.sql
-- RPC to mark all notifications as read for the calling user

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE notifications SET read = TRUE
  WHERE recipient_id = p_user_id AND read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'markedRead', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notifications_read(TEXT) TO authenticated;
