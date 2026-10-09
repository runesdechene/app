# Le pin GPS — conception

> 06/10/2026 · V2 (`apps/web-v2`) · maquettes Figma « Pin GPS — 1 à 6b » (fichier App v2, nœud 411:315 et voisins)

## Pourquoi

En explo, on n'a pas toujours le temps de s'arrêter pour ajouter un lieu entier (photos, nom, récit,
catégories). Uriel : « pour pouvoir ajouter un lieu plus tard quand on visite ». La V1 le faisait depuis
juin (« marque GPS », table `place_drafts`) : 144 marques devenues des lieux, 30 en attente chez 7 joueurs
au 06/10. La V2 n'a que l'entrée grisée « Un pin GPS · bientôt » dans la feuille du « + ».

## Ce qu'on construit

1. **Poser un pin** sur sa position, en deux appuis. **Rien d'autre** : ni photo ni texte à écrire (Uriel 06/10 —
   les photos se prennent avec l'appareil photo du téléphone, elles restent dans sa galerie si le pin se
   perd ; *écarté : des photos prises dans l'app, une copie locale, l'enregistrement dans la galerie*).
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
- **Le pin marche sans réseau** (Uriel 06/10 : « c'est tout l'intérêt ») : il est écrit d'abord dans le
  téléphone, puis envoyé dès que le réseau revient. **Risque accepté** : la date et la position deviennent
  celles que déclare le téléphone (*écarté : le réseau obligatoire, inviolable mais inutile en zone blanche*).
- **Au-delà de ± 200 m de précision, on ne pose pas** (Uriel 06/10) : l'écran l'empêche, le serveur refuse.
- **Un pin n'est jamais supprimé par le serveur** ; seul son propriétaire le supprime.
- **Chaque pin dit le temps qui lui reste**, dès la pose : le joueur ne découvre jamais la règle après coup.

## Les données et le serveur

**Pas de nouvelle table.** `place_drafts` (V1, mig 264) convient telle quelle : `id`, `user_id`,
`latitude`/`longitude` (real), `accuracy_m`, `title`, `images` (jsonb, même forme que `places.images`),
`status` (`open` / `published`), `published_place_id`, `published_at`, `created_at`. **`id` et
`created_at` viennent du téléphone** (le pin naît hors ligne) : l'identifiant rend l'envoi rejouable sans
doublon, la date est l'heure de la pose. RLS : chacun ses pins (lecture, écriture, suppression). La V2 n'écrit jamais `images` ; les
quelques pins de la V1 qui en ont (les plus récents datent du 15/09, déjà périmés) les gardent sans que la
V2 les montre. Le **lieu-dit** est trouvé une fois, à la pose, et rangé dans `title`.

**Quatre fonctions V2**, toutes gardées par l'identité de la session (jamais un `p_user_id` venu du client) :

