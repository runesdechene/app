# navigation — les onglets et les détails

Tout état navigable est une URL (décision 006).

- `tabs.ts` — les cinq onglets, et ce que fait un toucher (fonction pure).
- `useTabMemory.ts` — la dernière adresse de chaque onglet.
- `TabRoute.tsx` — laisse passer un onglet connu, redirige le reste vers l'Accueil.
- `closeDetail.ts` — où mène « fermer » un détail, sans jamais quitter l'app.

On n'y range pas : de mise en page (voir `shell/`).
