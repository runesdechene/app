-- 394 : le point des messages ratés du Registre, et la pastille des mentions. Annulé.
BEGIN;
\ir ../../migrations/394_registre_lu.sql
DO $test$
DECLARE
  moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  autre text := (SELECT id FROM users WHERE id <> 'cb16ff47-1ead-4adf-8eff-04d117551541' LIMIT 1);
  jamais json; apres_lecture json; apres_autre json; apres_moi json; relu json; anon text;
  v_id bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', moi, 'role', 'authenticated')::text, true);
  DELETE FROM chat_mentions WHERE user_id = moi; -- partir d'une page blanche (annulé à la fin)
  jamais := public.registre_non_lus();          -- jamais ouvert : rien de raté
  PERFORM public.marquer_registre_lu();
  apres_lecture := public.registre_non_lus();   -- tout lu : 0 / 0
  INSERT INTO chat_messages (channel, user_id, user_name, content) VALUES ('general', autre, 'Autre', 'Salut !');
  INSERT INTO chat_messages (channel, user_id, user_name, content) VALUES ('bugs', autre, 'Autre', 'Un bug @Moi')
  RETURNING id INTO v_id;
  INSERT INTO chat_mentions (message_id, user_id) VALUES (v_id, moi);
  apres_autre := public.registre_non_lus();     -- deux messages des autres, dont une mention : 2 / 1
  INSERT INTO chat_messages (channel, user_id, user_name, content) VALUES ('general', moi, 'Moi', 'Moi');
  apres_moi := public.registre_non_lus();       -- les miens ne comptent pas : toujours 2 / 1
  PERFORM public.marquer_registre_lu();
  relu := public.registre_non_lus();            -- relu : 0 / 0
  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.registre_non_lus(); anon := 'OUVERT A ANON'; EXCEPTION WHEN others THEN anon := 'anon refusé'; END;
  RAISE EXCEPTION 'BILAN jamais=% apres_lecture=% apres_autre=% apres_moi=% relu=% %',
    replace(jamais::text, '"', ''), replace(apres_lecture::text, '"', ''),
    replace(apres_autre::text, '"', ''), replace(apres_moi::text, '"', ''),
    replace(relu::text, '"', ''), anon;
END $test$;
ROLLBACK;
