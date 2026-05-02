-- 060_v07_fix_quest_progress_ambiguity.sql
-- WHY: increment_quest_progress (mig 056) déclare un paramètre OUT `reward_xp` ET
--      sélectionne la colonne `reward_xp` de quest_templates dans le FOR loop. PL/pgSQL
--      lève une erreur 42702 ("column reference 'reward_xp' is ambiguous") sur tout
--      caller : validate_emoji_throw → clic emoji 100 % cassé. react_to_note pareil.
--
-- Fix : directive `#variable_conflict use_column` en tête de la fonction. PostgreSQL
-- résout désormais l'ambiguïté en faveur de la colonne (le seul cas de conflit ici
-- est volontaire : on veut bien lire la colonne dans le SELECT, et l'écriture sur la
-- variable OUT plus bas reste explicite via assignation `reward_xp := ...`).

CREATE OR REPLACE FUNCTION public.increment_quest_progress(
  p_user_id text,
  p_tracker_kind text,
  p_amount integer DEFAULT 1
)
  RETURNS TABLE(completed_template_id text, reward_xp integer)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  v_date_local date;
  v_template RECORD;
  v_progress RECORD;
BEGIN
  IF p_user_id IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  v_date_local := public._user_date_local(p_user_id);
  IF v_date_local IS NULL THEN RETURN; END IF;

  FOR v_template IN
    SELECT id, threshold, reward_xp, reward_couronnes
      FROM public.quest_templates
      WHERE type = 'daily' AND active AND tracker_kind = p_tracker_kind
  LOOP
    INSERT INTO public.user_quest_progress (user_id, quest_template_id, date_local, count)
      VALUES (p_user_id, v_template.id, v_date_local, p_amount)
      ON CONFLICT (user_id, quest_template_id, date_local) DO UPDATE SET
        count = public.user_quest_progress.count + EXCLUDED.count
      RETURNING * INTO v_progress;

    IF v_progress.count >= v_template.threshold AND v_progress.completed_at IS NULL THEN
      UPDATE public.user_quest_progress
        SET completed_at = NOW(),
            rewarded = true
        WHERE user_id = p_user_id
          AND quest_template_id = v_template.id
          AND date_local = v_date_local
          AND completed_at IS NULL;

      UPDATE public.users
        SET xp_total = xp_total + v_template.reward_xp
        WHERE id = p_user_id;

      completed_template_id := v_template.id;
      reward_xp := v_template.reward_xp;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;
