-- ============================================
-- MIGRATION 106 : Stocker la phrase composee en texte
-- ============================================
-- composed_title_words ne suffit pas : l'article et les connecteurs
-- libres ne sont pas des fragment_words. On ajoute un champ texte
-- pour la phrase complete.
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS composed_title_text TEXT;

-- Supprimer l'ancienne signature (2 params) avant de recreer avec 3 params
DROP FUNCTION IF EXISTS public.set_composed_title(TEXT, INT[]);

-- Mettre a jour set_composed_title pour accepter la phrase
CREATE OR REPLACE FUNCTION public.set_composed_title(
  p_user_id TEXT,
  p_word_ids INT[],
  p_phrase TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Max 6 mots fragment
  IF p_word_ids IS NOT NULL AND array_length(p_word_ids, 1) > 6 THEN
    RETURN json_build_object('error', 'Maximum 6 mots');
  END IF;

  UPDATE users
  SET composed_title_words = COALESCE(p_word_ids, '{}'),
      composed_title_text = p_phrase
  WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

-- Mettre a jour get_user_composed_title pour retourner la phrase
CREATE OR REPLACE FUNCTION public.get_user_composed_title(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_word_ids INT[];
  v_phrase TEXT;
  v_words JSON;
BEGIN
  SELECT COALESCE(composed_title_words, '{}'), composed_title_text
  INTO v_word_ids, v_phrase
  FROM users WHERE id = p_user_id;

  -- Si phrase stockee, la retourner directement
  IF v_phrase IS NOT NULL AND v_phrase != '' THEN
    RETURN json_build_object('phrase', v_phrase, 'wordIds', v_word_ids);
  END IF;

  -- Fallback : reconstituer depuis les word IDs
  IF array_length(v_word_ids, 1) IS NULL OR array_length(v_word_ids, 1) = 0 THEN
    RETURN json_build_object('phrase', NULL, 'wordIds', '{}');
  END IF;

  SELECT json_agg(
    json_build_object('id', fw.id, 'word', fw.word, 'slot', fw.slot, 'gender', fw.gender)
    ORDER BY array_position(v_word_ids, fw.id)
  )
  INTO v_words
  FROM fragment_words fw
  WHERE fw.id = ANY(v_word_ids);

  RETURN json_build_object('phrase', NULL, 'words', COALESCE(v_words, '[]'::json), 'wordIds', v_word_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_composed_title(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_composed_title(TEXT, INT[], TEXT) TO authenticated;
