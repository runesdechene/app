# Explore — la Carte (design)

> Statut : **à relire par Uriel.** Conçue avec lui les 27 et 28/09/2026 en maquette (Figma
> « Carte — médiévale (lancement) », « Carte — Ajouter (feuille ouverte) ») et en prototype jetable
> (`.superpowers/brainstorm/carte/gravure.html`). Remplace le §7 de `2026-08-18-app-v2-design.md`.
> Cadre : §0 de cette même spec (Explore, offerte, quatre onglets).

## 1. Ce que la Carte doit être

Une **carte médiévale sur parchemin**, belle sans être lourde : elle doit rester fluide sur un
téléphone modeste. C'est le cœur d'Explore, et le seul écran qu'on ouvre pour arpenter.

Tout ce qui a été essayé et écarté en chemin (brume, relief 3D permanent, nuages, maisons en
volume, pastilles colorées, les trois lectures) est dans le `_État.md` du projet, section Écarté.

## 2. Le fond de carte

Un style MapLibre maison, partant des tuiles vectorielles gratuites OpenFreeMap (celles de la V1).

- **Parchemin** : fond crème, grain de papier très léger par-dessus, bords à peine assombris.
- **Épuré** : on garde la côte, la mer, les rivières, les grands axes routiers, les limites, les
  noms de villes et de villages. On retire les routes secondaires, les chemins, les ruisseaux,
  les lieux-dits, les bâtiments, les points d'intérêt du fond.
- **Forêts** en aplat vert-olive très pâle, sans hachures.
- **Relief** :
  - à plat, un **ombrage très léger** à l'encre brune pâle (tuiles d'altitude au zoom 11 au plus) ;
  - **incliné et d'assez près** (inclinaison > 15° et zoom ≥ 9), les montagnes **se lèvent en 3D** ;
    à plat ou de loin, le terrain 3D est coupé — c'est lui qui coûte.
- **Inclinable** jusqu'à 70°, l'horizon se fondant dans le parchemin. Elle s'ouvre à plat.

Aucun calque dessiné à la main à chaque image : c'est ce qui faisait ramer les prototypes.

## 3. Les lieux sur la carte

Les lieux sont des **calques MapLibre** (symboles et images), pas des éléments HTML : 3 500 lieux
visibles, et bientôt plus, doivent se dessiner par la carte graphique.

| État (pour celui qui regarde) | Marque |
|---|---|
| Inconnu | petite bille parchemin clair, cerclée d'encre, avec un **« ? »** ; toujours **sous** les autres |
| Connu (découvert à distance, ou ajouté par moi) | **sceau crème, icône du type à l'encre** |
| Visité en GPS | **sceau d'encre plein, icône crème** |

- Tous les sceaux ont **la même taille**. Aucune couleur par défaut : noir et crème, à l'aventurière.
- **Option « Mes lieux en couleur »** (Préférences, éteinte par défaut) : les lieux visités prennent
  la couleur de leur type, **désaturée**, en trois vagues douces, icône blanche, sans bordure.
- **Aucun regroupement** (Uriel, 28/09, révise la première version) : comme en V1, la carte
  dézoomée montre **tous les lieux**, en plus petit — la marque grandit avec le zoom. C'est
  l'effet de la carte, « un effet WOW même dézoomé ».
- *Le « ? » contredit l'ancien §7 (« l'inconnu se tait ») : Uriel le veut, petit et pâle.*

### La revendication — « pour la gloire »

- Un lieu revendiqué porte, **sous son sceau**, une **pilule parchemin** avec le nom en petites
  capitales brun encre ; **la mienne en encre pleine**. Jamais d'avatar sur la carte.
- Le nom est celui de **la dernière personne (ou expédition) qui l'a revendiqué sur place**.
  Revendiqué à plusieurs : le **nom de l'expédition**.
- Les pilules ne s'affichent que **de près**, pour ne pas charger la carte.

### La Curiosité

Un point d'intérêt trop petit pour être un lieu (inscription, borne, arbre, anecdote, zone
d'intérêt). Sur la carte : **une petite marque d'encre**, plus discrète que les sceaux, visible
**de près** seulement. Voir §6.

## 4. L'écran

- **En-tête commun** (sur tous les onglets) : le logo, **« + »** (carré d'encre plein au « + »
  évidé) et **la cloche** (pochoir d'encre, point rouge s'il y a du nouveau).
- **Recherche** « Un lieu, une ville… » et **un seul bouton Filtre** (type, saison, accès, bivouac
  — dans une feuille, pas en pastilles sur la carte).
- **Le nom du territoire** regardé, inscrit sur la carte **en italique de copiste** (IM Fell
  English, entre deux fleurons tracés à la plume), sans cadre. Il change en fondu quand on passe
  d'un territoire à l'autre :
  - de près, **le territoire historique** (Comté de Nice, Provence…) — une table département →
    nom historique, **dont Uriel fixe les noms** ; tant qu'un département n'en a pas, son nom ;
  - de plus loin, le pays ; de très loin, rien.
- **Rose des vents** à l'encre, en bas à gauche. **« Ma position »** en bas à droite.
- **Appui long sur la carte** : pose une épingle et ouvre « Un lieu » avec la position remplie.

