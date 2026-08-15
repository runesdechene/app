-- 340 — Compteur d'écoutes des Fragments audio
--
-- WHY : le lecteur de voix off tourne depuis plusieurs drops sans aucune mesure.
-- Impossible de dire si les Fragments sont écoutés, jusqu'au bout ou non, alors que
-- chaque voix off a un coût de production à chaque drop. Cette table tranche : continue-t-on
-- à payer la narration ? Clé = handle du métaobjet Illustration, PAS le tag produit
-- `fragment:*` — les migrations 251/252/253 ont déjà payé le prix des variations de casse.

CREATE TABLE public.fragment_audio_plays (
  id                  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  illustration_handle text        NOT NULL,
  source              text        NOT NULL CHECK (source IN ('motif', 'produit')),
  session_id          text        NOT NULL,
  listened_seconds    integer     NOT NULL DEFAULT 0,
  completed           boolean     NOT NULL DEFAULT false,
  played_on           date        NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fragment_audio_plays IS
  'Une ligne par (session, Illustration, surface, jour). Écrite uniquement par
   log_fragment_audio_play(), lue uniquement par get_fragment_audio_stats().';

-- Le dédoublonnage vit ICI, pas dans le navigateur : le sessionStorage côté client
-- se contourne en trois secondes de console.
CREATE UNIQUE INDEX fragment_audio_plays_unique_daily
  ON public.fragment_audio_plays (session_id, illustration_handle, source, played_on);

CREATE INDEX fragment_audio_plays_handle_idx
  ON public.fragment_audio_plays (illustration_handle, source);

-- Verrouillage : aucune policy, donc aucun accès direct pour anon ni authenticated.
-- Tout passe par les deux fonctions SECURITY DEFINER. Une policy d'insert anon
-- serait une surface d'écriture ouverte sans contrepartie.
ALTER TABLE public.fragment_audio_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fragment_audio_plays FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.fragment_audio_plays FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_fragment_audio_play(
  p_illustration_handle text,
  p_source              text,
  p_session_id          text,
  p_listened_seconds    integer,
  p_completed           boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Entrées hostiles ou malformées : on sort en silence. Le visiteur n'a rien
  -- demandé, il n'a pas à recevoir une erreur PostgREST dans sa console.
  IF coalesce(btrim(p_illustration_handle), '') = '' THEN RETURN; END IF;
  IF p_source NOT IN ('motif', 'produit') THEN RETURN; END IF;
  IF length(coalesce(p_session_id, '')) NOT BETWEEN 8 AND 64 THEN RETURN; END IF;

  INSERT INTO public.fragment_audio_plays
    (illustration_handle, source, session_id, listened_seconds, completed)
  VALUES
    (btrim(p_illustration_handle), p_source, p_session_id,
     greatest(coalesce(p_listened_seconds, 0), 0), coalesce(p_completed, false))
  ON CONFLICT (session_id, illustration_handle, source, played_on) DO UPDATE SET
    listened_seconds = greatest(fragment_audio_plays.listened_seconds, excluded.listened_seconds),
    completed        = fragment_audio_plays.completed OR excluded.completed;
END;
$$;

COMMENT ON FUNCTION public.log_fragment_audio_play(text, text, text, integer, boolean) IS
  'Enregistre ou enrichit une écoute. greatest() et OR : un événement tardif ne peut
   que faire monter le compteur — un rembobinage ne défait pas une complétion.';

GRANT EXECUTE ON FUNCTION public.log_fragment_audio_play(text, text, text, integer, boolean) TO anon;
