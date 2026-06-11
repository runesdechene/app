-- 230_drop_carnet_titles.sql
-- WHY : l'axe 7 « Carnets » (4 titres généraux : Page, Conteur, Chroniqueur,
-- Maître Conteur — seedés en mig 043) est devenu indébloquable. Le type de
-- contribution 'carnet' n'est plus jamais créé depuis le refactor carnet→description
-- (mig 195-202) : la stat `carnets` (COUNT type='carnet') reste figée à 0 pour tous
-- les nouveaux joueurs. Ces titres polluent la liste « Choisissez vos titres » avec
-- des paliers que personne ne peut plus atteindre. On les retire.
--
-- Cohérent avec la purge front V0.9.40/41 (lignes carnet du barème Coupe + bonus
-- d'affinité fantôme) — même nettoyage post-refactor carnet.
--
-- Data-only (pas de RPC). Id-agnostique : cible par condition, pas par id en dur.
-- Réversible : ré-insérer les 4 lignes via mig 043 (lignes 82-87).

-- 1. Purger les ids carnet des titres équipés (users.displayed_title_ids_v3 int[]),
--    sinon un joueur ayant équipé un titre carnet garderait un id orphelin.
UPDATE public.users u
SET displayed_title_ids_v3 = (
  SELECT COALESCE(array_agg(tid), '{}')
  FROM unnest(u.displayed_title_ids_v3) AS tid
  WHERE tid NOT IN (
    SELECT id FROM public.titles WHERE condition->>'stat' = 'carnets'
  )
)
WHERE u.displayed_title_ids_v3 && (
  SELECT COALESCE(array_agg(id), '{}') FROM public.titles WHERE condition->>'stat' = 'carnets'
);

-- 2. Supprimer les titres carnet.
DELETE FROM public.titles WHERE condition->>'stat' = 'carnets';