## 5. Toucher un lieu, le visiter, le revendiquer

Toucher un sceau ouvre **la fiche du lieu** dans le détail (plein écran sur mobile, panneau à
gauche sur desktop — règles du socle), à son adresse `/carte/lieu/:id`. La fiche suit le design
validé le 19/08 (§7 d'origine) ; **sa maquette Figma est à faire avant de la coder.**

**Le bouton de visite** porte son état avant qu'on le touche : actif à portée, grisé avec la
distance sinon. Portée : **200 m** — la valeur réellement appliquée en V1 (l'ancienne spec disait
500 m, c'était faux).

**Après une visite GPS réussie, une fenêtre propose de revendiquer le lieu.** On peut refuser :
visiter n'oblige pas à revendiquer.
> *Révisé le 28/09 par la spec « fiche d'un lieu » (§5-6) : les compagnons sont uniquement les
> Explorateurs présents en ce moment à moins de 200 m, présence calculée par le serveur.*

- **Seul**, ou **à plusieurs** : la fenêtre liste les **compagnons** — les joueurs qui ont
  **eux-mêmes visité ce lieu en GPS dans les 30 dernières minutes**. On les coche.
- **Le nom de l'expédition** se choisit ; la fenêtre propose les noms des expéditions passées du
  joueur. Seul, pas de nom : la pilule porte son prénom.

*Pourquoi les compagnons viennent des visites récentes et non de la présence en direct (V1) :* la
V1 fait confiance à la liste envoyée par le téléphone et suit tout le monde en temps réel. Ici, le
serveur vérifie lui-même que chaque compagnon est bien passé sur place, et il n'y a plus de
suivi en direct à faire tourner.

## 6. La Curiosité

- **Ajouter** : troisième choix du « + » — *Un lieu · Un pin GPS · Une curiosité*. Position, une ou
  deux phrases, une photo facultative. Rien d'autre.
- **La toucher** : une petite feuille — le texte, la photo, qui l'a déposée — et un bouton
  **« Vu »**. On voit **qui l'a vue**, et on peut **y réagir** (le même geste de réaction que sur
  l'Accueil). **On ne peut pas la revendiquer** : ni pilule, ni expédition.
- **Modérée** comme les lieux, dans le Hub.

## 7. Ce que ça demande au back

On **réutilise les tables** de la V1 et on écrit **des fonctions neuves** pour la V2, qui lisent
`auth.uid()` (règle du dépôt) et ignorent tout ce qui touche aux factions, à la Cour, aux
Couronnes et aux points de compétition.

| Besoin | Fonction V2 (neuve) | Tables |
|---|---|---|
| Les lieux de la carte, avec mon état et la revendication | `carte_lieux()` | `places`, `place_explorers`, `place_veille`, `expeditions` |
| Visiter en GPS (200 m) | `visiter_lieu(p_place_id, lat, lng)` | `place_explorers`, `activity_log` |
| Mes compagnons possibles | `compagnons_de_visite(p_place_id)` | `place_explorers` (30 min) |
| Revendiquer, seul ou à plusieurs | `revendiquer_lieu(p_place_id, compagnons, nom)` | `expeditions`, `expedition_members`, `place_veille.veilleur_user_id`, `veille_history` |
| Mes noms d'expédition passés | `mes_noms_d_expedition()` | `expedition_members` ⋈ `expeditions.title` |
| Le territoire historique | table `territoires_historiques` (code département → nom) | — |
| La Curiosité | colonne `places.nature` (`lieu` \| `curiosite`), fonctions `voir_curiosite()`, `reagir_curiosite()` | `places`, tables `curiosites_vues`, réactions |
| Mes lieux en couleur | colonne de préférence | `users` |

- **Pas de faction exigée** (la V1 renvoie `no_faction`) : les colonnes `faction_id` de ces tables
  acceptent déjà `NULL` (vérifié le 28/09).
- **Pas de délai de 24 h** entre deux revendications, pas de bonus de Cour, pas de Couronnes.
- **La V1 tourne sur la même base** jusqu'à la bascule : une revendication V2 écrit `place_veille`,
  que la V1 affichera aussi. C'est voulu.
- Les expéditions « rendez-vous » de la V1 (`voyages`) sont un autre sujet, hors de cette spec.

## 8. Hors de cette spec

- Les parcours **Ajouter un lieu** et **Pin GPS** (leur propre spec) ; la fiche d'un lieu (sa maquette).
- L'Accueil, les Messages, le Campement.

## 9. Tester

- Les fonctions SQL, dans une transaction annulée (`BEGIN … ROLLBACK`), comme pour le Compte :
  visite trop loin / à portée / déjà faite ; revendication seule, à plusieurs, par un inconnu non
  passé sur place (refusée) ; noms d'expédition passés ; Curiosité « Vu », réaction, revendication refusée.
- L'écran, comparé à la maquette Figma à 390 px (règle du dépôt), à plat et incliné.
- **La fluidité, sur un vrai téléphone**, en dézoomant jusqu'à la France entière : c'est le critère
  qui a fait tomber la brume.
