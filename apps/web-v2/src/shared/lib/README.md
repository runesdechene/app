# lib — le calcul pur que plusieurs zones partagent

- `lire.ts` — les petits lecteurs du JSON renvoyé par les fonctions de la base : chacun rend la
  valeur attendue ou lève une erreur. Compte et Carte s'en servent.
- `couleursCarte.ts`, `styleCarte.ts` — la carte parchemin (le fond OpenFreeMap recoloré aux
  couleurs des jetons) : la Carte et l'étape « Où » de l'ajout d'un lieu la partagent.
- `attente.ts` — une attente lisible (« 23 min », « 1 h 24 ») : la jauge d'énergie et le voile de
  découverte disent quand revient le prochain point.
- `ancienneExplore.ts` — choisir la V1 (cookie `explore_version`) et y revenir : toute sortie vers la V1
  passe par là, sinon la V1 renvoie aussitôt vers la V2.
