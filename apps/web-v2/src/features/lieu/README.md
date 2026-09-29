# lieu — la fiche d'un lieu et le geste de visite

Conception : `docs/superpowers/specs/2026-09-28-v2-fiche-lieu-design.md` (maquettes Figma
229:128, 230:128, 231:128, 232:128, 236:128).

- `/<onglet>/lieu/<id>` — la fiche : photo, faits, Explorateurs, revendication, récit ; envie,
  options, partage ; le bouton de visite (200 m, le serveur juge) et la fenêtre de revendication.

Chemin des données : `components/` → `hooks/` → `api/` → Supabase. La fiche est branchée sur la
coquille par `app/routes/lieu.tsx` ; la zone n'importe aucune autre zone.

- `api/` — lectures et écritures Supabase (migrations 364-365).
- `lib/` — les règles pures : distance, état du bouton, ligne de faits.
- `hooks/` — le cache, la position, la visite, la revendication, la présence, la suppression, les cœurs.
- `components/` — la fiche, le bouton, la fenêtre, les feuilles, les cœurs (`CoeursLieu`).