| Fonction | Rôle |
|---|---|
| `poser_pin(id, lat, lng, précision, posé_le, lieu_dit)` | enregistre un pin venu du téléphone ; refuse une précision au-delà de 200 m et une date dans le futur (5 min de tolérance d'horloge) ; rejouable (même `id` → rien de plus) ; ne rapporte rien |
| `mes_pins()` | mes pins ouverts, avec `joursRestants` (négatif = périmé) ; pour la feuille du « + » et la carte |
| `ajouter_lieu(…, p_pin)` | **un paramètre de plus**, facultatif : avec un pin, « sur place » se juge sur le pin (règles ci-dessus) au lieu de la position du téléphone ; le pin passe `published` avec `published_place_id` |
| `visiter_depuis_pin(pin, lieu)` | le « C'est lui » : pin valide et à moins de 200 m du lieu → visite datée du pin, **sans revendication** (elle reste un geste fait sur place) ; pin périmé → il se ferme sans visite, et l'écran le dit |

**La revendication sans la présence en direct** (Uriel 06/10). `revendiquer_lieu` exige une visite de moins
de 30 minutes et une présence en direct près du lieu ; `ajouter_lieu` sur place la contourne en écrivant la
position du téléphone dans `presences`. Avec un pin vieux de plusieurs jours, les deux contrôles échouent, et
écrire la position du pin dans `presences` montrerait l'auteur « présent maintenant » aux autres pendant 10
minutes. On extrait donc l'écriture de la revendication dans une fonction interne, `_revendiquer(lieu, moi,
compagnons, nom, pour)` : `revendiquer_lieu` l'appelle après ses contrôles, `ajouter_lieu` l'appelle
directement (pin ou sur place) et n'écrit plus dans `presences`.

Les **lieux à moins de 200 m du pin** se lisent par une fonction existante si l'une convient (à vérifier
au plan, avant d'en créer une). **Supprimer** passe par la règle RLS en place.

La V1 garde `create_gps_mark` et `publish_gps_mark` jusqu'à sa fin, sans changement : elle lit la même
table, donc un pin posé d'un côté se voit de l'autre.

## Les écrans

0. **Les pins en attente** — gardés dans IndexedDB (`idb-keyval`, comme le brouillon), envoyés au lancement de
   l'app, au retour du réseau (`online`) et à l'ouverture du « + ». Le lieu-dit se cherche à l'envoi.
   L'app s'ouvre déjà hors ligne (PWA, fichiers en cache) ; le fond de carte, lui, n'y est pas : hors
   ligne, l'écran de pose l'annonce (maquette 2b).
1. **Poser** — « Un pin GPS » n'est plus grisé. Un appui ouvre une petite carte centrée sur moi, la
   précision du GPS, **« Poser mon pin ici »**, et : *« Tu auras 15 jours pour le compléter en gardant
   “sur place”. »* Deux appuis plutôt qu'un : un appui raté ne pose rien. Ensuite : *« Pin posé · encore
   15 jours »*, *« Prends tes photos avec ton téléphone : tu les choisiras dans ta galerie en complétant le
   lieu »*, et **« C'est tout »**.
2. **La feuille du « + »** — une section **« Tes pins »** — ceux en attente d'abord (*« Pin du 6 oct., 14 h 32 · en attente de
   réseau »*, pas encore complétables : l'ajout demande le réseau) ; puis l'icône du pin, le lieu-dit, la
   date, *« encore 12 jours »* (périmé : *« sera ajouté à distance »*). Un appui : **Compléter · Voir sur la
   carte · Supprimer**.
3. **Ma carte** — mes pins avec leur icône (`assets/ui/pin-gps.svg`), visibles de moi seul ; un appui
   ouvre la même petite carte qu'à la feuille.
4. **Compléter** — s'il y a des lieux à moins de 200 m : *« C'est l'un de ceux-là ? »* et leurs cartes ;
   **« C'est lui »** → la visite, le pin se ferme ; **« Non, c'est un autre »** → la suite. Puis **le
   parcours d'ajout existant**, pré-rempli de la position du pin, ouvert à l'étape photo : on y
   choisit ses photos dans la galerie (l'étape lit déjà la position qu'y inscrit l'appareil ; pour un pin, **la position du pin prime** :
   c'est elle qui juge le cercle).
   À « placer le lieu », **un cercle de 200 m** autour du pin ; on peut en sortir, l'écran prévient :
   *« hors du cercle, il sera ajouté à distance »*. Le serveur juge, l'écran annonce.
5. **Le brouillon local** (IndexedDB, un seul à la fois) retient aussi son pin. Compléter un pin quand un
   autre ajout est en cours demande d'abord : *« Remplacer ton brouillon en cours ? »*
6. **Plan / Satellite** — un bouton sur la petite carte qui sert à placer, commun à la pose du pin et à
   l'étape « placer le lieu ». Tuiles **Esri World Imagery** (gratuites, sans clé, déjà utilisées par la V1 :
   `apps/explore-web/src/lib/map-style.ts`), attribution affichée.

## Les cas limites

- **Localisation refusée ou indisponible** : pas de pose ; l'écran dit pourquoi et comment l'autoriser.
- **GPS imprécis** : la précision est affichée ; au-delà de 200 m, le bouton est grisé et dit pourquoi
  (*« GPS trop imprécis (± 340 m) »*, maquette 1b) — un pin aussi flou ne prouverait rien.
- **Pas de réseau sur place** : le pin est posé dans le téléphone (maquette 2b) et part tout seul plus tard.
- **Le téléphone perd ses données** (navigateur vidé) avant l'envoi : le pin en attente est perdu. Accepté.
- **La session a expiré** au moment d'envoyer : le pin attend la prochaine connexion, rien n'est perdu.
- **Pin complété depuis un autre appareil** : `mes_pins()` vient du serveur, la liste suit.

## À vérifier en premier (au plan)

**L'app s'ouvre-t-elle vraiment hors ligne, session ouverte ?** Les fichiers sont en cache, mais la garde
de connexion ou le chargement du profil peuvent vouloir joindre le serveur et bloquer l'écran. C'est la
première tâche du plan : sans elle, le pin hors ligne ne sert à rien.

## Les tests

- Serveur, en prod sur des comptes réels (requêtes `db query`) : pin frais et proche → visite + revendication ;
  pin de 16 jours → ajout à distance ; lieu à 250 m du pin → ajout à distance ; pin d'un autre → refus ;
  « C'est lui » frais / périmé ; poser ne crédite rien ; `poser_pin` rejoué avec le même `id` → un seul pin ;
  précision de 250 m → refus ; date dans le futur → refus.
- Front (Vitest + Testing Library, comme les tests existants) : la feuille du « + » liste les pins et les
  jours restants ; l'entrée « Un pin GPS » n'est plus grisée (le test actuel `AjouterFeuille.test.tsx`
  change) ; le parcours d'ajout reprend un pin à la bonne étape ; l'avertissement « hors du cercle » ; un
  pin posé hors ligne reste en attente, puis part au retour du réseau.
- Hors ligne pour de vrai : téléphone en mode avion, ouvrir l'app, poser, rallumer le réseau.
- Le parcours entier dans le navigateur (`pnpm dev`), puis `pnpm build`.

## Les maquettes

Dessinées le 06/10 (rangée « PIN GPS », nœud 411:315) : poser · GPS trop imprécis (1b) · pin posé · posé sans réseau (2b) · la feuille du « + » avec « Tes pins » · la petite carte d'un pin · « C'est l'un de
ceux-là ? » · l'étape « placer le lieu » avec le cercle et le bouton Plan / Satellite · un pin sur ma carte.
