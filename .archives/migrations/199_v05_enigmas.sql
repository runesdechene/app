-- 199_v05_enigmas.sql
-- V0.5 : énigmes quotidiennes + énigmes de lieu

CREATE TABLE IF NOT EXISTS enigmas (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('daily', 'place')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  heritage_id VARCHAR(255) REFERENCES factions(id),  -- NULL = toutes factions
  place_tag TEXT,                                      -- NULL = pas lié à un tag de lieu
  lore_text TEXT NOT NULL,                             -- 2 lignes de contexte historique
  question TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('qcm', 'free')),
  choices JSONB,                                       -- ["choix1","choix2","choix3","choix4"] pour QCM
  answer TEXT NOT NULL,                                -- réponse correcte
  explanation TEXT NOT NULL,                            -- explication affichée après réponse
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enigmas_type_active ON enigmas(type, active);
CREATE INDEX IF NOT EXISTS idx_enigmas_daily ON enigmas(type, difficulty) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_enigmas_place_tag ON enigmas(place_tag) WHERE type = 'place' AND active = TRUE;

-- Historique des réponses (1 par jour par user pour les daily)
CREATE TABLE IF NOT EXISTS enigma_responses (
  id SERIAL PRIMARY KEY,
  enigma_id INT NOT NULL REFERENCES enigmas(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_given TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  influence_gained INT NOT NULL DEFAULT 0,
  erudition_gained INT NOT NULL DEFAULT 0,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enigma_responses_user_date ON enigma_responses(user_id, responded_at DESC);

-- Vue pour savoir si le joueur a déjà répondu aujourd'hui
CREATE OR REPLACE VIEW daily_enigma_status AS
SELECT
  er.user_id,
  er.responded_at::DATE AS response_date,
  er.correct,
  er.enigma_id
FROM enigma_responses er
JOIN enigmas e ON e.id = er.enigma_id
WHERE e.type = 'daily';

-- RLS
ALTER TABLE enigmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enigmas_select" ON enigmas FOR SELECT USING (active = TRUE);

ALTER TABLE enigma_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "responses_select" ON enigma_responses FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "responses_insert" ON enigma_responses FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
