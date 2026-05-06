# V0.7+ — Expéditions entre joueurs

> **Statut** : design validé Uriel le 2026-05-06.
> **Cible** : V0.7+ pré-lancement public. Premier livrable du sous-système "Tableau de Quêtes" agrégateur (mini-quêtes journalières + Expéditions joueurs + Missions Hub).
> **Référence cadre** : méta-spec [`2026-05-01-v07-articulation-campement-quetes-influence-design.md`](2026-05-01-v07-articulation-campement-quetes-influence-design.md) §6 (Sous-système 2 — Quêtes).
> **Pivot 2026-05-06** : (1) le **Campement permanent est abandonné** — le profil joueur reste un profil classique, pas un point géographique. (2) Sémantique clarifiée : "Quêtes" = canal marque (Hub→joueurs, prochaine spec) ; "Expéditions" = canal joueurs (cette spec). (3) Le "Tableau de Quêtes" est un afficheur unifié des trois flux.

---

## 1. Contexte & motivation

La méta-spec V0.7 articulation prévoyait deux sous-systèmes liés au social joueur-joueur : **Quêtes émises depuis Campement** (V0.7+) et **Expéditions multi-joueurs** (V0.8). Avec l'abandon du Campement permanent, ces deux fronts fusionnent dans un seul livrable cohérent : les **Expéditions**, un canal de convocation événementielle entre voyageurs.

Le besoin que cette feature couvre : la promesse de la stratégie RdC 2026 — *« que les gens puissent se rencontrer et partir à l'aventure ensemble d'ici cet été »* — n'a aujourd'hui aucune traduction mécanique dans l'app. La carte est un solo. Les Expéditions transforment la carte en lieu de convocation, sans imposer de tracking GPS, sans dérive influenceur, et avec une mémoire collective qui se constitue toute seule via les comptes rendus publics opt-in.

---

## 2. Décisions stratégiques (résumé exécutif)

| Décision | Choix retenu | Raison |
|---|---|---|
| **Lieu de RDV** | Point GPS libre (pas de `places.id`) | Une expédition peut partir d'un parking, d'un sentier, d'un point de vue — la base RdC ne contient pas tous ces points pratiques |
| **Métaphore visuelle** | "Bannière plantée" sur la carte (mini-marker temporaire) | Cohérent avec l'imaginaire RdC sans tomber dans le RPG |
| **Chef d'expédition** | Un seul créateur, pas de co-organisation | Simplifie la modération et la responsabilité |
| **Inscription** | Mode configurable à la création : "Validation manuelle" ou "Inscription libre" | Le chef décide selon son besoin |
| **Slots** | Fixes (2-50) **ou** Ouvert | Couvre rando solo-friendly et rassemblements festivaliers |
| **Économie** | Gratuit à créer / rejoindre. +10 XP par compte rendu posté (1 fois par expé) | Pas de Couronnes — l'économie reste lisible. XP ciblé sur la *trace*, pas la participation, pour éviter le no-show "j'étais là pour le score" |
| **Cycle de vie** | Publiée → Date passée → Archivée (permanente). Annulée = suppression dure J+30. Pas d'auto-suppression | L'archive crée du patrimoine et de l'ancienneté |
| **Visibilité archives** | Coque publique (nom, date, lieu, chef, participants, comptes rendus opt-in) + Cœur privé (chat, médias non publiés, comptes rendus privés) | Marketing préservé, pudeur respectée |
| **Compte rendu** | 1 par participant (chef inclus), texte + photos + vidéos. Opt-in publication individuelle. | Le défaut privé protège la sincérité ; l'opt-in pousse les meilleurs récits en vitrine |
| **Galerie** | Agrège les médias de tous les comptes rendus de l'expédition | Mémoire collective sans surcouche |
| **Limite d'expés actives par chef** | 3 simultanément | Anti-spam léger, force la finition |
| **Modération** | Bouton "Signaler" → remontée Hub. Pas d'auto-modération en V1 | Suffisant à l'échelle communauté française |
| **Tableau de Quêtes** | Onglets internes : *Quêtes du jour* / *Expéditions* / (futur) *Missions* | Un seul afficheur, trois flux distincts |

---

## 3. États & cycle de vie

