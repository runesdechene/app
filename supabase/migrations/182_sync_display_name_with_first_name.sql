-- 182_sync_display_name_with_first_name.sql
-- WHY : la mig 117 a backfill display_name = first_name un jour où first_name
-- valait encore 'Un voyageur sans nom' (legacy mig 044 archivée). Depuis, les
-- users qui ont customisé first_name via usePlayer.ts ont leur display_name
-- coincé sur la valeur legacy. 2484 users impactés (Yaz par ex.).
--
-- Le COALESCE(display_name, first_name) canonique des 59 RPCs V0.7 lit
-- display_name d'abord → "Un voyageur sans nom" affiché partout (La Cour,
-- Coupe, Expéditions, leaderboards). Cf. docs/db/tech-debt.md D2.
--
-- Approche : trigger BEFORE UPDATE OF first_name qui force display_name à
-- suivre first_name. Couvre app + hub + futurs call sites sans toucher au
-- code TS. Backfill initial pour rattraper les 2484 users existants ; les
-- comptes dormants ('Un voyageur sans nom' partout) sont laissés intacts.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_display_name_with_first_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.first_name IS NOT NULL AND NEW.first_name <> '' THEN
    NEW.display_name := NEW.first_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_display_name_with_first_name ON public.users;

CREATE TRIGGER trg_sync_display_name_with_first_name
  BEFORE INSERT OR UPDATE OF first_name ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_display_name_with_first_name();

-- Backfill one-shot : les users dont first_name a été customisé mais
-- display_name est resté coincé sur la valeur legacy. Comptes dormants
-- (first_name encore 'Un voyageur sans nom') intacts.
UPDATE public.users
SET display_name = first_name,
    updated_at = now()
WHERE display_name = 'Un voyageur sans nom'
  AND first_name IS NOT NULL
  AND first_name <> ''
  AND first_name <> 'Un voyageur sans nom';

COMMIT;
