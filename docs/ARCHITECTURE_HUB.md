# Architecture HUB - Runes de Chene

## Vue d'ensemble

Le HUB est la **gestion des comptes Runes de Chene**. Il gere :

- Les comptes utilisateurs (profil, avatar, bio)
- Les roles (admin, moderateur, ambassadeur, utilisateur)
- Les photos communautaires (upload, moderation, publication)

**Le HUB ne gere PAS** les commandes, les retours ou l'inventaire.
Shopify et IVY gerent ca de leur cote, de maniere independante.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    HUB (Supabase)                               │
│                                                                 │
│  Table: users                                                   │
│  ├── id, email_address                                          │
│  ├── role (user | ambassador | moderator | admin)               │
│  ├── display_name, bio, avatar_url                              │
│  └── is_active, last_login_at                                   │
│                                                                 │
│  Table: hub_community_photos                                    │
│  ├── user_id, image_url, caption                                │
│  ├── status (pending | approved | rejected)                     │
│  └── moderated_by, moderated_at                                 │
│                                                                 │
│  Storage: community-photos (Supabase Storage)                   │
│  └── Images uploadees par les utilisateurs                      │
└─────────────────────────────────────────────────────────────────┘
        ▲                                       ▲
        │                                       │
   EXPLORE                                  HUB Admin
   (profil, badges)                    (moderation, gestion)
```

---

## Roles

| Role         | Droits                                       |
| ------------ | -------------------------------------------- |
| `user`       | Voir son profil, uploader des photos         |
| `ambassador` | Idem + visibilite speciale, badges exclusifs |
| `moderator`  | Idem + moderer les photos de la communaute   |
| `admin`      | Acces total au dashboard HUB                 |

---

## Photos communautaires

### Flux upload

```
1. Utilisateur se connecte (Magic Link)
2. Upload une photo depuis son profil
3. Photo stockee dans Supabase Storage
4. Statut = "pending" (en attente de moderation)
5. Moderateur/Admin approuve ou rejette
6. Si approuvee → visible publiquement
7. Photos approuvees exploitables sur Shopify
```

### Moderation

- Les moderateurs et admins voient toutes les photos en attente
- Ils peuvent approuver ou rejeter (avec raison)
- Les photos approuvees sont accessibles via URL publique

### Integration Shopify

Les photos approuvees peuvent etre affichees sur la boutique Shopify via :

- Section Liquid custom pointant vers les URLs Supabase Storage
- Ou via une app tierce type galerie communautaire

---

## Conformite RGPD

| Situation   | Approche                                              |
| ----------- | ----------------------------------------------------- |
| EXPLORE     | Inscription avec Magic Link (consentement explicite)  |
| Photos      | L'utilisateur choisit d'uploader (opt-in)             |
| Suppression | L'utilisateur peut supprimer ses photos et son compte |

---

## Connexion Shopify / IVY (futur)

La liaison des commandes Shopify et IVY aux comptes HUB est **reportee**.
Quand un abonnement Shopify superieur sera pris, on pourra :

- Acceder aux PII via l'API Shopify
- Lier automatiquement les commandes aux comptes
- Attribuer des badges bases sur les achats

Pour l'instant, les comptes Runes de Chene sont independants des commandes.

---

## Prochaines etapes

1. [x] Creer l'app HUB (dashboard React)
2. [x] Definir les tables (users enrichi + community_photos)
3. [ ] Configurer Supabase Storage pour les photos
4. [ ] Page profil accessible a tous les utilisateurs
5. [ ] Systeme d'upload photos
6. [ ] Interface de moderation (admin/moderateur)
7. [ ] Integration photos approuvees vers Shopify