```
[Publiée] ──(date RDV passée auto)──> [Date passée] ──(J+30 auto)──> [Archivée — permanente]
   │                                       │
   │                                       │ ── compte rendu posté → +10 XP
   │
   └──(chef annule)──> [Annulée] ── 30j sur profil ── suppression dure
```

| État | Bannière carte | Tableau "À venir" | Tableau "Archives" | Inscriptions | Chat | Comptes rendus | Modifs chef |
|---|---|---|---|---|---|---|---|
| **Publiée** | ✅ | ✅ | — | ouvertes | actif (validés) | ❌ | ✅ tout (sauf chef) |
| **Date passée** | ❌ | ❌ | — *(pas encore)* | ❌ | lecture seule | ✅ ouverts | ❌ |
| **Archivée** | ❌ | ❌ | ✅ coque publique | ❌ | lecture seule (privé participants) | lecture seule | ❌ |
| **Annulée** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Notes** :
- Transition **Publiée → Date passée** : automatique à `now() >= rdv_at`, déclenchée par job (cron Postgres ou check à chaque RPC qui touche l'expé). On bascule la `status` et on retire la bannière.
- Transition **Date passée → Archivée** : à `rdv_at + 30 jours`. Pure transition d'affichage (l'expé reste en BDD).
- **Annulation** : visible 30 jours dans les sections "Mes expéditions" du chef et des inscrits, puis suppression dure (chat + médias compris).
- **Pas de bouton "Terminer" manuel** : trop souvent oublié en pratique sur ce genre d'apps.

---

## 4. Modèle de données

### 4.1 Tables

```sql
-- Table principale
CREATE TABLE expeditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chief_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 3 AND 80),
  description text CHECK (description IS NULL OR length(description) <= 1000),
  rdv_at timestamptz NOT NULL,
  rdv_lat double precision NOT NULL,
  rdv_lng double precision NOT NULL,
  rdv_label text CHECK (rdv_label IS NULL OR length(rdv_label) <= 120),
  slots_max integer CHECK (slots_max IS NULL OR slots_max BETWEEN 2 AND 50),
  slots_open boolean NOT NULL DEFAULT false,
  validation_mode text NOT NULL CHECK (validation_mode IN ('manual','free')),
  status text NOT NULL CHECK (status IN ('published','passed','archived','cancelled')) DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CHECK (
    (slots_open = true AND slots_max IS NULL)
    OR (slots_open = false AND slots_max IS NOT NULL)
  )
);
CREATE INDEX idx_expeditions_status_rdv ON expeditions(status, rdv_at);
CREATE INDEX idx_expeditions_chief ON expeditions(chief_user_id);

-- Inscriptions (demandes pending + validées + refusées + retraits)
CREATE TABLE expedition_participants (
  expedition_id uuid NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','validated','rejected','withdrawn')),
  request_message text CHECK (request_message IS NULL OR length(request_message) <= 280),
  joined_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  PRIMARY KEY (expedition_id, user_id)
);
CREATE INDEX idx_expedition_participants_user ON expedition_participants(user_id, status);

-- Chat privé (table dédiée — pas de partage avec chat_messages global)
CREATE TABLE expedition_messages (
  id bigserial PRIMARY KEY,
  expedition_id uuid NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expedition_messages_expe ON expedition_messages(expedition_id, created_at);

-- Compteur de messages non lus par participant (lazy update via RPC mark_read)
CREATE TABLE expedition_message_reads (
  expedition_id uuid NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expedition_id, user_id)
);

-- Comptes rendus (1 par participant)
CREATE TABLE expedition_reports (
  expedition_id uuid NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text_content text CHECK (text_content IS NULL OR length(text_content) <= 1000),
  is_public boolean NOT NULL DEFAULT false,
  cover_media_id uuid,                                -- référence à expedition_report_medias.id
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  xp_awarded boolean NOT NULL DEFAULT false,
  PRIMARY KEY (expedition_id, user_id)
);

-- Médias (photos + vidéos) attachés aux comptes rendus, agrégés en galerie
CREATE TABLE expedition_report_medias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expedition_id uuid NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('photo','video')),
  size_bytes integer,
  duration_seconds integer,                           -- vidéos uniquement
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (expedition_id, user_id)
    REFERENCES expedition_reports(expedition_id, user_id)
    ON DELETE CASCADE
);
CREATE INDEX idx_expedition_medias_gallery ON expedition_report_medias(expedition_id, created_at);

-- Signalements
CREATE TABLE expedition_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expedition_id uuid NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','inappropriate','other')),
  comment text CHECK (comment IS NULL OR length(comment) <= 500),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expedition_flags_unresolved ON expedition_flags(resolved_at) WHERE resolved_at IS NULL;
```

