-- 357 : un Fragment invisible ne se montre pas sur le profil. Annulé.
BEGIN;
\ir ../../migrations/357_profil_fragments_visibles.sql
DO $test$
DECLARE
  b text := 'd22c0729-67eb-45eb-9dab-2e6c1d19b331';
  cache int; montre int; profil json;
BEGIN
  SELECT id INTO cache FROM title_fragments WHERE visible IS NOT TRUE ORDER BY id LIMIT 1;
  SELECT id INTO montre FROM title_fragments WHERE visible ORDER BY id LIMIT 1;
  DELETE FROM user_fragments WHERE user_id = b;
  INSERT INTO user_fragments (user_id, fragment_id, unlocked_at, source)
    VALUES (b, cache, now(), 'manual'), (b, montre, now(), 'manual');
  UPDATE users SET signe_fragment_id = cache WHERE id = b;
  profil := public.get_profil_explorateur(b);
  RAISE EXCEPTION 'BILAN nb_fragments=% (attendu 1) cache_absent=% signe=% verifie=%',
    json_array_length(profil -> 'fragments'),
    NOT EXISTS (SELECT 1 FROM json_array_elements(profil -> 'fragments') e WHERE (e->>'id')::int = cache),
    profil -> 'signe', profil ->> 'porteurVerifie';
END $test$;
ROLLBACK;
