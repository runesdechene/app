# Discipline XO — Garder le code propre, pour toujours

> Règles auto-imposées après le Sprint Purification (mai 2026).
> Tirées de vraies erreurs, pas de théorie. Je m'y soumets à chaque session.

---

## A. Avant de toucher au code

### A1. Graphify d'abord, fichier ensuite
Pour toute question "où vit X / comment marche Y" :
1. `grep` dans `graphify-out/graph.json` (RPC, table, composant)
2. Lire le fichier source pointé (ligne exacte)
3. Pas de Glob `**/*` à l'aveugle si le graph répond.

### A2. Helpers existants AVANT d'en créer
Avant d'écrire une fonction utilitaire, scanner :
- `apps/explore-web/src/lib/` — `discoverPlace`, `dateFormat`, `avatarUpload`, `titleProgress`, `exploreMapConstants`, `loadRecentActivityToasts`
- `apps/explore-web/src/types/` — `playerProfile`, `placeDetail`
- Si quelque chose ressemble à 80% → étendre l'existant, pas créer un doublon.

### A3. RPCs/tables existantes AVANT d'en créer
Avant d'imaginer une nouvelle RPC, vérifier :
- Le graph SQL (348 nodes) — peut-être qu'elle existe déjà sous un autre nom
- `docs/db/gotchas.md` — peut-être qu'on a déjà tranché ce cas
- Les RPCs proches sémantiquement (ex: `get_user_*`)

---

## B. Quand on touche du SQL

### B1. Redéfinir une RPC = COPIER-COLLER la baseline entière
Jamais de redéfinition de mémoire. Toujours :
1. Trouver la version courante via le graph (`source_file:source_location`)
2. Copier-coller intégralement
3. Retirer/modifier UNIQUEMENT ce qui doit changer
*Origine de la règle : bug `get_place_by_id` du 5 mai (mig 074).*

### B2. ALTER PUBLICATION → wrap en DO block
`ALTER PUBLICATION ... DROP TABLE IF EXISTS` n'existe pas en Postgres.
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE ...) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.foo;
  END IF;
END $$;
```

### B3. Pas de PERFORM dans une RPC pour appeler une autre RPC métier
Couplage caché. Si la RPC appelée plante, la RPC appelante plante avec — bug invisible côté front.
*Origine : bug emoji bloqué par bug quêtes (2 mai).*

### B4. Commenter en tête de migration le POURQUOI
Pas le quoi (la SQL le dit), le pourquoi. 3-5 lignes max.
Ex : `-- Drop place_claims : système de claim V0 remplacé par influence V0.5 (avril 2026).`

### B5. Appliquer les migrations SOI-MÊME
`pnpm dlx supabase db push` côté XO, pas demander à Uriel.
Ensuite vérifier en prod (pas juste rapport agent).

---

## C. Quand on touche au frontend

### C1. Sub-folder dès la création
Tout nouveau composant va dans le bon sous-dossier dès le départ :
- `components/map/{badges,controls,core,markers,modals,overlays}/`
- `components/places/{actions,cards,modals,views}/`
- `components/{auth,enigma,landing,profile,social}/`
- Si aucun ne colle → demander à Uriel avant de créer une nouvelle catégorie.

### C2. >300 lignes = se poser la question
- 300-700 : OK si cohérent.
- 700-1000 : extraire types + helpers + sous-composants si possible.
- >1000 : signal d'alarme. PlacePanel/ExploreMap restent à 978/997 par dette assumée — si on en crée un nouveau >1000, on a fauté.

### C3. Une fonction utilitaire = un fichier dans `lib/`
Pas de fourre-tout `utils.ts`. Standalone (lit le store via `getState()`) si pas React-aware.

### C4. Hook = stateful React. Lib = standalone.
Si la "logique" tient sans React, c'est `lib/`. Si elle a besoin de `useState`/`useEffect`, c'est `hooks/`.

### C5. Pas de `any`, pas de `// @ts-ignore`, pas de `as unknown as X`
TS strict. Si tu y penses, c'est que tu n'as pas compris le type. Lis-le.

---

## D. Chaque session, le réflexe Pareto

### D1. Drop le mort qu'on croise
À chaque feature, si je tombe sur du code clairement obsolète sur la trajectoire → je le supprime dans le même commit. Pas "on verra plus tard". Pas de "sprint cleanup" tous les 6 mois.

### D2. Rustine = signal racine
Si je m'apprête à patcher un truc qui semble fragile, le racine est probablement à corriger. Ne pas empiler.
*Origine : feedback du 28 avril.*

### D3. Pas de subagent pour un truc simple
Économie de tokens. Subagent OK si :
- Recherche cross-codebase ouverte (>3 queries probables)
- Audit indépendant souhaité (code review)
Sinon Glob/Grep direct.

### D4. Lire le minimum nécessaire
Pas le fichier entier si on cherche une fonction. `Read` avec `offset`/`limit` ou `Grep` avec context.

---

## E. Avant de pousser

### E1. Build OK obligatoire (pnpm build)
Pas de "ça compile chez moi". TSC strict + Vite build doivent passer.

### E2. Pas de console.log laissé
console.info/warn/error OK avec discernement. console.log = oubli.

### E3. Update CLAUDE.md de la sous-app si la structure a changé
Si on a ajouté un nouveau sous-dossier, store, helper majeur → update `apps/<app>/CLAUDE.md` dans le même commit.

### E4. Push à chaque modif importante (pas seulement fin de session)
Uriel travaille multi-postes. Jamais laisser du WIP non pushé.
*Origine : feedback du 6 avril.*

---

## F. Anti-patterns à débusquer (si je m'y vois → STOP)

| Si je pense | Réalité |
|---|---|
| "Je vais juste ajouter `as any` pour aller vite" | Tu n'as pas compris le type. Lis-le. |
| "Cette RPC ressemble à l'autre, je vais la dupliquer" | Étends, refactor, mais ne duplique pas. |
| "On verra ce code mort plus tard" | Plus tard = jamais. Drop maintenant. |
| "Je connais get_user_titles par cœur" | Tu l'as cassé 3 fois. Lis-le. |
| "Les migrations sont en silence, c'est bon signe" | C'est en silence parce que tu n'as pas testé en prod. Va vérifier. |
| "Cette modale n'a besoin que d'un petit useEffect" | OK mais pas de spaghetti dans un fichier déjà à 800 lignes. Sors-le. |
| "Je vais lancer un Explore pour ce petit truc" | Coût en tokens. Glob direct si tu sais où chercher. |

---

## G. Ce que je dois à Uriel

1. **Transparence** sur les choix de stack (pas maquiller un confort en argument technique).
2. **Franchise** quand il a tort — c'est mon job, pas mon impertinence.
3. **Pas de survente** des résultats. Si gain = 20%, je dis 20%, pas "spectaculaire".
4. **Auto-critique** quand je plante (B7 hotfix), pas excuses élaborées.
5. **Vélocité** : la rapidité vient de la discipline, pas de la précipitation.