### 4.2 Bucket Supabase Storage

**À créer** : `expedition-medias`

Politique RLS :
- **INSERT** : authentifié + participant validé de l'expédition (vérification via RPC dédiée, le client ne pose pas de blob brut)
- **SELECT** :
  - Si le média est référencé par un `expedition_reports.cover_media_id` avec `is_public = true` → public
  - Sinon → participants validés de l'expédition seulement
- **DELETE** : auteur du média ou chef d'expédition (modération)

Limites côté client (validation avant upload) :
- Photo : ≤ 10 MB, formats `jpg`/`png`/`webp`
- Vidéo : ≤ 50 MB, ≤ 30 secondes, formats `mp4`/`webm`

### 4.3 Extension du système `notifications`

Le système existant (`apps/explore-web/src/components/notifications/NotificationPanel.tsx`) accepte des types arbitraires + payload `data` JSON. On ajoute :

| Type notif | Cible | Payload `data` |
|---|---|---|
| `expedition_join_request` | Chef | `{ expeditionId, expeditionName, requesterUserId, requesterName, message? }` |
| `expedition_validated` | Demandeur | `{ expeditionId, expeditionName, chiefName }` |
| `expedition_rejected` | Demandeur | `{ expeditionId, expeditionName, chiefName }` |
| `expedition_modified` | Inscrits validés | `{ expeditionId, expeditionName, changedFields: ['rdv_at', 'rdv_lat', ...] }` |
| `expedition_cancelled` | Inscrits validés | `{ expeditionId, expeditionName, chiefName }` |
| `expedition_reminder` | Inscrits validés | `{ expeditionId, expeditionName, rdvAt }` (J-1 à 9h locale) |
| `expedition_report_posted` | Inscrits validés | `{ expeditionId, expeditionName, authorName, isPublic }` |

Wordings dans `formatMessage()` à compléter (cf. NotificationPanel.tsx). Icons : 🚩 (`expedition_*` génériques) ou variations (📍 modif lieu, ⏰ rappel, 📜 compte rendu).

---

## 5. RPCs

Toutes en `SECURITY DEFINER` avec contrôle d'autorisation explicite (cf. discipline §A3).

| RPC | Rôle | Auth check |
|---|---|---|
| `create_expedition(name, description, rdv_at, rdv_lat, rdv_lng, rdv_label, slots_max, slots_open, validation_mode)` | Crée une expé. Vérifie limite ≤ 3 expés actives en tant que chef. | Connecté |
| `update_expedition(id, ...patches)` | Modifie une expé. Notifie les validés si champ "sensible" change. Refuse si statut ≠ `published`. | Chef |
| `cancel_expedition(id)` | Passe en `cancelled`, notifie les validés. | Chef |
| `request_join_expedition(id, message?)` | Crée une ligne `pending`. Si `validation_mode = 'free'` ET (slot libre OU `slots_open = true`) → bascule directement en `validated` + notif `expedition_validated`. Sinon, reste `pending` (file d'attente même si complet, le chef pourra valider en cas d'éjection ou de retrait). | Connecté, pas chef de cette expé, pas déjà inscrit (lignes `withdrawn` ou `rejected` autorisent une nouvelle demande) |
| `respond_join_request(expedition_id, user_id, decision)` | Accepte (`validated`) ou refuse (`rejected`). Vérifie slots. Notifie le demandeur. | Chef de l'expé |
| `withdraw_from_expedition(id)` | Retire un participant. Libère un slot. | Participant lui-même |
| `eject_participant(expedition_id, user_id)` | Chef éjecte un participant validé. | Chef |
| `send_expedition_message(expedition_id, content)` | Insert dans `expedition_messages`. | Participant validé ou chef |
| `mark_expedition_messages_read(expedition_id)` | Update `expedition_message_reads.last_read_at`. | Participant validé ou chef |
| `upsert_expedition_report(expedition_id, text_content, is_public, cover_media_id)` | Crée/met à jour le compte rendu. Si premier post → +10 XP via `add_user_xp` + flag `xp_awarded = true`. Notifie les autres participants. Refuse si statut = `published` (pas de CR avant la date). | Participant validé ou chef |
| `register_expedition_media(expedition_id, storage_path, kind, size_bytes, duration_seconds)` | Lie un média uploadé au compte rendu (à appeler après upload Supabase Storage). | Auteur du compte rendu |
| `delete_expedition_media(media_id)` | Supprime média (Storage + ligne DB). | Auteur ou chef |
| `flag_expedition(expedition_id, reason, comment?)` | Crée un signalement. | Connecté |
| `get_expedition(id)` | Détails complets selon le caller (coque publique vs cœur privé). | Tous |
| `list_expeditions_upcoming()` | Liste publique pour le Tableau (status = `published`), tri `rdv_at` asc. | Tous |
| `list_expeditions_archives(limit, offset)` | Liste archive publique (status = `archived`), tri `rdv_at` desc. | Tous |
| `list_my_expeditions()` | Pour le profil joueur : créées + rejointes (validated/withdrawn). | Connecté |

