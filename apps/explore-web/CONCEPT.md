# Explore Web — Runes de Chêne

> Bible du projet — Dernière mise à jour : 19/03/2026

## Vision

**Un jeu géostratégique communautaire autour du patrimoine**, connecté à la boutique e-commerce Runes de Chêne 

L'application est centrée sur une **carte interactive style parchemin/Skyrim** où les joueurs explorent, conquièrent et enrichissent des lieux patrimoniaux. 

**Plateformes cibles :**

- **Web (PWA)** — priorité 1

- **Desktop via Tauri** — priorité 2 (second temps)

- **Mobile** — en sommeil (`explore-mobile-sleep`), la PWA couvre ce besoin

---

## Stack technique

- **Framework** : React 18 + TypeScript + Vite

- **Styling** : TailwindCSS + shadcn/ui

- **Carte** : MapLibre GL JS + tuiles OpenFreeMap (open source, gratuit, pas de clé API)

- **Backend** : Supabase (auth OTP, RPC functions, RLS, Realtime)

- **PWA** : vite-plugin-pwa (déjà configuré)

- **Desktop** : Tauri (second temps)

- **State** : Zustand (léger) + React Query pour le cache serveur

- **Icônes** : Lucide React

- **Sons** : Howler.js (libre de droits au début, assets custom plus tard)

- **Déploiement** : Netlify — domaine `carte.runesdechene.com` (à configurer)

- **Package manager** : pnpm

---

## Architecture

```

src/

├── components/

│   ├── map/              # Carte MapLibre, markers, clusters, brouillard, territoires

│   ├── chat/             # Chat général + chat de faction (onglets)

│   ├── places/           # Fiches lieux, formulaires d'ajout/édition

│   ├── anecdotes/        # Anecdotes attachées ou sauvages

│   ├── auth/             # Login OTP, création profil, onboarding

│   ├── profile/          # Profil joueur, titres, faction, stats

│   ├── notifications/    # Feed de notifications (coin haut gauche)

│   ├── search/           # Recherche globale (lieux, adresses, users)

│   ├── filters/          # Filtres par type, époque, faction

│   └── ui/               # Composants shadcn/ui réutilisables

├── hooks/                # useMap, useAuth, usePlaces, useChat, useFog, useSound

├── lib/

│   ├── supabase.ts       # Client Supabase

│   ├── map.ts            # Config MapLibre + style parchemin

│   └── sounds.ts         # Gestionnaire de sons

├── types/                # Types TypeScript

├── stores/               # Zustand stores (auth, map, game, chat)

├── pages/                # Pages SEO (/lieu/:slug, /anecdote/:slug)

└── styles/               # Tailwind config, globals, thèmes parchemin/nuit

```

---

## La Carte

### Style visuel

- **Style parchemin / Skyrim** : couleurs sépia, texture de parchemin, typographie médiévale/fantasy

- **Deux thèmes** : Parchemin (mode clair) / Nuit (mode sombre)

- **Icônes custom** par type de lieu (récupérées depuis `explore-mobile-sleep`)

- **WebGL** via MapLibre pour la performance (2400+ lieux).

### Comportement

- **Centrage initial** : position GPS de l'utilisateur

- **Zone visible** : ~250 km de dézoom par défaut

- **Couverture** : mondiale

- **Zoom** : jusqu'au niveau rue

- **Clusters** : regroupement automatique des markers au dézoom.

- **Popup au clic** : ouverture de la modal détaillée.
- **Passage de la souris** : bref aperçu des infos importante donc faction propriétaire.
- **Fiche détaillée** : modal ou panneau latéral gauche

### Éléments sur la carte

4 types d'éléments, chacun avec son marker distinct :

1. **Lieux** — patrimoine naturel, historique, atypique (ajoutés par les utilisateurs)

2. **Anecdotes** — attachées à un lieu existant OU indépendantes ("sauvages") avec leur propre position

3. **Produits** — placés manuellement par les admins (lien vers la boutique Shopify)

4. **Événements** — stand nomade Runes de Chêne, partenaires (API Fellowship à terme)

### Système de tags

- Chaque élément a un **type** (Lieu, Anecdote, Produit, Événement) — structurel, fixe

- Chaque élément a des **tags** libres et multiples (ex: "forêt", "dolmen", "bretagne", "mystique")

- Les utilisateurs peuvent **créer de nouveaux tags** s'ils ne trouvent pas le leur.

