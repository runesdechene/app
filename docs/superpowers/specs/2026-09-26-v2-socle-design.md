# App V2 — le socle (design)

> Statut : **validé en conversation le 26/09/2026**, à relire par Uriel.
> Référence fonctionnelle de la V2 (écrans, zones, ce qui tombe) :
> `2026-08-18-app-v2-design.md`. Ce document-ci ne décrit **que** la fondation technique
> sur laquelle chaque zone sera construite ensuite.

## 1. Le but

Repartir sur un front **pur** : écrit de zéro, sans une ligne importée de la V1, contre le
même Supabase. La V2 vit à côté de la V1, invisible pour les joueurs, jusqu'à ce qu'elle la
remplace. Chaque fichier doit pouvoir être ouvert et compris par un codeur moyen.

**Le socle est fini quand** :

- `app.runesdechene.com/v2/` s'ouvre pour Uriel, et renvoie tout autre visiteur vers la V1 ;
- la barre à cinq onglets navigue entre cinq écrans vides qui gardent leur état ;
- les jetons de la DA sont posés ;
- le client Supabase et les types générés sont branchés ;
- lint strict, tests, typecheck et build passent en CI ;
- les conventions de documentation, le registre des décisions et le registre de purge existent.

**Hors socle** : la connexion (elle arrive avec la zone Compte) et tout écran fonctionnel.
Chaque zone — Compte, Accueil, Carte, Codex, Campement — aura son propre cycle
spec → plan → code, dans cet ordre.

## 2. Où vit la V2

Une app neuve, **`apps/web-v2`**, servie sous **`app.runesdechene.com/v2/`** par une
redirection Netlify vers un second site — le même mécanisme que `/lieu/*` vers `seo-pages`.

Même origine que la V1, donc **même session Supabase** : on passe de l'une à l'autre sans se
reconnecter. Le jour de la bascule, on inverse les deux et on supprime `apps/explore-web`.

*Écartés* :
- **un dossier `src/v2/` dans explore-web** (méthode Fellowship) — la V2 hériterait des
  dépendances, de la config et de la tentation d'importer la V1 ; jamais pure ;
- **un sous-domaine `v2.runesdechene.com`** — autre origine, donc reconnexion obligatoire à
  chaque bascule, pour Uriel comme pour ses testeurs.

## 3. La pile

| Couche | Choix | Raison |
|---|---|---|
| Base | React 19 + Vite + TypeScript ultra-strict | La V1 tourne déjà en React 19 sans le déclarer ; la V2 le déclare partout. |
| Données serveur | TanStack Query | Cache, relances, chargement et erreurs gérés en un seul endroit. |
| État d'interface | Zustand, seulement si React ne suffit pas | Jamais pour stocker des données serveur. |
| Types de la base | Générés par `supabase gen types` | Un nom de colonne ou une signature de RPC est vérifié par le compilateur. |
| Navigation | React Router 7 | Déjà connu du dépôt. |
| Carte | MapLibre | Le bon outil, gardé. |
| Style | CSS Modules + jetons CSS | Un `.module.css` à côté de chaque composant, lisible sans rien apprendre. |
| PWA | vite-plugin-pwa, service worker minimal | |
| Qualité | ESLint `strict-type-checked` + Prettier | `any`, `as unknown as`, `console.log` bloqués par l'outil. |
| Tests | Vitest + Testing Library ; Playwright dès la zone Compte | |
| CI | GitHub Action sur `apps/web-v2/**` | typecheck, lint, tests, build. |

Options TypeScript en plus de `strict` : `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.

Les versions exactes sont relevées dans la documentation officielle (Context7) au moment
d'écrire le plan, jamais de mémoire.

*Écarté* : **Tailwind** (utilisé par la V1). Le style dans le balisage se lit mal pour un
codeur moyen ; un fichier CSS séparé se lit comme du CSS.

## 4. L'organisation du code

On range **par zone de l'app**, pas par type technique.

```
apps/web-v2/
  src/
    app/            démarrage : fournisseurs, routeur, barre d'onglets, garde d'accès
    features/       une zone de la spec = un dossier
      compte/
        api/          les SEULS fichiers qui parlent à Supabase pour cette zone
        components/   l'affichage (.tsx + .module.css côte à côte)
        hooks/        la logique avec état React
        README.md     ce que fait la zone, ses écrans, les RPC utilisées
      accueil/  carte/  codex/  registre/  campement/
    shared/
      supabase/     le client unique + les types générés (jamais édités à la main)
      ui/           les briques génériques
      lib/          les fonctions pures, sans React
      styles/       jetons de la DA (tokens.css), remise à zéro
```

**Trois règles, vérifiées par ESLint** (`no-restricted-imports`) plutôt que par la discipline :

1. **Un composant ne parle jamais à Supabase.** Il appelle un hook, qui passe par `api/`.
2. **Une zone n'importe jamais une autre zone.** Ce qui se partage monte dans `shared/`.
3. **Rien n'importe la V1.** Aucun chemin vers `apps/explore-web`.

Et une règle de taille : **au-delà de 400 lignes, on découpe.**

## 5. La documentation

Trois étages, du plus fin au plus large.

**En tête de chaque fichier** :

```ts
/**
 * QUOI     — ce que fait ce fichier, en une ou deux phrases.
 * POURQUOI — la raison d'exister, ou le choix qui n'est pas évident.
 * ATTENTION — (si besoin) le piège, avec son renvoi (.claude/rules/…, docs/db/…).
 */
