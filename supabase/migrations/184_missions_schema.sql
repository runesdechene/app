-- 184_missions_schema.sql
-- Missions à thème (pilotées Hub). Salon commun (adhésion ouverte) calqué sur le chat
-- d'Expédition (mig 104/107). Liaison UGC via hub_photo_submissions.quest_ref = missions.slug.

CREATE TABLE IF NOT EXISTS public.missions (
  slug            text PRIMARY KEY,
  title           text NOT NULL,
  eyebrow         text,
  call            text,
  brief           text,
  emblem          text DEFAULT '🎯',
  cover_image_url text,
  deliverable_kind text NOT NULL DEFAULT 'photo'
                   CHECK (deliverable_kind IN ('photo','video','other')),
  product_handle  text,
  cta_label       text,
  cta_url         text,
  starts_at       timestamptz, ends_at timestamptz,
  floor_glory     integer NOT NULL DEFAULT 0,
  floor_crowns    integer NOT NULL DEFAULT 0,
  reward_hint     text,
  salon_intro     text,
  notify_on_launch boolean NOT NULL DEFAULT true,
  featured_on_home boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','published','passed','archived')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mission_participants (
  mission_slug text NOT NULL REFERENCES public.missions(slug) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_slug, user_id)
);

CREATE TABLE IF NOT EXISTS public.mission_messages (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mission_slug text NOT NULL REFERENCES public.missions(slug) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content      text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mission_messages_slug ON public.mission_messages(mission_slug, created_at);

CREATE TABLE IF NOT EXISTS public.mission_message_reads (
  mission_slug text NOT NULL REFERENCES public.missions(slug) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_slug, user_id)
);

GRANT SELECT ON public.missions, public.mission_participants TO authenticated, anon;
GRANT SELECT ON public.mission_messages TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_messages;

CREATE OR REPLACE FUNCTION public.join_mission(p_mission_slug text)
  RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user_id text := auth.uid()::text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  INSERT INTO public.mission_participants (mission_slug, user_id)
    VALUES (p_mission_slug, v_user_id) ON CONFLICT DO NOTHING;
  RETURN json_build_object('ok', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.join_mission(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_mission_message(p_mission_slug text, p_content text)
  RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user_id text := auth.uid()::text; v_status text; v_id bigint;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF coalesce(length(p_content),0) NOT BETWEEN 1 AND 500 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_content_length'); END IF;
  SELECT status INTO v_status FROM public.missions WHERE slug = p_mission_slug;
  IF v_status IS NULL THEN RETURN json_build_object('success', false, 'error', 'mission_not_found'); END IF;
  IF v_status NOT IN ('published') THEN
    RETURN json_build_object('success', false, 'error', 'salon_closed'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mission_participants
                 WHERE mission_slug = p_mission_slug AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'not_participant'); END IF;
  INSERT INTO public.mission_messages (mission_slug, user_id, content)
    VALUES (p_mission_slug, v_user_id, p_content) RETURNING id INTO v_id;
  RETURN json_build_object('success', true, 'message_id', v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.send_mission_message(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_mission_messages_read(p_mission_slug text)
  RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user_id text := auth.uid()::text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  INSERT INTO public.mission_message_reads (mission_slug, user_id, last_read_at)
    VALUES (p_mission_slug, v_user_id, now())
    ON CONFLICT (mission_slug, user_id) DO UPDATE SET last_read_at = now();
  RETURN json_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.mark_mission_messages_read(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_mission_state(p_slug text)
  RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE WHEN m.slug IS NULL THEN NULL ELSE json_build_object(
    'slug', m.slug, 'title', m.title, 'eyebrow', m.eyebrow, 'call', m.call,
    'brief', m.brief, 'emblem', m.emblem, 'coverImageUrl', m.cover_image_url,
    'deliverableKind', m.deliverable_kind,
    'productHandle', m.product_handle, 'ctaLabel', m.cta_label, 'ctaUrl', m.cta_url,
    'startsAt', m.starts_at, 'endsAt', m.ends_at,
    'floor', json_build_object('glory', m.floor_glory, 'crowns', m.floor_crowns),
    'rewardHint', m.reward_hint, 'salonIntro', m.salon_intro, 'status', m.status,
    'participantsCount', (SELECT count(*) FROM public.mission_participants WHERE mission_slug = m.slug),
    'isParticipant', EXISTS (SELECT 1 FROM public.mission_participants
                             WHERE mission_slug = m.slug AND user_id = auth.uid()::text)
  ) END
  FROM public.missions m WHERE m.slug = p_slug;
$$;
GRANT EXECUTE ON FUNCTION public.get_mission_state(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_mission_submissions(p_slug text)
  RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'submissionId', s.id, 'imageUrl', i.image_url,
    'submitterName', s.submitter_name, 'createdAt', s.created_at
  ) ORDER BY s.created_at DESC), '[]'::json)
  FROM public.hub_submission_images i
  JOIN public.hub_photo_submissions s ON s.id = i.submission_id
  WHERE s.quest_ref = p_slug
    AND s.status = 'approved' AND i.status = 'approved'
    AND s.consent_brand_usage = true;
$$;
GRANT EXECUTE ON FUNCTION public.get_mission_submissions(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_my_mission_submission_status(p_slug text)
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT status FROM public.hub_photo_submissions
   WHERE quest_ref = p_slug AND user_id = auth.uid()::text
   ORDER BY created_at DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_mission_submission_status(text) TO authenticated;
