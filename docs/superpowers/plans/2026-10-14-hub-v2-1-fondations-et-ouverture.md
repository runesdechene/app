# Hub V2 — plan 1 : les fondations et l'ouverture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une appli `apps/hub-v2` qui s'ouvre par code e-mail pour les admins, montre la coquille du nouveau Hub (menu par domaines, barre d'onglets sur téléphone) et l'écran d'ouverture complet (en-tête, pouls, ce qui t'attend, santé, fil d'activité), déployée sur un site Netlify de préparation.

**Architecture:** même pile que `apps/web-v2`. Les jetons de la DA quittent la V2 pour un paquet `packages/da` que les deux applis importent. Les données de l'ouverture viennent de trois fonctions serveur nouvelles, réservées aux admins (`hub_est_admin`, `hub_ouverture`, `fil_du_hub`) ; la phrase de chaque ligne du fil est composée côté client par une fonction pure.

**Tech Stack:** pnpm workspaces · Vite 8.3.1 · React 19.3.0 · React Router 8.4.0 · TanStack Query 5.104.0 · supabase-js 2.117.2 · CSS modules · Vitest 5.0.2 · ESLint 10 + typescript-eslint 8.70.1 · Stylelint 17 · Supabase (Postgres, migrations `NNN_*.sql`) · Netlify (déploiement manuel).

**Spec:** `docs/superpowers/specs/2026-10-14-hub-v2-design.md` (§4 architecture, §5 coquille, §6 DA, §7 ouverture, §8-9 définitions, §10 fil). Maquettes Figma « Runes de Chêne — App v2 », section « Hub V2 — maquette (14/10) » : ouverture PC `587:761`, téléphone `597:1365`.

**Ce plan est le premier de cinq** : 2 Communauté · 3 Le jeu · 4 Fragments et boutique (avec le déménagement des fonctions Netlify) · 5 Parler aux joueurs, Réglages, bascule de `hub.runesdechene.com`. Chacun s'écrit quand le précédent est livré.

## Global Constraints

- pnpm uniquement ; `npx` / `pnpm dlx` seulement pour `supabase`.
- TypeScript strict, mêmes options que `apps/web-v2/tsconfig.json` ; pas de `any`, `@ts-ignore`, `as unknown as`.
- Aucune valeur visuelle hors de `packages/da/tokens.css` (Stylelint `color-no-hex`, listes autorisées de la V2).
- En-tête `QUOI / POURQUOI / (ATTENTION)` sur chaque fichier ; `README.md` sur chaque dossier.
- Un composant ne parle jamais à Supabase : composant → hook → `api/`.
- Tout est animé avec `--duree-douce`/`--courbe-douce` ou `--duree-elan`/`--courbe-elan` ; `prefers-reduced-motion` respecté.
- Tout état navigable est une URL.
- Pas de `console.log`.
- Migrations : numérotées à partir de **505**, en-tête `-- WHY:` puis `-- SCHEMA CHECKED (date, live) :`, appliquées par `npx supabase db push --linked`, vérifiées en prod par `npx supabase db query --linked`.
- Fonctions du Hub : `SECURITY DEFINER`, `SET search_path TO 'public'`, refus par `_refus('Réservé à l’équipe', 'role')` si `NOT _is_admin()`, `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated;`.
- Vocabulaire : « Porteur », « client validé », jamais « client relié » ; « Compagnie », jamais « faction » à l'écran.
- Conventional Commits, un commit par tâche qui marche, terminé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Netlify manuel, jamais d'auto-deploy Git. Le domaine `hub.runesdechene.com` ne bouge PAS dans ce plan.

## Review Focus

1. **Un compte qui n'est pas admin entre son code** → il voit « Ce Hub est réservé à l'équipe » et un bouton pour se déconnecter, jamais un écran vide ni la coquille. (Test : Task 4, `decideEntree` + `PorteDEntree`.)
2. **Une période sans rien avant** (ex. 90 jours au lancement, ou « aujourd'hui » à 00 h 05) → l'écart s'affiche « nouveau » ou rien, jamais « +Infinity % » ni « NaN ». (Test : Task 6, `ecart`.)
3. **Le chiffre « actifs »** ne peut pas se comparer à la période d'avant (`last_login_at` ne garde que la dernière connexion) → la tuile montre la valeur sans écart, au lieu d'un écart faux. (Test : Task 6, `Pouls`.)
4. **Une ligne du fil dont l'auteur a supprimé son compte, ou dont le lieu est masqué** → la ligne s'affiche avec « Un Voyageur » et le nom du lieu, sans planter ni lien mort. (Test : Task 8, `phraseDuFil`.)
5. **« Voir tout le fil » au bout de l'historique** → le bouton disparaît quand une page revient incomplète, au lieu de boucler sur la même page. (Test : Task 8, `useFil`.)

---

## Fichiers

```
packages/da/                      (nouveau) jetons partagés
  package.json · README.md · tokens.css · polices.ts · fond-parchemin.webp · global.css
apps/web-v2/                      (modifié) importe @runes/da
  src/main.tsx · src/shared/styles/{README.md, tokens.test.ts} · src/app/da/daTokens.test.ts · .stylelintrc.json · package.json
  src/shared/styles/tokens.css, global.css → déplacés dans packages/da
apps/hub-v2/                      (nouveau)
  package.json · index.html · vite.config.ts · tsconfig.json · tsconfig.node.json · eslint.config.js
  .stylelintrc.json · netlify.toml · README.md · CLAUDE.md
  src/main.tsx · src/vite-env.d.ts · src/test/setup.ts
  src/app/{router.tsx, queryClient.ts, README.md}
  src/app/entree/{decideEntree.ts(+test), useEntree.ts, entree.ts, PorteDEntree.tsx(+test, .module.css), EcranCode.tsx(.module.css)}
  src/app/coquille/{menu.ts(+test), Coquille.tsx(+test, .module.css), Menu.tsx(.module.css), BarreDOnglets.tsx(.module.css), BientotIci.tsx(.module.css), useAttente.ts}
  src/shared/supabase/{client.ts, database.types.ts}
  src/shared/lib/{ecart.ts(+test), quand.ts(+test)}
  src/shared/ui/{Bloc, TitreDeSection, Tuile, Balise, ChoixSegmente, LigneATraiter}.tsx (+ .module.css, + tests)
  src/assets/ui/{section-ajoutes.svg, section-chemins.svg, section-nouvelles.png, logo-explore.webp, chevron.svg, loupe.svg}
  src/features/accueil/{api/ouverture.ts, api/fil.ts, hooks/useOuverture.ts, hooks/useFil.ts(+test), lib/phraseDuFil.ts(+test)}
  src/features/accueil/components/{Ouverture, EnTete, Pouls, Attente, Sante, FilDActivite}.tsx (+ .module.css, + tests)
supabase/migrations/
  505_hub_v2_entree.sql · 506_hub_ouverture.sql · 507_fil_du_hub.sql
.claude/rules/hub.md              (modifié) les règles du Hub V2
```

---

### Task 1: Migration 505 — la règle `flyer` remise d'accord, l'entrée du Hub, deux index

**Files:**
- Create: `supabase/migrations/505_hub_v2_entree.sql`

**Interfaces:**
- Produces: RPC `hub_est_admin() returns boolean` (vrai si l'appelant est admin, faux sinon — jamais d'erreur), utilisée par Task 4.

- [ ] **Step 1: Relever l'état live** (lecture seule)

```bash
npx supabase db query --linked "select pg_get_constraintdef(oid) as def from pg_constraint where conname='users_account_source_check'"
npx supabase db query --linked "select indexname from pg_indexes where tablename in ('places_discovered','enigma_responses') and indexdef ilike any (array['%discovered_at%','%responded_at%'])"
```

Attendu : `CHECK (((account_source)::text = ANY (ARRAY[('app'…), ('shopify'…), ('stand'…), ('flyer'…)])))` ; seul `idx_enigma_responses_user_date` (par joueur) sort pour la seconde requête. Si la contrainte diffère, s'arrêter et le signaler.

- [ ] **Step 2: Écrire la migration**

```sql
-- WHY: Hub V2, plan 1 (spec 2026-10-14-hub-v2-design §4, §13.1).
--      1. La contrainte users_account_source_check accepte 'flyer' en prod (26 comptes, changée
--         à la main) mais aucune migration ne le dit : le dépôt redevient la vérité, sans rien
--         changer en prod.
--      2. hub_est_admin() : la porte du Hub V2 demande si le compte connecté est admin, sans
--         erreur pour un joueur (la porte affiche « réservé à l'équipe »).
--      3. Deux index par date : le pouls et le fil du Hub lisent les visites et les réponses
--         d'énigme par période, toutes personnes confondues.
-- SCHEMA CHECKED (14/10/2026, live) : pg_constraint users_account_source_check =
--   CHECK (account_source IN ('app','shopify','stand','flyer')) ; places_discovered(discovered_at),
--   enigma_responses(responded_at) sans index par date seule ; _is_admin() (219).

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_source_check;
ALTER TABLE public.users ADD CONSTRAINT users_account_source_check
  CHECK ((account_source)::text = ANY (ARRAY['app'::varchar, 'shopify'::varchar, 'stand'::varchar, 'flyer'::varchar]::text[]));

CREATE OR REPLACE FUNCTION public.hub_est_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _is_admin();
$function$;

REVOKE ALL ON FUNCTION public.hub_est_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_est_admin() TO authenticated;

CREATE INDEX IF NOT EXISTS places_discovered_par_date ON public.places_discovered (discovered_at DESC);
CREATE INDEX IF NOT EXISTS enigma_responses_par_date ON public.enigma_responses (responded_at DESC);
```

- [ ] **Step 3: Vérifier puis appliquer**

```bash
npx supabase db push --dry-run --linked
npx supabase db push --linked
```

Attendu : le dry-run ne liste que `505_hub_v2_entree.sql` ; le push l'applique sans erreur.

- [ ] **Step 4: Vérifier en prod**

```bash
npx supabase db query --linked "select pg_get_constraintdef(oid) from pg_constraint where conname='users_account_source_check'"
npx supabase db query --linked "select has_function_privilege('anon','public.hub_est_admin()','execute') as anon, has_function_privilege('authenticated','public.hub_est_admin()','execute') as auth"
npx supabase db query --linked "select indexname from pg_indexes where indexname in ('places_discovered_par_date','enigma_responses_par_date')"
```

Attendu : la même contrainte qu'au Step 1 ; `anon = false`, `auth = true` ; les deux index.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/505_hub_v2_entree.sql
git commit -m "feat(db): l'entrée du Hub V2, la règle flyer remise d'accord avec la prod"
```

---

### Task 2: `packages/da` — les jetons partagés, la V2 les importe

**Files:**
- Create: `packages/da/package.json`, `packages/da/README.md`, `packages/da/polices.ts`
- Move: `apps/web-v2/src/shared/styles/tokens.css` → `packages/da/tokens.css` ; `apps/web-v2/src/shared/styles/global.css` → `packages/da/global.css`
- Copy: `apps/web-v2/src/assets/ui/fond-parchemin.webp` → `packages/da/fond-parchemin.webp`
- Modify: `apps/web-v2/package.json`, `apps/web-v2/src/main.tsx:8-16`, `apps/web-v2/.stylelintrc.json` (override `files`), `apps/web-v2/src/shared/styles/tokens.test.ts`, `apps/web-v2/src/app/da/daTokens.test.ts:12`, `apps/web-v2/src/shared/styles/README.md`

**Interfaces:**
- Produces: paquet `@runes/da` avec `@runes/da/tokens.css`, `@runes/da/global.css`, `@runes/da/polices` (importe les polices `@fontsource`).

- [ ] **Step 1: Faire échouer le test des jetons en pointant vers le futur chemin**

Dans `apps/web-v2/src/shared/styles/tokens.test.ts`, remplacer la lecture :

```ts
const tokens = readFileSync(path.join(SRC, 'shared/styles/tokens.css'), 'utf8')
```

par :

```ts
// Les jetons vivent dans le paquet partagé @runes/da (spec Hub V2 §4) : le Hub les lit aussi.
const TOKENS = path.resolve(SRC, '../../../packages/da/tokens.css')
const tokens = readFileSync(TOKENS, 'utf8')
```

et dans `apps/web-v2/src/app/da/daTokens.test.ts`, ligne 12 :

```ts
    path.resolve(import.meta.dirname, '../../../../../packages/da/tokens.css'),
```

Run: `pnpm --filter web-v2 exec vitest run src/shared/styles/tokens.test.ts src/app/da/daTokens.test.ts`
Expected: FAIL avec `ENOENT … packages/da/tokens.css`.

- [ ] **Step 2: Créer le paquet et déplacer les fichiers**

```bash
mkdir -p packages/da
git mv apps/web-v2/src/shared/styles/tokens.css packages/da/tokens.css
git mv apps/web-v2/src/shared/styles/global.css packages/da/global.css
cp apps/web-v2/src/assets/ui/fond-parchemin.webp packages/da/fond-parchemin.webp
```

`packages/da/package.json` :

```json
{
  "name": "@runes/da",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./tokens.css": "./tokens.css",
    "./global.css": "./global.css",
    "./polices": "./polices.ts"
  },
  "dependencies": {
    "@fontsource/bebas-neue": "^5.3.0",
    "@fontsource/cabin": "^5.3.0",
    "@fontsource/cabin-condensed": "^5.3.0",
    "@fontsource/im-fell-english": "^5.3.0"
  }
}
```

`packages/da/polices.ts` :

```ts
/**
 * QUOI     — les polices de la DA, servies par l'appli elle-même.
 * POURQUOI — aucune page ne contacte Google, qui recevrait l'adresse IP des visiteurs sans leur
 *            accord (RGPD, 11/10) ; un seul endroit pour la V2 et le Hub.
 */
import '@fontsource/bebas-neue/400.css'
import '@fontsource/cabin/400.css'
import '@fontsource/cabin/600.css'
import '@fontsource/cabin/700.css'
import '@fontsource/cabin/400-italic.css'
import '@fontsource/cabin-condensed/400.css'
import '@fontsource/cabin-condensed/700.css'
import '@fontsource/im-fell-english/400.css'
import '@fontsource/im-fell-english/400-italic.css'
```

Dans `packages/da/global.css`, la ligne du fond devient (le fichier est maintenant à côté) :

```css
  background: url('./fond-parchemin.webp') center top / cover no-repeat;
```

et l'en-tête QUOI gagne : ` * ATTENTION — partagé par la V2 et le Hub (packages/da) : toute règle ici vaut pour les deux.`

`packages/da/README.md` :

```markdown
# @runes/da — la direction artistique en variables

Partagé par `apps/web-v2` (Explore) et `apps/hub-v2` (le Hub).

- `tokens.css` — toutes les couleurs, polices, tailles, espacements, formes et mouvements. **Le
  seul endroit** où une valeur visuelle s'écrit en dur ; Stylelint refuse les autres, dans les
  deux applis.
- `global.css` — remise à zéro et fond parchemin commun.
- `polices.ts` — les polices, servies par l'appli (jamais Google).

