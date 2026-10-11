-- 481 : on salue une énigme percée sur « Sur les chemins ». Annulé.
BEGIN;
\ir ../../migrations/481_saluer_une_enigme.sql
DO $test$
DECLARE
  ev text; qui text; moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  premier json; second json; faux text; notif int;
BEGIN
  SELECT 'enigme:' || r.user_id || ':' || e.theme || ':' || r.responded_at::date, r.user_id INTO ev, qui
    FROM enigma_responses r JOIN enigmas e ON e.id = r.enigma_id
   WHERE r.correct AND r.responded_at IS NOT NULL AND r.user_id <> moi
   ORDER BY r.responded_at DESC LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', moi, 'role', 'authenticated')::text, true);
  premier := public.saluer(ev);
  second := public.saluer(ev);
  SELECT count(*) INTO notif FROM notifications WHERE recipient_id = qui AND type = 'salut' AND data->>'evenement' = ev;
  -- Un jour où personne n'a rien percé ne se salue pas.
  BEGIN PERFORM public.saluer('enigme:' || qui || ':celtique:1999-01-01'); faux := 'ACCEPTE';
  EXCEPTION WHEN others THEN faux := SQLERRM; END;
  RAISE EXCEPTION 'BILAN auteur_trouve=% premier=% second=% notif=% (attendu 1) jour_vide=% (attendu Introuvable)',
    public._auteur_du_chemin(ev) = qui, premier::text, second::text, notif, faux;
END $test$;
ROLLBACK;
