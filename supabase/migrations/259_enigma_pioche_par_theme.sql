-- 259_enigma_pioche_par_theme.sql
-- WHY : Etape 2/3 du decouplage faction. Les 3 RPC qui piochaient / affichaient par
-- faction (collection -> heritage_id) basculent sur le theme culturel :
--   - get_fragment_enigma   : pioche WHERE enigmas.theme = title_fragments.theme
--   - get_my_fragment_status: flag hasEnigma calcule via theme
--   - get_daily_enigma      : retourne 'theme' au lieu de 'heritageId' (macaron de theme)
-- Defs live (pg_get_functiondef) reprises VERBATIM ; seul le delta faction->theme est
-- applique (variable, clauses WHERE, error string no_collection->no_theme, champ retourne).
-- Le filtrage des pools et toute autre logique sont inchanges. DROP enigmas.heritage_id en 260.

-- ============================================================
-- 1) get_fragment_enigma : pioche par theme (v_collection -> v_theme)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_fragment_enigma(p_user_id text, p_fragment_id integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_theme TEXT;
  v_enigma RECORD;
  v_already_today BOOLEAN;
  v_today DATE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  SELECT theme INTO v_theme FROM title_fragments WHERE id = p_fragment_id;
  IF v_theme IS NULL THEN
    RETURN json_build_object('error', 'no_theme');
  END IF;

  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;

  SELECT EXISTS(
    SELECT 1 FROM enigma_responses er
    WHERE er.user_id = p_user_id
      AND er.enigma_id IN (
        SELECT e.id FROM enigmas e
        WHERE e.type = 'daily' AND e.theme = v_theme AND e.active = TRUE
      )
      AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today
      AND er.erudition_gained = -1 * p_fragment_id
  ) INTO v_already_today;

  SELECT EXISTS(
    SELECT 1 FROM activity_log
    WHERE actor_id = p_user_id
      AND type = 'fragment_enigma'
      AND (data->>'fragmentId')::INT = p_fragment_id
      AND created_at > NOW() - (COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_cooldown_hours'), 48) || ' hours')::INTERVAL
  ) INTO v_already_today;

  IF v_already_today THEN
    RETURN json_build_object('already_answered', true);
  END IF;

  SELECT e.* INTO v_enigma
  FROM enigmas e
  WHERE e.type = 'daily'
    AND e.theme = v_theme
    AND e.active = TRUE
    AND e.id NOT IN (SELECT enigma_id FROM enigma_responses WHERE user_id = p_user_id)
  ORDER BY RANDOM()
  LIMIT 1;

  IF v_enigma.id IS NULL THEN
    SELECT e.* INTO v_enigma
    FROM enigmas e
    WHERE e.type = 'daily'
      AND e.theme = v_theme
      AND e.active = TRUE
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;

  IF v_enigma.id IS NULL THEN
    SELECT e.* INTO v_enigma
    FROM enigmas e
    WHERE e.type = 'daily' AND e.active = TRUE
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;

  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'no_enigma_available');
  END IF;

  RETURN json_build_object(
    'id', v_enigma.id,
    'difficulty', v_enigma.difficulty,
    'loreText', v_enigma.lore_text,
    'question', v_enigma.question,
    'format', v_enigma.format,
    'choices', v_enigma.choices,
    'theme', v_enigma.theme,
    'fragmentId', p_fragment_id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_fragment_enigma(text, integer) TO anon, authenticated, service_role;

-- ============================================================
-- 2) get_my_fragment_status : flag hasEnigma via theme
--    (seul le champ 'hasEnigma' change ; 'collection' conserve pour l'affichage)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_fragment_status(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_today DATE;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'fragmentId', tf.id,
      'name', tf.name,
      'icon', tf.icon,
      'iconUrl', tf.icon_url,
      'imageUrl', tf.image_url,
      'collection', tf.collection,
      'hasEnigma', tf.theme IS NOT NULL AND EXISTS(
        SELECT 1 FROM enigmas e WHERE e.type = 'daily' AND e.theme = tf.theme AND e.active = TRUE
      ),
      'enigmaCooldown', EXISTS(
        SELECT 1 FROM activity_log al
        WHERE al.actor_id = p_user_id
          AND al.type = 'fragment_enigma'
          AND (al.data->>'fragmentId')::INT = tf.id
          AND al.created_at > NOW() - (COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_cooldown_hours'), 48) || ' hours')::INTERVAL
      ),
      'enigmaNextAt', (
        SELECT al.created_at + (COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_cooldown_hours'), 48) || ' hours')::INTERVAL
        FROM activity_log al
        WHERE al.actor_id = p_user_id
          AND al.type = 'fragment_enigma'
          AND (al.data->>'fragmentId')::INT = tf.id
        ORDER BY al.created_at DESC LIMIT 1
      ),
      'affinities', (
        SELECT COALESCE(json_agg(json_build_object(
          'tagId', fta.tag_id,
          'tagTitle', t.title,
          'bonusPoints', fta.bonus_points
        )), '[]'::json)
        FROM fragment_tag_affinities fta
        JOIN tags t ON t.id = fta.tag_id
        WHERE fta.fragment_id = tf.id
      )
    ) ORDER BY tf.name)
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id
  ), '[]'::json);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_fragment_status(text) TO anon, authenticated, service_role;