Ajouter un jeton = le montrer sur `/da` (Explore, `src/app/da/`). Pour voir toute la DA : `/da`.
```

- [ ] **Step 3: Brancher la V2 sur le paquet**

`apps/web-v2/package.json`, dans `dependencies`, ajouter `"@runes/da": "workspace:*",` et retirer les quatre `@fontsource/*` (ils sont dans le paquet).

`apps/web-v2/src/main.tsx`, remplacer les lignes des polices et des deux CSS par :

```ts
import '@runes/da/polices'
import '@runes/da/tokens.css'
import '@runes/da/global.css'
```

et dans son en-tête, la phrase sur les polices devient : `Les polices et les jetons viennent de @runes/da (packages/da), partagés avec le Hub.`

`apps/web-v2/.stylelintrc.json`, l'override `files` : `["../../packages/da/tokens.css"]` (le fichier n'est plus dans `src/`, l'override reste pour qui lance Stylelint sur le paquet).

`apps/web-v2/src/shared/styles/README.md` :

```markdown
# styles — renvoi

Les jetons (`tokens.css`) et la remise à zéro (`global.css`) vivent dans le paquet partagé
`packages/da` (`@runes/da`), importé par `src/main.tsx`. Ce dossier ne garde que le test qui
vérifie que chaque `var(--…)` de la V2 existe dans les jetons.

Pour voir toute la DA d'un coup : `/da`.
```

Run: `pnpm install`
Expected: le lien `@runes/da` apparaît dans `apps/web-v2/node_modules/@runes/da`.

- [ ] **Step 4: Les tests et le build de la V2 passent**

Run: `pnpm --filter web-v2 exec vitest run src/shared/styles/tokens.test.ts src/app/da/daTokens.test.ts`
Expected: PASS.

Run: `pnpm --filter web-v2 test && pnpm --filter web-v2 lint && pnpm --filter web-v2 build`
Expected: tout passe.

- [ ] **Step 5: La V2 est identique à l'œil**

Run: `pnpm --filter web-v2 dev`, ouvrir `http://localhost:5174/da` et `http://localhost:5174/bienvenue` dans le navigateur.
Expected: fond parchemin, Bebas Neue et Cabin chargées (onglet Réseau : polices servies par localhost, aucune requête vers Google), aucune erreur en console. Arrêter le serveur.

- [ ] **Step 6: Commit**

```bash
git add packages/da apps/web-v2 pnpm-lock.yaml
git commit -m "refactor(da): les jetons et les polices dans packages/da, partagés avec le Hub"
```

---

### Task 3: `apps/hub-v2` — l'appli vide qui se construit, se teste et se lint

**Files:**
- Create: `apps/hub-v2/package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `eslint.config.js`, `.stylelintrc.json`, `netlify.toml`, `README.md`, `CLAUDE.md`, `src/main.tsx`, `src/vite-env.d.ts`, `src/test/setup.ts`, `src/app/queryClient.ts`, `src/app/router.tsx`, `src/app/README.md`, `src/app/router.test.tsx`
- Create: `src/assets/ui/` — copier depuis `apps/web-v2/src/assets/ui/` : `section-ajoutes.svg`, `section-chemins.svg`, `section-nouvelles.png`, `logo-explore.webp`, `chevron.svg`, `loupe.svg`

**Interfaces:**
- Produces: `router` (React Router 8, `createBrowserRouter`), `queryClient` (TanStack Query), alias `@/` → `src/`.

- [ ] **Step 1: `package.json`**

```json
{
  "name": "hub-v2",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22.22.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "lint": "eslint . --max-warnings 0 && stylelint \"src/**/*.css\"",
    "test": "vitest run",
    "gen:types": "pnpm dlx supabase gen types typescript --linked --schema public > src/shared/supabase/database.types.ts"
  },
  "dependencies": {
    "@runes/da": "workspace:*",
    "@supabase/supabase-js": "2.117.2",
    "@tanstack/react-query": "5.104.0",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-router": "8.4.0"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.7",
    "@types/node": "24.19.0",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "eslint": "10.11.0",
    "eslint-plugin-react-hooks": "7.1.1",
    "eslint-plugin-react-refresh": "0.5.7",
    "globals": "17.12.0",
    "jsdom": "30.1.1",
    "stylelint": "17.15.0",
    "stylelint-config-css-modules": "4.6.0",
    "stylelint-config-standard": "40.0.0",
    "typescript": "6.0.3",
    "typescript-eslint": "8.70.1",
    "vite": "8.3.1",
    "vitest": "5.0.2"
  }
}
```

- [ ] **Step 2: Configuration (Vite, TypeScript, lint, Netlify)**

`vite.config.ts` :

```ts
/**
 * QUOI     — configuration de Vite (serveur de dev, build) et de Vitest (tests) du Hub V2.
 * POURQUOI — même pile que la V2 (spec Hub V2 §4) ; `envDir` lit le .env racine commun.
 */
/// <reference types="vitest/config" />
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  envDir: path.resolve(import.meta.dirname, '../..'),
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: { port: 5175 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    env: { VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'test' },
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
```

`tsconfig.json` : copie exacte de `apps/web-v2/tsconfig.json` en retirant `"vite-plugin-pwa/client"` de `types`.

`tsconfig.node.json` : copie exacte de `apps/web-v2/tsconfig.node.json`.

`eslint.config.js` : copie exacte de `apps/web-v2/eslint.config.js` (mêmes interdits : zones, Supabase hors des composants, pas de style inline, 400 lignes max, pas de `console`), en remplaçant la ligne `ignores` par :

```js
  { ignores: ['dist', 'src/shared/supabase/database.types.ts'] },
```

`.stylelintrc.json` : copie exacte de `apps/web-v2/.stylelintrc.json`, override `files` : `["../../packages/da/tokens.css"]`.

`netlify.toml` :

```toml
# QUOI     — le site Netlify du Hub V2 (préparation, puis hub.runesdechene.com à la bascule).
# POURQUOI — une appli d'une page : toute adresse sert index.html, le routeur fait le reste.
[build]
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

`index.html` :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Le Hub — Runes de Chêne</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/vite-env.d.ts` :

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Écrire le test du routeur (il échoue)**

`src/app/router.test.tsx` :

```tsx
/**
 * QUOI     — le routeur monte et l'adresse inconnue renvoie à l'accueil.
 */
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from './router'

test('une adresse inconnue renvoie à l’accueil', async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/nulle-part'] })
  render(<RouterProvider router={router} />)
  expect(await screen.findByText('Accueil du Hub')).toBeInTheDocument()
})
```

Run: `pnpm install && pnpm --filter hub-v2 test`
Expected: FAIL (`./router` introuvable).

- [ ] **Step 4: Le minimum qui passe**

`src/test/setup.ts` :

```ts
/**
 * QUOI     — préparation commune à tous les tests du Hub.
 * POURQUOI — vérifications DOM lisibles ; jsdom n'a ni matchMedia ni scrollTo.
 */
import '@testing-library/jest-dom/vitest'

class FausseRequeteMedia extends EventTarget implements MediaQueryList {
  readonly matches = false
  onchange = null
  constructor(readonly media: string) {
    super()
  }
  addListener() {}
  removeListener() {}
}
window.matchMedia = (requete: string) => new FausseRequeteMedia(requete)
Element.prototype.scrollTo = () => undefined
```

`src/app/queryClient.ts` :

```ts
/**
 * QUOI     — le cache de données du Hub.
 * POURQUOI — TanStack Query, comme la V2 ; rien n'est gardé sur l'appareil (un back-office lit
 *            toujours la base fraîche), une donnée a 30 s de fraîcheur.
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})
```

`src/app/router.tsx` (provisoire : la coquille arrive en Task 5) :

```tsx
/**
 * QUOI     — toutes les adresses du Hub V2.
 * POURQUOI — tout état navigable est une URL (spec Hub V2 §4).
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

export const routes: RouteObject[] = [
  { path: '/', element: <p>Accueil du Hub</p> },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
```

`src/main.tsx` :

```tsx
/**
 * QUOI     — point d'entrée du Hub V2 : la DA partagée, le cache de données, le routeur.
 */
import '@runes/da/polices'
import '@runes/da/tokens.css'
import '@runes/da/global.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { queryClient } from './app/queryClient'
import { router } from './app/router'

const root = document.getElementById('root')
if (!root) throw new Error('#root absent de index.html')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
```

Copier les six fichiers d'`assets/ui` listés en tête de tâche.

`README.md` (racine de l'appli) :

```markdown
# hub-v2 — le Hub, au design de la V2

La zone de pilotage de Runes de Chêne et de sa communauté (spec
`docs/superpowers/specs/2026-10-14-hub-v2-design.md`). Remplacera `apps/hub` à la bascule.

- `src/app/` — la coquille : entrée par code, porte admin, menu, routes.
- `src/features/<domaine>/` — un dossier par domaine du menu (`api/`, `components/`, `hooks/`, `lib/`).
- `src/shared/` — client Supabase, briques (`ui/`), fonctions pures (`lib/`).

Commandes : `pnpm --filter hub-v2 dev` (port 5175) · `test` · `lint` · `build`.
```

`CLAUDE.md` :

```markdown
# hub-v2 — le Hub V2

> Port dev 5175. Préparation : site Netlify `rdc-hub-v2`. Prod (après le plan 5) : hub.runesdechene.com.
> Réservé aux admins (`hub_est_admin()`).

Règles communes : `CLAUDE.md` racine. Règles de construction : `.claude/rules/v2.md` et
`.claude/rules/hub.md`. DA : `packages/da`.

## Commandes

pnpm --filter hub-v2 dev | test | lint | build
pnpm --filter hub-v2 gen:types   # après chaque migration qui touche le Hub
cd apps/hub-v2 && netlify deploy --prod --dir "$PWD/dist" --no-build   # site rdc-hub-v2 seulement
```

`src/app/README.md` :

```markdown
# app — la coquille du Hub

`entree/` (code e-mail, porte admin) · `coquille/` (menu par domaines, barre d'onglets) ·
`router.tsx` (toutes les adresses) · `queryClient.ts` (cache).
```

Run: `pnpm --filter hub-v2 test`
Expected: PASS.

- [ ] **Step 5: Lint, types, build**

Run: `pnpm --filter hub-v2 lint && pnpm --filter hub-v2 build`
Expected: tout passe, `apps/hub-v2/dist/index.html` existe.

- [ ] **Step 6: Commit**

```bash
git add apps/hub-v2 pnpm-lock.yaml
git commit -m "feat(hub-v2): l'appli du Hub V2, même pile que la V2"
```

---

### Task 4: L'entrée par code et la porte admin

**Files:**
- Create: `src/shared/supabase/client.ts`, `src/shared/supabase/database.types.ts` (généré), `src/shared/supabase/README.md`
- Create: `src/app/entree/decideEntree.ts`, `decideEntree.test.ts`, `entree.ts`, `useEntree.ts`, `PorteDEntree.tsx`, `PorteDEntree.test.tsx`, `PorteDEntree.module.css`, `EcranCode.tsx`, `EcranCode.module.css`, `README.md`
- Modify: `src/app/router.tsx`

(Tous les chemins relatifs à `apps/hub-v2/`.)

**Interfaces:**
- Consumes: RPC `hub_est_admin()` (Task 1).
- Produces: `<PorteDEntree>{children}</PorteDEntree>` — rend `children` seulement pour un admin connecté ; `decideEntree(etat: EtatEntree): Decision`.

- [ ] **Step 1: Générer les types et poser le client**

Run: `pnpm --filter hub-v2 gen:types`
Expected: `src/shared/supabase/database.types.ts` contient `hub_est_admin`.

`src/shared/supabase/client.ts` :

```ts
/**
 * QUOI     — le client Supabase unique du Hub, typé par le schéma réel de la base.
 * POURQUOI — les types générés font vérifier chaque table, colonne et RPC par le compilateur.
 * ATTENTION — options par défaut : la session est celle de la clé standard du projet.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
if (!url) throw new Error('VITE_SUPABASE_URL manquant dans le .env racine')
if (!anonKey) throw new Error('VITE_SUPABASE_ANON_KEY manquant dans le .env racine')

export const supabase = createClient<Database>(url, anonKey)
```

`src/shared/supabase/README.md` : `Le client Supabase et les types générés (`pnpm --filter hub-v2 gen:types`). Seuls les fichiers `api/` l'importent.`

- [ ] **Step 2: Écrire le test de la décision (il échoue)**

`src/app/entree/decideEntree.test.ts` :

```ts
import { decideEntree } from './decideEntree'

test('en cours de lecture : on attend', () => {
  expect(decideEntree({ statut: 'lecture' })).toBe('attendre')
})
test('sans session : on demande le code', () => {
  expect(decideEntree({ statut: 'pret', session: false, admin: false })).toBe('code')
})
test('connecté mais pas admin : refusé', () => {
  expect(decideEntree({ statut: 'pret', session: true, admin: false })).toBe('refuse')
})
test('admin connecté : on ouvre', () => {
  expect(decideEntree({ statut: 'pret', session: true, admin: true })).toBe('ouvrir')
})
test('erreur réseau : on propose de réessayer', () => {
  expect(decideEntree({ statut: 'erreur' })).toBe('reessayer')
})
```

Run: `pnpm --filter hub-v2 exec vitest run src/app/entree/decideEntree.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: La décision, l'API, le hook**

`src/app/entree/decideEntree.ts` :

```ts
/**
 * QUOI     — décide ce que la porte du Hub montre, à partir de l'état de la session.
 * POURQUOI — fonction pure : toute la logique de la porte se teste sans navigateur.
 */
export type EtatEntree =
  | { statut: 'lecture' }
  | { statut: 'erreur' }
  | { statut: 'pret'; session: boolean; admin: boolean }

export type Decision = 'attendre' | 'code' | 'refuse' | 'ouvrir' | 'reessayer'

export function decideEntree(etat: EtatEntree): Decision {
  switch (etat.statut) {
    case 'lecture':
      return 'attendre'
    case 'erreur':
      return 'reessayer'
    case 'pret':
      if (!etat.session) return 'code'
      return etat.admin ? 'ouvrir' : 'refuse'
  }
}
```

`src/app/entree/entree.ts` :

```ts
/**
 * QUOI     — ce que la porte demande à Supabase : la session, le droit d'entrer, le code e-mail.
 * POURQUOI — pas de mot de passe, comme la V2 : un code à 6 chiffres. Le Hub ne crée jamais de
 *            compte (shouldCreateUser: false).
 */
import { supabase } from '@/shared/supabase/client'

export async function lireEntree(): Promise<{ session: boolean; admin: boolean }> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session) return { session: false, admin: false }
  const reponse = await supabase.rpc('hub_est_admin')
  if (reponse.error) throw reponse.error
  return { session: true, admin: reponse.data }
}

export async function envoyerCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
  if (error) throw error
}

export async function verifierCode(email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error) throw error
}

export async function sortir() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
```

`src/app/entree/useEntree.ts` :

```ts
/**
 * QUOI     — lit l'entrée (session + droit) et la relit à chaque connexion ou déconnexion.
 * POURQUOI — traduit la réponse en EtatEntree pour decideEntree.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/shared/supabase/client'
import type { EtatEntree } from './decideEntree'
import { lireEntree } from './entree'

export const CLE_ENTREE = ['hub-entree']

export function useEntree(): { etat: EtatEntree; relire: () => void } {
  const client = useQueryClient()
  const requete = useQuery({ queryKey: CLE_ENTREE, queryFn: lireEntree, retry: false })

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      void client.invalidateQueries({ queryKey: CLE_ENTREE })
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [client])

  const relire = () => void requete.refetch()
  if (requete.isPending) return { etat: { statut: 'lecture' }, relire }
  if (requete.isError) return { etat: { statut: 'erreur' }, relire }
  return { etat: { statut: 'pret', ...requete.data }, relire }
}
```

Run: `pnpm --filter hub-v2 exec vitest run src/app/entree/decideEntree.test.ts`
Expected: PASS.

- [ ] **Step 4: Écrire le test de la porte (il échoue)**

`src/app/entree/PorteDEntree.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { PorteDEntree } from './PorteDEntree'
import * as hook from './useEntree'

function avec(etat: hook.EtatPourTest) {
  vi.spyOn(hook, 'useEntree').mockReturnValue({ etat, relire: vi.fn() })
}

test('un joueur connecté voit que le Hub est réservé, et peut se déconnecter', () => {
  avec({ statut: 'pret', session: true, admin: false })
  render(<PorteDEntree><p>Coquille</p></PorteDEntree>)
  expect(screen.getByText('Ce Hub est réservé à l’équipe.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  expect(screen.queryByText('Coquille')).not.toBeInTheDocument()
})

test('un admin connecté entre', () => {
  avec({ statut: 'pret', session: true, admin: true })
  render(<PorteDEntree><p>Coquille</p></PorteDEntree>)
  expect(screen.getByText('Coquille')).toBeInTheDocument()
})

test('sans session, on demande l’e-mail', () => {
  avec({ statut: 'pret', session: false, admin: false })
  render(<PorteDEntree><p>Coquille</p></PorteDEntree>)
  expect(screen.getByLabelText('Ton e-mail')).toBeInTheDocument()
})

test('en erreur, on propose de réessayer', () => {
  avec({ statut: 'erreur' })
  render(<PorteDEntree><p>Coquille</p></PorteDEntree>)
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
})
```

et ajouter en bas de `useEntree.ts` l'alias de type utilisé par le test :

```ts
export type EtatPourTest = EtatEntree
```

Run: `pnpm --filter hub-v2 exec vitest run src/app/entree/PorteDEntree.test.tsx`
Expected: FAIL (`PorteDEntree` introuvable).

- [ ] **Step 5: La porte et l'écran du code**

`src/app/entree/EcranCode.tsx` :

```tsx
/**
 * QUOI     — l'entrée du Hub : l'e-mail, puis le code à 6 chiffres reçu par e-mail.
 * POURQUOI — même geste que la V2 ; un e-mail qui n'a pas de compte ne reçoit rien (le Hub ne
 *            crée pas de compte).
 */
