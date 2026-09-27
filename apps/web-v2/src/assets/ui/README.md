# assets/ui — les images de l'interface

**Posées en brut depuis la maquette Figma « App v2 »**, pour être refaites par Uriel. Pour
remplacer une image : écraser le fichier **sous le même nom**. Aucun code à toucher.

| Fichier                | Taille actuelle | Où il s'affiche                                            |
| ---------------------- | --------------- | ---------------------------------------------------------- |
| `fond-parchemin.png`   | 390 × 732 (1x)  | fond de tous les écrans — **à ré-exporter en @3x**         |
| `logotype.png`         | 2520 × 455      | bandeau, à gauche (affiché en 216 × 39)                    |
| `barre-lisiere.png`    | 1024 × 40       | lisière de forêt au-dessus de la barre d'onglets           |
| `onglet-accueil.png`   | 120 × 120       | icône de l'onglet Accueil (affichée en 24 px)              |
| `onglet-carte.png`     | 120 × 120       | icône de l'onglet Carte                                    |
| `onglet-messages.png`  | 122 × 175       | icône de l'onglet Messages                                 |
| `onglet-codex.png`     | 122 × 175       | icône de l'onglet Codex                                    |
| `onglet-campement.png` | 338 × 342       | icône de l'onglet Campement                                |
| `partager.svg`         | vectoriel       | exemple d'IconButton sur /v2/da (fiche lieu, « partager ») |

Les icônes d'onglets servent de **pochoir** : seule leur forme compte (la transparence), leur
couleur vient du jeton `--color-encre`. `onglet-carte.png` a été recalé (opacité 70 % → 100 %)
en attendant son remplacement par Uriel.

L'avatar n'a pas d'image par défaut : la maquette montre la photo d'Uriel, qui ne peut pas
servir à tout le monde. Tant que la zone Compte n'existe pas, c'est un cercle sable.
