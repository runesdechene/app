-- 195_carnet_collab_schema.sql
-- WHY : refonte fiches de lieu — la description collaborative et les commentaires
-- réutilisent place_contributions (nouveaux types 'description'/'comment'), avec
-- réponses 1 niveau (parent_id) et historique d'édition (place_description_revisions).
-- Spec : docs/superpowers/specs/2026-06-02-refonte-fiches-lieu-collaboratives-design.md

BEGIN;

-- 1) Étendre le CHECK de type
ALTER TABLE public.place_contributions DROP CONSTRAINT IF EXISTS place_contributions_type_check;
ALTER TABLE public.place_contributions ADD CONSTRAINT place_contributions_type_check
  CHECK (type = ANY (ARRAY[
    'carnet','photo','accessibility','season','warning','epoch','comment','description'
  ]::text[]));

-- 2) parent_id : réponses à 1 niveau (FK auto-référente)
ALTER TABLE public.place_contributions
  ADD COLUMN IF NOT EXISTS parent_id integer
  REFERENCES public.place_contributions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_place_contributions_parent ON public.place_contributions(parent_id);
CREATE INDEX IF NOT EXISTS idx_place_contributions_place_type ON public.place_contributions(place_id, type);

-- 3) Remplacer l'unicité globale (place_id,user_id,type) — bloquait plusieurs
--    commentaires/photos par user — par des index partiels ciblés.
ALTER TABLE public.place_contributions
  DROP CONSTRAINT IF EXISTS place_contributions_place_id_user_id_type_key;

-- single-instance par user : infos
CREATE UNIQUE INDEX IF NOT EXISTS uq_pc_singleton_user_info
  ON public.place_contributions(place_id, user_id, type)
  WHERE type IN ('accessibility','season','warning','epoch','carnet');

-- single-instance par lieu : description (1 description par lieu)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pc_description_per_place
  ON public.place_contributions(place_id)
  WHERE type = 'description';

-- 'comment' et 'photo' : aucune contrainte (multiples autorisés).

-- 4) Historique d'édition de la description
CREATE TABLE IF NOT EXISTS public.place_description_revisions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id    varchar(255) NOT NULL,
  content     text NOT NULL,
  edited_by   varchar(255) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdr_place_created
  ON public.place_description_revisions(place_id, created_at DESC);

ALTER TABLE public.place_description_revisions OWNER TO postgres;
ALTER TABLE public.place_description_revisions ENABLE ROW LEVEL SECURITY;
-- Lecture publique (historique consultable), écriture uniquement via RPC SECURITY DEFINER.
DROP POLICY IF EXISTS pdr_read ON public.place_description_revisions;
CREATE POLICY pdr_read ON public.place_description_revisions FOR SELECT USING (true);
GRANT SELECT ON public.place_description_revisions TO authenticated, anon, service_role;

COMMIT;
