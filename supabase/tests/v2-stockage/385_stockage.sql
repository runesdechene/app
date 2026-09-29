-- 385 : chacun son dossier dans le stockage. Annulé.
BEGIN;
\ir ../../migrations/385_stockage_chacun_son_dossier.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';  -- admin
  b text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';                                    -- un Explorateur sans rôle
  n int;
  res text[] := '{}';
BEGIN
  -- Un fichier d'Uriel existe déjà (posé hors règles, comme les photos en place).
  INSERT INTO storage.objects (bucket_id, name) VALUES ('place-images', 'places/' || a || '/deja.webp'),
    ('home-banners', 'test-deja.webp');

  -- Comme l'API Storage : les effacements passent, les règles décident lesquels.
  PERFORM set_config('storage.allow_delete_query', 'true', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN INSERT INTO storage.objects (bucket_id, name) VALUES ('place-images', 'places/' || b || '/moi.webp'); res := res || 'b-sa-photo-ok'::text;
    EXCEPTION WHEN others THEN res := res || ('b-sa-photo-REFUSEE ' || SQLERRM); END;
  BEGIN INSERT INTO storage.objects (bucket_id, name) VALUES ('place-images', b || '/avatar.webp'); res := res || 'b-son-avatar-ok'::text;
    EXCEPTION WHEN others THEN res := res || ('b-son-avatar-REFUSE ' || SQLERRM); END;
  BEGIN INSERT INTO storage.objects (bucket_id, name) VALUES ('place-images', 'places/' || a || '/intrus.webp'); res := res || 'b-chez-a-ACCEPTE'::text;
    EXCEPTION WHEN others THEN res := res || 'b-chez-a-refuse'::text; END;
  BEGIN INSERT INTO storage.objects (bucket_id, name) VALUES ('home-banners', 'pub.webp'); res := res || 'b-banniere-ACCEPTEE'::text;
    EXCEPTION WHEN others THEN res := res || 'b-banniere-refusee'::text; END;
  UPDATE storage.objects SET name = name WHERE bucket_id = 'place-images' AND name = 'places/' || a || '/deja.webp';
  GET DIAGNOSTICS n = ROW_COUNT; res := res || ('b-ecrase-a=' || n);
  DELETE FROM storage.objects WHERE name = 'places/' || a || '/deja.webp';
  GET DIAGNOSTICS n = ROW_COUNT; res := res || ('b-efface-a=' || n);
  DELETE FROM storage.objects WHERE bucket_id = 'home-banners' AND name = 'test-deja.webp';
  GET DIAGNOSTICS n = ROW_COUNT; res := res || ('b-efface-banniere=' || n);
  UPDATE storage.objects SET name = name WHERE name = 'places/' || b || '/moi.webp';
  GET DIAGNOSTICS n = ROW_COUNT; res := res || ('b-remplace-sa-photo=' || n);
  DELETE FROM storage.objects WHERE name = 'places/' || b || '/moi.webp';
  GET DIAGNOSTICS n = ROW_COUNT; res := res || ('b-efface-sa-photo=' || n);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  BEGIN INSERT INTO storage.objects (bucket_id, name) VALUES ('place-images', 'tutorial/t.webp'); res := res || 'admin-tutoriel-ok'::text;
    EXCEPTION WHEN others THEN res := res || ('admin-tutoriel-REFUSE ' || SQLERRM); END;
  BEGIN INSERT INTO storage.objects (bucket_id, name) VALUES ('home-banners', 'nouvelle.webp'); res := res || 'admin-banniere-ok'::text;
    EXCEPTION WHEN others THEN res := res || ('admin-banniere-REFUSEE ' || SQLERRM); END;
  DELETE FROM storage.objects WHERE bucket_id = 'home-banners' AND name = 'test-deja.webp';
  GET DIAGNOSTICS n = ROW_COUNT; res := res || ('admin-efface-banniere=' || n);

  RAISE EXCEPTION 'BILAN %', array_to_string(res, ' | ');
END $test$;
ROLLBACK;
