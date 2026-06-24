-- 294_orphan_veilles_adopt_faction.sql
-- WHY : depuis le retrait du repeinturage-au-toggle (mig 289), les lieux veillés SANS
-- compagnie (faction_id NULL, pris en étant factionless) ne prenaient plus la couleur de
-- la première compagnie rejointe → territoires « perdus ». On adopte UNIQUEMENT les veilles
-- orphelines (faction_id IS NULL, non neutres) lorsqu'un joueur gagne/active une compagnie.
-- Les veilles déjà rattachées à une compagnie ne bougent pas (toggle ne repeint pas). ADDITIF.

CREATE OR REPLACE FUNCTION public._adopt_orphan_veilles_on_faction_gain()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.faction_id IS NOT NULL AND NEW.faction_id IS DISTINCT FROM OLD.faction_id THEN
    UPDATE public.place_veille
    SET faction_id = NEW.faction_id
    WHERE veilleur_user_id = NEW.id
      AND faction_id IS NULL
      AND NOT is_neutral;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS users_adopt_orphan_veilles ON public.users;
CREATE TRIGGER users_adopt_orphan_veilles
  AFTER UPDATE OF faction_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public._adopt_orphan_veilles_on_faction_gain();

-- Backfill : réparer les joueurs déjà en compagnie dont les veilles orphelines sont restées grises
UPDATE public.place_veille pv
SET faction_id = u.faction_id
FROM public.users u
WHERE u.id = pv.veilleur_user_id
  AND u.faction_id IS NOT NULL
  AND pv.faction_id IS NULL
  AND NOT pv.is_neutral;
