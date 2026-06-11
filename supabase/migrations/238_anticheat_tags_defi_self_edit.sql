-- 238_anticheat_tags_defi_self_edit.sql
-- WHY : l'édition collaborative de tags (mig 234/235, gate « Présence ou veille »)
-- ouvre une triche sur les Défis action×tag (mig 233) : _defi_progress JOIN les
-- place_tags en LIVE, donc un joueur peut retaguer un lieu (forêt→château) puis
-- agir, et valider « Planter mon GPS sur un château » sans château réel.
--
-- RÈGLE A : tes propres ÉDITIONS de tags ne te créditent jamais. Un tag posé par
-- quelqu'un d'autre — ou par toi à la CRÉATION du lieu (created_by NULL) — compte.
--   1) place_tags.created_by : NULL = tag d'origine (création) ; non-NULL = posé via
--      une édition set_place_tags, porte l'id de l'éditeur.
--   2) set_place_tags préserve created_by pour les tags conservés ; seuls les tags
--      NOUVELLEMENT ajoutés prennent created_by = appelant. + ligne d'audit.
--   3) _defi_progress exclut, pour p_user_id, les place_tags qu'il a édités lui-même.
--      Neutralisé pour les défis collectifs (p_collective court-circuite).
--
-- Réversible : DROP TABLE place_tags_revisions ; ALTER … DROP COLUMN created_by ;
-- restaurer les corps set_place_tags (mig 234) et _defi_progress (mig 233).

BEGIN;

-- 1) Paternité des tags ------------------------------------------------------
ALTER TABLE public.place_tags
  ADD COLUMN IF NOT EXISTS created_by text NULL
  REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.place_tags.created_by IS
  'NULL = tag posé à la création du lieu (paternité = places.author_id). '
  'non-NULL = tag posé via une édition set_place_tags par cet utilisateur. '
  'Sert à la Règle A anti-triche : une édition ne crédite pas son auteur dans _defi_progress.';

-- 2) Trail d'audit des changements de tags -----------------------------------
CREATE TABLE IF NOT EXISTS public.place_tags_revisions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id    varchar(255) NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  changed_by  text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  old_tag_ids text[] NOT NULL DEFAULT '{}',
  new_tag_ids text[] NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_tags_revisions_place
  ON public.place_tags_revisions (place_id, changed_at DESC);

GRANT SELECT ON public.place_tags_revisions TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- set_place_tags : remplace tous les tags d'un lieu (1-3, ordonnés ; 1er = primary).
-- Identique à mig 234 SAUF : préserve created_by des tags conservés, attribue
-- l'appelant aux tags nouvellement ajoutés, et journalise dans place_tags_revisions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_place_tags(p_place_id text, p_tag_ids text[])
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $tags$
DECLARE
  v_caller  text  := public._caller_user_id();
  v_n       int   := COALESCE(array_length(p_tag_ids, 1), 0);
  v_old_pat jsonb;          -- map { tag_id -> created_by } AVANT modification
  v_old_ids text[];         -- anciens tags (ordre is_primary DESC) pour l'audit
