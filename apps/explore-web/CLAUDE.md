# explore-web — La Carte

> App publique (V0.5 — L'Érudition Conquérante). Port dev 3000. Prod : carte.runesdechene.com (Netlify).

## Mémoire projet

Pour tout ce qui concerne **conventions, gotchas, décisions, préférences, architecture** :

**`~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`**

Pour la **structure du code** : interroger Graphify (`graphify-out/graph.json` à la racine du monorepo).

Pour les **docs externes** (React, Supabase, MapLibre…) : Context7 MCP.

## Spécificités cette app

- React 18 + Vite 5 + TypeScript strict
- MapLibre GL JS (carte)
- Zustand (6 stores)
- CSS par composant, media queries dans `styles/mobile.css`
- Supabase client : `src/lib/supabaseClient.ts`

## Commandes

```bash
pnpm dev                # port 3000
pnpm build              # tsc && vite build
# Deploy :
cd apps/explore-web && netlify deploy --prod --dir "$PWD/dist" --no-build
```

## Règles inviolables

- **Pas de `any`** (TS strict)
- **Pas de `console.log`** en prod
- **Pas de code mort** — supprimer si unused
- **RPCs** — logique métier côté serveur via `SECURITY DEFINER`

Détail : voir Citadelle `DEV/Conventions/` et `DEV/Gotchas/`.
