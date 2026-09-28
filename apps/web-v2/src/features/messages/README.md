# messages — l'onglet Messages

Conception : `docs/superpowers/specs/2026-08-18-app-v2-design.md`, §10 ; maquette Figma 45:278.
Base : migration 371 (le Registre).

« Un chat de MMO, pas une messagerie. » Deux onglets : **La communauté** (le Registre, public —
les canaux « général » et « Bugs & suggestions » de la table `chat_messages`, partagée avec la V1)
et **Les Murmures** (privés, pas encore en base : l'onglet le dit).

- `api/` — `registre.ts` (lire, écrire, écouter en direct) et `lireRegistre.ts` (la forme d'un
  message).
- `hooks/` — `useRegistre` (le Registre en cache, relu à chaque nouveau message, et l'écriture).
- `components/` — `MessagesScreen` (les deux onglets) et `Registre` (canaux, messages, écrire).
- À venir : les Murmures (une table et ses règles d'accès), la pastille de non-lus sur l'onglet.
