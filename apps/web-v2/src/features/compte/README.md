# compte — le Compte de l'Explorateur

Conception : `docs/superpowers/specs/2026-09-27-v2-compte-design.md`.

- `/<onglet>/menu` — le menu avatar (feuille) : Mon profil, Préférences, Déconnexion.
- `/<onglet>/explorateur/<id>` — le profil public, le même pour soi et pour les autres.

Chemin des données : `components/` → `hooks/` → `api/` → Supabase. Les écrans sont branchés
sur la coquille par `app/routes/compte.tsx`.

- `api/` — lectures et écritures Supabase (`get_profil_explorateur`, session).
- `hooks/` — le cache TanStack Query de ces lectures.
- `lib/` — le calcul pur, sans état (découpage de la présentation).
- `components/` — les écrans.
