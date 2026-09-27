-- 352 : une visite retire le lieu de la liste d'envies. Transaction annulée.
-- Sans la ligne \ir, le bilan doit dire envie_restante=1 (la migration manque) ; avec, 0.
BEGIN;
\ir ../../migrations/352_envies_sortent_a_la_visite.sql
DO $test$
DECLARE u text; p text; reste int; visitees_en_envie int;
BEGIN
  SELECT u2.id INTO u FROM users u2 JOIN auth.users a ON a.id::text = u2.id LIMIT 1;
  SELECT id INTO p FROM places
   WHERE NOT EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = places.id AND e.user_id = u)
     AND author_id IS DISTINCT FROM u
   LIMIT 1;
  DELETE FROM place_wishlist WHERE user_id = u AND place_id = p;
  INSERT INTO place_wishlist (user_id, place_id) VALUES (u, p);
  INSERT INTO place_explorers (user_id, place_id, visited_at) VALUES (u, p, now());
  SELECT count(*) INTO reste FROM place_wishlist WHERE user_id = u AND place_id = p;
  SELECT count(*) INTO visitees_en_envie FROM place_wishlist w
   WHERE EXISTS (SELECT 1 FROM place_explorers e WHERE e.user_id = w.user_id AND e.place_id = w.place_id);
  RAISE EXCEPTION 'BILAN envie_restante=% visitees_encore_en_envie=%', reste, visitees_en_envie;
END $test$;
ROLLBACK;
