# V0.7 — Micro-social : lancer d'emoji + notes éphémères

> **Statut** : design validé Uriel le 2026-05-02.
> **Cible** : V0.7+ pré-lancement public. Livré en parallèle de la spec mini-quêtes journalières.
> **Référence cadre** : remplace la « note partagée » du MVP ECO Merveille ([`2026-05-01-v07-eco-merveille-mvp-design.md`](2026-05-01-v07-eco-merveille-mvp-design.md) §4) jugée pas utile en standalone, et l'ensemble du Campement complet (méta-spec §5) parqué.
> **Pivot stratégique 2026-05-02** : Campement parké (cozy game). Le micro-social devient la mécanique principale de "vie sur la carte" en pré-lancement, **inspirée Zenly**.

---

## 1. Contexte & motivation

Le besoin Uriel exprimé le 2026-05-02 : *« les gens se plaignent que sur la carte on ne puisse pas vraiment interagir entre nous, à part avec le chat. »* Le chat existant (texte, séparé de la carte) est jugé insuffisant — il faut une mécanique d'interaction **directement sur la carte**, **immédiate**, **visuelle**, qui donne envie aux gens de communiquer entre eux et qui met **de la couleur et de la vie sur la carte**.

Inspiration directe : **Zenly** (l'app de localisation des amis qui avait une mécanique signature d'emojis lancés entre avatars). Le geste est : *« hey coucou je suis là, viens on va discuter dans le chat public. »*

La note partagée du MVP ECO Merveille avait été abandonnée plus tôt dans la session ("pas utilisée") puis reconsidérée parce qu'avec **les réactions emoji**, elle devient un objet social actif et non plus un journal intime perdu sur un profil.

---

## 2. Décisions stratégiques (résumé exécutif)

| Décision | Choix retenu | Raison |
|---|---|---|
| **Mécanique principale** | Lancer d'emoji ("emoji-throw") façon Zenly | Précédent prouvé. Visuel, fun, organique |
| **Surclick** | Libre, pas de throttle | C'est le sel du mécanisme. Permet la rafale comique et expressive |
| **Portée** | Visible à l'écran (viewport) | L'animation reste toujours visible. La carte filtre naturellement le social |
| **Stockage emoji-throws** | **Aucun** (pas de DB write) | Temps réel pur. Si tu rates, tu rates. *« Au moins tu le reçois, c'est beau. »* |
| **Notes** | Texte court ≤200 char, durée 24h, bulle parchemin permanente sous l'avatar | Surface d'expression + objet social actif via réactions emoji |
| **Réactions sur notes** | Stockées en DB pendant la vie de la note (24h max), 1 emoji par paire (note × user × emoji) | Compteur empilé sous la note. Pas de spam |
| **Anti-harcèlement** | Mute Soft uniquement (V0.7+) | Block dur ajouté en V0.7+ si nécessaire post-launch |
| **Notifications push** | **Aucune** | Pareto. La carte vit en temps réel uniquement. Pas de chantier infra FCM/Web Push |
| **Banque emoji** | Preset RdC curé (~33 emojis) | Pas d'Unicode complet, sinon dérive vers du 💩 hors-marque |

---

## 3. Mécanique 1 — Notes éphémères

### 3.1 UX

- **Édition** : depuis la modale de son propre profil, un champ texte avec un crayon ✏️. Sauvegarde au blur. Limite 200 char, compteur visible.
- **Affichage** : bulle parchemin **permanente sous l'avatar** sur la carte, à zoom rapproché (≥ 12). À dézoom (< 12), la note disparaît visuellement (juste l'avatar).
- **Style de la bulle** : fond `#fdf3d6`, bordure `#c8a874`, texte italique sépia, nom de l'auteur en uppercase au-dessus en plus petit. Coin replié subtil pour le côté parchemin.
- **Pas de redondance** : si l'utilisateur n'a pas de note posée, son avatar est nu (aucun badge, aucune indication).
- **Édition inline depuis la carte ?** Non pour V0.7+. Édition uniquement depuis la modale profil pour limiter la surface UI.

### 3.2 Cycle de vie (24h)

- **T0** — l'utilisateur poste sa note via la modale profil → broadcast sur la carte
- **T+x** — voyageurs réagissent en temps réel, compteurs visibles sous la note pendant qu'elle vit
- **T+24h** — note ET réactions disparaissent ensemble, page blanche, l'utilisateur peut en reposter une

### 3.3 Si la note est expirée

