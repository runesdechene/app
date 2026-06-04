-- 209_mission_pact_question_promo.sql
-- WHY : la modale de confirmation du pacte réutilisait le LIBELLÉ du bouton
-- (cta_label, ex « Rejoindre la boutique ») comme un nom d'objet → phrase cassée
-- (« As-tu déjà Rejoindre la boutique »). On ajoute une VRAIE question dédiée,
-- rédigée par mission depuis le hub (pact_question).
--
-- + Coup de pouce commerce : si le joueur répond « pas encore », on peut lui
-- offrir un CODE PROMO (promo_code) avec une ligne descriptive qui le vend
-- (promo_note, ex « −10% sur toute la collection grecque »). Champs optionnels :
-- code vide → la modale promo est sautée, on ouvre la boutique directement.
--
-- get_mission_state reconstruit depuis la def LIVE (mig 184, inchangée depuis),
-- delta = 3 champs ajoutés. (cf. migrations-workflow.md « lire avant de réécrire »).

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS pact_question text,
  ADD COLUMN IF NOT EXISTS promo_code    text,
  ADD COLUMN IF NOT EXISTS promo_note    text;

CREATE OR REPLACE FUNCTION public.get_mission_state(p_slug text)
  RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE WHEN m.slug IS NULL THEN NULL ELSE json_build_object(
    'slug', m.slug, 'title', m.title, 'eyebrow', m.eyebrow, 'call', m.call,
    'brief', m.brief, 'emblem', m.emblem, 'coverImageUrl', m.cover_image_url,
    'deliverableKind', m.deliverable_kind,
    'productHandle', m.product_handle, 'ctaLabel', m.cta_label, 'ctaUrl', m.cta_url,
    'pactQuestion', m.pact_question, 'promoCode', m.promo_code, 'promoNote', m.promo_note,
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
