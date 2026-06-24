# Spec — Compagnie Officielle + Allié

**Décidé le 24/06 (Uriel).** Résout le trilemme « multi-compagnies / contributions acquises / carte monochrome » en séparant allégeance et social.

## Modèle

- **Compagnie OFFICIELLE** (1 par joueur) = `users.faction_id`. C'est l'allégeance :
  - les **points** de Coupe y vont (déjà géré par banner-history) ;
  - les **territoires** (veilles non-neutres du joueur) la suivent / sont à sa couleur ;
  - le joueur compte pour son **Coupe**, son **rang/Chef**, ses **grades**.
- **Compagnie ALLIÉE** (1 en plus, optionnelle) = la 2e adhésion (`faction_members` ≠ `users.faction_id`) :
  - **chat** accessible ;
  - apparaît dans la liste des membres avec le badge **« Allié »** ;
  - **0 point**, exclu du classement, du Chef et des grades. Purement social (accès aux copains).
- Cap inchangé : **2 adhésions max** (1 officielle + 1 alliée).

## Règles

1. **Adhésion**
   - 0 compagnie → `join`/`create` → devient **officielle** (`faction_id` posé). _(déjà le cas)_
   - 1 officielle → `join` une 2e → devient **alliée** (`faction_id` inchangé). _(déjà le cas)_
2. **Officielle** : points (banner-history), territoires (suivent `faction_id`), Coupe, Chef, grades.
3. **Allié** : chat + membre badgé « Allié », 0 point, **exclu** `_faction_chef` / grades / classement.
4. **Changer d'officielle** (promouvoir l'allié / basculer) : **délibéré + cooldown**
   (réutiliser `faction_change_cooldown_days` / `faction_change_window`).
   - `users.faction_id` = nouvelle officielle ; l'ancienne devient l'alliée.
   - **territoires** non-neutres du joueur → repeints à la nouvelle officielle
     (repaint CONTRÔLÉ, uniquement sur ce changement délibéré — pas de toggle casual).
   - **points futurs** → nouvelle (banner-history ferme l'intervalle, en ouvre un neuf) ;
     **points passés** restent acquis à l'ancienne.
5. **Toggle de bannière actuel** (`BannerToggle` + `set_active_faction` casual) → **supprimé**,
   remplacé par une action explicite « Désigner comme officielle » (confirmation + cooldown).

## Impacts techniques

- **Pas de nouvelle colonne nécessaire** : officiel = membership where `faction_id = users.faction_id` ;
  allié = l'autre. (Colonne `role` possible si on veut être explicite — à trancher à l'implémentation.)
- `_faction_chef` : exclure les alliés (membres dont `users.faction_id <> p_faction_id`).
- `get_faction_detail` : marquer chaque membre `isAlly` ; badge « Allié » ; alliés hors classement/chef
  (leur coupe est déjà 0 via banner-history).
- `set_active_faction` → devient `set_official_faction` : cooldown + repeint des territoires du joueur
  vers la nouvelle officielle. (Restaure un repaint, mais borné à ce changement délibéré.)
- `join_faction` : inchangé (2e adhésion = alliée automatiquement). Vérifier accès chat allié (membre → OK).
- Front : retirer/retravailler `BannerToggle` ; badges « Allié » dans Hall / CompaniesPage / explorateur ;
  action « Désigner officielle ».
- Banner-history : conservé (gère l'historique des officielles pour l'épinglage des points passés).

## Déjà en place (au 24/06)
- Points uniquement pour la compagnie active/officielle (banner-history, migs 288/292).
- Territoires suivent l'officielle (orphelins adoptés, mig 294 ; stamp à la plantation).
- 2 adhésions max ignorant les retirées (mig 287).

## Reste à construire
Rôle Allié (badge + exclusions chef/grades/classement), `set_official_faction` (cooldown + repaint),
suppression/refonte du toggle, badges UI. **+ le plan Titres/grades** (parké) se branchera dessus
(grades = officiels uniquement).
