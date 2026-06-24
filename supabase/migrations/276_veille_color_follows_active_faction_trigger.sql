-- 276_veille_color_follows_active_faction_trigger.sql
-- WHY : la couleur d'un lieu (place_veille.faction_id) est dénormalisée. Avec les
-- nouvelles RPC Compagnie (create/join/leave/set_active_faction), changer de Compagnie
-- active ne recolorait plus les lieux veillés du joueur (seul l'ancien set_user_faction
-- le faisait). Un TRIGGER sur users.faction_id couvre TOUS les chemins d'un coup :
-- dès que la bannière active change, les veilles non-neutres du joueur suivent.
-- ADDITIF / sûr.

CREATE OR REPLACE FUNCTION public._sync_veille_color_on_faction_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.faction_id IS DISTINCT FROM OLD.faction_id THEN
    -- Les lieux veillés en solo (non expédition neutre) suivent la Compagnie active.
    -- faction_id NULL → lieu neutre gris (rendu géré côté carte).
    UPDATE public.place_veille
    SET faction_id = NEW.faction_id
    WHERE veilleur_user_id = NEW.id AND NOT is_neutral;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS users_faction_color_sync ON public.users;
CREATE TRIGGER users_faction_color_sync
  AFTER UPDATE OF faction_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_veille_color_on_faction_change();
