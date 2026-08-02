# Écran d'intro borne — refonte du wording et de la structure — Design

**Date :** 2026-08-02
**Statut :** Spec validée (Uriel), en attente de plan d'implémentation
**Contexte :** borne démo `demo.runesdechene.com` (mode `VITE_DEMO_MODE=true`),
composant `apps/explore-web/src/components/demo/DemoKioskShell.tsx`

## Problème

Sur le stand, la banderole dit « Portez l'Histoire » et vend des vêtements. Le
passant se tourne vers la borne et tombe sur une application mobile : **le lien
ne se fait pas**. Constat terrain d'Uriel : « souvent les gens voient la borne et
sont perdus de voir une application mobile ».

Deux défauts distincts sur l'écran d'intro actuel :

1. **Le message ne raccroche pas la borne au stand.** Le titre « Une marque. Une
   application. » est une affirmation abstraite : il nomme les deux objets sans
   jamais dire ce que le second apporte. Le seul vrai pont — l'encart « Chaque
   article acheté sur le stand débloque son Fragment d'Histoire » — est relégué
   en note de bas d'écran, et il parle en jargon (« Fragment d'Histoire »,
   « comme un équipement ») à quelqu'un qui découvre la marque.
2. **La dimension communautaire est absente.** L'app doit devenir le point de
   rencontre de la communauté — ses découvertes, ses actions pour réenchanter
   notre époque. L'écran actuel n'en laisse rien transparaître : « pour l'instant,
   on ne le ressent pas ».