**Job d'archivage** : RPC `archive_passed_expeditions()` à appeler par cron (toutes les heures) qui :
1. Bascule `status = 'passed'` les expés en `published` dont `rdv_at <= now()`
2. Bascule `status = 'archived'` celles en `passed` dont `rdv_at + 30 days <= now()`
3. Supprime dur (DELETE CASCADE en BDD + purge des médias associés dans le bucket `expedition-medias`) les `cancelled` dont `cancelled_at + 30 days <= now()`. Le cascade SQL nettoie les tables liées ; un appel auxiliaire purge les blobs Storage orphelins via une boucle sur `expedition_report_medias.storage_path` avant le DELETE de l'expédition.

Implémenté via `pg_cron` si dispo, sinon Edge Function Supabase Scheduled.

---

## 6. UI / composants frontend

### 6.1 Tableau de Quêtes — onglet "Expéditions"

Nouveau composant `apps/explore-web/src/components/quests/QuestsBoard.tsx` (sous-dossier à créer), avec onglets internes :
- *Quêtes du jour* (mini-quêtes journalières — autre spec)
- *Expéditions* (cette spec) — sous-onglets : **À venir** / **Archives**
- *Missions* (à venir) — placeholder "Bientôt"

L'onglet **Expéditions / À venir** affiche :
- En haut : bouton **"+ Créer une expédition"** (CTA principal sépia)
- Liste de cards (expé) triée par `rdv_at` asc :
  - Bannière (mini-asset)
  - Nom de l'expédition
  - Date relative ("Demain", "Dans 4 jours", "Le 15 juin")
  - Lieu (label texte ou coordonnées formatées)
  - Chef (avatar + prénom)
  - Slots ("3/5 places" ou "Ouvert · 7 inscrits")
  - Pill statut : *Demande envoyée* / *Validé* / *Complet* / vide

L'onglet **Expéditions / Archives** affiche :
- Liste de cards triée par `rdv_at` desc, identique mais avec :
  - Coque publique seulement
  - Si participant ou chef → indicateur "Tu y étais" + accès cœur privé direct
  - Aperçu **galerie** (3 vignettes) si elle contient des médias publics

### 6.2 Bannière sur la carte

Nouveau marker `ExpeditionBanner` dans `apps/explore-web/src/components/map/markers/`. Asset SVG sépia inspiré d'un drapeau planté (proche du marker Veilleur sans en être un duplicata). État visuel selon `rdv_at` :
- **`rdv_at - now() > 7j`** : opacité 60 %, label "Bientôt"
- **`now() ≤ rdv_at ≤ now()+7j`** : opacité 100 %, label "Bientôt"
- **`now() ≤ rdv_at ≤ now()+24h`** : ajout d'un halo doré pulsant, label "Demain" ou "Aujourd'hui"
- **Date passée** : retiré de la carte

