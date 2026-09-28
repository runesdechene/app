# Explore V2 — la fiche d'un lieu et le geste de visite

> Spec 1 de 2 sur les lieux (Uriel, 28/09/2026). La spec 2, **faire vivre un lieu**, couvrira
> « Modifier » ouvert à tous et versionné, l'histoire du lieu, la visibilité et « Signaler ».
> **Révise la spec Carte §5** sur un point : les compagnons d'une revendication (voir §5).

**Maquettes Figma (fichier V2, validées par Uriel le 28/09) :**

| Maquette | Nœud | Ce qu'elle montre |
|---|---|---|
| Lieu — fiche (proposition V2) | 229:128 | la fiche |
| Lieu — bouton de visite (états) | 230:128 | les six états du bouton |
| Lieu — options (feuille) | 231:128 | le bouton rond « options » |
| Lieu — revendiquer (fenêtre) | 232:128 | la fenêtre après une visite |
| Lieu — partager (feuille) | 236:128 | le bouton « partager » en haut à droite |

La fiche d'origine (cadre « Profil », 54:746) reste en l'état, pour mémoire.

## 1. Où vit la fiche

- Adresse : **`/<onglet>/lieu/<id>`** (déjà routée). Toucher un lieu sur la carte ouvre
  `/carte/lieu/<id>` ; depuis l'Accueil ou un profil, la fiche s'ouvre sous l'onglet en cours.
- Mobile : plein écran, par-dessus l'onglet. PC : **dans le tiroir**, la carte reste à côté (spec
  socle §4bis). Le retour arrière la ferme.
- Un lieu privé ou masqué d'un autre, ou inexistant : « Ce lieu n'existe pas ou n'est plus
  visible » et un retour. Jamais une fiche vide.

## 2. La fiche, de haut en bas

1. **Photo pleine largeur**, bord déchiré vers le parchemin. Retour en haut à gauche, **partager**
   en haut à droite. Sans photo : le fond parchemin et l'icône du type, en grand.
2. **Galerie** de vignettes (les autres photos) ; toucher une vignette l'affiche en grand.
3. **Titre** (Bebas), et à sa droite **deux boutons ronds** : **Envie d'y aller** (signet) et
   **Options du lieu**.
4. **Badge de type** (couleur du type, comme la carte).
5. **Ligne de faits**, une seule ligne, seulement ce qui est connu : époque (`eras.name`) ou
   siècle (`year_exact`), meilleure saison (`best_season`), accès (`accessibility`), bivouac
   (`bivouac`). *« Médiéval · XIIᵉ siècle · idéal au printemps · accès facile · bivouac toléré »*.
   Rien de connu : la ligne disparaît. (`sensible` : spec 2.)
6. **Adresse** — la toucher ouvre le GPS du téléphone vers le lieu ; « Toucher l'adresse pour
   ouvrir le GPS » en dessous.
7. **« N Explorateurs ont foulé ce lieu »**, avatars empilés (les trois derniers) — preuve
   sociale **sans classement**. Toucher la ligne : la liste des Explorateurs (profils). Zéro :
   « Personne n'a encore foulé ce lieu ».
8. **« Revendiqué par [pilule] · depuis le … »** — la même pilule que sur la carte, en encre
   pleine si c'est moi (ou mon expédition). Toucher le nom : le profil, ou la liste des membres de
   l'expédition. Pas de revendication : la ligne disparaît.
9. **Le bouton de visite** (§4).
10. **À propos** (`places.text`) — « Le récit » dans la maquette, renommé par Uriel (28/09).
11. **Crédits** : « Lieu ajouté par X · le … » ; « Enrichi par Y » si le récit a été révisé par
    quelqu'un d'autre (`place_description_revisions.edited_by`, le plus récent).

Les trois icônes de l'adresse, des Explorateurs (empreintes de pas) et de la revendication
(drapeau) ont **le même trait** (Uriel, 28/09).

## 3. Les boutons ronds et les feuilles

- **Envie d'y aller** : bascule, l'icône se remplit quand c'est coché ; le lieu rejoint « Mes
  envies » du profil (`places_bookmarked`). Mise à jour optimiste, retour en arrière si la base
  refuse (comme les Préférences).