S'y ajoutent deux dettes mineures : le CTA est du **texte transparent** posé sur
une photo (`.demo-intro-cta` n'a ni fond ni bordure), donc illisible à deux
mètres ; et le CSS conserve un **bloc mort** (`.demo-intro-top`,
`.demo-intro-mantra`, `.demo-mantra-*`) référençant trois SVG absents de
`public/`.

## Objectif

Deux critères de réussite, dans cet ordre :

1. **Ancrer le lien stand↔app.** Le passant repart en sachant que le vêtement
   qu'il achète ouvre quelque chose de vivant dans l'app — même s'il ne
   télécharge rien.
2. **Déclencher l'essai sur place.** Il touche l'écran et manipule la carte
   lui-même.

Le téléchargement n'est pas un critère : il suit si ces deux-là passent.

## Hors périmètre

- La page `/accueil` de l'app (HomePage) et le popup « Bienvenue, Veilleur » —
  seul l'écran d'intro plein écran change.
- Toute nouvelle RPC ou migration SQL : la refonte réutilise l'existant.
- Le mécanisme de scan du Fragment lui-même : on l'annonce, on ne le construit
  pas.

## Contenu de l'écran

**Bloc 1 — Kicker** (répond à « c'est quoi cet écran ? »)

> L'APPLICATION RUNES DE CHÊNE

Remplace « L'Histoire comme terrain d'aventure » : le kicker doit identifier
l'écran, pas ajouter de la poésie.

**Bloc 2 — Accroche**

> **Une marque sur le dos.**
> **Une communauté dans la poche.**

Retenue après itération sur quatre registres (pont objet→carte, France cachée,
mystère court, mouvement). La symétrie fait trois choses d'un coup : elle
explique le stand (*le dos*), elle explique l'écran (*la poche*), et elle dit que
ce qu'il y a dedans, ce sont **des gens**. Seconde ligne en or (`--color-accent`).

**Bloc 3 — Tagline** (ce que font les gens, pas ce que fait l'app)

> Ils explorent, ils partagent leurs découvertes, ils veillent sur les lieux
> oubliés. Une carte vivante, tenue par ceux qui portent nos pièces.

Rédigée à la 3ᵉ personne : la question tu/vous ne se pose donc que sur le CTA.

**Bloc 4 — Preuve vivante** *(nouveau)*

> **2 847** lieux d'Histoire · **1 203** Compagnons
> 📍 Un Compagnon vient de découvrir **la Chapelle Saint-Éloi** · il y a 2 h

Chiffres et découvertes réels, la découverte affichée tournant toutes les 6 s.
C'est le bloc qui répond au « on ne le ressent pas » : la communauté cesse d'être
affirmée et devient quelque chose qui bouge sous les yeux du passant. Effet de
bord bienvenu : le compteur de lieux est exact et se met à jour seul — plus de
« 3000+ » écrit en dur qui vieillit.

**Bloc 5 — Encart stand** (le pont, remonté en importance)

> Chaque pièce porte un lieu réel, et son histoire t'attend dans l'app.
> **Bientôt, tu la scanneras pour la voir prendre vie.**

Le premier temps est vrai aujourd'hui et répond enfin à « qu'est-ce que j'y
gagne ? » en expliquant ce qu'est un Fragment plutôt qu'en le nommant. Le second
donne l'effet wow sans mentir, parce qu'il est explicitement au futur. La
formulation ne verrouille pas la mécanique (vêtement, étiquette ou QR) — elle
restera vraie quelle que soit l'implémentation retenue du scan.

**Bloc 6 — CTA**

> **[ Touche l'écran, entre dans la carte ]**

Tutoiement, cohérent avec l'app dans laquelle le visiteur entre une seconde plus
tard.

## Structure et rendu

Le fond photo `public/demo-intro.jpg`, l'animation Ken Burns, le voile sombre, la
main animée, le durcissement kiosque et le reset d'inactivité sont **inchangés**.

| Zone | Contenu |
|---|---|
| Haut | Logo + kicker |
| Cœur | Accroche 2 lignes → tagline → bandeau preuve vivante |
| Bas | Encart stand → CTA bouton plein + main animée |

Deux corrections de rendu :

- **CTA en vrai bouton** : pastille pleine or (`#ecc15b`), texte encre foncée,
  ombre portée. C'est le point le plus faible de l'écran actuel.
- **Suppression du CSS mort** : `.demo-intro-top`, `.demo-intro-mantra`,
  `.demo-mantra-item`, `.demo-mantra-icon`, `.demo-mantra-apprend`,
  `.demo-mantra-incarne`, `.demo-mantra-explore`.

## Données — bloc preuve vivante

Aucune SQL nouvelle. Deux RPC anon existantes, déjà utilisées par
`components/landing/LandingActivityFeed.tsx` :

- `get_landing_stats()` → `{ total_places, total_users }`
- `get_landing_activity({ limit_count })` → `[{ place_title, discovered_at }]`

Le bandeau est un composant autonome monté par `DemoKioskShell`, sur le modèle de
`LandingActivityFeed` mais dimensionné pour la borne (typo plus grande, contraste
sur photo sombre). Il ne prend aucune décision : il charge, il affiche, il fait
tourner la découverte courante.

**Contrat d'échec :** si l'une des deux requêtes échoue ou revient vide, le
composant rend `null` et l'écran reste complet et cohérent sans lui. C'est la
règle : le réseau du stand est incertain, l'écran d'intro ne doit jamais dépendre
du réseau pour être présentable.

**Invariant démo préservé :** les deux RPC sont en lecture seule, l'écran d'intro
n'écrit rien.

## Sauvegarde de la version actuelle

Exigence explicite d'Uriel : pouvoir revenir à l'écran actuel. Deux filets, sans
garder de code mort dans le repo :

1. **Tag git `demo-intro-v1`** posé sur le commit actuel de `demo-borne` avant
   toute modification.
2. **Rollback Netlify** : le déploiement en cours du site `runesdechene-demo`
   reste republiable en un clic depuis le dashboard — restauration en dix
   secondes le jour J, sans build et sans développeur.

Alternative écartée : garder les deux écrans derrière une variable
d'environnement. Cela violerait la règle « pas de code mort » du projet pour un
bénéfice que le rollback Netlify couvre déjà mieux.

## Livraison

Branche `demo-intro-v2` depuis `main` (`demo-borne` est entièrement mergée dans
`main`, aucun commit divergent). `pnpm build` vert, prévisualisation locale en
mode démo, puis merge dans `main` **et** dans `demo-borne`. Le push sur
`demo-borne` déclenche le redéploiement Netlify automatique.

## Vérification

- `pnpm build` (tsc strict + vite) passe.
- Écran vérifié localement en `VITE_DEMO_MODE=true` : les six blocs s'affichent,
  le CTA est lisible à distance, la découverte affichée tourne.
- Bandeau preuve vivante coupé du réseau (RPC en échec simulé) : l'écran reste
  complet, aucun trou ni message d'erreur.
- Toucher l'écran entre bien dans la démo (popup « Bienvenue, Veilleur »
  inchangé), et le reset d'inactivité ramène à l'intro.
