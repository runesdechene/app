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
- la coquille mobile (barre basse) et desktop (bandeau haut) navigue entre cinq écrans vides
  qui gardent leur état, et le Compte s'ouvre en détail puis se ferme par le retour arrière ;
- la DA est fixée dans `tokens.css`, montrée sur `/v2/da`, et verrouillée par Stylelint ;
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
| Navigation | React Router 8 | Déjà connu du dépôt (la V1 est en 7). |
| Carte | MapLibre | Le bon outil, gardé. |
| Style | CSS Modules + jetons CSS | Un `.module.css` à côté de chaque composant, lisible sans rien apprendre. |
| PWA | vite-plugin-pwa, service worker minimal | |
| Qualité | ESLint `strict-type-checked` + Prettier | `any`, `as unknown as`, `console.log` bloqués par l'outil. |
| Tests | Vitest + Testing Library ; Playwright dès la zone Compte | |
| CI | GitHub Action sur `apps/web-v2/**` | typecheck, lint, tests, build. |

Options TypeScript en plus de `strict` : `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.

Versions relevées sur le registre npm le 27/09/2026 : React 19.3, Vite 8, React Router 8,
TanStack Query 5, Vitest 5, ESLint 10. **TypeScript reste en 6.0** : typescript-eslint
n'accepte pas encore la 7 (`typescript >=4.8.4 <6.1.0`). On monte quand il suit.

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
      accueil/  carte/  messages/  codex/  campement/
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

## 4bis. Les écrans, la navigation et le desktop

**Mobile d'abord, et exemplaire.** Le téléphone est la cible prioritaire ; le desktop est une
**édition** du même produit, proche de l'expérience V1 (carte large, panneau latéral), jamais
une seconde app.

**Tout état navigable est une URL.** Un onglet, une fiche de lieu, le Compte, une feuille qui
compte : chacun a son adresse. Conséquences, toutes voulues :
- **le retour arrière est celui du système** — bouton Android, glissement iOS, flèche du
  navigateur. Aucune pile maison : l'historique du navigateur fait foi ;
- une feuille ou une fiche ouverte **se ferme par le retour**, jamais en quittant l'app ;
- tout écran se **partage par un lien** et survit à un rechargement ;
- ce qui ne mérite pas d'URL (un menu, une confirmation) ne touche pas l'historique.

**Les onglets, selon les conventions mobiles** :
- changer d'onglet **ajoute une entrée** d'historique : le retour ramène à l'onglet précédent ;
- chaque onglet **se souvient de sa dernière adresse** : y revenir rouvre là où on l'a laissé ;
- toucher l'onglet **déjà actif** remonte à sa racine, puis en haut de la page ;
- les cinq écrans racines **restent montés** : leur état et leur position de défilement
  survivent au changement d'onglet ;
- la **position de défilement** est restaurée au retour arrière.

**Une même route, deux mises en page.** Chaque écran déclare un contenu **principal** et,
s'il en a, un **détail** (une fiche, le Compte). La coquille décide de l'endroit où le détail
s'affiche :

| | Mobile (< 1024 px) | Desktop (≥ 1024 px) |
|---|---|---|
| Navigation | barre basse, 5 onglets | les 5 onglets dans le bandeau haut |
| Détail | plein écran, par-dessus, retour pour fermer | panneau latéral, à côté du principal |
| Carte | plein écran | carte large + panneau latéral, comme la V1 |

L'URL est **identique** sur les deux : un lien envoyé depuis un téléphone s'ouvre au bon
endroit sur un ordinateur. La mise en page change à la largeur, jamais au type d'appareil.

**Contraintes mobiles tenues dès le socle** : zones sûres (`env(safe-area-inset-*)`, encoche
et barre système), hauteur d'écran dynamique (`100dvh`, pas `100vh`), cibles tactiles de 44 px
minimum, aucune dépendance au survol.

**La preuve dans le socle** : le Compte (ouvert par l'avatar) est le premier détail. Il n'a pas
encore de contenu, mais il démontre le patron complet : plein écran sur mobile, panneau sur
desktop, fermé par le retour, rouvert par son lien.

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

## 8ter. Une DA fixée — pas d'élément sauvage

*Demandé par Uriel le 27/09/2026 : « une VRAIE DA fixée […] pas d'éléments sauvages ».*

**Une échelle fermée.** `tokens.css` porte toutes les valeurs : couleurs, polices, tailles,
graisses, interlignages, espacements, rayons, ombres. S'y ajoutent des **styles de texte
nommés** — Titre d'écran, Titre de section, Sous-titre, Corps, Légende, Libellé, Bouton. Un écran
choisit un style, jamais une taille.

**Des briques uniques** dans `shared/ui/` : `Text`, `Button` (principal, secondaire, discret),
`IconButton`, `Pastille`, `EmptyState` pour le socle. Toute nouvelle brique naît là.

**Vérifié par l'outil, pas par la discipline** :
- **Stylelint** refuse, dans tout CSS hors `tokens.css`, une couleur écrite en dur (hex, `rgb`,
  nom), une `font-family`, une `font-size`, une `font-weight` ou un `line-height` qui ne soit pas
  une variable ;
- **ESLint** refuse un `style={…}` inline, sauf pour passer une variable CSS (`'--avatar'`).

**La page de référence `/v2/da`** montre chaque couleur, chaque style de texte, chaque brique
dans tous ses états, en mobile et en desktop. Hors des onglets, atteinte par son adresse,
réservée comme toute la V2. **Un test échoue si une brique de `shared/ui/` n'y figure pas.**

**D'où viennent les valeurs** : le Figma n'a aucune variable. Les tailles réellement utilisées
dans les maquettes sont relevées, une échelle est proposée, **Uriel la valide sur `/v2/da`**.
Validée, elle est gravée : une valeur nouvelle passe par `tokens.css` et par la page.

## 8bis. La coquille visuelle et ses ressources

Source : maquette Figma **« Runes de Chêne — App v2 »** (fichier `MKqyVhDPreg06PMEAaDxde`,
écran de référence `51:626`). Le fichier n'a **aucune variable Figma** : les jetons se
relèvent sur les calques et se confrontent au tableau ci-dessus.

Le socle pose la **coquille** commune aux cinq écrans :
- **bandeau haut** : logotype à gauche, avatar à droite ;
- **fond** : parchemin et paysage en filigrane — **fixe par défaut** ; défilant ou fixe se
  règle par une seule propriété CSS, à trancher sur écran réel ;
- **barre basse** : fond sable surmonté d'une lisière de forêt, cinq icônes gravées, libellés
  en Bebas Neue, pastille de notification ;
- **état vide** centré (« … est à venir ») sur chacun des cinq écrans.

**Les ressources sont posées en brut** : exportées telles quelles depuis Figma, Uriel les
refait ensuite. Elles vivent toutes dans `src/assets/ui/`, sous des **noms stables**, avec un
`README.md` qui liste chaque fichier, sa taille attendue et où il s'affiche. Remplacer une
ressource = remplacer un fichier du même nom, sans toucher au code.

**L'onglet « Messages »** (tranché le 27/09/2026) remplace « Registre », peu clair pour les
gens. Un seul nom partout : l'interface, le dossier `features/messages/`, la spec V2.

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
