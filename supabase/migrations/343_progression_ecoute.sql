-- 343 — Progression d'ecoute : jusqu'ou on va, pas seulement si on va au bout
--
-- WHY : le taux de completion dit combien vont au bout, jamais ou decrochent les
-- autres — or « ils s'arretent a 15 % » et « ils s'arretent a 85 % » commandent
-- des decisions opposees sur la voix off. On capture donc la duree du Fragment au
-- moment de l'ecoute : c'est la seule facon de transformer des secondes en
-- pourcentage. Demande d'Uriel le 2026-08-16, apres la premiere ecoute reelle.

ALTER TABLE public.fragment_audio_plays
  ADD COLUMN duration_seconds integer;

COMMENT ON COLUMN public.fragment_audio_plays.duration_seconds IS
  'Duree du Fragment telle que le navigateur la rapporte. NULL si inconnue :
   flux sans duree annoncee, ou ligne anterieure a la mig 343.';

-- ---------------------------------------------------------------------------
-- Ecriture : un sixieme parametre, avec defaut.
-- ---------------------------------------------------------------------------
-- La signature change, donc DROP puis CREATE : Postgres refuse de changer la
-- liste des arguments d'une fonction existante, et laisser cohabiter les deux
-- versions rendrait l'appel PostgREST ambigu. Le defaut NULL fait qu'un appelant
-- qui ignore encore ce parametre continue de fonctionner.

DROP FUNCTION IF EXISTS public.log_fragment_audio_play(text, text, text, integer, boolean);

CREATE OR REPLACE FUNCTION public.log_fragment_audio_play(
  p_illustration_handle text,
  p_source              text,
  p_session_id          text,
  p_listened_seconds    integer,
  p_completed           boolean,
  p_duration_seconds    integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_duree integer;
BEGIN
  -- Entrées hostiles ou malformées : on sort en silence. Le visiteur n'a rien
  -- demandé, il n'a pas à recevoir une erreur PostgREST dans sa console.
  IF coalesce(btrim(p_illustration_handle), '') = '' THEN RETURN; END IF;
  IF coalesce(p_source, '') NOT IN ('motif', 'produit') THEN RETURN; END IF;
  IF length(coalesce(p_session_id, '')) NOT BETWEEN 8 AND 64 THEN RETURN; END IF;

  -- Une durée nulle, négative ou absurde (au-delà de 24 h) est ignorée plutôt que
  -- stockée : elle fausserait la progression sans qu'on puisse la distinguer.
  v_duree := p_duration_seconds;
  IF v_duree IS NOT NULL AND (v_duree <= 0 OR v_duree > 86400) THEN
    v_duree := NULL;
  END IF;

  INSERT INTO public.fragment_audio_plays
    (illustration_handle, source, session_id, listened_seconds, completed, duration_seconds)
  VALUES
    (btrim(p_illustration_handle), p_source, p_session_id,
     greatest(coalesce(p_listened_seconds, 0), 0), coalesce(p_completed, false), v_duree)
  ON CONFLICT (session_id, illustration_handle, source, played_on) DO UPDATE SET
    listened_seconds = greatest(fragment_audio_plays.listened_seconds, excluded.listened_seconds),
    completed        = fragment_audio_plays.completed OR excluded.completed,
    -- La première durée connue gagne : elle ne change pas d'un événement à
    -- l'autre, et un événement tardif sans durée ne doit pas l'effacer.
    duration_seconds = coalesce(fragment_audio_plays.duration_seconds, excluded.duration_seconds);
END;
$$;

COMMENT ON FUNCTION public.log_fragment_audio_play(text, text, text, integer, boolean, integer) IS
  'Enregistre ou enrichit une écoute. greatest() et OR : un événement tardif ne peut
   que faire monter le compteur — un rembobinage ne défait pas une complétion.';

GRANT EXECUTE ON FUNCTION
  public.log_fragment_audio_play(text, text, text, integer, boolean, integer) TO anon;

-- ---------------------------------------------------------------------------
-- Lecture : la progression moyenne rejoint l'agrégat.
-- ---------------------------------------------------------------------------
-- DROP obligatoire aussi ici : on ajoute des colonnes au RETURNS TABLE, ce que
-- CREATE OR REPLACE refuse. Corps repris de la mig 342 — seule définition vivante,
-- aucune migration ultérieure ne l'a touchée — auquel s'ajoutent progression et
-- mesurables.

DROP FUNCTION IF EXISTS public.get_fragment_audio_stats();

CREATE OR REPLACE FUNCTION public.get_fragment_audio_stats()
RETURNS TABLE (
  illustration_handle text,
  ecoutes             bigint,
  completions         bigint,
  taux                numeric,
  progression         numeric,
  mesurables          bigint,
  ecoutes_motif       bigint,
  ecoutes_produit     bigint,
  derniere_ecoute     timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.illustration_handle,
    count(*)                                            AS ecoutes,
    count(*) FILTER (WHERE p.completed)                 AS completions,
    round(100.0 * count(*) FILTER (WHERE p.completed) / nullif(count(*), 0), 1) AS taux,
    -- Part moyenne du Fragment reellement parcourue. Plafonnee a 1 : une reecoute
    -- fait monter listened_seconds au-dela de la duree sans que cela veuille dire
    -- qu'on a ecoute 140 % du recit.
    round(100.0 * avg(
      least(p.listened_seconds::numeric / nullif(p.duration_seconds, 0), 1)
    ) FILTER (WHERE p.duration_seconds > 0), 1)         AS progression,
    -- Sur combien d'ecoutes cette moyenne repose : sans ce chiffre, une
    -- progression calculee sur une seule ligne se lirait comme une tendance.
    count(*) FILTER (WHERE p.duration_seconds > 0)      AS mesurables,
    count(*) FILTER (WHERE p.source = 'motif')          AS ecoutes_motif,
    count(*) FILTER (WHERE p.source = 'produit')        AS ecoutes_produit,
    max(p.created_at)                                   AS derniere_ecoute
  FROM public.fragment_audio_plays p
  WHERE public._is_staff() OR (SELECT auth.role()) = 'service_role'
  GROUP BY p.illustration_handle
  ORDER BY taux DESC NULLS LAST, ecoutes DESC;
$$;

COMMENT ON FUNCTION public.get_fragment_audio_stats() IS
  'Agrégat des écoutes par Illustration, trié par taux de complétion. `progression`
   dit jusqu''où on va en moyenne, `mesurables` sur combien d''écoutes elle repose.
   Zéro ligne pour un non-staff authentifié.';

REVOKE EXECUTE ON FUNCTION public.get_fragment_audio_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_fragment_audio_stats() TO authenticated;
