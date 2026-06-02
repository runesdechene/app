# Quêtes journalières & Défis à thème — Design

> Date : 2026-06-02 · Repo : `app (Runes de Chêne)` (explore-web + hub + supabase)
> Statut : design validé en brainstorm, prêt pour 2 plans d'implémentation
> Brainstorm : session visuelle 2026-06-02 (companion `.superpowers/brainstorm/1406-*`)
> S'appuie sur : `2026-05-26-ugc-mouvement-model-design.md` (dont c'est la **Phase 2 Quêtes** annoncée), `2026-05-26-ugc-brique1bis-studio-soumission-design.md`, `2026-05-27-ils-nous-portent-par-produit-design.md`

---

## 1. Intention

Compléter la dernière brique du plan applicatif : un **système de quêtes** qui crée de la
connivence (objectifs partagés, renouvelés) et un **moteur de défis à thème** qui convertit
la communauté en contributeurs UGC autour d'un produit (shooting → médias → récompense).

Deux types, deux étapes de livraison indépendantes.

---

## 2. Périmètre

### Type 1 — Quêtes journalières (auto-générées, « connivence »)
- **Perso** : lot tournant (~4) piochées dans un **pool curé**, reset 24h, *les mêmes pour tous
  le même jour* (la connivence vient de là). Ex. « Découvre 3 châteaux en 24h ».
- **Communautaire** : **une** quête de fond à **compteur partagé global**, cycle ~7j. Ex. « La
  communauté ajoute 10 châteaux en 7 jours ». Récompense **tous les contributeurs (≥1 action)**.

### Type 2 — Défis à thème (pilotés depuis le Hub)
Campagnes de marque tournées commerce + UGC : acheter un produit → shooting/médias → butin.
- **Salon commun** (1 défi = 1 chat partagé, adhésion ouverte) — émulation + vitrine UGC.
- **Preuve = la photo**, **validation Hub a priori**, **butin discrétionnaire** « à la tête du client ».

### Découpage de livraison (validé)
- **Étape 1 (app)** : le système de quêtes + l'entité Défi + la fenêtre joueur + le salon + la
  quête communautaire. Shippable même si le butin reste en Couronnes au début.
- **Étape 2 (Hub)** : butin > Couronnes (Gloire + titre + code) via l'email de validation existant
  + modération **« quête-aware »**.

### Hors-scope (YAGNI)
- Personnalisation comportementale des quêtes (ciblage Hub fin reporté, cf. brainstorm).
- Inventaire cosmétique complet (les **titres** sont livrés en texte simple, cf. §6).
- Génération **automatique** de codes promo Shopify : les codes sont **créés à la main** dans
  Shopify et saisis à la validation (cf. décision D-REC-3).
- Quêtes créées par les joueurs (pilotage = Hub + auto uniquement).

---

## 3. Décisions verrouillées (brainstorm 2026-06-02)

| # | Décision |
|---|----------|
| D-PILOT | Pilotage **Mix Hub + auto** : Hub pour les Défis, moteur auto pour les quêtes journalières. |
| D-T1-GEN | Type 1 perso = **pool tournant curé** (pas set fixe, pas génération paramétrique). |
| D-T1-MIX | **Lot perso (24h) + 1 communautaire (7j)** en parallèle, toujours visibles. |
| D-T1-COM | Quête communautaire = **compteur partagé global**, récompense **tous contributeurs ≥1**. |
| D-T2-CHAT | Défi = **salon commun** (pas de chat privé), adhésion ouverte. |
| D-T2-INFRA | **Hybride léger** : réutiliser l'infra chat/média realtime, coque UI dédiée (branding + CTA produit). |
| D-T2-PROOF | **Photo = preuve**, **validation Hub a priori** avant butin. |
| D-REC-1 | Butin **polymorphe** : Couronnes + XP + Gloire + Titre + Code promo. |
| D-REC-2 | Butin **discrétionnaire à la validation** (« à la tête du client », de -10% à -100%). Affichage joueur = **plancher annoncé** (min Gloire / min Couronnes). |
| D-REC-3 | Code promo **créé à la main** dans Shopify, saisi en texte libre à la validation. Pas d'intégration API. |
| D-REC-4 | Livraison du butin par l'**email de validation UGC existant** (`contribution_approved`). |
| D-REC-5 | **Gloire créditable manuellement** via validation (lève mig 024 pour ce chemin **manuel uniquement**). La Gloire **reste la monnaie de mérite du jeu** (alimente la Coupe) — à doser avec la même gravité qu'en jeu. |
| D-NAME | Type 2 nommé **« Défi »** côté joueur (les Expéditions occupent déjà le mot « Événement »). *À confirmer §9.* |

---

## 4. Existant réutilisé (ancrage code — on ne reconstruit pas)

