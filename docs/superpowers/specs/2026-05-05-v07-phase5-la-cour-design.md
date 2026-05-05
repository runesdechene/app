# V0.7 Phase 5 — La Cour (influence à distance via Couronnes)

> Spec design — 5 mai 2026
> Sprint unique. Implé en contexte direct (pas de sub-agents).

## 1. Contexte

V0.7 a rendu la veille des lieux **GPS-only** : un lieu est veillé par l'expédition qui y a planté physiquement. Conséquence : un joueur français ne peut jamais espérer veiller un lieu en Mongolie, et les lieux sans visiteur restent figés sur leur veilleur initial pendant des années.

Par ailleurs, le système d'influence V0.5 (`place_influence_action`, tables `place_influence` / `user_place_influence`) reste actif en prod (mig 022 a défrisé après le freeze prématuré de la mig 015). Inutilisable pour la phase 5 (logique faction-vs-faction obsolète, pas alignée avec la vision Harry Potter validée le 5 mai).

**Objectif** : permettre aux joueurs sédentaires d'influencer des lieux à distance via les Couronnes, **sans casser la primauté de la marche IRL**, et créer une mécanique sociale long-terme autour du mécénat.

## 2. Vue d'ensemble — "La Cour"

Chaque lieu veillé a un **veilleur diplomatique** (l'expédition détentrice de `place_veille`) qui démarre avec une **faveur diplomatique de +50** acquise au plantage. N'importe quelle autre expédition peut investir des Couronnes pour **défier** le veilleur ; le veilleur (ou ses mécènes) peut investir des Couronnes pour **renforcer** sa faveur. La première expédition challenger qui dépasse le score du veilleur **prend le lieu à distance** — mais sans visite IRL, ce n'est qu'un contrôle "par influence", instantanément réversible si l'ancien veilleur revient sur place.

**Faction = identité (Harry Potter)**. **Expédition = unité de groupement gameplay**. C'est expé-vs-expé, jamais faction-vs-faction.

## 3. Décisions de design (actées 5 mai)

| # | Décision | Justification |
|---|---|---|
| D1 | Faveur veilleur = **50** fixe à chaque (re)plantage GPS | Cap simple, lisible, équivalent ~10j de récolte solo |
| D2 | Investissement va à une **expédition** (défense ou challenger), pas à une faction | Aligné vision joueur-vs-joueur d'Uriel |
| D3 | **Couronnes brûlées** quand investies (irrécupérables) | Sacrifice = poids stratégique réel |
| D4 | Statut "**veilleur par influence**" distinct du veilleur plein | Tant que personne n'est venu IRL côté nouveau veilleur, l'ancien peut reset gratis |
| D5 | **Visibilité asymétrique** | Challenger voit son score à battre, veilleur voit la menace la plus haute (chiffre exact), personne ne voit la liste exhaustive |
| D6 | **Reset GPS** : visite IRL d'un membre de l'expé veilleuse actuelle = reset des challengers à 0 | "La marche prime sur l'or" |
| D7 | **Énigmes rapportent Couronnes** miroir Gloire/Coupe : 1/1/2/3 selon difficulté | Cohérence économique |
| D8 | **Cap silencieux** sur Couronnes énigme si stock plein (pas d'erreur) | UX douce, conforme feedback "modales minimales" |
| D9 | **Drop pur V0.5** — aucune conversion `influence_stock` | Tout le monde repart à 0 |
| D10 | **Notifications granularité 1×/jour/(lieu × expé attaquante)** + immédiates aux moments charnières | Anti-spam |
| D11 | **Top mécènes cumulatif à vie** par lieu, jamais reset | Réputation longue durée |
| D12 | **Sprint unique**, pas de découpage | Vélocité ; festival 12 mai |

## 4. Mécanique La Cour

### 4.1 État d'un lieu

- **Veilleur** : expédition détentrice de `place_veille.expedition_id`.
- **Score veilleur** = `50 + Couronnes investies en défense par l'expé veilleuse` (faveur 50 implicite, pas stockée).
- **Score d'une expé challenger X** = `Couronnes investies par X en attaque sur ce lieu`.
- **Score à battre** (vu par un challenger) = score veilleur courant.
- **Menace haute** (vue par le veilleur) = `MAX(score) parmi expés challengers`.

### 4.2 Action `invest_crowns`

Un joueur peut investir des Couronnes dans 3 cas :

| Cas | Camp | Effet |
|---|---|---|
| Membre de l'expé veilleuse | défense | +N au score veilleur |
| Pas membre de l'expé veilleuse, lieu paisible OU veut soutenir | défense (mécénat libre) | +N au score veilleur |
| Membre d'une expé challenger sur ce lieu | attaque | +N au score de cette expé challenger |

Les Couronnes sont débitées immédiatement et brûlées (pas de remboursement).

**Attribution à une expédition challenger** quand le user clique "Défier" :

- S'il existe ≥1 expé challenger active sur ce lieu : modale qui propose **rejoindre une expé existante** (liste des expés challengers, score affiché) **ou créer la sienne en solo**.
- Si aucune expé challenger n'existe : création automatique d'une expé solo (1 membre = lui) avec un nom par défaut (ex: "Expédition de [prénom]") modifiable.
- Une fois inscrit dans l'expé challenger, l'investissement est attribué à cette expé. Il peut investir à nouveau plus tard sans repasser par cette modale.

Détail des libellés et flow modale : à formaliser dans le plan d'implé.

### 4.3 Bascule

Dès qu'une expédition challenger franchit le score du veilleur (atomiquement dans la transaction `invest_crowns`) :

1. `place_veille.expedition_id` ← expé challenger
2. `place_veille.by_influence` ← `true` (nouvelle colonne)
3. **Reset** des scores : `DELETE FROM place_court_score WHERE place_id = X` (toutes les expés autres que la nouvelle veilleuse retombent à 0 ; faveur 50 implicite)
4. `activity_log` : `place_taken_remote` (cible : ancienne expé) + `place_taken_remote_self` (cible : nouvelle expé)

Les autres expés challengers en course ont brûlé leurs Couronnes et ne récupèrent rien — il fallait être premier.

### 4.4 Reset GPS (la marche prime)

À chaque plantage / re-plantage GPS sur un lieu (RPC `claim_place` ou équivalent) :

- Si le lieu n'a pas de veilleur → comportement V0.7 actuel (création expé)
- Si le lieu est **déjà veillé par l'expé du planteur** → noop côté veille, mais : `DELETE FROM place_court_score WHERE place_id = X AND expedition_id != veilleur_id` (reset challengers, faveur veilleur 50 + ses investissements défensifs reste). C'est le levier "défendre par la marche".
- Si le lieu est **veillé par une autre expé** :
  - Si `place_veille.by_influence = true` ET le planteur appartient à **l'expé qui détenait avant la bascule par influence** (à tracer : nouvelle colonne `place_veille.previous_expedition_id`) → **reprise gratuite** : `place_veille.expedition_id` ← ancienne expé, `by_influence` ← `false`, reset court_score, `activity_log: place_taken_back_gps` (cible : expé déchue)
  - Sinon (planteur d'une expé tierce) → comportement standard `claim_place` : nouveau veilleur, reset court_score, faveur 50 fraîche.

Note : `previous_expedition_id` est nécessaire pour identifier "l'ancien veilleur légitime" pendant l'état "par influence". Reset à `NULL` dès qu'un membre de la nouvelle expé vient confirmer IRL.

### 4.5 Confirmation IRL du veilleur "par influence"

Dès qu'un membre de l'expé "par influence" (`by_influence = true`) plante GPS sur le lieu :

- `place_veille.by_influence` ← `false`
- `place_veille.previous_expedition_id` ← `NULL`
- Faveur 50 redémarre à pleine puissance
- L'ancien veilleur ne peut plus reprendre gratis (il devra basculer comme tout le monde)
- `activity_log` : pas de notif spécifique (c'est une simple consolidation, déjà couvert par le toast de plantage standard)

## 5. Économie

### 5.1 Sources de Couronnes

| Source | Gain | Cap | Notes |
|---|---|---|---|
| Récolte coffres lieux veillés (mig 021/029) | 1/jour solo, 2/jour expé ≥2, max 15 lieux/jour | Cap balance 500 | Existe déjà |
| Énigme daily (3/jour) | 1/1/2/3 selon difficulté | Cap balance 500 (silencieux) | **NEW** |
| Énigme place | 1/1/2/3 | Idem | **NEW** |
| Énigme fragment | 1/1/2/3 | Idem | **NEW** |

Joueur sédentaire (énigmes seules, 0 lieu veillé) : ~3-7 Couronnes/jour. ~10-15j pour basculer un lieu non défendu.
Joueur actif (10 lieux veillés + énigmes) : ~13-22 Couronnes/jour. ~3-4j pour basculer un lieu non défendu.
Expé de 4 motivés : 50/jour cumulés. Bascule en ~1.5j mais ~200 Couronnes brûlées au total.

### 5.2 Coût bascule

- Faveur 50 du veilleur = base à dépasser.
- Veilleur peut renforcer à 1:1 (1 Couronne défense = +1 score veilleur).
- Donc un veilleur qui défend activement double facilement la barre : un lieu défendu activement requiert 100+ Couronnes côté attaquant pour basculer.
- Reset GPS gratuit du veilleur **annule tous les efforts adverses** : un lieu visité régulièrement IRL est de facto inviolable.

## 6. Notifications

### 6.1 Types et règles d'émission

| Type `activity_log` | Déclencheur | Cible | Cap d'émission |
|---|---|---|---|
| `place_court_attack` | Une expé attaque ce lieu pour la 1ère fois aujourd'hui | Membres expé veilleuse | 1× / (lieu, expé attaquante, jour) |
| `place_court_high_threat` | Menace franchit 50% du score veilleur | Membres expé veilleuse | 1× par franchissement (pas spam si oscille) |
| `place_taken_remote` | Bascule par influence | Membres ancienne expé veilleuse | Immédiate |
| `place_taken_remote_self` | Bascule par influence | Membres nouvelle expé veilleuse "par influence" | Immédiate |
| `place_taken_back_gps` | Ancien veilleur reprend par GPS | Membres expé "par influence" déchue | Immédiate |
| `mecene_principal_lost` | User perd le titre "Mécène Principal de [Lieu]" | User déchu | Immédiate |
| `mecene_principal_gained` | User devient #1 mécène d'un lieu | User promu | Immédiate, 1× par changement |

### 6.2 Cap 1×/jour pour `place_court_attack`

Géré dans `invest_crowns` : avant insert dans `activity_log`, vérifier qu'aucune ligne de ce type n'existe pour ce `(place_id, expedition_id_attaquante, current_date)`. Sinon skip l'insert.

### 6.3 Subscribe

`apps/explore-web/src/hooks/usePlayer.ts` est déjà subscribed sur `activity_log` (ligne ~391). Ajouter un nouveau hook `useCourtNotifications.ts` qui filtre les types `place_court_*` / `place_taken_*` / `mecene_*` et déclenche les toasts/banners appropriés. Pas de nouveau channel.

### 6.4 Push (optionnel V1)

OneSignal existe déjà dans le projet (à vérifier). Si oui, les notifs `place_taken_*` et `mecene_*` (immédiates et fortes) peuvent déclencher un push. À chiffrer dans le plan d'implé. Sinon V1 = in-app seulement, push différé.

## 7. UX fiche de lieu — La Cour addictive

### 7.1 Section "La Cour" sur `PlacePanel`

Ordre vertical :

1. **Pilule statut** : 🟢 Paisible / 🟡 Convoité / 🟠 Sous pression / 🔴 En siège (calculé : ratio menace/score veilleur)
2. **Carte d'identité veilleur** : pastille expédition + avatars membres + score (`Faveur 50 + 12 défense = 62`). Si `by_influence = true` : mention discrète "*tient ce lieu à distance*" + invitation IRL.
3. **Jauge Faveur** : barre horizontale animée, pivote selon `(score veilleur) − (menace haute)`. Clean, sobre logiciel.
4. **Boutons d'action** (1 ou 2 selon contexte) :
   - "Renforcer la veille" (si membre expé veilleuse)
   - "Mécèner ce lieu" (si pas membre, peu importe le statut)
   - "Défier" (si pas membre veilleuse — ouvre flow rejoindre/créer expé challenger)
   - "Investir pour [expé]" (si déjà membre d'une expé challenger active sur ce lieu)
5. **Trône des Mécènes** : top 5 cumulatif à vie. Le #1 a un pictogramme spécial + libellé "Mécène Principal".
6. **Chronique** : 10 dernières actions, format "X a investi N Couronnes pour [camp] — il y a Yh"

### 7.2 Modale d'investissement

`InvestCrownsModal.tsx` :
- Slider 1 → balance perso, défaut = 1
- Preview : "Vous allez investir **N Couronnes** pour soutenir [camp]. Brûlées définitivement."
- Si attaque : "Score actuel de votre expédition : 12 → **17**. Score à battre : 62."
- Bouton confirmation explicite + bouton annuler
- Anti-misclic : pas de confirmation auto

### 7.3 Effets de feedback

- Animation Couronnes qui tombent (CSS, 1-2s, sobre)
- Vibration mobile haptique légère
- Son discret (réutiliser asset existant si dispo)
- Si franchit un seuil de mécénat → toast "Vous êtes désormais Coffre d'Or"
- Si devient #1 mécène → toast forte "Mécène Principal de [Lieu]"

### 7.4 Carte (markers)

- Lieu veillé "plein" (`by_influence = false`) : marker actuel, plein
- Lieu veillé "par influence" (`by_influence = true`) : marker en pointillés ou demi-teinte (à designer côté CSS)
- `InfluenceToggle` (V0.5) → drop. Remplacer éventuellement par un toggle "Tension" qui colorise les markers selon statut (paisible/convoité/etc) — V1 optionnel.

## 8. Titres de mécénat

À ajouter dans `get_user_titles` :

| Titre | Critère |
|---|---|
| Bourse Légère | 50 Couronnes investies cumulées (tous lieux) |
| Coffre d'Or | 200 Couronnes |
| Trésorier | 1000 Couronnes |
| Mécène Principal de [Lieu] | #1 sur ce lieu spécifique (titre dynamique, peut en cumuler plusieurs) |
| Premier Mécène | A été #1 sur ≥3 lieux différents (cumulé à vie) |

## 9. Architecture technique

### 9.1 Migrations SQL

**Mig (drop V0.5)** :
- `DROP FUNCTION place_influence_action(...)`
- `DROP FUNCTION _place_influence_action_internal(...)`
- `DROP TABLE place_influence`
- `DROP TABLE user_place_influence`
- `ALTER TABLE users DROP COLUMN influence_stock`
- (vérifier au préalable qu'aucune RPC ne lit encore `users.influence_stock` — `get_player_profile`, etc.)

**Mig (phase 5)** :

```sql
CREATE TABLE public.place_court_action (
  id              bigserial PRIMARY KEY,
  place_id        text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id         text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expedition_id   uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  side            text NOT NULL CHECK (side IN ('defense', 'attack')),
  amount          integer NOT NULL CHECK (amount > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX place_court_action_place_user_idx ON place_court_action(place_id, user_id);
CREATE INDEX place_court_action_place_created_idx ON place_court_action(place_id, created_at DESC);

CREATE TABLE public.place_court_score (
  place_id        text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  expedition_id   uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  score           integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  last_action_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, expedition_id)
);

ALTER TABLE public.place_veille
  ADD COLUMN by_influence boolean NOT NULL DEFAULT false,
  ADD COLUMN previous_expedition_id uuid REFERENCES public.expeditions(id);

GRANT SELECT ON public.place_court_action TO authenticated, service_role;
GRANT SELECT ON public.place_court_score TO authenticated, service_role;
```

### 9.2 RPCs

- `invest_crowns(p_user_id, p_place_id, p_target_expedition_id, p_amount)` → débite balance Couronnes, insert action, upsert score (incrémental), check bascule, log notif si seuil franchi, log activity_log
- `get_place_court_state(p_place_id, p_user_id)` → retour JSON unique : `{ veilleur: {...}, byInfluence, score, threats: [{expeditionId, name, score}], topPatrons: [...], chronicle: [...], status, callerContext: {balance, isMemberOfVeilleur, challengerExpeditions: [...]} }`
- `get_my_patronage_titles(p_user_id)` → optionnel, ou intégré dans `get_user_titles` directement
- Modif `_answer_enigma_internal` : verbatim copy mig 069 + ajout `UPDATE user_crowns SET balance = LEAST(500, balance + N)` selon difficulté + retour `crownsGain`, `newCrownsBalance`
- Modif `_answer_fragment_enigma_internal` : idem
- Modif `claim_place` : ajout reset `place_court_score` + gestion `by_influence` / `previous_expedition_id` (cf §4.4)
- Modif `get_user_titles` : ajout titres mécénat (3 cumulatifs + dynamique par lieu via subquery sur top mécènes)

### 9.3 Frontend `apps/explore-web`

| Fichier | Action |
|---|---|
| `components/places/details/PlaceCourtView.tsx` | NEW — section principale Cour |
| `components/places/details/PatronsList.tsx` | NEW — Top 5 mécènes |
| `components/places/details/CourtTensionBar.tsx` | NEW — jauge Faveur |
| `components/places/details/CourtChronicle.tsx` | NEW — journal 10 dernières actions |
| `components/places/actions/InvestCrownsModal.tsx` | NEW — modale investissement |
| `components/places/views/PlacePanel.tsx` | Intégrer `PlaceCourtView`, retirer ancien InfluenceFrame V0.5 |
| `components/map/controls/InfluenceToggle.tsx` | DROP |
| `components/map/core/MapMarkers.tsx` | Variante visuelle markers `by_influence = true` |
| `components/enigma/EnigmaResult.tsx` | Ligne `👑 +N Couronnes` ajoutée |
| `components/enigma/DailyEnigma.tsx` | Lire `crownsGain` du retour RPC, refresh `crownsStore` |
| `components/enigma/FragmentEnigma.tsx` | Idem |
| `components/enigma/PlaceEnigma*` (à identifier) | Idem |
| `stores/crownsStore.ts` | Action `refreshAfterInvestment()` ou subscribe Realtime sur `user_crowns` |
| `hooks/useCourtNotifications.ts` | NEW — filtre subscribe activity_log pour types Cour |
| `lib/discoverPlace.ts` | Vérifier rien ne référence `place_influence_action` |
| `types/court.ts` | NEW — types `PlaceCourtState`, `Patron`, `ChronicleEntry`, `Threat` |
| `types/database.types.ts` | Régénérer post-migration |

### 9.4 Frontend `apps/hub`

V1 minimal : vue admin "Bascules récentes" dans `Divers.tsx` ou page dédiée `Mecenat.tsx`. Listing `place_taken_remote` du `activity_log` avec filtres date / lieu / expé. Permet à Uriel de monitorer les abus pendant les premiers jours.

## 10. Cas limites

- Balance < amount → `error: insufficient_crowns`
- Pas membre de l'expé cible (cas attaque) → `error: not_member`
- Lieu non veillé (`place_veille.expedition_id IS NULL`) → `error: not_veilled`
- Investir comme attaque sur sa propre expé veilleuse → `error: cannot_attack_self`
- Bascule simultanée (deux expés challengers franchissent dans la même seconde) → résolu par la transaction SERIALIZABLE de `invest_crowns` : la 2e transaction voit le veilleur déjà changé. Comportement défini : la 2e attaque est appliquée au nouveau veilleur (potentiellement sa propre expé si elle vient de basculer), donc convertie en défense ? Ou refusée avec `error: place_just_changed` ? **À trancher au plan d'implé** ; je penche pour `error: place_just_changed` + remboursement (cas exceptionnel, retour utilisateur "réessayez").
- Cap 500 atteint pendant énigme → `crownsGain = 0` retourné, modale affiche "👑 +0 (stock plein)"
- Énigme `place` (lieu veillé d'une autre expé) avec investissement de Couronnes simultané : pas d'interaction directe, énigme = source perso de Couronnes uniquement.
- Veilleur en "by_influence" qui se fait basculer à son tour (nouveau challenger dépasse) : `previous_expedition_id` reste pointant vers l'ancien légitime, le nouveau "by_influence" remplace. L'ancien légitime peut toujours reset par GPS (chaîne de droits ininterrompue).

## 11. Plan de livraison (sprint unique)

1. **Migration "drop V0.5"** : drop `place_influence_action`, tables, colonne `influence_stock`. Vérification préalable des dépendances frontend.
2. **Migration "phase 5"** : nouvelles tables, nouvelles colonnes, nouvelles RPCs, modifs `_answer_enigma_internal` / `_answer_fragment_enigma_internal` / `claim_place` / `get_user_titles`.
3. **Frontend complet** : nouveau `PlaceCourtView` + dépendances, modif `EnigmaResult`, `DailyEnigma`, `FragmentEnigma`, drop `InfluenceFrame`, drop `InfluenceToggle`.
4. **Hub minimal** : vue Bascules récentes dans `Divers.tsx`.
5. **Test bout en bout** : 2 comptes test, scénario complet (énigme → Couronnes, investissement, bascule, reset GPS).
6. **Deploy Netlify** explore-web + hub.
7. **Communication users** : email + post Insta annonçant La Cour.

Cible : avant **festival Echo & Merveilles 12 mai 2026** (J-7 au moment de cette spec).

## 12. Hors scope (NE PAS faire dans ce sprint)

- **Push notifications** OneSignal sur `place_taken_*` (différé V0.8 si pertinent).
- **Carte chaleur de tension** globale (toggle "Tension" sur InfluenceToggle refondu).
- **Échelle de faveur 50 + ancienneté** : on reste sur faveur fixe 50, on évaluera après quelques semaines de prod.
- **Récupération Couronnes brûlées par challenger en cas de bascule** : non, brûlées définitivement (sauf bascule simultanée à clarifier au plan).
- **Mécénat anonyme** : non, tous les mécénats sont nominatifs (réputation publique).
- **Notion d'alliance d'expéditions** : pour V1, une expé attaquante = une seule expé. Pas d'union d'expés au moment de l'attaque.
- **Limite quotidienne d'investissements par lieu** : pas de cap autre que la balance personnelle (cap 500 du stock).

## 13. Métrique de succès

- À J+7 prod : ≥30% des joueurs sédentaires (0 lieu veillé) ont investi au moins 1 Couronne sur un lieu.
- À J+14 prod : ≥1 bascule par influence effectuée.
- À J+30 prod : ≥10% des lieux ont eu au moins une action de Cour.
- Pas de hausse anormale du churn (les vétérans ne se sentent pas spoliés par les mécénats hostiles).
