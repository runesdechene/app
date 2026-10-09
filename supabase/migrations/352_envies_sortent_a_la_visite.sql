-- 352 — Une envie visitée sort de la liste
--
-- WHY : zone Compte — les listes du profil sont exclusives. Un lieu visité n'est plus une
-- « Envie d'y aller ». En base (et non dans le front) pour couvrir aussi les visites faites
-- depuis la V1. Nettoyage unique des envies déjà visitées ou déjà ajoutées par leur auteur.

CREATE OR REPLACE FUNCTION public._trg_envie_visitee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.place_wishlist WHERE user_id = NEW.user_id AND place_id = NEW.place_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._trg_envie_visitee() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS envie_visitee ON public.place_explorers;
CREATE TRIGGER envie_visitee
  AFTER INSERT ON public.place_explorers
  FOR EACH ROW EXECUTE FUNCTION public._trg_envie_visitee();

DELETE FROM public.place_wishlist w
 WHERE EXISTS (SELECT 1 FROM public.place_explorers e WHERE e.user_id = w.user_id AND e.place_id = w.place_id)
    OR EXISTS (SELECT 1 FROM public.places p WHERE p.id = w.place_id AND p.author_id = w.user_id);
