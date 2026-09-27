# 006 — Tout état navigable est une URL

**Date :** 2026-09-27 · **Statut :** adoptée

## Contexte
L'app est mobile d'abord et doit l'être de façon exemplaire : bouton retour Android, glissement
iOS, liens partagés, rechargement. Elle doit aussi avoir une édition desktop proche de la V1.

## Décision
- Chaque onglet, fiche ou détail a son adresse. Le retour est celui du navigateur : aucune pile
  de navigation maison.
- Premier segment de l'URL = l'onglet (`/carte`) ; ce qui suit = un détail (`/carte/compte`).
- Les cinq écrans racines **restent montés** ; seul l'actif est visible. Leur état et leur
  défilement survivent au changement d'onglet sans aucun code de restauration.
- Changer d'onglet ajoute une entrée d'historique ; chaque onglet se souvient de sa dernière
  adresse ; toucher l'onglet actif remonte à sa racine, puis en haut.
- Fermer un détail ouvert à froid (lien partagé) remplace par la racine de l'onglet : on ne
  quitte jamais l'app en fermant une fiche.
- Une même route, deux mises en page, choisies par CSS à 1024 px : mobile (barre basse, détail
  plein écran), desktop (onglets dans le bandeau, détail en panneau à gauche, comme la V1).

## Écarté
- **Une pile de navigation maison** (écrans empilés en état React) — casse le retour système,
  les liens et le rechargement.
- **Démonter l'écran quitté et restaurer son défilement** — du code de restauration fragile là
  où garder l'écran monté suffit.
- **Détecter l'appareil en JavaScript** — la mise en page suit la largeur, jamais l'appareil.

## Conséquences
- Toute future adresse d'écran commence par son onglet.
- Cinq écrans montés en permanence : un écran lourd (la Carte) devra charger paresseusement son
  contenu tant qu'il est caché.
