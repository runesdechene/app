-- ============================================
-- MIGRATION 162 : Nettoyer les titres orphelins au changement d'héritage
-- ============================================
-- Quand un joueur change de faction, ses titres de faction affichés
-- peuvent devenir invalides. On les retire.

-- Retirer les titres de faction qui ne correspondent plus
UPDATE users u
SET displayed_title_ids_v3 = (
  SELECT array_agg(tid)
  FROM unnest(u.displayed_title_ids_v3) AS tid
  WHERE tid < 0  -- Mots de fragments (négatifs) → on garde
    OR EXISTS (SELECT 1 FROM titles t WHERE t.id = tid AND (t.type = 'general' OR (t.type = 'faction' AND t.faction_id = u.faction_id)))
)
WHERE displayed_title_ids_v3 IS NOT NULL AND array_length(displayed_title_ids_v3, 1) > 0;

-- Remplacer les NULL par un array vide
UPDATE users SET displayed_title_ids_v3 = '{}' WHERE displayed_title_ids_v3 IS NULL;
