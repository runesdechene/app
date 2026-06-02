# Défis (journaliers/hebdo) & Missions (à thème) — Design

> Date : 2026-06-02 · Repo : `app (Runes de Chêne)` (explore-web + hub + supabase)
> Statut : design validé en brainstorm, prêt pour 2 plans d'implémentation
> Brainstorm : session visuelle 2026-06-02 (companion `.superpowers/brainstorm/1406-*`)
> S'appuie sur : `2026-05-26-ugc-mouvement-model-design.md` (dont c'est la **Phase 2 Quêtes** annoncée), `2026-05-26-ugc-brique1bis-studio-soumission-design.md`, `2026-05-27-ils-nous-portent-par-produit-design.md`

---

## 0. Vocabulaire (player-facing)

| Terme joueur | Quoi | Nature |
|---|---|---|
| **Défis** | Type 1 — objectifs courts, récurrents, auto-générés | Défis **du jour** (perso) + Défi **de la semaine** (communautaire) |
| **Missions** | Type 2 — opérations à thème pilotées depuis le Hub | Génériques : photos produit *aujourd'hui*, mais ouvert à concours photo hors-produit, vidéos, chasse au trésor… |

> **Code interne** : les identifiants existants restent `quest_*` (`quest_templates`, `quest_ref`,
> `QuestsBoardPanel`). On ne renomme pas le legacy. Les **nouvelles** tables Type 2 sont préfixées
> `mission_*`. La balise de liaison reste `quest_ref` / `?quete=` (déjà câblée, générique).

---

## 1. Intention

