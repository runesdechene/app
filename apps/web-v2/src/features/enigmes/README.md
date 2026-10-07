# enigmes — la page « Les énigmes »

Ce que l'Explorateur a appris en perçant les « ? » de la carte : combien d'énigmes résolues sur le
total, par culture, puis, pour une culture, chaque énigme résolue avec sa réponse et son « Le
savais-tu ? ». Le jeu lui-même (les sceaux, la feuille d'une énigme) vit dans `features/carte`.

- `api/` — `mesEnigmes.ts` parle à Supabase (`mes_enigmes`, `mes_enigmes_culture`, migration 447) ;
  `lireMesEnigmes.ts` lit leur JSON.
- `hooks/` — `useMesEnigmes`, `useMaCulture` (clé `['mes-enigmes']`).
- `lib/` — les phrases (`enClair.ts`).
- `components/` — `PageEnigmes`, `PageCulture`, `PastilleCulture`.
