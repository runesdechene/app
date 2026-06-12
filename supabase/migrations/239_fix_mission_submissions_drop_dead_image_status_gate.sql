-- 239_fix_mission_submissions_drop_dead_image_status_gate.sql
-- BUG : les photos validées d'une quête ne s'affichent pas dans la galerie « Les contributions »
--       de la modale de mission (explore-web MissionModal).
--
-- CAUSE : get_mission_submissions (mig 184) filtre sur i.status = 'approved' (statut PAR IMAGE).
--   Or ce gate a été ABANDONNÉ en mig 181 (« ne dépend plus du statut image 'approved' »,
--   suppression du bouton « Garder » → plus aucun appel à set_submission_image_status).
--   Les images restent donc DEFAULT 'pending' à vie. Le bouton « Valider » du hub
--   (moderate_submission) ne met à jour QUE hub_photo_submissions.status, jamais le statut image.
--   → i.status = 'approved' n'est jamais vrai → galerie toujours vide.
--
-- FIX : on retire le gate mort i.status = 'approved'. Le gate s'aligne sur le pattern canonique
--   de get_community_photos_by_product (mig 181) : soumission approuvée + consentement marque.

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
    AND s.status = 'approved'
    AND s.consent_brand_usage = true;
$$;
GRANT EXECUTE ON FUNCTION public.get_mission_submissions(text) TO authenticated, anon;
