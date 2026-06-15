-- 260_drop_enigmas_heritage_id.sql
-- WHY : Etape 3/3 du decouplage faction. Plus aucune RPC live, vue ou dependance ne
-- reference enigmas.heritage_id (migre vers theme en 259, audit pg_depend vide). On
-- supprime la colonne et sa FK vers factions. L'affichage utilise desormais le macaron
-- de theme (enigma.theme -> enigma_themes). title_fragments.collection (faction) reste.

BEGIN;
ALTER TABLE public.enigmas DROP CONSTRAINT IF EXISTS enigmas_heritage_id_fkey;
ALTER TABLE public.enigmas DROP COLUMN IF EXISTS heritage_id;
COMMIT;
