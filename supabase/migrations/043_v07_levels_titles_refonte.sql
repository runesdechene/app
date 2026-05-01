-- 043_v07_levels_titles_refonte.sql
-- WHY : Refonte complète des titres généraux V0.7 (cf. spec §8).
-- 33 titres finaux sur 7 axes thématiques, tous threshold acquis à vie.
-- Plus aucun rank lifetime (qui frustrait en se faisant doubler).
--
-- Conditions JSONB normalisées sur les nouveaux compteurs :
--   level, discoveries, places_visited, enigma_score, plantages, places_added, carnets

-- ============================================================
-- 1. DELETE des titres dépréciés
-- ============================================================
DELETE FROM public.titles WHERE id IN (18, 19); -- Bâtisseur, Bâtisseur de cathédrales (concept fortifications disparu)

-- ============================================================
-- 2. UPDATE des titres existants vers les nouvelles conditions
-- ============================================================

-- Axe 1 — Niveau (refonte des anciens rank-glory)
UPDATE public.titles SET name='Légende',         icon='👑', "order"=8,  condition='{"stat":"level","min":50}'::jsonb, description='Tu as atteint le sommet — niveau 50.' WHERE id=20;
UPDATE public.titles SET name='Héros régional',  icon='🏛️', "order"=21, condition='{"stat":"level","min":35}'::jsonb, description='Niveau 35 atteint.' WHERE id=24;
UPDATE public.titles SET name='Héros local',     icon='🛡️', "order"=20, condition='{"stat":"level","min":25}'::jsonb, description='Niveau 25 atteint.' WHERE id=23;

-- Axe 2 — Découvertes brouillard (existants, conservés mais seuils ajustés)
UPDATE public.titles SET name='Novice',     icon='🌱', condition='{"stat":"discoveries","min":0}'::jsonb,   description='Tu viens de t''inscrire... c''est déjà bien.' WHERE id=1;
UPDATE public.titles SET name='Explorateur',icon='🧭', condition='{"stat":"discoveries","min":50}'::jsonb,  description='Tu as découvert plus de 50 lieux.' WHERE id=2;
UPDATE public.titles SET name='Arpenteur',  icon='🗺️', condition='{"stat":"discoveries","min":200}'::jsonb, description='Tu as découvert plus de 200 lieux.' WHERE id=3;

-- Axe 3 — Marche physique (refonte des anciens "exploration" morts)
UPDATE public.titles SET name='Pèlerin',              icon='🥾', "order"=30, condition='{"stat":"places_visited","min":10}'::jsonb,  description='Tu as foulé 10 lieux.' WHERE id=25;
UPDATE public.titles SET name='Cheminant',            icon='🚶', "order"=31, condition='{"stat":"places_visited","min":50}'::jsonb,  description='Tu as foulé 50 lieux.' WHERE id=26;
UPDATE public.titles SET name='Marcheur des Mondes',  icon='🌍', "order"=33, condition='{"stat":"places_visited","min":500}'::jsonb, description='Tu as foulé 500 lieux.' WHERE id=27;

-- Axe 4 — Érudition (refonte des anciens "erudition" morts)
UPDATE public.titles SET name='Érudit',     icon='📚', "order"=40, condition='{"stat":"enigma_score","min":50}'::jsonb,  description='50 points d''énigmes pondérés.' WHERE id=28;
UPDATE public.titles SET name='Philosophe', icon='🦉', "order"=41, condition='{"stat":"enigma_score","min":150}'::jsonb, description='150 points d''énigmes pondérés.' WHERE id=29;
UPDATE public.titles SET name='Grand Sage', icon='📖', "order"=42, condition='{"stat":"enigma_score","min":400}'::jsonb, description='400 points d''énigmes pondérés.' WHERE id=30;

-- Axe 5 — Bannière (refonte des anciens claims morts)
UPDATE public.titles SET name='Hérault',            icon='🏴', "order"=51, condition='{"stat":"plantages","min":10}'::jsonb,  description='Tu as planté 10 bannières.' WHERE id=5;
UPDATE public.titles SET name='Maréchal',           icon='👑', "order"=54, condition='{"stat":"plantages","min":200}'::jsonb, description='Tu as planté 200 bannières.' WHERE id=17;

-- Axe 6 — Cartographie (refonte des anciens rank places_added)
UPDATE public.titles SET name='Cartographe Initié', icon='🧭', "order"=61, condition='{"stat":"places_added","min":5}'::jsonb,   description='Tu as cartographié 5 lieux.' WHERE id=31;
UPDATE public.titles SET name='Cartographe',        icon='📐', "order"=62, condition='{"stat":"places_added","min":25}'::jsonb,  description='Tu as cartographié 25 lieux.' WHERE id=32;
UPDATE public.titles SET name='Maître-Cartographe', icon='🏗️', "order"=64, condition='{"stat":"places_added","min":500}'::jsonb, description='Tu as cartographié 500 lieux.' WHERE id=33;
-- ID 22 (Grand Chroniqueur) ajusté en place 100
UPDATE public.titles SET name='Grand Chroniqueur',  icon='📜', "order"=63, condition='{"stat":"places_added","min":100}'::jsonb, description='Tu as cartographié 100 lieux.' WHERE id=22;

