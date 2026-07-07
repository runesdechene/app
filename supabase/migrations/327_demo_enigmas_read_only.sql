-- Deux fonctions LECTURE SEULE réservées au compte démo (borne demo.runesdechene.com).
-- Aucune écriture. Servent la vraie validation + la rotation infinie des énigmes en mode démo.
-- Garde par email : seul demo@runesdechene.com peut les appeler (anti-triche joueurs réels).

CREATE OR REPLACE FUNCTION public.get_demo_enigmas(p_count integer DEFAULT 3)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) IS DISTINCT FROM 'demo@runesdechene.com' THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT json_build_object('enigmas', COALESCE(json_agg(e), '[]'::json))
  INTO v_result
  FROM (
    SELECT
      en.id,
      en.difficulty,
      en.lore_text AS "loreText",
      en.question,
      en.format,
      en.choices,
      en.theme,
      COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || en.difficulty), 3) AS "rewardInfluence",
      COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || en.difficulty), 1) AS "rewardErudition"
    FROM enigmas en
    WHERE en.type = 'daily' AND en.active = TRUE
    ORDER BY random()
    LIMIT GREATEST(1, LEAST(p_count, 10))
  ) e;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_enigma_answer(p_enigma_id integer, p_answer text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_enigma RECORD;
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) IS DISTINCT FROM 'demo@runesdechene.com' THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  RETURN json_build_object(
    'correct',     public._enigma_answer_matches(p_answer, v_enigma.answer),
    'answer',      v_enigma.answer,
    'explanation', v_enigma.explanation,
    'difficulty',  v_enigma.difficulty
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_demo_enigmas(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_enigma_answer(integer, text) TO authenticated;
