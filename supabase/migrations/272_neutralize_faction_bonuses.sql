-- 272_neutralize_faction_bonuses.sql
-- Identité pure : zéro bonus mécanique de classe. Additif & réversible : on met tous les
-- bonus à 0 (colonnes et lignes conservées, jamais de DROP).
--
-- ROLLBACK — anciennes valeurs (au 23/06/2026) :
--   faction-celtique  : bonus_construction=1, bonus_regen_vitalite=50, bonus_vitalite=2
--   faction-nordique  : bonus_vitalite=1
--   faction-byzantine : bonus_conquest=1, bonus_construction=2, bonus_regen_construction=50
--   faction-romaine   : bonus_conquest=1, bonus_construction=1, bonus_regen_conquest=50
--   faction_tag_bonuses : 24 lignes, cost_reduction d'origine (re-seed depuis l'historique mig).

update public.factions set
  bonus_conquest = 0, bonus_construction = 0, bonus_energy = 0, bonus_regen = 0,
  bonus_regen_conquest = 0, bonus_regen_construction = 0, bonus_regen_energy = 0,
  bonus_regen_vitalite = 0, bonus_vitalite = 0;

-- Bonus de coût par tag : neutralisés sans DROP (lignes conservées, réversible).
update public.faction_tag_bonuses set cost_reduction = 0;
