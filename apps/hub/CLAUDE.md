# Hub — Runes de Chêne

> Back-office d'administration — Dernière mise à jour : 10 février 2026

## Vision

Le Hub est le **panneau d'administration** de l'écosystème Runes de Chêne. Il gère les utilisateurs, modère le contenu communautaire (photos, avis), et à terme administrera l'application Carte (types de lieux, tags, factions, titres, événements, produits géolocalisés).

## Stack technique

- **Framework** : React 18 + TypeScript + Vite
- **Routing** : react-router-dom v6
- **Backend** : Supabase (auth, RPC functions, storage)
- **Port dev** : 3001
- **Déploiement** : Netlify — domaine `hub.runesdechene.com`
- **Package manager** : pnpm

## Architecture actuelle

```
src/
├── components/
│   ├── Dashboard.tsx       # Stats globales (comptes, photos pending/approved)
│   ├── LoginPage.tsx       # Auth admin (Supabase Auth)
│   ├── Sidebar.tsx         # Navigation latérale
│   ├── Users.tsx           # Gestion utilisateurs (rôles, actif/inactif)
│   ├── Photos.tsx          # Modération photos communautaires (admin)
│   ├── PhotoSubmit.tsx     # Formulaire public /soumettre-contenu
│   ├── Reviews.tsx         # Modération avis (admin)
│   ├── ReviewSubmit.tsx    # Formulaire public /soumettre-avis
│   └── PublicForm.css      # Styles formulaires publics
├── hooks/
│   └── useAuth.ts          # Hook auth Supabase
├── lib/
│   └── supabase.ts         # Client Supabase
├── App.tsx                 # Router principal
├── App.css                 # Styles globaux
├── main.tsx                # Point d'entrée
└── index.css               # Reset CSS
```

## Routes

### Routes admin (auth requise)
- `/` — Dashboard (stats)
- `/users` — Gestion des utilisateurs
- `/photos` — Modération des soumissions photos
- `/reviews` — Modération des soumissions avis

### Routes publiques
- `/soumettre-contenu` — Formulaire de soumission de photos (clients, ambassadeurs, partenaires)
- `/soumettre-avis` — Formulaire de soumission d'avis

## Fonctionnalités existantes

### Dashboard
- Nombre total de comptes
- Nombre d'ambassadeurs
- Photos en attente de modération
- Photos approuvées

### Utilisateurs
- Liste avec recherche par email
- Modification des rôles : user, ambassador, moderator, admin
- Activation/désactivation de compte

### Photos (modération)
- Filtres par statut : En attente, Géniales, Moyennes, Refusées
- Filtres par rôle : Client, Ambassadeur, Partenaire
- Actions : Approuver (géniale/moyenne), Refuser (avec raison), Supprimer
- Lightbox pour visualiser les photos/vidéos
- Affichage des métadonnées (nom, email, instagram, localisation, message)

### Soumission photos (public)
- Champs : Nom, Email, Instagram, Ville, Code postal, Rôle, Message
- Upload multi-fichiers (max 5, photos 10Mo, vidéos 50Mo)
- Consentements : diffusion marque + création compte
- Création automatique de compte si email inconnu

### Avis (modération)
- Filtres par statut : En attente, Validés, Archivés
- Actions : Valider, Archiver, Supprimer
- Affichage note (étoiles), texte, photo, statut d'achat

### Soumission avis (public)
- Champs : Nom, Email, Lieu, Code postal, Note (1-5 étoiles), Texte, Photo, Statut d'achat
- Consentements : création compte + republication
- Création automatique de compte si email inconnu

## RPC Supabase utilisées

- `create_user_from_submission` — Création de compte depuis formulaire public
- `create_photo_submission` — Enregistrement soumission photo
- `add_submission_image` — Ajout image à une soumission
- `get_photo_submissions` — Liste des soumissions (filtrable par statut)
- `get_submission_images_batch` — Images par lot
- `moderate_submission` — Modération photo
- `delete_photo_submission` — Suppression photo
- `create_review_submission` — Enregistrement soumission avis
- `get_review_submissions` — Liste des avis (filtrable par statut)
- `moderate_review` — Modération avis
- `delete_review_submission` — Suppression avis

## Extensions prévues (pour l'app Carte)

- Gestion des **types de lieux**
- Gestion des **tags** (tri, fusion, suppression)
- Placement des **produits** sur la carte
- Gestion des **titres** et conditions de déblocage
- Gestion des **factions** et événements de saison
- Configuration des **musiques** par zone géographique
- Nomination de **modérateurs**
- **Statistiques** et analytics avancés

## Commandes

```bash
# Depuis la racine du monorepo :
pnpm --filter hub dev       # Lance le Hub (port 3001)
pnpm --filter hub build     # Build production

pnpm dev                    # Lance explore-web / La Carte (port 3000)
pnpm build                  # Build explore-web
```

## Conventions

- TypeScript strict — pas de `any`
- Code propre, DRY, modulaire
- pnpm comme package manager
- Variables d'environnement : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
