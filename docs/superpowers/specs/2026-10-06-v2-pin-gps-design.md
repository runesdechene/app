# Le pin GPS — conception

> 06/10/2026 · V2 (`apps/web-v2`) · maquettes Figma à dessiner (fichier « Runes de Chêne - App V2 »)

## Pourquoi

En explo, on n'a pas toujours le temps de s'arrêter pour ajouter un lieu entier (photos, nom, récit,
catégories). Uriel : « pour pouvoir ajouter un lieu plus tard quand on visite ». La V1 le faisait depuis
juin (« marque GPS », table `place_drafts`) : 144 marques devenues des lieux, 30 en attente chez 7 joueurs
au 06/10. La V2 n'a que l'entrée grisée « Un pin GPS · bientôt » dans la feuille du « + ».

## Ce qu'on construit

1. **Poser un pin** sur sa position, en deux appuis, avec une photo facultative juste après.
2. **Le compléter plus tard** en vrai lieu, **en gardant « sur place »** — la visite (datée du pin) et la
   revendication, comme un ajout à moins de 200 m (mig 393).
3. **Retrouver ses pins** dans la feuille du « + » et sur sa carte (visibles de soi seul).
4. **« C'est l'un de ceux-là ? »** : un pin posé près d'un lieu existant peut devenir une visite de ce lieu.
5. **La vue satellite** sur la carte où l'on place : pose du pin et étape « placer le lieu » de l'ajout.

Hors champ : le satellite sur la carte globale (filtres et calques — « à terme », Uriel 06/10), un rappel
par notification avant péremption, le point d'intérêt (l'autre entrée grisée du « + »).

## Les règles