- L'utilisateur ne voit pas de message d'expiration. La modale de son profil affiche juste le placeholder ("✏️ Laisse un mot…") comme s'il n'avait jamais rien posté.
- Pas d'historique conservé. Pas de "ta dernière note a reçu X réactions".

### 3.4 Réactions empilées

Sous la bulle parchemin, des **pills compactes** affichent les réactions :

```
[ ❤️ 3 ]  [ ☕ 2 ]  [ 👋 1 ]
```

- Chaque pill = 1 emoji distinct + le compteur de personnes ayant réagi avec cet emoji.
- Max 1 réaction par paire (note × user × emoji) — un user peut mettre plusieurs emojis différents mais pas spam le même.
- Tap sur la note d'un voyageur → mini-grille de réactions (~33 emojis curés) → l'emoji choisi vole vers l'auteur de la note ET incrémente le compteur sous la note.

---

## 4. Mécanique 2 — Lancer d'emoji ("emoji-throw")

### 4.1 UX

- **Tap sur l'avatar** d'un voyageur sur la carte → mini-grille emoji pop au-dessus de l'avatar
- **Tap sur un emoji** → l'emoji vole en arc depuis l'avatar de l'expéditeur jusqu'à celui du destinataire (~1.2 sec, courbe quadratique)
- **Surclick autorisé** : chaque tap déclenche un nouvel emoji volant. Compteur "×N" affiché brièvement au-dessus de l'expéditeur si rafale ≥ 3 emojis dans les 3 dernières secondes
- **Visible par tous** : l'animation est diffusée à tous les voyageurs dont l'écran couvre les 2 avatars (ou la trajectoire)

### 4.2 Animation

- **Trajectoire** : courbe quadratique (Bézier) avec un sommet 60-80px au-dessus de la ligne droite entre les 2 avatars. Effet "lancer en cloche".
- **Émission** : scale 0.5 → 1.2, opacity 0 → 1 sur les premiers 8% de la trajectoire (effet "départ")
- **Vol** : scale stable à 1.0
- **Arrivée** : opacity 1 → 0, scale 1 → 0.7 sur les derniers 15% (effet "absorption")
- **Durée totale** : 1.0-1.4 sec selon distance pixel sur la carte
- **CSS `offset-path: path(...)`** pour la courbe (déjà supporté par les navigateurs cibles)

### 4.3 Picker emoji

Au tap sur un avatar, popover positionné au-dessus du destinataire avec :
- Grille **5 colonnes × 7 lignes max** (33 emojis = 5×7 - 2 cases vides)
- Tap sur emoji = envoi immédiat (pas de "valider")
- Le picker reste ouvert tant que l'utilisateur n'a pas tapé en dehors → permet le **surclick** rapide
- Tap en dehors ou tap sur l'avatar à nouveau → ferme le picker

### 4.4 Pas de stockage

Les emojis lancés **ne sont pas stockés en DB**. Ils transitent uniquement par un canal Supabase Realtime `emoji-throws` (broadcast). Conséquences assumées :
- Pas d'historique des emojis reçus
- Si tu n'es pas dans l'app au moment de la rafale, tu rates l'animation, tu ne sais pas qu'on t'a envoyé quelque chose
- Aucune notification push (cf. décision §2)

C'est cohérent avec l'esprit *« vie sur la carte temps réel »*.

### 4.5 Portée — visible à l'écran

Côté client : on n'envoie un payload sur le channel `emoji-throws` que si le destinataire est **visible dans le viewport** de l'expéditeur. Si l'utilisateur veut atteindre quelqu'un de plus loin, il dézoome.

Côté serveur : le channel est ouvert à tous, mais l'animation n'est **rendue côté client** que si au moins l'un des 2 avatars (sender ou receiver) est dans le viewport du spectateur. Évite la pollution visuelle pour les voyageurs lointains.

### 4.6 Banque emoji curée (~33)

| Catégorie | Emojis |
|---|---|
| Salutations / chaleur | 👋 ❤️ 🤝 😊 👏 🥰 🙏 |
| Nature / éléments | 🌳 🌿 🍃 🍂 🌧️ ☀️ 🌙 🔥 |
| Marche / aventure | 🥾 🪨 🗝️ 🪶 🦅 |
| Lieux / patrimoine | ⛪ 🏛️ 🛖 🪦 🪵 |
| Convivial / gourmand | ☕ 🍞 🍷 |
| Esprit / honneur | ⚔️ 🛡️ 🌫️ 🐺 |
| Récompense / hommage | 🪙 |

