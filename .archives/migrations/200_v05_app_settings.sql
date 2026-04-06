-- 200_v05_app_settings.sql
-- V0.5 : settings pour le système d'influence et les énigmes

INSERT INTO app_settings (key, value) VALUES
  -- Influence
  ('influence_max_remote_per_day', '5'),          -- max points placables à distance par jour
  ('influence_decay_per_week', '1'),              -- decay hebdomadaire des placed_points
  ('influence_visit_gps', '10'),                  -- influence gagnée par visite GPS
  ('influence_add_place', '25'),                  -- influence gagnée en ajoutant un lieu
  ('influence_add_photo', '5'),                   -- influence gagnée en ajoutant une photo
  ('influence_add_carnet', '10'),                 -- influence gagnée en ajoutant une page de carnet
  ('influence_per_vote', '1'),                    -- influence permanente par vote reçu

  -- Exploration
  ('exploration_visit_gps', '2'),
  ('exploration_add_place', '5'),
  ('exploration_add_photo', '1'),
  ('exploration_add_carnet', '1'),

  -- Érudition
  ('erudition_add_carnet', '1'),
  ('erudition_enigma_wrong', '1'),                -- érudition même si mauvaise réponse

  -- Énigme quotidienne (bonne réponse)
  ('enigma_influence_easy', '3'),
  ('enigma_influence_medium', '4'),
  ('enigma_influence_hard', '5'),
  ('enigma_erudition_easy', '1'),
  ('enigma_erudition_medium', '2'),
  ('enigma_erudition_hard', '3'),

  -- Énigme de lieu
  ('enigma_place_influence_base', '2'),
  ('enigma_place_influence_per_diff', '1'),
  ('enigma_place_erudition_base', '2'),
  ('enigma_place_erudition_per_diff', '1')
ON CONFLICT (key) DO NOTHING;
