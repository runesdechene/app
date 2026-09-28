-- 366 : les correctifs de la revue (envie, compagnons, revendication). Annulé.
BEGIN;
\ir ../../migrations/366_fiche_correctifs.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  b text;
  lieu record;
  envie_avant int; envie_apres int; fiche_envie text;
  comp_sans_visite json; comp_avec_visite json;
  xp_avant int; xp_apres int; histo_avant int; histo_apres int;
  bonus int; scores int; expeditions_avant int; expeditions_apres int;
BEGIN
  -- Des comptes qui peuvent se connecter : auth.uid() est un UUID (les anciens identifiants V1 n'en sont pas).
  SELECT id INTO b FROM users WHERE id <> a AND id ~ '^[0-9a-f-]{36}$' ORDER BY created_at LIMIT 1;
  SELECT id, latitude AS lat, longitude AS lng INTO lieu FROM places
   WHERE masked IS NOT TRUE AND private IS NOT TRUE AND nature = 'lieu' AND latitude IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM place_wishlist w WHERE w.place_id = places.id AND w.user_id = a)
   LIMIT 1;

  -- B est là, à ~40 m.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.signaler_presence(lieu.lat + 0.00036, lieu.lng);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- « Envie d'y aller » écrit là où le profil lit : place_wishlist.
  SELECT count(*) INTO envie_avant FROM place_wishlist WHERE user_id = a;
  PERFORM public.basculer_envie(lieu.id);
  SELECT count(*) INTO envie_apres FROM place_wishlist WHERE user_id = a;
  fiche_envie := public.fiche_lieu(lieu.id)->'moi'->>'envie';

  -- Sans visite récente, même présent : aucune liste de compagnons.
  PERFORM public.signaler_presence(lieu.lat, lieu.lng);
  comp_sans_visite := public.compagnons_possibles(lieu.id);
  PERFORM public.visiter_lieu(lieu.id, lieu.lat, lieu.lng);
  comp_avec_visite := public.compagnons_possibles(lieu.id);

  -- Revendiquer avec B : ni Gloire ni historique ; la Cour est remise à zéro avec le bonus.
  SELECT xp_total INTO xp_avant FROM users WHERE id = a;
  SELECT count(*) INTO histo_avant FROM veille_history WHERE user_id = a;
  PERFORM public.revendiquer_lieu(lieu.id, ARRAY[b], 'Les Loups de Test');
  SELECT xp_total INTO xp_apres FROM users WHERE id = a;
  SELECT count(*) INTO histo_apres FROM veille_history WHERE user_id = a;
  SELECT amount INTO bonus FROM place_court_action WHERE place_id = lieu.id AND side = 'plant_bonus' AND beneficiary_user_id = a;
  SELECT count(*) INTO scores FROM place_court_score WHERE place_id = lieu.id;

  -- Déjà tenant : revendiquer à nouveau rafraîchit la date, sans nouvelle expédition.
  SELECT count(*) INTO expeditions_avant FROM expeditions WHERE place_id = lieu.id;
  PERFORM public.revendiquer_lieu(lieu.id, '{}', NULL);
  SELECT count(*) INTO expeditions_apres FROM expeditions WHERE place_id = lieu.id;

  RAISE EXCEPTION 'BILAN envie=%->% fiche_envie=% comp_sans_visite=% comp_avec_visite=% xp=%->% histo=%->% bonus=% scores=% expeditions=%->%',
    envie_avant, envie_apres, fiche_envie, comp_sans_visite, comp_avec_visite,
    xp_avant, xp_apres, histo_avant, histo_apres, bonus, scores, expeditions_avant, expeditions_apres;
END $test$;
ROLLBACK;