Whitelist côté serveur. Toute réaction ou throw avec un emoji hors banque est rejeté (sécurité + cohérence marque).

---

## 5. Architecture technique

### 5.1 Notes — DB

```sql
ALTER TABLE users ADD COLUMN note_text text CHECK (length(note_text) <= 200);
ALTER TABLE users ADD COLUMN note_posted_at timestamptz;

-- Index pour fetch rapide des notes actives
CREATE INDEX idx_users_active_notes ON users(note_posted_at) WHERE note_posted_at IS NOT NULL;
```

**Filtrage automatique d'expiration** : pas de cron de cleanup. La requête de fetch des positions joueurs filtre `note_posted_at >= NOW() - INTERVAL '24 hours'`. Si la condition échoue, on retourne `note_text = NULL` côté API. Cleanup paresseux de la colonne en option (job nightly qui set à NULL les notes > 24h, pour économiser l'index).

**RPCs** :
- `set_note(p_text)` — validation longueur ≤ 200, update `note_text` + `note_posted_at = NOW()`
- `clear_note()` — set à NULL

### 5.2 Réactions sur notes — DB

```sql
CREATE TABLE note_reactions (
  note_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- l'auteur de la note
  reactor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (note_user_id, reactor_user_id, emoji)
);

CREATE INDEX idx_note_reactions_by_note ON note_reactions(note_user_id);
```

**Cleanup** : à chaque `set_note` ou `clear_note`, on DELETE toutes les `note_reactions` où `note_user_id = current_user`. La nouvelle note repart avec un compteur vierge.

