# Les Actifs sur la carte

> Conception du 01/10/2026, validée par Uriel (« je valide tout »). Maquettes Figma :
> « Carte — les Explorateurs actifs » (362:182), « Carte — un Explorateur touché » (363:200, carte
> 366:236), « Carte — les Actifs autour de toi » (363:303).

## Pourquoi

La V1 montrait les joueurs connectés sur la carte, et soi-même. La V2 ne montre plus personne : la
carte paraît vide. Voir passer d'autres Explorateurs donne le sentiment de vie.

## Ce qu'on voit

- **Soi** : son portrait cerclé de rouge, un halo qui respire, l'étiquette « Toi », à sa vraie
  position (que soi seul voit). Pas de position, pas de marque.
- **Les autres Actifs** : leur portrait cerclé d'ocre et une étiquette « Nom · titre ».
- **Pistes brouillées** (`users.brouiller_pistes`, vrai par défaut) : une zone pointillée d'environ
  25 km (Uriel, 01/10 : 50 km, c'était trop), le portrait au centre, « quelque part par ici ». Jamais un faux point précis.
- **Parti depuis moins d'une heure** : le portrait reste, désaturé et transparent, avec « il y a
  23 min ». Au-delà d'une heure, il disparaît.
- **Tout le monde est montré**, sans groupes, portraits et noms à tout zoom (Uriel, 01/10 : même
  dézoomé au maximum, on voit les gens).
- **« X actifs »** à côté de la jauge d'énergie : en ligne et passés dans l'heure, soi exclu.

## Ce qu'on touche

- **Un portrait** ouvre la carte de l'Explorateur, centrée comme le profil : le fond parchemin, son
  signe (le Fragment choisi) en grand filigrane derrière le portrait, le nom, « titre · niveau N »,
  « sous le signe de X », « En ligne · à 12 km de toi » (ou « Il y a 23 min »), puis **Voir le
  profil** et **Envoyer un murmure**. Sans signe, le fond parchemin seul.
- **« X actifs »** ouvre la feuille « Les actifs autour de toi » : les plus proches d'abord,
  « En ligne » (point vert) ou « Il y a N min » (grisé), la distance (« ~ 40 km » si brouillé).
  Toucher une ligne ouvre la carte de l'Explorateur.

## Règles

- **En ligne** : vu depuis moins de 10 minutes. **Actif** : vu depuis moins d'une heure.
- La présence vient de `presences` (migration 365), que la V2 alimente chaque minute
  (`signaler_presence`) quand la position est autorisée. Les lignes vivent désormais une heure
  (elles en vivaient 10). Les compagnons (`_presents_autour`) gardent leur fenêtre de 10 minutes.
- **Le brouillage se fait dans la base** : on rend le centre de la case (environ 20 km) d'une grille
  dont l'origine est un secret de la base. On ne remonte pas au point sans le secret ; on ne voit pas
  bouger dans la case ; revenir chaque jour au même endroit redonne la même case (moyenner
  n'apprend rien). La zone de 25 km dessinée autour contient toujours la vraie position (le centre est à 15 km au plus). La vraie
  position ne sort jamais de la base. *(Relecture du 01/10 : un décalage tiré du jour et de
  l'identifiant se recalculait hors de la base, et révélait les déplacements.)*
- Pas de réglage « me cacher » pour l'instant (Uriel, 01/10) : le brouillage suffit.
- La carte relit les Actifs chaque minute.

## Hors périmètre

L'émoji lancé de la V1 (remplacé par le murmure). Le temps réel au-delà d'une relecture par minute.