- **Un pin vaut 15 jours** (Uriel 06/10 ; *écarté : 30 j de la V1, 7 j qui punissent le voyage de deux
  semaines où l'on complète au retour*). Réglage `app_settings.place_draft_freshness_days` = 15, **la V1
  comprise** (elle s'arrête dans quelques jours) : ses pins de plus de 15 jours deviennent des ajouts à
  distance, tant pis.
- **« Sur place » par le pin** : le pin est à moi, il a 15 jours ou moins, et le lieu final est à moins de
  200 m de lui. Sinon le lieu est un **ajout à distance** (ni visite ni revendication) — jamais un refus.
- **Poser ne rapporte rien.** Tout se joue à la complétion : pas de farming possible.
- **Un pin n'est jamais supprimé par le serveur** ; seul son propriétaire le supprime.
- **Chaque pin dit le temps qui lui reste**, dès la pose : le joueur ne découvre jamais la règle après coup.

## Les données et le serveur

**Pas de nouvelle table.** `place_drafts` (V1, mig 264) convient telle quelle : `id`, `user_id`,
`latitude`/`longitude` (real), `accuracy_m`, `title`, `images` (jsonb, même forme que `places.images`),
`status` (`open` / `published`), `published_place_id`, `published_at`, `created_at` (horodatage serveur =
la preuve). RLS : chacun ses pins (lecture, écriture, suppression). Les photos vont dans
`place-images/places/<moi>/…`, comme celles d'un lieu (règles de la mig 385). Le **lieu-dit** est trouvé
une fois, à la pose, et rangé dans `title`.

**Cinq fonctions V2**, toutes gardées par l'identité de la session (jamais un `p_user_id` venu du client) :

| Fonction | Rôle |
|---|---|
| `poser_pin(lat, lng, précision, lieu_dit)` | pose le pin ; date serveur ; ne rapporte rien |
| `photos_du_pin(pin, images)` | ajoute les photos prises juste après — la pose n'attend jamais la photo |
| `mes_pins()` | mes pins ouverts, avec `joursRestants` (négatif = périmé) ; pour la feuille du « + » et la carte |
| `ajouter_lieu(…, p_pin)` | **un paramètre de plus**, facultatif : avec un pin, « sur place » se juge sur le pin (règles ci-dessus) au lieu de la position du téléphone ; le pin passe `published` avec `published_place_id` |
| `visiter_depuis_pin(pin, lieu)` | le « C'est lui » : pin valide et à moins de 200 m du lieu → visite datée du pin, **sans revendication** (elle reste un geste fait sur place) ; pin périmé → il se ferme sans visite, et l'écran le dit |

Les **lieux à moins de 200 m du pin** se lisent par une fonction existante si l'une convient (à vérifier
au plan, avant d'en créer une). **Supprimer** passe par la règle RLS en place.

La V1 garde `create_gps_mark` et `publish_gps_mark` jusqu'à sa fin, sans changement : elle lit la même
table, donc un pin posé d'un côté se voit de l'autre.

## Les écrans

1. **Poser** — « Un pin GPS » n'est plus grisé. Un appui ouvre une petite carte centrée sur moi, la
   précision du GPS, **« Poser mon pin ici »**, et : *« Tu auras 15 jours pour le compléter en gardant
   “sur place”. »* Deux appuis plutôt qu'un : un appui raté ne pose rien. Ensuite : *« Pin posé · encore
   15 jours »*, **« Prendre une photo »** (facultatif) et **« C'est tout »**.
2. **La feuille du « + »** — une section **« Tes pins »** : la photo ou l'icône du pin, le lieu-dit, la
   date, *« encore 12 jours »* (périmé : *« sera ajouté à distance »*). Un appui : **Compléter · Voir sur la
   carte · Supprimer**.
3. **Ma carte** — mes pins avec leur icône (`assets/ui/pin-gps.svg`), visibles de moi seul ; un appui
   ouvre la même petite carte qu'à la feuille.
4. **Compléter** — s'il y a des lieux à moins de 200 m : *« C'est l'un de ceux-là ? »* et leurs cartes ;
   **« C'est lui »** → la visite, le pin se ferme ; **« Non, c'est un autre »** → la suite. Puis **le
   parcours d'ajout existant**, pré-rempli (photos et position du pin), ouvert à la première étape qui
   manque. À « placer le lieu », **un cercle de 200 m** autour du pin ; on peut en sortir, l'écran prévient :
   *« hors du cercle, il sera ajouté à distance »*. Le serveur juge, l'écran annonce.
5. **Le brouillon local** (IndexedDB, un seul à la fois) retient aussi son pin. Compléter un pin quand un
   autre ajout est en cours demande d'abord : *« Remplacer ton brouillon en cours ? »*
6. **Plan / Satellite** — un bouton sur la petite carte qui sert à placer, commun à la pose du pin et à
   l'étape « placer le lieu ». Tuiles **Esri World Imagery** (gratuites, sans clé, déjà utilisées par la V1 :
   `apps/explore-web/src/lib/map-style.ts`), attribution affichée.

## Les cas limites

- **Localisation refusée ou indisponible** : pas de pose ; l'écran dit pourquoi et comment l'autoriser.
- **GPS imprécis** : la précision est affichée ; au-delà de 200 m, « Poser mon pin ici » est grisé et dit
  pourquoi (*« GPS trop imprécis (± 340 m) — attends un instant »*) — un pin aussi flou ne prouverait rien.
- **Pas de réseau sur place** : voir point ouvert 1.
- **Photo qui échoue** : le pin reste posé ; la photo se reprend à la complétion.
- **Pin complété depuis un autre appareil** : `mes_pins()` vient du serveur, la liste suit.

## Points ouverts

1. **Poser sans réseau.** Les explos tombent souvent en zone blanche. Telle quelle, la pose exige le
   réseau (la date est celle du serveur : c'est la preuve). Garder le pin dans le téléphone et l'envoyer au
   retour du réseau rendrait la date et la position déclaratives. À trancher par Uriel.

## Les tests

- Serveur, en prod sur des comptes réels (requêtes `db query`) : pin frais et proche → visite + revendication ;
  pin de 16 jours → ajout à distance ; lieu à 250 m du pin → ajout à distance ; pin d'un autre → refus ;
  « C'est lui » frais / périmé ; poser ne crédite rien.
- Front (Vitest + Testing Library, comme les tests existants) : la feuille du « + » liste les pins et les
  jours restants ; l'entrée « Un pin GPS » n'est plus grisée (le test actuel `AjouterFeuille.test.tsx`
  change) ; le parcours d'ajout reprend un pin à la bonne étape ; l'avertissement « hors du cercle ».
- Le parcours entier dans le navigateur (`pnpm dev`), puis `pnpm build`.

## Maquettes à dessiner (Figma, avant le plan)

Poser (avant / après) · la feuille du « + » avec « Tes pins » · la petite carte d'un pin · « C'est l'un de
ceux-là ? » · l'étape « placer le lieu » avec le cercle et le bouton Plan / Satellite · un pin sur ma carte.
