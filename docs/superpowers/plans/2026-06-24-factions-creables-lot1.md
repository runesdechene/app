# Factions créables par les joueurs — Lot 1 — Plan

> PIVOT 24/06 (option A). Abandon SPEC 1 Classes + SPEC 2 Compagnies. On reprend le
> **moteur Faction** (déjà câblé : Coupe `get_coupe_state`/`_faction_member_scores`/
> `_user_coupe_score`, chat Dortoir `channel=factionId`, couleurs carte via
> `places.faction_id`, titres, FactionBar, `set_user_faction`, `get_faction_members`)
> et on le rend **créable + gérable par les joueurs, sans rien imposer**.
> Branche : `v1-factions-creables` (depuis `main`, migs jusqu'à 269).

## Décisions design (validées Uriel 24/06)

- **Pas imposé** : nouveau joueur démarre **factionless**. La FactionModal devient un
  choix optionnel (rejoindre/fonder), plus une étape forcée de l'onboarding.
- **4 héritages actuels (byzantine/celtique/nordique/romaine) = RETIRÉS** mais **pas
  supprimés** (11 FK dont 6 `NO ACTION` sur l'historique → DELETE bloqué). Soft-retire :
  flag `retired=true`, exclues de tout l'UI/choix ; `users.faction_id := NULL` pour leurs
  membres actuels (tout le monde repart à zéro). Cold-start : on assume le départ vide
  (création libre), pas de seed officielle.
- **Appartenance max 2** + **1 faction active** (bannière). `users.faction_id` = la faction
  **active** (pilote Coupe/chat/couleur). Nouvelle table de jonction `faction_members` =
  les ≤2 appartenances.
- **Chef = plus haute Coupe** (détrônable), pas le fondateur. Le chef édite l'identité +
  exclut des membres. `is_founder` gardé en base (extinction/trace) mais l'UI parle de « Chef ».
- **Fonder coûte 200 🪙**. Rejoindre = 1 clic. Quitter libre. **Extinction à 0 membre** =
  faction passée `retired=true` (pas de DELETE, FK historiques).
- Score faction = **Coupe de la saison active** = somme `_user_coupe_score` des membres dont
  c'est la faction **active** → `_faction_member_scores`/`get_coupe_state` marchent **déjà
  sans modif** (ils agrègent par `users.faction_id`).

## Terminologie (IMPORTANT)

User-facing = **« Compagnie »** (Chef de Compagnie, Fonder une Compagnie…). Code/DB/RPC =
`faction*` (la mécanique). Cf. Mécénat/court. Les composants portés affichent déjà « Compagnie ».

## Cold-start & bucket

- **Pas de seed** : départ 100% émergent (assumé par Uriel). Scoreboard vide au lancement,
  les premiers joueurs créent.
- Bucket emblèmes = **`faction-emblems`** (Uriel le crée manuellement). Upload via
  `lib/companyImageUpload` repointé sur ce bucket.

## Stratégie d'application prod (DB partagée avec le live)

La DB est la prod live. On **scinde** en deux migrations :
- **`270_factions_creatable_schema.sql` — ADDITIF, appliqué tout de suite** (colonnes `created_by`/
  `retired`, table `faction_members`, RPC, `app_settings` faction_*). Inoffensif pour le live.
- **`271_factions_retire_heritages.sql` — BREAKING, NON appliqué** (retire les 4 + `users.faction_id
  := NULL`). Casserait les users live → gardé pour la **release coordonnée** (deploy frontend +
  push ensemble). À documenter, pas à pousser maintenant.

## Pattern réutilisé (copié de `create_company`, déjà en prod)

- Solde : `user_crowns(user_id, balance, updated_at)` → `SELECT balance FOR UPDATE` puis
  `UPDATE ... SET balance = balance - v_cost`.
- Config : `app_settings(key,value)` → clés **`faction_founding_cost` (=200)**, `faction_max_count` (=2).
- Validations nom : `btrim`, `<> ''` → `name_required`, `> 40` → `name_too_long`,
  unique `lower(name)` → `name_taken` ; count membres ≥ max → `too_many`.
- Erreurs : `{error:'insufficient_crowns', cost, balance}` sinon `{success:true, factionId, cost}`.

## Migration `270_factions_creatable_schema.sql` (additif)

1. `ALTER TABLE factions ADD COLUMN created_by text REFERENCES users(id) ON DELETE SET NULL`,
   `ADD COLUMN retired boolean NOT NULL DEFAULT false`. (`description`, `image_url`, `color`,
   `title` existent déjà.)
2. Soft-retire des 4 : `UPDATE factions SET retired=true WHERE id IN (...4...)` ;
   `UPDATE users SET faction_id=NULL WHERE faction_id IN (...4...)`. Idempotent.
3. `CREATE TABLE faction_members (faction_id varchar REFERENCES factions(id) ON DELETE CASCADE,
   user_id text REFERENCES users(id) ON DELETE CASCADE, joined_at timestamptz DEFAULT now(),
   is_founder boolean DEFAULT false, PRIMARY KEY(faction_id,user_id))`. + index user_id.
   RLS : lecture publique ; écriture via RPC SECURITY DEFINER only.
4. RPC (toutes `SECURITY DEFINER`, retournent `json` `{success}|{error}` comme les RPC compagnie) :
   - `create_faction(p_user_id, p_name, p_color, p_description, p_image_url)` → slug unique
     (`'f-'||substr(md5(...),1,10)` en bouclant si collision), check `name` libre + ≤40,
     check ≥200 🪙 (réutiliser le débit Couronnes existant — **lire la RPC `create_*`/débit
     courante avant**, ne pas inventer), insert faction(created_by, order=max+1), insert
     faction_members(is_founder=true), `users.faction_id := new` (active). Renvoie `{factionId,cost}`.
   - `join_faction(p_user_id, p_faction_id)` → faction non-retired, count membres user <2,
     insert membership ; si pas de faction active → la rendre active.
   - `leave_faction(p_user_id, p_faction_id)` → delete membership ; si c'était l'active →
     bascule sur l'autre appartenance ou NULL ; si 0 membre restant → `retired=true`.
   - `set_active_faction(p_user_id, p_faction_id|null)` → doit être une appartenance ;
     `users.faction_id := p_faction_id`.
   - `update_faction_identity(p_user_id, p_faction_id, name, color, description, image_url)` →
     permission = chef (top `_user_coupe_score` parmi membres, saison active).
   - `remove_faction_member(p_user_id, p_faction_id, p_target)` → permission chef ; pas soi ;
     si la cible avait cette faction active → NULL/bascule.
   - `get_my_factions(p_user_id)` → `{activeFactionId, factions:[{id,title,color,imageUrl,
     description,memberCount,isActive,isFounder}]}`.
   - `get_faction(p_faction_id)` → détail + `members` triés par Coupe desc (rang 1 = chef),
     `totalCoupe` (saison active), `createdBy`.
   - `list_factions(p_search)` → factions non-retired classées par Coupe saison active
     (réutiliser la fenêtre de saison + `_user_coupe_score` ; ou dériver de `get_coupe_state`).
5. `get_factions_for_choice` : filtrer `WHERE retired=false`.

## Frontend (port du travail Compagnie, salvage depuis `v1-refonte-identite`)

- `stores/factionGroupStore.ts` ← port `companyStore` (loadMine/loadDirectory/create/join/
  leave/switchBanner/updateIdentity/removeMember) repointé sur les RPC `*_faction`.
  ⚠️ il existe déjà un état faction (playerStore.faction_id, FactionModal) — **ne pas
  dupliquer la lecture de la faction active**, brancher dessus.
- `components/factions/FactionCreateForm.tsx` ← port `CompanyCreateForm` (palette, upload image).
- `components/factions/FactionHallModal.tsx` ← port `CompanyHallModal` (2 colonnes : identité+
  mission / classement par Coupe ; chef = rang 1 ; chat = bouton vers Dortoir).
- **Scoreboard** : la `FactionBar` existe déjà (classement Coupe). Lui ajouter un accès
  « Fonder une faction (200🪙) » + « Explorer/Rejoindre » + clic faction → `FactionHallModal`.
- **Onboarding non-imposé** : retirer la FactionModal forcée du flux nouveau joueur
  (OnboardingModal → ne plus enchaîner sur FactionModal obligatoire). Garder un accès
  volontaire (ProfileMenu + FactionBar « Fonder/Rejoindre »).
- Image upload : réutiliser `lib/companyImageUpload` → renommer/pointer sur un bucket.
  🪣 **Bucket à confirmer** : `faction-patterns` existe (servait aux 4). Soit on autorise
  l'upload user dessus (RLS), soit nouveau bucket `faction-emblems`. **À créer/configurer
  manuellement** (signaler à Uriel).

## Garde-fous

- DB : query schema avant chaque RPC touchant une colonne ; jamais inventer (cf. FK ci-dessus).
- Coupe/chat/couleur : **ne rien réécrire**, ils suivent `users.faction_id` (active). Vérifier
  que créer une faction → sa couleur teinte bien la carte (territoire) et le chat Dortoir marche.
- RLS `faction_members` + `chat_messages channel=factionId` : un membre lit/écrit sa faction active.
- Pas de runtime test hors navigateur → `pnpm build` + click-flow Uriel avant tout deploy.
- **Mig 275 (companies) reste appliquée en prod = objets morts additifs.** Noter dans
  `docs/db/cleanup-v1-identity.md` (DROP au grand nettoyage, pas maintenant, [[verify_before_drop]]).

## Hors Lot 1 (différé)

- Échelons/hiérarchie organique (Membre/Porte-voix/Capitaine), pactes de lieu (SPEC 3),
  re-thématisation, métriques Couronnes investies (trésor de faction).
