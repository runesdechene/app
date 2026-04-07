-- 046_new_user_trigger_avatar.sql
-- Ajouter avatar_url dans le trigger new_user pour les toasts

CREATE OR REPLACE FUNCTION log_new_user_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(NEW.display_name, NEW.first_name, NEW.email_address);

  INSERT INTO activity_log (type, actor_id, data)
  VALUES (
    'new_user',
    NEW.id,
    jsonb_build_object(
      'actorName', v_name,
      'actorAvatarUrl', NEW.avatar_url
    )
  );
  RETURN NEW;
END;
$$;
