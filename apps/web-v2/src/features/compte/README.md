# compte — le Compte de l'Explorateur

Conception : `docs/superpowers/specs/2026-09-27-v2-compte-design.md` (et §0 de
`2026-08-18-app-v2-design.md` : le Compte est un onglet depuis le 28/09).

- `/compte` — l'onglet Compte : mon profil, Préférences, Déconnexion.
- `/<onglet>/explorateur/<id>` — le profil public, le même pour soi et pour les autres.
- `/<onglet>/explorateur/<moi>/modifier` — Modifier mon profil.
- `/<onglet>/preferences` — les Préférences.

Chemin des données : `components/` → `hooks/` → `api/` → Supabase. Les écrans sont branchés
sur la coquille par `app/routes/compte.tsx`.

- `api/` — lectures et écritures Supabase (profil, titres, avatar, préférences, session).
- `hooks/` — le cache TanStack Query de ces lectures.
- `lib/` — le calcul pur, sans état (découpage de la présentation).
- `components/` — les écrans.