- Les admins gérer les tags via le hub, et associer les tags à des "forces" ou des "faiblesses" pour les factions.

### Filtres

- Par **type d'élément** (Lieu, Anecdote, Produit, Événement)

- Par **tags**

- Par **époque historique** :

  - Préhistoire

  - Antiquité

  - Moyen Âge

  - Renaissance
  - La belle époque.
  - Epoque industrielle.

  - Époque moderne

  - Contemporain

Idéalement par date en fonction de J-C, détaillée dans les fiches, sur une période ou la date de sa fondation.

- Par **faction** propriétaire

### Recherche globale

- Barre de recherche **toujours visible** en haut

- Recherche dans : lieux, adresses/positions GPS, anecdotes, utilisateurs

- Résultats dans une **modal centrale**

---

## Gameplay — Système de Factions & Territoires

### Factions

4 factions inspirées des collections de la boutique.

- 🟢 **Les Compagnons de Lug** (Celtique) — Vert

- 🔵 **Les Explorateurs de Midgard** (Nordique) — Bleu

- 🔴 **Les Aigles de Rome** (Romaine) — Rouge

- 🟣 **Les Disciples de Pythéas** (Grecque) — Violet

Extensible avec de nouvelles collections boutique.
Chacune offre des malus ou des bonus.

### Appartenance

- Le joueur **choisit sa faction** à l'inscription. Il peut ne pas en choisir une, mais ne pourra pas faire autre chose qu'explorer des lieux.

- **Changement possible 1 fois gratuitement, puis une fois par saison** (cooldown + coût en points)

- Le profil affiche les **couleurs de la faction**.

- **Système de mercenaire** : 1 action/jour possible pour une autre faction (coût majoré). Offre un titre "Mercenaire" avec des rangs croissants.

### Points d'exploration

- **5 points/jour**, non cumulables (par défaut).

- Les achats boutique **augmentent le plafond de stockage** (pas les gains quotidiens — pas de pay-to-win)

  - Ex: +0.5 point de stockage par tranche de 10€ d'achat

- Les lieux proches de la position GPS sont **éclairables gratuitement**

### Actions et coûts

| Action                          | À distance    | Sur place (GPS) |

| ------------------------------- | ------------- | --------------- |

| **Éclairer** (lever brouillard) | 1 point       | Gratuit         |

| **Conquérir** un lieu           | 3 points      | 1 point         |

| **Renforcer** un lieu allié     | ❌ Impossible | 1 point         |

| **Contester** un lieu ennemi    | 2 points      | 1 point         |

### Brouillard de guerre

- La carte est couverte d'un **brouillard** (opacité, couleurs désaturées, blur sur les éléments de la carte).

- Éclairer un lieu = lever le brouillard autour de lui

