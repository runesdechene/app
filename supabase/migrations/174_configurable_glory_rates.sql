-- ============================================
-- MIGRATION 174 : Taux de Gloire configurables
-- ============================================

INSERT INTO app_settings (key, value) VALUES ('glory_discover', '2') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('glory_claim', '5') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('glory_fortify', '5') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('glory_cost_bonus_pct', '10') ON CONFLICT (key) DO NOTHING;
