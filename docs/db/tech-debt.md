# Dette technique — DB & SQL

> Liste des dettes connues, à traiter dans les sprints cleanup.
> Format : titre, contexte, coût estimé, urgence.

---

## D-UI1. Unifier les modales de récompense en un seul `<RewardModal>`

**Origine** : 2 juin 2026 — la `QuestRewardModal` (butin des Défis du jour) réutilise le CSS de `VictoryModal` (classes `victory-*`) mais reste un **composant séparé** (markup dupliqué). Il existe en parallèle `LevelUpModal` (CSS `lvlup-*`, distinct). → 3 composants de récompense, 2 feuilles de style.

**Dette à traiter** : extraire un composant présentationnel unique `<RewardModal>` (1 fichier + 1 CSS : label, icône, titre, citation, encart gains, bouton, accent themable) et faire passer Victoire + Palier + Quête dessus. Style/structure modifiés à **un seul endroit**.

**Coût** : moyen — touche `VictoryModal` + `LevelUpModal` en prod (Cour/Veilles/level-up), tests soigneux requis.

**Urgence** : basse — le CSS Quête+Victoire est déjà mutualisé ; seuls le Palier et le markup divergent. (Demandé par Uriel le 2026-06-02 : "on garde pour l'instant, à unifier un jour".)

---

## D0. Drift repo/prod — mig 175 patche dynamiquement 3 RPCs

**Origine** : 28 mai 2026 — bump du rayon GPS 100m → 200m (bug RICKNON viaduc de la Borrèze). Au lieu de recopier 350 lignes de RPCs pour 3 fonctions (`plant_flag`, `revisit_place_gps`, `_visit_place_gps_internal`), la mig 175 fait un `pg_get_functiondef` + `replace('v_distance_km > 0.1', 'v_distance_km > 0.2')` + `EXECUTE` dynamique. Idempotent et court (~15 lignes utiles).

**Drift** : les définitions en repo des 3 RPCs (mig 166 pour `plant_flag` ; définitions historiques implicites pour les 2 autres) restent à `0.1`. La prod est à `0.2`. Le prochain qui édite un de ces RPCs DOIT partir de `pg_get_functiondef` en prod, **pas** du repo, sinon réintroduit `0.1`.

**Dette à traiter** : prochaine fois qu'on touche `plant_flag` (probable — sujet sensible), créer une mig CREATE OR REPLACE complète avec `0.2` et supprimer cette note D0.

**Coût** : 0 (corrigé "naturellement" au prochain travail sur ces RPCs).

**Urgence** : basse — tant que le repo n'est pas pris comme source de vérité aveugle pour ces 3 RPCs.

---

## D1. Tables Plantage à renommer : `expeditions` → `plantage_groups`

**Origine** : 6 mai 2026 — pendant le brainstorm du sous-système "Expéditions joueur-joueur" (V0.7+), on a découvert que la table `expeditions` existait déjà côté Plantage/Veille V0.7 (mig 015), où elle représente un *groupe de veilleurs qui plantent ensemble* (concept proche, mais distinct).

**Pour ne pas bloquer la livraison** : le nouveau système Expéditions utilise le préfixe SQL `voyage_*` (tables `voyages`, `voyage_participants`, `voyage_messages`, `voyage_reports`, etc.) tandis que le frontend, les types TS, les composants React et le wording UI restent en "Expedition" (la couche `expeditionsApi.ts` fait le mapping).

**Dette** :
- Tables à renommer : `expeditions` → `plantage_groups`, `expedition_members` → `plantage_group_members`
- Colonnes à renommer : `place_veille.expedition_id` → `plantage_group_id`, `veille_history.expedition_id` → `plantage_group_id`
- RPCs vivantes à patcher (audit nécessaire — ~10-15 RPCs estimées dans les migs 015-103, notamment `plant_flag`, `get_place_veille*`, `get_player_profile*`, `crowns_*`, `court_state_*`)
- Frontend : 6 fichiers TS référencent `expedition_id` côté Plantage (notificationStore, types/veille, types/court, PlaceCourtView, InvestCrownsModal, courtToastMessages)

**Coût estimé** : 1 journée de refacto concentré + tests prod.

**Quand traiter** : prochain sprint cleanup. Pas urgent — la cohabitation `voyage_*` (Expéditions joueur) / `expeditions` (Plantage) fonctionne sans collision tant que personne n'écrit du SQL ad-hoc qui mélange les deux concepts.

**Approche recommandée** : 1 seule migration qui ALTER TABLE RENAME + CREATE OR REPLACE de toutes les RPCs vivantes touchées dans la même transaction (rollback atomique si une RPC casse).

---

## D2. Consolider `users.first_name` et `users.display_name`

**Origine** : 6 mai 2026 — sprint Expéditions. La table `users` a deux colonnes de nom :
- `first_name` (varchar 255) — colonne d'origine, écrite par l'app à l'inscription (cf. `usePlayer.ts`).
- `display_name` (text) — ajoutée plus tard avec une intention "nom d'affichage différent du prénom légal", **jamais écrite par aucune migration ni par l'app**.

**Conséquence** : 50+ migrations V0.7 (Coupe, Cour, plantage, leaderboards, Expéditions…) lisent `display_name` qui est NULL pour la majorité des users. Les RPCs retournent des noms vides en silence. Les composants ont parfois des fallbacks (`?? 'Voyageur'`) qui masquent le bug, mais le sous-système Expéditions a révélé le problème.

**Backfill appliqué** (mig 117) : `UPDATE users SET display_name = first_name WHERE display_name IS NULL`. Résout immédiatement la lecture pour les users existants.

**Dette à traiter** : décider du nom canonique et drop l'autre.
- Option A — drop `first_name`, garder `display_name` : sémantique plus moderne (un user "affiche" un nom). Coût : refondre `apps/explore-web/src/hooks/usePlayer.ts` + tous les autres usages de `first_name` dans le code (à inventorier — l'auth en dépend).
- Option B — drop `display_name`, garder `first_name` : moins disruptif côté code, mais touche 50 migrations + 19 fichiers TS qui lisent `display_name`. Coût plus élevé.

**Coût estimé** : 1 jour de refacto + tests.

**Quand traiter** : prochain sprint cleanup. Pas urgent — le backfill + la convention `COALESCE(display_name, first_name)` dans les nouvelles RPCs (cf. règle XO en mémoire) tient l'eau.

**Convention temporaire** : toute nouvelle RPC qui retourne un nom user doit faire `COALESCE(u.display_name, u.first_name, 'Voyageur')`.

**Mise à jour 28 mai 2026 — souffrance immédiate résolue** : mig 182 ajoute un trigger BEFORE INSERT/UPDATE OF first_name sur `users` qui force `display_name := first_name` à chaque écriture. + backfill one-shot des 9 users actifs touchés (Yaz, etc.). Les 2475 comptes dormants (`first_name = display_name = 'Un voyageur sans nom'`) sont laissés intacts — ils seront sync automatiquement à leur prochain edit. La dette structurelle (drop d'une colonne, choix Option A vs B) reste à trancher au prochain sprint cleanup.
