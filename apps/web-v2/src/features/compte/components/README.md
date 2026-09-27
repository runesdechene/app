# components — les écrans de la zone Compte

- `MenuAvatar` — la feuille ouverte par l'avatar.
- `ProfilExplorateur` — le profil public ; ses états chargement / erreur / introuvable.
  - `ProfilEntete` — couverture du signe, portrait, nom, niveau, titres en une ligne (origine
    au toucher), présentation, attache, bouton.
  - `ProfilChiffres` — le bandeau : lieux ajoutés, visités, fragments.
  - `ProfilFragments` — les Fragments collectés sur une ligne ; sur son profil, choisir son
    signe et « + N à découvrir » vers le Codex.
  - `ProfilDecouvertes` — sections Lieux ajoutés / Visités / Envie d'y aller, en lignes qui défilent.
  - `LieuCarte` — grande carte photo : nom posé dessus, catégorie, distance (si position), auteur.
  - `ExplorateurIntrouvable` — l'adresse d'un Explorateur qui n'existe pas.
- `ModifierProfil` — le formulaire du profil ; ne s'affiche qu'une fois tout chargé.
- `PreferencesPage` — les trois cartes de réglages.
- `BadgesExplorateur` — « Porteur vérifié » et le rôle, à droite du titre du détail.
