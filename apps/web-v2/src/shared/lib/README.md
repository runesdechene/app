# lib — le calcul pur que plusieurs zones partagent

- `lire.ts` — les petits lecteurs du JSON renvoyé par les fonctions de la base : chacun rend la
  valeur attendue ou lève une erreur. Compte et Carte s'en servent.
- `couleursCarte.ts`, `styleCarte.ts` — la carte parchemin (le fond OpenFreeMap recoloré aux
  couleurs des jetons) : la Carte et l'étape « Où » de l'ajout d'un lieu la partagent.