**RPC** :
- `react_to_note(p_note_user_id, p_emoji)` — checks :
  - L'auteur a une note active (`note_posted_at >= NOW() - 24h`)
  - L'emoji est dans la whitelist
  - INSERT dans `note_reactions` (PRIMARY KEY garantit l'unicité, ON CONFLICT DO NOTHING)
  - Broadcast realtime sur `note-reactions:{note_user_id}` pour que les compteurs se mettent à jour live

### 5.3 Emoji-throws — Realtime uniquement

Pas de table SQL. Channel Supabase Realtime `emoji-throws` avec broadcast :

```json
{
  "from_user_id": "uuid",
  "to_user_id": "uuid",
  "emoji": "👋",
  "sent_at": "2026-05-02T14:22:33Z"
}
```

**RPC** : `throw_emoji(p_to_user_id, p_emoji)` — validation emoji whitelist, broadcast sur channel `emoji-throws`. Pas d'INSERT en DB.

**Côté client** : abonnement au channel `emoji-throws`. Pour chaque payload reçu :
1. Vérifier que `from_user_id` n'est pas dans `users.muted_user_ids` du spectateur
2. Vérifier que au moins l'un des 2 avatars (from/to) est dans le viewport
3. Si oui : déclencher l'animation CSS `offset-path` entre les 2 avatars
4. Sinon : ignorer

### 5.4 Mute soft

```sql
ALTER TABLE users ADD COLUMN muted_user_ids uuid[] NOT NULL DEFAULT '{}';
```

**RPCs** :
- `mute_user(p_target_user_id)` — append à `muted_user_ids`
- `unmute_user(p_target_user_id)` — remove de `muted_user_ids`

**Effet client** : les emoji-throws reçus du muted sont ignorés. Les réactions du muted sur les notes du muteur ne sont pas affichées (filtrage côté API au moment du fetch).

L'utilisateur muté n'a aucune indication qu'il est muté. C'est le sens du "soft" : pas d'humiliation publique.

### 5.5 Modération des notes

Existe déjà dans le MVP ECO Merveille spec §4.3 :

```sql
CREATE TABLE note_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_text_at_report text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
```

**RPC** : `report_note(p_target_user_id)` — snapshot le `note_text` actuel + INSERT.

**Hub admin** : nouvelle vue "Notes signalées" pour reset le `note_text` + ban temporaire de la fonction "note" (V0.7+ Hub).

### 5.6 Whitelist emoji côté serveur

Stockée en constante PostgreSQL ou en table de référence :

```sql
CREATE TABLE allowed_emojis (
  emoji text PRIMARY KEY,
  category text NOT NULL
);
INSERT INTO allowed_emojis VALUES
  ('👋', 'salutation'), ('❤️', 'salutation'), ('🤝', 'salutation'), ('😊', 'salutation'),
  ('👏', 'salutation'), ('🥰', 'salutation'), ('🙏', 'salutation'),
  ('🌳', 'nature'), ('🌿', 'nature'), ('🍃', 'nature'), ('🍂', 'nature'),
  ('🌧️', 'nature'), ('☀️', 'nature'), ('🌙', 'nature'), ('🔥', 'nature'),
  ('🥾', 'aventure'), ('🪨', 'aventure'), ('🗝️', 'aventure'), ('🪶', 'aventure'),
  ('🦅', 'aventure'),
  ('⛪', 'patrimoine'), ('🏛️', 'patrimoine'), ('🛖', 'patrimoine'),
  ('🪦', 'patrimoine'), ('🪵', 'patrimoine'),
  ('☕', 'convivial'), ('🍞', 'convivial'), ('🍷', 'convivial'),
  ('⚔️', 'esprit'), ('🛡️', 'esprit'), ('🌫️', 'esprit'), ('🐺', 'esprit'),
  ('🪙', 'recompense');
```

Validation dans `throw_emoji` et `react_to_note` : `IF NOT EXISTS (SELECT 1 FROM allowed_emojis WHERE emoji = p_emoji) THEN RAISE EXCEPTION 'emoji_not_allowed';`

### 5.7 Hooks vers les quêtes

Les RPCs `throw_emoji` et `react_to_note` doivent appeler `increment_quest_progress(p_user_id, 'social_action', 1)` (cf. spec mini-quêtes §6.4) pour valider la quête #4.

---

## 6. UI sur la carte

### 6.1 Nouveaux composants

- `NoteBubble.tsx` — bulle parchemin sous l'avatar
- `NoteReactionsRow.tsx` — pills compteurs sous la bulle
- `EmojiPicker.tsx` — popover grid 5×7 au tap sur avatar
- `FlyingEmojiLayer.tsx` — couche absolue qui rend les animations CSS `offset-path`
- `MuteToggleButton.tsx` — dans la modale profil (à côté de l'action "signaler")

### 6.2 Modifications existantes

- `PlayerProfileModal.tsx` — ajouter :
  - Champ d'édition de note (si profil de l'utilisateur courant)
  - Affichage de la note avec compteurs réactions (si profil d'un autre)
  - Bouton "Ne plus recevoir d'emojis de [Personne]" (mute soft)
  - Bouton "Signaler la note"
- `ExploreMap.tsx` ou `MapPage.tsx` — intégrer :
  - Rendu des `NoteBubble` à zoom rapproché
  - Layer `FlyingEmojiLayer` au-dessus de la carte
  - Subscriber Realtime channels `emoji-throws` et `note-reactions:{my_user_id}`
- Nouveau hook `useEmojiThrows()` — gère l'abonnement, le filtrage mute, et l'enqueue des animations
- Nouveau hook `useUserNote()` — get/set/clear la note de l'utilisateur

### 6.3 Performance

- **NoteBubble** rendues uniquement à zoom ≥ 12 → max ~50 voyageurs visibles à ce zoom = OK
- **FlyingEmojiLayer** : limit max 20 animations concurrentes. Au-delà, on drop les nouvelles (ou on simplifie le rendu)
- **Realtime** : un seul channel `emoji-throws` pour tous, filtrage côté client. Si la charge devient lourde post-launch, partitionner par région géographique

---

## 7. Risques & dépendances

### 7.1 Risques

| Risque | Mitigation |
|---|---|
| **Spam d'emoji-throws sur le channel Realtime** (un troll surclick à 100/sec) | Throttle côté client : max 10 emojis/sec par expéditeur. Au-delà, on drop côté front avant l'envoi |
| **Perf carte avec 50+ animations CSS simultanées** | Limit 20 anims concurrentes, drop les nouvelles. Tester sur device bas de gamme |
| **Note inappropriée publiée** | Limite 200 char + bouton signaler + reset admin Hub (existant V0.7+) |
| **Mute soft contourné** par un troll qui crée des comptes** | Pas dans le scope V0.7. Ajouter Block dur + détection de patterns en V0.7+ si nécessaire |
| **Manque de découvrabilité** (les utilisateurs ne savent pas qu'ils peuvent taper sur un avatar) | Onboarding visuel : au premier login post-deploy, mini-tutoriel "Tape sur un avatar pour saluer". Délivré via la modale d'accueil existante (à enrichir) |
| **Latence Realtime ressentie** | Optimiste : afficher l'animation côté expéditeur immédiatement (pas d'attente du roundtrip). Tolère le décalage côté spectateurs |

### 7.2 Dépendances

- ✅ Supabase Realtime déjà en place
- ✅ Modale `PlayerProfileModal.tsx` existante
- ✅ Système de toasts existant (pour confirmer "emoji envoyé" si besoin)
- ⚠️ **Spec mini-quêtes** (parallèle) — la quête #4 dépend de ces RPCs. Ordre d'implémentation : micro-social d'abord
- ✅ Hub admin existant pour la modération

---

## 8. Hors-scope V0.7+

Anticipé dans l'archi mais **pas livré** :

- ❌ Block dur (réciproque, masque les avatars)
- ❌ Notifications push
- ❌ Historique des emojis reçus / sent
- ❌ Compteur "Ta dernière note a reçu X réactions" sur le profil
- ❌ Mini-conversation emoji-only (pile persistante par paire de users)
- ❌ Emoji custom marque (badges Runes de Chêne unlockables)
- ❌ Notes éditoriales de la marque (Uriel poste un mot du jour visible par tous)
- ❌ Sons / haptics au reception d'emoji

Ces extensions peuvent venir post-launch sans refactor majeur.

---

## 9. Plan d'implémentation (résumé)

À détailler dans un plan d'implémentation séparé. Direction :

1. **Migrations SQL** :
   - Colonnes `users.note_text`, `users.note_posted_at`, `users.muted_user_ids`
   - Tables `note_reactions`, `note_reports`, `allowed_emojis` (avec seed)
   - Index
2. **RPCs** : `set_note`, `clear_note`, `react_to_note`, `throw_emoji`, `mute_user`, `unmute_user`, `report_note`
3. **Realtime** : channels `emoji-throws` (global) et `note-reactions:{user_id}` (par-user)
4. **Hook quêtes** : appel à `increment_quest_progress` dans `throw_emoji` et `react_to_note`
5. **Frontend** :
   - Composants `NoteBubble`, `NoteReactionsRow`, `EmojiPicker`, `FlyingEmojiLayer`, `MuteToggleButton`
   - Hooks `useEmojiThrows()`, `useUserNote()`, `useMutedUsers()`
   - Modifications `PlayerProfileModal`, `ExploreMap` / `MapPage`
6. **Animation CSS** : trajectoire `offset-path` quadratique, keyframes émission/vol/arrivée
7. **Onboarding** : mini-tutoriel post-deploy "Tape sur un avatar pour saluer"
8. **Tests manuels** : edge cases (mute, surclick, dézoom, hors écran, expiration note 24h)

**Effort estimé** : ~4 jours (~1.5j SQL + RPCs, ~2j frontend + animations, ~0.5j tests + ajustements).

---

## 10. Annexes

### 10.1 Décisions explicites de simplification

- ❌ Mécanique broadcast/réactions ("poser un emoji sur soi") → remplacée par notes + emoji-throw
- ❌ Mini-conversation emoji empilée → trop proche d'un chat, pas dans le scope
- ❌ Coucou éphémère 2-3 sec sans destinataire ciblé → remplacé par emoji-throw direct façon Zenly
- ❌ Push notifications → pareto, temps réel pur
- ❌ Block dur → ajouté V0.7+ si nécessaire
- ❌ Banque Unicode complète → preset RdC curé (cohérence marque + anti-dérive 💩)

### 10.2 Conditions de succès post-launch

- ≥ 50% des joueurs actifs envoient au moins 1 emoji-throw par semaine
- ≥ 30% des joueurs actifs posent au moins 1 note par semaine
- ≥ 70% des notes posées reçoivent au moins 1 réaction
- Sentiment "carte vivante" remontée par feedback (qualitatif)
- 0 incident de signalement de note dans la première semaine post-launch (modération a posteriori suffit)

### 10.3 Références

- Spec parallèle mini-quêtes : [`2026-05-02-v07-mini-quetes-journalieres-design.md`](2026-05-02-v07-mini-quetes-journalieres-design.md)
- Spec brouillage GPS (à exécuter en parallèle) : [`2026-05-01-v07-eco-merveille-mvp-design.md`](2026-05-01-v07-eco-merveille-mvp-design.md) §3
- Méta-spec V0.7 articulation : [`2026-05-01-v07-articulation-campement-quetes-influence-design.md`](2026-05-01-v07-articulation-campement-quetes-influence-design.md)
- MVP ECO Merveille (note partagée remplacée par cette spec) : [`2026-05-01-v07-eco-merveille-mvp-design.md`](2026-05-01-v07-eco-merveille-mvp-design.md) §4
- Inspiration Zenly (mécanique d'emojis lancés entre avatars)
