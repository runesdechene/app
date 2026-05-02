# V0.7 — Mini-quêtes journalières

> **Statut** : design validé Uriel le 2026-05-02.
> **Cible** : V0.7+ pré-lancement public. Livré en parallèle de la spec micro-social emoji + notes.
> **Référence cadre** : méta-spec [`2026-05-01-v07-articulation-campement-quetes-influence-design.md`](2026-05-01-v07-articulation-campement-quetes-influence-design.md) §6 (Sous-système 2 — Quêtes).
> **Pivot stratégique 2026-05-02** : Campement parké (cozy game, plus tard ou jamais). Les Quêtes deviennent un livrable principal du V0.7+ pré-lancement, aux côtés du micro-social emoji+notes et du brouillage GPS.

---

## 1. Contexte & motivation

V0.7.0 a livré le système de Niveaux où la simple **Découverte** (lever le brouillard sur un lieu sans s'y rendre) rapporte **0 XP** — décision anti-farm validée. Conséquence : les joueurs n'ont plus de gratification immédiate pour leur exploration cartographique de salon. Les mini-quêtes journalières comblent ce vide en récompensant l'exploration **canalisée** (3-4 actions par jour qui correspondent au cœur du jeu : marcher, découvrir, jouer, créer du lien social).

Le pivot stratégique du 2026-05-02 a confirmé que les Quêtes sont un **levier critique du lancement public**, parce qu'elles offrent un rituel quotidien qui structure le retour du joueur sur l'app sans complexité technique. C'est l'antidote à la dispersion qu'on craignait avec le Campement complet.

---

## 2. Décisions stratégiques (résumé exécutif)

| Décision | Choix retenu | Raison |
|---|---|---|
| **Scope V0.7+** | 4 quêtes journalières fixes, pas de banque, pas de tirage | Ultra-lean. Variété viendra avec hebdo (V0.7+) puis suggestions locales (V0.7+) puis quêtes éditoriales marque (V0.7+) |
| **Structure récompenses** | XP + 🪙 viennent uniquement des coffres de moisson, pas des quêtes elles-mêmes | Cohérence économie Couronnes : les Couronnes restent la moisson de la veille active sur lieux foulés |
| **Reset** | Minuit **local** (timezone du device) | Naturel pour le joueur. Risque de triche timezone marginal (RdC = communauté française à 95%) |
| **Hebdomadaire cartographie** | **Repoussé V0.7+** | Pas dans le scope du lancement. À ajouter si l'usage des dailies montre un appétit pour plus |
| **Suggestions locales (c)** | **Repoussées V0.7+** | Demandent moteur de génération géographique. Risque d'edge cases (festivals isolés, étranger, campagne). À ajouter une fois la base validée |
| **Quêtes éditoriales marque** | **Repoussées V0.7+** | Demandent UI Hub + workflow de publication. À designer dans une spec dédiée |
| **Architecture DB** | Polymorphe dès V0.7+ (table `quest_templates` avec ENUM `type`) | Anticipe l'arrivée des suggestions locales / éditoriales / expéditions sans refactor |
| **Déclenchement quêtes** | Auto-tracking via les actions joueur existantes (foulage, découverte, énigme, emoji-throw) | Pas de bouton "claim", pas de friction, le toast suffit |

---

## 3. Tableau des 4 quêtes journalières

Toutes les 4 sont **fixes chaque jour**. Pas de banque, pas de tirage.

| # | Verbe / Wording | Mécanique tracker | Récompense | Dépendance |
|---|---|---|---|---|
| 1️⃣ | **« Récupère la moisson d'au moins 2 lieux »** | Compte les coffres de moisson ouverts dans la journée par l'utilisateur. Seuil : ≥ 2 | +3 XP | ✅ Mécanique Couronnes V0.7.0 livrée |
| 2️⃣ | **« Lève le brouillard sur 2 lieux »** | Compte les nouvelles découvertes (lieux passés de fogged à découvert) dans la journée. Seuil : ≥ 2 | +5 XP | ✅ Mécanique brouillard existante |
| 3️⃣ | **« Tente l'énigme du jour »** | Vérifie qu'une réponse a été soumise à l'énigme du jour (qu'elle soit bonne ou non) | +5 XP | ✅ `DailyEnigma.tsx` existant |
| 4️⃣ | **« Lance un emoji à un voyageur ou réagis à sa note »** | Vérifie qu'au moins une action sociale a été émise dans la journée (1 emoji-throw envoyé OU 1 réaction sur note) | +3 XP | ⚠️ **Spec micro-social** [`2026-05-02-v07-micro-social-emoji-notes-design.md`](2026-05-02-v07-micro-social-emoji-notes-design.md) |

