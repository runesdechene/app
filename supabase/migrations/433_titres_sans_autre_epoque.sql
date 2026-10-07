-- WHY: Uriel, 06/10 (avant l'arrêt de la V1) : les titres de l'ancien jeu s'effacent avec elle —
--      découvertes (Novice compris), bannières, mécénat, énigmes (elles reviendront sous un nouveau
--      format). Ne restent que les chemins vivants : niveau, visites, lieux ajoutés, lieux enrichis.
--      « Tous les titres » perd son bloc « D'une autre époque ».
-- SCHEMA CHECKED (07/10/2026) : users(displayed_title_ids_v3 int4[], displayed_general_title_ids
--      int4[]) ; titles(id, type, condition) ; aucune clé étrangère vers titles. Les autres lectures
--      (get_profil_explorateur, actifs_carte, grands_explorateurs, get_player_profile…) rattachent les
--      titres par leur id : un titre supprimé en sort sans rien casser. 18 titres concernés, 32 joueurs
--      en portaient 40 (sauvegarde des lignes et des titres portés : .superpowers/sauvegardes, 07/10).
--      get_mes_titres : définition live (pg_get_functiondef, 07/10) = mig 430 ; seul `autreEpoque` part.
--      Le front 1.1.1+ ne lit plus `autreEpoque` : il doit être déployé AVANT cette migration.

-- 1. Les titres portés ne pointent plus vers un titre supprimé (V2, et la V1 par propreté).
UPDATE public.users u
SET displayed_title_ids_v3 = ARRAY(
      SELECT x FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS d(x, ord)
      WHERE x NOT IN (SELECT t.id FROM public.titles t
                      WHERE t.type = 'general'
                        AND t.condition->>'stat' NOT IN ('level', 'places_visited', 'places_added', 'places_enriched'))
      ORDER BY ord)
WHERE u.displayed_title_ids_v3 && ARRAY(
      SELECT t.id FROM public.titles t
      WHERE t.type = 'general'
        AND t.condition->>'stat' NOT IN ('level', 'places_visited', 'places_added', 'places_enriched'));

UPDATE public.users u
SET displayed_general_title_ids = ARRAY(
      SELECT x FROM unnest(u.displayed_general_title_ids) WITH ORDINALITY AS d(x, ord)
      WHERE x NOT IN (SELECT t.id FROM public.titles t
                      WHERE t.type = 'general'
                        AND t.condition->>'stat' NOT IN ('level', 'places_visited', 'places_added', 'places_enriched'))
      ORDER BY ord)
WHERE u.displayed_general_title_ids && ARRAY(
      SELECT t.id FROM public.titles t
      WHERE t.type = 'general'
        AND t.condition->>'stat' NOT IN ('level', 'places_visited', 'places_added', 'places_enriched'));

-- 2. Les titres de l'ancien jeu
DELETE FROM public.titles t
WHERE t.type = 'general'
  AND t.condition->>'stat' NOT IN ('level', 'places_visited', 'places_added', 'places_enriched');

-- 3. La page : seulement les chemins vivants
CREATE OR REPLACE FUNCTION public.get_mes_titres()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi     text := auth.uid()::text;
  v_vivants text[] := ARRAY['level', 'places_visited', 'places_added', 'places_enriched'];
  v_titres  json;
  v_obtenus int[];
  v_portes  int[];
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'non connecté';
  END IF;
  v_titres := public.get_user_titles(v_moi);
  SELECT COALESCE(array_agg((e->>'id')::int), '{}') INTO v_obtenus
    FROM json_array_elements(v_titres->'unlockedGeneralTitles') e;
  SELECT COALESCE(displayed_title_ids_v3, '{}') INTO v_portes FROM users WHERE id = v_moi;

  RETURN json_build_object(
    'obtenus', cardinality(v_obtenus),
    'total', (SELECT count(*) FROM titles t
               WHERE t.type = 'general' AND t.condition->>'stat' = ANY (v_vivants)),
    'chemins', (SELECT json_agg(json_build_object(
        'stat', c.stat,
        'compteur', COALESCE((v_titres->'stats'->>c.stat)::int, 0),
        'titres', (SELECT COALESCE(json_agg(json_build_object(
                      'id', t.id, 'nom', t.name, 'min', (t.condition->>'min')::int,
                      'obtenu', t.id = ANY (v_obtenus), 'porte', t.id = ANY (v_portes))
                    ORDER BY (t.condition->>'min')::int), '[]'::json)
                   FROM titles t WHERE t.type = 'general' AND t.condition->>'stat' = c.stat))
      ORDER BY c.ordre)
      FROM unnest(v_vivants) WITH ORDINALITY AS c(stat, ordre))
  );
END;
$function$;