import { useState, type FormEvent } from 'react'
import logo from '@/assets/ui/logo-explore.webp'
import { envoyerCode, verifierCode } from './entree'
import styles from './EcranCode.module.css'

export function EcranCode() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [etape, setEtape] = useState<'email' | 'code'>('email')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function valider(event: FormEvent) {
    event.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      if (etape === 'email') {
        await envoyerCode(email.trim())
        setEtape('code')
      } else {
        await verifierCode(email.trim(), code.trim())
      }
    } catch {
      setErreur(etape === 'email' ? 'Cet e-mail n’a pas pu recevoir de code.' : 'Ce code ne marche pas.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <main className={styles.ecran}>
      <form className={styles.carte} onSubmit={(e) => void valider(e)}>
        <img className={styles.logo} src={logo} alt="Runes de Chêne Explore" />
        <p className={styles.surtitre}>Le Hub</p>
        {etape === 'email' ? (
          <label className={styles.champ}>
            <span>Ton e-mail</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        ) : (
          <label className={styles.champ}>
            <span>Le code reçu par e-mail</span>
            <input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
        )}
        {erreur && <p className={styles.erreur} role="alert">{erreur}</p>}
        <button className={styles.bouton} type="submit" disabled={envoi}>
          {etape === 'email' ? 'Recevoir un code' : 'Entrer'}
        </button>
      </form>
    </main>
  )
}
```

`src/app/entree/PorteDEntree.tsx` :

```tsx
/**
 * QUOI     — la porte du Hub : rien ne s'affiche avant qu'un admin soit connecté.
 * POURQUOI — applique decideEntree ; un joueur connecté apprend que le Hub est réservé et peut
 *            se déconnecter, au lieu d'un écran vide.
 */
import type { ReactNode } from 'react'
import { decideEntree } from './decideEntree'
import { EcranCode } from './EcranCode'
import { sortir } from './entree'
import { useEntree } from './useEntree'
import styles from './PorteDEntree.module.css'

export function PorteDEntree({ children }: { children: ReactNode }) {
  const { etat, relire } = useEntree()
  switch (decideEntree(etat)) {
    case 'attendre':
      return <main className={styles.ecran} aria-busy="true" />
    case 'code':
      return <EcranCode />
    case 'ouvrir':
      return children
    case 'refuse':
      return (
        <main className={styles.ecran}>
          <p className={styles.message}>Ce Hub est réservé à l’équipe.</p>
          <button className={styles.bouton} type="button" onClick={() => void sortir()}>
            Se déconnecter
          </button>
        </main>
      )
    case 'reessayer':
      return (
        <main className={styles.ecran}>
          <p className={styles.message}>La base ne répond pas.</p>
          <button className={styles.bouton} type="button" onClick={relire}>
            Réessayer
          </button>
        </main>
      )
  }
}
```

`src/app/entree/PorteDEntree.module.css` :

```css
/*
 * QUOI     — les écrans d'attente, de refus et d'erreur de la porte.
 */
.ecran {
  display: grid;
  place-content: center;
  gap: var(--space-4);
  min-height: 100dvh;
  padding: var(--space-6);
  text-align: center;
}

.message {
  margin: 0;
  font-family: var(--font-titre);
  font-size: var(--titre-section-size);
  color: var(--color-encre);
}

.bouton {
  justify-self: center;
  padding: var(--space-2) var(--space-6);
  border: 1px solid var(--color-bord);
  border-radius: var(--radius-rond);
  background: none;
  font-family: var(--font-condensee);
  font-weight: var(--weight-gras);
  color: var(--color-texte);
  transition: background var(--duree-douce) var(--courbe-douce);
}

.bouton:hover {
  background: var(--color-pastille);
}
```

`src/app/entree/EcranCode.module.css` :

```css
/*
 * QUOI     — l'entrée du Hub : une carte claire et bordée au centre du parchemin.
 */
.ecran {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: var(--space-6);
}

.carte {
  display: grid;
  gap: var(--space-4);
  width: min(100%, 360px);
  padding: var(--space-8) var(--space-6);
  border: 1px solid var(--color-sable);
  border-radius: var(--radius-carte);
  background: var(--color-bloc);
  animation: apparait var(--duree-douce) var(--courbe-douce);
}

.logo {
  justify-self: center;
  width: 176px;
}

.surtitre {
  margin: 0;
  text-align: center;
  font-family: var(--font-condensee);
  font-size: var(--libelle-size);
  letter-spacing: var(--bandeau-tracking);
  text-transform: uppercase;
  color: var(--color-texte-doux);
}

.champ {
  display: grid;
  gap: var(--space-1);
  font-size: var(--sous-titre-size);
  color: var(--color-texte-doux);
}

.champ input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-sable);
  border-radius: var(--radius-petit);
  background: var(--color-feuille);
  font: inherit;
  font-size: var(--corps-size);
  color: var(--color-encre);
}

.erreur {
  margin: 0;
  font-size: var(--sous-titre-size);
  color: var(--color-accent);
}

.bouton {
  padding: var(--space-2) var(--space-6);
  border: 0;
  border-radius: var(--radius-rond);
  background: var(--color-accent);
  font-family: var(--font-condensee);
  font-weight: var(--weight-gras);
  font-size: var(--bouton-size);
  color: var(--color-sur-accent);
  transition: opacity var(--duree-douce) var(--courbe-douce);
}

.bouton:disabled {
  opacity: 0.6;
}

