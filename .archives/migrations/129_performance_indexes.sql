-- ============================================
-- MIGRATION 129 : Index de performance
-- ============================================
-- Ajout d'index sur les colonnes frequemment filtrees dans les RPCs

-- places.claimed_by — utilise dans get_player_profile, get_map_places
CREATE INDEX IF NOT EXISTS idx_places_claimed_by ON places(claimed_by);

-- user_fragments.user_id — utilise dans get_user_fragments, get_user_energy, get_all_player_titles
CREATE INDEX IF NOT EXISTS idx_user_fragments_user_id ON user_fragments(user_id);

-- activity_log.actor_id — utilise dans les requetes d'historique joueur
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id ON activity_log(actor_id);

-- fragment_words.fragment_id — utilise dans get_user_fragments, get_all_player_titles
CREATE INDEX IF NOT EXISTS idx_fragment_words_fragment_id ON fragment_words(fragment_id);

-- territory_name_votes.voter_id — utilise dans les requetes de vote
CREATE INDEX IF NOT EXISTS idx_territory_votes_voter ON territory_name_votes(voter_id);
