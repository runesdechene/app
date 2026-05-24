# Mécénat d'un challenger — soutenir un attaquant (La Cour)

> Spec design — 24 mai 2026
> App : explore-web. Système : La Cour (influence à distance, modèle user-centric).

## 1. Contexte & problème

La Cour est **user-centric** depuis les mig 152/156 : un lieu a un **veilleur = un user** (`place_veille.veilleur_user_id`), et chaque Couronne investie porte un `beneficiary_user_id`. Le score d'un joueur sur un lieu = `SUM(place_court_action.amount WHERE beneficiary_user_id = lui)`. Le premier challenger dont le score dépasse celui du veilleur **prend le lieu**.

Aujourd'hui, depuis la fiche de lieu :
- **Soutenir le veilleur** → crédite le score du *veilleur* (mécénat libre, le tiers n'a pas besoin de le rejoindre). Géré : `invest_crowns` cible l'expé veilleuse → `beneficiary = veilleur_user_id`.
- **Influencer** → crédite **son propre** score (`beneficiary = caller`). C'est la seule façon d'attaquer.

**Manque** : la symétrie. On peut être mécène du **défenseur**, mais pas d'un **attaquant**. Quand on attaque, on ne finance que soi-même — impossible de concentrer ses Couronnes derrière un challenger déjà en course pour le faire basculer.

> Note historique : la spec du 5/05 décrivait des « expéditions challengers » qu'on aurait pu rejoindre. Ce modèle a été abandonné à la refonte user-centric (mig 152). Il n'y a **pas** d'expédition à distance — c'est user-vs-user.

## 2. Objectif

Permettre à un joueur de **créditer le score d'un autre attaquant** (un challenger déjà présent sur le lieu) via un bouton « Soutenir » dans la liste des mécènes — exactement comme le mécénat du veilleur, mais côté attaque.

## 3. Décisions de design (validées 24 mai)

| # | Décision | Justification |
|---|---|---|
| D1 | **Mécénat libre** : on crédite le challenger sans le rejoindre | Symétrie parfaite avec le soutien au veilleur (déjà libre) |
| D2 | **Aucune contrainte de faction** : on peut soutenir n'importe quel attaquant | Cohérent avec l'existant (le soutien au veilleur est déjà agnostique faction) |
| D3 | **Faiseur de roi** : si mon soutien fait basculer le lieu, c'est le **challenger soutenu** qui devient veilleur, pas moi | Cohérent avec le modèle user-centric (bascule clé sur `beneficiary`) ; je reste mécène visible |
| D4 | **Bouton dans la liste + « Influencer » inchangé** | Deux chemins clairs : lancer ma propre attaque / financer une existante |
| D5 | **Cibles = challengers existants uniquement** (score > 0, ≠ veilleur) | Pas de challenger fantôme ; aligné sur ce que l'UI affiche |

## 4. Mécanique

`invest_crowns` détermine `beneficiary` + `side` à partir d'un **nouveau paramètre optionnel** `p_beneficiary_user_id` :

| Cas (appel front) | `beneficiary` | `side` |
|---|---|---|
| `p_beneficiary_user_id` NULL (legacy) | déduit comme aujourd'hui (cible = expé veilleuse → veilleur ; sinon → caller) | idem |
| `p_beneficiary_user_id` = veilleur courant | veilleur | `defense` |
| `p_beneficiary_user_id` = un challenger (≠ veilleur, score > 0) | ce challenger | `attack` |

La **bascule** est déjà clé sur `beneficiary` (`IF v_beneficiary IS DISTINCT FROM v_current_veilleur_user AND v_new_score > v_old_veilleur_score`). Donc soutenir un challenger jusqu'à dépasser le veilleur le fait basculer **lui** — aucune nouvelle logique de bascule.

## 5. Architecture technique

### 5.1 Migration 173 (next ; 172 = dernière actuelle)

**Baselines à reprendre verbatim (vérifiées au plus haut numéro) :**
- `invest_crowns` → **mig 164** (`164_actor_id_in_notif_data.sql`)
- `get_place_court_state` → **mig 156** (`156_top_patrons_desagrege_par_user.sql`)

**`invest_crowns` — modif ciblée :**
1. Nouvelle signature : ajout `p_beneficiary_user_id text DEFAULT NULL` en fin de paramètres (rétro-compatible — le front actuel n'envoie pas ce param).
2. Bloc de détermination camp/bénéficiaire : si `p_beneficiary_user_id` est fourni, il **prime** sur la déduction par expédition :
   - `= v_current_veilleur_user` → `side='defense'`, `beneficiary = veilleur`.
   - sinon → validation challenger : `_user_place_score(p_beneficiary_user_id, place) > 0` ET `p_beneficiary_user_id != v_current_veilleur_user`. Si KO → `RETURN json_build_object('error', 'not_a_challenger')`. Sinon `side='attack'`, `beneficiary = p_beneficiary_user_id`.
3. `place_court_action.expedition_id` (FK NOT NULL) : on enregistre l'**expédition challenger du bénéficiaire** sur ce lieu (celle créée lors de sa 1ère attaque) :
   ```sql
   SELECT e.id FROM public.expeditions e
   JOIN public.expedition_members em ON em.expedition_id = e.id
   WHERE em.user_id = p_beneficiary_user_id AND e.place_id = p_place_id
     AND (v_current_veilleur_exp IS NULL OR e.id != v_current_veilleur_exp)
   LIMIT 1;
   ```
   Tout challenger réel (score > 0) en possède une. Si NULL (cas anormal) → `error: challenger_expedition_missing`. Cette expé sert aussi de `p_target_expedition_id` effectif pour le maintien legacy `place_court_score` et la bascule (qui pose `place_veille.expedition_id`).
4. **Notif au challenger soutenu** : on **réutilise le type existant `place_court_support`** (introduit en V159 pour le soutien au veilleur, déjà géré côté front). Dans la branche attaque, quand `v_beneficiary != p_user_id` (= c'est un soutien, pas une attaque solo) → `PERFORM public.notify(v_beneficiary, 'place_court_support', ...)` + `activity_log`. Pas de nouveau type, pas de code front à ajouter (à confirmer : `useCourtNotifications` gère déjà `place_court_support`). Le veilleur garde ses notifs `place_court_attack` / `place_court_high_threat` inchangées (logique sur `v_new_score` = score du bénéficiaire challenger).

**`get_place_court_state` — modif ciblée :**
- Ajout d'un champ `challengers` (groupé par **bénéficiaire**, non-veilleur, score > 0) :
  ```sql
  -- pour chaque beneficiary_user_id != veilleur avec SUM(amount) > 0 :
  -- { userId, displayName, avatarUrl, score, factionColor, factionPattern, expeditionId }
  -- expeditionId = l'expé challenger du user sur ce lieu (cf. 5.1 §3), pour l'appel front.
  -- ORDER BY score DESC LIMIT 5.
  ```
- Le reste (`topPatrons` désagrégé par investisseur, `veilleur`, `threats` legacy) **inchangé** — `topPatrons` reste la vue réputation (qui investit), `challengers` est la vue « cibles soutenables » (qui menace le trône).

### 5.2 Frontend `apps/explore-web`

| Fichier | Action |
|---|---|
| `types/court.ts` | NEW interface `Challenger` (`userId, displayName, avatarUrl, score, factionColor, factionPattern, expeditionId`) ; ajout `challengers: Challenger[]` à `PlaceCourtState` ; prop `beneficiaryUserId?: string` au flux invest |
| `components/places/details/PatronsList.tsx` | Section « ⚔ Challengers » basée sur `challengers` (score-bénéficiaire) au lieu du filtre `attackTotal` investisseur-centrique ; bouton « 🪙 Soutenir » par ligne → callback `onSupportChallenger(challenger)` |
| `components/places/actions/InvestCrownsModal.tsx` | Prop optionnelle `beneficiaryUserId` transmise à l'appel `invest_crowns`. Réutilisé tel quel (slider + preview « score X → X+N, à battre : score veilleur »). Titre adapté : « Soutenir [nom] » |
| `components/places/details/PlaceCourtView.tsx` | Passe `state.challengers` + `onSupportChallenger` à `PatronsList` ; ouvre `InvestCrownsModal` en mode soutien-challenger (`side='attack'`, `currentScore = challenger.score`, `scoreToBeat = scoreVeilleur`, `beneficiaryUserId = challenger.userId`, `expeditionId = challenger.expeditionId`) ; refetch au succès. Bouton « Influencer » **inchangé** |
| `lib/expeditionsApi.ts` *(si wrapper)* | Vérifier si `invest_crowns` y est wrappé ; sinon appel direct comme l'existant |

### 5.3 Hub

Aucun changement requis V1.

## 6. Flux (soutenir un challenger)

1. User ouvre la fiche de lieu → onglet Infos → La Cour → déplie « Mécènes du lieu ».
2. Section « ⚔ Challengers » : chaque attaquant (user) avec son score + bouton « Soutenir ».
3. Clic → `InvestCrownsModal` (slider, preview, « à battre : score veilleur »).
4. Confirme → `invest_crowns(caller, placeId, challenger.expeditionId, amount, challenger.userId)`.
5. RPC crédite le score du challenger ; si dépasse le veilleur → bascule, le challenger devient veilleur ; notifs émises.
6. Front refetch `get_place_court_state` → liste + jauge à jour.

## 7. Cas limites

- **Solde insuffisant / montant ≤ 0** : `insufficient_crowns` / `invalid_amount` (déjà gérés).
- **Challenger basculé entre l'affichage et le clic** : si `p_beneficiary_user_id` est devenu le veilleur → `side='defense'` (bénin, on le crédite comme veilleur). Si un autre a basculé → la validation `score > 0 AND != veilleur` reste vraie, le soutien s'applique au nouveau contexte.
- **Bénéficiaire plus un challenger valide** (score retombé à 0 via plant_flag wipe) → `error: not_a_challenger`, le front refetch et la ligne disparaît.
- **Auto-soutien** (`p_beneficiary_user_id = caller`) : autorisé, équivaut à l'attaque solo legacy.
- **Cap 500** : ne s'applique qu'au gain de Couronnes (énigmes), pas à l'investissement. Pas d'impact.

## 8. Hors scope V1

- Soutenir le veilleur via la liste (déjà couvert par le bouton principal « Soutenir le veilleur »).
- Bouton « Soutenir » sur les lignes *soutiens du veilleur* (on ne soutient pas un soutien).
- Titre / haut-fait spécifique « mécène d'attaque ».
- Retrait / remboursement de Couronnes investies (brûlées, inchangé).

## 9. Tests bout-en-bout

2 comptes (A veilleur, B challenger, C tiers) :
1. B attaque le lieu de A via « Influencer » (score B = X).
2. C ouvre la liste → soutient B → score B monte, A reçoit `place_court_attack` / `high_threat`, B reçoit la notif de soutien.
3. C continue jusqu'à `score B > score A` → bascule : **B** devient veilleur (pas C), C reste mécène visible.
4. A re-plante GPS → wipe des scores tiers, A redevient veilleur (régression vérifiée : flux plant_flag intact).
5. `pnpm build` (tsc strict + vite) OK ; pas de `any`, pas de `console.log`.