### Moteur de quêtes journalières (Type 1 perso) — mig 056
- `quest_templates(id, type, wording, icon, tracker_kind, threshold, reward_xp, reward_couronnes, active, display_order)` — `type` accepte déjà `daily/weekly/editorial/local/campement_issued/expedition`.
- `user_quest_progress(user_id, quest_template_id, date_local, count, completed_at, rewarded)` PK composite.
- `increment_quest_progress(user_id, tracker_kind, amount)` + triggers auto-track (`discoveries`, `enigma_attempt`, `moisson_claims`, `social_action`).
- `get_user_quests_today()` (filtre `type='daily'`), `_user_date_local(user_id)` (timezone-aware).
- ⚠️ **Divergence à résorber** : `get_today_quests_state(p_user_id)` (mig 125) est un **second** moteur daily, hardcodé en JSON, et c'est *lui* que `QuestsBoardPanel` consomme aujourd'hui. On consolide sur le moteur 056.

### Pipeline UGC (Type 2 backbone) — mig 175-181
- `hub_photo_submissions(..., status, message=avis public, consent_brand_usage, **quest_ref**, reward_crowns, rating_*, team_note PRIVÉ, moderated_at, rewarded_at)`.
- `hub_submission_images(submission_id, image_url, status, size, product_worn, shopify_product_*, show_in_community, show_on_wall)`.
- `create_photo_submission(... p_quest_ref ...)` **public/anon** — capte `?quete=` (**balise déjà câblée**).
- `moderate_submission(p_submission_id, p_status, p_crowns)` — crédit **manuel** idempotent (`rewarded_at`), `contributions_count++`, insère notif `contribution_approved`.
- Notif → trigger `email_on_notification` → edge function `send-email` (Resend). Push existant en bonus.
- Studio public `StudioSubmit.tsx` (`/soumettre-contenu`, wizard 4 étapes), `get_studio_config`.
- Hub modération : `Photos.tsx`, `photos/SubmissionDetail.tsx`, `photos/SubmissionList.tsx`, `photos/PhotosToolbar.tsx`.
- Galerie publique par produit : `get_community_photos_by_product(handle)`.

### Chat realtime (salon backbone) — mig 104/107
- `voyages`, `voyage_participants(status)`, `voyage_messages(voyage_id, user_id, content)`, `voyage_message_reads`.
- `send_voyage_message(user_id, voyage_id, content)` (autorisé chef + validés), `mark_voyage_messages_read`.
- Front : `useExpeditionChat.ts` (subscribe `postgres_changes`), `ExpeditionChat.tsx`, design parchemin (`ExpeditionModal.css`).

### Économie & UI
- `user_crowns(balance)` cap 500, `users.xp_total`, `users.contributions_count`, Gloire (mig 024).
- `QuestsBoardPanel` (HUD agrégateur), `dailyQuestsStore`, `DailyQuestsList/Card/Modal`.

---

## 5. Architecture — modèle de données (net-new)

> Migrations à partir de **183** (dernière = 182). Numéros à ajuster à l'implémentation.

### 5.1 Type 1 perso — pool tournant
Pas de nouvelle table. On exploite `quest_templates` :
- Marquer un ensemble de templates `type='daily'` comme **pool** (déjà le cas via `active`).
- Ajouter une **sélection déterministe par date** : `get_user_quests_today()` renvoie un sous-ensemble
  de N templates choisi par un hash stable `f(date_local, display_order)` → **mêmes quêtes pour tous
  le même jour**, rotation sans répétition courte. Aucune colonne neuve indispensable ; au besoin
  `quest_templates.pool_weight int`.
- Seeder une vraie bibliothèque curée (ton bonapartiste) incluant la maille **châteaux**
  (nouveau `tracker_kind` si besoin, ex. `castle_discoveries` filtré par catégorie de lieu).

### 5.2 Type 1 communautaire — compteur partagé
```
community_quests(
  id text PK,                 -- slug
  wording text, icon text,
  tracker_kind text,          -- ex. 'places_added', 'castle_added'
  target int,                 -- ex. 10
  current_count int NOT NULL DEFAULT 0,   -- compteur partagé (dénormalisé pour lecture rapide)
  starts_at timestamptz, ends_at timestamptz,
  reward_xp int, reward_couronnes int,
  status text CHECK (status IN ('draft','active','reached','closed')) DEFAULT 'draft'
)
community_quest_contributions(
  quest_id text REFERENCES community_quests(id),
  user_id  text REFERENCES users(id),
  count int NOT NULL DEFAULT 0,
  rewarded_at timestamptz,
  PRIMARY KEY (quest_id, user_id)
)
```
- **Auto-track** : trigger sur l'action ciblée (ex. `AFTER INSERT ON places`) → `increment_community_quest(user_id, tracker_kind, amount)` qui (a) `current_count += amount` sur la quête active du bon `tracker_kind`, (b) upsert la contribution du user.
- **Atteinte de l'objectif** (`current_count >= target`) → passage `active → reached` + **récompense de tous les contributeurs ≥1** (parcours `community_quest_contributions`, crédit idempotent via `rewarded_at`, respect du cap Couronnes 500 / bucket séparé du cap mig 029 comme l'UGC).
- **Connivence** : la fiche affiche la barre `current_count / target` communautaire + « ta contribution : X ».

