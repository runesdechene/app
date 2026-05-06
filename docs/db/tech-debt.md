# Dette technique — DB & SQL

> Liste des dettes connues, à traiter dans les sprints cleanup.
> Format : titre, contexte, coût estimé, urgence.

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