Tap sur la bannière → ouvre `ExpeditionModal`.

LOD : à zoom < 8, les bannières basculent en marker layer natif WebGL (point de couleur héritage chef, comme proposé dans la méta-spec pour les Campements).

### 6.3 ExpeditionModal

Nouveau `apps/explore-web/src/components/expeditions/ExpeditionModal.tsx`. Mobile = bottom sheet 95 % ; desktop = modale centrale 720px.

**Header** : nom de l'expédition, pill statut, bouton fermer + (si chef) menu kebab (modifier, annuler).

**Bloc info** :
- Date+heure (format français : *Vendredi 20 juin · 14:00*)
- Lieu (mini-carte 200×120 + label si fourni)
- Chef (avatar + prénom + niveau)
- Slots ("3/5 places")
- Description (si fournie)

**Section "Participants"** (visible si chef ou validé) :
- Liste des validés (avatars + prénoms cliquables → profil)
- Si chef : liste des `pending` avec leur message court + boutons **Accepter** / **Décliner**

**Section "Chat"** (visible si chef ou validé, statut `published` ou `passed`) :
- Réutilise le pattern de `ChatPanel.tsx` mais sur table `expedition_messages` + channel Realtime `expedition:{id}`
- Compteur non-lu via `expedition_message_reads`
- Read-only si statut = `archived` ou `cancelled`

**Section "Comptes rendus & galerie"** (visible si statut ∈ `passed`, `archived` ; cœur privé pour validés/chef, coque publique pour autres) :
- **Galerie** : grille 3 colonnes mosaïque (photos + thumbnails vidéos), tap → fullscreen viewer (composant à factoriser, possible réutilisation `MediaViewer` existant)
- **Liste des comptes rendus** :
  - Chaque card : avatar auteur + texte + médias inline + badge "Public" si `is_public`
  - Si caller = participant qui n'a pas encore posté → CTA **"Laisser mon compte rendu"** ouvre `ReportEditor`
  - Coque publique (non-participant) : seulement comptes rendus `is_public = true`

**Bouton "Signaler"** discret en footer (3 raisons + commentaire optionnel).

### 6.4 ExpeditionCreator (formulaire de création)

Nouveau `apps/explore-web/src/components/expeditions/ExpeditionCreator.tsx`. Étapes (modale ou stepper) :

1. **Lieu** : tap sur la carte pour planter la bannière (mode "création active"), libellé optionnel
2. **Détails** : nom (obligatoire), description (optionnelle)
3. **Date+heure** : datepicker (rdv_at obligatoire, futur)
4. **Slots** : choix radio "Nombre fixe" (slider 2-50) ou "Ouvert"
5. **Validation** : toggle "Validation manuelle" (défaut ON) ou "Inscription libre"
6. **Confirmation** : récap + CTA **"Publier l'expédition"**

### 6.5 ReportEditor

Nouveau `apps/explore-web/src/components/expeditions/ReportEditor.tsx`. Permet :
- Texte (1000 char max, compteur)
- Upload jusqu'à N médias (photo/vidéo)
- Choix d'une **photo de couverture** (uniquement si `is_public`)
- Toggle **"Rendre public"** (défaut OFF)
- CTA "Enregistrer mon compte rendu"

À l'enregistrement initial → +10 XP (toast).

### 6.6 Profil joueur — section "Mes expéditions"

Onglet ajouté à `PlayerProfileModal.tsx` :
- **À venir** : liste des expés où le user est chef ou validé, statut `published`
- **Passées** : statut `passed` + `archived`, tri date desc
- **Annulées** : statut `cancelled` (visibles 30j seulement)
- Pour les autres profils (vue tierce) : seulement la coque publique des passées + archivées + opt-in compte rendu de ce user.

### 6.7 Notifications — extension du `NotificationPanel`

Nouveaux wordings dans `formatMessage()` (cf. §4.3). Icônes ajoutées dans `TYPE_ICONS`. Le `NotificationBell` non modifié structurellement.

### 6.8 Toasts

