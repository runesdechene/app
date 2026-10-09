# Compagnies

Les antennes locales (spec `docs/superpowers/specs/2026-10-05-v2-compagnies-design.md`, migrations
420 à 422) : la page « Les Compagnies », la fiche d'une Compagnie, Fonder et Gérer, et l'écran
« C'est réservé aux Porteurs ». Le canal d'une Compagnie vit dans La Communauté (zone Messages) ;
rejoindre ou quitter relit la clé partagée `canauxKey`.

- `api/` — les appels (`compagnies`, `compagnie`, `fonder_compagnie`…) et leur lecture.
- `hooks/` — les données en cache et les gestes.
- `lib/` — ce qui se calcule sans état (chercher, le rôle accordé).
- `components/` — les écrans.
