-- 029_reset_glory_exploration_erudition.sql
-- Reset global : exploration_points, erudition_points, notoriety_points, influence_stock à 0

UPDATE users SET
  exploration_points = 0,
  erudition_points = 0,
  notoriety_points = 0,
  influence_stock = 0;
