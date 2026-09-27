-- 346 — Quatre fonctions internes retirent leur droit d'appel public
--
-- WHY : audit du 27/09/2026. Ces fonctions SECURITY DEFINER agissent pour un `p_user_id` fourni
-- sans vérifier l'appelant, et étaient appelables par anon et authenticated. Aucune application
-- ne les appelle : elles ne servent qu'à d'autres fonctions ou à des déclencheurs
-- (answer_fragment_enigma, _trg_community_quest_place_added, _trg_quest_progress_*), qui
-- s'exécutent avec les droits du propriétaire et gardent donc l'accès. toggle_place_description_like
-- n'a plus aucun appelant (noté au registre de purge).

REVOKE EXECUTE ON FUNCTION public._answer_fragment_enigma_internal(p_user_id text, p_enigma_id integer, p_answer text, p_fragment_id integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_community_quest(p_user_id text, p_tracker_kind text, p_place_type text, p_amount integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_quest_progress(p_user_id text, p_tracker_kind text, p_amount integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.toggle_place_description_like(p_user_id text, p_place_id text) FROM PUBLIC, anon, authenticated;
