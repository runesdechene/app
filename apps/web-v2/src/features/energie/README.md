# energie — la jauge d'énergie

Conception : `docs/superpowers/specs/2026-10-01-v2-energie-design.md`. Base : migration 399.

Découvrir est gratuit à moins de 100 km ; plus loin, ça coûte de l'énergie. Cette zone montre la
jauge sur la carte (la coquille la pose sous la recherche) ; le prix d'une découverte, lui, vit
dans la zone `lieu`.

- `api/` — `energie.ts` (lire `mon_energie`) ; `lireEnergie.ts` (la forme de la réponse).
- `hooks/` — `useEnergie` (la jauge, relue chaque minute ; clé `['energie']`).
- `components/` — `JaugeEnergie` (la gélule, et la feuille qui dit la règle).
