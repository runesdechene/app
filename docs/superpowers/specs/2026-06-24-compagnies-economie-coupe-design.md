# Économie & Coupe des Compagnies + bannière active — design

> Suite de [factions-creables-lot1](../plans/2026-06-24-factions-creables-lot1.md).
> Mécanique = `faction*` ; user-facing = « Compagnie ». Validé avec Uriel le 24/06.

## Intention

Donner aux Compagnies des **sources de points (Coupe)** claires et **saines** (l'effort
prime, l'argent ne rachète pas le classement), et un levier d'**entraide** par les Couronnes.
Rendre utilisable l'appartenance à **2 Compagnies** (cas d'usage réel : une **locale** + une
**plus grande**) via une **bannière active** unique.

## 1. Appartenance & bannière active

- **Max 2 Compagnies** par joueur (déjà en place). Cas d'usage : locale + grande.
- **Une seule bannière active à la fois** = `users.faction_id`. Elle reçoit :
  ta Coupe (toutes tes actions, énigmes incluses), ta couleur sur la carte, ton canal
  de chat mis en avant, tes Couronnes investies.
- La 2ᵉ Compagnie reste **réelle** (membre, roster, chat) mais ne reçoit pas ta Coupe tant
  qu'elle n'est pas active. **Pas de double-crédit** (sinon la Coupe ne veut plus rien dire
  et tout le monde s'inscrit partout pour farmer).
- **Choisir sa bannière = acte de jeu stratégique** (« je pousse ma locale » vs « ma grande »),
  posé rarement — **jamais un toggle par-action**.
- **Garde-fou UX** : la bannière active est **affichée là où on agit** (HUD carte + écran
  d'énigme : petit « ⚔️ pour {Compagnie} ») → jamais de « mes points sont partis au mauvais
  endroit ».
- **À construire** : le toggle de bannière active (backend `set_active_faction` déjà prêt).
  Emplacements : bouton **« ⚑ Porter ces couleurs »** dans le Hall (si membre & pas active) ;
  liseré/coche sur la Compagnie active dans la FactionBar.

## 2. Coupe de la Compagnie

Score compétitif = **somme du Coupe des membres dont c'est la bannière active**, sur la saison
(modèle existant `_user_coupe_score` agrégé par `users.faction_id`).

### Barème (par action d'un membre)
| Action | Coupe | Note |
|---|---|---|
| Ajouter un lieu | +7 | inchangé |
| Visite GPS d'un lieu | +3 | inchangé |
| Plantage de bannière | +2 | inchangé |
| Énigme résolue | +1 | **gardé** (déjà compté ; capé naturellement 1/j + fragments) |
| Photo sur un lieu | +1 | **uniquement la 1ʳᵉ photo d'un membre sur un lieu donné** |
| Récit / description | **0** | **exclu** (non capé → farmable). Retirer la clé morte `coupe.carnet`. |

> ⚠️ `carnet` n'existe plus en base (→ `description`, 2783 lignes). La clé `coupe.carnet`
> du barème ne matche plus rien : à retirer. Les récits restent à **0** (décision anti-spam).

### Conquête à l'or (nouveau, « moindre mesure »)
- Couronnes investies pour la Compagnie sur un lieu → converties en Coupe **par tranche**,
  **prorata réduit**, **plafonné/jour/membre**.
- Valeurs (paramétrables `app_settings`) : **1 Coupe / 10 🪙**, **cap 10 Coupe/jour/membre**.
- Pas de pay-to-win : Couronnes **gagnées en jeu** (capées), et l'or vaut bien moins que l'effort.

## 3. Couronnes investies (entraide)

- Réutilise le **Mécénat existant** : `invest_crowns(p_user_id, p_place_id, …, p_amount,
  p_beneficiary_user_id)` — soutenir un coéquipier sur un lieu existe déjà.
- Quand un membre investit en portant la bannière de la Compagnie X → le montant s'ajoute au
  **total de Couronnes investies de X** (affiché dans le Hall = fierté collective) et alimente
  la Coupe de X via la **tranche** (§2).
- **Distinction à garder pour rester sain** :
  - `faction_members.crowns_invested` du **fondateur** (coût de fondation, 200) → reste
    l'**avantage Chef** : rang interne = Coupe + `crowns_invested` (1:1). Petit, fixe.
  - La **conquête à l'or** → compte pour le **score de Compagnie** au **prorata réduit
    (tranche)**, pas 1:1. L'or ne rachète pas le classement.
- **Chef inchangé** = top (Coupe saison + `crowns_invested`), détrônable.

## 4. Affichages

- **Hall** : par membre `🏆 Coupe` (+ `🪙 investies` si >0, déjà fait) ; **total Couronnes
  investies de la Compagnie** (nouveau).
- **HUD carte + écran d'énigme** : bannière active « ⚔️ pour {Compagnie} ».
- **FactionBar** : coche/liseré sur la Compagnie active.

## Hors périmètre (plus tard)
- Dépense du trésor / bonus collectifs ; pactes de lieu (SPEC 3) ; rôle « Mécène » distinct.

## Garde-fous récap
- Photo : 1ʳᵉ par lieu seulement. Récits : 0. Énigme : capée nativement.
- Or → Coupe : tranche + cap/jour + Couronnes earned-only. Pas de double-crédit (1 bannière).
- DB partagée prod : migrations additives appliquables ; rien de breaking sans release coordonnée.