**Total potentiel par jour** : +16 XP, soit ~10-15% d'un niveau bas, ~3-5% d'un niveau moyen.

---

## 4. UI Tableau de Quêtes

### 4.1 Placement

**Bouton dédié dans le HUD principal** (pas de modale au login intrusive). L'icône 🗒️ ou 📜 (à finaliser dans le mockup d'implémentation) ouvre une bottom sheet (mobile) ou modale (desktop) "Tableau de Quêtes du jour".

Position du bouton à valider à l'implémentation parmi les emplacements HUD libres. Ne pas occuper la place réservée au futur bandeau de présence (Campement V0.7+).

### 4.2 Composition de la modale

- **Titre** : « Quêtes du jour »
- **Date du jour** en sous-titre discret (ex : *« Vendredi 2 mai »*)
- **Liste des 4 quêtes** en cards verticales :
  - Icône thématique (🪙 / 🌫️ / 🗝️ / 👋)
  - Wording de la quête
  - Récompense (badge `+5 XP`)
  - **État de progression** :
    - À faire — fond crème, opacité normale
    - En cours (ex : 1/2 lieux foulés) — barre de progression discrète
    - Complétée — fond vert pâle, ✓ vert, opacité réduite
- **Footer** : « Reset à minuit » + heure locale calculée

### 4.3 Notification de complétion

À chaque complétion d'une quête, un **toast non-intrusif** s'affiche en haut de l'écran :

> 🎯 **Quête accomplie : Lève le brouillard sur 2 lieux** · +5 XP

Le toast utilise le système `toastStore` existant. Pas de modale qui interrompt le jeu.

---

## 5. Comportement et règles

### 5.1 Reset journalier

- Le reset se fait à **minuit local** du device.
- Côté serveur : on stocke `users.timezone` (mis à jour à chaque session via `Intl.DateTimeFormat().resolvedOptions().timeZone`).
- Le calcul de "aujourd'hui" se fait côté serveur en convertissant `NOW()` dans la timezone du user pour déterminer la date `YYYY-MM-DD` de la journée en cours.
- À 00:00 local du joueur, l'état de progression repart à zéro.

### 5.2 Auto-tracking des progrès

Le tracker est **passif** : aucune action explicite côté joueur n'est nécessaire pour "valider" une quête. Le serveur incrémente le compteur à chaque action (foulage, découverte, etc.) et déclenche le toast + l'attribution XP dès le seuil atteint.

### 5.3 Pas de "claim" manuel

La récompense est **attribuée automatiquement** dès le seuil atteint. Pas de bouton "récolter ma récompense". Évite la friction et le risque d'oubli.

### 5.4 Pas d'expiration des récompenses

Si le joueur n'ouvre pas l'app de la journée mais a fait toutes les actions (rare cas : il est connecté, fait les actions en background via webhooks ?). Dans la pratique, les actions tracké demandent que le joueur soit dans l'app, donc le toast s'affiche au moment de l'action. Pas de cas où la récompense serait "perdue".

### 5.5 Comportement multi-device

Si le joueur ouvre l'app sur 2 devices simultanément, le tracker est synchronisé côté serveur. Le toast peut s'afficher 2x (une fois par device) ou idéalement 1x via le canal realtime. À implémenter : préférer le toast unique via realtime.

---

## 6. Architecture technique

### 6.1 Tables

**Polymorphe dès V0.7+** pour anticiper les types futurs sans refactor.

```sql
-- Table des templates de quêtes (seed pour les 4 dailies)
CREATE TABLE quest_templates (
  id text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('daily', 'weekly', 'editorial', 'local', 'campement_issued', 'expedition')),
  wording text NOT NULL,            -- « Lève le brouillard sur 2 lieux »
  icon text NOT NULL,               -- '🌫️'
  tracker_kind text NOT NULL,       -- 'discoveries', 'gps_visits', 'enigma_attempt', 'social_action', 'moisson_claims'
  threshold integer NOT NULL,       -- 2
  reward_xp integer NOT NULL,       -- 5
  reward_couronnes integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Progression journalière par user
CREATE TABLE user_quest_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_template_id text NOT NULL REFERENCES quest_templates(id),
  date_local date NOT NULL,         -- YYYY-MM-DD selon timezone du user
  count integer NOT NULL DEFAULT 0,
  completed_at timestamptz,         -- NULL tant que pas complété
  rewarded boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, quest_template_id, date_local)
);

-- Index pour lookup rapide
CREATE INDEX idx_user_quest_progress_today ON user_quest_progress(user_id, date_local);
```

