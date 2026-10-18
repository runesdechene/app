-- WHY: Le mod « pouls » de Claude Code est retiré (mis en service puis écarté le 18/10/2026 : il
--      marchait, mais un chiffre ambiant n'apportait rien). Sa fonction edge `pouls` est le seul
--      appelant que _hub_pouls_periode(text) ait jamais eu sous la clé service_role ; elle part du
--      dépôt et du projet Supabase, donc le grant n'a plus d'objet et on le reprend.
--      On ne défait QUE ce grant. _hub_bornes(text) et _hub_pouls_periode(text) restent — elles
--      portent le calcul des bornes et le compteur « actifs » que la 528 a sortis de hub_ouverture,
--      qui les appelle et en dépend. hub_ouverture est SECURITY DEFINER : elle exécute sous son
--      propriétaire, pas sous service_role, donc ce REVOKE ne lui enlève rien.
-- SCHEMA CHECKED (18/10/2026, live) : has_function_privilege('service_role',
--   'public._hub_pouls_periode(text)', 'EXECUTE') = true (le grant de la 528, bien là, donc il y a
--   quelque chose à reprendre) ; pour 'authenticated' = false (déjà fermé, rien à faire).
--   schema_migrations s'arrête à 528 : le numéro 529 est libre.

REVOKE EXECUTE ON FUNCTION public._hub_pouls_periode(text) FROM service_role;
