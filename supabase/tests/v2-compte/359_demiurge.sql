-- 359 : Demiurge disparaît sans laisser de référence morte ; rien d'autre ne bouge. Annulé.
BEGIN;
DO $avant$
BEGIN
  PERFORM set_config('test.fragments_avant', (SELECT count(*) FROM title_fragments)::text, true);
  PERFORM set_config('test.possessions_avant', (SELECT count(*) FROM user_fragments WHERE fragment_id <> 3)::text, true);
END $avant$;
\ir ../../migrations/359_demiurge_nest_pas_un_fragment.sql
DO $test$
BEGIN
  RAISE EXCEPTION 'BILAN fragment3=% mot8=% possessions3=% titres_morts=% fragments=%->% autres_possessions=%->%',
    (SELECT count(*) FROM title_fragments WHERE id = 3),
    (SELECT count(*) FROM fragment_words WHERE id = 8),
    (SELECT count(*) FROM user_fragments WHERE fragment_id = 3),
    (SELECT count(*) FROM users WHERE -8 = ANY(displayed_title_ids_v3)),
    current_setting('test.fragments_avant'), (SELECT count(*) FROM title_fragments),
    current_setting('test.possessions_avant'), (SELECT count(*) FROM user_fragments);
END $test$;
ROLLBACK;
