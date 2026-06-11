-- 231_fix_title_progress_stats_passthrough.sql
-- WHY : la jauge de progression d'un titre (« 7 / 10 lieux visités ») restait
-- bloquée à 0 jusqu'au déblocage réel. Cause : get_all_player_titles ne renvoyait
-- dans `stats` que 5 clés LEGACY (discoveries, claims, notoriety, likes,
-- fortifications) — dont claims/notoriety/likes/fortifications qui n'existent même
-- plus dans get_user_titles->'stats' depuis la refonte V0.7 (sortaient à 0). Or les
-- conditions de titres actuelles (mig 043 + 082) portent sur level, places_visited,
-- enigma_score, plantages, places_added, mecenat_total, mecenat_top1_count. Aucune
-- de ces stats n'était transmise au front → playerStats[stat] = undefined → la jauge
-- affichait toujours « 0 / N ».
--
-- FIX : passthrough complet de get_user_titles->'stats' (qui calcule déjà tout le set
-- pour l'évaluation des déblocages). Seule la ligne `v_stats` change ; tout le reste
-- (game/faction/fragment titles) est identique au live. Suppression des 5 variables
-- legacy devenues inutiles.
--
-- Source : def LIVE de get_all_player_titles (capturée via pg_get_functiondef).
-- Réversible : remettre l'ancien json_build_object 5-clés.

CREATE OR REPLACE FUNCTION public.get_all_player_titles(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_displayed INT[];
  v_faction_id TEXT;
  v_is_admin BOOLEAN;
  v_game_titles JSON;
  v_faction_titles JSON;
  v_fragment_titles JSON;
  v_titles_data JSON;
  v_stats JSON;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id, (role = 'admin')
  INTO v_displayed, v_faction_id, v_is_admin
  FROM users WHERE id = p_user_id;

  v_titles_data := get_user_titles(p_user_id);

  -- Passthrough complet : level, places_visited, enigma_score, plantages,
  -- places_added, discoveries, mecenat_total, mecenat_top1_count, xpTotal…
  -- exactement les stats référencées par les conditions de titres.
  v_stats := COALESCE(v_titles_data->'stats', '{}'::json);

  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT t.id, t.name, t.icon, t.description, NULL::TEXT AS icon_url, NULL::TEXT AS image_url, t."order" AS t_order,
      t.condition,
      EXISTS (SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem WHERE (elem->>'id')::INT = t.id) AS unlocked
    FROM titles t WHERE t.type = 'general'
  ) row_data;

  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT t.id, t.name, t.icon, t.description, NULL::TEXT AS icon_url, NULL::TEXT AS image_url, t."order" AS t_order,
        t.condition,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT fw.id * -1 AS id, fw.word AS name, tf.icon,
      COALESCE(tf.description, tf.name) AS description,
      tf.icon_url, tf.image_url,
      tf.name AS frag_name, fw.word,
      EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id) AS unlocked,
      tf.name AS source_label
    FROM fragment_words fw
    JOIN title_fragments tf ON tf.id = fw.fragment_id
    WHERE tf.visible = true OR v_is_admin = true
  ) row_data;

  RETURN json_build_object(
    'gameTitles', COALESCE(v_game_titles, '[]'::json),
    'factionTitles', COALESCE(v_faction_titles, '[]'::json),
    'fragmentTitles', COALESCE(v_fragment_titles, '[]'::json),
    'displayedIds', v_displayed,
    'stats', v_stats
  );
END;
$function$;