Et une colonne sur `users` :

```sql
ALTER TABLE users ADD COLUMN timezone text NOT NULL DEFAULT 'Europe/Paris';
```

### 6.2 Seed des 4 templates

```sql
INSERT INTO quest_templates (id, type, wording, icon, tracker_kind, threshold, reward_xp, reward_couronnes) VALUES
  ('daily_moisson', 'daily', 'Récupère la moisson d''au moins 2 lieux', '🪙', 'moisson_claims', 2, 3, 0),
  ('daily_brouillard', 'daily', 'Lève le brouillard sur 2 lieux', '🌫️', 'discoveries', 2, 5, 0),
  ('daily_enigme', 'daily', 'Tente l''énigme du jour', '🗝️', 'enigma_attempt', 1, 5, 0),
  ('daily_emoji', 'daily', 'Lance un emoji à un voyageur ou réagis à sa note', '👋', 'social_action', 1, 3, 0);
```

### 6.3 RPCs

**`get_user_quests_today(p_user_id)`** — Renvoie la liste des 4 quêtes du jour avec leur état de progression (count, completed, rewarded).

**`increment_quest_progress(p_user_id, p_tracker_kind, p_amount)`** — Incrémente le compteur des quêtes correspondantes pour la date locale du user. Si seuil atteint et `completed_at IS NULL` : remplit `completed_at`, attribue les XP via `add_user_xp` existant, marque `rewarded = true`. Renvoie la liste des quêtes nouvellement complétées (pour déclencher les toasts client).

**`update_user_timezone(p_timezone)`** — Met à jour `users.timezone`.

### 6.4 Hooks d'auto-tracking

Les RPCs existantes qui produisent les actions trackées doivent appeler `increment_quest_progress` :

| Action joueur | RPC existante | Tracker à incrémenter |
|---|---|---|
| Foule un lieu en GPS | `record_gps_visit` (à confirmer) | (rien — V0.7+ ?) |
| Lève brouillard sur un lieu | `discover_place` (à confirmer) | `discoveries` (+1) |
| Soumet réponse à énigme du jour | `submit_daily_enigma` (à confirmer) | `enigma_attempt` (+1) |
| Récupère la moisson d'un lieu (clic coffre) | RPC moisson V0.7.0 | `moisson_claims` (+1) |
| Envoie un emoji-throw OU réagit à une note | RPC `throw_emoji` ou `react_to_note` (spec micro-social) | `social_action` (+1) |