-- ============================================================
-- 3. INSERT des nouveaux titres pour compléter à 33
-- ============================================================

-- Axe 1 — Niveau, paliers manquants (Compagnon, Veilleur, Héros)
INSERT INTO public.titles (name, type, faction_id, "order", icon, unlocks, condition, description) VALUES
  ('Compagnon', 'general', NULL, 4,  '⚜️', '{}'::text[], '{"stat":"level","min":5}'::jsonb,  'Niveau 5 atteint.'),
  ('Veilleur',  'general', NULL, 5,  '⚔️', '{}'::text[], '{"stat":"level","min":15}'::jsonb, 'Niveau 15 atteint. Tu portes le titre de Veilleur.'),
  ('Héros',     'general', NULL, 22, '🦅', '{}'::text[], '{"stat":"level","min":42}'::jsonb, 'Niveau 42 atteint.');

-- Axe 2 — Découvertes brouillard, paliers manquants (Curieux, Grand Voyageur)
INSERT INTO public.titles (name, type, faction_id, "order", icon, unlocks, condition, description) VALUES
  ('Curieux',        'general', NULL, 1,  '🔍', '{}'::text[], '{"stat":"discoveries","min":10}'::jsonb,   'Tu as découvert plus de 10 lieux.'),
  ('Grand Voyageur', 'general', NULL, 4,  '🌐', '{}'::text[], '{"stat":"discoveries","min":1000}'::jsonb, 'Tu as découvert plus de 1000 lieux.');

-- Axe 3 — Marche, palier manquant (Errant)
INSERT INTO public.titles (name, type, faction_id, "order", icon, unlocks, condition, description) VALUES
  ('Errant', 'general', NULL, 32, '⚔️', '{}'::text[], '{"stat":"places_visited","min":150}'::jsonb, 'Tu as foulé 150 lieux. Tel un chevalier errant.');

-- Axe 4 — Érudition, palier manquant (Apprenti Sage)
INSERT INTO public.titles (name, type, faction_id, "order", icon, unlocks, condition, description) VALUES
  ('Apprenti Sage', 'general', NULL, 39, '📜', '{}'::text[], '{"stat":"enigma_score","min":15}'::jsonb, '15 points d''énigmes pondérés.');

-- Axe 5 — Bannière, paliers manquants (Recrue, Banneret, Capitaine)
INSERT INTO public.titles (name, type, faction_id, "order", icon, unlocks, condition, description) VALUES
  ('Recrue',    'general', NULL, 50, '🌑', '{}'::text[], '{"stat":"plantages","min":3}'::jsonb,  'Tu as planté 3 bannières.'),
  ('Banneret',  'general', NULL, 52, '⚜️', '{}'::text[], '{"stat":"plantages","min":30}'::jsonb, 'Tu as planté 30 bannières.'),
  ('Capitaine', 'general', NULL, 53, '🛡️', '{}'::text[], '{"stat":"plantages","min":80}'::jsonb, 'Tu as planté 80 bannières.');

-- Axe 6 — Cartographie, palier manquant (Pionnier)
INSERT INTO public.titles (name, type, faction_id, "order", icon, unlocks, condition, description) VALUES
  ('Pionnier', 'general', NULL, 60, '🌟', '{}'::text[], '{"stat":"places_added","min":1}'::jsonb, 'Tu as cartographié ton premier lieu.');

-- Axe 7 — Carnets (NOUVEAU axe complet, 4 titres)
INSERT INTO public.titles (name, type, faction_id, "order", icon, unlocks, condition, description) VALUES
  ('Page',           'general', NULL, 70, '📝', '{}'::text[], '{"stat":"carnets","min":1}'::jsonb,   'Ton premier récit.'),
  ('Conteur',        'general', NULL, 71, '🪶', '{}'::text[], '{"stat":"carnets","min":10}'::jsonb,  'Tu as écrit 10 récits.'),
  ('Chroniqueur',    'general', NULL, 72, '📜', '{}'::text[], '{"stat":"carnets","min":50}'::jsonb,  'Tu as écrit 50 récits.'),
  ('Maître Conteur', 'general', NULL, 73, '📖', '{}'::text[], '{"stat":"carnets","min":200}'::jsonb, 'Tu as écrit 200 récits.');
