# 📣 SPEC — Système d'annonces multi-canal (Hub → tous canaux)

> Rédigée le 5 juin 2026 — Uriel + XO
> Zone : transverse (Hub + explore-web + boutique Shopify)
> Statut : **design validé** — prêt pour plan d'implémentation
> Rattaché à : `INDEX - Boutique en ligne`, `GUIDE EDITORIAL — Voie 3`, `Push Notifications V1` (2026-05-09)

---

## Résumé (le job-to-be-done)

Uriel a **du mal à annoncer les nouveautés** (produits boutique, nouveautés d'app, vie de la marque).
Diagnostic : ce **n'est pas** un problème de SEO/acquisition, ni de plume, ni de portée. Ce sont **deux douleurs précises** :

1. **Pas de point d'ancrage** — tout est éphémère (stories IG). Aucun endroit pérenne à soi.
2. **L'effort manuel** — il faut tout réécrire pour chaque canal, donc souvent ça ne se fait pas.

**Réponse** : un système **hub-and-spoke** (« create once, publish everywhere »). Le **Hub est la source de vérité** ; chaque canal en est une déclinaison. Niveau d'automatisation : **assisté** (Uriel déclenche, XO rédige, Uriel valide, 1 clic diffuse).

---

## Architecture — Le Hub comme source de vérité

```
            ┌──────────────────────────────────────────┐
            │   HUB — SOURCE DE VÉRITÉ                  │
            │   Article stocké dans Supabase (à nous)   │
            │   on écrit ici · on édite ici · TOUJOURS  │
            └───────────────────┬──────────────────────┘
                                │  publier / ré-éditer
        ┌───────────────┬───────┴───────┬───────────────┬──────────────┐
        ▼ (auto)        ▼ (auto natif)  ▼ (auto)         ▼ (Phase 2)    ▼ (généré)
  📝 Blog Shopify   📱 Lecteur app   🔔 Push        📧 Email Resend  📸 Post IG
  (miroir public,   (vrai lieu de   (broadcast      (newsletter      (légende +
   SEO, liens         lecture des     opt-in →        owned)          brief visuel,
   produits)          articles)       deeplink app)                   kit-à-coller)
```

**Principes :**

- **L'article vit dans notre base (Supabase), pas chez Shopify.** L'app le lit nativement → vrai lecteur in-app.
- **Shopify = miroir public.** À la publication, le Hub *pousse* l'article via l'API Admin et stocke l'`article_id`. Ré-édition dans le Hub → *update* de l'article Shopify par son id.
- **Synchro à sens unique (Hub → Shopify).** ⚠️ Contrainte actée : **on n'édite jamais directement dans l'admin Shopify** (sinon écrasé à la prochaine synchro). Prix d'une source de vérité unique, évite les conflits bidirectionnels.
- **Le push deeplink renvoie vers le lecteur in-app** (`/article/:slug`), pas vers Shopify → on ramène le trafic *dans* l'app.

---

## Les canaux (spokes) — niveau d'automatisation réel

| Canal | Niveau | Notes |
|---|---|---|
| 📝 **Blog Shopify** | **1-clic auto** | API Admin Shopify. L'ancre publique + SEO + liens produits. |
| 📱 **Lecteur app** | **1-clic auto (natif)** | Article déjà dans Supabase. Route `/article/:slug` + liste « Nouvelles ». |
| 🔔 **Push** | **1-clic auto** | Réutilise l'infra Push V1 (`push_subscriptions`, Edge Function `send-push`, VAPID). Nouveau mode **broadcast** (fan-out vers tous les abonnés opt-in, respect `push_important_enabled`). Deeplink → lecteur app. |
| 📧 **Email** | **1-clic auto — Phase 2** | Via **Resend** (API d'envoi réelle). Remplace Shopify Email *pour la newsletter/diffusion uniquement*. |
| 📸 **Instagram** | **Généré → collé** | API Meta non rentable. XO génère légende + hashtags + brief visuel ; Uriel poste. |

### Pourquoi Resend (décision du 5 juin)

Shopify Email **n'a pas d'API d'envoi de campagne** → la newsletter y resterait manuelle. **Resend** a une vraie API d'envoi + Audiences/Broadcasts. Bénéfices :

1. L'email passe en **colonne automatique** (geste manuel résiduel = Instagram seul).
2. **Unifie la couche `audience`** : push + app + email lisent **les mêmes contacts Supabase**. Une liste (ex. *Ambassadeurs*) définie une fois marche identiquement sur les 3 canaux owned.

**Prix honnête (repris à notre charge) :**
- Authentification de domaine (SPF/DKIM/DMARC sur `runesdechene.com`).
- Conformité RGPD : lien de désinscription + liste de suppression + traçabilité du consentement.
- Migration des contacts : sync des opt-ins Shopify → table `contacts` (avec preuve de consentement).
- **Shopify Email reste pour le transactionnel** (post-commande, confirmation). Règle : *Shopify = ce qui suit une commande · Resend = ce qu'on diffuse.* On ne duplique pas.

---

## Segmentation / audiences (couture prévue, livrée plus tard)

**Seuls les canaux qui connaissent l'identité du destinataire peuvent cibler** : Push + Lecteur app (et Email via Resend en Phase 2). Blog et Instagram sont **publics par nature** → toujours « tout le monde ».

- **Couture v1** : chaque annonce porte un champ `audience`, valeur unique `tout-le-monde`.
- **v2** : moteur de segments nommés (*Ambassadeurs*, *Maison Boréale*, *Niveau 10+*…). Le champ existe déjà, les canaux owned savent déjà filtrer → branchement sans casse.
- **Règle UI** : si `audience ≠ tout-le-monde`, les canaux publics (blog, IG) se grisent automatiquement.
- **À définir en v2** : ce qu'est un « ambassadeur » côté données (rôle ? seuil de notoriété ? flag manuel Hub ?).

---

## Data model

### Table `announcements` (Supabase — source de vérité)

| Champ | Rôle |
|---|---|
| `id`, `slug` | identité + URL du lecteur in-app (`/article/:slug`) |
| `type` | `produit` / `app` / `marque` |
| `title`, `cover_image` | en-tête |
| `body` | contenu riche, version longue canonique |
| `status` | `draft` / `published` |
| `audience` | `tout-le-monde` en v1 ; id de segment en v2 |
| `shopify_article_id` | id du miroir Shopify (update vs recréation) |
| `published_at` | date |
| `channels` (jsonb) | état par canal : `{ blog, app, push, email, insta }` → `none/ready/published/sent` |

### Table `contacts` (Supabase — Phase 2, fondation Resend)

Unifie **acheteurs Shopify** et **joueurs de l'app** par email.

| Champ | Rôle |
|---|---|
| `id`, `email` | identité |
| `source` | `shopify` / `app` / `manuel` |
| `consent_at`, `consent_source` | traçabilité RGPD |
| `unsubscribe_token` | désinscription |
| `status` | `subscribed` / `unsubscribed` / `bounced` |
| (attributs de segmentation v2 : Maison, niveau, rôle…) | via jointure `users` |

---

## Le lecteur in-app

- Nouvelle route `/article/:slug` dans explore-web — vrai lecteur (titre, image de couverture, corps riche, liens produits cliquables).
- Une **liste « Nouvelles »** accessible depuis le menu → le joueur retrouve les annonces passées.
- C'est ce qui fait de l'app **un vrai lieu de lecture**, et ce vers quoi le push deeplink renvoie.

---

## Le workflow — « Composer d'annonce » (Hub)

1. **Déclencher** — bouton *Nouvelle annonce* → type (Produit/App/Marque) + matière première (1-2 phrases ou lien produit Shopify).
2. **Choisir l'audience** — v1 : *Tout le monde* (sélecteur prêt pour les segments v2).
3. **XO rédige** — brouillon multi-canal (blog / app / push / email / Insta) dans la voix Voie 3, par onglets.
4. **Relire & corriger** — éditeur inline par onglet + *Régénère cet onglet*. Rien ne part sans validation.
5. **Publier** — 1 clic, cases à cocher par canal :
   - ☑️ Blog → publié (API) · ☑️ App → live (Supabase) · ☑️ Push → broadcast opt-in · ☑️ Email → Resend *(Phase 2)* · ☑️ Insta → kit-à-coller
   - canaux publics grisés si `audience ≠ tout-le-monde`
6. **Historique** — tableau des annonces dans le Hub, statut par canal. Le journal de comm.

---

## Phasage

- **Phase 1 — Cœur owned, zéro friction conformité**
  Table `announcements` · Composer Hub · génération XO multi-canal · publication Blog Shopify (API) · Lecteur app (`/article/:slug` + liste Nouvelles) · Push broadcast · kit Instagram.
  → Canal d'annonce **fonctionnel et automatique** immédiatement (le consentement push existe déjà).

- **Phase 2 — Resend (email owned)**
  Table `contacts` · sync opt-ins Shopify · authentification de domaine · désinscription/suppression · envoi newsletter via API au 1 clic. L'email rejoint l'automatique, la segmentation devient réelle.

- **Phase 3 — plus tard**
  Moteur de segments nommés (Ambassadeurs, Maisons…) · planification (publier à une date) · Instagram auto si ça vaut le coup un jour.

---

## Décisions actées

| # | Décision |
|---|---|
| 1 | Le **Hub est la source de vérité**, pas Shopify. |
| 2 | Synchro **Hub → Shopify à sens unique** ; jamais d'édition directe dans Shopify. |
| 3 | Automatisation **assistée** : Uriel valide toujours le texte final (voix de marque). |
| 4 | L'app est un **vrai lieu de lecture** d'articles, pas un simple changelog. |
| 5 | **Resend** pour la newsletter (Phase 2) ; **Shopify Email** reste pour le transactionnel. |
| 6 | Champ `audience` posé dès v1 (`tout-le-monde`) ; segments nommés en v2. |
| 7 | Instagram reste **généré-à-coller** (pas d'auto-post). |

## Questions ouvertes (pour le plan / Phase 2)

- Vérifier finement l'API Resend à utiliser (Broadcasts + Audiences vs envoi brut + liste maison) au moment du plan.
- Définition « ambassadeur » côté données (v2).
- Le push broadcast doit-il avoir son propre opt-out distinct des 6 types push existants, ou réutiliser `push_important_enabled` ?
- Stratégie de double opt-in pour la liste Resend (hygiène + réputation domaine).

---

## Historique

| Date | Changement |
|------|-----------|
| 5 juin 2026 | Création — Uriel + XO. Design validé section par section. |