- Les markers sont **visibles à travers le brouillard** (on sait qu'il y a quelque chose) mais les détails sont masqués.

- **Sans compte** : le joueur voit sa zone proche. S'il clique sur un lieu dans le brouillard → invitation à créer un compte avec un CTA fort.

### Territoires

- Un lieu conquis crée une **zone de contrôle circulaire** avec la couleur de la faction

- **Bordure brillante** de la couleur de la faction
- Les bordures se fusionnent entre elles pour former un + grand territoire dirigé par une faction.

- Le **rayon** dépend de la valeur du lieu :

  - Likes, visites confirmées (check-in GPS), photos ajoutées, anecdotes, avis, éditions, temps passé sur la fiche, vues externes (partage URL avec `?ref=userId`)

- **Renforcement** : uniquement sur place (GPS). Plus un lieu est renforcé, plus il est difficile à contester.

- Un lieu sans crédit communautaire = à peine un avant-poste

### Conquête en temps réel (Duel)

Quand un joueur lance une conquête :

1. Un **timer de 120 secondes** démarre, 60 si sur position GPS de l'utilisateur (aproximatif).

2. **Notification live** envoyée à tous les joueurs proches + faction propriétaire : "⚔️ [Pseudo] tente de conquérir [Lieu] !"

3. Pendant 120/60 secondes, n'importe qui peut **s'opposer** (défendre) ou **venir en renfort** (attaquer avec lui).
4. Chaque nouvel arrivant opposé augmente le timer de +30 secondes. Chaque nouvel arrivant allié le réduit de -30 secondes.

5. À la fin du timer : résolution basée sur la **puissance cumulée** de chaque camp.

#### Puissance de combat

La puissance d'un joueur est liée à son exploration réelle — plus tu explores, plus tu es fort :

| Source de puissance                                                    | Bonus                                 |

| ---------------------------------------------------------------------- | ------------------------------------- |

| **Base** (tout joueur)                                                 | 1                                     |

| **Présent sur place** (GPS)                                            | ×5                                    |

| **Lieux éclairés** (total)                                             | +0.1 par lieu                         |

| **Lieux conquis** cette saison                                         | +0.2 par lieu                         |

| **Bonus de faction** (lieu d'époque alignée, ex: Celtes sur un dolmen) | ×1.5                                  |

| **Titre spécial** (Conquérant, etc.)                                   | +0.5                                  |

| **Renfort allié**                                                      | puissance de chaque allié additionnée |

Un joueur expérimenté présent physiquement avec bonus faction est redoutable, mais 10 joueurs moyens à distance peuvent le battre ensemble → encourage la **coopération**.

### Valeur culturelle vs valeur stratégique

- **Likes/contributions enrichissent le LIEU** (neutre, profite à tous)

- **Conquête/renforcement enrichissent la FACTION** (stratégique)

- Liker un lieu ennemi = investissement : si ta faction le conquiert, tu récupères un gros territoire

### Saisons

- **Reset tous les 3 mois** — les territoires repartent à zéro.

- La faction gagnante reçoit un **titre exclusif + récompense boutique** ou item unique.

- Chaque saison peut avoir un **thème** (ex: "La Conquête de la Bretagne"), ou ne pas en avoir (saison libre)

- **Événements cross-faction** (PvE) : menaces qui forcent la coopération temporaire

### Guildes / Unités (futur)

- Les joueurs peuvent créer des **guildes** au sein de leur faction

- Nom libre, bannière custom, chat de guilde

- Coordination de conquêtes en équipe

### Extensions futures (non prioritaires)

- Construction d'avant-postes

- Événements IRL

- Chasses au trésor

- Duels entre joueurs

---

## Enrichir un lieu — Mécaniques de valeur

Un lieu gagne en importance (rayon de territoire, visibilité) grâce à :

- ❤️ **Likes**

- 📍 **Visites confirmées** (check-in GPS) — le plus puissant

- 📸 **Photos ajoutées** par la communauté

- 📜 **Anecdotes attachées**

- ⭐ **Avis/reviews** détaillés

- ✏️ **Éditions de la fiche** (contributeurs)

- 🔗 **Partages externes** — lien `carte.runesdechene.com/nom-du-lieu?ref=userId`, compteur de vues

- ⏱️ **Temps passé sur la fiche** par les visiteurs

Les fiches de lieux sont **éditables par la communauté** (wiki-like). Chaque contributeur est crédité.

---

## Utilisateurs & Profil

### Inscription (flow)

1. Email ou téléphone

2. OTP (Supabase Auth)

3. Création du profil d'aventurier :

   - Pseudo

   - Avatar

   - Petite bio

   - Réseau social (optionnel)

1. Choix de faction (optionnel, il peut la choisir + tard).

2. **Onboarding guidé** style RPG : "Bienvenue Voyageur ! Vous apparaissez dans le brouillard... Éclairez votre premier lieu !"

### Profil

- Pseudo + avatar (visible sur la carte et dans le chat)

- **Titre actif** affiché sous le pseudo. L'utilisateur peut choisir quel titre afficher. Il peut en choisir plusieurs, mais seul le premier sera affiché. Exemple : "Roi de la colline + 3 autres titres"

- Couleurs de la faction dominante

- Stats : lieux éclairés, conquis, renforcés, contributions

- Lieux ajoutés / renforcés ou conquis (encore sous sa domination) / bookmarkés

### Système de titres

- Titres débloqués par des **conditions** (lieux visités, anecdotes ajoutées, événements, ancienneté, produits achetés...)

- Exemples :

  - "Explorateur Novice" (premier lieu éclairé)

  - "Historien" (5 anecdotes ajoutées)

  - "Ambassadeur Runes de Chêne" (participation à un événement IRL)

  - "Démiurge" (Admins)

  - "Conquérant" (10 lieux conquis)

- Les admins peuvent **créer de nouveaux titres** avec des conditions via le Hub.

### Compte

- Compte Supabase (géré via le Hub)

- Indépendant du compte Shopify (pour l'instant), à terme le HUB se chargera de tout unifier avec les commandes etc... le HUB restera source de vérité absolue.

---

## Interface (Layout)

### Écran principal

La carte prend **100% de l'écran**. Les éléments UI sont des **panneaux flottants** :

```

┌─────────────────────────────────────────────────┐

│ [Notifications]              [🔍] [➕] [⚙️] [👤] │

│  feed scrollable              Recherche          │

│  (7 jours d'historique)       Ajouter            │

│                               Options            │

│                               Profil             │

│                                                  │

│              CARTE PLEIN ÉCRAN                   │

│           (style parchemin/nuit)                 │

│                                                  │

│                                                  │

│ [???]                    [💬 Général | ⚔️ Faction]│

│  (à définir)             Chat (onglets)          │

│                          ouvert par défaut       │

│                          minimisable             │

└─────────────────────────────────────────────────┘

```

### Fiche d'un lieu

- S'ouvre en **panneau latéral gauche** (au-dessus de la carte) pour pouvoir continuer à voir le tchat à droite de l'écran.

- Contenu : description, photos, vidéos, avis, anecdotes, contributeurs, faction propriétaire

- Boutons : liker, visiter, éclairer, conquérir, renforcer, partager, éditer

- **Pas de page dédiée dans le jeu** — mais lien vers page SEO

### Pages SEO (hors jeu)

- URL : `carte.runesdechene.com/lieu/:slug` et `carte.runesdechene.com/anecdote/:slug`

- Contenu : fiche complète, moins gamifié, très pratique

- Bouton "Voir sur la carte" → renvoie vers l'app

- **Indexable** par les moteurs de recherche

- Optimisé meta tags / Open Graph pour le partage social

### Mode embed (Shopify)

- URL : `carte.runesdechene.com?embed=true`

- L'app s'affiche **sous la navbar de la boutique** (le header Shopify reste visible avec menus + panier)

- Bouton **plein écran** → redirige vers `carte.runesdechene.com` (sans navbar boutique)

---

## Notifications (Feed d'activité)

### Position

- **Coin haut gauche**, panneau flottant fixe

- Style "archive de terminal" — scrollable, intégré graphiquement

- Les notifications restent **7 jours**

### Types de notifications

- "**[Pseudo]** a ajouté un lieu !"

- "**[Pseudo]** a visité **[lieu]** !"

- "Nouveau festival pour Runes de Chêne !"

- "**[Pseudo]** a noté **[lieu]** !"

- "**[Pseudo]** vient de se connecter depuis **[localisation]** !"

- "**[Pseudo]** a créé un nouveau compte !"

- "**[Faction]** a conquis **[lieu]** !"

- "**[Pseudo]** a éclairé une nouvelle zone !"

---

## Chat

### Général

- **Coin bas droite**, ouvert par défaut, minimisable (avec bruitage)

- **Onglets** : Chat Général | Chat de Faction

- Texte + emoji uniquement (pas de médias)

- Supabase Realtime

### Modération

- Les admins peuvent nommer des **modérateurs** via le Hub. Ils ont des options pour modérer (cacher des lieux, afin de laisser les admins trancher, mais aussi supprimer des commentaires ou masquer des photos de lieux).

---

## Sons & Musique

### Bruitages (événements)

- Clic sur un marker

- Clic sur un bouton

- Nouvelle notification

- Like / repartage

- Lieu éclairé (son de "découverte")

- Lieu conquis (fanfare)

- Ouverture/fermeture du chat

- Onboarding

### Musique de fond

- **Changeante selon la position géographique** (ex: celtique en Bretagne, provençale dans le sud). Chaque zone a un dossier avec un ensemble de musique qui passent à la chaine.

- Musique par défaut si la zone n'a pas de musique assignée (Musique de carte).

- **Optionnelle** (activable/désactivable en haut à droite de l'écran).

- Assets libres de droits au début, assets custom fournis par le fondateur plus tard.

---

## Anecdotes

### Types

- **Attachées à un lieu** : reliées à la fiche du lieu, ajoutables depuis la fiche

- **Sauvages** : position géographique propre, ajoutées directement sur la carte

### Champs

- Titre

- Contenu texte

- Époque historique

- Position (héritée du lieu ou propre)

- Auteur

- Tags

### Qui peut en ajouter ?

- N'importe quel utilisateur connecté

---

## Administration (Hub)

Le Hub (`apps/hub`) gère toute l'administration :

- Créer/modifier les **types de lieux**

- Gérer les **tags** (trier les populaires, supprimer les doublons)

- Placer les **produits** sur la carte

- Gérer les **titres** et leurs conditions

- Gérer les **factions** et événements de saison

- Modérer le contenu (lieux, anecdotes, avis, chat)

- Nommer des **modérateurs**

- Configurer les **musiques** par zone géographique

- Statistiques et analytics

---

## Backend Supabase (déjà en place)

### RPC functions existantes

- `get_map_places` — tous les lieux pour la carte

- `get_map_banners` — bannières

- `get_regular_feed` / `get_banner_feed` — feeds

- `get_place_by_id` — détail d'un lieu

- `get_place_reviews` — avis

- `get_user_profile` / `get_my_informations` — profil

- `get_user_places` — lieux d'un utilisateur

### À créer

- Tables : factions, territoires, points d'exploration, titres, anecdotes, guildes, notifications

- RPC : conquête, renforcement, contestation, classement factions, feed notifications

- Realtime : chat, notifications live

- Storage : photos communautaires, avatars

### Auth

- OTP (signInWithOtp / verifyOtp) configuré côté Supabase

### Données existantes

- **+2 400 lieux** avec coordonnées GPS, photos, descriptions, auteurs

- **+2 970 utilisateurs**

---

## Roadmap

### Phase 1 — Carte MVP (deadline : mi-mars 2026)

- [ ] Setup TailwindCSS + shadcn/ui

- [ ] Intégrer MapLibre GL JS avec style parchemin

- [ ] Afficher les 2400+ lieux existants (markers + clusters)

- [ ] Popup au clic sur un marker

- [ ] Fiche détaillée d'un lieu (modal/panneau)

- [ ] Filtres par type de lieu et époque

- [ ] Recherche globale (lieux, adresses, utilisateurs)

- [ ] Géolocalisation utilisateur

- [ ] Auth OTP + création profil + choix faction

- [ ] Responsive mobile-first (PWA)

- [ ] Pages SEO pour les lieux (`/lieu/:slug`)

### Phase 2 — Gameplay de base (deadline : fin mars 2026)

- [ ] Brouillard de guerre

- [ ] Système de points d'exploration (5/jour)

- [ ] Éclairer / conquérir / contester des lieux

- [ ] Zones de territoire (cercles colorés par faction)

- [ ] Renforcement sur place (GPS)

- [ ] Onboarding guidé RPG

- [ ] Thème Nuit (mode sombre)

### Phase 3 — Communauté

- [ ] Ajout de lieux par les utilisateurs

- [ ] Fiches éditables (wiki-like, contributeurs crédités)

- [ ] Anecdotes (attachées + sauvages)

- [ ] Avis/reviews

- [ ] Système de titres

- [ ] Feed de notifications (7 jours)

- [ ] Chat général + chat de faction (Supabase Realtime)

### Phase 4 — Intégrations

- [ ] Produits Runes de Chêne géolocalisés (admins)

- [ ] Embed iframe dans la boutique Shopify

- [ ] Saisons (reset trimestriel, thèmes, récompenses boutique)

- [ ] Musique de fond par zone géographique

- [ ] Bruitages

- [ ] Événements CDKoger sur la carte

### Phase 5 — Extensions

- [ ] Guildes / unités au sein des factions

- [ ] Bonus boutique (augmentation plafond de points)

- [ ] Événements cross-faction (PvE)

- [ ] Desktop Tauri

- [ ] Chasses au trésor, duels, avant-postes

---

## Choix carte : MapLibre + OpenFreeMap

**Pourquoi pas Google Maps :**

- Payant après quota

- Dépendance Google

- Pas open source

**Pourquoi MapLibre GL JS + OpenFreeMap :**

- 100% open source

- Gratuit, pas de clé API nécessaire

- Données OpenStreetMap (communautaire, français)

- Performant (WebGL) — essentiel pour 2400+ markers

- Styles personnalisables (parchemin, nuit, branding Runes de Chêne)

- Self-hostable si besoin

---

## Conventions

- TypeScript strict — pas de `any`

- Code propre, DRY, modulaire

- Composants fonctionnels avec hooks

- TailwindCSS pour le styling (pas de CSS-in-JS)

- pnpm comme package manager

- Commits conventionnels (feat:, fix:, chore:)

- Tests unitaires pour la logique métier

- Accessibilité (a11y) de base
