-- 369-370 : les Fragments réclamés avec son propre e-mail ; l'onboarding. Annulé.
BEGIN;
\ir ../../migrations/369_fragments_email_verifie.sql
\ir ../../migrations/370_onboarding.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  achat int; vole int; legitime int; entree_avant json; entree_apres json; nom text;
  vide text;
BEGIN
  -- Un achat en attente, fait par quelqu'un d'autre.
  INSERT INTO purchase_log (email, status, unlock_type, unlock_ref_id)
  SELECT 'victime@exemple.test', 'pending', 'fragment', min(id) FROM title_fragments
  RETURNING id INTO achat;

  -- A, connecté avec son propre e-mail, tente de réclamer l'achat de la victime.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'a@exemple.test')::text, true);
  vole := public.unlock_pending_fragments(a, 'victime@exemple.test');
  -- La victime, elle, le réclame avec son e-mail vérifié.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'Victime@Exemple.test')::text, true);
  legitime := public.unlock_pending_fragments(a, 'ignore@exemple.test');

  entree_avant := public.mon_entree();
  PERFORM public.signer_charte();
  nom := public.nommer_explorateur('  Claire M.  ');
  BEGIN PERFORM public.nommer_explorateur('   '); vide := 'accepté';
  EXCEPTION WHEN others THEN vide := SQLERRM; END;
  entree_apres := public.mon_entree();

  RAISE EXCEPTION 'BILAN vole=% legitime=% avant=% nom=% vide=% apres=%',
    vole, legitime, entree_avant, nom, vide, entree_apres;
END $test$;
ROLLBACK;
