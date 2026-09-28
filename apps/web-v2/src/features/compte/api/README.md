# api — ce que la zone Compte demande à Supabase

Le seul dossier de la zone qui parle à Supabase. Chaque fonction rend une donnée typée ou
lève une erreur ; jamais un `{ error }` à vérifier plus loin.

- `lireProfil.ts` — la forme d'un profil et sa lecture défensive du JSON (tout ou `null`).
- `explorateur.ts` — `fetchExplorateur(id)` : `get_profil_explorateur` (migration 354).
- `session.ts` — qui est connecté ; la déconnexion (partagée avec la V1).
- `monProfil.ts` — nom, présentation, Instagram, titres portés, accord des titres, signe.
- `avatar.ts` — la photo : webp 400 px, `place-images/<id>/avatar.webp`.
- `preferences.ts` — lecture et réglages (migration 353), e-mail, lien du Hub.
- `position.ts` — la position de celui qui regarde, seulement si déjà autorisée (jamais de demande).
