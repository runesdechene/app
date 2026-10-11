-- 501 : un visiteur sans compte dépose ses contenus ; les anciennes fonctions lui sont fermées,
-- une image hors du dépôt est refusée. Annulé.
BEGIN;
\ir ../../migrations/501_deposer_contenu.sql
DO $test$
DECLARE
  photo text := (SELECT name FROM storage.objects WHERE bucket_id = 'community-photos' AND name LIKE 'submissions/%' LIMIT 1);
  r text := ''; rendu json; url text; fiches int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  rendu := public.deposer_contenu('  Essai.Studio@Example.com ', 'Essai', jsonb_build_array(jsonb_build_object('path', photo, 'size', 'M')), true, true, 'Bonjour');
  r := r || ' premier=' || (rendu->>'nouveauCompte');
  rendu := public.deposer_contenu('essai.studio@example.com', 'Essai', jsonb_build_array(jsonb_build_object('path', photo)), true, true);
  r := r || ' second=' || (rendu->>'nouveauCompte');
  BEGIN PERFORM public.deposer_contenu('x@example.com', 'X', '[{"path":"submissions/a/faux.webp"}]', true, true); r := r || ' faux=ACCEPTE'; EXCEPTION WHEN others THEN r := r || ' faux=refus'; END;
  BEGIN PERFORM public.deposer_contenu('x@example.com', 'X', jsonb_build_array(jsonb_build_object('path', photo)), true, false); r := r || ' sans_accord=ACCEPTE'; EXCEPTION WHEN others THEN r := r || ' sans_accord=refus'; END;
  BEGIN PERFORM public.create_user_from_submission('a', 'a@a.fr', 'a', null, null, null); r := r || ' ancienne=OUVERTE'; EXCEPTION WHEN insufficient_privilege THEN r := r || ' ancienne=fermee'; END;
  RESET ROLE;
  SELECT image_url INTO url FROM hub_submission_images i JOIN hub_photo_submissions s ON s.id = i.submission_id WHERE s.submitter_email = 'essai.studio@example.com' LIMIT 1;
  SELECT count(*) INTO fiches FROM users WHERE email_address = 'essai.studio@example.com';
  RAISE EXCEPTION 'BILAN% fiches=% (attendu 1) url=%', r, fiches, url;
END $test$;
ROLLBACK;