Toast in-app via `toastStore` existant pour les notifications déclenchées en temps réel (Supabase Realtime sur `notifications`). Pas de push V1 (Web Push à étendre dans une autre passe — l'app a déjà un fondement FCM partiel).

---

## 7. Récompenses & économie

| Action | Récompense | Note |
|---|---|---|
| Créer une expédition | 0 | Acte gratuit |
| Rejoindre une expé (validé) | 0 | Acte gratuit |
| Poster son compte rendu | **+10 XP** (1 fois) | Via `add_user_xp` existant. Flag `xp_awarded` empêche double-attribution si le user édite |
| Avoir des comptes rendus publics | 0 mais valeur sociale (vitrine archives) | Pas d'XP supplémentaire pour éviter le grind |

**Pas de Couronnes** dans cette feature — l'économie reste lisible (Couronnes = moisson + futures missions Hub).

---

## 8. Modération & signalement

- Bouton **"Signaler"** discret sur `ExpeditionModal` (3 raisons : spam / contenu inapproprié / autre + commentaire ≤500 char optionnel).
- Les signalements remontent dans le **Hub** (à designer dans une passe Hub V2).
- Pas d'auto-modération en V1 (volume insuffisant, modération manuelle suffisante).
- Pas de **blocage utilisateur** (utilisateur A ne peut pas voir/inscrire chez utilisateur B) en V1 — à ajouter si nécessaire post-launch.
- Suppression d'urgence par admin (Uriel/Mathéo) via le Hub : RPC `admin_delete_expedition(id)` à prévoir, accès limité par claim JWT.

---

## 9. Hors-scope V1

- ❌ Push notifications (Web Push) — toast in-app suffit
- ❌ Notification géolocalisée "expé créée à 50km de toi" — bruit, à voir post-launch
- ❌ Modération automatique (filtre spam/contenu)
- ❌ Blocage utilisateur (ne pas voir / ne pas être vu par X)
- ❌ Co-organisation (plusieurs chefs)
- ❌ Slots avec rôles ("2 expérimentés + 3 novices")
- ❌ Coût/récompense en Couronnes
- ❌ Tampons / badges (V0.7+ système séparé qui s'appliquera *à terme* aux expéditions notables)
- ❌ Évaluation post-expé entre participants (notation, "ami fiable", etc.)
- ❌ Intégration calendrier (export iCal)
- ❌ Mode "expédition récurrente" (rando du dimanche hebdomadaire)

Ces extensions s'appuieront sur l'archi posée sans refactor.

---

## 10. Risques & dépendances

### 10.1 Risques

| Risque | Mitigation |
|---|---|
| **Spam d'expéditions fictives** | Limite 3 actives par chef + signalement + modération Hub |
| **Stockage médias qui explose** | Limites 10 MB photo / 50 MB vidéo + cleanup auto à la suppression de l'expé. Cron mensuel pour orphans. |
| **No-show le jour J** | Pas mitigé — c'est une dynamique IRL, on ne pénalise pas. À terme, système d'évaluation (V0.8+) |
| **Modération absente / lente** | Hub V2 à prioriser pour outils admin. Mathéo désigné premier modérateur (à confirmer) |
| **Compte rendu public exploité** (qq'un poste un texte injurieux/illégal) | Bouton signaler + suppression admin via Hub. Limite 1000 char. |
| **Cron archivage qui ne tourne pas** | Implémenter en `pg_cron` natif Supabase (le plus fiable) avec alerte si pas exécuté > 2h |
| **Réalisation tardive d'un besoin "expé sans date"** | Refus volontaire — date obligatoire en V1. Si retours utilisateurs forts post-launch, `rdv_at` peut devenir nullable + statut "ouvert" |
| **UX bannière confondue avec marker Veilleur ou futur marker Mission** | Direction artistique distincte (forme + couleur). Maquette validation visuelle avant dev. |

### 10.2 Dépendances

- ✅ Système Niveaux V0.7.0 — `add_user_xp` existant
- ✅ Système Notifications existant — extension simple via nouveaux types
- ✅ ChatPanel pattern existant — réutilisable pour `expedition_messages`
- ✅ Supabase Realtime déjà en prod
- ✅ Toast system existant
- ⚠️ **Bucket `expedition-medias` à créer** côté Supabase (RLS à écrire)
- ⚠️ **`pg_cron`** ou Edge Function Scheduled à activer pour le job d'archivage
- ⚠️ **Hub V2** pour gérer signalements (peut être livré séparément après V1 expéditions)

---

## 11. Plan d'implémentation (résumé)

À détailler dans un plan d'implémentation séparé (`writing-plans` skill). Direction :

1. **Migration SQL** : 7 tables (`expeditions`, `expedition_participants`, `expedition_messages`, `expedition_message_reads`, `expedition_reports`, `expedition_report_medias`, `expedition_flags`) + index
2. **Bucket Storage** + RLS
3. **RPCs** : ~17 RPCs listées en §5
4. **Job archivage** : `archive_passed_expeditions()` + setup `pg_cron`
5. **Extension notifications** : 7 nouveaux types + wordings + icons
6. **Frontend** :
   - `QuestsBoard.tsx` (onglet conteneur + sous-onglets Expéditions)
   - `ExpeditionBanner` (marker carte)
   - `ExpeditionCreator` (formulaire création, stepper)
   - `ExpeditionModal` (vue détaillée, chat intégré, comptes rendus)
   - `ReportEditor` (compte rendu + médias)
   - Onglet "Mes expéditions" dans `PlayerProfileModal`
7. **Tests manuels** : flux complet création → demande → validation → chat → date passée → compte rendu → archivage
8. **Mise à jour `apps/explore-web/CLAUDE.md`** : ajouter le sous-dossier `components/expeditions/` + nouveau store si créé + nouvelles RPCs notables

**Effort estimé** : ~5-7 jours (1.5j SQL + RPCs + bucket, 3-4j frontend, 1j tests + ajustements). À calibrer dans le plan détaillé.

---

## 12. Annexes

### 12.1 Pitch marketing (pour briefing associés)

Cf. session brainstorm 2026-05-06 — pitch validé Uriel :

> **En une phrase** — Un Voyageur peut désormais convoquer ses pairs en un lieu et une date — planter sa bannière sur la carte, ouvrir un chat de préparation, accueillir ceux qu'il choisit, et garder avec eux la trace de ce qu'ils ont vécu.

**Quatre piliers stratégiques** :
1. La carte cesse d'être un solo — la promesse "partir à l'aventure ensemble" passe enfin du discours à la mécanique
2. Une mémoire qui se constitue toute seule — les Archives racontent l'histoire vivante de la communauté
3. Un canal de preuve sociale qui ne ressemble pas à du marketing — pas du contenu sponsorisé, du vrai vécu
4. Le festival devient permanent — chaque voyageur peut convoquer son propre rassemblement local

### 12.2 Sources mémoire pertinentes

- `project_campement_permanent_abandonne.md` — pivot 2026-05-06
- `feedback_simplify_not_complexify.md` — règle de simplicité avant complexité
- `feedback_pareto_durabilite.md` — Pareto durable
- `feedback_no_spoilers_user_facing.md` — pas de spoilers énigmes (s'applique aux comptes rendus)
- `feedback_ui_sobre_pas_rpg.md` — UI sobre logiciel, pas RPG
- `feedback_v07_design_humain_vs_tribal.md` — humain > tribal (chef d'expédition par nom, pas emblème)
- `reference_xo_discipline.md` — discipline XO (RPCs, redéfinition baseline, ALTER PUBLICATION en DO block)

### 12.3 Conditions de succès post-launch

- ≥ 5 expéditions actives à tout moment dans le mois suivant le lancement
- ≥ 50 % des participants validés postent un compte rendu
- ≥ 30 % des comptes rendus sont marqués `is_public`
- 0 incident modération nécessitant une action en urgence dans les 30 premiers jours

### 12.4 Références cadres

- Méta-spec V0.7 articulation : [`2026-05-01-v07-articulation-campement-quetes-influence-design.md`](2026-05-01-v07-articulation-campement-quetes-influence-design.md)
- Spec mini-quêtes journalières : [`2026-05-02-v07-mini-quetes-journalieres-design.md`](2026-05-02-v07-mini-quetes-journalieres-design.md)
- Stratégie 2026 : `~/citadelle/🧭 STRATEGIE 2026.md`
- Bible Game Design : `~/citadelle/📱 L'application (La Carte)/🎮 Bible Game Design.md`
