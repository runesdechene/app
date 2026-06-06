-- 220_announcements_broadcast_push.sql
-- WHY : Canal Push de la spec annonces. broadcast_announcement_push() fait un fan-out
-- (1 notification par user opt-in) ; le trigger push existant (mig 142) prend le relais
-- par utilisateur. On réutilise push_important_enabled comme opt-out (décision Phase 1).
-- Le payload pointe le deeplink /article/:slug (lecteur in-app). Même pattern éprouvé
-- que le cron daily_enigma_lunch_push (mig 144).
--
--   - admin only · l'annonce doit être 'published' · trace channels.push = 'sent'
--   - le trigger email (email_on_notification) ignore ce type → pas d'email parasite
--   - clé app_settings.shopify_blog_id (configurable) posée ici pour le canal Blog.

INSERT INTO public.app_settings (key, value)
VALUES ('shopify_blog_id', '')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.broadcast_announcement_push(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ann   public.announcements;
  v_count int;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;

  SELECT * INTO v_ann FROM public.announcements WHERE id = p_id;
  IF v_ann.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_ann.status <> 'published' THEN RAISE EXCEPTION 'not_published'; END IF;

  -- Fan-out : 1 notification par user opt-in actif. Le trigger push fait le reste.
  INSERT INTO public.notifications (recipient_id, type, data)
  SELECT u.id,
         'announcement',
         jsonb_build_object(
           'announcement_id', v_ann.id,
           'slug',            v_ann.slug,
           'title',           v_ann.title,
           'push_text',       v_ann.push_text
         )
    FROM public.users u
   WHERE u.push_important_enabled = true
     AND u.is_active = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Trace le canal push comme envoyé.
  UPDATE public.announcements
     SET channels = channels || '{"push":"sent"}'::jsonb
   WHERE id = p_id;

  RETURN jsonb_build_object('success', true, 'recipients', v_count);
END; $$;
GRANT EXECUTE ON FUNCTION public.broadcast_announcement_push(uuid) TO authenticated;
