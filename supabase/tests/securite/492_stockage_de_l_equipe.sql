-- 492 : un joueur ne dépose plus d'icône de nature ; l'équipe si. Annulé.
BEGIN;
\ir ../../migrations/492_stockage_de_l_equipe.sql
DO $test$
DECLARE r text := '';
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '10e4c7d5-7f09-4bdf-8a47-c44db83a196f', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('tag-icons', 'essai-joueur.svg', auth.uid()); r := r || ' joueur=DEPOSE'; EXCEPTION WHEN others THEN r := r || ' joueur=refus'; END;
  BEGIN INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('app-assets', 'essai-joueur.png', auth.uid()); r := r || ' joueur_assets=DEPOSE'; EXCEPTION WHEN others THEN r := r || ' joueur_assets=refus'; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'cb16ff47-1ead-4adf-8eff-04d117551541', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('tag-icons', 'essai-equipe.svg', auth.uid()); r := r || ' equipe=depose'; EXCEPTION WHEN others THEN r := r || ' equipe=REFUS(' || SQLERRM || ')'; END;
  RESET ROLE;
  RAISE EXCEPTION 'BILAN% (attendu : refus, refus, depose)', r;
END $test$;
ROLLBACK;