**Vérification à l'implémentation** : les noms exacts des RPCs sont à valider via Graphify (`graphify-out/graph.json`). Si une RPC n'existe pas (ex : pour le foulage GPS qui n'est pas dans V0.7), le hook est ajouté plus tard.

### 6.5 Realtime

Quand `increment_quest_progress` détecte une complétion, broadcast un payload sur le channel Supabase Realtime `user-events:{user_id}` :

```json
{ "type": "quest_completed", "quest_template_id": "daily_brouillard", "reward_xp": 5 }
```

Le client est abonné au channel et déclenche le toast. Évite le double-toast multi-device et permet une UX fluide.

---

## 7. Récompenses & calibration XP

### 7.1 Calibration

| Quête | XP | Justification |
|---|---|---|
| 1️⃣ Moisson 2 lieux | +3 | Action passive (clic), faible effort. Bonus de régularité |
| 2️⃣ Brouillard 2 lieux | +5 | Action de découverte (qui rapporte sinon 0 XP en brut depuis V0.7.0). Compense légèrement |
| 3️⃣ Énigme du jour | +5 | Action de réflexion, mérite récompense (bonne réponse ou non — la tentative compte) |
| 4️⃣ Lance emoji ou réagit à note | +3 | Action sociale légère, bonus de socialisation |
| **Total max/jour** | **+16 XP** | ~10-15% d'un niveau bas, ~3-5% d'un niveau moyen |

### 7.2 Pas de Couronnes en récompense de quête

Décision actée : les Couronnes viennent **uniquement** de la moisson des coffres (mécanique V0.7.0). Les quêtes ne distribuent **que de l'XP**. Pareto durable : économie Couronnes lisible avec une seule source.

---

## 8. Hors-scope V0.7+

Anticipé dans l'archi mais **pas livré** :

- ❌ Hebdomadaire cartographie (« Cartographie 1 nouveau lieu cette semaine »)
- ❌ Suggestions locales (quêtes générées par proximité GPS)
- ❌ Quêtes éditoriales marque (Hub admin pour publier)
- ❌ Quêtes émises depuis un Campement
- ❌ Expéditions multi-joueurs
- ❌ Tampons / stickers (réservés aux quêtes éditoriales et expéditions, cf. méta-spec §6.3)

Ces extensions s'appuieront sur la table polymorphe `quest_templates` + `user_quest_progress` sans refactor.

---

## 9. Risques & dépendances

### 9.1 Risques

| Risque | Mitigation |
|---|---|
| **Quêtes trop répétitives** (4 mêmes chaque jour, usure rapide) | Volontaire pour V0.7+ : "rituel quotidien". Variété viendra avec hebdo + locales + éditoriales en V0.7+. À monitorer sur ~1 mois post-launch |
| **Cassure du timezone** si user voyage à l'étranger | `users.timezone` mis à jour à chaque session. Légère fenêtre de désynchro acceptable (< 24h) |
| **Auto-tracking manqué** si une RPC existante n'appelle pas `increment_quest_progress` | Vérification manuelle à l'implémentation : grep des RPCs concernées + tests |
| **Surcharge Realtime** si trop de notifs simultanées | Un user reçoit max 4 events `quest_completed` par jour. Charge négligeable |

### 9.2 Dépendances

- ✅ Système Niveaux V0.7.0 — `add_user_xp` existant
- ✅ Système Couronnes V0.7.0 — moisson des coffres existante
- ✅ Système Énigme du jour — `DailyEnigma.tsx` existant
- ⚠️ **Système micro-social emoji + notes** (spec parallèle) — la quête #4 dépend de ses RPCs `throw_emoji` et `react_to_note`. Ordre d'implémentation : micro-social d'abord, puis quêtes
- ✅ Toast system existant (`toastStore.ts`)
- ✅ Supabase Realtime déjà en place

---

## 10. Plan d'implémentation (résumé)

À détailler dans un plan d'implémentation séparé (skill writing-plans). Direction :

1. **Migration SQL** : tables `quest_templates` + `user_quest_progress` + colonne `users.timezone` + seed des 4 templates
2. **RPCs** : `get_user_quests_today`, `increment_quest_progress`, `update_user_timezone`
3. **Hooks** : modification des RPCs `discover_place`, `submit_daily_enigma`, RPC moisson, et RPCs micro-social pour appeler `increment_quest_progress`
4. **Realtime** : broadcast sur `user-events:{user_id}` à la complétion
5. **Frontend** :
   - Composant `QuestsPanel.tsx` (modale/bottom sheet)
   - Bouton 🗒️ dans le HUD
   - Subscriber Realtime + intégration `toastStore`
   - Hook `useUserQuests()` qui fetch via `get_user_quests_today`
6. **Tests manuels** : faire les 4 actions, vérifier toasts, vérifier persistence du progress après refresh, vérifier reset à minuit local

**Effort estimé** : ~2.5 jours (~1j SQL + RPCs, ~1j frontend, ~0.5j tests + ajustements).

---

## 11. Annexes

### 11.1 Décisions explicites de simplification

- ❌ Banque + tirage aléatoire → 4 quêtes fixes (variété viendra avec hebdo/locales/éditoriales)
- ❌ Système de "streaks" (X jours consécutifs) → pas de gamification anxiogène, pareto durable
- ❌ Notifications push pour quêtes complétées → pareto, toast in-app suffit
- ❌ UI "ma progression historique" → pas de stockage long-terme, on ne voit que la journée

### 11.2 Conditions de succès post-launch

- ≥ 60% des joueurs actifs complètent au moins 1 quête par jour
- ≥ 30% des joueurs actifs complètent les 4 quêtes par jour
- Taux de retour J+1 amélioré vs baseline V0.7.0 (mesure à comparer)

### 11.3 Références

- Méta-spec V0.7 articulation : [`2026-05-01-v07-articulation-campement-quetes-influence-design.md`](2026-05-01-v07-articulation-campement-quetes-influence-design.md)
- Spec parallèle micro-social : [`2026-05-02-v07-micro-social-emoji-notes-design.md`](2026-05-02-v07-micro-social-emoji-notes-design.md)
- Spec brouillage GPS (à exécuter en parallèle) : [`2026-05-01-v07-eco-merveille-mvp-design.md`](2026-05-01-v07-eco-merveille-mvp-design.md) §3
- Bible Game Design : `~/citadelle/📱 L'application (La Carte)/🎮 Bible Game Design.md`
