-- 121_app_settings_crowns_seeds.sql
-- WHY : Phase 1 du nouveau système Couronnes (spec 2026-05-07).
-- On externalise les constantes de l'éco Couronnes vers app_settings pour pouvoir
-- les ajuster à chaud sans nouvelle migration. La mig 122 (refonte
-- get_my_crowns_state) lit ces clés via COALESCE — donc valeurs par défaut
-- protégées si la clé manque, mais on seed explicitement pour documenter.

BEGIN;

INSERT INTO public.app_settings (key, value) VALUES
  ('crowns_proba_k',                  '3.87'),  -- p(N) = K / sqrt(N) ; K=sqrt(15) → p(15)=1.0
  ('crowns_proba_n_floor',            '15'),    -- N <= ce seuil → 100% (tous les coffres visibles)
  ('crowns_drip_start_hour',          '6'),     -- heure de début d'apparition (HH:00 local server)
  ('crowns_drip_end_hour',            '20'),    -- heure de fin d'apparition (tout dispo après)
  ('crowns_stock_cap',                '500'),   -- plafond de stock (= valeur actuelle dans harvest_crown)
  ('crowns_discovery_gain',           '1'),     -- gain par découverte 1ère visite GPS
  ('crowns_quest_discover_threshold', '3'),     -- nombre de découvertes pour la mini-quête
  ('crowns_quest_discover_bonus',     '1')      -- bonus de la mini-quête
ON CONFLICT (key) DO NOTHING;

COMMIT;
