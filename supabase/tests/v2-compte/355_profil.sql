-- 355 : titres filtrés avant la limite ; attache sans lieux cachés pour les autres. Annulé.
BEGIN;
\ir ../../migrations/355_profil_titres_et_attache.sql
DO $test$
DECLARE
  a text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';
  b text := 'd22c0729-67eb-45eb-9dab-2e6c1d19b331';
  g int[]; nb_titres int; attache_a text; attache_b text;
BEGIN
  SELECT array_agg(id ORDER BY id) INTO g FROM (SELECT id FROM titles WHERE faction_id IS NULL ORDER BY id LIMIT 2) s;
  UPDATE users SET displayed_title_ids_v3 = ARRAY[-5, g[1], g[2]], show_departement = true WHERE id = b;
  -- B a visité un seul lieu, masqué : l'attache disparaît pour A, reste pour B.
  DELETE FROM place_explorers WHERE user_id = b;
  INSERT INTO place_explorers (user_id, place_id, visited_at)
    SELECT b, id, now() FROM places WHERE departement IS NOT NULL ORDER BY id LIMIT 1;
  UPDATE places SET masked = true WHERE id IN (SELECT place_id FROM place_explorers WHERE user_id = b);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SELECT json_array_length(public.get_profil_explorateur(b) -> 'titres') INTO nb_titres;
  attache_a := public.get_profil_explorateur(b) ->> 'attache';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  attache_b := public.get_profil_explorateur(b) ->> 'attache';
  RAISE EXCEPTION 'BILAN titres=% (attendu 2) attache_vue_par_a=% attache_vue_par_b=%', nb_titres, attache_a, attache_b;
END $test$;
ROLLBACK;
