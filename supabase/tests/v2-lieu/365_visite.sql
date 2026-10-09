-- 365 : visiter, être présent, revendiquer. Annulé.
BEGIN;
\ir ../../migrations/365_visite_revendication.sql
DO $test$
DECLARE
  a text; b text; c text; lieu record; loin_ok boolean := false; tard_ok boolean := false;
  comp json; comp_loin json; r json; pilule text;
BEGIN
  SELECT id INTO a FROM users WHERE id = 'cb16ff47-1ead-4adf-8eff-04d117551541';
  -- Des comptes qui peuvent se connecter : auth.uid() est un UUID (les anciens identifiants V1 n'en sont pas).
  SELECT id INTO b FROM users WHERE id <> a AND id ~ '^[0-9a-f-]{36}$' ORDER BY created_at LIMIT 1;
  SELECT id INTO c FROM users WHERE id NOT IN (a, b) AND id ~ '^[0-9a-f-]{36}$' ORDER BY created_at LIMIT 1;
  SELECT id, latitude AS lat, longitude AS lng INTO lieu FROM places
   WHERE masked IS NOT TRUE AND private IS NOT TRUE AND nature = 'lieu' AND latitude IS NOT NULL LIMIT 1;

  -- B est là (à ~40 m), C est parti (présence vieille de 11 min).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.signaler_presence(lieu.lat + 0.00036, lieu.lng);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  PERFORM public.signaler_presence(lieu.lat, lieu.lng);
  UPDATE presences SET vu_a = now() - interval '11 minutes' WHERE user_id = c;

  -- A : trop loin (250 m) → refus ; puis à 150 m → visite.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.visiter_lieu(lieu.id, lieu.lat + 0.00225, lieu.lng);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN loin_ok := true;
  END;
  PERFORM public.visiter_lieu(lieu.id, lieu.lat + 0.00135, lieu.lng);
  comp := public.compagnons_possibles(lieu.id);
  r := public.revendiquer_lieu(lieu.id, ARRAY[b, c], 'Les Loups de Test');
  SELECT COALESCE(NULLIF(x.title, ''), '?') INTO pilule FROM place_veille v JOIN expeditions x ON x.id = v.expedition_id WHERE v.place_id = lieu.id;

  -- A s'éloigne : la liste des compagnons lui est fermée.
  PERFORM public.signaler_presence(lieu.lat + 0.01, lieu.lng);
  comp_loin := public.compagnons_possibles(lieu.id);

  -- Une visite vieille de 40 minutes ne permet plus de revendiquer.
  UPDATE place_explorers SET visited_at = now() - interval '40 minutes' WHERE place_id = lieu.id AND user_id = a;
  BEGIN
    PERFORM public.revendiquer_lieu(lieu.id, '{}', NULL);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN tard_ok := true;
  END;

  RAISE EXCEPTION 'BILAN refus_loin=% compagnons=% revendication=% pilule=% membres=% liste_si_loin=% refus_tard=% decouvert_gps=%',
    loin_ok, comp, r, pilule,
    (SELECT count(*) FROM expedition_members m JOIN place_veille v ON v.expedition_id = m.expedition_id WHERE v.place_id = lieu.id),
    comp_loin, tard_ok,
    (SELECT method FROM places_discovered WHERE user_id = a AND place_id = lieu.id);
END $test$;
ROLLBACK;
