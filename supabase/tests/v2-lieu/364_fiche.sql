-- 364 : la fiche d'un lieu. Annulé.
BEGIN;
\ir ../../migrations/364_fiche_lieu.sql
DO $test$
DECLARE
  moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  public_id text; prive_autre text; f json; envie1 boolean; envie2 boolean; noms text[];
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', moi, 'role', 'authenticated')::text, true);
  SELECT p.id INTO public_id FROM places p
   WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE AND jsonb_array_length(p.images) > 1
     AND EXISTS (SELECT 1 FROM place_veille v WHERE v.place_id = p.id) LIMIT 1;
  SELECT p.id INTO prive_autre FROM places p WHERE (p.private OR p.masked) AND p.author_id <> moi LIMIT 1;
  f := public.fiche_lieu(public_id);
  envie1 := public.basculer_envie(public_id);
  envie2 := public.basculer_envie(public_id);
  noms := public.mes_noms_d_expedition();
  RAISE EXCEPTION 'BILAN nom=% photos=% type=% explorateurs=% revendication=% moi=% prive_autre=% inconnu=% envie=%/% noms=% liste=%',
    f->>'nom', json_array_length(f->'photos'), f->'type'->>'nom', f->'explorateurs'->>'nombre',
    f->'revendication'->>'nom', f->'moi', public.fiche_lieu(prive_autre), public.fiche_lieu('n-existe-pas'),
    envie1, envie2, cardinality(noms), json_array_length(public.explorateurs_du_lieu(public_id));
END $test$;
ROLLBACK;
