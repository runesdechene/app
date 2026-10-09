-- 392 : la carte des visiteurs, aux positions floutées. Annulé.
BEGIN;
\ir ../../migrations/392_carte_publique.sql
DO $test$
DECLARE
  carte json; total int; publics int; ecart_max float8; ecart_moyen float8; fixe boolean;
  masques int; personne int;
BEGIN
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  carte := public.carte_publique();
  fixe := public.carte_publique()::text = carte::text;
  PERFORM set_config('role', 'postgres', true);
  total := json_array_length(carte);
  SELECT count(*) INTO publics FROM places
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND masked IS NOT TRUE AND private IS NOT TRUE;
  -- L'écart en km entre la position floutée et la vraie.
  SELECT max(d), avg(d) INTO ecart_max, ecart_moyen FROM (
    SELECT sqrt(power(((x->>'lat')::float8 - p.latitude) * 111, 2)
              + power(((x->>'lng')::float8 - p.longitude) * 111 * cos(radians(p.latitude)), 2)) AS d
    FROM json_array_elements(carte) x JOIN places p ON p.id = x->>'id') e;
  SELECT count(*) INTO masques FROM json_array_elements(carte) x JOIN places p ON p.id = x->>'id'
    WHERE p.masked IS TRUE OR p.private IS TRUE;
  SELECT count(*) INTO personne FROM json_array_elements(carte) x
    WHERE x->>'etat' <> 'inconnu' OR json_typeof(x->'revendication') <> 'null';
  RAISE EXCEPTION 'BILAN lieux=% (publics=%) | ecart km max=% moyen=% | fixe=% | masques=% | etat/personne=% | exemple=%',
    total, publics, round(ecart_max::numeric, 2), round(ecart_moyen::numeric, 2), fixe, masques, personne,
    left((carte->0)::text, 220);
END $test$;
ROLLBACK;