### 5.3 Type 2 — Défi
```
quest_events(
  slug text PK,               -- = valeur de hub_photo_submissions.quest_ref (?quete=slug)
  title text, eyebrow text, call text,   -- branding (cf. maquette)
  emblem text,                -- emoji/cover signature (ex. '⚔️')
  cover_image_url text,
  product_handle text,        -- Shopify, pour le CTA + la galerie produit existante
  starts_at timestamptz, ends_at timestamptz,
  floor_glory int, floor_crowns int,     -- plancher de butin ANNONCÉ (D-REC-2)
  reward_hint text,           -- ex. « + titre & code possibles »
  status text CHECK (status IN ('draft','published','passed','archived')) DEFAULT 'draft'
)
quest_event_participants(    -- adhésion OUVERTE (relever le défi / entrer au salon)
  event_slug text REFERENCES quest_events(slug),
  user_id text REFERENCES users(id),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_slug, user_id)
)
quest_event_messages(        -- salon commun
  id bigint PK,
  event_slug text REFERENCES quest_events(slug),
  user_id text REFERENCES users(id),
  content text CHECK (length(content) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now()
)
quest_event_message_reads(event_slug, user_id, last_read_at)   -- badge non-lus
```
- **Salon** : `send_event_message(user_id, event_slug, content)` — autorisé = participant (adhésion ouverte, pas de validation chef). Le front **réutilise** `ExpeditionChat` + le pattern `useExpeditionChat` (généralisés à une « source » de messages). Realtime via `postgres_changes` sur `quest_event_messages`.
- **Galerie des offrandes** (page centrale de la fenêtre) : nouvelle RPC publique
  `get_quest_event_submissions(p_slug)` → photos approuvées dont `hub_photo_submissions.quest_ref = p_slug`
  (jointe images approuvées + consentement marque), + un volet « en attente » pour l'auteur courant
  (statut de sa propre soumission). Calquée sur `get_community_photos_by_product`.
- **Soumission** : bouton « Présenter mon shooting » → deep-link `/soumettre-contenu?quete=<slug>`
  (studio existant, `quest_ref` déjà géré). Aucun nouveau formulaire.

### 5.4 Butin (Étape 2) — extension du pipeline UGC
- `moderate_submission` étendue :
  `moderate_submission(p_submission_id, p_status, p_crowns, p_glory int DEFAULT NULL, p_title text DEFAULT NULL, p_promo_code text DEFAULT NULL)`.
  - Crédit **Gloire** manuel (lève mig 024 sur ce chemin) — écrit la même Gloire que le jeu (alimente la Coupe).
  - **Titre** : stocké simple (ex. `users.earned_titles text[]` ou `user_titles(user_id, title, granted_at)`) + affiché au profil. Pas d'inventaire cosmétique complet (YAGNI).
  - **Code promo** : stocké sur la soumission (`hub_photo_submissions.reward_promo_code`) pour l'email ; pas crédité en DB de jeu.
  - Idempotence conservée (`rewarded_at`). Enrichir le `jsonb` de la notif `contribution_approved` (`glory`, `title`, `promo_code`).
- **Email** (`send-email` Resend) : enrichir le template pour rendre Gloire + titre + code en plus des Couronnes (cf. aperçu maquette `hub-butin`).
- **Hook Défi** : à la validation d'une soumission avec `quest_ref` non nul → en plus du crédit,
  marquer la participation au Défi accomplie (la soumission validée *est* la complétion) — pas de table
  d'état séparée nécessaire (l'état dérive de `hub_photo_submissions.status` + `quest_ref`).

---

## 6. Récompenses — modèle & phasage

