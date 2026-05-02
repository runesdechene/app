-- 058_v07_hotfix_drop_quest_triggers.sql
-- HOTFIX URGENT : les triggers d'auto-tracking des quêtes (mig 056) faisaient rollback
-- des transactions parentes (discover_place / harvest_crown / submit_enigma) quand
-- increment_quest_progress échouait. Conséquence prod : énergie infinie + coffres
-- pas récoltés mais réapparaissent.
--
-- Action : DROP les 4 triggers de quêtes. La quête #1 (moisson) et #2 (brouillard)
-- ne s'auto-trackeront plus côté DB — le reste du jeu redevient sain immédiatement.
-- Plan : réintroduire un tracking côté RPCs (au lieu de triggers) après diag.

DROP TRIGGER IF EXISTS trg_quest_progress_discovered ON public.places_discovered;
DROP TRIGGER IF EXISTS trg_quest_progress_enigma ON public.enigma_responses;
DROP TRIGGER IF EXISTS trg_quest_progress_moisson_ins ON public.crown_harvest;
DROP TRIGGER IF EXISTS trg_quest_progress_moisson_upd ON public.crown_harvest;
