-- 361 : Lieux ajoutés du plus récent au plus ancien. Annulé.
BEGIN;
\ir ../../migrations/361_profil_ajoutes_recents.sql
DO $test$
DECLARE u text := 'cb16ff47-1ead-4adf-8eff-04d117551541'; attendu text; obtenu text;
BEGIN
  SELECT string_agg(id, ',' ORDER BY created_at DESC) INTO attendu
    FROM places WHERE author_id = u AND masked IS NOT TRUE AND private IS NOT TRUE;
  SELECT string_agg(e->>'id', ',') INTO obtenu FROM json_array_elements(public.get_profil_explorateur(u) -> 'ajoutes') e;
  RAISE EXCEPTION 'BILAN ordre_correct=%', attendu = obtenu;
END $test$;
ROLLBACK;
