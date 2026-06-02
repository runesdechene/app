# Hub — Runes de Chêne (Back-office admin)

## Rôle

Back-office admin : paramètres du jeu, contenu, joueurs, boutique. Accès admin uniquement (`users.role = 'admin'`).

## Stack

React 18 + TypeScript · Vite 5 · Supabase · React Router DOM · CSS global (thème parchemin) · Netlify CLI manuel

## Commandes

```bash
pnpm --filter hub dev     # port 3001
pnpm --filter hub build
cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --no-build
```

## Conventions

- **Pattern SaveBar** : toutes les pages utilisent `<SaveBar>`. Pas d'auto-save (sauf AssignFragments).
- **Après chaque save** : refetch serveur pour garantir la synchro.
- **Deep copy** : `JSON.parse(JSON.stringify(data))` pour comparer sauvé vs courant.
- **try/finally** : wrapper les fetch pour éviter "Chargement..." infinis.
- **Classes CSS** : Publicités = `pub-*` (pas `ads-*`) pour éviter les ad blockers.

## Référence détaillée (.wolf/)

| Besoin | Fichier |
|--------|---------|
| Intégration Shopify | `.wolf/shopify.md` |
| Schéma BDD | `.wolf/schema.md` |
| Composants & fichiers | `.wolf/anatomy.md` |
| Bugs connus | `.wolf/buglog.json` |
