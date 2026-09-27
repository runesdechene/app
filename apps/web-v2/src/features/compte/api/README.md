# api — ce que la zone Compte demande à Supabase

Le seul dossier de la zone qui parle à Supabase. Chaque fonction rend une donnée typée ou
lève une erreur ; jamais un `{ error }` à vérifier plus loin.

- `lireProfil.ts` — la forme d'un profil et sa lecture défensive du JSON (tout ou `null`).
- `explorateur.ts` — `fetchExplorateur(id)` : `get_profil_explorateur` (migration 354).
- `session.ts` — qui est connecté ; la déconnexion (partagée avec la V1).
