# components — la fiche d'un lieu à l'écran

Chaque composant a son `.module.css`. Aucun n'appelle Supabase : tout passe par `../hooks/`.

- `FicheLieu` — la fiche, dans l'ordre de la maquette 229:128.
- `BoutonVisite` — le bouton de visite et ses états (maquettes 230:128, 649:1776), et le lien « J'y suis allé ».
- `FeuilleJySuisAlle` — déclarer une visite passée : le mois, une photo, un mot (maquette 649:1678).
- `ParcoursRevendication` — après une visite sur place : la fête (`Recompense`), puis l'étendard, puis la conquête (spec 2026-10-21, maquettes 682:1720, 679:1676, 678:1676).
- `PlanteTonEtendard` — le nom de la revendication (mon nom, mes Compagnies, ou écrit), les Explorateurs présents, planter.
- `Conquete` — « Conquis ! » : l'étendard tombe et se plante, puis à qui on l'a pris et le rang.
- `BoutonAPortee` — sur la carte, « Marquer ma visite » quand un lieu est à portée (le Shell le pose).
- `FeuilleOptions`, `FeuillePartager` — « Ce lieu » et « Partager ce lieu » (maquettes 231:128, 236:128).
