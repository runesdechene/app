# Flyer QR → Cadeau → Code promo boutique

**Date :** 2026-06-23
**Statut :** Design validé, prêt pour plan d'implémentation

## Intention

Un QR code imprimé sur les flyers de la marque renvoie vers une page privée du Hub
qui offre un cadeau (code promo boutique) en échange de l'email. L'email crée un
compte app en transparence (inscription indolore — socle existant : 1 email = 1 compte).

**But premier :** vendre en boutique. L'app n'est pas imposée comme tunnel — c'est
juste une page cadeau. La récolte pour la marque = l'email, ajouté à l'audience
Shopify (newsletter) pour les campagnes.

## Flow utilisateur

1. Le visiteur scanne le QR du flyer → ouvre une **URL unique et statique** (la même
   pour tous les flyers, imprimée).
2. Page privée du Hub : écran « **Bienvenue dans la Confrérie, voici ton cadeau** ».
3. Champ email → il valide.
4. Compte créé en transparence (aucun tunnel : pas de mot de passe, pas d'onboarding).
5. Le **code promo** s'affiche immédiatement (+ envoyé par mail via le flow Shopify).

## Technique

On **calque le pattern existant** `apps/hub/netlify/functions/stand-create-account.ts`
(création de compte fantôme en festival). Différences : public au lieu d'admin, et
nouvelle source `flyer`.

### Nouvelle Netlify function `flyer-create-account.ts`

- **Publique** — pas de `requireAdmin` (contrairement au flow stand).
- **Idempotent** : email déjà connu → on réaffiche le code promo, aucun doublon créé.
- **Shopify** : crée/maj le `customer` avec `email_marketing_consent: { state: 'subscribed' }`
  (opt-in newsletter) + tag `source:flyer` (via `buildTags`, qui pose déjà `source:stand`).
- **Supabase** : insère le user fantôme `id = "shopify-{customerId}"`,
  `account_source = 'flyer'`, `is_active: true`.
- Retourne le code promo à afficher.

### Garde-fous (flow public)

> Note de design : l'URL du QR est **statique** (même URL pour tous). Un token secret
> dans l'URL ne protégerait de rien (quiconque a le flyer a l'URL et peut la rejouer).
> On ne met donc **pas** de faux garde-fou. Les vrais :

1. **Idempotence email** — 1 email = 1 compte = 1 code. Rejouer un email ne crée rien.
2. **Rate-limit par IP** — côté Netlify function, contre le spam d'emails bidons en masse.

### Code promo : générique

- **Code générique** (ex. `CONFRERIE10`), le même pour tous.
- Pourquoi pas unique Shopify : avec une URL statique, le code unique n'apporte aucune
  traçabilité réelle (on ne sait pas *qui* scanne, juste qui donne son email — déjà
  couvert par `source:flyer`). Et le code unique créerait une incitation à farmer des
  codes via faux emails. Le générique est plus simple et plus robuste.
- Seul « abus » résiduel = pollution de la liste par faux emails → couvert par le rate-limit.

### Migration SQL

- Élargir le CHECK constraint `users.account_source` pour accepter `'flyer'`
  (calquer `139_extend_account_source_stand.sql` : `app` | `shopify` | `stand` | `flyer`).

## Segmentation obtenue

- `account_source = 'flyer'` (Supabase) + tag `source:flyer` (Shopify) → campagne email
  ciblée « nés du flyer », funnel flyer → vente isolé.

## Hors scope

- Pas de code promo unique par personne.
- Pas de tunnel d'inscription app (mot de passe, onboarding).
- Dette notée mais **non traitée ici** : points exploration/érudition morts depuis 0.6 ;
  compteur public `movement_stats` qui compte tous les comptes fantômes sans filtre.