Compléter la dernière brique du plan applicatif :
- des **Défis** qui créent de la connivence (objectifs partagés, renouvelés) ;
- un **moteur de Missions** générique qui mobilise la communauté autour d'une opération à thème
  (aujourd'hui : achat produit → shooting → médias → butin ; demain : tout autre livrable).

Deux types, deux étapes de livraison indépendantes.

---

## 2. Périmètre

### Type 1 — Défis (auto-générés, « connivence »)
- **Du jour (perso)** : lot tournant (~4) pioché dans un **pool curé**, reset 24h, *les mêmes pour
  tous le même jour* (la connivence vient de là). Ex. « Découvre 3 châteaux en 24h ».
- **De la semaine (communautaire)** : **un** défi de fond à **compteur partagé global**, cycle ~7j.
  Ex. « La communauté ajoute 10 châteaux en 7 jours ». Récompense **tous les contributeurs (≥1)**.

### Type 2 — Missions (pilotées Hub, génériques)
Une Mission est un **contenant libre** : un brief, une fenêtre temporelle, un salon commun, un butin.
- **Livrable actuel** : médias (photos) via le studio UGC existant, **lié optionnellement à un produit**.
- **Salon commun** (1 mission = 1 chat partagé, adhésion ouverte) — émulation + vitrine UGC.
- **Preuve = le livrable**, **validation Hub a priori**, **butin discrétionnaire** « à la tête du client ».
- **Extensible** (hors-scope immédiat, non préclus par le modèle) : vidéos, concours hors-produit,
  chasse au trésor (validation géo/code) — cf. `mission.deliverable_kind`.

### Découpage de livraison (validé)
- **Étape 1 (app)** : moteur de Défis + entité Mission + fenêtre joueur + salon + défi communautaire.
  Shippable même si le butin reste en Couronnes au début.
- **Étape 2 (Hub)** : butin > Couronnes (Gloire + titre + code) via l'email de validation existant
  + modération **« mission-aware »** + authoring des Missions.

### Hors-scope (YAGNI)
- Personnalisation comportementale des Défis (ciblage Hub fin reporté).
- Inventaire cosmétique complet (les **titres** sont livrés en texte simple, cf. §6).
- Génération **automatique** de codes promo Shopify (créés à la main, saisis à la validation — D-REC-3).
- Livrables Mission non-photo (vidéo, chasse au trésor) : **prévus par le modèle, pas implémentés** ici.
- Défis/Missions créés par les joueurs (pilotage = Hub + auto uniquement).

---

## 3. Décisions verrouillées (brainstorm 2026-06-02)

| # | Décision |
|---|----------|
| D-PILOT | Pilotage **Mix Hub + auto** : Hub pour les Missions, moteur auto pour les Défis. |
| D-T1-GEN | Défis perso = **pool tournant curé** (pas set fixe, pas génération paramétrique). |
| D-T1-MIX | **Lot perso (24h) + 1 communautaire (7j)** en parallèle, toujours visibles. |
| D-T1-COM | Défi communautaire = **compteur partagé global**, récompense **tous contributeurs ≥1**. |
| D-T2-CHAT | Mission = **salon commun** (pas de chat privé), adhésion ouverte. |
| D-T2-INFRA | **Hybride léger** : réutiliser l'infra chat/média realtime, coque UI dédiée (branding + CTA). |
| D-T2-PROOF | **Livrable = preuve**, **validation Hub a priori** avant butin. |
| D-T2-GEN | **Mission générique** : brief libre, produit **optionnel**, `deliverable_kind` extensible. |
| D-REC-1 | Butin **polymorphe** : Couronnes + XP + Gloire + Titre + Code promo. |
| D-REC-2 | Butin **discrétionnaire à la validation** (« à la tête du client », -10% à -100%). Affichage joueur = **plancher annoncé** (min Gloire / min Couronnes). |
| D-REC-3 | Code promo **créé à la main** dans Shopify, saisi en texte libre à la validation. |
| D-REC-4 | Livraison du butin par l'**email de validation UGC existant** (`contribution_approved`). |
| D-REC-5 | **Gloire créditable manuellement** via validation (lève mig 024 sur ce chemin **manuel uniquement**). La Gloire **reste la monnaie de mérite du jeu** (alimente la Coupe) — à doser avec la même gravité qu'en jeu. |
| D-NAME | **Défis** = Type 1 (journalier/hebdo) · **Missions** = Type 2 (à thème). « Événement » reste réservé aux Expéditions. |

---

## 4. Existant réutilisé (ancrage code — on ne reconstruit pas)

### Moteur de quêtes journalières (Défis perso) — mig 056
- `quest_templates(id, type, wording, icon, tracker_kind, threshold, reward_xp, reward_couronnes, active, display_order)` — `type` accepte déjà `daily/weekly/editorial/local/campement_issued/expedition`.
- `user_quest_progress(user_id, quest_template_id, date_local, count, completed_at, rewarded)` PK composite.
- `increment_quest_progress(user_id, tracker_kind, amount)` + triggers auto-track (`discoveries`, `enigma_attempt`, `moisson_claims`, `social_action`).
- `get_user_quests_today()` (filtre `type='daily'`), `_user_date_local(user_id)` (timezone-aware).
- ⚠️ **Divergence à résorber** : `get_today_quests_state(p_user_id)` (mig 125) est un **second** moteur daily, hardcodé JSON, et c'est *lui* que `QuestsBoardPanel` consomme aujourd'hui. On consolide sur le moteur 056.

### Pipeline UGC (Missions backbone) — mig 175-181
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

### 5.1 Défis perso — pool tournant
Pas de nouvelle table. On exploite `quest_templates` :
- Sélection **déterministe par date** dans `get_user_quests_today()` : sous-ensemble de N templates
  choisi par un hash stable `f(date_local, display_order)` → **mêmes défis pour tous le même jour**,
  rotation sans répétition courte. Au besoin `quest_templates.pool_weight int`.
- Seeder une bibliothèque curée (ton bonapartiste) incluant la maille **châteaux** (nouveau
  `tracker_kind`, ex. `castle_discoveries`, filtré par catégorie de lieu — cf. §9.4).

### 5.2 Défi communautaire — compteur partagé
```
community_quests(
  id text PK,                 -- slug
  wording text, icon text,
  tracker_kind text,          -- ex. 'places_added', 'castle_added'
  target int,                 -- ex. 10
  current_count int NOT NULL DEFAULT 0,   -- compteur partagé (dénormalisé, lecture rapide)
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
- **Auto-track** : trigger sur l'action ciblée (ex. `AFTER INSERT ON places`) →
  `increment_community_quest(user_id, tracker_kind, amount)` : (a) `current_count += amount` sur le défi
  actif du bon `tracker_kind`, (b) upsert la contribution du user.
- **Atteinte** (`current_count >= target`) → `active → reached` + **récompense de tous les contributeurs ≥1**
  (parcours des contributions, crédit idempotent `rewarded_at`, bucket séparé du cap Couronnes mig 029).
- **Connivence** : la fiche affiche `current_count / target` + « ta contribution : X ».

### 5.3 Mission (générique)
```
missions(
  slug text PK,               -- = valeur de hub_photo_submissions.quest_ref (?quete=slug)
  title text, eyebrow text, call text,   -- branding (cf. maquette event-window-v2)
  brief text,                 -- description libre de ce qui est demandé (générique)
  emblem text,                -- emoji/cover signature (ex. '⚔️')
  cover_image_url text,
  deliverable_kind text NOT NULL DEFAULT 'photo'
     CHECK (deliverable_kind IN ('photo','video','other')),  -- extensible
  product_handle text,        -- OPTIONNEL : Shopify, UNIQUEMENT pour la galerie communauté par produit
  cta_label text,             -- CTA découplé du produit (ex. « Rejoindre la boutique »)
  cta_url text,               -- cible libre : fiche produit, collection ou URL
  starts_at timestamptz, ends_at timestamptz,
  floor_glory int, floor_crowns int,     -- plancher de butin ANNONCÉ (D-REC-2) ; pré-remplit la validation
  reward_hint text,           -- ex. « + titre & code possibles »
  salon_intro text,           -- message d'accueil épinglé en tête du salon (optionnel)
  notify_on_launch boolean NOT NULL DEFAULT true,    -- push « nouvelle mission » à la publication
  featured_on_home boolean NOT NULL DEFAULT false,   -- carte sur /accueil en plus du HUD
  status text CHECK (status IN ('draft','published','passed','archived')) DEFAULT 'draft'
  -- salon : lecture seule quand status IN ('passed','archived') (pas de champ dédié)
)
mission_participants(         -- adhésion OUVERTE (relever la mission / entrer au salon)
  mission_slug text REFERENCES missions(slug),
  user_id text REFERENCES users(id),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (mission_slug, user_id)
)
mission_messages(            -- salon commun
  id bigint PK,
  mission_slug text REFERENCES missions(slug),
  user_id text REFERENCES users(id),
  content text CHECK (length(content) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now()
)
mission_message_reads(mission_slug, user_id, last_read_at)   -- badge non-lus
```
- **Salon** : `send_mission_message(user_id, mission_slug, content)` — autorisé = participant (adhésion
  ouverte, pas de validation chef). Front **réutilise** `ExpeditionChat` + pattern `useExpeditionChat`
  (généralisés à une « source » de messages). Realtime `postgres_changes` sur `mission_messages`.
- **Galerie des livrables** (page centrale) : RPC publique `get_mission_submissions(p_slug)` → médias
  approuvés dont `hub_photo_submissions.quest_ref = p_slug` (images approuvées + consentement marque),
  + statut de la soumission de l'auteur courant. Calquée sur `get_community_photos_by_product`.
- **Soumission** : « Présenter mon livrable » → deep-link `/soumettre-contenu?quete=<slug>` (studio
  existant, `quest_ref` déjà géré). Aucun nouveau formulaire pour le livrable photo.

### 5.4 Butin (Étape 2) — extension du pipeline UGC
- `moderate_submission` étendue :
  `moderate_submission(p_submission_id, p_status, p_crowns, p_glory int DEFAULT NULL, p_title text DEFAULT NULL, p_promo_code text DEFAULT NULL)`.
  - Crédit **Gloire** manuel (lève mig 024 sur ce chemin) — même Gloire que le jeu (alimente la Coupe).
  - **Titre** : stockage simple (ex. `user_titles(user_id, title, granted_at)`) + affiché au profil.
    Pas d'inventaire cosmétique complet (YAGNI).
  - **Code promo** : stocké sur la soumission (`hub_photo_submissions.reward_promo_code`) pour l'email ;
    pas crédité en DB de jeu.
  - Idempotence conservée (`rewarded_at`). Enrichir le `jsonb` de la notif (`glory`, `title`, `promo_code`).
- **Email** (`send-email` Resend) : enrichir le template pour rendre Gloire + titre + code en plus des
  Couronnes (cf. aperçu maquette `hub-butin`).
- **Hook Mission** : la validation d'une soumission avec `quest_ref` non nul *est* la complétion de la
  participation (état dérivé de `hub_photo_submissions.status` + `quest_ref`, pas de table d'état séparée).

---

## 6. Récompenses — modèle & phasage

| Récompense | Mécanisme | Étape |
|---|---|---|
| 🪙 Couronnes | `user_crowns`, déjà manuel dans `moderate_submission` | Existe |
| ⭐ XP | `users.xp_total` (Défis T1) / option butin Mission | 1 |
| 🎖️ Gloire | crédit **manuel** à la validation (D-REC-5) | 2 |
| 👑 Titre | texte stocké + affiché profil (pas d'inventaire complet) | 2 |
| 🏷️ Code promo | texte libre créé main dans Shopify, livré par email | 2 |

Affichage joueur (fiche Mission) = **plancher** (`floor_glory`, `floor_crowns`, `reward_hint`). Le butin
réel, personnalisé, arrive par **email** à la validation.

---

## 7. UI

### 7.1 QuestsBoardPanel (HUD) — 3 sections
`Défis du jour` (lot perso) · `Le défi de la semaine` (communautaire + barre partagée) · `Missions`
(carte d'entrée vers la fenêtre, s'il y en a une active). Consolider la source sur le moteur 056
(+ community_quests + missions), retirer la dépendance au `get_today_quests_state` hardcodé (mig 125).

### 7.2 Fenêtre Mission (joueur) — modale parchemin
Validée en maquette (`event-window-v2`). Langage des Expéditions (tokens parchemin, onglets sticky).
- **Onglet « Mission »** (page centrale) : eyebrow + titre signature + call ; cover 16:9 + emblème +
  compteur J-N ; **Butin** (plancher) ; **Le brief** (1·2·3 + **CTA boutique** bronze si produit lié) ;
  **statut de validation** de l'auteur ; **« Les contributions »** = galerie (badges ✓ validé / ⏳ en
  attente) ; bouton **« Présenter mon livrable »**.
- **Onglet « Salon »** : chat commun (réutilise `ExpeditionChat`), badge non-lus.

### 7.3 Hub
- **Authoring Mission** : CRUD `missions` (branding, brief, `deliverable_kind`, produit optionnel,
  dates, plancher de butin, statut).
- **Modération mission-aware** : dans `Photos.tsx`/`SubmissionDetail.tsx`, quand `quest_ref` est présent →
  panneau enrichi (contexte Mission, plancher pré-rempli, champs Gloire/Titre/Code, aperçu email) — cf.
  maquette `hub-butin`. Sans `quest_ref` → panneau actuel inchangé.

---

## 8. Flux clés

**Mission (bout en bout, cas photo+produit)**
```
Hub crée missions(slug=hoplite, deliverable=photo, product, dates, plancher)
  → joueur ouvre la fenêtre Mission, rejoint le salon (mission_participants)
  → « Présenter mon livrable » → /soumettre-contenu?quete=hoplite (studio existant)
  → hub_photo_submissions(quest_ref=hoplite, status=pending) + images
  → Hub : SubmissionDetail détecte quest_ref → panneau enrichi → moderate_submission(approved, crowns, glory, title, promo_code)
  → crédit (Couronnes/Gloire/titre) + notif contribution_approved → email (Couronnes+Gloire+titre+code)
  → fenêtre Mission : la photo passe ✓ validé dans « Les contributions » (+ galerie produit Shopify existante)
```

**Défi communautaire**
```
action ciblée (ex. ajout d'un château) → trigger increment_community_quest
  → current_count++ + contribution upsert → barre partagée mise à jour
  → si current_count >= target : status reached → récompense de tous les contributeurs ≥1 (idempotent)
```

---

## 9. Points ouverts (à confirmer en revue)

1. **Naming résolu** : Défis (T1) / Missions (T2). ✅
2. **Salon = tables dédiées** (`mission_messages`) plutôt que réutiliser `voyage_messages`
   (adhésion ouverte ≠ roster validé). Front mutualisé, backend distinct. **Reco : tables dédiées.**
3. **Titres** livrés en stockage simple (texte) maintenant, **inventaire cosmétique** complet reporté.
4. **Maille « châteaux »** : nouveau `tracker_kind` filtré par catégorie de lieu — confirmer que la
   catégorie « château » est exploitable dans le schéma `places` (vérif au plan).
5. **Genéricité Mission** : on livre le chemin photo (studio UGC) ; vidéo / chasse au trésor sont
   prévus par `deliverable_kind` mais **non implémentés** (chaque nouveau livrable = son plan).
6. **Réglages Mission verrouillés** (mockup `hub-mission-editor`, validé 2026-06-02) : `notify_on_launch`
   (push, défaut oui), `featured_on_home` (défaut non), `cta_label`+`cta_url` (CTA libre découplé du
   produit), `salon_intro` (mot épinglé), salon **lecture seule** après fin, validation **pré-remplie au
   plancher**. ✅

---

## 10. Séquence d'implémentation (2 plans)

- **Plan Étape 1 (app)** : community_quests + contributions + trigger ; missions + participants +
  salon (RPC + front chat mutualisé) ; pool/rotation Défis perso + seed bibliothèque ; fenêtre Mission ;
  QuestsBoardPanel 3 sections + consolidation mig 125→056. Butin = Couronnes (existant).
- **Plan Étape 2 (Hub)** : extension `moderate_submission` (Gloire/titre/code) + email enrichi ;
  stockage titres ; authoring `missions` (Hub) ; modération mission-aware (`SubmissionDetail`).

---

## 11. Vérification (critères de fin, par plan)
- Défi communautaire : compteur partagé exact sous concurrence ; récompense unique par contributeur (idempotence) ; cycle correct.
- Défis perso : mêmes défis pour tous le même jour ; rotation sans répétition courte.
- Mission : soumission via deep-link porte bien `quest_ref` ; galerie n'expose jamais `team_note`/email (test anon) ; salon réservé aux participants.
- Butin : Gloire créditée seulement en manuel (jamais auto) ; idempotence (`rewarded_at`) ; email rend Couronnes+Gloire+titre+code ; cap Couronnes respecté.
```