@keyframes apparait {
  from {
    opacity: 0;
    translate: 0 var(--space-2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .carte {
    animation: none;
  }
}
```

**Jeton manquant :** `--color-bloc` (le fond des blocs clairs du Hub, `#fef6eb`, maquette 587:761). L'ajouter dans `packages/da/tokens.css`, groupe « Fonds », avec le commentaire `/* le fond des blocs clairs du Hub (Figma 587:761) */`, et l'ajouter à la liste des couleurs montrées sur `/da` (`apps/web-v2/src/app/da/daTokens.ts`, tableau `COLOR_TOKENS`), sinon le test `daTokens.test.ts` échoue.

`src/app/entree/README.md` : `La porte du Hub : `decideEntree` (pure) · `useEntree` (session + `hub_est_admin`) · `PorteDEntree` (applique) · `EcranCode` (e-mail puis code).`

`src/app/router.tsx` — envelopper l'accueil :

```tsx
import { PorteDEntree } from './entree/PorteDEntree'

export const routes: RouteObject[] = [
  { path: '/', element: <PorteDEntree><p>Accueil du Hub</p></PorteDEntree> },
  { path: '*', element: <Navigate to="/" replace /> },
]
```

et dans `router.test.tsx`, ajouter en tête un faux de la porte pour garder le test du routeur indépendant :

```tsx
import type { ReactNode } from 'react'
import { vi } from 'vitest'
vi.mock('./entree/PorteDEntree', () => ({
  PorteDEntree: ({ children }: { children: ReactNode }) => children,
}))
```

Run: `pnpm --filter hub-v2 test && pnpm --filter web-v2 exec vitest run src/app/da`
Expected: PASS.

- [ ] **Step 6: Essayer dans le navigateur**

Run: `pnpm --filter hub-v2 dev`, ouvrir `http://localhost:5175/`.
Expected : l'écran du code. Avec l'e-mail admin d'Uriel : le code arrive, « Accueil du Hub » s'affiche. Avec un compte joueur (demander à Uriel un compte de test, ne pas en créer) : « Ce Hub est réservé à l’équipe. » Console sans erreur.

- [ ] **Step 7: Commit**

```bash
git add apps/hub-v2 packages/da apps/web-v2/src/app/da
git commit -m "feat(hub-v2): l'entrée par code et la porte réservée aux admins"
```

---

### Task 5: Les briques et la coquille

**Files:**
- Create: `src/shared/ui/{Bloc, TitreDeSection, Tuile, Balise, ChoixSegmente, LigneATraiter}.tsx` + `.module.css` + `src/shared/ui/briques.test.tsx` + `src/shared/ui/README.md`
- Create: `src/app/coquille/menu.ts`, `menu.test.ts`, `Coquille.tsx`, `Coquille.module.css`, `Coquille.test.tsx`, `Menu.tsx`, `Menu.module.css`, `BarreDOnglets.tsx`, `BarreDOnglets.module.css`, `BientotIci.tsx`, `BientotIci.module.css`, `README.md`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Produces (briques) :
  - `Bloc({ children, className? })` — le bloc clair, arrondi, bordé.
  - `TitreDeSection({ titre, icone?, aDroite? })` — icône gravée + Bebas + filet.
  - `Tuile({ libelle, valeur, ecart? })` avec `ecart?: { texte: string; sens: 'hausse' | 'baisse' | 'egal' }`.
  - `Balise({ texte, teinte })` avec `teinte: 'nouveau' | 'reactive' | 'sommeil' | 'porteur' | 'admin' | 'compte' | 'lieu' | 'visite' | 'enigme' | 'boutique' | 'photo' | 'message' | 'moderation' | 'notification'`.
  - `ChoixSegmente<T extends string>({ options: { valeur: T; libelle: string }[], choisi: T, onChoix: (v: T) => void, nom: string })`.
  - `LigneATraiter({ nombre, titre, detail, vers })` — un lien (`react-router` `Link`).
- Produces (coquille) : `MENU: Domaine[]` avec `type Domaine = { titre: string | null; liens: Lien[] }`, `type Lien = { libelle: string; chemin: string; file?: CleAttente }`, `type CleAttente = 'photos' | 'lieux' | 'signalementsLieu' | 'signalementsEnigme' | 'achats'` ; `ONGLETS` (téléphone) ; `<Coquille />` (rend `<Outlet />`).

- [ ] **Step 1: Écrire les tests des briques et du menu (ils échouent)**

`src/shared/ui/briques.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { Balise } from './Balise'
import { ChoixSegmente } from './ChoixSegmente'
import { LigneATraiter } from './LigneATraiter'
import { Tuile } from './Tuile'

test('une tuile sans écart ne montre que la valeur', () => {
  render(<Tuile libelle="Actifs" valeur="312" />)
  expect(screen.getByText('312')).toBeInTheDocument()
  expect(screen.queryByTestId('ecart')).not.toBeInTheDocument()
})

test('une tuile qui baisse le dit', () => {
  render(<Tuile libelle="Lieux ajoutés" valeur="14" ecart={{ texte: '−4 %', sens: 'baisse' }} />)
  expect(screen.getByTestId('ecart')).toHaveAttribute('data-sens', 'baisse')
})

test('une balise porte sa teinte', () => {
  render(<Balise texte="Porteur" teinte="porteur" />)
  expect(screen.getByText('Porteur')).toHaveAttribute('data-teinte', 'porteur')
})

test('le choix segmenté rend la valeur choisie', async () => {
  const onChoix = vi.fn()
  render(
    <ChoixSegmente
      nom="Période"
      options={[{ valeur: '7', libelle: '7 jours' }, { valeur: '30', libelle: '30 jours' }]}
      choisi="7"
      onChoix={onChoix}
    />,
  )
  expect(screen.getByRole('radio', { name: '7 jours' })).toBeChecked()
  await userEvent.click(screen.getByRole('radio', { name: '30 jours' }))
  expect(onChoix).toHaveBeenCalledWith('30')
})

test('une ligne à traiter mène à son écran', () => {
  render(
    <MemoryRouter>
      <LigneATraiter nombre={12} titre="Photos et avis à valider" detail="Le plus ancien attend depuis 3 jours" vers="/boutique/photos" />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: /Photos et avis à valider/ })).toHaveAttribute('href', '/boutique/photos')
})
```

`src/app/coquille/menu.test.ts` :

```ts
import { MENU, ONGLETS } from './menu'

test('chaque adresse du menu est unique', () => {
  const chemins = MENU.flatMap((d) => d.liens.map((l) => l.chemin))
  expect(new Set(chemins).size).toBe(chemins.length)
})

test('le menu suit les domaines de la spec', () => {
  expect(MENU.map((d) => d.titre)).toEqual([null, 'Communauté', 'Le jeu', 'Fragments et boutique', 'Parler aux joueurs', 'Réglages'])
})

test('chaque onglet du téléphone mène à une adresse du menu', () => {
  const chemins = new Set(MENU.flatMap((d) => d.liens.map((l) => l.chemin)))
  for (const onglet of ONGLETS) expect(chemins.has(onglet.chemin)).toBe(true)
})
```

Run: `pnpm --filter hub-v2 test`
Expected: FAIL (modules introuvables).

- [ ] **Step 2: Le menu**

`src/app/coquille/menu.ts` :

```ts
/**
 * QUOI     — le menu du Hub, par domaines (spec Hub V2 §5), et les onglets du téléphone.
 * POURQUOI — une seule liste : le menu du PC, les onglets, les routes et les pastilles en
 *            découlent. Les domaines préparent les droits des modérateurs (chantier C).
 */
export type CleAttente = 'photos' | 'lieux' | 'signalementsLieu' | 'signalementsEnigme' | 'achats'
export type Lien = { libelle: string; chemin: string; file?: CleAttente }
export type Domaine = { titre: string | null; liens: Lien[] }

export const MENU: Domaine[] = [
  { titre: null, liens: [{ libelle: 'Accueil', chemin: '/' }] },
  {
    titre: 'Communauté',
    liens: [
      { libelle: 'Comptes', chemin: '/communaute/comptes' },
      { libelle: 'Compagnies', chemin: '/communaute/compagnies' },
      { libelle: 'Lieux à modérer', chemin: '/communaute/lieux', file: 'lieux' },
      { libelle: 'Signalements', chemin: '/communaute/signalements', file: 'signalementsLieu' },
    ],
  },
  {
    titre: 'Le jeu',
    liens: [
      { libelle: 'Énigmes', chemin: '/jeu/enigmes' },
      { libelle: 'Énigmes signalées', chemin: '/jeu/enigmes-signalees', file: 'signalementsEnigme' },
      { libelle: 'Cultures', chemin: '/jeu/cultures' },
      { libelle: 'Natures', chemin: '/jeu/natures' },
      { libelle: 'Titres', chemin: '/jeu/titres' },
      { libelle: 'Bannières', chemin: '/jeu/bannieres' },
      { libelle: 'Énergie', chemin: '/jeu/energie' },
    ],
  },
  {
    titre: 'Fragments et boutique',
    liens: [
      { libelle: 'Fragments', chemin: '/boutique/fragments', file: 'achats' },
      { libelle: 'Photos et avis', chemin: '/boutique/photos', file: 'photos' },
      { libelle: 'Synchro Shopify', chemin: '/boutique/synchro' },
      { libelle: 'Écoutes audio', chemin: '/boutique/audio' },
    ],
  },
  {
    titre: 'Parler aux joueurs',
    liens: [
      { libelle: 'Mises à jour', chemin: '/joueurs/mises-a-jour' },
      { libelle: 'Notifications', chemin: '/joueurs/notifications' },
      { libelle: 'Blog de la boutique', chemin: '/joueurs/blog' },
    ],
  },
  { titre: 'Réglages', liens: [{ libelle: 'Réglages', chemin: '/reglages' }] },
]

export type Onglet = { libelle: string; chemin: string; icone: 'accueil' | 'communaute' | 'jeu' | 'boutique' | 'plus' }

export const ONGLETS: Onglet[] = [
  { libelle: 'Accueil', chemin: '/', icone: 'accueil' },
  { libelle: 'Communauté', chemin: '/communaute/comptes', icone: 'communaute' },
  { libelle: 'Le jeu', chemin: '/jeu/enigmes', icone: 'jeu' },
  { libelle: 'Boutique', chemin: '/boutique/photos', icone: 'boutique' },
  { libelle: 'Plus', chemin: '/reglages', icone: 'plus' },
]
```

- [ ] **Step 3: Les briques**

`src/shared/ui/Bloc.tsx` :

```tsx
/**
 * QUOI     — le bloc clair, arrondi et bordé des listes du Hub (maquette 587:761).
 */
import type { ReactNode } from 'react'
import styles from './Bloc.module.css'

export function Bloc({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `${styles.bloc} ${className}` : styles.bloc}>{children}</div>
}
```

`src/shared/ui/Bloc.module.css` :

```css
/*
 * QUOI     — fond clair, filet sable, coins de 15 px ; chaque enfant direct séparé d'un filet.
 */
.bloc {
  display: grid;
  border: 1px solid var(--color-sable);
  border-radius: var(--radius-carte);
  background: var(--color-bloc);
  overflow: clip;
}

.bloc > * + * {
  border-top: 1px solid var(--color-sable);
}
```

`src/shared/ui/TitreDeSection.tsx` :

```tsx
/**
 * QUOI     — le titre d'une section comme dans l'appli : icône gravée, Bebas, filet jusqu'au bord.
 */
import type { ReactNode } from 'react'
import styles from './TitreDeSection.module.css'

export function TitreDeSection({ titre, icone, aDroite }: { titre: string; icone?: string; aDroite?: ReactNode }) {
  return (
    <div className={styles.titre}>
      {icone && <img className={styles.icone} src={icone} alt="" />}
      <h2 className={styles.texte}>{titre}</h2>
      <span className={styles.filet} />
      {aDroite}
    </div>
  )
}
```

`src/shared/ui/TitreDeSection.module.css` :

```css
.titre {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.icone {
  height: 24px;
  opacity: 0.75;
}

.texte {
  margin: 0;
  font-family: var(--font-titre);
  font-size: var(--titre-carte-size);
  font-weight: var(--weight-normal);
  letter-spacing: var(--titre-tracking);
  color: var(--color-encre);
}

.filet {
  flex: 1;
  border-top: 1px solid var(--color-sable);
}
```

`src/shared/ui/Tuile.tsx` :

```tsx
/**
 * QUOI     — un chiffre du pouls : libellé, valeur, et l'écart avec la période d'avant.
 * POURQUOI — sans écart (un chiffre qu'on ne peut pas comparer), la tuile ne ment pas : elle
 *            montre la valeur seule.
 */
import styles from './Tuile.module.css'

export type Ecart = { texte: string; sens: 'hausse' | 'baisse' | 'egal' }

export function Tuile({ libelle, valeur, ecart }: { libelle: string; valeur: string; ecart?: Ecart }) {
  return (
    <div className={styles.tuile}>
      <span className={styles.libelle}>{libelle}</span>
      <span className={styles.ligne}>
        <span className={styles.valeur}>{valeur}</span>
        {ecart && (
          <span className={styles.ecart} data-testid="ecart" data-sens={ecart.sens}>
            {ecart.texte}
          </span>
        )}
      </span>
    </div>
  )
}
```

`src/shared/ui/Tuile.module.css` :

```css
.tuile {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-bord);
  border-radius: var(--radius-carte);
}

.libelle {
  font-family: var(--font-condensee);
  font-weight: var(--weight-gras);
  font-size: var(--libelle-size);
  letter-spacing: var(--libelle-tracking);
  text-transform: uppercase;
  color: var(--color-encre);
}

.ligne {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.valeur {
  font-family: var(--font-titre);
  font-size: var(--titre-ecran-size);
  line-height: 1;
  color: var(--color-encre);
}

.ecart {
  font-weight: var(--weight-semi);
  font-size: var(--sous-titre-size);
  color: var(--color-texte-pale);
}

.ecart[data-sens='hausse'] {
  color: var(--color-succes);
}
```

`src/shared/ui/Balise.tsx` :

```tsx
/**
 * QUOI     — une gélule colorée : la balise d'un compte (Nouveau, Porteur…) ou le type d'une
 *            ligne du fil.
 */
import styles from './Balise.module.css'

export type Teinte =
  | 'nouveau' | 'reactive' | 'sommeil' | 'porteur' | 'admin'
  | 'compte' | 'lieu' | 'visite' | 'enigme' | 'boutique' | 'photo' | 'message' | 'moderation' | 'notification'

export function Balise({ texte, teinte }: { texte: string; teinte: Teinte }) {
  return (
    <span className={styles.balise} data-teinte={teinte}>
      {texte}
    </span>
  )
}
```

`src/shared/ui/Balise.module.css` (les couleurs viennent de la maquette ; chacune existe déjà dans `tokens.css` sauf les deux de « En sommeil » et celle de « Modération », à ajouter — voir la note) :

```css
.balise {
  display: inline-block;
  padding: 1px var(--space-2);
  border-radius: var(--radius-rond);
  font-family: var(--font-condensee);
  font-weight: var(--weight-gras);
  font-size: var(--micro-size);
  letter-spacing: var(--pilule-tracking);
  text-transform: uppercase;
  white-space: nowrap;
}

.balise[data-teinte='nouveau'],
.balise[data-teinte='visite'] {
  background: var(--color-succes-fond);
  color: var(--color-succes);
}

.balise[data-teinte='reactive'],
.balise[data-teinte='enigme'] {
  background: var(--color-canal-activite);
  color: var(--color-canal-activite-texte);
}

.balise[data-teinte='sommeil'] {
  background: var(--color-sommeil);
  color: var(--color-sommeil-texte);
}

.balise[data-teinte='porteur'],
.balise[data-teinte='photo'] {
  background: var(--color-choisie);
  color: var(--color-brun);
}

.balise[data-teinte='admin'],
.balise[data-teinte='compte'] {
  background: var(--color-rose);
  color: var(--color-accent);
}

.balise[data-teinte='lieu'] {
  background: var(--color-pilule);
  color: var(--color-pilule-texte);
}

.balise[data-teinte='boutique'] {
  background: var(--color-sable);
  color: var(--color-encre);
}

.balise[data-teinte='message'] {
  background: var(--color-canal-bugs);
  color: var(--color-canal-bugs-texte);
}

.balise[data-teinte='moderation'] {
  background: var(--color-moderation);
  color: var(--color-fiche-badge);
}

.balise[data-teinte='notification'] {
  background: var(--color-carte-eau);
  color: var(--color-kaki);
}
```

**Jetons à ajouter** dans `packages/da/tokens.css` (groupe « Le Hub », après « Le Registre ») et dans `COLOR_TOKENS` de `apps/web-v2/src/app/da/daTokens.ts` :

```css
  /* Le Hub (Figma 594:961, 592:852) : les balises qui n'ont pas d'équivalent dans l'appli */
  --color-sommeil: #e2dfe8; /* « En sommeil » : un ancien compte jamais revenu */
  --color-sommeil-texte: #6b6680;
  --color-moderation: #f3c9c4; /* le type « Modération » du fil */
```

`src/shared/ui/ChoixSegmente.tsx` :

```tsx
/**
 * QUOI     — une gélule au contour fin, le choix actif en rouge (période, filtres).
 * POURQUOI — des boutons radio natifs : le clavier et les lecteurs d'écran marchent sans code.
 */
import styles from './ChoixSegmente.module.css'

type Option<T extends string> = { valeur: T; libelle: string }

export function ChoixSegmente<T extends string>({
  options, choisi, onChoix, nom,
}: { options: Option<T>[]; choisi: T; onChoix: (valeur: T) => void; nom: string }) {
  return (
    <fieldset className={styles.choix}>
      <legend className={styles.legende}>{nom}</legend>
      {options.map((o) => (
        <label key={o.valeur} className={styles.option}>
          <input
            type="radio"
            name={nom}
            value={o.valeur}
            checked={o.valeur === choisi}
            onChange={() => onChoix(o.valeur)}
          />
          <span>{o.libelle}</span>
        </label>
      ))}
    </fieldset>
  )
}
```

`src/shared/ui/ChoixSegmente.module.css` :

```css
.choix {
  display: inline-flex;
  gap: 2px;
  margin: 0;
  padding: var(--space-1);
  border: 1px solid var(--color-bord);
  border-radius: var(--radius-rond);
  min-inline-size: 0;
}

.legende {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.option input {
  position: absolute;
  opacity: 0;
}

.option span {
  display: block;
  padding: 6px var(--space-3);
  border-radius: var(--radius-rond);
  font-family: var(--font-condensee);
  font-weight: var(--weight-gras);
  font-size: var(--sous-titre-size);
  color: var(--color-texte-doux);
  white-space: nowrap;
  transition:
    background var(--duree-elan) var(--courbe-elan),
    color var(--duree-elan) var(--courbe-elan);
}

.option input:checked + span {
  background: var(--color-accent);
  color: var(--color-sur-accent);
}

.option input:focus-visible + span {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .option span {
    transition: none;
  }
}
```

`src/shared/ui/LigneATraiter.tsx` :

```tsx
/**
 * QUOI     — une ligne de « Ce qui t'attend » : le nombre, ce qui attend, un détail, le lien.
 */
import { Link } from 'react-router'
import chevron from '@/assets/ui/chevron.svg'
import styles from './LigneATraiter.module.css'

export function LigneATraiter({ nombre, titre, detail, vers }: { nombre: number; titre: string; detail: string; vers: string }) {
  return (
    <Link className={styles.ligne} to={vers}>
      <span className={styles.nombre}>{nombre}</span>
      <span className={styles.texte}>
        <span className={styles.titre}>{titre}</span>
        <span className={styles.detail}>{detail}</span>
      </span>
      <img className={styles.chevron} src={chevron} alt="" />
    </Link>
  )
}
```

`src/shared/ui/LigneATraiter.module.css` :

```css
.ligne {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: inherit;
  text-decoration: none;
  transition: background var(--duree-douce) var(--courbe-douce);
}

.ligne:hover {
  background: var(--color-surface);
}

.nombre {
  flex: 0 0 34px;
  padding: 2px 0;
  border-radius: var(--radius-rond);
  background: var(--color-accent);
  text-align: center;
  font-weight: var(--weight-gras);
  font-size: var(--flux-size);
  color: var(--color-sur-accent);
}

.texte {
  display: grid;
  flex: 1;
  min-width: 0;
}

.titre {
  font-weight: var(--weight-semi);
  color: var(--color-encre);
}

.detail {
  font-size: var(--flux-size);
  color: var(--color-texte-doux);
}

.chevron {
  width: 16px;
  opacity: 0.5;
}
```

`src/shared/ui/README.md` : `Les briques du Hub (spec Hub V2 §6), une par fichier : Bloc, TitreDeSection, Tuile, Balise, ChoixSegmente, LigneATraiter. Elles ne parlent jamais à Supabase.`

Run: `pnpm --filter hub-v2 test && pnpm --filter web-v2 exec vitest run src/app/da`
Expected: les tests des briques, du menu et de `/da` passent.

- [ ] **Step 4: Écrire le test de la coquille (il échoue)**

`src/app/coquille/Coquille.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Coquille } from './Coquille'

vi.mock('./useAttente', () => ({
  useAttente: () => ({ photos: 12, lieux: 0, signalementsLieu: 2, signalementsEnigme: 1, achats: 4 }),
}))

function monter(adresse: string) {
  const router = createMemoryRouter(
    [{ path: '/', Component: Coquille, children: [{ path: '*', element: <p>Écran</p> }, { index: true, element: <p>Écran</p> }] }],
    { initialEntries: [adresse] },
  )
  render(<RouterProvider router={router} />)
}

test('le lien de l’écran ouvert est marqué', () => {
  monter('/communaute/comptes')
  expect(screen.getAllByRole('link', { name: 'Comptes' })[0]).toHaveAttribute('aria-current', 'page')
})

test('une file non vide montre sa pastille, une file vide n’en montre pas', () => {
  monter('/')
  expect(screen.getAllByRole('link', { name: /Photos et avis/ })[0]).toHaveTextContent('12')
  expect(screen.getAllByRole('link', { name: /Lieux à modérer/ })[0]).not.toHaveTextContent('0')
})
```

Run: `pnpm --filter hub-v2 exec vitest run src/app/coquille`
Expected: FAIL (`./Coquille` introuvable).

- [ ] **Step 5: La coquille, le menu, la barre d'onglets, l'écran « bientôt »**

`src/app/coquille/useAttente.ts` (provisoire : branché sur `hub_ouverture` en Task 6) :

```ts
/**
 * QUOI     — les nombres des files qui attendent, pour les pastilles du menu.
 * ATTENTION — Task 6 le branche sur hub_ouverture ; d'ici là, aucune pastille.
 */
import type { CleAttente } from './menu'

export function useAttente(): Partial<Record<CleAttente, number>> {
  return {}
}
```

`src/app/coquille/Menu.tsx` :

```tsx
/**
 * QUOI     — le menu du PC : le logo, puis les domaines et leurs liens, avec la pastille des
 *            files qui attendent.
 */
import { NavLink } from 'react-router'
import logo from '@/assets/ui/logo-explore.webp'
import { MENU } from './menu'
import { useAttente } from './useAttente'
import styles from './Menu.module.css'

export function Menu() {
  const attente = useAttente()
  return (
    <nav className={styles.menu} aria-label="Menu du Hub">
      <div className={styles.marque}>
        <img src={logo} alt="Runes de Chêne Explore" />
        <span>Le Hub</span>
      </div>
      {MENU.map((domaine) => (
        <div key={domaine.titre ?? 'accueil'} className={styles.domaine}>
          {domaine.titre && <p className={styles.titre}>{domaine.titre}</p>}
          {domaine.liens.map((lien) => {
            const nombre = lien.file ? (attente[lien.file] ?? 0) : 0
            return (
              <NavLink key={lien.chemin} to={lien.chemin} end className={styles.lien}>
                <span>{lien.libelle}</span>
                {nombre > 0 && <span className={styles.pastille}>{nombre}</span>}
              </NavLink>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
```

`src/app/coquille/Menu.module.css` :

```css
.menu {
  display: grid;
  align-content: start;
  gap: var(--space-1);
  padding: var(--space-6) var(--space-4) var(--space-8);
  background: color-mix(in srgb, var(--color-barre) 55%, transparent);
  overflow-y: auto;
}

.marque {
  display: grid;
  gap: var(--space-1);
  padding: 0 var(--space-2) var(--space-4);
}

.marque img {
  width: 176px;
}

.marque span {
  font-family: var(--font-condensee);
  font-weight: var(--weight-gras);
  font-size: var(--libelle-size);
  letter-spacing: var(--bandeau-tracking);
  text-transform: uppercase;
  color: var(--color-texte-doux);
}

.domaine {
  display: grid;
  gap: 1px;
}

.titre {
  margin: var(--space-4) 0 var(--space-1);
  padding: 0 var(--space-3);
  font-family: var(--font-titre);
  font-size: var(--surtitre-size);
  letter-spacing: var(--titre-tracking);
  color: var(--color-encre);
}

.lien {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px var(--space-3);
  border-radius: var(--radius-petit);
  font-weight: var(--weight-normal);
  color: var(--color-texte);
  text-decoration: none;
  transition: background var(--duree-elan) var(--courbe-elan);
}

.lien:hover {
  background: color-mix(in srgb, var(--color-pastille) 50%, transparent);
}

.lien[aria-current='page'] {
  background: var(--color-pastille);
  font-weight: var(--weight-semi);
  color: var(--color-encre);
}

.pastille {
  padding: 1px 7px;
  border-radius: var(--radius-rond);
  background: var(--color-accent);
  font-family: var(--font-condensee);
  font-weight: var(--weight-gras);
  font-size: var(--legende-size);
  color: var(--color-sur-accent);
}
```

`src/app/coquille/BarreDOnglets.tsx` (les icônes sont celles de la maquette téléphone 597:1365, tracées en SVG) :

```tsx
/**
 * QUOI     — la barre d'onglets du téléphone (85 px, comme l'appli) : Accueil, Communauté,
 *            Le jeu, Boutique, Plus.
 */
import { NavLink } from 'react-router'
import { ONGLETS, type Onglet } from './menu'
import styles from './BarreDOnglets.module.css'

const TRACES: Record<Onglet['icone'], string[]> = {
  accueil: ['M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],
  communaute: ['M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5', 'M17 14c2.4.2 4 1.8 4.5 4.5'],
  jeu: ['M12 3 4 7v6c0 4.5 3.4 7.6 8 8 4.6-.4 8-3.5 8-8V7z', 'M12 8v5M12 16v.5'],
  boutique: ['M5 8h14l-1.2 12H6.2z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  plus: ['M5 12h.01M12 12h.01M19 12h.01'],
}
const CERCLES: Partial<Record<Onglet['icone'], [number, number, number][]>> = {
  communaute: [[9, 8, 3.5], [17, 9, 2.5]],
}

export function BarreDOnglets() {
  return (
    <nav className={styles.barre} aria-label="Onglets du Hub">
      {ONGLETS.map((o) => (
        <NavLink key={o.chemin} to={o.chemin} end={o.chemin === '/'} className={styles.onglet}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {TRACES[o.icone].map((d) => <path key={d} d={d} />)}
            {(CERCLES[o.icone] ?? []).map(([cx, cy, r]) => <circle key={`${String(cx)}-${String(cy)}`} cx={cx} cy={cy} r={r} />)}
          </svg>
          <span>{o.libelle}</span>
        </NavLink>
      ))}
    </nav>
  )
}
```

`src/app/coquille/BarreDOnglets.module.css` :

```css
.barre {
  display: flex;
  justify-content: space-between;
  height: var(--tabbar-height);
  padding: var(--space-3) var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-sable);
  background: var(--color-barre);
}

.onglet {
  display: grid;
  justify-items: center;
  gap: var(--space-1);
  font-family: var(--font-condensee);
  font-weight: var(--weight-gras);
  font-size: var(--libelle-size);
  text-transform: uppercase;
  color: var(--color-kaki);
  text-decoration: none;
  transition: color var(--duree-elan) var(--courbe-elan);
}

.onglet[aria-current='page'] {
  color: var(--color-accent);
}
```

`src/app/coquille/BientotIci.tsx` :

```tsx
/**
 * QUOI     — l'écran d'un domaine pas encore repris : son nom, et le lien vers l'ancien Hub.
 * POURQUOI — le menu est complet dès le plan 1 ; les écrans arrivent plan par plan (spec §12).
 * ATTENTION — chaque plan suivant remplace une de ces routes ; à la bascule (plan 5), il n'en
 *            reste aucune et ce fichier est supprimé.
 */
import { useLocation } from 'react-router'
import { MENU } from './menu'
import styles from './BientotIci.module.css'

export function BientotIci() {
  const { pathname } = useLocation()
  const lien = MENU.flatMap((d) => d.liens).find((l) => l.chemin === pathname)
  return (
    <section className={styles.ecran}>
      <h1 className={styles.titre}>{lien?.libelle ?? 'Cet écran'}</h1>
      <p>Cet écran arrive bientôt dans le nouveau Hub.</p>
      <a href="https://hub.runesdechene.com">Ouvrir l’ancien Hub</a>
    </section>
  )
}
```

`src/app/coquille/BientotIci.module.css` :

```css
.ecran {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-6);
}

.titre {
  margin: 0;
  font-family: var(--font-titre);
  font-size: var(--titre-ecran-size);
  font-weight: var(--weight-normal);
  color: var(--color-encre);
}

.ecran a {
  color: var(--color-accent);
}
```

`src/app/coquille/Coquille.tsx` :

```tsx
/**
 * QUOI     — la coquille du Hub : le menu à gauche sur PC, la barre d'onglets sur téléphone,
 *            l'écran ouvert au milieu.
 * POURQUOI — la bascule PC/téléphone suit la largeur (container queries, comme la V2).
 */
import { Outlet } from 'react-router'
import { BarreDOnglets } from './BarreDOnglets'
import { Menu } from './Menu'
import styles from './Coquille.module.css'

export function Coquille() {
  return (
    <div className={styles.coquille}>
      <div className={styles.menu}>
        <Menu />
      </div>
      <main className={styles.contenu}>
        <Outlet />
      </main>
      <div className={styles.onglets}>
        <BarreDOnglets />
      </div>
    </div>
  )
}
```

`src/app/coquille/Coquille.module.css` :

```css
.coquille {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 100dvh;
}

.menu {
  display: none;
}

.contenu {
  min-width: 0;
  padding: var(--space-4) var(--space-4) calc(var(--tabbar-height) + var(--space-6));
}

.onglets {
  position: fixed;
  inset: auto 0 0;
}

@container app (width >= 900px) {
  .coquille {
    grid-template-columns: 232px minmax(0, 1fr);
  }

  .menu {
    display: block;
    position: sticky;
    top: 0;
    height: 100dvh;
  }

  .menu > nav {
    height: 100%;
  }

  .contenu {
    padding: var(--space-8) 56px 120px;
  }

  .onglets {
    display: none;
  }
}
```

Le `container: app / inline-size` sur `#root` vient de `packages/da/global.css` (repris de la V2).

`src/app/coquille/README.md` : `La coquille : `menu.ts` (la liste unique), `Menu` (PC), `BarreDOnglets` (téléphone), `Coquille` (la mise en page), `BientotIci` (écrans pas encore repris), `useAttente` (pastilles).`

`src/app/router.tsx` :

```tsx
/**
 * QUOI     — toutes les adresses du Hub V2.
 * POURQUOI — tout état navigable est une URL (spec Hub V2 §4) ; le menu (coquille/menu.ts) est la
 *            liste des adresses, l'accueil a son écran, les autres attendent leur plan.
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { BientotIci } from './coquille/BientotIci'
import { Coquille } from './coquille/Coquille'
import { MENU } from './coquille/menu'
import { PorteDEntree } from './entree/PorteDEntree'

const autres = MENU.flatMap((d) => d.liens)
  .filter((l) => l.chemin !== '/')
  .map((l) => ({ path: l.chemin.slice(1), Component: BientotIci }))

export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <PorteDEntree>
        <Coquille />
      </PorteDEntree>
    ),
    children: [{ index: true, element: <p>Accueil du Hub</p> }, ...autres],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
```

Run: `pnpm --filter hub-v2 test && pnpm --filter hub-v2 lint`
Expected: PASS.

- [ ] **Step 6: Essayer dans le navigateur, à 1440 et 390 px**

Run: `pnpm --filter hub-v2 dev`, se connecter, parcourir chaque lien du menu.
Expected : le menu de la maquette 587:761 à 1440 px (groupes en Bebas, lien choisi sur fond pastille), la barre d'onglets à 390 px (maquette 597:1365), chaque lien ouvre son écran « bientôt », l'adresse change, le retour du navigateur marche. Console sans erreur.

- [ ] **Step 7: Commit**

```bash
git add apps/hub-v2 packages/da apps/web-v2/src/app/da
git commit -m "feat(hub-v2): la coquille, le menu par domaines et les briques"
```

---

### Task 6: L'ouverture — migration 506, l'en-tête, le pouls, ce qui attend, la santé

**Files:**
- Create: `supabase/migrations/506_hub_ouverture.sql`
- Create (`apps/hub-v2/`) : `src/shared/lib/ecart.ts`, `ecart.test.ts`, `src/shared/lib/quand.ts`, `quand.test.ts`, `src/shared/lib/README.md`
- Create : `src/features/accueil/api/ouverture.ts`, `hooks/useOuverture.ts`, `components/{Ouverture, EnTete, Pouls, Attente, Sante}.tsx` + `Ouverture.module.css`, `components/Pouls.test.tsx`, `components/Attente.test.tsx`, `README.md`
- Modify : `src/app/coquille/useAttente.ts`, `src/app/router.tsx`, `src/shared/supabase/database.types.ts` (régénéré)

**Interfaces:**
- Consumes: `Tuile`, `Bloc`, `TitreDeSection`, `ChoixSegmente`, `LigneATraiter` (Task 5).
- Produces: RPC `hub_ouverture(p_jours integer) returns jsonb` :

```json
{
  "pouls":  { "nouveaux": 23, "reactives": 9, "actifs": 312, "lieux": 14, "visites": 86, "enigmes": 241 },
  "avant":  { "nouveaux": 19, "reactives": 6, "lieux": 8, "visites": 77, "enigmes": 236 },
  "attente": { "photos": 12, "photos_depuis": "2026-10-11T09:00:00Z", "lieux": 3, "signalements_lieu": 2,
               "signalements_enigme": 1, "achats": 4 },
  "sante":  { "derniere_commande": "2026-10-10T…", "notifications": 1204, "notifications_lues": 410 }
}
```

  `avant` n'a pas `actifs` (non comparable). TS : `type Ouverture` dans `api/ouverture.ts` ; `ecart(actuel: number, avant: number | undefined): Ecart | undefined` ; `depuis(iso: string, maintenant: Date): string`.

- [ ] **Step 1: Relever les colonnes live** (lecture seule)

```bash
npx supabase db query --linked "select table_name, column_name from information_schema.columns where table_schema='public' and (table_name, column_name) in (('users','created_at'),('users','charte_signee_le'),('users','last_login_at'),('places','created_at'),('places','verified_at'),('places_discovered','method'),('places_discovered','discovered_at'),('enigma_responses','correct'),('enigma_responses','responded_at'),('hub_photo_submissions','status'),('hub_photo_submissions','created_at'),('signalements_lieu','traite_le'),('signalements_enigme','traite_le'),('purchase_log','status'),('purchase_log','created_at'),('notifications','read'),('notifications','created_at')) order by 1,2"
```

Expected: les 17 couples. S'il en manque un, s'arrêter.

- [ ] **Step 2: La migration**

```sql
-- WHY: Hub V2, l'ouverture (spec 2026-10-14-hub-v2-design §7-9, définitions validées par Uriel
--      le 14/10) : le pouls d'une période et de la période d'avant, ce qui attend, la santé, en
--      une lecture réservée aux admins.
--      « Aujourd'hui » (p_jours = 1) part de minuit à Paris ; sinon, les N derniers jours.
--      « Actifs » n'a pas de période d'avant : last_login_at ne garde que la dernière connexion.
--      « Réactivé » : charte_signee_le, posée une seule fois à la première entrée dans la V2,
--      plus d'un jour après la création du compte.
--      « Lieux à modérer » : ajoutés depuis la bascule (07/10/2026) et jamais vérifiés.
-- SCHEMA CHECKED (14/10/2026, information_schema live) : users(created_at, charte_signee_le,
--   last_login_at) ; places(created_at, verified_at) ; places_discovered(method, discovered_at) ;
--   enigma_responses(correct, responded_at) ; hub_photo_submissions(status, created_at) ;
--   signalements_lieu(traite_le) ; signalements_enigme(traite_le) ; purchase_log(status,
--   created_at) ; notifications(read, created_at) ; _is_admin(), _refus().

CREATE OR REPLACE FUNCTION public._hub_pouls(p_debut timestamptz, p_fin timestamptz)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'nouveaux', (SELECT count(*) FROM users WHERE created_at >= p_debut AND created_at < p_fin),
    'reactives', (SELECT count(*) FROM users
                   WHERE charte_signee_le >= p_debut AND charte_signee_le < p_fin
                     AND charte_signee_le > created_at + interval '1 day'),
    'lieux', (SELECT count(*) FROM places WHERE created_at >= p_debut AND created_at < p_fin),
    'visites', (SELECT count(*) FROM places_discovered
                 WHERE method = 'gps' AND discovered_at >= p_debut AND discovered_at < p_fin),
    'enigmes', (SELECT count(*) FROM enigma_responses
                 WHERE correct AND responded_at >= p_debut AND responded_at < p_fin)
  );
$function$;

REVOKE ALL ON FUNCTION public._hub_pouls(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hub_ouverture(p_jours integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fin timestamptz := now();
  v_debut timestamptz;
  v_avant timestamptz;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_jours NOT IN (1, 7, 30, 90) THEN PERFORM _refus('Période inconnue', 'periode'); END IF;

  v_debut := CASE WHEN p_jours = 1
    THEN date_trunc('day', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris'
    ELSE now() - make_interval(days => p_jours) END;
  v_avant := v_debut - (v_fin - v_debut);

  RETURN jsonb_build_object(
    'pouls', _hub_pouls(v_debut, v_fin)
      || jsonb_build_object('actifs', (SELECT count(*) FROM users WHERE last_login_at >= v_debut)),
    'avant', _hub_pouls(v_avant, v_debut),
    'attente', jsonb_build_object(
      'photos', (SELECT count(*) FROM hub_photo_submissions WHERE status = 'pending'),
      'photos_depuis', (SELECT min(created_at) FROM hub_photo_submissions WHERE status = 'pending'),
      'lieux', (SELECT count(*) FROM places
                 WHERE verified_at IS NULL AND created_at >= '2026-10-07'::timestamptz),
      'signalements_lieu', (SELECT count(*) FROM signalements_lieu WHERE traite_le IS NULL),
      'signalements_enigme', (SELECT count(*) FROM signalements_enigme WHERE traite_le IS NULL),
      'achats', (SELECT count(*) FROM purchase_log WHERE status IN ('pending', 'no_match'))
    ),
    'sante', jsonb_build_object(
      'derniere_commande', (SELECT max(created_at) FROM purchase_log),
      'notifications', (SELECT count(*) FROM notifications WHERE created_at >= v_debut),
      'notifications_lues', (SELECT count(*) FROM notifications WHERE created_at >= v_debut AND read)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_ouverture(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_ouverture(integer) TO authenticated;
```

- [ ] **Step 3: Appliquer et vérifier en prod**

```bash
npx supabase db push --dry-run --linked
npx supabase db push --linked
npx supabase db query --linked "select has_function_privilege('anon','public.hub_ouverture(integer)','execute') as anon, has_function_privilege('authenticated','public._hub_pouls(timestamptz,timestamptz)','execute') as pouls_ouvert"
npx supabase db query --linked "select public._hub_pouls(now() - interval '7 days', now())"
```

Expected : `anon = false`, `pouls_ouvert = false` ; la dernière requête (lancée en propriétaire) rend cinq compteurs plausibles. `hub_ouverture` elle-même se vérifie dans le navigateur au Step 8 (elle exige une session admin).

Run: `pnpm --filter hub-v2 gen:types`
Expected : `hub_ouverture` dans `database.types.ts`.

- [ ] **Step 4: Écrire les tests des fonctions pures (ils échouent)**

`src/shared/lib/ecart.test.ts` :

```ts
import { ecart } from './ecart'

test('sans période d’avant comparable, pas d’écart', () => {
  expect(ecart(312, undefined)).toBeUndefined()
})
test('rien avant, quelque chose maintenant : « nouveau », jamais l’infini', () => {
  expect(ecart(5, 0)).toEqual({ texte: 'nouveau', sens: 'hausse' })
})
test('rien avant, rien maintenant : égal', () => {
  expect(ecart(0, 0)).toEqual({ texte: '=', sens: 'egal' })
})
test('petits nombres : l’écart en valeur', () => {
  expect(ecart(9, 6)).toEqual({ texte: '+3', sens: 'hausse' })
  expect(ecart(4, 6)).toEqual({ texte: '−2', sens: 'baisse' })
})
test('grands nombres : l’écart en pourcentage arrondi', () => {
  expect(ecart(23, 19.5)).toEqual({ texte: '+18 %', sens: 'hausse' })
  expect(ecart(300, 312)).toEqual({ texte: '−4 %', sens: 'baisse' })
})
test('même valeur : égal', () => {
  expect(ecart(40, 40)).toEqual({ texte: '=', sens: 'egal' })
})
```

`src/shared/lib/quand.test.ts` :

```ts
import { depuis } from './quand'

const maintenant = new Date('2026-10-14T12:00:00Z')

test('moins d’une heure', () => {
  expect(depuis('2026-10-14T11:48:00Z', maintenant)).toBe('il y a 12 min')
})
test('quelques heures', () => {
  expect(depuis('2026-10-14T09:00:00Z', maintenant)).toBe('il y a 3 h')
})
test('quelques jours', () => {
  expect(depuis('2026-10-11T09:00:00Z', maintenant)).toBe('il y a 3 jours')
})
test('un jour', () => {
  expect(depuis('2026-10-13T09:00:00Z', maintenant)).toBe('hier')
})
```

Run: `pnpm --filter hub-v2 exec vitest run src/shared/lib`
Expected: FAIL (modules introuvables).

- [ ] **Step 5: Les fonctions pures**

`src/shared/lib/ecart.ts` :

```ts
/**
 * QUOI     — l'écart entre un chiffre et celui de la période d'avant, tel qu'on l'écrit sur une tuile.
 * POURQUOI — sous 20, un pourcentage ment (de 2 à 3, « +50 % ») : on écrit l'écart en valeur.
 *            Rien avant → « nouveau » (jamais l'infini). Pas de période d'avant → pas d'écart.
 */
import type { Ecart } from '@/shared/ui/Tuile'

const SEUIL_POURCENTAGE = 20

export function ecart(actuel: number, avant: number | undefined): Ecart | undefined {
  if (avant === undefined) return undefined
  if (actuel === avant) return { texte: '=', sens: 'egal' }
  if (avant === 0) return { texte: 'nouveau', sens: 'hausse' }
  const sens = actuel > avant ? 'hausse' : 'baisse'
  const signe = sens === 'hausse' ? '+' : '−'
  if (avant < SEUIL_POURCENTAGE) return { texte: `${signe}${String(Math.abs(actuel - avant))}`, sens }
  const pourcentage = Math.round((Math.abs(actuel - avant) / avant) * 100)
  if (pourcentage === 0) return { texte: '=', sens: 'egal' }
  return { texte: `${signe}${String(pourcentage)} %`, sens }
}
```

`src/shared/lib/quand.ts` :

```ts
/**
 * QUOI     — « il y a 12 min », « il y a 3 h », « hier », « il y a 3 jours ».
 */
const MINUTE = 60_000
const HEURE = 60 * MINUTE
const JOUR = 24 * HEURE

export function depuis(iso: string, maintenant: Date = new Date()): string {
  const ecoule = maintenant.getTime() - new Date(iso).getTime()
  if (ecoule < HEURE) return `il y a ${String(Math.max(1, Math.round(ecoule / MINUTE)))} min`
  if (ecoule < JOUR) return `il y a ${String(Math.round(ecoule / HEURE))} h`
  const jours = Math.floor(ecoule / JOUR)
  return jours === 1 ? 'hier' : `il y a ${String(jours)} jours`
}
```

`src/shared/lib/README.md` : `Fonctions pures du Hub, testées seules : `ecart` (l'écart d'une tuile), `quand` (« il y a… »).`

Run: `pnpm --filter hub-v2 exec vitest run src/shared/lib`
Expected: PASS.

- [ ] **Step 6: Écrire les tests du pouls et de l'attente (ils échouent)**

`src/features/accueil/components/Pouls.test.tsx` :

```tsx
import { render, screen, within } from '@testing-library/react'
import { Pouls } from './Pouls'

const pouls = { nouveaux: 23, reactives: 9, actifs: 312, lieux: 14, visites: 86, enigmes: 241 }
const avant = { nouveaux: 19, reactives: 6, lieux: 8, visites: 77, enigmes: 236 }

test('six tuiles, dans l’ordre de la maquette', () => {
  render(<Pouls pouls={pouls} avant={avant} />)
  expect(screen.getAllByText(/./, { selector: 'span[class*="libelle"]' }).map((e) => e.textContent)).toEqual([
    'Nouveaux comptes', 'Comptes réactivés', 'Actifs', 'Lieux ajoutés', 'Visites sur place', 'Énigmes percées',
  ])
})

test('« Actifs » n’a pas d’écart : la période d’avant n’est pas comparable', () => {
  render(<Pouls pouls={pouls} avant={avant} />)
  const actifs = screen.getByText('Actifs').parentElement
  if (!actifs) throw new Error('tuile absente')
  expect(within(actifs).queryByTestId('ecart')).not.toBeInTheDocument()
})
```

`src/features/accueil/components/Attente.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Attente } from './Attente'

const attente = { photos: 12, photos_depuis: '2026-10-11T09:00:00Z', lieux: 0, signalements_lieu: 2, signalements_enigme: 0, achats: 4 }

test('seules les files non vides ont leur ligne', () => {
  render(<MemoryRouter><Attente attente={attente} maintenant={new Date('2026-10-14T12:00:00Z')} /></MemoryRouter>)
  expect(screen.getByText('Photos et avis à valider')).toBeInTheDocument()
  expect(screen.getByText('Le plus ancien attend depuis 3 jours')).toBeInTheDocument()
  expect(screen.queryByText('Lieux à modérer')).not.toBeInTheDocument()
  expect(screen.queryByText('Énigmes signalées')).not.toBeInTheDocument()
})

test('rien n’attend : on le dit', () => {
  const vide = { photos: 0, photos_depuis: null, lieux: 0, signalements_lieu: 0, signalements_enigme: 0, achats: 0 }
  render(<MemoryRouter><Attente attente={vide} maintenant={new Date()} /></MemoryRouter>)
  expect(screen.getByText('Rien ne t’attend. Belle journée.')).toBeInTheDocument()
})
```

Run: `pnpm --filter hub-v2 exec vitest run src/features/accueil`
Expected: FAIL (modules introuvables).

- [ ] **Step 7: L'API, le hook, les composants**

`src/features/accueil/api/ouverture.ts` :

```ts
/**
 * QUOI     — lit l'ouverture du Hub (hub_ouverture, mig 506) pour une période.
 * POURQUOI — une seule lecture pour l'en-tête, le pouls, l'attente et la santé.
 */
import { supabase } from '@/shared/supabase/client'

export type Periode = '1' | '7' | '30' | '90'
export type Compteurs = { nouveaux: number; reactives: number; lieux: number; visites: number; enigmes: number }
export type Ouverture = {
  pouls: Compteurs & { actifs: number }
  avant: Compteurs
  attente: {
    photos: number; photos_depuis: string | null; lieux: number
    signalements_lieu: number; signalements_enigme: number; achats: number
  }
  sante: { derniere_commande: string | null; notifications: number; notifications_lues: number }
}

export async function lireOuverture(periode: Periode): Promise<Ouverture> {
  const { data, error } = await supabase.rpc('hub_ouverture', { p_jours: Number(periode) })
  if (error) throw error
  return data as Ouverture
}
```

(`data` est typé `Json` par le générateur ; la forme est garantie par la migration 506 — c'est la seule conversion du fichier.)

`src/features/accueil/hooks/useOuverture.ts` :

```ts
/**
 * QUOI     — l'ouverture pour la période choisie, rafraîchie toutes les minutes.
 */
import { useQuery } from '@tanstack/react-query'
import { lireOuverture, type Periode } from '../api/ouverture'

export function useOuverture(periode: Periode) {
  return useQuery({
    queryKey: ['hub-ouverture', periode],
    queryFn: () => lireOuverture(periode),
    refetchInterval: 60_000,
  })
}
```

`src/app/coquille/useAttente.ts` (remplace la version provisoire) :

```ts
/**
 * QUOI     — les nombres des files qui attendent, pour les pastilles du menu.
 * POURQUOI — lus dans la même réponse que l'ouverture (7 jours : l'attente ne dépend pas de la
 *            période) ; rien tant qu'elle n'est pas arrivée.
 */
import { useOuverture } from '@/features/accueil/hooks/useOuverture'
import type { CleAttente } from './menu'

export function useAttente(): Partial<Record<CleAttente, number>> {
  const { data } = useOuverture('7')
  if (!data) return {}
  const a = data.attente
  return { photos: a.photos, lieux: a.lieux, signalementsLieu: a.signalements_lieu, signalementsEnigme: a.signalements_enigme, achats: a.achats }
}
```

(La coquille est dans `src/app/` : elle peut importer une zone ; une zone n'importe jamais la coquille.)

`src/features/accueil/components/Pouls.tsx` :

```tsx
/**
 * QUOI     — les six chiffres du pouls (définitions : spec §8).
 * ATTENTION — « Actifs » n'a pas d'écart : last_login_at ne garde que la dernière connexion.
 */
import { ecart } from '@/shared/lib/ecart'
import { Tuile } from '@/shared/ui/Tuile'
import type { Compteurs, Ouverture } from '../api/ouverture'
import styles from './Ouverture.module.css'

const TUILES: { cle: keyof Ouverture['pouls']; libelle: string }[] = [
  { cle: 'nouveaux', libelle: 'Nouveaux comptes' },
  { cle: 'reactives', libelle: 'Comptes réactivés' },
  { cle: 'actifs', libelle: 'Actifs' },
  { cle: 'lieux', libelle: 'Lieux ajoutés' },
  { cle: 'visites', libelle: 'Visites sur place' },
  { cle: 'enigmes', libelle: 'Énigmes percées' },
]

const nombre = new Intl.NumberFormat('fr-FR')

export function Pouls({ pouls, avant }: { pouls: Ouverture['pouls']; avant: Compteurs }) {
  return (
    <div className={styles.tuiles}>
      {TUILES.map(({ cle, libelle }) => {
        const e = cle === 'actifs' ? undefined : ecart(pouls[cle], avant[cle])
        return <Tuile key={cle} libelle={libelle} valeur={nombre.format(pouls[cle])} {...(e ? { ecart: e } : {})} />
      })}
    </div>
  )
}
```

`src/features/accueil/components/Attente.tsx` :

```tsx
/**
 * QUOI     — « Ce qui t'attend » : une ligne par file non vide, avec le lien vers son écran.
 */
import sectionNouvelles from '@/assets/ui/section-nouvelles.png'
import { depuis } from '@/shared/lib/quand'
import { Bloc } from '@/shared/ui/Bloc'
import { LigneATraiter } from '@/shared/ui/LigneATraiter'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { Ouverture } from '../api/ouverture'
import styles from './Ouverture.module.css'

export function Attente({ attente, maintenant }: { attente: Ouverture['attente']; maintenant: Date }) {
  const lignes = [
    { nombre: attente.photos, titre: 'Photos et avis à valider', vers: '/boutique/photos',
      detail: attente.photos_depuis ? `Le plus ancien attend depuis ${depuis(attente.photos_depuis, maintenant).replace('il y a ', '')}` : 'À relire' },
    { nombre: attente.lieux, titre: 'Lieux à modérer', vers: '/communaute/lieux', detail: 'Ajoutés depuis la bascule, jamais vérifiés' },
    { nombre: attente.signalements_lieu, titre: 'Signalements de lieux', vers: '/communaute/signalements', detail: 'Pas encore traités' },
    { nombre: attente.signalements_enigme, titre: 'Énigmes signalées', vers: '/jeu/enigmes-signalees', detail: 'Pas encore traitées' },
    { nombre: attente.achats, titre: 'Achats à associer à la main', vers: '/boutique/fragments', detail: 'Commandes sans compte trouvé' },
  ].filter((l) => l.nombre > 0)

  return (
    <section className={styles.section}>
      <TitreDeSection titre="Ce qui t’attend" icone={sectionNouvelles} />
      {lignes.length === 0 ? (
        <p className={styles.calme}>Rien ne t’attend. Belle journée.</p>
      ) : (
        <Bloc>
          {lignes.map((l) => <LigneATraiter key={l.vers} {...l} />)}
        </Bloc>
      )}
    </section>
  )
}
```

`src/features/accueil/components/Sante.tsx` :

```tsx
/**
 * QUOI     — « La santé » : un point vert ou orange par service (spec §9).
 * ATTENTION — Synchro Shopify et fiches publiques arrivent avec le plan 4 (fonctions Netlify) ;
 *            ici, ce que la base sait : les commandes reçues, les notifications, la version d'Explore.
 */
import sectionAjoutes from '@/assets/ui/section-ajoutes.svg'
import { depuis } from '@/shared/lib/quand'
import { Bloc } from '@/shared/ui/Bloc'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { Ouverture } from '../api/ouverture'
import styles from './Ouverture.module.css'

const TROIS_JOURS = 3 * 24 * 3600_000

export function Sante({ sante, maintenant }: { sante: Ouverture['sante']; maintenant: Date }) {
  const commande = sante.derniere_commande
  const commandesOk = commande !== null && maintenant.getTime() - new Date(commande).getTime() < TROIS_JOURS
  const lignes = [
    { ok: commandesOk, titre: 'Commandes Shopify', detail: commande ? `Dernière reçue ${depuis(commande, maintenant)}` : 'Aucune commande reçue' },
    { ok: true, titre: 'Notifications', detail: `${String(sante.notifications)} envoyées sur la période · ${String(sante.notifications_lues)} lues` },
  ]
  return (
    <section className={styles.section}>
      <TitreDeSection titre="La santé" icone={sectionAjoutes} />
      <Bloc>
        {lignes.map((l) => (
          <div key={l.titre} className={styles.etat}>
            <span className={styles.point} data-ok={l.ok} />
            <span className={styles.etatTexte}>
              <span className={styles.etatTitre}>{l.titre}</span>
              <span className={styles.etatDetail}>{l.detail}</span>
            </span>
          </div>
        ))}
      </Bloc>
    </section>
  )
}
```

`src/features/accueil/components/EnTete.tsx` :

```tsx
/**
 * QUOI     — l'en-tête de l'ouverture : la date, « Bonjour », une phrase de la période, le
 *            choix de la période.
 */
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import type { Ouverture, Periode } from '../api/ouverture'
import styles from './Ouverture.module.css'

const PERIODES: { valeur: Periode; libelle: string }[] = [
  { valeur: '1', libelle: 'Aujourd’hui' },
  { valeur: '7', libelle: '7 jours' },
  { valeur: '30', libelle: '30 jours' },
  { valeur: '90', libelle: '90 jours' },
]

const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

export function EnTete({ periode, onPeriode, pouls, maintenant }: {
  periode: Periode; onPeriode: (p: Periode) => void; pouls: Ouverture['pouls'] | undefined; maintenant: Date
}) {
  return (
    <header className={styles.entete}>
      <div className={styles.salut}>
        <p className={styles.date}>{date.format(maintenant)}</p>
        <h1 className={styles.bonjour}>Bonjour Uriel</h1>
        {pouls && (
          <p className={styles.phrase}>
            {pouls.nouveaux} nouveaux Explorateurs, {pouls.visites} visites sur place.
          </p>
        )}
      </div>
      <ChoixSegmente nom="Période" options={PERIODES} choisi={periode} onChoix={onPeriode} />
    </header>
  )
}
```

(« Bonjour Uriel » est écrit en dur : le Hub n'a qu'un admin aujourd'hui ; le prénom viendra du compte quand les modérateurs arriveront, chantier C.)

`src/features/accueil/components/Ouverture.tsx` :

```tsx
/**
 * QUOI     — l'écran d'ouverture du Hub (maquettes 587:761, 597:1365) : en-tête, pouls, ce qui
 *            t'attend, la santé, le fil d'activité.
 * POURQUOI — la période est dans l'adresse (?periode=30) : tout état navigable est une URL.
 */
import { useSearchParams } from 'react-router'
import type { Periode } from '../api/ouverture'
import { useOuverture } from '../hooks/useOuverture'
import { Attente } from './Attente'
import { EnTete } from './EnTete'
import { Pouls } from './Pouls'
import { Sante } from './Sante'
import styles from './Ouverture.module.css'

const VALIDES: Periode[] = ['1', '7', '30', '90']

export function Ouverture() {
  const [params, setParams] = useSearchParams()
  const brute = params.get('periode')
  const periode: Periode = VALIDES.find((p) => p === brute) ?? '7'
  const { data, isError, refetch } = useOuverture(periode)
  const maintenant = new Date()

  return (
    <div className={styles.ouverture}>
      <EnTete periode={periode} onPeriode={(p) => setParams({ periode: p })} pouls={data?.pouls} maintenant={maintenant} />
      {isError && (
        <p className={styles.calme}>
          La base ne répond pas. <button type="button" onClick={() => void refetch()}>Réessayer</button>
        </p>
      )}
      {data && (
        <>
          <Pouls pouls={data.pouls} avant={data.avant} />
          <div className={styles.paire}>
            <Attente attente={data.attente} maintenant={maintenant} />
            <Sante sante={data.sante} maintenant={maintenant} />
          </div>
        </>
      )}
    </div>
  )
}
```

`src/features/accueil/components/Ouverture.module.css` :

```css
/*
 * QUOI     — la mise en page de l'ouverture : en-tête, tuiles (6 sur PC, 2 par ligne au
 *            téléphone), la paire « attente / santé » côte à côte sur PC.
 */
.ouverture {
  display: grid;
  gap: var(--space-6);
}

.entete {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.salut {
  display: grid;
  gap: var(--space-1);
}

.date {
  margin: 0;
  font-family: var(--font-titre);
  font-size: var(--rangee-size);
  letter-spacing: var(--bandeau-titre-tracking);
  text-transform: uppercase;
  color: var(--color-texte-doux);
}

.bonjour {
  margin: 0;
  font-family: var(--font-titre);
  font-size: var(--vitrine-lieux-titre-pc-size);
  font-weight: var(--weight-normal);
  line-height: 1;
  color: var(--color-encre);
}

.phrase {
  margin: 0;
  color: var(--color-texte);
}

.tuiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.paire {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-6);
}

.section {
  display: grid;
  gap: var(--space-4);
  align-content: start;
}

.calme {
  margin: 0;
  color: var(--color-texte-doux);
}

.etat {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.point {
  flex: 0 0 10px;
  height: 10px;
  border-radius: var(--radius-rond);
  background: var(--color-vert);
}

.point[data-ok='false'] {
  background: var(--color-confetti-or);
}

.etatTexte {
  display: grid;
}

.etatTitre {
  font-weight: var(--weight-semi);
  color: var(--color-encre);
}

.etatDetail {
  font-size: var(--flux-size);
  color: var(--color-texte-doux);
}

@container app (width >= 900px) {
  .tuiles {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .paire {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-8);
  }
}
```

`src/features/accueil/README.md` : `L'accueil du Hub (spec §7) : `api/` (hub_ouverture, fil_du_hub), `hooks/`, `lib/` (phrase du fil), `components/` (Ouverture et ses sections).`

`src/app/router.tsx` : remplacer `{ index: true, element: <p>Accueil du Hub</p> }` par `{ index: true, Component: Ouverture }` (import `import { Ouverture } from '@/features/accueil/components/Ouverture'`), et dans `router.test.tsx` attendre le texte `Bonjour Uriel` au lieu de `Accueil du Hub`, en ajoutant le faux du hook :

```tsx
vi.mock('@/features/accueil/hooks/useOuverture', () => ({
  useOuverture: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
}))
```

Run: `pnpm --filter hub-v2 test && pnpm --filter hub-v2 lint`
Expected: PASS.

- [ ] **Step 8: Essayer dans le navigateur contre la prod, à 1440 et 390 px**

Run: `pnpm --filter hub-v2 dev`, se connecter en admin.
Expected : les chiffres réels ; changer de période change l'adresse (`?periode=30`) et les chiffres ; « Actifs » sans écart ; une file vide n'a pas de ligne ni de pastille ; le retour du navigateur revient à la période d'avant. Mettre la capture à côté de la maquette 587:761 (1440) et 597:1365 (390) et reprendre chaque écart (tailles, couleurs, alignements). Console sans erreur.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/506_hub_ouverture.sql apps/hub-v2
git commit -m "feat(hub-v2): l'ouverture — le pouls, ce qui attend, la santé"
```

---

### Task 7: Le fil d'activité — migration 507, la phrase de chaque ligne, l'écran

**Files:**
- Create: `supabase/migrations/507_fil_du_hub.sql`
- Create (`apps/hub-v2/`) : `src/features/accueil/api/fil.ts`, `lib/phraseDuFil.ts`, `lib/phraseDuFil.test.ts`, `hooks/useFil.ts`, `hooks/useFil.test.tsx`, `components/FilDActivite.tsx`, `components/FilDActivite.module.css`
- Modify : `src/features/accueil/components/Ouverture.tsx`, `src/shared/supabase/database.types.ts` (régénéré)

**Interfaces:**
- Consumes: `Balise`, `Bloc`, `TitreDeSection`, `ChoixSegmente` (Task 5), `depuis` (Task 6).
- Produces: RPC `fil_du_hub(p_types text[], p_avant timestamptz, p_limite integer) returns jsonb` — un tableau trié du plus récent au plus ancien de :

```json
{ "type": "lieu", "sorte": "ajout", "quand": "2026-10-14T09:02:00Z",
  "qui": { "id": "…", "nom": "Luna", "avatar": "https://…" },
  "lieu": { "id": "…", "nom": "Dolmen de la Pierre Levée", "departement": "Aude" },
  "donnees": { "verifie": false } }
```

  `type` ∈ `compte | lieu | visite | enigme | boutique | photo | message | moderation | notification`. TS : `type Activite`, `phraseDuFil(a: Activite): { titre: string; detail: string }`, `useFil(types: TypeActivite[])` rend `{ activites: Activite[]; voirPlus: () => void; aDAutres: boolean; isError: boolean }`.

- [ ] **Step 1: Relever les colonnes live** (lecture seule)

```bash
npx supabase db query --linked "select table_name, column_name from information_schema.columns where table_schema='public' and (table_name, column_name) in (('users','display_name'),('users','first_name'),('users','avatar_url'),('users','account_source'),('users','shopify_customer_id'),('places','title'),('places','departement'),('places','author_id'),('places','verified_at'),('places','masked'),('versions_lieu','auteur'),('versions_lieu','cree_le'),('places_discovered','user_id'),('enigma_responses','enigma_id'),('enigmas','theme'),('user_fragments','unlocked_at'),('user_fragments','source'),('title_fragments','name'),('hub_photo_submissions','submitter_name'),('hub_photo_submissions','product_worn'),('hub_photo_submissions','rating_products'),('chat_messages','channel'),('chat_messages','retire_le'),('signalements_lieu','raison'),('signalements_enigme','raison'),('notifications','type')) order by 1,2"
```

Expected : les 26 couples. S'il en manque un, s'arrêter.

- [ ] **Step 2: La migration**

```sql
-- WHY: Hub V2, le fil d'activité (spec 2026-10-14-hub-v2-design §10) : tout ce que font les
--      gens, avec plus de détails que l'appli publique, sans nouvelle table — chaque source est
--      lue là où la base la garde déjà, comme sur_les_chemins (504) : une branche par source,
--      chacune limitée, puis un tri commun.
--      Les lieux masqués ou privés restent dans le fil : c'est l'équipe qui lit.
--      Un compte sans nom s'appelle « Un Voyageur » (mig 486).
--      Notifications : regroupées par type et par heure (une ligne « l'énigme du jour est
--      partie », pas 400).
-- SCHEMA CHECKED (14/10/2026, information_schema live) : voir le plan, Task 7 Step 1 (26
--   colonnes) ; _is_admin(), _refus().

CREATE OR REPLACE FUNCTION public.fil_du_hub(p_types text[], p_avant timestamptz, p_limite integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_avant timestamptz := COALESCE(p_avant, now() + interval '1 second');
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 30), 1), 100);
  v_tous boolean := p_types IS NULL OR cardinality(p_types) = 0;
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;

  WITH
  evenements AS (
    (SELECT 'compte' AS type, 'inscription' AS sorte, u.created_at AS quand, u.id AS qui, NULL::text AS lieu,
            jsonb_build_object('provenance', u.account_source, 'client', u.shopify_customer_id IS NOT NULL) AS donnees
       FROM users u WHERE (v_tous OR 'compte' = ANY(p_types)) AND u.created_at < v_avant
      ORDER BY u.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'compte', 'reactivation', u.charte_signee_le, u.id, NULL,
            jsonb_build_object('inscrit', u.created_at)
       FROM users u WHERE (v_tous OR 'compte' = ANY(p_types)) AND u.charte_signee_le < v_avant
        AND u.charte_signee_le > u.created_at + interval '1 day'
      ORDER BY u.charte_signee_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'lieu', 'ajout', p.created_at, p.author_id, p.id,
            jsonb_build_object('verifie', p.verified_at IS NOT NULL, 'masque', p.masked)
       FROM places p WHERE (v_tous OR 'lieu' = ANY(p_types)) AND p.created_at < v_avant
      ORDER BY p.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'lieu', 'modification', v.cree_le, v.auteur, v.place_id, '{}'::jsonb
       FROM versions_lieu v WHERE (v_tous OR 'lieu' = ANY(p_types)) AND v.cree_le < v_avant
      ORDER BY v.cree_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'visite', 'sur_place', d.discovered_at, d.user_id, d.place_id,
            jsonb_build_object('premiere', NOT EXISTS (
              SELECT 1 FROM places_discovered d2
               WHERE d2.place_id = d.place_id AND d2.method = 'gps' AND d2.discovered_at < d.discovered_at))
       FROM places_discovered d WHERE (v_tous OR 'visite' = ANY(p_types)) AND d.method = 'gps' AND d.discovered_at < v_avant
      ORDER BY d.discovered_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'enigme', CASE WHEN r.correct THEN 'percee' ELSE 'manquee' END, r.responded_at, r.user_id, NULL,
            jsonb_build_object('enigme', r.enigma_id, 'culture', e.theme,
              'essai', (SELECT count(*) FROM enigma_responses r2
                         WHERE r2.user_id = r.user_id AND r2.enigma_id = r.enigma_id AND r2.responded_at <= r.responded_at)))
       FROM enigma_responses r LEFT JOIN enigmas e ON e.id = r.enigma_id
      WHERE (v_tous OR 'enigme' = ANY(p_types)) AND r.responded_at < v_avant
      ORDER BY r.responded_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'boutique', 'fragment', f.unlocked_at, f.user_id, NULL,
            jsonb_build_object('fragment', t.name, 'source', f.source)
       FROM user_fragments f LEFT JOIN title_fragments t ON t.id = f.fragment_id
      WHERE (v_tous OR 'boutique' = ANY(p_types)) AND f.unlocked_at < v_avant
      ORDER BY f.unlocked_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'photo', 'contribution', s.created_at, s.user_id, NULL,
            jsonb_build_object('nom', s.submitter_name, 'produit', s.product_worn, 'note', s.rating_products, 'statut', s.status)
       FROM hub_photo_submissions s WHERE (v_tous OR 'photo' = ANY(p_types)) AND s.created_at < v_avant
      ORDER BY s.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'message', 'canal', m.created_at, m.user_id, NULL, jsonb_build_object('canal', m.channel)
       FROM chat_messages m WHERE (v_tous OR 'message' = ANY(p_types)) AND m.created_at < v_avant AND m.retire_le IS NULL
      ORDER BY m.created_at DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'moderation', 'signalement_lieu', s.cree_le, s.user_id, s.place_id, jsonb_build_object('motif', s.raison)
       FROM signalements_lieu s WHERE (v_tous OR 'moderation' = ANY(p_types)) AND s.cree_le < v_avant
      ORDER BY s.cree_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'moderation', 'signalement_enigme', s.cree_le, s.user_id, NULL,
            jsonb_build_object('motif', s.raison, 'enigme', s.enigma_id)
       FROM signalements_enigme s WHERE (v_tous OR 'moderation' = ANY(p_types)) AND s.cree_le < v_avant
      ORDER BY s.cree_le DESC LIMIT v_limite)
    UNION ALL
    (SELECT 'notification', n.type, date_trunc('hour', n.created_at), NULL, NULL,
            jsonb_build_object('envoyees', count(*), 'lues', count(*) FILTER (WHERE n.read)))
       FROM notifications n WHERE (v_tous OR 'notification' = ANY(p_types)) AND n.created_at < v_avant
      GROUP BY n.type, date_trunc('hour', n.created_at)
      ORDER BY date_trunc('hour', n.created_at) DESC LIMIT v_limite)
  ),
  derniers AS (
    SELECT * FROM evenements WHERE quand IS NOT NULL ORDER BY quand DESC LIMIT v_limite
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'type', e.type, 'sorte', e.sorte, 'quand', e.quand,
           'qui', CASE WHEN e.qui IS NULL THEN NULL ELSE jsonb_build_object(
             'id', e.qui,
             'nom', COALESCE(u.display_name, u.first_name, 'Un Voyageur'),
             'avatar', u.avatar_url) END,
           'lieu', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
             'id', p.id, 'nom', p.title, 'departement', p.departement) END,
           'donnees', e.donnees) ORDER BY e.quand DESC), '[]'::jsonb)
    INTO v_resultat
    FROM derniers e
    LEFT JOIN users u ON u.id = e.qui
    LEFT JOIN places p ON p.id = e.lieu;

  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.fil_du_hub(text[], timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fil_du_hub(text[], timestamptz, integer) TO authenticated;
```

Note de lecture : `users.id` et `places.id` sont des `text` (`users.id::text = auth.uid()::text` dans `_is_admin`) ; `places_discovered.place_id`, `versions_lieu.place_id` et `signalements_lieu.place_id` sont typés `string` dans `database.types.ts`. Si `db push` refuse une jointure pour un type (uuid contre text), caster la colonne de la table source en `::text` dans la branche concernée, rien d'autre.

- [ ] **Step 3: Appliquer, vérifier la durée et les droits en prod**

```bash
npx supabase db push --dry-run --linked
npx supabase db push --linked
npx supabase db query --linked "select has_function_privilege('anon','public.fil_du_hub(text[],timestamptz,integer)','execute') as anon"
npx supabase db query --linked "explain analyze select public.fil_du_hub(null, null, 30)"
```

Expected : `anon = false` ; le `explain analyze` est refusé par `_refus` (la requête n'a pas de session admin) : la porte tient. La durée se mesure au Step 7 dans le navigateur (onglet Réseau, `fil_du_hub` < 800 ms). Si elle dépasse, ajouter l'index de date de la branche lente (`users.created_at` est la candidate ; les autres tables sont petites ou indexées) dans une migration 508.

Run: `pnpm --filter hub-v2 gen:types`
Expected : `fil_du_hub` dans `database.types.ts`.

- [ ] **Step 4: Écrire le test de la phrase (il échoue)**

`src/features/accueil/lib/phraseDuFil.test.ts` :

```ts
import type { Activite } from '../api/fil'
import { phraseDuFil } from './phraseDuFil'

const luna = { id: 'u1', nom: 'Luna', avatar: null }
const dolmen = { id: 'p1', nom: 'Dolmen de la Pierre Levée', departement: 'Aude' }
const base = { quand: '2026-10-14T09:02:00Z', qui: luna, lieu: null, donnees: {} }

test('un lieu ajouté, pas encore vérifié', () => {
  const a: Activite = { ...base, type: 'lieu', sorte: 'ajout', lieu: dolmen, donnees: { verifie: false, masque: false } }
  expect(phraseDuFil(a)).toEqual({ titre: 'Luna a ajouté « Dolmen de la Pierre Levée »', detail: 'En attente de modération' })
})

test('une inscription par flyer, cliente validée', () => {
  const a: Activite = { ...base, type: 'compte', sorte: 'inscription', donnees: { provenance: 'flyer', client: true } }
  expect(phraseDuFil(a)).toEqual({ titre: 'Luna s’est inscrit', detail: 'Arrivé par un flyer · client validé' })
})

test('une énigme percée au deuxième essai', () => {
  const a: Activite = { ...base, type: 'enigme', sorte: 'percee', donnees: { enigme: 242, culture: 'Celte', essai: 2 } }
  expect(phraseDuFil(a)).toEqual({ titre: 'Luna a percé l’énigme n° 242', detail: 'Culture Celte · juste au 2e essai' })
})

test('un compte supprimé : « Un Voyageur », jamais de plantage', () => {
  const a: Activite = { ...base, type: 'visite', sorte: 'sur_place', qui: null, lieu: dolmen, donnees: { premiere: true } }
  expect(phraseDuFil(a).titre).toBe('Un Voyageur a posé sa marque à « Dolmen de la Pierre Levée »')
})

test('un lieu disparu : la phrase tient sans le lieu', () => {
  const a: Activite = { ...base, type: 'lieu', sorte: 'modification', lieu: null, donnees: {} }
  expect(phraseDuFil(a).titre).toBe('Luna a modifié un lieu')
})

test('une notification regroupée', () => {
  const a: Activite = { ...base, type: 'notification', sorte: 'daily_enigma', qui: null, donnees: { envoyees: 412, lues: 61 } }
  expect(phraseDuFil(a)).toEqual({ titre: 'Notification « daily_enigma » envoyée', detail: '412 destinataires · 61 l’ont lue' })
})
```

(La base ne connaît pas le genre : les accords restent au masculin.)

Run: `pnpm --filter hub-v2 exec vitest run src/features/accueil/lib`
Expected: FAIL (modules introuvables).

- [ ] **Step 5: L'API et la phrase**

`src/features/accueil/api/fil.ts` :

```ts
/**
 * QUOI     — lit le fil d'activité (fil_du_hub, mig 507), page par page.
 * POURQUOI — la page suivante commence avant la dernière ligne reçue (p_avant).
 */
import { supabase } from '@/shared/supabase/client'

export type TypeActivite = 'compte' | 'lieu' | 'visite' | 'enigme' | 'boutique' | 'photo' | 'message' | 'moderation' | 'notification'

export type Activite = {
  type: TypeActivite
  sorte: string
  quand: string
  qui: { id: string; nom: string; avatar: string | null } | null
  lieu: { id: string; nom: string; departement: string | null } | null
  donnees: Record<string, string | number | boolean | null>
}

export const PAGE = 30

export async function lireFil(types: TypeActivite[], avant: string | null): Promise<Activite[]> {
  const { data, error } = await supabase.rpc('fil_du_hub', { p_types: types, p_avant: avant ?? undefined, p_limite: PAGE })
  if (error) throw error
  return data as Activite[]
}
```

(`p_avant ?? undefined` : le générateur type `p_avant` comme `string` ; `null` côté base veut dire « maintenant ». Si le type généré accepte `null`, passer `avant` tel quel.)

`src/features/accueil/lib/phraseDuFil.ts` :

```ts
/**
 * QUOI     — la phrase d'une ligne du fil : un titre (qui, quoi) et un détail réservé à l'équipe.
 * POURQUOI — fonction pure : chaque cas se teste seul ; la base ne rend que des faits.
 * ATTENTION — un compte supprimé s'appelle « Un Voyageur » ; un lieu disparu se dit « un lieu ».
 *            La base ne connaît pas le genre : les accords restent au masculin.
 */
import type { Activite } from '../api/fil'

const PROVENANCES: Record<string, string> = {
  app: 'Inscrit dans l’appli', shopify: 'Venu de la boutique', stand: 'Inscrit au stand', flyer: 'Arrivé par un flyer',
}

function texte(v: string | number | boolean | null | undefined): string {
  return v === null || v === undefined ? '' : String(v)
}

export function phraseDuFil(a: Activite): { titre: string; detail: string } {
  const qui = a.qui?.nom ?? 'Un Voyageur'
  const lieu = a.lieu ? `« ${a.lieu.nom} »` : 'un lieu'
  const d = a.donnees

  switch (a.type) {
    case 'compte':
      if (a.sorte === 'reactivation') return { titre: `${qui} a réactivé son ancien compte`, detail: `Inscrit le ${new Date(texte(d.inscrit)).toLocaleDateString('fr-FR')}` }
      return {
        titre: `${qui} s’est inscrit`,
        detail: [PROVENANCES[texte(d.provenance)] ?? 'Provenance inconnue', d.client ? 'client validé' : ''].filter(Boolean).join(' · '),
      }
    case 'lieu':
      if (a.sorte === 'modification') return { titre: `${qui} a modifié ${lieu}`, detail: 'Nouvelle version de la fiche' }
      return { titre: `${qui} a ajouté ${lieu}`, detail: d.verifie ? 'Vérifié' : 'En attente de modération' }
    case 'visite':
      return { titre: `${qui} a posé sa marque à ${lieu}`, detail: d.premiere ? 'Premier passage sur place à ce lieu' : 'Sur place' }
    case 'enigme': {
      const culture = d.culture ? `Culture ${texte(d.culture)} · ` : ''
      const essai = Number(d.essai)
      if (a.sorte === 'percee') return { titre: `${qui} a percé l’énigme n° ${texte(d.enigme)}`, detail: `${culture}juste au ${essai === 1 ? '1er' : `${String(essai)}e`} essai` }
      return { titre: `${qui} a manqué l’énigme n° ${texte(d.enigme)}`, detail: `${culture}${String(essai)}e essai` }
    }
    case 'boutique':
      return { titre: `${qui} a débloqué le Fragment ${texte(d.fragment) || 'inconnu'}`, detail: d.source === 'shopify' ? 'Par une commande Shopify' : 'Associé à la main' }
    case 'photo':
      return { titre: `${texte(d.nom) || qui} a envoyé une contribution`, detail: [texte(d.produit), d.note ? `${texte(d.note)}/5` : '', d.statut === 'pending' ? 'à valider' : ''].filter(Boolean).join(' · ') }
    case 'message':
      return { titre: `${qui} a écrit dans un canal`, detail: `Canal ${texte(d.canal)}` }
    case 'moderation':
      return { titre: a.sorte === 'signalement_lieu' ? `${qui} a signalé ${lieu}` : `${qui} a signalé l’énigme n° ${texte(d.enigme)}`, detail: `Motif : ${texte(d.motif)}` }
    case 'notification':
      return { titre: `Notification « ${a.sorte} » envoyée`, detail: `${texte(d.envoyees)} destinataires · ${texte(d.lues)} l’ont lue` }
  }
}
```

Run: `pnpm --filter hub-v2 exec vitest run src/features/accueil/lib`
Expected: PASS.

- [ ] **Step 6: Le hook de pages, son test, l'écran du fil**

`src/features/accueil/hooks/useFil.test.tsx` :

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import * as api from '../api/fil'
import { useFil } from './useFil'

function ligne(i: number): api.Activite {
  return { type: 'lieu', sorte: 'ajout', quand: new Date(Date.UTC(2026, 9, 14, 12, 0, 0) - i * 60_000).toISOString(), qui: null, lieu: null, donnees: {} }
}

const enveloppe = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

test('« Voir tout le fil » disparaît quand une page revient incomplète', async () => {
  const lire = vi.spyOn(api, 'lireFil')
  lire.mockResolvedValueOnce(Array.from({ length: api.PAGE }, (_, i) => ligne(i)))
  lire.mockResolvedValueOnce([ligne(100)])
  const { result } = renderHook(() => useFil([]), { wrapper: enveloppe })
  await waitFor(() => expect(result.current.activites).toHaveLength(api.PAGE))
  expect(result.current.aDAutres).toBe(true)
  act(() => result.current.voirPlus())
  await waitFor(() => expect(result.current.activites).toHaveLength(api.PAGE + 1))
  expect(result.current.aDAutres).toBe(false)
  expect(lire).toHaveBeenLastCalledWith([], ligne(api.PAGE - 1).quand)
})
```

`src/features/accueil/hooks/useFil.ts` :

```ts
/**
 * QUOI     — le fil, page par page, filtré par types ; rafraîchi toutes les minutes.
 * POURQUOI — useInfiniteQuery de TanStack : la page suivante part de la dernière ligne reçue,
 *            et s'arrête quand une page revient incomplète (fin de l'historique).
 */
import { useInfiniteQuery } from '@tanstack/react-query'
import { lireFil, PAGE, type Activite, type TypeActivite } from '../api/fil'

export function useFil(types: TypeActivite[]) {
  const requete = useInfiniteQuery({
    queryKey: ['hub-fil', types],
    queryFn: ({ pageParam }) => lireFil(types, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (derniere: Activite[]) => (derniere.length < PAGE ? undefined : derniere[derniere.length - 1]?.quand),
    refetchInterval: 60_000,
  })
  return {
    activites: requete.data?.pages.flat() ?? [],
    voirPlus: () => void requete.fetchNextPage(),
    aDAutres: requete.hasNextPage,
    isError: requete.isError,
  }
}
```

`src/features/accueil/components/FilDActivite.tsx` :

```tsx
/**
 * QUOI     — « Le fil d'activité » (maquette 592:852) : filtres par type, une ligne par geste
 *            (heure, type, portrait, qui et quoi, détail réservé à l'équipe, département), et
 *            « Voir tout le fil ».
 * POURQUOI — le filtre est dans l'adresse (?fil=lieu) : tout état navigable est une URL.
 */
import { useSearchParams } from 'react-router'
import sectionChemins from '@/assets/ui/section-chemins.svg'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { TypeActivite } from '../api/fil'
import { useFil } from '../hooks/useFil'
import { phraseDuFil } from '../lib/phraseDuFil'
import styles from './FilDActivite.module.css'

type Filtre = 'tout' | TypeActivite
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'tout', libelle: 'Tout' }, { valeur: 'compte', libelle: 'Comptes' }, { valeur: 'lieu', libelle: 'Lieux' },
  { valeur: 'visite', libelle: 'Visites' }, { valeur: 'enigme', libelle: 'Énigmes' }, { valeur: 'boutique', libelle: 'Boutique' },
  { valeur: 'photo', libelle: 'Photos' }, { valeur: 'message', libelle: 'Messages' }, { valeur: 'moderation', libelle: 'Modération' },
  { valeur: 'notification', libelle: 'Notifications' },
]
const LIBELLES: Record<TypeActivite, string> = {
  compte: 'Compte', lieu: 'Lieu', visite: 'Visite', enigme: 'Énigme', boutique: 'Boutique',
  photo: 'Photo', message: 'Message', moderation: 'Modération', notification: 'Notification',
}
const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function FilDActivite() {
  const [params, setParams] = useSearchParams()
  const brut = params.get('fil')
  const filtre: Filtre = FILTRES.find((f) => f.valeur === brut)?.valeur ?? 'tout'
  const { activites, voirPlus, aDAutres, isError } = useFil(filtre === 'tout' ? [] : [filtre])

  function choisir(f: Filtre) {
    const suivants = new URLSearchParams(params)
    if (f === 'tout') suivants.delete('fil')
    else suivants.set('fil', f)
    setParams(suivants)
  }

  return (
    <section className={styles.fil}>
      <TitreDeSection titre="Le fil d’activité" icone={sectionChemins} aDroite={<span className={styles.direct}>En direct</span>} />
      <div className={styles.filtres}>
        <ChoixSegmente nom="Types" options={FILTRES} choisi={filtre} onChoix={choisir} />
      </div>
      {isError && <p className={styles.vide}>Le fil ne répond pas.</p>}
      <Bloc>
        {activites.map((a) => {
          const { titre, detail } = phraseDuFil(a)
          return (
            <div key={`${a.type}-${a.sorte}-${a.quand}-${a.qui?.id ?? ''}-${a.lieu?.id ?? ''}`} className={styles.ligne}>
              <span className={styles.heure}>{heure.format(new Date(a.quand))}</span>
              <span className={styles.type}><Balise texte={LIBELLES[a.type]} teinte={a.type} /></span>
              {a.qui?.avatar ? <img className={styles.portrait} src={a.qui.avatar} alt="" loading="lazy" /> : <span className={styles.portrait} />}
              <span className={styles.texte}>
                <span className={styles.titre}>{titre}</span>
                <span className={styles.detail}>{detail}</span>
              </span>
              <span className={styles.ou}>{a.lieu?.departement ?? ''}</span>
            </div>
          )
        })}
        {aDAutres && (
          <button className={styles.plus} type="button" onClick={voirPlus}>
            Voir tout le fil →
          </button>
        )}
      </Bloc>
    </section>
  )
}
```

`src/features/accueil/components/FilDActivite.module.css` :

```css
/*
 * QUOI     — le fil : une grille par ligne sur PC (heure, type, portrait, texte, département),
 *            une pile compacte au téléphone (type et heure, puis le texte).
 */
.fil {
  display: grid;
  gap: var(--space-4);
}

.direct {
  font-size: var(--flux-size);
  color: var(--color-texte-doux);
}

.direct::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: var(--space-2);
  border-radius: var(--radius-rond);
  background: var(--color-vert);
}

.filtres {
  overflow-x: auto;
  scrollbar-width: none;
}

.ligne {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  grid-template-areas:
    'type heure heure'
    'texte texte texte';
  gap: var(--space-1) var(--space-2);
  padding: var(--space-3) var(--space-4);
  animation: apparait var(--duree-douce) var(--courbe-douce);
}

.heure {
  grid-area: heure;
  font-family: var(--font-condensee);
  font-weight: var(--weight-gras);
  font-size: var(--meta-size);
  color: var(--color-texte-pale);
}

.type {
  grid-area: type;
}

.portrait,
.ou {
  display: none;
}

.texte {
  grid-area: texte;
  display: grid;
}

.titre {
  font-weight: var(--weight-semi);
  color: var(--color-encre);
}

.detail {
  font-size: var(--flux-size);
  color: var(--color-texte-doux);
}

.plus {
  padding: var(--space-3);
  border: 0;
  background: none;
  font-weight: var(--weight-semi);
  font-size: var(--flux-size);
  color: var(--color-accent);
}

.vide {
  margin: 0;
  color: var(--color-texte-doux);
}

@container app (width >= 900px) {
  .ligne {
    grid-template-columns: 40px 104px 28px minmax(0, 1fr) 170px;
    grid-template-areas: 'heure type portrait texte ou';
    align-items: center;
    gap: var(--space-4);
  }

  .portrait {
    display: block;
    grid-area: portrait;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-rond);
    background: var(--color-vignette);
    object-fit: cover;
  }

  .ou {
    display: block;
    grid-area: ou;
    text-align: right;
    font-size: var(--flux-size);
    color: var(--color-texte-pale);
  }
}

@keyframes apparait {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ligne {
    animation: none;
  }
}
```

`src/features/accueil/components/Ouverture.tsx` : ajouter `<FilDActivite />` après la `div.paire` (dans le fragment `data && (…)` : non, **en dehors**, pour que le fil se charge même si l'ouverture tarde), et l'import `import { FilDActivite } from './FilDActivite'`.

Run: `pnpm --filter hub-v2 test && pnpm --filter hub-v2 lint`
Expected: PASS.

- [ ] **Step 7: Essayer dans le navigateur contre la prod**

Run: `pnpm --filter hub-v2 dev`, se connecter en admin.
Expected : les vraies lignes, du plus récent au plus ancien ; chaque filtre change l'adresse (`?fil=lieu`) et la liste ; « Voir tout le fil » ajoute 30 lignes puis disparaît au bout ; onglet Réseau : `fil_du_hub` répond en moins de 800 ms ; à 390 px, lignes compactes et filtres qui défilent de côté. Comparer à la maquette 592:852 (dans 587:761) et 597:1365. Console sans erreur.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/507_fil_du_hub.sql apps/hub-v2
git commit -m "feat(hub-v2): le fil d'activité, réservé à l'équipe"
```

---

### Task 8: Préparation en ligne et règles du Hub

**Files:**
- Modify: `.claude/rules/hub.md` (la section « Tout écran du Hub se conçoit » décrit encore la DA du Hub V1)
- Modify: `docs/tech-backlog.md` (le reste à faire hors plan)

- [ ] **Step 1: Tout passe, dans tout le dépôt**

Run: `pnpm --filter hub-v2 test && pnpm --filter hub-v2 lint && pnpm --filter hub-v2 build && pnpm --filter web-v2 test && pnpm --filter web-v2 lint && pnpm --filter web-v2 build`
Expected: tout passe.

- [ ] **Step 2: Créer le site de préparation et déployer** (lire `.claude/rules/deploiement.md` avant)

```bash
cd apps/hub-v2
netlify sites:create --name rdc-hub-v2
netlify link --name rdc-hub-v2
netlify env:import ../../.env
netlify deploy --prod --dir "$PWD/dist" --no-build
```

Expected : l'adresse `https://rdc-hub-v2.netlify.app`. Ajouter cette adresse aux « Redirect URLs » de l'authentification Supabase seulement si l'e-mail du code contient un lien (le Hub utilise le code à 6 chiffres : rien à ajouter). `hub.runesdechene.com` ne bouge pas.

- [ ] **Step 3: Vérifier en ligne**

Ouvrir `https://rdc-hub-v2.netlify.app` (recharger deux fois), se connecter, parcourir l'ouverture, le fil, trois liens du menu, à 1440 et 390 px. Console sans erreur.

- [ ] **Step 4: Les règles du Hub disent la vérité**

Dans `.claude/rules/hub.md`, remplacer le paragraphe « **How to apply :** le Hub a DÉJÀ un système de tokens dans `apps/hub/src/index.css` … » par :

```markdown
**How to apply :** le Hub V2 (`apps/hub-v2`) n'a pas de DA à lui : il prend celle de l'appli,
dans `packages/da` (`tokens.css`), et les briques de `apps/hub-v2/src/shared/ui/`. Un écran se
compare à sa maquette Figma (section « Hub V2 — maquette (14/10) ») à 1440 et 390 px avant d'être
dit fini. L'ancien `apps/hub` (parchemin `#f5edd8`, Cinzel) ne reçoit plus d'écran neuf : il
disparaît à la bascule (plan 5).
```

Dans `docs/tech-backlog.md`, ajouter :

```markdown
- **Hub V2 — santé** : Synchro Shopify et fiches publiques dans « La santé » (plan 4, avec les
  fonctions Netlify) ; la reconstruction nocturne des fiches n'écrit son résultat nulle part de
  lisible (spec Hub V2 §13.4).
- **Hub V2 — image de fond** : une grande image de parchemin (≥ 2 880 px) pour le PC (spec §13.5).
```

- [ ] **Step 5: Commit et push**

```bash
git add .claude/rules/hub.md docs/tech-backlog.md
git commit -m "docs(hub): les règles du Hub V2 ; le reste à faire du plan 1"
git push
```

---

## Self-Review (fait à l'écriture)

- **Couverture de la spec** : §4 architecture → Tasks 2, 3 ; §5 coquille → Task 5 ; §6 DA → Tasks 2, 5 (jetons ajoutés : `--color-bloc`, `--color-sommeil`, `--color-sommeil-texte`, `--color-moderation`) ; §7 ouverture → Tasks 6, 7 ; §8 définitions → migration 506 (Task 6) ; §9 attente et santé → Task 6 (Synchro Shopify et fiches publiques reportées au plan 4, notées au backlog) ; §10 fil → Task 7 ; §11 écrans → plans 2 à 5 (routes « bientôt » d'ici là) ; §12 étapes 1-3 → ce plan ; §13.1 → Task 1 ; §13.4-5 → backlog. Balises de comptes (§8) : utilisées au plan 2 (Comptes) ; les teintes existent dès Task 5.
- **Noms** : `hub_est_admin`, `hub_ouverture`, `_hub_pouls`, `fil_du_hub` ; `decideEntree`, `useEntree`, `PorteDEntree`, `ecart`, `depuis`, `phraseDuFil`, `useFil`, `useOuverture`, `useAttente` — identiques dans toutes les tâches.
- **Écarts de maquette assumés** : la tuile « Actifs » sans écart ; « Bonjour Uriel » en dur ; la santé sans Synchro Shopify ni version d'Explore jusqu'au plan 4.
