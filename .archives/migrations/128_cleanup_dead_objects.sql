-- ============================================
-- MIGRATION 128 : Nettoyage des objets morts
-- ============================================
-- Supprime les colonnes et fonctions liees au systeme de composer (remplace par titres v3)

-- Colonnes mortes sur users (ancien systeme composer)
ALTER TABLE users DROP COLUMN IF EXISTS composed_title_words;
ALTER TABLE users DROP COLUMN IF EXISTS composed_title_text;

-- RPCs mortes (ancien systeme composer)
DROP FUNCTION IF EXISTS public.get_user_composed_title(TEXT);
DROP FUNCTION IF EXISTS public.set_composed_title(TEXT, INT[], TEXT);