-- ============================================================
-- 3) get_daily_enigma : retourne 'theme' au lieu de 'heritageId'
--    (filtrage du pool INCHANGE ; seul le champ retourne change)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daily_enigma(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_today DATE;
  v_day_seed INT;
  v_answered_difficulties TEXT[];
  v_answered_count INT;
  v_diff TEXT;
  v_enigma RECORD;
  v_result JSON[] := '{}';
  v_candidates INT[];
  v_pick_idx INT;
  v_reward_influence INT;
  v_reward_erudition INT;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;
  v_day_seed := (EXTRACT(EPOCH FROM v_today)::INT / 86400);

  -- V129 : filtre er.fragment_id IS NULL pour ne compter que les vraies
  -- réponses daily (pas les réponses passées par le flow fragment).
  SELECT COALESCE(ARRAY_AGG(DISTINCT e.difficulty), '{}'), COUNT(*)
  INTO v_answered_difficulties, v_answered_count
  FROM enigma_responses er
  JOIN enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id
    AND e.type = 'daily'
    AND er.fragment_id IS NULL
    AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today;

  IF v_answered_count >= 3 OR ARRAY['very_easy', 'easy', 'medium'] <@ v_answered_difficulties THEN
    RETURN json_build_object('all_answered', true);
  END IF;

  FOREACH v_diff IN ARRAY ARRAY['very_easy', 'easy', 'medium']
  LOOP
    IF v_diff = ANY(v_answered_difficulties) THEN
      CONTINUE;
    END IF;

    -- Pool prioritaire : énigmes jamais répondues par cet user (lifetime, peu
    -- importe le canal — fragment ou daily, on ne re-sert pas la même).
    SELECT ARRAY_AGG(id ORDER BY id) INTO v_candidates
    FROM enigmas
    WHERE type = 'daily' AND active = TRUE AND difficulty = v_diff
      AND id NOT IN (SELECT enigma_id FROM enigma_responses WHERE user_id = p_user_id);

    IF v_candidates IS NULL OR array_length(v_candidates, 1) = 0 THEN
      SELECT ARRAY_AGG(id ORDER BY id) INTO v_candidates
      FROM enigmas
      WHERE type = 'daily' AND active = TRUE AND difficulty = v_diff;
    END IF;

    IF v_candidates IS NULL OR array_length(v_candidates, 1) = 0 THEN
      CONTINUE;
    END IF;

    v_pick_idx := (v_day_seed % array_length(v_candidates, 1)) + 1;
    SELECT * INTO v_enigma FROM enigmas WHERE id = v_candidates[v_pick_idx];

    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || v_diff), 3) INTO v_reward_influence;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || v_diff), 1) INTO v_reward_erudition;

    IF v_enigma.id IS NOT NULL THEN
      v_result := array_append(v_result, json_build_object(
        'id', v_enigma.id,
        'difficulty', v_enigma.difficulty,
        'loreText', v_enigma.lore_text,
        'question', v_enigma.question,
        'format', v_enigma.format,
        'choices', v_enigma.choices,
        'theme', v_enigma.theme,
        'rewardInfluence', v_reward_influence,
        'rewardErudition', v_reward_erudition
      ));
    END IF;
  END LOOP;

  IF array_length(v_result, 1) IS NULL OR array_length(v_result, 1) = 0 THEN
    RETURN json_build_object('all_answered', true);
  END IF;

  RETURN json_build_object(
    'enigmas', (SELECT json_agg(elem) FROM unnest(v_result) AS elem),
    'answeredToday', v_answered_difficulties
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_enigma(text) TO anon, authenticated, service_role;