- **Options du lieu** : une feuille « Ce lieu ». Dans cette spec : **Trouver sur la carte**
  (ouvre `/carte` centré sur le lieu, zoom 14). **Modifier**, **Visibilité** (auteur),
  **Signaler** : spec 2 — les lignes n'apparaissent pas tant qu'elles ne font rien.
- **Partager** : une feuille « Partager ce lieu » — l'aperçu (vignette, nom, type, lieu), puis
  **Copier le lien** et **Partager ailleurs…** (le partage natif du téléphone, `navigator.share` ;
  absent sur un ordinateur : la ligne disparaît). **Envoyer à un Explorateur** arrive avec les
  Messages (la ligne n'apparaît pas avant). Le lien est l'adresse de la fiche.

Les feuilles glissent depuis le bas (`Feuille`) ; la règle « tout est animé » s'applique.

## 4. Le bouton de visite

Il **porte son état avant qu'on le touche** : le refus est écrit sur le bouton, jamais découvert
par l'échec. **Portée : 200 m.**

| État | Bouton |
|---|---|
| Position inconnue (jamais demandée) | rouge — « Me localiser pour visiter » ; le toucher demande la position |
| À portée, jamais visité | rouge — « Marquer ma visite (GPS) » |
| Trop loin, jamais visité | grisé — « Marquer ma visite · 274 km trop loin » |
| Déjà visité, de retour à portée | rouge — « Revendiquer » : refait la visite (`visited_at` remis à maintenant), puis ouvre la fenêtre (§5) |
| Déjà visité, loin | crème — « ✓ Visité le 3 août · 274 km » |
| Position refusée | grisé — « Position refusée » + « Autorise la localisation dans les réglages du navigateur pour visiter » |

- La position est suivie tant que la fiche est ouverte (`watchPosition`) : le bouton change
  d'état quand on s'approche, sans recharger.
- La distance affichée : en mètres sous 1 km (« 350 m »), en km au-delà (« 274 km »).
- **Le serveur décide** : `visiter_lieu` recalcule la distance avec la position envoyée et refuse
  au-delà de 200 m. La position envoyée est celle du téléphone (comme en V1) ; on ne prétend pas
  empêcher un faux GPS.
- **Visiter** inscrit la visite là où la V1 la lit aussi : `place_explorers` (avec `visited_at`)
  et `places_discovered` (`method = 'gps'`). **Ni énergie, ni points, ni Couronnes** (Explore ne
  fait rien gagner). Le lieu passe « visité » sur la carte (sceau d'encre plein).
- Juste après une visite réussie : **la fenêtre de revendication s'ouvre** (§5).

## 5. La revendication — « pour la gloire »

**La fenêtre** (une feuille, maquette 232:128) :

- *« Tu es au [lieu]. Ton nom s'inscrira sous son sceau, pour la gloire — jusqu'à ce qu'un autre
  vienne le reprendre. »*
- **Seul / En expédition** (le curseur des Segments). Seul : la pilule porte mon nom.
- **En expédition — « Qui est avec toi ? »** : **uniquement les Explorateurs présents en ce
  moment**, connectés à moins de 200 m du lieu (« à 40 m »), à cocher (Uriel, 28/09).
  - *Révise la spec Carte §5 : les compagnons ne viennent plus des visites récentes mais de la
    présence en direct. C'est le serveur qui calcule qui est proche (§6) : le téléphone ne
    choisit jamais qui est avec lui.*
  - Personne autour : « Personne d'autre n'est ici en ce moment » — on revendique seul.
- **Nom de l'expédition** : un champ, et mes noms d'expédition passés en pastilles (toucher =
  remplir). Obligatoire en expédition.
- **Revendiquer** / **Pas maintenant**. Refuser ne défait pas la visite.

**Ce que fait `revendiquer_lieu`** : il vérifie que l'appelant a visité le lieu en GPS **dans les
30 dernières minutes** (sinon : refus) et que chaque compagnon coché est **présent maintenant à
moins de 200 m du lieu** (les autres sont ignorés). Puis, comme `plant_flag` de la V1 (sa
définition live sera relue avant d'écrire) : une expédition (`expeditions.title`, ses
`expedition_members`), `place_veille` (le veilleur, l'expédition, `planted_at`), une ligne
`veille_history`. **Pas de délai entre deux revendications, pas de Cour, pas de Couronnes.** La V1
affichera la même revendication : c'est voulu.

**Reprendre un lieu** : on revient sur place ; le bouton devient « Revendiquer » (§4) ; la
nouvelle revendication remplace l'ancienne. La pilule porte toujours **le dernier** passé sur
place.

## 6. La présence — qui est dans le coin

- Tant que l'app est ouverte **avec la position autorisée**, le téléphone signale sa position au
  serveur **au plus une fois par minute** (`signaler_presence(lat, lng)`), et à chaque changement
  d'état du bouton de visite.
- Une seule ligne par Explorateur (`presences`), **écrasée à chaque signal**, **oubliée au bout de
  10 minutes**. **Aucun historique.** Personne ne lit cette table : seules les fonctions de la
  revendication s'en servent, et elles ne rendent jamais une position, seulement « à 40 m ».
- **La liste ne se montre qu'à quelqu'un qui est lui-même présent, maintenant, à moins de 200 m
  du lieu** — qui voit donc de toute façon les gens autour. Rien n'est révélé à distance. C'est
  aussi ce qui règle **« Brouiller tes pistes »** : l'Explorateur apparaît comme compagnon, mais
  seulement à quelqu'un qui est sur place (Uriel, 28/09).
- Position refusée : aucun signal ; on n'apparaît pas comme compagnon.

## 7. Les données

Toutes les fonctions lisent **`auth.uid()`** et ne prennent jamais d'identifiant de joueur ;
`SECURITY DEFINER`, exécutables par `authenticated` seulement.

| Besoin | Fonction | Tables |
|---|---|---|
| Toute la fiche, et mon état | `fiche_lieu(p_id)` | `places`, `place_tags`/`tags`, `eras`, `place_explorers`, `place_veille`, `expeditions`, `places_bookmarked`, `place_description_revisions`, `users` |
| La liste des Explorateurs passés | `explorateurs_du_lieu(p_id)` | `place_explorers`, `users` |
| Envie d'y aller | `basculer_envie(p_id)` | `places_bookmarked` |
| Visiter en GPS | `visiter_lieu(p_id, p_lat, p_lng)` | `place_explorers`, `places_discovered` |
| Signaler sa présence | `signaler_presence(p_lat, p_lng)` | `presences` (nouvelle) |
| Les compagnons possibles | `compagnons_possibles(p_id)` | `presences`, `users` |
| Mes noms d'expédition passés | `mes_noms_d_expedition()` | `expedition_members`, `expeditions` |
| Revendiquer | `revendiquer_lieu(p_id, p_compagnons, p_nom)` | `expeditions`, `expedition_members`, `place_veille`, `veille_history` |

- `fiche_lieu` applique la même visibilité que `carte_lieux` (privé/masqué d'un autre : rien).
- Les noms publics passent par `user_public_name` (jamais un e-mail).
- `presences(user_id pk, latitude, longitude, vu_a)` : RLS activée, aucun droit direct.
- Les photos : `places.images` (jsonb), lues par le même lecteur défensif que le reste.

Côté app : `features/lieu/` (api → hooks → lib → composants), branchée par `app/routes/` ; la
zone Carte n'en importe rien (elle navigue vers l'adresse).

## 8. Hors de cette spec

- Modifier (tout le monde, versionné), l'histoire du lieu, la visibilité, Signaler → **spec 2**.
- La petite fiche d'un **point d'intérêt** (le « Vu ») → avec le parcours « Ajouter ».
- « Envoyer à un Explorateur » → avec les Messages.
- Les commentaires/avis (`reviews`) de la V1 : pas sur la fiche V2.

## 9. Ce que les tests doivent couvrir

- La fiche d'un lieu complet, sans photo, sans faits, sans revendication, jamais visité ; un lieu
  privé d'un autre (refusé), le sien (visible).
- Les six états du bouton, et le passage de l'un à l'autre quand la position change.
- `visiter_lieu` : à 150 m (accepté), à 250 m (refusé), deux fois (une seule visite, `visited_at`
  remis à jour).
- `revendiquer_lieu` : seul ; à plusieurs ; sans visite récente (refusé) ; un compagnon ni proche
  ni passé (ignoré) ; la reprise par un autre (la pilule change).
- `compagnons_possibles` : présent à 40 m (listé) ; à 250 m (absent) ; présence vieille de
  11 min (absente) ; « brouiller » à 150 m (listé) ; appelant lui-même absent ou loin (liste vide) ;
  jamais soi-même.
- Envie d'y aller : bascule, et retour en arrière si la base refuse.