```

Pas de « utilisé par » : ça devient faux au premier déplacement, et l'éditeur le trouve seul.
Dans le corps du code, un commentaire explique **pourquoi**, jamais ce que la ligne dit déjà.

**Un `README.md` par dossier** : ce qu'on y range, ce qu'on n'y range pas, et pourquoi.

**`docs/v2/decisions/`** — une page par choix structurant (`001-app-separee.md`,
`002-tanstack-query.md`…) : le contexte, la décision, les options écartées et leur raison.
Les décisions des sections 2 à 4 y entrent dès le socle.

## 6. L'accès et la bascule

**Côté back — un seul ajout** (migration 344) :
- colonne `users.v2_access boolean NOT NULL DEFAULT false` ;
- RPC `has_v2_access()` : vrai si `users.role = 'admin'` ou `v2_access` vrai pour l'appelant ;
- dans le Hub, fiche joueur : une case « Accès V2 », avec la pastille « V2 compatible ».

Ce verrou règle **l'affichage**, pas la sécurité : la V2 passe par les mêmes RLS que la V1.

**Côté V1 — trois retouches, rien d'autre** :
1. `netlify.toml` : `/v2/*` → site `rdc-web-v2`, statut 200, sur le modèle de `/lieu/*` ;
2. `sw.ts` : `/v2` ajouté à la liste d'exclusion, sinon le service worker V1 sert la V1 ;
3. un `?v=2` sur n'importe quelle page renvoie vers `/v2/` si `has_v2_access()` dit oui ; un
   lien « Essayer la V2 » dans le menu du compte des personnes autorisées.

**Côté V2** :
- construite avec `base: '/v2/'` ; service worker de portée `/v2/` — le navigateur donne la
  main au service worker de portée la plus précise ;
- **la garde d'accès**, au démarrage : pas de session → retour à la V1 pour se connecter ;
  session sans accès → retour à la V1, en silence ;
- un lien « Revenir à la V1 » visible en permanence pendant la construction.

La décision de la garde est une **fonction pure** (session, accès → destination), testée
seule. Aucun contournement « mode test » dans le code livré.

## 7. Le déploiement

Un nouveau site Netlify, **`rdc-web-v2`**, déployé à la main comme les autres, avec son
`netlify.toml` dans `apps/web-v2/`. Il s'ajoute au tableau des sites de
`.claude/rules/deploiement.md`.

Ordre au premier déploiement : le site V2 d'abord, puis la redirection et l'exclusion du
service worker côté V1. Dans l'autre sens, `/v2/` pointerait un moment vers un site absent.

## 8. Les jetons de la DA

Relevés dans la spec V2, §5 « DA — source de vérité » — la boutique, pas la V1 :
parchemin `#f4eee1`, surface `#f6eddd`, titres `#403434`, texte `#594848`, accent rouge sang
`#833434`, rose poudré `#ebd2d2`, kaki forêt `#46493c`, sable `#e7dcca`, ocre doré `#8A6F3A` ;
**Bebas Neue** pour les titres, **Cabin** pour le corps.

Ils vivent dans `shared/styles/tokens.css`, et nulle part ailleurs : aucune couleur en dur
dans un composant.

## 9. Le registre de purge du back

`docs/v2/purge-back.md` — tout ce que le back devra perdre ou corriger une fois la V2 lancée.

**Une ligne par objet** (table, RPC, colonne, policy, bucket, cron) : le **constat**,
l'**action** (supprimer, réécrire, restreindre), le **moment** (« après bascule » si la V1 en
dépend, « dès maintenant » si c'est sans risque), et **d'où vient le constat**.

**Trois sections** :
1. **À supprimer après bascule** — pré-remplie avec les systèmes que la spec V2 abandonne :
   Coupe des Héritages, la Cour, Compagnies, Gloire/XP/niveaux, Énigmes, Expéditions
   joueur-joueur, Quêtes du jour, et leurs crons ;
2. **À corriger** — pré-remplie avec le `GRANT ALL` d'`anon` sur `chat_messages` et les
   colonnes `faction_*` des messages (spec V2, §10) ;
3. **Ajouté pour la V2** — `v2_access`, `has_v2_access()`, et chaque ajout à venir ; ainsi
   que l'URL `/v2/` à autoriser dans Supabase Auth quand la zone Compte aura sa connexion.

**Tenue** : tout commit V2 qui croise un objet douteux ajoute sa ligne dans le même commit.
La règle est écrite dans `.claude/rules/`.

**Garde-fou** : le registre liste des candidats, pas des ordres. Chaque DROP en prod est
revérifié à la main au moment de le faire.

## 10. Ce que le socle corrige ailleurs

- **Spec V2 (`2026-08-18`)** : §2 « fork parallèle de explore-web, même stack » est remplacé
  par un renvoi vers ce document ; l'en-tête « restent à concevoir : Carte, Codex,
  Campement » est corrigé — ces sections sont validées.
- **`.claude/rules/`** : une règle V2 (organisation, documentation, registre de purge),
  chargée sur `apps/web-v2/**`.
- **`CLAUDE.md` racine** : `apps/web-v2/` ajouté au tableau « Où sont les choses ».
