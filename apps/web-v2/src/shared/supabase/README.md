# supabase — la porte vers la base

- `client.ts` — le client. Ne jamais en créer un second.
- `database.types.ts` — **généré, ne jamais modifier à la main.** Après chaque migration :
  `pnpm --filter web-v2 gen:types`, puis commit.

Qui a le droit d'importer d'ici : les dossiers `features/*/api/` et `app/access/`. ESLint refuse
les composants.