| Récompense | Mécanisme | Étape |
|---|---|---|
| 🪙 Couronnes | `user_crowns`, déjà manuel dans `moderate_submission` | Existe |
| ⭐ XP | `users.xp_total` (quêtes T1) / option butin Défi | 1 |
| 🎖️ Gloire | crédit **manuel** à la validation (D-REC-5) | 2 |
| 👑 Titre | texte stocké + affiché profil (pas d'inventaire complet) | 2 |
| 🏷️ Code promo | texte libre créé main dans Shopify, livré par email | 2 |

Affichage joueur (fiche Défi) = **plancher** (`floor_glory`, `floor_crowns`, `reward_hint`). Le butin
réel, personnalisé, arrive par **email** à la validation.

---

## 7. UI

### 7.1 QuestsBoardPanel (HUD) — 3 sections
`Du jour` (lot perso) · `La communauté` (quête communautaire + barre partagée) · `Défi` (s'il y en a un
actif, carte d'entrée vers la fenêtre). Consolider la source sur le moteur 056 (+ community_quests +
quest_events), retirer la dépendance au `get_today_quests_state` hardcodé (mig 125).

### 7.2 Fenêtre Défi (joueur) — modale parchemin
Validée en maquette (`event-window-v2`). Langage des Expéditions (tokens parchemin, onglets sticky).
- **Onglet « Défi »** (page centrale) : eyebrow + titre signature + call ; cover 16:9 + emblème + compteur
  J-N ; **Butin** (plancher) ; **La mission** 1·2·3 avec **CTA boutique** (bronze) ; **statut de validation**
  de l'auteur ; **« Les offrandes »** = galerie des contributions (badges ✓ validé / ⏳ en attente) ;
  bouton **« Présenter mon shooting »**.
- **Onglet « Salon »** : chat commun (réutilise `ExpeditionChat`), badge non-lus.

### 7.3 Hub
- **Authoring Défi** : CRUD `quest_events` (branding, produit, dates, plancher de butin, statut).
- **Modération quête-aware** : dans `Photos.tsx`/`SubmissionDetail.tsx`, quand `quest_ref` est présent →
  panneau enrichi (contexte Défi, plancher pré-rempli, champs Gloire/Titre/Code, aperçu email) — cf.
  maquette `hub-butin`. Sans `quest_ref` → panneau actuel inchangé.

---

## 8. Flux clés

**Défi (bout en bout)**
```
Hub crée quest_events(slug=hoplite, product, dates, plancher)
  → joueur ouvre la fenêtre Défi (app), rejoint le salon (quest_event_participants)
  → « Présenter mon shooting » → /soumettre-contenu?quete=hoplite (studio existant)
  → hub_photo_submissions(quest_ref=hoplite, status=pending) + images
  → Hub : SubmissionDetail détecte quest_ref → panneau enrichi → moderate_submission(approved, crowns, glory, title, promo_code)
  → crédit (Couronnes/Gloire/titre) + notif contribution_approved → email (Couronnes+Gloire+titre+code)
  → fenêtre Défi : la photo passe ✓ validé dans « Les offrandes » (+ galerie produit Shopify existante)
```

**Quête communautaire**
```
action ciblée (ex. ajout d'un château) → trigger increment_community_quest
  → current_count++ + contribution upsert  → barre partagée mise à jour
  → si current_count >= target : status reached → récompense de tous les contributeurs ≥1 (idempotent)
```

---

## 9. Points ouverts (à confirmer en revue)

1. **Naming Type 2 = « Défi »** (D-NAME) pour éviter la collision avec « Événement » (= Expéditions).
   Alternatives : « Campagne », « Quête à thème ». **Reco : Défi.**
2. **Salon = tables dédiées** (`quest_event_messages`) plutôt que réutiliser `voyage_messages`
   (adhésion ouverte ≠ roster validé d'Expédition). Front mutualisé, backend distinct. **Reco : tables dédiées.**
3. **Titres** livrés en stockage simple (texte) maintenant, **inventaire cosmétique** complet reporté.
4. **Maille « châteaux »** : nouveau `tracker_kind` filtré par catégorie de lieu — confirmer que la
   catégorie « château » est exploitable dans le schéma `places`.

---

## 10. Séquence d'implémentation (2 plans)

- **Plan Étape 1 (app)** : community_quests + contributions + trigger ; quest_events + participants +
  salon (RPC + front chat mutualisé) ; pool/rotation T1 perso + seed bibliothèque ; fenêtre Défi ;
  QuestsBoardPanel 3 sections + consolidation mig 125→056. Butin = Couronnes (existant).
- **Plan Étape 2 (Hub)** : extension `moderate_submission` (Gloire/titre/code) + email enrichi ;
  stockage titres ; authoring `quest_events` (Hub) ; modération quête-aware (`SubmissionDetail`).

---

## 11. Vérification (critères de fin, par plan)
- T1 communautaire : compteur partagé exact sous concurrence ; récompense unique par contributeur (idempotence) ; reset/cycle correct.
- T1 perso : mêmes quêtes pour tous le même jour ; rotation sans répétition courte.
- Défi : soumission via deep-link porte bien `quest_ref` ; galerie n'expose jamais `team_note`/email (test anon) ; salon réservé aux participants.
- Butin : Gloire créditée seulement en manuel (jamais auto) ; idempotence (`rewarded_at`) ; email rend Couronnes+Gloire+titre+code ; cap Couronnes respecté.
```
