# components — les écrans de la zone Compte

- `MenuAvatar` — la feuille ouverte par l'avatar.
- `ProfilExplorateur` — le profil public ; ses états chargement / erreur / introuvable.
  - `ProfilEntete` — badges, portrait, nom, niveau, signe (filigrane), titres (origine au
    toucher), présentation, attache, bouton.
  - `ProfilFragments` — ses Fragments ; sur son profil, choisir son signe.
  - `ProfilDecouvertes` — sections Lieux ajoutés / Visités / Envie d'y aller, en lignes qui défilent.
  - `LieuCarte` — une carte de lieu : photo, nom, distance (si position), catégorie, auteur.
  - `ExplorateurIntrouvable` — l'adresse d'un Explorateur qui n'existe pas.
- `ModifierProfil` — le formulaire du profil ; ne s'affiche qu'une fois tout chargé.
- `PreferencesPage` — les trois cartes de réglages.
- `BadgesExplorateur` — « Porteur vérifié » et le rôle, à droite du titre du détail.
