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
| Compagnies (mig 295, grades, bannières, buckets `faction-emblems` / `faction-patterns`) | Maisons qui s'affrontent, abandonnées | supprimer | après bascule | spec V2 §1 |
| Gloire V1 (`notoriety_points`, `exploration_points`, `erudition_points`…) | ⚠️ le **niveau reste** (révision 27/09) : ne supprimer que ce qui ne nourrit plus `xp_total` ; vérifier chaque colonne avant | trier, puis supprimer | après bascule | spec V2 §1 révisé |
| Énergie (`energy_points`, `max_energy`, `energy_reset_at`, `preview_action_cost`, coût de `discover_place`) | supprimée : découvrir devient gratuit | supprimer | après bascule | décision 27/09 |
| Expéditions joueur-joueur (`voyage_*`) | abandonnées | supprimer | après bascule | spec V2 §1 |
| Quêtes du jour (et leurs tables) | abandonnées — ≠ Missions, qui restent | supprimer | après bascule | spec V2 §1 |
| `floor_glory`, `floor_crowns` sur les appels | liés à la Gloire et à la Cour | supprimer | au portage des appels | spec V2, reste à faire |
| Image `app-fragments/fragment-3.webp` (seau de stockage) | l'image de « Demiurge (Admin) », Fragment retiré par la mig 359 | supprimer à la main dans le stockage | dès la 359 appliquée | mig 359, 27/09 |
| `accueil_nouveaute()` | la V2 ne l'appelle plus : « Nouvelles de la marque » retirée de l'Accueil (Uriel, 28/09), la Saga prendra sa place ; `announcements` reste, le Hub et la V1 s'en servent | supprimer si la Saga ne la reprend pas | après bascule | 28/09 |

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
| Seau `place-images` : policy INSERT ouverte à tout `authenticated` | n'importe quel connecté peut déposer un fichier dans le dossier d'un autre (pas l'écraser : il n'y a pas de policy UPDATE, d'où le « supprimer puis envoyer » des avatars) | restreindre l'INSERT au dossier = `auth.uid()` (et aux dossiers de lieux autorisés) ; ajouter une policy UPDATE propriétaire pour permettre `upsert` | après bascule | Task 8 compte, 27/09 |
| `chat_messages.user_name` écrit par le client | la V1 insère elle-même le nom affiché : n'importe qui peut signer un message du nom d'un autre | la V2 écrit par `ecrire_au_registre` (le nom posé par la base, mig 371) ; côté V1, retirer l'INSERT direct (policies `chat_insert_*`) à la bascule | après bascule | relecture 28/09 |
| `unlock_pending_fragments(p_user_id, p_email)` | lisait l'e-mail fourni par l'appelant : on pouvait réclamer les Fragments achetés par un autre client | **corrigé** par la mig 369 (l'e-mail vérifié du jeton) — à appliquer | au GO d'Uriel | relecture 28/09 |
| **`storage.objects` : policies « Allow all 1snxhtj_2/_3 » et « Enable storage 1lvpvk4_2/_3 »** (UPDATE et DELETE, `qual true`, rôle `authenticated`, tous seaux) | constaté le 30/09 : **tout compte connecté peut modifier ou effacer n'importe quel fichier de n'importe quel seau** (photos des lieux, avatars, emblèmes). Elles expliquent aussi que l'`upsert` marche malgré l'absence de policy UPDATE propriétaire (ligne `place-images` ci-dessus) | **urgent, à trancher par Uriel** : les supprimer après vérification à la main de ce qui s'en sert (probablement rien d'autre que le « supprimer puis envoyer » des avatars), et ajouter à la place une policy UPDATE propriétaire sur `place-images` (dossier `places/<auth.uid()>/`) — la V2 (Ajouter un lieu) envoie en `upsert` | au plus tôt | relecture Ajouter un lieu, 30/09 |
| `@types/react` 18 dans explore-web et hub | React y tourne en 19.0.0 ; hissé à la racine, il sert aussi de types aux bibliothèques de la V2 (react-query) — contourné par un fragment dans `useV2Access.test.tsx` | aligner sur 19, puis retirer le fragment | après bascule | plan socle, Task 1 ; relecture 27/09 |

## 3. Ajouté pour la V2

| Objet | Rôle | Source |
|---|---|---|
| `users.v2_access` | autorisation V2 par compte | mig 344 |
| `has_v2_access()` | la V2 demande si l'appelant peut entrer | mig 344 |
| `set_v2_access(text, boolean)` | le Hub coche / décoche | mig 344 |
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