BEGIN
  IF v_caller IS NULL THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  IF v_n < 1 THEN
    RETURN json_build_object('error', 'no_tags');
  END IF;
  IF v_n > 3 THEN
    RETURN json_build_object('error', 'too_many_tags');
  END IF;
  IF (SELECT count(DISTINCT tid) FROM unnest(p_tag_ids) tid) <> v_n THEN
    RETURN json_build_object('error', 'duplicate_tag');
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_tag_ids) tid
    WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE id = tid)
  ) THEN
    RETURN json_build_object('error', 'invalid_tag');
  END IF;

  IF NOT public._can_edit_place_meta(p_place_id, v_caller) THEN
    RETURN json_build_object('error', 'not_allowed');
  END IF;

  -- Snapshot de la paternité AVANT le DELETE (jsonb null pour created_by NULL).
  SELECT jsonb_object_agg(tag_id, to_jsonb(created_by)),
         array_agg(tag_id ORDER BY is_primary DESC)
    INTO v_old_pat, v_old_ids
    FROM public.place_tags
   WHERE place_id = p_place_id;

  DELETE FROM public.place_tags WHERE place_id = p_place_id;

  INSERT INTO public.place_tags (place_id, tag_id, is_primary, created_at, created_by)
  SELECT
    p_place_id,
    t.tag_id,
    (t.ord = 1),
    NOW(),
    CASE
      WHEN v_old_pat ? t.tag_id            -- tag déjà présent → on garde sa paternité
      THEN NULLIF(v_old_pat->>t.tag_id, '')  -- (NULL si c'était un tag de création)
      ELSE v_caller                         -- tag nouvellement ajouté → l'éditeur
    END
  FROM unnest(p_tag_ids) WITH ORDINALITY AS t(tag_id, ord);

  -- Audit : une ligne par appel (qui, quoi avant, quoi après).
  INSERT INTO public.place_tags_revisions (place_id, changed_by, old_tag_ids, new_tag_ids)
  VALUES (p_place_id, v_caller, COALESCE(v_old_ids, '{}'), p_tag_ids);

  UPDATE public.places SET updated_at = NOW() WHERE id = p_place_id;

  RETURN json_build_object('success', true, 'tagIds', p_tag_ids);
END;
$tags$;

ALTER FUNCTION public.set_place_tags(text, text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_place_tags(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_place_tags(text, text[]) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- _defi_progress : corps mig 233 + Règle A. Chaque EXISTS sur place_tags exclut,
-- pour un joueur (p_collective = false), les tags que CE joueur a édités lui-même
-- (pt.created_by = p_user_id). p_collective = true court-circuite → compteur
-- communautaire objectif inchangé. created_by NULL (tag de création) compte toujours.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._defi_progress(p_action text, p_tag_id text, p_user_id text, p_collective boolean, p_ws timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  IF p_action = 'enigma' THEN
    SELECT count(*) INTO n FROM public.enigma_responses e
     WHERE e.responded_at >= p_ws AND (p_collective OR e.user_id = p_user_id);
  ELSIF p_action = 'reveal' THEN
    SELECT count(*) INTO n FROM public.places_discovered pd
     WHERE pd.method = 'remote'
       AND pd.discovered_at >= p_ws
       AND (p_collective OR pd.user_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pd.place_id AND pt.tag_id = p_tag_id
               AND (p_collective OR pt.created_by IS DISTINCT FROM p_user_id)));
  ELSIF p_action = 'visit' THEN
    SELECT count(*) INTO n FROM (
      SELECT pe.user_id, pe.place_id
        FROM public.place_explorers pe
       WHERE pe.visited_at >= p_ws
         AND (p_collective OR pe.user_id = p_user_id)
         AND (p_tag_id IS NULL OR EXISTS (
               SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pe.place_id AND pt.tag_id = p_tag_id
                 AND (p_collective OR pt.created_by IS DISTINCT FROM p_user_id)))
      UNION
      SELECT pd.user_id, pd.place_id
        FROM public.places_discovered pd
       WHERE pd.method = 'gps'
         AND pd.discovered_at >= p_ws
         AND (p_collective OR pd.user_id = p_user_id)
         AND (p_tag_id IS NULL OR EXISTS (
               SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pd.place_id AND pt.tag_id = p_tag_id
                 AND (p_collective OR pt.created_by IS DISTINCT FROM p_user_id)))
    ) x;
  ELSIF p_action = 'add' THEN
    SELECT count(*) INTO n FROM public.places p
     WHERE p.created_at >= p_ws
       AND (p_collective OR p.author_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = p.id AND pt.tag_id = p_tag_id
               AND (p_collective OR pt.created_by IS DISTINCT FROM p_user_id)));
  ELSIF p_action = 'veilleur' THEN
    SELECT count(*) INTO n FROM public.place_veille pv
     WHERE pv.by_influence = false AND pv.planted_at >= p_ws
       AND (p_collective OR pv.veilleur_user_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pv.place_id AND pt.tag_id = p_tag_id
               AND (p_collective OR pt.created_by IS DISTINCT FROM p_user_id)));
  ELSE
    n := 0;
  END IF;
  RETURN COALESCE(n, 0);
END; $function$;

COMMIT;
