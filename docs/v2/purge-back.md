# Registre de purge du back

> Tout ce que le back devra perdre ou corriger une fois la V2 lancée. **Des candidats, pas des
> ordres** : chaque DROP en prod est revérifié à la main au moment de le faire.
> Règle : un commit V2 qui croise un objet douteux ajoute sa ligne dans le même commit.

## 1. À supprimer après bascule

| Objet | Constat | Action | Quand | Source |
|---|---|---|---|---|
| Coupe des Héritages (`get_coupe_state`, tables associées) | classement entre Maisons, abandonné | supprimer | après bascule | spec V2 §1 |
| La Cour (`place_court_*`, `invest_crowns`, couronnes, mécénat, veilleurs) | prendre un lieu à un autre, abandonné | supprimer | après bascule | spec V2 §1 |
| Contestation de lieu | abandonnée | supprimer | après bascule | spec V2 §1 |
| Bonus d'énergie : `users.max_energy`, `factions.bonus_energy` / `bonus_regen_energy`, `title_fragments.bonus_type` `max_energy` / `regen_energy`, multiplicateur outsider sur l'énergie | ignorés depuis la mig 399 (jauge = 10 + 1 par Fragment, un point par heure) ; la page Réglages du Hub ne les écrit plus | supprimer | après bascule | spec énergie 01/10 |
| Compagnies, ce que la V2 ne lit plus : `faction_grade_labels` et les grades de `faction_members` (repris en Chef / Officiers par la mig 420), bannières et motifs (`factions.pattern*`, seau `faction-patterns`), `users.faction_id` (la Compagnie active V1 — `fonder` / `rejoindre` l'écrivent encore pour la V1), `create_faction` & co. | les Compagnies restent (antennes locales, migs 420-423) ; seuls les morceaux V1 partent | supprimer | après bascule | spec compagnies 05/10 |
| Gloire V1 (`notoriety_points`, `exploration_points`, `erudition_points`…) | ⚠️ le **niveau reste** (révision 27/09) : ne supprimer que ce qui ne nourrit plus `xp_total` ; vérifier chaque colonne avant | trier, puis supprimer | après bascule | spec V2 §1 révisé |
| Énergie (`energy_points`, `max_energy`, `energy_reset_at`, `preview_action_cost`, coût de `discover_place`) | supprimée : découvrir devient gratuit | supprimer | après bascule | décision 27/09 |
| Expéditions joueur-joueur (`voyage_*`) | abandonnées | supprimer | après bascule | spec V2 §1 |
| Quêtes du jour (et leurs tables) | abandonnées — ≠ Missions, qui restent | supprimer | après bascule | spec V2 §1 |
| `floor_glory`, `floor_crowns` sur les appels | liés à la Gloire et à la Cour | supprimer | au portage des appels | spec V2, reste à faire |
| Image `app-fragments/fragment-3.webp` (seau de stockage) | l'image de « Demiurge (Admin) », Fragment retiré par la mig 359 | supprimer à la main dans le stockage | dès la 359 appliquée | mig 359, 27/09 |
| `accueil_nouveaute()` | la V2 ne l'appelle plus : « Nouvelles de la marque » retirée de l'Accueil (Uriel, 28/09), la Saga prendra sa place ; `announcements` reste, le Hub et la V1 s'en servent | supprimer si la Saga ne la reprend pas | après bascule | 28/09 |
| `places.accessibility`, `places.best_season`, `places.bivouac` | remplacées par `acces`, `quand`, `bivouac_tolere` (mig 414) ; plus lues par la V2 | supprimer | après bascule | spec enrichir 05/10 |
| `edit_place_description`, `restore_place_description_revision`, `get_place_description_history`, `place_description_revisions`, `contribute_to_place` (types texte), `_rubrique_v1` | V1 en lecture seule (mig 414) ; l'histoire vit dans `versions_lieu` | supprimer | quand la V1 s'arrête | spec enrichir 05/10 |
| `get_mes_titres` : clés `cultures` (toujours `[]`) et `polymathe` (toujours NULL) | les connaissances ont quitté « Tous les titres » (gélules du profil) ; les clés restent pour la V2 1.5/1.6 qui les lit | retirer les deux clés, et leur lecture dans `lireMesTitres.ts` | quand aucune V2 en ligne ne les lit plus | mig 452 |

## 1bis. En sommeil — ne PAS supprimer

| Objet | Constat | Action | Quand | Source |
|---|---|---|---|---|
| Couronnes (`user_crowns`, réglages `crowns_*` dans `app_settings`) | ni gagnées ni affichées en V2.0 ; soldes gardés pour un usage futur (cagnotte du Campement ?) | couper les gains, garder tables et soldes | à la bascule | décision 27/09 |
| Énigmes (daily, fragment, lieu) + leurs 3 crons | en sommeil, on y reviendra | couper les crons, garder les tables | à la bascule | décision 27/09 |

## 2. À corriger

| Objet | Constat | Action | Quand | Source |
|---|---|---|---|---|
| `chat_messages` : `GRANT ALL` à `anon` | les RLS rattrapent pour un salon public, pas pour des murmures | révoquer, gater par appartenance à la conversation | avant la zone Messages | spec V2 §10 |
| `chat_messages.faction_id/color/pattern` | colorait les noms par Maison | neutraliser | au portage des Messages | spec V2 §10 |
| Toutes les vues de `public` en `security_invoker = off` | les default privileges donnent ALL à `authenticated` sur toute nouvelle vue ; une vue qui s'exécute en propriétaire et reste modifiable ouvre l'écriture (cas `users_admin`, corrigé mig 345) | **audité le 27/09** : les 3 autres vues (`daily_enigma_status`, `movement_stats`, `movement_wall_photos`) sont en `security_invoker=true` et non modifiables — leurs droits d'écriture affichés sont sans effet. Révoquer par propreté | après bascule | relecture 27/09 |
| `cleanup_old_chat_messages()` | purge tout à 14 jours, murmures compris | **résolu par construction** (28/09) : les murmures vivent dans leur propre table (`murmures`, mig 372), que la purge ne touche pas | — | spec V2 §10 |
| Seau `place-images` : policy INSERT ouverte à tout `authenticated` | n'importe quel connecté pouvait déposer dans le dossier d'un autre | **corrigé par la mig 385** (même ligne ci-dessous) ; restent ouverts à tout connecté, chacun dans son seau : `tag-icons` (Hub, modérateurs compris), `faction-patterns`, `app-assets` — à restreindre au staff | après bascule | Task 8 compte, 27/09 |
| `chat_messages.user_name` écrit par le client | la V1 insère elle-même le nom affiché : n'importe qui peut signer un message du nom d'un autre | la V2 écrit par `ecrire_au_registre` (le nom posé par la base, mig 371) ; côté V1, retirer l'INSERT direct (policies `chat_insert_*`) à la bascule | après bascule | relecture 28/09 |
| `unlock_pending_fragments(p_user_id, p_email)` | lisait l'e-mail fourni par l'appelant : on pouvait réclamer les Fragments achetés par un autre client | **corrigé** par la mig 369 (l'e-mail vérifié du jeton) — à appliquer | au GO d'Uriel | relecture 28/09 |
| **`storage.objects` : policies « Allow all 1snxhtj » et « Enable storage 1lvpvk4 »** (INSERT/UPDATE/DELETE `true`, tous seaux) | tout compte connecté pouvait déposer, écraser ou effacer n'importe quel fichier | **corrigé par la mig 385, à appliquer** (écrite et testée le 30/09) : chacun ses dossiers dans `place-images` (`places/<moi>/`, `<moi>/`), chef ou admin pour `faction-emblems`, admins pour les seaux du Hub | au GO d'Uriel | relecture Ajouter un lieu, 30/09 |
| `delete_place(p_user_id, p_place_id)` (V1, reprise par la V2 le 30/09) | SECURITY DEFINER **sans `search_path` fixé** ; rend son refus en `{ error }` au lieu de le lever ; n'efface pas les fichiers des photos dans `place-images` (orphelins) | réécrire en `supprimer_lieu(p_id)` (auth.uid(), `search_path`, refus levés, photos effacées) | avec « faire vivre un lieu » | suppression d'un lieu en V2, 30/09 |
| `@types/react` 18 dans explore-web et hub | React y tourne en 19.0.0 ; pnpm remonte l'une ou l'autre version dans son dossier caché, au hasard de l'installation, et react-query y lisait ses types : la CI de la V2 échouait (29-30/09). **Contourné** : le `tsconfig` de la V2 épingle `react` sur ses propres types (`paths`) | aligner sur 19 après la bascule, puis retirer l'épingle | après bascule | plan socle, Task 1 ; CI 30/09 |

## 3. Ajouté pour la V2

| Objet | Rôle | Source |
|---|---|---|
| `users.v2_access` | autorisation V2 par compte — **ne sert plus depuis la mig 398** (V2 ouverte à tous) : à retirer avec la case du Hub | mig 344 |
| `has_v2_access()` | la V2 demande si l'appelant peut entrer — tout compte connecté depuis la mig 398 ; à retirer à la bascule | mig 344, 398 |
| `set_v2_access(text, boolean)` | le Hub coche / décoche — sans effet depuis la mig 398 | mig 344 |
| Supabase Auth — URL `/v2/` | à autoriser quand la zone Compte aura sa propre connexion | spec socle §9 |
| PostGIS, `geo_departements`, `geo_pays`, `places.departement` / `pays`, `_rattacher_lieu`, déclencheur `places_rattacher` | rattacher chaque lieu (profil, régions parcourues) ; DROM rattachés au pays seulement ; 2 îlots isolés sans rattachement | migs 349-351 |
| déclencheur `envie_visitee` (`_trg_envie_visitee`) | une visite retire le lieu des envies (listes exclusives) | mig 352 |
| `users.show_departement`, `users.show_envies`, `get_my_preferences()`, `set_my_preference(text, boolean)` | Préférences de la V2, sans identifiant fourni | mig 353 |
| `set_my_displayed_titles(integer[])` | deux titres portés au plus ; remplace à terme `set_displayed_titles_v3` (trois) | mig 353 |
| `get_profil_explorateur(text)` | profil public en une lecture ; remplace à terme `get_player_profile` pour la V2 | mig 354 |
| `users.signe_fragment_id`, `set_my_signe(integer)` ; `set_my_displayed_titles` passé à 3 | le signe d'un Porteur ; trois titres de jeu (révision du 27/09) | mig 356 |
| `saluts`, `accueil_nouveaute()`, `accueil_ajoutes(int)`, `sur_les_chemins(int)`, `saluer(text)`, `_auteur_du_chemin(text)` | l'Accueil : nouveauté, ajoutés récemment, le fil et ses saluts | mig 368 |
| `users.charte_signee_le`, `signer_charte()`, `nommer_explorateur(text)`, `mon_entree()` | l'onboarding : Charte, nom, numéro d'Explorateur | mig 370 |
| `registre(text[], int)`, `ecrire_au_registre(text, text)` | le Registre (Messages) : lire, écrire, le nom posé par la base | mig 371 |
| `murmures`, `murmurer(text, text)`, `mes_murmures()`, `conversation(text, int)`, `lire_murmures(text)` | les Murmures, messages privés | mig 372 |
| `factions.privee/devise/chef_m/chef_f/officier_m/officier_f`, `faction_members.role`, `demandes_compagnie`, `expeditions.pour_compagnie`, `place_veille.pour_compagnie`, `_est_porteur`, `_role_compagnie` | les Compagnies V2 : fiche, rôles nommés, demandes, revendiquer pour une Compagnie | mig 420 |
| `compagnies()`, `compagnie(text)`, `fonder_compagnie`, `modifier_compagnie`, `rejoindre_compagnie`, `repondre_demande`, `quitter_compagnie`, `changer_role`, `retirer_membre` ; notifications `demande_compagnie` / `demande_acceptee` | les gestes d'une Compagnie | migs 421, 423 |
| `mes_canaux()` ; `registre` / `ecrire_au_registre` / `registre_non_lus` aux canaux des Compagnies ; `revendiquer_lieu(…, p_pour_compagnie)` | chaque Compagnie est un canal de La Communauté | mig 422 |
| policy `Admins manage factions` (remplace « Auth manage factions »), `_trg_succession` + déclencheur `faction_members_succession` ; `ecrire_au_registre` / `aimer_message` / `marquer_registre_lu` aux membres des Compagnies | relecture des Compagnies : écriture directe réservée aux admins, mentions et cœurs entre membres, lu jusqu'aux Compagnies, tout départ passe la main | mig 424 |
| `sur_les_chemins` : lignes `fondation` / `adhesion` et colonne `compagnie` ; `_auteur_du_chemin` les connaît | « Sur les chemins » dit qui fonde ou rejoint une Compagnie publique | mig 425 |
