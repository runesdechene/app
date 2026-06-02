# La Carte — Runes de Chêne (V0.4 — L'Érudition Conquérante)

## Stack

React 18 + TypeScript strict · Vite 5 · Supabase · MapLibre GL JS · Zustand (6 stores) · CSS par composant · Netlify CLI manuel

## Commandes

```bash
pnpm dev                # port 3000
pnpm build              # tsc && vite build
cd apps/explore-web && netlify deploy --prod --dir "$PWD/dist" --no-build
```

## Conventions

- **pnpm** uniquement — **TypeScript strict** — pas de `any`
- **CSS par composant** — media queries dans `styles/mobile.css`
- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `docs:`
- **Pas de code mort** — si c'est unused, on supprime
- **Pas de console.log en prod**
- **Migrations SQL** — numérotées dans `supabase/migrations/`
- **RPCs** — logique métier côté serveur via `SECURITY DEFINER`

## Référence détaillée (.wolf/)

| Besoin | Fichier |
|--------|---------|
| Schéma BDD | `.wolf/schema.md` |
| RPCs | `.wolf/rpcs.md` |
| Gameplay & règles | `.wolf/gameplay.md` |
| Stores Zustand | `.wolf/stores.md` |
| Intégration Shopify | `.wolf/shopify.md` |
| Bugs connus | `.wolf/buglog.json` |
| Composants & fichiers | `.wolf/anatomy.md` |
